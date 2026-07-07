import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { readBootstrappedEmissionResultListPageData } from "../../lib/api/bootstrap";
import { fetchEmissionResultListPage } from "../../lib/api/emission";
import type { EmissionResultListPagePayload } from "../../lib/api/emissionTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminInput, AdminSelect, CollectionResultPanel, DiagnosticCard, GridToolbar, LookupContextStrip, MemberPagination, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { stringOf } from "../admin-system/adminSystemShared";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  resultStatus: string;
  verificationStatus: string;
};

const DEFAULT_FILTERS: Filters = {
  pageIndex: 1,
  searchKeyword: "",
  resultStatus: "",
  verificationStatus: ""
};

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  const search = new URLSearchParams(window.location.search);
  return {
    pageIndex: Number(search.get("pageIndex") || "1") || 1,
    searchKeyword: search.get("searchKeyword") || "",
    resultStatus: search.get("resultStatus") || "",
    verificationStatus: search.get("verificationStatus") || ""
  };
}

function sameFilters(left: Filters, right: Filters) {
  return left.pageIndex === right.pageIndex
    && left.searchKeyword === right.searchKeyword
    && left.resultStatus === right.resultStatus
    && left.verificationStatus === right.verificationStatus;
}

function buildDetailHref(detailUrl: string) {
  const normalizedDetailUrl = String(detailUrl || "").trim();
  if (!normalizedDetailUrl || typeof window === "undefined") {
    return normalizedDetailUrl;
  }
  try {
    const nextUrl = new URL(normalizedDetailUrl, window.location.origin);
    nextUrl.searchParams.set("returnUrl", `${window.location.pathname}${window.location.search}`);
    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  } catch {
    return normalizedDetailUrl;
  }
}

const RESULT_STATUS_LABELS = {
  COMPLETED: { ko: "산정 완료", en: "Completed" },
  REVIEW: { ko: "검토 중", en: "Under Review" },
  DRAFT: { ko: "임시 저장", en: "Draft" }
} as const;

const VERIFICATION_STATUS_LABELS = {
  VERIFIED: { ko: "검증 완료", en: "Verified" },
  PENDING: { ko: "검증 대기", en: "Pending" },
  IN_PROGRESS: { ko: "검증 진행중", en: "In Progress" },
  FAILED: { ko: "재검토 필요", en: "Recheck Needed" },
  NOT_REQUIRED: { ko: "검증 제외", en: "Not Required" }
} as const;

function activeFilterLabels(filters: Filters, en: boolean) {
  const labels: string[] = [];
  if (filters.searchKeyword) {
    labels.push(en ? `Keyword: ${filters.searchKeyword}` : `검색어: ${filters.searchKeyword}`);
  }
  if (filters.resultStatus) {
    const status = RESULT_STATUS_LABELS[filters.resultStatus as keyof typeof RESULT_STATUS_LABELS];
    labels.push(en ? `Calculation: ${status?.en || filters.resultStatus}` : `산정 상태: ${status?.ko || filters.resultStatus}`);
  }
  if (filters.verificationStatus) {
    const status = VERIFICATION_STATUS_LABELS[filters.verificationStatus as keyof typeof VERIFICATION_STATUS_LABELS];
    labels.push(en ? `Verification: ${status?.en || filters.verificationStatus}` : `검증 상태: ${status?.ko || filters.verificationStatus}`);
  }
  return labels;
}

