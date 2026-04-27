import { buildAdminApiPath, buildQueryParams, buildQueryString, fetchLocalizedPageJson, fetchPageJson, postAdminJson } from "./core";
import type { IpWhitelistPagePayload } from "./opsTypes";
import type {
  AccessHistoryPagePayload,
  BlocklistPagePayload,
  ErrorLogPagePayload,
  LoginHistoryPagePayload,
  MenuPermissionAutoCleanupResponse,
  SecurityAuditPagePayload,
  SecurityHistoryActionResponse,
  SecurityMonitoringPagePayload,
  SecurityPolicyPagePayload
} from "./securityTypes";

type SecurityQueryParams = Record<string, string | number | boolean | null | undefined>;

function buildSecurityAdminUrl(
  path: string,
  params?: SecurityQueryParams
) {
  return `${buildAdminApiPath(path)}${buildQueryString(params)}`;
}

function buildSecurityPageUrl(
  path: string,
  params?: SecurityQueryParams
) {
  return `${path}${buildQueryString(params)}`;
}

function createSecurityPageErrorResolver<T extends Record<string, unknown>>(
  fallbackMessage: string,
  errorKey: keyof T & string
) {
  return (body: T, status: number) => String(body[errorKey] || `${fallbackMessage}: ${status}`);
}

async function fetchAdminPageJson<T>(path: string, params?: SecurityQueryParams) {
  return fetchPageJson<T>(buildSecurityAdminUrl(path, params));
}

async function fetchSecurityPageJson<T>(
  path: string,
  params?: SecurityQueryParams,
  fallbackMessage?: string,
  resolveError?: (body: T, status: number) => string
) {
  return fetchPageJson<T>(buildSecurityPageUrl(path, params), {
    fallbackMessage,
    resolveError
  });
}

async function fetchLocalizedSecurityPageJson<T>(
  koPath: string,
  enPath: string,
  params?: SecurityQueryParams,
  fallbackMessage?: string,
  resolveError?: (body: T, status: number) => string
) {
  return fetchLocalizedPageJson<T>(koPath, enPath, {
    query: buildQueryParams(params),
    fallbackMessage,
    resolveError
  });
}

async function postSecurityAction<T extends { success?: boolean; message?: string }>(
  path: string,
  payload?: Record<string, unknown>
): Promise<T> {
  const body = await postAdminJson<T>(path, payload || {});
  if (body.success === false) {
    throw new Error(String(body.message || `Failed to process security action: ${path}`));
  }
  return body;
}

export async function fetchLoginHistoryPage(params?: { pageIndex?: number; searchKeyword?: string; userSe?: string; loginResult?: string; insttId?: string; }) {
  return fetchAdminPageJson<LoginHistoryPagePayload>(
    "/api/admin/member/login-history/page",
    params
  );
}

export async function fetchAccessHistoryPage(params?: { pageIndex?: number; searchKeyword?: string; insttId?: string; }) {
  const fallbackMessage = "Failed to load access history page";
  return fetchLocalizedSecurityPageJson<AccessHistoryPagePayload>(
    "/admin/system/access_history/page-data",
    "/en/admin/system/access_history/page-data",
    params,
    fallbackMessage,
    createSecurityPageErrorResolver<AccessHistoryPagePayload>(fallbackMessage, "accessHistoryError")
  );
}

export async function fetchErrorLogPage(params?: { pageIndex?: number; searchKeyword?: string; insttId?: string; sourceType?: string; errorType?: string; }) {
  const fallbackMessage = "Failed to load error log page";
  return fetchLocalizedSecurityPageJson<ErrorLogPagePayload>(
    "/admin/system/error-log/page-data",
    "/en/admin/system/error-log/page-data",
    params,
    fallbackMessage,
    createSecurityPageErrorResolver<ErrorLogPagePayload>(fallbackMessage, "errorLogError")
  );
}

