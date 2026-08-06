import { type ReactNode, useEffect, useMemo } from "react";
import { useFrontendSession } from "../hooks/useFrontendSession";
import { isEnglish } from "../../lib/navigation/runtime";
import { getRouteAuthorityScope, type MigrationPageId } from "./routeCatalog";
import { getRouteDefinition } from "./definitions";

type RouteAuthenticationBoundaryProps = {
  children: ReactNode;
  page: MigrationPageId;
  routePath: string;
};

export function requiresRouteAuthentication(page: MigrationPageId): boolean {
  return !getRouteAuthorityScope(page).actorFamily.startsWith("PUBLIC_");
}

function buildLoginPath(page: MigrationPageId, routePath: string): string {
  const definition = getRouteDefinition(page);
  const loginPath = definition?.group === "admin" ? "/admin/login/loginView" : "/signin/loginView";
  const localizedLoginPath = isEnglish() ? `/en${loginPath}` : loginPath;
  return `${localizedLoginPath}?${new URLSearchParams({ returnUrl: routePath })}`;
}

export function RouteAuthenticationBoundary({ children, page, routePath }: RouteAuthenticationBoundaryProps) {
  const authenticationRequired = useMemo(() => requiresRouteAuthentication(page), [page]);
  const session = useFrontendSession({ enabled: authenticationRequired });
  const loginPath = useMemo(() => buildLoginPath(page, routePath), [page, routePath]);

  useEffect(() => {
    if (!authenticationRequired || session.loading || session.value?.authenticated) {
      return;
    }
    window.location.replace(loginPath);
  }, [authenticationRequired, loginPath, session.loading, session.value?.authenticated]);

  if (!authenticationRequired) {
    return children;
  }
  if (session.loading || !session.value?.authenticated) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center bg-[var(--kr-gov-bg-gray,#f5f7fa)] px-4" role="status">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-sm font-black text-[var(--kr-gov-text-primary,#1e2124)]">
            {isEnglish() ? "Checking access permissions." : "접근 권한을 확인하고 있습니다."}
          </p>
          <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary,#555)]">
            {isEnglish() ? "You will be redirected to sign in when required." : "로그인이 필요하면 로그인 화면으로 이동합니다."}
          </p>
        </div>
      </main>
    );
  }
  return children;
}
