import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { FrameworkAuthorityRoleContract } from "../../framework";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { resolveAuthorityScope, type AuthorityAction } from "../../app/policy/authorityScope";
import { getCurrentRuntimePathname, getCurrentRuntimeSearch } from "../../app/routes/runtime";
import { logGovernanceScope } from "../../app/policy/debug";
import { readBootstrappedScreenBuilderPageData } from "../../lib/api/bootstrap";
import { fetchScreenCommandPage } from "../../lib/api/platform";
import {
  fetchScreenBuilderPage,
} from "../../lib/api/platform";
import type { ScreenCommandPagePayload, ScreenBuilderPagePayload } from "../../lib/api/platformTypes";
import { buildLocalizedPath, getNavigationEventName, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { ContextKeyStrip } from "../admin-ui/ContextKeyStrip";
import { authorDesignContextKeys } from "../admin-ui/contextKeyPresets";
import { DiagnosticCard, MemberLinkButton, MemberPermissionButton, PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { MemberStateCard } from "../member/sections";
import { resolveScreenBuilderQuery } from "./shared/screenBuilderUtils";
import {
  buildEnvironmentManagementPath,
  buildCurrentRuntimeComparePath,
  buildRepairWorkbenchPath,
  buildScreenFlowManagementPath,
  buildScreenMenuAssignmentManagementPath,
  buildScreenRuntimePath
} from "./screenBuilderPaths";
import {
  BUILDER_INSTALL_VALIDATOR_CHECKS,
  buildBuilderInstallFlowContract,
  buildBuilderInstallQueueSummary as buildInstallQueueSummaryFromContract
} from "./shared/installableBuilderContract";
import { useScreenBuilderEditor } from "./hooks/useScreenBuilderEditor";
import { useScreenBuilderGovernanceState } from "./hooks/useScreenBuilderGovernanceState";
import { useScreenBuilderMutations } from "./hooks/useScreenBuilderMutations";
import { useScreenBuilderWorkspaceState } from "./hooks/useScreenBuilderWorkspaceState";

const ScreenBuilderGovernancePanels = lazy(() => import("./panels/ScreenBuilderGovernancePanels"));
const ScreenBuilderEditorPanels = lazy(() => import("./panels/ScreenBuilderEditorPanels"));
const ScreenBuilderOverviewPanels = lazy(() => import("./panels/ScreenBuilderOverviewPanels"));

function getScreenBuilderRoutePath() {
  return getCurrentRuntimePathname();
}

function getScreenBuilderSearchParams() {
  return new URLSearchParams(getCurrentRuntimeSearch());
}

function getScreenBuilderProjectId() {
  return getScreenBuilderSearchParams().get("projectId") || "";
}

function readScreenBuilderQueryFromLocation() {
  const searchParams = getScreenBuilderSearchParams();
  return resolveScreenBuilderQuery({
    get(name: string) {
      return searchParams.get(name);
    }
  });
}

export function ScreenBuilderMigrationPage() {
  const en = isEnglish();
  const sessionState = useFrontendSession();
  const [pageQuery, setPageQuery] = useState(() => readScreenBuilderQueryFromLocation());
  const bootstrappedPayload = useMemo(() => readBootstrappedScreenBuilderPageData(), []);
  const initialPayload = useMemo(() => {
    if (!bootstrappedPayload) {
      return null;
    }
    const payloadMenuCode = String(bootstrappedPayload.menuCode || "");
    const payloadPageId = String(bootstrappedPayload.pageId || "");
    const payloadMenuUrl = String(bootstrappedPayload.menuUrl || "");
    const queryMenuCode = String(pageQuery.menuCode || "");
    const queryPageId = String(pageQuery.pageId || "");
    const queryMenuUrl = String(pageQuery.menuUrl || "");
    const matchesMenuCode = !queryMenuCode || payloadMenuCode === queryMenuCode;
    const matchesPageId = !queryPageId || payloadPageId === queryPageId;
    const matchesMenuUrl = !queryMenuUrl || payloadMenuUrl === queryMenuUrl;
    return matchesMenuCode && matchesPageId && matchesMenuUrl ? bootstrappedPayload : null;
  }, [bootstrappedPayload, pageQuery.menuCode, pageQuery.menuUrl, pageQuery.pageId]);

  useEffect(() => {
    function syncScreenBuilderQuery() {
      setPageQuery(readScreenBuilderQueryFromLocation());
    }

    const navigationEventName = getNavigationEventName();
    window.addEventListener(navigationEventName, syncScreenBuilderQuery);
    window.addEventListener("popstate", syncScreenBuilderQuery);
    return () => {
      window.removeEventListener(navigationEventName, syncScreenBuilderQuery);
      window.removeEventListener("popstate", syncScreenBuilderQuery);
    };
  }, []);

  const pageState = useAsyncValue<ScreenBuilderPagePayload>(
    () => fetchScreenBuilderPage(pageQuery),
    [pageQuery.menuCode, pageQuery.pageId, pageQuery.menuTitle, pageQuery.menuUrl],
    {
      initialValue: initialPayload,
      skipInitialLoad: Boolean(initialPayload)
    }
  );
  const page = pageState.value;
  const [draftAuthorityProfile, setDraftAuthorityProfile] = useState<ScreenBuilderPagePayload["authorityProfile"] | null>(null);
  const commandState = useAsyncValue<ScreenCommandPagePayload>(
    () => (page?.pageId ? fetchScreenCommandPage(page.pageId) : Promise.resolve({ selectedPageId: "", pages: [], page: {} as ScreenCommandPagePayload["page"] })),
    [page?.pageId || ""],
    { enabled: Boolean(page?.pageId) }
  );
  const {
    addAiNodeTreeRow,
    aiNodeTreeRows,
    autoReplacePreviewItems,
    componentRegistry,
    copiedButtonStyleId,
    copyButtonStyleId,
    message,
    previewLoading,
    previewMessage,
    previewMode,
    previewNodes,
    registryEditorDescription,
    registryEditorLabel,
    registryEditorPropsJson,
    registryEditorReplacementId,
    registryEditorStatus,
    registryEditorType,
    registryScanRows,
    registryStatusFilter,
    registryTypeFilter,
    registryUsageLoading,
    registryUsagePreviewMap,
    registryUsageRows,
    removeAiNodeTreeRow,
    saveError,
    saving,
    selectedRegistryComponentId,
    selectedTemplateType,
    setAutoReplacePreviewItems,
    setComponentRegistry,
    setMessage,
    setPreviewLoading,
    setPreviewMessage,
    setPreviewMode,
    setPreviewNodes,
    setRegistryEditorDescription,
    setRegistryEditorLabel,
    setRegistryEditorPropsJson,
    setRegistryEditorReplacementId,
    setRegistryEditorStatus,
    setRegistryEditorType,
    setRegistryScanRows,
    setRegistryStatusFilter,
    setRegistryTypeFilter,
    setRegistryUsageLoading,
    setRegistryUsagePreviewMap,
    setRegistryUsageRows,
    setSaveError,
    setSaving,
    setSelectedRegistryComponentId,
    setSelectedTemplateType,
    updateAiNodeTreeRow
  } = useScreenBuilderWorkspaceState(en);

  const availableApis = useMemo(() => commandState.value?.page?.apis || [], [commandState.value]);
  const {
    authorityAssignmentAuthorities,
    authorityLoading,
    authorityRoleCategories,
    authorityRoleCategoryOptions,
    authorityRoleTemplates,
    backendDeprecatedNodes,
    backendMissingNodes,
    backendUnregisteredNodes,
    componentPromptSurface,
    componentTypeOptions,
    filteredComponentRegistry,
    filteredSystemCatalog,
    selectedCatalogType,
    selectedRegistryInventoryItem,
    systemCatalogInstances,
    uniqueUsageUrlsByComponent
  } = useScreenBuilderGovernanceState({
    componentRegistry,
    en,
    page,
    registryStatusFilter,
    registryTypeFilter,
    registryUsagePreviewMap,
    selectedRegistryComponentId,
    setComponentRegistry,
    setPreviewNodes,
    setRegistryEditorDescription,
    setRegistryEditorLabel,
    setRegistryEditorPropsJson,
    setRegistryEditorReplacementId,
    setRegistryEditorStatus,
    setRegistryEditorType,
    setRegistryUsageLoading,
    setRegistryUsagePreviewMap,
    setRegistryUsageRows,
    setSaveError,
    setSelectedRegistryComponentId,
    setSelectedTemplateType
  });
  useEffect(() => {
    setDraftAuthorityProfile(page?.authorityProfile || null);
  }, [page?.authorityProfile]);
  const publishIssueCount = backendUnregisteredNodes.length + backendMissingNodes.length + backendDeprecatedNodes.length;
  const publishReady = publishIssueCount === 0;

  const {
    addNode,
    collapsedNodeIdSet,
    componentDescription,
    componentLabel,
    dragNodeId,
    duplicateSelectedNode,
    ensureSelectedEvent,
    events,
    filteredPalette,
    handleApplyTemplatePreset,
    handleReplaceSelectedComponent,
    moveSelectedNode,
    nodeTreeRows,
    nodes,
    removeSelectedNode,
    reorderNodes,
    replacementComponentId,
    selectedApi,
    selectedEvent,
    selectedNode,
    selectedNodeProps,
    selectedRegistryComponent,
    setComponentDescription,
    setComponentLabel,
    setDragNodeId,
    setEvents,
    setNodes,
    setReplacementComponentId,
    setSelectedNodeId,
    toggleCollapsedNode,
    updateSelectedEvent,
    updateSelectedEventApi,
    updateSelectedEventRequestMapping,
    updateSelectedEventTarget,
    updateSelectedNodeField
  } = useScreenBuilderEditor({
    availableApis,
    componentRegistry,
    en,
    page: page || undefined,
    selectedTemplateType,
    setMessage
  });


  const {
    handleAddNodeFromComponent,
    handleAddNodeTreeFromAiSurface,
    handleAutoReplaceDeprecated,
    handleDeleteRegistryItem,
    handleDeprecateComponent,
    handlePreviewAutoReplaceDeprecated,
    handlePreviewRefresh,
    handlePublish,
    handleRegisterSelectedComponent,
    handleRemapRegistryUsage,
    handleRestoreVersion,
    handleSave,
    handleSaveRegistryItem,
    handleScanRegistryDiagnostics
  } = useScreenBuilderMutations({
    aiNodeTreeRows,
    backendDeprecatedNodesLength: backendDeprecatedNodes.length,
    backendMissingNodesLength: backendMissingNodes.length,
    backendUnregisteredNodesLength: backendUnregisteredNodes.length,
    componentDescription,
    componentLabel,
    en,
    events,
    nodes,
    page,
    pageReload: pageState.reload,
    previewMode,
    publishIssueCount,
    draftAuthorityProfile,
    registryEditorDescription,
    registryEditorLabel,
    registryEditorPropsJson,
    registryEditorReplacementId,
    registryEditorStatus,
    registryEditorType,
    replacementComponentId,
    selectedNode,
    selectedRegistryInventoryItem,
    selectedTemplateType,
    setAutoReplacePreviewItems,
    setComponentRegistry,
    setMessage,
    setNodes,
    setPreviewLoading,
    setPreviewMessage,
    setPreviewNodes,
    setRegistryScanRows,
    setRegistryUsageRows,
    setReplacementComponentId,
    setSaveError,
    setSaving,
    setSelectedRegistryComponentId
  });

  const rootMenuHref = buildEnvironmentManagementPath();
  const screenFlowHref = buildScreenFlowManagementPath();
  const screenMenuAssignmentHref = buildScreenMenuAssignmentManagementPath();
  const screenGovernanceSummary = useMemo(() => ({
    requiredViewFeatureCode: String(commandState.value?.page?.menuPermission?.requiredViewFeatureCode || ""),
    featureCodeCount: commandState.value?.page?.menuPermission?.featureCodes?.length || 0,
    relationTableCount: commandState.value?.page?.menuPermission?.relationTables?.length || 0,
    surfaceCount: commandState.value?.page?.surfaces?.length || 0,
    eventCount: commandState.value?.page?.events?.length || 0,
    apiCount: commandState.value?.page?.apis?.length || 0,
    schemaCount: commandState.value?.page?.schemas?.length || 0,
    changeTargetCount: commandState.value?.page?.changeTargets?.length || 0,
    routePath: String(commandState.value?.page?.routePath || page?.menuUrl || ""),
    menuLookupUrl: String(commandState.value?.page?.menuLookupUrl || "")
  }), [commandState.value?.page, page?.menuUrl]);
  const screenBuilderAuthority = useMemo(() => resolveAuthorityScope({
    scopeName: "screen-builder",
    routePath: getScreenBuilderRoutePath(),
    session: sessionState.value,
    menuCode: page?.menuCode || pageQuery.menuCode,
    requiredViewFeatureCode: commandState.value?.page?.menuPermission?.requiredViewFeatureCode,
    featureCodes: commandState.value?.page?.menuPermission?.featureCodes,
    featureRows: commandState.value?.page?.menuPermission?.featureRows
  }), [commandState.value?.page?.menuPermission?.featureCodes, commandState.value?.page?.menuPermission?.featureRows, commandState.value?.page?.menuPermission?.requiredViewFeatureCode, page?.menuCode, pageQuery.menuCode, sessionState.value]);
  const pagePermissionDenied = !sessionState.loading && !screenBuilderAuthority.entryAllowed;
  const packageArtifactEvidence = (page?.artifactEvidence || {}) as Record<string, unknown>;
  const projectId = getScreenBuilderProjectId();
  const packageQueueSummary = useMemo(() => buildInstallQueueSummaryFromContract({
    menuCode: page?.menuCode,
    pageId: page?.pageId,
    menuUrl: page?.menuUrl,
    releaseUnitId: page?.releaseUnitId || page?.publishedVersionId,
    runtimePackageId: String(packageArtifactEvidence.runtimePackageId || page?.publishedVersionId || ""),
    deployTraceId: String(packageArtifactEvidence.deployTraceId || page?.publishedSavedAt || ""),
    publishReady,
    issueCount: publishIssueCount,
    validatorPassCount: publishReady ? BUILDER_INSTALL_VALIDATOR_CHECKS.length : Math.max(BUILDER_INSTALL_VALIDATOR_CHECKS.length - 2, 0),
    validatorTotalCount: BUILDER_INSTALL_VALIDATOR_CHECKS.length
  }), [packageArtifactEvidence.deployTraceId, packageArtifactEvidence.runtimePackageId, page?.menuCode, page?.menuUrl, page?.pageId, page?.publishedSavedAt, page?.publishedVersionId, page?.releaseUnitId, publishIssueCount, publishReady]);
  const installFlowQuery = useMemo(() => ({
    menuCode: page?.menuCode || "",
    pageId: page?.pageId || "",
    menuTitle: page?.menuTitle || "",
    menuUrl: page?.menuUrl || "",
    snapshotVersionId: String(page?.publishedVersionId || ""),
    projectId
  }), [page?.menuCode, page?.menuTitle, page?.menuUrl, page?.pageId, page?.publishedVersionId, projectId]);
  const installFlowContract = useMemo(() => buildBuilderInstallFlowContract({
    en,
    manifestTarget: commandState.value?.page?.manifestRegistry?.pageId
      ? `${commandState.value.page.manifestRegistry.pageId} / ${commandState.value.page.manifestRegistry.layoutVersion || "-"}`
      : (page?.pageId || "-"),
    queueSummary: packageQueueSummary,
    bindingInputs: [
      { key: "projectId", ready: Boolean(projectId), detail: projectId || (en ? "Project binding is missing." : "프로젝트 바인딩이 없습니다.") },
      { key: "menuRoot", ready: Boolean(page?.menuUrl), detail: page?.menuUrl || "-" },
      { key: "runtimeClass", ready: Boolean(page?.pageId), detail: page?.pageId || "-" },
      { key: "menuScope", ready: Boolean(screenGovernanceSummary.requiredViewFeatureCode), detail: screenGovernanceSummary.requiredViewFeatureCode || "-" },
      { key: "releaseUnitPrefix", ready: packageQueueSummary.releaseUnitId !== "-", detail: packageQueueSummary.releaseUnitId },
      { key: "runtimePackagePrefix", ready: packageQueueSummary.runtimePackageId !== "-", detail: packageQueueSummary.runtimePackageId }
    ],
    validatorInputs: BUILDER_INSTALL_VALIDATOR_CHECKS.map((check, index) => ({
      key: check,
      ready: packageQueueSummary.validatorPassCount > index,
      detail: check === "builder-routes-exposed"
        ? (page?.menuUrl || "-")
        : (check === "storage-writable" ? packageQueueSummary.deployTraceId : packageQueueSummary.menuCode)
    })),
    rollbackEvidenceTarget: buildRepairWorkbenchPath(installFlowQuery),
    publishedVersionId: page?.publishedVersionId,
    versionId: page?.versionId,
    publishIssueCount,
    requiredViewFeatureCode: screenGovernanceSummary.requiredViewFeatureCode
  }), [commandState.value?.page?.manifestRegistry?.layoutVersion, commandState.value?.page?.manifestRegistry?.pageId, en, installFlowQuery, packageQueueSummary, page?.menuUrl, page?.pageId, page?.publishedVersionId, page?.versionId, projectId, publishIssueCount, screenGovernanceSummary.requiredViewFeatureCode]);
  const installReady = installFlowContract.steps[3]?.state === (en ? "READY" : "준비됨");
  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "screen-builder", {
      route: getScreenBuilderRoutePath(),
      pageId: page.pageId || "",
      menuCode: page.menuCode || "",
      nodeCount: nodes.length,
      eventCount: events.length,
      publishIssueCount,
      componentRegistryCount: componentRegistry.length
    });
    logGovernanceScope("COMPONENT", "screen-builder-governance", {
      component: "screen-builder-governance",
      selectedNodeId: selectedNode?.nodeId || "",
      selectedRegistryComponentId,
      registryIssueCount: backendUnregisteredNodes.length + backendMissingNodes.length + backendDeprecatedNodes.length,
      previewNodeCount: previewNodes.length
    });
  }, [
    backendDeprecatedNodes.length,
    backendMissingNodes.length,
    backendUnregisteredNodes.length,
    componentRegistry.length,
    events.length,
    nodes.length,
    page,
    previewNodes.length,
    publishIssueCount,
    selectedNode,
    selectedRegistryComponentId
  ]);

  useEffect(() => {
    if (!pagePermissionDenied) {
      return;
    }
    screenBuilderAuthority.logAuthorityDenied("view", {
      component: "screen-builder-page",
      menuCode: page?.menuCode || pageQuery.menuCode,
      pageId: page?.pageId || pageQuery.pageId
    });
  }, [page?.menuCode, page?.pageId, pagePermissionDenied, pageQuery.menuCode, pageQuery.pageId, screenBuilderAuthority]);

  async function runScreenBuilderAction(
    action: AuthorityAction,
    executor: () => Promise<void> | void,
    payload: Record<string, unknown> = {}
  ) {
    if (!screenBuilderAuthority.allowsAction(action)) {
      screenBuilderAuthority.logAuthorityDenied(action, payload);
      setSaveError(screenBuilderAuthority.getActionReason(action, en));
      return;
    }
    screenBuilderAuthority.logAuthorityGranted(action, payload);
    await executor();
  }

  async function handlePreviewRefreshWithAuthority(savedDraft = false) {
    await runScreenBuilderAction("query", () => handlePreviewRefresh(savedDraft), {
      component: "screen-builder-preview-refresh",
      menuCode: page?.menuCode || pageQuery.menuCode,
      pageId: page?.pageId || pageQuery.pageId
    });
  }

  async function handleSaveWithAuthority() {
    await runScreenBuilderAction("update", handleSave, {
      component: "screen-builder-save",
      menuCode: page?.menuCode || pageQuery.menuCode,
      pageId: page?.pageId || pageQuery.pageId
    });
  }

  async function handlePublishWithAuthority() {
    await runScreenBuilderAction("execute", handlePublish, {
      component: "screen-builder-publish",
      menuCode: page?.menuCode || pageQuery.menuCode,
      pageId: page?.pageId || pageQuery.pageId
    });
  }

  function applyAuthorityRoleToDraft(role: FrameworkAuthorityRoleContract) {
    setDraftAuthorityProfile({
      roleKey: role.roleKey,
      authorCode: role.authorCode,
      label: role.label,
      description: role.description,
      tier: role.tier,
      actorType: role.actorType,
      scopePolicy: role.scopePolicy,
      hierarchyLevel: role.hierarchyLevel,
      featureCodes: role.featureCodes || [],
      tags: [`role-template:${role.authorCode}`, `role-tier:${role.tier}`]
    });
    setMessage(en ? `Authority profile ${role.authorCode} applied to the draft.` : `${role.authorCode} 권한 프로필을 draft에 반영했습니다.`);
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Builder Install / Bind Console" : "빌더 설치 / 바인딩 콘솔", href: rootMenuHref },
        { label: en ? "Builder Package Studio" : "빌더 패키지 스튜디오" }
      ]}
      title={en ? "Builder Package Studio" : "빌더 패키지 스튜디오"}
      subtitle={en ? "Assemble a package-ready page draft from menu metadata, governed components, authority evidence, and install validation context." : "메뉴 메타데이터, 거버넌스 컴포넌트, 권한 증거, 설치 검증 문맥을 묶어 패키지 가능한 페이지 초안을 구성합니다."}
      contextStrip={
        <ContextKeyStrip items={authorDesignContextKeys} />
      }
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading screen builder..." : "화면 빌더를 불러오는 중입니다."}
    >
      {pageState.error || saveError ? (
        <PageStatusNotice tone="error">
          {pageState.error || saveError}
        </PageStatusNotice>
      ) : null}
      {message ? (
        <PageStatusNotice tone="success">
          {message}
        </PageStatusNotice>
      ) : null}
      <AdminWorkspacePageFrame>
        {pagePermissionDenied ? (
          <MemberStateCard
            description={en
              ? `You need ${screenBuilderAuthority.requiredViewFeatureCode || `${page?.menuCode || pageQuery.menuCode}_VIEW`} permission to open the governed screen-builder workspace for this page.`
              : `이 페이지의 governed screen-builder 작업공간을 열려면 ${screenBuilderAuthority.requiredViewFeatureCode || `${page?.menuCode || pageQuery.menuCode}_VIEW`} 권한이 필요합니다.`}
            icon="lock"
            title={en ? "Permission denied." : "권한이 없습니다."}
            tone="danger"
          />
        ) : null}
        {pagePermissionDenied ? null : (
        <>
        <div data-help-id="screen-builder-summary">
        <DiagnosticCard
          actions={(
            <>
              {page?.menuCode ? (
                <MemberLinkButton href={buildEnvironmentManagementPath(page.menuCode, projectId)} variant="secondary">
                  {en ? "Open Project Binding" : "프로젝트 바인딩 열기"}
                </MemberLinkButton>
              ) : null}
              {page?.publishedVersionId ? (
                <MemberLinkButton href={buildCurrentRuntimeComparePath(installFlowQuery)} variant="secondary">
                  {en ? "Open Install Compare" : "설치 Compare 열기"}
                </MemberLinkButton>
              ) : null}
              {page?.publishedVersionId ? (
                <MemberLinkButton href={buildRepairWorkbenchPath(installFlowQuery)} variant="secondary">
                  {en ? "Open Install Repair" : "설치 Repair 열기"}
                </MemberLinkButton>
              ) : null}
            </>
          )}
          description={en
            ? "Close one governed family by moving the same page from draft save to publish, project binding, and install pipeline without leaving the builder contract."
            : "같은 페이지를 빌더 계약 안에서 초안 저장, 발행, 프로젝트 바인딩, 설치 파이프라인까지 이어서 닫습니다."}
          eyebrow={projectId || (en ? "default project lane" : "기본 프로젝트 레인")}
          status={installReady ? (en ? "INSTALL READY" : "설치 준비 완료") : (en ? "FLOW ACTIVE" : "흐름 진행 중")}
          statusTone={installReady ? "healthy" : "warning"}
          summary={(
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {installFlowContract.steps.map((step) => (
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3" key={step.key}>
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{step.title}</p>
                  <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${step.tone}`}>{step.state}</p>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-primary)] break-all">{step.detail}</p>
                </div>
              ))}
            </div>
          )}
          title={en ? "Governed Install Flow" : "Governed 설치 흐름"}
        />
        <DiagnosticCard
          description={en
            ? "This contract keeps manifest identity, binding inputs, validator inputs, and rollback evidence explicit so the family stays installable without source-copy delivery."
            : "이 계약은 manifest 식별자, binding input, validator input, rollback evidence를 명시해 source-copy 없이도 family가 설치 가능하도록 유지합니다."}
          eyebrow={en ? "install contract" : "설치 계약"}
          status={en ? "EXPLICIT" : "명시됨"}
          statusTone="healthy"
          summary={(
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">manifest</p>
                <p className="mt-2 font-mono text-sm text-[var(--kr-gov-text-primary)] break-all">{installFlowContract.manifestTarget}</p>
                <p className="mt-3 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Rollback Evidence" : "롤백 증거"}</p>
                <p className="mt-2 font-mono text-sm text-[var(--kr-gov-text-primary)] break-all">{installFlowContract.rollbackEvidenceTarget}</p>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Binding Inputs" : "바인딩 입력"}</p>
                  <div className="mt-2 space-y-2 text-sm">
                    {installFlowContract.bindingInputs.map((item) => (
                      <div className="flex items-start justify-between gap-3" key={item.key}>
                        <div>
                          <p className="font-semibold text-[var(--kr-gov-text-primary)]">{item.key}</p>
                          <p className="text-[12px] text-[var(--kr-gov-text-secondary)] break-all">{item.detail}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${item.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {item.ready ? (en ? "READY" : "준비") : (en ? "PENDING" : "대기")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Validator Inputs" : "검증 입력"}</p>
                  <div className="mt-2 space-y-2 text-sm">
                    {installFlowContract.validatorInputs.map((item) => (
                      <div className="flex items-start justify-between gap-3" key={item.key}>
                        <div>
                          <p className="font-semibold text-[var(--kr-gov-text-primary)]">{item.key}</p>
                          <p className="text-[12px] text-[var(--kr-gov-text-secondary)] break-all">{item.detail}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${item.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {item.ready ? (en ? "PASS" : "통과") : (en ? "WAIT" : "대기")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          title={en ? "Install Contract" : "설치 계약"}
        />
        <DiagnosticCard
          actions={(
            <>
              {page?.menuCode ? (
                  <MemberLinkButton
                    href={buildEnvironmentManagementPath(page.menuCode)}
                    variant="secondary"
                  >
                    {en ? "Open Install / Bind Console" : "설치 / 바인딩 콘솔 열기"}
                  </MemberLinkButton>
                ) : null}
                {page?.menuCode ? (
                  <MemberLinkButton
                    href={buildScreenRuntimePath({
                      menuCode: page.menuCode,
                      pageId: page.pageId || "",
                      menuTitle: page.menuTitle || "",
                      menuUrl: page.menuUrl || ""
                    })}
                    variant="secondary"
                  >
                    {en ? "Open Install Runtime" : "설치 런타임 열기"}
                  </MemberLinkButton>
                ) : null}
                <MemberLinkButton href={screenFlowHref} variant="secondary">
                  {en ? "Open Package Flow" : "패키지 흐름 관리"}
                </MemberLinkButton>
                <MemberLinkButton href={screenMenuAssignmentHref} variant="secondary">
                  {en ? "Open Menu Package Binding" : "메뉴 패키지 바인딩"}
                </MemberLinkButton>
                <MemberPermissionButton allowed={screenBuilderAuthority.allowsAction("update")} disabled={!page?.menuCode || saving} onClick={() => { void handleSaveWithAuthority(); }} reason={screenBuilderAuthority.getActionReason("update", en)} variant="primary">
                  {saving ? (en ? "Saving..." : "저장 중...") : (en ? "Save Package Draft" : "패키지 초안 저장")}
                </MemberPermissionButton>
                <MemberPermissionButton allowed={screenBuilderAuthority.allowsAction("execute")} disabled={!page?.menuCode || saving || publishIssueCount > 0} onClick={() => { void handlePublishWithAuthority(); }} reason={screenBuilderAuthority.getActionReason("execute", en)} variant="info">
                  {saving ? (en ? "Working..." : "처리 중...") : (en ? "Build Install Snapshot" : "설치 스냅샷 빌드")}
                </MemberPermissionButton>
                <MemberPermissionButton allowed={screenBuilderAuthority.allowsAction("query")} disabled={!page?.menuCode || previewLoading} onClick={() => { void handlePreviewRefreshWithAuthority(false); }} reason={screenBuilderAuthority.getActionReason("query", en)} variant="secondary">
                  {previewLoading ? (en ? "Refreshing..." : "갱신 중...") : (en ? "Refresh Package Preview" : "패키지 미리보기 갱신")}
                </MemberPermissionButton>
              </>
            )}
            description={en ? "Use this studio to save package drafts, build install snapshots, and hand off runtime validation for the current menu." : "현재 메뉴 기준으로 패키지 초안을 저장하고, 설치 스냅샷을 만들고, 런타임 검증으로 넘기는 스튜디오입니다."}
            eyebrow={page?.templateType || "EDIT_PAGE"}
            status={publishReady ? (en ? "READY" : "준비 완료") : (en ? "BLOCKED" : "차단")}
            statusTone={publishReady ? "healthy" : "danger"}
            summary={(
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">menuCode / pageId</p>
                  <p className="mt-2 font-mono text-sm">{packageQueueSummary.menuCode} / {packageQueueSummary.pageId}</p>
                </div>
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Install Target" : "설치 타깃"}</p>
                  <p className="mt-2 font-mono text-sm break-all">{packageQueueSummary.menuUrl}</p>
                </div>
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">releaseUnit / package</p>
                  <p className="mt-2 font-mono text-sm">{packageQueueSummary.releaseUnitId} / {packageQueueSummary.runtimePackageId}</p>
                </div>
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Validator Gate" : "검증 게이트"}</p>
                  <p className="mt-2 text-lg font-black">{packageQueueSummary.validatorPassCount} / {packageQueueSummary.validatorTotalCount}</p>
                  <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">
                    {en ? `Issues ${packageQueueSummary.issueCount} / Trace ${packageQueueSummary.deployTraceId}` : `이슈 ${packageQueueSummary.issueCount} / 추적 ${packageQueueSummary.deployTraceId}`}
                  </p>
                </div>
              </div>
            )}
            title={en ? "Package Builder Actions" : "패키지 빌더 액션"}
          />
        </div>
        <DiagnosticCard
          description={en ? "Authority profile embedded in the current package draft artifact." : "현재 패키지 초안 산출물에 포함되는 권한 프로필입니다."}
          eyebrow={draftAuthorityProfile?.tier || (en ? "UNASSIGNED" : "미지정")}
          status={draftAuthorityProfile?.authorCode || (en ? "MISSING" : "없음")}
          statusTone={draftAuthorityProfile?.authorCode ? "healthy" : "warning"}
          summary={(
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-[var(--kr-gov-text-secondary)]">{en ? "Scope" : "범위"}</div>
                <div className="font-semibold text-[var(--kr-gov-text-primary)]">{draftAuthorityProfile?.scopePolicy || "-"}</div>
              </div>
              <div>
                <div className="text-[var(--kr-gov-text-secondary)]">{en ? "Actor" : "주체"}</div>
                <div className="font-semibold text-[var(--kr-gov-text-primary)]">{draftAuthorityProfile?.actorType || "-"}</div>
              </div>
              <div>
                <div className="text-[var(--kr-gov-text-secondary)]">{en ? "Feature Grants" : "기능 권한"}</div>
                <div className="font-semibold text-[var(--kr-gov-text-primary)]">{draftAuthorityProfile?.featureCodes?.length || 0}</div>
              </div>
            </div>
          )}
          title={draftAuthorityProfile?.label || (en ? "Package Draft Authority Profile" : "패키지 초안 권한 프로필")}
        />
        <div data-help-id="screen-builder-overview">
          <Suspense
            fallback={(
              <section className="gov-card px-6 py-8 text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "Loading overview panels..." : "개요 패널을 불러오는 중입니다."}
              </section>
            )}
          >
            <ScreenBuilderOverviewPanels
              backendDeprecatedCount={backendDeprecatedNodes.length}
              backendMissingCount={backendMissingNodes.length}
              backendUnregisteredCount={backendUnregisteredNodes.length}
              componentRegistryLength={componentRegistry.length}
              en={en}
              eventsLength={events.length}
              handleApplyTemplatePreset={handleApplyTemplatePreset}
              handleRestoreVersion={handleRestoreVersion}
              installQueueSummary={packageQueueSummary}
              nodesLength={nodes.length}
              page={page ? {
                ...page,
                screenGovernance: screenGovernanceSummary
              } : null}
              publishIssueCount={publishIssueCount}
              publishReady={publishReady}
              saving={saving}
              selectedTemplateType={selectedTemplateType}
              setSelectedTemplateType={setSelectedTemplateType}
            />
          </Suspense>
        </div>

        <div data-help-id="screen-builder-governance">
          <Suspense
            fallback={(
              <section className="gov-card px-6 py-8 text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "Loading governance workspace..." : "거버넌스 작업 영역을 불러오는 중입니다."}
              </section>
            )}
          >
            <ScreenBuilderGovernancePanels
              aiNodeTreeRows={aiNodeTreeRows}
              addAiNodeTreeRow={addAiNodeTreeRow}
              authorityLoading={authorityLoading}
              authorityAssignmentAuthorities={authorityAssignmentAuthorities}
              authorityRoleCategories={authorityRoleCategories}
              authorityRoleCategoryOptions={authorityRoleCategoryOptions}
              authorityRoleTemplates={authorityRoleTemplates}
              applyAuthorityRoleToDraft={applyAuthorityRoleToDraft}
              autoReplacePreviewItems={autoReplacePreviewItems}
              backendDeprecatedNodes={backendDeprecatedNodes}
              backendMissingNodes={backendMissingNodes}
              backendUnregisteredNodes={backendUnregisteredNodes}
              componentPromptSurface={componentPromptSurface}
              componentRegistry={componentRegistry}
              componentTypeOptions={componentTypeOptions}
              copiedButtonStyleId={copiedButtonStyleId}
              copyButtonStyleId={copyButtonStyleId}
              draftAuthorityAuthorCode={String(draftAuthorityProfile?.authorCode || "")}
              en={en}
              filteredComponentRegistry={filteredComponentRegistry}
              filteredSystemCatalog={filteredSystemCatalog}
              handleAddNodeFromComponent={(componentType) => runScreenBuilderAction("create", () => handleAddNodeFromComponent(componentType), { component: "screen-builder-add-node", componentType })}
              handleAddNodeTreeFromAiSurface={() => runScreenBuilderAction("create", handleAddNodeTreeFromAiSurface, { component: "screen-builder-add-node-tree" })}
              handleAutoReplaceDeprecated={() => runScreenBuilderAction("update", handleAutoReplaceDeprecated, { component: "screen-builder-auto-replace" })}
              handleDeleteRegistryItem={() => runScreenBuilderAction("delete", handleDeleteRegistryItem, { component: "screen-builder-delete-registry-item" })}
              handleDeprecateComponent={(componentId) => runScreenBuilderAction("update", () => handleDeprecateComponent(componentId), { component: "screen-builder-deprecate-component", componentId })}
              handlePreviewAutoReplaceDeprecated={() => runScreenBuilderAction("query", handlePreviewAutoReplaceDeprecated, { component: "screen-builder-preview-auto-replace" })}
              handleRemapRegistryUsage={() => runScreenBuilderAction("update", handleRemapRegistryUsage, { component: "screen-builder-remap-registry-usage" })}
              handleSaveRegistryItem={() => runScreenBuilderAction("update", handleSaveRegistryItem, { component: "screen-builder-save-registry-item" })}
              handleScanRegistryDiagnostics={() => runScreenBuilderAction("query", handleScanRegistryDiagnostics, { component: "screen-builder-scan-registry-diagnostics" })}
              registryEditorDescription={registryEditorDescription}
              registryEditorPropsJson={registryEditorPropsJson}
              registryEditorLabel={registryEditorLabel}
              registryEditorReplacementId={registryEditorReplacementId}
              registryEditorStatus={registryEditorStatus}
              registryEditorType={registryEditorType}
              registryScanRows={registryScanRows}
              registryStatusFilter={registryStatusFilter}
              registryTypeFilter={registryTypeFilter}
              registryUsageLoading={registryUsageLoading}
              registryUsageRows={registryUsageRows}
              removeAiNodeTreeRow={removeAiNodeTreeRow}
              saving={saving}
              selectedCatalogType={selectedCatalogType}
              selectedRegistryInventoryItem={selectedRegistryInventoryItem}
              setRegistryEditorDescription={setRegistryEditorDescription}
              setRegistryEditorLabel={setRegistryEditorLabel}
              setRegistryEditorPropsJson={setRegistryEditorPropsJson}
              setRegistryEditorReplacementId={setRegistryEditorReplacementId}
              setRegistryEditorStatus={setRegistryEditorStatus}
              setRegistryEditorType={setRegistryEditorType}
              setRegistryStatusFilter={setRegistryStatusFilter}
              setRegistryTypeFilter={setRegistryTypeFilter}
              setReplacementComponentId={setReplacementComponentId}
              setSelectedNodeId={setSelectedNodeId}
              setSelectedRegistryComponentId={setSelectedRegistryComponentId}
              systemCatalogInstances={systemCatalogInstances}
              uniqueUsageUrlsByComponent={uniqueUsageUrlsByComponent}
              updateAiNodeTreeRow={updateAiNodeTreeRow}
            />
          </Suspense>
        </div>

        <div data-help-id="screen-builder-editor">
          <Suspense
            fallback={(
              <section className="gov-card px-6 py-8 text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "Loading editor panels..." : "편집 패널을 불러오는 중입니다."}
              </section>
            )}
          >
            <ScreenBuilderEditorPanels
              addNode={addNode}
              availableApis={availableApis}
              collapsedNodeIdSet={collapsedNodeIdSet}
              commandHasApis={Boolean(commandState.value?.page?.apis?.length)}
              componentDescription={componentDescription}
              componentLabel={componentLabel}
              componentRegistry={componentRegistry}
              dragNodeId={dragNodeId}
              duplicateSelectedNode={duplicateSelectedNode}
              en={en}
              ensureSelectedEvent={ensureSelectedEvent}
              filteredPalette={filteredPalette}
              handleRegisterSelectedComponent={async () => {
                await runScreenBuilderAction("create", handleRegisterSelectedComponent, { component: "screen-builder-register-selected-component" });
              }}
              handleReplaceSelectedComponent={async () => {
                await runScreenBuilderAction("update", handleReplaceSelectedComponent, { component: "screen-builder-replace-selected-component" });
              }}
              menuUrl={page?.menuUrl}
              moveSelectedNode={moveSelectedNode}
              nodeTreeRows={nodeTreeRows}
              nodes={nodes}
              previewMessage={previewMessage}
              previewMode={previewMode}
              previewNodes={previewNodes}
              publishedVersionId={page?.publishedVersionId}
              removeSelectedNode={removeSelectedNode}
              reorderNodes={reorderNodes}
              replacementComponentId={replacementComponentId}
              saving={saving}
              selectedApi={selectedApi}
              selectedEvent={selectedEvent}
              selectedNode={selectedNode}
              selectedNodeProps={selectedNodeProps}
              selectedRegistryComponent={selectedRegistryComponent}
              selectedTemplateType={selectedTemplateType}
              setComponentDescription={setComponentDescription}
              setComponentLabel={setComponentLabel}
              setDragNodeId={setDragNodeId}
              setEvents={setEvents}
              setMessage={setMessage}
              setNodes={setNodes}
              setPreviewMode={setPreviewMode}
              setReplacementComponentId={setReplacementComponentId}
              setSelectedNodeId={setSelectedNodeId}
              toggleCollapsedNode={toggleCollapsedNode}
              updateSelectedEvent={updateSelectedEvent}
              updateSelectedEventApi={updateSelectedEventApi}
              updateSelectedEventRequestMapping={updateSelectedEventRequestMapping}
              updateSelectedEventTarget={updateSelectedEventTarget}
              updateSelectedNodeField={updateSelectedNodeField}
            />
          </Suspense>
        </div>
        </>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
