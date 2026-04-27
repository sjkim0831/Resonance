import { buildLocalizedPath } from "../navigation/runtime";
import {
  buildAdminApiPath,
  buildFormUrlEncoded,
  buildQueryString,
  fetchJson,
  fetchPageJson,
  fetchValidatedJson,
  fetchLocalizedPageJson,
  postAdminValidatedJson,
  postValidatedJson,
  postLocalizedValidatedAction,
  postLocalizedValidatedFormUrlEncoded,
  postLocalizedValidatedJson,
} from "./core";
import { buildPageCacheKey, fetchCachedJson, fetchJsonWithoutCache } from "./pageCache";
import type {
  AuditEventSearchPayload,
  CodexHistoryPayload,
  DbBusinessChangeLogRow,
  DbChangeCaptureSummaryPayload,
  DbDeployablePatchQueueRow,
  DbDeployablePatchResultRow,
  CodexProvisionPagePayload,
  FunctionManagementPagePayload,
  FullStackGovernanceAutoCollectRequest,
  FullStackGovernanceRegistryEntry,
  HelpManagementItem,
  HelpManagementPagePayload,
  MenuManagementPagePayload,
  NewPagePagePayload,
  PlatformInstallPagePayload,
  PlatformOperationPreviewPayload,
  PlatformOperationVerifyPayload,
  PlatformOperationDryRunPayload,
  PageManagementPagePayload,
  ProjectApplyUpgradeResponse,
  ProjectRollbackResponse,
  ProjectUpgradeImpactResponse,
  ProjectVersionListPayload,
  ProjectVersionManagementPagePayload,
  ProjectFleetUpgradeGovernancePayload,
  ProjectVersionOpsPayload,
  ProjectVersionOverviewPayload,
  ProjectVersionServerStatePayload,
  ProjectVersionTargetArtifactPayload,
  ScreenCommandPagePayload,
  ScreenBuilderAutoReplacePreviewItem,
  ScreenBuilderComponentRegistryItem,
  ScreenBuilderComponentUsage,
  ScreenBuilderEventBinding,
  ScreenBuilderNode,
  ScreenBuilderPagePayload,
  ScreenBuilderPreviewPayload,
  ScreenBuilderRegistryScanItem,
  ScreenBuilderStatusSummaryResponse,
  SrTicketArtifactPayload,
  SrTicketDetailPayload,
  SrTicketRow,
  SrWorkbenchPagePayload,
  SrWorkbenchStackItem,
  SystemAssetDetailPayload,
  SystemAssetImpactPayload,
  SystemAssetGapPayload,
  SystemAssetLifecyclePayload,
  SystemAssetLifecyclePlanVO,
  SystemAssetInventoryVO,
  AssetScanSummary,
  VerificationCenterPagePayload,
  VerificationAssetManagementPagePayload,
  VerificationAssetMutationResponse,
  VerificationCenterRunResponse,
  TraceEventSearchPayload,
  WbsManagementPagePayload
} from "./platformTypes";

function buildVersionControlApiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return buildLocalizedPath(
    `/api/platform/version-control${normalized}`,
    `/en/api/platform/version-control${normalized}`
  );
}

async function postProjectVersionJson<T>(
  url: string,
  payload: unknown,
  fallback: string,
  requiredFeatureCode: string
): Promise<T> {
  return postValidatedJson<T & Record<string, unknown>>(url, payload, {
    fallbackMessage: fallback,
    init: {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    },
    resolveError: (body, status) => {
      if (status === 403) {
        return String(
          body.message || `You do not have permission to run this version-management action. Required feature: ${requiredFeatureCode}.`
        );
      }
      return String(body.message || fallback);
    }
  }) as Promise<T>;
}

function versionPermissionError(
  body: Record<string, unknown>,
  status: number,
  fallback: string,
  requiredFeatureCode: string
) {
  if (status === 403) {
    return String(
      body.message || `You do not have permission to access project version management. Required feature: ${requiredFeatureCode}.`
    );
  }
  return String(body.message || fallback);
}

type EnvironmentManagedPageImpactResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  defaultViewFeatureCode?: string;
  linkedFeatureCodes?: string[];
  nonDefaultFeatureCodes?: string[];
  defaultViewRoleRefCount?: number;
  defaultViewUserOverrideCount?: number;
  blocked?: boolean;
} & Record<string, unknown>;

type EnvironmentManagedPageDeleteResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  nonDefaultFeatureCodes?: string[];
  defaultViewRoleRefCount?: number;
  defaultViewUserOverrideCount?: number;
} & Record<string, unknown>;

type EnvironmentFeatureImpactResponse = {
  success?: boolean;
  message?: string;
  featureCode?: string;
  assignedRoleCount?: number;
  userOverrideCount?: number;
} & Record<string, unknown>;

function createPlatformPageErrorResolver<T extends Record<string, unknown>>(
  fallbackMessage: string,
  errorKey: keyof T & string
) {
  return (body: T, status: number) => String(body[errorKey] || `${fallbackMessage}: ${status}`);
}

export async function fetchFullStackManagementPage(menuType?: string, saved?: string) {
  const query = buildQueryString({ menuType, saved });
  const fallbackMessage = "Failed to load full-stack management page";
  return fetchPageJson<MenuManagementPagePayload>(
    buildLocalizedPath(
      `/admin/system/full-stack-management/page-data${query}`,
      `/en/admin/system/full-stack-management/page-data${query}`
    ),
    {
      fallbackMessage,
      resolveError: createPlatformPageErrorResolver<MenuManagementPagePayload>(fallbackMessage, "menuMgmtError")
    }
  );
}

export async function fetchWbsManagementPage(menuType?: string) {
  const query = buildQueryString({ menuType });
  return fetchPageJson<WbsManagementPagePayload>(
    buildLocalizedPath(
      `/admin/system/wbs-management/page-data${query}`,
      `/en/admin/system/wbs-management/page-data${query}`
    ),
    {
      fallbackMessage: "Failed to load WBS management page"
    }
  );
}

export async function fetchVerificationCenterPage() {
  return fetchLocalizedPageJson<VerificationCenterPagePayload>(
    "/admin/system/verification-center/page-data",
    "/en/admin/system/verification-center/page-data",
    {
      fallbackMessage: "Failed to load verification center page"
    }
  );
}

export async function fetchPlatformInstallPage() {
  return fetchLocalizedPageJson<PlatformInstallPagePayload>(
    "/admin/system/platform-install/page-data",
    "/en/admin/system/platform-install/page-data",
    {
      fallbackMessage: "Failed to load AI platform install page"
    }
  );
}

export async function fetchOllamaDeterministicRouteMap() {
  return fetchLocalizedPageJson<Record<string, unknown>>(
    "/api/platform/ollama/deterministic-route-map",
    "/en/admin/api/platform/ollama/deterministic-route-map",
    {
      fallbackMessage: "Failed to load deterministic route map"
    }
  );
}

export async function fetchOllamaAgentStageModelMatrix() {
  return fetchLocalizedPageJson<Record<string, unknown>>(
    "/api/platform/ollama/agent-stage-model-matrix",
    "/en/admin/api/platform/ollama/agent-stage-model-matrix",
    {
      fallbackMessage: "Failed to load agent stage model matrix"
    }
  );
}

