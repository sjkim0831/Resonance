declare global {
  interface Window {
    __CARBONET_REACT_MIGRATION__?: {
      route?: string;
      locale?: string;
      admin?: boolean;
      devUrl?: string;
      prodJs?: string;
    };
    __CARBONET_REACT_BOOTSTRAP__?: {
      frontendSession?: unknown;
      adminMenuTree?: unknown;
      adminHomePageData?: unknown;
      authGroupPageData?: unknown;
      authChangePageData?: unknown;
      deptRolePageData?: unknown;
      memberEditPageData?: unknown;
      homePayload?: unknown;
      mypagePayload?: unknown;
      mypageContext?: unknown;
      memberStatsPageData?: unknown;
      tradeListPageData?: unknown;
      tradeStatisticsPageData?: unknown;
      tradeDuplicatePageData?: unknown;
      refundListPageData?: unknown;
      settlementCalendarPageData?: unknown;
      tradeApprovePageData?: unknown;
      certificateReviewPageData?: unknown;
      securityPolicyPageData?: unknown;
      notificationPageData?: unknown;
      securityMonitoringPageData?: unknown;
      securityAuditPageData?: unknown;
      certificateAuditLogPageData?: unknown;
      certificateRecCheckPageData?: unknown;
      schedulerManagementPageData?: unknown;
      backupConfigPageData?: unknown;
      emissionResultListPageData?: unknown;
      emissionResultDetailPageData?: unknown;
      certificateStatisticsPageData?: unknown;
      emissionDataHistoryPageData?: unknown;
      emissionDefinitionStudioPageData?: unknown;
      emissionSiteManagementPageData?: unknown;
      emissionValidatePageData?: unknown;
      screenBuilderPageData?: unknown;
    };
  }
}

const NAVIGATION_EVENT = "carbonet:navigate";

function isEnglishPath(pathname: string): boolean {
  return pathname.startsWith("/en/")
    || pathname === "/join/en"
    || pathname.startsWith("/join/en/");
}

function normalizeAdminRootPath(path: string): string {
  if (!path) {
    return path;
  }
  return path
    .replace(/^\/admin\/([?#]|$)/, "/admin$1")
    .replace(/^\/en\/admin\/([?#]|$)/, "/en/admin$1");
}

function resolveNavigationUrl(path: string): URL {
  return new URL(normalizeAdminRootPath(path), window.location.origin);
}

export function getRuntimeLocale(): "ko" | "en" {
  const locale = window.__CARBONET_REACT_MIGRATION__?.locale;
  return locale === "en" || document.documentElement.lang === "en" || isEnglishPath(window.location.pathname)
    ? "en"
    : "ko";
}

export function isEnglish(): boolean {
  return getRuntimeLocale() === "en";
}

export function isAdminContext(): boolean {
  const flag = window.__CARBONET_REACT_MIGRATION__?.admin;
  if (typeof flag === "boolean") {
    return flag;
  }
  return window.location.pathname.includes("/admin/");
}

export function getSearchParam(name: string): string {
  return new URLSearchParams(window.location.search).get(name)?.trim() || "";
}

export function buildLocalizedPath(koPath: string, enPath: string): string {
  return normalizeAdminRootPath(isEnglish() ? enPath : koPath);
}

export function navigate(path: string) {
  const nextUrl = resolveNavigationUrl(path);
  const currentUrl = new URL(window.location.href);
  if (isEnglishPath(nextUrl.pathname) !== isEnglishPath(currentUrl.pathname)) {
    window.location.href = nextUrl.toString();
    return;
  }
  if (nextUrl.origin !== currentUrl.origin) {
    window.location.href = nextUrl.toString();
    return;
  }
  if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search && nextUrl.hash === currentUrl.hash) {
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
    return;
  }
  window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function replace(path: string) {
  const nextUrl = resolveNavigationUrl(path);
  window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function getNavigationEventName() {
  return NAVIGATION_EVENT;
}

export function getCsrfMeta() {
  const token = document.querySelector('meta[name="_csrf"]')?.getAttribute("content")
    || (document.getElementById("admin-csrf-token") as HTMLInputElement | null)?.value
    || "";
  const headerName = document.querySelector('meta[name="_csrf_header"]')?.getAttribute("content")
    || (document.getElementById("admin-csrf-header") as HTMLInputElement | null)?.value
    || "X-CSRF-TOKEN";
  return { token, headerName };
}
