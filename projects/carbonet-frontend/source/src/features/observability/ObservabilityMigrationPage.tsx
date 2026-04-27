import { useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { ContextKeyStrip } from "../admin-ui/ContextKeyStrip";
import { verifyRuntimeContextKeys } from "../admin-ui/contextKeyPresets";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import type { AuditEventSearchPayload, TraceEventSearchPayload } from "../../lib/api/platformTypes";
import { fetchAuditEvents, fetchTraceEvents } from "../../platform/observability/observability";
import { fetchUnifiedLog, type UnifiedLogRow, type UnifiedLogSearchPayload, type UnifiedLogTab } from "../../lib/api/unifiedLog";
import { CollectionResultPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminTable, MemberButton, MemberPagination, MemberSectionToolbar } from "../member/common";

type ObservabilityTab = "audit" | "trace";
const DEFAULT_PAGE_SIZE = 10;
const UNIFIED_LOG_TABS: UnifiedLogTab[] = ["all", "access-auth", "audit", "error", "trace", "security", "batch-runtime"];
const UNIFIED_LOG_PRESETS = [
  {
    pathSuffix: "/system/unified_log",
    label: "통합 로그",
    subtitle: "접속, 감사, 오류, 추적 로그를 하나의 공통 계약으로 조회합니다.",
    tab: "all" as UnifiedLogTab,
    logType: "",
    detailType: ""
  },
  {
    pathSuffix: "/system/unified_log/trace",
    label: "추적 로그",
    subtitle: "traceId를 기준으로 페이지, 컴포넌트, API 흐름을 추적합니다.",
    tab: "trace" as UnifiedLogTab,
    logType: "TRACE",
    detailType: ""
  },
  {
    pathSuffix: "/system/unified_log/page-events",
    label: "페이지 이벤트 로그",
    subtitle: "페이지 진입과 화면 전환 흐름을 추적합니다.",
    tab: "trace" as UnifiedLogTab,
    logType: "TRACE",
    detailType: "PAGE_VIEW,PAGE_LEAVE"
  },
  {
    pathSuffix: "/system/unified_log/ui-actions",
    label: "UI 액션 로그",
    subtitle: "버튼, 검색, 저장 같은 사용자 액션을 추적합니다.",
    tab: "trace" as UnifiedLogTab,
    logType: "TRACE",
    detailType: "UI_ACTION"
  },
  {
    pathSuffix: "/system/unified_log/api-trace",
    label: "API 추적 로그",
    subtitle: "화면 액션과 연결된 API 호출 흐름을 추적합니다.",
    tab: "trace" as UnifiedLogTab,
    logType: "TRACE",
    detailType: "API_REQUEST,API_RESPONSE"
  },
  {
    pathSuffix: "/system/unified_log/ui-errors",
    label: "UI 오류 로그",
    subtitle: "프론트 오류와 렌더링 실패를 추적합니다.",
    tab: "error" as UnifiedLogTab,
    logType: "TRACE,ERROR",
    detailType: "UI_ERROR,WINDOW_ERROR,UNHANDLED_REJECTION,REACT_ERROR_BOUNDARY,FRONTEND_REPORT,FRONTEND_TELEMETRY"
  },
  {
    pathSuffix: "/system/unified_log/layout-render",
    label: "레이아웃 렌더 로그",
    subtitle: "레이아웃 렌더링과 화면 구성 변경을 추적합니다.",
    tab: "trace" as UnifiedLogTab,
    logType: "TRACE",
    detailType: "LAYOUT_RENDER"
  }
] as const;

function resolveUnifiedLogPreset() {
  if (typeof window === "undefined") {
    return UNIFIED_LOG_PRESETS[0];
  }
  const pathname = window.location.pathname;
  return UNIFIED_LOG_PRESETS.find((preset) => pathname.endsWith(preset.pathSuffix)) || UNIFIED_LOG_PRESETS[0];
}

function readInitialQuery() {
  if (typeof window === "undefined") {
    return {
      tab: "audit" as ObservabilityTab,
      unifiedTab: "all" as UnifiedLogTab,
      projectId: "",
      traceId: "",
      actorId: "",
      actionCode: "",
      pageId: "",
      componentId: "",
      functionId: "",
      apiId: "",
      eventType: "",
      resultCode: "",
      searchKeyword: ""
    };
  }
  const params = new URLSearchParams(window.location.search);
  const tab: ObservabilityTab = params.get("tab") === "trace" ? "trace" : "audit";
  const requestedUnifiedTab = (params.get("tab") || "").trim() as UnifiedLogTab;
  return {
    tab,
    unifiedTab: UNIFIED_LOG_TABS.includes(requestedUnifiedTab) ? requestedUnifiedTab : "all",
    projectId: params.get("projectId") || "",
    traceId: params.get("traceId") || "",
    targetType: params.get("targetType") || "",
    targetId: params.get("targetId") || "",
    actorId: params.get("actorId") || "",
    actionCode: params.get("actionCode") || "",
    pageId: params.get("pageId") || "",
    componentId: params.get("componentId") || "",
    functionId: params.get("functionId") || "",
    apiId: params.get("apiId") || "",
    eventType: params.get("eventType") || "",
    resultCode: params.get("resultCode") || "",
    searchKeyword: params.get("searchKeyword") || ""
  };
}

export function ObservabilityMigrationPage() {
  const en = isEnglish();
  const isUnifiedLogPage = typeof window !== "undefined" && window.location.pathname.includes("/system/unified_log");
  const unifiedPreset = resolveUnifiedLogPreset();
  const initialQuery = readInitialQuery();
  const [tab, setTab] = useState<ObservabilityTab>(initialQuery.tab);
  const [unifiedTab, setUnifiedTab] = useState<UnifiedLogTab>(isUnifiedLogPage && unifiedPreset.tab !== "all" ? unifiedPreset.tab : initialQuery.unifiedTab);
  const [auditPage, setAuditPage] = useState<AuditEventSearchPayload | null>(null);
  const [tracePage, setTracePage] = useState<TraceEventSearchPayload | null>(null);
  const [unifiedPage, setUnifiedPage] = useState<UnifiedLogSearchPayload | null>(null);
  const [projectId, setProjectId] = useState(initialQuery.projectId);
  const [traceId, setTraceId] = useState(initialQuery.traceId);
  const [targetType, setTargetType] = useState(initialQuery.targetType);
  const [targetId, setTargetId] = useState(initialQuery.targetId);
  const [actorId, setActorId] = useState(initialQuery.actorId);
  const [actionCode, setActionCode] = useState(initialQuery.actionCode);
  const [pageId, setPageId] = useState(initialQuery.pageId);
  const [componentId, setComponentId] = useState(initialQuery.componentId);
  const [functionId, setFunctionId] = useState(initialQuery.functionId);
  const [apiId, setApiId] = useState(initialQuery.apiId);
  const [eventType, setEventType] = useState(isUnifiedLogPage && unifiedPreset.detailType ? unifiedPreset.detailType : initialQuery.eventType);
  const [resultCode, setResultCode] = useState(initialQuery.resultCode);
  const [searchKeyword, setSearchKeyword] = useState(initialQuery.searchKeyword);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedUnifiedLogId, setSelectedUnifiedLogId] = useState("");
  const [auditPageIndex, setAuditPageIndex] = useState(1);
  const [tracePageIndex, setTracePageIndex] = useState(1);
  const [unifiedPageIndex, setUnifiedPageIndex] = useState(1);
  const isTraceFocusedUnifiedPage = isUnifiedLogPage && unifiedPreset.pathSuffix === "/system/unified_log/trace";
  const isPageEventFocusedUnifiedPage = isUnifiedLogPage && unifiedPreset.pathSuffix === "/system/unified_log/page-events";
  const isApiTraceFocusedUnifiedPage = isUnifiedLogPage && unifiedPreset.pathSuffix === "/system/unified_log/api-trace";
  const isUiErrorFocusedUnifiedPage = isUnifiedLogPage && unifiedPreset.pathSuffix === "/system/unified_log/ui-errors";
  const isLayoutRenderFocusedUnifiedPage = isUnifiedLogPage && unifiedPreset.pathSuffix === "/system/unified_log/layout-render";
  const unifiedItems = unifiedPage?.items || [];
  const evidenceContextLabel = [targetType, targetId].filter(Boolean).join(" / ");
  const uniqueTraceCount = new Set(unifiedItems.map((item) => String(item.traceId || "")).filter(Boolean)).size;
  const uniquePageCount = new Set(unifiedItems.map((item) => String(item.pageId || "")).filter(Boolean)).size;
  const uniqueApiCount = new Set(unifiedItems.map((item) => String(item.apiId || "")).filter(Boolean)).size;
  const uniqueComponentCount = new Set(unifiedItems.map((item) => String(item.componentId || "")).filter(Boolean)).size;
  const uniqueFunctionCount = new Set(unifiedItems.map((item) => String(item.functionId || "")).filter(Boolean)).size;
  const apiEventCount = unifiedItems.filter((item) => String(item.apiId || "").trim() || String(item.detailType || "").includes("API")).length;
  const apiRequestCount = unifiedItems.filter((item) => String(item.detailType || "").toUpperCase().includes("API_REQUEST")).length;
  const apiResponseCount = unifiedItems.filter((item) => String(item.detailType || "").toUpperCase().includes("API_RESPONSE")).length;
  const pageViewCount = unifiedItems.filter((item) => String(item.detailType || "").toUpperCase().includes("PAGE_VIEW")).length;
  const pageLeaveCount = unifiedItems.filter((item) => String(item.detailType || "").toUpperCase().includes("PAGE_LEAVE")).length;
  const errorLikeCount = unifiedItems.filter((item) => {
    const result = String(item.resultCode || "").toUpperCase();
    const detail = String(item.detailType || "").toUpperCase();
    return result.includes("ERROR") || result.includes("FAIL") || detail.includes("ERROR");
  }).length;
  const uiErrorCount = unifiedItems.filter((item) => {
    const detail = String(item.detailType || "").toUpperCase();
    return detail.includes("UI_ERROR") || detail.includes("WINDOW_ERROR") || detail.includes("REACT_ERROR_BOUNDARY");
  }).length;
  const rejectionCount = unifiedItems.filter((item) => {
    const detail = String(item.detailType || "").toUpperCase();
    return detail.includes("UNHANDLED_REJECTION");
  }).length;
  const durationRows = unifiedItems.filter((item) => typeof item.durationMs === "number" && Number.isFinite(item.durationMs));
  const averageDurationMs = durationRows.length
    ? Math.round(durationRows.reduce((sum, item) => sum + Number(item.durationMs || 0), 0) / durationRows.length)
    : 0;
  const selectedUnifiedItem = unifiedItems.find((item, index) => `${String(item.logId || "unified")}-${index}` === selectedUnifiedLogId) || unifiedItems[0] || null;
  const auditCurrentPage = Math.max(1, Number(auditPage?.pageIndex || auditPageIndex || 1));
  const traceCurrentPage = Math.max(1, Number(tracePage?.pageIndex || tracePageIndex || 1));
  const unifiedCurrentPage = Math.max(1, Number(unifiedPageIndex || 1));
  const auditTotalPages = Math.max(1, Math.ceil(Number(auditPage?.totalCount || 0) / Math.max(1, Number(auditPage?.pageSize || DEFAULT_PAGE_SIZE))));
  const traceTotalPages = Math.max(1, Math.ceil(Number(tracePage?.totalCount || 0) / Math.max(1, Number(tracePage?.pageSize || DEFAULT_PAGE_SIZE))));
  const unifiedTotalPages = Math.max(1, Math.ceil(Number(unifiedPage?.totalCount || 0) / DEFAULT_PAGE_SIZE));

  async function loadAudit(next?: { traceId?: string; actorId?: string; actionCode?: string; pageId?: string; pageIndex?: number; }) {
    logGovernanceScope("ACTION", "observability-audit-search", {
      traceId: next?.traceId ?? traceId,
      actorId: next?.actorId ?? actorId,
      actionCode: next?.actionCode ?? actionCode,
      pageId: next?.pageId ?? pageId,
      pageIndex: next?.pageIndex ?? auditPageIndex
    });
    setLoading(true);
    try {
      const payload = await fetchAuditEvents({
        pageIndex: next?.pageIndex ?? auditPageIndex,
        pageSize: DEFAULT_PAGE_SIZE,
        traceId: next?.traceId ?? traceId,
        actorId: next?.actorId ?? actorId,
        actionCode: next?.actionCode ?? actionCode,
        pageId: next?.pageId ?? pageId
      });
      setAuditPage(payload);
      setAuditPageIndex(Number(payload.pageIndex || next?.pageIndex || 1));
    } finally {
      setLoading(false);
    }
  }

  async function loadTrace(next?: {
    traceId?: string;
    pageId?: string;
    componentId?: string;
    functionId?: string;
    apiId?: string;
    eventType?: string;
    resultCode?: string;
    searchKeyword?: string;
    pageIndex?: number;
  }) {
    logGovernanceScope("ACTION", "observability-trace-search", {
      traceId: next?.traceId ?? traceId,
      pageId: next?.pageId ?? pageId,
      componentId: next?.componentId ?? componentId,
      functionId: next?.functionId ?? functionId,
      apiId: next?.apiId ?? apiId,
      eventType: next?.eventType ?? eventType,
      resultCode: next?.resultCode ?? resultCode,
      searchKeyword: next?.searchKeyword ?? searchKeyword,
      pageIndex: next?.pageIndex ?? tracePageIndex
    });
    setLoading(true);
    try {
      const payload = await fetchTraceEvents({
        pageIndex: next?.pageIndex ?? tracePageIndex,
        pageSize: DEFAULT_PAGE_SIZE,
        traceId: next?.traceId ?? traceId,
        pageId: next?.pageId ?? pageId,
        componentId: next?.componentId ?? componentId,
        functionId: next?.functionId ?? functionId,
        apiId: next?.apiId ?? apiId,
        eventType: next?.eventType ?? eventType,
        resultCode: next?.resultCode ?? resultCode,
        searchKeyword: next?.searchKeyword ?? searchKeyword
      });
      setTracePage(payload);
      setTracePageIndex(Number(payload.pageIndex || next?.pageIndex || 1));
    } finally {
      setLoading(false);
    }
  }

  async function loadUnified(next?: { tab?: UnifiedLogTab; pageIndex?: number }) {
    const effectiveTab = next?.tab ?? unifiedTab;
    const effectiveLogType = unifiedPreset.logType || "";
    const effectiveDetailType = unifiedPreset.detailType || eventType;
    logGovernanceScope("ACTION", "unified-log-search", {
      tab: effectiveTab,
      logType: effectiveLogType,
      traceId,
      targetType,
      targetId,
      actorId,
      actionCode,
      pageId,
      componentId,
      functionId,
      apiId,
      eventType: effectiveDetailType,
      resultCode,
      searchKeyword,
      pageIndex: next?.pageIndex ?? unifiedPageIndex
    });
    setLoading(true);
    try {
      const payload = await fetchUnifiedLog({
        pageIndex: next?.pageIndex ?? unifiedPageIndex,
        pageSize: DEFAULT_PAGE_SIZE,
        tab: effectiveTab,
        logType: effectiveLogType,
        traceId,
        targetType,
        targetId,
        actorId,
        actionCode,
        pageId,
        componentId,
        functionId,
        apiId,
        detailType: effectiveDetailType,
        resultCode,
        searchKeyword
      });
      setUnifiedPage(payload);
      setUnifiedPageIndex(next?.pageIndex ?? 1);
    } finally {
      setLoading(false);
    }
  }

  function syncUnifiedLogUrl(nextTab: UnifiedLogTab) {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("tab", nextTab);
    if (projectId) url.searchParams.set("projectId", projectId); else url.searchParams.delete("projectId");
    if (traceId) url.searchParams.set("traceId", traceId); else url.searchParams.delete("traceId");
    if (targetType) url.searchParams.set("targetType", targetType); else url.searchParams.delete("targetType");
    if (targetId) url.searchParams.set("targetId", targetId); else url.searchParams.delete("targetId");
    if (actorId) url.searchParams.set("actorId", actorId); else url.searchParams.delete("actorId");
    if (actionCode) url.searchParams.set("actionCode", actionCode); else url.searchParams.delete("actionCode");
    if (pageId) url.searchParams.set("pageId", pageId); else url.searchParams.delete("pageId");
    if (componentId) url.searchParams.set("componentId", componentId); else url.searchParams.delete("componentId");
    if (functionId) url.searchParams.set("functionId", functionId); else url.searchParams.delete("functionId");
    if (apiId) url.searchParams.set("apiId", apiId); else url.searchParams.delete("apiId");
    const effectiveDetailType = unifiedPreset.detailType || eventType;
    const effectiveLogType = unifiedPreset.logType || "";
    if (effectiveDetailType) url.searchParams.set("eventType", effectiveDetailType); else url.searchParams.delete("eventType");
    if (effectiveLogType) url.searchParams.set("logType", effectiveLogType); else url.searchParams.delete("logType");
    if (resultCode) url.searchParams.set("resultCode", resultCode); else url.searchParams.delete("resultCode");
    if (searchKeyword) url.searchParams.set("searchKeyword", searchKeyword); else url.searchParams.delete("searchKeyword");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function applyUnifiedTab(nextTab: UnifiedLogTab) {
    setUnifiedTab(nextTab);
    setUnifiedPageIndex(1);
    syncUnifiedLogUrl(nextTab);
    loadUnified({ tab: nextTab, pageIndex: 1 }).catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    if (isUnifiedLogPage && unifiedPreset.detailType && eventType !== unifiedPreset.detailType) {
      setEventType(unifiedPreset.detailType);
    }
    if (isUnifiedLogPage && unifiedPreset.tab !== "all" && unifiedTab !== unifiedPreset.tab) {
      setUnifiedTab(unifiedPreset.tab);
    }
    const loader = isUnifiedLogPage
      ? loadUnified()
      : Promise.all([loadAudit(), loadTrace()]);
    Promise.resolve(loader).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    logGovernanceScope("PAGE", "observability", {
      route: window.location.pathname,
      tab: isUnifiedLogPage ? unifiedTab : tab,
      traceId,
      targetType,
      targetId,
      pageId,
      actorId,
      actionCode,
      componentId,
      functionId,
      apiId
    });
    logGovernanceScope("COMPONENT", isUnifiedLogPage ? "unified-log-table" : tab === "audit" ? "observability-audit-table" : "observability-trace-table", {
      component: isUnifiedLogPage ? "unified-log-table" : tab === "audit" ? "observability-audit-table" : "observability-trace-table",
      rowCount: Number(isUnifiedLogPage ? unifiedPage?.items?.length || 0 : tab === "audit" ? auditPage?.items?.length || 0 : tracePage?.items?.length || 0),
      totalCount: Number(isUnifiedLogPage ? unifiedPage?.totalCount || 0 : tab === "audit" ? auditPage?.totalCount || 0 : tracePage?.totalCount || 0)
    });
  }, [actionCode, actorId, apiId, auditPage?.items?.length, auditPage?.totalCount, componentId, functionId, isUnifiedLogPage, pageId, tab, targetId, targetType, traceId, tracePage?.items?.length, tracePage?.totalCount, unifiedPage?.items?.length, unifiedPage?.totalCount, unifiedTab]);

  useEffect(() => {
    if (!isUnifiedLogPage) {
      setSelectedUnifiedLogId("");
      return;
    }
    if (!unifiedItems.length) {
      setSelectedUnifiedLogId("");
      return;
    }
    setSelectedUnifiedLogId((current) => {
      if (current && unifiedItems.some((item, index) => `${String(item.logId || "unified")}-${index}` === current)) {
        return current;
      }
      return `${String(unifiedItems[0].logId || "unified")}-0`;
    });
  }, [isUnifiedLogPage, unifiedItems]);

  function moveToTrace(trace: string) {
    if (isUnifiedLogPage) {
      setTraceId(trace);
      applyUnifiedTab("trace");
      return;
    }
    setTraceId(trace);
    setTab("trace");
    loadTrace({ traceId: trace }).catch((err: Error) => setError(err.message));
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: isUnifiedLogPage ? (en ? "Unified Log" : unifiedPreset.label) : (en ? "Audit Log" : "감사 로그") }
      ]}
      title={isUnifiedLogPage ? (en ? "Unified Log" : unifiedPreset.label) : (en ? "Audit Log" : "감사 로그")}
      subtitle={isUnifiedLogPage
        ? (en ? "Search access, audit, error, and trace events through one common log contract." : unifiedPreset.subtitle)
        : (en ? "Search audit logs first, then follow the related trace events." : "감사 로그를 중심으로 조회하고 필요한 경우 추적 이벤트를 이어서 확인합니다.")}
      contextStrip={
        <ContextKeyStrip items={verifyRuntimeContextKeys} />
      }
    >
      {error ? <PageStatusNotice tone="error">조회 중 오류: {error}</PageStatusNotice> : null}
      <AdminWorkspacePageFrame>
      {isUnifiedLogPage && projectId ? (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <MemberButton
            type="button"
            variant="secondary"
            onClick={() => {
              window.location.assign(`${buildLocalizedPath("/admin/system/version", "/en/admin/system/version")}?projectId=${encodeURIComponent(projectId)}`);
            }}
          >
            {en ? "Back To Version Management" : "버전 관리로 돌아가기"}
          </MemberButton>
        </div>
      ) : null}
      {isUnifiedLogPage && (targetType || targetId) ? (
        <PageStatusNotice tone="info">
          {en
            ? `Version-governance evidence context is active. projectId=${projectId || "-"}, targetType=${targetType || "-"}, targetId=${targetId || "-"}.`
            : `버전 거버넌스 증거 문맥이 적용되었습니다. projectId=${projectId || "-"}, targetType=${targetType || "-"}, targetId=${targetId || "-"}.`}
        </PageStatusNotice>
      ) : null}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard title={isUnifiedLogPage ? (en ? "Unified Rows" : "통합 로그 건수") : (en ? "Visible Rows" : "조회 건수")} value={Number(isUnifiedLogPage ? unifiedPage?.totalCount || 0 : tab === "audit" ? auditPage?.totalCount || 0 : tracePage?.totalCount || 0).toLocaleString()} description={en ? "Current search total" : "현재 검색 총 건수"} />
        <SummaryMetricCard title={en ? "Trace IDs" : "고유 traceId"} value={uniqueTraceCount.toLocaleString()} description={en ? "Visible trace groups" : "현재 화면의 trace 묶음"} />
        <SummaryMetricCard title={en ? "Pages / APIs" : "화면 / API"} value={`${uniquePageCount.toLocaleString()} / ${uniqueApiCount.toLocaleString()}`} description={en ? "Observed pageId and apiId" : "관찰된 pageId와 apiId"} />
        {isUnifiedLogPage && evidenceContextLabel ? (
          <SummaryMetricCard
            title={en ? "Evidence Target" : "증거 대상"}
            value={targetType || "-"}
            description={targetId || "-"}
          />
        ) : (
          <SummaryMetricCard title={en ? "Error-like Events" : "오류 계열 이벤트"} value={errorLikeCount.toLocaleString()} description={en ? "Fail or error signals" : "실패 또는 오류 신호"} />
        )}
      </section>
      <CollectionResultPanel description={isUnifiedLogPage ? (en ? "Move between access, audit, error, and trace slices through one common log contract." : "하나의 공통 로그 계약으로 접속, 감사, 오류, 추적 슬라이스를 전환합니다.") : (en ? "Audit-first investigation stays linked to trace follow-up through shared IDs." : "감사 중심 조회와 추적 후속 확인을 공통 ID로 연결합니다.")} title={isUnifiedLogPage ? (en ? "Unified log workflow" : "통합 로그 운영 흐름") : (en ? "Observability workflow" : "관측 운영 흐름")}>
        {isUnifiedLogPage && evidenceContextLabel
          ? (en
            ? `Current version-governance evidence target: ${evidenceContextLabel}. Keep filters, tab changes, and selected event detail in one workspace so investigation context remains stable.`
            : `현재 버전 거버넌스 증거 대상: ${evidenceContextLabel}. 필터, 탭 전환, 선택 이벤트 상세를 한 작업 공간에 두어 조사 컨텍스트가 끊기지 않게 유지합니다.`)
          : (en ? "Keep filters, tab changes, and selected event detail in one workspace so investigation context remains stable." : "필터, 탭 전환, 선택 이벤트 상세를 한 작업 공간에 두어 조사 컨텍스트가 끊기지 않게 유지합니다.")}
      </CollectionResultPanel>

      {isTraceFocusedUnifiedPage ? (
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="unified-trace-summary">
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">조회 이벤트</p>
            <p className="mt-3 text-3xl font-black text-[var(--kr-gov-blue)]">{Number(unifiedPage?.totalCount || 0).toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">현재 조건으로 조회된 추적 이벤트 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">고유 traceId</p>
            <p className="mt-3 text-3xl font-black text-emerald-700">{uniqueTraceCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">화면 흐름을 구성하는 개별 추적 묶음</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">API 연계 이벤트</p>
            <p className="mt-3 text-3xl font-black text-amber-600">{apiEventCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">API 호출이 연결된 trace 이벤트 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">오류/실패 흔적</p>
            <p className="mt-3 text-3xl font-black text-red-600">{errorLikeCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">실패 결과 또는 오류 계열 detailType 수</p>
          </article>
        </section>
      ) : null}

      {isPageEventFocusedUnifiedPage ? (
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="unified-page-event-summary">
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">조회 이벤트</p>
            <p className="mt-3 text-3xl font-black text-[var(--kr-gov-blue)]">{Number(unifiedPage?.totalCount || 0).toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">현재 조건으로 조회된 페이지 이벤트 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">PAGE_VIEW</p>
            <p className="mt-3 text-3xl font-black text-emerald-700">{pageViewCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">페이지 진입 이벤트 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">PAGE_LEAVE</p>
            <p className="mt-3 text-3xl font-black text-amber-600">{pageLeaveCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">페이지 이탈 이벤트 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">고유 pageId</p>
            <p className="mt-3 text-3xl font-black text-fuchsia-700">{uniquePageCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">현재 조건에서 관찰된 화면 수</p>
          </article>
        </section>
      ) : null}

      {isApiTraceFocusedUnifiedPage ? (
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="unified-api-trace-summary">
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">조회 이벤트</p>
            <p className="mt-3 text-3xl font-black text-[var(--kr-gov-blue)]">{Number(unifiedPage?.totalCount || 0).toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">현재 조건으로 조회된 API 추적 이벤트 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">API_REQUEST</p>
            <p className="mt-3 text-3xl font-black text-emerald-700">{apiRequestCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">호출 시작 이벤트 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">API_RESPONSE</p>
            <p className="mt-3 text-3xl font-black text-amber-600">{apiResponseCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">응답 완료 이벤트 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">고유 apiId</p>
            <p className="mt-3 text-3xl font-black text-fuchsia-700">{uniqueApiCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">현재 조건에서 관찰된 API 수</p>
          </article>
        </section>
      ) : null}

      {isUiErrorFocusedUnifiedPage ? (
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="unified-ui-error-summary">
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">조회 이벤트</p>
            <p className="mt-3 text-3xl font-black text-[var(--kr-gov-blue)]">{Number(unifiedPage?.totalCount || 0).toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">현재 조건으로 조회된 UI 오류 이벤트 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">UI/렌더 오류</p>
            <p className="mt-3 text-3xl font-black text-red-600">{uiErrorCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">UI_ERROR, WINDOW_ERROR, REACT_ERROR_BOUNDARY 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">Unhandled Rejection</p>
            <p className="mt-3 text-3xl font-black text-amber-600">{rejectionCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">Promise rejection 계열 이벤트 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">고유 componentId</p>
            <p className="mt-3 text-3xl font-black text-fuchsia-700">{uniqueComponentCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">오류가 보고된 컴포넌트 수</p>
          </article>
        </section>
      ) : null}

      {isLayoutRenderFocusedUnifiedPage ? (
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="unified-layout-render-summary">
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">조회 이벤트</p>
            <p className="mt-3 text-3xl font-black text-[var(--kr-gov-blue)]">{Number(unifiedPage?.totalCount || 0).toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">현재 조건으로 조회된 레이아웃 렌더 이벤트 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">고유 pageId</p>
            <p className="mt-3 text-3xl font-black text-emerald-700">{uniquePageCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">렌더가 발생한 화면 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">고유 componentId</p>
            <p className="mt-3 text-3xl font-black text-amber-600">{uniqueComponentCount.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">렌더에 참여한 컴포넌트 수</p>
          </article>
          <article className="gov-card">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">평균 렌더 소요</p>
            <p className="mt-3 text-3xl font-black text-fuchsia-700">{averageDurationMs ? `${averageDurationMs}ms` : "-"}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">측정 가능한 이벤트 기준 평균 소요시간</p>
          </article>
        </section>
      ) : null}

      {isTraceFocusedUnifiedPage ? (
        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]" data-help-id="unified-trace-ops">
          <article className="gov-card">
            <h3 className="text-lg font-bold">추적 로그 운영 가이드</h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">1. traceId를 먼저 고정하고 pageId, functionId, apiId 순서로 범위를 줄입니다.</div>
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">2. 오류 건은 결과코드와 detailType을 같이 보고, 같은 traceId의 직전 UI/API 이벤트를 이어서 확인합니다.</div>
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">3. 장시간 이벤트는 평균 소요와 비교해 병목 후보를 먼저 좁힙니다.</div>
            </div>
          </article>
          <article className="gov-card">
            <h3 className="text-lg font-bold">선택 이벤트 상세</h3>
            {selectedUnifiedItem ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">traceId</p>
                  <p className="mt-2 font-mono text-sm">{String(selectedUnifiedItem.traceId || "-")}</p>
                  <p className="mt-3 text-lg font-bold">{String(selectedUnifiedItem.detailType || selectedUnifiedItem.logType || "-")}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">페이지/기능</p>
                    <p className="mt-2 text-sm">{String(selectedUnifiedItem.pageId || "-")}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{String(selectedUnifiedItem.componentId || "-")} / {String(selectedUnifiedItem.functionId || "-")}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">API/결과</p>
                    <p className="mt-2 text-sm">{String(selectedUnifiedItem.apiId || "-")}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{String(selectedUnifiedItem.resultCode || "-")} / {typeof selectedUnifiedItem.durationMs === "number" ? `${selectedUnifiedItem.durationMs}ms` : "-"}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4">
                  <p className="text-xs font-bold text-blue-700">요약</p>
                  <p className="mt-2 text-sm leading-6 text-blue-900">{String(selectedUnifiedItem.summary || selectedUnifiedItem.message || "-")}</p>
                </div>
                <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
                  요청 URI: <span className="font-mono">{String(selectedUnifiedItem.requestUri || "-")}</span>
                  <br />
                  사용자: <span className="font-mono">{String(selectedUnifiedItem.actorId || "-")}</span>
                  <br />
                  평균 소요 비교: <span className="font-mono">{averageDurationMs ? `${averageDurationMs}ms` : "-"}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-sm text-[var(--kr-gov-text-secondary)]">선택된 이벤트가 없습니다.</div>
            )}
          </article>
        </section>
      ) : null}

      {isPageEventFocusedUnifiedPage ? (
        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]" data-help-id="unified-page-event-ops">
          <article className="gov-card">
            <h3 className="text-lg font-bold">페이지 이벤트 운영 가이드</h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">1. pageId를 먼저 고정한 뒤 traceId로 같은 사용자 흐름을 묶어 확인합니다.</div>
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">2. PAGE_VIEW 대비 PAGE_LEAVE 비율이 낮으면 화면 이탈 누락이나 비정상 종료를 의심합니다.</div>
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">3. 같은 pageId에서 actorId, requestUri를 같이 보면 유입 경로와 이탈 경로를 좁히기 쉽습니다.</div>
            </div>
          </article>
          <article className="gov-card">
            <h3 className="text-lg font-bold">선택 이벤트 상세</h3>
            {selectedUnifiedItem ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">pageId</p>
                  <p className="mt-2 font-mono text-sm">{String(selectedUnifiedItem.pageId || "-")}</p>
                  <p className="mt-3 text-lg font-bold">{String(selectedUnifiedItem.detailType || "-")}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">trace/사용자</p>
                    <p className="mt-2 text-sm">{String(selectedUnifiedItem.traceId || "-")}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{String(selectedUnifiedItem.actorId || "-")} / {String(selectedUnifiedItem.actorRole || "-")}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">요청 URI/결과</p>
                    <p className="mt-2 text-sm">{String(selectedUnifiedItem.requestUri || "-")}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{String(selectedUnifiedItem.resultCode || "-")} / {typeof selectedUnifiedItem.durationMs === "number" ? `${selectedUnifiedItem.durationMs}ms` : "-"}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4">
                  <p className="text-xs font-bold text-blue-700">이벤트 요약</p>
                  <p className="mt-2 text-sm leading-6 text-blue-900">{String(selectedUnifiedItem.summary || selectedUnifiedItem.message || "-")}</p>
                </div>
                <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
                  componentId: <span className="font-mono">{String(selectedUnifiedItem.componentId || "-")}</span>
                  <br />
                  functionId: <span className="font-mono">{String(selectedUnifiedItem.functionId || "-")}</span>
                  <br />
                  고유 pageId 수: <span className="font-mono">{uniquePageCount.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-sm text-[var(--kr-gov-text-secondary)]">선택된 이벤트가 없습니다.</div>
            )}
          </article>
        </section>
      ) : null}

      {isApiTraceFocusedUnifiedPage ? (
        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]" data-help-id="unified-api-trace-ops">
          <article className="gov-card">
            <h3 className="text-lg font-bold">API 추적 운영 가이드</h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">1. apiId를 먼저 고정한 뒤 traceId와 pageId로 호출이 시작된 화면을 확인합니다.</div>
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">2. API_REQUEST는 있는데 API_RESPONSE가 부족하면 중간 실패나 타임아웃을 먼저 의심합니다.</div>
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">3. 평균 소요보다 큰 응답은 resultCode와 requestUri를 같이 보고 병목 호출을 좁힙니다.</div>
            </div>
          </article>
          <article className="gov-card">
            <h3 className="text-lg font-bold">선택 이벤트 상세</h3>
            {selectedUnifiedItem ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">apiId</p>
                  <p className="mt-2 font-mono text-sm">{String(selectedUnifiedItem.apiId || "-")}</p>
                  <p className="mt-3 text-lg font-bold">{String(selectedUnifiedItem.detailType || "-")}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">trace/page</p>
                    <p className="mt-2 text-sm">{String(selectedUnifiedItem.traceId || "-")}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{String(selectedUnifiedItem.pageId || "-")} / {String(selectedUnifiedItem.functionId || "-")}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">결과/지연</p>
                    <p className="mt-2 text-sm">{String(selectedUnifiedItem.resultCode || "-")}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{typeof selectedUnifiedItem.durationMs === "number" ? `${selectedUnifiedItem.durationMs}ms` : "-"} / 평균 {averageDurationMs ? `${averageDurationMs}ms` : "-"}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4">
                  <p className="text-xs font-bold text-blue-700">요청 URI / 요약</p>
                  <p className="mt-2 font-mono text-sm text-blue-900">{String(selectedUnifiedItem.requestUri || "-")}</p>
                  <p className="mt-2 text-sm leading-6 text-blue-900">{String(selectedUnifiedItem.summary || selectedUnifiedItem.message || "-")}</p>
                </div>
                <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
                  actorId: <span className="font-mono">{String(selectedUnifiedItem.actorId || "-")}</span>
                  <br />
                  componentId: <span className="font-mono">{String(selectedUnifiedItem.componentId || "-")}</span>
                  <br />
                  고유 apiId 수: <span className="font-mono">{uniqueApiCount.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-sm text-[var(--kr-gov-text-secondary)]">선택된 이벤트가 없습니다.</div>
            )}
          </article>
        </section>
      ) : null}

      {isUiErrorFocusedUnifiedPage ? (
        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]" data-help-id="unified-ui-error-ops">
          <article className="gov-card">
            <h3 className="text-lg font-bold">UI 오류 운영 가이드</h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">1. detailType으로 오류 성격을 먼저 나누고 pageId, componentId로 화면 범위를 좁힙니다.</div>
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">2. 같은 traceId에서 직전 API/페이지 이벤트를 함께 보면 재현 경로를 빠르게 찾을 수 있습니다.</div>
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">3. FRONTEND_REPORT와 UI_ERROR가 함께 있으면 사용자 보고와 실제 런타임 오류를 같이 비교합니다.</div>
            </div>
          </article>
          <article className="gov-card">
            <h3 className="text-lg font-bold">선택 이벤트 상세</h3>
            {selectedUnifiedItem ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">detailType</p>
                  <p className="mt-2 font-mono text-sm">{String(selectedUnifiedItem.detailType || "-")}</p>
                  <p className="mt-3 text-lg font-bold">{String(selectedUnifiedItem.pageId || "-")}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">component/trace</p>
                    <p className="mt-2 text-sm">{String(selectedUnifiedItem.componentId || "-")}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{String(selectedUnifiedItem.traceId || "-")} / {String(selectedUnifiedItem.functionId || "-")}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">결과/사용자</p>
                    <p className="mt-2 text-sm">{String(selectedUnifiedItem.resultCode || "-")}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{String(selectedUnifiedItem.actorId || "-")} / {String(selectedUnifiedItem.requestUri || "-")}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4">
                  <p className="text-xs font-bold text-red-700">오류 요약</p>
                  <p className="mt-2 text-sm leading-6 text-red-900">{String(selectedUnifiedItem.summary || selectedUnifiedItem.message || "-")}</p>
                </div>
                <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
                  apiId: <span className="font-mono">{String(selectedUnifiedItem.apiId || "-")}</span>
                  <br />
                  duration: <span className="font-mono">{typeof selectedUnifiedItem.durationMs === "number" ? `${selectedUnifiedItem.durationMs}ms` : "-"}</span>
                  <br />
                  고유 componentId 수: <span className="font-mono">{uniqueComponentCount.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-sm text-[var(--kr-gov-text-secondary)]">선택된 이벤트가 없습니다.</div>
            )}
          </article>
        </section>
      ) : null}

      {isLayoutRenderFocusedUnifiedPage ? (
        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]" data-help-id="unified-layout-render-ops">
          <article className="gov-card">
            <h3 className="text-lg font-bold">레이아웃 렌더 운영 가이드</h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">1. pageId를 먼저 고정한 뒤 componentId와 functionId로 렌더 책임 구간을 줄입니다.</div>
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">2. 평균 렌더 소요보다 큰 이벤트는 같은 traceId의 직전 액션과 같이 봐야 원인을 좁히기 쉽습니다.</div>
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">3. 같은 pageId에서 componentId가 과도하게 많으면 화면 구조 변경이나 반복 렌더를 먼저 의심합니다.</div>
            </div>
          </article>
          <article className="gov-card">
            <h3 className="text-lg font-bold">선택 이벤트 상세</h3>
            {selectedUnifiedItem ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">pageId</p>
                  <p className="mt-2 font-mono text-sm">{String(selectedUnifiedItem.pageId || "-")}</p>
                  <p className="mt-3 text-lg font-bold">{String(selectedUnifiedItem.detailType || "-")}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">component/function</p>
                    <p className="mt-2 text-sm">{String(selectedUnifiedItem.componentId || "-")}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{String(selectedUnifiedItem.functionId || "-")} / {String(selectedUnifiedItem.traceId || "-")}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">소요/결과</p>
                    <p className="mt-2 text-sm">{typeof selectedUnifiedItem.durationMs === "number" ? `${selectedUnifiedItem.durationMs}ms` : "-"}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{String(selectedUnifiedItem.resultCode || "-")} / 평균 {averageDurationMs ? `${averageDurationMs}ms` : "-"}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4">
                  <p className="text-xs font-bold text-blue-700">렌더 요약</p>
                  <p className="mt-2 text-sm leading-6 text-blue-900">{String(selectedUnifiedItem.summary || selectedUnifiedItem.message || "-")}</p>
                </div>
                <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
                  actorId: <span className="font-mono">{String(selectedUnifiedItem.actorId || "-")}</span>
                  <br />
                  requestUri: <span className="font-mono">{String(selectedUnifiedItem.requestUri || "-")}</span>
                  <br />
                  고유 functionId 수: <span className="font-mono">{uniqueFunctionCount.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-sm text-[var(--kr-gov-text-secondary)]">선택된 이벤트가 없습니다.</div>
            )}
          </article>
        </section>
      ) : null}

      <div className="gov-card mb-8" data-help-id="observability-filters">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <MemberSectionToolbar
            actions={(
              <div className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                {isUnifiedLogPage ? unifiedPreset.label : tab === "audit" ? "감사 로그" : "추적 이벤트"}
              </div>
            )}
            meta={isUnifiedLogPage ? "로그 유형, traceId, 페이지, 액션 기준으로 공통 로그를 좁힙니다." : "traceId와 pageId를 공통 기준으로 좁히고, 감사 로그와 추적 이벤트를 탭으로 나눠 확인합니다."}
            title="검색 조건"
          />
        </div>
        {isUnifiedLogPage ? (
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-4">
            <div className="flex flex-wrap gap-2">
              {UNIFIED_LOG_PRESETS.map((preset) => (
                <MemberButton
                  key={preset.pathSuffix}
                  type="button"
                  variant={unifiedPreset.pathSuffix === preset.pathSuffix ? "primary" : "secondary"}
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.location.href = preset.pathSuffix;
                    }
                  }}
                >
                  {preset.label}
                </MemberButton>
              ))}
            </div>
          </div>
        ) : null}
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {isUnifiedLogPage ? (
              <>
                <MemberButton onClick={() => applyUnifiedTab("all")} type="button" variant={unifiedTab === "all" ? "primary" : "secondary"}>전체</MemberButton>
                <MemberButton onClick={() => applyUnifiedTab("access-auth")} type="button" variant={unifiedTab === "access-auth" ? "primary" : "secondary"}>접속/인증</MemberButton>
                <MemberButton onClick={() => applyUnifiedTab("audit")} type="button" variant={unifiedTab === "audit" ? "primary" : "secondary"}>감사</MemberButton>
                <MemberButton onClick={() => applyUnifiedTab("error")} type="button" variant={unifiedTab === "error" ? "primary" : "secondary"}>오류</MemberButton>
                <MemberButton onClick={() => applyUnifiedTab("trace")} type="button" variant={unifiedTab === "trace" ? "primary" : "secondary"}>추적</MemberButton>
              </>
            ) : (
              <>
                <MemberButton onClick={() => setTab("audit")} type="button" variant={tab === "audit" ? "primary" : "secondary"}>감사 로그</MemberButton>
                <MemberButton onClick={() => setTab("trace")} type="button" variant={tab === "trace" ? "primary" : "secondary"}>추적 이벤트</MemberButton>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-4" data-help-id="observability-search-panel">
          <div>
            <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">traceId</span>
            <AdminInput value={traceId} onChange={(e) => setTraceId(e.target.value)} />
          </div>
          <div>
            <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">pageId</span>
            <AdminInput value={pageId} onChange={(e) => setPageId(e.target.value)} />
          </div>
          {isUnifiedLogPage ? (
            <>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">projectId</span>
                <AdminInput value={projectId} onChange={(e) => setProjectId(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">actorId</span>
                <AdminInput value={actorId} onChange={(e) => setActorId(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">targetType</span>
                <AdminInput value={targetType} onChange={(e) => setTargetType(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">targetId</span>
                <AdminInput value={targetId} onChange={(e) => setTargetId(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">actionCode</span>
                <AdminInput value={actionCode} onChange={(e) => setActionCode(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">apiId</span>
                <AdminInput value={apiId} onChange={(e) => setApiId(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">event/detail</span>
                <AdminInput disabled={Boolean(unifiedPreset.detailType)} value={eventType} onChange={(e) => setEventType(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">functionId</span>
                <AdminInput value={functionId} onChange={(e) => setFunctionId(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">componentId</span>
                <AdminInput value={componentId} onChange={(e) => setComponentId(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">resultCode</span>
                <AdminInput value={resultCode} onChange={(e) => setResultCode(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">검색어</span>
                <AdminInput value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} />
              </div>
            </>
          ) : tab === "audit" ? (
            <>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">actorId</span>
                <AdminInput value={actorId} onChange={(e) => setActorId(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">actionCode</span>
                <AdminInput value={actionCode} onChange={(e) => setActionCode(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">apiId</span>
                <AdminInput value={apiId} onChange={(e) => setApiId(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">eventType</span>
                <AdminInput value={eventType} onChange={(e) => setEventType(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">functionId</span>
                <AdminInput value={functionId} onChange={(e) => setFunctionId(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">componentId</span>
                <AdminInput value={componentId} onChange={(e) => setComponentId(e.target.value)} />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">resultCode</span>
                <AdminInput value={resultCode} onChange={(e) => setResultCode(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">검색어</span>
                <AdminInput value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} />
              </div>
            </>
          )}
          <div className="md:col-span-4">
            <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                {isUnifiedLogPage
                  ? `${unifiedPreset.label}를 공통 컬럼으로 시간 역순 조회합니다.`
                  : tab === "audit"
                  ? "감사 로그를 시간 역순으로 보고 traceId를 눌러 관련 추적 이벤트로 이동합니다."
                  : "추적 이벤트는 페이지, 컴포넌트, API 흐름을 세부적으로 확인할 때 사용합니다."}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <MemberButton
                  onClick={() => {
                    if (isUnifiedLogPage) {
                      setUnifiedPageIndex(1);
                      loadUnified({ pageIndex: 1 }).catch((err: Error) => setError(err.message));
                    } else if (tab === "audit") {
                      setAuditPageIndex(1);
                      loadAudit({ pageIndex: 1 }).catch((err: Error) => setError(err.message));
                    } else {
                      setTracePageIndex(1);
                      loadTrace({ pageIndex: 1 }).catch((err: Error) => setError(err.message));
                    }
                  }}
                  type="button"
                  variant="primary"
                >
                  {loading ? "조회 중..." : "검색"}
                </MemberButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div data-help-id="observability-audit-table" hidden={isUnifiedLogPage || tab !== "audit"} />
      <div data-help-id="observability-trace-table" hidden={isUnifiedLogPage || tab !== "trace"} />
      <div data-help-id="unified-log-table" hidden={!isUnifiedLogPage} />
      <div className="gov-card overflow-hidden p-0" data-help-id={isUnifiedLogPage ? "unified-log-table" : tab === "audit" ? "observability-audit-table" : "observability-trace-table"}>
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <MemberSectionToolbar
            meta={isUnifiedLogPage
              ? (evidenceContextLabel
                ? `${evidenceContextLabel} 문맥에서 공통 로그 이벤트를 시간순으로 확인합니다.`
                : "공통 로그 이벤트를 시간순으로 확인합니다.")
              : tab === "audit" ? "감사 이벤트를 시간순으로 확인합니다." : "추적 이벤트를 시간순으로 확인합니다."}
            title={(
              <span className="text-[15px] font-semibold text-[var(--kr-gov-text-primary)]">
                전체 <span className="text-[var(--kr-gov-blue)]">{Number(isUnifiedLogPage ? unifiedPage?.totalCount || 0 : tab === "audit" ? auditPage?.totalCount || 0 : tracePage?.totalCount || 0).toLocaleString()}</span>건
              </span>
            )}
          />
        </div>
        <div className="overflow-x-auto">
          <AdminTable>
            {isUnifiedLogPage ? (
              <>
                <thead>
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-6 py-4">발생 일시</th>
                    <th className="px-6 py-4">유형</th>
                    <th className="px-6 py-4">세부유형</th>
                    <th className="px-6 py-4">사용자</th>
                    <th className="px-6 py-4">페이지/기능</th>
                    <th className="px-6 py-4">대상</th>
                    <th className="px-6 py-4">결과</th>
                    <th className="px-6 py-4">traceId</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(unifiedPage?.items || []).length === 0 ? (
                    <tr><td className="px-6 py-8 text-center text-gray-500" colSpan={8}>조회된 통합 로그가 없습니다.</td></tr>
                  ) : (unifiedPage?.items || []).map((item: UnifiedLogRow, index) => (
                    <tr
                      className={`${selectedUnifiedLogId === `${String(item.logId || "unified")}-${index}` ? "bg-blue-50" : "transition-colors hover:bg-gray-50/50"}`}
                      key={`${String(item.logId || "unified")}-${index}`}
                      onClick={() => setSelectedUnifiedLogId(`${String(item.logId || "unified")}-${index}`)}
                    >
                      <td className="px-6 py-4 text-gray-600">{String(item.occurredAt || "-")}</td>
                      <td className="px-6 py-4 text-[var(--kr-gov-text-primary)]">{String(item.logType || "-")}</td>
                      <td className="px-6 py-4 text-gray-600">{String(item.detailType || "-")}</td>
                      <td className="px-6 py-4 text-[var(--kr-gov-text-primary)]">{String(item.actorId || "-")}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {String(item.pageId || "-")}
                        {item.functionId ? ` / ${String(item.functionId)}` : ""}
                        {item.apiId ? ` / ${String(item.apiId)}` : ""}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {String(item.targetId || item.requestUri || "-")}
                        {item.summary ? <div className="mt-1 text-xs text-slate-500">{String(item.summary)}</div> : null}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{String(item.resultCode || "-")}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {item.traceId ? (
                          <button className="font-semibold text-[var(--kr-gov-blue)] hover:underline" onClick={() => moveToTrace(String(item.traceId || ""))} type="button">
                            {String(item.traceId || "-")}
                          </button>
                        ) : String(item.traceId || "-")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : tab === "audit" ? (
              <>
                <thead data-help-id="audit-event-table">
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-6 py-4">발생 일시</th>
                    <th className="px-6 py-4">traceId</th>
                    <th className="px-6 py-4">사용자</th>
                    <th className="px-6 py-4">행위</th>
                    <th className="px-6 py-4">대상</th>
                    <th className="px-6 py-4">결과</th>
                    <th className="px-6 py-4">페이지</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(auditPage?.items || []).length === 0 ? (
                    <tr><td className="px-6 py-8 text-center text-gray-500" colSpan={7}>조회된 감사 로그가 없습니다.</td></tr>
                  ) : (auditPage?.items || []).map((item, index) => (
                    <tr className="transition-colors hover:bg-gray-50/50" key={`${String(item.auditId || "audit")}-${index}`}>
                      <td className="px-6 py-4 text-gray-600">{String(item.createdAt || "-")}</td>
                      <td className="px-6 py-4">
                        <button className="font-semibold text-[var(--kr-gov-blue)] hover:underline" onClick={() => moveToTrace(String(item.traceId || ""))} type="button">
                          {String(item.traceId || "-")}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-[var(--kr-gov-text-primary)]">{String(item.actorId || "-")}</td>
                      <td className="px-6 py-4 text-[var(--kr-gov-text-primary)]">{String(item.actionCode || "-")}</td>
                      <td className="px-6 py-4 text-gray-600">{String(item.entityId || "-")}</td>
                      <td className="px-6 py-4 text-gray-600">{String(item.resultStatus || "-")}</td>
                      <td className="px-6 py-4 text-gray-600">{String(item.pageId || "-")}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <>
                <thead data-help-id="trace-event-table">
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-6 py-4">발생 일시</th>
                    <th className="px-6 py-4">traceId</th>
                    <th className="px-6 py-4">페이지</th>
                    <th className="px-6 py-4">컴포넌트</th>
                    <th className="px-6 py-4">함수</th>
                    <th className="px-6 py-4">API</th>
                    <th className="px-6 py-4">이벤트</th>
                    <th className="px-6 py-4">결과</th>
                    <th className="px-6 py-4">소요(ms)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(tracePage?.items || []).length === 0 ? (
                    <tr><td className="px-6 py-8 text-center text-gray-500" colSpan={9}>조회된 추적 이벤트가 없습니다.</td></tr>
                  ) : (tracePage?.items || []).map((item, index) => (
                    <tr className="transition-colors hover:bg-gray-50/50" key={`${String(item.eventId || "trace")}-${index}`}>
                      <td className="px-6 py-4 text-gray-600">{String(item.createdAt || "-")}</td>
                      <td className="px-6 py-4 text-[var(--kr-gov-text-primary)]">{String(item.traceId || "-")}</td>
                      <td className="px-6 py-4 text-gray-600">{String(item.pageId || "-")}</td>
                      <td className="px-6 py-4 text-gray-600">{String(item.componentId || "-")}</td>
                      <td className="px-6 py-4 text-gray-600">{String(item.functionId || "-")}</td>
                      <td className="px-6 py-4 text-gray-600">{String(item.apiId || "-")}</td>
                      <td className="px-6 py-4 text-gray-600">{String(item.eventType || "-")}</td>
                      <td className="px-6 py-4 text-gray-600">{String(item.resultCode || "-")}</td>
                      <td className="px-6 py-4 text-gray-600">{String(item.durationMs || "-")}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </AdminTable>
        </div>
        {isUnifiedLogPage ? (
          <MemberPagination currentPage={unifiedCurrentPage} onPageChange={(pageNumber) => loadUnified({ pageIndex: pageNumber }).catch((err: Error) => setError(err.message))} totalPages={unifiedTotalPages} />
        ) : null}
        {!isUnifiedLogPage && tab === "audit" ? (
          <MemberPagination currentPage={auditCurrentPage} onPageChange={(pageNumber) => loadAudit({ pageIndex: pageNumber }).catch((err: Error) => setError(err.message))} totalPages={auditTotalPages} />
        ) : null}
        {!isUnifiedLogPage && tab === "trace" ? (
          <MemberPagination currentPage={traceCurrentPage} onPageChange={(pageNumber) => loadTrace({ pageIndex: pageNumber }).catch((err: Error) => setError(err.message))} totalPages={traceTotalPages} />
        ) : null}
      </div>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