export async function fetchOllamaRouterConfig() {
  return fetchLocalizedPageJson<Record<string, unknown>>(
    "/api/platform/ollama/router-config",
    "/en/admin/api/platform/ollama/router-config",
    {
      fallbackMessage: "Failed to load Ollama router config"
    }
  );
}

export async function saveOllamaRouterConfig(payload: Record<string, unknown>) {
  return postLocalizedValidatedJson<Record<string, unknown>>(
    "/api/platform/ollama/router-config",
    "/en/admin/api/platform/ollama/router-config",
    payload,
    "Failed to save Ollama router config."
  );
}

export async function fetchOllamaAgentProfiles() {
  return fetchLocalizedPageJson<Record<string, unknown>>(
    "/api/platform/ollama/agent-profiles",
    "/en/admin/api/platform/ollama/agent-profiles",
    {
      fallbackMessage: "Failed to load Ollama agent profiles"
    }
  );
}

export async function saveOllamaAgentProfiles(payload: Record<string, unknown>) {
  return postLocalizedValidatedJson<Record<string, unknown>>(
    "/api/platform/ollama/agent-profiles",
    "/en/admin/api/platform/ollama/agent-profiles",
    payload,
    "Failed to save Ollama agent profiles."
  );
}

export async function fetchOllamaRunnerProfiles() {
  return fetchLocalizedPageJson<Record<string, unknown>>(
    "/api/platform/ollama/runner-profiles",
    "/en/admin/api/platform/ollama/runner-profiles",
    {
      fallbackMessage: "Failed to load AI runner profiles"
    }
  );
}

export async function saveOllamaRunnerProfiles(payload: Record<string, unknown>) {
  return postLocalizedValidatedJson<Record<string, unknown>>(
    "/api/platform/ollama/runner-profiles",
    "/en/admin/api/platform/ollama/runner-profiles",
    payload,
    "Failed to save AI runner profiles."
  );
}

export async function fetchOllamaToolchainProfiles() {
  return fetchLocalizedPageJson<Record<string, unknown>>(
    "/api/platform/ollama/toolchain-profiles",
    "/en/admin/api/platform/ollama/toolchain-profiles",
    {
      fallbackMessage: "Failed to load AI toolchain profiles"
    }
  );
}

export async function saveOllamaToolchainProfiles(payload: Record<string, unknown>) {
  return postLocalizedValidatedJson<Record<string, unknown>>(
    "/api/platform/ollama/toolchain-profiles",
    "/en/admin/api/platform/ollama/toolchain-profiles",
    payload,
    "Failed to save AI toolchain profiles."
  );
}

export async function fetchOllamaOperationReadiness() {
  return fetchLocalizedPageJson<Record<string, unknown>>(
    "/api/platform/ollama/operation-readiness",
    "/en/admin/api/platform/ollama/operation-readiness",
    {
      fallbackMessage: "Failed to load operation readiness"
    }
  );
}

export async function previewOllamaOperation(operationId: string) {
  return postLocalizedValidatedJson<PlatformOperationPreviewPayload>(
    "/api/platform/ollama/operation-preview",
    "/en/admin/api/platform/ollama/operation-preview",
    { operationId },
    "Failed to preview operation script."
  );
}

export async function verifyOllamaOperation(operationId: string) {
  return postLocalizedValidatedJson<PlatformOperationVerifyPayload>(
    "/api/platform/ollama/operation-verify",
    "/en/admin/api/platform/ollama/operation-verify",
    { operationId },
    "Failed to verify operation readiness."
  );
}

export async function dryRunOllamaOperation(operationId: string) {
  return postLocalizedValidatedJson<PlatformOperationDryRunPayload>(
    "/api/platform/ollama/operation-dry-run",
    "/en/admin/api/platform/ollama/operation-dry-run",
    { operationId },
    "Failed to create operation dry-run plan."
  );
}

export async function runVerificationCenterCheck(actionType: string) {
  return postLocalizedValidatedJson<VerificationCenterRunResponse>(
    "/admin/system/verification-center/run-check",
    "/en/admin/system/verification-center/run-check",
    { actionType },
    "Failed to run verification check."
  );
}

export async function fetchVerificationAssetManagementPage() {
  return fetchLocalizedPageJson<VerificationAssetManagementPagePayload>(
    "/admin/system/verification-assets/page-data",
    "/en/admin/system/verification-assets/page-data",
    {
      fallbackMessage: "Failed to load verification asset management page"
    }
  );
}

export async function upsertVerificationBaseline(payload: Record<string, unknown>) {
  return postLocalizedValidatedJson<VerificationAssetMutationResponse>(
    "/admin/system/verification-assets/upsert-baseline",
    "/en/admin/system/verification-assets/upsert-baseline",
    payload,
    "Failed to save baseline."
  );
}

export async function upsertVerificationAccount(payload: Record<string, unknown>) {
  return postLocalizedValidatedJson<VerificationAssetMutationResponse>(
    "/admin/system/verification-assets/upsert-account",
    "/en/admin/system/verification-assets/upsert-account",
    payload,
    "Failed to save test account."
  );
}

export async function upsertVerificationDataset(payload: Record<string, unknown>) {
  return postLocalizedValidatedJson<VerificationAssetMutationResponse>(
    "/admin/system/verification-assets/upsert-dataset",
    "/en/admin/system/verification-assets/upsert-dataset",
    payload,
    "Failed to save dataset."
  );
}

export async function resolveVerificationAction(actionId: string) {
  return postLocalizedValidatedJson<VerificationAssetMutationResponse>(
    "/admin/system/verification-assets/resolve-action",
    "/en/admin/system/verification-assets/resolve-action",
    { actionId },
    "Failed to resolve action."
  );
}

export async function fetchNewPagePage() {
  return fetchPageJson<NewPagePagePayload>(
    buildLocalizedPath("/admin/system/new-page/page-data", "/en/admin/system/new-page/page-data"),
    {
      fallbackMessage: "Failed to load new page"
    }
  );
}

export async function fetchFunctionManagementPage(params?: { menuType?: string; searchMenuCode?: string; searchKeyword?: string; }) {
  const fallbackMessage = "Failed to load function management page";
  const query = buildQueryString({
    menuType: params?.menuType,
    searchMenuCode: params?.searchMenuCode,
    searchKeyword: params?.searchKeyword
  });
  return fetchLocalizedPageJson<FunctionManagementPagePayload>(
    "/admin/system/feature-management/page-data",
    "/en/admin/system/feature-management/page-data",
    {
      query,
      fallbackMessage,
      resolveError: createPlatformPageErrorResolver<FunctionManagementPagePayload>(fallbackMessage, "featureMgmtError")
    }
  );
}

export async function fetchMenuManagementPage(menuType?: string, saved?: string) {
  const fallbackMessage = "Failed to load menu management page";
  const query = buildQueryString({ menuType, saved });
  return fetchLocalizedPageJson<MenuManagementPagePayload>(
    "/admin/system/menu/page-data",
    "/en/admin/system/menu/page-data",
    {
      query,
      fallbackMessage,
      resolveError: createPlatformPageErrorResolver<MenuManagementPagePayload>(fallbackMessage, "menuMgmtError")
    }
  );
}

