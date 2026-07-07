import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchExternalConnectionListPage } from "../../lib/api/ops";
import type { ExternalConnectionListPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish, replace } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, MemberPagination } from "../member/common";

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

function numberOf(row: Record<string, unknown> | null | undefined, ...keys: string[]) {
  const value = stringOf(row, ...keys);
  if (!value) {
    return 0;
  }
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function badgeClass(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("CRITICAL") || upper.includes("ERROR") || upper.includes("DANGER")) {
    return "bg-red-100 text-red-700";
  }
  if (upper.includes("WARNING") || upper.includes("REVIEW") || upper.includes("MAINTENANCE")) {
    return "bg-amber-100 text-amber-700";
  }
  if (upper.includes("HEALTHY") || upper.includes("ACTIVE")) {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-slate-100 text-slate-700";
}

function sourceLabel(value: string, en: boolean) {
  switch (value) {
    case "REGISTERED_AND_OBSERVED":
      return en ? "Observed + Profile" : "관측 + 프로필";
    case "PROFILE_ONLY":
      return en ? "Profile Only" : "프로필 전용";
    case "OBSERVED":
    default:
      return en ? "Observed" : "관측";
  }
}

function sortRank(row: Record<string, unknown>) {
  const status = stringOf(row, "status").toUpperCase();
  if (status.includes("DEGRADED")) {
    return 3;
  }
  if (status.includes("WARNING")) {
    return 2;
  }
  if (status.includes("HEALTHY")) {
    return 1;
  }
  return 0;
}

function buildConnectionEditHref(row: Record<string, unknown> | null | undefined) {
  const connectionId = stringOf(row, "connectionId", "apiId");
  const path = buildLocalizedPath("/admin/external/connection_edit", "/en/admin/external/connection_edit");
  if (!connectionId) {
    return path;
  }
  const search = new URLSearchParams({ connectionId });
  return `${path}?${search.toString()}`;
}

function readInitialFilters() {
  if (typeof window === "undefined") {
    return {
      keyword: "",
      status: "ALL",
      protocol: "ALL",
      source: "ALL",
      sortBy: "PRIORITY",
      pageNumber: 1
    };
  }
  const search = new URLSearchParams(window.location.search);
  return {
    keyword: search.get("keyword") || "",
    status: search.get("status") || "ALL",
    protocol: search.get("protocol") || "ALL",
    source: search.get("source") || "ALL",
    sortBy: search.get("sortBy") || "PRIORITY",
    pageNumber: Math.max(1, Number(search.get("page") || "1") || 1)
  };
}

export function ExternalConnectionListMigrationPage() {
  const en = isEnglish();
  const initialFilters = useMemo(() => readInitialFilters(), []);
  const pageState = useAsyncValue<ExternalConnectionListPagePayload>(fetchExternalConnectionListPage, [], {});
  const page = pageState.value;
  const summary = useMemo(() => ((page?.externalConnectionSummary || []) as Array<Record<string, string>>), [page]);
  const rows = useMemo(() => ((page?.externalConnectionRows || []) as Array<Record<string, string>>), [page]);
  const issueRows = useMemo(() => ((page?.externalConnectionIssueRows || []) as Array<Record<string, string>>), [page]);
  const quickLinks = useMemo(() => ((page?.externalConnectionQuickLinks || []) as Array<Record<string, string>>), [page]);
  const guidance = useMemo(() => ((page?.externalConnectionGuidance || []) as Array<Record<string, string>>), [page]);
  const [keyword, setKeyword] = useState(initialFilters.keyword);
  const [status, setStatus] = useState(initialFilters.status);
  const [protocol, setProtocol] = useState(initialFilters.protocol);
  const [source, setSource] = useState(initialFilters.source);
  const [sortBy, setSortBy] = useState(initialFilters.sortBy);
  const [pageNumber, setPageNumber] = useState(initialFilters.pageNumber);

  const statusOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => stringOf(row, "operationStatus", "status").toUpperCase()).filter(Boolean))),
    [rows]
  );
  const protocolOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => stringOf(row, "protocol").toUpperCase()).filter(Boolean))),
    [rows]
  );
  const sourceOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => stringOf(row, "sourceType").toUpperCase()).filter(Boolean))),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesKeyword = !normalizedKeyword || [
        stringOf(row, "connectionId", "apiId"),
        stringOf(row, "connectionName"),
        stringOf(row, "partnerName"),
        stringOf(row, "requestUri", "endpointUrl"),
        stringOf(row, "ownerName"),
        stringOf(row, "ownerContact"),
        stringOf(row, "authMethod"),
        stringOf(row, "syncMode")
      ].join(" ").toLowerCase().includes(normalizedKeyword);
      const rowStatus = stringOf(row, "operationStatus", "status").toUpperCase();
      const rowProtocol = stringOf(row, "protocol").toUpperCase();
      const rowSource = stringOf(row, "sourceType").toUpperCase();
      return matchesKeyword
        && (status === "ALL" || rowStatus === status)
        && (protocol === "ALL" || rowProtocol === protocol)
        && (source === "ALL" || rowSource === source);
    });
  }, [keyword, protocol, rows, source, status]);

  const sortedRows = useMemo(() => {
    const nextRows = [...filteredRows];
    nextRows.sort((left, right) => {
      if (sortBy === "LATENCY") {
        return numberOf(right, "avgDurationMs") - numberOf(left, "avgDurationMs");
      }
      if (sortBy === "ERRORS") {
        return numberOf(right, "errorCount") - numberOf(left, "errorCount");
      }
      if (sortBy === "LAST_SEEN") {
        return stringOf(right, "lastSeenAt").localeCompare(stringOf(left, "lastSeenAt"));
      }
      if (sortBy === "NAME") {
        return stringOf(left, "connectionName", "connectionId", "apiId").localeCompare(stringOf(right, "connectionName", "connectionId", "apiId"));
      }
      return [
        sortRank(right) - sortRank(left),
        numberOf(right, "errorCount") - numberOf(left, "errorCount"),
        numberOf(right, "avgDurationMs") - numberOf(left, "avgDurationMs"),
        stringOf(right, "lastSeenAt").localeCompare(stringOf(left, "lastSeenAt"))
      ].find((value) => value !== 0) || 0;
    });
    return nextRows;
  }, [filteredRows, sortBy]);

  const profileRegisteredCount = useMemo(
    () => rows.filter((row) => stringOf(row, "profileRegistered").toUpperCase() === "Y").length,
    [rows]
  );
  const profileMissingCount = useMemo(
    () => rows.filter((row) => stringOf(row, "profileRegistered").toUpperCase() !== "Y").length,
    [rows]
  );
  const attentionCount = useMemo(
    () => rows.filter((row) => stringOf(row, "status").toUpperCase() !== "HEALTHY").length,
    [rows]
  );

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pagedRows = useMemo(
    () => sortedRows.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
    [pageNumber, sortedRows]
  );

  useEffect(() => {
    setPageNumber(1);
  }, [keyword, protocol, source, sortBy, status]);

  useEffect(() => {
    if (pageNumber > totalPages) {
      setPageNumber(totalPages);
    }
  }, [pageNumber, totalPages]);

  useEffect(() => {
    const search = new URLSearchParams();
    if (keyword.trim()) {
      search.set("keyword", keyword.trim());
    }
    if (status !== "ALL") {
      search.set("status", status);
    }
    if (protocol !== "ALL") {
      search.set("protocol", protocol);
    }
    if (source !== "ALL") {
      search.set("source", source);
    }
    if (sortBy !== "PRIORITY") {
      search.set("sortBy", sortBy);
    }
    if (pageNumber > 1) {
      search.set("page", String(pageNumber));
    }
    const query = search.toString();
    replace(`${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [keyword, pageNumber, protocol, sortBy, source, status]);

  useEffect(() => {
    logGovernanceScope("PAGE", "external-connection-list", {
      language: en ? "en" : "ko",
      totalCount: rows.length,
      filteredCount: filteredRows.length,
      statusFilter: status,
      protocolFilter: protocol,
      sourceFilter: source,
      sortBy
    });
  }, [en, filteredRows.length, protocol, rows.length, sortBy, source, status]);

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (keyword.trim()) {
      labels.push(en ? `Keyword: ${keyword.trim()}` : `검색어: ${keyword.trim()}`);
    }
    if (status !== "ALL") {
      labels.push(en ? `Status: ${status}` : `상태: ${status}`);
    }
    if (protocol !== "ALL") {
      labels.push(en ? `Protocol: ${protocol}` : `프로토콜: ${protocol}`);
    }
    if (source !== "ALL") {
      labels.push(en ? `Source: ${sourceLabel(source, en)}` : `출처: ${sourceLabel(source, en)}`);
    }
    if (sortBy !== "PRIORITY") {
      labels.push(en ? `Sort: ${sortBy}` : `정렬: ${sortBy}`);
    }
    return labels;
  }, [en, keyword, protocol, sortBy, source, status]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "External Integration" : "외부 연계" },
        { label: en ? "Connection List" : "외부 연계 목록" }
      ]}
      title={en ? "Connection List" : "외부 연계 목록"}
      subtitle={en ? "Review observed partner connections and saved registry profiles in one place." : "관측된 파트너 연결과 저장된 레지스트리 프로필을 한 화면에서 함께 점검합니다."}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/external/schema", "/en/admin/external/schema")}>
            {en ? "Schema Registry" : "스키마 현황"}
          </a>
          <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/external/sync", "/en/admin/external/sync")}>
            {en ? "Sync Execution" : "동기화 실행"}
          </a>
          <a className="gov-btn" href={buildLocalizedPath("/admin/external/connection_add", "/en/admin/external/connection_add")}>
            {en ? "Register Connection" : "외부연계 등록"}
          </a>
        </div>
      }
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading external connections..." : "외부연계 목록을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {summary.map((item, index) => (
            <SummaryMetricCard
              key={`${stringOf(item, "title", "label")}-${index}`}
              title={stringOf(item, "title", "label")}
              value={stringOf(item, "value")}
              description={stringOf(item, "description")}
            />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" data-help-id="external-connection-list-summary">
          <article className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">{en ? "Profile Coverage" : "프로필 커버리지"}</p>
            <p className="mt-2 text-2xl font-black text-[var(--kr-gov-text-primary)]">{profileRegisteredCount}/{rows.length}</p>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Connections already owned with a saved profile." : "저장된 운영 프로필이 있는 외부연계 수입니다."}</p>
          </article>
          <article className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">{en ? "Needs Registration" : "프로필 등록 필요"}</p>
            <p className="mt-2 text-2xl font-black text-[var(--kr-gov-text-primary)]">{profileMissingCount}</p>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Observed connections without an explicit registry profile." : "관측됐지만 명시적 레지스트리 프로필이 없는 연결 수입니다."}</p>
          </article>
          <article className="rounded-[var(--kr-gov-radius)] border border-rose-200 bg-rose-50 px-5 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-rose-700">{en ? "Needs Attention" : "주의 필요"}</p>
            <p className="mt-2 text-2xl font-black text-[var(--kr-gov-text-primary)]">{attentionCount}</p>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Connections with warning or degraded runtime status." : "런타임 상태가 warning 또는 degraded 인 연결 수입니다."}</p>
          </article>
        </section>

        <div data-help-id="external-connection-list-filters">
          <CollectionResultPanel
            title={en ? "External Connection Filters" : "외부 연계 조회 조건"}
            description={en ? "Filter by connection, partner, status, protocol, or source before opening add or edit flows." : "등록 또는 수정 작업 전에 연계, 기관, 상태, 프로토콜, 데이터 출처 기준으로 범위를 좁힙니다."}
            icon="hub"
          >
            {activeFilterLabels.length > 0 ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {activeFilterLabels.map((label) => (
                  <span key={label} className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6 xl:w-[86rem]">
              <div>
                <label className="mb-1 block text-sm font-bold" htmlFor="externalConnectionKeyword">{en ? "Keyword" : "검색어"}</label>
                <AdminInput
                  id="externalConnectionKeyword"
                  placeholder={en ? "Connection, partner, endpoint" : "연계명, 기관명, 엔드포인트"}
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold" htmlFor="externalConnectionStatus">{en ? "Status" : "운영 상태"}</label>
                <AdminSelect id="externalConnectionStatus" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="ALL">{en ? "All" : "전체"}</option>
                  {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </AdminSelect>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold" htmlFor="externalConnectionProtocol">{en ? "Protocol" : "프로토콜"}</label>
                <AdminSelect id="externalConnectionProtocol" value={protocol} onChange={(event) => setProtocol(event.target.value)}>
                  <option value="ALL">{en ? "All" : "전체"}</option>
                  {protocolOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </AdminSelect>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold" htmlFor="externalConnectionSource">{en ? "Source" : "출처"}</label>
                <AdminSelect id="externalConnectionSource" value={source} onChange={(event) => setSource(event.target.value)}>
                  <option value="ALL">{en ? "All" : "전체"}</option>
                  {sourceOptions.map((option) => (
                    <option key={option} value={option}>
                      {sourceLabel(option, en)}
                    </option>
                  ))}
                </AdminSelect>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold" htmlFor="externalConnectionSort">{en ? "Sort" : "정렬"}</label>
                <AdminSelect id="externalConnectionSort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="PRIORITY">{en ? "Priority" : "우선순위"}</option>
                  <option value="LATENCY">{en ? "Latency" : "지연순"}</option>
                  <option value="ERRORS">{en ? "Errors" : "오류순"}</option>
                  <option value="LAST_SEEN">{en ? "Last Seen" : "최신 관측순"}</option>
                  <option value="NAME">{en ? "Name" : "이름순"}</option>
                </AdminSelect>
              </div>
              <div className="flex items-end">
                <button
                  className="gov-btn gov-btn-outline w-full"
                  type="button"
                  onClick={() => {
                    setKeyword("");
                    setStatus("ALL");
                    setProtocol("ALL");
                    setSource("ALL");
                    setSortBy("PRIORITY");
                    setPageNumber(1);
                  }}
                >
                  {en ? "Reset Filters" : "검색 조건 초기화"}
                </button>
              </div>
            </div>
          </CollectionResultPanel>
        </div>

        <section className="gov-card overflow-hidden p-0" data-help-id="external-connection-list-table">
          <div className="flex flex-col gap-3 border-b border-[var(--kr-gov-border-light)] px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-black text-[var(--kr-gov-text-primary)]">{en ? "External Connection Registry" : "외부 연계 레지스트리"}</h2>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {(en ? "Refreshed at " : "갱신 시각 ") + stringOf(page as Record<string, unknown>, "refreshedAt")}
              </p>
            </div>
            <p className="text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? `Visible ${sortedRows.length} of ${rows.length} connections. Page ${pageNumber} of ${totalPages}.` : `전체 ${rows.length}건 중 ${sortedRows.length}건이 표시됩니다. ${pageNumber}/${totalPages} 페이지입니다.`}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">{en ? "Connection" : "연계"}</th>
                  <th className="px-4 py-3">{en ? "Partner" : "기관"}</th>
                  <th className="px-4 py-3">{en ? "Endpoint" : "엔드포인트"}</th>
                  <th className="px-4 py-3">{en ? "Profile" : "프로필"}</th>
                  <th className="px-4 py-3">{en ? "Flow" : "연계 방식"}</th>
                  <th className="px-4 py-3">{en ? "Latency" : "지연"}</th>
                  <th className="px-4 py-3">{en ? "Traffic" : "트래픽"}</th>
                  <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                  <th className="px-4 py-3">{en ? "Owner" : "담당"}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, index) => (
                  <tr key={`${stringOf(row, "connectionKey", "connectionId", "apiId")}-${index}`} className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-3">
                      <a className="font-bold text-[var(--kr-gov-blue)] underline-offset-2 hover:underline" href={buildConnectionEditHref(row)}>
                        {stringOf(row, "connectionName") || stringOf(row, "connectionId", "apiId")}
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--kr-gov-text-secondary)]">
                        <span>{stringOf(row, "connectionId", "apiId")}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-black ${badgeClass(stringOf(row, "sourceType"))}`}>
                          {sourceLabel(stringOf(row, "sourceType"), en)}
                        </span>
                        {stringOf(row, "profileRegistered").toUpperCase() !== "Y" ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-black text-amber-700">
                            {en ? "Register Profile" : "프로필 등록 필요"}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">{stringOf(row, "partnerName") || "-"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{stringOf(row, "requestUri", "endpointUrl") || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold">{stringOf(row, "protocol") || "-"}</div>
                      <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "authMethod") || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{stringOf(row, "syncMode") || "-"}</div>
                      <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "httpMethod") || "-"}</div>
                    </td>
                    <td className="px-4 py-3">{stringOf(row, "avgDurationMs") ? `${stringOf(row, "avgDurationMs")}ms` : "-"}</td>
                    <td className="px-4 py-3">
                      <div>{en ? `Trace ${stringOf(row, "traceCount") || "0"}` : `추적 ${stringOf(row, "traceCount") || "0"}건`}</div>
                      <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                        {en ? `Success ${stringOf(row, "successCount") || "0"} / Error ${stringOf(row, "errorCount") || "0"}` : `성공 ${stringOf(row, "successCount") || "0"} / 오류 ${stringOf(row, "errorCount") || "0"}`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "operationStatus", "status"))}`}>
                        {stringOf(row, "operationStatus", "status") || "-"}
                      </span>
                      <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                        {en ? "Last seen " : "마지막 관측 "}
                        {stringOf(row, "lastSeenAt") || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{stringOf(row, "ownerName") || "-"}</div>
                      <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "ownerContact") || "-"}</div>
                    </td>
                  </tr>
                ))}
                {sortedRows.length === 0 ? (
                  <tr className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={9}>
                      {en ? "No external connections match the current filters." : "현재 조건에 맞는 외부연계가 없습니다."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {sortedRows.length > 0 ? <MemberPagination currentPage={pageNumber} totalPages={totalPages} onPageChange={setPageNumber} /> : null}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr,1fr]">
          <div data-help-id="external-connection-list-issues">
            <CollectionResultPanel
              title={en ? "Recent Issues" : "최근 이슈"}
              description={en ? "Trace recent latency and error spikes before changing the connection profile." : "프로필을 바꾸기 전에 최근 지연과 오류 급증 이력을 확인합니다."}
              icon="warning"
            >
              <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2">{en ? "Time" : "시각"}</th>
                    <th className="px-3 py-2">{en ? "Connection" : "연계"}</th>
                    <th className="px-3 py-2">{en ? "Type" : "유형"}</th>
                    <th className="px-3 py-2">{en ? "Status" : "상태"}</th>
                    <th className="px-3 py-2">{en ? "Detail" : "상세"}</th>
                  </tr>
                </thead>
                <tbody>
                  {issueRows.map((row, index) => (
                    <tr key={`${stringOf(row, "occurredAt")}-${index}`} className="border-t border-[var(--kr-gov-border-light)]">
                      <td className="px-3 py-3 whitespace-nowrap">{stringOf(row, "occurredAt")}</td>
                      <td className="px-3 py-3">
                        <a className="text-[var(--kr-gov-blue)] underline-offset-2 hover:underline" href={stringOf(row, "targetRoute")}>
                          {stringOf(row, "connectionName")}
                        </a>
                      </td>
                      <td className="px-3 py-3">{stringOf(row, "issueType")}</td>
                      <td className="px-3 py-3">{stringOf(row, "status")}</td>
                      <td className="px-3 py-3">{stringOf(row, "detail")}</td>
                    </tr>
                  ))}
                  {issueRows.length === 0 ? (
                    <tr className="border-t border-[var(--kr-gov-border-light)]">
                      <td className="px-3 py-6 text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                        {en ? "No recent integration issues were found." : "최근 외부연계 이슈가 없습니다."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              </div>
            </CollectionResultPanel>
          </div>

          <div className="space-y-4">
            <div data-help-id="external-connection-list-guidance">
              <CollectionResultPanel
                title={en ? "Quick Links" : "바로가기"}
                description={en ? "Jump into the related observability views." : "관련 추적 화면으로 바로 이동합니다."}
                icon="link"
              >
                <div className="grid grid-cols-1 gap-3">
                {quickLinks.map((item, index) => (
                  <a key={`${stringOf(item, "label", "title")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm font-bold text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)]" href={stringOf(item, "href", "targetRoute")}>
                    {stringOf(item, "label", "title")}
                  </a>
                ))}
                </div>
              </CollectionResultPanel>

              <CollectionResultPanel
                title={en ? "Operating Guidance" : "운영 가이드"}
                description={en ? "Use the same baseline before approving external access." : "외부 접근 승인 전에 같은 기준으로 점검합니다."}
                icon="fact_check"
              >
                <div className="space-y-3">
                {guidance.map((item, index) => (
                  <article key={`${stringOf(item, "title")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${badgeClass(stringOf(item, "tone"))}`}>
                        {stringOf(item, "tone") || "INFO"}
                      </span>
                      <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</h3>
                    </div>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item, "description", "body")}</p>
                  </article>
                ))}
                </div>
              </CollectionResultPanel>
            </div>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