export async function fetchIpWhitelistPage(params?: { searchIp?: string; accessScope?: string; status?: string; }) {
  return fetchLocalizedSecurityPageJson<IpWhitelistPagePayload>(
    "/admin/system/ip_whitelist/page-data",
    "/en/admin/system/ip_whitelist/page-data",
    params,
    "Failed to load IP whitelist page"
  );
}

export async function decideIpWhitelistRequest(payload: Record<string, unknown>) {
  return postSecurityAction<{ success?: boolean; message?: string; requestId?: string } & Record<string, unknown>>(
    "/api/admin/system/ip-whitelist/request-decision",
    payload
  );
}

export async function fetchSecurityHistoryPage(params?: { pageIndex?: number; searchKeyword?: string; userSe?: string; insttId?: string; actionStatus?: string; }) {
  const fallbackMessage = "Failed to load security history page";
  return fetchSecurityPageJson<LoginHistoryPagePayload>(
    "/admin/system/security/page-data",
    params,
    fallbackMessage,
    createSecurityPageErrorResolver<LoginHistoryPagePayload>(fallbackMessage, "loginHistoryError")
  );
}

export async function fetchMemberSecurityHistoryPage(params?: { pageIndex?: number; searchKeyword?: string; userSe?: string; insttId?: string; actionStatus?: string; }) {
  const fallbackMessage = "Failed to load member security history page";
  return fetchLocalizedSecurityPageJson<LoginHistoryPagePayload>(
    "/admin/member/security/page-data",
    "/en/admin/member/security/page-data",
    params,
    fallbackMessage,
    createSecurityPageErrorResolver<LoginHistoryPagePayload>(fallbackMessage, "loginHistoryError")
  );
}

export async function saveSecurityHistoryAction(payload: Record<string, unknown>) {
  return postSecurityAction<SecurityHistoryActionResponse>("/api/admin/system/security-history/action", payload);
}

export async function fetchSecurityPolicyPage() {
  return fetchSecurityPageJson<SecurityPolicyPagePayload>(
    "/admin/system/security-policy/page-data",
    undefined,
    "Failed to load security policy page"
  );
}

export async function fetchNotificationPage(params?: {
  deliveryChannel?: string;
  deliveryStatus?: string;
  deliveryKeyword?: string;
  deliveryPage?: number;
  activityAction?: string;
  activityKeyword?: string;
  activityPage?: number;
}) {
  return fetchLocalizedSecurityPageJson<SecurityPolicyPagePayload>(
    "/admin/system/notification/page-data",
    "/en/admin/system/notification/page-data",
    {
      deliveryChannel: params?.deliveryChannel,
      deliveryStatus: params?.deliveryStatus,
      deliveryKeyword: params?.deliveryKeyword,
      deliveryPage: params?.deliveryPage && params.deliveryPage > 1 ? params.deliveryPage : undefined,
      activityAction: params?.activityAction,
      activityKeyword: params?.activityKeyword,
      activityPage: params?.activityPage && params.activityPage > 1 ? params.activityPage : undefined
    },
    "Failed to load notification page"
  );
}

export async function runMenuPermissionAutoCleanup(menuUrls?: string[]) {
  return postSecurityAction<MenuPermissionAutoCleanupResponse>(
    "/api/admin/system/menu-permission-diagnostics/auto-cleanup",
    { menuUrls: menuUrls || [] }
  );
}

export async function saveSecurityPolicyFindingState(payload: Record<string, unknown>) {
  return postSecurityAction<Record<string, unknown> & { success?: boolean; message?: string }>(
    "/api/admin/system/security-policy/state",
    payload
  );
}

export async function clearSecurityPolicySuppressions() {
  return postSecurityAction<Record<string, unknown> & { success?: boolean; message?: string }>(
    "/api/admin/system/security-policy/clear-suppressions",
    {}
  );
}

