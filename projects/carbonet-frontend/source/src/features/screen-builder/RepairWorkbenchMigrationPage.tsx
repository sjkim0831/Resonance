import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { resolveAuthorityScope } from "../../app/policy/authorityScope";
import { getCurrentRuntimePathname, getCurrentRuntimeSearch } from "../../app/routes/runtime";
import { fetchAuditEvents } from "../../platform/observability/observability";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  fetchParityCompare,
  fetchProjectPipelineStatus,
  fetchRepairApply,
  fetchRepairOpen,
  resolveResonanceProjectId,
  runProjectPipeline,
  type ResonanceParityCompareRow,
  type ResonanceRepairApplyResponse,
  type ResonanceRepairOpenResponse,
  type ResonanceProjectPipelineResponse
} from "../../lib/api/resonanceControlPlane";
import { fetchScreenBuilderPage, fetchScreenBuilderPreview, fetchScreenCommandPage } from "../../lib/api/platform";
import type { ScreenCommandPagePayload } from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { ContextKeyStrip } from "../admin-ui/ContextKeyStrip";
import { buildCurrentRuntimeComparePath, buildScreenBuilderPath } from "./screenBuilderPaths";
import {
  AdminSelect,
  AdminTextarea,
  CopyableCodeBlock,
  GridToolbar,
  KeyValueGridPanel,
  MemberLinkButton,
  MemberPermissionButton,
  PageStatusNotice,
  SummaryMetricCard
} from "../admin-ui/common";
import { resolveRepairWorkbenchContextKeys } from "../admin-ui/contextKeyPresets";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { MemberStateCard } from "../member/sections";
import { resolveScreenBuilderQuery, sortScreenBuilderNodes } from "./shared/screenBuilderUtils";
import { buildScreenBuilderOperatorFlowPaths, buildScreenBuilderOperatorFlowSteps, buildScreenBuilderRouteVerifyCommands } from "./operatorFlow";

type CompareRow = {
  label: string;
  current: string;
  generated: string;
  baseline: string;
  patchTarget: string;
  result: "MATCH" | "MISMATCH" | "GAP";
};

function stringifyValue(value: unknown, empty = "-") {
  const normalized = String(value || "").trim();
  return normalized || empty;
}

function findContextKeyValue(items: Array<{ label: string; value: string }>, label: string, empty = "-") {
  return items.find((item) => item.label === label)?.value || empty;
}

function mapParityRows(rows: ResonanceParityCompareRow[]): CompareRow[] {
  return rows.map((row) => ({
    label: stringifyValue(row.target),
    current: stringifyValue(row.currentRuntime),
    generated: stringifyValue(row.generatedTarget),
    baseline: stringifyValue(row.proposalBaseline),
    patchTarget: stringifyValue(row.patchTarget),
    result: row.result === "MATCH" || row.result === "MISMATCH" || row.result === "GAP" ? row.result : "GAP"
  }));
}

function toneClassName(value: string) {
  if (value === "MATCH" || value === "PASS" || value === "APPLIED") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (value === "GAP" || value === "WARN" || value === "REVIEW_REQUIRED") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-red-100 text-red-700";
}

