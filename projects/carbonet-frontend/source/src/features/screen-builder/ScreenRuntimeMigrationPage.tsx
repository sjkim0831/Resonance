import { useMemo } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { resolveAuthorityScope } from "../../app/policy/authorityScope";
import { getCurrentRuntimePathname, getCurrentRuntimeSearch } from "../../app/routes/runtime";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchAuditEvents } from "../../platform/observability/observability";
import { buildObservabilityPath } from "../../platform/routes/platformPaths";
import { fetchScreenBuilderPage, fetchScreenBuilderPreview, fetchScreenCommandPage } from "../../lib/api/platform";
import type { ScreenCommandPagePayload } from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { ContextKeyStrip } from "../admin-ui/ContextKeyStrip";
import { CopyableCodeBlock, DiagnosticCard, GridToolbar, KeyValueGridPanel, MemberLinkButton, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { resolveRuntimeSurfaceContextKeys } from "../admin-ui/contextKeyPresets";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { MemberStateCard } from "../member/sections";
import { renderScreenBuilderNodePreview } from "./shared/screenBuilderPreview";
import { resolveScreenBuilderQuery, sortScreenBuilderNodes } from "./shared/screenBuilderUtils";
import { buildScreenBuilderOperatorFlowPaths, buildScreenBuilderOperatorFlowSteps, buildScreenBuilderRuntimeVerificationCommand } from "./operatorFlow";
import { buildEnvironmentManagementPath, buildScreenBuilderPath } from "./screenBuilderPaths";
import { useEffect } from "react";

function stringifyValue(value: unknown, empty = "-") {
  const normalized = String(value || "").trim();
  return normalized || empty;
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getScreenRuntimeRoutePath() {
  return getCurrentRuntimePathname();
}

function getScreenRuntimeSearchParam(name: string) {
  return new URLSearchParams(getCurrentRuntimeSearch()).get(name);
}

export function ScreenRuntimeMigrationPage() {
  const en = isEnglish();
  const sessionState = useFrontendSession();
  const query = useMemo(() => resolveScreenBuilderQuery({ get: getScreenRuntimeSearchParam }), []);
  const commandState = useAsyncValue<ScreenCommandPagePayload>(
    () => (query.pageId ? fetchScreenCommandPage(query.pageId) : Promise.resolve({ selectedPageId: "", pages: [], page: {} as ScreenCommandPagePayload["page"] })),
    [query.pageId],
    { enabled: Boolean(query.pageId) }
  );
  const screenRuntimeAuthority = useMemo(() => resolveAuthorityScope({
    scopeName: "screen-runtime",
    routePath: getScreenRuntimeRoutePath(),
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
  const pagePermissionDenied = !sessionState.loading && !commandState.loading && !screenRuntimeAuthority.entryAllowed;
  const pageQueryEnabled = (!query.pageId || !commandState.loading) && screenRuntimeAuthority.entryAllowed;
  const snapshotVersionId = getScreenRuntimeSearchParam("snapshotVersionId") || "";
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
  const previewState = useAsyncValue(
    () => fetchScreenBuilderPreview({ ...query, versionStatus: "PUBLISHED" }),
    [query.menuCode, query.pageId, query.menuTitle, query.menuUrl, page?.publishedVersionId || ""],
    { enabled: pageQueryEnabled && Boolean(page?.publishedVersionId) }
  );
  const auditState = useAsyncValue(
    () => fetchAuditEvents({ menuCode: query.menuCode, pageId: query.pageId, pageSize: 10 }),
    [query.menuCode, query.pageId],
    { enabled: pageQueryEnabled && Boolean(query.menuCode || query.pageId) }
  );
  const preview = previewState.value;
  const previewNodes = useMemo(() => sortScreenBuilderNodes(preview?.nodes || []), [preview?.nodes]);
  const artifactEvidence = preview?.artifactEvidence || page?.artifactEvidence || {};
  const releaseUnitId = String(preview?.releaseUnitId || page?.releaseUnitId || page?.publishedVersionId || page?.versionId || "-");
  const runtimeDiagnostics = preview?.registryDiagnostics || page?.registryDiagnostics || {};
  const unregisteredNodes = runtimeDiagnostics?.unregisteredNodes || [];
  const missingNodes = runtimeDiagnostics?.missingNodes || [];
  const deprecatedNodes = runtimeDiagnostics?.deprecatedNodes || [];
  const runtimeIssueCount = (runtimeDiagnostics?.missingNodes?.length || 0) + (runtimeDiagnostics?.deprecatedNodes?.length || 0);
  const componentLinkageIssueCount = unregisteredNodes.length + missingNodes.length + deprecatedNodes.length;
  const runtimeBlocked = runtimeIssueCount > 0;
  const runtimeContextKeys = useMemo(() => resolveRuntimeSurfaceContextKeys({
    menuUrl: page?.menuUrl || query.menuUrl,
    templateType: preview?.templateType || page?.templateType
  }), [page?.menuUrl, page?.templateType, preview?.templateType, query.menuUrl]);
  const operatorFlowQuery = useMemo(() => ({
    menuCode: page?.menuCode || query.menuCode,
    pageId: page?.pageId || query.pageId,
    menuTitle: query.menuTitle,
    menuUrl: page?.menuUrl || query.menuUrl,
    snapshotVersionId,
    projectId: getScreenRuntimeSearchParam("projectId") || ""
  }), [page?.menuCode, page?.pageId, page?.menuUrl, query.menuCode, query.menuTitle, query.menuUrl, query.pageId, snapshotVersionId]);
  const operatorFlowPaths = useMemo(() => buildScreenBuilderOperatorFlowPaths(operatorFlowQuery), [operatorFlowQuery]);
  const operatorFlowSteps = useMemo(() => buildScreenBuilderOperatorFlowSteps(operatorFlowQuery), [operatorFlowQuery]);
  const runtimeVerifyCommand = useMemo(() => buildScreenBuilderRuntimeVerificationCommand(operatorFlowQuery), [operatorFlowQuery]);
  const screenBuilderAudits = useMemo(
    () => (auditState.value?.items || [])
      .filter((row) => String(row.actionCode || "").startsWith("SCREEN_BUILDER_"))
      .slice(0, 5),
    [auditState.value]
  );
  const publishedActionAudit = useMemo(
    () => screenBuilderAudits.find((row) => String(row.actionCode || "").includes("PUBLISH")) || null,
    [screenBuilderAudits]
  );
  const snapshotMatchesPublished = Boolean(snapshotVersionId && snapshotVersionId === String(page?.publishedVersionId || ""));
  const runtimeSnapshotFocusMode = snapshotVersionId
    ? (snapshotMatchesPublished
      ? (en ? "published runtime anchor" : "발행 런타임 앵커")
      : (en ? "manual snapshot review" : "수동 스냅샷 검토"))
    : (en ? "latest published runtime" : "최신 발행 런타임");
  const registryIssueRows = [
    ...unregisteredNodes.map((item) => ({ status: en ? "Unregistered" : "미등록", nodeId: stringifyValue(item.nodeId), componentType: stringifyValue(item.componentType), componentId: stringifyValue(item.componentId) })),
    ...missingNodes.map((item) => ({ status: en ? "Missing" : "누락", nodeId: stringifyValue(item.nodeId), componentType: stringifyValue(item.componentType), componentId: stringifyValue(item.componentId) })),
    ...deprecatedNodes.map((item) => ({ status: en ? "Deprecated" : "사용중단", nodeId: stringifyValue(item.nodeId), componentType: stringifyValue(item.componentType), componentId: stringifyValue(item.componentId) }))
  ].slice(0, 8);
  useEffect(() => {
    logGovernanceScope("PAGE", "screen-runtime", {
      route: getScreenRuntimeRoutePath(),
      language: en ? "en" : "ko",
      menuCode: page?.menuCode || query.menuCode,
      pageId: page?.pageId || query.pageId,
      previewNodeCount: previewNodes.length,
      runtimeBlocked,
      componentLinkageIssueCount
    });
    logGovernanceScope("COMPONENT", "screen-runtime-preview", {
      previewNodeCount: previewNodes.length,
      eventCount: preview?.events?.length || 0,
      auditCount: screenBuilderAudits.length,
      registryIssueCount: registryIssueRows.length
    });
  }, [
    componentLinkageIssueCount,
    en,
    page?.menuCode,
    page?.pageId,
    preview?.events?.length,
    previewNodes.length,
    query.menuCode,
    query.pageId,
    registryIssueRows.length,
    runtimeBlocked,
    screenBuilderAudits.length
  ]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Screen Builder" : "화면 빌더", href: buildScreenBuilderPath() },
        { label: en ? "Runtime Validator Console" : "런타임 검증 콘솔" }
      ]}
      title={en ? "Runtime Validator Console" : "런타임 검증 콘솔"}
      subtitle={en ? "Validate the latest published screen-builder snapshot as install-ready runtime evidence." : "최신 publish 스냅샷을 설치 가능한 런타임 검증 근거로 확인합니다."}
      contextStrip={<ContextKeyStrip items={runtimeContextKeys} />}
      loading={(commandState.loading && !commandState.value) || (pageState.loading && !page) || (previewState.loading && !preview)}
      loadingLabel={en ? "Loading published runtime..." : "발행 런타임을 불러오는 중입니다."}
    >
      {commandState.error || pageState.error || previewState.error ? (
        <PageStatusNotice tone="error">
          {commandState.error || pageState.error || previewState.error}
        </PageStatusNotice>
      ) : null}
      {snapshotVersionId ? (
        <PageStatusNotice tone="success">
          {en ? `Snapshot focus: ${snapshotVersionId}` : `현재 검증 스냅샷: ${snapshotVersionId}`}
        </PageStatusNotice>
      ) : null}
      {snapshotVersionId && !focusedSnapshot ? (
        <PageStatusNotice tone="warning">
          {en
            ? "The focused snapshot was not found in the current snapshot registry. Review snapshot history before treating this validator run as anchored evidence."
            : "현재 스냅샷 레지스트리에서 포커스 스냅샷을 찾지 못했습니다. 이 검증 실행을 앵커 증거로 보기 전에 먼저 스냅샷 이력을 확인해야 합니다."}
        </PageStatusNotice>
      ) : null}
      {snapshotVersionId && !snapshotMatchesPublished ? (
        <PageStatusNotice tone="warning">
          {en
            ? "Runtime validator still renders the latest published snapshot. The focused snapshot is treated as a manual review anchor until it becomes the published runtime."
            : "런타임 검증 콘솔은 여전히 최신 발행 스냅샷을 렌더링합니다. 현재 포커스 스냅샷은 발행 런타임이 되기 전까지 수동 검토 앵커로 처리됩니다."}
        </PageStatusNotice>
      ) : null}
      <AdminWorkspacePageFrame>
        {pagePermissionDenied ? (
          <MemberStateCard
            description={en
              ? `You need ${screenRuntimeAuthority.requiredViewFeatureCode || `${commandState.value?.page?.menuPermission?.menuCode || page?.menuCode || query.menuCode}_VIEW`} permission to open published runtime evidence for this page.`
              : `이 페이지의 발행 런타임 증거를 열려면 ${screenRuntimeAuthority.requiredViewFeatureCode || `${commandState.value?.page?.menuPermission?.menuCode || page?.menuCode || query.menuCode}_VIEW`} 권한이 필요합니다.`}
            icon="lock"
            title={en ? "Permission denied." : "권한이 없습니다."}
            tone="danger"
          />
        ) : null}
        {pagePermissionDenied ? null : (
        <>
        {snapshotVersionId ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3" data-help-id="screen-runtime-snapshot-focus">
            <SummaryMetricCard
              title={en ? "Snapshot Focus" : "스냅샷 포커스"}
              value={snapshotVersionId}
              description={en ? "Validator target snapshot" : "현재 검증 대상 스냅샷"}
            />
            <SummaryMetricCard
              title={en ? "Published Match" : "발행 일치"}
              value={snapshotMatchesPublished ? (en ? "MATCH" : "일치") : (en ? "DIFF" : "불일치")}
              description={page?.publishedVersionId || "-"}
              accentClassName={snapshotMatchesPublished ? "text-emerald-700" : "text-amber-700"}
              surfaceClassName={snapshotMatchesPublished ? "bg-emerald-50" : "bg-amber-50"}
            />
            <SummaryMetricCard
              title={en ? "Validator Lane" : "검증 레인"}
              value={snapshotMatchesPublished ? (en ? "published runtime" : "발행 런타임") : (en ? "manual snapshot review" : "수동 스냅샷 검토")}
              description={en ? "Current runtime validator source" : "현재 런타임 검증 소스"}
            />
          </section>
        ) : null}
        {snapshotVersionId && focusedSnapshot ? (
          <div data-help-id="screen-runtime-focused-snapshot-evidence">
            <KeyValueGridPanel
              title={en ? "Focused Snapshot Evidence" : "포커스 스냅샷 증거"}
              description={en ? "This registry row is the snapshot record currently being used as validator anchor evidence." : "이 레지스트리 행은 현재 검증 앵커 증거로 사용하는 스냅샷 레코드입니다."}
              items={[
                { label: en ? "Snapshot Version" : "스냅샷 버전", value: String(focusedSnapshot.versionId || "-") },
                { label: en ? "Snapshot Status" : "스냅샷 상태", value: String(focusedSnapshot.versionStatus || "-") },
                { label: en ? "Saved At" : "저장 시각", value: String(focusedSnapshot.savedAt || "-") },
                { label: en ? "Template Type" : "템플릿 타입", value: String(focusedSnapshot.templateType || "-") },
                { label: en ? "Node Count" : "노드 수", value: String(focusedSnapshot.nodeCount || 0) },
                { label: en ? "Event Count" : "이벤트 수", value: String(focusedSnapshot.eventCount || 0) },
                { label: en ? "Published Anchor Match" : "발행 앵커 일치", value: snapshotMatchesPublished ? (en ? "MATCH" : "일치") : (en ? "DIFF" : "불일치") }
              ]}
            />
          </div>
        ) : null}
        <div data-help-id="screen-runtime-summary">
          <DiagnosticCard
            actions={(
              <>
                {page?.menuCode ? (
                  <MemberLinkButton
                    href={buildEnvironmentManagementPath(page.menuCode)}
                    variant="secondary"
                  >
                    {en ? "Open Environment Management" : "환경관리 열기"}
                  </MemberLinkButton>
                ) : null}
                {page?.menuCode ? (
                  <MemberLinkButton
                    href={buildScreenBuilderPath({
                      menuCode: page.menuCode,
                      pageId: page.pageId || "",
                      menuTitle: page.menuTitle || "",
                      menuUrl: page.menuUrl || ""
                    })}
                    variant="secondary"
                  >
                    {en ? "Open Builder" : "빌더 열기"}
                  </MemberLinkButton>
                ) : null}
              </>
            )}
            description={page?.publishedVersionId
              ? (en ? "This surface renders the latest published snapshot only. Draft-only edits remain in the builder." : "이 화면은 최신 publish 스냅샷만 렌더링합니다. 초안 수정은 빌더에만 남습니다.")
              : (en ? "No published snapshot exists yet. Publish from the screen builder first." : "아직 publish 스냅샷이 없습니다. 먼저 화면 빌더에서 publish 하세요.")}
            eyebrow={preview?.templateType || page?.templateType || "EDIT_PAGE"}
            status={page?.publishedVersionId ? "PUBLISHED" : "DRAFT_ONLY"}
            statusTone={page?.publishedVersionId ? "healthy" : "warning"}
            summary={(
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">Menu Code</p>
                  <p className="mt-2 font-mono text-sm">{page?.menuCode || query.menuCode || "-"}</p>
                </div>
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">pageId</p>
                  <p className="mt-2 font-mono text-sm">{page?.pageId || query.pageId || "-"}</p>
                </div>
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Published Version" : "발행 버전"}</p>
                  <p className="mt-2 font-mono text-sm">{page?.publishedVersionId || "-"}</p>
                </div>
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Nodes" : "노드 수"}</p>
                  <p className="mt-2 text-lg font-black">{previewNodes.length}</p>
                </div>
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Published At" : "발행 시각"}</p>
                  <p className="mt-2 text-sm font-semibold">{String(page?.publishedSavedAt || "-")}</p>
                </div>
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Snapshots" : "스냅샷 수"}</p>
                  <p className="mt-2 text-lg font-black">{Array.isArray(page?.versionHistory) ? page.versionHistory.length : 0}</p>
                </div>
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Recent Builder Events" : "최근 빌더 활동"}</p>
                  <p className="mt-2 text-lg font-black">{screenBuilderAudits.length}</p>
                </div>
              </div>
            )}
            title={page?.menuTitle || query.menuTitle || (en ? "Published runtime" : "발행 런타임")}
          />
        </div>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-help-id="screen-runtime-operator-flow">
          <KeyValueGridPanel
            title={en ? "Install / Deploy Closeout" : "설치 / 배포 closeout"}
            description={en ? "This pilot family uses screen-runtime as the explicit runtime verification target and hands compare and repair forward without changing identity keys." : "이 pilot family는 screen-runtime을 명시적 runtime verification target으로 사용하고, identity key를 바꾸지 않은 채 compare와 repair로 넘깁니다."}
            items={[
              { label: "pageFamily", value: "screen-builder" },
              { label: "installScope", value: "COMMON_DEF_PROJECT_BIND" },
              { label: en ? "Runtime Target" : "런타임 대상", value: operatorFlowPaths.runtime },
              { label: en ? "Compare Target" : "비교 대상", value: operatorFlowPaths.compare },
              { label: en ? "Repair Target" : "복구 대상", value: operatorFlowPaths.repair },
              { label: en ? "Binding Inputs" : "바인딩 입력", value: `${page?.menuCode || query.menuCode || "-"} / ${page?.pageId || query.pageId || "-"} / ${page?.menuUrl || query.menuUrl || "-"} / ${snapshotVersionId || String(page?.publishedVersionId || "-")}` },
              { label: en ? "Rollback Evidence" : "롤백 증거", value: `${releaseUnitId} / ${stringifyValue(artifactEvidence.runtimePackageId)} / ${stringifyValue(artifactEvidence.deployTraceId)}` },
              { label: en ? "Authority Scope" : "권한 범위", value: `${screenRuntimeAuthority.entryAllowed ? "ENTRY_ALLOWED" : "ENTRY_GUARDED"} / ${stringifyValue(preview?.authorityProfile?.scopePolicy || page?.authorityProfile?.scopePolicy, "PROJECT_SCOPED")}` }
            ]}
          />
          <KeyValueGridPanel
            title={en ? "Operator Flow" : "운영자 플로우"}
            description={en ? "Use one governed loop for deploy, freshness, compare, and repair evidence." : "배포, freshness, compare, repair 증거를 하나의 governed loop로 사용합니다."}
            items={operatorFlowSteps.map((step) => ({
              label: step.label,
              value: `${step.command} -> ${step.evidence}`
            }))}
          >
            <div className="grid grid-cols-1 gap-3">
              <CopyableCodeBlock title={en ? "Build / Package / Restart" : "빌드 / 패키지 / 재시작"} value={operatorFlowSteps[0]?.command || ""} />
              <CopyableCodeBlock title={en ? "Freshness + Runtime Verify" : "freshness + 런타임 검증"} value={`${operatorFlowSteps[1]?.command || ""}\n${runtimeVerifyCommand}`} />
            </div>
          </KeyValueGridPanel>
        </section>
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="screen-runtime-metrics">
          <SummaryMetricCard title={en ? "Published Nodes" : "발행 노드 수"} value={previewNodes.length} description={en ? "Rendered runtime nodes" : "렌더 가능한 런타임 노드"} />
          <SummaryMetricCard title={en ? "Runtime Events" : "런타임 이벤트"} value={preview?.events?.length || 0} description={en ? "Published event bindings" : "발행 이벤트 바인딩"} />
          <SummaryMetricCard title={en ? "Registry Gaps" : "레지스트리 갭"} value={componentLinkageIssueCount} description={en ? "Unregistered, missing, deprecated" : "미등록 / 누락 / 사용중단"} accentClassName={componentLinkageIssueCount ? "text-amber-700" : undefined} surfaceClassName={componentLinkageIssueCount ? "bg-amber-50" : undefined} />
          <SummaryMetricCard title={en ? "Release Unit" : "릴리즈 유닛"} value={releaseUnitId} description={en ? "Ops-owned publish package" : "ops 소유 publish 패키지"} />
        </section>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-help-id="screen-runtime-binding">
          <KeyValueGridPanel
            title={en ? "Runtime Validator Binding" : "런타임 검증 바인딩"}
            description={en ? "The runtime validator keeps the same identity keys from builder handoff through published output." : "이 런타임 검증 콘솔은 builder handoff부터 발행 출력까지 동일한 identity key를 유지합니다."}
            items={[
              { label: "guidedStateId", value: runtimeContextKeys[0]?.value || "-" },
              { label: "templateLineId", value: runtimeContextKeys[1]?.value || "-" },
              { label: "screenFamilyRuleId", value: runtimeContextKeys[2]?.value || "-" },
              { label: "ownerLane", value: runtimeContextKeys[3]?.value || "-" },
              { label: en ? "Authority Scope" : "권한 범위", value: stringifyValue(preview?.authorityProfile?.scopePolicy || page?.authorityProfile?.scopePolicy, "GLOBAL") },
              { label: en ? "Published Version" : "발행 버전", value: page?.publishedVersionId || "-" },
              { label: en ? "Release Unit" : "릴리즈 유닛", value: releaseUnitId }
            ]}
          />
          <KeyValueGridPanel
            title={en ? "Validator Linkage Summary" : "검증 연결 요약"}
            description={en ? "Use these counters to decide whether the runtime output is safe to hand off to repair and compare validators." : "이 카운트는 런타임 출력이 복구 및 비교 검증 흐름으로 넘어가도 되는지 판단하는 기준입니다."}
            items={[
              { label: en ? "Unregistered Nodes" : "미등록 노드", value: String(unregisteredNodes.length) },
              { label: en ? "Missing Nodes" : "누락 노드", value: String(missingNodes.length) },
              { label: en ? "Deprecated Nodes" : "사용중단 노드", value: String(deprecatedNodes.length) },
              { label: en ? "Recent Builder Events" : "최근 빌더 이벤트", value: String(screenBuilderAudits.length) },
              { label: en ? "Published At" : "발행 시각", value: stringifyValue(page?.publishedSavedAt) },
              { label: en ? "Node / Event Total" : "노드 / 이벤트 합계", value: `${formatCountLabel(previewNodes.length, en ? "node" : "개", en ? "nodes" : "개")} / ${formatCountLabel(preview?.events?.length || 0, en ? "event" : "개", en ? "events" : "개")}` }
            ]}
          />
        </section>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-help-id="screen-runtime-artifact-evidence">
          <KeyValueGridPanel
            title={en ? "Snapshot Runtime Anchor" : "스냅샷 런타임 앵커"}
            description={en ? "The runtime validator keeps one snapshot anchor while still rendering the published runtime output." : "런타임 검증 콘솔은 발행 런타임을 렌더링하면서도 하나의 스냅샷 앵커를 유지합니다."}
            items={[
              { label: en ? "Focus Snapshot" : "포커스 스냅샷", value: snapshotVersionId || (page?.publishedVersionId || "-") },
              { label: en ? "Focus Mode" : "포커스 모드", value: runtimeSnapshotFocusMode },
              { label: en ? "Published Anchor" : "발행 앵커", value: page?.publishedVersionId || "-" },
              { label: en ? "Anchor Match" : "앵커 일치", value: snapshotVersionId ? (snapshotMatchesPublished ? (en ? "MATCH" : "일치") : (en ? "DIFF" : "불일치")) : (en ? "CURRENT" : "현재값") },
              { label: en ? "Published Saved At" : "발행 저장 시각", value: stringifyValue(page?.publishedSavedAt) },
              { label: en ? "Runtime Render Source" : "런타임 렌더 소스", value: en ? "published snapshot only" : "발행 스냅샷만 렌더링" }
            ]}
          />
          <KeyValueGridPanel
            title={en ? "Install Artifact Evidence" : "설치 산출물 증거"}
            description={en ? "These values define the publish boundary used to install or bind runtime artifacts downstream." : "이 값들은 downstream 설치 및 바인딩에 사용하는 publish 경계를 나타냅니다."}
            items={[
              { label: en ? "Source System" : "소스 시스템", value: stringifyValue(artifactEvidence.artifactSourceSystem, "carbonet-ops") },
              { label: en ? "Target System" : "타깃 시스템", value: stringifyValue(artifactEvidence.artifactTargetSystem, "carbonet-general") },
              { label: en ? "Release Unit" : "릴리즈 유닛", value: stringifyValue(artifactEvidence.releaseUnitId, releaseUnitId) },
              { label: en ? "Runtime Package" : "런타임 패키지", value: stringifyValue(artifactEvidence.runtimePackageId) },
              { label: en ? "Deploy Trace" : "배포 추적", value: stringifyValue(artifactEvidence.deployTraceId) },
              { label: en ? "Artifact Path" : "산출물 경로", value: stringifyValue(artifactEvidence.artifactPathHint) }
            ]}
          />
          <KeyValueGridPanel
            title={en ? "Published Validator Snapshot" : "발행 검증 스냅샷"}
            description={en ? "Use this block when handing the published runtime to validator, repair, or downstream runtime targets." : "이 블록은 발행 런타임을 검증, 복구, 또는 downstream runtime target으로 넘길 때 사용합니다."}
            items={[
              { label: en ? "Artifact Kind" : "산출물 종류", value: stringifyValue(artifactEvidence.artifactKind, "screen-builder-runtime") },
              { label: en ? "Published Version" : "발행 버전", value: stringifyValue(artifactEvidence.publishedVersionId, page?.publishedVersionId) },
              { label: en ? "Published Saved At" : "발행 저장 시각", value: stringifyValue(artifactEvidence.publishedSavedAt, page?.publishedSavedAt) },
              { label: en ? "Page Id" : "페이지 ID", value: stringifyValue(page?.pageId, query.pageId) },
              { label: "menuCode", value: stringifyValue(page?.menuCode, query.menuCode) },
              { label: "menuUrl", value: stringifyValue(page?.menuUrl, query.menuUrl) }
            ]}
          />
        </section>
        {componentLinkageIssueCount ? (
          <PageStatusNotice tone="warning">
            {en
              ? "Component linkage still has unregistered, missing, or deprecated nodes. Close these before treating the published runtime as clean handoff evidence."
              : "구성요소 연결에 미등록, 누락, 사용중단 노드가 남아 있습니다. 발행 런타임을 clean handoff 근거로 보기 전에 먼저 닫아야 합니다."}
          </PageStatusNotice>
        ) : (
          <PageStatusNotice tone="success">
            {en
              ? "Runtime component linkage is currently clean enough for compare and repair handoff."
              : "현재 런타임 구성요소 연결 상태는 compare / repair handoff 기준을 충족합니다."}
          </PageStatusNotice>
        )}
        {publishedActionAudit ? (
          <section className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3" data-help-id="screen-runtime-publish-audit">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-blue-700">{en ? "Publish Action" : "발행 액션"}</p>
                <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{String(publishedActionAudit.actionCode || "-")}</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-blue-700">{en ? "Published By" : "발행 작업자"}</p>
                <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{String(publishedActionAudit.actorId || "-")}</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-blue-700">{en ? "Publish Time" : "발행 시각"}</p>
                <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{String(publishedActionAudit.createdAt || "-")}</p>
              </div>
            </div>
          </section>
        ) : null}
        {runtimeBlocked ? (
          <section className="rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-black text-red-800">{en ? "Published runtime blocked" : "발행 런타임 차단"}</p>
            <p className="mt-1 text-sm text-red-700">
              {en
                ? "The published snapshot still references missing or deprecated components. Fix the registry or run replacement before using runtime."
                : "발행 스냅샷이 누락되었거나 deprecated된 컴포넌트를 참조하고 있습니다. 레지스트리를 정리하거나 대체를 먼저 실행하세요."}
            </p>
          </section>
        ) : null}

        <section className="gov-card p-0 overflow-hidden" data-help-id="screen-runtime-preview">
          <GridToolbar
            meta={`${page?.menuUrl || query.menuUrl || "-"} / PUBLISHED`}
            title={en ? "Validator Runtime Preview" : "검증 런타임 미리보기"}
          />
          <div className="min-h-[680px] bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] p-4">
            {previewNodes.length && !runtimeBlocked ? (
              renderScreenBuilderNodePreview(previewNodes[0], previewNodes, en)
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] text-sm text-[var(--kr-gov-text-secondary)]">
                {runtimeBlocked
                  ? (en ? "Runtime rendering is blocked until missing or deprecated components are resolved." : "누락 또는 deprecated 컴포넌트가 정리될 때까지 런타임 렌더링이 차단됩니다.")
                  : (en ? "No published runtime snapshot is available." : "사용 가능한 publish 런타임 스냅샷이 없습니다.")}
              </div>
            )}
          </div>
        </section>

        <section className="gov-card p-0 overflow-hidden" data-help-id="screen-runtime-builder-activity">
          <GridToolbar
            actions={page?.menuCode ? (
              <MemberLinkButton
                href={buildObservabilityPath({
                  menuCode: page.menuCode,
                  pageId: page.pageId || "",
                  searchKeyword: "SCREEN_BUILDER_"
                })}
                size="sm"
                variant="secondary"
              >
                {en ? "Open Observability" : "Observability 열기"}
              </MemberLinkButton>
            ) : null}
            meta={en ? "Recent screen-builder save, publish, and restore activity for this page." : "이 페이지의 최근 screen-builder 저장, publish, 복원 이력입니다."}
            title={en ? "Validator Evidence Activity" : "검증 증거 활동 이력"}
          />
          <div className="divide-y divide-gray-100">
            {screenBuilderAudits.length ? screenBuilderAudits.map((row, index) => (
              <div className="px-5 py-4" key={`runtime-audit-${index}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold text-[var(--kr-gov-text-primary)]">{String(row.actionCode || "-")}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--kr-gov-text-secondary)]">{String(row.createdAt || "-")}</span>
                    <MemberLinkButton
                      href={buildObservabilityPath({
                        traceId: String(row.traceId || ""),
                        menuCode: page?.menuCode || "",
                        pageId: page?.pageId || "",
                        actionCode: String(row.actionCode || "")
                      })}
                      size="xs"
                      variant="secondary"
                    >
                      {en ? "Detail" : "상세"}
                    </MemberLinkButton>
                  </div>
                </div>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Actor" : "작업자"}: {String(row.actorId || "-")} / {en ? "Result" : "결과"}: {String(row.resultStatus || "-")}
                </p>
                {String(row.message || "").trim() ? (
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-primary)]">{String(row.message || "")}</p>
                ) : null}
              </div>
            )) : (
              <div className="px-5 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]">
                {auditState.loading
                  ? (en ? "Loading recent builder activity..." : "최근 빌더 활동 이력을 불러오는 중입니다.")
                  : (en ? "No recent screen-builder activity was found." : "최근 screen-builder 활동 이력이 없습니다.")}
              </div>
            )}
          </div>
        </section>
        <section className="gov-card overflow-hidden p-0" data-help-id="screen-runtime-registry-linkage">
          <GridToolbar
            meta={en ? "Registry linkage issues that still affect the published runtime surface." : "발행 런타임 화면에 아직 영향을 주는 레지스트리 연결 이슈입니다."}
            title={en ? "Validator Linkage Queue" : "검증 연결 대기열"}
          />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)]">
              <thead className="bg-slate-50 text-left text-[12px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                <tr>
                  <th className="px-5 py-4">{en ? "Status" : "상태"}</th>
                  <th className="px-5 py-4">{en ? "Node Id" : "노드 ID"}</th>
                  <th className="px-5 py-4">{en ? "Component Type" : "구성요소 타입"}</th>
                  <th className="px-5 py-4">{en ? "Component Id" : "구성요소 ID"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white text-sm">
                {registryIssueRows.length ? registryIssueRows.map((row) => (
                  <tr key={`${row.status}-${row.nodeId}-${row.componentId}`}>
                    <td className="px-5 py-4 font-bold text-[var(--kr-gov-text-primary)]">{row.status}</td>
                    <td className="px-5 py-4 font-mono">{row.nodeId}</td>
                    <td className="px-5 py-4">{row.componentType}</td>
                    <td className="px-5 py-4 font-mono">{row.componentId}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-5 py-4 text-[var(--kr-gov-text-secondary)]" colSpan={4}>
                      {en ? "No registry linkage issues remain in the published runtime." : "발행 런타임에는 남은 레지스트리 연결 이슈가 없습니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        </>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
