import { buildAdminApiPath, buildQueryString, fetchPageJson, postValidatedJson } from "./core";

export const RESONANCE_PROJECT_ID = "carbonet-main";
const RESONANCE_PROJECT_PARAM_KEYS = ["resonanceProjectId", "projectId"];
type ResonanceQueryParams = Record<string, string | number | boolean | null | undefined>;

function readProjectIdFromSearch() {
  if (typeof window === "undefined") {
    return "";
  }
  const search = new URLSearchParams(window.location.search);
  for (const key of RESONANCE_PROJECT_PARAM_KEYS) {
    const value = (search.get(key) || "").trim();
    if (value) {
      return value;
    }
  }
  return "";
}

export function resolveResonanceProjectId(explicitProjectId?: string) {
  const candidate = (explicitProjectId || "").trim();
  return candidate || readProjectIdFromSearch() || RESONANCE_PROJECT_ID;
}

function buildResonanceUrl(path: string, params?: ResonanceQueryParams) {
  return `${buildAdminApiPath(path)}${buildQueryString(params)}`;
}

export type ResonanceParityCompareRow = {
  target: string;
  currentRuntime: string;
  generatedTarget: string;
  proposalBaseline: string;
  patchTarget: string;
  result: "MATCH" | "MISMATCH" | "GAP" | string;
};

export type ResonanceParityCompareResponse = {
  compareContextId: string;
  projectId: string;
  guidedStateId: string;
  templateLineId: string;
  screenFamilyRuleId: string;
  ownerLane: string;
  selectedScreenId: string;
  releaseUnitId: string;
  compareBaseline: string;
  compareTargetSet: ResonanceParityCompareRow[];
  parityScore: number;
  uniformityScore: number;
  blockerSet: string[];
  repairCandidateSet: string[];
  result: string;
  requestedBy: string;
  requestedByType: string;
  occurredAt: string;
  traceId: string;
};

export type ResonanceRepairOpenResponse = {
  repairSessionId: string;
  projectId: string;
  guidedStateId: string;
  templateLineId: string;
  screenFamilyRuleId: string;
  ownerLane: string;
  selectedScreenId: string;
  builderInput: Record<string, unknown>;
  runtimeEvidence: Record<string, unknown>;
  selectedElementSet: string[];
  compareSnapshotId: string;
  blockingGapSet: string[];
  reuseRecommendationSet: string[];
  requiredContractSet: string[];
  status: string;
  result: string;
  releaseUnitId: string;
  deployTraceId?: string;
  deployContract?: ResonanceDeployContract;
  serverStateSet?: ResonancePipelineServerState[];
  compareBaseline: string;
  reasonCode: string;
  requestedBy: string;
  requestedByType: string;
  requestNote: string;
  occurredAt: string;
  traceId: string;
};

export type ResonanceRepairApplyResponse = {
  repairApplyRunId: string;
  repairSessionId: string;
  guidedStateId: string;
  templateLineId: string;
  ownerLane: string;
  builderInput: Record<string, unknown>;
  runtimeEvidence: Record<string, unknown>;
  updatedAssetTraceSet: string[];
  updatedReleaseCandidateId: string;
  candidateRuntimePackageId?: string;
  parityRecheckRequiredYn: boolean;
  uniformityRecheckRequiredYn: boolean;
  smokeRequiredYn: boolean;
  status: string;
  result: string;
  projectId: string;
  releaseUnitId: string;
  screenFamilyRuleId: string;
  selectedScreenId: string;
  selectedElementSet: string[];
  updatedBindingSet: string[];
  updatedThemeOrLayoutSet: string[];
  sqlDraftSet: string[];
  publishMode: string;
  deployTraceId?: string;
  deployContract?: ResonanceDeployContract;
  serverStateSet?: ResonancePipelineServerState[];
  requestedBy: string;
  requestedByType: string;
  changeSummary: string;
  compareBaseline: string;
  occurredAt: string;
  traceId: string;
};

export type ResonanceDeploymentRoute = {
  serverId: string;
  serverRole: string;
  promotionState: string;
};

export type ResonancePipelineServerState = {
  serverId: string;
  serverRole: string;
  projectId?: string;
  activeReleaseUnitId: string;
  deployTraceId: string;
  deployedAt: string;
  healthStatus: string;
  promotionState: string;
};

export type ResonanceDeployContract = {
  artifactTargetSystem: string;
  deploymentTarget: string;
  deploymentRouteSet?: ResonanceDeploymentRoute[];
  deploymentMode: string;
  versionTrackingYn: boolean;
  releaseFamilyId: string;
  releaseUnitId?: string;
};

