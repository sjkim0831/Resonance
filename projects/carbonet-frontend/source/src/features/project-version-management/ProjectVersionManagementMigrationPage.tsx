import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  approveDbPatchQueue,
  analyzeProjectUpgradeImpact,
  executeDbPatchQueue,
  fetchDbChangeLogList,
  applyProjectUpgrade,
  fetchDbPatchQueueList,
  fetchDbPatchResultList,
  fetchDbChangeCaptureSummary,
  fetchProjectVersionManagementPage,
  fetchProjectVersionOperations,
  queueDbChangeLog,
  rejectDbPatchQueue,
  runProjectVersionSyncAndDeploy,
  rollbackProjectVersion
} from "../../lib/api/platform";
import type {
  ProjectApplyUpgradeResponse,
  ProjectRollbackResponse,
  ProjectUpgradeImpactResponse,
  ProjectVersionManagementPagePayload,
  ProjectVersionOpsPayload,
  ProjectVersionTargetArtifactPayload
} from "../../lib/api/platformTypes";
import { fetchBackupConfigPage, runBackupExecution, saveBackupConfig } from "../../lib/api/ops";
import {
  fetchProjectPipelineStatus,
  runProjectPipeline,
  type ResonanceProjectPipelineResponse
} from "../../lib/api/resonanceControlPlane";
import {
  getCurrentRuntimeHash,
  buildRuntimeLocationState,
  getCurrentRuntimeLocationState,
  getCurrentRuntimePathname,
  getCurrentRuntimeSearch,
  navigateToRuntimeHref
} from "../../app/routes/runtime";
import { buildUnifiedLogPath, buildUnifiedLogTracePath } from "../../platform/routes/platformPaths";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { GridToolbar, KeyValueGridPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberPermissionButton, MemberSectionToolbar } from "../member/common";
import { MemberStateCard } from "../member/sections";

const DEFAULT_PROJECT_ID = "carbonet";
const DEFAULT_OPERATOR = "system-operator";
const VERSION_VIEW_FEATURE = "A0060404_VIEW";
const VERSION_ANALYZE_FEATURE = "A0060404_ANALYZE";
const VERSION_APPLY_FEATURE = "A0060404_APPLY";
const VERSION_ROLLBACK_FEATURE = "A0060404_ROLLBACK";
const VERSION_REQUIRED_FEATURE_SET = [
  VERSION_VIEW_FEATURE,
  VERSION_ANALYZE_FEATURE,
  VERSION_APPLY_FEATURE,
  VERSION_ROLLBACK_FEATURE
];
const DEFAULT_REMOTE_DEPLOY_MODE = "pull";

function hasVersionFeature(authorCode: string, featureCodes: string[], requiredFeature: string) {
  const normalizedAuthorCode = authorCode.trim().toUpperCase();
  if (normalizedAuthorCode === "ROLE_SYSTEM_MASTER") {
    return true;
  }
  return featureCodes.includes("*") || featureCodes.includes(requiredFeature);
}

function stringOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberOf(value: unknown) {
  return typeof value === "number" ? value : Number(value) || 0;
}

function getProjectVersionRoutePath() {
  return getCurrentRuntimePathname();
}

function getProjectVersionSearchParams() {
  return new URLSearchParams(getCurrentRuntimeSearch());
}

function readProjectIdFromLocation() {
  if (typeof window === "undefined") {
    return DEFAULT_PROJECT_ID;
  }
  return getProjectVersionSearchParams().get("projectId") || DEFAULT_PROJECT_ID;
}

function buildProjectVersionLocationState(projectId: string) {
  const nextSearch = getProjectVersionSearchParams();
  if (projectId) {
    nextSearch.set("projectId", projectId);
  } else {
    nextSearch.delete("projectId");
  }
  return buildRuntimeLocationState(
    getProjectVersionRoutePath(),
    nextSearch.toString() ? `?${nextSearch.toString()}` : "",
    getCurrentRuntimeHash()
  );
}

function getProjectVersionCurrentLocationState() {
  return getCurrentRuntimeLocationState();
}

function openProjectVersionHref(href: string) {
  navigateToRuntimeHref(href);
}

