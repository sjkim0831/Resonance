import { buildLocalizedPath } from "../navigation/runtime";
import { buildQueryParams, buildQueryString, fetchLocalizedPageJson, fetchPageJson, postJson } from "./core";
import type {
  BackupConfigPagePayload,
  BatchManagementPagePayload,
  CertificateAuditLogPagePayload,
  DbSyncDeployPagePayload,
  DbPromotionPolicyPagePayload,
  ExternalConnectionFormPagePayload,
  ExternalConnectionListPagePayload,
  ExternalKeysPagePayload,
  ExternalLogsPagePayload,
  ExternalMaintenancePagePayload,
  ExternalMonitoringPagePayload,
  ExternalRetryPagePayload,
  ExternalSchemaPagePayload,
  ExternalSyncPagePayload,
  ExternalUsagePagePayload,
  ExternalWebhooksPagePayload,
  OperationsCenterPagePayload,
  ProjectRuntimeRegistryPayload,
  PerformancePagePayload,
  SchedulerManagementPagePayload,
  SensorListPagePayload
} from "./opsTypes";
import type { SecurityAuditPagePayload } from "./securityTypes";

type OpsQueryParams = Record<string, string | number | boolean | null | undefined>;

function createOpsActionError(message: string, fallbackMessage: string) {
  return String(message || fallbackMessage);
}

async function postLocalizedJson<T>(
  koPath: string,
  enPath: string,
  payload: unknown
): Promise<T> {
  return postJson<T>(buildLocalizedPath(koPath, enPath), payload, {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest"
    }
  });
}

async function fetchOpsPageJson<T>(
  path: string,
  params?: OpsQueryParams,
  fallbackMessage?: string
): Promise<T> {
  return fetchPageJson<T>(`${path}${buildQueryString(params)}`, {
    fallbackMessage
  });
}

async function postLocalizedOpsAction<T extends { success?: boolean; message?: string }>(
  koPath: string,
  enPath: string,
  payload: unknown,
  fallbackMessage: string
): Promise<T> {
  const body = await postLocalizedJson<T>(koPath, enPath, payload);
  if (body.success === false) {
    throw new Error(createOpsActionError(body.message || "", fallbackMessage));
  }
  return body;
}

export async function fetchOperationsCenterPage() {
  return fetchPageJson<OperationsCenterPagePayload>("/admin/monitoring/center/page-data", {
    fallbackMessage: "Failed to load operations center page"
  });
}

export async function fetchProjectRuntimeRegistry() {
  return fetchOpsPageJson<ProjectRuntimeRegistryPayload>(
    "/api/operations/governance/runtime/projects/registry",
    undefined,
    "Failed to load project runtime registry"
  );
}

export async function mutateProjectRuntime(projectId: string, action: "start" | "stop" | "restart") {
  return postLocalizedOpsAction<{ success: boolean; message?: string; output?: string }>(
    `/api/operations/governance/runtime/projects/${projectId}/${action}`,
    `/api/operations/governance/runtime/projects/${projectId}/${action}`,
    {},
    `Failed to ${action} project ${projectId}.`
  );
}

export async function saveProjectRuntime(projectId: string, payload: Record<string, unknown>) {
  return postLocalizedOpsAction<{ success: boolean; message?: string }>(
    `/api/operations/governance/runtime/projects/${projectId}/save`,
    `/api/operations/governance/runtime/projects/${projectId}/save`,
    payload,
    `Failed to save project ${projectId} configuration.`
  );
}

export async function deleteProjectRuntime(projectId: string) {
  return postLocalizedOpsAction<{ success: boolean; message?: string }>(
    `/api/operations/governance/runtime/projects/${projectId}/delete`,
    `/api/operations/governance/runtime/projects/${projectId}/delete`,
    {},
    `Failed to delete project ${projectId}.`
  );
}

export async function applyProjectRouting(projectId: string) {
  return postLocalizedOpsAction<{ success: boolean; message?: string; output?: string }>(
    `/api/operations/governance/runtime/projects/${projectId}/apply-routing`,
    `/api/operations/governance/runtime/projects/${projectId}/apply-routing`,
    {},
    `Failed to apply Nginx routing for project ${projectId}.`
  );
}

export async function fetchProjectAdapters(projectId: string) {
  return fetchPageJson<Array<{ name: string; size: number; lastModified: number }>>(
    `/api/operations/governance/runtime/projects/${projectId}/adapters`,
    { fallbackMessage: `Failed to load adapters for project ${projectId}` }
  );
}