export function EmissionResultListMigrationPage() {
  const en = isEnglish();
  const initial = useMemo<Filters>(() => readInitialFilters(), []);
  const initialPayload = useMemo(() => readBootstrappedEmissionResultListPageData(), []);
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  function syncFilters(next: Filters) {
    setDraft((current) => sameFilters(current, next) ? current : next);
    setFilters((current) => sameFilters(current, next) ? current : next);
  }
  function mergeFilters(updater: (current: Filters) => Filters) {
    setFilters((current) => {
      const next = updater(current);
      setDraft((draftCurrent) => sameFilters(draftCurrent, next) ? draftCurrent : next);
      return sameFilters(current, next) ? current : next;
    });
  }
  const pageState = useAsyncValue<EmissionResultListPagePayload>(() => fetchEmissionResultListPage(filters), [filters.pageIndex, filters.searchKeyword, filters.resultStatus, filters.verificationStatus], {
    initialValue: initialPayload,
    skipInitialLoad: Boolean(initialPayload),
    onSuccess(payload) {
      const next = {
        pageIndex: Number(payload.pageIndex || 1),
        searchKeyword: String(payload.searchKeyword || ""),
        resultStatus: String(payload.resultStatus || ""),
        verificationStatus: String(payload.verificationStatus || "")
      };
      setFilters((current) => sameFilters(current, next) ? current : next);
      setDraft((current) => sameFilters(current, next) ? current : next);
    }
  });
  const page = pageState.value;
  const rows = (page?.emissionResultList || []) as Array<Record<string, unknown>>;
  const totalPages = Number(page?.totalPages || 1);
  const currentPage = Number(page?.pageIndex || 1);
  const totalCount = Number(page?.totalCount || 0);
  const isReviewQueue = filters.resultStatus === "REVIEW";
  const currentPageRows = rows.length;
  const filterLabels = activeFilterLabels(filters, en);
  const activeFilterCount = filterLabels.length;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const search = new URLSearchParams();
    if (filters.pageIndex > 1) {
      search.set("pageIndex", String(filters.pageIndex));
    }
    if (filters.searchKeyword) {
      search.set("searchKeyword", filters.searchKeyword);
    }
    if (filters.resultStatus) {
      search.set("resultStatus", filters.resultStatus);
    }
    if (filters.verificationStatus) {
      search.set("verificationStatus", filters.verificationStatus);
    }
    const nextQuery = search.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [filters]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handlePopState = () => {
      syncFilters(readInitialFilters());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-result-list", {
      language: en ? "en" : "ko",
      pageIndex: currentPage,
      searchKeyword: filters.searchKeyword,
      resultStatus: filters.resultStatus,
      verificationStatus: filters.verificationStatus,
      rowCount: rows.length
    });
    logGovernanceScope("COMPONENT", "emission-result-table", {
      rowCount: rows.length,
      totalPages,
      currentPage
    });
  }, [currentPage, en, filters.resultStatus, filters.searchKeyword, filters.verificationStatus, rows.length, totalPages]);

  function resultBadgeClass(code: string) {
    switch (code) {
      case "COMPLETED": return "bg-emerald-100 text-emerald-700";
      case "REVIEW": return "bg-amber-100 text-amber-700";
      default: return "bg-slate-200 text-slate-700";
    }
  }

  function verificationBadgeClass(code: string) {
    switch (code) {
      case "PENDING": return "bg-blue-100 text-blue-700";
      case "IN_PROGRESS": return "bg-indigo-100 text-indigo-700";
      case "VERIFIED": return "bg-emerald-100 text-emerald-700";
      case "FAILED": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Calculation & Certification" : "산정·인증" },
        { label: en ? "Emission Result List" : "산정 결과 목록" }
      ]}
      contextStrip={(
        <LookupContextStrip
          action={activeFilterCount > 0 ? (
            <button
              className="gov-btn gov-btn-secondary"
              onClick={() => {
                syncFilters({ ...DEFAULT_FILTERS });
              }}
              type="button"
            >
              {en ? "Reset Filters" : "검색 조건 초기화"}
            </button>
          ) : null}
          label={en ? "Result Scope" : "조회 범위"}
          value={(
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>{isReviewQueue ? (en ? "Review queue is active." : "검토 큐가 적용된 상태입니다.") : (en ? "All result rows are visible." : "전체 결과 범위를 조회 중입니다.")}</span>
              <span className="text-xs text-[var(--kr-gov-text-secondary)]">
                {en ? "Active filters" : "적용 필터"} <strong>{activeFilterCount}</strong>
              </span>
              <span className="text-xs text-[var(--kr-gov-text-secondary)]">
                {en ? "Rows" : "행 수"} <strong>{totalCount.toLocaleString()}</strong>
              </span>
              {filterLabels.length > 0 ? (
                <span className="text-xs text-[var(--kr-gov-text-secondary)]">
                  {filterLabels.join(en ? " / " : " / ")}
                </span>
              ) : null}
            </div>
          )}
        />
      )}
      title={en ? "Emission Result List" : "산정 결과 목록"}
      subtitle={en ? "Review emission calculation results by calculation and verification status." : "배출량 산정 결과를 검토 상태와 검증 상태 기준으로 조회합니다."}
      loading={pageState.loading && !page && !pageState.error}
      loadingLabel={en ? "Loading emission result list." : "산정 결과 목록을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
        {!pageState.error && totalCount === 0 ? (
          <PageStatusNotice tone="warning">
            {activeFilterCount > 0
              ? (en ? "No emission results matched the current filters. Reset or widen the search scope." : "현재 필터 조건에 맞는 산정 결과가 없습니다. 검색 조건을 초기화하거나 범위를 넓혀주세요.")
              : (en ? "No emission results are available yet." : "아직 조회 가능한 산정 결과가 없습니다.")}
          </PageStatusNotice>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="emission-result-summary">
          <SummaryMetricCard title={en ? "Visible Results" : "조회 결과"} value={totalCount.toLocaleString()} description={en ? "Current filter result count" : "현재 필터 기준 결과 건수"} />
          <SummaryMetricCard accentClassName="text-amber-600" description={en ? "Rows still waiting for admin review" : "관리자 검토가 남은 결과"} surfaceClassName="bg-amber-50" title={en ? "Under Review" : "검토 진행"} value={Number(page?.reviewCount || 0).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-emerald-600" description={en ? "Rows already verified in the current scope" : "현재 범위에서 검증이 완료된 결과"} surfaceClassName="bg-emerald-50" title={en ? "Verified" : "검증 완료"} value={Number(page?.verifiedCount || 0).toLocaleString()} />
          <SummaryMetricCard title={en ? "Current Page" : "현재 페이지"} value={`${currentPage} / ${totalPages}`} description={en ? "Server-side pagination" : "서버 기준 페이지"} />
        </section>

        {isReviewQueue ? (
          <DiagnosticCard
            actions={(
              <>
                <button
                  className="gov-btn gov-btn-primary"
                  onClick={() => mergeFilters((current) => ({ ...current, verificationStatus: "PENDING", pageIndex: 1 }))}
                  type="button"
                >
                  {en ? "Focus pending verification" : "검증 대기만 보기"}
                </button>
                <button
                  className="gov-btn gov-btn-secondary"
                  onClick={() => {
                    syncFilters({ ...DEFAULT_FILTERS });
                  }}
                  type="button"
                >
                  {en ? "Open all results" : "전체 결과 보기"}
                </button>
              </>
            )}
            data-help-id="emission-result-review-context"
            description={en
              ? "This queue is narrowed to items that still require admin review before verification closure. Keep the URL filter intact so the same queue can be shared or refreshed."
              : "이 큐는 검증 종료 전 관리자 검토가 필요한 결과만 좁혀 보여줍니다. 동일한 검토 범위를 공유하거나 새로고침해도 유지되도록 URL 필터를 함께 유지합니다."}
            eyebrow={en ? "Review Queue" : "검토 큐"}
            status={`${Number(page?.reviewCount || 0).toLocaleString()} ${en ? "items" : "건"}`}
            statusTone="warning"
            title={en ? "Emission review workspace is active" : "배출 결과 검토 작업공간이 활성화되었습니다"}
          />
        ) : null}

        <CollectionResultPanel
          data-help-id="emission-result-search"
          description={en ? "Filter by calculation status, verification status, and keyword before reviewing result rows." : "산정 상태, 검증 상태, 검색어로 먼저 좁힌 뒤 결과 행을 검토합니다."}
          icon="filter_alt"
          title={en ? "Emission Result Filter" : "산정 결과 조회 조건"}
        >
        <form className="grid grid-cols-1 gap-6 md:grid-cols-4" onSubmit={(event) => {
          event.preventDefault();
          logGovernanceScope("ACTION", "emission-result-search", {
            searchKeyword: draft.searchKeyword,
            resultStatus: draft.resultStatus,
            verificationStatus: draft.verificationStatus
          });
          syncFilters({ ...draft, pageIndex: 1 });
        }}>
          <div>
            <label className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="resultStatus">{en ? "Calculation Status" : "산정 상태"}</label>
            <AdminSelect id="resultStatus" value={draft.resultStatus} onChange={(event) => setDraft((current) => ({ ...current, resultStatus: event.target.value }))}>
              <option value="">{en ? "All" : "전체"}</option>
              <option value="COMPLETED">{en ? "Completed" : "산정 완료"}</option>
              <option value="REVIEW">{en ? "Under Review" : "검토 중"}</option>
              <option value="DRAFT">{en ? "Draft" : "임시 저장"}</option>
            </AdminSelect>
          </div>
          <div>
            <label className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="verificationStatus">{en ? "Verification Status" : "검증 상태"}</label>
            <AdminSelect id="verificationStatus" value={draft.verificationStatus} onChange={(event) => setDraft((current) => ({ ...current, verificationStatus: event.target.value }))}>
              <option value="">{en ? "All" : "전체"}</option>
              <option value="VERIFIED">{en ? "Verified" : "검증 완료"}</option>
              <option value="PENDING">{en ? "Pending" : "검증 대기"}</option>
              <option value="IN_PROGRESS">{en ? "In Progress" : "검증 진행중"}</option>
              <option value="FAILED">{en ? "Recheck Needed" : "재검토 필요"}</option>
              <option value="NOT_REQUIRED">{en ? "Not Required" : "검증 제외"}</option>
            </AdminSelect>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="searchKeyword">{en ? "Keyword" : "검색어"}</label>
            <div className="flex gap-2">
              <AdminInput className="flex-1" id="searchKeyword" placeholder={en ? "Search by project, company, or result ID" : "프로젝트명, 기관명, 결과 ID 검색"} value={draft.searchKeyword} onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))} />
              <button className="gov-btn gov-btn-primary" type="submit">{en ? "Search" : "검색"}</button>
              <button
                className="gov-btn gov-btn-secondary"
                onClick={() => {
                  syncFilters({ ...DEFAULT_FILTERS });
                }}
                type="button"
              >
                {en ? "Reset" : "초기화"}
              </button>
            </div>
          </div>
        </form>
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="emission-result-table">
        <GridToolbar
          actions={<p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? `Page rows ${currentPageRows} / total ${totalCount}` : `현재 페이지 ${currentPageRows}건 / 전체 ${totalCount}건`}</p>}
          meta={isReviewQueue
            ? (en ? "Review-focused queue with calculation and verification state kept together for approval follow-up." : "승인 후속 처리를 위해 산정 상태와 검증 상태를 함께 유지한 검토 전용 큐입니다.")
            : (en ? "Review result, company, emission total, and verification state from one table." : "결과, 기관, 총 배출량, 검증 상태를 한 표에서 함께 검토합니다.")}
          title={en ? "Emission Results" : "산정 결과"}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="gov-table-header">
                <th className="px-6 py-4 text-center w-16">{en ? "No." : "번호"}</th>
                <th className="px-6 py-4">{en ? "Result ID / Project" : "결과 ID / 프로젝트명"}</th>
                <th className="px-6 py-4">{en ? "Company" : "기관명"}</th>
                <th className="px-6 py-4">{en ? "Calculated At" : "산정일"}</th>
                <th className="px-6 py-4">{en ? "Total Emission" : "총 배출량"}</th>
                <th className="px-6 py-4 text-center">{en ? "Calculation" : "산정 상태"}</th>
                <th className="px-6 py-4 text-center">{en ? "Verification" : "검증 상태"}</th>
                <th className="px-6 py-4 text-center">{en ? "Action" : "관리"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr><td className="px-6 py-8 text-center text-gray-500" colSpan={8}>{en ? "No emission results found." : "조회된 산정 결과가 없습니다."}</td></tr>
              ) : rows.map((item, index) => {
                const rowNo = Number(page?.totalCount || 0) - ((currentPage - 1) * Number(page?.pageSize || 10) + index);
                return (
                  <tr className="hover:bg-gray-50/50 transition-colors" key={`${stringOf(item, "resultId")}-${index}`}>
                    <td className="px-6 py-4 text-center text-gray-500">{rowNo}</td>
                    <td className="px-6 py-4"><div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "projectName")}</div><div className="text-xs text-gray-400 mt-1">{stringOf(item, "resultId")}</div></td>
                    <td className="px-6 py-4 font-medium text-[var(--kr-gov-text-secondary)]">{stringOf(item, "companyName")}</td>
                    <td className="px-6 py-4 text-gray-500">{stringOf(item, "calculatedAt")}</td>
                    <td className="px-6 py-4 font-bold text-[var(--kr-gov-blue)]">{stringOf(item, "totalEmission")}</td>
                    <td className="px-6 py-4 text-center"><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${resultBadgeClass(stringOf(item, "resultStatusCode"))}`}>{stringOf(item, "resultStatusLabel")}</span></td>
                    <td className="px-6 py-4 text-center"><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${verificationBadgeClass(stringOf(item, "verificationStatusCode"))}`}>{stringOf(item, "verificationStatusLabel")}</span></td>
                    <td className="px-6 py-4 text-center"><a className="inline-flex px-3 py-1.5 bg-[var(--kr-gov-blue)] text-white text-[12px] font-bold rounded-[var(--kr-gov-radius)] hover:bg-[var(--kr-gov-blue-hover)]" href={buildDetailHref(stringOf(item, "detailUrl"))}>{en ? "Detail" : "상세"}</a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <MemberPagination className="border-t-0" currentPage={currentPage} onPageChange={(pageNumber) => mergeFilters((current) => ({ ...current, pageIndex: pageNumber }))} totalPages={totalPages} />
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
