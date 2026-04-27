import { normalizeRegistryPath } from "../../framework/registry/pathNormalization";
import { createRuntimePathRegistry } from "../../framework/registry/runtimePathRegistry";
import { getRuntimeLocale } from "../../lib/navigation/runtime";
import {
  ALL_ROUTE_DEFINITIONS,
  DEFAULT_ADMIN_ROUTE,
  DEFAULT_PAGE_ROUTE,
  findRouteOwnershipTraceByPath,
  getRouteOwnershipTrace
} from "./routeCatalog";
import type { MigrationPageId } from "./routeCatalog";
import { getRouteDefinition, normalizeRouteId } from "./definitions";

type RuntimePathContext = {
  normalizedPath: string;
  normalizedKoPath: string;
  isReactShellPath: boolean;
  specialCasePage: MigrationPageId | null;
  matchedRouteId: MigrationPageId | "";
};

export type ManagedRuntimeRoute = {
  pageId: MigrationPageId;
  pathname: string;
  search: string;
  hash: string;
  routePath: string;
  locationState: string;
};

export type ManagedRuntimeTransitionState = ManagedRuntimeRoute & {
  familyId: string;
  ownershipLane: string;
  installScope: string;
  canonicalRoute: string;
  menuCode: string;
};

type CurrentRuntimeLocation = Pick<Location, "pathname" | "search" | "hash">;

const REACT_SHELL_PATHS = [
  "/app",
  "/en/app",
  "/admin/app",
  "/en/admin/app"
] as const;
const PLATFORM_SPECIAL_CASE_PREFIXES = [
  ["/admin/system/unified_log", "unified-log"]
] as const satisfies ReadonlyArray<readonly [string, MigrationPageId]>;
const APP_SPECIAL_CASE_PAGES = [
  ["/admin/member/withdrawn", "member-list"],
  ["/admin/member/activate", "member-list"],
  ["/admin/system/menu", "menu-management"],
  ["/admin/system/menu-management", "menu-management"],
  ["/admin/content/menu", "faq-menu-management"],
  ["/signin/findId/overseas", "signin-find-id"],
  ["/signin/findPassword/overseas", "signin-find-password"],
  ["/co2/credit", "co2-credit"]
] as const satisfies ReadonlyArray<readonly [string, MigrationPageId]>;
const APP_ROUTE_ALIASES = [
  ["/admin/trade/list", "trade-list"],
  ["/en/admin/trade/list", "trade-list"],
  ["/trade/matching", "co2-search"],
  ["/en/trade/matching", "co2-search"],
  ["/monitoring/esg", "monitoring-statistics"],
  ["/en/monitoring/esg", "monitoring-statistics"],
  ["/payment/detail", "payment-history"],
  ["/en/payment/detail", "payment-history"],
  ["/payment/refund_account", "payment-refund-account"],
  ["/en/payment/refund_account", "payment-refund-account"],
  ["/payment/refundAccount", "payment-refund-account"],
  ["/en/payment/refundAccount", "payment-refund-account"]
] as const satisfies ReadonlyArray<readonly [string, MigrationPageId]>;

const REACT_SHELL_PATH_SET = new Set<string>(REACT_SHELL_PATHS);
const APP_SPECIAL_CASE_PAGE_MAP = new Map<string, MigrationPageId>(APP_SPECIAL_CASE_PAGES);

const runtimePathRegistry = createRuntimePathRegistry(ALL_ROUTE_DEFINITIONS, APP_ROUTE_ALIASES);

export function buildRuntimeRequestPath(pathname: string, search = ""): string {
  return `${pathname}${search}`;
}

export function buildRuntimeLocationState(pathname: string, search = "", hash = ""): string {
  return `${pathname}${search}${hash}`;
}

function getCurrentRuntimeLocation(): CurrentRuntimeLocation {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash
  };
}

export function getCurrentRuntimeRequestPath(): string {
  const { pathname, search } = getCurrentRuntimeLocation();
  return buildRuntimeRequestPath(pathname, search);
}

export function getCurrentRuntimePathname(): string {
  return getCurrentRuntimeLocation().pathname;
}

export function getCurrentRuntimeSearch(): string {
  return getCurrentRuntimeLocation().search;
}

export function getCurrentRuntimeHash(): string {
  return getCurrentRuntimeLocation().hash;
}

export function getCurrentRuntimeLocationState(): string {
  const { pathname, search, hash } = getCurrentRuntimeLocation();
  return buildRuntimeLocationState(pathname, search, hash);
}

export function getCurrentRuntimeHref(): string {
  return window.location.href;
}

export function getCurrentBootstrappedRouteId(): string {
  return window.__CARBONET_REACT_MIGRATION__?.route || "";
}

export function reloadCurrentRuntime() {
  window.location.reload();
}

export function navigateToRuntimeHref(href: string) {
  window.location.assign(href);
}