export async function fetchContentMenuManagementPage(saved?: string) {
  const fallbackMessage = "Failed to load content menu management page";
  const query = buildQueryString({ saved });
  return fetchLocalizedPageJson<MenuManagementPagePayload>(
    "/admin/content/menu/page-data",
    "/en/admin/content/menu/page-data",
    {
      query,
      fallbackMessage,
      resolveError: createPlatformPageErrorResolver<MenuManagementPagePayload>(fallbackMessage, "menuMgmtError")
    }
  );
}

export async function fetchScreenBuilderPage(params?: {
  menuCode?: string;
  pageId?: string;
  menuTitle?: string;
  menuUrl?: string;
}) {
  const query = buildQueryString({
    menuCode: params?.menuCode,
    pageId: params?.pageId,
    menuTitle: params?.menuTitle,
    menuUrl: params?.menuUrl
  });
  return fetchCachedJson<ScreenBuilderPagePayload>({
    cacheKey: buildPageCacheKey(`screen-builder/page${query}`),
    url: `${buildAdminApiPath("/api/platform/screen-builder/page")}${query}`,
    mapError: (body, status) => body.screenBuilderMessage || `Failed to load screen builder page: ${status}`
  });
}

export async function fetchProjectVersionManagementPage(params?: {
  projectId?: string;
  page?: number;
  pageSize?: number;
}): Promise<ProjectVersionManagementPagePayload> {
  const overviewQuery = buildQueryString({ projectId: params?.projectId });
  const listQuery = buildQueryString({
    projectId: params?.projectId,
    page: params?.page,
    pageSize: params?.pageSize
  });

  const [overview, adapterHistory, releaseUnits, serverDeployState, candidateArtifacts, fleetGovernance] = await Promise.all([
    fetchJsonWithoutCache<ProjectVersionOverviewPayload>({
      url: `${buildVersionControlApiPath("/overview")}${overviewQuery}`,
      mapError: (body, status) => versionPermissionError(body, status, `Failed to load version overview: ${status}`, "A0060404_VIEW")
    }),
    fetchJsonWithoutCache<ProjectVersionListPayload>({
      url: `${buildVersionControlApiPath("/adapter-history")}${listQuery}`,
      mapError: (body, status) => versionPermissionError(body, status, `Failed to load adapter history: ${status}`, "A0060404_VIEW")
    }),
    fetchJsonWithoutCache<ProjectVersionListPayload>({
      url: `${buildVersionControlApiPath("/release-units")}${listQuery}`,
      mapError: (body, status) => versionPermissionError(body, status, `Failed to load release units: ${status}`, "A0060404_VIEW")
    }),
    fetchJsonWithoutCache<ProjectVersionServerStatePayload>({
      url: `${buildVersionControlApiPath("/server-deploy-state")}${overviewQuery}`,
      mapError: (body, status) => versionPermissionError(body, status, `Failed to load server deployment state: ${status}`, "A0060404_VIEW")
    }),
    fetchJsonWithoutCache<ProjectVersionListPayload>({
      url: `${buildVersionControlApiPath("/candidate-artifacts")}${listQuery}`,
      mapError: (body, status) => versionPermissionError(body, status, `Failed to load candidate artifacts: ${status}`, "A0060404_VIEW")
    }),
    fetchJsonWithoutCache<ProjectFleetUpgradeGovernancePayload>({
      url: `${buildVersionControlApiPath("/fleet-governance")}${listQuery}`,
      mapError: (body, status) => versionPermissionError(body, status, `Failed to load fleet governance: ${status}`, "A0060404_VIEW")
    })
  ]);

  return {
    overview,
    adapterHistory,
    releaseUnits,
    serverDeployState,
    candidateArtifacts,
    fleetGovernance
  };
}

export async function analyzeProjectUpgradeImpact(payload: {
  projectId: string;
  operator: string;
  targetArtifactSet: ProjectVersionTargetArtifactPayload[];
}) {
  return postProjectVersionJson<ProjectUpgradeImpactResponse>(
    buildVersionControlApiPath("/upgrade-impact"),
    payload,
    "Failed to analyze project upgrade impact.",
    "A0060404_ANALYZE"
  );
}

export async function applyProjectUpgrade(payload: {
  projectId: string;
  operator: string;
  targetArtifactSet: ProjectVersionTargetArtifactPayload[];
}) {
  return postProjectVersionJson<ProjectApplyUpgradeResponse>(
    buildVersionControlApiPath("/apply-upgrade"),
    payload,
    "Failed to apply project upgrade.",
    "A0060404_APPLY"
  );
}

export async function rollbackProjectVersion(payload: {
  projectId: string;
  operator: string;
  targetReleaseUnitId: string;
}) {
  return postProjectVersionJson<ProjectRollbackResponse>(
    buildVersionControlApiPath("/rollback"),
    payload,
    "Failed to rollback project version.",
    "A0060404_ROLLBACK"
  );
}

export async function fetchProjectVersionOperations(params?: {
  projectId?: string;
}) {
  const query = buildQueryString({ projectId: params?.projectId });
  return fetchJsonWithoutCache<ProjectVersionOpsPayload>({
    url: `${buildVersionControlApiPath("/operations")}${query}`,
    mapError: (body, status) => versionPermissionError(body, status, `Failed to load version operations: ${status}`, "A0060404_VIEW")
  });
}

export async function fetchDbChangeCaptureSummary(params?: {
  projectId?: string;
}) {
  const query = buildQueryString({ projectId: params?.projectId });
  return fetchJsonWithoutCache<DbChangeCaptureSummaryPayload>({
    url: `${buildLocalizedPath("/api/platform/db-change/summary", "/en/api/platform/db-change/summary")}${query}`,
    mapError: (body, status) => String(body.message || `Failed to load DB change summary: ${status}`)
  });
}

export async function fetchDbChangeLogList(params?: {
  projectId?: string;
  limit?: number;
}) {
  const query = buildQueryString({ projectId: params?.projectId, limit: params?.limit });
  return fetchJsonWithoutCache<DbBusinessChangeLogRow[]>({
    url: `${buildLocalizedPath("/api/platform/db-change/changes", "/en/api/platform/db-change/changes")}${query}`,
    mapError: (body, status) => String(body.message || `Failed to load DB change logs: ${status}`)
  });
}

export async function fetchDbPatchQueueList(params?: {
  projectId?: string;
  limit?: number;
}) {
  const query = buildQueryString({ projectId: params?.projectId, limit: params?.limit });
  return fetchJsonWithoutCache<DbDeployablePatchQueueRow[]>({
    url: `${buildLocalizedPath("/api/platform/db-change/queue", "/en/api/platform/db-change/queue")}${query}`,
    mapError: (body, status) => String(body.message || `Failed to load DB patch queue: ${status}`)
  });
}