export async function fetchPerformancePage() {
  return fetchLocalizedPageJson<PerformancePagePayload>(
    "/admin/system/performance/page-data",
    "/en/admin/system/performance/page-data",
    { fallbackMessage: "Failed to load performance page" }
  );
}

export async function fetchDbPromotionPolicyPage() {
  return fetchLocalizedPageJson<DbPromotionPolicyPagePayload>(
    "/admin/system/db-promotion-policy/page-data",
    "/en/admin/system/db-promotion-policy/page-data",
    { fallbackMessage: "Failed to load DB promotion policy page" }
  );
}

export async function saveDbPromotionPolicy(payload: Record<string, string>) {
  return postLocalizedOpsAction<DbPromotionPolicyPagePayload>(
    "/admin/system/db-promotion-policy/save",
    "/en/admin/system/db-promotion-policy/save",
    payload,
    "Failed to save DB promotion policy."
  );
}

export async function fetchDbSyncDeployPage() {
  return fetchLocalizedPageJson<DbSyncDeployPagePayload>(
    "/admin/system/db-sync-deploy/page-data",
    "/en/admin/system/db-sync-deploy/page-data",
    { fallbackMessage: "Failed to load DB sync deploy page" }
  );
}

export async function analyzeDbSyncDeploy() {
  return postLocalizedOpsAction<DbSyncDeployPagePayload>(
    "/admin/system/db-sync-deploy/analyze",
    "/en/admin/system/db-sync-deploy/analyze",
    {},
    "Failed to analyze DB sync deploy preflight."
  );
}

export async function validateDbSyncDeployPolicy() {
  return postLocalizedOpsAction<DbSyncDeployPagePayload>(
    "/admin/system/db-sync-deploy/validate-policy",
    "/en/admin/system/db-sync-deploy/validate-policy",
    {},
    "Failed to validate DB sync deploy policy."
  );
}

export async function executeDbSyncDeploy(payload?: {
  executionMode?: string;
  targetRoute?: string;
  executionSource?: string;
  ticketNumber?: string;
  approver?: string;
}) {
  return postLocalizedOpsAction<DbSyncDeployPagePayload>(
    "/admin/system/db-sync-deploy/execute",
    "/en/admin/system/db-sync-deploy/execute",
    payload || {},
    "Failed to execute DB sync deploy runner."
  );
}

export async function fetchExternalConnectionListPage() {
  return fetchLocalizedPageJson<ExternalConnectionListPagePayload>(
    "/admin/external/connection_list/page-data",
    "/en/admin/external/connection_list/page-data",
    { fallbackMessage: "Failed to load external connection list page" }
  );
}

export async function fetchExternalSchemaPage() {
  return fetchLocalizedPageJson<ExternalSchemaPagePayload>(
    "/admin/external/schema/page-data",
    "/en/admin/external/schema/page-data",
    { fallbackMessage: "Failed to load external schema page" }
  );
}

export async function fetchExternalKeysPage() {
  return fetchLocalizedPageJson<ExternalKeysPagePayload>(
    "/admin/external/keys/page-data",
    "/en/admin/external/keys/page-data",
    { fallbackMessage: "Failed to load external keys page" }
  );
}

export async function mutateExternalKey(
  action: "issue" | "rotate" | "revoke",
  payload: {
    connectionId: string;
    credentialLabel: string;
    reason?: string;
    approver?: string;
  }
) {
  return postLocalizedOpsAction<{ success: boolean; message?: string }>(
    `/admin/external/keys/${action}`,
    `/en/admin/external/keys/${action}`,
    payload,
    `Failed to ${action} external key.`
  );
}

export async function fetchExternalUsagePage() {
  return fetchLocalizedPageJson<ExternalUsagePagePayload>(
    "/admin/external/usage/page-data",
    "/en/admin/external/usage/page-data",
    { fallbackMessage: "Failed to load external usage page" }
  );
}

export async function fetchExternalLogsPage() {
  return fetchLocalizedPageJson<ExternalLogsPagePayload>(
    "/admin/external/logs/page-data",
    "/en/admin/external/logs/page-data",
    { fallbackMessage: "Failed to load external logs page" }
  );
}