export async function runSecurityPolicyAutoFix(payload: Record<string, unknown>) {
  return postSecurityAction<Record<string, unknown> & { success?: boolean; message?: string }>(
    "/api/admin/system/security-policy/auto-fix",
    payload
  );
}

export async function runSecurityPolicyBulkAutoFix(payload: Record<string, unknown>) {
  return postSecurityAction<Record<string, unknown> & { success?: boolean; message?: string }>(
    "/api/admin/system/security-policy/auto-fix-bulk",
    payload
  );
}

export async function saveSecurityPolicyNotificationConfig(payload: Record<string, unknown>) {
  return postSecurityAction<Record<string, unknown> & { success?: boolean; message?: string }>(
    "/api/admin/system/security-policy/notification-config",
    payload
  );
}

export async function runSecurityPolicyRollback(payload: Record<string, unknown>) {
  return postSecurityAction<Record<string, unknown> & { success?: boolean; message?: string }>(
    "/api/admin/system/security-policy/rollback",
    payload
  );
}

export async function dispatchSecurityPolicyNotifications(payload: Record<string, unknown>) {
  return postSecurityAction<Record<string, unknown> & { success?: boolean; message?: string }>(
    "/api/admin/system/security-policy/dispatch",
    payload
  );
}

export async function fetchSecurityMonitoringPage() {
  return fetchSecurityPageJson<SecurityMonitoringPagePayload>(
    "/admin/system/security-monitoring/page-data",
    undefined,
    "Failed to load security monitoring page"
  );
}

export async function saveSecurityMonitoringState(payload: Record<string, unknown>) {
  return postSecurityAction<Record<string, unknown> & { success?: boolean; message?: string }>(
    "/api/admin/system/security-monitoring/state",
    payload
  );
}

export async function registerSecurityMonitoringBlockCandidate(payload: Record<string, unknown>) {
  return postSecurityAction<Record<string, unknown> & { success?: boolean; message?: string }>(
    "/api/admin/system/security-monitoring/block-candidates",
    payload
  );
}

export async function updateSecurityMonitoringBlockCandidate(payload: Record<string, unknown>) {
  return postSecurityAction<Record<string, unknown> & { success?: boolean; message?: string }>(
    "/api/admin/system/security-monitoring/block-candidates/state",
    payload
  );
}

export async function dispatchSecurityMonitoringNotification(payload: Record<string, unknown>) {
  return postSecurityAction<Record<string, unknown> & { success?: boolean; message?: string }>(
    "/api/admin/system/security-monitoring/notify",
    payload
  );
}

export async function fetchBlocklistPage(params?: { searchKeyword?: string; blockType?: string; status?: string; source?: string; }) {
  return fetchSecurityPageJson<BlocklistPagePayload>(
    "/admin/system/blocklist/page-data",
    params,
    "Failed to load blocklist page"
  );
}

export async function fetchSecurityAuditPage(params?: {
  pageIndex?: number;
  searchKeyword?: string;
  actionType?: string;
  routeGroup?: string;
  startDate?: string;
  endDate?: string;
  sortKey?: string;
  sortDirection?: string;
}) {
  return fetchSecurityPageJson<SecurityAuditPagePayload>(
    "/admin/system/security-audit/page-data",
    {
      pageIndex: params?.pageIndex && params.pageIndex > 1 ? params.pageIndex : undefined,
      searchKeyword: params?.searchKeyword,
      actionType: params?.actionType && params.actionType !== "ALL" ? params.actionType : undefined,
      routeGroup: params?.routeGroup && params.routeGroup !== "ALL" ? params.routeGroup : undefined,
      startDate: params?.startDate,
      endDate: params?.endDate,
      sortKey: params?.sortKey && params.sortKey !== "AUDIT_AT" ? params.sortKey : undefined,
      sortDirection: params?.sortDirection && params.sortDirection !== "DESC" ? params.sortDirection : undefined
    },
    "Failed to load security audit page"
  );
}