export async function fetchDbPatchResultList(params?: {
  projectId?: string;
  limit?: number;
}) {
  const query = buildQueryString({ projectId: params?.projectId, limit: params?.limit });
  return fetchJsonWithoutCache<DbDeployablePatchResultRow[]>({
    url: `${buildLocalizedPath("/api/platform/db-change/results", "/en/api/platform/db-change/results")}${query}`,
    mapError: (body, status) => String(body.message || `Failed to load DB patch results: ${status}`)
  });
}

export async function queueDbChangeLog(changeLogId: string, payload?: Record<string, unknown>) {
  return postLocalizedValidatedJson<Record<string, unknown>>(
    `/api/platform/db-change/changes/${encodeURIComponent(changeLogId)}/queue`,
    `/en/api/platform/db-change/changes/${encodeURIComponent(changeLogId)}/queue`,
    payload || {},
    "Failed to queue DB change log."
  );
}

export async function approveDbPatchQueue(queueId: string) {
  return postLocalizedValidatedJson<Record<string, unknown>>(
    `/api/platform/db-change/queue/${encodeURIComponent(queueId)}/approve`,
    `/en/api/platform/db-change/queue/${encodeURIComponent(queueId)}/approve`,
    {},
    "Failed to approve DB patch queue."
  );
}

export async function rejectDbPatchQueue(queueId: string, reason?: string) {
  return postLocalizedValidatedJson<Record<string, unknown>>(
    `/api/platform/db-change/queue/${encodeURIComponent(queueId)}/reject`,
    `/en/api/platform/db-change/queue/${encodeURIComponent(queueId)}/reject`,
    { reason: reason || "" },
    "Failed to reject DB patch queue."
  );
}

export async function executeDbPatchQueue(queueId: string, payload?: Record<string, unknown>) {
  return postLocalizedValidatedJson<Record<string, unknown>>(
    `/api/platform/db-change/queue/${encodeURIComponent(queueId)}/execute`,
    `/en/api/platform/db-change/queue/${encodeURIComponent(queueId)}/execute`,
    payload || {},
    "Failed to execute DB patch queue."
  );
}

export async function runProjectVersionSyncAndDeploy(payload: {
  projectId: string;
  operator: string;
  releaseVersion: string;
  releaseTitle?: string;
  releaseContent: string;
  remoteDeployMode?: string;
}) {
  return postProjectVersionJson<ProjectVersionOpsPayload>(
    buildVersionControlApiPath("/operations/sync-and-deploy"),
    payload,
    "Failed to start remote sync and deploy.",
    "A0060404_APPLY"
  );
}

export async function fetchScreenBuilderPreview(params?: {
  menuCode?: string;
  pageId?: string;
  menuTitle?: string;
  menuUrl?: string;
  versionStatus?: string;
}) {
  const query = buildQueryString({
    menuCode: params?.menuCode,
    pageId: params?.pageId,
    menuTitle: params?.menuTitle,
    menuUrl: params?.menuUrl,
    versionStatus: params?.versionStatus
  });
  return fetchPageJson<ScreenBuilderPreviewPayload & Record<string, unknown>>(
    `${buildAdminApiPath("/api/platform/screen-builder/preview")}${query}`,
    {
      fallbackMessage: "Failed to load screen builder preview",
      resolveError: (body, status) => String(body.message || `Failed to load screen builder preview: ${status}`)
    }
  ) as Promise<ScreenBuilderPreviewPayload>;
}

export async function fetchScreenBuilderStatusSummary(menuCodes: string[]) {
  const query = buildQueryString({
    menuCode: [...new Set(menuCodes.map((item) => item.trim()).filter(Boolean))]
  });
  return fetchCachedJson<ScreenBuilderStatusSummaryResponse>({
    cacheKey: buildPageCacheKey(`screen-builder/status-summary${query}`),
    url: `${buildAdminApiPath("/api/platform/screen-builder/status-summary")}${query}`,
    mapError: (_body, status) => `Failed to load screen builder status summary: ${status}`
  });
}

