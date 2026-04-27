import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { resolveAuthorityScope } from "../../app/policy/authorityScope";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  deleteEnvironmentManagedPage,
  deleteEnvironmentFeature,
  fetchEnvironmentFeatureImpact,
  fetchEnvironmentManagedPageImpact,
  fetchSystemAssetList,
  updateEnvironmentFeature,
  updateEnvironmentManagedPage
} from "../../lib/api/platform";
import { fetchFunctionManagementPage, fetchMenuManagementPage } from "../../lib/api/platform";
import type { FunctionManagementPagePayload, MenuManagementPagePayload } from "../../lib/api/platformTypes";
import { postFormUrlEncoded } from "../../lib/api/core";
import { resolveResonanceProjectId } from "../../lib/api/resonanceControlPlane";
import { fetchAuditEvents } from "../../platform/observability/observability";
import {
  buildAssetInventoryPath,
  buildAssetImpactPath,
  buildAssetLifecyclePath,
  buildAssetGapPath,
  buildFeatureManagementCreatePath,
  buildFeatureManagementPath,
  buildFullStackManagementPath,
  buildHelpManagementPath,
  buildInfraPath,
  buildMenuCreatePagePath,
  buildObservabilityPath,
  buildPlatformStudioPath,
  buildVerificationCenterPath
} from "../../platform/routes/platformPaths";
import { rebuildScreenBuilderStatusSummary } from "../../lib/api/platform";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { getCurrentRuntimePathname, getCurrentRuntimeSearch } from "../../app/routes/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { numberOf, stringOf, submitFormRequest } from "../admin-system/adminSystemShared";
import { ContextKeyStrip } from "../admin-ui/ContextKeyStrip";
import { authorDesignContextKeys } from "../admin-ui/contextKeyPresets";
import { BinaryStatusCard, CollectionResultPanel, DiagnosticCard, GridToolbar, KeyValueGridPanel, MemberButton, MemberLinkButton, MemberPermissionButton, MetaListPanel, PageStatusNotice, SummaryMetricCard, WarningPanel } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { MemberStateCard } from "../member/sections";
import {
  BUILDER_INSTALL_ARTIFACTS,
  BUILDER_INSTALL_REQUIRED_BINDINGS,
  BUILDER_INSTALL_VALIDATOR_CHECKS,
  buildBuilderInstallQueueSummary,
  type BuilderInstallBindingKey,
  type BuilderInstallValidatorCheckKey,
  describeBuilderInstallBinding,
  describeBuilderValidatorCheck
} from "../screen-builder/shared/installableBuilderContract";
import {
  buildSuggestedPageCode,
  buildCurrentRuntimeComparePath,
  buildRepairWorkbenchPath,
  buildScreenBuilderPath,
  buildScreenRuntimePath,
  createEmptyFeatureDraft,
  createEmptySelectedMenuDraft,
  describeScreenBuilderFilter,
  describeScreenBuilderIssueReason,
  describeScreenBuilderQueueFocus,
  ENVIRONMENT_MANAGEMENT_MENU_CODE,
  matchesScreenBuilderIssueReason,
  normalizeRows,
  recommendBuilderNextAction,
  resolveDefaultSelectedMenuCode,
  summarizeBuilderBlockingReason,
  summarizeBuilderIssueBreakdown,
  summarizeMenuAuditDiff,
  type FeatureDeleteImpact,
  type FeatureDraft,
  type GovernanceRemediationItem,
  type ManagedMenuRow,
  type PageDeleteImpact,
  type SelectedMenuDraft,
  validateManagedUrl
} from "./environmentManagementShared";
import { useEnvironmentGovernance } from "./useEnvironmentGovernance";

function renderMetaList(items: string[], emptyLabel: string) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--kr-gov-text-secondary)]">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-mono text-[var(--kr-gov-text-primary)]">
          {item}
        </span>
      ))}
    </div>
  );
}

function getEnvironmentRoutePath() {
  return getCurrentRuntimePathname();
}

function getEnvironmentSearchParams() {
  return new URLSearchParams(getCurrentRuntimeSearch());
}

function getEnvironmentSearchParam(name: string) {
  return getEnvironmentSearchParams().get(name) || "";
}

