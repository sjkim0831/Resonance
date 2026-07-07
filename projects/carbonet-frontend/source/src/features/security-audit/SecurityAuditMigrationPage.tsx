import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchSecurityAuditPage } from "../../lib/api/security";
import { buildSecurityAuditExportUrl } from "../../lib/api/ops";
import { readBootstrappedSecurityAuditPageData } from "../../lib/api/bootstrap";
import type { SecurityAuditPagePayload } from "../../lib/api/securityTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberLinkButton, MemberPagination, MemberSectionToolbar, PageStatusNotice } from "../member/common";
import { ReviewModalFrame } from "../member/sections";

type AuditFilters = {
  pageIndex: number;
  searchKeyword: string;
  actionType: string;
  routeGroup: string;
  startDate: string;
  endDate: string;
  sortKey: string;
  sortDirection: string;
};

type SortableAuditColumn = "AUDIT_AT" | "ACTOR" | "ACTION" | "TARGET";

type SecurityAuditRowView = {
  row: Record<string, unknown>;
  rowKey: string;
  auditAt: string;
  actor: string;
  actorId: string;
  actorType: string;
  insttId: string;
  action: string;
  target: string;
  detail: string;
  actorScope: string;
  targetScope: string;
  contextMode: string;
  reason: string;
  remoteAddr: string;
  responseStatus: number;
  durationMs: number;
  traceId: string;
  requestId: string;
  httpMethod: string;
};

const DEFAULT_FILTERS: AuditFilters = {
  pageIndex: 1,
  searchKeyword: "",
  actionType: "ALL",
  routeGroup: "ALL",
  startDate: "",
  endDate: "",
  sortKey: "AUDIT_AT",
  sortDirection: "DESC"
};

function readInitialFilters(): AuditFilters {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  const params = new URLSearchParams(window.location.search);
  return {
    pageIndex: Number(params.get("pageIndex") || "1") || 1,
    searchKeyword: params.get("searchKeyword") || "",
    actionType: params.get("actionType") || "ALL",
    routeGroup: params.get("routeGroup") || "ALL",
    startDate: params.get("startDate") || "",
    endDate: params.get("endDate") || "",
    sortKey: params.get("sortKey") || "AUDIT_AT",
    sortDirection: params.get("sortDirection") || "DESC"
  };
}

function stringOf(row: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!row) {
    return "";
  }
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined) {
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
  }
  return "";
}

