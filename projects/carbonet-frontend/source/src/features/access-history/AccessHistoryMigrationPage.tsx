import { useEffect, useState, useMemo } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { CanView } from "../../components/access/CanView";
  import { fetchAccessHistoryPage } from "../../lib/api/security";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberPagination, MemberSectionToolbar } from "../member/common";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  insttId: string;
  startDate: string;
  endDate: string;
  httpMethod: string;
  responseStatus: string;
  sortKey: string;
  sortDirection: string;
};

const DEFAULT_FILTERS: Filters = {
  pageIndex: 1,
  searchKeyword: "",
  insttId: "",
  startDate: "",
  endDate: "",
  httpMethod: "ALL",
  responseStatus: "ALL",
  sortKey: "executedAt",
  sortDirection: "desc",
};

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  const params = new URLSearchParams(window.location.search);
  return {
    pageIndex: Number(params.get("pageIndex") || "1") || 1,
    searchKeyword: params.get("searchKeyword") || "",
    insttId: params.get("insttId") || "",
    startDate: params.get("startDate") || "",
    endDate: params.get("endDate") || "",
    httpMethod: params.get("httpMethod") || "ALL",
    responseStatus: params.get("responseStatus") || "ALL",
    sortKey: params.get("sortKey") || "executedAt",
    sortDirection: params.get("sortDirection") || "desc",
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

function statusBadge(status: number) {
  if (status >= 500) {
    return "bg-red-100 text-red-700 border-red-300";
  }
  if (status >= 400) {
    return "bg-amber-100 text-amber-700 border-amber-300";
  }
  if (status >= 300) {
    return "bg-blue-100 text-blue-700 border-blue-300";
  }
  return "bg-emerald-100 text-emerald-700 border-emerald-300";
}

function httpMethodBadge(method: string) {
  const badges: Record<string, string> = {
    GET: "bg-emerald-100 text-emerald-700",
    POST: "bg-blue-100 text-blue-700",
    PUT: "bg-amber-100 text-amber-700",
    DELETE: "bg-red-100 text-red-700",
    PATCH: "bg-purple-100 text-purple-700",
  };
  return badges[method] || "bg-gray-100 text-gray-600";
}

function formatDuration(ms: number): string {
  if (ms > 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function truncate(text: string, max: number = 60): string {
  if (!text || text.length <= max) return text;
  return text.substring(0, max) + "...";
}

export function AccessHistoryMigrationPage() {
  const [filters, setFilters] = useState<Filters>(() => readInitialFilters());
  const [draftFilters, setDraftFilters] = useState<Filters>(() => readInitialFilters());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

const pageState = useAsyncValue<Record<string, unknown>>(
    () => fetchAccessHistoryPage(filters),
    [
      filters.pageIndex,
      filters.searchKeyword,
      filters.insttId,
      filters.startDate,
      filters.endDate,
      filters.httpMethod,
      filters.responseStatus,
      filters.sortKey,
      filters.sortDirection,
    ],
    {
      onSuccess(payload) {
        const next = {
          pageIndex: Number(payload.pageIndex || 1),
          searchKeyword: String(payload.searchKeyword || ""),
          insttId: String(payload.selectedInsttId || ""),
          startDate: payload.startDate || "",
          endDate: payload.endDate || "",
          httpMethod: payload.httpMethod || "ALL",
          responseStatus: payload.responseStatus || "ALL",
          sortKey: payload.sortKey || "executedAt",
          sortDirection: payload.sortDirection || "desc",
        } as Filters;
        setFilters(next);
        setDraftFilters(next);
      },
    }
  );

  const page = pageState.value;
  const error = pageState.error || String(page?.accessHistoryError || "");
  const totalPages = Math.max(1, Number(page?.totalPages || 1));
  const currentPage = Math.max(1, Number(page?.pageIndex || 1));
  const rows = (page?.accessHistoryList || []) as Array<Record<string, unknown>>;
  const companyOptions = (page?.companyOptions || []) as Array<Record<string, string>>;

  // Statistics calculation
  const stats = useMemo(() => {
    const stats = {
      total: rows.length,
      errors: 0,
      warnings: 0,
      success: 0,
      avgDuration: 0,
      durationSum: 0,
      durationCount: 0,
      httpMethods: {} as Record<string, number>,
      responseRanges: {
        "2xx": 0,
        "3xx": 0,
        "4xx": 0,
        "5xx": 0,
        other: 0,
      },
    };

    rows.forEach((row) => {
      const status = Number(row.responseStatus || 0);
      const duration = Number(row.durationMs || 0);
      const method = stringOf(row, "httpMethod") || "OTHER";

      if (status >= 500) stats.errors++;
      else if (status >= 400) stats.warnings++;
      else if (status >= 200) stats.success++;

      if (duration > 0) {
        stats.durationSum += duration;
        stats.durationCount++;
      }

      stats.httpMethods[method] = (stats.httpMethods[method] || 0) + 1;

      if (status >= 200 && status < 300) stats.responseRanges["2xx"]++;
      else if (status >= 300 && status < 400) stats.responseRanges["3xx"]++;
      else if (status >= 400 && status < 500) stats.responseRanges["4xx"]++;
      else if (status >= 500) stats.responseRanges["5xx"]++;
      else if (status > 0) stats.responseRanges.other++;
    });

    if (stats.durationCount > 0) {
      stats.avgDuration = Math.round(stats.durationSum / stats.durationCount);
    }

    return stats;
  }, [rows]);

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "access-history", {
      route: window.location.pathname,
      canView: !!page.canViewAccessHistory,
      canManageAllCompanies: !!page.canManageAllCompanies,
      selectedInsttId: filters.insttId,
      currentPage,
      totalCount: Number(page.totalCount || 0),
      searchKeyword: filters.searchKeyword,
      startDate: filters.startDate,
      endDate: filters.endDate,
      httpMethod: filters.httpMethod,
      responseStatus: filters.responseStatus,
    });
    logGovernanceScope("COMPONENT", "access-history-table", {
      component: "access-history-table",
      rowCount: rows.length,
      companyOptionCount: companyOptions.length,
      expandedRowCount: expandedRows.size,
    });
  }, [
    companyOptions.length,
    currentPage,
    filters.insttId,
    filters.searchKeyword,
    filters.startDate,
    filters.endDate,
    page,
    rows.length,
    expandedRows.size,
  ]);

  function updateDraft<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(nextPageIndex = 1) {
    logGovernanceScope("ACTION", "access-history-search", {
      pageIndex: nextPageIndex,
      insttId: draftFilters.insttId,
      searchKeyword: draftFilters.searchKeyword,
      startDate: draftFilters.startDate,
      endDate: draftFilters.endDate,
      httpMethod: draftFilters.httpMethod,
      responseStatus: draftFilters.responseStatus,
      sortKey: draftFilters.sortKey,
      sortDirection: draftFilters.sortDirection,
    });
    setFilters({
      ...draftFilters,
      pageIndex: nextPageIndex,
    });
  }

  function resetFilters() {
    const next = {
      ...DEFAULT_FILTERS,
      insttId: page?.canManageAllCompanies ? "" : String(page?.selectedInsttId || ""),
    };
    setDraftFilters(next);
    setFilters(next);
  }

  function toggleExpand(rowId: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  function toggleSort(key: string) {
    const isDescending = draftFilters.sortKey === key && draftFilters.sortDirection === "desc";
    setDraftFilters({
      ...draftFilters,
      sortKey: key,
      sortDirection: isDescending ? "asc" : "desc",
    });
    applyFilters(1);
  }

  function getSortIcon(key: string) {
    if (filters.sortKey !== key) return "↕️";
    return filters.sortDirection === "desc" ? "⬇️" : "⬆️";
  }

  function getSortIndicator(key: string) {
    if (filters.sortKey !== key) return "text-gray-400 hover:text-gray-600";
    return "text-[var(--kr-gov-blue)]";
  }

  // Date range helpers
  const today = new Date();
  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  const datePresets = [
    { label: "오늘", value: [formatDate(today), formatDate(today)] },
    { label: "최근 7일", value: [formatDate(new Date(today.getTime() - 6 * 86400000)), formatDate(today)] },
    { label: "최근 30일", value: [formatDate(new Date(today.getTime() - 29 * 864000000)), formatDate(today)] },
  ];

  function applyDatePreset(start: string, end: string) {
    setDraftFilters({
      ...draftFilters,
      startDate: start,
      endDate: end,
    });
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: "시스템" },
        { label: "접속 로그" },
      ]}
      subtitle="관리자 접속 이력을 조회하고 분석합니다. 날짜, HTTP 메서드, 응답 상태 기준으로 필터링할 수 있습니다."
      title="접속 로그"
      loading={pageState.loading && !page && !error}
      loadingLabel="접속 로그를 불러오는 중입니다."
    >
      {error ? (
        <section className="mb-4 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">
            <strong>⚠️ 조회 오류</strong>: {error}
          </p>
        </section>
      ) : null}

      <CanView
        allowed={!!page?.canViewAccessHistory}
        fallback={
          <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-6 py-8">
            <p className="text-sm text-[var(--kr-gov-text-secondary)]">
              🔒 접속 로그를 조회할 권한이 없습니다.
            </p>
          </section>
        }
      >
        {/* Search Section */}
        <div className="gov-card mb-8" data-help-id="access-history-search">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
                  >
                    📄 페이지 {currentPage} / {totalPages}
                  </span>
                  <span
                    className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
                  >
                    📊 전체 {Number(page?.totalCount || 0).toLocaleString()}건
                  </span>
                </div>
              }
              meta="회사, 검색어, 날짜 범위, HTTP 메서드, 응답 상태로 필터링하세요."
              title="🔍 검색 조건"
            />
          </div>

          <form
            className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters(1);
            }}
          >
            {/* Company Selection */}
            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                🏢 회사
              </span>
              <AdminSelect
                disabled={!page?.canManageAllCompanies}
                id="insttId"
                value={draftFilters.insttId}
                onChange={(event) => updateDraft("insttId", event.target.value)}
              >
                {page?.canManageAllCompanies ? <option value="">🔓 전체 회사</option> : null}
                {companyOptions.map((option) => (
                  <option key={String(option.insttId || "")} value={String(option.insttId || "")}>
                    {String(option.cmpnyNm || option.insttId || "-")}
                  </option>
                ))}
              </AdminSelect>
            </div>

            {/* Search Keyword */}
            <div className="md:col-span-3">
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                🔍 검색어
              </span>
              <AdminInput
                id="searchKeyword"
                placeholder="회사명, 계정 ID, 요청 URI, IP, 에러 메시지 검색"
                value={draftFilters.searchKeyword}
                onChange={(event) => updateDraft("searchKeyword", event.target.value)}
              />
            </div>

            {/* Date Range */}
            <div className="md:col-span-2">
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                📅 시작 날짜
              </span>
              <AdminInput
                type="date"
                id="startDate"
                value={draftFilters.startDate}
                onChange={(event) => updateDraft("startDate", event.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                📅 종료 날짜
              </span>
              <AdminInput
                type="date"
                id="endDate"
                value={draftFilters.endDate}
                onChange={(event) => updateDraft("endDate", event.target.value)}
              />
            </div>

            {/* Date Presets */}
            <div className="md:col-span-4">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-500 py-2">빠른 선택:</span>
                {datePresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyDatePreset(preset.value[0], preset.value[1])}
                    className="text-xs px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* HTTP Method Filter */}
            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                📡 HTTP 메서드
              </span>
              <AdminSelect
                id="httpMethod"
                value={draftFilters.httpMethod}
                onChange={(event) => updateDraft("httpMethod", event.target.value)}
              >
                <option value="ALL">전체</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </AdminSelect>
            </div>

            {/* Response Status Filter */}
            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                ✅ 응답 상태
              </span>
              <AdminSelect
                id="responseStatus"
                value={draftFilters.responseStatus}
                onChange={(event) => updateDraft("responseStatus", event.target.value)}
              >
                <option value="ALL">전체</option>
                <option value="2xx">2xx (성공)</option>
                <option value="3xx">3xx (리다이렉트)</option>
                <option value="4xx">4xx (클라이언트 오류)</option>
                <option value="5xx">5xx (서버 오류)</option>
              </AdminSelect>
            </div>

            {/* Sort Selection */}
            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                ↕️ 정렬 기준
              </span>
              <AdminSelect
                id="sortKey"
                value={draftFilters.sortKey}
                onChange={(event) => updateDraft("sortKey", event.target.value)}
              >
                <option value="executedAt">접속 일시</option>
                <option value="responseStatus">응답 상태</option>
                <option value="durationMs">처리 시간</option>
              </AdminSelect>
            </div>

            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                🔃 정렬 순서
              </span>
              <AdminSelect
                id="sortDirection"
                value={draftFilters.sortDirection}
                onChange={(event) => updateDraft("sortDirection", event.target.value)}
              >
                <option value="desc">내림차순</option>
                <option value="asc">오름차순</option>
              </AdminSelect>
            </div>

            {/* Action Buttons */}
            <div className="md:col-span-4">
              <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  💡 마스터 관리자는 회사별로 조회할 수 있고, 시스템 관리자는 본인 회사 로그만 조회합니다.
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <MemberButton onClick={resetFilters} type="button" variant="secondary">
                    🔄 초기화
                  </MemberButton>
                  <MemberButton icon="search" type="submit" variant="primary">
                    🔍 검색
                  </MemberButton>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Statistics Cards */}
        {rows.length > 0 && (
          <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-5" data-help-id="access-history-stats">
            <div className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600 font-bold">2xx 성공</span>
                <span className="text-xl font-bold text-emerald-700">{stats.responseRanges["2xx"]}</span>
              </div>
              <div className="text-xs text-emerald-500">{((stats.responseRanges["2xx"] / stats.total) * 100).toFixed(1)}%</div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-600 font-bold">3xx 리다이렉트</span>
                <span className="text-xl font-bold text-blue-700">{stats.responseRanges["3xx"]}</span>
              </div>
              <div className="text-xs text-blue-500">{((stats.responseRanges["3xx"] / stats.total) * 100).toFixed(1)}%</div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-600 font-bold">4xx 오류</span>
                <span className="text-xl font-bold text-amber-700">{stats.responseRanges["4xx"]}</span>
              </div>
              <div className="text-xs text-amber-500">{((stats.responseRanges["4xx"] / stats.total) * 100).toFixed(1)}%</div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-red-600 font-bold">5xx 서버 오류</span>
                <span className="text-xl font-bold text-red-700">{stats.responseRanges["5xx"]}</span>
              </div>
              <div className="text-xs text-red-500">{((stats.responseRanges["5xx"] / stats.total) * 100).toFixed(1)}%</div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-purple-200 bg-purple-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-purple-600 font-bold">평균 처리 시간</span>
                <span className="text-lg font-bold text-purple-700">{formatDuration(stats.avgDuration)}</span>
              </div>
              <div className="text-xs text-purple-500">
                {stats.durationCount}개 요청 기준
              </div>
            </div>
          </div>
        )}

        {/* Results Table */}
        <div className="gov-card p-0 overflow-hidden" data-help-id="access-history-table">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="text-xs px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                  >
                    {showAdvancedFilters ? "⬆️ 필터 접기" : "⬇️ 확장 필터"}
                  </button>
                </div>
              }
              meta={`결과 ${rows.length}건 (${stats.httpMethods.GET || 0} GET, ${stats.httpMethods.POST || 0} POST, ${stats.httpMethods.PUT || 0} PUT, ${stats.httpMethods.DELETE || 0} DELETE)`}
              title={
                <span className="text-[15px] font-semibold text-[var(--kr-gov-text-primary)]">
                  📋 조회 결과{" "}
                  <span className="text-[var(--kr-gov-blue)]">
                    {Number(page?.totalCount || 0).toLocaleString()}
                  </span>{" "}
                  건
                </span>
              }
            />
          </div>

          <div className="overflow-x-auto">
            <AdminTable>
              <thead>
                <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                  <th className="w-16 px-6 py-4 text-center">
                    <button type="button" onClick={() => toggleSort("executedAt")} className={getSortIndicator("executedAt")}>
                      번호 {getSortIcon("executedAt")}
                    </button>
                  </th>
                  <th className="px-6 py-4">
                    <button type="button" onClick={() => toggleSort("executedAt")} className={getSortIndicator("executedAt")}>
                      접속 일시 {getSortIcon("executedAt")}
                    </button>
                  </th>
                  <th className="px-6 py-4">회사</th>
                  <th className="px-6 py-4">
                    <button type="button" onClick={() => toggleSort("responseStatus")} className={getSortIndicator("responseStatus")}>
                      사용자 {getSortIcon("responseStatus")}
                    </button>
                  </th>
                  <th className="px-6 py-4">IP</th>
                  <th className="px-6 py-4">
                    <button type="button" onClick={() => toggleSort("durationMs")} className={getSortIndicator("durationMs")}>
                      요청 {getSortIcon("durationMs")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center">
                    <button type="button" onClick={() => toggleSort("responseStatus")} className={getSortIndicator("responseStatus")}>
                      응답 {getSortIcon("responseStatus")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center">
                    <button type="button" onClick={() => toggleSort("durationMs")} className={getSortIndicator("durationMs")}>
                      처리 시간 {getSortIcon("durationMs")}
                    </button>
                  </th>
                  <th className="w-20 px-6 py-4 text-center">
                    상세
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-12 text-center" colSpan={9}>
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-4xl">📭</span>
                        <p className="text-sm text-gray-500">조회된 접속 로그가 없습니다.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const rowId = `${stringOf(row, "executedAt", "actorUserId", "requestUri")}-${index}`;
                    const rowNumber =
                      Number(page?.totalCount || 0) -
                      ((currentPage - 1) * Number(page?.pageSize || 10) + index);
                    const status = Number(row.responseStatus || 0);
                    const remoteAddr = stringOf(row, "remoteAddr");
                    const method = stringOf(row, "httpMethod");
                    const duration = Number(row.durationMs || 0);
                    const uri = stringOf(row, "requestUri");
                    const isExpanded = expandedRows.has(rowId);

                    return (
                      <tr
                        key={rowId}
                        className={`transition-colors ${
                          isExpanded ? "bg-gray-50" : "hover:bg-gray-50/50"
                        } ${status >= 500 ? "bg-red-50" : status >= 400 ? "bg-amber-50" : ""}`}
                      >
                        <td className="px-6 py-4 text-center text-gray-500">{rowNumber > 0 ? rowNumber : index + 1}</td>
                        <td className="px-6 py-4 text-gray-600">
                          {stringOf(row, "executedAt") || "-"}
                        </td>
                        <td className="px-6 py-4 font-medium text-[var(--kr-gov-text-secondary)]">
                          <div>🏢 {stringOf(row, "companyName") || "-"}</div>
                          <div className="text-xs text-gray-400">{stringOf(row, "insttId") || "-"}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-[var(--kr-gov-text-primary)]">
                            👤 {stringOf(row, "actorUserId") || "-"}
                          </div>
                          <div className="text-xs text-gray-400">
                            {stringOf(row, "actorAuthorCode") || "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          📍 {remoteAddr || "-"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${httpMethodBadge(method)}`}>
                              {method}
                            </span>
                            <span className="font-medium text-[var(--kr-gov-text-primary)] truncate max-w-xs">
                              {truncate(uri || "-")}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {stringOf(row, "featureType") || "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${statusBadge(status)}`}
                          >
                            {status >= 500 ? "❌ " : status >= 400 ? "⚠️ " : status >= 300 ? "↗️ " : "✅ "}
                            {status || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`text-xs font-bold ${
                              duration > 1000 ? "text-red-600" : duration > 500 ? "text-amber-600" : "text-emerald-600"
                            }`}
                          >
                            {duration > 0 ? formatDuration(duration) : "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleExpand(rowId)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                              isExpanded
                                ? "bg-[var(--kr-gov-blue)] text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {isExpanded ? "▲" : "▼"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </AdminTable>
          </div>

          {/* Expanded Row Details */}
          {expandedRows.size > 0 &&
            rows.map((row, index) => {
              const rowId = `${stringOf(row, "executedAt", "actorUserId", "requestUri")}-${index}`;
              if (!expandedRows.has(rowId)) return null;

              return (
                <tr key={`expanded-${rowId}`}>
                  <td colSpan={9} className="px-6 py-4 bg-gray-50">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <h4 className="text-sm font-bold text-gray-700 mb-2">📋 요청 정보</h4>
                        <dl className="space-y-2 text-xs">
                          <div>
                            <dt className="font-medium text-gray-600">URI</dt>
                            <dd className="text-gray-800">{stringOf(row, "requestUri") || "-"}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-600">HTTP 메서드</dt>
                            <dd className="text-gray-800">{stringOf(row, "httpMethod") || "-"}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-600">기능 타입</dt>
                            <dd className="text-gray-800">{stringOf(row, "featureType") || "-"}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-600">Trace ID</dt>
                            <dd className="text-gray-800">{stringOf(row, "traceId") || "-"}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <h4 className="text-sm font-bold text-gray-700 mb-2">👤 액터 정보</h4>
                        <dl className="space-y-2 text-xs">
                          <div>
                            <dt className="font-medium text-gray-600">사용자 ID</dt>
                            <dd className="text-gray-800">{stringOf(row, "actorUserId") || "-"}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-600">역할</dt>
                            <dd className="text-gray-800">{stringOf(row, "actorAuthorCode") || "-"}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-600">회사</dt>
                            <dd className="text-gray-800">{stringOf(row, "companyName") || "-"}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-600">IP 주소</dt>
                            <dd className="text-gray-800">{stringOf(row, "remoteAddr") || "-"}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <h4 className="text-sm font-bold text-gray-700 mb-2">📊 응답 정보</h4>
                        <dl className="space-y-2 text-xs">
                          <div>
                            <dt className="font-medium text-gray-600">상태 코드</dt>
                            <dd className="text-gray-800">{stringOf(row, "responseStatus") || "-"}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-600">처리 시간</dt>
                            <dd className="text-gray-800">{stringOf(row, "durationMs") || "-"} ms</dd>
                          </div>
                          {stringOf(row, "errorMessage") && (
                            <div>
                              <dt className="font-medium text-gray-600">에러 메시지</dt>
                              <dd className="text-red-600">{stringOf(row, "errorMessage")}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}

          <MemberPagination
            currentPage={currentPage}
            onPageChange={(pageIndex) => applyFilters(pageIndex)}
            totalPages={totalPages}
          />
        </div>
      </CanView>
    </AdminPageShell>
  );
}