export async function fetchExternalWebhooksPage(params?: {
  keyword?: string;
  syncMode?: string;
  status?: string;
}) {
  const query = buildQueryParams({
    keyword: params?.keyword?.trim() || undefined,
    syncMode: params?.syncMode && params.syncMode !== "ALL" ? params.syncMode : undefined,
    status: params?.status && params.status !== "ALL" ? params.status : undefined
  });
  return fetchLocalizedPageJson<ExternalWebhooksPagePayload>(
    "/admin/external/webhooks/page-data",
    "/en/admin/external/webhooks/page-data",
    {
      query,
      fallbackMessage: "Failed to load external webhooks page"
    }
  );
}

export async function fetchExternalSyncPage() {
  return fetchLocalizedPageJson<ExternalSyncPagePayload>(
    "/admin/external/sync/page-data",
    "/en/admin/external/sync/page-data",
    { fallbackMessage: "Failed to load external sync page" }
  );
}

export async function fetchExternalMonitoringPage() {
  return fetchLocalizedPageJson<ExternalMonitoringPagePayload>(
    "/admin/external/monitoring/page-data",
    "/en/admin/external/monitoring/page-data",
    { fallbackMessage: "Failed to load external monitoring page" }
  );
}

export async function fetchExternalMaintenancePage() {
  return fetchLocalizedPageJson<ExternalMaintenancePagePayload>(
    "/admin/external/maintenance/page-data",
    "/en/admin/external/maintenance/page-data",
    { fallbackMessage: "Failed to load external maintenance page" }
  );
}

export async function fetchExternalRetryPage() {
  return fetchLocalizedPageJson<ExternalRetryPagePayload>(
    "/admin/external/retry/page-data",
    "/en/admin/external/retry/page-data",
    { fallbackMessage: "Failed to load external retry page" }
  );
}

export async function fetchExternalConnectionFormPage(mode: "add" | "edit", connectionId?: string) {
  const koPath = mode === "add"
    ? "/admin/external/connection_add/page-data"
    : "/admin/external/connection_edit/page-data";
  const enPath = mode === "add"
    ? "/en/admin/external/connection_add/page-data"
    : "/en/admin/external/connection_edit/page-data";
  return fetchLocalizedPageJson<ExternalConnectionFormPagePayload>(
    koPath,
    enPath,
    {
      query: buildQueryParams({ connectionId }),
      fallbackMessage: "Failed to load external connection form page"
    }
  );
}

export async function saveExternalConnection(payload: Record<string, string>) {
  return postLocalizedOpsAction<ExternalConnectionFormPagePayload>(
    "/admin/external/connection/save",
    "/en/admin/external/connection/save",
    payload,
    "Failed to save external connection."
  );
}

export async function fetchSensorListPage() {
  return fetchLocalizedPageJson<SensorListPagePayload>(
    "/admin/monitoring/sensor_list/page-data",
    "/en/admin/monitoring/sensor_list/page-data",
    { fallbackMessage: "Failed to load sensor list page" }
  );
}

export async function fetchCertificateAuditLogPage(params?: {
  pageIndex?: number;
  searchKeyword?: string;
  auditType?: string;
  status?: string;
  certificateType?: string;
  startDate?: string;
  endDate?: string;
}) {
  const query = buildQueryParams({
    pageIndex: params?.pageIndex && params.pageIndex > 1 ? params.pageIndex : undefined,
    searchKeyword: params?.searchKeyword,
    auditType: params?.auditType && params.auditType !== "ALL" ? params.auditType : undefined,
    status: params?.status && params.status !== "ALL" ? params.status : undefined,
    certificateType: params?.certificateType && params.certificateType !== "ALL" ? params.certificateType : undefined,
    startDate: params?.startDate,
    endDate: params?.endDate
  });
  return fetchLocalizedPageJson<CertificateAuditLogPagePayload>(
    "/admin/certificate/audit-log/page-data",
    "/en/admin/certificate/audit-log/page-data",
    {
      query,
      fallbackMessage: "Failed to load certificate audit log page"
    }
  );
}