function compatibilityTone(value: string) {
  if (value === "ADAPTER_BREAKING") return "bg-rose-100 text-rose-700";
  if (value === "ADAPTER_REVIEW_REQUIRED") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function truthLabel(value: unknown, en: boolean) {
  const enabled = value === true || value === "Y" || value === 1;
  return enabled ? (en ? "Yes" : "예") : (en ? "No" : "아니오");
}

function normalizeTargetArtifacts(rows: Array<Record<string, unknown>>): ProjectVersionTargetArtifactPayload[] {
  return rows
    .map((row) => ({
      artifactId: stringOf(row.artifactId),
      artifactVersion: stringOf(row.installedArtifactVersion || row.artifactVersion)
    }))
    .filter((row) => row.artifactId && row.artifactVersion);
}

function replaceTargetArtifact(
  current: ProjectVersionTargetArtifactPayload[],
  nextItem: ProjectVersionTargetArtifactPayload
) {
  const withoutSameArtifact = current.filter((item) => item.artifactId !== nextItem.artifactId);
  return [...withoutSameArtifact, nextItem];
}

function candidateStatusTone(status: "INSTALLED" | "LATEST" | "REVIEW" | "AVAILABLE") {
  if (status === "INSTALLED") return "bg-slate-100 text-slate-700";
  if (status === "LATEST") return "bg-emerald-100 text-emerald-700";
  if (status === "REVIEW") return "bg-amber-100 text-amber-700";
  return "bg-blue-100 text-blue-700";
}

function parseJsonList(value: unknown) {
  const raw = stringOf(value);
  if (!raw) {
    return [] as Array<Record<string, unknown>>;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : [];
  } catch {
    return [];
  }
}

function parseJsonRecord(value: unknown) {
  const raw = stringOf(value);
  if (!raw) {
    return {} as Record<string, unknown>;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function toList(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined) : [];
}

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function serverHealthTone(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("HEALTHY")) return "bg-emerald-100 text-emerald-700";
  if (upper.includes("WARNING") || upper.includes("REVIEW")) return "bg-amber-100 text-amber-700";
  if (upper.includes("ERROR") || upper.includes("FAIL") || upper.includes("DOWN")) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

type ServerRoleFilter = "ALL" | "ACTIVE" | "PREVIEW" | "STAGE" | "UNKNOWN";

function inferServerRole(server: Record<string, unknown>): ServerRoleFilter {
  const explicitRole = stringOf(server.serverRole).toUpperCase();
  const serverId = stringOf(server.serverId).toUpperCase();
  const joined = `${explicitRole} ${serverId}`;
  if (joined.includes("ACTIVE") || joined.includes("MAIN") || joined.includes("PROD") || joined.includes("PRIMARY")) return "ACTIVE";
  if (joined.includes("PREVIEW")) return "PREVIEW";
  if (joined.includes("STAGE") || joined.includes("IDLE")) return "STAGE";
  return "UNKNOWN";
}

function normalizePipelineRole(value: unknown) {
  const upper = stringOf(value).toUpperCase();
  if (upper === "ACTIVE" || upper === "MAIN" || upper === "PROD" || upper === "PRIMARY") return "PRIMARY";
  if (upper === "STAGE") return "STAGE";
  if (upper === "PREVIEW") return "PREVIEW";
  return upper;
}

function serverRoleTone(role: ServerRoleFilter) {
  if (role === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (role === "PREVIEW") return "bg-blue-100 text-blue-700";
  if (role === "STAGE") return "bg-violet-100 text-violet-700";
  return "bg-slate-100 text-slate-700";
}

function isPermissionDeniedMessage(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return normalized.includes("permission")
    || normalized.includes("forbidden")
    || normalized.includes("권한")
    || normalized.includes("403");
}

function buildDeployTraceHref(projectId: string, traceId: string) {
  const normalizedTraceId = traceId.trim();
  if (!normalizedTraceId) {
    return "";
  }
  return buildUnifiedLogTracePath({
    traceId: normalizedTraceId,
    projectId: projectId.trim()
  });
}

function buildUnifiedLogTargetHref(projectId: string, targetType: string, targetId: string) {
  const normalizedType = targetType.trim();
  const normalizedId = targetId.trim();
  if (!normalizedType || !normalizedId) {
    return "";
  }
  return buildUnifiedLogPath({
    projectId: projectId.trim(),
    targetType: normalizedType,
    targetId: normalizedId
  });
}

function jobStatusTone(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("SUCCESS")) return "bg-emerald-100 text-emerald-700";
  if (upper.includes("RUNNING") || upper.includes("QUEUED")) return "bg-blue-100 text-blue-700";
  if (upper.includes("FAILED") || upper.includes("ERROR")) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function noticeTone(value: string): "success" | "error" | "warning" {
  const normalized = value.toLowerCase();
  if (normalized.includes("fail") || value.includes("실패") || normalized.includes("error")) {
    return "error";
  }
  if (normalized.includes("permission") || value.includes("권한") || normalized.includes("forbidden")) {
    return "warning";
  }
  return "success";
}

function backupValueOf(form: Record<string, string>, key: string) {
  return form[key] || "";
}

function backupYes(form: Record<string, string>, key: string) {
  return backupValueOf(form, key) === "Y";
}

function deriveDbPatchDefaultsFromBackupSettings(form: Record<string, string>) {
  const preset = backupValueOf(form, "dbDiffExecutionPreset") || "PATCH_WITH_DIFF";
  const base = preset === "PATCH_ONLY"
    ? {
      executionMode: "DB_ONLY_PREDEPLOY",
      applyDbDiffToRemoteYn: "N",
      applyDbDiffToLocalYn: "N",
      skipDbSchemaDiffYn: "Y",
      forceDestructiveDiffYn: "N",
      failOnDbDiffRemainsYn: "N",
      failOnUntrackedDestructiveDiffYn: "N",
      remoteDeployMode: "pull"
    }
    : preset === "FULL_REMOTE_DEPLOY"
      ? {
        executionMode: "FULL_REMOTE_DEPLOY",
        applyDbDiffToRemoteYn: "Y",
        applyDbDiffToLocalYn: "N",
        skipDbSchemaDiffYn: "N",
        forceDestructiveDiffYn: "N",
        failOnDbDiffRemainsYn: "Y",
        failOnUntrackedDestructiveDiffYn: "N",
        remoteDeployMode: "pull"
      }
      : {
        executionMode: "DB_ONLY_PREDEPLOY",
        applyDbDiffToRemoteYn: "Y",
        applyDbDiffToLocalYn: "N",
        skipDbSchemaDiffYn: "N",
        forceDestructiveDiffYn: "N",
        failOnDbDiffRemainsYn: "Y",
        failOnUntrackedDestructiveDiffYn: "N",
        remoteDeployMode: "pull"
      };
  const promotionPolicy = backupValueOf(form, "dbPromotionDataPolicy") || "CONTROLLED_REFERENCE_ONLY";
  return {
    executionMode: base.executionMode,
    targetEnv: "REMOTE_MAIN",
    applyDbDiffToRemoteYn: base.applyDbDiffToRemoteYn,
    applyDbDiffToLocalYn: backupYes(form, "dbApplyLocalDiffYn") ? "Y" : base.applyDbDiffToLocalYn,
    skipDbSchemaDiffYn: base.skipDbSchemaDiffYn,
    forceDestructiveDiffYn: backupYes(form, "dbForceDestructiveDiffYn") ? "Y" : base.forceDestructiveDiffYn,
    failOnDbDiffRemainsYn: base.failOnDbDiffRemainsYn,
    failOnUntrackedDestructiveDiffYn: backupYes(form, "dbFailOnUntrackedDestructiveDiffYn") ? "Y" : base.failOnUntrackedDestructiveDiffYn,
    allowPolicyOverrideYn: promotionPolicy === "CONTROLLED_REFERENCE_ONLY" ? "N" : "Y",
    allowBusinessDataPatchYn: promotionPolicy === "CONTROLLED_REFERENCE_ONLY" ? "N" : "Y",
    requireDbPatchHistoryYn: backupYes(form, "dbRequirePatchHistoryYn") ? "Y" : "N",
    policyOverrideReason: "",
    remoteDeployMode: "pull",
    forceQueue: "N"
  };
}

export function ProjectVersionManagementMigrationPage() {
  const en = isEnglish();
  const initialProjectId = readProjectIdFromLocation();
  const sessionState = useFrontendSession();
  const [draftProjectId, setDraftProjectId] = useState(initialProjectId);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [targetArtifactSet, setTargetArtifactSet] = useState<ProjectVersionTargetArtifactPayload[]>([]);
  const [artifactDraft, setArtifactDraft] = useState<ProjectVersionTargetArtifactPayload>({ artifactId: "", artifactVersion: "" });
  const [rollbackTargetReleaseId, setRollbackTargetReleaseId] = useState("");
  const [selectedReleaseUnitId, setSelectedReleaseUnitId] = useState("");
  const [selectedServerId, setSelectedServerId] = useState("");
  const [serverRoleFilter, setServerRoleFilter] = useState<ServerRoleFilter>("ALL");
  const [impact, setImpact] = useState<ProjectUpgradeImpactResponse | null>(null);
  const [applyResult, setApplyResult] = useState<ProjectApplyUpgradeResponse | null>(null);
  const [rollbackResult, setRollbackResult] = useState<ProjectRollbackResponse | null>(null);
  const [operationMessage, setOperationMessage] = useState("");
  const [submitting, setSubmitting] = useState<"" | "impact" | "apply" | "rollback">("");
  const [projectPipeline, setProjectPipeline] = useState<ResonanceProjectPipelineResponse | null>(null);
  const [pipelineRunLoading, setPipelineRunLoading] = useState(false);
  const [pipelineRunError, setPipelineRunError] = useState("");
  const [pipelineRunSuccess, setPipelineRunSuccess] = useState("");
  const [opsSubmitting, setOpsSubmitting] = useState<"" | "db-backup" | "git-precheck" | "git-push" | "remote-sync">("");
  const [opsMessage, setOpsMessage] = useState("");
  const [backupSettingsForm, setBackupSettingsForm] = useState<Record<string, string>>({});
  const [backupSettingsSaving, setBackupSettingsSaving] = useState(false);
  const [deployForm, setDeployForm] = useState({
    releaseVersion: "",
    releaseTitle: "",
    releaseContent: "",
    remoteDeployMode: DEFAULT_REMOTE_DEPLOY_MODE
  });

  const backupSettingsState = useAsyncValue(
    () => fetchBackupConfigPage("/admin/system/backup_config"),
    [refreshNonce]
  );

  const pageState = useAsyncValue<ProjectVersionManagementPagePayload>(
    () => fetchProjectVersionManagementPage({ projectId, page: 1, pageSize: 20 }),
    [projectId, refreshNonce]
  );
  const operationsState = useAsyncValue<ProjectVersionOpsPayload>(
    () => fetchProjectVersionOperations({ projectId }),
    [projectId, refreshNonce]
  );
  const changeCaptureState = useAsyncValue<Record<string, unknown>>(
    () => fetchDbChangeCaptureSummary({ projectId }),
    [projectId, refreshNonce]
  );
  const changeLogListState = useAsyncValue<Record<string, unknown>[]>(
    () => fetchDbChangeLogList({ projectId, limit: 12 }),
    [projectId, refreshNonce]
  );
  const patchQueueState = useAsyncValue<Record<string, unknown>[]>(
    () => fetchDbPatchQueueList({ projectId, limit: 12 }),
    [projectId, refreshNonce]
  );
  const patchResultState = useAsyncValue<Record<string, unknown>[]>(
    () => fetchDbPatchResultList({ projectId, limit: 12 }),
    [projectId, refreshNonce]
  );
  const pipelineStatusState = useAsyncValue(
    () => fetchProjectPipelineStatus({ projectId }),
    [projectId],
    {
      enabled: false,
      onSuccess: (value) => {
        setProjectPipeline(value);
        setPipelineRunError("");
      },
      onError: (error) => {
        setPipelineRunError(error.message);
      }
    }
  );

  const overview = pageState.value?.overview;
  const operationsPayload = operationsState.value;
  const backupSettingsPayload = backupSettingsState.value;
  const sessionFeatureCodes = sessionState.value?.featureCodes || [];
  const sessionAuthorCode = stringOf(sessionState.value?.authorCode);
  const canViewVersionManagement = hasVersionFeature(sessionAuthorCode, sessionFeatureCodes, VERSION_VIEW_FEATURE);
  const canAnalyzeUpgrade = hasVersionFeature(sessionAuthorCode, sessionFeatureCodes, VERSION_ANALYZE_FEATURE);
  const canApplyUpgrade = hasVersionFeature(sessionAuthorCode, sessionFeatureCodes, VERSION_APPLY_FEATURE);
  const canRollbackRelease = hasVersionFeature(sessionAuthorCode, sessionFeatureCodes, VERSION_ROLLBACK_FEATURE);
  const pagePermissionDenied = !sessionState.loading && isPermissionDeniedMessage(pageState.error || "");
  const showSessionFeatureWarning = !sessionState.loading
    && !canViewVersionManagement
    && !pageState.value
    && !operationsState.value;
  const missingFeatureCodes = useMemo(
    () => VERSION_REQUIRED_FEATURE_SET.filter((featureCode) => !hasVersionFeature(sessionAuthorCode, sessionFeatureCodes, featureCode)),
    [sessionAuthorCode, sessionFeatureCodes]
  );
  const adapterHistory = (pageState.value?.adapterHistory?.itemSet || []) as Array<Record<string, unknown>>;
  const releaseUnits = (pageState.value?.releaseUnits?.itemSet || []) as Array<Record<string, unknown>>;
  const serverStates = (pageState.value?.serverDeployState?.serverStateSet || []) as Array<Record<string, unknown>>;
  const candidateArtifacts = (pageState.value?.candidateArtifacts?.itemSet || []) as Array<Record<string, unknown>>;
  const artifactLocks = (pageState.value?.fleetGovernance?.artifactLocks?.itemSet || []) as Array<Record<string, unknown>>;
  const compatibilityRuns = (pageState.value?.fleetGovernance?.compatibilityRuns?.itemSet || []) as Array<Record<string, unknown>>;
  const fleetGovernanceNextSteps = (pageState.value?.fleetGovernance?.recommendedNextStepSet || []) as Array<Record<string, unknown>>;
  const installedArtifacts = ((overview?.installedArtifactSet || []) as Array<Record<string, unknown>>);
  const installedPackages = ((overview?.installedPackageSet || []) as Array<Record<string, unknown>>);
  const currentRemoteJob = toRecord(operationsPayload?.currentRemoteJob);
  const recentRemoteJobs = toList(operationsPayload?.recentRemoteJobs);
  const currentBackupJob = toRecord(backupSettingsPayload?.backupCurrentJob);
  const recentBackupJobs = toList(backupSettingsPayload?.backupRecentJobs);
  const backupCoverageSet = toList(operationsPayload?.backupCoverageSet).map((item) => stringOf(item));
  const launcherExclusiveSet = toList(operationsPayload?.launcherExclusiveSet).map((item) => stringOf(item));
  const recommendedFlowSet = toList(operationsPayload?.recommendedFlowSet).map((item) => stringOf(item));
  const changeCaptureSummary = toRecord(changeCaptureState.value);
  const dbChangeLogs = Array.isArray(changeLogListState.value) ? changeLogListState.value : [];
  const dbPatchQueueRows = Array.isArray(patchQueueState.value) ? patchQueueState.value : [];
  const dbPatchResultRows = Array.isArray(patchResultState.value) ? patchResultState.value : [];
  const [dbPatchSubmitting, setDbPatchSubmitting] = useState("");
  const [dbPatchMessage, setDbPatchMessage] = useState("");
  const [dbPatchOptions, setDbPatchOptions] = useState(() => deriveDbPatchDefaultsFromBackupSettings({}));
  const [dbPatchDefaultsLoaded, setDbPatchDefaultsLoaded] = useState(false);
  const dbPatchPresetOptions = useMemo(() => ([
    {
      id: "PATCH_ONLY",
      label: en ? "Patch Only" : "패치만 반영",
      variant: "primary" as const,
      description: en ? "Skip schema diff and app deploy. Apply only the generated SQL patch to remote DB." : "스키마 diff와 앱 배포를 생략하고 생성된 SQL 패치만 운영 DB에 반영합니다.",
      values: {
        executionMode: "DB_ONLY_PREDEPLOY",
        applyDbDiffToRemoteYn: "N",
        applyDbDiffToLocalYn: "N",
        skipDbSchemaDiffYn: "Y",
        forceDestructiveDiffYn: "N",
        failOnDbDiffRemainsYn: "N",
        failOnUntrackedDestructiveDiffYn: "N",
        remoteDeployMode: "pull"
      }
    },
    {
      id: "PATCH_WITH_DIFF",
      label: en ? "Patch + Diff Guard" : "패치 + diff 검증",
      variant: "secondary" as const,
      description: en ? "Run remote diff guard before patch application, but still skip full app deploy." : "전체 앱 배포는 생략하되 원격 diff 검증 후 패치를 적용합니다.",
      values: {
        executionMode: "DB_ONLY_PREDEPLOY",
        applyDbDiffToRemoteYn: "Y",
        applyDbDiffToLocalYn: "N",
        skipDbSchemaDiffYn: "N",
        forceDestructiveDiffYn: "N",
        failOnDbDiffRemainsYn: "Y",
        failOnUntrackedDestructiveDiffYn: "N",
        remoteDeployMode: "pull"
      }
    },
    {
      id: "FULL_REMOTE_DEPLOY",
      label: en ? "Full Remote Deploy" : "원격 전체 배포",
      variant: "secondary" as const,
      description: en ? "Apply DB patch and continue through git push and remote application deploy." : "DB 패치 반영 후 git push와 원격 애플리케이션 배포까지 이어갑니다.",
      values: {
        executionMode: "FULL_REMOTE_DEPLOY",
        applyDbDiffToRemoteYn: "Y",
        applyDbDiffToLocalYn: "N",
        skipDbSchemaDiffYn: "N",
        forceDestructiveDiffYn: "N",
        failOnDbDiffRemainsYn: "Y",
        failOnUntrackedDestructiveDiffYn: "N",
        remoteDeployMode: "pull"
      }
    }
  ]), [en]);
  const recentDeploymentHistory = toList(operationsPayload?.recentDeploymentHistory);
  const remoteDeployModeOptions = toList(operationsPayload?.remoteDeployModeOptionSet).map((item) => toRecord(item));
  const defaultRemoteDeployMode = stringOf(operationsPayload?.defaultRemoteDeployMode) || DEFAULT_REMOTE_DEPLOY_MODE;

  useEffect(() => {
    setDeployForm((current) => ({
      ...current,
      remoteDeployMode: current.remoteDeployMode || defaultRemoteDeployMode
    }));
  }, [defaultRemoteDeployMode]);
  const hasOverviewVersionBaseline = Boolean(
    stringOf(overview?.activeRuntimeVersion)
    || stringOf(overview?.activeCommonCoreVersion)
    || stringOf(overview?.activeAdapterContractVersion)
    || stringOf(overview?.rollbackReadyReleaseUnitId)
  );
  const hasVersionGovernanceData = (
    installedArtifacts.length > 0
    || installedPackages.length > 0
    || adapterHistory.length > 0
    || releaseUnits.length > 0
    || serverStates.length > 0
    || candidateArtifacts.length > 0
    || artifactLocks.length > 0
    || compatibilityRuns.length > 0
    || hasOverviewVersionBaseline
  );
  const isInitializationState = !pageState.loading && !pageState.error && canViewVersionManagement && !hasVersionGovernanceData;
  const backupJobActive = (() => {
    const status = stringOf(currentBackupJob.status).toUpperCase();
    return status === "QUEUED" || status === "RUNNING";
  })();
  const remoteJobActive = (() => {
    const status = stringOf(currentRemoteJob.status).toUpperCase();
    return status === "QUEUED" || status === "RUNNING";
  })();
  const filteredServerStates = useMemo(
    () => serverStates.filter((item) => serverRoleFilter === "ALL" || inferServerRole(item) === serverRoleFilter),
    [serverRoleFilter, serverStates]
  );
  const selectedReleaseUnit = useMemo(
    () => releaseUnits.find((item) => stringOf(item.releaseUnitId) === selectedReleaseUnitId) || releaseUnits[0] || null,
    [releaseUnits, selectedReleaseUnitId]
  );
  const selectedServer = useMemo(
    () => filteredServerStates.find((item) => stringOf(item.serverId) === selectedServerId) || filteredServerStates[0] || null,
    [filteredServerStates, selectedServerId]
  );
  const selectedReleaseCommonArtifacts = useMemo(
    () => parseJsonRecord(selectedReleaseUnit?.commonArtifactSet).targetArtifactSet
      ? parseJsonList(JSON.stringify((parseJsonRecord(selectedReleaseUnit?.commonArtifactSet).targetArtifactSet)))
      : parseJsonList(selectedReleaseUnit?.commonArtifactSet),
    [selectedReleaseUnit]
  );
  const selectedReleasePackages = useMemo(
    () => parseJsonList(selectedReleaseUnit?.packageVersionSet),
    [selectedReleaseUnit]
  );
  const latestCandidateVersionMap = useMemo(() => {
    const next = new Map<string, string>();
    candidateArtifacts.forEach((item) => {
      const artifactId = stringOf(item.artifactId);
      const artifactVersion = stringOf(item.latestArtifactVersion || item.artifactVersion);
      const upgradeReady = item.upgradeReadyYn === true || item.upgradeReadyYn === "Y" || item.upgradeReadyYn === 1;
      if (!artifactId || !artifactVersion || next.has(artifactId) || !upgradeReady) {
        return;
      }
      next.set(artifactId, artifactVersion);
    });
    return next;
  }, [candidateArtifacts]);
  const latestCandidateSet = useMemo(() => {
    const next: ProjectVersionTargetArtifactPayload[] = [];
    latestCandidateVersionMap.forEach((artifactVersion, artifactId) => {
      if (!artifactId || !artifactVersion) {
        return;
      }
      next.push({ artifactId, artifactVersion });
    });
    return next;
  }, [latestCandidateVersionMap]);

  useEffect(() => {
    const nextUrl = buildProjectVersionLocationState(projectId);
    const currentUrl = getProjectVersionCurrentLocationState();
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [projectId]);

  useEffect(() => {
    if (!overview) {
      return;
    }
    setRollbackTargetReleaseId((current) => current || stringOf(overview.rollbackReadyReleaseUnitId) || stringOf(releaseUnits[0]?.releaseUnitId));
    setSelectedReleaseUnitId((current) => current || stringOf(releaseUnits[0]?.releaseUnitId));
    setSelectedServerId((current) => current || stringOf(filteredServerStates[0]?.serverId) || stringOf(serverStates[0]?.serverId));
    setTargetArtifactSet((current) => current.length > 0 ? current : normalizeTargetArtifacts(installedArtifacts));
  }, [filteredServerStates, installedArtifacts, overview, releaseUnits, serverStates]);

  useEffect(() => {
    const releaseUnitId = stringOf(applyResult?.releaseUnitId);
    if (!releaseUnitId) {
      return;
    }
    setSelectedReleaseUnitId(releaseUnitId);
    const alignedServer = filteredServerStates.find((item) => stringOf(item.activeReleaseUnitId) === releaseUnitId);
    if (alignedServer) {
      setSelectedServerId(stringOf(alignedServer.serverId));
    }
  }, [applyResult, filteredServerStates]);

  useEffect(() => {
    const releaseUnitId = stringOf(rollbackResult?.rolledBackToReleaseUnitId);
    if (!releaseUnitId) {
      return;
    }
    setSelectedReleaseUnitId(releaseUnitId);
    setRollbackTargetReleaseId((current) => current || stringOf(rollbackResult?.rollbackTargetReleaseId));
    const alignedServer = filteredServerStates.find((item) => stringOf(item.activeReleaseUnitId) === releaseUnitId);
    if (alignedServer) {
      setSelectedServerId(stringOf(alignedServer.serverId));
    }
  }, [filteredServerStates, rollbackResult]);

  useEffect(() => {
    logGovernanceScope("PAGE", "project-version-management", {
      route: typeof window === "undefined" ? "" : getProjectVersionRoutePath(),
      projectId,
      installedArtifactCount: installedArtifacts.length,
      adapterHistoryCount: adapterHistory.length,
      releaseUnitCount: releaseUnits.length,
      serverStateCount: serverStates.length
    });
  }, [adapterHistory.length, installedArtifacts.length, projectId, releaseUnits.length, serverStates.length]);

  useEffect(() => {
    setBackupSettingsForm((backupSettingsPayload?.backupConfigForm || {}) as Record<string, string>);
  }, [backupSettingsPayload?.backupConfigForm]);

  useEffect(() => {
    const nextForm = (backupSettingsPayload?.backupConfigForm || {}) as Record<string, string>;
    if (dbPatchDefaultsLoaded || Object.keys(nextForm).length === 0) {
      return;
    }
    setDbPatchOptions((current) => ({
      ...current,
      ...deriveDbPatchDefaultsFromBackupSettings(nextForm)
    }));
    setDbPatchDefaultsLoaded(true);
  }, [backupSettingsPayload?.backupConfigForm, dbPatchDefaultsLoaded]);

  useEffect(() => {
    if (!backupJobActive && !remoteJobActive) {
      return;
    }
    const timer = window.setInterval(() => {
      void Promise.allSettled([
        backupSettingsState.reload(),
        operationsState.reload()
      ]);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [backupJobActive, remoteJobActive, backupSettingsState, operationsState]);

  async function reloadDbPatchState() {
    await Promise.allSettled([
      changeCaptureState.reload(),
      changeLogListState.reload(),
      patchQueueState.reload(),
      patchResultState.reload()
    ]);
  }

  async function handleQueueChangeLog(changeLogId: string) {
    setDbPatchSubmitting(`queue:${changeLogId}`);
    setDbPatchMessage("");
    try {
      const response = await queueDbChangeLog(changeLogId, {
        forceQueue: dbPatchOptions.forceQueue === "Y",
        policyOverrideReason: dbPatchOptions.policyOverrideReason,
        targetEnv: dbPatchOptions.targetEnv
      });
      setDbPatchMessage(stringOf(response.message) || (en ? "Queued change log." : "변경 로그를 큐에 올렸습니다."));
      await reloadDbPatchState();
    } catch (error) {
      setDbPatchMessage(error instanceof Error ? error.message : (en ? "Failed to queue change log." : "변경 로그 큐 등록에 실패했습니다."));
    } finally {
      setDbPatchSubmitting("");
    }
  }

  async function handleApproveQueue(queueId: string) {
    setDbPatchSubmitting(`approve:${queueId}`);
    setDbPatchMessage("");
    try {
      const response = await approveDbPatchQueue(queueId);
      setDbPatchMessage(stringOf(response.message) || (en ? "Queue approved." : "패치 큐를 승인했습니다."));
      await reloadDbPatchState();
    } catch (error) {
      setDbPatchMessage(error instanceof Error ? error.message : (en ? "Failed to approve queue." : "패치 큐 승인에 실패했습니다."));
    } finally {
      setDbPatchSubmitting("");
    }
  }

  async function handleRejectQueue(queueId: string) {
    setDbPatchSubmitting(`reject:${queueId}`);
    setDbPatchMessage("");
    try {
      const response = await rejectDbPatchQueue(queueId);
      setDbPatchMessage(stringOf(response.message) || (en ? "Queue rejected." : "패치 큐를 반려했습니다."));
      await reloadDbPatchState();
    } catch (error) {
      setDbPatchMessage(error instanceof Error ? error.message : (en ? "Failed to reject queue." : "패치 큐 반려에 실패했습니다."));
    } finally {
      setDbPatchSubmitting("");
    }
  }

  async function handleExecuteQueue(queueId: string) {
    setDbPatchSubmitting(`execute:${queueId}`);
    setDbPatchMessage("");
    try {
      const response = await executeDbPatchQueue(queueId, {
        executionMode: dbPatchOptions.executionMode,
        targetEnv: dbPatchOptions.targetEnv,
        applyDbDiffToRemoteYn: dbPatchOptions.applyDbDiffToRemoteYn === "Y",
        applyDbDiffToLocalYn: dbPatchOptions.applyDbDiffToLocalYn === "Y",
        skipDbSchemaDiffYn: dbPatchOptions.skipDbSchemaDiffYn === "Y",
        forceDestructiveDiffYn: dbPatchOptions.forceDestructiveDiffYn === "Y",
        failOnDbDiffRemainsYn: dbPatchOptions.failOnDbDiffRemainsYn === "Y",
        failOnUntrackedDestructiveDiffYn: dbPatchOptions.failOnUntrackedDestructiveDiffYn === "Y",
        allowBusinessDataPatchYn: dbPatchOptions.allowBusinessDataPatchYn === "Y",
        requireDbPatchHistoryYn: dbPatchOptions.requireDbPatchHistoryYn === "Y",
        allowPolicyOverrideYn: dbPatchOptions.allowPolicyOverrideYn === "Y",
        policyOverrideReason: dbPatchOptions.policyOverrideReason,
        remoteDeployMode: dbPatchOptions.remoteDeployMode
      });
      setDbPatchMessage(stringOf(response.message) || (en ? "Queue executed." : "패치 큐를 실행했습니다."));
      await reloadDbPatchState();
    } catch (error) {
      setDbPatchMessage(error instanceof Error ? error.message : (en ? "Failed to execute queue." : "패치 큐 실행에 실패했습니다."));
    } finally {
      setDbPatchSubmitting("");
    }
  }

  function updateDbPatchOption(key: string, value: string) {
    setDbPatchOptions((current) => ({ ...current, [key]: value }));
  }

  function applyDbPatchPreset(values: Partial<typeof dbPatchOptions>) {
    setDbPatchOptions((current) => ({
      ...current,
      ...values
    }));
    setDbPatchMessage("");
  }

  const summaryCards = useMemo(() => ([
    {
      title: en ? "Installed Artifacts" : "설치 아티팩트",
      value: String(installedArtifacts.length),
      description: en ? "Artifact versions pinned to this project." : "현재 프로젝트에 고정된 아티팩트 버전 수입니다."
    },
    {
      title: en ? "Adapter Changes" : "어댑터 변경",
      value: String(numberOf(pageState.value?.adapterHistory?.totalCount)),
      description: en ? "Recorded adapter compatibility events." : "기록된 어댑터 호환성 이벤트 수입니다."
    },
    {
      title: en ? "Release Units" : "릴리스 유닛",
      value: String(numberOf(pageState.value?.releaseUnits?.totalCount)),
      description: en ? "Deployable runtime package combinations." : "배포 가능한 런타임 패키지 조합 수입니다."
    },
    {
      title: en ? "Servers Tracked" : "서버 추적 수",
      value: String(serverStates.length),
      description: en ? "Deployment states registered for this project." : "이 프로젝트에 등록된 서버 배포 상태 수입니다."
    },
    {
      title: en ? "Candidate Versions" : "후보 버전",
      value: String(numberOf(pageState.value?.candidateArtifacts?.totalCount)),
      description: en ? "Version candidates available on current artifact lines." : "현재 artifact 라인에서 선택 가능한 후보 버전 수입니다."
    },
    {
      title: en ? "Fleet Runs" : "공통 호환성 실행",
      value: String(numberOf(pageState.value?.fleetGovernance?.compatibilityRuns?.totalCount)),
      description: en ? "Recorded compatibility decisions for fleet-wide common upgrades." : "공통 업그레이드 호환성 판단 기록 수입니다."
    }
  ]), [en, installedArtifacts.length, pageState.value?.adapterHistory?.totalCount, pageState.value?.candidateArtifacts?.totalCount, pageState.value?.fleetGovernance?.compatibilityRuns?.totalCount, pageState.value?.releaseUnits?.totalCount, serverStates.length]);
  const deploySummaryCards = useMemo(() => {
    const matchedServerCount = filteredServerStates.filter((item) => stringOf(item.activeReleaseUnitId) === stringOf(selectedReleaseUnit?.releaseUnitId)).length;
    const reviewServerCount = filteredServerStates.filter((item) => {
      const health = stringOf(item.healthStatus).toUpperCase();
      return health.includes("WARNING") || health.includes("REVIEW");
    }).length;
    const driftServerCount = filteredServerStates.filter((item) => (
      stringOf(selectedReleaseUnit?.releaseUnitId)
      && stringOf(item.activeReleaseUnitId)
      && stringOf(item.activeReleaseUnitId) !== stringOf(selectedReleaseUnit?.releaseUnitId)
    )).length;
    return [
      {
        title: en ? "Servers On Selected Release" : "선택 릴리스 적용 서버",
        value: String(matchedServerCount),
        description: en ? "Servers already aligned to the selected release unit." : "선택된 릴리스 유닛과 이미 일치하는 서버 수입니다."
      },
      {
        title: en ? "Servers In Drift" : "릴리스 불일치 서버",
        value: String(driftServerCount),
        description: en ? "Servers running a different active release." : "다른 active release를 가리키는 서버 수입니다."
      },
      {
        title: en ? "Review Required" : "점검 필요 서버",
        value: String(reviewServerCount),
        description: en ? "Servers currently marked warning or review." : "현재 warning 또는 review 상태인 서버 수입니다."
      }
    ];
  }, [en, filteredServerStates, selectedReleaseUnit]);
  const pipelineValidatorRows = toList(projectPipeline?.validatorCheckSet);
  const pipelineStageRows = toList(projectPipeline?.stageSet);
  const pipelineArtifactRows = toList(projectPipeline?.artifactRegistryEntrySet);
  const pipelineInstallableProduct = toRecord(projectPipeline?.installableProduct);
  const pipelineDeployContract = toRecord(projectPipeline?.deployContract);
  const pipelineDeploymentRoutes = toList(pipelineDeployContract.deploymentRouteSet);
  const pipelineArtifactLineage = toRecord(projectPipeline?.artifactLineage);
  const pipelineRollbackPlan = toRecord(projectPipeline?.rollbackPlan);
  const pipelineServerStateRows = toList(projectPipeline?.serverStateSet);
  const pipelineRouteByRole = useMemo(() => {
    const next = new Map<string, Record<string, unknown>>();
    pipelineDeploymentRoutes.forEach((item) => {
      const row = toRecord(item);
      next.set(normalizePipelineRole(row.serverRole), row);
    });
    return next;
  }, [pipelineDeploymentRoutes]);
  const pipelineServerStateByServerId = useMemo(() => {
    const next = new Map<string, Record<string, unknown>>();
    pipelineServerStateRows.forEach((item) => {
      const row = toRecord(item);
      const serverId = stringOf(row.serverId);
      if (serverId) {
        next.set(serverId, row);
      }
    });
    return next;
  }, [pipelineServerStateRows]);
  const serverCountByReleaseUnitId = useMemo(() => {
    const next = new Map<string, number>();
    serverStates.forEach((item) => {
      const releaseUnitId = stringOf(item.activeReleaseUnitId);
      if (!releaseUnitId) {
        return;
      }
      next.set(releaseUnitId, (next.get(releaseUnitId) || 0) + 1);
    });
    return next;
  }, [serverStates]);
  const pipelinePromotionSummary = useMemo(() => {
    const counts = new Map<string, number>();
    pipelineServerStateRows.forEach((item) => {
      const promotionState = stringOf(toRecord(item).promotionState) || "UNKNOWN";
      counts.set(promotionState, (counts.get(promotionState) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([state, count]) => `${state} ${count}`)
      .join(" / ");
  }, [pipelineServerStateRows]);
  const applyServerAlignment = useMemo(() => {
    const appliedReleaseUnitId = stringOf(applyResult?.releaseUnitId);
    if (!appliedReleaseUnitId) {
      return {
        appliedReleaseUnitId: "",
        alignedCount: 0,
        driftCount: 0,
        reviewCount: 0,
        alignedServers: [] as Array<Record<string, unknown>>,
        driftServers: [] as Array<Record<string, unknown>>
      };
    }
    const alignedServers = filteredServerStates.filter((item) => stringOf(item.activeReleaseUnitId) === appliedReleaseUnitId);
    const driftServers = filteredServerStates.filter((item) => stringOf(item.activeReleaseUnitId) && stringOf(item.activeReleaseUnitId) !== appliedReleaseUnitId);
    const reviewCount = filteredServerStates.filter((item) => {
      const health = stringOf(item.healthStatus).toUpperCase();
      return health.includes("WARNING") || health.includes("REVIEW");
    }).length;
    return {
      appliedReleaseUnitId,
      alignedCount: alignedServers.length,
      driftCount: driftServers.length,
      reviewCount,
      alignedServers,
      driftServers
    };
  }, [applyResult, filteredServerStates]);
  const rollbackServerAlignment = useMemo(() => {
    const rollbackReleaseUnitId = stringOf(rollbackResult?.rolledBackToReleaseUnitId);
    if (!rollbackReleaseUnitId) {
      return {
        rollbackReleaseUnitId: "",
        alignedCount: 0,
        driftCount: 0,
        reviewCount: 0,
        alignedServers: [] as Array<Record<string, unknown>>,
        driftServers: [] as Array<Record<string, unknown>>
      };
    }
    const alignedServers = filteredServerStates.filter((item) => stringOf(item.activeReleaseUnitId) === rollbackReleaseUnitId);
    const driftServers = filteredServerStates.filter((item) => stringOf(item.activeReleaseUnitId) && stringOf(item.activeReleaseUnitId) !== rollbackReleaseUnitId);
    const reviewCount = filteredServerStates.filter((item) => {
      const health = stringOf(item.healthStatus).toUpperCase();
      return health.includes("WARNING") || health.includes("REVIEW");
    }).length;
    return {
      rollbackReleaseUnitId,
      alignedCount: alignedServers.length,
      driftCount: driftServers.length,
      reviewCount,
      alignedServers,
      driftServers
    };
  }, [filteredServerStates, rollbackResult]);
  const rollbackDeployTraceHref = buildDeployTraceHref(projectId, stringOf(rollbackResult?.deployTraceId));
  const selectedReleaseUnitLogHref = buildUnifiedLogTargetHref(projectId, "RELEASE_UNIT", stringOf(selectedReleaseUnit?.releaseUnitId));
  const selectedRuntimePackageLogHref = buildUnifiedLogTargetHref(projectId, "RUNTIME_PACKAGE", stringOf(selectedReleaseUnit?.runtimePackageId));
  const applyReleaseUnitLogHref = buildUnifiedLogTargetHref(projectId, "RELEASE_UNIT", stringOf(applyResult?.releaseUnitId));
  const applyRuntimePackageLogHref = buildUnifiedLogTargetHref(projectId, "RUNTIME_PACKAGE", stringOf(applyResult?.runtimePackageId));
  const pipelineReleaseFamilyLogHref = buildUnifiedLogTargetHref(projectId, "RELEASE_FAMILY", stringOf(pipelineArtifactLineage.releaseFamilyId) || stringOf(pipelineDeployContract.releaseFamilyId));
  const pipelineReleaseUnitLogHref = buildUnifiedLogTargetHref(projectId, "RELEASE_UNIT", stringOf(projectPipeline?.releaseUnitId) || stringOf(selectedReleaseUnit?.releaseUnitId));

  async function runImpactAnalysis() {
    setSubmitting("impact");
    setOperationMessage("");
    try {
      const next = await analyzeProjectUpgradeImpact({
        projectId,
        operator: DEFAULT_OPERATOR,
        targetArtifactSet
      });
      setImpact(next);
      setOperationMessage(en ? "Upgrade impact analyzed." : "업그레이드 영향 분석을 완료했습니다.");
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : (en ? "Failed to analyze upgrade impact." : "업그레이드 영향 분석에 실패했습니다."));
    } finally {
      setSubmitting("");
    }
  }

  async function syncProjectPipelineStatus(nextReleaseUnitId?: string) {
    try {
      const next = await fetchProjectPipelineStatus({
        projectId,
        releaseUnitId: nextReleaseUnitId || undefined
      });
      setProjectPipeline(next);
      setPipelineRunError("");
    } catch (error) {
      setPipelineRunError(error instanceof Error ? error.message : (en ? "Failed to sync project pipeline status." : "프로젝트 파이프라인 상태 동기화에 실패했습니다."));
    }
  }

  async function runApplyUpgrade() {
    setSubmitting("apply");
    setOperationMessage("");
    try {
      const result: ProjectApplyUpgradeResponse = await applyProjectUpgrade({
        projectId,
        operator: DEFAULT_OPERATOR,
        targetArtifactSet
      });
      setApplyResult(result);
      setImpact(null);
      setRollbackResult(null);
      setRefreshNonce((value) => value + 1);
      setRollbackTargetReleaseId(stringOf(result.rollbackTargetReleaseId));
      setSelectedReleaseUnitId(stringOf(result.releaseUnitId));
      await syncProjectPipelineStatus(stringOf(result.releaseUnitId));
      setOperationMessage(en
        ? `Upgrade prepared as ${stringOf(result.releaseUnitId)}.`
        : `업그레이드 릴리스 ${stringOf(result.releaseUnitId)} 를 준비했습니다.`);
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : (en ? "Failed to apply upgrade." : "업그레이드 적용에 실패했습니다."));
    } finally {
      setSubmitting("");
    }
  }

  async function runRollback() {
    if (!rollbackTargetReleaseId) {
      setOperationMessage(en ? "Choose a rollback target release first." : "먼저 롤백 대상 릴리스를 선택하세요.");
      return;
    }
    setSubmitting("rollback");
    setOperationMessage("");
    try {
      const result: ProjectRollbackResponse = await rollbackProjectVersion({
        projectId,
        operator: DEFAULT_OPERATOR,
        targetReleaseUnitId: rollbackTargetReleaseId
      });
      setRollbackResult(result);
      setRefreshNonce((value) => value + 1);
      setSelectedReleaseUnitId(stringOf(result.rolledBackToReleaseUnitId));
      await syncProjectPipelineStatus(stringOf(result.rolledBackToReleaseUnitId));
      const restoredCount = Array.isArray(result.restoredArtifactSet) ? result.restoredArtifactSet.length : 0;
      setOperationMessage(en
        ? `Rollback completed to ${stringOf(result.rolledBackToReleaseUnitId)} with ${restoredCount} restored artifacts.`
        : `${stringOf(result.rolledBackToReleaseUnitId)} 로 롤백을 완료했습니다. 복원된 artifact ${restoredCount}건입니다.`);
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : (en ? "Failed to rollback release." : "릴리스 롤백에 실패했습니다."));
    } finally {
      setSubmitting("");
    }
  }

  function addTargetArtifact() {
    if (!artifactDraft.artifactId.trim() || !artifactDraft.artifactVersion.trim()) {
      return;
    }
    setTargetArtifactSet((current) => ([
      ...current,
      {
        artifactId: artifactDraft.artifactId.trim(),
        artifactVersion: artifactDraft.artifactVersion.trim()
      }
    ]));
    setArtifactDraft({ artifactId: "", artifactVersion: "" });
  }

  function removeTargetArtifact(index: number) {
    setTargetArtifactSet((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function applyLatestCandidateSet() {
    setTargetArtifactSet((current) => {
      let next = [...current];
      latestCandidateSet.forEach((item) => {
        next = replaceTargetArtifact(next, item);
      });
      return next;
    });
  }

  async function handleRunProjectPipeline() {
    setPipelineRunLoading(true);
    setPipelineRunError("");
    setPipelineRunSuccess("");
    try {
      const response = await runProjectPipeline({
        projectId,
        scenarioId: `${projectId}-version-governance`,
        guidedStateId: `${projectId}-version-guided`,
        templateLineId: stringOf(selectedReleaseUnit?.runtimePackageId) || `${projectId}-release-template`,
        screenFamilyRuleId: `${projectId}-version-family`,
        ownerLane: "version-governance",
        menuRoot: projectId,
        runtimeClass: stringOf(overview?.projectDisplayName) || projectId,
        menuScope: "ADMIN",
        releaseUnitId: stringOf(selectedReleaseUnit?.releaseUnitId) || undefined,
        runtimePackageId: stringOf(selectedReleaseUnit?.runtimePackageId) || undefined,
        releaseUnitPrefix: "release-unit",
        runtimePackagePrefix: "runtime-package",
        artifactTargetSystem: "carbonet-general",
        deploymentTarget: selectedServer ? stringOf(selectedServer.serverId) || "ops-runtime" : "ops-runtime",
        operator: DEFAULT_OPERATOR
      });
      setProjectPipeline(response);
      setPipelineRunSuccess(en ? "Version tracking pipeline snapshot recorded." : "버전 추적용 파이프라인 스냅샷을 기록했습니다.");
      pipelineStatusState.setError("");
    } catch (error) {
      setPipelineRunError(error instanceof Error ? error.message : (en ? "Failed to run project pipeline." : "프로젝트 파이프라인 실행에 실패했습니다."));
    } finally {
      setPipelineRunLoading(false);
    }
  }

  async function handleRefreshProjectPipeline() {
    setPipelineRunSuccess("");
    await pipelineStatusState.reload();
  }

  async function runEmbeddedBackupOperation(
    operationKey: "db-backup" | "git-precheck" | "git-push",
    executionType: "DB" | "GIT_PRECHECK" | "GIT_COMMIT_AND_PUSH_BASE",
    successMessage: string
  ) {
    setOpsSubmitting(operationKey);
    setOpsMessage("");
    try {
      const response = await runBackupExecution(executionType);
      setOpsMessage(stringOf(response.backupConfigMessage) || successMessage);
    } catch (error) {
      setOpsMessage(error instanceof Error ? error.message : (en ? "Operation failed." : "작업 실행에 실패했습니다."));
    } finally {
      setOpsSubmitting("");
    }
  }

  async function handleRunRemoteSyncAndDeploy() {
    setOpsSubmitting("remote-sync");
    setOpsMessage("");
    try {
      const response = await runProjectVersionSyncAndDeploy({
        projectId,
        operator: DEFAULT_OPERATOR,
        releaseVersion: deployForm.releaseVersion,
        releaseTitle: deployForm.releaseTitle,
        releaseContent: deployForm.releaseContent,
        remoteDeployMode: deployForm.remoteDeployMode
      });
      setOpsMessage(stringOf(response.message) || (en
        ? "Remote sync and deploy job started."
        : "원격 동기화 및 배포 작업을 시작했습니다."));
      setDeployForm((current) => ({
        ...current,
        releaseContent: ""
      }));
      await operationsState.reload();
    } catch (error) {
      setOpsMessage(error instanceof Error ? error.message : (en ? "Failed to start remote sync and deploy." : "원격 동기화 및 배포 시작에 실패했습니다."));
    } finally {
      setOpsSubmitting("");
    }
  }

  function updateBackupSetting(key: string, value: string) {
    setBackupSettingsForm((current) => ({ ...current, [key]: value }));
  }

  function updateDeployForm(key: "releaseVersion" | "releaseTitle" | "releaseContent" | "remoteDeployMode", value: string) {
    setDeployForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSaveBackupSettings() {
    setBackupSettingsSaving(true);
    setOpsMessage("");
    try {
      const response = await saveBackupConfig(backupSettingsForm);
      setBackupSettingsForm((response.backupConfigForm || {}) as Record<string, string>);
      setOpsMessage(stringOf(response.backupConfigMessage) || (en ? "Backup settings saved." : "백업 설정을 저장했습니다."));
      await Promise.all([
        backupSettingsState.reload(),
        operationsState.reload()
      ]);
    } catch (error) {
      setOpsMessage(error instanceof Error ? error.message : (en ? "Failed to save backup settings." : "백업 설정 저장에 실패했습니다."));
    } finally {
      setBackupSettingsSaving(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Version Management" : "버전 관리" }
      ]}
      title={en ? "Project Version Management" : "프로젝트 버전 관리"}
      subtitle={en
        ? "Track installed common artifacts, adapter changes, release units, and server deployment states per project."
        : "프로젝트별 설치 공통 아티팩트, 어댑터 변경, 릴리스 유닛, 서버 배포 상태를 한 화면에서 관리합니다."}
      loading={pageState.loading || sessionState.loading}
      loadingLabel={en ? "Loading project version governance data." : "프로젝트 버전 거버넌스 데이터를 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        <section className="gov-card">
          <form
            className="grid grid-cols-1 gap-4 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setProjectId(draftProjectId.trim() || DEFAULT_PROJECT_ID);
              setApplyResult(null);
              setImpact(null);
              setRollbackResult(null);
              setOperationMessage("");
              setTargetArtifactSet([]);
            }}
          >
            <div>
              <label className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="project-id">
                {en ? "Project ID" : "프로젝트 ID"}
              </label>
              <AdminInput
                id="project-id"
                placeholder={DEFAULT_PROJECT_ID}
                value={draftProjectId}
                onChange={(event) => setDraftProjectId(event.target.value)}
              />
            </div>
            <div className="flex items-end justify-end gap-2">
              <MemberButton type="submit" variant="primary" icon="search">
                {en ? "Load Project" : "프로젝트 조회"}
              </MemberButton>
              <MemberButton type="button" variant="secondary" onClick={() => setRefreshNonce((value) => value + 1)}>
                {en ? "Refresh" : "새로고침"}
              </MemberButton>
            </div>
          </form>
        </section>

        {sessionState.error ? <PageStatusNotice tone={isPermissionDeniedMessage(sessionState.error) ? "warning" : "error"}>{sessionState.error}</PageStatusNotice> : null}
        {showSessionFeatureWarning ? (
          <MemberStateCard
            description={en
              ? "The current session does not expose A0060404_VIEW. The page will still try to load, but analyze/apply/rollback buttons stay permission-gated and any real API 403 will be shown below."
              : "현재 세션에 A0060404_VIEW가 노출되지 않았습니다. 화면 조회는 계속 시도하지만 analyze/apply/rollback 버튼은 권한 기준으로 유지되고, 실제 API 403이 발생하면 아래에 표시됩니다."}
            icon="lock"
            title={en ? "Session feature code missing." : "세션 기능 코드가 없습니다."}
            tone="warning"
          >
            <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-white px-4 py-3 text-left text-sm">
              <p className="font-bold text-amber-900">{en ? "Required feature codes" : "필수 기능 코드"}</p>
              <p className="mt-2 text-[var(--kr-gov-text-secondary)]">
                {missingFeatureCodes.length > 0
                  ? (en ? `Missing in current session: ${missingFeatureCodes.join(", ")}` : `현재 세션에 없는 코드: ${missingFeatureCodes.join(", ")}`)
                  : (en ? `Registered set: ${VERSION_REQUIRED_FEATURE_SET.join(", ")}` : `등록 기준 코드: ${VERSION_REQUIRED_FEATURE_SET.join(", ")}`)}
              </p>
            </div>
          </MemberStateCard>
        ) : null}
        {pageState.error && canViewVersionManagement ? (
          <PageStatusNotice tone={isPermissionDeniedMessage(pageState.error) ? "warning" : "error"}>
            {pageState.error}
          </PageStatusNotice>
        ) : null}
        {operationsState.error && canViewVersionManagement ? (
          <PageStatusNotice tone={isPermissionDeniedMessage(operationsState.error) ? "warning" : "error"}>
            {operationsState.error}
          </PageStatusNotice>
        ) : null}
        {operationMessage ? (
          <PageStatusNotice
            tone={isPermissionDeniedMessage(operationMessage)
              ? "warning"
              : (operationMessage.toLowerCase().includes("fail") || operationMessage.includes("실패") ? "error" : "success")}
          >
            {operationMessage}
          </PageStatusNotice>
        ) : null}
        {opsMessage ? (
          <PageStatusNotice tone={noticeTone(opsMessage)}>
            {opsMessage}
          </PageStatusNotice>
        ) : null}

        {pagePermissionDenied ? null : (
          <>
        {pipelineRunError ? <PageStatusNotice tone="error">{pipelineRunError}</PageStatusNotice> : null}
        {pipelineRunSuccess ? <PageStatusNotice tone="success">{pipelineRunSuccess}</PageStatusNotice> : null}
        {isInitializationState ? (
          <MemberStateCard
            description={en
              ? "No version-management data is registered for this project yet."
              : "이 프로젝트에는 아직 버전 관리 데이터가 등록되지 않았습니다."}
            icon=""
            title={en ? "Version Management Setup Required" : "버전 관리 설정이 필요합니다"}
            tone="warning"
          >
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <article className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-white px-4 py-4 text-left">
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Current status" : "현재 상태"}</p>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "No installed artifact, release unit, candidate version, adapter history, or deployment status records were found."
                    : "설치 아티팩트, 릴리스 유닛, 후보 버전, 어댑터 이력, 배포 상태 데이터가 아직 없습니다."}
                </p>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-white px-4 py-4 text-left">
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Next step" : "다음 작업"}</p>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Load another project or populate the version-control registry tables for this project, then refresh the page."
                    : "다른 프로젝트를 조회하거나 이 프로젝트의 버전 관리 레지스트리 테이블을 적재한 뒤 새로고침하세요."}
                </p>
              </article>
            </div>
            <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-white px-4 py-4 text-left">
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Release and deployment sections stay in setup mode until version data is registered. Pipeline runs require at least one release unit."
                  : "버전 관리 데이터가 등록되기 전까지 릴리스/배포 영역은 설정 대기 상태로 유지됩니다. 파이프라인 실행은 릴리스 유닛 등록 후 사용할 수 있습니다."}
              </p>
            </div>
          </MemberStateCard>
        ) : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6" data-help-id="version-management-summary">
          {summaryCards.map((card) => (
            <SummaryMetricCard
              key={card.title}
              title={card.title}
              value={card.value}
              description={card.description}
            />
          ))}
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="version-management-governance">
          <GridToolbar
            title={en ? "Fleet Common Upgrade Governance" : "공통 업그레이드 거버넌스"}
            meta={en
              ? "Artifact locks and compatibility runs keep common-core updates traceable across many projects."
              : "아티팩트 잠금과 호환성 실행 기록으로 여러 프로젝트의 공통 코어 업데이트를 추적합니다."}
            actions={<span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Automatic Recording" : "자동 기록"}</span>}
          />
          <div className="grid grid-cols-1 gap-4 px-6 py-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <article className="overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white">
              <div className="border-b border-[var(--kr-gov-border-light)] px-4 py-3">
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Compatibility Runs" : "호환성 실행 기록"}</p>
                <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Impact analysis writes one run with adapter, DB diff, smoke, and final decision fields."
                    : "영향 분석을 실행하면 어댑터, DB diff, smoke, 최종 판단이 1건 기록됩니다."}
                </p>
              </div>
              <div className="overflow-x-auto">
                <AdminTable className="min-w-[980px]">
                  <thead>
                    <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
                      <th className="px-4 py-3">{en ? "Run" : "실행 ID"}</th>
                      <th className="px-4 py-3">{en ? "Target Common" : "대상 공통 버전"}</th>
                      <th className="px-4 py-3">{en ? "Adapter" : "어댑터"}</th>
                      <th className="px-4 py-3">{en ? "DB Diff" : "DB Diff"}</th>
                      <th className="px-4 py-3">{en ? "Smoke" : "Smoke"}</th>
                      <th className="px-4 py-3">{en ? "Decision" : "판단"}</th>
                      <th className="px-4 py-3">{en ? "Tested At" : "확인 시각"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compatibilityRuns.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={7}>
                          {en ? "No compatibility runs have been recorded yet." : "아직 기록된 호환성 실행이 없습니다."}
                        </td>
                      </tr>
                    ) : compatibilityRuns.map((item, index) => (
                      <tr className="border-b border-[var(--kr-gov-border-light)] bg-white" key={`${stringOf(item.runId)}-${index}`}>
                        <td className="px-4 py-3 text-sm font-semibold">{stringOf(item.runId) || "-"}</td>
                        <td className="px-4 py-3 text-sm">{stringOf(item.targetCommonVersion) || "-"}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${jobStatusTone(stringOf(item.adapterContractStatus))}`}>
                            {stringOf(item.adapterContractStatus) || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{stringOf(item.dbDiffStatus) || "-"}</td>
                        <td className="px-4 py-3 text-sm">{stringOf(item.smokeStatus) || "-"}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${jobStatusTone(stringOf(item.compatibilityStatus))}`}>
                            {stringOf(item.compatibilityStatus) || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{stringOf(item.testedAt) || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              </div>
            </article>

            <article className="overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white">
              <div className="border-b border-[var(--kr-gov-border-light)] px-4 py-3">
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Artifact Locks" : "아티팩트 잠금"}</p>
                <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Apply upgrade writes the exact artifact versions and checksums for rollback and audit."
                    : "업그레이드 적용 시 롤백과 감사를 위한 정확한 아티팩트 버전/체크섬을 저장합니다."}
                </p>
              </div>
              <div className="max-h-[360px] overflow-auto">
                <AdminTable className="min-w-[760px]">
                  <thead>
                    <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
                      <th className="px-4 py-3">{en ? "Release Unit" : "릴리스 유닛"}</th>
                      <th className="px-4 py-3">{en ? "Artifact" : "아티팩트"}</th>
                      <th className="px-4 py-3">{en ? "Version" : "버전"}</th>
                      <th className="px-4 py-3">{en ? "Source" : "출처"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {artifactLocks.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={4}>
                          {en ? "No artifact locks have been recorded yet." : "아직 기록된 아티팩트 잠금이 없습니다."}
                        </td>
                      </tr>
                    ) : artifactLocks.map((item, index) => (
                      <tr className="border-b border-[var(--kr-gov-border-light)] bg-white" key={`${stringOf(item.releaseUnitId)}-${stringOf(item.artifactId)}-${index}`}>
                        <td className="px-4 py-3 text-sm font-semibold">{stringOf(item.releaseUnitId) || "-"}</td>
                        <td className="px-4 py-3 text-sm">{stringOf(item.groupId) || "-"}:{stringOf(item.artifactId) || "-"}</td>
                        <td className="px-4 py-3 text-sm">{stringOf(item.artifactVersion) || "-"}</td>
                        <td className="px-4 py-3 text-sm">{stringOf(item.lockSource) || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              </div>
              {fleetGovernanceNextSteps.length > 0 ? (
                <div className="space-y-2 border-t border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  {fleetGovernanceNextSteps.map((item, index) => (
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3" key={`${stringOf(item.stepId)}-${index}`}>
                      <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item.title) || "-"}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(item.description) || "-"}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="gov-card overflow-hidden p-0" data-help-id="version-management-db-git">
            <GridToolbar
              title={en ? "DB And Git Operations" : "DB 및 Git 운영 작업"}
              meta={en
                ? "Reuse the backup/restore engine from this page so version management and restore points stay together."
                : "버전 관리 화면에서 기존 백업/복구 엔진을 그대로 사용합니다."}
              actions={<span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Shared Backup Engine" : "공유 백업 엔진"}</span>}
            />
            <div className="space-y-4 px-6 py-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">DB</p>
                  <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">
                    {en ? "Available" : "실행 가능"}
                  </p>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                    {en ? "Backup and restore point creation." : "백업 및 복구 지점 생성."}
                  </p>
                </article>
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">Git</p>
                  <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">
                    {en ? "Available" : "실행 가능"}
                  </p>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                    {en ? "Precheck, bundle, commit, push, and rollback support." : "사전점검, 번들, 커밋, push, 롤백 지원."}
                  </p>
                </article>
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Execution Scope" : "실행 범위"}</p>
                  <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Backup / Restore / Git" : "백업 / 복구 / Git"}</p>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Runs through the existing shared observability backup engine." : "기존 공용 observability 백업 엔진을 그대로 사용합니다."}</p>
                </article>
              </div>

              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Git Push Credentials" : "Git Push 자격 정보"}</p>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en
                        ? "These fields are saved to the shared backup settings and then used by Git commit/push and 221 deploy automation."
                        : "여기 입력한 값은 공용 백업 설정에 저장되고, 이후 Git commit/push와 221 배포 자동화에서 사용됩니다."}
                    </p>
                  </div>
                  <MemberButton type="button" variant="primary" disabled={backupSettingsSaving} onClick={() => void handleSaveBackupSettings()}>
                    {backupSettingsSaving ? (en ? "Saving..." : "저장 중...") : (en ? "Save Credentials" : "자격 정보 저장")}
                  </MemberButton>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Remote URL" : "원격 저장소 URL"}</span>
                    <AdminInput
                      value={backupValueOf(backupSettingsForm, "gitRemoteUrl")}
                      onChange={(event) => updateBackupSetting("gitRemoteUrl", event.target.value)}
                      placeholder="https://github.com/owner/repo.git"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Git Username" : "Git 사용자명"}</span>
                    <AdminInput
                      value={backupValueOf(backupSettingsForm, "gitUsername")}
                      onChange={(event) => updateBackupSetting("gitUsername", event.target.value)}
                      placeholder="github-user"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Base Branch" : "기준 브랜치"}</span>
                    <AdminInput
                      value={backupValueOf(backupSettingsForm, "gitBranchPattern")}
                      onChange={(event) => updateBackupSetting("gitBranchPattern", event.target.value)}
                      placeholder="main"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Git Token" : "Git 토큰"}</span>
                    <AdminInput
                      type="password"
                      value={backupValueOf(backupSettingsForm, "gitAuthToken")}
                      onChange={(event) => updateBackupSetting("gitAuthToken", event.target.value)}
                      placeholder={en ? "Paste personal access token" : "개인 액세스 토큰 붙여넣기"}
                    />
                  </label>
                </div>
                <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {backupYes(backupSettingsForm, "gitAuthTokenConfigured")
                    ? (en
                      ? `Token is already stored. Current value stays hidden as ${backupValueOf(backupSettingsForm, "gitAuthTokenMasked") || "********"}. Leave the field blank to keep it.`
                      : `토큰이 이미 저장되어 있습니다. 현재 값은 ${backupValueOf(backupSettingsForm, "gitAuthTokenMasked") || "********"} 로 숨김 처리됩니다. 유지하려면 입력란을 비워 두세요.`)
                    : (en
                      ? "No token is stored yet. Save a personal access token before running Git push or 221 deploy."
                      : "저장된 토큰이 아직 없습니다. Git push 또는 221 배포 전에 개인 액세스 토큰을 저장하세요.")}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Promotion Data Policy" : "반영 데이터 정책"}</span>
                    <AdminSelect value={backupValueOf(backupSettingsForm, "dbPromotionDataPolicy") || "CONTROLLED_REFERENCE_ONLY"} onChange={(event) => updateBackupSetting("dbPromotionDataPolicy", event.target.value)}>
                      <option value="CONTROLLED_REFERENCE_ONLY">{en ? "Controlled metadata only" : "관리 메타데이터만"}</option>
                      <option value="BUSINESS_WITH_OVERRIDE">{en ? "Business data with override" : "업무 데이터는 우회 사유 필요"}</option>
                      <option value="BUSINESS_ALLOWED">{en ? "Business data allowed" : "업무 데이터 허용"}</option>
                    </AdminSelect>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Diff Execution Preset" : "diff 실행 프리셋"}</span>
                    <AdminSelect value={backupValueOf(backupSettingsForm, "dbDiffExecutionPreset") || "PATCH_WITH_DIFF"} onChange={(event) => updateBackupSetting("dbDiffExecutionPreset", event.target.value)}>
                      <option value="PATCH_ONLY">{en ? "Patch only" : "패치만 반영"}</option>
                      <option value="PATCH_WITH_DIFF">{en ? "Patch with diff guard" : "패치 + diff 검증"}</option>
                      <option value="FULL_REMOTE_DEPLOY">{en ? "Full remote deploy" : "원격 전체 배포"}</option>
                    </AdminSelect>
                  </label>
                  <label className="flex items-start gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                    <input checked={backupYes(backupSettingsForm, "dbApplyLocalDiffYn")} className="mt-1" onChange={(event) => updateBackupSetting("dbApplyLocalDiffYn", event.target.checked ? "Y" : "N")} type="checkbox" />
                    <span className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Allow local diff apply when reverse-sync is intentional." : "역동기화가 필요한 경우에만 local diff 적용을 허용합니다."}</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                    <input checked={backupYes(backupSettingsForm, "dbForceDestructiveDiffYn")} className="mt-1" onChange={(event) => updateBackupSetting("dbForceDestructiveDiffYn", event.target.checked ? "Y" : "N")} type="checkbox" />
                    <span className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Force destructive diff only for reviewed exceptional cases." : "검토된 예외 상황에서만 파괴적 diff 강제를 허용합니다."}</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                    <input checked={backupYes(backupSettingsForm, "dbFailOnUntrackedDestructiveDiffYn")} className="mt-1" onChange={(event) => updateBackupSetting("dbFailOnUntrackedDestructiveDiffYn", event.target.checked ? "Y" : "N")} type="checkbox" />
                    <span className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Fail when untracked destructive diff is detected." : "미추적 파괴적 diff가 발견되면 실패 처리합니다."}</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                    <input checked={backupYes(backupSettingsForm, "dbRequirePatchHistoryYn")} className="mt-1" onChange={(event) => updateBackupSetting("dbRequirePatchHistoryYn", event.target.checked ? "Y" : "N")} type="checkbox" />
                    <span className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Require DB patch history evidence before treating remote apply as success." : "원격 반영 성공 처리 전에 DB patch 이력 증거를 필수로 요구합니다."}</span>
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <MemberButton
                    type="button"
                    variant="secondary"
                    onClick={() => setDbPatchOptions((current) => ({ ...current, ...deriveDbPatchDefaultsFromBackupSettings(backupSettingsForm) }))}
                  >
                    {en ? "Load Policy Defaults Into Queue Options" : "정책 기본값을 큐 옵션에 반영"}
                  </MemberButton>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <MemberButton
                  type="button"
                  variant="secondary"
                  disabled={opsSubmitting !== ""}
                  onClick={() => runEmbeddedBackupOperation("db-backup", "DB", en ? "DB backup started." : "DB 백업을 시작했습니다.")}
                >
                  {opsSubmitting === "db-backup" ? (en ? "Running DB Backup..." : "DB 백업 실행 중...") : (en ? "Run DB Backup" : "DB 백업 실행")}
                </MemberButton>
                <MemberButton
                  type="button"
                  variant="secondary"
                  disabled={opsSubmitting !== ""}
                  onClick={() => runEmbeddedBackupOperation("git-precheck", "GIT_PRECHECK", en ? "Git precheck started." : "Git 사전점검을 시작했습니다.")}
                >
                  {opsSubmitting === "git-precheck" ? (en ? "Running Git Precheck..." : "Git 사전점검 실행 중...") : (en ? "Run Git Precheck" : "Git 사전점검")}
                </MemberButton>
                <MemberButton
                  type="button"
                  variant="secondary"
                  disabled={opsSubmitting !== ""}
                  onClick={() => runEmbeddedBackupOperation("git-push", "GIT_COMMIT_AND_PUSH_BASE", en ? "Git commit/push started." : "Git commit/push를 시작했습니다.")}
                >
                  {opsSubmitting === "git-push" ? (en ? "Running Git Push..." : "Git Push 실행 중...") : (en ? "Git Commit And Push" : "Git Commit And Push")}
                </MemberButton>
                <MemberButton
                  type="button"
                  variant="secondary"
                  onClick={() => openProjectVersionHref(buildLocalizedPath("/admin/system/backup", "/en/admin/system/backup"))}
                >
                  {en ? "Open Backup Page" : "백업 화면 열기"}
                </MemberButton>
                <MemberButton
                  type="button"
                  variant="secondary"
                  onClick={() => openProjectVersionHref(buildLocalizedPath("/admin/system/restore", "/en/admin/system/restore"))}
                >
                  {en ? "Open Restore Page" : "복구 화면 열기"}
                </MemberButton>
              </div>

              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Backup Engine Status" : "백업 엔진 상태"}</p>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en
                        ? "DB and Git actions on this page call the same backup/restore engine used by /admin/system/backup and /admin/system/restore."
                        : "이 화면의 DB/Git 작업은 /admin/system/backup, /admin/system/restore와 같은 백업/복구 엔진을 호출합니다."}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {en ? "Shared Engine" : "공용 엔진"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Already Covered Here" : "현재 화면에서 바로 가능한 범위"}</p>
                    <ul className="space-y-2 text-sm text-[var(--kr-gov-text-secondary)]">
                      {backupCoverageSet.map((item) => (
                        <li key={item} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-2">{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "When To Use Backup / Restore Pages" : "백업 / 복구 전용 화면이 필요한 경우"}</p>
                    <ul className="space-y-2 text-sm text-[var(--kr-gov-text-secondary)]">
                      <li className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-2">{en ? "SQL / physical / PITR restore drill selection" : "SQL / 물리 / PITR 복구 대상 선택"}</li>
                      <li className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-2">{en ? "Saved backup profile inspection and version restore" : "저장된 백업 프로파일 점검 및 버전 복원"}</li>
                      <li className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-2">{en ? "Detailed Git restore branch workflows" : "상세 Git 복구 브랜치 워크플로우"}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Live Backup Job" : "실시간 백업 작업"}</p>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en
                        ? "DB backup and Git execution progress from the shared backup engine is refreshed automatically while a job is running."
                        : "공용 백업 엔진의 DB 백업과 Git 실행 상태는 작업이 실행 중일 때 자동으로 갱신됩니다."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${jobStatusTone(stringOf(currentBackupJob.status))}`}>
                      {stringOf(currentBackupJob.status) || "-"}
                    </span>
                    <MemberButton type="button" variant="secondary" onClick={() => void backupSettingsState.reload()}>
                      {en ? "Refresh Backup State" : "백업 상태 새로고침"}
                    </MemberButton>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Job ID" : "작업 ID"}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(currentBackupJob.jobId) || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Profile" : "프로필"}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(currentBackupJob.profileName) || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Started" : "시작"}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(currentBackupJob.startedAt) || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Duration" : "소요 시간"}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(currentBackupJob.duration) || "-"}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-950 px-4 py-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-300">{en ? "Live Backup Log" : "실시간 백업 로그"}</p>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-100">
                    {(toList(currentBackupJob.logLines).map((line) => stringOf(line)).join("\n")) || (en ? "No logs yet." : "아직 로그가 없습니다.")}
                  </pre>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Recent Backup Jobs" : "최근 백업 작업"}</p>
                  {recentBackupJobs.length === 0 ? (
                    <p className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en ? "No backup jobs have been recorded yet." : "기록된 백업 작업이 없습니다."}
                    </p>
                  ) : recentBackupJobs.slice(0, 4).map((item, index) => {
                    const row = toRecord(item);
                    return (
                      <div className="flex items-center justify-between gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3" key={`${stringOf(row.jobId)}-${index}`}>
                        <div>
                          <p className="text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(row.profileName) || stringOf(row.executionType) || "-"}</p>
                          <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row.startedAt) || "-"}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${jobStatusTone(stringOf(row.status))}`}>{stringOf(row.status) || "-"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="gov-card overflow-hidden p-0" data-help-id="version-management-overview">
            <GridToolbar
              title={en ? "221 Sync And Fresh Deploy" : "221 동기화 및 Fresh Deploy"}
              meta={en
                ? "This is the capability that existed in the Windows launcher but was missing from the version-management screen."
                : "Windows 실행기에 있던 기능을 버전 관리 화면에 통합했습니다."}
              actions={<span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{stringOf(operationsPayload?.remoteHost) || "-"}</span>}
            />
            <div className="space-y-4 px-6 py-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Launcher" : "런처"}</p>
                  <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(operationsPayload?.launcherPresentYn) === "Y" ? "OK" : "-"}</p>
                  <p className="mt-2 break-all text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(operationsPayload?.launcherPath) || "-"}</p>
                </article>
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Deploy Script" : "배포 스크립트"}</p>
                  <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(operationsPayload?.scriptPresentYn) === "Y" ? "OK" : "-"}</p>
                  <p className="mt-2 break-all text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(operationsPayload?.scriptPath) || "-"}</p>
                </article>
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Automation Env" : "자동화 환경"}</p>
                  <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">
                    {stringOf(operationsPayload?.deployAutomationConfiguredYn) === "Y" ? (en ? "Configured" : "설정됨") : (en ? "Check Required" : "확인 필요")}
                  </p>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Uses repository env/config for remote credentials and automation." : "원격 계정과 자동화 설정은 저장소 env/config를 사용합니다."}</p>
                </article>
              </div>

              <div className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Missing Capability Closed" : "부족했던 기능 보강"}</p>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en
                        ? "The backup/restore pages already handled DB and Git backup flows. This screen now closes the remaining gap with remote DB SQL sync plus selectable 221 deploy modes."
                        : "백업/복구 화면은 DB/Git 백업 흐름을 이미 제공했고, 이 화면에서 원격 DB SQL 반영과 선택형 221 배포 모드까지 실행할 수 있도록 남은 차이를 메웠습니다."}
                    </p>
                  </div>
                  <MemberPermissionButton
                    allowed={canApplyUpgrade}
                    reason={en ? "You need A0060404_APPLY permission to start remote sync and deploy." : "원격 동기화 및 배포를 실행하려면 A0060404_APPLY 권한이 필요합니다."}
                    type="button"
                    variant="primary"
                    disabled={opsSubmitting !== "" || stringOf(currentRemoteJob.status) === "RUNNING" || stringOf(currentRemoteJob.status) === "QUEUED"}
                    onClick={handleRunRemoteSyncAndDeploy}
                  >
                    {opsSubmitting === "remote-sync"
                      ? (en ? "Starting 221 Deploy..." : "221 배포 시작 중...")
                      : (en ? "Run 221 Sync And Deploy" : "221 동기화 및 배포 실행")}
                  </MemberPermissionButton>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Deploy Mode" : "배포 모드"}</span>
                    <AdminSelect
                      value={deployForm.remoteDeployMode}
                      onChange={(event) => updateDeployForm("remoteDeployMode", event.target.value)}
                    >
                      {remoteDeployModeOptions.length === 0 ? (
                        <>
                          <option value="pull">{en ? "Pull + Restart" : "Pull + 재기동"}</option>
                          <option value="fresh-clone">{en ? "Fresh Clone + Restart" : "Fresh Clone + 재기동"}</option>
                          <option value="jar-mosh">{en ? "Jar Transfer + Restart" : "Jar 전송 + 재기동"}</option>
                        </>
                      ) : remoteDeployModeOptions.map((item) => {
                        const modeValue = stringOf(item.value);
                        const modeLabel = en ? stringOf(item.labelEn) || stringOf(item.label) : stringOf(item.label) || stringOf(item.labelEn);
                        return (
                          <option key={modeValue} value={modeValue}>
                            {modeLabel || modeValue}
                          </option>
                        );
                      })}
                    </AdminSelect>
                    <span className="text-xs text-[var(--kr-gov-text-secondary)]">
                      {en
                        ? "Pull reuses the remote repo and refreshes scripts first. Fresh clone rebuilds from a clean checkout. Jar transfer uploads the local jar and restart scripts only."
                        : "Pull은 원격 저장소를 재사용하면서 스크립트까지 최신화합니다. Fresh clone은 깨끗한 체크아웃으로 다시 배포합니다. Jar 전송은 로컬 jar와 재기동 스크립트만 올립니다."}
                    </span>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Release Version" : "배포 버전"}</span>
                    <AdminInput
                      value={deployForm.releaseVersion}
                      onChange={(event) => updateDeployForm("releaseVersion", event.target.value)}
                      placeholder={en ? "2026.04.13.1" : "2026.04.13.1"}
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Release Title" : "배포 제목"}</span>
                    <AdminInput
                      value={deployForm.releaseTitle}
                      onChange={(event) => updateDeployForm("releaseTitle", event.target.value)}
                      placeholder={en ? "Carbonet server fresh deploy" : "Carbonet 서버 신규 배포"}
                    />
                  </label>
                </div>
                <label className="mt-4 flex flex-col gap-2">
                  <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Release Content" : "배포 내용"}</span>
                  <textarea
                    className="min-h-[120px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)] outline-none"
                    value={deployForm.releaseContent}
                    onChange={(event) => updateDeployForm("releaseContent", event.target.value)}
                    placeholder={en ? "Describe what changed in this deployment." : "이번 배포 변경 내용을 입력하세요."}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Launcher-Only Coverage Now Integrated" : "이번에 통합된 실행기 기능"}</p>
                  <ul className="space-y-2 text-sm text-[var(--kr-gov-text-secondary)]">
                    {launcherExclusiveSet.map((item) => (
                      <li key={item} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-2">{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Recommended Operator Flow" : "권장 운영 순서"}</p>
                  <ul className="space-y-2 text-sm text-[var(--kr-gov-text-secondary)]">
                    {recommendedFlowSet.map((item) => (
                      <li key={item} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-2">{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Captured DB Changes" : "저장 추적 요약"}</p>
                  <div className="space-y-2 text-sm text-[var(--kr-gov-text-secondary)]">
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-2">
                      {en ? "Captured changes" : "누적 변경"}: <span className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(changeCaptureSummary.totalChangeCount || 0)}</span>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-2">
                      {en ? "Auto queued" : "자동 큐 적재"}: <span className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(changeCaptureSummary.autoQueuedChangeCount || 0)}</span>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-2">
                      {en ? "Approval required" : "승인 필요"}: <span className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(changeCaptureSummary.approvalRequiredChangeCount || 0)}</span>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-2">
                      {en ? "Blocked" : "반영 제외"}: <span className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(changeCaptureSummary.blockedChangeCount || 0)}</span>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-2">
                      {en ? "Pending queue" : "대기 큐"}: <span className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(changeCaptureSummary.pendingQueueCount || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "DB Change Promotion Queue" : "DB 변경 승격 큐"}</p>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en ? "Review captured changes, queue manual candidates, and execute approved DB patch rows." : "저장 추적 변경을 검토하고, 수동 대상은 큐에 올린 뒤 승인된 패치를 실행합니다."}
                    </p>
                  </div>
                  <MemberButton type="button" variant="secondary" onClick={() => void reloadDbPatchState()}>
                    {en ? "Refresh DB Queue" : "DB 큐 새로고침"}
                  </MemberButton>
                </div>
                {dbPatchMessage ? (
                  <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    {dbPatchMessage}
                  </div>
                ) : null}
                <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Execution Options" : "실행 옵션"}</p>
                  <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Recommended presets" : "권장 프리셋"}</p>
                        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                          {en ? "For predeploy DB work, start with Patch Only. It disables diff checks and app deployment, and applies only the generated SQL patch." : "운영 DB 선반영은 먼저 패치만 반영 프리셋을 쓰면 됩니다. diff 검사와 앱 배포를 끄고 생성된 SQL 패치만 적용합니다."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {dbPatchPresetOptions.map((preset) => (
                          <MemberButton
                            key={preset.id}
                            type="button"
                            variant={preset.variant}
                            onClick={() => applyDbPatchPreset(preset.values)}
                          >
                            {preset.label}
                          </MemberButton>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-3">
                      {dbPatchPresetOptions.map((preset) => (
                        <div key={`${preset.id}-description`} className="rounded-[var(--kr-gov-radius)] border border-white/70 bg-white px-3 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                          <span className="font-bold text-[var(--kr-gov-text-primary)]">{preset.label}</span>
                          <p className="mt-1">{preset.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Execution Mode" : "실행 모드"}</span>
                      <AdminSelect value={dbPatchOptions.executionMode} onChange={(event) => updateDbPatchOption("executionMode", event.target.value)}>
                        <option value="DB_ONLY_PREDEPLOY">{en ? "DB Only Predeploy" : "DB 선반영만"}</option>
                        <option value="FULL_REMOTE_DEPLOY">{en ? "Full Remote Deploy" : "원격 전체 배포"}</option>
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Target Env" : "대상 환경"}</span>
                      <AdminInput value={dbPatchOptions.targetEnv} onChange={(event) => updateDbPatchOption("targetEnv", event.target.value)} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Remote Deploy Mode" : "원격 배포 모드"}</span>
                      <AdminSelect value={dbPatchOptions.remoteDeployMode} onChange={(event) => updateDbPatchOption("remoteDeployMode", event.target.value)}>
                        <option value="pull">pull</option>
                        <option value="fresh-clone">fresh-clone</option>
                        <option value="jar-mosh">jar-mosh</option>
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Blocked Queue Override" : "정책 차단 큐 등록"}</span>
                      <AdminSelect value={dbPatchOptions.forceQueue} onChange={(event) => updateDbPatchOption("forceQueue", event.target.value)}>
                        <option value="N">{en ? "No" : "아니오"}</option>
                        <option value="Y">{en ? "Yes" : "예"}</option>
                      </AdminSelect>
                    </label>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">remote diff</span>
                      <AdminSelect value={dbPatchOptions.applyDbDiffToRemoteYn} onChange={(event) => updateDbPatchOption("applyDbDiffToRemoteYn", event.target.value)}>
                        <option value="Y">{en ? "Apply" : "적용"}</option>
                        <option value="N">{en ? "Skip" : "건너뜀"}</option>
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">local diff</span>
                      <AdminSelect value={dbPatchOptions.applyDbDiffToLocalYn} onChange={(event) => updateDbPatchOption("applyDbDiffToLocalYn", event.target.value)}>
                        <option value="N">{en ? "Skip" : "건너뜀"}</option>
                        <option value="Y">{en ? "Apply" : "적용"}</option>
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Skip Schema Diff" : "스키마 diff 생략"}</span>
                      <AdminSelect value={dbPatchOptions.skipDbSchemaDiffYn} onChange={(event) => updateDbPatchOption("skipDbSchemaDiffYn", event.target.value)}>
                        <option value="N">{en ? "No" : "아니오"}</option>
                        <option value="Y">{en ? "Yes" : "예"}</option>
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Force Destructive Diff" : "파괴적 diff 강제"}</span>
                      <AdminSelect value={dbPatchOptions.forceDestructiveDiffYn} onChange={(event) => updateDbPatchOption("forceDestructiveDiffYn", event.target.value)}>
                        <option value="N">{en ? "No" : "아니오"}</option>
                        <option value="Y">{en ? "Yes" : "예"}</option>
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Fail On Remaining Diff" : "잔여 diff 실패 처리"}</span>
                      <AdminSelect value={dbPatchOptions.failOnDbDiffRemainsYn} onChange={(event) => updateDbPatchOption("failOnDbDiffRemainsYn", event.target.value)}>
                        <option value="Y">{en ? "Yes" : "예"}</option>
                        <option value="N">{en ? "No" : "아니오"}</option>
                      </AdminSelect>
                    </label>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Fail On Untracked Destructive Diff" : "미추적 파괴적 diff 실패 처리"}</span>
                      <AdminSelect value={dbPatchOptions.failOnUntrackedDestructiveDiffYn} onChange={(event) => updateDbPatchOption("failOnUntrackedDestructiveDiffYn", event.target.value)}>
                        <option value="N">{en ? "No" : "아니오"}</option>
                        <option value="Y">{en ? "Yes" : "예"}</option>
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Allow Business Data Patch" : "업무 데이터 패치 허용"}</span>
                      <AdminSelect value={dbPatchOptions.allowBusinessDataPatchYn} onChange={(event) => updateDbPatchOption("allowBusinessDataPatchYn", event.target.value)}>
                        <option value="N">{en ? "No" : "아니오"}</option>
                        <option value="Y">{en ? "Yes" : "예"}</option>
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Require Patch History" : "패치 이력 필수"}</span>
                      <AdminSelect value={dbPatchOptions.requireDbPatchHistoryYn} onChange={(event) => updateDbPatchOption("requireDbPatchHistoryYn", event.target.value)}>
                        <option value="Y">{en ? "Yes" : "예"}</option>
                        <option value="N">{en ? "No" : "아니오"}</option>
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Execute With Policy Override" : "정책 우회 실행"}</span>
                      <AdminSelect value={dbPatchOptions.allowPolicyOverrideYn} onChange={(event) => updateDbPatchOption("allowPolicyOverrideYn", event.target.value)}>
                        <option value="N">{en ? "No" : "아니오"}</option>
                        <option value="Y">{en ? "Yes" : "예"}</option>
                      </AdminSelect>
                    </label>
                  </div>
                  <label className="mt-4 flex flex-col gap-2">
                    <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Policy Override Reason / Operator Note" : "정책 우회 사유 / 운영 메모"}</span>
                    <textarea
                      className="min-h-[90px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)] outline-none"
                      value={dbPatchOptions.policyOverrideReason}
                      onChange={(event) => updateDbPatchOption("policyOverrideReason", event.target.value)}
                      placeholder={en ? "Record why policy bypass or special diff handling is required." : "정책 우회 또는 특수 diff 처리 사유를 기록하세요."}
                    />
                  </label>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Recent Captured Changes" : "최근 저장 추적 변경"}</p>
                    <div className="mt-3 space-y-3">
                      {dbChangeLogs.length === 0 ? (
                        <p className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                          {en ? "No captured DB changes yet." : "저장 추적된 DB 변경이 없습니다."}
                        </p>
                      ) : dbChangeLogs.slice(0, 5).map((item, index) => {
                        const row = toRecord(item);
                        const changeLogId = stringOf(row.changeLogId);
                        const canQueue = stringOf(row.queueRequestedYn) !== "Y" && stringOf(row.promotionPolicyCode) === "MANUAL_APPROVAL";
                        return (
                          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3" key={`${changeLogId}-${index}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row.targetTableName) || "-"}</p>
                              <span className={`rounded-full px-3 py-1 text-xs font-bold ${jobStatusTone(stringOf(row.approvalStatus || row.queueDecisionCode || row.promotionPolicyCode))}`}>
                                {stringOf(row.changeType) || "-"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row.changeSummary) || "-"}</p>
                            <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">
                              {stringOf(row.promotionPolicyCode) || "-"} / {stringOf(row.capturedAt) || "-"}
                            </p>
                            {canQueue ? (
                              <div className="mt-3">
                                <MemberButton
                                  type="button"
                                  variant="secondary"
                                  disabled={!canApplyUpgrade || dbPatchSubmitting === `queue:${changeLogId}`}
                                  onClick={() => void handleQueueChangeLog(changeLogId)}
                                >
                                  {dbPatchSubmitting === `queue:${changeLogId}`
                                    ? (en ? "Queueing..." : "큐 등록 중...")
                                    : (en ? "Queue For Approval" : "승인 큐 등록")}
                                </MemberButton>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Deployable Patch Queue" : "배포 가능 패치 큐"}</p>
                    <div className="mt-3 space-y-3">
                      {dbPatchQueueRows.length === 0 ? (
                        <p className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                          {en ? "No deployable patch queue rows yet." : "배포 가능 패치 큐가 없습니다."}
                        </p>
                      ) : dbPatchQueueRows.slice(0, 5).map((item, index) => {
                        const row = toRecord(item);
                        const queueId = stringOf(row.queueId);
                        const approvalStatus = stringOf(row.approvalStatus);
                        const applyStatus = stringOf(row.applyStatus);
                        return (
                          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3" key={`${queueId}-${index}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row.targetTableName) || "-"}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${jobStatusTone(approvalStatus)}`}>{approvalStatus || "-"}</span>
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${jobStatusTone(applyStatus)}`}>{applyStatus || "-"}</span>
                              </div>
                            </div>
                            <p className="mt-2 break-all text-xs text-[var(--kr-gov-text-secondary)]">{queueId || "-"}</p>
                            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                              {stringOf(row.targetEnv) || "-"} / {stringOf(row.riskLevel) || "-"}
                            </p>
                            <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row.renderedSqlPreview) || "-"}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <MemberButton
                                type="button"
                                variant="secondary"
                                disabled={!canApplyUpgrade || approvalStatus === "APPROVED" || applyStatus === "EXECUTED" || dbPatchSubmitting === `approve:${queueId}`}
                                onClick={() => void handleApproveQueue(queueId)}
                              >
                                {dbPatchSubmitting === `approve:${queueId}` ? (en ? "Approving..." : "승인 중...") : (en ? "Approve" : "승인")}
                              </MemberButton>
                              <MemberButton
                                type="button"
                                variant="secondary"
                                disabled={!canApplyUpgrade || approvalStatus === "REJECTED" || applyStatus === "EXECUTED" || dbPatchSubmitting === `reject:${queueId}`}
                                onClick={() => void handleRejectQueue(queueId)}
                              >
                                {dbPatchSubmitting === `reject:${queueId}` ? (en ? "Rejecting..." : "반려 중...") : (en ? "Reject" : "반려")}
                              </MemberButton>
                              <MemberButton
                                type="button"
                                variant="primary"
                                disabled={!canApplyUpgrade || approvalStatus !== "APPROVED" || applyStatus === "EXECUTED" || dbPatchSubmitting === `execute:${queueId}`}
                                onClick={() => void handleExecuteQueue(queueId)}
                              >
                                {dbPatchSubmitting === `execute:${queueId}` ? (en ? "Executing..." : "실행 중...") : (en ? "Execute" : "실행")}
                              </MemberButton>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Recent Patch Results" : "최근 패치 실행 이력"}</p>
                    <div className="mt-3 space-y-3">
                      {dbPatchResultRows.length === 0 ? (
                        <p className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                          {en ? "No patch execution results yet." : "패치 실행 이력이 없습니다."}
                        </p>
                      ) : dbPatchResultRows.slice(0, 5).map((item, index) => {
                        const row = toRecord(item);
                        return (
                          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3" key={`${stringOf(row.resultId)}-${index}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row.queueId) || "-"}</p>
                              <span className={`rounded-full px-3 py-1 text-xs font-bold ${jobStatusTone(stringOf(row.executionStatus))}`}>
                                {stringOf(row.executionStatus) || "-"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row.executionMessage) || "-"}</p>
                            <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">
                              {stringOf(row.targetEnv) || "-"} / {stringOf(row.startedAt) || "-"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Recent Deployment Records" : "최근 배포 기록"}</p>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Release version/title/content are stored in DB before remote deploy starts." : "원격 배포 시작 전에 버전/제목/내용이 DB에 저장됩니다."}
                </p>
                <div className="mt-4 space-y-3">
                  {recentDeploymentHistory.length === 0 ? (
                    <p className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en ? "No deployment records have been stored yet." : "저장된 배포 기록이 없습니다."}
                    </p>
                  ) : recentDeploymentHistory.slice(0, 5).map((item, index) => {
                    const row = toRecord(item);
                    return (
                      <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4" key={`${stringOf(row.deploymentHistoryId)}-${index}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row.releaseVersion) || "-"}</p>
                            <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row.releaseTitle) || "-"}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${jobStatusTone(stringOf(row.status))}`}>{stringOf(row.status) || "-"}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row.releaseContent) || "-"}</p>
                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Started" : "시작"}</p>
                            <p className="mt-1 text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(row.startedAt) || "-"}</p>
                          </div>
                          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Git Commit" : "Git 커밋"}</p>
                            <p className="mt-1 break-all text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(row.gitCommitSha) || "-"}</p>
                          </div>
                          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Result" : "결과"}</p>
                            <p className="mt-1 text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(row.resultMessage) || "-"}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Current Remote Job" : "현재 원격 작업"}</p>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(currentRemoteJob.profileName) || "-"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${jobStatusTone(stringOf(currentRemoteJob.status))}`}>{stringOf(currentRemoteJob.status) || "-"}</span>
                    <MemberButton type="button" variant="secondary" onClick={() => void operationsState.reload()}>
                      {en ? "Refresh Job State" : "작업 상태 새로고침"}
                    </MemberButton>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Started" : "시작"}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(currentRemoteJob.startedAt) || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Deploy Mode" : "배포 모드"}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(currentRemoteJob.remoteDeployMode) || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Duration" : "소요 시간"}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(currentRemoteJob.duration) || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Result" : "결과"}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(currentRemoteJob.resultMessage) || "-"}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-950 px-4 py-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-300">{en ? "Latest Log Lines" : "최근 로그"}</p>
                  <div className="space-y-1 font-mono text-xs text-slate-100">
                    {toList(currentRemoteJob.logLines).slice(-40).map((line, index) => (
                      <div key={`${stringOf(line)}-${index}`}>{stringOf(line)}</div>
                    ))}
                    {toList(currentRemoteJob.logLines).length === 0 ? (
                      <div className="text-slate-400">{en ? "No logs yet." : "아직 로그가 없습니다."}</div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Recent Remote Jobs" : "최근 원격 작업"}</p>
                  {recentRemoteJobs.length === 0 ? (
                    <p className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en ? "No remote deploy jobs have been recorded yet." : "기록된 원격 배포 작업이 없습니다."}
                    </p>
                  ) : recentRemoteJobs.slice(0, 4).map((item, index) => {
                    const row = toRecord(item);
                    return (
                      <div className="flex items-center justify-between gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3" key={`${stringOf(row.jobId)}-${index}`}>
                        <div>
                          <p className="text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(row.profileName) || stringOf(row.executionType) || "-"}</p>
                          <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row.startedAt) || "-"}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${jobStatusTone(stringOf(row.status))}`}>{stringOf(row.status) || "-"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="gov-card overflow-hidden p-0">
            <MemberSectionToolbar
              title={en ? "Project Version Overview" : "프로젝트 버전 개요"}
              actions={<span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{projectId}</span>}
            />
            <div className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2">
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Runtime" : "런타임"}</p>
                <h3 className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(overview?.activeRuntimeVersion) || "-"}</h3>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Active runtime package version." : "현재 활성 런타임 패키지 버전입니다."}</p>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Common Core" : "공통 코어"}</p>
                <h3 className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(overview?.activeCommonCoreVersion) || "-"}</h3>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Version-pinned common jar line." : "버전 고정된 공통 jar 라인입니다."}</p>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Adapter Contract" : "어댑터 계약"}</p>
                <h3 className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(overview?.activeAdapterContractVersion) || "-"}</h3>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Stable project-facing contract line." : "프로젝트가 바라보는 안정 계약 버전입니다."}</p>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Rollback Target" : "롤백 대상"}</p>
                <h3 className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(overview?.rollbackReadyReleaseUnitId) || "-"}</h3>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Immediate rollback reference release." : "즉시 롤백 가능한 기준 릴리스입니다."}</p>
              </article>
            </div>
          </div>

          <div className="gov-card overflow-hidden p-0">
            <MemberSectionToolbar title={en ? "Installed Packages" : "설치 패키지"} />
            <div className="space-y-3 px-6 py-6">
              {installedPackages.length === 0 ? (
                <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No installable package records were returned." : "설치형 패키지 기록이 없습니다."}</p>
              ) : installedPackages.map((item, index) => (
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4" key={`${stringOf(item.packageId)}-${index}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item.packageId) || "-"}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{stringOf(item.installedVersion) || "-"}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item.packageType) || "-"}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="gov-card overflow-hidden p-0">
            <MemberSectionToolbar title={en ? "Installed Artifact Set" : "설치 아티팩트 세트"} />
            <div className="overflow-x-auto">
              <AdminTable>
                <thead>
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-6 py-4">{en ? "Artifact ID" : "아티팩트 ID"}</th>
                    <th className="px-6 py-4">{en ? "Family" : "패밀리"}</th>
                    <th className="px-6 py-4">{en ? "Installed Version" : "설치 버전"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Active" : "활성"}</th>
                  </tr>
                </thead>
                <tbody>
                  {installedArtifacts.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={4}>
                        {en ? "No installed artifacts were returned." : "설치된 아티팩트 정보가 없습니다."}
                      </td>
                    </tr>
                  ) : installedArtifacts.map((item, index) => (
                    <tr className="border-b border-[var(--kr-gov-border-light)] bg-white" key={`${stringOf(item.artifactId)}-${index}`}>
                      <td className="px-6 py-4 text-sm font-semibold">{stringOf(item.artifactId) || "-"}</td>
                      <td className="px-6 py-4 text-sm">{stringOf(item.artifactFamily) || "-"}</td>
                      <td className="px-6 py-4 text-sm">{stringOf(item.installedArtifactVersion) || "-"}</td>
                      <td className="px-6 py-4 text-center text-sm">{truthLabel(item.activeYn, en)}</td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
            </div>
          </div>

          <div className="gov-card overflow-hidden p-0">
            <MemberSectionToolbar
              title={en ? "Server Deployment State" : "서버 배포 상태"}
              actions={(
                <div className="flex flex-wrap gap-2">
                  {(["ALL", "ACTIVE", "PREVIEW", "STAGE", "UNKNOWN"] as ServerRoleFilter[]).map((role) => (
                    <button
                      key={role}
                      className={`rounded-full px-3 py-1 text-xs font-bold ${serverRoleFilter === role ? "bg-[var(--kr-gov-blue)] text-white" : "bg-slate-100 text-slate-700"}`}
                      type="button"
                      onClick={() => setServerRoleFilter(role)}
                    >
                      {role === "ALL"
                        ? (en ? "All" : "전체")
                        : role === "ACTIVE"
                          ? "ACTIVE"
                          : role === "PREVIEW"
                            ? "PREVIEW"
                            : role === "STAGE"
                              ? "STAGE"
                              : (en ? "UNKNOWN" : "미분류")}
                    </button>
                  ))}
                </div>
              )}
            />
            <div className="space-y-3 px-6 py-6">
              {filteredServerStates.length === 0 ? (
                <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No server deployment states were returned." : "서버 배포 상태 정보가 없습니다."}</p>
              ) : filteredServerStates.map((item, index) => (
                (() => {
                  const pipelineServerState = pipelineServerStateByServerId.get(stringOf(item.serverId)) || null;
                  const effectivePromotionState = stringOf(pipelineServerState?.promotionState) || "";
                  const effectiveHealthStatus = stringOf(pipelineServerState?.healthStatus) || stringOf(item.healthStatus);
                  const effectiveReleaseUnitId = stringOf(pipelineServerState?.activeReleaseUnitId) || stringOf(item.activeReleaseUnitId);
                  const routePlan = pipelineRouteByRole.get(normalizePipelineRole(pipelineServerState?.serverRole || item.serverRole));
                  return (
                <article
                  className={`rounded-[var(--kr-gov-radius)] border px-4 py-4 ${stringOf(item.serverId) === stringOf(selectedServer?.serverId) ? "border-[var(--kr-gov-blue)] bg-blue-50/60" : "border-[var(--kr-gov-border-light)] bg-white"}`}
                  key={`${stringOf(item.serverId)}-${index}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      className="text-sm font-bold text-[var(--kr-gov-text-primary)] underline"
                      type="button"
                      onClick={() => setSelectedServerId(stringOf(item.serverId))}
                    >
                      {stringOf(item.serverId) || "-"}
                    </button>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${serverRoleTone(inferServerRole(item))}`}>{inferServerRole(item)}</span>
                      {effectivePromotionState ? (
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${serverHealthTone(effectivePromotionState)}`}>
                          {effectivePromotionState}
                        </span>
                      ) : null}
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${serverHealthTone(effectiveHealthStatus)}`}>
                        {effectiveHealthStatus || "-"}
                      </span>
                    </div>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-[var(--kr-gov-text-secondary)]">
                    <div className="flex justify-between gap-4">
                      <dt>{en ? "Release" : "릴리스"}</dt>
                      <dd>
                        <button
                          className="font-semibold text-[var(--kr-gov-blue)] underline"
                          type="button"
                          onClick={() => {
                            setSelectedReleaseUnitId(effectiveReleaseUnitId);
                            setRollbackTargetReleaseId(effectiveReleaseUnitId);
                            setSelectedServerId(stringOf(item.serverId));
                          }}
                        >
                          {effectiveReleaseUnitId || "-"}
                        </button>
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4"><dt>{en ? "Deploy Trace" : "배포 추적"}</dt><dd>{stringOf(item.deployTraceId) || "-"}</dd></div>
                    <div className="flex justify-between gap-4"><dt>{en ? "Deployed At" : "배포 시각"}</dt><dd>{stringOf(item.deployedAt) || "-"}</dd></div>
                    <div className="flex justify-between gap-4"><dt>{en ? "Pipeline Route" : "파이프라인 경로"}</dt><dd>{stringOf(routePlan?.serverRole) || "-"}</dd></div>
                    <div className="flex justify-between gap-4">
                      <dt>{en ? "Selected Release Match" : "선택 릴리스 일치"}</dt>
                      <dd className={effectiveReleaseUnitId === stringOf(selectedReleaseUnit?.releaseUnitId) ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>
                        {effectiveReleaseUnitId === stringOf(selectedReleaseUnit?.releaseUnitId)
                          ? (en ? "Matched" : "일치")
                          : (en ? "Different" : "불일치")}
                      </dd>
                    </div>
                  </dl>
                </article>
                  );
                })()
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="gov-card overflow-hidden p-0">
            <MemberSectionToolbar title={en ? "Deployment Alignment" : "배포 정렬 상태"} />
            <div className="grid grid-cols-1 gap-3 px-6 py-6 md:grid-cols-3">
              {deploySummaryCards.map((card) => (
                <SummaryMetricCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  description={card.description}
                />
              ))}
            </div>
          </div>

          <div className="gov-card overflow-hidden p-0">
            <MemberSectionToolbar
              title={en ? "Selected Server Detail" : "선택 서버 상세"}
              actions={selectedServer ? <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{stringOf(selectedServer.serverId)}</span> : null}
            />
            <div className="space-y-4 px-6 py-6">
              {!selectedServer ? (
                <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Select a server to inspect deployment alignment." : "배포 정렬 상태를 보려면 서버를 선택하세요."}</p>
              ) : (
                <>
                  <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3"><dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Server ID" : "서버 ID"}</dt><dd className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(selectedServer.serverId) || "-"}</dd></div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3"><dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Role" : "역할"}</dt><dd className="mt-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${serverRoleTone(inferServerRole(selectedServer))}`}>{inferServerRole(selectedServer)}</span></dd></div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3"><dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Health" : "상태"}</dt><dd className="mt-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${serverHealthTone(stringOf(selectedServer.healthStatus))}`}>{stringOf(selectedServer.healthStatus) || "-"}</span></dd></div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3"><dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Active Release" : "활성 릴리스"}</dt><dd className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(selectedServer.activeReleaseUnitId) || "-"}</dd></div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3"><dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Deploy Trace" : "배포 추적"}</dt><dd className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(selectedServer.deployTraceId) || "-"}</dd></div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <MemberButton
                      type="button"
                      variant="secondary"
                      disabled={!buildDeployTraceHref(projectId, stringOf(selectedServer?.deployTraceId))}
                      onClick={() => {
                        const deployTraceHref = buildDeployTraceHref(projectId, stringOf(selectedServer?.deployTraceId));
                        if (!deployTraceHref) {
                          return;
                        }
                        openProjectVersionHref(deployTraceHref);
                      }}
                    >
                      {en ? "Open Deploy Trace" : "배포 추적 열기"}
                    </MemberButton>
                    <MemberButton
                      type="button"
                      variant="secondary"
                      onClick={() => setSelectedReleaseUnitId(stringOf(selectedServer.activeReleaseUnitId))}
                    >
                      {en ? "Open Active Release" : "활성 릴리스 열기"}
                    </MemberButton>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Selected Release Alignment" : "선택 릴리스 정렬 상태"}</p>
                    <p className={`mt-2 text-sm font-bold ${stringOf(selectedServer.activeReleaseUnitId) === stringOf(selectedReleaseUnit?.releaseUnitId) ? "text-emerald-700" : "text-amber-700"}`}>
                      {stringOf(selectedServer.activeReleaseUnitId) === stringOf(selectedReleaseUnit?.releaseUnitId)
                        ? (en ? "This server already points to the selected release unit." : "이 서버는 이미 선택한 릴리스 유닛을 가리킵니다.")
                        : (en ? "This server is still pointing to a different release unit." : "이 서버는 아직 다른 릴리스 유닛을 가리키고 있습니다.")}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <div className="overflow-hidden rounded-2xl border border-[var(--kr-gov-border)] bg-white shadow-sm">
          <GridToolbar
            title={en ? "Version Tracking Control Plane" : "버전 추적 컨트롤 플레인"}
            meta={en
              ? "Bind the selected release, artifact line, deployment target, and rollback anchor to the governed project pipeline contract."
              : "선택 릴리스, 아티팩트 라인, 배포 대상, 롤백 앵커를 governed project pipeline 계약으로 묶습니다."}
            actions={(
              <div className="flex flex-wrap gap-2">
                <MemberButton disabled={pipelineRunLoading} onClick={handleRefreshProjectPipeline} type="button" variant="secondary">
                  {pipelineStatusState.loading ? (en ? "Loading..." : "불러오는 중...") : (en ? "Load Latest" : "최신 실행 조회")}
                </MemberButton>
                <MemberButton disabled={pipelineRunLoading || !selectedReleaseUnit} onClick={handleRunProjectPipeline} type="button" variant="primary">
                  {pipelineRunLoading ? (en ? "Running..." : "실행 중...") : (en ? "Run Pipeline" : "파이프라인 실행")}
                </MemberButton>
              </div>
            )}
          />
          <div className="space-y-6 px-6 py-5" data-help-id="version-management-control-plane">
            <KeyValueGridPanel
              title={en ? "Pipeline Summary" : "파이프라인 요약"}
              description={en
                ? "This snapshot standardizes version tracking around release family, runtime package, deploy trace, and rollback target."
                : "이 스냅샷은 버전 추적을 release family, runtime package, deploy trace, rollback target 기준으로 표준화합니다."}
              items={[
                { label: "projectId", value: projectId },
                { label: "pipelineRunId", value: projectPipeline?.pipelineRunId || "-" },
                { label: "selectedReleaseUnitId", value: stringOf(selectedReleaseUnit?.releaseUnitId) || "-" },
                { label: "pipelineReleaseUnitId", value: projectPipeline?.releaseUnitId || "-" },
                { label: "runtimePackageId", value: projectPipeline?.runtimePackageId || stringOf(selectedReleaseUnit?.runtimePackageId) || "-" },
                { label: "deployTraceId", value: projectPipeline?.deployTraceId || stringOf(selectedServer?.deployTraceId) || "-" },
                { label: en ? "Pipeline Result" : "파이프라인 결과", value: projectPipeline?.result || "-" },
                { label: en ? "Release Family" : "릴리스 패밀리", value: stringOf(pipelineArtifactLineage.releaseFamilyId) || "-" },
                { label: en ? "Release Track Version" : "릴리스 트랙 버전", value: stringOf(pipelineArtifactLineage.releaseTrackVersion) || "-" },
                { label: en ? "Rollback Target" : "롤백 대상", value: stringOf(pipelineRollbackPlan.rollbackTargetReleaseUnitId) || rollbackTargetReleaseId || "-" }
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <MemberButton
                type="button"
                variant="secondary"
                disabled={!buildDeployTraceHref(projectId, stringOf(projectPipeline?.deployTraceId) || stringOf(selectedServer?.deployTraceId))}
                onClick={() => {
                  const deployTraceHref = buildDeployTraceHref(projectId, stringOf(projectPipeline?.deployTraceId) || stringOf(selectedServer?.deployTraceId));
                  if (!deployTraceHref) {
                    return;
                  }
                  openProjectVersionHref(deployTraceHref);
                }}
              >
                {en ? "Open Pipeline Deploy Trace" : "파이프라인 배포 추적 열기"}
              </MemberButton>
              <MemberButton
                type="button"
                variant="secondary"
                disabled={!pipelineReleaseUnitLogHref}
                onClick={() => {
                  if (!pipelineReleaseUnitLogHref) {
                    return;
                  }
                  openProjectVersionHref(pipelineReleaseUnitLogHref);
                }}
              >
                {en ? "Open Pipeline Release Evidence" : "파이프라인 릴리스 증거 열기"}
              </MemberButton>
              <MemberButton
                type="button"
                variant="secondary"
                disabled={!pipelineReleaseFamilyLogHref}
                onClick={() => {
                  if (!pipelineReleaseFamilyLogHref) {
                    return;
                  }
                  openProjectVersionHref(pipelineReleaseFamilyLogHref);
                }}
              >
                {en ? "Open Release Family Lineage" : "릴리스 패밀리 계보 열기"}
              </MemberButton>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <KeyValueGridPanel
                title={en ? "Installable Product" : "설치형 프로덕트"}
                items={[
                  { label: "installableProductId", value: stringOf(pipelineInstallableProduct.installableProductId) || "-" },
                  { label: "productType", value: stringOf(pipelineInstallableProduct.productType) || "-" },
                  { label: "packageId", value: stringOf(pipelineInstallableProduct.packageId) || stringOf(selectedReleaseUnit?.runtimePackageId) || "-" },
                  { label: "packageFormat", value: stringOf(pipelineInstallableProduct.packageFormat) || "-" },
                  { label: "menuBinding.projectId", value: stringOf(toRecord(pipelineInstallableProduct.menuBinding).projectId) || projectId },
                  { label: "menuBinding.menuRoot", value: stringOf(toRecord(pipelineInstallableProduct.menuBinding).menuRoot) || projectId },
                  { label: "menuBinding.runtimeClass", value: stringOf(toRecord(pipelineInstallableProduct.menuBinding).runtimeClass) || stringOf(overview?.projectDisplayName) || projectId },
                  { label: "menuBinding.menuScope", value: stringOf(toRecord(pipelineInstallableProduct.menuBinding).menuScope) || "ADMIN" }
                ]}
              />
              <KeyValueGridPanel
                title={en ? "Deploy Contract" : "배포 계약"}
                items={[
                  { label: "artifactTargetSystem", value: stringOf(pipelineDeployContract.artifactTargetSystem) || "-" },
                  { label: "deploymentTarget", value: stringOf(pipelineDeployContract.deploymentTarget) || stringOf(selectedServer?.serverId) || "-" },
                  { label: "deploymentMode", value: stringOf(pipelineDeployContract.deploymentMode) || "-" },
                  { label: "versionTrackingYn", value: String(pipelineDeployContract.versionTrackingYn ?? "-") },
                  { label: "releaseFamilyId", value: stringOf(pipelineDeployContract.releaseFamilyId) || "-" },
                  { label: "releaseUnitId", value: stringOf(pipelineDeployContract.releaseUnitId) || stringOf(selectedReleaseUnit?.releaseUnitId) || "-" },
                  { label: "artifactManifestId", value: stringOf(pipelineArtifactLineage.artifactManifestId) || "-" },
                  { label: "selectedServerId", value: stringOf(selectedServer?.serverId) || "-" }
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Deployment Route" : "배포 승격 경로"}</h3>
                <div className="mt-3 space-y-2">
                  {pipelineDeploymentRoutes.length ? pipelineDeploymentRoutes.map((item, index) => {
                    const row = toRecord(item);
                    return (
                      <div className="flex items-center justify-between rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-3" key={`${stringOf(row.serverRole)}-${index}`}>
                        <div>
                          <p className="text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(row.serverRole) || "-"}</p>
                          <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row.serverId) || "-"}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${serverHealthTone(stringOf(row.promotionState) || "")}`}>{stringOf(row.promotionState) || "-"}</span>
                      </div>
                    );
                  }) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No deployment route is attached yet." : "연결된 배포 승격 경로가 없습니다."}</p>}
                </div>
              </section>
              <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Server Promotion State" : "서버 승격 상태"}</h3>
                <div className="mt-3 space-y-2">
                  {pipelineServerStateRows.length ? pipelineServerStateRows.map((item, index) => {
                    const row = toRecord(item);
                    return (
                      <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-3" key={`${stringOf(row.serverId)}-${index}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(row.serverId) || "-"}</p>
                            <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row.serverRole) || "-"}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${serverHealthTone(stringOf(row.promotionState) || "")}`}>{stringOf(row.promotionState) || "-"}</span>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${serverHealthTone(stringOf(row.healthStatus) || "")}`}>{stringOf(row.healthStatus) || "-"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No pipeline server state is available." : "파이프라인 서버 상태가 없습니다."}</p>}
                </div>
              </section>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Validator Checks" : "검증 체크"}</h3>
                <div className="mt-3 space-y-2">
                  {pipelineValidatorRows.length ? pipelineValidatorRows.map((item, index) => {
                    const row = toRecord(item);
                    const status = stringOf(row.status);
                    const tone = status === "PASS" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
                    return (
                      <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-3" key={`${stringOf(row.validatorCheckId)}-${index}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold">{stringOf(row.validatorCheckId) || "-"}</div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{status || "-"}</span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row.summary) || "-"}</p>
                      </div>
                    );
                  }) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No pipeline status loaded." : "불러온 파이프라인 상태가 없습니다."}</p>}
                </div>
              </section>

              <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Stage Progress" : "단계 진행"}</h3>
                <div className="mt-3 space-y-2">
                  {pipelineStageRows.length ? pipelineStageRows.map((item, index) => {
                    const row = toRecord(item);
                    const status = stringOf(row.status);
                    const tone = status === "DONE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
                    return (
                      <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-3" key={`${stringOf(row.stageId)}-${index}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold">{stringOf(row.stageId) || "-"}</div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{status || "-"}</span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row.summary) || "-"}</p>
                      </div>
                    );
                  }) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No stage evidence loaded." : "불러온 단계 정보가 없습니다."}</p>}
                </div>
              </section>

              <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Artifact Registry" : "아티팩트 레지스트리"}</h3>
                <div className="mt-3 space-y-2">
                  {pipelineArtifactRows.length ? pipelineArtifactRows.map((item, index) => {
                    const row = toRecord(item);
                    return (
                      <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-3" key={`${stringOf(row.artifactId)}-${index}`}>
                        <div className="text-sm font-semibold">{stringOf(row.artifactId) || "-"}</div>
                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--kr-gov-text-secondary)]">{stringOf(row.artifactFamily) || "-"}</p>
                        <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row.artifactVersion) || "-"}</p>
                      </div>
                    );
                  }) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No artifact registry evidence loaded." : "불러온 아티팩트 정보가 없습니다."}</p>}
                </div>
              </section>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="gov-card overflow-hidden p-0" data-help-id="version-management-release-detail">
            <MemberSectionToolbar title={en ? "Adapter Change History" : "어댑터 변경 이력"} />
            <div className="overflow-x-auto">
              <AdminTable className="min-w-[920px]">
                <thead>
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-6 py-4">{en ? "Recorded At" : "기록 시각"}</th>
                    <th className="px-6 py-4">{en ? "Contract" : "계약 버전"}</th>
                    <th className="px-6 py-4">{en ? "Artifact" : "어댑터 아티팩트"}</th>
                    <th className="px-6 py-4">{en ? "Compatibility" : "호환성"}</th>
                    <th className="px-6 py-4">{en ? "Impact Summary" : "영향 요약"}</th>
                  </tr>
                </thead>
                <tbody>
                  {adapterHistory.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                        {en ? "No adapter history was returned." : "어댑터 변경 이력이 없습니다."}
                      </td>
                    </tr>
                  ) : adapterHistory.map((item, index) => (
                    <tr className="border-b border-[var(--kr-gov-border-light)] bg-white" key={`${stringOf(item.recordedAt)}-${index}`}>
                      <td className="px-6 py-4 text-sm">{stringOf(item.recordedAt) || "-"}</td>
                      <td className="px-6 py-4 text-sm">{stringOf(item.adapterContractVersion) || "-"}</td>
                      <td className="px-6 py-4 text-sm">{stringOf(item.adapterArtifactVersion) || "-"}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${compatibilityTone(stringOf(item.compatibilityClass))}`}>
                          {stringOf(item.compatibilityClass) || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item.mappingImpactSummary) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
            </div>
          </div>

          <div className="gov-card overflow-hidden p-0">
            <MemberSectionToolbar title={en ? "Release Units" : "릴리스 유닛"} />
            <div className="overflow-x-auto">
              <AdminTable className="min-w-[920px]">
                <thead>
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-6 py-4">{en ? "Release Unit" : "릴리스 유닛"}</th>
                    <th className="px-6 py-4">{en ? "Runtime Package" : "런타임 패키지"}</th>
                    <th className="px-6 py-4">{en ? "Runtime Version" : "런타임 버전"}</th>
                    <th className="px-6 py-4">{en ? "Servers" : "서버 수"}</th>
                    <th className="px-6 py-4">{en ? "Pipeline Snapshot" : "파이프라인 스냅샷"}</th>
                    <th className="px-6 py-4">{en ? "Built At" : "빌드 시각"}</th>
                  </tr>
                </thead>
                <tbody>
                  {releaseUnits.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={6}>
                        {en ? "No release units were returned." : "릴리스 유닛 정보가 없습니다."}
                      </td>
                    </tr>
                  ) : releaseUnits.map((item, index) => {
                    const releaseUnitId = stringOf(item.releaseUnitId);
                    const isPipelineRelease = releaseUnitId === stringOf(projectPipeline?.releaseUnitId);
                    const isRollbackAnchor = releaseUnitId === (stringOf(pipelineRollbackPlan.rollbackTargetReleaseUnitId) || rollbackTargetReleaseId);
                    return (
                      <tr
                        className={`border-b border-[var(--kr-gov-border-light)] ${releaseUnitId === stringOf(selectedReleaseUnit?.releaseUnitId) ? "bg-blue-50/70" : "bg-white hover:bg-slate-50"} cursor-pointer`}
                        key={`${releaseUnitId}-${index}`}
                        onClick={() => {
                          setSelectedReleaseUnitId(releaseUnitId);
                          setRollbackTargetReleaseId(releaseUnitId);
                        }}
                      >
                        <td className="px-6 py-4 text-sm font-semibold">{releaseUnitId || "-"}</td>
                        <td className="px-6 py-4 text-sm">{stringOf(item.runtimePackageId) || "-"}</td>
                        <td className="px-6 py-4 text-sm">{stringOf(item.projectRuntimeVersion) || "-"}</td>
                        <td className="px-6 py-4 text-sm">{String(serverCountByReleaseUnitId.get(releaseUnitId) || 0)}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-wrap gap-2">
                            {isPipelineRelease ? (
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                                {en ? "Snapshot" : "스냅샷"}
                              </span>
                            ) : null}
                            {isRollbackAnchor ? (
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                                {en ? "Rollback Anchor" : "롤백 앵커"}
                              </span>
                            ) : null}
                            {isPipelineRelease && pipelinePromotionSummary ? (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                                {pipelinePromotionSummary}
                              </span>
                            ) : null}
                            {!isPipelineRelease && !isRollbackAnchor ? "-": null}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">{stringOf(item.builtAt) || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </AdminTable>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="gov-card overflow-hidden p-0">
            <MemberSectionToolbar
              title={en ? "Selected Release Detail" : "선택 릴리스 상세"}
              actions={selectedReleaseUnit ? <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{stringOf(selectedReleaseUnit.releaseUnitId)}</span> : null}
            />
            <div className="space-y-4 px-6 py-6">
              {!selectedReleaseUnit ? (
                <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                  {isInitializationState
                    ? (en ? "Release units will appear here after the version-control registry is initialized for this project." : "이 프로젝트의 버전 관리 레지스트리가 초기화되면 릴리스 유닛이 여기에 표시됩니다.")
                    : (en ? "Select a release unit to inspect details." : "상세를 보려면 릴리스 유닛을 선택하세요.")}
                </p>
              ) : (
                <>
                  <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3"><dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Runtime Package" : "런타임 패키지"}</dt><dd className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(selectedReleaseUnit.runtimePackageId) || "-"}</dd></div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3"><dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Runtime Version" : "런타임 버전"}</dt><dd className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(selectedReleaseUnit.projectRuntimeVersion) || "-"}</dd></div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3"><dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Adapter Artifact" : "어댑터 아티팩트"}</dt><dd className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(selectedReleaseUnit.adapterArtifactVersion) || "-"}</dd></div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3"><dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Adapter Contract" : "어댑터 계약"}</dt><dd className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(selectedReleaseUnit.adapterContractVersion) || "-"}</dd></div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3"><dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Built At" : "빌드 시각"}</dt><dd className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(selectedReleaseUnit.builtAt) || "-"}</dd></div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3"><dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Rollback Target" : "롤백 대상"}</dt><dd className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(selectedReleaseUnit.rollbackTargetReleaseId) || "-"}</dd></div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <MemberPermissionButton
                      allowed={canRollbackRelease}
                      reason={en ? "You need A0060404_ROLLBACK permission to mark a rollback target." : "롤백 대상을 지정하려면 A0060404_ROLLBACK 권한이 필요합니다."}
                      type="button"
                      variant="secondary"
                      onClick={() => setRollbackTargetReleaseId(stringOf(selectedReleaseUnit.releaseUnitId))}
                    >
                      {en ? "Use As Rollback Target" : "롤백 대상으로 사용"}
                    </MemberPermissionButton>
                    <MemberButton
                      type="button"
                      variant="secondary"
                      disabled={!selectedReleaseUnitLogHref}
                      onClick={() => {
                        if (!selectedReleaseUnitLogHref) {
                          return;
                        }
                        openProjectVersionHref(selectedReleaseUnitLogHref);
                      }}
                    >
                      {en ? "Open Release Evidence" : "릴리스 증거 열기"}
                    </MemberButton>
                    <MemberButton
                      type="button"
                      variant="secondary"
                      disabled={!selectedRuntimePackageLogHref}
                      onClick={() => {
                        if (!selectedRuntimePackageLogHref) {
                          return;
                        }
                        openProjectVersionHref(selectedRuntimePackageLogHref);
                      }}
                    >
                      {en ? "Open Runtime Package Evidence" : "런타임 패키지 증거 열기"}
                    </MemberButton>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="gov-card overflow-hidden p-0">
            <MemberSectionToolbar title={en ? "Selected Release Artifact Set" : "선택 릴리스 아티팩트 세트"} />
            <div className="space-y-4 px-6 py-6">
              <div className="overflow-x-auto">
                <AdminTable>
                  <thead>
                    <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                      <th className="px-6 py-4">{en ? "Artifact ID" : "아티팩트 ID"}</th>
                      <th className="px-6 py-4">{en ? "Version" : "버전"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReleaseCommonArtifacts.length === 0 ? (
                      <tr>
                        <td className="px-6 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={2}>
                          {en ? "No release artifact payload was recorded." : "기록된 릴리스 아티팩트 payload가 없습니다."}
                        </td>
                      </tr>
                    ) : selectedReleaseCommonArtifacts.map((item, index) => (
                      <tr className="border-b border-[var(--kr-gov-border-light)] bg-white" key={`${stringOf(item.artifactId)}-${stringOf(item.artifactVersion)}-${index}`}>
                        <td className="px-6 py-4 text-sm font-semibold">{stringOf(item.artifactId) || "-"}</td>
                        <td className="px-6 py-4 text-sm">{stringOf(item.artifactVersion) || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              </div>
              <div className="overflow-x-auto">
                <AdminTable>
                  <thead>
                    <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                      <th className="px-6 py-4">{en ? "Package ID" : "패키지 ID"}</th>
                      <th className="px-6 py-4">{en ? "Version" : "버전"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReleasePackages.length === 0 ? (
                      <tr>
                        <td className="px-6 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={2}>
                          {en ? "No package version set was recorded." : "기록된 패키지 버전 세트가 없습니다."}
                        </td>
                      </tr>
                    ) : selectedReleasePackages.map((item, index) => (
                      <tr className="border-b border-[var(--kr-gov-border-light)] bg-white" key={`${stringOf(item.packageId)}-${stringOf(item.installedVersion)}-${index}`}>
                        <td className="px-6 py-4 text-sm font-semibold">{stringOf(item.packageId) || "-"}</td>
                        <td className="px-6 py-4 text-sm">{stringOf(item.installedVersion || item.packageVersion) || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              </div>
            </div>
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0">
          <MemberSectionToolbar
            title={en ? "Candidate Artifact Versions" : "후보 아티팩트 버전"}
            actions={(
              <MemberButton type="button" variant="secondary" onClick={applyLatestCandidateSet} disabled={latestCandidateSet.length === 0}>
                {en ? "Use Latest Set" : "최신 세트 사용"}
              </MemberButton>
            )}
          />
          <div className="overflow-x-auto">
            <AdminTable className="min-w-[1080px]">
              <thead>
                <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                  <th className="px-6 py-4">{en ? "Artifact ID" : "아티팩트 ID"}</th>
                  <th className="px-6 py-4">{en ? "Version" : "버전"}</th>
                  <th className="px-6 py-4">{en ? "State" : "상태"}</th>
                  <th className="px-6 py-4">{en ? "Adapter Contract" : "어댑터 계약"}</th>
                  <th className="px-6 py-4">{en ? "Published At" : "발행 시각"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Installed" : "설치 여부"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Action" : "동작"}</th>
                </tr>
              </thead>
              <tbody>
                {candidateArtifacts.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={7}>
                      {en ? "No candidate artifact versions were returned." : "후보 아티팩트 버전이 없습니다."}
                    </td>
                  </tr>
                ) : candidateArtifacts.map((item, index) => {
                  const artifactId = stringOf(item.artifactId);
                  const artifactVersion = stringOf(item.artifactVersion);
                  const adapterContractVersion = stringOf(item.adapterContractVersion);
                  const installedVersion = stringOf(item.installedArtifactVersion);
                  const latestVersion = stringOf(item.latestArtifactVersion);
                  const compatibilityClass = stringOf(item.compatibilityClass);
                  const stateSummary = stringOf(item.stateSummary);
                  const upgradeReady = item.upgradeReadyYn === true || item.upgradeReadyYn === "Y" || item.upgradeReadyYn === 1;
                  const alreadySelected = targetArtifactSet.some((candidate) => (
                    candidate.artifactId === artifactId
                    && candidate.artifactVersion === artifactVersion
                  ));
                  const candidateState = stringOf(item.candidateState) as "INSTALLED" | "LATEST" | "REVIEW" | "AVAILABLE";
                  return (
                    <tr className="border-b border-[var(--kr-gov-border-light)] bg-white" key={`${artifactId}-${artifactVersion}-${index}`}>
                      <td className="px-6 py-4 text-sm font-semibold">{artifactId || "-"}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-[var(--kr-gov-text-primary)]">{artifactVersion || "-"}</div>
                        {(installedVersion || latestVersion) ? (
                          <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                            {en
                              ? `Installed ${installedVersion || "-"} / Latest ${latestVersion || "-"}`
                              : `설치 ${installedVersion || "-"} / 최신 ${latestVersion || "-"}`}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${candidateStatusTone(candidateState)}`}>
                          {candidateState === "INSTALLED"
                            ? (en ? "Installed" : "설치중")
                            : candidateState === "LATEST"
                              ? (en ? "Latest" : "최신")
                              : candidateState === "REVIEW"
                                ? (en ? "Review" : "검토 필요")
                                : (en ? "Available" : "선택 가능")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-[var(--kr-gov-text-primary)]">{adapterContractVersion || "-"}</div>
                        {compatibilityClass ? (
                          <div className="mt-1">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${compatibilityTone(compatibilityClass)}`}>
                              {compatibilityClass}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-sm">{stringOf(item.publishedAt) || "-"}</td>
                      <td className="px-6 py-4 text-center text-sm">
                        <div>{truthLabel(item.installedYn, en)}</div>
                        {stateSummary ? (
                          <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stateSummary}</div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <MemberButton
                          type="button"
                          variant="secondary"
                          disabled={alreadySelected || !upgradeReady}
                          onClick={() => setTargetArtifactSet((current) => replaceTargetArtifact(current, {
                            artifactId,
                            artifactVersion
                          }))}
                        >
                          {alreadySelected
                            ? (en ? "Selected" : "선택됨")
                            : !upgradeReady
                              ? (en ? "Review" : "검토 필요")
                              : (en ? "Add" : "추가")}
                        </MemberButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          </div>
        </section>

        <section className="gov-card" data-help-id="version-management-upgrade-planner">
          <MemberSectionToolbar title={en ? "Upgrade Planner" : "업그레이드 플래너"} />
            <div className="space-y-6 px-6 py-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div>
                <label className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="artifact-id">
                  {en ? "Artifact ID" : "아티팩트 ID"}
                </label>
                <AdminInput id="artifact-id" value={artifactDraft.artifactId} onChange={(event) => setArtifactDraft((current) => ({ ...current, artifactId: event.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="artifact-version">
                  {en ? "Artifact Version" : "아티팩트 버전"}
                </label>
                <AdminInput id="artifact-version" value={artifactDraft.artifactVersion} onChange={(event) => setArtifactDraft((current) => ({ ...current, artifactVersion: event.target.value }))} />
              </div>
              <div className="flex items-end">
                <MemberButton type="button" variant="secondary" onClick={addTargetArtifact}>
                  {en ? "Add Target" : "대상 추가"}
                </MemberButton>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)]">
              <AdminTable>
                <thead>
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-6 py-4">{en ? "Artifact ID" : "아티팩트 ID"}</th>
                    <th className="px-6 py-4">{en ? "Target Version" : "대상 버전"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Action" : "동작"}</th>
                  </tr>
                </thead>
                <tbody>
                {targetArtifactSet.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={3}>
                        {en ? "Add target artifacts before analyzing an upgrade." : "업그레이드 분석 전에 대상 아티팩트를 추가하세요."}
                      </td>
                    </tr>
                  ) : targetArtifactSet.map((item, index) => (
                    <tr className="border-b border-[var(--kr-gov-border-light)] bg-white" key={`${item.artifactId}-${item.artifactVersion}-${index}`}>
                      <td className="px-6 py-4 text-sm font-semibold">{item.artifactId}</td>
                      <td className="px-6 py-4 text-sm">{item.artifactVersion}</td>
                      <td className="px-6 py-4 text-center">
                        <MemberButton type="button" variant="secondary" onClick={() => removeTargetArtifact(index)}>
                          {en ? "Remove" : "삭제"}
                        </MemberButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
            </div>

            <div className="flex flex-wrap gap-2">
              <MemberPermissionButton
                allowed={canAnalyzeUpgrade}
                disabled={submitting !== "" || targetArtifactSet.length === 0 || isInitializationState}
                onClick={runImpactAnalysis}
                reason={en ? "You need A0060404_ANALYZE permission to analyze upgrade impact." : "영향 분석을 실행하려면 A0060404_ANALYZE 권한이 필요합니다."}
                type="button"
                variant="primary"
              >
                {submitting === "impact" ? (en ? "Analyzing..." : "분석 중...") : (en ? "Analyze Impact" : "영향 분석")}
              </MemberPermissionButton>
              <MemberPermissionButton
                allowed={canApplyUpgrade}
                disabled={submitting !== "" || targetArtifactSet.length === 0 || isInitializationState}
                onClick={runApplyUpgrade}
                reason={en ? "You need A0060404_APPLY permission to apply an upgrade." : "업그레이드 적용을 실행하려면 A0060404_APPLY 권한이 필요합니다."}
                type="button"
                variant="secondary"
              >
                {submitting === "apply" ? (en ? "Applying..." : "적용 중...") : (en ? "Apply Upgrade" : "업그레이드 적용")}
              </MemberPermissionButton>
              <MemberPermissionButton
                allowed={canRollbackRelease}
                disabled={submitting !== "" || !rollbackTargetReleaseId || isInitializationState}
                onClick={runRollback}
                reason={en ? "You need A0060404_ROLLBACK permission to run rollback." : "롤백을 실행하려면 A0060404_ROLLBACK 권한이 필요합니다."}
                type="button"
                variant="secondary"
              >
                {submitting === "rollback" ? (en ? "Rolling back..." : "롤백 중...") : (en ? "Rollback" : "롤백")}
              </MemberPermissionButton>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <label className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="rollback-target">
                  {en ? "Rollback Target Release" : "롤백 대상 릴리스"}
                </label>
                <AdminInput id="rollback-target" value={rollbackTargetReleaseId} onChange={(event) => setRollbackTargetReleaseId(event.target.value)} />
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Use the release unit ID recorded in the project release list." : "프로젝트 릴리스 목록에 기록된 release unit ID를 사용합니다."}
                </p>
              </article>

              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Latest Impact Result" : "최근 영향 분석 결과"}</p>
                {impact ? (
                  <div className="mt-3 space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${compatibilityTone(stringOf(impact.compatibilityClass))}`}>
                        {stringOf(impact.compatibilityClass) || "-"}
                      </span>
                      <span className="text-[var(--kr-gov-text-secondary)]">{stringOf(impact.adapterImpactSummary) || "-"}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Upgrade Ready" : "업그레이드 가능"}</p>
                        <p className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{truthLabel(impact.upgradeReadyYn, en)}</p>
                      </div>
                      <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Rollback Target" : "롤백 대상"}</p>
                        <p className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(impact.rollbackTargetReleaseId) || "-"}</p>
                      </div>
                    </div>
                    {Array.isArray(impact.blockerSet) && impact.blockerSet.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5 text-rose-700">
                        {impact.blockerSet.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    ) : (
                      <p className="text-[var(--kr-gov-text-secondary)]">{en ? "No blockers were reported." : "보고된 차단 요인이 없습니다."}</p>
                    )}
                    {Array.isArray(impact.artifactDelta) && impact.artifactDelta.length > 0 ? (
                      <div className="overflow-x-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white">
                        <AdminTable className="min-w-[760px]">
                          <thead>
                            <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
                              <th className="px-4 py-3">{en ? "Artifact" : "아티팩트"}</th>
                              <th className="px-4 py-3">{en ? "Version" : "버전"}</th>
                              <th className="px-4 py-3">{en ? "Adapter" : "어댑터"}</th>
                              <th className="px-4 py-3">{en ? "API" : "API"}</th>
                              <th className="px-4 py-3">{en ? "Manifest" : "매니페스트"}</th>
                              <th className="px-4 py-3">{en ? "Capability" : "Capability"}</th>
                              <th className="px-4 py-3">{en ? "Compatibility" : "호환성"}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {impact.artifactDelta.map((item, index) => (
                              <tr className="border-b border-[var(--kr-gov-border-light)] bg-white" key={`${stringOf(item.artifactId)}-${stringOf(item.artifactVersion)}-${index}`}>
                                <td className="px-4 py-3 text-sm font-semibold">{stringOf(item.artifactId) || "-"}</td>
                                <td className="px-4 py-3 text-sm">{stringOf(item.artifactVersion) || "-"}</td>
                                <td className="px-4 py-3 text-sm">{stringOf(item.adapterContractVersion) || "-"}</td>
                                <td className="px-4 py-3 text-sm">{stringOf(item.apiContractVersion) || "-"}</td>
                                <td className="px-4 py-3 text-sm">{stringOf(item.manifestContractVersion) || "-"}</td>
                                <td className="px-4 py-3 text-sm">{stringOf(item.capabilityCatalogVersion) || "-"}</td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${compatibilityTone(stringOf(item.compatibilityClass))}`}>
                                    {stringOf(item.compatibilityClass) || "-"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </AdminTable>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Run impact analysis to compare target artifacts against the current adapter contract." : "현재 어댑터 계약과 대상 아티팩트를 비교하려면 영향 분석을 실행하세요."}</p>
                )}
              </article>
            </div>

            {applyResult ? (
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Latest Upgrade Result" : "최근 업그레이드 결과"}</p>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en
                        ? "Review the prepared release unit and server alignment after the last upgrade apply."
                        : "가장 최근 업그레이드 적용 이후 준비된 릴리스와 서버 정렬 상태를 확인합니다."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${compatibilityTone(stringOf(applyResult.compatibilityClass) || "ADAPTER_SAFE")}`}>
                      {stringOf(applyResult.compatibilityClass) || "ADAPTER_SAFE"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {stringOf(applyResult.releaseUnitId) || "-"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">
                      {en ? "Selection Synced To Prepared Release" : "준비 릴리스 기준으로 선택 동기화"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en
                        ? `The release explorer now follows ${stringOf(applyResult.releaseUnitId) || "-"}. Server detail also follows an aligned server when one is available.`
                        : `${stringOf(applyResult.releaseUnitId) || "-"} 기준으로 릴리스 탐색기가 자동 선택됩니다. 일치 서버가 있으면 서버 상세도 함께 맞춰집니다.`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <MemberButton
                      type="button"
                      variant="secondary"
                      onClick={() => setSelectedReleaseUnitId(stringOf(applyResult.releaseUnitId))}
                    >
                      {en ? "Open Prepared Release" : "준비 릴리스 열기"}
                    </MemberButton>
                    <MemberButton
                      type="button"
                      variant="secondary"
                      disabled={!applyServerAlignment.alignedServers[0]}
                      onClick={() => {
                        const alignedServer = applyServerAlignment.alignedServers[0];
                        if (!alignedServer) {
                          return;
                        }
                        setSelectedReleaseUnitId(stringOf(applyResult.releaseUnitId));
                        setSelectedServerId(stringOf(alignedServer.serverId));
                      }}
                    >
                      {en ? "Open Aligned Server" : "일치 서버 열기"}
                    </MemberButton>
                    <MemberButton
                      type="button"
                      variant="secondary"
                      disabled={!applyReleaseUnitLogHref}
                      onClick={() => {
                        if (!applyReleaseUnitLogHref) {
                          return;
                        }
                        openProjectVersionHref(applyReleaseUnitLogHref);
                      }}
                    >
                      {en ? "Open Release Evidence" : "릴리스 증거 열기"}
                    </MemberButton>
                    <MemberButton
                      type="button"
                      variant="secondary"
                      disabled={!applyRuntimePackageLogHref}
                      onClick={() => {
                        if (!applyRuntimePackageLogHref) {
                          return;
                        }
                        openProjectVersionHref(applyRuntimePackageLogHref);
                      }}
                    >
                      {en ? "Open Runtime Package Evidence" : "런타임 패키지 증거 열기"}
                    </MemberButton>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Runtime Package" : "런타임 패키지"}</p>
                    <p className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(applyResult.runtimePackageId) || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Rollback Target" : "롤백 기준 릴리스"}</p>
                    <p className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(applyResult.rollbackTargetReleaseId) || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Deploy Ready" : "배포 가능"}</p>
                    <p className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{truthLabel(applyResult.deployReadyYn, en)}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Applied Artifacts" : "적용 아티팩트 수"}</p>
                    <p className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{String(Array.isArray(applyResult.appliedArtifactSet) ? applyResult.appliedArtifactSet.length : 0)}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Servers On Prepared Release" : "준비 릴리스 일치 서버"}</p>
                    <p className="mt-2 font-bold text-emerald-700">{String(applyServerAlignment.alignedCount)}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Servers In Drift" : "불일치 서버"}</p>
                    <p className="mt-2 font-bold text-amber-700">{String(applyServerAlignment.driftCount)}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Servers Requiring Review" : "점검 필요 서버"}</p>
                    <p className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{String(applyServerAlignment.reviewCount)}</p>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white">
                  <AdminTable className="min-w-[720px]">
                    <thead>
                      <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
                        <th className="px-4 py-3">{en ? "Artifact" : "아티팩트"}</th>
                        <th className="px-4 py-3">{en ? "Applied Version" : "적용 버전"}</th>
                        <th className="px-4 py-3">{en ? "Rollback Target Version" : "롤백 대상 버전"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!Array.isArray(applyResult.appliedArtifactSet) || applyResult.appliedArtifactSet.length === 0 ? (
                        <tr>
                          <td className="px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={3}>
                            {en ? "No applied artifacts were reported by the upgrade response." : "업그레이드 응답에 적용 artifact가 보고되지 않았습니다."}
                          </td>
                        </tr>
                      ) : applyResult.appliedArtifactSet.map((item, index) => (
                        <tr className="border-b border-[var(--kr-gov-border-light)] bg-white" key={`${stringOf(item.artifactId)}-${stringOf(item.artifactVersion)}-${index}`}>
                          <td className="px-4 py-3 text-sm font-semibold">{stringOf(item.artifactId) || "-"}</td>
                          <td className="px-4 py-3 text-sm">{stringOf(item.artifactVersion) || "-"}</td>
                          <td className="px-4 py-3 text-sm">{stringOf(item.rollbackTargetVersion) || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </AdminTable>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Aligned Servers" : "일치 서버"}</p>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{String(applyServerAlignment.alignedCount)}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {applyServerAlignment.alignedServers.length === 0 ? (
                        <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No servers are currently aligned to the prepared release." : "현재 준비된 릴리스와 일치하는 서버가 없습니다."}</p>
                      ) : applyServerAlignment.alignedServers.map((item, index) => (
                        <button
                          key={`${stringOf(item.serverId)}-apply-aligned-${index}`}
                          className="flex w-full items-center justify-between rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-3 py-3 text-left"
                          type="button"
                          onClick={() => {
                            setSelectedServerId(stringOf(item.serverId));
                            setSelectedReleaseUnitId(stringOf(applyResult?.releaseUnitId));
                          }}
                        >
                          <span className="text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(item.serverId) || "-"}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${serverHealthTone(stringOf(item.healthStatus))}`}>{stringOf(item.healthStatus) || "-"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Drift Servers" : "불일치 서버"}</p>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">{String(applyServerAlignment.driftCount)}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {applyServerAlignment.driftServers.length === 0 ? (
                        <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No drift servers were detected for this prepared release." : "이번 준비 릴리스 기준 불일치 서버가 감지되지 않았습니다."}</p>
                      ) : applyServerAlignment.driftServers.map((item, index) => (
                        <button
                          key={`${stringOf(item.serverId)}-apply-drift-${index}`}
                          className="flex w-full items-center justify-between rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-3 py-3 text-left"
                          type="button"
                          onClick={() => {
                            setSelectedServerId(stringOf(item.serverId));
                            setSelectedReleaseUnitId(stringOf(item.activeReleaseUnitId));
                          }}
                        >
                          <div>
                            <p className="text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(item.serverId) || "-"}</p>
                            <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                              {en ? "Active release" : "현재 활성 릴리스"}: {stringOf(item.activeReleaseUnitId) || "-"}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${serverHealthTone(stringOf(item.healthStatus))}`}>{stringOf(item.healthStatus) || "-"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ) : null}

            {rollbackResult ? (
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Latest Rollback Result" : "최근 롤백 결과"}</p>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en
                        ? "Review the governed artifact set restored by the last rollback."
                        : "가장 최근 롤백으로 복원된 governed artifact 세트를 확인합니다."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${serverHealthTone(stringOf(rollbackResult.status) || "ROLLED_BACK")}`}>
                      {stringOf(rollbackResult.status) || "ROLLED_BACK"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {stringOf(rollbackResult.rolledBackToReleaseUnitId) || "-"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">
                      {en ? "Selection Synced To Rolled-Back Release" : "롤백 릴리스 기준으로 선택 동기화"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en
                        ? `The release explorer now follows ${stringOf(rollbackResult.rolledBackToReleaseUnitId) || "-"}. Server detail also follows an aligned server when one is available.`
                        : `${stringOf(rollbackResult.rolledBackToReleaseUnitId) || "-"} 기준으로 릴리스 탐색기가 자동 선택됩니다. 일치 서버가 있으면 서버 상세도 함께 맞춰집니다.`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <MemberButton
                      type="button"
                      variant="secondary"
                      onClick={() => setSelectedReleaseUnitId(stringOf(rollbackResult.rolledBackToReleaseUnitId))}
                    >
                      {en ? "Open Rolled-Back Release" : "롤백 릴리스 열기"}
                    </MemberButton>
                    <MemberButton
                      type="button"
                      variant="secondary"
                      disabled={!rollbackServerAlignment.alignedServers[0]}
                      onClick={() => {
                        const alignedServer = rollbackServerAlignment.alignedServers[0];
                        if (!alignedServer) {
                          return;
                        }
                        setSelectedReleaseUnitId(stringOf(rollbackResult.rolledBackToReleaseUnitId));
                        setSelectedServerId(stringOf(alignedServer.serverId));
                      }}
                    >
                      {en ? "Open Aligned Server" : "일치 서버 열기"}
                    </MemberButton>
                    <MemberButton
                      type="button"
                      variant="secondary"
                      disabled={!rollbackDeployTraceHref}
                      onClick={() => {
                        if (!rollbackDeployTraceHref) {
                          return;
                        }
                        openProjectVersionHref(rollbackDeployTraceHref);
                      }}
                    >
                      {en ? "Open Deploy Trace" : "배포 추적 열기"}
                    </MemberButton>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Runtime Package" : "런타임 패키지"}</p>
                    <p className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(rollbackResult.runtimePackageId) || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Deploy Trace" : "배포 추적"}</p>
                    <p className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(rollbackResult.deployTraceId) || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Next Rollback Target" : "다음 롤백 기준"}</p>
                    <p className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(rollbackResult.rollbackTargetReleaseId) || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Restored Artifacts" : "복원 아티팩트 수"}</p>
                    <p className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{String(Array.isArray(rollbackResult.restoredArtifactSet) ? rollbackResult.restoredArtifactSet.length : 0)}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Servers On Rollback Release" : "롤백 릴리스 일치 서버"}</p>
                    <p className="mt-2 font-bold text-emerald-700">{String(rollbackServerAlignment.alignedCount)}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Servers In Drift" : "롤백 후 불일치 서버"}</p>
                    <p className="mt-2 font-bold text-amber-700">{String(rollbackServerAlignment.driftCount)}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Servers Requiring Review" : "점검 필요 서버"}</p>
                    <p className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{String(rollbackServerAlignment.reviewCount)}</p>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white">
                  <AdminTable className="min-w-[720px]">
                    <thead>
                      <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
                        <th className="px-4 py-3">{en ? "Artifact" : "아티팩트"}</th>
                        <th className="px-4 py-3">{en ? "Restored Version" : "복원 버전"}</th>
                        <th className="px-4 py-3">{en ? "Previous Active Version" : "이전 활성 버전"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!Array.isArray(rollbackResult.restoredArtifactSet) || rollbackResult.restoredArtifactSet.length === 0 ? (
                        <tr>
                          <td className="px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={3}>
                            {en ? "No restored artifacts were reported by the rollback response." : "롤백 응답에 복원 artifact가 보고되지 않았습니다."}
                          </td>
                        </tr>
                      ) : rollbackResult.restoredArtifactSet.map((item, index) => (
                        <tr className="border-b border-[var(--kr-gov-border-light)] bg-white" key={`${stringOf(item.artifactId)}-${stringOf(item.artifactVersion)}-${index}`}>
                          <td className="px-4 py-3 text-sm font-semibold">{stringOf(item.artifactId) || "-"}</td>
                          <td className="px-4 py-3 text-sm">{stringOf(item.artifactVersion) || "-"}</td>
                          <td className="px-4 py-3 text-sm">{stringOf(item.rollbackTargetVersion) || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </AdminTable>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Aligned Servers" : "일치 서버"}</p>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{String(rollbackServerAlignment.alignedCount)}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {rollbackServerAlignment.alignedServers.length === 0 ? (
                        <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No servers are currently aligned to the rollback release." : "현재 롤백 릴리스와 일치하는 서버가 없습니다."}</p>
                      ) : rollbackServerAlignment.alignedServers.map((item, index) => (
                        <button
                          key={`${stringOf(item.serverId)}-aligned-${index}`}
                          className="flex w-full items-center justify-between rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-3 py-3 text-left"
                          type="button"
                          onClick={() => {
                            setSelectedServerId(stringOf(item.serverId));
                            setSelectedReleaseUnitId(stringOf(rollbackResult?.rolledBackToReleaseUnitId));
                          }}
                        >
                          <span className="text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(item.serverId) || "-"}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${serverHealthTone(stringOf(item.healthStatus))}`}>{stringOf(item.healthStatus) || "-"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Drift Servers" : "불일치 서버"}</p>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">{String(rollbackServerAlignment.driftCount)}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {rollbackServerAlignment.driftServers.length === 0 ? (
                        <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No drift servers were detected after this rollback." : "이번 롤백 이후 불일치 서버가 감지되지 않았습니다."}</p>
                      ) : rollbackServerAlignment.driftServers.map((item, index) => (
                        <button
                          key={`${stringOf(item.serverId)}-drift-${index}`}
                          className="flex w-full items-center justify-between rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-3 py-3 text-left"
                          type="button"
                          onClick={() => {
                            setSelectedServerId(stringOf(item.serverId));
                            setSelectedReleaseUnitId(stringOf(item.activeReleaseUnitId));
                          }}
                        >
                          <div>
                            <p className="text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(item.serverId) || "-"}</p>
                            <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                              {en ? "Active release" : "현재 활성 릴리스"}: {stringOf(item.activeReleaseUnitId) || "-"}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${serverHealthTone(stringOf(item.healthStatus))}`}>{stringOf(item.healthStatus) || "-"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        </section>
          </>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