function actionTone(action: string) {
  const normalized = action.toLowerCase();
  if (normalized.includes("blocked") || normalized.includes("차단")) {
    return "bg-red-100 text-red-700";
  }
  if (normalized.includes("allowed") || normalized.includes("허용")) {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-slate-100 text-slate-700";
}

function splitActor(actor: string) {
  const [identityPart = "", insttId = ""] = actor.split(" / ");
  const typeStart = identityPart.indexOf("(");
  const typeEnd = identityPart.lastIndexOf(")");
  if (typeStart >= 0 && typeEnd > typeStart) {
    return {
      actorId: identityPart.slice(0, typeStart).trim(),
      actorType: identityPart.slice(typeStart + 1, typeEnd).trim(),
      insttId: insttId.trim()
    };
  }
  return {
    actorId: identityPart.trim(),
    actorType: "",
    insttId: insttId.trim()
  };
}

function splitDetail(detail: string) {
  const tokens = detail.split(",").map((token) => token.trim()).filter(Boolean);
  return {
    actorScope: tokens[0] || "-",
    targetScope: tokens[1] || "-",
    contextMode: tokens[2] || "-",
    reason: tokens.slice(3).join(", ") || "-"
  };
}

function currentDateInputValue(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function resolveSortIndicator(active: boolean, direction: string) {
  if (!active) {
    return "unfold_more";
  }
  return direction === "ASC" ? "arrow_upward" : "arrow_downward";
}

function countOf(row: Record<string, unknown> | null | undefined, key: string) {
  return Number(row?.[key] || 0);
}

function sameFilters(left: AuditFilters, right: AuditFilters) {
  return left.pageIndex === right.pageIndex
    && left.searchKeyword === right.searchKeyword
    && left.actionType === right.actionType
    && left.routeGroup === right.routeGroup
    && left.startDate === right.startDate
    && left.endDate === right.endDate
    && left.sortKey === right.sortKey
    && left.sortDirection === right.sortDirection;
}

export function SecurityAuditMigrationPage() {
  const en = isEnglish();
  const initialPayload = useMemo(() => readBootstrappedSecurityAuditPageData(), []);
  const [showDeferredInsights, setShowDeferredInsights] = useState(false);
  const [filters, setFilters] = useState<AuditFilters>(() => readInitialFilters());
  const [draft, setDraft] = useState<AuditFilters>(() => readInitialFilters());
  const [selectedRowKey, setSelectedRowKey] = useState("");
  const pageState = useAsyncValue<SecurityAuditPagePayload>(
    () => fetchSecurityAuditPage(filters),
    [filters.pageIndex, filters.searchKeyword, filters.actionType, filters.routeGroup, filters.startDate, filters.endDate, filters.sortKey, filters.sortDirection],
    {
      initialValue: initialPayload,
      skipInitialLoad: Boolean(initialPayload),
      onSuccess(payload) {
        const next = {
          pageIndex: Number(payload.pageIndex || 1),
          searchKeyword: String(payload.searchKeyword || ""),
          actionType: String(payload.actionType || "ALL"),
          routeGroup: String(payload.routeGroup || "ALL"),
          startDate: String(payload.startDate || ""),
          endDate: String(payload.endDate || ""),
          sortKey: String(payload.sortKey || "AUDIT_AT"),
          sortDirection: String(payload.sortDirection || "DESC")
        };
        setFilters((current) => sameFilters(current, next) ? current : next);
        setDraft((current) => sameFilters(current, next) ? current : next);
      }
    }
  );
  const page = pageState.value;
  const rows = (page?.securityAuditRows || []) as Array<Record<string, unknown>>;
  const summary = (page?.securityAuditSummary || []) as Array<Record<string, unknown>>;
  const repeatedActors = (page?.securityAuditRepeatedActors || []) as Array<Record<string, unknown>>;
  const repeatedTargets = (page?.securityAuditRepeatedTargets || []) as Array<Record<string, unknown>>;
  const repeatedRemoteAddrs = (page?.securityAuditRepeatedRemoteAddrs || []) as Array<Record<string, unknown>>;
  const currentPage = Math.max(1, Number(page?.pageIndex || 1));
  const totalPages = Math.max(1, Number(page?.totalPages || 1));
  const totalCount = Number(page?.totalCount || rows.length);
  const pageSize = Number(page?.pageSize || 10);
  const rowViews = useMemo<SecurityAuditRowView[]>(
    () => rows.map((row, index) => {
      const actor = stringOf(row, "actor");
      const actorParts = splitActor(actor);
      const detail = stringOf(row, "detail");
      const detailParts = splitDetail(detail);
      return {
        row,
        rowKey: `${stringOf(row, "auditAt", "target", "actor")}-${index}`,
        auditAt: stringOf(row, "auditAt"),
        actor,
        actorId: actorParts.actorId,
        actorType: actorParts.actorType,
        insttId: actorParts.insttId,
        action: stringOf(row, "action"),
        target: stringOf(row, "target"),
        detail,
        actorScope: detailParts.actorScope,
        targetScope: detailParts.targetScope,
        contextMode: detailParts.contextMode,
        reason: detailParts.reason,
        remoteAddr: stringOf(row, "remoteAddr"),
        responseStatus: countOf(row, "responseStatus"),
        durationMs: countOf(row, "durationMs"),
        traceId: stringOf(row, "traceId"),
        requestId: stringOf(row, "requestId"),
        httpMethod: stringOf(row, "httpMethod")
      };
    }),
    [rows]
  );
  const repeatedActorSet = useMemo(() => new Set(repeatedActors.map((item) => stringOf(item, "value")).filter(Boolean)), [repeatedActors]);
  const repeatedTargetSet = useMemo(() => new Set(repeatedTargets.map((item) => stringOf(item, "value")).filter(Boolean)), [repeatedTargets]);
  const repeatedRemoteAddrSet = useMemo(() => new Set(repeatedRemoteAddrs.map((item) => stringOf(item, "value")).filter(Boolean)), [repeatedRemoteAddrs]);
  const selectedRow = useMemo(
    () => rowViews.find((row) => row.rowKey === selectedRowKey) || null,
    [rowViews, selectedRowKey]
  );

  useEffect(() => {
    setShowDeferredInsights(false);
    if (typeof window === "undefined") {
      return;
    }
    let cancelled = false;
    const schedule = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (!cancelled) {
          setShowDeferredInsights(true);
        }
      }, 0);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(schedule);
    };
  }, [
    page?.pageIndex,
    page?.totalCount,
    page?.sortKey,
    page?.sortDirection,
    page?.searchKeyword,
    page?.actionType,
    page?.routeGroup,
    page?.startDate,
    page?.endDate
  ]);

  useEffect(() => {
    const nextSearch = new URLSearchParams();
    if (filters.pageIndex > 1) nextSearch.set("pageIndex", String(filters.pageIndex));
    if (filters.searchKeyword) nextSearch.set("searchKeyword", filters.searchKeyword);
    if (filters.actionType !== "ALL") nextSearch.set("actionType", filters.actionType);
    if (filters.routeGroup !== "ALL") nextSearch.set("routeGroup", filters.routeGroup);
    if (filters.startDate) nextSearch.set("startDate", filters.startDate);
    if (filters.endDate) nextSearch.set("endDate", filters.endDate);
    if (filters.sortKey !== "AUDIT_AT") nextSearch.set("sortKey", filters.sortKey);
    if (filters.sortDirection !== "DESC") nextSearch.set("sortDirection", filters.sortDirection);
    const query = nextSearch.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [filters]);

  useEffect(() => {
    function handlePopState() {
      const next = readInitialFilters();
      setFilters(next);
      setDraft(next);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "security-audit", {
      route: window.location.pathname,
      rowCount: rowViews.length,
      totalCount,
      searchKeyword: filters.searchKeyword,
      actionType: filters.actionType,
      routeGroup: filters.routeGroup,
      startDate: filters.startDate,
      endDate: filters.endDate
    });
  }, [filters.actionType, filters.endDate, filters.routeGroup, filters.searchKeyword, filters.startDate, page, rowViews.length, totalCount]);

  useEffect(() => {
    setSelectedRowKey("");
  }, [currentPage, filters.searchKeyword, filters.actionType, filters.routeGroup, filters.startDate, filters.endDate, filters.sortKey, filters.sortDirection]);

  function applyFilters(nextPageIndex = 1) {
    setFilters({
      ...draft,
      pageIndex: nextPageIndex
    });
  }

  function resetFilters() {
    setDraft(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  }

  function applyDatePreset(range: "TODAY" | "LAST_7" | "LAST_30") {
    const today = currentDateInputValue(0);
    const startDate = range === "TODAY"
      ? today
      : range === "LAST_7"
        ? currentDateInputValue(-6)
        : currentDateInputValue(-29);
    const nextDraft = {
      ...draft,
      startDate,
      endDate: today
    };
    setDraft(nextDraft);
    setFilters({
      ...nextDraft,
      pageIndex: 1
    });
  }

  function handleSortChange(sortKey: SortableAuditColumn) {
    const nextDirection = filters.sortKey === sortKey && filters.sortDirection === "DESC" ? "ASC" : "DESC";
    const nextDraft = {
      ...draft,
      sortKey,
      sortDirection: nextDirection
    };
    setDraft(nextDraft);
    setFilters({
      ...nextDraft,
      pageIndex: 1
    });
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Security Audit" : "보안 감사" }
      ]}
      title={en ? "Security Audit Log" : "보안 감사 로그"}
      subtitle={en ? "Review recent block, allow, and route-scope decisions." : "차단, 허용, 경로 스코프 관련 최근 감사 이력을 검토합니다."}
      loading={pageState.loading && !page && !pageState.error}
      loadingLabel={en ? "Loading security audit logs." : "보안 감사 로그를 불러오는 중입니다."}
    >
      {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
      <AdminWorkspacePageFrame>
      {showDeferredInsights ? (
        <>
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryMetricCard title={en ? "Audit Events" : "감사 이벤트"} value={totalCount.toLocaleString()} description={en ? "Filtered total rows" : "현재 필터 기준 총 건수"} />
            <SummaryMetricCard title={en ? "Current Page" : "현재 페이지"} value={`${currentPage} / ${totalPages}`} description={en ? "Server-side pagination" : "서버 기준 페이지"} />
            <SummaryMetricCard title={en ? "Failed Events" : "오류 이벤트"} value={Number(page?.filteredErrorCount || 0).toLocaleString()} description={en ? "Error responses in scope" : "현재 범위 오류 응답"} />
            <SummaryMetricCard title={en ? "Repeated Signals" : "반복 징후"} value={(Number(page?.filteredRepeatedActorCount || 0) + Number(page?.filteredRepeatedTargetCount || 0) + Number(page?.filteredRepeatedRemoteAddrCount || 0)).toLocaleString()} description={en ? "Actor, route, and IP" : "수행자, 경로, IP"} />
          </section>
          <CollectionResultPanel description={en ? "Search, anomaly review, and row-level detail stay in one workspace for policy follow-up." : "검색, 이상 징후 검토, 행 상세를 한 작업 공간에 두고 정책 후속 조치까지 이어갑니다."} title={en ? "Audit operation workflow" : "감사 운영 흐름"}>
            {en ? "Filter first, review repeated patterns next, then open row details to inspect scope and operator reasons." : "먼저 필터로 좁히고, 반복 패턴을 검토한 뒤, 행 상세에서 스코프와 운영 사유를 확인합니다."}
          </CollectionResultPanel>
        </>
      ) : (
        <section className="gov-card mb-8">
          <div className="px-6 py-5 text-sm text-[var(--kr-gov-text-secondary)]">
            {en ? "Loading summary insights." : "요약 인사이트를 불러오는 중입니다."}
          </div>
        </section>
      )}

      <section className="gov-card mb-8" data-help-id="security-audit-filters">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <MemberSectionToolbar
            actions={(
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                {en ? `Page ${currentPage} / ${totalPages}` : `${currentPage} / ${totalPages} 페이지`}
              </span>
            )}
            meta={en ? "Filter by keyword, action type, date range, route group, and sort order." : "검색어, 행위 유형, 기간, 경로 그룹, 정렬 기준으로 감사 로그를 좁혀 봅니다."}
            title={en ? "Search Filters" : "검색 조건"}
          />
        </div>
        <form className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-4" onSubmit={(event) => {
          event.preventDefault();
          applyFilters(1);
        }}>
          <div className="md:col-span-2">
            <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "검색어"}</span>
            <AdminInput value={draft.searchKeyword} onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))} />
          </div>
          <div>
            <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Action Type" : "행위 유형"}</span>
            <AdminSelect value={draft.actionType} onChange={(event) => setDraft((current) => ({ ...current, actionType: event.target.value }))}>
              <option value="ALL">{en ? "All" : "전체"}</option>
              <option value="BLOCKED">{en ? "Blocked" : "차단"}</option>
              <option value="ALLOWED">{en ? "Allowed" : "허용"}</option>
              <option value="REVIEWED">{en ? "Reviewed" : "기타 검토"}</option>
            </AdminSelect>
          </div>
          <div>
            <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Route Group" : "경로 그룹"}</span>
            <AdminSelect value={draft.routeGroup} onChange={(event) => setDraft((current) => ({ ...current, routeGroup: event.target.value }))}>
              <option value="ALL">{en ? "All" : "전체"}</option>
              <option value="BLOCK">{en ? "Block/Deny" : "차단/거부"}</option>
              <option value="POLICY">{en ? "Policy" : "정책"}</option>
            </AdminSelect>
          </div>
          <div>
            <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Start Date" : "시작일"}</span>
            <AdminInput type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} />
          </div>
          <div>
            <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "End Date" : "종료일"}</span>
            <AdminInput type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} />
          </div>
          <div>
            <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Sort Key" : "정렬 기준"}</span>
            <AdminSelect value={draft.sortKey} onChange={(event) => setDraft((current) => ({ ...current, sortKey: event.target.value }))}>
              <option value="AUDIT_AT">{en ? "Audit Time" : "감사 시각"}</option>
              <option value="ACTOR">{en ? "Actor" : "수행자"}</option>
              <option value="ACTION">{en ? "Action" : "행위"}</option>
              <option value="TARGET">{en ? "Target" : "대상"}</option>
            </AdminSelect>
          </div>
          <div>
            <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Sort Direction" : "정렬 방향"}</span>
            <AdminSelect value={draft.sortDirection} onChange={(event) => setDraft((current) => ({ ...current, sortDirection: event.target.value }))}>
              <option value="DESC">{en ? "Descending" : "내림차순"}</option>
              <option value="ASC">{en ? "Ascending" : "오름차순"}</option>
            </AdminSelect>
          </div>
          <div className="md:col-span-4">
            <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                {en ? "Open row details to inspect actor scope, target scope, context mode, and operator reason together." : "행 상세를 열면 수행자 스코프, 대상 스코프, context mode, 운영 사유를 함께 확인할 수 있습니다."}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <MemberButton onClick={() => applyDatePreset("TODAY")} type="button" variant="secondary">
                  {en ? "Today" : "오늘"}
                </MemberButton>
                <MemberButton onClick={() => applyDatePreset("LAST_7")} type="button" variant="secondary">
                  {en ? "Last 7 Days" : "최근 7일"}
                </MemberButton>
                <MemberButton onClick={() => applyDatePreset("LAST_30")} type="button" variant="secondary">
                  {en ? "Last 30 Days" : "최근 30일"}
                </MemberButton>
                <MemberLinkButton href={buildSecurityAuditExportUrl(filters)} icon="download" variant="secondary">
                  {en ? "CSV Export" : "CSV 내보내기"}
                </MemberLinkButton>
                <MemberButton onClick={resetFilters} type="button" variant="secondary">
                  {en ? "Reset" : "초기화"}
                </MemberButton>
                <MemberButton icon="search" type="submit" variant="primary">
                  {en ? "Search" : "조회"}
                </MemberButton>
              </div>
            </div>
          </div>
        </form>
      </section>

      {showDeferredInsights ? (
      <section className="gov-card mb-8" data-help-id="security-audit-summary">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <MemberSectionToolbar
            meta={en ? "Summary cards reflect the latest filtered audit snapshot from the backend." : "요약 카드는 백엔드 필터 결과 기준 최신 감사 스냅샷을 반영합니다."}
            title={en ? "Operational Summary" : "운영 요약"}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-4">
          {summary.length === 0 ? (
            <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)] md:col-span-2 xl:col-span-4">
              {en ? "No security audit summary is available." : "표시할 보안 감사 요약 정보가 없습니다."}
            </div>
          ) : summary.map((card, idx) => (
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-5 py-5 shadow-sm" key={idx}>
              <p className="text-xs font-bold tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{stringOf(card, "title") || "-"}</p>
              <p className="mt-3 text-3xl font-black text-[var(--kr-gov-text-primary)]">{stringOf(card, "value") || "0"}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(card, "description") || "-"}</p>
            </article>
          ))}
        </div>
      </section>
      ) : null}

      {showDeferredInsights ? (
      <section className="gov-card mb-8" data-help-id="security-audit-anomalies">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <MemberSectionToolbar
            meta={en ? "Repeated actors, routes, and slow or failed responses are calculated from the current filter result." : "반복 수행자, 반복 경로, 지연 응답, 오류 응답은 현재 필터 결과 기준으로 계산됩니다."}
            title={en ? "Anomaly Signals" : "이상 징후"}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-5">
          {[
            { title: en ? "Failed Events" : "오류 이벤트", value: Number(page?.filteredErrorCount || 0), tone: "text-red-700" },
            { title: en ? "Slow Events" : "지연 이벤트", value: Number(page?.filteredSlowCount || 0), tone: "text-amber-700" },
            { title: en ? "Repeated Actors" : "반복 수행자", value: Number(page?.filteredRepeatedActorCount || 0), tone: "text-[var(--kr-gov-blue)]" },
            { title: en ? "Repeated Routes" : "반복 경로", value: Number(page?.filteredRepeatedTargetCount || 0), tone: "text-[var(--kr-gov-blue)]" },
            { title: en ? "Repeated IPs" : "반복 IP", value: Number(page?.filteredRepeatedRemoteAddrCount || 0), tone: "text-[var(--kr-gov-blue)]" }
          ].map((card) => (
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-5 py-5 shadow-sm" key={card.title}>
              <p className="text-xs font-bold tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{card.title}</p>
              <p className={`mt-3 text-3xl font-black ${card.tone}`}>{card.value.toLocaleString()}</p>
            </article>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 border-t border-[var(--kr-gov-border-light)] px-6 py-6 lg:grid-cols-3">
          {[
            { title: en ? "Top Repeated Actors" : "상위 반복 수행자", rows: repeatedActors },
            { title: en ? "Top Repeated Routes" : "상위 반복 경로", rows: repeatedTargets },
            { title: en ? "Top Repeated IPs" : "상위 반복 IP", rows: repeatedRemoteAddrs }
          ].map((group) => (
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-5" key={group.title}>
              <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{group.title}</p>
              <div className="mt-4 space-y-3">
                {group.rows.length === 0 ? (
                  <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No repeated pattern was detected." : "반복 패턴이 감지되지 않았습니다."}</p>
                ) : group.rows.map((item) => (
                  <div className="flex items-start justify-between gap-3 rounded-[var(--kr-gov-radius)] bg-white px-4 py-3" key={`${group.title}-${stringOf(item, "value")}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(item, "value") || "-"}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(item, "label") || "-"}</p>
                    </div>
                    <span className="inline-flex shrink-0 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
                      {en ? `${stringOf(item, "count")} hits` : `${stringOf(item, "count")}건`}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      ) : null}

      <section className="gov-card overflow-hidden p-0" data-help-id="security-audit-table">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <MemberSectionToolbar
            meta={en ? "Recent audit events are sorted and paged on the server response." : "감사 이벤트는 서버 응답 기준으로 정렬되고 페이지 처리됩니다."}
            title={(
              <span className="text-[15px] font-semibold text-[var(--kr-gov-text-primary)]">
                {en ? "Audit Events" : "감사 이벤트"} <span className="text-[var(--kr-gov-blue)]">{totalCount.toLocaleString()}</span>
              </span>
            )}
          />
        </div>
        <div className="overflow-x-auto">
          <AdminTable className="min-w-[1160px]">
            <thead>
              <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                <th className="w-16 px-6 py-4 text-center">{en ? "No." : "번호"}</th>
                <th className="px-6 py-4">
                  <button className="inline-flex items-center gap-1" onClick={() => handleSortChange("AUDIT_AT")} type="button">
                    <span>{en ? "Audit Time" : "감사 시각"}</span>
                    <span className="material-symbols-outlined text-[16px]">{resolveSortIndicator(filters.sortKey === "AUDIT_AT", filters.sortDirection)}</span>
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button className="inline-flex items-center gap-1" onClick={() => handleSortChange("ACTOR")} type="button">
                    <span>{en ? "Actor" : "수행자"}</span>
                    <span className="material-symbols-outlined text-[16px]">{resolveSortIndicator(filters.sortKey === "ACTOR", filters.sortDirection)}</span>
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button className="inline-flex items-center gap-1" onClick={() => handleSortChange("ACTION")} type="button">
                    <span>{en ? "Action" : "행위"}</span>
                    <span className="material-symbols-outlined text-[16px]">{resolveSortIndicator(filters.sortKey === "ACTION", filters.sortDirection)}</span>
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button className="inline-flex items-center gap-1" onClick={() => handleSortChange("TARGET")} type="button">
                    <span>{en ? "Target Route" : "대상 경로"}</span>
                    <span className="material-symbols-outlined text-[16px]">{resolveSortIndicator(filters.sortKey === "TARGET", filters.sortDirection)}</span>
                  </button>
                </th>
                <th className="px-6 py-4">{en ? "Scope Detail" : "스코프 상세"}</th>
                <th className="px-6 py-4 text-center">{en ? "Open" : "열기"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500" colSpan={7}>
                    {en ? "No audit events matched the current filters." : "현재 필터에 일치하는 감사 이벤트가 없습니다."}
                  </td>
                </tr>
              ) : rowViews.map((rowView, index) => {
                return (
                  <tr className="transition-colors hover:bg-gray-50/50" key={rowView.rowKey}>
                    <td className="px-6 py-4 text-center text-gray-500">{totalCount - ((currentPage - 1) * pageSize + index)}</td>
                    <td className="px-6 py-4 text-gray-600">{rowView.auditAt || "-"}</td>
                    <td className="px-6 py-4 text-[var(--kr-gov-text-primary)]">
                      <p>{rowView.actor || "-"}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {repeatedActorSet.has(rowView.actorId) ? <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">{en ? "Repeated Actor" : "반복 수행자"}</span> : null}
                        {repeatedRemoteAddrSet.has(rowView.remoteAddr) ? <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">{en ? "Repeated IP" : "반복 IP"}</span> : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${actionTone(rowView.action)}`}>
                          {rowView.action || "-"}
                        </span>
                        {rowView.responseStatus >= 400 ? <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">{en ? "Error" : "오류"}</span> : null}
                        {rowView.durationMs >= 1000 ? <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{en ? "Slow" : "지연"}</span> : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[13px] text-[var(--kr-gov-text-primary)]">
                      <p>{rowView.target || "-"}</p>
                      {repeatedTargetSet.has(rowView.target) ? (
                        <span className="mt-2 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">{en ? "Repeated Route" : "반복 경로"}</span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{rowView.detail || "-"}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <MemberButton onClick={() => setSelectedRowKey(rowView.rowKey)} type="button" variant="secondary">
                          {en ? "Detail" : "상세"}
                        </MemberButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
        </div>
        <MemberPagination currentPage={currentPage} onPageChange={(pageIndex) => applyFilters(pageIndex)} totalPages={totalPages} />
      </section>
      </AdminWorkspacePageFrame>

      <ReviewModalFrame
        maxWidthClassName="max-w-4xl"
        onClose={() => setSelectedRowKey("")}
        open={Boolean(selectedRow)}
        title={en ? "Audit Event Detail" : "감사 이벤트 상세"}
      >
        {selectedRow ? (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <article className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Status" : "응답 상태"}</p>
                <p className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{selectedRow.responseStatus || "-"}</p>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Duration" : "소요 시간"}</p>
                <p className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{selectedRow.durationMs ? `${selectedRow.durationMs}ms` : "-"}</p>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Trace ID" : "Trace ID"}</p>
                <p className="mt-2 break-all font-mono text-[12px] text-[var(--kr-gov-text-primary)]">{selectedRow.traceId || "-"}</p>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Request ID" : "Request ID"}</p>
                <p className="mt-2 break-all font-mono text-[12px] text-[var(--kr-gov-text-primary)]">{selectedRow.requestId || "-"}</p>
              </article>
            </section>
            <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Event" : "이벤트"}</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Audit Time" : "감사 시각"}</dt>
                    <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{selectedRow.auditAt || "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Action" : "행위"}</dt>
                    <dd className="mt-1">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${actionTone(selectedRow.action)}`}>
                        {selectedRow.action || "-"}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Target Route" : "대상 경로"}</dt>
                    <dd className="mt-1 break-all font-mono text-[13px] text-[var(--kr-gov-text-primary)]">{selectedRow.target || "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "HTTP Method" : "HTTP 메서드"}</dt>
                    <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{selectedRow.httpMethod || "-"}</dd>
                  </div>
                </dl>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Actor" : "수행자"}</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Actor ID" : "수행자 ID"}</dt>
                    <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{selectedRow.actorId || "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Actor Type" : "수행자 유형"}</dt>
                    <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{selectedRow.actorType || "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Institution" : "기관 ID"}</dt>
                    <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{selectedRow.insttId || "-"}</dd>
                  </div>
                </dl>
              </article>
            </section>
            <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Scope" : "스코프"}</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Actor Scope" : "수행자 스코프"}</dt>
                    <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{selectedRow.actorScope}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Target Scope" : "대상 스코프"}</dt>
                    <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{selectedRow.targetScope}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Context Mode" : "Context Mode"}</dt>
                    <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{selectedRow.contextMode}</dd>
                  </div>
                </dl>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Reason" : "사유"}</p>
                <p className="mt-4 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-[var(--kr-gov-text-primary)]">
                  {selectedRow.reason || "-"}
                </p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Remote IP" : "원격 IP"}</dt>
                    <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{selectedRow.remoteAddr || "-"}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <MemberLinkButton href={buildLocalizedPath(`/admin/system/security-policy?searchKeyword=${encodeURIComponent(selectedRow.target)}${filters.startDate ? `&startDate=${encodeURIComponent(filters.startDate)}` : ""}${filters.endDate ? `&endDate=${encodeURIComponent(filters.endDate)}` : ""}`, `/en/admin/system/security-policy?searchKeyword=${encodeURIComponent(selectedRow.target)}${filters.startDate ? `&startDate=${encodeURIComponent(filters.startDate)}` : ""}${filters.endDate ? `&endDate=${encodeURIComponent(filters.endDate)}` : ""}`)} variant="secondary">
                    {en ? "Open Policy" : "정책 열기"}
                  </MemberLinkButton>
                  <MemberLinkButton href={buildLocalizedPath(`/admin/system/blocklist?searchKeyword=${encodeURIComponent(selectedRow.target)}`, `/en/admin/system/blocklist?searchKeyword=${encodeURIComponent(selectedRow.target)}`)} variant="secondary">
                    {en ? "Open Blocklist" : "차단목록 열기"}
                  </MemberLinkButton>
                </div>
              </article>
            </section>
            <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Query String" : "쿼리 문자열"}</p>
                <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-[var(--kr-gov-radius)] bg-slate-50 px-4 py-4 text-[12px] leading-6 text-[var(--kr-gov-text-primary)]">{stringOf(selectedRow.row, "queryString") || "-"}</pre>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Parameter Summary" : "파라미터 요약"}</p>
                <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-[var(--kr-gov-radius)] bg-slate-50 px-4 py-4 text-[12px] leading-6 text-[var(--kr-gov-text-primary)]">{stringOf(selectedRow.row, "parameterSummary") || "-"}</pre>
              </article>
            </section>
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Raw Detail" : "원문 상세"}</p>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-[var(--kr-gov-radius)] bg-slate-50 px-4 py-4 text-[12px] leading-6 text-[var(--kr-gov-text-primary)]">{selectedRow.detail || "-"}</pre>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Error Message" : "오류 메시지"}</p>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-[var(--kr-gov-radius)] bg-slate-50 px-4 py-4 text-[12px] leading-6 text-[var(--kr-gov-text-primary)]">{stringOf(selectedRow.row, "errorMessage") || "-"}</pre>
            </article>
          </>
        ) : null}
      </ReviewModalFrame>
    </AdminPageShell>
  );
}