export function buildSecurityAuditExportUrl(params?: {
  searchKeyword?: string;
  actionType?: string;
  routeGroup?: string;
  startDate?: string;
  endDate?: string;
  sortKey?: string;
  sortDirection?: string;
}) {
  const query = buildQueryString({
    searchKeyword: params?.searchKeyword,
    actionType: params?.actionType && params.actionType !== "ALL" ? params.actionType : undefined,
    routeGroup: params?.routeGroup && params.routeGroup !== "ALL" ? params.routeGroup : undefined,
    startDate: params?.startDate,
    endDate: params?.endDate,
    sortKey: params?.sortKey && params.sortKey !== "AUDIT_AT" ? params.sortKey : undefined,
    sortDirection: params?.sortDirection && params.sortDirection !== "DESC" ? params.sortDirection : undefined
  });
  return buildLocalizedPath(
    `/admin/system/security-audit/export.csv${query}`,
    `/en/admin/system/security-audit/export.csv${query}`
  );
}

export async function fetchSchedulerManagementPage(params?: { jobStatus?: string; executionType?: string; }) {
  return fetchOpsPageJson<SchedulerManagementPagePayload>(
    "/admin/system/scheduler/page-data",
    params,
    "Failed to load scheduler management page"
  );
}

export async function fetchBatchManagementPage() {
  return fetchPageJson<BatchManagementPagePayload>("/admin/system/batch/page-data", {
    fallbackMessage: "Failed to load batch management page"
  });
}

export async function fetchBackupConfigPage(pathname?: string) {
  const currentPath = pathname || (typeof window === "undefined" ? "/admin/system/backup_config" : window.location.pathname);
  const normalizedPath = currentPath.replace(/\/page-data$/, "");
  const sharedPath = normalizedPath
    .replace(/\/admin\/system\/backup$/, "/admin/system/backup_config")
    .replace(/\/admin\/system\/restore$/, "/admin/system/backup_config")
    .replace(/\/admin\/system\/version$/, "/admin/system/backup_config")
    .replace(/\/en\/admin\/system\/backup$/, "/en/admin/system/backup_config")
    .replace(/\/en\/admin\/system\/restore$/, "/en/admin/system/backup_config")
    .replace(/\/en\/admin\/system\/version$/, "/en/admin/system/backup_config");
  const url = sharedPath.startsWith("/en/")
    ? `${sharedPath}/page-data`
    : buildLocalizedPath(`${sharedPath}/page-data`, `/en${sharedPath}/page-data`);
  return fetchPageJson<BackupConfigPagePayload>(url, {
    fallbackMessage: "Failed to load backup config page"
  });
}

export async function saveBackupConfig(payload: Record<string, string>) {
  return postLocalizedJson<BackupConfigPagePayload>(
    "/admin/system/backup_config/save",
    "/en/admin/system/backup_config/save",
    payload
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
  return fetchOpsPageJson<SecurityAuditPagePayload>(
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

export async function createIpWhitelistRequest(payload: Record<string, unknown>) {
  return postLocalizedOpsAction<{ success?: boolean; message?: string; requestId?: string; ruleId?: string } & Record<string, unknown>>(
    "/admin/system/ip-whitelist/request",
    "/en/admin/system/ip-whitelist/request",
    payload || {},
    "Failed to create IP whitelist request"
  );
}

export async function restoreBackupConfigVersion(versionId: string) {
  return postLocalizedJson<BackupConfigPagePayload>(
    "/admin/system/version/restore",
    "/en/admin/system/version/restore",
    { versionId }
  );
}

export async function runBackupExecution(
  executionType:
    | "DB"
    | "GIT"
    | "GIT_PRECHECK"
    | "GIT_CLEANUP_SAFE"
    | "GIT_BUNDLE"
    | "GIT_COMMIT_AND_PUSH_BASE"
    | "GIT_PUSH_BASE"
    | "GIT_PUSH_RESTORE"
    | "GIT_TAG_PUSH"
    | "GIT_RESTORE_COMMIT"
    | "DB_RESTORE_SQL"
    | "DB_RESTORE_PHYSICAL"
    | "DB_RESTORE_PITR",
  options?: {
    gitRestoreCommit?: string;
    dbRestoreType?: string;
    dbRestoreTarget?: string;
    dbRestorePointInTime?: string;
    sudoPassword?: string;
  }
) {
  const body = await postLocalizedJson<BackupConfigPagePayload>(
    "/admin/system/backup/run",
    "/en/admin/system/backup/run",
    {
      executionType,
      gitRestoreCommit: options?.gitRestoreCommit || "",
      dbRestoreType: options?.dbRestoreType || "",
      dbRestoreTarget: options?.dbRestoreTarget || "",
      dbRestorePointInTime: options?.dbRestorePointInTime || "",
      sudoPassword: options?.sudoPassword || ""
    }
  );
  return body;
}
