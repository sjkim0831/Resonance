import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { resolveAuthorityScope } from "../../app/policy/authorityScope";
import { getCurrentRuntimePathname, getCurrentRuntimeSearch } from "../../app/routes/runtime";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchAuditEvents } from "../../platform/observability/observability";
import { buildObservabilityPath } from "../../platform/routes/platformPaths";
import {
  fetchParityCompare,
  fetchProjectPipelineStatus,
  resolveResonanceProjectId,
  runProjectPipeline,
  type ResonanceParityCompareRow,
  type ResonanceProjectPipelineResponse
} from "../../lib/api/resonanceControlPlane";
import { fetchScreenBuilderPage, fetchScreenBuilderPreview, fetchScreenCommandPage } from "../../lib/api/platform";
import type { ScreenCommandPagePayload } from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { ContextKeyStrip } from "../admin-ui/ContextKeyStrip";
import { CopyableCodeBlock, GridToolbar, KeyValueGridPanel, MemberLinkButton, MemberPermissionButton, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { resolveRuntimeCompareContextKeys } from "../admin-ui/contextKeyPresets";
import { MemberStateCard } from "../member/sections";
import { resolveScreenBuilderQuery, sortScreenBuilderNodes } from "./shared/screenBuilderUtils";
import { buildScreenBuilderOperatorFlowPaths, buildScreenBuilderOperatorFlowSteps, buildScreenBuilderRouteVerifyCommands } from "./operatorFlow";
import { buildRepairWorkbenchPath, buildScreenBuilderPath, buildScreenRuntimePath } from "./screenBuilderPaths";

type CompareRow = {
  label: string;
  current: string;
  generated: string;
  baseline: string;
  patchTarget: string;
  result: "MATCH" | "MISMATCH" | "GAP";
};

type BlockerRow = {
  blocker: string;
  ownerLane: string;
  source: string;
};

type RepairQueueEntry = {
  candidate: string;
  guidedStateId: string;
  templateLineId: string;
  screenFamilyRuleId: string;
  ownerLane: string;
  selectedScreenId: string;
};

type VerifyClosureRow = {
  label: string;
  state: "PASS" | "WARN";
  evidence: string;
};

type LoopStatusItem = {
  label: string;
  value: string;
};

function getCurrentRuntimeCompareRoutePath() {
  return getCurrentRuntimePathname();
}

function getCurrentRuntimeCompareSearchParam(name: string) {
  return new URLSearchParams(getCurrentRuntimeSearch()).get(name);
}

function stringifyValue(value: unknown, empty = "-") {
  const normalized = String(value || "").trim();
  return normalized || empty;
}

function findContextKeyValue(items: Array<{ label: string; value: string }>, label: string, empty = "-") {
  return items.find((item) => item.label === label)?.value || empty;
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function normalizeToken(value: string, fallback: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
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
  if (normalized.includes("HEALTHY") || normalized.includes("PROMOTED") || normalized.includes("TARGET")) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (normalized.includes("VALIDATING") || normalized.includes("PENDING")) {
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

function buildCompareRows(options: {
  currentTemplateLine: string;
  currentFamilyRule: string;
  currentScope: string;
  currentNodeCount: number;
  currentIssueCount: number;
  generatedTemplateLine: string;
  generatedFamilyRule: string;
  generatedScope: string;
  generatedNodeCount: number;
  generatedIssueCount: number;
  baselineTemplateLine: string;
  baselineFamilyRule: string;
  baselineScope: string;
  patchTemplateLine: string;
  patchFamilyRule: string;
  patchScope: string;
  patchNodeCount: number;
  patchIssueCount: number;
}): CompareRow[] {
  const rows: Array<Omit<CompareRow, "result">> = [
    {
      label: "Template Line",
      current: options.currentTemplateLine,
      generated: options.generatedTemplateLine,
      baseline: options.baselineTemplateLine,
      patchTarget: options.patchTemplateLine
    },
    {
      label: "Screen Family Rule",
      current: options.currentFamilyRule,
      generated: options.generatedFamilyRule,
      baseline: options.baselineFamilyRule,
      patchTarget: options.patchFamilyRule
    },
    {
      label: "Authority Scope",
      current: options.currentScope,
      generated: options.generatedScope,
      baseline: options.baselineScope,
      patchTarget: options.patchScope
    },
    {
      label: "Node Count",
      current: String(options.currentNodeCount),
      generated: String(options.generatedNodeCount),
      baseline: "family-governed",
      patchTarget: String(options.patchNodeCount),
    },
    {
      label: "Registry Issues",
      current: `${options.currentIssueCount} issue(s)`,
      generated: `${options.generatedIssueCount} issue(s)`,
      baseline: "0 issue(s)",
      patchTarget: `${options.patchIssueCount} issue(s)`
    }
  ];

  return rows.map((row) => {
    const values = [row.current, row.generated, row.baseline, row.patchTarget].map((item) => item.trim());
    const hasGap = values.some((item) => item === "-" || item === "");
    if (hasGap) {
      return { ...row, result: "GAP" as const };
    }
    const allMatch = values.every((item) => item === values[0]);
    return { ...row, result: allMatch ? "MATCH" as const : "MISMATCH" as const };
  });
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

function resultChipClassName(result: CompareRow["result"]) {
  if (result === "MATCH") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (result === "GAP") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-red-100 text-red-700";
}

function buildCompareContextStripItems(
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

export function CurrentRuntimeCompareMigrationPage() {
  const en = isEnglish();
  const sessionState = useFrontendSession();
  const query = useMemo(() => resolveScreenBuilderQuery({ get: getCurrentRuntimeCompareSearchParam }), []);
  const commandState = useAsyncValue<ScreenCommandPagePayload>(
    () => (query.pageId ? fetchScreenCommandPage(query.pageId) : Promise.resolve({ selectedPageId: "", pages: [], page: {} as ScreenCommandPagePayload["page"] })),
    [query.pageId],
    { enabled: Boolean(query.pageId) }
  );
  const runtimeCompareAuthority = useMemo(() => resolveAuthorityScope({
    scopeName: "current-runtime-compare",
    routePath: getCurrentRuntimeCompareRoutePath(),
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
  const pagePermissionDenied = !sessionState.loading && !commandState.loading && !runtimeCompareAuthority.entryAllowed;
  const pageQueryEnabled = (!query.pageId || !commandState.loading) && runtimeCompareAuthority.entryAllowed;
  const snapshotVersionId = getCurrentRuntimeCompareSearchParam("snapshotVersionId") || "";
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

  const currentPreview = currentPreviewState.value;
  const publishedPreview = publishedPreviewState.value;
  const generatedNodes = useMemo(() => sortScreenBuilderNodes(currentPreview?.nodes || page?.nodes || []), [currentPreview?.nodes, page?.nodes]);
  const currentNodes = useMemo(() => sortScreenBuilderNodes(publishedPreview?.nodes || []), [publishedPreview?.nodes]);
  const currentDiagnostics = publishedPreview?.registryDiagnostics || page?.registryDiagnostics;
  const generatedDiagnostics = currentPreview?.registryDiagnostics || page?.registryDiagnostics;
  const currentIssueCount = (currentDiagnostics?.missingNodes?.length || 0) + (currentDiagnostics?.deprecatedNodes?.length || 0);
  const generatedIssueCount = (generatedDiagnostics?.missingNodes?.length || 0) + (generatedDiagnostics?.deprecatedNodes?.length || 0);
  const currentEventCount = publishedPreview?.events?.length || 0;
  const generatedEventCount = currentPreview?.events?.length || page?.events?.length || 0;
  const compareContextKeys = useMemo(() => resolveRuntimeCompareContextKeys({
    menuUrl: page?.menuUrl || query.menuUrl,
    templateType: currentPreview?.templateType || publishedPreview?.templateType || page?.templateType
  }), [currentPreview?.templateType, page?.menuUrl, page?.templateType, publishedPreview?.templateType, query.menuUrl]);
  const resonanceProjectId = useMemo(() => resolveResonanceProjectId(getCurrentRuntimeCompareSearchParam("projectId") || ""), []);
  const templateLineId = findContextKeyValue(compareContextKeys, "Template Line");
  const screenFamilyRuleId = findContextKeyValue(compareContextKeys, "Screen Family Rule");
  const guidedStateId = findContextKeyValue(compareContextKeys, "Guided State");
  const ownerLane = findContextKeyValue(compareContextKeys, "Owner Lane");
  const selectedScreenId = page?.pageId || query.pageId || query.menuCode || "screen-runtime";
  const artifactEvidence = publishedPreview?.artifactEvidence || currentPreview?.artifactEvidence || page?.artifactEvidence || null;
  const releaseUnitId = stringifyValue(page?.releaseUnitId || publishedPreview?.releaseUnitId || currentPreview?.releaseUnitId || page?.publishedVersionId || page?.versionId || "-");
  const previewRuntimeEvidence = ((currentPreview as unknown as { runtimeEvidence?: Record<string, unknown> } | undefined)?.runtimeEvidence) || null;
  const deployEvidence = useMemo(
    () => buildDeployEvidence({
      releaseUnitId,
      selectedScreenId,
      ownerLane,
      runtimeEvidence: previewRuntimeEvidence,
      artifactEvidence
    }),
    [artifactEvidence, ownerLane, previewRuntimeEvidence, releaseUnitId, selectedScreenId]
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
  const fallbackCompareRows = useMemo(() => buildCompareRows({
    currentTemplateLine: templateLineId,
    currentFamilyRule: screenFamilyRuleId,
    currentScope: stringifyValue(publishedPreview?.authorityProfile?.scopePolicy || page?.authorityProfile?.scopePolicy, "GLOBAL"),
    currentNodeCount: currentNodes.length,
    currentIssueCount,
    generatedTemplateLine: templateLineId,
    generatedFamilyRule: screenFamilyRuleId,
    generatedScope: stringifyValue(currentPreview?.authorityProfile?.scopePolicy || page?.authorityProfile?.scopePolicy, "GLOBAL"),
    generatedNodeCount: generatedNodes.length,
    generatedIssueCount,
    baselineTemplateLine: templateLineId,
    baselineFamilyRule: screenFamilyRuleId,
    baselineScope: "GLOBAL",
    patchTemplateLine: templateLineId,
    patchFamilyRule: screenFamilyRuleId,
    patchScope: stringifyValue(currentPreview?.authorityProfile?.scopePolicy || page?.authorityProfile?.scopePolicy, "GLOBAL"),
    patchNodeCount: generatedNodes.length,
    patchIssueCount: generatedIssueCount
  }), [currentIssueCount, currentNodes.length, currentPreview?.authorityProfile?.scopePolicy, generatedIssueCount, generatedNodes.length, page?.authorityProfile?.scopePolicy, publishedPreview?.authorityProfile?.scopePolicy, screenFamilyRuleId, templateLineId]);
  const parityCompareState = useAsyncValue(
    () => fetchParityCompare({
      projectId: resonanceProjectId,
      guidedStateId,
      templateLineId,
      screenFamilyRuleId,
      ownerLane,
      selectedScreenId,
      releaseUnitId,
      compareBaseline: "CURRENT_RUNTIME",
      requestedBy: "current-runtime-compare-ui",
      requestedByType: "ADMIN_UI"
    }),
    [
      guidedStateId,
      ownerLane,
      page?.pageId,
      page?.releaseUnitId,
      query.menuCode,
      query.pageId,
      resonanceProjectId,
      screenFamilyRuleId,
      selectedScreenId,
      templateLineId
    ],
    { enabled: pageQueryEnabled && Boolean(selectedScreenId && guidedStateId && templateLineId && screenFamilyRuleId && ownerLane) }
  );
  const [projectPipeline, setProjectPipeline] = useState<ResonanceProjectPipelineResponse | null>(null);
  const [pipelineRunLoading, setPipelineRunLoading] = useState(false);
  const [pipelineRunError, setPipelineRunError] = useState("");
  const [pipelineRunSuccess, setPipelineRunSuccess] = useState("");
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
  const compareRows = parityCompareState.value?.compareTargetSet?.length
    ? mapParityRows(parityCompareState.value.compareTargetSet)
    : fallbackCompareRows;
  const snapshotMatchesPublished = Boolean(snapshotVersionId && snapshotVersionId === String(page?.publishedVersionId || ""));
  const snapshotMatchesDraft = Boolean(snapshotVersionId && snapshotVersionId === String(page?.versionId || ""));
  const snapshotAnchorState = !snapshotVersionId
    ? (en ? "CURRENT" : "현재값")
    : (!focusedSnapshot
      ? (en ? "MISSING" : "누락")
      : (snapshotMatchesPublished ? (en ? "PUBLISHED" : "발행본") : (snapshotMatchesDraft ? (en ? "DRAFT" : "초안") : (en ? "MANUAL" : "수동"))));
  const repairSnapshotFocusMode = snapshotVersionId
    ? (snapshotMatchesPublished
      ? (en ? "published compare anchor" : "발행 비교 앵커")
      : (snapshotMatchesDraft ? (en ? "draft compare anchor" : "초안 비교 앵커") : (en ? "manual snapshot compare" : "수동 스냅샷 비교")))
    : (en ? "latest draft vs published compare" : "최신 초안과 발행본 비교");
  const compareContextStripItems = useMemo(
    () => buildCompareContextStripItems(compareContextKeys, compareRows, releaseUnitId),
    [compareContextKeys, compareRows, releaseUnitId]
  );
  const mismatchCount = compareRows.filter((row) => row.result === "MISMATCH").length;
  const gapCount = compareRows.filter((row) => row.result === "GAP").length;
  const parityScore = parityCompareState.value?.parityScore ?? Math.max(0, 100 - mismatchCount * 10 - gapCount * 15);
  const uniformityScore = parityCompareState.value?.uniformityScore ?? Math.max(0, 100 - mismatchCount * 8 - gapCount * 10);
  const blockerRows: BlockerRow[] = (parityCompareState.value?.blockerSet || []).map((blocker) => ({
    blocker,
    ownerLane,
    source: parityCompareState.value?.traceId || "parity-compare"
  }));
  const repairQueue: RepairQueueEntry[] = (parityCompareState.value?.repairCandidateSet || []).map((candidate) => ({
    candidate,
    guidedStateId,
    templateLineId,
    screenFamilyRuleId,
    ownerLane,
    selectedScreenId
  }));
  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "current-runtime-compare", {
      route: getCurrentRuntimeCompareRoutePath(),
      pageId: page.pageId || "",
      menuCode: page.menuCode || "",
      compareRowCount: compareRows.length,
      currentNodeCount: currentNodes.length,
      generatedNodeCount: generatedNodes.length
    });
    logGovernanceScope("COMPONENT", "current-runtime-compare-table", {
      component: "current-runtime-compare-table",
      compareRowCount: compareRows.length,
      blockerCount: blockerRows.length,
      repairQueueCount: repairQueue.length
    });
  }, [blockerRows.length, compareRows.length, currentNodes.length, generatedNodes.length, page, repairQueue.length]);
  const recentAuditCount = (auditState.value?.items || []).length;
  const latestPublishAudit = (auditState.value?.items || []).find((row) => String(row.actionCode || "").includes("PUBLISH")) || null;
  const verifyClosureRows: VerifyClosureRow[] = [
    {
      label: en ? "menuCode / pageId / menuUrl alignment" : "menuCode / pageId / menuUrl 정렬",
      state: page?.menuCode && selectedScreenId && (page?.menuUrl || query.menuUrl) ? "PASS" : "WARN",
      evidence: `${page?.menuCode || query.menuCode || "-"} / ${selectedScreenId} / ${page?.menuUrl || query.menuUrl || "-"}`
    },
    {
      label: en ? "Governed context keys fixed" : "governed 컨텍스트 키 고정",
      state: guidedStateId !== "-" && templateLineId !== "-" && screenFamilyRuleId !== "-" && ownerLane !== "-" ? "PASS" : "WARN",
      evidence: `${guidedStateId} / ${templateLineId} / ${screenFamilyRuleId} / ${ownerLane}`
    },
    {
      label: en ? "Draft and published versions visible" : "초안 및 발행 버전 가시성",
      state: page?.versionId && page?.publishedVersionId ? "PASS" : "WARN",
      evidence: `${page?.versionId || "-"} / ${page?.publishedVersionId || "-"}`
    },
    {
      label: en ? "Node and event counts comparable" : "노드 및 이벤트 수 비교 가능",
      state: generatedNodes.length > 0 || currentNodes.length > 0 ? "PASS" : "WARN",
      evidence: `${generatedNodes.length}/${currentNodes.length} ${en ? "nodes" : "노드"}, ${generatedEventCount}/${currentEventCount} ${en ? "events" : "이벤트"}`
    },
    {
      label: en ? "Publish or compare evidence attached" : "발행 또는 비교 증거 첨부",
      state: latestPublishAudit || parityCompareState.value?.traceId ? "PASS" : "WARN",
      evidence: latestPublishAudit
        ? `${String(latestPublishAudit.actionCode || "-")} / ${String(latestPublishAudit.createdAt || "-")}`
        : (parityCompareState.value?.traceId || "-")
    },
    {
      label: en ? "08 deploy evidence attached" : "08 배포 증거 첨부",
      state: deployEvidence.releaseUnitId !== "-" && deployEvidence.runtimePackageId !== "-" && deployEvidence.deployTraceId !== "-" ? "PASS" : "WARN",
      evidence: `${deployEvidence.releaseUnitId} / ${deployEvidence.runtimePackageId} / ${deployEvidence.deployTraceId} / ${deployEvidence.rollbackAnchorYn}`
    }
  ];
  const repairPayloadItems = [
    { label: "projectId", value: resonanceProjectId },
    { label: "releaseUnitId", value: deployEvidence.releaseUnitId },
    { label: "runtimePackageId", value: deployEvidence.runtimePackageId },
    { label: "deployTraceId", value: deployEvidence.deployTraceId },
    { label: "rollbackAnchorYn", value: deployEvidence.rollbackAnchorYn },
    { label: "selectedScreenId", value: selectedScreenId },
    { label: "guidedStateId", value: guidedStateId },
    { label: "templateLineId", value: templateLineId },
    { label: "screenFamilyRuleId", value: screenFamilyRuleId },
    { label: "ownerLane", value: ownerLane },
    { label: "deployEvidence.ownerLane", value: deployEvidence.ownerLane },
    { label: "compareBaseline", value: parityCompareState.value?.compareBaseline || "CURRENT_RUNTIME" },
    { label: "builderInput.builderId", value: page?.builderId || "-" },
    { label: "builderInput.draftVersionId", value: page?.versionId || "-" },
    { label: "builderInput.menuCode", value: page?.menuCode || query.menuCode || "-" },
    { label: "builderInput.pageId", value: page?.pageId || query.pageId || "-" },
    { label: "builderInput.menuUrl", value: page?.menuUrl || query.menuUrl || "-" },
    { label: "runtimeEvidence.publishedVersionId", value: stringifyValue(artifactEvidence?.publishedVersionId, page?.publishedVersionId || "-") },
    { label: "runtimeEvidence.currentNodeCount", value: String(currentNodes.length) },
    { label: "runtimeEvidence.currentEventCount", value: String(currentEventCount) },
    { label: "publishEvidence", value: latestPublishAudit ? `${String(latestPublishAudit.actionCode || "-")} / ${String(latestPublishAudit.createdAt || "-")}` : "-" },
    { label: "compareTraceId", value: parityCompareState.value?.traceId || "-" },
    { label: en ? "blockerSet" : "blockerSet", value: blockerRows.length ? blockerRows.map((row) => row.blocker).join(", ") : "-" },
    { label: en ? "repairCandidateSet" : "repairCandidateSet", value: repairQueue.length ? repairQueue.map((row) => row.candidate).join(", ") : "-" }
  ];
  const smokeReadinessItems = [
    { label: en ? "Snapshot Anchor State" : "스냅샷 앵커 상태", value: snapshotAnchorState },
    { label: en ? "Parity Score" : "정합성 점수", value: `${parityScore}%` },
    { label: en ? "Uniformity Score" : "일관성 점수", value: `${uniformityScore}%` },
    { label: en ? "Current Result" : "현재 결과", value: parityCompareState.value?.result || "-" },
    { label: en ? "Open Blockers" : "열린 차단 항목", value: String(blockerRows.length) },
    { label: en ? "Repair Queue" : "복구 큐", value: String(repairQueue.length) },
    { label: "runtimePackageId", value: deployEvidence.runtimePackageId },
    { label: "deployTraceId", value: deployEvidence.deployTraceId },
    { label: en ? "Publish Evidence" : "발행 증거", value: latestPublishAudit ? `${String(latestPublishAudit.actionCode || "-")} / ${String(latestPublishAudit.createdAt || "-")}` : "-" },
    { label: en ? "Compare Trace" : "비교 추적", value: parityCompareState.value?.traceId || "-" },
    { label: en ? "Smoke Gate" : "스모크 게이트", value: blockerRows.length === 0 && Boolean(latestPublishAudit || parityCompareState.value?.traceId) ? "READY_FOR_SMOKE" : "BLOCKED_BY_COMPARE" }
  ];
  const firstUnfinishedBlocker = blockerRows[0]?.blocker || "";
  const firstRepairCandidate = repairQueue[0]?.candidate || "";
  const loopStatusItems: LoopStatusItem[] = [
    { label: en ? "Loop Cadence" : "루프 주기", value: en ? "60 seconds" : "60초" },
    {
      label: en ? "Loop Mode" : "루프 모드",
      value: firstUnfinishedBlocker || firstRepairCandidate ? "CONTINUE_UNFINISHED" : "RERUN_SCOPE"
    },
    {
      label: en ? "Last Unfinished Scope" : "마지막 미완료 범위",
      value: firstUnfinishedBlocker || firstRepairCandidate || (en ? "smoke-readiness review" : "스모크 준비 상태 재점검")
    },
    {
      label: en ? "Recovery Order" : "복구 순서",
      value: en
        ? "session alive -> recover last unfinished compare item -> continue repair queue -> rerun full compare scope"
        : "세션 생존 확인 -> 마지막 미완료 compare 항목 복구 -> repair 큐 이어서 진행 -> 전체 compare 범위 재실행"
    },
    {
      label: en ? "Next Recheck Entry" : "다음 재점검 시작점",
      value: firstUnfinishedBlocker || firstRepairCandidate || (compareRows[0]?.label || "-")
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
  const pipelinePromotionSummary = useMemo(() => {
    const counts = new Map<string, number>();
    pipelineServerStateRows.forEach((item) => {
      const promotionState = stringifyValue(toRecord(item).promotionState, "UNKNOWN");
      counts.set(promotionState, (counts.get(promotionState) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([state, count]) => `${state} ${count}`).join(" / ");
  }, [pipelineServerStateRows]);
  const promotedServerCount = useMemo(
    () => pipelineServerStateRows.filter((item) => stringifyValue(toRecord(item).promotionState).toUpperCase().includes("PROMOTED")).length,
    [pipelineServerStateRows]
  );
  const pendingServerCount = useMemo(
    () => pipelineServerStateRows.filter((item) => {
      const promotionState = stringifyValue(toRecord(item).promotionState).toUpperCase();
      return promotionState.includes("PENDING") || promotionState.includes("TARGET");
    }).length,
    [pipelineServerStateRows]
  );
  const rollbackAnchorState = stringifyValue(pipelineRollbackPlan.rollbackTargetReleaseUnitId);
  const primaryRoute = useMemo(
    () => pipelineDeploymentRoutes.find((item) => normalizePipelineRole(toRecord(item).serverRole) === "PRIMARY"),
    [pipelineDeploymentRoutes]
  );
  async function handleRunProjectPipeline() {
    if (!runtimeCompareAuthority.allowsAction("execute")) {
      runtimeCompareAuthority.logAuthorityDenied("execute", { component: "current-runtime-compare-run-pipeline", menuCode: page?.menuCode || query.menuCode });
      setPipelineRunError(runtimeCompareAuthority.getActionReason("execute", en));
      return;
    }
    setPipelineRunLoading(true);
    setPipelineRunError("");
    setPipelineRunSuccess("");
    try {
      const response = await runProjectPipeline({
        projectId: resonanceProjectId,
        scenarioId: guidedStateId !== "-" ? guidedStateId : undefined,
        guidedStateId: guidedStateId !== "-" ? guidedStateId : undefined,
        templateLineId: templateLineId !== "-" ? templateLineId : undefined,
        screenFamilyRuleId: screenFamilyRuleId !== "-" ? screenFamilyRuleId : undefined,
        ownerLane: ownerLane !== "-" ? ownerLane : undefined,
        menuRoot: page?.menuCode || query.menuCode || query.pageId || selectedScreenId,
        runtimeClass: selectedScreenId,
        menuScope: stringifyValue(page?.authorityProfile?.scopePolicy, "ADMIN"),
        releaseUnitPrefix: "release-unit",
        runtimePackagePrefix: "runtime-package",
        artifactTargetSystem: "carbonet-general",
        deploymentTarget: "ops-runtime",
        operator: "current-runtime-compare-ui"
      });
      setProjectPipeline(response);
      setPipelineRunSuccess(en ? "Project pipeline run recorded." : "프로젝트 파이프라인 실행 결과를 기록했습니다.");
      pipelineStatusState.setError("");
    } catch (error) {
      setPipelineRunError(error instanceof Error ? error.message : (en ? "Failed to run project pipeline." : "프로젝트 파이프라인 실행에 실패했습니다."));
    } finally {
      setPipelineRunLoading(false);
    }
  }

  async function handleRefreshProjectPipeline() {
    if (!runtimeCompareAuthority.allowsAction("query")) {
      runtimeCompareAuthority.logAuthorityDenied("query", { component: "current-runtime-compare-refresh-pipeline", menuCode: page?.menuCode || query.menuCode });
      setPipelineRunError(runtimeCompareAuthority.getActionReason("query", en));
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
        { label: en ? "Repair Validator Console" : "복구 검증 콘솔" }
      ]}
      title={en ? "Repair Validator Console" : "복구 검증 콘솔"}
      subtitle={en ? "Validate repair readiness by comparing the published runtime against the current generated snapshot and governed baseline." : "발행 런타임을 현재 생성 스냅샷 및 governed baseline과 비교해 복구 준비 상태를 검증합니다."}
      contextStrip={<ContextKeyStrip items={compareContextStripItems} />}
      loading={(commandState.loading && !commandState.value) || (pageState.loading && !page) || (currentPreviewState.loading && !currentPreview)}
      loadingLabel={en ? "Loading runtime compare..." : "런타임 비교를 불러오는 중입니다."}
    >
      {commandState.error || pageState.error || currentPreviewState.error || publishedPreviewState.error || parityCompareState.error ? (
        <PageStatusNotice tone="error">
          {commandState.error || pageState.error || currentPreviewState.error || publishedPreviewState.error || parityCompareState.error}
        </PageStatusNotice>
      ) : null}
      {pipelineRunError ? <PageStatusNotice tone="error">{pipelineRunError}</PageStatusNotice> : null}
      {pipelineRunSuccess ? <PageStatusNotice tone="success">{pipelineRunSuccess}</PageStatusNotice> : null}
      {snapshotVersionId ? (
        <PageStatusNotice tone="success">
          {en ? `Snapshot focus: ${snapshotVersionId}` : `현재 검증 스냅샷: ${snapshotVersionId}`}
        </PageStatusNotice>
      ) : null}
      {snapshotVersionId && !focusedSnapshot ? (
        <PageStatusNotice tone="warning">
          {en
            ? "The focused snapshot was not found in the current snapshot registry. Treat compare evidence as unanchored until the snapshot history is restored."
            : "현재 스냅샷 레지스트리에서 포커스 스냅샷을 찾지 못했습니다. 스냅샷 이력이 복구되기 전까지 compare 증거를 비앵커 상태로 취급해야 합니다."}
        </PageStatusNotice>
      ) : null}
      {snapshotVersionId && !snapshotMatchesPublished && !snapshotMatchesDraft ? (
        <PageStatusNotice tone="warning">
          {en
            ? "This compare console is anchored to a snapshot that is neither the current draft nor the current published version. Treat compare evidence as manual snapshot review until one of those anchors matches."
            : "현재 비교 콘솔은 최신 초안이나 최신 발행본과 일치하지 않는 스냅샷을 기준으로 보고 있습니다. 둘 중 하나와 일치하기 전까지는 수동 스냅샷 검토로 취급해야 합니다."}
        </PageStatusNotice>
      ) : null}

      {!page?.publishedVersionId ? (
        <PageStatusNotice tone="warning">
          {en
            ? "No published runtime snapshot exists yet. Compare results are limited until a publish snapshot is available."
            : "아직 발행된 런타임 스냅샷이 없습니다. publish 스냅샷이 생기기 전까지 비교 결과가 제한됩니다."}
        </PageStatusNotice>
      ) : null}

      <AdminWorkspacePageFrame>
        {pagePermissionDenied ? (
          <MemberStateCard
            description={en
              ? `You need ${runtimeCompareAuthority.requiredViewFeatureCode || `${commandState.value?.page?.menuPermission?.menuCode || page?.menuCode || query.menuCode}_VIEW`} permission to open current runtime compare for this page.`
              : `이 페이지의 현재 런타임 비교 화면을 열려면 ${runtimeCompareAuthority.requiredViewFeatureCode || `${commandState.value?.page?.menuPermission?.menuCode || page?.menuCode || query.menuCode}_VIEW`} 권한이 필요합니다.`}
            icon="lock"
            title={en ? "Permission denied." : "권한이 없습니다."}
            tone="danger"
          />
        ) : null}
        {pagePermissionDenied ? null : (
        <>
        {snapshotVersionId ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-4" data-help-id="runtime-compare-snapshot-focus">
            <SummaryMetricCard
              title={en ? "Snapshot Focus" : "스냅샷 포커스"}
              value={snapshotVersionId}
              description={en ? "Repair validator target snapshot" : "현재 복구 검증 대상 스냅샷"}
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
              title={en ? "Focus Mode" : "포커스 모드"}
              value={snapshotMatchesPublished ? (en ? "published compare" : "발행 비교") : (snapshotMatchesDraft ? (en ? "draft compare" : "초안 비교") : (en ? "manual snapshot compare" : "수동 스냅샷 비교"))}
              description={en ? "Current repair validator source" : "현재 복구 검증 소스"}
            />
          </section>
        ) : null}
        {snapshotVersionId && focusedSnapshot ? (
          <div data-help-id="runtime-compare-focused-snapshot-evidence">
            <KeyValueGridPanel
              title={en ? "Focused Snapshot Evidence" : "포커스 스냅샷 증거"}
              description={en ? "This snapshot registry row is the current compare anchor between draft, published runtime, and governed baseline." : "이 스냅샷 레지스트리 행은 현재 초안, 발행 런타임, governed baseline 사이의 compare 앵커입니다."}
              items={[
                { label: en ? "Snapshot Version" : "스냅샷 버전", value: String(focusedSnapshot.versionId || "-") },
                { label: en ? "Snapshot Status" : "스냅샷 상태", value: String(focusedSnapshot.versionStatus || "-") },
                { label: en ? "Saved At" : "저장 시각", value: String(focusedSnapshot.savedAt || "-") },
                { label: en ? "Template Type" : "템플릿 타입", value: String(focusedSnapshot.templateType || "-") },
                { label: en ? "Node Count" : "노드 수", value: String(focusedSnapshot.nodeCount || 0) },
                { label: en ? "Event Count" : "이벤트 수", value: String(focusedSnapshot.eventCount || 0) },
                { label: en ? "Anchor Match" : "앵커 일치", value: snapshotMatchesPublished ? (en ? "PUBLISHED" : "발행본") : (snapshotMatchesDraft ? (en ? "DRAFT" : "초안") : (en ? "MANUAL" : "수동")) },
                { label: en ? "Compare Trace" : "비교 추적", value: parityCompareState.value?.traceId || "-" }
              ]}
            />
          </div>
        ) : null}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="runtime-compare-metrics">
          <SummaryMetricCard
            title={en ? "Pipeline Promotion" : "파이프라인 승격"}
            value={projectPipeline ? `${promotedServerCount}/${pipelineServerStateRows.length || 0}` : `${parityScore}%`}
            description={projectPipeline ? (pipelinePromotionSummary || (en ? "Promotion summary unavailable" : "승격 요약 없음")) : (en ? "Current compare score" : "현재 compare 점수")}
          />
          <SummaryMetricCard
            title={en ? "Validator Closure" : "검증 종료"}
            value={projectPipeline ? `${projectPipeline.validatorPassCount}/${projectPipeline.validatorTotalCount}` : `${uniformityScore}%`}
            description={projectPipeline ? (en ? "Validator pass ratio" : "검증 통과 비율") : (en ? "Uniformity closure" : "uniformity 종료 기준")}
          />
          <SummaryMetricCard
            title={en ? "Release Drift" : "릴리스 드리프트"}
            value={projectPipeline ? pendingServerCount : mismatchCount}
            description={projectPipeline ? (en ? "Servers still pending target promotion" : "목표 승격 전 서버 수") : (en ? "Current vs generated vs baseline" : "current / generated / baseline 비교")}
            accentClassName="text-red-700"
            surfaceClassName="bg-red-50"
          />
          <SummaryMetricCard
            title={en ? "Rollback Anchor" : "롤백 앵커"}
            value={projectPipeline ? rollbackAnchorState : repairQueue.length}
            description={projectPipeline
              ? `${stringifyValue(toRecord(primaryRoute).serverId)} / ${stringifyValue(toRecord(primaryRoute).promotionState)}`
              : (en ? "Queue-ready compare targets" : "큐에 올릴 수 있는 비교 대상")}
          />
        </section>

        <div className="overflow-hidden rounded-2xl border border-[var(--kr-gov-border)] bg-white shadow-sm" data-help-id="runtime-compare-project-pipeline">
          <GridToolbar
            title={en ? "Project Pipeline Control Plane" : "프로젝트 파이프라인 컨트롤 플레인"}
            meta={en
              ? "Lock projectId-scoped scaffold, validator, package, deploy, and rollback evidence from the current compare scope."
              : "현재 compare 범위에서 projectId 기준 scaffold, validator, package, deploy, rollback 증거를 고정합니다."}
            actions={(
              <div className="flex flex-wrap gap-2">
                <MemberPermissionButton allowed={runtimeCompareAuthority.allowsAction("query")} disabled={pipelineRunLoading} onClick={handleRefreshProjectPipeline} reason={runtimeCompareAuthority.getActionReason("query", en)} size="sm" type="button" variant="secondary">
                  {pipelineStatusState.loading ? (en ? "Loading..." : "불러오는 중...") : (en ? "Load Latest" : "최신 실행 조회")}
                </MemberPermissionButton>
                <MemberPermissionButton allowed={runtimeCompareAuthority.allowsAction("execute")} disabled={pipelineRunLoading} onClick={handleRunProjectPipeline} reason={runtimeCompareAuthority.getActionReason("execute", en)} size="sm" type="button" variant="primary">
                  {pipelineRunLoading ? (en ? "Running..." : "실행 중...") : (en ? "Run Pipeline" : "파이프라인 실행")}
                </MemberPermissionButton>
              </div>
            )}
          />
          <div className="space-y-6 px-6 py-5">
            <KeyValueGridPanel
              title={en ? "Pipeline Summary" : "파이프라인 요약"}
              description={en
                ? "This snapshot binds the current runtime compare scope to an installable product and artifact-centered deployment contract."
                : "이 스냅샷은 현재 runtime compare 범위를 installable product와 artifact 중심 배포 계약으로 묶습니다."}
              items={[
                { label: "projectId", value: resonanceProjectId },
                { label: "pipelineRunId", value: projectPipeline?.pipelineRunId || "-" },
                { label: "releaseUnitId", value: projectPipeline?.releaseUnitId || "-" },
                { label: "runtimePackageId", value: projectPipeline?.runtimePackageId || "-" },
                { label: "deployTraceId", value: projectPipeline?.deployTraceId || "-" },
                { label: en ? "Pipeline Result" : "파이프라인 결과", value: projectPipeline?.result || "-" },
                { label: en ? "Validator Pass" : "검증 통과", value: projectPipeline ? `${projectPipeline.validatorPassCount}/${projectPipeline.validatorTotalCount}` : "-" },
                { label: en ? "Deploy Mode" : "배포 모드", value: stringifyValue(pipelineDeployContract.deploymentMode) },
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
                  { label: "menuBinding.projectId", value: stringifyValue(toRecord(pipelineInstallableProduct.menuBinding).projectId) },
                  { label: "menuBinding.menuRoot", value: stringifyValue(toRecord(pipelineInstallableProduct.menuBinding).menuRoot) },
                  { label: "menuBinding.runtimeClass", value: stringifyValue(toRecord(pipelineInstallableProduct.menuBinding).runtimeClass) },
                  { label: "menuBinding.menuScope", value: stringifyValue(toRecord(pipelineInstallableProduct.menuBinding).menuScope) }
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
                  { label: "releaseUnitId", value: stringifyValue(pipelineDeployContract.releaseUnitId) },
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

        <div data-help-id="runtime-compare-scope">
          <KeyValueGridPanel
            description={en ? "Baseline values are derived from the governed context keys for the current lane." : "baseline 값은 현재 레인의 governed context key 기준으로 계산합니다."}
            items={[
              { label: en ? "Focus Snapshot" : "포커스 스냅샷", value: snapshotVersionId || "-" },
              { label: en ? "Anchor State" : "앵커 상태", value: snapshotAnchorState },
              { label: en ? "Focus Mode" : "포커스 모드", value: repairSnapshotFocusMode },
              { label: en ? "Menu Code" : "메뉴 코드", value: page?.menuCode || query.menuCode || "-" },
              { label: "pageId", value: page?.pageId || query.pageId || "-" },
              { label: en ? "Published Version" : "발행 버전", value: page?.publishedVersionId || "-" },
              { label: en ? "Draft Version" : "초안 버전", value: page?.versionId || "-" },
              { label: en ? "Runtime URL" : "런타임 URL", value: page?.menuUrl || query.menuUrl || "-" },
              { label: en ? "Latest Publish" : "최근 발행", value: latestPublishAudit ? String(latestPublishAudit.createdAt || "-") : "-" },
              { label: en ? "Compare Context" : "비교 컨텍스트", value: parityCompareState.value?.compareContextId || "-" },
              { label: en ? "Parity Result" : "정합성 결과", value: parityCompareState.value?.result || "-" },
              { label: en ? "Blocker Count" : "차단 항목 수", value: String(blockerRows.length) },
              { label: en ? "Repair Queue" : "복구 큐", value: String(repairQueue.length) }
            ]}
            title={en ? "Repair Validator Scope" : "복구 검증 범위"}
          />
        </div>

        <div data-help-id="runtime-compare-linkage">
          <KeyValueGridPanel
            description={en ? "This panel closes the verify handoff between the builder lane input and the frontend runtime evidence used for compare and repair." : "이 패널은 compare/repair에 사용하는 빌더 레인 입력물과 프런트엔드 런타임 증거 사이의 verify handoff를 닫습니다."}
            items={[
              { label: en ? "Focus Snapshot" : "포커스 스냅샷", value: snapshotVersionId || "-" },
              { label: en ? "Focus Mode" : "포커스 모드", value: repairSnapshotFocusMode },
              { label: en ? "Snapshot Anchor Match" : "스냅샷 앵커 일치", value: snapshotAnchorState },
              { label: en ? "Builder Id" : "빌더 ID", value: page?.builderId || "-" },
              { label: en ? "Builder Draft" : "빌더 초안", value: page?.versionId || "-" },
              { label: en ? "Published Runtime" : "발행 런타임", value: page?.publishedVersionId || "-" },
              { label: en ? "Published At" : "발행 시각", value: page?.publishedSavedAt || "-" },
              { label: en ? "Generated Nodes" : "생성 노드 수", value: formatCountLabel(generatedNodes.length, en ? "node" : "개", en ? "nodes" : "개") },
              { label: en ? "Current Nodes" : "현재 노드 수", value: formatCountLabel(currentNodes.length, en ? "node" : "개", en ? "nodes" : "개") },
              { label: en ? "Generated Events" : "생성 이벤트 수", value: formatCountLabel(generatedEventCount, en ? "event" : "개", en ? "events" : "개") },
              { label: en ? "Current Events" : "현재 이벤트 수", value: formatCountLabel(currentEventCount, en ? "event" : "개", en ? "events" : "개") },
              { label: en ? "Generated Registry Issues" : "생성 레지스트리 이슈", value: String(generatedIssueCount) },
              { label: en ? "Current Registry Issues" : "현재 레지스트리 이슈", value: String(currentIssueCount) }
            ]}
            title={en ? "Validator Evidence Handoff" : "검증 증거 인계"}
          />
        </div>

        <div data-help-id="runtime-compare-deploy-evidence">
          <KeyValueGridPanel
            description={en ? "Lane 09 must preserve the latest 08 deploy evidence without renaming these fields before repair or handoff." : "09 레인은 repair나 handoff 전에 최신 08 배포 증거를 이 필드 이름 그대로 유지해야 합니다."}
            items={[
              { label: en ? "Focus Snapshot" : "포커스 스냅샷", value: snapshotVersionId || "-" },
              { label: "releaseUnitId", value: deployEvidence.releaseUnitId },
              { label: "runtimePackageId", value: deployEvidence.runtimePackageId },
              { label: "deployTraceId", value: deployEvidence.deployTraceId },
              { label: "ownerLane", value: deployEvidence.ownerLane },
              { label: "rollbackAnchorYn", value: deployEvidence.rollbackAnchorYn }
            ]}
            title={en ? "Install Deploy Evidence" : "설치 배포 증거"}
          />
        </div>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-help-id="runtime-compare-operator-flow">
          <KeyValueGridPanel
            title={en ? "Operator Flow Closure" : "운영자 플로우 종료 기준"}
            description={en ? "Current runtime compare closes deploy freshness into a governed compare handoff for the screen-builder pilot family." : "current runtime compare는 screen-builder pilot family에서 deploy freshness를 governed compare handoff로 닫습니다."}
            items={[
              { label: "pageFamily", value: "screen-builder" },
              { label: "installScope", value: "COMMON_DEF_PROJECT_BIND" },
              { label: en ? "Runtime Target" : "런타임 대상", value: operatorFlowPaths.runtime },
              { label: en ? "Compare Target" : "비교 대상", value: operatorFlowPaths.compare },
              { label: en ? "Repair Target" : "복구 대상", value: operatorFlowPaths.repair },
              { label: en ? "Release Evidence" : "릴리즈 증거", value: `${deployEvidence.releaseUnitId} / ${deployEvidence.runtimePackageId} / ${deployEvidence.deployTraceId}` },
              { label: en ? "Rollback Anchor" : "롤백 앵커", value: deployEvidence.rollbackAnchorYn },
              { label: en ? "Compare Trace" : "비교 추적", value: parityCompareState.value?.traceId || "-" }
            ]}
          />
          <KeyValueGridPanel
            title={en ? "Deploy / Freshness / Route Verify Commands" : "배포 / freshness / 라우트 검증 명령"}
            description={en ? "Run this sequence before opening repair so install/deploy closeout and runtime verification remain explicit." : "repair를 열기 전에 이 순서를 사용해 install/deploy closeout과 runtime verification을 명시 상태로 유지합니다."}
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

        <div data-help-id="runtime-compare-smoke-readiness">
          <KeyValueGridPanel
            description={en ? "This checklist maps parity and smoke closure directly to compare response fields and publish evidence." : "이 체크리스트는 parity 및 smoke 종료 기준을 compare 응답 필드와 publish 증거에 직접 매핑합니다."}
            items={smokeReadinessItems}
            title={en ? "Validator Gate Readiness" : "검증 게이트 준비 상태"}
          />
        </div>

        <div data-help-id="runtime-compare-loop-status">
          <KeyValueGridPanel
            description={en ? "Use the same lane-09 repeat order every minute: recover the last unfinished compare item first, then rerun only when the unfinished scope is closed." : "1분마다 같은 09 레인 반복 순서를 유지합니다. 마지막 미완료 compare 항목을 먼저 복구하고, 그 범위가 닫힌 뒤에만 재실행합니다."}
            items={loopStatusItems}
            title={en ? "Repair Loop Continuation" : "복구 루프 이어가기"}
          />
        </div>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="gov-card overflow-hidden p-0" data-help-id="runtime-compare-verify-closure">
            <GridToolbar
              meta={en ? "These checks close the 04 builder input and 05 runtime evidence into one verify handoff." : "이 체크는 04 빌더 입력물과 05 런타임 증거를 하나의 verify handoff로 닫습니다."}
              title={en ? "Validator Closure" : "검증 종료 기준"}
            />
            {snapshotVersionId ? (
              <div className={`border-b px-5 py-3 text-sm ${snapshotAnchorState === (en ? "PUBLISHED" : "발행본") || snapshotAnchorState === (en ? "DRAFT" : "초안") ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                <span className="font-bold">{en ? "Closure anchor" : "종료 기준 앵커"}</span>
                {`: ${snapshotVersionId} / ${snapshotAnchorState} / ${repairSnapshotFocusMode}`}
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)]">
                <thead className="bg-slate-50 text-left text-[12px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                  <tr>
                    <th className="px-5 py-4">{en ? "Check" : "체크"}</th>
                    <th className="px-5 py-4">{en ? "State" : "상태"}</th>
                    <th className="px-5 py-4">{en ? "Evidence" : "근거"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white text-sm">
                  {verifyClosureRows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-5 py-4 font-bold text-[var(--kr-gov-text-primary)]">{row.label}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${row.state === "PASS" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                          {row.state}
                        </span>
                      </td>
                      <td className="px-5 py-4">{row.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div data-help-id="runtime-compare-repair-payload">
            <KeyValueGridPanel
              description={en ? "Use this payload preview to open repair without renaming governed keys from the compare scope." : "이 payload 미리보기는 compare 범위의 governed key를 바꾸지 않고 repair를 열기 위한 기준입니다."}
              items={repairPayloadItems}
              title={en ? "Repair Handoff Payload" : "복구 인계 페이로드"}
            />
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="runtime-compare-matrix">
          <GridToolbar
            actions={(
              <>
                <MemberLinkButton
                  href={buildRepairWorkbenchPath({
                    menuCode: page?.menuCode || query.menuCode,
                    pageId: page?.pageId || query.pageId,
                    menuTitle: page?.menuTitle || query.menuTitle,
                    menuUrl: page?.menuUrl || query.menuUrl
                  })}
                  size="sm"
                  variant="secondary"
                >
                  {en ? "Open Repair" : "복구 열기"}
                </MemberLinkButton>
                <MemberLinkButton
                  href={buildScreenRuntimePath({
                    menuCode: page?.menuCode || query.menuCode,
                    pageId: page?.pageId || query.pageId,
                    menuTitle: page?.menuTitle || query.menuTitle,
                    menuUrl: page?.menuUrl || query.menuUrl
                  })}
                  size="sm"
                  variant="secondary"
                >
                  {en ? "Open Runtime" : "런타임 열기"}
                </MemberLinkButton>
                <MemberLinkButton
                  href={buildObservabilityPath({
                    menuCode: page?.menuCode || query.menuCode,
                    pageId: page?.pageId || query.pageId,
                    searchKeyword: "SCREEN_BUILDER_"
                  })}
                  size="sm"
                  variant="secondary"
                >
                  {en ? "Open Observability" : "Observability 열기"}
                </MemberLinkButton>
              </>
            )}
            meta={en ? "Published runtime is treated as current evidence; the draft builder snapshot is used as the generated target." : "발행 런타임을 current evidence로, 현재 빌더 스냅샷을 generated target으로 사용합니다."}
            title={en ? "Repair Validator Matrix" : "복구 검증 매트릭스"}
          />
          {snapshotVersionId ? (
            <div className={`border-b px-5 py-3 text-sm ${snapshotAnchorState === (en ? "PUBLISHED" : "발행본") || snapshotAnchorState === (en ? "DRAFT" : "초안") ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <span className="font-bold">{en ? "Matrix anchor" : "매트릭스 앵커"}</span>
              {`: ${snapshotVersionId} / ${snapshotAnchorState} / ${repairSnapshotFocusMode}`}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)]">
              <thead className="bg-slate-50 text-left text-[12px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                <tr>
                  <th className="px-5 py-4">{en ? "Target" : "대상"}</th>
                  <th className="px-5 py-4">{en ? "Current Runtime" : "현재 런타임"}</th>
                  <th className="px-5 py-4">{en ? "Generated" : "생성 결과"}</th>
                  <th className="px-5 py-4">{en ? "Baseline" : "기준선"}</th>
                  <th className="px-5 py-4">{en ? "Patch Target" : "패치 대상"}</th>
                  <th className="px-5 py-4">{en ? "Result" : "결과"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white text-sm">
                {compareRows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-5 py-4 font-bold text-[var(--kr-gov-text-primary)]">{row.label}</td>
                    <td className="px-5 py-4">{row.current}</td>
                    <td className="px-5 py-4">{row.generated}</td>
                    <td className="px-5 py-4">{row.baseline}</td>
                    <td className="px-5 py-4">{row.patchTarget}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${resultChipClassName(row.result)}`}>
                        {row.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="gov-card overflow-hidden p-0" data-help-id="runtime-compare-events">
          <GridToolbar
            meta={en ? "Latest compare-linked publish evidence and recent builder activity." : "비교와 연결된 최근 publish 증거와 빌더 활동입니다."}
            title={en ? "Recent Validator Events" : "최근 검증 이벤트"}
          />
          <div className="divide-y divide-[var(--kr-gov-border-light)] bg-white">
            <div className="px-5 py-4 text-sm">
              <p className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Latest Publish Evidence" : "최근 발행 증거"}</p>
              <p className="mt-1 text-[var(--kr-gov-text-secondary)]">
                {latestPublishAudit
                  ? `${String(latestPublishAudit.actionCode || "-")} / ${String(latestPublishAudit.createdAt || "-")}`
                  : (en ? "No publish audit was found yet." : "아직 publish audit 이력이 없습니다.")}
              </p>
            </div>
            <div className="px-5 py-4 text-sm">
              <p className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Recent Builder Event Count" : "최근 빌더 이벤트 수"}</p>
              <p className="mt-1 text-[var(--kr-gov-text-secondary)]">
                {recentAuditCount} {en ? "event(s) linked to this compare scope." : "건의 이벤트가 현재 비교 범위에 연결되어 있습니다."}
              </p>
            </div>
            <div className="px-5 py-4 text-sm">
              <p className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Parity Trace" : "정합성 추적"}</p>
              <p className="mt-1 text-[var(--kr-gov-text-secondary)]">
                {parityCompareState.value?.traceId
                  ? `${String(parityCompareState.value.traceId)} / ${String(parityCompareState.value.occurredAt || "-")}`
                  : (en ? "No parity trace was recorded yet." : "아직 정합성 추적 이력이 없습니다.")}
              </p>
            </div>
          </div>
        </section>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="gov-card overflow-hidden p-0" data-help-id="runtime-compare-blockers">
            <GridToolbar
              meta={en ? "Blockers must keep the verify lane owner before handoff." : "차단 항목은 인계 전까지 verify owner lane을 유지해야 합니다."}
              title={en ? "Install Blocker List" : "설치 차단 항목 목록"}
            />
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)]">
                <thead className="bg-slate-50 text-left text-[12px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                  <tr>
                    <th className="px-5 py-4">{en ? "Blocker" : "차단 항목"}</th>
                    <th className="px-5 py-4">{en ? "Owner Lane" : "소유 레인"}</th>
                    <th className="px-5 py-4">{en ? "Source" : "출처"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white text-sm">
                  {blockerRows.length ? blockerRows.map((row) => (
                    <tr key={row.blocker}>
                      <td className="px-5 py-4 font-bold text-[var(--kr-gov-text-primary)]">{row.blocker}</td>
                      <td className="px-5 py-4">{row.ownerLane}</td>
                      <td className="px-5 py-4">{row.source}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="px-5 py-4 text-[var(--kr-gov-text-secondary)]" colSpan={3}>
                        {en ? "No blocking gaps were returned for the current compare scope." : "현재 비교 범위에는 차단 항목이 없습니다."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="gov-card overflow-hidden p-0" data-help-id="runtime-compare-repair-queue">
            <GridToolbar
              meta={en ? "Repair queue rows keep governed identity keys for repair/open handoff." : "복구 큐 행은 repair/open 인계를 위해 governed identity key를 유지합니다."}
              title={en ? "Repair Validator Queue" : "복구 검증 큐"}
            />
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)]">
                <thead className="bg-slate-50 text-left text-[12px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                  <tr>
                    <th className="px-5 py-4">{en ? "Candidate" : "후보"}</th>
                    <th className="px-5 py-4">guidedStateId</th>
                    <th className="px-5 py-4">templateLineId</th>
                    <th className="px-5 py-4">screenFamilyRuleId</th>
                    <th className="px-5 py-4">{en ? "Owner Lane" : "소유 레인"}</th>
                    <th className="px-5 py-4">{en ? "Selected Screen" : "선택 화면"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white text-sm">
                  {repairQueue.length ? repairQueue.map((row) => (
                  <tr key={row.candidate}>
                      <td className="px-5 py-4 font-bold text-[var(--kr-gov-text-primary)]">{row.candidate}</td>
                      <td className="px-5 py-4">{row.guidedStateId}</td>
                      <td className="px-5 py-4">{row.templateLineId}</td>
                      <td className="px-5 py-4">{row.screenFamilyRuleId}</td>
                      <td className="px-5 py-4">{row.ownerLane}</td>
                      <td className="px-5 py-4 font-mono">{row.selectedScreenId}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="px-5 py-4 text-[var(--kr-gov-text-secondary)]" colSpan={6}>
                        {en ? "No repair candidates were returned yet for this compare target." : "이 비교 대상에는 아직 복구 후보가 없습니다."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
        </>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