function toList(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== null && item !== undefined);
  }
  return [];
}

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function deploymentStateTone(value: string) {
  const normalized = value.toUpperCase();
  if (normalized.includes("HEALTHY") || normalized.includes("PROMOTED") || normalized.includes("TARGET") || normalized.includes("ROLLED_BACK")) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (normalized.includes("VALIDATING") || normalized.includes("PENDING") || normalized.includes("SYNCED")) {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-slate-100 text-slate-700";
}

function normalizePipelineRole(value: unknown) {
  const upper = stringifyValue(value, "").toUpperCase();
  if (upper === "ACTIVE" || upper === "MAIN" || upper === "PROD" || upper === "PRIMARY") return "PRIMARY";
  if (upper === "STAGE") return "STAGE";
  if (upper === "PREVIEW") return "PREVIEW";
  return upper;
}

type LoopStatusItem = {
  label: string;
  value: string;
};

function getRepairWorkbenchRoutePath() {
  return getCurrentRuntimePathname();
}

function getRepairWorkbenchSearchParam(name: string) {
  return new URLSearchParams(getCurrentRuntimeSearch()).get(name);
}

function getRepairWorkbenchProjectId() {
  return getRepairWorkbenchSearchParam("projectId");
}

function getRepairWorkbenchSnapshotVersionId() {
  return getRepairWorkbenchSearchParam("snapshotVersionId");
}

function buildRepairContextStripItems(
  baseItems: Array<{ label: string; value: string }>,
  rows: CompareRow[],
  releaseUnitId: string
) {
  const items = [...baseItems];
  const trackedTargets = new Set(items.map((item) => item.label));
  const compareTargets = [
    { label: "Template Line", rowLabel: "Template Line" },
    { label: "Screen Family Rule", rowLabel: "Screen Family Rule" }
  ];

  compareTargets.forEach(({ label, rowLabel }) => {
    const row = rows.find((candidate) => candidate.label === rowLabel);
    if (!row || row.result === "MATCH") {
      return;
    }
    const currentLabel = `Current ${label}`;
    const targetLabel = `Target ${label}`;
    if (!trackedTargets.has(currentLabel)) {
      items.push({ label: currentLabel, value: row.current });
      trackedTargets.add(currentLabel);
    }
    if (!trackedTargets.has(targetLabel)) {
      items.push({ label: targetLabel, value: row.patchTarget });
      trackedTargets.add(targetLabel);
    }
  });

  if (releaseUnitId && releaseUnitId !== "-" && !trackedTargets.has("Release Unit")) {
    items.push({ label: "Release Unit", value: releaseUnitId });
  }

  return items;
}

function normalizeToken(value: string, fallback: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function buildDeployEvidence(options: {
  releaseUnitId: string;
  selectedScreenId: string;
  ownerLane: string;
  runtimeEvidence?: Record<string, unknown> | null;
  artifactEvidence?: Record<string, unknown> | null;
}) {
  const runtimeEvidence = options.runtimeEvidence || {};
  const artifactEvidence = options.artifactEvidence || {};
  const releaseUnitId = stringifyValue(artifactEvidence.releaseUnitId || options.releaseUnitId);
  const selectedScreenToken = normalizeToken(options.selectedScreenId, "screen-runtime");

  return {
    releaseUnitId,
    runtimePackageId: stringifyValue(artifactEvidence.runtimePackageId || runtimeEvidence.runtimePackageId, `runtime-package-${selectedScreenToken}`),
    deployTraceId: stringifyValue(artifactEvidence.deployTraceId || runtimeEvidence.deployTraceId, `deploy-trace-${normalizeToken(releaseUnitId, "release-unit")}-${selectedScreenToken}`),
    ownerLane: stringifyValue(runtimeEvidence.ownerLane, options.ownerLane),
    rollbackAnchorYn: stringifyValue(runtimeEvidence.rollbackAnchorYn, "Y")
  };
}

export function RepairWorkbenchMigrationPage() {
  const en = isEnglish();
  const sessionState = useFrontendSession();
  const query = useMemo(() => resolveScreenBuilderQuery({ get: getRepairWorkbenchSearchParam }), []);
  const commandState = useAsyncValue<ScreenCommandPagePayload>(
    () => (query.pageId ? fetchScreenCommandPage(query.pageId) : Promise.resolve({ selectedPageId: "", pages: [], page: {} as ScreenCommandPagePayload["page"] })),
    [query.pageId],
    { enabled: Boolean(query.pageId) }
  );
  const repairWorkbenchAuthority = useMemo(() => resolveAuthorityScope({
    scopeName: "repair-workbench",
    routePath: getRepairWorkbenchRoutePath(),
    session: sessionState.value,
    menuCode: commandState.value?.page?.menuPermission?.menuCode || query.menuCode,
    requiredViewFeatureCode: commandState.value?.page?.menuPermission?.requiredViewFeatureCode,
    featureCodes: commandState.value?.page?.menuPermission?.featureCodes,
    featureRows: commandState.value?.page?.menuPermission?.featureRows
  }), [
    commandState.value?.page?.menuPermission?.featureCodes,
    commandState.value?.page?.menuPermission?.featureRows,
    commandState.value?.page?.menuPermission?.menuCode,
    commandState.value?.page?.menuPermission?.requiredViewFeatureCode,
    query.menuCode,
    sessionState.value
  ]);
  const pagePermissionDenied = !sessionState.loading && !commandState.loading && !repairWorkbenchAuthority.entryAllowed;
  const pageQueryEnabled = (!query.pageId || !commandState.loading) && repairWorkbenchAuthority.entryAllowed;
  const snapshotVersionId = getRepairWorkbenchSnapshotVersionId() || "";
  const pageState = useAsyncValue(
    () => fetchScreenBuilderPage(query),
    [query.menuCode, query.pageId, query.menuTitle, query.menuUrl],
    { enabled: pageQueryEnabled }
  );
  const page = pageState.value;
  const focusedSnapshot = useMemo(
    () => (Array.isArray(page?.versionHistory)
      ? page.versionHistory.find((version) => String(version?.versionId || "") === snapshotVersionId) || null
      : null),
    [page?.versionHistory, snapshotVersionId]
  );
  const publishedPreviewState = useAsyncValue(
    () => fetchScreenBuilderPreview({ ...query, versionStatus: "PUBLISHED" }),
    [query.menuCode, query.pageId, query.menuTitle, query.menuUrl, page?.publishedVersionId || ""],
    { enabled: pageQueryEnabled && Boolean(page?.publishedVersionId) }
  );
  const currentPreviewState = useAsyncValue(
    () => fetchScreenBuilderPreview(query),
    [query.menuCode, query.pageId, query.menuTitle, query.menuUrl, page?.versionId || ""],
    { enabled: pageQueryEnabled && Boolean(query.menuCode || query.pageId) }
  );
  const auditState = useAsyncValue(
    () => fetchAuditEvents({ menuCode: query.menuCode, pageId: query.pageId, pageSize: 8 }),
    [query.menuCode, query.pageId],
    { enabled: pageQueryEnabled && Boolean(query.menuCode || query.pageId) }
  );

  const compareContextKeys = useMemo(() => resolveRepairWorkbenchContextKeys({
    menuUrl: page?.menuUrl || query.menuUrl,
    templateType: currentPreviewState.value?.templateType || publishedPreviewState.value?.templateType || page?.templateType
  }), [currentPreviewState.value?.templateType, page?.menuUrl, page?.templateType, publishedPreviewState.value?.templateType, query.menuUrl]);
  const resonanceProjectId = useMemo(() => resolveResonanceProjectId(getRepairWorkbenchProjectId() || ""), []);
  const guidedStateId = findContextKeyValue(compareContextKeys, "Guided State");
  const templateLineId = findContextKeyValue(compareContextKeys, "Template Line");
  const screenFamilyRuleId = findContextKeyValue(compareContextKeys, "Screen Family Rule");
  const ownerLane = findContextKeyValue(compareContextKeys, "Owner Lane");
  const selectedScreenId = page?.pageId || query.pageId || query.menuCode || "screen-runtime";
  const artifactEvidence = publishedPreviewState.value?.artifactEvidence || currentPreviewState.value?.artifactEvidence || page?.artifactEvidence || null;
  const releaseUnitId = stringifyValue(page?.releaseUnitId || publishedPreviewState.value?.releaseUnitId || currentPreviewState.value?.releaseUnitId || page?.publishedVersionId || page?.versionId || selectedScreenId);
  const generatedNodes = useMemo(() => sortScreenBuilderNodes(currentPreviewState.value?.nodes || page?.nodes || []), [currentPreviewState.value?.nodes, page?.nodes]);
  const currentNodes = useMemo(() => sortScreenBuilderNodes(publishedPreviewState.value?.nodes || []), [publishedPreviewState.value?.nodes]);
  const generatedEventCount = currentPreviewState.value?.events?.length || page?.events?.length || 0;
  const currentEventCount = publishedPreviewState.value?.events?.length || 0;
  const compareState = useAsyncValue(
    () => fetchParityCompare({
      projectId: resonanceProjectId,
      guidedStateId,
      templateLineId,
      screenFamilyRuleId,
      ownerLane,
      selectedScreenId,
      releaseUnitId,
      compareBaseline: "CURRENT_RUNTIME",
      requestedBy: "repair-workbench-ui",
      requestedByType: "ADMIN_UI"
    }),
    [guidedStateId, ownerLane, releaseUnitId, resonanceProjectId, screenFamilyRuleId, selectedScreenId, templateLineId],
    { enabled: pageQueryEnabled && Boolean(guidedStateId && templateLineId && screenFamilyRuleId && ownerLane && selectedScreenId) }
  );

  const compareRows = compareState.value?.compareTargetSet?.length ? mapParityRows(compareState.value.compareTargetSet) : [];
  const repairContextStripItems = useMemo(
    () => buildRepairContextStripItems(compareContextKeys, compareRows, releaseUnitId),
    [compareContextKeys, compareRows, releaseUnitId]
  );
  const fallbackCandidates = compareRows.filter((row) => row.result !== "MATCH").map((row) => row.label.toLowerCase().replace(/\s+/g, "-"));
  const selectedElementSet = compareState.value?.repairCandidateSet?.length ? compareState.value.repairCandidateSet : fallbackCandidates;
  const reuseRecommendationSet = [
    "common-bottom-action-bar-v2",
    "help-anchor-bundle-join-v2",
    "spacing-profile:public-form-comfortable:v2"
  ];
  const requiredContractSet = [
    "page-design.json",
    "page-assembly.json",
    "backend-chain-manifest"
  ];
  const builderInput = {
    builderId: page?.builderId || selectedScreenId,
    draftVersionId: page?.versionId || "-",
    menuCode: page?.menuCode || query.menuCode || selectedScreenId,
    pageId: selectedScreenId,
    menuUrl: page?.menuUrl || query.menuUrl || "-"
  };
  const runtimeEvidence = {
    publishedVersionId: stringifyValue(artifactEvidence?.publishedVersionId, page?.publishedVersionId || "-"),
    currentRuntimeTraceId: compareState.value?.traceId || "runtime-compare-trace",
    currentNodeCount: currentNodes.length,
    currentEventCount
  };
  const latestPublishAudit = (auditState.value?.items || []).find((row) => String(row.actionCode || "").includes("PUBLISH")) || null;
  const [openingRepair, setOpeningRepair] = useState(false);
  const [repairOpenResponse, setRepairOpenResponse] = useState<ResonanceRepairOpenResponse | null>(null);
  const [openError, setOpenError] = useState("");
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState("");
  const [applyingRepair, setApplyingRepair] = useState(false);
  const [repairApplyResponse, setRepairApplyResponse] = useState<ResonanceRepairApplyResponse | null>(null);
  const [projectPipeline, setProjectPipeline] = useState<ResonanceProjectPipelineResponse | null>(null);
  const [pipelineRunLoading, setPipelineRunLoading] = useState(false);
  const [pipelineRunError, setPipelineRunError] = useState("");
  const [pipelineRunSuccess, setPipelineRunSuccess] = useState("");
  const [publishMode, setPublishMode] = useState("REVIEW_READY");
  const [changeSummary, setChangeSummary] = useState(
    "Close runtime compare blockers by aligning governed action layout, help anchors, and builder/runtime evidence before parity recheck."
  );
  const pipelineStatusState = useAsyncValue(
    () => fetchProjectPipelineStatus({ projectId: resonanceProjectId }),
    [resonanceProjectId],
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
  const previewRuntimeEvidence = ((currentPreviewState.value as unknown as { runtimeEvidence?: Record<string, unknown> } | undefined)?.runtimeEvidence) || null;
  const repairRuntimeEvidence = (repairOpenResponse?.runtimeEvidence || repairApplyResponse?.runtimeEvidence || previewRuntimeEvidence || null) as Record<string, unknown> | null;
  const deployEvidence = useMemo(
    () => buildDeployEvidence({
      releaseUnitId,
      selectedScreenId,
      ownerLane,
      runtimeEvidence: repairRuntimeEvidence,
      artifactEvidence
    }),
    [artifactEvidence, ownerLane, releaseUnitId, repairRuntimeEvidence, selectedScreenId]
  );
  const operatorFlowQuery = useMemo(() => ({
    menuCode: page?.menuCode || query.menuCode,
    pageId: page?.pageId || query.pageId,
    menuTitle: page?.menuTitle || query.menuTitle,
    menuUrl: page?.menuUrl || query.menuUrl,
    snapshotVersionId,
    projectId: resonanceProjectId
  }), [page?.menuCode, page?.menuTitle, page?.menuUrl, page?.pageId, query.menuCode, query.menuTitle, query.menuUrl, query.pageId, resonanceProjectId, snapshotVersionId]);
  const operatorFlowPaths = useMemo(() => buildScreenBuilderOperatorFlowPaths(operatorFlowQuery), [operatorFlowQuery]);
  const operatorFlowSteps = useMemo(() => buildScreenBuilderOperatorFlowSteps(operatorFlowQuery), [operatorFlowQuery]);
  const routeVerifyCommands = useMemo(() => buildScreenBuilderRouteVerifyCommands(operatorFlowQuery), [operatorFlowQuery]);
  const snapshotMatchesPublished = Boolean(snapshotVersionId && snapshotVersionId === String(page?.publishedVersionId || ""));
  const snapshotMatchesDraft = Boolean(snapshotVersionId && snapshotVersionId === String(page?.versionId || ""));
  const snapshotAnchorState = !snapshotVersionId
    ? (en ? "CURRENT" : "현재값")
    : (!focusedSnapshot
      ? (en ? "MISSING" : "누락")
      : (snapshotMatchesPublished ? (en ? "PUBLISHED" : "발행본") : (snapshotMatchesDraft ? (en ? "DRAFT" : "초안") : (en ? "MANUAL" : "수동"))));
  const rollbackSnapshotFocusMode = snapshotVersionId
    ? (snapshotMatchesPublished
      ? (en ? "published rollback anchor" : "발행 롤백 앵커")
      : (snapshotMatchesDraft ? (en ? "draft rollback anchor" : "초안 롤백 앵커") : (en ? "manual snapshot rollback" : "수동 스냅샷 롤백")))
    : (en ? "latest rollback scope" : "최신 롤백 범위");

  useEffect(() => {
    logGovernanceScope("PAGE", "repair-workbench", {
      route: getRepairWorkbenchRoutePath(),
      language: en ? "en" : "ko",
      selectedScreenId,
      releaseUnitId,
      compareRowCount: compareRows.length,
      selectedElementCount: selectedElementSet.length,
      openingRepair,
      applyingRepair
    });
    logGovernanceScope("COMPONENT", "repair-workbench-compare", {
      compareRowCount: compareRows.length,
      auditCount: (auditState.value?.items || []).length,
      latestTrace: compareState.value?.traceId || "-"
    });
  }, [
    (auditState.value?.items || []).length,
    applyingRepair,
    compareRows.length,
    compareState.value?.traceId,
    en,
    openingRepair,
    releaseUnitId,
    selectedElementSet.length,
    selectedScreenId
  ]);

  async function handleOpenRepair() {
    if (!repairWorkbenchAuthority.allowsAction("execute")) {
      repairWorkbenchAuthority.logAuthorityDenied("execute", { component: "repair-workbench-open-repair", menuCode: page?.menuCode || query.menuCode });
      setOpenError(repairWorkbenchAuthority.getActionReason("execute", en));
      return;
    }
    logGovernanceScope("ACTION", "repair-workbench-open", {
      selectedScreenId,
      releaseUnitId,
      selectedElementCount: selectedElementSet.length
    });
    setOpeningRepair(true);
    setOpenError("");
    setApplySuccess("");
    try {
      const response = await fetchRepairOpen({
        projectId: resonanceProjectId,
        releaseUnitId,
        guidedStateId,
        templateLineId,
        screenFamilyRuleId,
        ownerLane,
        selectedScreenId,
        builderInput,
        runtimeEvidence,
        selectedElementSet,
        compareBaseline: compareState.value?.compareBaseline || "CURRENT_RUNTIME",
        reasonCode: compareState.value?.blockerSet?.length ? "PARITY_GAP" : "RUNTIME_DRIFT",
        existingAssetReuseSet: reuseRecommendationSet,
        requestedBy: "repair-workbench-ui",
        requestedByType: "ADMIN_UI",
        requestNote: changeSummary
      });
      setRepairOpenResponse(response);
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : String(error));
    } finally {
      setOpeningRepair(false);
    }
  }

  async function handleApplyRepair() {
    if (!repairOpenResponse) {
      return;
    }
    if (!repairWorkbenchAuthority.allowsAction("execute")) {
      repairWorkbenchAuthority.logAuthorityDenied("execute", { component: "repair-workbench-apply-repair", menuCode: page?.menuCode || query.menuCode });
      setApplyError(repairWorkbenchAuthority.getActionReason("execute", en));
      return;
    }
    logGovernanceScope("ACTION", "repair-workbench-apply", {
      selectedScreenId,
      releaseUnitId,
      publishMode
    });
    setApplyingRepair(true);
    setApplyError("");
    setApplySuccess("");
    try {
      const response = await fetchRepairApply({
        repairSessionId: repairOpenResponse.repairSessionId,
        projectId: repairOpenResponse.projectId,
        releaseUnitId: repairOpenResponse.releaseUnitId,
        guidedStateId: repairOpenResponse.guidedStateId,
        templateLineId: repairOpenResponse.templateLineId,
        screenFamilyRuleId: repairOpenResponse.screenFamilyRuleId,
        ownerLane: repairOpenResponse.ownerLane,
        selectedScreenId: repairOpenResponse.selectedScreenId,
        selectedElementSet: repairOpenResponse.selectedElementSet,
        compareBaseline: repairOpenResponse.compareBaseline,
        builderInput: toRecord(repairOpenResponse.builderInput),
        runtimeEvidence: toRecord(repairOpenResponse.runtimeEvidence),
        updatedAssetSet: [
          `page-design:${selectedScreenId}:v4`,
          `page-assembly:${selectedScreenId}:v4`
        ],
        updatedBindingSet: [
          `event-binding:${selectedScreenId}:v2`,
          `function-binding:${selectedScreenId}:v2`
        ],
        updatedThemeOrLayoutSet: [
          "action-layout:detail-footer-standard:v2",
          "help-anchor-bundle:join-v2"
        ],
        sqlDraftSet: [],
        publishMode,
        requestedBy: "repair-workbench-ui",
        requestedByType: "ADMIN_UI",
        changeSummary
      });
      setRepairApplyResponse(response);
      setApplySuccess(response.status);
      await handleRunProjectPipeline(response);
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : String(error));
    } finally {
      setApplyingRepair(false);
    }
  }

  const blockingGapSet = repairOpenResponse?.blockingGapSet || compareState.value?.blockerSet || [];
  const mismatchCount = compareRows.filter((row) => row.result === "MISMATCH").length;
  const latestTrace = repairApplyResponse?.traceId || repairOpenResponse?.traceId || compareState.value?.traceId || "-";
  const parityRecheckRequired = repairApplyResponse?.parityRecheckRequiredYn ?? true;
  const uniformityRecheckRequired = repairApplyResponse?.uniformityRecheckRequiredYn ?? true;
  const smokeRequired = repairApplyResponse?.smokeRequiredYn ?? (publishMode !== "DRAFT_ONLY");
  const closureChecklistItems = [
    { label: en ? "Snapshot Anchor State" : "스냅샷 앵커 상태", value: snapshotAnchorState },
    { label: en ? "Blocking Gaps" : "차단 gap", value: blockingGapSet.length ? blockingGapSet.join(", ") : (en ? "0 open blockers" : "열린 차단 항목 0건") },
    { label: en ? "Selected Repair Targets" : "선택 복구 대상", value: selectedElementSet.join(", ") || "-" },
    { label: en ? "Required Contracts" : "필수 계약", value: (repairOpenResponse?.requiredContractSet || requiredContractSet).join(", ") },
    { label: en ? "Reuse Recommendation" : "재사용 권장", value: (repairOpenResponse?.reuseRecommendationSet || reuseRecommendationSet).join(", ") },
    { label: en ? "Parity Recheck" : "정합성 재검증", value: String(parityRecheckRequired) },
    { label: en ? "Uniformity Recheck" : "일관성 재검증", value: String(uniformityRecheckRequired) },
    { label: en ? "Smoke Required" : "스모크 필요 여부", value: String(smokeRequired) },
    { label: en ? "Latest Publish Evidence" : "최근 발행 증거", value: latestPublishAudit ? `${String(latestPublishAudit.actionCode || "-")} / ${String(latestPublishAudit.createdAt || "-")}` : "-" },
    { label: en ? "Closure Gate" : "종료 게이트", value: repairApplyResponse?.status ? (smokeRequired ? "READY_FOR_SMOKE" : "READY_FOR_HANDOFF") : "REPAIR_PENDING" }
  ];
  const handoffReady = Boolean(repairApplyResponse?.status) && blockingGapSet.length === 0 && !parityRecheckRequired && !uniformityRecheckRequired && !smokeRequired;
  const handoffStatus = handoffReady ? "HANDOFF READY" : "IN_PROGRESS";
  const handoffNote = handoffReady
    ? "HANDOFF READY: 01 may continue from parity, compare, repair, and verification outputs cross-checked against 04 builder inputs, 05 frontend runtime results, and 08 deploy evidence; blocker count is 0 for current verification scope."
    : `IN_PROGRESS: 09 verification scope still requires ${[
      blockingGapSet.length ? `${blockingGapSet.length} blocker(s)` : "",
      parityRecheckRequired ? "parity recheck" : "",
      uniformityRecheckRequired ? "uniformity recheck" : "",
      smokeRequired ? "smoke verification" : ""
    ].filter(Boolean).join(", ")}.`;
  const crossLaneEvidenceItems = [
    { label: en ? "04 Builder Input" : "04 빌더 입력", value: `${builderInput.builderId} / ${builderInput.draftVersionId}` },
    { label: en ? "05 Runtime Result" : "05 런타임 결과", value: `${stringifyValue(runtimeEvidence.publishedVersionId)} / nodes ${runtimeEvidence.currentNodeCount} / events ${runtimeEvidence.currentEventCount}` },
    { label: en ? "06 Compare Contract" : "06 비교 계약", value: `${compareState.value?.traceId || "-"} / ${compareState.value?.compareBaseline || "CURRENT_RUNTIME"}` },
    { label: en ? "08 Release Evidence" : "08 릴리즈 증거", value: `${deployEvidence.releaseUnitId} / ${deployEvidence.runtimePackageId} / ${deployEvidence.deployTraceId}` },
    { label: en ? "Owner Lane" : "소유 레인", value: ownerLane },
    { label: en ? "08 Deploy Owner Lane" : "08 배포 소유 레인", value: deployEvidence.ownerLane },
    { label: en ? "Selected Screen" : "선택 화면", value: selectedScreenId }
  ];
  const handoffChecklistItems = [
    { label: en ? "Snapshot Anchor State" : "스냅샷 앵커 상태", value: snapshotAnchorState },
    { label: en ? "Lane Status" : "레인 상태", value: handoffStatus },
    { label: en ? "Open Blockers" : "열린 차단 항목", value: String(blockingGapSet.length) },
    { label: en ? "Parity Recheck Pending" : "정합성 재검증 대기", value: String(parityRecheckRequired) },
    { label: en ? "Uniformity Recheck Pending" : "일관성 재검증 대기", value: String(uniformityRecheckRequired) },
    { label: en ? "Smoke Pending" : "스모크 대기", value: String(smokeRequired) },
    { label: "ownerLane", value: ownerLane },
    { label: "runtimePackageId", value: deployEvidence.runtimePackageId },
    { label: "deployTraceId", value: deployEvidence.deployTraceId },
    { label: "rollbackAnchorYn", value: deployEvidence.rollbackAnchorYn },
    { label: "deployEvidence.ownerLane", value: deployEvidence.ownerLane },
    { label: en ? "Latest Trace" : "최신 추적", value: latestTrace }
  ];
  const lastUnfinishedRepairItem = blockingGapSet[0]
    || (parityRecheckRequired ? "PARITY_RECHECK" : "")
    || (uniformityRecheckRequired ? "UNIFORMITY_RECHECK" : "")
    || (smokeRequired ? "SMOKE_VERIFICATION" : "")
    || "";
  const loopStatusItems: LoopStatusItem[] = [
    { label: en ? "Loop Cadence" : "루프 주기", value: en ? "60 seconds" : "60초" },
    {
      label: en ? "Loop Mode" : "루프 모드",
      value: handoffReady ? "HANDOFF_MONITOR" : (lastUnfinishedRepairItem ? "CONTINUE_UNFINISHED" : "RERUN_SCOPE")
    },
    {
      label: en ? "Last Unfinished Scope" : "마지막 미완료 범위",
      value: handoffReady ? (en ? "handoff receipt confirmation" : "인계 수신 확인") : (lastUnfinishedRepairItem || "-")
    },
    {
      label: en ? "Recovery Order" : "복구 순서",
      value: en
        ? "session alive -> recover last unfinished repair item -> continue parity/uniformity/smoke gates -> rerun linked verify scope"
        : "세션 생존 확인 -> 마지막 미완료 repair 항목 복구 -> parity/uniformity/smoke 게이트 이어서 진행 -> 연결된 verify 범위 재실행"
    },
    {
      label: en ? "Next Recheck Entry" : "다음 재점검 시작점",
      value: lastUnfinishedRepairItem || latestTrace
    },
    {
      label: en ? "Stop Condition" : "중지 조건",
      value: en ? "operator stop, DONE, BLOCKED, or ownership change" : "운영자 중지, DONE, BLOCKED, 또는 소유 범위 변경"
    }
  ];
  const pipelineValidatorRows = toList(projectPipeline?.validatorCheckSet);
  const pipelineStageRows = toList(projectPipeline?.stageSet);
  const pipelineArtifactRows = toList(projectPipeline?.artifactRegistryEntrySet);
  const pipelineInstallableProduct = toRecord(projectPipeline?.installableProduct);
  const pipelineDeployContract = toRecord(projectPipeline?.deployContract);
  const pipelineDeploymentRoutes = toList(pipelineDeployContract.deploymentRouteSet);
  const pipelineArtifactLineage = toRecord(projectPipeline?.artifactLineage);
  const pipelineRollbackPlan = toRecord(projectPipeline?.rollbackPlan);
  const pipelineServerStateRows = toList(projectPipeline?.serverStateSet);
  const repairDeployContract = toRecord(repairApplyResponse?.deployContract || repairOpenResponse?.deployContract);
  const repairDeploymentRoutes = toList(repairDeployContract.deploymentRouteSet);
  const repairServerStateRows = toList(repairApplyResponse?.serverStateSet || repairOpenResponse?.serverStateSet);
  const repairPromotionSummary = useMemo(() => {
    const counts = new Map<string, number>();
    repairServerStateRows.forEach((item) => {
      const promotionState = stringifyValue(toRecord(item).promotionState, "UNKNOWN");
      counts.set(promotionState, (counts.get(promotionState) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([state, count]) => `${state} ${count}`).join(" / ");
  }, [repairServerStateRows]);
  const repairPendingCount = useMemo(
    () => repairServerStateRows.filter((item) => {
      const promotionState = stringifyValue(toRecord(item).promotionState).toUpperCase();
      return promotionState.includes("PENDING") || promotionState.includes("TARGET");
    }).length,
    [repairServerStateRows]
  );
  const repairPromotedCount = useMemo(
    () => repairServerStateRows.filter((item) => stringifyValue(toRecord(item).promotionState).toUpperCase().includes("PROMOTED")).length,
    [repairServerStateRows]
  );
  const candidatePrimaryRoute = useMemo(
    () => repairDeploymentRoutes.find((item) => normalizePipelineRole(toRecord(item).serverRole) === "PRIMARY"),
    [repairDeploymentRoutes]
  );

  async function handleRunProjectPipeline(repairCandidate?: ResonanceRepairApplyResponse | null) {
    if (!repairWorkbenchAuthority.allowsAction("execute")) {
      repairWorkbenchAuthority.logAuthorityDenied("execute", { component: "repair-workbench-run-pipeline", menuCode: page?.menuCode || query.menuCode });
      setPipelineRunError(repairWorkbenchAuthority.getActionReason("execute", en));
      return;
    }
    setPipelineRunLoading(true);
    setPipelineRunError("");
    setPipelineRunSuccess("");
    try {
      const candidateDeployContract = toRecord(repairCandidate?.deployContract);
      const candidateReleaseUnitId = stringifyValue(repairCandidate?.updatedReleaseCandidateId, "");
      const candidateRuntimePackageId = stringifyValue(repairCandidate?.candidateRuntimePackageId, "");
      const response = await runProjectPipeline({
        projectId: resonanceProjectId,
        scenarioId: guidedStateId !== "-" ? guidedStateId : undefined,
        guidedStateId: guidedStateId !== "-" ? guidedStateId : undefined,
        templateLineId: templateLineId !== "-" ? templateLineId : undefined,
        screenFamilyRuleId: screenFamilyRuleId !== "-" ? screenFamilyRuleId : undefined,
        ownerLane: ownerLane !== "-" ? ownerLane : undefined,
        menuRoot: builderInput.menuCode || selectedScreenId,
        runtimeClass: selectedScreenId,
        menuScope: stringifyValue(page?.authorityProfile?.scopePolicy, "ADMIN"),
        releaseUnitId: candidateReleaseUnitId || undefined,
        runtimePackageId: candidateRuntimePackageId || undefined,
        releaseUnitPrefix: "release-unit",
        runtimePackagePrefix: "runtime-package",
        artifactTargetSystem: "carbonet-general",
        deploymentTarget: stringifyValue(candidateDeployContract.deploymentTarget, publishMode === "PUBLISH_READY" ? "ops-runtime" : "ops-review-runtime"),
        operator: "repair-workbench-ui"
      });
      setProjectPipeline(response);
      setPipelineRunSuccess(repairCandidate
        ? (en ? "Repair candidate was handed off into project pipeline." : "repair candidate를 project pipeline으로 인계했습니다.")
        : (en ? "Project pipeline run recorded from repair workbench." : "복구 워크벤치에서 프로젝트 파이프라인 실행 결과를 기록했습니다."));
      pipelineStatusState.setError("");
    } catch (error) {
      setPipelineRunError(error instanceof Error ? error.message : (en ? "Failed to run project pipeline." : "프로젝트 파이프라인 실행에 실패했습니다."));
    } finally {
      setPipelineRunLoading(false);
    }
  }

  async function handleRefreshProjectPipeline() {
    if (!repairWorkbenchAuthority.allowsAction("query")) {
      repairWorkbenchAuthority.logAuthorityDenied("query", { component: "repair-workbench-refresh-pipeline", menuCode: page?.menuCode || query.menuCode });
      setPipelineRunError(repairWorkbenchAuthority.getActionReason("query", en));
      return;
    }
    setPipelineRunSuccess("");
    await pipelineStatusState.reload();
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Screen Builder" : "화면 빌더", href: buildScreenBuilderPath() },
        { label: en ? "Rollback History Console" : "롤백 이력 콘솔" }
      ]}
      title={en ? "Rollback History Console" : "롤백 이력 콘솔"}
      subtitle={en ? "Carry validator blockers into governed repair, rollback, and handoff flows without losing builder/runtime identity." : "검증 차단 항목을 빌더/런타임 식별 키를 유지한 채 governed 복구, 롤백, 인계 흐름으로 넘깁니다."}
      contextStrip={<ContextKeyStrip items={repairContextStripItems} />}
      loading={(commandState.loading && !commandState.value) || (pageState.loading && !page) || (currentPreviewState.loading && !currentPreviewState.value)}
      loadingLabel={en ? "Loading repair workbench..." : "복구 워크벤치를 불러오는 중입니다."}
    >
      {commandState.error || pageState.error || currentPreviewState.error || publishedPreviewState.error || compareState.error ? (
        <PageStatusNotice tone="error">
          {commandState.error || pageState.error || currentPreviewState.error || publishedPreviewState.error || compareState.error}
        </PageStatusNotice>
      ) : null}
      {pipelineRunError ? <PageStatusNotice tone="error">{pipelineRunError}</PageStatusNotice> : null}
      {snapshotVersionId ? (
        <PageStatusNotice tone="success">
          {en ? `Snapshot focus: ${snapshotVersionId}` : `현재 검증 스냅샷: ${snapshotVersionId}`}
        </PageStatusNotice>
      ) : null}
      {snapshotVersionId && !focusedSnapshot ? (
        <PageStatusNotice tone="warning">
          {en
            ? "The focused snapshot is missing from the current snapshot registry. Keep rollback evidence in review mode until the snapshot record is restored."
            : "현재 스냅샷 레지스트리에서 포커스 스냅샷을 찾지 못했습니다. 스냅샷 레코드가 복구될 때까지 롤백 증거를 검토 모드로 유지해야 합니다."}
        </PageStatusNotice>
      ) : null}
      {snapshotVersionId && !snapshotMatchesPublished && !snapshotMatchesDraft ? (
        <PageStatusNotice tone="warning">
          {en
            ? "Rollback evidence is anchored to a snapshot outside the current draft/published pair. Keep this session in manual snapshot rollback mode until the anchor matches a governed version."
            : "현재 롤백 증거는 최신 초안/발행본 쌍 밖의 스냅샷을 기준으로 잡혀 있습니다. governed 버전과 일치할 때까지 수동 스냅샷 롤백 모드로 유지해야 합니다."}
        </PageStatusNotice>
      ) : null}
      {openError ? <PageStatusNotice tone="error">{openError}</PageStatusNotice> : null}
      {applyError ? <PageStatusNotice tone="error">{applyError}</PageStatusNotice> : null}
      {applySuccess ? (
        <PageStatusNotice tone="success">
          {en ? `Repair apply completed with status ${applySuccess}.` : `repair apply가 ${applySuccess} 상태로 완료되었습니다.`}
        </PageStatusNotice>
      ) : null}
      {pipelineRunSuccess ? <PageStatusNotice tone="success">{pipelineRunSuccess}</PageStatusNotice> : null}

      <AdminWorkspacePageFrame>
        {pagePermissionDenied ? (
          <MemberStateCard
            description={en
              ? `You need ${repairWorkbenchAuthority.requiredViewFeatureCode || `${commandState.value?.page?.menuPermission?.menuCode || page?.menuCode || query.menuCode}_VIEW`} permission to open repair and rollback evidence for this page.`
              : `이 페이지의 복구 및 롤백 증거 화면을 열려면 ${repairWorkbenchAuthority.requiredViewFeatureCode || `${commandState.value?.page?.menuPermission?.menuCode || page?.menuCode || query.menuCode}_VIEW`} 권한이 필요합니다.`}
            icon="lock"
            title={en ? "Permission denied." : "권한이 없습니다."}
            tone="danger"
          />
        ) : null}
        {pagePermissionDenied ? null : (
        <>
        {snapshotVersionId ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-4" data-help-id="repair-workbench-snapshot-focus">
            <SummaryMetricCard
              title={en ? "Snapshot Focus" : "스냅샷 포커스"}
              value={snapshotVersionId}
              description={en ? "Rollback console target snapshot" : "현재 롤백 콘솔 대상 스냅샷"}
            />
            <SummaryMetricCard
              title={en ? "Published Match" : "발행 일치"}
              value={snapshotMatchesPublished ? (en ? "MATCH" : "일치") : (en ? "DIFF" : "불일치")}
              description={page?.publishedVersionId || "-"}
              accentClassName={snapshotMatchesPublished ? "text-emerald-700" : "text-amber-700"}
              surfaceClassName={snapshotMatchesPublished ? "bg-emerald-50" : "bg-amber-50"}
            />
            <SummaryMetricCard
              title={en ? "Draft Match" : "초안 일치"}
              value={snapshotMatchesDraft ? (en ? "MATCH" : "일치") : (en ? "DIFF" : "불일치")}
              description={page?.versionId || "-"}
              accentClassName={snapshotMatchesDraft ? "text-emerald-700" : "text-amber-700"}
              surfaceClassName={snapshotMatchesDraft ? "bg-emerald-50" : "bg-amber-50"}
            />
            <SummaryMetricCard
              title={en ? "Rollback Focus Mode" : "롤백 포커스 모드"}
              value={snapshotMatchesPublished ? (en ? "published rollback" : "발행 롤백") : (snapshotMatchesDraft ? (en ? "draft rollback" : "초안 롤백") : (en ? "manual snapshot rollback" : "수동 스냅샷 롤백"))}
              description={en ? "Current rollback evidence source" : "현재 롤백 증거 소스"}
            />
          </section>
        ) : null}
        {snapshotVersionId && focusedSnapshot ? (
          <div data-help-id="repair-workbench-focused-snapshot-evidence">
            <KeyValueGridPanel
              title={en ? "Focused Snapshot Evidence" : "포커스 스냅샷 증거"}
              description={en ? "This snapshot registry row is the rollback anchor currently carried into repair, rollback, and handoff evidence." : "이 스냅샷 레지스트리 행은 현재 복구, 롤백, 인계 증거로 이어지는 롤백 앵커입니다."}
              items={[
                { label: en ? "Snapshot Version" : "스냅샷 버전", value: String(focusedSnapshot.versionId || "-") },
                { label: en ? "Snapshot Status" : "스냅샷 상태", value: String(focusedSnapshot.versionStatus || "-") },
                { label: en ? "Saved At" : "저장 시각", value: String(focusedSnapshot.savedAt || "-") },
                { label: en ? "Template Type" : "템플릿 타입", value: String(focusedSnapshot.templateType || "-") },
                { label: en ? "Node Count" : "노드 수", value: String(focusedSnapshot.nodeCount || 0) },
                { label: en ? "Event Count" : "이벤트 수", value: String(focusedSnapshot.eventCount || 0) },
                { label: en ? "Anchor Match" : "앵커 일치", value: snapshotMatchesPublished ? (en ? "PUBLISHED" : "발행본") : (snapshotMatchesDraft ? (en ? "DRAFT" : "초안") : (en ? "MANUAL" : "수동")) },
                { label: en ? "Repair Session" : "복구 세션", value: repairOpenResponse?.repairSessionId || "-" }
              ]}
            />
          </div>
        ) : null}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetricCard
            title={en ? "Candidate Promotion" : "후보 승격"}
            value={repairServerStateRows.length ? `${repairPromotedCount}/${repairServerStateRows.length}` : blockingGapSet.length}
            description={repairServerStateRows.length ? (repairPromotionSummary || (en ? "Candidate route summary unavailable" : "후보 경로 요약 없음")) : (en ? "Open repair gaps" : "열린 복구 gap")}
            accentClassName={repairServerStateRows.length ? undefined : "text-red-700"}
            surfaceClassName={repairServerStateRows.length ? undefined : "bg-red-50"}
          />
          <SummaryMetricCard
            title={en ? "Pending Handoff" : "인계 대기"}
            value={repairServerStateRows.length ? repairPendingCount : mismatchCount}
            description={repairServerStateRows.length ? (en ? "Servers not yet promoted from repair candidate" : "repair 후보에서 아직 승격 전인 서버") : (en ? "Parity drift rows" : "정합성 드리프트")}
            accentClassName="text-amber-700"
            surfaceClassName="bg-amber-50"
          />
          <SummaryMetricCard
            title={en ? "Repair Targets" : "복구 대상"}
            value={selectedElementSet.length}
            description={repairApplyResponse?.updatedReleaseCandidateId
              ? `${repairApplyResponse.updatedReleaseCandidateId} / ${stringifyValue(repairApplyResponse.candidateRuntimePackageId)}`
              : (en ? "Selected repair candidates" : "선택된 복구 후보")}
          />
          <SummaryMetricCard
            title={en ? "Rollback Anchor" : "롤백 앵커"}
            value={stringifyValue(pipelineRollbackPlan.rollbackTargetReleaseUnitId, stringifyValue(repairOpenResponse?.releaseUnitId, String((repairOpenResponse?.requiredContractSet || requiredContractSet).length)))}
            description={repairServerStateRows.length
              ? `${stringifyValue(toRecord(candidatePrimaryRoute).serverId)} / ${stringifyValue(toRecord(candidatePrimaryRoute).promotionState)}`
              : (en ? "Repair and rollback handoff artifacts" : "복구 및 롤백 인계 산출물")}
          />
        </section>

        <div className="overflow-hidden rounded-2xl border border-[var(--kr-gov-border)] bg-white shadow-sm" data-help-id="repair-workbench-project-pipeline">
          <GridToolbar
            title={en ? "Repair Pipeline Control Plane" : "복구 파이프라인 컨트롤 플레인"}
            meta={en
              ? "Promote repair outputs into an installable product, artifact-centered deploy contract, and rollback anchor."
              : "복구 결과를 installable product, artifact 중심 배포 계약, rollback anchor로 승격합니다."}
            actions={(
              <div className="flex flex-wrap gap-2">
                <MemberPermissionButton allowed={repairWorkbenchAuthority.allowsAction("query")} disabled={pipelineRunLoading} onClick={handleRefreshProjectPipeline} reason={repairWorkbenchAuthority.getActionReason("query", en)} size="sm" type="button" variant="secondary">
                  {pipelineStatusState.loading ? (en ? "Loading..." : "불러오는 중...") : (en ? "Load Latest" : "최신 실행 조회")}
                </MemberPermissionButton>
                <MemberPermissionButton allowed={repairWorkbenchAuthority.allowsAction("execute")} disabled={pipelineRunLoading} onClick={() => { void handleRunProjectPipeline(); }} reason={repairWorkbenchAuthority.getActionReason("execute", en)} size="sm" type="button" variant="primary">
                  {pipelineRunLoading ? (en ? "Running..." : "실행 중...") : (en ? "Run Pipeline" : "파이프라인 실행")}
                </MemberPermissionButton>
              </div>
            )}
          />
          <div className="space-y-6 px-6 py-5">
            <KeyValueGridPanel
              title={en ? "Pipeline Summary" : "파이프라인 요약"}
              description={en
                ? "Repair outputs stay governed only when the resulting package, artifact lineage, and deploy contract are fixed together."
                : "복구 결과는 결과 패키지, artifact lineage, deploy contract가 함께 고정될 때만 governed 상태를 유지합니다."}
              items={[
                { label: "projectId", value: resonanceProjectId },
                { label: "pipelineRunId", value: projectPipeline?.pipelineRunId || "-" },
                { label: "releaseUnitId", value: projectPipeline?.releaseUnitId || deployEvidence.releaseUnitId },
                { label: "runtimePackageId", value: projectPipeline?.runtimePackageId || deployEvidence.runtimePackageId },
                { label: "deployTraceId", value: projectPipeline?.deployTraceId || deployEvidence.deployTraceId },
                { label: en ? "Pipeline Result" : "파이프라인 결과", value: projectPipeline?.result || "-" },
                { label: en ? "Apply Status" : "적용 상태", value: repairApplyResponse?.status || repairOpenResponse?.status || "-" },
                { label: en ? "Validator Pass" : "검증 통과", value: projectPipeline ? `${projectPipeline.validatorPassCount}/${projectPipeline.validatorTotalCount}` : "-" },
                { label: en ? "Release Family" : "릴리스 패밀리", value: stringifyValue(pipelineArtifactLineage.releaseFamilyId) },
                { label: en ? "Rollback Target" : "롤백 대상", value: stringifyValue(pipelineRollbackPlan.rollbackTargetReleaseUnitId) }
              ]}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <KeyValueGridPanel
                title={en ? "Installable Product" : "설치형 프로덕트"}
                items={[
                  { label: "installableProductId", value: stringifyValue(pipelineInstallableProduct.installableProductId) },
                  { label: "productType", value: stringifyValue(pipelineInstallableProduct.productType) },
                  { label: "packageId", value: stringifyValue(pipelineInstallableProduct.packageId) },
                  { label: "packageFormat", value: stringifyValue(pipelineInstallableProduct.packageFormat) },
                  { label: "menuBinding.projectId", value: stringifyValue(toRecord(pipelineInstallableProduct.menuBinding).projectId, resonanceProjectId) },
                  { label: "menuBinding.menuRoot", value: stringifyValue(toRecord(pipelineInstallableProduct.menuBinding).menuRoot, builderInput.menuCode) },
                  { label: "menuBinding.runtimeClass", value: stringifyValue(toRecord(pipelineInstallableProduct.menuBinding).runtimeClass, selectedScreenId) },
                  { label: "menuBinding.menuScope", value: stringifyValue(toRecord(pipelineInstallableProduct.menuBinding).menuScope, stringifyValue(page?.authorityProfile?.scopePolicy, "ADMIN")) }
                ]}
              />
              <KeyValueGridPanel
                title={en ? "Deploy Contract" : "배포 계약"}
                items={[
                  { label: "artifactTargetSystem", value: stringifyValue(pipelineDeployContract.artifactTargetSystem) },
                  { label: "deploymentTarget", value: stringifyValue(pipelineDeployContract.deploymentTarget) },
                  { label: "deploymentMode", value: stringifyValue(pipelineDeployContract.deploymentMode) },
                  { label: "versionTrackingYn", value: stringifyValue(pipelineDeployContract.versionTrackingYn) },
                  { label: "releaseFamilyId", value: stringifyValue(pipelineDeployContract.releaseFamilyId) },
                  { label: "releaseUnitId", value: stringifyValue(pipelineDeployContract.releaseUnitId, deployEvidence.releaseUnitId) },
                  { label: "artifactManifestId", value: stringifyValue(pipelineArtifactLineage.artifactManifestId) },
                  { label: "releaseTrackVersion", value: stringifyValue(pipelineArtifactLineage.releaseTrackVersion) }
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <section className="rounded-2xl border border-[var(--kr-gov-border-light)] bg-slate-50/70 p-4">
                <h3 className="text-sm font-bold">{en ? "Deployment Route" : "배포 승격 경로"}</h3>
                <div className="mt-3 space-y-2">
                  {pipelineDeploymentRoutes.length ? pipelineDeploymentRoutes.map((item, index) => {
                    const row = toRecord(item);
                    const promotionState = stringifyValue(row.promotionState);
                    return (
                      <div className="flex items-center justify-between rounded-xl border border-[var(--kr-gov-border-light)] bg-white p-3" key={`${stringifyValue(row.serverRole)}-${index}`}>
                        <div>
                          <p className="text-sm font-semibold">{stringifyValue(row.serverRole)}</p>
                          <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringifyValue(row.serverId)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${deploymentStateTone(promotionState)}`}>{promotionState}</span>
                      </div>
                    );
                  }) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No deployment route is attached yet." : "연결된 배포 승격 경로가 없습니다."}</p>}
                </div>
              </section>
              <section className="rounded-2xl border border-[var(--kr-gov-border-light)] bg-slate-50/70 p-4">
                <h3 className="text-sm font-bold">{en ? "Server Promotion State" : "서버 승격 상태"}</h3>
                <div className="mt-3 space-y-2">
                  {pipelineServerStateRows.length ? pipelineServerStateRows.map((item, index) => {
                    const row = toRecord(item);
                    const healthStatus = stringifyValue(row.healthStatus);
                    const promotionState = stringifyValue(row.promotionState);
                    return (
                      <div className="rounded-xl border border-[var(--kr-gov-border-light)] bg-white p-3" key={`${stringifyValue(row.serverId)}-${index}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{stringifyValue(row.serverId)}</p>
                            <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringifyValue(row.serverRole)}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${deploymentStateTone(promotionState)}`}>{promotionState}</span>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${deploymentStateTone(healthStatus)}`}>{healthStatus}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No pipeline server state is available." : "파이프라인 서버 상태가 없습니다."}</p>}
                </div>
              </section>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <section className="rounded-2xl border border-[var(--kr-gov-border-light)] bg-slate-50/70 p-4">
                <h3 className="text-sm font-bold">{en ? "Validator Checks" : "검증 체크"}</h3>
                <div className="mt-3 space-y-2">
                  {pipelineValidatorRows.length ? pipelineValidatorRows.map((item, index) => {
                    const row = toRecord(item);
                    const status = stringifyValue(row.status);
                    const tone = status === "PASS" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";
                    return (
                      <div className="rounded-xl border border-[var(--kr-gov-border-light)] bg-white p-3" key={`${stringifyValue(row.validatorCheckId, String(index))}-${index}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold">{stringifyValue(row.validatorCheckId)}</div>
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${tone}`}>{status || "-"}</span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringifyValue(row.summary)}</p>
                      </div>
                    );
                  }) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No pipeline status loaded." : "불러온 파이프라인 상태가 없습니다."}</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--kr-gov-border-light)] bg-slate-50/70 p-4">
                <h3 className="text-sm font-bold">{en ? "Stage Progress" : "단계 진행"}</h3>
                <div className="mt-3 space-y-2">
                  {pipelineStageRows.length ? pipelineStageRows.map((item, index) => {
                    const row = toRecord(item);
                    const status = stringifyValue(row.status);
                    const tone = status === "DONE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800";
                    return (
                      <div className="rounded-xl border border-[var(--kr-gov-border-light)] bg-white p-3" key={`${stringifyValue(row.stageId, String(index))}-${index}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold">{stringifyValue(row.stageId)}</div>
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${tone}`}>{status || "-"}</span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringifyValue(row.summary)}</p>
                      </div>
                    );
                  }) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No stage evidence loaded." : "불러온 단계 정보가 없습니다."}</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--kr-gov-border-light)] bg-slate-50/70 p-4">
                <h3 className="text-sm font-bold">{en ? "Artifact Registry" : "아티팩트 레지스트리"}</h3>
                <div className="mt-3 space-y-2">
                  {pipelineArtifactRows.length ? pipelineArtifactRows.map((item, index) => {
                    const row = toRecord(item);
                    return (
                      <div className="rounded-xl border border-[var(--kr-gov-border-light)] bg-white p-3" key={`${stringifyValue(row.artifactId, String(index))}-${index}`}>
                        <div className="text-sm font-semibold">{stringifyValue(row.artifactId)}</div>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--kr-gov-text-secondary)]">{stringifyValue(row.artifactFamily)}</p>
                        <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringifyValue(row.artifactVersion)}</p>
                      </div>
                    );
                  }) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No artifact registry evidence loaded." : "불러온 아티팩트 정보가 없습니다."}</p>}
                </div>
              </section>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div data-help-id="repair-workbench-scope">
            <KeyValueGridPanel
              title={en ? "Rollback Scope" : "롤백 범위"}
              description={en ? "The rollback console keeps validator scope, builder input, and runtime evidence on one governed chain." : "이 롤백 콘솔은 검증 범위, builder 입력, runtime 증거를 하나의 governed 체인으로 유지합니다."}
              items={[
                { label: en ? "Focus Snapshot" : "포커스 스냅샷", value: snapshotVersionId || "-" },
                { label: en ? "Anchor State" : "앵커 상태", value: snapshotAnchorState },
                { label: en ? "Focus Mode" : "포커스 모드", value: rollbackSnapshotFocusMode },
                { label: en ? "Menu Code" : "메뉴 코드", value: builderInput.menuCode },
                { label: "pageId", value: builderInput.pageId },
                { label: en ? "Runtime URL" : "런타임 URL", value: builderInput.menuUrl },
                { label: en ? "Release Unit" : "릴리즈 유닛", value: releaseUnitId },
                { label: en ? "Published Runtime" : "발행 런타임", value: stringifyValue(runtimeEvidence.publishedVersionId) },
                { label: en ? "Latest Publish" : "최근 발행", value: latestPublishAudit ? String(latestPublishAudit.createdAt || "-") : "-" },
                { label: en ? "Validator Trace" : "검증 추적", value: compareState.value?.traceId || "-" },
                { label: en ? "Repair Session" : "복구 세션", value: repairOpenResponse?.repairSessionId || "-" },
                { label: en ? "Apply Run" : "적용 실행", value: repairApplyResponse?.repairApplyRunId || "-" },
                { label: en ? "Latest Trace" : "최신 추적", value: latestTrace }
              ]}
            />
          </div>
          <div data-help-id="repair-workbench-linkage">
            <KeyValueGridPanel
              title={en ? "Rollback Evidence Handoff" : "롤백 증거 인계"}
              description={en ? "Selected repair targets should map back to the same builder draft and published runtime snapshot." : "선택된 복구 대상은 동일한 빌더 초안과 발행 런타임 스냅샷으로 되돌아가야 합니다."}
              items={[
                { label: en ? "Focus Snapshot" : "포커스 스냅샷", value: snapshotVersionId || "-" },
                { label: en ? "Focus Mode" : "포커스 모드", value: rollbackSnapshotFocusMode },
                { label: en ? "Snapshot Anchor Match" : "스냅샷 앵커 일치", value: snapshotAnchorState },
                { label: en ? "Builder Id" : "빌더 ID", value: builderInput.builderId },
                { label: en ? "Draft Version" : "초안 버전", value: builderInput.draftVersionId },
                { label: en ? "Published Version" : "발행 버전", value: stringifyValue(runtimeEvidence.publishedVersionId) },
                { label: en ? "Generated Nodes" : "생성 노드", value: String(generatedNodes.length) },
                { label: en ? "Current Nodes" : "현재 노드", value: String(currentNodes.length) },
                { label: en ? "Generated Events" : "생성 이벤트", value: String(generatedEventCount) },
                { label: en ? "Current Events" : "현재 이벤트", value: String(currentEventCount) },
                { label: en ? "Selected Elements" : "선택 요소", value: selectedElementSet.join(", ") || "-" }
              ]}
            />
          </div>
        </section>

        <div data-help-id="repair-workbench-deploy-evidence">
          <KeyValueGridPanel
            title={en ? "Rollback Deploy Evidence" : "롤백 배포 증거"}
            description={en ? "Keep the deploy evidence fields unchanged while repair, rollback, and final handoff stay in progress." : "복구, 롤백, 최종 인계 동안 배포 증거 필드를 이름 변경 없이 그대로 유지합니다."}
            items={[
              { label: en ? "Focus Snapshot" : "포커스 스냅샷", value: snapshotVersionId || "-" },
              { label: "releaseUnitId", value: deployEvidence.releaseUnitId },
              { label: "runtimePackageId", value: deployEvidence.runtimePackageId },
              { label: "deployTraceId", value: deployEvidence.deployTraceId },
              { label: "ownerLane", value: deployEvidence.ownerLane },
              { label: "rollbackAnchorYn", value: deployEvidence.rollbackAnchorYn }
            ]}
          />
        </div>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-help-id="repair-workbench-operator-flow">
          <KeyValueGridPanel
            title={en ? "Repair / Rollback Operator Flow" : "복구 / 롤백 운영자 플로우"}
            description={en ? "Repair workbench closes the operator path from deploy freshness into compare, repair, and rollback evidence for the screen-builder pilot family." : "repair workbench는 screen-builder pilot family에서 deploy freshness부터 compare, repair, rollback evidence까지의 운영자 경로를 닫습니다."}
            items={[
              { label: "pageFamily", value: "screen-builder" },
              { label: "installScope", value: "COMMON_DEF_PROJECT_BIND" },
              { label: en ? "Runtime Target" : "런타임 대상", value: operatorFlowPaths.runtime },
              { label: en ? "Compare Target" : "비교 대상", value: operatorFlowPaths.compare },
              { label: en ? "Repair Target" : "복구 대상", value: operatorFlowPaths.repair },
              { label: en ? "Repair Session" : "복구 세션", value: repairOpenResponse?.repairSessionId || "-" },
              { label: en ? "Apply Run" : "적용 실행", value: repairApplyResponse?.repairApplyRunId || "-" },
              { label: en ? "Rollback Anchor" : "롤백 앵커", value: deployEvidence.rollbackAnchorYn }
            ]}
          />
          <KeyValueGridPanel
            title={en ? "Deploy / Verify / Rollback Commands" : "배포 / 검증 / 롤백 명령"}
            description={en ? "Use the same command chain before and after repair apply so rollback evidence remains operator-readable." : "repair apply 전후에 같은 명령 체인을 사용해 rollback evidence를 운영자 가독 상태로 유지합니다."}
            items={operatorFlowSteps.map((step) => ({
              label: step.label,
              value: `${step.command} -> ${step.evidence}`
            }))}
          >
            <div className="grid grid-cols-1 gap-3">
              <CopyableCodeBlock title={en ? "Build / Package / Restart" : "빌드 / 패키지 / 재시작"} value={operatorFlowSteps[0]?.command || ""} />
              <CopyableCodeBlock title={en ? "Freshness / Compare / Repair Verify" : "freshness / compare / repair 검증"} value={`${operatorFlowSteps[1]?.command || ""}\n${routeVerifyCommands.runtime}\n${routeVerifyCommands.compare}\n${routeVerifyCommands.repair}`} />
            </div>
          </KeyValueGridPanel>
        </section>

        <div data-help-id="repair-workbench-closure-checklist">
          <KeyValueGridPanel
            title={en ? "Rollback Closure Gate" : "롤백 종료 게이트"}
            description={en ? "This panel keeps the repair contract, parity recheck, and smoke verification gates on one governed checklist." : "이 패널은 복구 계약, parity 재검증, smoke 검증 게이트를 하나의 governed 체크리스트로 유지합니다."}
            items={closureChecklistItems}
          />
        </div>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div data-help-id="repair-workbench-cross-lane-evidence">
            <KeyValueGridPanel
              title={en ? "Rollback Evidence Mapping" : "롤백 증거 매핑"}
              description={en ? "Keep the 04 builder input, 05 runtime result, 06 compare contract, and 08 release evidence on one verify chain before handoff." : "인계 전까지 04 빌더 입력, 05 런타임 결과, 06 비교 계약, 08 릴리즈 증거를 하나의 verify 체인으로 유지합니다."}
              items={crossLaneEvidenceItems}
            />
          </div>
          <div data-help-id="repair-workbench-handoff-readiness">
            <KeyValueGridPanel
              title={en ? "Rollback Handoff Readiness" : "롤백 인계 준비도"}
              description={en ? "Use this gate before handing 09 outputs back to 01." : "09 산출물을 01로 되돌려 넘기기 전에 이 게이트를 사용합니다."}
              items={handoffChecklistItems}
            />
          </div>
        </section>

        <div data-help-id="repair-workbench-loop-status">
          <KeyValueGridPanel
            title={en ? "Rollback Loop Continuation" : "롤백 루프 이어가기"}
            description={en ? "Keep the existing 09 session attached: recover the last unfinished repair or verify gate first, and rerun the same scope only after the unfinished item closes." : "기존 09 세션에 붙은 상태를 유지합니다. 마지막 미완료 repair 또는 verify 게이트를 먼저 복구하고, 그 항목이 닫힌 뒤에만 같은 범위를 재실행합니다."}
            items={loopStatusItems}
          />
        </div>

        <PageStatusNotice tone={handoffReady ? "success" : "warning"}>
          {handoffNote}
        </PageStatusNotice>

        <section className="gov-card overflow-hidden p-0">
          <GridToolbar
            title={en ? "Rollback Drift Matrix" : "롤백 드리프트 매트릭스"}
            meta={en ? "Rows returned from validator compare remain the source of truth for repair and rollback handoff." : "검증 비교 행은 복구 및 롤백 인계의 기준 truth source로 유지됩니다."}
            actions={(
              <>
                <MemberLinkButton
                  href={buildCurrentRuntimeComparePath({
                    menuCode: query.menuCode,
                    pageId: query.pageId,
                    menuTitle: query.menuTitle,
                    menuUrl: query.menuUrl
                  })}
                  size="sm"
                  variant="secondary"
                >
                  {en ? "Open Repair Validator" : "복구 검증 열기"}
                </MemberLinkButton>
                <MemberPermissionButton allowed={repairWorkbenchAuthority.allowsAction("execute")} disabled={openingRepair || !selectedElementSet.length} onClick={handleOpenRepair} reason={repairWorkbenchAuthority.getActionReason("execute", en)} size="sm" type="button" variant="primary">
                  {openingRepair ? (en ? "Opening..." : "여는 중...") : (en ? "Open Rollback Session" : "롤백 세션 열기")}
                </MemberPermissionButton>
              </>
            )}
          />
          {snapshotVersionId ? (
            <div className={`border-b px-5 py-3 text-sm ${snapshotAnchorState === (en ? "PUBLISHED" : "발행본") || snapshotAnchorState === (en ? "DRAFT" : "초안") ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <span className="font-bold">{en ? "Drift matrix anchor" : "드리프트 매트릭스 앵커"}</span>
              {`: ${snapshotVersionId} / ${snapshotAnchorState} / ${rollbackSnapshotFocusMode}`}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)]">
              <thead className="bg-slate-50 text-left text-[12px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                <tr>
                  <th className="px-5 py-4">{en ? "Target" : "대상"}</th>
                  <th className="px-5 py-4">{en ? "Current" : "현재"}</th>
                  <th className="px-5 py-4">{en ? "Generated" : "생성"}</th>
                  <th className="px-5 py-4">{en ? "Baseline" : "기준선"}</th>
                  <th className="px-5 py-4">{en ? "Patch" : "패치"}</th>
                  <th className="px-5 py-4">{en ? "Result" : "결과"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white text-sm">
                {compareRows.length ? compareRows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-5 py-4 font-bold text-[var(--kr-gov-text-primary)]">{row.label}</td>
                    <td className="px-5 py-4">{row.current}</td>
                    <td className="px-5 py-4">{row.generated}</td>
                    <td className="px-5 py-4">{row.baseline}</td>
                    <td className="px-5 py-4">{row.patchTarget}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${toneClassName(row.result)}`}>{row.result}</span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-5 py-4 text-[var(--kr-gov-text-secondary)]" colSpan={6}>
                      {en ? "No compare rows were returned for this scope yet." : "아직 이 범위에 대한 compare 행이 없습니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="gov-card overflow-hidden p-0">
            <GridToolbar
              title={en ? "Rollback Session" : "롤백 세션"}
              meta={en ? "repair open response and governed blocker ownership." : "repair open 응답과 governed 차단 항목 소유 상태입니다."}
            />
            {snapshotVersionId ? (
              <div className={`border-b px-5 py-3 text-sm ${snapshotAnchorState === (en ? "PUBLISHED" : "발행본") || snapshotAnchorState === (en ? "DRAFT" : "초안") ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                <span className="font-bold">{en ? "Session anchor" : "세션 앵커"}</span>
                {`: ${snapshotVersionId} / ${snapshotAnchorState} / ${rollbackSnapshotFocusMode}`}
              </div>
            ) : null}
            <div className="divide-y divide-[var(--kr-gov-border-light)] bg-white">
              <div className="grid grid-cols-1 gap-3 px-5 py-4 text-sm md:grid-cols-2">
                <div><p className="text-[var(--kr-gov-text-secondary)]">status</p><p className="mt-1 font-bold"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${toneClassName(repairOpenResponse?.status || "REVIEW_REQUIRED")}`}>{repairOpenResponse?.status || "READY"}</span></p></div>
                <div><p className="text-[var(--kr-gov-text-secondary)]">repairSessionId</p><p className="mt-1 font-bold">{repairOpenResponse?.repairSessionId || "-"}</p></div>
                <div><p className="text-[var(--kr-gov-text-secondary)]">{en ? "snapshotAnchorState" : "스냅샷 앵커 상태"}</p><p className="mt-1 font-bold">{snapshotAnchorState}</p></div>
                <div><p className="text-[var(--kr-gov-text-secondary)]">{en ? "focusSnapshot" : "포커스 스냅샷"}</p><p className="mt-1 font-bold">{snapshotVersionId || "-"}</p></div>
                <div><p className="text-[var(--kr-gov-text-secondary)]">compareSnapshotId</p><p className="mt-1 font-bold">{repairOpenResponse?.compareSnapshotId || "-"}</p></div>
                <div><p className="text-[var(--kr-gov-text-secondary)]">ownerLane</p><p className="mt-1 font-bold">{repairOpenResponse?.ownerLane || ownerLane}</p></div>
              </div>
              <div className="px-5 py-4 text-sm">
                <p className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Blocking Gaps" : "차단 gap"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {blockingGapSet.length ? blockingGapSet.map((item) => (
                    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700" key={item}>{item}</span>
                  )) : <span className="text-[var(--kr-gov-text-secondary)]">{en ? "No blockers." : "차단 항목이 없습니다."}</span>}
                </div>
              </div>
              <div className="px-5 py-4 text-sm">
                <p className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Reuse Recommendations" : "재사용 권장"}</p>
                <ul className="mt-3 space-y-2 text-[var(--kr-gov-text-secondary)]">
                  {(repairOpenResponse?.reuseRecommendationSet || reuseRecommendationSet).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="px-5 py-4 text-sm">
                <p className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Required Contracts" : "필수 계약"}</p>
                <ul className="mt-3 space-y-2 text-[var(--kr-gov-text-secondary)]">
                  {(repairOpenResponse?.requiredContractSet || requiredContractSet).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="grid grid-cols-1 gap-4 px-5 py-4 xl:grid-cols-2">
                <section className="rounded-xl border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                  <h3 className="text-sm font-bold">{en ? "Candidate Deployment Route" : "후보 배포 승격 경로"}</h3>
                  <div className="mt-3 space-y-2">
                    {repairDeploymentRoutes.length ? repairDeploymentRoutes.map((item, index) => {
                      const row = toRecord(item);
                      const promotionState = stringifyValue(row.promotionState);
                      return (
                        <div className="flex items-center justify-between rounded-xl border border-[var(--kr-gov-border-light)] bg-white p-3" key={`${stringifyValue(row.serverRole)}-open-${index}`}>
                          <div>
                            <p className="text-sm font-semibold">{stringifyValue(row.serverRole)}</p>
                            <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringifyValue(row.serverId)}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${deploymentStateTone(promotionState)}`}>{promotionState}</span>
                        </div>
                      );
                    }) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No repair route is attached yet." : "연결된 repair 승격 경로가 없습니다."}</p>}
                  </div>
                </section>
                <section className="rounded-xl border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                  <h3 className="text-sm font-bold">{en ? "Candidate Server State" : "후보 서버 상태"}</h3>
                  <div className="mt-3 space-y-2">
                    {repairServerStateRows.length ? repairServerStateRows.map((item, index) => {
                      const row = toRecord(item);
                      return (
                        <div className="rounded-xl border border-[var(--kr-gov-border-light)] bg-white p-3" key={`${stringifyValue(row.serverId)}-open-${index}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{stringifyValue(row.serverId)}</p>
                              <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringifyValue(row.serverRole)}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-3 py-1 text-xs font-bold ${deploymentStateTone(stringifyValue(row.promotionState))}`}>{stringifyValue(row.promotionState)}</span>
                              <span className={`rounded-full px-3 py-1 text-xs font-bold ${deploymentStateTone(stringifyValue(row.healthStatus))}`}>{stringifyValue(row.healthStatus)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No repair server state is attached yet." : "연결된 repair 서버 상태가 없습니다."}</p>}
                  </div>
                </section>
              </div>
            </div>
          </section>

          <section className="gov-card overflow-hidden p-0">
            <GridToolbar
              title={en ? "Rollback Apply" : "롤백 적용"}
              meta={en ? "Close the current session into parity recheck and smoke verification readiness." : "현재 세션을 parity 재검증과 smoke 검증 준비 상태로 닫습니다."}
              actions={(
                <MemberPermissionButton allowed={repairWorkbenchAuthority.allowsAction("execute")} disabled={!repairOpenResponse || applyingRepair} onClick={handleApplyRepair} reason={repairWorkbenchAuthority.getActionReason("execute", en)} size="sm" type="button" variant="primary">
                  {applyingRepair ? (en ? "Applying..." : "적용 중...") : (en ? "Apply Rollback" : "롤백 적용")}
                </MemberPermissionButton>
              )}
            />
            <div className="space-y-4 bg-white px-5 py-4">
              <label className="block text-sm font-bold text-[var(--kr-gov-text-primary)]">
                {en ? "Publish Mode" : "배포 모드"}
                <AdminSelect className="mt-2" onChange={(event) => setPublishMode(event.target.value)} value={publishMode}>
                  <option value="DRAFT_ONLY">DRAFT_ONLY</option>
                  <option value="REVIEW_READY">REVIEW_READY</option>
                  <option value="PUBLISH_READY">PUBLISH_READY</option>
                </AdminSelect>
              </label>
              <label className="block text-sm font-bold text-[var(--kr-gov-text-primary)]">
                {en ? "Change Summary" : "변경 요약"}
                <AdminTextarea className="mt-2 min-h-[120px]" onChange={(event) => setChangeSummary(event.target.value)} value={changeSummary} />
              </label>
              <div className="rounded border border-[var(--kr-gov-border-light)] bg-slate-50 p-4 text-sm">
                <p className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Apply Result" : "적용 결과"}</p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div><p className="text-[var(--kr-gov-text-secondary)]">repairApplyRunId</p><p className="mt-1 font-bold">{repairApplyResponse?.repairApplyRunId || "-"}</p></div>
                  <div><p className="text-[var(--kr-gov-text-secondary)]">updatedReleaseCandidateId</p><p className="mt-1 font-bold">{repairApplyResponse?.updatedReleaseCandidateId || "-"}</p></div>
                  <div><p className="text-[var(--kr-gov-text-secondary)]">parityRecheckRequiredYn</p><p className="mt-1 font-bold">{String(parityRecheckRequired)}</p></div>
                  <div><p className="text-[var(--kr-gov-text-secondary)]">uniformityRecheckRequiredYn</p><p className="mt-1 font-bold">{String(uniformityRecheckRequired)}</p></div>
                  <div><p className="text-[var(--kr-gov-text-secondary)]">smokeRequiredYn</p><p className="mt-1 font-bold">{String(smokeRequired)}</p></div>
                  <div><p className="text-[var(--kr-gov-text-secondary)]">closureGate</p><p className="mt-1 font-bold">{repairApplyResponse?.status ? (smokeRequired ? "READY_FOR_SMOKE" : "READY_FOR_HANDOFF") : "REPAIR_PENDING"}</p></div>
                </div>
                <div className="mt-4">
                  <p className="text-[var(--kr-gov-text-secondary)]">updatedAssetTraceSet</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {toList(repairApplyResponse?.updatedAssetTraceSet).length ? toList(repairApplyResponse?.updatedAssetTraceSet).map((item) => (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700" key={item}>{item}</span>
                    )) : <span className="text-[var(--kr-gov-text-secondary)]">{en ? "Apply has not run yet." : "아직 apply가 실행되지 않았습니다."}</span>}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <section className="rounded-xl border border-[var(--kr-gov-border-light)] bg-white p-4">
                    <h3 className="text-sm font-bold">{en ? "Apply Deploy Contract" : "적용 배포 계약"}</h3>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3"><span className="text-[var(--kr-gov-text-secondary)]">deploymentTarget</span><span className="font-semibold">{stringifyValue(repairDeployContract.deploymentTarget)}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-[var(--kr-gov-text-secondary)]">deploymentMode</span><span className="font-semibold">{stringifyValue(repairDeployContract.deploymentMode)}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-[var(--kr-gov-text-secondary)]">releaseUnitId</span><span className="font-semibold">{stringifyValue(repairDeployContract.releaseUnitId, repairApplyResponse?.updatedReleaseCandidateId || "-")}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-[var(--kr-gov-text-secondary)]">deployTraceId</span><span className="font-semibold">{stringifyValue(repairApplyResponse?.deployTraceId || repairOpenResponse?.deployTraceId)}</span></div>
                    </div>
                  </section>
                  <section className="rounded-xl border border-[var(--kr-gov-border-light)] bg-white p-4">
                    <h3 className="text-sm font-bold">{en ? "Apply Promotion Plan" : "적용 승격 계획"}</h3>
                    <div className="mt-3 space-y-2">
                      {repairDeploymentRoutes.length ? repairDeploymentRoutes.map((item, index) => {
                        const row = toRecord(item);
                        return (
                          <div className="flex items-center justify-between rounded-xl border border-[var(--kr-gov-border-light)] bg-slate-50 p-3" key={`${stringifyValue(row.serverRole)}-apply-${index}`}>
                            <div>
                              <p className="text-sm font-semibold">{stringifyValue(row.serverRole)}</p>
                              <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringifyValue(row.serverId)}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${deploymentStateTone(stringifyValue(row.promotionState))}`}>{stringifyValue(row.promotionState)}</span>
                          </div>
                        );
                      }) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Apply plan will appear after repair routing is resolved." : "repair 라우팅이 정해지면 적용 계획이 표시됩니다."}</p>}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </section>
        </section>
        </>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