function resolveRuntimeUrl(href: string): URL {
  return new URL(href, window.location.origin);
}

function buildManagedRuntimeRoute(url: Pick<URL, "pathname" | "search" | "hash">): ManagedRuntimeRoute {
  const transitionState = buildManagedRuntimeTransitionState(url.pathname, url.search, url.hash);
  return {
    pageId: transitionState.pageId,
    pathname: transitionState.pathname,
    search: transitionState.search,
    hash: transitionState.hash,
    routePath: transitionState.routePath,
    locationState: transitionState.locationState
  };
}

export function buildManagedRuntimeTransitionState(
  pathname: string,
  search = "",
  hash = ""
): ManagedRuntimeTransitionState {
  const pageId = resolvePageFromPath(pathname);
  const ownershipTrace = findRouteOwnershipTraceByPath(pathname) || getRouteOwnershipTrace(pageId);
  return {
    pageId,
    pathname,
    search,
    hash,
    routePath: buildRuntimeRequestPath(pathname, search),
    locationState: buildRuntimeLocationState(pathname, search, hash),
    familyId: ownershipTrace.familyId,
    ownershipLane: ownershipTrace.ownershipLane,
    installScope: ownershipTrace.installScope,
    canonicalRoute: ownershipTrace.canonicalRoute,
    menuCode: ownershipTrace.menuCode
  };
}

export function resolveManagedRuntimeHref(href: string): ManagedRuntimeRoute | null {
  const url = resolveRuntimeUrl(href);
  if (url.origin !== window.location.origin || !isReactManagedPath(url.pathname)) {
    return null;
  }
  return buildManagedRuntimeRoute(url);
}

export function resolveRuntimeRoutePath(routePath: string): ManagedRuntimeRoute {
  return buildManagedRuntimeRoute(resolveRuntimeUrl(routePath));
}

function resolveRuntimePathContext(pathname: string): RuntimePathContext {
  const normalizedPath = normalizeRegistryPath(pathname);
  const normalizedKoPath = normalizeRegistryPath(normalizedPath.replace(/^\/en/, "") || "/home");
  let specialCasePage = APP_SPECIAL_CASE_PAGE_MAP.get(normalizedKoPath) || null;

  for (const [prefix, pageId] of PLATFORM_SPECIAL_CASE_PREFIXES) {
    if (normalizedKoPath === prefix || normalizedKoPath.startsWith(`${prefix}/`)) {
      specialCasePage = pageId;
      break;
    }
  }

  const matched = runtimePathRegistry.getByPath(normalizedKoPath) || runtimePathRegistry.getByPath(normalizedPath);

  return {
    normalizedPath,
    normalizedKoPath,
    isReactShellPath: REACT_SHELL_PATH_SET.has(normalizedPath),
    specialCasePage,
    matchedRouteId: matched ? normalizeRouteId(matched) : ""
  };
}

function isReactManagedPath(pathname: string): boolean {
  const { isReactShellPath, specialCasePage, matchedRouteId } = resolveRuntimePathContext(pathname);
  if (isReactShellPath) {
    return true;
  }
  if (specialCasePage) {
    return true;
  }
  return !!matchedRouteId;
}

export function resolveCanonicalRuntimePath(): string {
  const { pathname, search } = getCurrentRuntimeLocation();
  const { isReactShellPath } = resolveRuntimePathContext(pathname);
  if (!isReactShellPath) {
    return "";
  }

  const params = new URLSearchParams(search);
  const route = normalizeRouteId(params.get("route") || getCurrentBootstrappedRouteId());
  if (!route) {
    return "";
  }
  const matched = getRouteDefinition(route);
  if (!matched) {
    return "";
  }

  params.delete("route");
  params.delete("content");
  params.delete("language");

  const basePath = getRuntimeLocale() === "en" ? matched.enPath : matched.koPath;
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function resolvePageFromPath(pathname: string): MigrationPageId {
  const { normalizedPath, specialCasePage, matchedRouteId } = resolveRuntimePathContext(pathname);
  if (specialCasePage) {
    return specialCasePage;
  }
  if (matchedRouteId) {
    return matchedRouteId;
  }
  if (normalizedPath.startsWith("/admin") || normalizedPath.startsWith("/en/admin")) {
    return DEFAULT_ADMIN_ROUTE;
  }
  return DEFAULT_PAGE_ROUTE;
}

export function parseLocationState(locationState: string) {
  const url = resolveRuntimeUrl(locationState || getCurrentRuntimeLocationState());
  return {
    pathname: url.pathname,
    search: url.search,
    hash: url.hash
  };
}

export function parseManagedRuntimeTransitionState(locationState: string): ManagedRuntimeTransitionState {
  const parsed = parseLocationState(locationState);
  return buildManagedRuntimeTransitionState(parsed.pathname, parsed.search, parsed.hash);
}
