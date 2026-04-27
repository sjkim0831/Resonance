import { useEffect, useMemo, useState } from "react";
import { preloadPageModule } from "../routes/pageRegistry";
import {
  buildRuntimeRequestPath,
  getCurrentRuntimeLocationState,
  type ManagedRuntimeRoute,
  parseLocationState,
  resolveCanonicalRuntimePath,
  resolveManagedRuntimeHref,
  resolvePageFromPath
} from "../routes/runtime";
import { getNavigationEventName, navigate, replace } from "../../lib/navigation/runtime";
import { prefetchRouteBootstrap, prefetchRoutePageData } from "../../lib/api/appBootstrap";

export function useRuntimeNavigation() {
  const [locationState, setLocationState] = useState(getCurrentRuntimeLocationState);
  const [routeLoading, setRouteLoading] = useState(false);
  const location = useMemo(() => parseLocationState(locationState), [locationState]);
  const page = useMemo(() => resolvePageFromPath(location.pathname), [location.pathname]);
  const currentRoutePath = useMemo(
    () => buildRuntimeRequestPath(location.pathname, location.search),
    [location.pathname, location.search]
  );

  useEffect(() => {
    const canonicalPath = resolveCanonicalRuntimePath();
    if (canonicalPath && canonicalPath !== currentRoutePath) {
      replace(canonicalPath);
    }
  }, [currentRoutePath]);

  useEffect(() => {
    void preloadPageModule(page);
  }, [page]);

  useEffect(() => {
    function syncLocation() {
      setLocationState(getCurrentRuntimeLocationState());
      setRouteLoading(false);
    }

    async function handleReactNavigation(nextRoute: ManagedRuntimeRoute) {
      setRouteLoading(true);
      try {
        await Promise.all([
          prefetchRouteBootstrap(nextRoute.pageId, nextRoute.routePath),
          preloadPageModule(nextRoute.pageId),
          prefetchRoutePageData(nextRoute.pageId, nextRoute.search).catch(() => undefined)
        ]);
      } finally {
        navigate(nextRoute.locationState);
      }
    }

    function handleDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented) {
        return;
      }
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.hasAttribute("download") || anchor.target === "_blank") {
        return;
      }
      const managedRoute = resolveManagedRuntimeHref(anchor.href);
      if (!managedRoute) {
        return;
      }
      event.preventDefault();
      void handleReactNavigation(managedRoute);
    }

    window.addEventListener("popstate", syncLocation);
    window.addEventListener(getNavigationEventName(), syncLocation);
    document.addEventListener("click", handleDocumentClick);
    return () => {
      window.removeEventListener("popstate", syncLocation);
      window.removeEventListener(getNavigationEventName(), syncLocation);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  return {
    locationState,
    location,
    page,
    routeLoading,
    setRouteLoading
  };
}