export function EnvironmentManagementHubPage() {
  const en = isEnglish();
  const sessionState = useFrontendSession();
  const resonanceProjectId = useMemo(() => resolveResonanceProjectId(getEnvironmentSearchParam("projectId")), []);
  const initialMenuType = getEnvironmentSearchParam("menuType") || "ADMIN";
  const [menuType, setMenuType] = useState(initialMenuType);
  const [menuSearch, setMenuSearch] = useState(getEnvironmentSearchParam("keyword"));
  const [screenBuilderFilter, setScreenBuilderFilter] = useState<"ALL" | "PUBLISHED_ONLY" | "DRAFT_ONLY" | "READY_ONLY" | "BLOCKED_ONLY" | "ISSUE_ONLY" | "STALE_PUBLISH_ONLY" | "PARITY_DRIFT_ONLY" | "PARITY_GAP_ONLY">("ALL");
  const [screenBuilderIssueReasonFilter, setScreenBuilderIssueReasonFilter] = useState<"ALL" | "UNREGISTERED" | "MISSING" | "DEPRECATED">("ALL");
  const [featureSearch, setFeatureSearch] = useState("");
  const [featureLinkFilter, setFeatureLinkFilter] = useState<"ALL" | "UNASSIGNED" | "LINKED">("ALL");
  const [selectedMenuCode, setSelectedMenuCode] = useState(
    resolveDefaultSelectedMenuCode(initialMenuType, getEnvironmentSearchParam("menuCode"))
  );
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [parentCodeValue, setParentCodeValue] = useState("");
  const [codeNm, setCodeNm] = useState("");
  const [codeDc, setCodeDc] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [menuIcon, setMenuIcon] = useState("web");
  const [useAt, setUseAt] = useState("Y");
  const [featureDraft, setFeatureDraft] = useState<FeatureDraft>(createEmptyFeatureDraft);
  const [selectedMenuDraft, setSelectedMenuDraft] = useState<SelectedMenuDraft>(createEmptySelectedMenuDraft);
  const [menuSaving, setMenuSaving] = useState(false);
  const [pageDeleteImpactLoading, setPageDeleteImpactLoading] = useState(false);
  const [pendingPageDeleteImpact, setPendingPageDeleteImpact] = useState<PageDeleteImpact | null>(null);
  const [pageDeleting, setPageDeleting] = useState(false);
  const [menuAuditRows, setMenuAuditRows] = useState<Array<Record<string, unknown>>>([]);
  const [menuAuditLoading, setMenuAuditLoading] = useState(false);
  const [editingFeatureCode, setEditingFeatureCode] = useState("");
  const [editingFeatureDraft, setEditingFeatureDraft] = useState<FeatureDraft>(createEmptyFeatureDraft);
  const [featureSaving, setFeatureSaving] = useState(false);
  const [deleteImpactLoading, setDeleteImpactLoading] = useState(false);
  const [deleteImpactFeatureCode, setDeleteImpactFeatureCode] = useState("");
  const [pendingDeleteImpact, setPendingDeleteImpact] = useState<FeatureDeleteImpact | null>(null);
  const [featureDeleting, setFeatureDeleting] = useState(false);
  const [metadataExpanded, setMetadataExpanded] = useState(false);
  const [selectedSummaryRebuildBusy, setSelectedSummaryRebuildBusy] = useState(false);
  const [allSummaryRebuildBusy, setAllSummaryRebuildBusy] = useState(false);
  const [systemAssetSummary, setSystemAssetSummary] = useState<{ total: number; health: string; active: number; infraCount: number; serviceCount: number } | null>(null);

  const loadSystemAssetSummary = async () => {
    try {
      const data = await fetchSystemAssetList();
      setSystemAssetSummary({
        total: data.length,
        health: data.every(a => a.healthStatus === "OK") ? "Healthy" : "Check",
        active: data.filter(a => a.activeYn === "Y").length,
        infraCount: data.filter(a => a.assetFamily === "INFRA").length,
        serviceCount: data.filter(a => a.assetFamily === "SERVICE").length
      });
    } catch (err) {
      console.error("Failed to load system asset summary", err);
    }
  };

  useEffect(() => {
    void loadSystemAssetSummary();
  }, []);

  const resolveManagedPageId = (menuCode: string, pageId?: string | null) => pageId || menuCode.toLowerCase();

  const buildManagedBuilderHref = (menu: { code: string; label: string; menuUrl?: string }, pageId?: string | null) =>
    buildScreenBuilderPath({
      menuCode: menu.code,
      pageId: resolveManagedPageId(menu.code, pageId),
      menuTitle: menu.label,
      menuUrl: menu.menuUrl || ""
    });

  const buildManagedRuntimeHref = (menu: { code: string; label: string; menuUrl?: string }, pageId?: string | null) =>
    buildScreenRuntimePath({
      menuCode: menu.code,
      pageId: resolveManagedPageId(menu.code, pageId),
      menuTitle: menu.label,
      menuUrl: menu.menuUrl || ""
    });

  const buildManagedCompareHref = (menu: { code: string; label: string; menuUrl?: string }, pageId?: string | null) =>
    buildCurrentRuntimeComparePath({
      menuCode: menu.code,
      pageId: resolveManagedPageId(menu.code, pageId),
      menuTitle: menu.label,
      menuUrl: menu.menuUrl || ""
    });

  const buildManagedObservabilityHref = (menu: { code: string }, pageId?: string | null, searchKeyword = "SCREEN_BUILDER_") =>
    buildObservabilityPath({
      menuCode: menu.code,
      pageId: resolveManagedPageId(menu.code, pageId),
      searchKeyword
    });

  const governanceEngineCards = useMemo(() => ([
    {
      key: "scope-policy",
      title: en ? "Scope Policy Engine" : "스코프 정책 엔진",
      description: en
        ? "If a component does not explicitly allow ALL, it must resolve to own-company scope and require actor insttId."
        : "컴포넌트가 명시적으로 ALL을 허용하지 않으면 자기 회사 스코프로 강제하고 actor insttId를 필수로 요구합니다.",
      bullets: en
        ? ["allowAllScope", "enforceOwnCompanyScope", "restrictTargetCompanyOutput"]
        : ["allowAllScope", "enforceOwnCompanyScope", "restrictTargetCompanyOutput"]
    },
    {
      key: "type-policy",
      title: en ? "Member Type Policy Engine" : "회원 타입 정책 엔진",
      description: en
        ? "Combos, popups, and features can declare E/P/C/G limits so only matching actors and targets can use them."
        : "콤보, 팝업, 기능이 E/P/C/G 제한을 선언해 일치하는 사용자와 대상만 사용하도록 합니다.",
      bullets: en
        ? ["allowedMemberTypes", "targetMemberType", "TYPE role layering"]
        : ["allowedMemberTypes", "targetMemberType", "타입 롤 레이어"]
    },
    {
      key: "selector-query",
      title: en ? "Selector / Query Scope Engine" : "셀렉터 / 쿼리 스코프 엔진",
      description: en
        ? "Common selectors should inject company, type, and state predicates before a list, combo, or popup is rendered."
        : "목록, 콤보, 팝업이 그려지기 전에 공통 셀렉터가 회사, 타입, 상태 조건을 주입합니다.",
      bullets: en
        ? ["scoped list query", "grantable roles", "company-matched output"]
        : ["scoped list query", "grantable roles", "company-matched output"]
    },
    {
      key: "audit-diagnostic",
      title: en ? "Audit / Diagnostic Engine" : "감사 / 진단 엔진",
      description: en
        ? "Page, component, function, API, and common-code usage should be diagnosable with the same governed metadata."
        : "페이지, 컴포넌트, 기능, API, 공통코드 사용처를 같은 거버넌스 메타데이터로 진단할 수 있어야 합니다.",
      bullets: en
        ? ["screen command", "manifest registry", "trace + audit"]
        : ["screen command", "manifest registry", "trace + audit"]
    }
  ]), [en]);

  const menuPageState = useAsyncValue<MenuManagementPagePayload>(() => fetchMenuManagementPage(menuType), [menuType]);
  const menuPage = menuPageState.value;

  const featurePageState = useAsyncValue<FunctionManagementPagePayload>(
    () => fetchFunctionManagementPage({ menuType, searchMenuCode: selectedMenuCode }),
    [menuType, selectedMenuCode]
  );
  const featurePage = featurePageState.value;

  const menuRows = useMemo(
    () => normalizeRows(((menuPage?.menuRows || []) as Array<Record<string, unknown>>)),
    [menuPage?.menuRows]
  );
  const groupMenuOptions = ((menuPage?.groupMenuOptions || []) as Array<Record<string, string>>);
  const iconOptions = ((menuPage?.iconOptions || []) as string[]);
  const useAtOptions = ((menuPage?.useAtOptions || []) as string[]);
  const featureRows = ((featurePage?.featureRows || []) as Array<Record<string, unknown>>);
  const selectedMenu = useMemo(
    () => menuRows.find((row) => row.code === selectedMenuCode) || null,
    [menuRows, selectedMenuCode]
  );
  const selectedMenuIsPage = selectedMenu?.code.length === 8;
  const {
    collecting,
    governanceDraftOnly,
    governanceError,
    governanceLoading,
    governanceMessage,
    governanceOverview,
    governancePage,
    governancePageId,
    governanceRemediationItems,
    governanceSurfaceChains,
    governanceSurfaceEventRows,
    governanceWarnings,
    handleAutoCollect,
    lastAutoCollectAt,
    permissionSummary,
    postCollectAuditRows,
    postCollectTraceRows,
    screenBuilderFreshnessMap,
    screenBuilderIssueDetailMap,
    screenBuilderIssueMap,
    screenBuilderParityMap,
    screenBuilderPageCounts,
    screenBuilderPublishedMap,
    screenBuilderStatus,
    setGovernanceError,
    setGovernanceMessage
  } = useEnvironmentGovernance({
    en,
    featureRows,
    menuRows,
    onAfterCollect: async () => {
      await menuPageState.reload();
      await featurePageState.reload();
    },
    selectedMenu,
    selectedMenuCode,
    selectedMenuIsPage
  });
  const environmentAuthority = useMemo(() => resolveAuthorityScope({
    scopeName: "environment-management",
    routePath: getEnvironmentRoutePath(),
    session: sessionState.value,
    menuCode: governancePage?.page?.menuPermission?.menuCode || ENVIRONMENT_MANAGEMENT_MENU_CODE,
    requiredViewFeatureCode: governancePage?.page?.menuPermission?.requiredViewFeatureCode || `${ENVIRONMENT_MANAGEMENT_MENU_CODE}_VIEW`,
    featureCodes: governancePage?.page?.menuPermission?.featureCodes,
    featureRows: governancePage?.page?.menuPermission?.featureRows
  }), [
    governancePage?.page?.menuPermission?.featureCodes,
    governancePage?.page?.menuPermission?.featureRows,
    governancePage?.page?.menuPermission?.menuCode,
    governancePage?.page?.menuPermission?.requiredViewFeatureCode,
    sessionState.value
  ]);
  const pagePermissionDenied = !sessionState.loading && !governanceLoading && !environmentAuthority.entryAllowed;

  const filteredMenus = useMemo(() => {
    const keyword = menuSearch.trim().toLowerCase();
    return menuRows.filter((row) => {
      if (screenBuilderFilter === "PUBLISHED_ONLY" && row.code.length === 8 && !screenBuilderPublishedMap[row.code]) {
        return false;
      }
      if (screenBuilderFilter === "DRAFT_ONLY" && row.code.length === 8 && screenBuilderPublishedMap[row.code]) {
        return false;
      }
      if (screenBuilderFilter === "ISSUE_ONLY" && row.code.length === 8 && !(screenBuilderIssueMap[row.code] > 0)) {
        return false;
      }
      if (screenBuilderFilter === "STALE_PUBLISH_ONLY" && row.code.length === 8 && screenBuilderFreshnessMap[row.code]?.state !== "STALE") {
        return false;
      }
      if (screenBuilderFilter === "PARITY_DRIFT_ONLY" && row.code.length === 8 && screenBuilderParityMap[row.code]?.state !== "DRIFT") {
        return false;
      }
      if (screenBuilderFilter === "PARITY_GAP_ONLY" && row.code.length === 8 && screenBuilderParityMap[row.code]?.state !== "GAP") {
        return false;
      }
      if (screenBuilderFilter === "READY_ONLY" && row.code.length === 8 && (screenBuilderIssueMap[row.code] || 0) > 0) {
        return false;
      }
      if (screenBuilderFilter === "BLOCKED_ONLY" && row.code.length === 8 && (screenBuilderIssueMap[row.code] || 0) === 0) {
        return false;
      }
      if (row.code.length === 8 && screenBuilderIssueReasonFilter !== "ALL") {
        const detail = screenBuilderIssueDetailMap[row.code];
        if (!matchesScreenBuilderIssueReason(detail, screenBuilderIssueReasonFilter)) {
          return false;
        }
      }
      if (!keyword) {
        return true;
      }
      return (
        row.code.toLowerCase().includes(keyword)
        || row.label.toLowerCase().includes(keyword)
        || row.labelEn.toLowerCase().includes(keyword)
        || row.menuUrl.toLowerCase().includes(keyword)
      );
    });
  }, [menuRows, menuSearch, screenBuilderFilter, screenBuilderFreshnessMap, screenBuilderIssueDetailMap, screenBuilderIssueMap, screenBuilderIssueReasonFilter, screenBuilderParityMap, screenBuilderPublishedMap]);
  const screenBuilderIssuePageCounts = useMemo(() => ({
    UNREGISTERED: screenBuilderPageCounts.unregisteredPages,
    MISSING: screenBuilderPageCounts.missingPages,
    DEPRECATED: screenBuilderPageCounts.deprecatedPages
  }), [screenBuilderPageCounts.deprecatedPages, screenBuilderPageCounts.missingPages, screenBuilderPageCounts.unregisteredPages]);

  const selectedMenuBuilderAudits = useMemo(
    () => menuAuditRows.filter((row) => String(row.actionCode || "").startsWith("SCREEN_BUILDER_")).slice(0, 3),
    [menuAuditRows]
  );
  const latestSelectedMenuBuilderAudit = selectedMenuBuilderAudits[0] || null;
  const hasActiveScreenBuilderFilter = screenBuilderFilter !== "ALL" || screenBuilderIssueReasonFilter !== "ALL";
  const activeScreenBuilderFilterLabel = describeScreenBuilderFilter(screenBuilderFilter, screenBuilderIssueReasonFilter, en);
  const selectedBuilderStatus = screenBuilderStatus;
  const selectedMenuBuilderIssueCount = (screenBuilderStatus?.unregisteredCount || 0) + (screenBuilderStatus?.missingCount || 0) + (screenBuilderStatus?.deprecatedCount || 0);
  const selectedMenuPublishReady = selectedMenuBuilderIssueCount === 0;
  const selectedPublishFreshnessClasses = useMemo(() => {
    switch (selectedBuilderStatus?.publishFreshnessState) {
      case "FRESH":
        return "border-emerald-200 bg-emerald-50";
      case "AGING":
        return "border-amber-200 bg-amber-50";
      case "STALE":
      case "UNKNOWN":
        return "border-red-200 bg-red-50";
      case "UNPUBLISHED":
      default:
        return "border-slate-200 bg-slate-50";
    }
  }, [selectedBuilderStatus?.publishFreshnessState]);
  const selectedParityClasses = useMemo(() => {
    switch (selectedBuilderStatus?.parityState) {
      case "MATCH":
        return "border-emerald-200 bg-emerald-50";
      case "DRIFT":
        return "border-amber-200 bg-amber-50";
      case "GAP":
        return "border-red-200 bg-red-50";
      case "UNAVAILABLE":
      default:
        return "border-slate-200 bg-slate-50";
    }
  }, [selectedBuilderStatus?.parityState]);
  const selectedIssueReason = useMemo<"UNREGISTERED" | "MISSING" | "DEPRECATED" | null>(() => {
    if (!selectedBuilderStatus || selectedMenuPublishReady) {
      return null;
    }
    if (selectedBuilderStatus.unregisteredCount > 0) {
      return "UNREGISTERED";
    }
    if (selectedBuilderStatus.missingCount > 0) {
      return "MISSING";
    }
    if (selectedBuilderStatus.deprecatedCount > 0) {
      return "DEPRECATED";
    }
    return null;
  }, [selectedBuilderStatus, selectedMenuPublishReady]);
  const sameIssueMenus = useMemo(() => {
    if (!selectedIssueReason) {
      return [] as ManagedMenuRow[];
    }
    return menuRows.filter((row) => row.code.length === 8 && matchesScreenBuilderIssueReason(screenBuilderIssueDetailMap[row.code], selectedIssueReason));
  }, [menuRows, screenBuilderIssueDetailMap, selectedIssueReason]);
  const sameIssueIndex = useMemo(() => {
    if (!selectedMenu || !selectedIssueReason) {
      return -1;
    }
    return sameIssueMenus.findIndex((row) => row.code === selectedMenu.code);
  }, [sameIssueMenus, selectedIssueReason, selectedMenu]);
  const nextSameIssueMenu = useMemo(() => {
    if (sameIssueMenus.length === 0) {
      return null;
    }
    if (sameIssueIndex >= 0 && sameIssueIndex < sameIssueMenus.length - 1) {
      return sameIssueMenus[sameIssueIndex + 1];
    }
    return sameIssueMenus[0] || null;
  }, [sameIssueIndex, sameIssueMenus]);
  const previousSameIssueMenu = useMemo(() => {
    if (sameIssueMenus.length === 0) {
      return null;
    }
    if (sameIssueIndex > 0) {
      return sameIssueMenus[sameIssueIndex - 1];
    }
    return sameIssueMenus[sameIssueMenus.length - 1] || null;
  }, [sameIssueIndex, sameIssueMenus]);
  const remainingSameIssueCount = useMemo(() => {
    if (sameIssueMenus.length === 0) {
      return 0;
    }
    return Math.max(sameIssueMenus.length - 1, 0);
  }, [sameIssueMenus.length]);
  const resolvedSameIssueCount = useMemo(() => {
    if (sameIssueMenus.length === 0) {
      return 0;
    }
    return Math.max((sameIssueIndex >= 0 ? sameIssueIndex : 0), 0);
  }, [sameIssueIndex, sameIssueMenus.length]);
  const sameIssueProgressPercent = useMemo(() => {
    if (sameIssueMenus.length === 0) {
      return 0;
    }
    return Math.round((resolvedSameIssueCount / sameIssueMenus.length) * 100);
  }, [resolvedSameIssueCount, sameIssueMenus.length]);
  const sameIssueQueueSummary = useMemo(() => {
    return sameIssueMenus.reduce((summary, row, index) => {
      const published = Boolean(screenBuilderPublishedMap[row.code]);
      summary.totalPublished += published ? 1 : 0;
      summary.totalDraft += published ? 0 : 1;
      if (index > sameIssueIndex) {
        summary.remainingPublished += published ? 1 : 0;
        summary.remainingDraft += published ? 0 : 1;
      }
      return summary;
    }, {
      totalPublished: 0,
      totalDraft: 0,
      remainingPublished: 0,
      remainingDraft: 0
    });
  }, [sameIssueIndex, sameIssueMenus, screenBuilderPublishedMap]);
  useEffect(() => {
    if (!pagePermissionDenied) {
      return;
    }
    environmentAuthority.logAuthorityDenied("view", {
      component: "environment-management-hub",
      menuCode: ENVIRONMENT_MANAGEMENT_MENU_CODE
    });
  }, [environmentAuthority, pagePermissionDenied]);
  useEffect(() => {
    if (!menuPage && !featurePage) {
      return;
    }
    logGovernanceScope("PAGE", "environment-management-hub", {
      route: getEnvironmentRoutePath(),
      menuType,
      selectedMenuCode,
      menuRowCount: menuRows.length,
      featureRowCount: featureRows.length,
      filteredMenuCount: filteredMenus.length,
      governanceRemediationCount: governanceRemediationItems.length
    });
    logGovernanceScope("COMPONENT", "environment-management-governance", {
      component: "environment-management-governance",
      selectedMenuCode,
      issueCount: selectedMenuBuilderIssueCount,
      remediationCount: governanceRemediationItems.length,
      draftOnly: governanceDraftOnly
    });
  }, [
    featurePage,
    featureRows.length,
    filteredMenus.length,
    governanceDraftOnly,
    governanceRemediationItems.length,
    menuPage,
    menuRows.length,
    menuType,
    selectedMenuBuilderIssueCount,
    selectedMenuCode
  ]);
  const nextRemainingPublishedSameIssueMenu = useMemo(() => (
    sameIssueMenus.find((row, index) => index > sameIssueIndex && Boolean(screenBuilderPublishedMap[row.code])) || null
  ), [sameIssueIndex, sameIssueMenus, screenBuilderPublishedMap]);
  const nextRemainingDraftSameIssueMenu = useMemo(() => (
    sameIssueMenus.find((row, index) => index > sameIssueIndex && !Boolean(screenBuilderPublishedMap[row.code])) || null
  ), [sameIssueIndex, sameIssueMenus, screenBuilderPublishedMap]);
  const previousPublishedSameIssueMenu = useMemo(() => {
    for (let index = sameIssueIndex - 1; index >= 0; index -= 1) {
      const row = sameIssueMenus[index];
      if (Boolean(screenBuilderPublishedMap[row.code])) {
        return row;
      }
    }
    return null;
  }, [sameIssueIndex, sameIssueMenus, screenBuilderPublishedMap]);
  const previousDraftSameIssueMenu = useMemo(() => {
    for (let index = sameIssueIndex - 1; index >= 0; index -= 1) {
      const row = sameIssueMenus[index];
      if (!Boolean(screenBuilderPublishedMap[row.code])) {
        return row;
      }
    }
    return null;
  }, [sameIssueIndex, sameIssueMenus, screenBuilderPublishedMap]);
  const sameIssueMenuCodeSet = useMemo(() => new Set(sameIssueMenus.map((row) => row.code)), [sameIssueMenus]);
  const sameIssueIndexMap = useMemo(() => (
    sameIssueMenus.reduce<Record<string, number>>((accumulator, row, index) => {
      accumulator[row.code] = index;
      return accumulator;
    }, {})
  ), [sameIssueMenus]);
  const orderedFilteredMenus = useMemo(() => {
    if (!selectedIssueReason) {
      return filteredMenus;
    }
    return [...filteredMenus].sort((left, right) => {
      const leftIndex = sameIssueIndexMap[left.code];
      const rightIndex = sameIssueIndexMap[right.code];
      const leftInIssueFamily = Number.isInteger(leftIndex);
      const rightInIssueFamily = Number.isInteger(rightIndex);
      if (leftInIssueFamily && rightInIssueFamily) {
        return leftIndex - rightIndex;
      }
      if (leftInIssueFamily !== rightInIssueFamily) {
        return leftInIssueFamily ? -1 : 1;
      }
      return 0;
    });
  }, [filteredMenus, sameIssueIndexMap, selectedIssueReason]);
  const sameIssueRemainingMap = useMemo(() => (
    sameIssueMenus.reduce<Record<string, number>>((accumulator, row, index) => {
      accumulator[row.code] = Math.max(sameIssueMenus.length - index - 1, 0);
      return accumulator;
    }, {})
  ), [sameIssueMenus]);
  const visibleSameIssueMenus = useMemo(
    () => orderedFilteredMenus.filter((row) => sameIssueMenuCodeSet.has(row.code)),
    [orderedFilteredMenus, sameIssueMenuCodeSet]
  );
  const visibleSameIssuePublishedCount = useMemo(
    () => visibleSameIssueMenus.filter((row) => Boolean(screenBuilderPublishedMap[row.code])).length,
    [screenBuilderPublishedMap, visibleSameIssueMenus]
  );
  const visibleSameIssueDraftCount = useMemo(
    () => visibleSameIssueMenus.filter((row) => !Boolean(screenBuilderPublishedMap[row.code])).length,
    [screenBuilderPublishedMap, visibleSameIssueMenus]
  );
  const visibleSameIssueReadyCount = useMemo(
    () => visibleSameIssueMenus.filter((row) => (screenBuilderIssueMap[row.code] || 0) === 0).length,
    [screenBuilderIssueMap, visibleSameIssueMenus]
  );
  const visibleSameIssueBlockedCount = useMemo(
    () => visibleSameIssueMenus.filter((row) => (screenBuilderIssueMap[row.code] || 0) > 0).length,
    [screenBuilderIssueMap, visibleSameIssueMenus]
  );
  const visibleSameIssueRatio = useMemo(() => {
    if (orderedFilteredMenus.length === 0) {
      return 0;
    }
    return Math.round((visibleSameIssueMenus.length / orderedFilteredMenus.length) * 100);
  }, [orderedFilteredMenus.length, visibleSameIssueMenus.length]);
  const visibleOtherMenus = useMemo(
    () => orderedFilteredMenus.filter((row) => !sameIssueMenuCodeSet.has(row.code)),
    [orderedFilteredMenus, sameIssueMenuCodeSet]
  );
  const visibleOtherPublishedCount = useMemo(
    () => visibleOtherMenus.filter((row) => Boolean(screenBuilderPublishedMap[row.code])).length,
    [screenBuilderPublishedMap, visibleOtherMenus]
  );
  const visibleOtherDraftCount = useMemo(
    () => visibleOtherMenus.filter((row) => !Boolean(screenBuilderPublishedMap[row.code])).length,
    [screenBuilderPublishedMap, visibleOtherMenus]
  );
  const visibleOtherReadyCount = useMemo(
    () => visibleOtherMenus.filter((row) => (screenBuilderIssueMap[row.code] || 0) === 0).length,
    [screenBuilderIssueMap, visibleOtherMenus]
  );
  const visibleOtherBlockedCount = useMemo(
    () => visibleOtherMenus.filter((row) => (screenBuilderIssueMap[row.code] || 0) > 0).length,
    [screenBuilderIssueMap, visibleOtherMenus]
  );
  const visibleOtherRatio = useMemo(() => {
    if (orderedFilteredMenus.length === 0) {
      return 0;
    }
    return Math.round((visibleOtherMenus.length / orderedFilteredMenus.length) * 100);
  }, [orderedFilteredMenus.length, visibleOtherMenus.length]);
  const previousSameIssueMenuIssueCount = previousSameIssueMenu ? (screenBuilderIssueMap[previousSameIssueMenu.code] || 0) : 0;
  const previousSameIssueMenuIsPublished = previousSameIssueMenu ? Boolean(screenBuilderPublishedMap[previousSameIssueMenu.code]) : false;
  const nextSameIssueMenuIssueCount = nextSameIssueMenu ? (screenBuilderIssueMap[nextSameIssueMenu.code] || 0) : 0;
  const nextSameIssueMenuIsPublished = nextSameIssueMenu ? Boolean(screenBuilderPublishedMap[nextSameIssueMenu.code]) : false;
  const filteredFeatureRows = useMemo(() => {
    const keyword = featureSearch.trim().toLowerCase();
    return featureRows.filter((row) => {
      const featureCode = stringOf(row, "featureCode");
      const featureNm = stringOf(row, "featureNm");
      const featureDc = stringOf(row, "featureDc");
      const unassigned = Boolean(row.unassignedToRole);
      if (featureLinkFilter === "UNASSIGNED" && !unassigned) {
        return false;
      }
      if (featureLinkFilter === "LINKED" && unassigned) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return (
        featureCode.toLowerCase().includes(keyword)
        || featureNm.toLowerCase().includes(keyword)
        || featureDc.toLowerCase().includes(keyword)
      );
    });
  }, [featureLinkFilter, featureRows, featureSearch]);
  const createUrlValidation = useMemo(
    () => validateManagedUrl(menuUrl, menuType, menuRows, undefined, en),
    [en, menuRows, menuType, menuUrl]
  );
  const selectedUrlValidation = useMemo(
    () => validateManagedUrl(selectedMenuDraft.menuUrl, menuType, menuRows, selectedMenu?.code, en),
    [en, menuRows, menuType, selectedMenu?.code, selectedMenuDraft.menuUrl]
  );
  const selectedMenuDiff = useMemo(() => {
    if (!selectedMenu) {
      return [];
    }
    const changes: string[] = [];
    if (selectedMenu.label !== selectedMenuDraft.codeNm) changes.push(`${en ? "Name" : "메뉴명"}: ${selectedMenu.label} -> ${selectedMenuDraft.codeNm}`);
    if (selectedMenu.labelEn !== selectedMenuDraft.codeDc) changes.push(`${en ? "English name" : "영문명"}: ${selectedMenu.labelEn} -> ${selectedMenuDraft.codeDc}`);
    if (selectedMenu.menuUrl !== selectedMenuDraft.menuUrl) changes.push(`URL: ${selectedMenu.menuUrl} -> ${selectedMenuDraft.menuUrl}`);
    if (selectedMenu.menuIcon !== selectedMenuDraft.menuIcon) changes.push(`${en ? "Icon" : "아이콘"}: ${selectedMenu.menuIcon} -> ${selectedMenuDraft.menuIcon}`);
    if (selectedMenu.useAt !== selectedMenuDraft.useAt) changes.push(`${en ? "Use" : "사용 여부"}: ${selectedMenu.useAt} -> ${selectedMenuDraft.useAt}`);
    return changes;
  }, [en, selectedMenu, selectedMenuDraft.codeDc, selectedMenuDraft.codeNm, selectedMenuDraft.menuIcon, selectedMenuDraft.menuUrl, selectedMenuDraft.useAt]);
  const installBindingChecklist = useMemo(() => ([
    {
      key: "scope",
      label: en ? "Project scope selected" : "프로젝트 스코프 선택",
      ready: Boolean(menuType),
      detail: en ? `Scope ${menuType}` : `스코프 ${menuType}`
    },
    {
      key: "menu",
      label: en ? "Page menu selected" : "페이지 메뉴 선택",
      ready: Boolean(selectedMenu && selectedMenuIsPage),
      detail: selectedMenu
        ? `${selectedMenu.label} (${selectedMenu.code})`
        : (en ? "Select a page menu to bind." : "바인딩할 페이지 메뉴를 선택하세요.")
    },
    {
      key: "url",
      label: en ? "Runtime URL valid" : "런타임 URL 검증",
      ready: !selectedMenu || !selectedMenuIsPage ? false : selectedUrlValidation.tone === "success",
      detail: selectedMenu && selectedMenuIsPage
        ? selectedUrlValidation.message
        : (en ? "URL validation starts after page selection." : "페이지를 선택하면 URL 검증을 시작합니다.")
    },
    {
      key: "governance",
      label: en ? "Governance page resolved" : "거버넌스 페이지 연결",
      ready: Boolean(governancePageId),
      detail: governancePageId || (en ? "No pageId resolved yet." : "아직 pageId가 연결되지 않았습니다.")
    },
    {
      key: "publish",
      label: en ? "Builder publish-ready" : "빌더 publish 준비",
      ready: Boolean(selectedMenu && selectedMenuIsPage && selectedMenuPublishReady),
      detail: selectedMenu && selectedMenuIsPage
        ? summarizeBuilderBlockingReason(selectedMenuBuilderIssueCount, en)
        : (en ? "Publish readiness is checked for page menus only." : "Publish 준비도는 페이지 메뉴 기준으로만 계산합니다.")
    }
  ]), [
    en,
    governancePageId,
    menuType,
    selectedMenuBuilderIssueCount,
    selectedMenu,
    selectedMenuIsPage,
    selectedMenuPublishReady,
    selectedUrlValidation.message,
    selectedUrlValidation.tone
  ]);
  const installBindingReadyCount = useMemo(
    () => installBindingChecklist.filter((item) => item.ready).length,
    [installBindingChecklist]
  );
  const installManifestBindingStatuses = useMemo(() => ([
    {
      key: "projectId" as BuilderInstallBindingKey,
      ready: true,
      detail: resonanceProjectId
    },
    {
      key: "menuRoot" as BuilderInstallBindingKey,
      ready: Boolean(selectedMenu?.menuUrl),
      detail: selectedMenu?.menuUrl || "-"
    },
    {
      key: "runtimeClass" as BuilderInstallBindingKey,
      ready: Boolean(selectedMenu && selectedMenuIsPage),
      detail: selectedMenu && selectedMenuIsPage ? "ADMIN" : "-"
    },
    {
      key: "menuScope" as BuilderInstallBindingKey,
      ready: Boolean(selectedMenu && selectedMenuIsPage),
      detail: selectedMenu && selectedMenuIsPage ? "PROJECT_RUNTIME" : "-"
    },
    {
      key: "releaseUnitPrefix" as BuilderInstallBindingKey,
      ready: Boolean(selectedBuilderStatus?.releaseUnitId || selectedBuilderStatus?.publishedVersionId),
      detail: selectedBuilderStatus?.releaseUnitId || selectedBuilderStatus?.publishedVersionId || "-"
    },
    {
      key: "runtimePackagePrefix" as BuilderInstallBindingKey,
      ready: Boolean(selectedBuilderStatus?.runtimePackageId || selectedBuilderStatus?.publishedVersionId),
      detail: selectedBuilderStatus?.runtimePackageId || selectedBuilderStatus?.publishedVersionId || "-"
    }
  ]), [resonanceProjectId, selectedBuilderStatus?.publishedVersionId, selectedBuilderStatus?.releaseUnitId, selectedBuilderStatus?.runtimePackageId, selectedMenu, selectedMenuIsPage]);
  const installValidatorStatuses = useMemo(() => ([
    {
      key: "required-beans-present" as BuilderInstallValidatorCheckKey,
      ready: Boolean(selectedMenu && selectedMenuIsPage),
      detail: selectedMenu && selectedMenuIsPage ? (en ? "Builder-owned page selected." : "빌더 소유 페이지 선택됨") : (en ? "Select a page registry row first." : "페이지 레지스트리 행을 먼저 선택")
    },
    {
      key: "required-properties-present" as BuilderInstallValidatorCheckKey,
      ready: installManifestBindingStatuses.every((item) => item.ready),
      detail: installManifestBindingStatuses.filter((item) => !item.ready).map((item) => describeBuilderInstallBinding(item.key, en)).join(", ") || (en ? "All install bindings are present." : "설치 바인딩이 모두 준비됨")
    },
    {
      key: "menu-root-resolvable" as BuilderInstallValidatorCheckKey,
      ready: selectedUrlValidation.tone === "success",
      detail: selectedUrlValidation.message
    },
    {
      key: "storage-writable" as BuilderInstallValidatorCheckKey,
      ready: Boolean(selectedBuilderStatus?.versionCount || latestSelectedMenuBuilderAudit),
      detail: selectedBuilderStatus?.publishedSavedAt || String(latestSelectedMenuBuilderAudit?.createdAt || (en ? "No storage evidence yet." : "스토리지 증거 없음"))
    },
    {
      key: "builder-routes-exposed" as BuilderInstallValidatorCheckKey,
      ready: Boolean(selectedMenu && selectedMenuIsPage && governancePageId),
      detail: governancePageId || (en ? "Collect governance pageId first." : "거버넌스 pageId를 먼저 수집")
    }
  ]), [en, governancePageId, installManifestBindingStatuses, latestSelectedMenuBuilderAudit, selectedBuilderStatus?.publishedSavedAt, selectedBuilderStatus?.versionCount, selectedMenu, selectedMenuIsPage, selectedUrlValidation.message, selectedUrlValidation.tone]);
  const installManifestReadyCount = useMemo(
    () => installManifestBindingStatuses.filter((item) => item.ready).length,
    [installManifestBindingStatuses]
  );
  const installValidatorPassCount = useMemo(
    () => installValidatorStatuses.filter((item) => item.ready).length,
    [installValidatorStatuses]
  );
  const selectedInstallQueueSummary = useMemo(() => buildBuilderInstallQueueSummary({
    menuCode: selectedMenu?.code,
    pageId: governancePageId || selectedMenu?.code?.toLowerCase(),
    menuUrl: selectedMenu?.menuUrl,
    releaseUnitId: selectedBuilderStatus?.releaseUnitId || selectedBuilderStatus?.publishedVersionId,
    runtimePackageId: selectedBuilderStatus?.runtimePackageId || selectedBuilderStatus?.publishedVersionId,
    deployTraceId: selectedBuilderStatus?.deployTraceId || selectedBuilderStatus?.parityTraceId,
    publishReady: selectedMenuPublishReady,
    issueCount: selectedMenuBuilderIssueCount,
    validatorPassCount: installValidatorPassCount,
    validatorTotalCount: BUILDER_INSTALL_VALIDATOR_CHECKS.length
  }), [governancePageId, installValidatorPassCount, selectedBuilderStatus?.deployTraceId, selectedBuilderStatus?.parityTraceId, selectedBuilderStatus?.publishedVersionId, selectedBuilderStatus?.releaseUnitId, selectedBuilderStatus?.runtimePackageId, selectedMenu?.code, selectedMenu?.menuUrl, selectedMenuBuilderIssueCount, selectedMenuPublishReady]);
  const selectedInstallFlowQuery = useMemo(() => ({
    menuCode: selectedMenu?.code || "",
    pageId: governancePageId || selectedMenu?.code?.toLowerCase() || "",
    menuTitle: selectedMenu?.label || "",
    menuUrl: selectedMenu?.menuUrl || "",
    snapshotVersionId: String(selectedBuilderStatus?.publishedVersionId || ""),
    projectId: resonanceProjectId
  }), [governancePageId, resonanceProjectId, selectedBuilderStatus?.publishedVersionId, selectedMenu?.code, selectedMenu?.label, selectedMenu?.menuUrl]);
  const selectedInstallFlowSteps = useMemo(() => [
    {
      key: "draft",
      title: en ? "1. Draft" : "1. 초안",
      state: selectedBuilderStatus?.versionCount ? (en ? "READY" : "준비됨") : (en ? "MISSING" : "없음"),
      tone: selectedBuilderStatus?.versionCount ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50",
      detail: selectedBuilderStatus?.publishedSavedAt || String(latestSelectedMenuBuilderAudit?.createdAt || (en ? "Save a builder draft first." : "먼저 빌더 초안을 저장하세요."))
    },
    {
      key: "publish",
      title: en ? "2. Publish" : "2. 발행",
      state: selectedBuilderStatus?.publishedVersionId ? (en ? "READY" : "준비됨") : (selectedMenuPublishReady ? (en ? "WAITING" : "대기") : (en ? "BLOCKED" : "차단")),
      tone: selectedBuilderStatus?.publishedVersionId
        ? "text-emerald-700 bg-emerald-50"
        : (selectedMenuPublishReady ? "text-blue-700 bg-blue-50" : "text-red-700 bg-red-50"),
      detail: selectedBuilderStatus?.publishedVersionId || summarizeBuilderBlockingReason(selectedMenuBuilderIssueCount, en)
    },
    {
      key: "binding",
      title: en ? "3. Project Binding" : "3. 프로젝트 바인딩",
      state: installManifestBindingStatuses.every((item) => item.ready) ? (en ? "READY" : "준비됨") : (en ? "BLOCKED" : "차단"),
      tone: installManifestBindingStatuses.every((item) => item.ready) ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50",
      detail: installManifestBindingStatuses.filter((item) => !item.ready).map((item) => describeBuilderInstallBinding(item.key, en)).join(", ") || `${selectedMenu?.code || "-"} / ${governancePageId || "-"}`
    },
    {
      key: "install",
      title: en ? "4. Install" : "4. 설치",
      state: selectedInstallQueueSummary.releaseUnitId !== "-" && selectedInstallQueueSummary.runtimePackageId !== "-"
        ? (en ? "READY" : "준비됨")
        : (en ? "PIPELINE" : "파이프라인 필요"),
      tone: selectedInstallQueueSummary.releaseUnitId !== "-" && selectedInstallQueueSummary.runtimePackageId !== "-"
        ? "text-emerald-700 bg-emerald-50"
        : "text-violet-700 bg-violet-50",
      detail: selectedInstallQueueSummary.releaseUnitId !== "-" && selectedInstallQueueSummary.runtimePackageId !== "-"
        ? `${selectedInstallQueueSummary.releaseUnitId} / ${selectedInstallQueueSummary.runtimePackageId}`
        : (en ? "Open compare or repair to promote installable product." : "compare 또는 repair를 열어 설치형 프로덕트로 승격하세요.")
    }
  ], [en, governancePageId, installManifestBindingStatuses, latestSelectedMenuBuilderAudit, selectedBuilderStatus?.publishedSavedAt, selectedBuilderStatus?.publishedVersionId, selectedBuilderStatus?.versionCount, selectedInstallQueueSummary.releaseUnitId, selectedInstallQueueSummary.runtimePackageId, selectedMenu?.code, selectedMenuBuilderIssueCount, selectedMenuPublishReady]);
  const installBindingNextActions = useMemo(() => {
    const actions: string[] = [];
    if (!selectedMenu || !selectedMenuIsPage) {
      actions.push(en ? "Select a page menu from the inventory first." : "먼저 인벤토리에서 페이지 메뉴를 선택하세요.");
    } else {
      if (selectedUrlValidation.tone !== "success") {
        actions.push(selectedUrlValidation.message);
      }
      if (!governancePageId) {
        actions.push(en ? "Collect or bind the governance pageId before install." : "설치 전에 거버넌스 pageId를 수집하거나 바인딩하세요.");
      }
      if (!selectedMenuPublishReady) {
        actions.push(recommendBuilderNextAction(selectedBuilderStatus, en));
      }
    }
    if (governanceRemediationItems.length > 0) {
      actions.push(en ? "Resolve the top remediation item before package install." : "패키지 설치 전에 최상위 remediation 항목을 처리하세요.");
    }
    return actions.slice(0, 3);
  }, [
    en,
    governancePageId,
    governanceRemediationItems.length,
    selectedBuilderStatus,
    selectedMenu,
    selectedMenuIsPage,
    selectedMenuPublishReady,
    selectedUrlValidation.message,
    selectedUrlValidation.tone
  ]);
  useEffect(() => {
    if (!parentCodeValue && groupMenuOptions.length > 0) {
      setParentCodeValue(stringOf(groupMenuOptions[0], "value"));
    }
  }, [groupMenuOptions, parentCodeValue]);

  useEffect(() => {
    setActionError("");
    setActionMessage("");
    setMenuSearch("");
    setFeatureSearch("");
    setFeatureLinkFilter("ALL");
    setSelectedMenuCode(menuType === "ADMIN" ? ENVIRONMENT_MANAGEMENT_MENU_CODE : "");
    setParentCodeValue(stringOf(groupMenuOptions[0], "value"));
    setCodeNm("");
    setCodeDc("");
    setMenuUrl("");
    setMenuIcon(iconOptions[0] || "web");
    setUseAt(useAtOptions[0] || "Y");
    setFeatureDraft(createEmptyFeatureDraft());
    setSelectedMenuDraft(createEmptySelectedMenuDraft());
    setMenuSaving(false);
    setPageDeleteImpactLoading(false);
    setPendingPageDeleteImpact(null);
    setPageDeleting(false);
    setEditingFeatureCode("");
    setEditingFeatureDraft(createEmptyFeatureDraft());
    setFeatureSaving(false);
    setDeleteImpactLoading(false);
    setDeleteImpactFeatureCode("");
    setPendingDeleteImpact(null);
    setFeatureDeleting(false);
    setGovernanceMessage("");
    setGovernanceError("");
    setMetadataExpanded(false);
  }, [menuType]);

  useEffect(() => {
    setMetadataExpanded(false);
  }, [selectedMenuCode]);

  useEffect(() => {
    setPendingPageDeleteImpact(null);
  }, [selectedMenuCode]);

  useEffect(() => {
    let cancelled = false;
    async function loadMenuAudit() {
      if (!selectedMenu || !selectedMenuIsPage) {
        setMenuAuditRows([]);
        return;
      }
      setMenuAuditLoading(true);
      try {
        const response = await fetchAuditEvents({ menuCode: selectedMenu.code, pageSize: 5 });
        if (!cancelled) {
          setMenuAuditRows(Array.isArray(response.items) ? response.items : []);
        }
      } catch {
        if (!cancelled) {
          setMenuAuditRows([]);
        }
      } finally {
        if (!cancelled) {
          setMenuAuditLoading(false);
        }
      }
    }
    void loadMenuAudit();
    return () => {
      cancelled = true;
    };
  }, [selectedMenu, selectedMenuIsPage]);

  useEffect(() => {
    if (!selectedMenu) {
      setSelectedMenuDraft(createEmptySelectedMenuDraft());
      return;
    }
    setSelectedMenuDraft({
      codeNm: selectedMenu.label,
      codeDc: selectedMenu.labelEn,
      menuUrl: selectedMenu.menuUrl,
      menuIcon: selectedMenu.menuIcon || (iconOptions[0] || "web"),
      useAt: selectedMenu.useAt || (useAtOptions[0] || "Y")
    });
  }, [iconOptions, selectedMenu, useAtOptions]);

  useEffect(() => {
    if (!editingFeatureCode) {
      setEditingFeatureDraft(createEmptyFeatureDraft());
      setPendingDeleteImpact(null);
      return;
    }
    const row = featureRows.find((item) => stringOf(item, "featureCode") === editingFeatureCode);
    if (!row) {
      setEditingFeatureDraft(createEmptyFeatureDraft());
      return;
    }
    setEditingFeatureDraft({
      featureCode: stringOf(row, "featureCode"),
      featureNm: stringOf(row, "featureNm"),
      featureNmEn: stringOf(row, "featureNmEn"),
      featureDc: stringOf(row, "featureDc"),
      useAt: stringOf(row, "useAt") || "Y"
    });
  }, [editingFeatureCode, featureRows]);

  useEffect(() => {
    if (!selectedMenuCode && menuRows.length > 0) {
      setSelectedMenuCode(menuRows[0].code);
    }
  }, [menuRows, selectedMenuCode]);

  async function createPageMenu() {
    if (!environmentAuthority.allowsAction("create")) {
      environmentAuthority.logAuthorityDenied("create", { component: "environment-management-create-menu" });
      throw new Error(environmentAuthority.getActionReason("create", en));
    }
    setActionError("");
    setActionMessage("");
    const body = new URLSearchParams();
    body.set("menuType", menuType);
    body.set("parentCode", parentCodeValue);
    body.set("codeNm", codeNm);
    body.set("codeDc", codeDc);
    body.set("menuUrl", menuUrl);
    body.set("menuIcon", menuIcon);
    body.set("useAt", useAt);
    const responseBody = await postFormUrlEncoded<{ success?: boolean; message?: string; createdCode?: string }>(
      buildMenuCreatePagePath(),
      body
    );
    if (!responseBody.success) {
      throw new Error(responseBody.message || "Failed to create page menu.");
    }
    await menuPageState.reload();
    await featurePageState.reload();
    if (responseBody.createdCode) {
      setSelectedMenuCode(String(responseBody.createdCode));
    }
    setActionMessage(responseBody.message || (en ? "The page menu has been created." : "페이지 메뉴를 생성했습니다."));
    setCodeNm("");
    setCodeDc("");
    setMenuUrl("");
  }

  async function refreshEnvironmentData() {
    await menuPageState.reload();
    await featurePageState.reload();
  }

  async function handleFeatureSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!environmentAuthority.allowsAction("create")) {
      environmentAuthority.logAuthorityDenied("create", { component: "environment-management-feature-create" });
      setActionError(environmentAuthority.getActionReason("create", en));
      return;
    }
    setActionError("");
    setActionMessage("");
    try {
      await submitFormRequest(event.currentTarget);
      setFeatureDraft(createEmptyFeatureDraft());
      await featurePageState.reload();
      setActionMessage(en ? "Feature has been added." : "기능을 추가했습니다.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to add feature." : "기능 추가에 실패했습니다."));
    }
  }

  async function handleSelectedMenuSave() {
    if (!selectedMenu) {
      return;
    }
    if (!environmentAuthority.allowsAction("update")) {
      environmentAuthority.logAuthorityDenied("update", { component: "environment-management-selected-menu-save", menuCode: selectedMenu.code });
      setActionError(environmentAuthority.getActionReason("update", en));
      return;
    }
    setActionError("");
    setActionMessage("");
    setMenuSaving(true);
    try {
      const response = await updateEnvironmentManagedPage({
        menuType,
        code: selectedMenu.code,
        codeNm: selectedMenuDraft.codeNm,
        codeDc: selectedMenuDraft.codeDc,
        menuUrl: selectedMenuDraft.menuUrl,
        menuIcon: selectedMenuDraft.menuIcon,
        useAt: selectedMenuDraft.useAt
      });
      await refreshEnvironmentData();
      setActionMessage(String(response.message || (en ? "The selected menu has been updated." : "선택한 메뉴를 수정했습니다.")));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to update the selected menu." : "선택한 메뉴 수정에 실패했습니다."));
    } finally {
      setMenuSaving(false);
    }
  }

  async function prepareFeatureDelete(featureCode: string) {
    if (!environmentAuthority.allowsAction("delete")) {
      environmentAuthority.logAuthorityDenied("delete", { component: "environment-management-feature-delete-impact", featureCode });
      setActionError(environmentAuthority.getActionReason("delete", en));
      return;
    }
    setActionError("");
    setActionMessage("");
    setDeleteImpactLoading(true);
    setDeleteImpactFeatureCode(featureCode);
    setPendingDeleteImpact(null);
    try {
      const response = await fetchEnvironmentFeatureImpact(featureCode);
      setPendingDeleteImpact({
        featureCode,
        assignedRoleCount: numberOf(response, "assignedRoleCount"),
        userOverrideCount: numberOf(response, "userOverrideCount")
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to load delete impact." : "삭제 영향도를 불러오지 못했습니다."));
    } finally {
      setDeleteImpactLoading(false);
    }
  }

  async function preparePageDelete() {
    if (!selectedMenu) {
      return;
    }
    if (!environmentAuthority.allowsAction("delete")) {
      environmentAuthority.logAuthorityDenied("delete", { component: "environment-management-page-delete-impact", menuCode: selectedMenu.code });
      setActionError(environmentAuthority.getActionReason("delete", en));
      return;
    }
    setActionError("");
    setActionMessage("");
    setPageDeleteImpactLoading(true);
    setPendingPageDeleteImpact(null);
    try {
      const response = await fetchEnvironmentManagedPageImpact(menuType, selectedMenu.code);
      setPendingPageDeleteImpact({
        code: String(response.code || selectedMenu.code),
        defaultViewFeatureCode: String(response.defaultViewFeatureCode || `${selectedMenu.code}_VIEW`),
        linkedFeatureCodes: Array.isArray(response.linkedFeatureCodes) ? response.linkedFeatureCodes.map(String) : [],
        nonDefaultFeatureCodes: Array.isArray(response.nonDefaultFeatureCodes) ? response.nonDefaultFeatureCodes.map(String) : [],
        defaultViewRoleRefCount: numberOf(response, "defaultViewRoleRefCount"),
        defaultViewUserOverrideCount: numberOf(response, "defaultViewUserOverrideCount"),
        blocked: Boolean(response.blocked)
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to load page delete impact." : "페이지 삭제 영향도를 불러오지 못했습니다."));
    } finally {
      setPageDeleteImpactLoading(false);
    }
  }

  async function confirmPageDelete() {
    if (!selectedMenu || !pendingPageDeleteImpact || pendingPageDeleteImpact.blocked) {
      return;
    }
    if (!environmentAuthority.allowsAction("delete")) {
      environmentAuthority.logAuthorityDenied("delete", { component: "environment-management-page-delete-confirm", menuCode: selectedMenu.code });
      setActionError(environmentAuthority.getActionReason("delete", en));
      return;
    }
    setActionError("");
    setActionMessage("");
    setPageDeleting(true);
    try {
      const response = await deleteEnvironmentManagedPage(menuType, selectedMenu.code);
      await refreshEnvironmentData();
      setPendingPageDeleteImpact(null);
      setEditingFeatureCode("");
      setSelectedMenuCode("");
      setActionMessage(String(response.message || (en ? "The page menu has been deleted." : "페이지 메뉴를 삭제했습니다.")));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to delete the selected page menu." : "선택한 페이지 메뉴 삭제에 실패했습니다."));
    } finally {
      setPageDeleting(false);
    }
  }

  async function confirmFeatureDelete() {
    if (!pendingDeleteImpact) {
      return;
    }
    if (!environmentAuthority.allowsAction("delete")) {
      environmentAuthority.logAuthorityDenied("delete", { component: "environment-management-feature-delete-confirm", featureCode: pendingDeleteImpact.featureCode });
      setActionError(environmentAuthority.getActionReason("delete", en));
      return;
    }
    setActionError("");
    setActionMessage("");
    setFeatureDeleting(true);
    try {
      const response = await deleteEnvironmentFeature(pendingDeleteImpact.featureCode);
      await featurePageState.reload();
      setPendingDeleteImpact(null);
      setDeleteImpactFeatureCode("");
      if (editingFeatureCode === pendingDeleteImpact.featureCode) {
        setEditingFeatureCode("");
      }
      setActionMessage(String(response.message || (en ? "The feature has been deleted." : "기능을 삭제했습니다.")));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to delete the feature." : "기능 삭제에 실패했습니다."));
    } finally {
      setFeatureDeleting(false);
    }
  }

  async function handleFeatureUpdate() {
    if (!selectedMenu || !editingFeatureCode) {
      return;
    }
    if (!environmentAuthority.allowsAction("update")) {
      environmentAuthority.logAuthorityDenied("update", { component: "environment-management-feature-update", menuCode: selectedMenu.code, featureCode: editingFeatureCode });
      setActionError(environmentAuthority.getActionReason("update", en));
      return;
    }
    setActionError("");
    setActionMessage("");
    setFeatureSaving(true);
    try {
      const response = await updateEnvironmentFeature({
        menuType,
        menuCode: selectedMenu.code,
        featureCode: editingFeatureDraft.featureCode,
        featureNm: editingFeatureDraft.featureNm,
        featureNmEn: editingFeatureDraft.featureNmEn,
        featureDc: editingFeatureDraft.featureDc,
        useAt: editingFeatureDraft.useAt
      });
      await featurePageState.reload();
      setActionMessage(String(response.message || (en ? "The feature has been updated." : "기능을 수정했습니다.")));
      setPendingDeleteImpact(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to update the feature." : "기능 수정에 실패했습니다."));
    } finally {
      setFeatureSaving(false);
    }
  }

  async function handleRebuildSelectedSummary() {
    if (!selectedMenu || !selectedMenuIsPage) {
      return;
    }
    if (!environmentAuthority.allowsAction("execute")) {
      environmentAuthority.logAuthorityDenied("execute", { component: "environment-management-rebuild-selected-summary", menuCode: selectedMenu.code });
      setActionError(environmentAuthority.getActionReason("execute", en));
      return;
    }
    if (!window.confirm(en ? "Are you sure you want to rebuild this menu's summary projection?" : "이 메뉴의 요약 프로젝션을 재생성하시겠습니까?")) {
      return;
    }
    setActionError("");
    setActionMessage("");
    setSelectedSummaryRebuildBusy(true);
    try {
      const response = await rebuildScreenBuilderStatusSummary([selectedMenu.code]);
      await refreshEnvironmentData();
      setActionMessage(String(response.message || (en ? "Selected summary projection rebuilt." : "선택 메뉴 요약 프로젝션을 재생성했습니다.")));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to rebuild selected summary projection." : "선택 메뉴 요약 프로젝션 재생성에 실패했습니다."));
    } finally {
      setSelectedSummaryRebuildBusy(false);
    }
  }

  async function handleRebuildAllSummaries() {
    if (!environmentAuthority.allowsAction("execute")) {
      environmentAuthority.logAuthorityDenied("execute", { component: "environment-management-rebuild-all-summaries" });
      setActionError(environmentAuthority.getActionReason("execute", en));
      return;
    }
    if (!window.confirm(en ? "Are you sure you want to rebuild all summary projections? This might take some time depending on the number of menus." : "전체 요약 프로젝션을 재생성하시겠습니까? 메뉴 수에 따라 시간이 다소 소요될 수 있습니다.")) {
      return;
    }
    setActionError("");
    setActionMessage("");
    setAllSummaryRebuildBusy(true);
    try {
      const response = await rebuildScreenBuilderStatusSummary([]);
      await refreshEnvironmentData();
      setActionMessage(String(response.message || (en ? "All summary projections rebuilt." : "전체 요약 프로젝션을 재생성했습니다.")));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to rebuild all summary projections." : "전체 요약 프로젝션 재생성에 실패했습니다."));
    } finally {
      setAllSummaryRebuildBusy(false);
    }
  }

  function scrollToSection(sectionId: string) {
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyScreenBuilderIssueView(reason: "UNREGISTERED" | "MISSING" | "DEPRECATED") {
    setMenuSearch("");
    setScreenBuilderFilter("BLOCKED_ONLY");
    setScreenBuilderIssueReasonFilter(reason);
    const firstMatch = menuRows.find((row) => {
      if (row.code.length !== 8) {
        return false;
      }
      const detail = screenBuilderIssueDetailMap[row.code];
      return matchesScreenBuilderIssueReason(detail, reason);
    });
    if (firstMatch?.code) {
      setSelectedMenuCode(firstMatch.code);
    }
    window.setTimeout(() => scrollToSection("environment-search-menu"), 0);
  }

  function moveToSameIssueMenu(targetMenuCode: string) {
    if (!targetMenuCode || !selectedIssueReason) {
      return;
    }
    setMenuSearch("");
    setScreenBuilderFilter("BLOCKED_ONLY");
    setScreenBuilderIssueReasonFilter(selectedIssueReason);
    setSelectedMenuCode(targetMenuCode);
    window.setTimeout(() => scrollToSection("environment-search-menu"), 0);
  }

  function moveToSameIssueQueueMode(mode: "PUBLISHED" | "DRAFT") {
    const targetMenu = mode === "PUBLISHED" ? nextRemainingPublishedSameIssueMenu : nextRemainingDraftSameIssueMenu;
    if (!targetMenu?.code) {
      return;
    }
    moveToSameIssueMenu(targetMenu.code);
  }

  function applySameIssueQueueFilter(mode: "PUBLISHED" | "DRAFT") {
    if (!selectedIssueReason) {
      return;
    }
    setMenuSearch("");
    setScreenBuilderIssueReasonFilter(selectedIssueReason);
    setScreenBuilderFilter(mode === "PUBLISHED" ? "PUBLISHED_ONLY" : "DRAFT_ONLY");
    const targetMenu = mode === "PUBLISHED" ? nextRemainingPublishedSameIssueMenu : nextRemainingDraftSameIssueMenu;
    if (targetMenu?.code) {
      setSelectedMenuCode(targetMenu.code);
    }
    window.setTimeout(() => scrollToSection("environment-search-menu"), 0);
  }

  function applySameIssueBlockedFilter() {
    if (!selectedIssueReason) {
      return;
    }
    setMenuSearch("");
    setScreenBuilderIssueReasonFilter(selectedIssueReason);
    setScreenBuilderFilter("BLOCKED_ONLY");
    window.setTimeout(() => scrollToSection("environment-search-menu"), 0);
  }

  function runGovernanceAction(item: GovernanceRemediationItem) {
    if (item.actionKind === "autoCollect") {
      setMetadataExpanded(true);
      void handleAutoCollect();
      return;
    }
    if (item.actionKind === "permissions") {
      if (item.href) {
        navigate(item.href);
      }
      return;
    }
    if (item.href) {
      navigate(item.href);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Installable Builder" : "설치형 빌더" },
        { label: en ? "Install / Bind Console" : "설치 / 바인딩 콘솔" }
      ]}
      title={en ? "Builder Install / Bind Console" : "빌더 설치 / 바인딩 콘솔"}
      subtitle={en
        ? "Bind page inventory, governance metadata, builder readiness, and next install actions from one governed workspace."
        : "페이지 인벤토리, 거버넌스 메타데이터, 빌더 준비도, 다음 설치 액션을 하나의 거버넌스 작업공간에서 연결합니다."}
      contextStrip={
        <ContextKeyStrip items={authorDesignContextKeys} />
      }
    >
      <AdminWorkspacePageFrame>
        <section className="grid gap-4 xl:grid-cols-6 mb-6" data-help-id="environment-management-asset-root">
          <DiagnosticCard
            title={en ? "Asset inventory root" : "자산 인벤토리 루트"}
            status={systemAssetSummary ? (en ? `${systemAssetSummary.total} Assets (${systemAssetSummary.health})` : `${systemAssetSummary.total}개 자산 (${systemAssetSummary.health})`) : (en ? "Loading..." : "불러오는 중...")}
            statusTone={systemAssetSummary?.health === "Healthy" ? "healthy" : "warning"}
            description={en
              ? `Grouped inventory: ${systemAssetSummary?.infraCount || 0} Infra, ${systemAssetSummary?.serviceCount || 0} Service, and other assets.`
              : `자산 분류: 인프라 ${systemAssetSummary?.infraCount || 0}개, 서비스 ${systemAssetSummary?.serviceCount || 0}개 및 기타 자산이 등록되어 있습니다.`}
            actions={<MemberLinkButton href={buildAssetInventoryPath()} size="sm" variant="secondary">{en ? "Open inventory" : "인벤토리 열기"}</MemberLinkButton>}
          />
          <DiagnosticCard
            title={en ? "Asset detail" : "자산 상세"}
            status={en ? "Ready" : "준비 완료"}
            statusTone="healthy"
            description={en
              ? "Open the detail view to inspect real asset identifiers, owners, and runtime drift states."
              : "상세 뷰를 열어 실제 자산 식별자, 소유자, 런타임 변동 상태를 확인합니다."}
            actions={<MemberLinkButton href={buildLocalizedPath("/admin/system/asset-detail?assetType=service-registry", "/en/admin/system/asset-detail?assetType=service-registry")} size="sm" variant="secondary">{en ? "Open detail" : "상세 열기"}</MemberLinkButton>}
          />
          <DiagnosticCard
            title={en ? "Asset impact review" : "자산 영향 검토"}
            status={en ? "Unified shell" : "통합 쉘"}
            statusTone="warning"
            description={en
              ? "Page delete impact, feature authority impact, runtime compare, and integration maintenance impact should be reviewed from one entry."
              : "페이지 삭제 영향, 기능 권한 영향, 런타임 비교, 연계 점검 영향을 하나의 진입점에서 검토하도록 만듭니다."}
            actions={<MemberLinkButton href={buildAssetImpactPath("page")} size="sm" variant="secondary">{en ? "Open impact" : "영향도 열기"}</MemberLinkButton>}
          />
          <DiagnosticCard
            title={en ? "Asset lifecycle root" : "자산 생명주기 루트"}
            status={en ? "Governed shell" : "거버넌스 쉘"}
            statusTone="warning"
            description={en
              ? "Create, publish, deprecate, retire, and rollback checkpoints should remain explicit instead of staying hidden inside delete or deploy actions."
              : "생성, 반영, 축소, 폐기, 롤백 점검은 삭제나 배포 동작 안에 숨기지 말고 분리해서 관리해야 합니다."}
            actions={<MemberLinkButton href={buildAssetLifecyclePath("create")} size="sm" variant="secondary">{en ? "Open lifecycle" : "생명주기 열기"}</MemberLinkButton>}
          />
          <DiagnosticCard
            title={en ? "Asset gap queue" : "자산 미흡 큐"}
            status={en ? "Backlog shell" : "백로그 쉘"}
            statusTone="warning"
            description={en
              ? "Missing owner, missing binding, missing policy, and orphan assets should converge into one operational queue."
              : "소유자 누락, 바인딩 누락, 정책 누락, 고아 자산은 하나의 운영 큐로 모아야 합니다."}
            actions={<MemberLinkButton href={buildAssetGapPath()} size="sm" variant="secondary">{en ? "Open gap queue" : "미흡 큐 열기"}</MemberLinkButton>}
          />
          <DiagnosticCard
            title={en ? "Verification center" : "운영 검증 센터"}
            status={en ? "Baseline shell" : "baseline 쉘"}
            statusTone="warning"
            description={en
              ? "Record preserved page baselines, smoke scenarios, test accounts, and run evidence before they stay scattered in tickets or chat."
              : "페이지 baseline, smoke 시나리오, 테스트 계정, 실행 증거를 티켓이나 대화에 흩어두지 않고 한 곳에 기록합니다."}
            actions={<MemberLinkButton href={buildVerificationCenterPath()} size="sm" variant="secondary">{en ? "Open verification" : "검증 센터 열기"}</MemberLinkButton>}
          />
        </section>
      {pagePermissionDenied ? (
        <MemberStateCard
          description={en
            ? `You need ${environmentAuthority.requiredViewFeatureCode || `${ENVIRONMENT_MANAGEMENT_MENU_CODE}_VIEW`} permission to open the builder install/bind console.`
            : `빌더 설치/바인딩 콘솔을 열려면 ${environmentAuthority.requiredViewFeatureCode || `${ENVIRONMENT_MANAGEMENT_MENU_CODE}_VIEW`} 권한이 필요합니다.`}
          icon="lock"
          title={en ? "Permission denied." : "권한이 없습니다."}
          tone="danger"
        />
      ) : null}
      {pagePermissionDenied ? null : (
      <>
      {actionMessage ? (
        <PageStatusNotice tone="success">
          {actionMessage}
        </PageStatusNotice>
      ) : null}
      {menuPageState.error || featurePageState.error || actionError ? (
        <PageStatusNotice tone="error">
          {actionError || menuPageState.error || featurePageState.error}
        </PageStatusNotice>
      ) : null}

      <div data-help-id="environment-management-summary" id="environment-install-bind">
        <DiagnosticCard
          description={en
            ? "This page is the install-bind console for builder-managed pages. Use it to choose the target page, verify required bindings, and decide whether the package can move into install or validation."
            : "이 페이지는 빌더 관리 페이지의 설치/바인딩 콘솔입니다. 대상 페이지를 고르고, 필수 바인딩을 확인하고, 패키지를 설치나 검증 단계로 넘길 수 있는지 판단하는 데 사용합니다."}
          summary={(
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                {en ? "Install / Bind Workspace" : "설치 / 바인딩 작업공간"}
              </p>
              <h3 className="mt-2 text-2xl font-black text-[var(--kr-gov-text-primary)]">
                {en ? "Attach the builder package only after bindings are clear" : "바인딩이 명확할 때만 빌더 패키지를 붙입니다"}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Instead of treating this page as a generic menu editor, use it as the governed checkpoint before install. Confirm page inventory, runtime URL, pageId binding, and publish readiness here first."
                  : "이 화면을 단순 메뉴 편집기가 아니라 설치 전 거버넌스 체크포인트로 사용합니다. 페이지 인벤토리, 런타임 URL, pageId 바인딩, publish 준비도를 여기서 먼저 확인합니다."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <MemberButton onClick={() => scrollToSection("environment-install-bind")} size="sm" type="button" variant="primary">
                  {en ? "Install Checklist" : "설치 체크리스트"}
                </MemberButton>
                <MemberButton onClick={() => scrollToSection("environment-register-menu")} size="sm" type="button" variant="secondary">
                  {en ? "Menu Registry" : "메뉴 인벤토리"}
                </MemberButton>
                <MemberButton onClick={() => scrollToSection("environment-search-menu")} size="sm" type="button" variant="secondary">
                  {en ? "Binding Inventory" : "바인딩 인벤토리"}
                </MemberButton>
                <MemberButton onClick={() => scrollToSection("environment-feature-management")} size="sm" type="button" variant="secondary">
                  {en ? "Authority / Features" : "권한 / 기능"}
                </MemberButton>
                <MemberButton onClick={() => scrollToSection("environment-metadata")} size="sm" type="button" variant="secondary">
                  {en ? "Validator / Metadata" : "검증 / 메타데이터"}
                </MemberButton>
                <MemberLinkButton href={buildAssetInventoryPath()} size="sm" variant="secondary">
                  {en ? "Asset Inventory" : "자산 인벤토리"}
                </MemberLinkButton>
                <MemberLinkButton href={buildAssetImpactPath("page")} size="sm" variant="secondary">
                  {en ? "Asset Impact" : "자산 영향도"}
                </MemberLinkButton>
                <MemberLinkButton href={buildAssetLifecyclePath("create")} size="sm" variant="secondary">
                  {en ? "Asset Lifecycle" : "자산 생명주기"}
                </MemberLinkButton>
              </div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                {en ? "Install Readiness" : "설치 준비도"}
              </p>
              <div className="mt-3 space-y-2 text-sm">
                {installBindingChecklist.map((item) => (
                  <div className={`rounded-lg border px-3 py-2 ${item.ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`} key={item.key}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-[var(--kr-gov-text-primary)]">{item.label}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${item.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {item.ready ? (en ? "READY" : "준비") : (en ? "PENDING" : "대기")}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">{item.detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Bindings Ready" : "준비된 바인딩"}</p>
                  <p className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{installBindingReadyCount} / {installBindingChecklist.length}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Next Actions" : "다음 액션"}</p>
                  <p className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{installBindingNextActions.length}</p>
                </div>
              </div>
              {installBindingNextActions.length > 0 ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                    {en ? "Recommended Next" : "권장 다음 단계"}
                  </p>
                  <ul className="mt-2 space-y-1 text-[12px] text-[var(--kr-gov-text-secondary)]">
                    {installBindingNextActions.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-3">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                  {en ? "Install Package Contract" : "설치 패키지 계약"}
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Bindings" : "바인딩"}</p>
                    <p className="mt-1 text-sm font-black text-[var(--kr-gov-text-primary)]">{installManifestReadyCount} / {BUILDER_INSTALL_REQUIRED_BINDINGS.length}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Validator Checks" : "검증 체크"}</p>
                    <p className="mt-1 text-sm font-black text-[var(--kr-gov-text-primary)]">{installValidatorPassCount} / {BUILDER_INSTALL_VALIDATOR_CHECKS.length}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Artifacts" : "산출물"}</p>
                    <p className="mt-1 text-sm font-black text-[var(--kr-gov-text-primary)]">{BUILDER_INSTALL_ARTIFACTS.length}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {BUILDER_INSTALL_ARTIFACTS.map((artifact) => (
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-mono text-[var(--kr-gov-text-primary)]" key={artifact}>{artifact}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          )}
          title={en ? "Install / Bind Workspace" : "설치 / 바인딩 작업공간"}
        />
      </div>

      <section className="gov-card mb-6" data-help-id="environment-management-engines">
        <GridToolbar
          actions={(
            <div className="flex flex-wrap gap-2">
              <MemberLinkButton href={buildInfraPath()} size="sm" variant="secondary">
                {en ? "Infra Console" : "인프라 콘솔"}
              </MemberLinkButton>
              <MemberLinkButton href={buildFullStackManagementPath()} size="sm" variant="secondary">
                {en ? "Full-stack Registry" : "풀스택 레지스트리"}
              </MemberLinkButton>
              <MemberLinkButton href={buildHelpManagementPath()} size="sm" variant="secondary">
                {en ? "Screen Command" : "화면 커맨드"}
              </MemberLinkButton>
            </div>
          )}
          title={en ? "Install / Validate Engines" : "설치 / 검증 엔진"}
        />
        <p className="mb-4 text-sm text-[var(--kr-gov-text-secondary)]">
          {en
            ? "This console should not stop at menu and feature editing. The engines below are the required install, validation, and runtime-governance layers for an installable builder."
            : "이 콘솔은 메뉴/기능 편집에서 멈추면 안 됩니다. 아래 엔진들은 설치형 빌더를 위한 설치, 검증, 런타임 거버넌스 레이어입니다."}
        </p>
        <div className="grid gap-4 xl:grid-cols-2">
          {governanceEngineCards.map((item) => (
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4" key={item.key}>
              <h3 className="text-base font-black text-[var(--kr-gov-text-primary)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{item.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.bullets.map((bullet) => (
                  <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-mono text-[var(--kr-gov-text-primary)]" key={bullet}>
                    {bullet}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]" data-help-id="environment-management-cards">
        <div className="space-y-6">
          <section className="gov-card" id="environment-register-menu">
            <GridToolbar title={en ? "Menu Registry Intake" : "메뉴 인벤토리 등록"} />
            <p className="mb-4 text-sm text-[var(--kr-gov-text-secondary)]">
              {en
                ? "Create or extend the page inventory first. This section owns menu registration, URL ownership, and default permission seeding."
                : "먼저 페이지 인벤토리를 만들거나 확장합니다. 이 구역은 메뉴 등록, URL 소유권, 기본 권한 시딩을 담당합니다."}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="gov-label" htmlFor="parentCode">{en ? "Group / Common Code" : "그룹 / 공통코드"}</label>
                <select className="gov-select" id="parentCode" value={parentCodeValue} onChange={(event) => setParentCodeValue(event.target.value)}>
                  {groupMenuOptions.map((option) => (
                    <option key={stringOf(option, "value")} value={stringOf(option, "value")}>{stringOf(option, "label")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="gov-label" htmlFor="nextCode">{en ? "Generated Page Code" : "생성 예정 페이지 코드"}</label>
                <input className="gov-input bg-gray-50" id="nextCode" readOnly value={buildSuggestedPageCode(parentCodeValue, menuRows)} />
              </div>
              <div>
                <label className="gov-label" htmlFor="codeNm">{en ? "Menu Name" : "메뉴명"}</label>
                <input className="gov-input" id="codeNm" value={codeNm} onChange={(event) => setCodeNm(event.target.value)} />
              </div>
              <div>
                <label className="gov-label" htmlFor="codeDc">{en ? "Menu Name (EN)" : "영문 메뉴명"}</label>
                <input className="gov-input" id="codeDc" value={codeDc} onChange={(event) => setCodeDc(event.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="gov-label" htmlFor="menuUrl">{en ? "Runtime URL" : "연결 URL"}</label>
                <input className="gov-input" id="menuUrl" placeholder={menuType === "USER" ? "/home/..." : "/admin/system/..."} value={menuUrl} onChange={(event) => setMenuUrl(event.target.value)} />
                <p className={`mt-2 text-xs ${createUrlValidation.tone === "success" ? "text-emerald-700" : "text-amber-700"}`}>{createUrlValidation.message}</p>
              </div>
              <div>
                <label className="gov-label" htmlFor="menuIcon">{en ? "Icon" : "아이콘"}</label>
                <select className="gov-select" id="menuIcon" value={menuIcon} onChange={(event) => setMenuIcon(event.target.value)}>
                  {iconOptions.map((icon) => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="gov-label" htmlFor="newMenuUseAt">{en ? "Use" : "사용 여부"}</label>
                <select className="gov-select" id="newMenuUseAt" value={useAt} onChange={(event) => setUseAt(event.target.value)}>
                  {useAtOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <MemberPermissionButton
                allowed={environmentAuthority.allowsAction("create")}
                disabled={createUrlValidation.tone !== "success"}
                onClick={() => { void createPageMenu().catch((error: Error) => setActionError(error.message)); }}
                reason={environmentAuthority.getActionReason("create", en)}
                type="button"
                variant="primary"
              >
                {en ? "Create Menu + Default Permission" : "메뉴 등록 + 기본 권한 생성"}
              </MemberPermissionButton>
            </div>
          </section>

          <section className="gov-card" id="environment-search-menu">
            <GridToolbar title={en ? "Binding Inventory Queue" : "바인딩 인벤토리 큐"} />
            <p className="mb-4 text-sm text-[var(--kr-gov-text-secondary)]">
              {en
                ? "Use this queue to decide which page can move into builder attach, which page is blocked, and which page should move next into validator flows."
                : "이 큐에서 어떤 페이지를 빌더에 연결할지, 어떤 페이지가 차단 상태인지, 어떤 페이지를 다음 검증 단계로 보낼지 결정합니다."}
            </p>
            <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
              <div>
                <label className="gov-label" htmlFor="environmentMenuType">{en ? "Scope" : "화면 구분"}</label>
                <select className="gov-select" id="environmentMenuType" value={menuType} onChange={(event) => setMenuType(event.target.value)}>
                  {((menuPage?.menuTypes || []) as Array<Record<string, unknown>>).map((type) => (
                    <option key={stringOf(type, "value")} value={stringOf(type, "value")}>{stringOf(type, "label")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="gov-label" htmlFor="environmentMenuSearch">{en ? "Menu Search" : "메뉴 검색어"}</label>
                <input
                  className="gov-input"
                  id="environmentMenuSearch"
                  placeholder={en ? "Menu code, page name, or URL" : "메뉴 코드, 페이지명, URL"}
                  value={menuSearch}
                  onChange={(event) => setMenuSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-white px-3 py-1 font-bold text-[var(--kr-gov-text-primary)]">
                  {en ? `Results ${filteredMenus.length}` : `검색 결과 ${filteredMenus.length}건`}
                </span>
                <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[var(--kr-gov-text-secondary)]">
                  {en ? `Pages ${screenBuilderPageCounts.totalPages}` : `페이지 ${screenBuilderPageCounts.totalPages}건`}
                </span>
                <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
                  {en ? `Published ${screenBuilderPageCounts.publishedPages}` : `Publish ${screenBuilderPageCounts.publishedPages}건`}
                </span>
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                  {en ? `Ready ${screenBuilderPageCounts.readyPages}` : `가능 ${screenBuilderPageCounts.readyPages}건`}
                </span>
                <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
                  {en ? `Blocked ${screenBuilderPageCounts.blockedPages}` : `차단 ${screenBuilderPageCounts.blockedPages}건`}
                </span>
                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                  {en ? `No Publish ${screenBuilderPageCounts.draftOnlyPages}` : `미발행 ${screenBuilderPageCounts.draftOnlyPages}건`}
                </span>
                <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
                  {en ? `Issues ${screenBuilderPageCounts.issuePages}` : `이슈 ${screenBuilderPageCounts.issuePages}건`}
                </span>
                <MemberButton
                  onClick={() => setScreenBuilderIssueReasonFilter("UNREGISTERED")}
                  size="xs"
                  type="button"
                  variant={screenBuilderIssueReasonFilter === "UNREGISTERED" ? "primary" : "secondary"}
                >
                  {en ? `Unregistered ${screenBuilderPageCounts.unregisteredPages}` : `미등록 ${screenBuilderPageCounts.unregisteredPages}건`}
                </MemberButton>
                <MemberButton
                  onClick={() => setScreenBuilderIssueReasonFilter("MISSING")}
                  size="xs"
                  type="button"
                  variant={screenBuilderIssueReasonFilter === "MISSING" ? "primary" : "secondary"}
                >
                  {en ? `Missing ${screenBuilderPageCounts.missingPages}` : `누락 ${screenBuilderPageCounts.missingPages}건`}
                </MemberButton>
                <MemberButton
                  onClick={() => setScreenBuilderIssueReasonFilter("DEPRECATED")}
                  size="xs"
                  type="button"
                  variant={screenBuilderIssueReasonFilter === "DEPRECATED" ? "primary" : "secondary"}
                >
                  {en ? `Deprecated ${screenBuilderPageCounts.deprecatedPages}` : `Deprecated ${screenBuilderPageCounts.deprecatedPages}건`}
                </MemberButton>
                <MemberButton onClick={() => setScreenBuilderFilter("ALL")} size="xs" type="button" variant={screenBuilderFilter === "ALL" ? "primary" : "secondary"}>
                  {en ? "All Menus" : "전체 메뉴"}
                </MemberButton>
                <MemberButton onClick={() => setScreenBuilderFilter("PUBLISHED_ONLY")} size="xs" type="button" variant={screenBuilderFilter === "PUBLISHED_ONLY" ? "primary" : "secondary"}>
                  {en ? "Published Only" : "Publish만"}
                </MemberButton>
                <MemberButton onClick={() => setScreenBuilderFilter("DRAFT_ONLY")} size="xs" type="button" variant={screenBuilderFilter === "DRAFT_ONLY" ? "primary" : "secondary"}>
                  {en ? "No Publish Yet" : "Publish 없음"}
                </MemberButton>
                <MemberButton onClick={() => setScreenBuilderFilter("READY_ONLY")} size="xs" type="button" variant={screenBuilderFilter === "READY_ONLY" ? "primary" : "secondary"}>
                  {en ? "Ready Only" : "가능만"}
                </MemberButton>
                <MemberButton onClick={() => setScreenBuilderFilter("BLOCKED_ONLY")} size="xs" type="button" variant={screenBuilderFilter === "BLOCKED_ONLY" ? "primary" : "secondary"}>
                  {en ? "Blocked Only" : "차단만"}
                </MemberButton>
                <MemberButton onClick={() => setScreenBuilderFilter("ISSUE_ONLY")} size="xs" type="button" variant={screenBuilderFilter === "ISSUE_ONLY" ? "primary" : "secondary"}>
                  {en ? "Issues Only" : "이슈만"}
                </MemberButton>
                <MemberButton onClick={() => setScreenBuilderFilter("STALE_PUBLISH_ONLY")} size="xs" type="button" variant={screenBuilderFilter === "STALE_PUBLISH_ONLY" ? "primary" : "secondary"}>
                  {en ? `Stale Publish ${screenBuilderPageCounts.stalePublishPages}` : `노후 발행 ${screenBuilderPageCounts.stalePublishPages}건`}
                </MemberButton>
                <MemberButton onClick={() => setScreenBuilderFilter("PARITY_DRIFT_ONLY")} size="xs" type="button" variant={screenBuilderFilter === "PARITY_DRIFT_ONLY" ? "primary" : "secondary"}>
                  {en ? `Parity Drift ${screenBuilderPageCounts.parityDriftPages}` : `정합성 드리프트 ${screenBuilderPageCounts.parityDriftPages}건`}
                </MemberButton>
                <MemberButton onClick={() => setScreenBuilderFilter("PARITY_GAP_ONLY")} size="xs" type="button" variant={screenBuilderFilter === "PARITY_GAP_ONLY" ? "primary" : "secondary"}>
                  {en ? `Parity Gap ${screenBuilderPageCounts.parityGapPages}` : `정합성 갭 ${screenBuilderPageCounts.parityGapPages}건`}
                </MemberButton>
                <MemberButton onClick={() => setScreenBuilderIssueReasonFilter("ALL")} size="xs" type="button" variant={screenBuilderIssueReasonFilter === "ALL" ? "primary" : "secondary"}>
                  {en ? "All Reasons" : "전체 사유"}
                </MemberButton>
                <MemberButton onClick={() => setScreenBuilderIssueReasonFilter("UNREGISTERED")} size="xs" type="button" variant={screenBuilderIssueReasonFilter === "UNREGISTERED" ? "primary" : "secondary"}>
                  {en ? "Unregistered" : "미등록"}
                </MemberButton>
                <MemberButton onClick={() => setScreenBuilderIssueReasonFilter("MISSING")} size="xs" type="button" variant={screenBuilderIssueReasonFilter === "MISSING" ? "primary" : "secondary"}>
                  {en ? "Missing" : "누락"}
                </MemberButton>
                <MemberButton onClick={() => setScreenBuilderIssueReasonFilter("DEPRECATED")} size="xs" type="button" variant={screenBuilderIssueReasonFilter === "DEPRECATED" ? "primary" : "secondary"}>
                  {en ? "Deprecated" : "Deprecated"}
                </MemberButton>
                {hasActiveScreenBuilderFilter ? (
                  <>
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[var(--kr-gov-text-secondary)]">
                      {en ? "Active filter" : "적용 필터"}: {activeScreenBuilderFilterLabel}
                    </span>
                    <MemberButton
                      onClick={() => {
                        setScreenBuilderFilter("ALL");
                        setScreenBuilderIssueReasonFilter("ALL");
                      }}
                      size="xs"
                      type="button"
                      variant="secondary"
                    >
                      {en ? "Reset Filters" : "필터 초기화"}
                    </MemberButton>
                  </>
                ) : null}
                {selectedMenu ? (
                  <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[var(--kr-gov-text-secondary)]">
                    {en ? "Selected" : "선택 메뉴"}: {selectedMenu.label} ({selectedMenu.code})
                  </span>
                ) : null}
              </div>
              <p className="text-[var(--kr-gov-text-secondary)]">
                {en ? "Search by code, label, or runtime URL." : "코드, 메뉴명, URL 기준으로 바로 찾을 수 있습니다."}
              </p>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                  {en ? "Queue Focus" : "큐 집중 영역"}
                </p>
                <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">
                  {hasActiveScreenBuilderFilter ? activeScreenBuilderFilterLabel : (en ? "All inventory" : "전체 인벤토리")}
                </p>
                <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? `${visibleSameIssueMenus.length} issue-family menus and ${visibleOtherMenus.length} other menus are visible now.`
                    : `현재 이슈군 메뉴 ${visibleSameIssueMenus.length}건, 기타 메뉴 ${visibleOtherMenus.length}건이 보입니다.`}
                </p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                  {en ? "Ready vs Blocked" : "가능 / 차단"}
                </p>
                <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">
                  {en
                    ? `Ready ${screenBuilderPageCounts.readyPages} / Blocked ${screenBuilderPageCounts.blockedPages}`
                    : `가능 ${screenBuilderPageCounts.readyPages} / 차단 ${screenBuilderPageCounts.blockedPages}`}
                </p>
                <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Blocked pages should stay here until validator-result becomes clean."
                    : "차단 페이지는 validator-result가 깨끗해질 때까지 이 큐에 남겨야 합니다."}
                </p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                  {en ? "Install Handoff" : "설치 핸드오프"}
                </p>
                <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">
                  {selectedMenu && selectedMenuIsPage
                    ? (selectedMenuPublishReady ? (en ? "Can move to validator" : "검증 단계로 이동 가능") : (en ? "Fix blockers before attach" : "연결 전 차단 이슈 해결"))
                    : (en ? "Select a page first" : "먼저 페이지를 선택하세요")}
                </p>
                <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">
                  {installBindingNextActions[0] || (en ? "No blocking action is open." : "열려 있는 차단 액션이 없습니다.")}
                </p>
              </div>
            </div>

            {selectedIssueReason ? (
              <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="font-bold text-blue-800">
                      {en
                        ? `Menu search result list is focused on ${describeScreenBuilderIssueReason(selectedIssueReason, en)} issue pages.`
                        : `메뉴 검색 결과 목록은 ${describeScreenBuilderIssueReason(selectedIssueReason, en)} 이슈가 있는 페이지 메뉴를 중심으로 보고 있습니다.`}
                    </p>
                    <p className="text-blue-700">
                      {en
                        ? `Visible page menus ${visibleSameIssueMenus.length} of ${sameIssueMenus.length} in this issue family.`
                        : `현재 이 이슈군의 페이지 메뉴 ${sameIssueMenus.length}건 중 ${visibleSameIssueMenus.length}건이 검색 결과 목록에 표시되고 있습니다.`}
                    </p>
                    <p className="text-blue-700">
                      {en
                        ? "Issue-family menus are pinned to the top of the search result list in queue order."
                        : "이 이슈군의 페이지 메뉴는 검색 결과 목록 상단에 정리 순서대로 먼저 배치됩니다."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MemberButton onClick={applySameIssueBlockedFilter} size="xs" type="button" variant="secondary">
                      {en ? "Show blocked issue list" : "같은 이슈 목록 보기"}
                    </MemberButton>
                    <MemberButton
                      onClick={() => {
                        setScreenBuilderFilter("ALL");
                        setScreenBuilderIssueReasonFilter("ALL");
                      }}
                      size="xs"
                      type="button"
                      variant="secondary"
                    >
                      {en ? "Clear issue focus" : "이슈 집중 해제"}
                    </MemberButton>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-4 py-3">{en ? "Menu" : "메뉴"}</th>
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3 text-center">{en ? "Type" : "유형"}</th>
                    <th className="px-4 py-3 text-center">{en ? "Use" : "사용"}</th>
                    <th className="px-4 py-3 text-center">{en ? "Select" : "선택"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orderedFilteredMenus.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                        <div className="flex flex-col items-center gap-2">
                          <p>
                            {hasActiveScreenBuilderFilter
                              ? (en
                                ? `No menus matched the active builder filter: ${activeScreenBuilderFilterLabel}.`
                                : `현재 빌더 필터(${activeScreenBuilderFilterLabel})에 맞는 메뉴가 없습니다.`)
                              : (en ? "No menus matched the search." : "검색 조건에 맞는 메뉴가 없습니다.")}
                          </p>
                          {hasActiveScreenBuilderFilter ? (
                            <MemberButton
                              onClick={() => {
                                setScreenBuilderFilter("ALL");
                                setScreenBuilderIssueReasonFilter("ALL");
                              }}
                              size="xs"
                              type="button"
                              variant="secondary"
                            >
                              {en ? "Reset Builder Filters" : "빌더 필터 초기화"}
                            </MemberButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : orderedFilteredMenus.map((row, index) => {
                    const selected = row.code === selectedMenuCode;
                    const rowIssueCount = screenBuilderIssueMap[row.code] || 0;
                    const rowIssueDetail = screenBuilderIssueDetailMap[row.code] || { unregisteredCount: 0, missingCount: 0, deprecatedCount: 0 };
                    const rowFreshness = screenBuilderFreshnessMap[row.code];
                    const rowParity = screenBuilderParityMap[row.code];
                    const rowPublishReady = row.code.length === 8 && rowIssueCount === 0;
                    const rowInSameIssueFamily = sameIssueMenuCodeSet.has(row.code);
                    const rowSameIssuePosition = rowInSameIssueFamily ? (sameIssueIndexMap[row.code] ?? -1) + 1 : 0;
                    const rowSameIssueRemaining = rowInSameIssueFamily ? (sameIssueRemainingMap[row.code] ?? 0) : 0;
                    const rowIsCurrentIssueTarget = selectedMenu?.code === row.code && rowInSameIssueFamily;
                    const rowIsPreviousIssueTarget = previousSameIssueMenu?.code === row.code;
                    const rowIsNextIssueTarget = nextSameIssueMenu?.code === row.code;
                    const rowToneClass = rowIsCurrentIssueTarget
                      ? "bg-blue-50 ring-1 ring-blue-200"
                      : rowIsNextIssueTarget
                        ? "bg-emerald-50"
                        : rowIsPreviousIssueTarget
                          ? "bg-amber-50"
                          : selected
                            ? "bg-[rgba(28,100,242,0.04)]"
                            : "";
                    const showOtherMenusDivider = Boolean(
                      selectedIssueReason
                      && visibleSameIssueMenus.length > 0
                      && visibleSameIssueMenus.length < orderedFilteredMenus.length
                      && index === visibleSameIssueMenus.length
                    );
                    const showIssueQueueDivider = Boolean(
                      selectedIssueReason
                      && visibleSameIssueMenus.length > 0
                      && index === 0
                      && rowInSameIssueFamily
                    );
                    return (
                      <Fragment key={row.code}>
                        {showIssueQueueDivider ? (
                          <tr className="bg-blue-100/70">
                            <td className="px-4 py-2 text-[11px] text-blue-800" colSpan={5}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-bold uppercase tracking-[0.08em]">
                                  {en
                                    ? `Current issue queue menus · ${describeScreenBuilderIssueReason(selectedIssueReason, en)}`
                                    : `현재 이슈 큐 메뉴 · ${describeScreenBuilderIssueReason(selectedIssueReason, en)}`}
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex rounded-full border border-blue-200 bg-white px-2 py-0.5 font-bold text-blue-800">
                                    {en ? `Share ${visibleSameIssueRatio}%` : `비중 ${visibleSameIssueRatio}%`}
                                  </span>
                                  <MemberButton onClick={applySameIssueBlockedFilter} size="xs" type="button" variant="secondary">
                                    {en ? "Show only this queue" : "이 구간만 보기"}
                                  </MemberButton>
                                </div>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-200/70">
                                <div className="h-full rounded-full bg-blue-600" style={{ width: `${visibleSameIssueRatio}%` }} />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 font-bold">
                                <span>{en ? `Visible ${visibleSameIssueMenus.length} / Total ${sameIssueMenus.length}` : `표시 ${visibleSameIssueMenus.length}건 / 전체 ${sameIssueMenus.length}건`}</span>
                                <span>{en ? `Published ${sameIssueQueueSummary.totalPublished}` : `Publish ${sameIssueQueueSummary.totalPublished}건`}</span>
                                <span>{en ? `Drafts ${sameIssueQueueSummary.totalDraft}` : `초안 ${sameIssueQueueSummary.totalDraft}건`}</span>
                                <span>{en ? `Ready ${visibleSameIssueReadyCount}` : `가능 ${visibleSameIssueReadyCount}건`}</span>
                                <span>{en ? `Blocked ${visibleSameIssueBlockedCount}` : `차단 ${visibleSameIssueBlockedCount}건`}</span>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                        {showOtherMenusDivider ? (
                          <tr key={`${row.code}-divider`} className="bg-slate-100/80">
                            <td className="px-4 py-2 text-[11px] text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-bold uppercase tracking-[0.08em]">
                                  {en ? "Other menus outside this issue queue" : "현재 이슈 큐 밖의 다른 메뉴"}
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex rounded-full border border-slate-300 bg-white px-2 py-0.5 font-bold text-[var(--kr-gov-text-primary)]">
                                    {en ? `Share ${visibleOtherRatio}%` : `비중 ${visibleOtherRatio}%`}
                                  </span>
                                  <MemberButton
                                    onClick={() => {
                                      setScreenBuilderFilter("ALL");
                                      setScreenBuilderIssueReasonFilter("ALL");
                                      window.setTimeout(() => scrollToSection("environment-search-menu"), 0);
                                    }}
                                    size="xs"
                                    type="button"
                                    variant="secondary"
                                  >
                                    {en ? "Show outside queue" : "이 구간만 보기"}
                                  </MemberButton>
                                </div>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                                <div className="h-full rounded-full bg-slate-500" style={{ width: `${visibleOtherRatio}%` }} />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 font-bold">
                                <span>{en ? `Menus ${visibleOtherMenus.length}` : `메뉴 ${visibleOtherMenus.length}건`}</span>
                                <span>{en ? `Published ${visibleOtherPublishedCount}` : `Publish ${visibleOtherPublishedCount}건`}</span>
                                <span>{en ? `Drafts ${visibleOtherDraftCount}` : `초안 ${visibleOtherDraftCount}건`}</span>
                                <span>{en ? `Ready ${visibleOtherReadyCount}` : `가능 ${visibleOtherReadyCount}건`}</span>
                                <span>{en ? `Blocked ${visibleOtherBlockedCount}` : `차단 ${visibleOtherBlockedCount}건`}</span>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                        <tr key={row.code} className={rowToneClass}>
                          <td className="px-4 py-3">
                          <p className="font-bold">{row.label}</p>
                          <p className="text-xs text-[var(--kr-gov-text-secondary)]">{row.code} / {row.parentCode}</p>
                          {row.code.length === 8 ? (
                            <>
                              {rowInSameIssueFamily ? (
                                <p className="mt-1 flex flex-wrap gap-1">
                                  {rowIsCurrentIssueTarget ? (
                                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                      {en ? "Current issue target" : "현재 이슈 대상"}
                                    </span>
                                  ) : null}
                                  {rowIsPreviousIssueTarget ? (
                                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                      {en ? "Previous issue target" : "이전 이슈 대상"}
                                    </span>
                                  ) : null}
                                  {rowIsNextIssueTarget ? (
                                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                      {en ? "Next issue target" : "다음 이슈 대상"}
                                    </span>
                                  ) : null}
                                  {!rowIsCurrentIssueTarget && !rowIsPreviousIssueTarget && !rowIsNextIssueTarget ? (
                                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                      {en ? "Same issue family" : "같은 이슈군"}
                                    </span>
                                  ) : null}
                                  {rowSameIssuePosition > 0 ? (
                                    <span className="inline-flex rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                      {en
                                        ? `Position ${rowSameIssuePosition}/${sameIssueMenus.length}`
                                        : `순번 ${rowSameIssuePosition}/${sameIssueMenus.length}`}
                                    </span>
                                  ) : null}
                                  {rowSameIssuePosition > 0 ? (
                                    <span className="inline-flex rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                      {en
                                        ? `Remaining ${rowSameIssueRemaining}`
                                        : `남은 ${rowSameIssueRemaining}건`}
                                    </span>
                                  ) : null}
                                </p>
                              ) : null}
                              <p className="mt-1 flex flex-wrap gap-1">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${screenBuilderPublishedMap[row.code] ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                  {screenBuilderPublishedMap[row.code] ? (en ? "Published" : "Publish") : (en ? "Draft" : "초안")}
                                </span>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${rowPublishReady ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                  {rowPublishReady ? (en ? "Ready" : "가능") : (en ? "Blocked" : "차단")}
                                </span>
                                {rowFreshness?.state === "STALE" ? (
                                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700">
                                    {en ? "Stale Publish" : "노후 발행"}
                                  </span>
                                ) : rowFreshness?.state === "AGING" ? (
                                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700">
                                    {en ? "Aging Publish" : "발행 노후화"}
                                  </span>
                                ) : rowFreshness?.state === "FRESH" ? (
                                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                    {en ? "Fresh Publish" : "최신 발행"}
                                  </span>
                                ) : null}
                                {rowParity?.state === "GAP" ? (
                                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700">
                                    {en ? "Parity Gap" : "정합성 갭"}
                                  </span>
                                ) : rowParity?.state === "DRIFT" ? (
                                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700">
                                    {en ? "Parity Drift" : "정합성 드리프트"}
                                  </span>
                                ) : rowParity?.state === "MATCH" ? (
                                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                    {en ? "Parity Match" : "정합성 일치"}
                                  </span>
                                ) : null}
                                {rowIssueCount > 0 ? (
                                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700">
                                    {en ? `Issues ${rowIssueCount}` : `이슈 ${rowIssueCount}`}
                                  </span>
                                ) : null}
                                {rowIssueDetail.unregisteredCount > 0 ? (
                                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700">
                                    {en ? `U ${rowIssueDetail.unregisteredCount}` : `미 ${rowIssueDetail.unregisteredCount}`}
                                  </span>
                                ) : null}
                                {rowIssueDetail.missingCount > 0 ? (
                                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700">
                                    {en ? `M ${rowIssueDetail.missingCount}` : `누 ${rowIssueDetail.missingCount}`}
                                  </span>
                                ) : null}
                                {rowIssueDetail.deprecatedCount > 0 ? (
                                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-fuchsia-100 text-fuchsia-700">
                                    {en ? `D ${rowIssueDetail.deprecatedCount}` : `D ${rowIssueDetail.deprecatedCount}`}
                                  </span>
                                ) : null}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <MemberLinkButton
                                  href={buildScreenBuilderPath({
                                    menuCode: row.code,
                                    pageId: row.code.toLowerCase(),
                                    menuTitle: row.label,
                                    menuUrl: row.menuUrl || ""
                                  })}
                                  size="xs"
                                  variant={rowPublishReady ? "secondary" : "info"}
                                >
                                  {en ? "Attach" : "연결"}
                                </MemberLinkButton>
                                {screenBuilderPublishedMap[row.code] ? (
                                  <>
                                    <MemberLinkButton
                                      href={buildScreenRuntimePath({
                                        menuCode: row.code,
                                        pageId: row.code.toLowerCase(),
                                        menuTitle: row.label,
                                        menuUrl: row.menuUrl || ""
                                      })}
                                      size="xs"
                                      variant="secondary"
                                    >
                                      {en ? "Validate Runtime" : "런타임 검증"}
                                    </MemberLinkButton>
                                    <MemberLinkButton
                                      href={buildCurrentRuntimeComparePath({
                                        menuCode: row.code,
                                        pageId: row.code.toLowerCase(),
                                        menuTitle: row.label,
                                        menuUrl: row.menuUrl || ""
                                      })}
                                      size="xs"
                                      variant={rowParity?.state === "GAP" || rowParity?.state === "DRIFT" ? "info" : "secondary"}
                                    >
                                      {en ? "Repair / Compare" : "복구 / 비교"}
                                    </MemberLinkButton>
                                  </>
                                ) : null}
                                <MemberLinkButton
                                  href={buildObservabilityPath({
                                    menuCode: row.code,
                                    pageId: row.code.toLowerCase(),
                                    searchKeyword: "SCREEN_BUILDER_"
                                  })}
                                  size="xs"
                                  variant="secondary"
                                >
                                  {en ? "Observe" : "관측"}
                                </MemberLinkButton>
                              </div>
                            </>
                          ) : null}
                          {row.code.length === 8 ? (
                            <p className={`mt-1 text-[11px] ${rowPublishReady ? "text-emerald-700" : "text-red-700"}`}>
                              {summarizeBuilderBlockingReason(rowIssueCount, en)}
                            </p>
                          ) : null}
                          {row.code.length === 8 && (rowFreshness?.detail || rowParity?.detail) ? (
                            <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">
                              {[rowFreshness?.detail, rowParity?.detail].filter(Boolean).join(" / ")}
                            </p>
                          ) : null}
                        </td>
                          <td className="px-4 py-3 break-all text-[var(--kr-gov-text-secondary)]">{row.menuUrl}</td>
                          <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${row.code.length === 8 ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-700"}`}>
                            {row.code.length === 8 ? (en ? "Page" : "페이지") : (en ? "Group" : "그룹")}
                          </span>
                          </td>
                          <td className="px-4 py-3 text-center">{row.useAt}</td>
                          <td className="px-4 py-3 text-center">
                          <button
                            className={selected ? "gov-btn gov-btn-primary" : "gov-btn gov-btn-outline-blue"}
                            onClick={() => setSelectedMenuCode(row.code)}
                            type="button"
                          >
                            {selected ? (en ? "Selected" : "선택됨") : (en ? "Select" : "선택")}
                          </button>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="gov-card min-w-0">
            <GridToolbar title={en ? "Selected Binding Detail" : "선택 바인딩 상세"} />
            <p className="mb-4 text-sm text-[var(--kr-gov-text-secondary)]">
              {en
                ? "This panel owns the current page binding detail. Review draft values, builder status, and next handoff actions for the selected page here."
                : "이 패널은 현재 페이지의 바인딩 상세를 담당합니다. 선택 페이지의 draft 값, 빌더 상태, 다음 핸드오프 액션을 여기서 확인합니다."}
            </p>
            {selectedMenu ? (
              <div className="space-y-4">
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Menu</p>
                  <p className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{selectedMenu.label}</p>
                  <p className="mt-1 font-mono text-[13px] text-[var(--kr-gov-text-secondary)]">{selectedMenu.code}</p>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Group Code" : "그룹 코드"}</dt>
                    <dd className="font-mono text-[13px] text-[var(--kr-gov-text-primary)]">{selectedMenu.parentCode}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">URL</dt>
                    <dd className="font-mono text-[13px] text-right text-[var(--kr-gov-text-primary)]">{selectedMenu.menuUrl}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Default Permission" : "기본 권한"}</dt>
                    <dd className="font-mono text-[13px] text-[var(--kr-gov-text-primary)]">{selectedMenu.code}_VIEW</dd>
                  </div>
                </dl>
                <div className="rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "This panel updates the selected page menu in place without leaving the screen."
                    : "이 패널에서 화면 이동 없이 선택한 페이지 메뉴의 이름, URL, 아이콘, 사용 여부를 바로 수정합니다."}
                </div>
                <div className="flex flex-wrap gap-2">
                  <MemberLinkButton href={buildLocalizedPath("/admin/auth/group", "/en/admin/auth/group")} size="sm" variant="secondary">
                    {en ? "Open Authority Binding" : "권한 바인딩 열기"}
                  </MemberLinkButton>
                  <MemberLinkButton href={buildFeatureManagementPath({ menuType, searchMenuCode: selectedMenu.code })} size="sm" variant="secondary">
                    {en ? "Open Feature Binding" : "기능 바인딩 열기"}
                  </MemberLinkButton>
                    <MemberPermissionButton
                      allowed={environmentAuthority.allowsAction("execute")}
                      disabled={allSummaryRebuildBusy}
                      onClick={() => { void handleRebuildAllSummaries(); }}
                      reason={environmentAuthority.getActionReason("execute", en)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {allSummaryRebuildBusy
                      ? (en ? "Refreshing All Gates..." : "전체 게이트 갱신 중...")
                      : (en ? "Refresh All Install Gates" : "전체 설치 게이트 갱신")}
                    </MemberPermissionButton>
                  {selectedMenuIsPage ? (
                    <>
                      <MemberPermissionButton
                        allowed={environmentAuthority.allowsAction("execute")}
                        disabled={selectedSummaryRebuildBusy}
                        onClick={() => { void handleRebuildSelectedSummary(); }}
                        reason={environmentAuthority.getActionReason("execute", en)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        {selectedSummaryRebuildBusy
                          ? (en ? "Rebuilding Summary..." : "요약 재생성 중...")
                          : (en ? "Rebuild This Summary" : "이 메뉴 요약 재생성")}
                      </MemberPermissionButton>
                      <MemberLinkButton
                        href={buildScreenBuilderPath({
                          menuCode: selectedMenu.code,
                          pageId: governancePageId || selectedMenu.code.toLowerCase(),
                          menuTitle: selectedMenu.label,
                          menuUrl: selectedMenu.menuUrl || ""
                        })}
                        size="sm"
                        variant="info"
                      >
                        {en ? "Open Screen Builder" : "화면 빌더 열기"}
                      </MemberLinkButton>
                      <MemberLinkButton
                        href={buildScreenRuntimePath({
                          menuCode: selectedMenu.code,
                          pageId: governancePageId || selectedMenu.code.toLowerCase(),
                          menuTitle: selectedMenu.label,
                          menuUrl: selectedMenu.menuUrl || ""
                        })}
                        size="sm"
                        variant="secondary"
                      >
                        {en ? "Open Published Runtime" : "발행 런타임 열기"}
                      </MemberLinkButton>
                      <MemberLinkButton
                        href={buildObservabilityPath({
                          menuCode: selectedMenu.code,
                          pageId: governancePageId || selectedMenu.code.toLowerCase(),
                          searchKeyword: "SCREEN_BUILDER_"
                        })}
                        size="sm"
                        variant="secondary"
                      >
                        {en ? "Open Builder Activity" : "빌더 활동 열기"}
                      </MemberLinkButton>
                    </>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Linked Features" : "연결 기능"}</p>
                    <p className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{permissionSummary.linkedFeatureCount} / {permissionSummary.featureCount}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                      {en ? "Features already connected to at least one role group" : "권한 그룹에 1개 이상 연결된 기능 수"}
                    </p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Role Links" : "권한 연결 수"}</p>
                    <p className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{permissionSummary.assignedRoleTotal}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                      {permissionSummary.unassignedFeatureCount > 0
                        ? (en ? `${permissionSummary.unassignedFeatureCount} features still need review` : `${permissionSummary.unassignedFeatureCount}개 기능 추가 검토 필요`)
                        : (en ? "All registered features are mapped" : "등록 기능이 모두 매핑됨")}
                    </p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Screen Builder" : "화면 빌더"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${screenBuilderStatus?.publishedVersionId ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                        {screenBuilderStatus?.publishedVersionId ? (en ? "Published" : "Publish 있음") : (en ? "Draft Only" : "초안만 있음")}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${selectedMenuPublishReady ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {selectedMenuPublishReady
                          ? (en ? "Publish Ready" : "Publish 가능")
                          : (en ? "Publish Blocked" : "Publish 차단")}
                      </span>
                      <span className="text-sm text-[var(--kr-gov-text-secondary)]">
                        {en ? "Snapshots" : "스냅샷"}: {screenBuilderStatus?.versionCount || 0}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${selectedMenuBuilderIssueCount > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {en ? "Registry Issues" : "레지스트리 이슈"}: {selectedMenuBuilderIssueCount}
                      </span>
                      {screenBuilderStatus?.publishedVersionId ? (
                        <>
                          <span className="font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">{screenBuilderStatus.publishedVersionId}</span>
                          {screenBuilderStatus.publishedSavedAt ? (
                            <span className="text-[11px] text-[var(--kr-gov-text-secondary)]">{screenBuilderStatus.publishedSavedAt}</span>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    {screenBuilderStatus ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-4">
                        <div className={`rounded border px-3 py-2 ${selectedMenuPublishReady ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                          <p className={`text-[11px] font-black uppercase tracking-[0.08em] ${selectedMenuPublishReady ? "text-emerald-800" : "text-red-800"}`}>{en ? "Publish Readiness" : "Publish 준비 상태"}</p>
                          <p className={`mt-1 text-sm font-bold ${selectedMenuPublishReady ? "text-emerald-900" : "text-red-900"}`}>
                            {selectedMenuPublishReady
                              ? (en ? "Ready now" : "지금 가능")
                              : (en ? `${selectedMenuBuilderIssueCount} issues blocking` : `${selectedMenuBuilderIssueCount}건 차단`)}
                          </p>
                          <p className={`mt-1 text-[11px] ${selectedMenuPublishReady ? "text-emerald-700" : "text-red-700"}`}>
                            {summarizeBuilderIssueBreakdown(screenBuilderStatus, en)}
                          </p>
                          <p className={`mt-2 text-[11px] font-medium ${selectedMenuPublishReady ? "text-emerald-800" : "text-red-800"}`}>
                            {en ? "Next action" : "권장 다음 조치"}: {recommendBuilderNextAction(screenBuilderStatus, en)}
                          </p>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Unregistered" : "미등록"}</p>
                          <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{screenBuilderStatus.unregisteredCount}</p>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Missing" : "누락"}</p>
                          <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{screenBuilderStatus.missingCount}</p>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Deprecated</p>
                          <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{screenBuilderStatus.deprecatedCount}</p>
                        </div>
                      </div>
                    ) : null}
                    {selectedMenuIsPage && selectedBuilderStatus ? (
                      <div className={`mt-3 rounded-[var(--kr-gov-radius)] border px-4 py-3 ${selectedMenuPublishReady ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className={`text-xs font-black uppercase tracking-[0.08em] ${selectedMenuPublishReady ? "text-emerald-800" : "text-red-800"}`}>
                              {en ? "Recommended Builder Action" : "권장 빌더 작업"}
                            </p>
                            <p className={`mt-1 text-sm font-bold ${selectedMenuPublishReady ? "text-emerald-900" : "text-red-900"}`}>
                              {recommendBuilderNextAction(selectedBuilderStatus, en)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <MemberLinkButton
                              href={buildScreenBuilderPath({
                                menuCode: selectedMenu.code,
                                pageId: governancePageId || selectedMenu.code.toLowerCase(),
                                menuTitle: selectedMenu.label,
                                menuUrl: selectedMenu.menuUrl || ""
                              })}
                              size="sm"
                              variant={selectedMenuPublishReady ? "secondary" : "info"}
                            >
                              {en ? "Open Builder Now" : "지금 빌더 열기"}
                            </MemberLinkButton>
                            <MemberLinkButton
                              href={buildObservabilityPath({
                                menuCode: selectedMenu.code,
                                pageId: governancePageId || selectedMenu.code.toLowerCase(),
                                searchKeyword: "SCREEN_BUILDER_"
                              })}
                              size="sm"
                              variant="secondary"
                            >
                              {en ? "Check Builder Activity" : "빌더 활동 확인"}
                            </MemberLinkButton>
                          </div>
                        </div>
                        {(selectedBuilderStatus!.unregisteredCount > 0 || selectedBuilderStatus!.missingCount > 0 || selectedBuilderStatus!.deprecatedCount > 0) ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${selectedMenuPublishReady ? "bg-white text-emerald-800" : "bg-white text-red-800"}`}>
                              {en ? "View pages with same issue" : "같은 유형 페이지 보기"}
                            </span>
                            {selectedBuilderStatus!.unregisteredCount > 0 ? (
                              <MemberButton
                                onClick={() => applyScreenBuilderIssueView("UNREGISTERED")}
                                size="xs"
                                type="button"
                                variant="secondary"
                              >
                                {en ? `Unregistered pages ${screenBuilderIssuePageCounts.UNREGISTERED}` : `미등록 페이지 ${screenBuilderIssuePageCounts.UNREGISTERED}건`}
                              </MemberButton>
                            ) : null}
                            {selectedBuilderStatus!.missingCount > 0 ? (
                              <MemberButton
                                onClick={() => applyScreenBuilderIssueView("MISSING")}
                                size="xs"
                                type="button"
                                variant="secondary"
                              >
                                {en ? `Missing pages ${screenBuilderIssuePageCounts.MISSING}` : `누락 페이지 ${screenBuilderIssuePageCounts.MISSING}건`}
                              </MemberButton>
                            ) : null}
                            {selectedBuilderStatus!.deprecatedCount > 0 ? (
                              <MemberButton
                                onClick={() => applyScreenBuilderIssueView("DEPRECATED")}
                                size="xs"
                                type="button"
                                variant="secondary"
                              >
                                {en ? `Deprecated pages ${screenBuilderIssuePageCounts.DEPRECATED}` : `Deprecated 페이지 ${screenBuilderIssuePageCounts.DEPRECATED}건`}
                              </MemberButton>
                            ) : null}
                          </div>
                        ) : null}
                        {selectedIssueReason && sameIssueMenus.length > 0 ? (
                          <div className="mt-3 space-y-2 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center rounded-full px-3 py-1 font-bold ${selectedMenuPublishReady ? "bg-white text-emerald-800" : "bg-white text-red-800"}`}>
                                {en ? `Issue family ${describeScreenBuilderIssueReason(selectedIssueReason, en)}` : `이슈 유형 ${describeScreenBuilderIssueReason(selectedIssueReason, en)}`}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-3 py-1 font-bold ${selectedMenuPublishReady ? "bg-white text-emerald-800" : "bg-white text-red-800"}`}>
                                {en
                                  ? `Current position ${sameIssueIndex >= 0 ? sameIssueIndex + 1 : 1} / ${sameIssueMenus.length}`
                                  : `현재 위치 ${sameIssueIndex >= 0 ? sameIssueIndex + 1 : 1} / ${sameIssueMenus.length}`}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-3 py-1 font-bold ${selectedMenuPublishReady ? "bg-white text-emerald-800" : "bg-white text-red-800"}`}>
                                {en ? `Remaining ${remainingSameIssueCount}` : `남은 대상 ${remainingSameIssueCount}건`}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-3 py-1 font-bold ${selectedMenuPublishReady ? "bg-white text-emerald-800" : "bg-white text-red-800"}`}>
                                {en ? `Resolved ${resolvedSameIssueCount}` : `지나온 대상 ${resolvedSameIssueCount}건`}
                              </span>
                              {selectedMenu ? (
                                <span className={`inline-flex items-center rounded-full px-3 py-1 font-mono ${selectedMenuPublishReady ? "bg-white text-emerald-800" : "bg-white text-red-800"}`}>
                                  {selectedMenu.code} / {selectedMenu.label}
                                </span>
                              ) : null}
                              {previousSameIssueMenu ? (
                                <MemberButton onClick={() => moveToSameIssueMenu(previousSameIssueMenu.code)} size="xs" type="button" variant="secondary">
                                  {en ? `Previous ${previousSameIssueMenu.code}` : `이전 대상 ${previousSameIssueMenu.code}`}
                                </MemberButton>
                              ) : null}
                              {nextSameIssueMenu ? (
                                <MemberButton onClick={() => moveToSameIssueMenu(nextSameIssueMenu.code)} size="xs" type="button" variant="secondary">
                                  {en ? `Next ${nextSameIssueMenu.code}` : `다음 대상 ${nextSameIssueMenu.code}`}
                                </MemberButton>
                              ) : null}
                            </div>
                            <div className="rounded border border-white bg-white/70 px-3 py-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                                  {en ? "Issue family progress" : "이슈 정리 진행률"}
                                </span>
                                <span className="text-[11px] font-bold text-[var(--kr-gov-text-primary)]">
                                  {sameIssueProgressPercent}%
                                </span>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className={`h-full rounded-full ${selectedMenuPublishReady ? "bg-emerald-500" : "bg-red-500"}`}
                                  style={{ width: `${sameIssueProgressPercent}%` }}
                                />
                              </div>
                              <p className="mt-2 text-[11px] text-[var(--kr-gov-text-secondary)]">
                                {en
                                  ? `${resolvedSameIssueCount} reviewed / ${sameIssueMenus.length} total`
                                  : `${resolvedSameIssueCount}건 확인 / 전체 ${sameIssueMenus.length}건`}
                              </p>
                              <p className="mt-1 text-[10px] text-[var(--kr-gov-text-secondary)]">
                                {en
                                  ? "Counts below are based on the menu search result list on this page."
                                  : "아래 수치는 이 화면의 메뉴 검색 결과 목록에 현재 보이는 페이지 메뉴 기준입니다."}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                  {en
                                    ? `Visible in search list ${visibleSameIssueMenus.length} / ${sameIssueMenus.length}`
                                    : `검색 결과 목록 표시 ${visibleSameIssueMenus.length} / ${sameIssueMenus.length}`}
                                </span>
                                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                  {en
                                    ? `Visible published menus ${visibleSameIssuePublishedCount}`
                                    : `검색 결과 Publish 메뉴 ${visibleSameIssuePublishedCount}건`}
                                </span>
                                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                  {en
                                    ? `Visible draft menus ${visibleSameIssueDraftCount}`
                                    : `검색 결과 초안 메뉴 ${visibleSameIssueDraftCount}건`}
                                </span>
                                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                  {en
                                    ? `Published queue ${sameIssueQueueSummary.totalPublished}`
                                    : `Publish 큐 ${sameIssueQueueSummary.totalPublished}건`}
                                </span>
                                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                  {en
                                    ? `Draft queue ${sameIssueQueueSummary.totalDraft}`
                                    : `초안 큐 ${sameIssueQueueSummary.totalDraft}건`}
                                </span>
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                  {en
                                    ? `Remaining published ${sameIssueQueueSummary.remainingPublished}`
                                    : `남은 Publish ${sameIssueQueueSummary.remainingPublished}건`}
                                </span>
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                  {en
                                    ? `Remaining draft ${sameIssueQueueSummary.remainingDraft}`
                                    : `남은 초안 ${sameIssueQueueSummary.remainingDraft}건`}
                                </span>
                                {previousPublishedSameIssueMenu ? (
                                  <>
                                    <MemberButton onClick={() => moveToSameIssueMenu(previousPublishedSameIssueMenu.code)} size="xs" type="button" variant="secondary">
                                      {en ? "Open previous published" : "이전 Publish 열기"}
                                    </MemberButton>
                                    <>
                                      <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-mono text-blue-700">
                                        {previousPublishedSameIssueMenu.code} / {previousPublishedSameIssueMenu.label}
                                      </span>
                                      <MemberLinkButton
                                        href={buildScreenBuilderPath({
                                          menuCode: previousPublishedSameIssueMenu.code,
                                          pageId: previousPublishedSameIssueMenu.code.toLowerCase(),
                                          menuTitle: previousPublishedSameIssueMenu.label,
                                          menuUrl: previousPublishedSameIssueMenu.menuUrl || ""
                                        })}
                                        size="xs"
                                        variant="secondary"
                                      >
                                        {en ? "Builder" : "빌더"}
                                      </MemberLinkButton>
                                      <MemberLinkButton
                                        href={buildScreenRuntimePath({
                                          menuCode: previousPublishedSameIssueMenu.code,
                                          pageId: previousPublishedSameIssueMenu.code.toLowerCase(),
                                          menuTitle: previousPublishedSameIssueMenu.label,
                                          menuUrl: previousPublishedSameIssueMenu.menuUrl || ""
                                        })}
                                        size="xs"
                                        variant="secondary"
                                      >
                                        {en ? "Runtime" : "런타임"}
                                      </MemberLinkButton>
                                      <MemberLinkButton
                                        href={buildObservabilityPath({
                                          menuCode: previousPublishedSameIssueMenu.code,
                                          pageId: previousPublishedSameIssueMenu.code.toLowerCase(),
                                          searchKeyword: "SCREEN_BUILDER_"
                                        })}
                                        size="xs"
                                        variant="secondary"
                                      >
                                        {en ? "Activity" : "활동"}
                                      </MemberLinkButton>
                                    </>
                                  </>
                                ) : null}
                                {previousDraftSameIssueMenu ? (
                                  <>
                                    <MemberButton onClick={() => moveToSameIssueMenu(previousDraftSameIssueMenu.code)} size="xs" type="button" variant="secondary">
                                      {en ? "Open previous draft" : "이전 초안 열기"}
                                    </MemberButton>
                                    <>
                                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-mono text-amber-700">
                                        {previousDraftSameIssueMenu.code} / {previousDraftSameIssueMenu.label}
                                      </span>
                                      <MemberLinkButton
                                        href={buildManagedBuilderHref(previousDraftSameIssueMenu)}
                                        size="xs"
                                        variant="secondary"
                                      >
                                        {en ? "Builder" : "빌더"}
                                      </MemberLinkButton>
                                      <MemberLinkButton
                                        href={buildManagedObservabilityHref(previousDraftSameIssueMenu)}
                                        size="xs"
                                        variant="secondary"
                                      >
                                        {en ? "Activity" : "활동"}
                                      </MemberLinkButton>
                                    </>
                                  </>
                                ) : null}
                                {sameIssueQueueSummary.remainingPublished > 0 ? (
                                  <>
                                    <MemberButton onClick={() => moveToSameIssueQueueMode("PUBLISHED")} size="xs" type="button" variant="secondary">
                                      {en ? "Open next published" : "다음 Publish 열기"}
                                    </MemberButton>
                                    <MemberButton onClick={() => applySameIssueQueueFilter("PUBLISHED")} size="xs" type="button" variant="secondary">
                                      {en ? "Show published in list" : "목록에서 Publish만 보기"}
                                    </MemberButton>
                                    {nextRemainingPublishedSameIssueMenu ? (
                                      <>
                                        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-mono text-blue-700">
                                          {nextRemainingPublishedSameIssueMenu.code} / {nextRemainingPublishedSameIssueMenu.label}
                                        </span>
                                        <MemberLinkButton
                                          href={buildManagedBuilderHref(nextRemainingPublishedSameIssueMenu)}
                                          size="xs"
                                          variant="secondary"
                                        >
                                          {en ? "Builder" : "빌더"}
                                        </MemberLinkButton>
                                        <MemberLinkButton
                                          href={buildManagedRuntimeHref(nextRemainingPublishedSameIssueMenu)}
                                          size="xs"
                                          variant="secondary"
                                        >
                                          {en ? "Runtime" : "런타임"}
                                        </MemberLinkButton>
                                        <MemberLinkButton
                                          href={buildManagedObservabilityHref(nextRemainingPublishedSameIssueMenu)}
                                          size="xs"
                                          variant="secondary"
                                        >
                                          {en ? "Activity" : "활동"}
                                        </MemberLinkButton>
                                      </>
                                    ) : null}
                                  </>
                                ) : null}
                                {sameIssueQueueSummary.remainingDraft > 0 ? (
                                  <>
                                    <MemberButton onClick={() => moveToSameIssueQueueMode("DRAFT")} size="xs" type="button" variant="secondary">
                                      {en ? "Open next draft" : "다음 초안 열기"}
                                    </MemberButton>
                                    <MemberButton onClick={() => applySameIssueQueueFilter("DRAFT")} size="xs" type="button" variant="secondary">
                                      {en ? "Show drafts in list" : "목록에서 초안만 보기"}
                                    </MemberButton>
                                    {nextRemainingDraftSameIssueMenu ? (
                                      <>
                                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-mono text-amber-700">
                                          {nextRemainingDraftSameIssueMenu.code} / {nextRemainingDraftSameIssueMenu.label}
                                        </span>
                                        <MemberLinkButton
                                          href={buildManagedBuilderHref(nextRemainingDraftSameIssueMenu)}
                                          size="xs"
                                          variant="secondary"
                                        >
                                          {en ? "Builder" : "빌더"}
                                        </MemberLinkButton>
                                        <MemberLinkButton
                                          href={buildManagedObservabilityHref(nextRemainingDraftSameIssueMenu)}
                                          size="xs"
                                          variant="secondary"
                                        >
                                          {en ? "Activity" : "활동"}
                                        </MemberLinkButton>
                                      </>
                                    ) : null}
                                  </>
                                ) : null}
                                {selectedIssueReason ? (
                                  <MemberButton onClick={applySameIssueBlockedFilter} size="xs" type="button" variant="secondary">
                                    {en ? "Show blocked issue list" : "목록에서 같은 이슈 보기"}
                                  </MemberButton>
                                ) : null}
                              </div>
                              <p className="mt-2 text-[11px] font-medium text-[var(--kr-gov-text-primary)]">
                                {describeScreenBuilderQueueFocus(sameIssueQueueSummary, en)}
                              </p>
                            </div>
                            {selectedMenu ? (
                              <div className="rounded border border-white bg-white/80 px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                                    {en ? "Current target" : "현재 대상"}
                                  </span>
                                  <span className="font-mono text-[11px] text-[var(--kr-gov-text-primary)]">
                                    {selectedMenu.code}
                                  </span>
                                  <span className="text-[11px] text-[var(--kr-gov-text-secondary)]">
                                    {selectedMenu.label}
                                  </span>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${screenBuilderStatus?.publishedVersionId ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                    {screenBuilderStatus?.publishedVersionId ? (en ? "Published" : "Publish") : (en ? "Draft" : "초안")}
                                  </span>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${selectedMenuPublishReady ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                    {selectedMenuPublishReady ? (en ? "Ready" : "가능") : (en ? `Issues ${selectedMenuBuilderIssueCount}` : `이슈 ${selectedMenuBuilderIssueCount}`)}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <MemberLinkButton
                                    href={buildManagedBuilderHref(selectedMenu, governancePageId)}
                                    size="xs"
                                    variant="secondary"
                                  >
                                    {en ? "Current Attach" : "현재 연결"}
                                  </MemberLinkButton>
                                  {screenBuilderStatus?.publishedVersionId ? (
                                    <MemberLinkButton
                                      href={buildManagedRuntimeHref(selectedMenu, governancePageId)}
                                      size="xs"
                                      variant="secondary"
                                    >
                                      {en ? "Current Validate" : "현재 검증"}
                                    </MemberLinkButton>
                                  ) : null}
                                  <MemberLinkButton
                                    href={buildManagedObservabilityHref(selectedMenu, governancePageId)}
                                    size="xs"
                                    variant="secondary"
                                  >
                                    {en ? "Current Observe" : "현재 관측"}
                                  </MemberLinkButton>
                                  {screenBuilderStatus?.publishedVersionId ? (
                                    <MemberLinkButton
                                      href={buildManagedCompareHref(selectedMenu, governancePageId)}
                                      size="xs"
                                      variant="secondary"
                                    >
                                      {en ? "Current Repair" : "현재 복구"}
                                    </MemberLinkButton>
                                  ) : null}
                                </div>
                                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                                  <div className="rounded border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                                      {en ? "Release Unit" : "릴리즈 유닛"}
                                    </p>
                                    <p className="mt-1 font-mono text-[11px] text-[var(--kr-gov-text-primary)]">
                                      {screenBuilderStatus?.releaseUnitId || "-"}
                                    </p>
                                  </div>
                                  <div className="rounded border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                                      {en ? "Install Target" : "설치 타깃"}
                                    </p>
                                    <p className="mt-1 font-mono text-[11px] text-[var(--kr-gov-text-primary)]">
                                      {screenBuilderStatus?.artifactTargetSystem || "carbonet-general"}
                                    </p>
                                  </div>
                                  <div className="rounded border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                                      {en ? "Attach Package" : "연결 패키지"}
                                    </p>
                                    <p className="mt-1 font-mono text-[11px] text-[var(--kr-gov-text-primary)] break-all">
                                      {screenBuilderStatus?.runtimePackageId || "-"}
                                    </p>
                                  </div>
                                  <div className="rounded border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                                      {en ? "Install Trace" : "설치 추적"}
                                    </p>
                                    <p className="mt-1 font-mono text-[11px] text-[var(--kr-gov-text-primary)] break-all">
                                      {screenBuilderStatus?.deployTraceId || "-"}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
                                  <div className={`rounded border px-3 py-2 ${selectedPublishFreshnessClasses}`}>
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                                        {en ? "Validator Status" : "검증 상태"}
                                      </p>
                                      <span className="font-mono text-[10px] text-[var(--kr-gov-text-secondary)]">
                                        {screenBuilderStatus?.publishedSavedAt || "-"}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-[12px] font-bold text-[var(--kr-gov-text-primary)]">
                                      {screenBuilderStatus?.publishFreshnessLabel || (en ? "Not checked" : "미확인")}
                                    </p>
                                    <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">
                                      {screenBuilderStatus?.publishFreshnessDetail || (en ? "Validator summary is not available yet." : "검증 상태 요약이 아직 없습니다.")}
                                    </p>
                                  </div>
                                  <div className={`rounded border px-3 py-2 ${selectedParityClasses}`}>
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                                        {en ? "Repair Status" : "복구 상태"}
                                      </p>
                                      <span className="font-mono text-[10px] text-[var(--kr-gov-text-secondary)] break-all">
                                        {screenBuilderStatus?.parityTraceId || "-"}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-[12px] font-bold text-[var(--kr-gov-text-primary)]">
                                      {screenBuilderStatus?.parityLabel || (en ? "Not checked" : "미확인")}
                                    </p>
                                    <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">
                                      {screenBuilderStatus?.parityDetail || (en ? "Repair and compare summary is not available yet." : "복구 및 비교 요약이 아직 없습니다.")}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            {previousSameIssueMenu ? (
                              <div className="rounded border border-white bg-white/80 px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                                    {en ? "Previous queue item" : "이전 큐 항목"}
                                  </span>
                                  <span className="font-mono text-[11px] text-[var(--kr-gov-text-primary)]">
                                    {previousSameIssueMenu.code}
                                  </span>
                                  <span className="text-[11px] text-[var(--kr-gov-text-secondary)]">
                                    {previousSameIssueMenu.label}
                                  </span>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${previousSameIssueMenuIsPublished ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                    {previousSameIssueMenuIsPublished ? (en ? "Published" : "Publish") : (en ? "Draft" : "초안")}
                                  </span>
                                  <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                    {en ? `Issues ${previousSameIssueMenuIssueCount}` : `이슈 ${previousSameIssueMenuIssueCount}`}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <MemberLinkButton
                                    href={buildManagedBuilderHref(previousSameIssueMenu)}
                                    size="xs"
                                    variant="secondary"
                                  >
                                    {en ? "Previous Attach" : "이전 연결"}
                                  </MemberLinkButton>
                                  {previousSameIssueMenuIsPublished ? (
                                    <MemberLinkButton
                                      href={buildManagedRuntimeHref(previousSameIssueMenu)}
                                      size="xs"
                                      variant="secondary"
                                    >
                                      {en ? "Previous Validate" : "이전 검증"}
                                    </MemberLinkButton>
                                  ) : null}
                                  <MemberLinkButton
                                    href={buildManagedObservabilityHref(previousSameIssueMenu)}
                                    size="xs"
                                    variant="secondary"
                                  >
                                    {en ? "Previous Observe" : "이전 관측"}
                                  </MemberLinkButton>
                                </div>
                                <p className="mt-2 text-[11px] text-[var(--kr-gov-text-secondary)]">
                                  {en
                                    ? "Review the last blocked item in the same issue family before moving the current install queue."
                                    : "현재 설치 큐를 넘기기 전에 같은 이슈 계열의 직전 차단 항목을 검토합니다."}
                                </p>
                              </div>
                            ) : null}
                            {nextSameIssueMenu ? (
                              <div className="rounded border border-white bg-white/80 px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                                    {en ? "Next queue item" : "다음 큐 항목"}
                                  </span>
                                  <span className="font-mono text-[11px] text-[var(--kr-gov-text-primary)]">
                                    {nextSameIssueMenu.code}
                                  </span>
                                  <span className="text-[11px] text-[var(--kr-gov-text-secondary)]">
                                    {nextSameIssueMenu.label}
                                  </span>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${nextSameIssueMenuIsPublished ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                    {nextSameIssueMenuIsPublished ? (en ? "Published" : "Publish") : (en ? "Draft" : "초안")}
                                  </span>
                                  <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                    {en ? `Issues ${nextSameIssueMenuIssueCount}` : `이슈 ${nextSameIssueMenuIssueCount}`}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <MemberLinkButton
                                    href={buildManagedBuilderHref(nextSameIssueMenu)}
                                    size="xs"
                                    variant="secondary"
                                  >
                                    {en ? "Next Attach" : "다음 연결"}
                                  </MemberLinkButton>
                                  {nextSameIssueMenuIsPublished ? (
                                    <MemberLinkButton
                                      href={buildManagedRuntimeHref(nextSameIssueMenu)}
                                      size="xs"
                                      variant="secondary"
                                    >
                                      {en ? "Next Validate" : "다음 검증"}
                                    </MemberLinkButton>
                                  ) : null}
                                  <MemberLinkButton
                                    href={buildManagedObservabilityHref(nextSameIssueMenu)}
                                    size="xs"
                                    variant="secondary"
                                  >
                                    {en ? "Next Observe" : "다음 관측"}
                                  </MemberLinkButton>
                                </div>
                                <p className="mt-2 text-[11px] text-[var(--kr-gov-text-secondary)]">
                                  {en
                                    ? "Open the next blocked item in the same issue family and continue the attach or validate handoff."
                                    : "같은 이슈 계열의 다음 차단 항목을 열어 연결 또는 검증 핸드오프를 이어갑니다."}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {latestSelectedMenuBuilderAudit ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Latest Evidence Action" : "최신 증거 액션"}</p>
                          <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(latestSelectedMenuBuilderAudit, "actionCode") || "-"}</p>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Evidence Owner" : "증거 작업자"}</p>
                          <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(latestSelectedMenuBuilderAudit, "actorId") || "-"}</p>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Evidence Time" : "증거 시각"}</p>
                          <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(latestSelectedMenuBuilderAudit, "createdAt") || "-"}</p>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Recent Validator Evidence" : "최근 검증 증거 피드"}</p>
                        <span className="text-[11px] text-[var(--kr-gov-text-secondary)]">{selectedMenuBuilderAudits.length}{en ? " items" : "건"}</span>
                      </div>
                      {selectedMenuBuilderAudits.length ? (
                        <div className="mt-3 space-y-2">
                          {selectedMenuBuilderAudits.map((row, index) => (
                            <div className="rounded border border-slate-100 bg-slate-50 px-3 py-2" key={`selected-builder-audit-${index}`}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "actionCode") || "-"}</p>
                                <span className="text-[11px] text-[var(--kr-gov-text-secondary)]">{stringOf(row, "createdAt") || "-"}</span>
                              </div>
                              <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">
                                {en ? "Actor" : "작업자"}: {stringOf(row, "actorId") || "-"} / {en ? "Result" : "결과"}: {stringOf(row, "resultStatus") || "-"}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-[12px] text-[var(--kr-gov-text-secondary)]">
                          {en ? "No recent validator evidence was found for this menu." : "이 메뉴에 대한 최근 검증 증거 이력이 없습니다."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="gov-label" htmlFor="selectedMenuName">{en ? "Menu Name" : "메뉴명"}</label>
                    <input className="gov-input" id="selectedMenuName" value={selectedMenuDraft.codeNm} onChange={(event) => setSelectedMenuDraft((current) => ({ ...current, codeNm: event.target.value }))} />
                  </div>
                  <div>
                    <label className="gov-label" htmlFor="selectedMenuNameEn">{en ? "Menu Name (EN)" : "영문 메뉴명"}</label>
                    <input className="gov-input" id="selectedMenuNameEn" value={selectedMenuDraft.codeDc} onChange={(event) => setSelectedMenuDraft((current) => ({ ...current, codeDc: event.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="gov-label" htmlFor="selectedMenuUrl">{en ? "Runtime URL" : "연결 URL"}</label>
                    <input className="gov-input" id="selectedMenuUrl" value={selectedMenuDraft.menuUrl} onChange={(event) => setSelectedMenuDraft((current) => ({ ...current, menuUrl: event.target.value }))} />
                    <p className={`mt-2 text-xs ${selectedUrlValidation.tone === "success" ? "text-emerald-700" : "text-amber-700"}`}>{selectedUrlValidation.message}</p>
                  </div>
                  <div>
                    <label className="gov-label" htmlFor="selectedMenuIcon">{en ? "Icon" : "아이콘"}</label>
                    <select className="gov-select" id="selectedMenuIcon" value={selectedMenuDraft.menuIcon} onChange={(event) => setSelectedMenuDraft((current) => ({ ...current, menuIcon: event.target.value }))}>
                      {iconOptions.map((icon) => (
                        <option key={icon} value={icon}>{icon}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="gov-label" htmlFor="selectedMenuUseAt">{en ? "Use" : "사용 여부"}</label>
                    <select className="gov-select" id="selectedMenuUseAt" value={selectedMenuDraft.useAt} onChange={(event) => setSelectedMenuDraft((current) => ({ ...current, useAt: event.target.value }))}>
                      {useAtOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Change Diff" : "변경 Diff"}</p>
                  {selectedMenuDiff.length === 0 ? (
                    <p className="mt-2 text-sm text-emerald-700">{en ? "No pending menu changes." : "저장 전 메뉴 변경 사항이 없습니다."}</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedMenuDiff.map((item) => (
                        <span className="inline-flex rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] text-[var(--kr-gov-text-primary)]" key={item}>{item}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <MemberPermissionButton allowed={environmentAuthority.allowsAction("update")} disabled={menuSaving || selectedUrlValidation.tone !== "success"} onClick={() => { void handleSelectedMenuSave(); }} reason={environmentAuthority.getActionReason("update", en)} type="button" variant="primary">
                    {menuSaving ? (en ? "Saving..." : "저장 중...") : (en ? "Save Menu Changes" : "메뉴 변경 저장")}
                  </MemberPermissionButton>
                </div>
                {selectedMenuIsPage ? (
                  <div className="rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.08em] text-red-700">{en ? "Delete Page Menu" : "페이지 메뉴 삭제"}</p>
                        <p className="mt-2 text-sm leading-6 text-red-900">
                          {en
                            ? "Review feature dependencies and VIEW permission cleanup impact before deleting the selected page menu."
                            : "선택한 페이지 메뉴를 삭제하기 전에 연결 기능과 기본 VIEW 권한 정리 영향을 먼저 확인합니다."}
                        </p>
                      </div>
                      <MemberPermissionButton allowed={environmentAuthority.allowsAction("delete")} disabled={pageDeleteImpactLoading || pageDeleting} onClick={() => { void preparePageDelete(); }} reason={environmentAuthority.getActionReason("delete", en)} type="button" variant="danger">
                        {pageDeleteImpactLoading ? (en ? "Checking..." : "확인 중...") : (en ? "Review Delete Impact" : "삭제 영향 확인")}
                      </MemberPermissionButton>
                    </div>
                    {pendingPageDeleteImpact ? (
                      <div className="mt-4 space-y-3 rounded-[var(--kr-gov-radius)] border border-white/80 bg-white/70 px-4 py-4 text-sm">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Default VIEW" : "기본 VIEW"}</p>
                            <p className="mt-1 font-mono text-[13px] text-[var(--kr-gov-text-primary)]">{pendingPageDeleteImpact.defaultViewFeatureCode}</p>
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Cleanup Impact" : "정리 영향"}</p>
                            <p className="mt-1 text-[var(--kr-gov-text-primary)]">
                              {en
                                ? `Role mappings ${pendingPageDeleteImpact.defaultViewRoleRefCount}, user overrides ${pendingPageDeleteImpact.defaultViewUserOverrideCount}`
                                : `권한그룹 매핑 ${pendingPageDeleteImpact.defaultViewRoleRefCount}건, 사용자 예외권한 ${pendingPageDeleteImpact.defaultViewUserOverrideCount}건`}
                            </p>
                          </div>
                        </div>
                        {pendingPageDeleteImpact.nonDefaultFeatureCodes.length > 0 ? (
                          <div className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                            <p className="font-bold">{en ? "Delete blocked" : "삭제 차단"}</p>
                            <p className="mt-2">
                              {en
                                ? "Delete the page-specific action features first. Remaining features:"
                                : "페이지 전용 액션 기능을 먼저 삭제해 주세요. 남아 있는 기능:"}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {pendingPageDeleteImpact.nonDefaultFeatureCodes.map((featureCode) => (
                                <button
                                  key={featureCode}
                                  className="inline-flex rounded-full border border-amber-300 bg-white px-3 py-1 text-[12px] font-mono text-amber-900"
                                  onClick={() => {
                                    setEditingFeatureCode(featureCode);
                                    scrollToSection("environment-feature-management");
                                  }}
                                  type="button"
                                >
                                  {featureCode}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
                            {en
                              ? "No page-specific action features remain. You can delete this page menu."
                              : "남아 있는 페이지 전용 액션 기능이 없습니다. 이 페이지 메뉴를 삭제할 수 있습니다."}
                          </div>
                        )}
                        <div className="flex flex-wrap justify-end gap-2">
                          <button className="gov-btn gov-btn-outline-blue" onClick={() => setPendingPageDeleteImpact(null)} type="button">
                            {en ? "Close" : "닫기"}
                          </button>
                          <MemberPermissionButton allowed={environmentAuthority.allowsAction("delete")} disabled={pageDeleting || pendingPageDeleteImpact.blocked} onClick={() => { void confirmPageDelete(); }} reason={environmentAuthority.getActionReason("delete", en)} type="button" variant="danger">
                            {pageDeleting ? (en ? "Deleting..." : "삭제 중...") : (en ? "Delete Page Menu" : "페이지 메뉴 삭제")}
                          </MemberPermissionButton>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {selectedMenuIsPage ? (
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">history</span>
                      <p className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Recent Changes" : "최근 변경 이력"}</p>
                    </div>
                    {menuAuditLoading ? (
                      <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Loading recent audit events..." : "최근 감사 이력을 불러오는 중입니다..."}</p>
                    ) : menuAuditRows.length === 0 ? (
                      <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No recent audit events for this menu." : "이 메뉴의 최근 감사 이력이 없습니다."}</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {menuAuditRows.map((row, index) => (
                          <div key={`${stringOf(row, "auditId") || "audit"}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "actionCode") || "-"}</p>
                              <span className="text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "createdAt") || "-"}</span>
                            </div>
                            <p className="mt-1 text-[var(--kr-gov-text-secondary)]">{en ? "Actor" : "작업자"}: {stringOf(row, "actorId") || "-"}</p>
                            <p className="mt-1 text-[var(--kr-gov-text-secondary)]">{en ? "Result" : "결과"}: {stringOf(row, "resultStatus") || "-"}</p>
                            {stringOf(row, "reasonSummary") ? <p className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "reasonSummary")}</p> : null}
                            <p className="mt-2 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] font-bold text-[var(--kr-gov-blue)]">
                              {summarizeMenuAuditDiff(row, en)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Select a menu to continue." : "작업할 메뉴를 먼저 선택하세요."}</p>
            )}
          </section>

          <section className="gov-card" id="environment-feature-management">
            <GridToolbar title={en ? "Authority / Feature Binding" : "권한 / 기능 바인딩"} />
            <p className="mb-4 text-sm text-[var(--kr-gov-text-secondary)]">
              {en
                ? "Keep authority and feature bindings aligned with the selected page before install. This section should stay focused on binding, not generic feature sprawl."
                : "설치 전에 선택 페이지의 권한과 기능 바인딩을 맞춥니다. 이 구역은 일반 기능 나열이 아니라 바인딩 정합성에 집중해야 합니다."}
            </p>
            {selectedMenu && selectedMenuIsPage ? (
              <>
                <form action={buildFeatureManagementCreatePath()} className="grid gap-4" method="post" onSubmit={handleFeatureSubmit}>
                  <input name="menuType" type="hidden" value={menuType} />
                  <input name="menuCode" type="hidden" value={selectedMenu.code} />
                  <div>
                    <label className="gov-label" htmlFor="featureCode">{en ? "Feature Code" : "기능 코드"}</label>
                    <input className="gov-input" id="featureCode" name="featureCode" placeholder={`${selectedMenu.code}_CREATE`} value={featureDraft.featureCode} onChange={(event) => setFeatureDraft((current) => ({ ...current, featureCode: event.target.value.toUpperCase() }))} />
                  </div>
                  <div>
                    <label className="gov-label" htmlFor="featureNm">{en ? "Feature Name" : "기능명"}</label>
                    <input className="gov-input" id="featureNm" name="featureNm" value={featureDraft.featureNm} onChange={(event) => setFeatureDraft((current) => ({ ...current, featureNm: event.target.value }))} />
                  </div>
                  <div>
                    <label className="gov-label" htmlFor="featureNmEn">{en ? "Feature Name (EN)" : "영문 기능명"}</label>
                    <input className="gov-input" id="featureNmEn" name="featureNmEn" value={featureDraft.featureNmEn} onChange={(event) => setFeatureDraft((current) => ({ ...current, featureNmEn: event.target.value }))} />
                  </div>
                  <div>
                    <label className="gov-label" htmlFor="featureDc">{en ? "Description" : "설명"}</label>
                    <input className="gov-input" id="featureDc" name="featureDc" value={featureDraft.featureDc} onChange={(event) => setFeatureDraft((current) => ({ ...current, featureDc: event.target.value }))} />
                  </div>
                  <div>
                    <label className="gov-label" htmlFor="featureUseAt">{en ? "Use" : "사용 여부"}</label>
                    <select className="gov-select" id="featureUseAt" name="useAt" value={featureDraft.useAt} onChange={(event) => setFeatureDraft((current) => ({ ...current, useAt: event.target.value }))}>
                      {((featurePage?.useAtOptions || ["Y", "N"]) as string[]).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <MemberPermissionButton allowed={environmentAuthority.allowsAction("create")} reason={environmentAuthority.getActionReason("create", en)} type="submit" variant="primary">
                      {en ? "Add Feature" : "기능 추가"}
                    </MemberPermissionButton>
                  </div>
                </form>

                {pendingDeleteImpact ? (
                  <div className="mt-5 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                    <p className="font-bold">
                      {en ? "Delete Impact Review" : "삭제 영향 검토"}: {pendingDeleteImpact.featureCode}
                    </p>
                    <p className="mt-2">
                      {en
                        ? `Role mappings ${pendingDeleteImpact.assignedRoleCount}, user overrides ${pendingDeleteImpact.userOverrideCount} will be removed together.`
                        : `권한그룹 매핑 ${pendingDeleteImpact.assignedRoleCount}건, 사용자 예외권한 ${pendingDeleteImpact.userOverrideCount}건이 함께 삭제됩니다.`}
                    </p>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <a className="gov-btn gov-btn-outline-blue" href={buildLocalizedPath("/admin/auth/group", "/en/admin/auth/group")}>
                        {en ? "Review In Permission Groups" : "권한 그룹에서 검토"}
                      </a>
                      <button className="gov-btn gov-btn-outline-blue" onClick={() => { setPendingDeleteImpact(null); setDeleteImpactFeatureCode(""); }} type="button">
                        {en ? "Cancel" : "취소"}
                      </button>
                      <MemberPermissionButton allowed={environmentAuthority.allowsAction("delete")} disabled={featureDeleting} onClick={() => { void confirmFeatureDelete(); }} reason={environmentAuthority.getActionReason("delete", en)} type="button" variant="danger">
                        {featureDeleting ? (en ? "Deleting..." : "삭제 중...") : (en ? "Confirm Delete" : "영향 확인 후 삭제")}
                      </MemberPermissionButton>
                    </div>
                  </div>
                ) : null}

                {editingFeatureCode ? (
                  <div className="mt-5 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Editing Feature" : "수정 중 기능"}</p>
                        <p className="mt-1 font-mono text-sm text-[var(--kr-gov-text-primary)]">{editingFeatureDraft.featureCode}</p>
                      </div>
                      <button className="gov-btn gov-btn-outline-blue" onClick={() => setEditingFeatureCode("")} type="button">
                        {en ? "Close" : "닫기"}
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="gov-label" htmlFor="editingFeatureNm">{en ? "Feature Name" : "기능명"}</label>
                        <input className="gov-input" id="editingFeatureNm" value={editingFeatureDraft.featureNm} onChange={(event) => setEditingFeatureDraft((current) => ({ ...current, featureNm: event.target.value }))} />
                      </div>
                      <div>
                        <label className="gov-label" htmlFor="editingFeatureNmEn">{en ? "Feature Name (EN)" : "영문 기능명"}</label>
                        <input className="gov-input" id="editingFeatureNmEn" value={editingFeatureDraft.featureNmEn} onChange={(event) => setEditingFeatureDraft((current) => ({ ...current, featureNmEn: event.target.value }))} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="gov-label" htmlFor="editingFeatureDc">{en ? "Description" : "설명"}</label>
                        <input className="gov-input" id="editingFeatureDc" value={editingFeatureDraft.featureDc} onChange={(event) => setEditingFeatureDraft((current) => ({ ...current, featureDc: event.target.value }))} />
                      </div>
                      <div>
                        <label className="gov-label" htmlFor="editingFeatureUseAt">{en ? "Use" : "사용 여부"}</label>
                        <select className="gov-select" id="editingFeatureUseAt" value={editingFeatureDraft.useAt} onChange={(event) => setEditingFeatureDraft((current) => ({ ...current, useAt: event.target.value }))}>
                          {((featurePage?.useAtOptions || ["Y", "N"]) as string[]).map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <MemberPermissionButton allowed={environmentAuthority.allowsAction("update")} disabled={featureSaving} onClick={() => { void handleFeatureUpdate(); }} reason={environmentAuthority.getActionReason("update", en)} type="button" variant="primary">
                        {featureSaving ? (en ? "Saving..." : "저장 중...") : (en ? "Save Feature Changes" : "기능 변경 저장")}
                      </MemberPermissionButton>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_12rem]">
                  <div>
                    <label className="gov-label" htmlFor="featureSearch">{en ? "Feature Search" : "기능 검색"}</label>
                    <input
                      className="gov-input"
                      id="featureSearch"
                      placeholder={en ? "Feature code, name, or description" : "기능 코드, 이름, 설명"}
                      value={featureSearch}
                      onChange={(event) => setFeatureSearch(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="gov-label" htmlFor="featureLinkFilter">{en ? "Link Status" : "연계 상태"}</label>
                    <select
                      className="gov-select"
                      id="featureLinkFilter"
                      value={featureLinkFilter}
                      onChange={(event) => setFeatureLinkFilter(event.target.value as "ALL" | "UNASSIGNED" | "LINKED")}
                    >
                      <option value="ALL">{en ? "All" : "전체"}</option>
                      <option value="UNASSIGNED">{en ? "Unassigned" : "미할당"}</option>
                      <option value="LINKED">{en ? "Linked" : "연결됨"}</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="gov-table-header">
                        <th className="px-4 py-3">{en ? "Feature Code" : "기능 코드"}</th>
                        <th className="px-4 py-3">{en ? "Feature Name" : "기능명"}</th>
                        <th className="px-4 py-3">{en ? "Description" : "설명"}</th>
                        <th className="px-4 py-3 text-center">{en ? "Authority" : "권한 연계"}</th>
                        <th className="px-4 py-3 text-center">{en ? "Manage" : "관리"}</th>
                        <th className="px-4 py-3 text-center">{en ? "Delete" : "삭제"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredFeatureRows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-gray-500" colSpan={6}>
                            {featureRows.length === 0
                              ? (en ? "No additional features have been registered yet." : "추가 등록된 기능이 아직 없습니다.")
                              : (en ? "No features matched the current filter." : "현재 필터 조건에 맞는 기능이 없습니다.")}
                          </td>
                        </tr>
                      ) : filteredFeatureRows.map((row) => {
                        const featureCode = stringOf(row, "featureCode");
                        const unassigned = Boolean(row.unassignedToRole);
                        return (
                          <tr key={featureCode}>
                            <td className="px-4 py-3 font-bold whitespace-nowrap">{featureCode}</td>
                            <td className="px-4 py-3">{stringOf(row, "featureNm")}</td>
                            <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "featureDc")}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${unassigned ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                                {unassigned ? (en ? "Unassigned" : "미할당") : `${en ? "Roles" : "Role"} ${numberOf(row, "assignedRoleCount")}`}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button className={editingFeatureCode === featureCode ? "gov-btn gov-btn-primary" : "gov-btn gov-btn-outline-blue"} onClick={() => setEditingFeatureCode(featureCode)} type="button">
                                {editingFeatureCode === featureCode ? (en ? "Editing" : "수정 중") : (en ? "Edit" : "수정")}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <MemberPermissionButton allowed={environmentAuthority.allowsAction("delete")} disabled={deleteImpactLoading && deleteImpactFeatureCode === featureCode} onClick={() => { void prepareFeatureDelete(featureCode); }} reason={environmentAuthority.getActionReason("delete", en)} type="button" variant="danger">
                                {deleteImpactLoading && deleteImpactFeatureCode === featureCode ? (en ? "Checking..." : "확인 중...") : (en ? "Delete" : "삭제")}
                              </MemberPermissionButton>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : selectedMenu ? (
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Only 8-digit page menus can own feature codes." : "기능 코드는 8자리 페이지 메뉴에서만 관리할 수 있습니다."}</p>
            ) : (
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "After selecting a menu, you can add and delete page-specific feature codes here." : "메뉴를 선택하면 여기서 페이지 전용 기능 코드를 추가하고 삭제할 수 있습니다."}</p>
            )}
          </section>

          <section className="gov-card" id="environment-metadata">
            <div className="flex items-center justify-between gap-3 border-b pb-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">dataset</span>
                <h3 className="text-lg font-bold">{en ? "Validator / Metadata Result" : "검증 / 메타데이터 결과"}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="gov-btn gov-btn-outline-blue"
                  disabled={!selectedMenuIsPage && !governanceOverview.pageId}
                  onClick={() => setMetadataExpanded((current) => !current)}
                  type="button"
                >
                  {metadataExpanded ? (en ? "Collapse" : "접기") : (en ? "Expand" : "펼치기")}
                </button>
                <button
                  className="gov-btn gov-btn-primary"
                  disabled={!selectedMenuIsPage || collecting || governanceLoading}
                  onClick={() => { void handleAutoCollect(); }}
                  type="button"
                >
                  {collecting ? (en ? "Collecting..." : "수집 중...") : (en ? "Auto Collect" : "자동 수집")}
                </button>
              </div>
            </div>
            <p className="mb-4 text-sm text-[var(--kr-gov-text-secondary)]">
              {en
                ? "Treat this section as the validator-result console. Collected metadata matters only if it explains install readiness, blocking issues, and rollback-safe evidence."
                : "이 구역은 validator-result 콘솔로 봐야 합니다. 수집 메타데이터는 설치 준비도, 차단 이슈, 롤백 가능한 증거를 설명할 때만 의미가 있습니다."}
            </p>

            {governanceMessage ? (
              <PageStatusNotice tone="success">
                {governanceMessage}
              </PageStatusNotice>
            ) : null}
            {lastAutoCollectAt && (postCollectAuditRows.length > 0 || postCollectTraceRows.length > 0) ? (
              <CollectionResultPanel
                description={en ? "Collected metadata and linked the newest observability records." : "메타데이터 수집 직후 연결된 최신 observability 기록입니다."}
                title={en ? "Latest Validator Evidence" : "최근 검증 증거"}
              >
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Audit</p>
                    {postCollectAuditRows.length === 0 ? (
                      <p className="mt-2 text-[var(--kr-gov-text-secondary)]">{en ? "No audit event was found yet." : "아직 연결된 감사 이력이 없습니다."}</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {postCollectAuditRows.map((row, index) => (
                          <div className="rounded-[var(--kr-gov-radius)] border border-slate-100 bg-slate-50 px-3 py-2" key={`${stringOf(row, "auditId") || "audit"}-${index}`}>
                            <p className="font-bold">{stringOf(row, "actionCode") || "-"}</p>
                            <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">{stringOf(row, "createdAt") || "-"}</p>
                            <p className="mt-1 text-[12px] text-[var(--kr-gov-blue)]">{summarizeMenuAuditDiff(row, en)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Trace</p>
                    {postCollectTraceRows.length === 0 ? (
                      <p className="mt-2 text-[var(--kr-gov-text-secondary)]">{en ? "No trace event was found yet." : "아직 연결된 trace 이벤트가 없습니다."}</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {postCollectTraceRows.map((row, index) => (
                          <div className="rounded-[var(--kr-gov-radius)] border border-slate-100 bg-slate-50 px-3 py-2" key={`${stringOf(row, "traceId") || "trace"}-${index}`}>
                            <p className="font-bold">{stringOf(row, "eventType") || stringOf(row, "functionId") || "-"}</p>
                            <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">
                              {[stringOf(row, "pageId"), stringOf(row, "apiId"), stringOf(row, "resultCode")].filter(Boolean).join(" / ") || "-"}
                            </p>
                            <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">{stringOf(row, "createdAt") || stringOf(row, "occurredAt") || "-"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CollectionResultPanel>
            ) : null}
            {governanceError ? (
              <PageStatusNotice tone="warning">
                {governanceError}
              </PageStatusNotice>
            ) : null}

            <div className="mb-4 grid gap-3 xl:grid-cols-3">
              <div className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 ${selectedMenuPublishReady ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                  {en ? "Install Gate" : "설치 게이트"}
                </p>
                <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">
                  {selectedMenuPublishReady ? (en ? "Ready for validator handoff" : "검증 단계로 이동 가능") : (en ? "Blocked before install" : "설치 전 차단 상태")}
                </p>
                <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">
                  {summarizeBuilderBlockingReason(selectedMenuBuilderIssueCount, en)}
                </p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                  {en ? "Remediation Queue" : "리메디에이션 큐"}
                </p>
                <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">
                  {en ? `${governanceRemediationItems.length} open actions` : `열린 액션 ${governanceRemediationItems.length}건`}
                </p>
                <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">
                  {governanceRemediationItems.length > 0
                    ? (en ? "Resolve the highest-priority remediation before package install." : "패키지 설치 전에 우선순위가 가장 높은 remediation을 해결하세요.")
                    : (en ? "No remediation item is blocking right now." : "현재 차단 중인 remediation 항목이 없습니다.")}
                </p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                  {en ? "Validator Evidence" : "검증 증거"}
                </p>
                <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">
                  {en ? `Audit ${postCollectAuditRows.length} / Trace ${postCollectTraceRows.length}` : `Audit ${postCollectAuditRows.length} / Trace ${postCollectTraceRows.length}`}
                </p>
                <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">
                  {en ? "Install, validate, and rollback should all use these records as governed evidence." : "설치, 검증, 롤백 모두 이 기록들을 거버넌스 증거로 사용해야 합니다."}
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Governed Install Flow" : "Governed 설치 흐름"}</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedMenu && selectedMenuIsPage ? (
                    <MemberLinkButton href={buildScreenBuilderPath(selectedInstallFlowQuery)} size="xs" variant="secondary">
                      {en ? "Draft Builder" : "초안 빌더"}
                    </MemberLinkButton>
                  ) : null}
                  {selectedMenu && selectedMenuIsPage && selectedBuilderStatus?.publishedVersionId ? (
                    <MemberLinkButton href={buildCurrentRuntimeComparePath(selectedInstallFlowQuery)} size="xs" variant="secondary">
                      {en ? "Install Compare" : "설치 Compare"}
                    </MemberLinkButton>
                  ) : null}
                  {selectedMenu && selectedMenuIsPage && selectedBuilderStatus?.publishedVersionId ? (
                    <MemberLinkButton href={buildRepairWorkbenchPath(selectedInstallFlowQuery)} size="xs" variant="secondary">
                      {en ? "Install Repair" : "설치 Repair"}
                    </MemberLinkButton>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                {selectedInstallFlowSteps.map((step) => (
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={step.key}>
                    <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{step.title}</p>
                    <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${step.tone}`}>{step.state}</p>
                    <p className="mt-2 text-[12px] text-[var(--kr-gov-text-primary)] break-all">{step.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Current Install Queue Item" : "현재 설치 큐 항목"}</h4>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${selectedInstallQueueSummary.publishReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {selectedInstallQueueSummary.publishReady ? (en ? "READY_FOR_PACKAGE" : "패키지 가능") : (en ? "BLOCKED" : "차단")}
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">menuCode / pageId</p>
                  <p className="mt-1 font-mono text-[var(--kr-gov-text-primary)]">{selectedInstallQueueSummary.menuCode} / {selectedInstallQueueSummary.pageId}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Install Target" : "설치 타깃"}</p>
                  <p className="mt-1 font-mono text-[var(--kr-gov-text-primary)] break-all">{selectedInstallQueueSummary.menuUrl}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">releaseUnit / package</p>
                  <p className="mt-1 font-mono text-[var(--kr-gov-text-primary)]">{selectedInstallQueueSummary.releaseUnitId} / {selectedInstallQueueSummary.runtimePackageId}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Validator Gate" : "검증 게이트"}</p>
                  <p className="mt-1 font-mono text-[var(--kr-gov-text-primary)]">{selectedInstallQueueSummary.validatorPassCount} / {selectedInstallQueueSummary.validatorTotalCount}</p>
                </div>
              </div>
              <p className="mt-3 text-[12px] text-[var(--kr-gov-text-secondary)]">
                {en
                  ? `Issues ${selectedInstallQueueSummary.issueCount}. Deploy trace ${selectedInstallQueueSummary.deployTraceId}.`
                  : `이슈 ${selectedInstallQueueSummary.issueCount}건. 배포 추적 ${selectedInstallQueueSummary.deployTraceId}.`}
              </p>
            </div>

            <div className="mb-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Install Manifest Binding Status" : "설치 Manifest 바인딩 상태"}</h4>
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-[var(--kr-gov-text-secondary)]">{installManifestReadyCount} / {BUILDER_INSTALL_REQUIRED_BINDINGS.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {installManifestBindingStatuses.map((item) => (
                    <div className="flex items-start justify-between gap-3 text-sm" key={item.key}>
                      <div>
                        <p className="font-bold text-[var(--kr-gov-text-primary)]">{describeBuilderInstallBinding(item.key, en)}</p>
                        <p className="text-[12px] text-[var(--kr-gov-text-secondary)]">{item.detail}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${item.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {item.ready ? (en ? "READY" : "준비") : (en ? "PENDING" : "대기")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Bootstrap Validator Checks" : "부트스트랩 검증 체크"}</h4>
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-[var(--kr-gov-text-secondary)]">{installValidatorPassCount} / {BUILDER_INSTALL_VALIDATOR_CHECKS.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {installValidatorStatuses.map((item) => (
                    <div className="flex items-start justify-between gap-3 text-sm" key={item.key}>
                      <div>
                        <p className="font-bold text-[var(--kr-gov-text-primary)]">{describeBuilderValidatorCheck(item.key, en)}</p>
                        <p className="text-[12px] text-[var(--kr-gov-text-secondary)]">{item.detail}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${item.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {item.ready ? (en ? "PASS" : "통과") : (en ? "WAIT" : "대기")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <SummaryMetricCard
                accentClassName="text-[var(--kr-gov-text-secondary)] text-xs uppercase tracking-[0.08em]"
                className="border-slate-200"
                surfaceClassName="bg-slate-50"
                title="Page"
                value={<span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{governanceOverview.pageId || "-"}</span>}
              />
              <SummaryMetricCard
                accentClassName="text-[var(--kr-gov-text-secondary)] text-xs uppercase tracking-[0.08em]"
                className="border-slate-200"
                surfaceClassName="bg-slate-50"
                title={en ? "Events / APIs" : "이벤트 / API"}
                value={<span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{governanceOverview.eventIds.length} / {governanceOverview.apiIds.length}</span>}
              />
              <SummaryMetricCard
                accentClassName="text-[var(--kr-gov-text-secondary)] text-xs uppercase tracking-[0.08em]"
                className="border-slate-200"
                surfaceClassName="bg-slate-50"
                title={en ? "DB Assets" : "DB 자원"}
                value={<span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{governanceOverview.tableNames.length} / {governanceOverview.columnNames.length}</span>}
              />
              <SummaryMetricCard
                accentClassName="text-[var(--kr-gov-text-secondary)] text-xs uppercase tracking-[0.08em]"
                className="border-slate-200"
                surfaceClassName="bg-slate-50"
                title={en ? "Feature Codes" : "기능 코드"}
                value={<span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{governanceOverview.featureCodes.length}</span>}
              />
            </div>
            {selectedMenu && selectedMenuIsPage ? (
              <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <BinaryStatusCard
                  healthy={Boolean(governanceOverview.pageId)}
                  healthyLabel={en ? "Linked" : "연결됨"}
                  title={en ? "Registry" : "레지스트리"}
                  unhealthyLabel={en ? "Missing" : "누락"}
                />
                <BinaryStatusCard
                  healthy={!featureRows.some((row) => Boolean(row.unassignedToRole))}
                  healthyLabel={en ? "Aligned" : "정상"}
                  title={en ? "Permissions" : "권한"}
                  unhealthyLabel={en ? "Review required" : "검토 필요"}
                />
                <BinaryStatusCard
                  healthy={governanceOverview.apiIds.length > 0}
                  healthyLabel={en ? "Collected" : "수집됨"}
                  title="API"
                  unhealthyLabel={en ? "Not collected" : "미수집"}
                />
                <BinaryStatusCard
                  healthy={governanceOverview.tableNames.length > 0}
                  healthyLabel={en ? "Collected" : "수집됨"}
                  title="DB"
                  unhealthyLabel={en ? "Not collected" : "미수집"}
                />
              </div>
            ) : null}
            {governanceWarnings.length > 0 ? (
              <WarningPanel
                actions={
                  <>
                    <a className="gov-btn gov-btn-outline-blue" href={buildFullStackManagementPath()}>
                      {en ? "Open Full-Stack Management" : "풀스택 관리 바로가기"}
                    </a>
                    <a className="gov-btn gov-btn-outline-blue" href={buildPlatformStudioPath()}>
                      {en ? "Open Platform Studio" : "플랫폼 스튜디오 바로가기"}
                    </a>
                  </>
                }
                title={en ? "Operational warnings" : "운영 경고"}
              >
                <ul className="space-y-1">
                  {governanceWarnings.map((warning) => (
                    <li key={warning}>- {warning}</li>
                  ))}
                </ul>
                {governanceRemediationItems.length > 0 ? (
                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    {governanceRemediationItems.map((item) => (
                      <article className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-4 text-[13px] text-[var(--kr-gov-text-secondary)]" key={`${item.title}-${item.href || item.actionKind}`}>
                        <p className="font-bold text-[var(--kr-gov-text-primary)]">{item.title}</p>
                        <p className="mt-2 leading-6">{item.description}</p>
                        <button
                          className="mt-3 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[var(--kr-gov-blue)]"
                          onClick={() => runGovernanceAction(item)}
                          type="button"
                        >
                          {item.actionLabel}
                        </button>
                      </article>
                    ))}
                  </div>
                ) : null}
              </WarningPanel>
            ) : null}

            {!selectedMenu ? (
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Select a menu to inspect connected page metadata." : "연결된 페이지 메타데이터를 보려면 메뉴를 먼저 선택하세요."}</p>
            ) : !selectedMenuIsPage ? (
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Only 8-digit page menus can display collected metadata." : "수집 메타데이터는 8자리 페이지 메뉴에서만 표시됩니다."}</p>
            ) : !metadataExpanded ? (
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Detailed metadata is folded by default so the daily menu and feature workflow stays visible. Expand this area when you need the full governance chain."
                  : "일상적인 메뉴/기능 작업이 먼저 보이도록 상세 메타데이터는 기본 접힘 상태입니다. 전체 거버넌스 체인이 필요할 때 펼쳐서 확인하세요."}
              </div>
            ) : governanceDraftOnly ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Page ID</p>
                    <p className="mt-2 font-mono text-sm text-[var(--kr-gov-text-primary)]">{governanceOverview.pageId || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Source</p>
                    <p className="mt-2 font-mono text-sm text-[var(--kr-gov-text-primary)]">{governanceOverview.source || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">URL</p>
                    <p className="mt-2 font-mono text-sm break-all text-[var(--kr-gov-text-primary)]">{selectedMenu.menuUrl || "-"}</p>
                  </div>
                </div>

                <div className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  {en
                    ? "This menu is connected through a draft registry entry only. Detailed components, events, APIs, and schema metadata will appear after the page implementation or an explicit registry save."
                    : "이 메뉴는 현재 draft registry로만 연결된 상태입니다. 상세 컴포넌트, 이벤트, API, 스키마 메타데이터는 실제 페이지 구현 또는 명시적 registry 저장 이후에 표시됩니다."}
                </div>
              </div>
            ) : (
              <div className="min-w-0 space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Page ID</p>
                    <p className="mt-2 font-mono text-sm text-[var(--kr-gov-text-primary)]">{governanceOverview.pageId || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Source</p>
                    <p className="mt-2 font-mono text-sm text-[var(--kr-gov-text-primary)]">{governanceOverview.source || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">URL</p>
                    <p className="mt-2 font-mono text-sm break-all text-[var(--kr-gov-text-primary)]">{selectedMenu.menuUrl || "-"}</p>
                  </div>
                </div>

                <div>
                  <p className="gov-label mb-2">{en ? "Install Blocker Summary" : "설치 차단 요약"}</p>
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-[var(--kr-gov-text-primary)]">
                    {governanceOverview.summary || (en ? "No summary collected yet." : "아직 수집된 요약이 없습니다.")}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                  <div className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 ${selectedMenuPublishReady ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                      {en ? "Primary Install Blocker" : "주요 설치 차단"}
                    </p>
                    <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">
                      {selectedMenuPublishReady
                        ? (en ? "No primary blocker is open." : "주요 차단 이슈가 없습니다.")
                        : summarizeBuilderBlockingReason(selectedMenuBuilderIssueCount, en)}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">
                      {selectedIssueReason
                        ? (en ? `Current queue is focused on ${describeScreenBuilderIssueReason(selectedIssueReason, en)} issues.` : `현재 큐는 ${describeScreenBuilderIssueReason(selectedIssueReason, en)} 이슈 중심으로 정렬돼 있습니다.`)
                        : (en ? "Current menu does not expose a single issue family yet." : "현재 메뉴는 단일 이슈 계열로 좁혀지지 않았습니다.")}
                    </p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                      {en ? "Validator Evidence Coverage" : "검증 증거 커버리지"}
                    </p>
                    <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">
                      {en ? `Audit ${postCollectAuditRows.length} / Trace ${postCollectTraceRows.length}` : `Audit ${postCollectAuditRows.length} / Trace ${postCollectTraceRows.length}`}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">
                      {en
                        ? "Use the latest audit and trace bundle before handing off install validation."
                        : "설치 검증 핸드오프 전에 최신 audit/trace 묶음을 확보해야 합니다."}
                    </p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                      {en ? "Rollback Evidence Anchor" : "롤백 증거 앵커"}
                    </p>
                    <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">
                      {latestSelectedMenuBuilderAudit ? (stringOf(latestSelectedMenuBuilderAudit, "actionCode") || "-") : (en ? "No recent action" : "최근 액션 없음")}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">
                      {latestSelectedMenuBuilderAudit
                        ? `${stringOf(latestSelectedMenuBuilderAudit, "actorId") || "-"} / ${stringOf(latestSelectedMenuBuilderAudit, "createdAt") || "-"}`
                        : (en ? "Capture a governed builder action before rollback packaging." : "롤백 패키징 전에 거버넌스 빌더 액션을 남겨야 합니다.")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <KeyValueGridPanel
                    description={governanceOverview.summary || "-"}
                    items={[
                      { label: "Menu Code", value: selectedMenu.code || "-" },
                      { label: "Menu URL", value: selectedMenu.menuUrl || "-" },
                      { label: "Page ID", value: governancePage?.page?.manifestRegistry?.pageId || governanceOverview.pageId || "-" },
                      { label: "Layout", value: String(governancePage?.page?.manifestRegistry?.layoutVersion || "-") },
                      { label: "Design Token", value: String(governancePage?.page?.manifestRegistry?.designTokenVersion || "-") },
                      { label: "VIEW Feature", value: String(governancePage?.page?.menuPermission?.requiredViewFeatureCode || "-") }
                    ]}
                    title={en ? "Install Manifest Registry" : "설치 매니페스트 레지스트리"}
                  />
                  <div className="rounded-[var(--kr-gov-radius)] border-2 border-[rgba(28,100,242,0.18)] bg-[linear-gradient(180deg,rgba(239,246,255,0.95),rgba(248,250,252,0.98))] p-4 shadow-[0_12px_32px_rgba(28,100,242,0.08)]">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">policy</span>
                      <h4 className="font-black text-[var(--kr-gov-text-primary)]">{en ? "Validator Permission Evidence" : "검증 권한 증거"}</h4>
                    </div>
                    <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">
                      {(governancePage?.page?.commonCodeGroups || []).map((item) => `${item.codeGroupId}[${item.values.join(", ")}]`).join(" / ") || "-"}
                    </p>
                    <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-white/70 bg-white/80 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-blue)]">{en ? "Resolver Evidence" : "권한 해석 증거"}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-primary)]">
                        {(governancePage?.page?.menuPermission?.resolverNotes || []).join(" ") || "-"}
                      </p>
                    </div>
                    <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-white/70 bg-white/80 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-blue)]">{en ? "Permission Relation Tables" : "권한 해석 테이블"}</p>
                      <div className="mt-2">
                        {renderMetaList(governancePage?.page?.menuPermission?.relationTables || [], en ? "No relation tables collected yet." : "수집된 권한 해석 테이블이 없습니다.")}
                      </div>
                    </div>
                    <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-white/70 bg-white/80 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-blue)]">{en ? "Evidence Tags" : "증거 태그"}</p>
                      <div className="mt-2">
                      {renderMetaList(governanceOverview.tags, en ? "No tags collected yet." : "수집된 태그가 없습니다.")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-[#f8fbff] px-4 py-3">
                    <p className="font-bold text-[var(--kr-gov-blue)]">{en ? "Rollback Tables" : "롤백 테이블"}</p>
                    <p className="mt-1">{governanceOverview.tableNames.length}</p>
                    <p className="text-[var(--kr-gov-text-secondary)] break-all">{governanceOverview.tableNames.join(", ") || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-[#fcfbf7] px-4 py-3">
                    <p className="font-bold text-[#8a5a00]">{en ? "Rollback Columns" : "롤백 컬럼"}</p>
                    <p className="mt-1">{governanceOverview.columnNames.length}</p>
                    <p className="text-[var(--kr-gov-text-secondary)] break-all">{governanceOverview.columnNames.join(", ") || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-[#f7fbf8] px-4 py-3">
                    <p className="font-bold text-[#196c2e]">{en ? "Validator Events / APIs" : "검증 이벤트 / API"}</p>
                    <p className="mt-1">{(governancePage?.page?.events || []).length} / {(governancePage?.page?.apis || []).length}</p>
                    <p className="text-[var(--kr-gov-text-secondary)]">{en ? "Function and backend linkage count" : "함수 및 백엔드 연결 수"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-[#f9f7fb] px-4 py-3">
                    <p className="font-bold text-[#6b3ea1]">{en ? "Permission Evidence Rows" : "권한 증거 행"}</p>
                    <p className="mt-1">{(governancePage?.page?.menuPermission?.featureRows || []).length}</p>
                    <p className="text-[var(--kr-gov-text-secondary)]">{(governancePage?.page?.menuPermission?.featureCodes || []).join(", ") || "-"}</p>
                  </div>
                </div>

                <details className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4" open={!selectedMenuPublishReady || governanceWarnings.length > 0 || governanceRemediationItems.length > 0}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="gov-label mb-1">{en ? "Validator Evidence Inventory" : "검증 증거 인벤토리"}</p>
                        <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                          {en
                            ? "Expand when you need the full metadata inventory for blocker analysis or package review."
                            : "차단 이슈 분석이나 패키지 검토에 전체 메타데이터 인벤토리가 필요할 때 펼칩니다."}
                        </p>
                      </div>
                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-[var(--kr-gov-text-secondary)]">
                        {en ? "Components / APIs / DB / Codes" : "컴포넌트 / API / DB / 코드"}
                      </span>
                    </div>
                  </summary>
                  <div className="mt-4">
                    <MetaListPanel
                      sections={[
                        { label: en ? "Screen Elements / Components" : "화면 요소 / 컴포넌트", content: renderMetaList(governanceOverview.componentIds, en ? "No components collected yet." : "수집된 컴포넌트가 없습니다.") },
                        { label: en ? "Events" : "이벤트", content: renderMetaList(governanceOverview.eventIds, en ? "No events collected yet." : "수집된 이벤트가 없습니다.") },
                        { label: en ? "Functions" : "함수", content: renderMetaList(governanceOverview.functionIds, en ? "No functions collected yet." : "수집된 함수가 없습니다.") },
                        { label: en ? "Feature Codes" : "기능 코드", content: renderMetaList(governanceOverview.featureCodes, en ? "No feature codes collected yet." : "수집된 기능 코드가 없습니다.") },
                        { label: en ? "Parameters" : "파라미터", content: renderMetaList(governanceOverview.parameterSpecs, en ? "No parameters collected yet." : "수집된 파라미터가 없습니다.") },
                        { label: en ? "Results" : "출력값", content: renderMetaList(governanceOverview.resultSpecs, en ? "No results collected yet." : "수집된 출력값이 없습니다.") },
                        { label: "API", content: renderMetaList(governanceOverview.apiIds, en ? "No APIs collected yet." : "수집된 API가 없습니다.") },
                        { label: "Controller", content: renderMetaList(governanceOverview.controllerActions, en ? "No controller actions collected yet." : "수집된 Controller 액션이 없습니다.") },
                        { label: "Service", content: renderMetaList(governanceOverview.serviceMethods, en ? "No service methods collected yet." : "수집된 Service 메서드가 없습니다.") },
                        { label: "Mapper", content: renderMetaList(governanceOverview.mapperQueries, en ? "No mapper queries collected yet." : "수집된 Mapper 쿼리가 없습니다.") },
                        { label: en ? "Schemas" : "스키마", content: renderMetaList(governanceOverview.schemaIds, en ? "No schemas collected yet." : "수집된 스키마가 없습니다.") },
                        { label: en ? "Common Codes" : "공통코드", content: renderMetaList(governanceOverview.commonCodeGroups, en ? "No common code groups collected yet." : "수집된 공통코드가 없습니다.") },
                        { label: en ? "DB Tables" : "DB 테이블", content: renderMetaList(governanceOverview.tableNames, en ? "No tables collected yet." : "수집된 테이블이 없습니다.") },
                        { label: en ? "DB Columns" : "DB 컬럼", content: renderMetaList(governanceOverview.columnNames, en ? "No columns collected yet." : "수집된 컬럼이 없습니다.") }
                      ]}
                    />
                  </div>
                </details>

                <details className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-4" open={!selectedMenuPublishReady || governanceWarnings.length > 0 || governanceRemediationItems.length > 0}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="gov-label mb-1">{en ? "Validator Evidence Chain" : "검증 증거 체인"}</p>
                        <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                          {en
                            ? "Expand when you need the full install-validation chain and rollback-ready backend evidence."
                            : "전체 설치 검증 체인과 롤백 가능 백엔드 증거가 필요할 때 펼칩니다."}
                        </p>
                      </div>
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-[var(--kr-gov-text-secondary)]">
                        {en ? `${governanceSurfaceChains.length} surfaces` : `화면 요소 ${governanceSurfaceChains.length}개`}
                      </span>
                    </div>
                  </summary>
                  <div className="mt-4 space-y-4">
                    {governanceSurfaceChains.length === 0 ? (
                      <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                        {en ? "No screen elements collected yet." : "수집된 화면 요소가 없습니다."}
                      </div>
                    ) : governanceSurfaceChains.map((surface) => (
                    <article key={surface.surfaceId} className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-black text-[var(--kr-gov-text-primary)]">{surface.label || surface.surfaceId}</h4>
                          <p className="mt-1 text-xs font-mono text-[var(--kr-gov-text-secondary)]">{surface.surfaceId}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">{surface.layoutZone || "-"}</span>
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">{surface.componentId || "-"}</span>
                        </div>
                      </div>
                      <p className="mt-3 break-all text-xs text-[var(--kr-gov-text-secondary)]">{surface.selector || "-"}</p>
                      {surface.notes ? <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{surface.notes}</p> : null}

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Small Elements" : "작은 요소"}</p>
                          <div className="mt-3 space-y-2">
                            {surface.childElements.length === 0 ? (
                              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No child elements mapped yet." : "연결된 작은 요소가 없습니다."}</p>
                            ) : surface.childElements.map((child) => (
                              <div key={`${surface.surfaceId}-${child.instanceKey}-${child.componentId}`} className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-3 py-2">
                                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{child.componentName || child.instanceKey || child.componentId || "-"}</p>
                                <p className="mt-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">{child.instanceKey || "-"}</p>
                                <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">{child.componentId || "-"} / {child.layoutZone || "-"}</p>
                                {child.designReference ? <p className="mt-1 break-all text-[11px] text-[var(--kr-gov-text-secondary)]">{child.designReference}</p> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Page-Level Codes" : "페이지 공통 코드"}</p>
                          <div className="mt-3 space-y-3">
                            <div>
                              <p className="mb-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Feature Codes" : "기능 코드"}</p>
                              {renderMetaList(governanceOverview.featureCodes, en ? "No feature codes collected yet." : "수집된 기능 코드가 없습니다.")}
                            </div>
                            <div>
                              <p className="mb-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Common Codes" : "공통코드"}</p>
                              {renderMetaList(governanceOverview.commonCodeGroups, en ? "No common code groups collected yet." : "수집된 공통코드가 없습니다.")}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-4">
                        {surface.events.length === 0 ? (
                          <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                            {en ? "No events mapped to this screen element yet." : "이 화면 요소에 연결된 이벤트가 없습니다."}
                          </div>
                        ) : surface.events.map((event) => (
                          <section key={event.eventId} className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h5 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{event.label || event.eventId}</h5>
                                <p className="mt-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">{event.eventId}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">{event.eventType || "-"}</span>
                                <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">{event.frontendFunction || "-"}</span>
                              </div>
                            </div>
                            <p className="mt-2 break-all text-xs text-[var(--kr-gov-text-secondary)]">{event.triggerSelector || "-"}</p>
                            {event.notes ? <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{event.notes}</p> : null}

                            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white p-3">
                                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Function Inputs" : "함수 파라미터"}</p>
                                <div className="mt-3 space-y-2">
                                  {event.functionInputs.length === 0 ? <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No parameters collected yet." : "수집된 파라미터가 없습니다."}</p> : event.functionInputs.map((field) => (
                                    <div key={`${event.eventId}-in-${field.fieldId}`} className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-2">
                                      <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{field.fieldId}</p>
                                      <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">{field.type} / {field.source || "-"} / {field.required ? "required" : "optional"}</p>
                                      {field.notes ? <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">{field.notes}</p> : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white p-3">
                                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Function Results" : "함수 결과값"}</p>
                                <div className="mt-3 space-y-2">
                                  {event.functionOutputs.length === 0 ? <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No results collected yet." : "수집된 결과값이 없습니다."}</p> : event.functionOutputs.map((field) => (
                                    <div key={`${event.eventId}-out-${field.fieldId}`} className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-2">
                                      <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{field.fieldId}</p>
                                      <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">{field.type} / {field.source || "-"} / {field.required ? "required" : "optional"}</p>
                                      {field.notes ? <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">{field.notes}</p> : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 space-y-3">
                              {event.apis.length === 0 ? (
                                <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                                  {en ? "No API is linked to this event." : "이 이벤트에 연결된 API가 없습니다."}
                                </div>
                              ) : event.apis.map((api) => (
                                <article key={`${event.eventId}-${api.apiId}`} className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <h6 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{api.label || api.apiId}</h6>
                                      <p className="mt-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">{api.apiId}</p>
                                    </div>
                                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">{api.method} {api.endpoint}</span>
                                  </div>

                                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                    <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-3">
                                      <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Backend Chain</p>
                                      <div className="mt-3 space-y-3">
                                        <div>
                                          <p className="mb-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">Controller</p>
                                          {renderMetaList(api.controllerActions, en ? "No controller actions collected yet." : "수집된 Controller 액션이 없습니다.")}
                                        </div>
                                        <div>
                                          <p className="mb-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">Service</p>
                                          {renderMetaList(api.serviceMethods, en ? "No service methods collected yet." : "수집된 Service 메서드가 없습니다.")}
                                        </div>
                                        <div>
                                          <p className="mb-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">Mapper</p>
                                          {renderMetaList(api.mapperQueries, en ? "No mapper queries collected yet." : "수집된 Mapper 쿼리가 없습니다.")}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-3">
                                      <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">API I/O</p>
                                      <div className="mt-3 space-y-3">
                                        <div>
                                          <p className="mb-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Request Fields" : "요청 필드"}</p>
                                          {api.requestFields.length === 0 ? <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No request fields collected yet." : "수집된 요청 필드가 없습니다."}</p> : api.requestFields.map((field) => (
                                            <div key={`${api.apiId}-req-${field.fieldId}`} className="mb-2 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-3 py-2">
                                              <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{field.fieldId}</p>
                                              <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">{field.type} / {field.source || "-"} / {field.required ? "required" : "optional"}</p>
                                            </div>
                                          ))}
                                        </div>
                                        <div>
                                          <p className="mb-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Response Fields" : "응답 필드"}</p>
                                          {api.responseFields.length === 0 ? <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No response fields collected yet." : "수집된 응답 필드가 없습니다."}</p> : api.responseFields.map((field) => (
                                            <div key={`${api.apiId}-res-${field.fieldId}`} className="mb-2 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-3 py-2">
                                              <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{field.fieldId}</p>
                                              <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">{field.type} / {field.source || "-"} / {field.required ? "required" : "optional"}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                    <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-3">
                                      <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Schemas / Tables / Columns" : "스키마 / 테이블 / 컬럼"}</p>
                                      <div className="mt-3 space-y-3">
                                        <div>
                                          <p className="mb-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Schemas" : "스키마"}</p>
                                          {api.schemas.length === 0 ? <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No schemas linked yet." : "연결된 스키마가 없습니다."}</p> : api.schemas.map((schema) => (
                                            <div key={`${api.apiId}-${schema.schemaId}`} className="mb-2 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-3 py-2">
                                              <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{schema.label || schema.schemaId}</p>
                                              <p className="mt-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">{schema.schemaId}</p>
                                              <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">{schema.tableName || "-"}</p>
                                              <div className="mt-2">{renderMetaList(schema.columns || [], en ? "No columns collected yet." : "수집된 컬럼이 없습니다.")}</div>
                                            </div>
                                          ))}
                                        </div>
                                        <div>
                                          <p className="mb-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Related Tables" : "관련 테이블"}</p>
                                          {renderMetaList(api.relatedTables, en ? "No tables collected yet." : "수집된 테이블이 없습니다.")}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-3">
                                      <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Codes / Permissions" : "코드 / 권한"}</p>
                                      <div className="mt-3 space-y-3">
                                        <div>
                                          <p className="mb-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Feature Codes" : "기능 코드"}</p>
                                          {renderMetaList(governanceOverview.featureCodes, en ? "No feature codes collected yet." : "수집된 기능 코드가 없습니다.")}
                                        </div>
                                        <div>
                                          <p className="mb-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Common Codes" : "공통코드"}</p>
                                          {renderMetaList(governanceOverview.commonCodeGroups, en ? "No common code groups collected yet." : "수집된 공통코드가 없습니다.")}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </article>
                    ))}
                  </div>
                </details>

                <details className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4" open={!selectedMenuPublishReady || governanceWarnings.length > 0}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="gov-label mb-1">{en ? "Rollback Evidence Mapping" : "롤백 증거 매핑 표"}</p>
                        <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                          {en
                            ? "Expand for a single-table review before install or rollback packaging."
                            : "설치 또는 롤백 패키징 전 단일 표 검토가 필요할 때 펼칩니다."}
                        </p>
                      </div>
                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-[var(--kr-gov-text-secondary)]">
                        {en ? `${governanceSurfaceEventRows.length} mappings` : `매핑 ${governanceSurfaceEventRows.length}건`}
                      </span>
                    </div>
                  </summary>
                  <div className="mt-4 table-wrap max-w-full">
                    <table className="data-table min-w-[1200px]">
                      <thead>
                        <tr>
                          <th>{en ? "Surface" : "화면 요소"}</th>
                          <th>{en ? "Child Elements" : "작은 요소"}</th>
                          <th>{en ? "Event" : "이벤트"}</th>
                          <th>{en ? "Function" : "함수"}</th>
                          <th>{en ? "Parameters / Results" : "파라미터 / 결과값"}</th>
                          <th>API</th>
                          <th>{en ? "Backend Chain" : "백엔드 체인"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {governanceSurfaceEventRows.length === 0 ? (
                          <tr><td colSpan={7}>{en ? "No surface-event mappings collected yet." : "수집된 화면 요소-이벤트 매핑이 없습니다."}</td></tr>
                        ) : governanceSurfaceEventRows.map((row) => (
                          <tr key={`${row.surfaceId}-${row.eventId}-${row.frontendFunction}`}>
                            <td>
                              <strong>{row.surfaceLabel || row.surfaceId}</strong>
                              <br />
                              <span className="text-[var(--kr-gov-text-secondary)]">{row.surfaceId}</span>
                            </td>
                            <td>{row.childElements || "-"}</td>
                            <td>
                              <strong>{row.eventLabel}</strong>
                              <br />
                              <span className="text-[var(--kr-gov-text-secondary)]">{row.eventId} / {row.eventType}</span>
                            </td>
                            <td>{row.frontendFunction || "-"}</td>
                            <td>
                              <strong>{en ? "IN" : "입력"}</strong> {row.parameters}
                              <br />
                              <strong>{en ? "OUT" : "출력"}</strong> {row.results}
                            </td>
                            <td>{row.apiLabels || "-"}</td>
                            <td>
                              <strong>Controller</strong> {row.controllerActions}
                              <br />
                              <strong>Service</strong> {row.serviceMethods}
                              <br />
                              <strong>Mapper</strong> {row.mapperQueries}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}
          </section>
        </div>
      </section>
      </>
      )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
