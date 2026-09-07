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
  const loginOnly = page === "signin-login" || page === "admin-login";
  const session = useFrontendSession({ enabled: authenticationRequired || loginOnly, revalidate: true });
  const loginPath = useMemo(() => buildLoginPath(page, routePath), [page, routePath]);

  useEffect(() => {
    if (!loginOnly || session.loading || session.error || session.value?.authenticated !== true) return;
    const destination = session.value.canEnterAdminConsole ? "/admin" : "/home";
    window.location.replace(isEnglish() ? `/en${destination}` : destination);
  }, [loginOnly, session.loading, session.error, session.value?.authenticated, session.value?.canEnterAdminConsole]);

  useEffect(() => {
    if (!authenticationRequired || session.loading || session.error || session.value?.authenticated !== false) {
      return;
    }
    window.location.replace(loginPath);
  }, [authenticationRequired, loginPath, session.loading, session.error, session.value?.authenticated]);

  if (!authenticationRequired && !loginOnly) {
    return children;
  }
  if (session.error) {
    return <main className="flex min-h-[40vh] items-center justify-center bg-slate-50 p-6"><section className="max-w-lg rounded-xl border bg-white p-6" role="alert"><h1 className="font-black">로그인 상태를 확인하지 못했습니다</h1><p className="mt-3">일시적인 통신 오류를 로그아웃으로 처리하지 않았습니다. 잠시 후 다시 확인해 주세요.</p><button type="button" className="mt-4 min-h-11 rounded-lg bg-blue-700 px-4 text-white" onClick={()=>void session.reload()}>로그인 상태 다시 확인</button></section></main>;
  }
  if (session.loading || !session.value || (loginOnly ? session.value.authenticated !== false : !session.value.authenticated)) {
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
