import { useEffect, useMemo, useState } from "react";
import type {
  FullStackGovernanceRegistryEntry,
  ScreenBuilderStatusSummaryItem,
  ScreenCommandPagePayload
} from "../../lib/api/platformTypes";
import { fetchAuditEvents, fetchTraceEvents } from "../../platform/observability/observability";
import { buildFullStackManagementPath, buildPlatformStudioPath } from "../../platform/routes/platformPaths";
import {
  autoCollectFullStackGovernanceRegistry,
  fetchFullStackGovernanceRegistry,
  fetchScreenBuilderStatusSummary,
  fetchScreenCommandPage
} from "../../lib/api/platform";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import {
  buildGovernanceOverview,
  buildSurfaceChains,
  buildSurfaceEventTableRows,
  isDraftOnlyGovernancePage,
  resolveGovernancePageId,
  type GovernanceOverview,
  type GovernanceRemediationItem,
  type GovernanceSurfaceChain,
  type GovernanceSurfaceEventTableRow,
  type ManagedMenuRow,
  type ScreenBuilderFreshnessSummary,
  type ScreenBuilderIssueBreakdown,
  type ScreenBuilderParitySummary,
  type ScreenBuilderStatus
} from "./environmentManagementShared";

function mapSummaryItemToStatus(item: ScreenBuilderStatusSummaryItem): ScreenBuilderStatus {
  return {
    publishedVersionId: String(item.publishedVersionId || ""),
    publishedSavedAt: String(item.publishedSavedAt || ""),
    releaseUnitId: String(item.releaseUnitId || ""),
    artifactTargetSystem: String(item.artifactTargetSystem || "carbonet-general"),
    runtimePackageId: String(item.runtimePackageId || ""),
    deployTraceId: String(item.deployTraceId || ""),
    publishFreshnessState: item.publishFreshnessState || "UNKNOWN",
    publishFreshnessLabel: String(item.publishFreshnessLabel || ""),
    publishFreshnessDetail: String(item.publishFreshnessDetail || ""),
    parityState: item.parityState || "UNAVAILABLE",
    parityLabel: String(item.parityLabel || ""),
    parityDetail: String(item.parityDetail || ""),
    parityTraceId: String(item.parityTraceId || ""),
    versionCount: Number(item.versionCount || 0),
    unregisteredCount: Number(item.unregisteredCount || 0),
    missingCount: Number(item.missingCount || 0),
    deprecatedCount: Number(item.deprecatedCount || 0)
  };
}

type UseEnvironmentGovernanceParams = {
  en: boolean;
  featureRows: Array<Record<string, unknown>>;
  menuRows: ManagedMenuRow[];
  selectedMenu: ManagedMenuRow | null;
  selectedMenuCode: string;
  selectedMenuIsPage: boolean;
  onAfterCollect: () => Promise<void>;
};