export async function rebuildScreenBuilderStatusSummary(menuCodes: string[] = []) {
  const query = buildQueryString({
    menuCode: [...new Set(menuCodes.map((item) => item.trim()).filter(Boolean))]
  });
  return postAdminValidatedJson<ScreenBuilderStatusSummaryResponse & { success?: boolean; message?: string }>(
    `/api/platform/screen-builder/status-summary/rebuild${query}`,
    {},
    "Failed to rebuild screen builder status summary",
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
}

export async function saveScreenBuilderDraft(payload: {
  menuCode: string;
  pageId: string;
  menuTitle: string;
  menuUrl: string;
  templateType: string;
  authorityProfile?: ScreenBuilderPagePayload["authorityProfile"];
  nodes: ScreenBuilderNode[];
  events: ScreenBuilderEventBinding[];
}) {
  return postAdminValidatedJson<{ success?: boolean; message?: string } & Record<string, unknown>>(
    "/api/platform/screen-builder/draft",
    payload,
    "Failed to save screen builder draft",
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
}

export async function restoreScreenBuilderDraft(payload: {
  menuCode: string;
  versionId: string;
}) {
  return postAdminValidatedJson<{ success?: boolean; message?: string } & Record<string, unknown>>(
    "/api/platform/screen-builder/restore",
    payload,
    "Failed to restore screen builder draft",
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
}

export async function publishScreenBuilderDraft(payload: {
  menuCode: string;
}) {
  return postAdminValidatedJson<{ success?: boolean; message?: string } & Record<string, unknown>>(
    "/api/platform/screen-builder/publish",
    payload,
    "Failed to publish screen builder draft",
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
}

export async function registerScreenBuilderComponent(payload: {
  menuCode: string;
  pageId: string;
  nodeId: string;
  componentId?: string;
  componentType: string;
  label: string;
  labelEn?: string;
  description?: string;
  propsTemplate?: Record<string, unknown>;
}) {
  const body = await postAdminValidatedJson<{ success?: boolean; message?: string; item?: ScreenBuilderComponentRegistryItem } & Record<string, unknown>>(
    "/api/platform/screen-builder/component-registry",
    payload,
    "Failed to register screen builder component",
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
  if (!body.item) {
    throw new Error(String(body.message || "Failed to register screen builder component"));
  }
  return body as { success: boolean; message?: string; item: ScreenBuilderComponentRegistryItem };
}

export async function updateScreenBuilderComponentRegistry(payload: {
  componentId: string;
  componentType?: string;
  label?: string;
  labelEn?: string;
  description?: string;
  status?: string;
  replacementComponentId?: string;
  propsTemplate?: Record<string, unknown>;
  menuCode?: string;
}) {
  const body = await postAdminValidatedJson<{ success?: boolean; message?: string; item?: ScreenBuilderComponentRegistryItem } & Record<string, unknown>>(
    "/api/platform/screen-builder/component-registry/update",
    payload,
    "Failed to update screen builder component registry",
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
  if (!body.item) {
    throw new Error(String(body.message || "Failed to update screen builder component registry"));
  }
  return body as { success: boolean; message?: string; item: ScreenBuilderComponentRegistryItem };
}

export async function fetchScreenBuilderComponentRegistryUsage(componentId: string) {
  return fetchPageJson<{ componentId?: string; items?: ScreenBuilderComponentUsage[] } & Record<string, unknown>>(
    buildAdminApiPath(`/api/platform/screen-builder/component-registry/usage?componentId=${encodeURIComponent(componentId)}`),
    {
      fallbackMessage: "Failed to load component usage",
      resolveError: (body, status) => String(body.message || `Failed to load component usage: ${status}`)
    }
  ) as Promise<{ componentId: string; items: ScreenBuilderComponentUsage[] }>;
}

export async function deleteScreenBuilderComponentRegistryItem(payload: {
  componentId: string;
}) {
  const body = await postAdminValidatedJson<{ success?: boolean; message?: string } & Record<string, unknown>>(
    "/api/platform/screen-builder/component-registry/delete",
    payload,
    "Failed to delete screen builder component",
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
  return body as { success: boolean; message?: string };
}

export async function remapScreenBuilderComponentRegistryUsage(payload: {
  fromComponentId: string;
  toComponentId: string;
}) {
  const body = await postAdminValidatedJson<{ success?: boolean; message?: string; updatedDraftCount?: number; updatedPublishedCount?: number } & Record<string, unknown>>(
    "/api/platform/screen-builder/component-registry/remap",
    payload,
    "Failed to remap screen builder component usage",
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
  return body as { success: boolean; message?: string; updatedDraftCount?: number; updatedPublishedCount?: number };
}

export async function autoReplaceDeprecatedScreenBuilderComponents(payload: {
  menuCode: string;
}) {
  const body = await postAdminValidatedJson<{ success?: boolean; message?: string; replacedCount?: number } & Record<string, unknown>>(
    "/api/platform/screen-builder/component-registry/auto-replace",
    payload,
    "Failed to auto replace deprecated components",
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
  return body as { success: boolean; message?: string; replacedCount?: number };
}

export async function previewAutoReplaceDeprecatedScreenBuilderComponents(payload: {
  menuCode: string;
}) {
  const body = await postAdminValidatedJson<{ replacedCount?: number; items?: ScreenBuilderAutoReplacePreviewItem[] } & Record<string, unknown>>(
    "/api/platform/screen-builder/component-registry/auto-replace-preview",
    payload,
    "Failed to preview deprecated component replacement",
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
  return body as { replacedCount: number; items: ScreenBuilderAutoReplacePreviewItem[] };
}

export async function scanScreenBuilderRegistryDiagnostics() {
  return fetchPageJson<{ items?: ScreenBuilderRegistryScanItem[]; totalCount?: number } & Record<string, unknown>>(
    buildAdminApiPath("/api/platform/screen-builder/component-registry/scan"),
    {
      fallbackMessage: "Failed to scan screen builder registry diagnostics",
      resolveError: (body, status) => String(body.message || `Failed to scan screen builder registry diagnostics: ${status}`)
    }
  ) as Promise<{ items: ScreenBuilderRegistryScanItem[]; totalCount: number }>;
}

export async function addScreenBuilderNodeFromComponent(payload: {
  menuCode: string;
  componentId: string;
  parentNodeId?: string;
  props?: Record<string, unknown>;
}) {
  const body = await postAdminValidatedJson<{ success?: boolean; message?: string; nodeId?: string; componentId?: string } & Record<string, unknown>>(
    "/api/platform/screen-builder/component-registry/add-node",
    payload,
    "Failed to add node from registered component",
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
  return body as { success: boolean; message?: string; nodeId?: string; componentId?: string };
}

export async function addScreenBuilderNodeTreeFromComponents(payload: {
  menuCode: string;
  items: Array<{
    componentId: string;
    alias?: string;
    parentAlias?: string;
    parentNodeId?: string;
    props?: Record<string, unknown>;
  }>;
}) {
  const body = await postAdminValidatedJson<{ success?: boolean; message?: string; addedCount?: number; items?: Array<Record<string, unknown>> } & Record<string, unknown>>(
    "/api/platform/screen-builder/component-registry/add-node-tree",
    payload,
    "Failed to add node tree from components",
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
  return body as { success: boolean; message?: string; addedCount?: number; items?: Array<Record<string, unknown>> };
}

export async function updateEnvironmentManagedPage(payload: {
  menuType: string;
  code: string;
  codeNm: string;
  codeDc: string;
  menuUrl: string;
  menuIcon: string;
  useAt: string;
}) {
  const form = buildFormUrlEncoded(payload);
  return postLocalizedValidatedFormUrlEncoded<{ success?: boolean; message?: string; code?: string } & Record<string, unknown>>(
    "/admin/system/environment-management/page/update",
    "/en/admin/system/environment-management/page/update",
    form,
    "Failed to update environment managed page"
  );
}

export async function fetchEnvironmentManagedPageImpact(menuType: string, code: string) {
  const query = buildQueryString({ menuType, code });
  return fetchValidatedJson<EnvironmentManagedPageImpactResponse>(
    buildLocalizedPath(
      `/admin/system/environment-management/page-impact${query}`,
      `/en/admin/system/environment-management/page-impact${query}`
    ),
    {
      fallbackMessage: "Failed to load environment managed page impact",
      resolveError: (body, status) => body.message || `Failed to load environment managed page impact: ${status}`,
      validate: (body) => body.success !== false
    }
  );
}

export async function deleteEnvironmentManagedPage(menuType: string, code: string) {
  const form = buildFormUrlEncoded({ menuType, code });
  return postLocalizedValidatedFormUrlEncoded<EnvironmentManagedPageDeleteResponse>(
    "/admin/system/environment-management/page/delete",
    "/en/admin/system/environment-management/page/delete",
    form,
    "Failed to delete environment managed page"
  );
}

export async function updateEnvironmentFeature(payload: {
  menuType: string;
  menuCode: string;
  featureCode: string;
  featureNm: string;
  featureNmEn: string;
  featureDc: string;
  useAt: string;
}) {
  const form = buildFormUrlEncoded(payload);
  return postLocalizedValidatedFormUrlEncoded<{ success?: boolean; message?: string; featureCode?: string } & Record<string, unknown>>(
    "/admin/system/environment-management/feature/update",
    "/en/admin/system/environment-management/feature/update",
    form,
    "Failed to update environment feature"
  );
}

export async function fetchEnvironmentFeatureImpact(featureCode: string) {
  const query = buildQueryString({ featureCode });
  return fetchValidatedJson<EnvironmentFeatureImpactResponse>(
    buildLocalizedPath(`/admin/system/environment-management/feature-impact${query}`, `/en/admin/system/environment-management/feature-impact${query}`),
    {
      fallbackMessage: "Failed to load environment feature impact",
      resolveError: (body, status) => body.message || `Failed to load environment feature impact: ${status}`,
      validate: (body) => body.success !== false
    }
  );
}

export async function deleteEnvironmentFeature(featureCode: string) {
  const form = buildFormUrlEncoded({ featureCode });
  return postLocalizedValidatedFormUrlEncoded<EnvironmentFeatureImpactResponse>(
    "/admin/system/environment-management/feature/delete",
    "/en/admin/system/environment-management/feature/delete",
    form,
    "Failed to delete environment feature"
  );
}

export async function fetchPageManagementPage(params?: {
  menuType?: string;
  searchKeyword?: string;
  searchUrl?: string;
  autoFeature?: string;
  updated?: string;
  deleted?: string;
  deletedRoleRefs?: string;
  deletedUserOverrides?: string;
}) {
  const query = buildQueryString({
    menuType: params?.menuType,
    searchKeyword: params?.searchKeyword,
    searchUrl: params?.searchUrl,
    autoFeature: params?.autoFeature,
    updated: params?.updated,
    deleted: params?.deleted,
    deletedRoleRefs: params?.deletedRoleRefs,
    deletedUserOverrides: params?.deletedUserOverrides
  });
  return fetchLocalizedPageJson<PageManagementPagePayload>(
    "/admin/system/page-management/page-data",
    "/en/admin/system/page-management/page-data",
    {
      query,
      fallbackMessage: "Failed to load page management page",
      resolveError: (body, status) => body.pageMgmtError || `Failed to load page management page: ${status}`
    }
  );
}

export async function fetchCodexProvisionPage() {
  return fetchPageJson<CodexProvisionPagePayload>(
    buildLocalizedPath("/admin/system/codex-request/page-data", "/en/admin/system/codex-request/page-data"),
    {
      fallbackMessage: "Failed to load Codex provision page"
    }
  );
}

export async function runCodexLoginCheck() {
  return postLocalizedValidatedAction<Record<string, unknown>>(
    "/admin/system/codex-request/login",
    "/en/admin/system/codex-request/login",
    "Failed to run Codex login check"
  );
}

export async function executeCodexProvision(payload: Record<string, unknown>) {
  return postLocalizedValidatedJson<Record<string, unknown>>(
    "/admin/system/codex-request/execute",
    "/en/admin/system/codex-request/execute",
    payload,
    "Failed to execute Codex provision"
  );
}

export async function fetchCodexHistory() {
  return fetchJson<CodexHistoryPayload>(
    buildLocalizedPath("/admin/system/codex-request/history", "/en/admin/system/codex-request/history"),
    {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
    }
  );
}

export async function inspectCodexHistory(logId: string) {
  return postLocalizedValidatedAction<Record<string, unknown>>(
    `/admin/system/codex-request/history/${encodeURIComponent(logId)}/inspect`,
    `/en/admin/system/codex-request/history/${encodeURIComponent(logId)}/inspect`,
    "Failed to inspect Codex history"
  );
}

export async function remediateCodexHistory(logId: string) {
  return postLocalizedValidatedAction<Record<string, unknown>>(
    `/admin/system/codex-request/history/${encodeURIComponent(logId)}/remediate`,
    `/en/admin/system/codex-request/history/${encodeURIComponent(logId)}/remediate`,
    "Failed to remediate Codex history"
  );
}

export async function prepareCodexSrTicket(ticketId: string) {
  return postLocalizedValidatedAction<{ success: boolean; message: string; ticket: SrTicketRow }>(
    `/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/prepare`,
    `/en/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/prepare`,
    "Failed to prepare Codex SR ticket"
  );
}

export async function planCodexSrTicket(ticketId: string) {
  return postLocalizedValidatedAction<{ success: boolean; message: string; ticket: SrTicketRow }>(
    `/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/plan`,
    `/en/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/plan`,
    "Failed to plan Codex SR ticket"
  );
}

export async function executeCodexSrTicket(ticketId: string) {
  return postLocalizedValidatedAction<{ success: boolean; message: string; ticket: SrTicketRow }>(
    `/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/execute`,
    `/en/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/execute`,
    "Failed to execute Codex SR ticket"
  );
}

export async function directExecuteCodexSrTicket(ticketId: string) {
  return postLocalizedValidatedAction<{ success: boolean; message: string; ticket: SrTicketRow }>(
    `/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/direct-execute`,
    `/en/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/direct-execute`,
    "Failed to direct execute Codex SR ticket"
  );
}

export async function queueDirectExecuteCodexSrTicket(ticketId: string) {
  return postLocalizedValidatedAction<{ success: boolean; message: string; ticket: SrTicketRow; executionLanes?: Array<Record<string, unknown>> }>(
    `/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/queue-direct-execute`,
    `/en/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/queue-direct-execute`,
    "Failed to queue direct execute Codex SR ticket"
  );
}

export async function skipPlanExecuteCodexSrTicket(ticketId: string) {
  return postLocalizedValidatedAction<{ success: boolean; message: string; ticket: SrTicketRow }>(
    `/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/skip-plan-execute`,
    `/en/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/skip-plan-execute`,
    "Failed to skip-plan execute Codex SR ticket"
  );
}

export async function reissueCodexSrTicket(ticketId: string) {
  return postLocalizedValidatedAction<{ success: boolean; message: string; ticket: SrTicketRow; sourceTicketId: string }>(
    `/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/reissue`,
    `/en/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/reissue`,
    "Failed to reissue Codex SR ticket"
  );
}

export async function rollbackCodexSrTicket(ticketId: string) {
  return postLocalizedValidatedAction<{ success: boolean; message: string; ticket: SrTicketRow }>(
    `/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/rollback`,
    `/en/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/rollback`,
    "Failed to rollback Codex SR ticket"
  );
}

export async function deleteCodexSrTicket(ticketId: string) {
  return postLocalizedValidatedAction<{ success: boolean; message: string; deletedTicketId: string }>(
    `/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/delete`,
    `/en/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/delete`,
    "Failed to delete Codex SR ticket"
  );
}

export async function fetchCodexSrTicketDetail(ticketId: string) {
  return fetchJson<SrTicketDetailPayload>(
    buildLocalizedPath(
      `/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}`,
      `/en/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}`
    ),
    {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
    }
  );
}

export async function fetchCodexSrTicketArtifact(ticketId: string, artifactType: string) {
  return fetchJson<SrTicketArtifactPayload>(
    buildLocalizedPath(
      `/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/artifacts/${encodeURIComponent(artifactType)}`,
      `/en/admin/system/codex-request/tickets/${encodeURIComponent(ticketId)}/artifacts/${encodeURIComponent(artifactType)}`
    ),
    {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
    }
  );
}

export async function fetchAuditEvents(params?: {
  pageIndex?: number;
  pageSize?: number;
  traceId?: string;
  actorId?: string;
  actionCode?: string;
  menuCode?: string;
  pageId?: string;
  resultStatus?: string;
  searchKeyword?: string;
}): Promise<AuditEventSearchPayload> {
  const query = buildQueryString(params);
  return fetchJson<AuditEventSearchPayload>(
    `${buildAdminApiPath("/api/admin/observability/audit-events")}${query}`,
    {
      apiId: "admin.observability.audit-events.search"
    }
  );
}

export async function fetchTraceEvents(params?: {
  pageIndex?: number;
  pageSize?: number;
  traceId?: string;
  pageId?: string;
  componentId?: string;
  functionId?: string;
  apiId?: string;
  eventType?: string;
  resultCode?: string;
  searchKeyword?: string;
}): Promise<TraceEventSearchPayload> {
  const query = buildQueryString(params);
  return fetchJson<TraceEventSearchPayload>(
    `${buildAdminApiPath("/api/admin/observability/trace-events")}${query}`,
    {
      apiId: "admin.observability.trace-events.search"
    }
  );
}

export async function fetchHelpManagementPage(pageId: string): Promise<HelpManagementPagePayload> {
  const query = buildQueryString({ pageId });
  return fetchPageJson<HelpManagementPagePayload>(
    `${buildLocalizedPath("/admin/api/platform/help-management/page", "/en/admin/api/platform/help-management/page")}${query}`,
    {
    init: {
      apiId: "admin.help-management.page"
    },
    fallbackMessage: "Failed to load help management page"
    }
  );
}

export async function saveHelpManagementPage(payload: {
  pageId: string;
  title: string;
  summary: string;
  helpVersion: string;
  activeYn: string;
  items: HelpManagementItem[];
}) {
  return postLocalizedValidatedJson<{ success: boolean; pageId: string; message: string }>(
    "/admin/api/platform/help-management/save",
    "/en/admin/api/platform/help-management/save",
    payload,
    "Failed to save help management page",
    {
      apiId: "admin.help-management.save",
      headers: {
        "Content-Type": "application/json"
      }
    } as RequestInit
  );
}

export async function fetchScreenCommandPage(pageId: string): Promise<ScreenCommandPagePayload> {
  const query = buildQueryString({ pageId });
  return fetchPageJson<ScreenCommandPagePayload>(
    `${buildLocalizedPath("/admin/api/platform/help-management/screen-command/page", "/en/admin/api/platform/help-management/screen-command/page")}${query}`,
    {
    init: {
      apiId: "admin.help-management.screen-command.page"
    },
    fallbackMessage: "Failed to load screen command page"
    }
  );
}

export async function saveScreenCommandMenuMapping(payload: {
  pageId: string;
  menuCode: string;
  menuName: string;
  menuUrl: string;
  domainCode: string;
}) {
  return postLocalizedValidatedJson<{ success: boolean; message: string; pageId: string; menuCode: string; routePath: string }>(
    "/admin/api/platform/help-management/screen-command/map-menu",
    "/en/admin/api/platform/help-management/screen-command/map-menu",
    payload,
    "Failed to save screen command menu mapping",
    {
      apiId: "admin.help-management.screen-command.map-menu"
    } as RequestInit
  );
}

export async function fetchFullStackGovernanceRegistry(menuCode: string): Promise<FullStackGovernanceRegistryEntry> {
  const query = buildQueryString({ menuCode });
  return fetchJson<FullStackGovernanceRegistryEntry>(`/api/admin/full-stack-management/registry${query}`, {
    apiId: "admin.full-stack-management.registry"
  });
}

export async function saveFullStackGovernanceRegistry(payload: FullStackGovernanceRegistryEntry) {
  return postAdminValidatedJson<{ success: boolean; message: string; entry: FullStackGovernanceRegistryEntry }>(
    "/api/admin/full-stack-management/registry",
    payload,
    "Failed to save full-stack governance registry",
    {
      apiId: "admin.full-stack-management.registry-save"
    } as RequestInit
  );
}

export async function saveWbsManagementEntry(payload: {
  menuType: string;
  menuCode: string;
  owner: string;
  status: string;
  progress: number;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  startDate: string;
  endDate: string;
  notes: string;
  codexInstruction: string;
}) {
  return postAdminValidatedJson<{ success: boolean; message: string; entry: Record<string, unknown> }>(
    "/api/admin/wbs-management/entry",
    payload,
    "Failed to save WBS management entry",
    {
      apiId: "admin.wbs-management.entry-save"
    } as RequestInit
  );
}

export async function autoCollectFullStackGovernanceRegistry(payload: FullStackGovernanceAutoCollectRequest) {
  return postAdminValidatedJson<{ success: boolean; message: string; entry: FullStackGovernanceRegistryEntry }>(
    "/api/admin/full-stack-management/registry/auto-collect",
    payload,
    "Failed to auto-collect full-stack governance registry",
    {
      apiId: "admin.full-stack-management.registry-auto-collect"
    } as RequestInit
  );
}

export async function fetchSrWorkbenchPage(pageId: string): Promise<SrWorkbenchPagePayload> {
  const query = buildQueryString({ pageId });
  return fetchPageJson<SrWorkbenchPagePayload>(`${buildAdminApiPath("/api/platform/workbench/page")}${query}`, {
    init: {
      apiId: "admin.sr-workbench.page"
    },
    fallbackMessage: "Failed to load SR workbench page"
  });
}

export async function createSrTicket(payload: {
  pageId: string;
  pageLabel: string;
  routePath: string;
  menuCode: string;
  menuLookupUrl: string;
  surfaceId: string;
  surfaceLabel: string;
  eventId: string;
  eventLabel: string;
  targetId: string;
  targetLabel: string;
  summary: string;
  instruction: string;
  technicalContext?: string;
  generatedDirection: string;
  commandPrompt: string;
  stackItemIds?: string[];
}) {
  return postAdminValidatedJson<{ success: boolean; message: string; ticket: SrTicketRow }>(
    "/api/platform/workbench/tickets",
    payload,
    "Failed to create SR ticket",
    {
      apiId: "admin.sr-workbench.ticket.create"
    } as RequestInit
  );
}

export async function quickExecuteSrTicket(payload: {
  pageId: string;
  pageLabel: string;
  routePath: string;
  menuCode: string;
  menuLookupUrl: string;
  surfaceId: string;
  surfaceLabel: string;
  eventId: string;
  eventLabel: string;
  targetId: string;
  targetLabel: string;
  summary: string;
  instruction: string;
  technicalContext?: string;
  generatedDirection: string;
  commandPrompt: string;
  stackItemIds?: string[];
}) {
  return postAdminValidatedJson<{ success: boolean; message: string; ticket: SrTicketRow; ticketId: string }>(
    "/api/platform/workbench/quick-execute",
    payload,
    "Failed to quick-execute SR ticket",
    {
      apiId: "admin.sr-workbench.ticket.quick-execute"
    } as RequestInit
  );
}

export async function addSrWorkbenchStackItem(payload: {
  pageId: string;
  pageLabel: string;
  routePath: string;
  menuCode: string;
  menuLookupUrl: string;
  surfaceId: string;
  surfaceLabel: string;
  selector: string;
  componentId: string;
  eventId: string;
  eventLabel: string;
  targetId: string;
  targetLabel: string;
  summary: string;
  instruction: string;
  technicalContext?: string;
  traceId: string;
  requestId: string;
}) {
  return postAdminValidatedJson<{ success: boolean; message: string; stackItem: SrWorkbenchStackItem }>(
    "/api/platform/workbench/stack-items",
    payload,
    "Failed to add SR workbench stack item",
    {
      apiId: "admin.sr-workbench.stack-item.create"
    } as RequestInit
  );
}

export async function removeSrWorkbenchStackItem(stackItemId: string) {
  return postAdminValidatedJson<{ success: boolean; message: string; removedCount: number }>(
    `/api/platform/workbench/stack-items/${encodeURIComponent(stackItemId)}/delete`,
    {},
    "Failed to remove SR workbench stack item",
    {
      apiId: "admin.sr-workbench.stack-item.delete"
    } as RequestInit
  );
}

export async function clearSrWorkbenchStack() {
  return postAdminValidatedJson<{ success: boolean; message: string }>(
    "/api/platform/workbench/stack-items/clear",
    {},
    "Failed to clear SR workbench stack",
    {
      apiId: "admin.sr-workbench.stack-item.clear"
    } as RequestInit
  );
}

export async function approveSrTicket(ticketId: string, decision: "APPROVE" | "REJECT", comment: string) {
  return postAdminValidatedJson<{ success: boolean; message: string; ticket: SrTicketRow }>(
    `/api/platform/workbench/tickets/${encodeURIComponent(ticketId)}/approve`,
    { decision, comment },
    "Failed to approve SR ticket",
    {
      apiId: "admin.sr-workbench.ticket.approve"
    } as RequestInit
  );
}

export async function prepareSrExecution(ticketId: string) {
  return postAdminValidatedJson<{ success: boolean; message: string; ticket: SrTicketRow }>(
    `/api/platform/workbench/tickets/${encodeURIComponent(ticketId)}/prepare-execution`,
    {},
    "Failed to prepare SR execution",
    {
      apiId: "admin.sr-workbench.ticket.prepare-execution"
    } as RequestInit
  );
}

export async function planSrTicket(ticketId: string) {
  return postAdminValidatedJson<{ success: boolean; message: string; ticket: SrTicketRow }>(
    `/api/platform/workbench/tickets/${encodeURIComponent(ticketId)}/plan`,
    {},
    "Failed to plan SR ticket",
    {
      apiId: "admin.sr-workbench.ticket.plan"
    } as RequestInit
  );
}

export async function executeSrTicket(ticketId: string) {
  return postAdminValidatedJson<{ success: boolean; message: string; ticket: SrTicketRow }>(
    `/api/platform/workbench/tickets/${encodeURIComponent(ticketId)}/execute`,
    {},
    "Failed to execute SR ticket",
    {
      apiId: "admin.sr-workbench.ticket.execute"
    } as RequestInit
  );
}

export async function directExecuteSrTicket(ticketId: string) {
  return postAdminValidatedJson<{ success: boolean; message: string; ticket: SrTicketRow }>(
    `/api/platform/workbench/tickets/${encodeURIComponent(ticketId)}/direct-execute`,
    {},
    "Failed to direct-execute SR ticket",
    {
      apiId: "admin.sr-workbench.ticket.direct-execute"
    } as RequestInit
  );
}

export async function skipPlanExecuteSrTicket(ticketId: string) {
  return postAdminValidatedJson<{ success: boolean; message: string; ticket: SrTicketRow }>(
    `/api/platform/workbench/tickets/${encodeURIComponent(ticketId)}/skip-plan-execute`,
    {},
    "Failed to skip-plan execute SR ticket",
    {
      apiId: "admin.sr-workbench.ticket.skip-plan-execute"
    } as RequestInit
  );
}

export async function fetchSystemAssetList(params?: {
  type?: string;
  domain?: string;
  health?: string;
}) {
  const query = buildQueryString(params);
  return fetchValidatedJson<SystemAssetInventoryVO[]>(
    buildLocalizedPath(`/api/admin/system/asset/list${query}`, `/en/api/admin/system/asset/list${query}`),
    {
      fallbackMessage: "Failed to load system asset list",
      validate: (body) => Array.isArray(body)
    }
  );
}

export async function fetchSystemAssetDetail(assetId: string) {
  const query = buildQueryString({ id: assetId });
  return fetchJson<SystemAssetDetailPayload>(
    buildLocalizedPath(`/api/admin/system/asset/detail${query}`, `/en/api/admin/system/asset/detail${query}`),
    {
      fallbackMessage: "Failed to load system asset detail"
    }
  );
}

export async function triggerSystemAssetScan() {
  return postLocalizedValidatedJson<AssetScanSummary>(
    "/api/admin/system/asset/scan",
    "/en/api/admin/system/asset/scan",
    {},
    "Failed to trigger system asset scan"
  );
}

export async function fetchSystemAssetImpact(assetId: string) {
  const query = buildQueryString({ id: assetId });
  return fetchJson<SystemAssetImpactPayload>(
    buildLocalizedPath(`/api/admin/system/asset/impact${query}`, `/en/api/admin/system/asset/impact${query}`),
    {
      fallbackMessage: "Failed to load system asset impact"
    }
  );
}

export async function fetchSystemAssetGap(type?: string) {
  const query = buildQueryString({ type });
  return fetchJson<SystemAssetGapPayload>(
    buildLocalizedPath(`/api/admin/system/asset/gap${query}`, `/en/api/admin/system/asset/gap${query}`),
    {
      fallbackMessage: "Failed to load system asset gap queue"
    }
  );
}

export async function fetchSystemAssetLifecycle(assetId?: string) {
  const query = buildQueryString({ id: assetId });
  return fetchJson<SystemAssetLifecyclePayload>(
    buildLocalizedPath(`/api/admin/system/asset/lifecycle${query}`, `/en/api/admin/system/asset/lifecycle${query}`),
    {
      fallbackMessage: "Failed to load system asset lifecycle"
    }
  );
}

export async function updateSystemAsset(params: {
  id: string;
  assetFamily?: string;
  ownerDomain?: string;
  ownerScope?: string;
  operatorOwner?: string;
  serviceOwner?: string;
  criticality?: string;
  activeYn?: string;
  propagate?: boolean;
}) {
  return postLocalizedValidatedJson<{ success: boolean; affectedCount: number }>(
    "/api/admin/system/asset/update",
    "/en/api/admin/system/asset/update",
    params,
    "Failed to update system asset"
  );
}

export async function createSystemAssetLifecyclePlan(plan: Partial<SystemAssetLifecyclePlanVO>) {
  return postLocalizedValidatedJson<{ success: boolean; planId: string }>(
    "/api/admin/system/asset/lifecycle/plan/create",
    "/en/api/admin/system/asset/lifecycle/plan/create",
    plan,
    "Failed to create lifecycle plan"
  );
}

export async function fetchSystemAssetLifecyclePlanList(params?: {
  assetId?: string;
  status?: string;
  stage?: string;
}) {
  const query = buildQueryString(params);
  return fetchJson<SystemAssetLifecyclePlanVO[]>(
    buildLocalizedPath(`/api/admin/system/asset/lifecycle/plan/list${query}`, `/en/api/admin/system/asset/lifecycle/plan/list${query}`),
    {
      fallbackMessage: "Failed to load lifecycle plans"
    }
  );
}

export async function approveSystemAssetLifecyclePlan(params: {
  planId: string;
  approverId: string;
  status: string;
}) {
  return postLocalizedValidatedJson<{ success: boolean }>(
    "/api/admin/system/asset/lifecycle/plan/approve",
    "/en/api/admin/system/asset/lifecycle/plan/approve",
    params,
    "Failed to approve lifecycle plan"
  );
}