export type ResonanceProjectPipelineResponse = {
  pipelineRunId: string;
  traceId: string;
  projectId: string;
  scenarioId: string;
  guidedStateId: string;
  templateLineId: string;
  screenFamilyRuleId: string;
  ownerLane: string;
  menuRoot: string;
  runtimeClass: string;
  menuScope: string;
  artifactTargetSystem: string;
  deploymentTarget: string;
  releaseUnitId: string;
  runtimePackageId: string;
  deployTraceId: string;
  commonArtifactSet: string[];
  projectAdapterArtifactSet: string[];
  installableArtifactSet: string[];
  installableProduct: Record<string, unknown>;
  boundarySummary: Record<string, unknown>;
  validatorCheckSet: Array<Record<string, unknown>>;
  validatorPassCount: number;
  validatorTotalCount: number;
  stageSet: Array<Record<string, unknown>>;
  artifactVersionSet: Record<string, unknown>;
  artifactLineage: Record<string, unknown>;
  artifactRegistryEntrySet: Array<Record<string, unknown>>;
  deployContract: ResonanceDeployContract;
  serverStateSet?: ResonancePipelineServerState[];
  rollbackPlan: Record<string, unknown>;
  operator: string;
  result: string;
  occurredAt: string;
};

export async function fetchParityCompare(params: {
  projectId: string;
  guidedStateId: string;
  templateLineId: string;
  screenFamilyRuleId: string;
  ownerLane: string;
  selectedScreenId: string;
  releaseUnitId?: string;
  compareBaseline?: string;
  requestedBy?: string;
  requestedByType?: string;
}) {
  return fetchPageJson<ResonanceParityCompareResponse & { message?: string }>(
    buildResonanceUrl("/api/platform/runtime/parity/compare", params),
    {
      fallbackMessage: "Failed to load parity compare",
      resolveError: (body, status) => String(body.message || `Failed to load parity compare: ${status}`)
    }
  ) as Promise<ResonanceParityCompareResponse>;
}

async function postResonanceJson<T extends Record<string, unknown>>(
  path: string,
  payload: unknown,
  fallbackMessage: string
) {
  return postValidatedJson<T>(
    buildAdminApiPath(path),
    payload,
    {
      fallbackMessage,
      init: {
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        }
      },
      resolveError: (body, status) => String(body.message || `${fallbackMessage}: ${status}`)
    }
  );
}

export async function fetchRepairOpen(payload: {
  projectId: string;
  releaseUnitId: string;
  guidedStateId: string;
  templateLineId: string;
  screenFamilyRuleId: string;
  ownerLane: string;
  selectedScreenId: string;
  builderInput: Record<string, unknown>;
  runtimeEvidence: Record<string, unknown>;
  selectedElementSet: string[];
  compareBaseline: string;
  reasonCode: string;
  existingAssetReuseSet: string[];
  requestedBy: string;
  requestedByType: string;
  requestNote?: string;
}) {
  return postResonanceJson<ResonanceRepairOpenResponse & { message?: string }>(
    "/api/platform/runtime/repair/open",
    payload,
    "Failed to open repair session"
  );
}

export async function fetchRepairApply(payload: {
  repairSessionId: string;
  projectId: string;
  releaseUnitId: string;
  guidedStateId: string;
  templateLineId: string;
  screenFamilyRuleId: string;
  ownerLane: string;
  selectedScreenId: string;
  selectedElementSet: string[];
  compareBaseline: string;
  builderInput: Record<string, unknown>;
  runtimeEvidence: Record<string, unknown>;
  updatedAssetSet: string[];
  updatedBindingSet: string[];
  updatedThemeOrLayoutSet: string[];
  sqlDraftSet: string[];
  publishMode: string;
  requestedBy: string;
  requestedByType: string;
  changeSummary: string;
}) {
  return postResonanceJson<ResonanceRepairApplyResponse & { message?: string }>(
    "/api/platform/runtime/repair/apply",
    payload,
    "Failed to apply repair session"
  );
}

export async function runProjectPipeline(payload: {
  projectId: string;
  scenarioId?: string;
  guidedStateId?: string;
  templateLineId?: string;
  screenFamilyRuleId?: string;
  ownerLane?: string;
  menuRoot: string;
  runtimeClass: string;
  menuScope: string;
  releaseUnitId?: string;
  runtimePackageId?: string;
  releaseUnitPrefix: string;
  runtimePackagePrefix: string;
  artifactTargetSystem?: string;
  deploymentTarget?: string;
  operator?: string;
}) {
  return postResonanceJson<ResonanceProjectPipelineResponse & { message?: string }>(
    "/api/platform/runtime/project-pipeline/run",
    payload,
    "Failed to run project pipeline"
  );
}

export async function fetchProjectPipelineStatus(payload: {
  projectId: string;
  pipelineRunId?: string;
  releaseUnitId?: string;
}) {
  return postResonanceJson<ResonanceProjectPipelineResponse & { message?: string }>(
    "/api/platform/runtime/project-pipeline/status",
    payload,
    "Failed to load project pipeline status"
  );
}