export function useEnvironmentGovernance({
  en,
  featureRows,
  menuRows,
  selectedMenu,
  selectedMenuCode,
  selectedMenuIsPage,
  onAfterCollect
}: UseEnvironmentGovernanceParams) {
  const [governanceMessage, setGovernanceMessage] = useState("");
  const [governanceError, setGovernanceError] = useState("");
  const [screenCatalog, setScreenCatalog] = useState<ScreenCommandPagePayload | null>(null);
  const [governancePage, setGovernancePage] = useState<ScreenCommandPagePayload | null>(null);
  const [registryEntry, setRegistryEntry] = useState<FullStackGovernanceRegistryEntry | null>(null);
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [postCollectAuditRows, setPostCollectAuditRows] = useState<Array<Record<string, unknown>>>([]);
  const [postCollectTraceRows, setPostCollectTraceRows] = useState<Array<Record<string, unknown>>>([]);
  const [lastAutoCollectAt, setLastAutoCollectAt] = useState("");
  const [screenBuilderStatusMap, setScreenBuilderStatusMap] = useState<Record<string, ScreenBuilderStatus>>({});
  const [screenBuilderStatus, setScreenBuilderStatus] = useState<ScreenBuilderStatus | null>(null);
  const [screenBuilderPublishedMap, setScreenBuilderPublishedMap] = useState<Record<string, boolean>>({});
  const [screenBuilderIssueMap, setScreenBuilderIssueMap] = useState<Record<string, number>>({});
  const [screenBuilderIssueDetailMap, setScreenBuilderIssueDetailMap] = useState<Record<string, ScreenBuilderIssueBreakdown>>({});
  const [screenBuilderFreshnessMap, setScreenBuilderFreshnessMap] = useState<Record<string, ScreenBuilderFreshnessSummary>>({});
  const [screenBuilderParityMap, setScreenBuilderParityMap] = useState<Record<string, ScreenBuilderParitySummary>>({});

  const governancePageId = useMemo(
    () => resolveGovernancePageId(selectedMenu, screenCatalog?.pages),
    [screenCatalog?.pages, selectedMenu]
  );
  const governanceOverview = useMemo<GovernanceOverview>(
    () => buildGovernanceOverview(registryEntry, governancePage?.page || null),
    [governancePage?.page, registryEntry]
  );
  const governanceDraftOnly = useMemo(
    () => isDraftOnlyGovernancePage(registryEntry, governancePage?.page || null),
    [governancePage?.page, registryEntry]
  );
  const governanceWarnings = useMemo(() => {
    if (!selectedMenu || !selectedMenuIsPage) {
      return [] as string[];
    }
    const warnings: string[] = [];
    if (!governanceOverview.pageId) {
      warnings.push(en ? "Screen-command registry is not linked yet." : "screen-command registry 연결이 아직 없습니다.");
    }
    if (governanceDraftOnly) {
      warnings.push(en ? "Only draft registry is connected." : "draft registry만 연결된 상태입니다.");
    }
    if (governanceOverview.apiIds.length === 0) {
      warnings.push(en ? "No backend API linkage collected." : "연결된 백엔드 API가 수집되지 않았습니다.");
    }
    if (governanceOverview.tableNames.length === 0) {
      warnings.push(en ? "No DB table metadata collected." : "DB 테이블 메타데이터가 수집되지 않았습니다.");
    }
    if (featureRows.some((row) => Boolean(row.unassignedToRole))) {
      warnings.push(en ? "Some features are still unassigned to permission groups." : "일부 기능이 아직 권한 그룹에 연결되지 않았습니다.");
    }
    return warnings;
  }, [en, featureRows, governanceDraftOnly, governanceOverview.apiIds.length, governanceOverview.pageId, governanceOverview.tableNames.length, selectedMenu, selectedMenuIsPage]);
  const permissionSummary = useMemo(() => {
    const featureCount = featureRows.length;
    const linkedFeatureCount = featureRows.filter((row) => !Boolean(row.unassignedToRole)).length;
    const unassignedFeatureCount = featureRows.filter((row) => Boolean(row.unassignedToRole)).length;
    const assignedRoleTotal = featureRows.reduce((sum, row) => sum + Number(row.assignedRoleCount || 0), 0);
    return {
      featureCount,
      linkedFeatureCount,
      unassignedFeatureCount,
      assignedRoleTotal
    };
  }, [featureRows]);
  const governanceRemediationItems = useMemo<GovernanceRemediationItem[]>(() => {
    const items: GovernanceRemediationItem[] = [];
    if (!selectedMenu || !selectedMenuIsPage) {
      return items;
    }
    if (!governanceOverview.pageId) {
      items.push({
        title: en ? "Link this menu to registry" : "이 메뉴를 registry에 연결",
        description: en
          ? "Create or save the page manifest so the menu is traceable from route to implementation."
          : "페이지 manifest를 생성하거나 저장해 메뉴를 route와 구현 정보에 연결하세요.",
        href: buildFullStackManagementPath(),
        actionLabel: en ? "Open Full-Stack Management" : "풀스택 관리 열기",
        actionKind: "link"
      });
    }
    if (governanceDraftOnly) {
      items.push({
        title: en ? "Promote draft metadata" : "draft 메타데이터 승격",
        description: en
          ? "Run auto-collection or save the screen registry so draft-only linkage becomes operational metadata."
          : "자동 수집 또는 화면 registry 저장으로 draft 연결을 운영 메타데이터로 승격하세요.",
        href: governancePageId ? undefined : buildPlatformStudioPath(),
        actionLabel: governancePageId ? (en ? "Run Auto Collect" : "자동 수집 실행") : (en ? "Open Platform Studio" : "플랫폼 스튜디오 열기"),
        actionKind: governancePageId ? "autoCollect" : "link"
      });
    }
    if (governanceOverview.apiIds.length === 0) {
      items.push({
        title: en ? "Collect backend API chain" : "백엔드 API 체인 수집",
        description: en
          ? "Review event-to-API mappings and persist controller/service/mapper linkage."
          : "이벤트-API 매핑을 검토하고 controller/service/mapper 연결을 저장하세요.",
        href: governancePageId ? undefined : buildPlatformStudioPath(),
        actionLabel: governancePageId ? (en ? "Run Auto Collect" : "자동 수집 실행") : (en ? "Review In Platform Studio" : "플랫폼 스튜디오에서 검토"),
        actionKind: governancePageId ? "autoCollect" : "link"
      });
    }
    if (governanceOverview.tableNames.length === 0) {
      items.push({
        title: en ? "Add DB metadata coverage" : "DB 메타데이터 보강",
        description: en
          ? "Register related schema and table metadata so operational impact can be traced before change."
          : "관련 스키마와 테이블 메타데이터를 등록해 변경 전 영향도를 추적 가능하게 하세요.",
        href: governancePageId ? undefined : buildFullStackManagementPath(),
        actionLabel: governancePageId ? (en ? "Run Auto Collect" : "자동 수집 실행") : (en ? "Review In Full-Stack Management" : "풀스택 관리에서 검토"),
        actionKind: governancePageId ? "autoCollect" : "link"
      });
    }
    if (permissionSummary.unassignedFeatureCount > 0) {
      items.push({
        title: en ? "Assign unlinked features to roles" : "미연결 기능을 권한 그룹에 할당",
        description: en
          ? "Open permission groups with the current menu scope and assign the remaining features."
          : "현재 메뉴 범위로 권한 그룹 화면을 열어 남은 기능을 연결하세요.",
        href: buildLocalizedPath(`/admin/auth/group?menuCode=${selectedMenu.code}`, `/en/admin/auth/group?menuCode=${selectedMenu.code}`),
        actionLabel: en ? "Open Permission Groups" : "권한 그룹 열기",
        actionKind: "permissions"
      });
    }
    return items;
  }, [en, governanceDraftOnly, governanceOverview.apiIds.length, governanceOverview.pageId, governanceOverview.tableNames.length, governancePageId, permissionSummary.unassignedFeatureCount, selectedMenu, selectedMenuIsPage]);
  const governanceSurfaceChains = useMemo<GovernanceSurfaceChain[]>(
    () => buildSurfaceChains(governancePage?.page || null),
    [governancePage?.page]
  );
  const governanceSurfaceEventRows = useMemo<GovernanceSurfaceEventTableRow[]>(
    () => buildSurfaceEventTableRows(governanceSurfaceChains),
    [governanceSurfaceChains]
  );
  const screenBuilderPageCounts = useMemo(() => {
    const pageMenus = menuRows.filter((row) => row.code.length === 8);
    const publishedCount = pageMenus.filter((row) => Boolean(screenBuilderPublishedMap[row.code])).length;
    const issuePagesCount = pageMenus.filter((row) => (screenBuilderIssueMap[row.code] || 0) > 0).length;
    const unregisteredPages = pageMenus.filter((row) => (screenBuilderIssueDetailMap[row.code]?.unregisteredCount || 0) > 0).length;
    const missingPages = pageMenus.filter((row) => (screenBuilderIssueDetailMap[row.code]?.missingCount || 0) > 0).length;
    const deprecatedPages = pageMenus.filter((row) => (screenBuilderIssueDetailMap[row.code]?.deprecatedCount || 0) > 0).length;
    const stalePublishPages = pageMenus.filter((row) => screenBuilderFreshnessMap[row.code]?.state === "STALE").length;
    const parityDriftPages = pageMenus.filter((row) => screenBuilderParityMap[row.code]?.state === "DRIFT").length;
    const parityGapPages = pageMenus.filter((row) => screenBuilderParityMap[row.code]?.state === "GAP").length;
    return {
      totalPages: pageMenus.length,
      publishedPages: publishedCount,
      readyPages: Math.max(pageMenus.length - issuePagesCount, 0),
      blockedPages: issuePagesCount,
      draftOnlyPages: Math.max(pageMenus.length - publishedCount, 0),
      issuePages: issuePagesCount,
      unregisteredPages,
      missingPages,
      deprecatedPages,
      stalePublishPages,
      parityDriftPages,
      parityGapPages
    };
  }, [menuRows, screenBuilderFreshnessMap, screenBuilderIssueDetailMap, screenBuilderIssueMap, screenBuilderParityMap, screenBuilderPublishedMap]);

  useEffect(() => {
    let cancelled = false;
    async function loadPublishedFlags() {
      const pageMenus = menuRows.filter((row) => row.code.length === 8);
      if (pageMenus.length === 0) {
        setScreenBuilderStatusMap({});
        setScreenBuilderStatus(null);
        setScreenBuilderPublishedMap({});
        setScreenBuilderIssueMap({});
        setScreenBuilderIssueDetailMap({});
        setScreenBuilderFreshnessMap({});
        setScreenBuilderParityMap({});
        return;
      }
      try {
        const response = await fetchScreenBuilderStatusSummary(pageMenus.map((row) => row.code));
        if (cancelled) {
          return;
        }
        const items: ScreenBuilderStatusSummaryItem[] = Array.isArray(response.items) ? response.items : [];
        const statusMap = items.reduce<Record<string, ScreenBuilderStatus>>((accumulator, item) => {
          accumulator[item.menuCode] = mapSummaryItemToStatus(item);
          return accumulator;
        }, {});
        setScreenBuilderStatusMap(statusMap);
        setScreenBuilderStatus(selectedMenu && selectedMenuIsPage ? (statusMap[selectedMenu.code] || null) : null);
        setScreenBuilderPublishedMap(Object.fromEntries(items.map((item) => [item.menuCode, Boolean(item.publishedVersionId)])));
        setScreenBuilderIssueMap(Object.fromEntries(items.map((item) => [item.menuCode, item.unregisteredCount + item.missingCount + item.deprecatedCount])));
        setScreenBuilderIssueDetailMap(Object.fromEntries(items.map((item) => [item.menuCode, {
          unregisteredCount: item.unregisteredCount,
          missingCount: item.missingCount,
          deprecatedCount: item.deprecatedCount
        }])));
        setScreenBuilderFreshnessMap(Object.fromEntries(items.map((item) => [item.menuCode, {
          state: item.publishFreshnessState,
          label: item.publishFreshnessLabel,
          detail: item.publishFreshnessDetail
        }])));
        setScreenBuilderParityMap(Object.fromEntries(items.map((item) => [item.menuCode, {
          state: item.parityState,
          label: item.parityLabel,
          detail: item.parityDetail,
          traceId: item.parityTraceId
        }])));
      } catch {
        if (!cancelled) {
          setScreenBuilderStatusMap({});
          setScreenBuilderStatus(null);
          setScreenBuilderPublishedMap({});
          setScreenBuilderIssueMap({});
          setScreenBuilderIssueDetailMap({});
          setScreenBuilderFreshnessMap({});
          setScreenBuilderParityMap({});
        }
      }
    }
    void loadPublishedFlags();
    return () => {
      cancelled = true;
    };
  }, [menuRows, selectedMenu, selectedMenuIsPage]);

  useEffect(() => {
    if (!selectedMenu || !selectedMenuIsPage) {
      setScreenBuilderStatus(null);
      return;
    }
    setScreenBuilderStatus(screenBuilderStatusMap[selectedMenu.code] || null);
  }, [screenBuilderStatusMap, selectedMenu, selectedMenuIsPage]);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const payload = await fetchScreenCommandPage("");
        if (!cancelled) {
          setScreenCatalog(payload);
        }
      } catch {
        if (!cancelled) {
          setScreenCatalog(null);
        }
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [en]);

  useEffect(() => {
    let cancelled = false;
    async function loadGovernanceData() {
      setGovernanceMessage("");
      setGovernanceError("");
      if (!selectedMenu || !selectedMenuIsPage) {
        setGovernancePage(null);
        setRegistryEntry(null);
        return;
      }
      setGovernanceLoading(true);
      try {
        const [pageResult, registryResult] = await Promise.allSettled([
          governancePageId ? fetchScreenCommandPage(governancePageId) : Promise.resolve(null),
          fetchFullStackGovernanceRegistry(selectedMenu.code)
        ]);
        if (!cancelled) {
          const pagePayload = pageResult.status === "fulfilled" ? pageResult.value : null;
          const registryPayload = registryResult.status === "fulfilled" ? registryResult.value : null;
          setGovernancePage(pagePayload);
          setRegistryEntry(registryPayload);
          if (!governancePageId && pageResult.status !== "rejected") {
            setGovernanceError(en ? "This menu is not linked to the screen-command registry yet." : "이 메뉴는 아직 screen-command registry와 연결되지 않았습니다.");
          } else if (pageResult.status === "rejected" && registryResult.status === "rejected") {
            setGovernanceError(en ? "Failed to load both screen-command and full-stack metadata." : "screen-command와 full-stack 메타데이터를 모두 불러오지 못했습니다.");
          } else if (pageResult.status === "rejected") {
            setGovernanceError(en ? "Screen-command metadata is unavailable right now." : "screen-command 메타데이터를 지금 불러오지 못했습니다.");
          } else if (registryResult.status === "rejected") {
            setGovernanceError(en ? "Full-stack registry is unavailable right now." : "full-stack registry를 지금 불러오지 못했습니다.");
          }
        }
      } catch (error) {
        if (!cancelled) {
          setGovernancePage(null);
          setRegistryEntry(null);
          setGovernanceError(error instanceof Error ? error.message : (en ? "Failed to load menu metadata." : "메뉴 메타데이터를 불러오지 못했습니다."));
        }
      } finally {
        if (!cancelled) {
          setGovernanceLoading(false);
        }
      }
    }
    void loadGovernanceData();
    return () => {
      cancelled = true;
    };
  }, [en, governancePageId, selectedMenu, selectedMenuIsPage]);

  useEffect(() => {
    setPostCollectAuditRows([]);
    setPostCollectTraceRows([]);
    setLastAutoCollectAt("");
  }, [selectedMenuCode]);

  async function handleAutoCollect() {
    if (!selectedMenu || !selectedMenuIsPage) {
      setGovernanceError(en ? "Select an 8-digit page menu first." : "먼저 8자리 페이지 메뉴를 선택하세요.");
      return false;
    }
    if (!governancePageId) {
      setGovernanceError(en ? "The selected menu is not linked to a collectable page." : "선택한 메뉴가 수집 가능한 페이지와 아직 연결되지 않았습니다.");
      return false;
    }
    setCollecting(true);
    setGovernanceError("");
    setGovernanceMessage("");
    try {
      const response = await autoCollectFullStackGovernanceRegistry({
        menuCode: selectedMenu.code,
        pageId: governancePageId,
        menuUrl: selectedMenu.menuUrl,
        mergeExisting: true,
        save: true
      });
      setRegistryEntry(response.entry);
      setGovernanceMessage(response.message || (en ? "Metadata collected and saved." : "메타데이터를 자동 수집하고 저장했습니다."));
      setLastAutoCollectAt(new Date().toISOString());
      const [auditResponse, traceResponse] = await Promise.all([
        fetchAuditEvents({ menuCode: selectedMenu.code, pageId: governancePageId, pageSize: 3 }).catch(() => ({ items: [] })),
        fetchTraceEvents({ pageId: governancePageId, pageSize: 3 }).catch(() => ({ items: [] }))
      ]);
      setPostCollectAuditRows(Array.isArray(auditResponse.items) ? auditResponse.items : []);
      setPostCollectTraceRows(Array.isArray(traceResponse.items) ? traceResponse.items : []);
    } catch (error) {
      setGovernanceError(error instanceof Error ? error.message : (en ? "Failed to collect metadata." : "메타데이터 수집에 실패했습니다."));
      setCollecting(false);
      return false;
    }
    try {
      await onAfterCollect();
    } catch (error) {
      setGovernanceError(error instanceof Error ? error.message : (en ? "Failed to refresh metadata summary after collection." : "수집 후 메타데이터 요약 새로고침에 실패했습니다."));
    } finally {
      setCollecting(false);
    }
    return true;
  }

  return {
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
    screenBuilderIssueDetailMap,
    screenBuilderFreshnessMap,
    screenBuilderIssueMap,
    screenBuilderParityMap,
    screenBuilderPageCounts,
    screenBuilderPublishedMap,
    screenBuilderStatus,
    setGovernanceError,
    setGovernanceMessage
  };
}
