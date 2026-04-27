import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { readBootstrappedRefundListPageData } from "../../lib/api/bootstrap";
import { fetchRefundListPage } from "../../lib/api/trade";
import type { RefundListPagePayload } from "../../lib/api/tradeTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminInput, AdminSelect, CollectionResultPanel, GridToolbar, MemberPagination, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  status: string;
  riskLevel: string;
};

const DEFAULT_FILTERS: Filters = {
  pageIndex: 1,
  searchKeyword: "",
  status: "",
  riskLevel: ""
};

function stringOf(value: unknown, key?: string) {
  if (typeof key === "string" && value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return typeof record[key] === "string" ? record[key] as string : "";
  }
  return typeof value === "string" ? value : "";
}

function numberOf(value: unknown) {
  return typeof value === "number" ? value : Number(value || 0);
}

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  const search = new URLSearchParams(window.location.search);
  return {
    pageIndex: Number(search.get("pageIndex") || "1") || 1,
    searchKeyword: search.get("searchKeyword") || "",
    status: search.get("status") || "",
    riskLevel: search.get("riskLevel") || ""
  };
}

function sameFilters(left: Filters, right: Filters) {
  return left.pageIndex === right.pageIndex
    && left.searchKeyword === right.searchKeyword
    && left.status === right.status
    && left.riskLevel === right.riskLevel;
}

function badgeClass(code: string, kind: "status" | "risk") {
  if (kind === "risk") {
    switch (code) {
      case "HIGH": return "bg-rose-100 text-rose-700";
      case "MEDIUM": return "bg-amber-100 text-amber-700";
      default: return "bg-emerald-100 text-emerald-700";
    }
  }
  switch (code) {
    case "COMPLETED": return "bg-emerald-100 text-emerald-700";
    case "TRANSFER_SCHEDULED": return "bg-indigo-100 text-indigo-700";
    case "APPROVED": return "bg-blue-100 text-blue-700";
    case "REJECTED": return "bg-slate-200 text-slate-700";
    case "ACCOUNT_REVIEW": return "bg-amber-100 text-amber-700";
    default: return "bg-rose-50 text-rose-700";
  }
}

export function RefundListMigrationPage() {
  const en = isEnglish();
  const initial = useMemo<Filters>(() => readInitialFilters(), []);
  const initialPayload = useMemo(() => readBootstrappedRefundListPageData(), []);
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const pageState = useAsyncValue<RefundListPagePayload>(
    () => fetchRefundListPage(filters),
    [filters.pageIndex, filters.searchKeyword, filters.status, filters.riskLevel],
    {
      initialValue: initialPayload,
      skipInitialLoad: Boolean(initialPayload),
      onSuccess(payload) {
        const next = {
          pageIndex: numberOf(payload.pageIndex) || 1,
          searchKeyword: stringOf(payload.searchKeyword),
          status: stringOf(payload.status),
          riskLevel: stringOf(payload.riskLevel)
        };
        setFilters((current) => sameFilters(current, next) ? current : next);
        setDraft((current) => sameFilters(current, next) ? current : next);
      }
    }
  );
  const page = pageState.value;
  const rows = (page?.refundRows || []) as Array<Record<string, unknown>>;
  const statusOptions = (page?.statusOptions || []) as Array<Record<string, unknown>>;
  const riskLevelOptions = (page?.riskLevelOptions || []) as Array<Record<string, unknown>>;
  const alerts = (page?.refundAlerts || []) as Array<Record<string, unknown>>;
  const currentPage = numberOf(page?.pageIndex) || 1;
  const totalPages = numberOf(page?.totalPages) || 1;
  const pageSize = numberOf(page?.pageSize) || 8;
  const totalCount = numberOf(page?.totalCount);

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
    if (filters.status) {
      search.set("status", filters.status);
    }
    if (filters.riskLevel) {
      search.set("riskLevel", filters.riskLevel);
    }
    const query = search.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [filters]);

  useEffect(() => {
    logGovernanceScope("PAGE", "refund-list", {
      language: en ? "en" : "ko",
      pageIndex: currentPage,
      searchKeyword: filters.searchKeyword,
      status: filters.status,
      riskLevel: filters.riskLevel,
      rowCount: rows.length
    });
  }, [currentPage, en, filters.riskLevel, filters.searchKeyword, filters.status, rows.length]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Payment" : "결제/환불" },
        { label: en ? "Refund Request List" : "환불 요청 목록" }
      ]}
      title={en ? "Refund Request List" : "환불 요청 목록"}
      subtitle={en ? "Review account verification, approval readiness, and transfer scheduling in one refund queue." : "환불 계좌 검수, 승인 준비, 이체 일정을 하나의 운영 큐에서 함께 관리합니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="refund-list-summary">
          <SummaryMetricCard title={en ? "Visible Requests" : "조회 요청"} value={totalCount.toLocaleString()} />
          <SummaryMetricCard accentClassName="text-amber-600" surfaceClassName="bg-amber-50" title={en ? "Pending / Account Review" : "접수 / 계좌 검수"} value={numberOf(page?.pendingCount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-blue-600" surfaceClassName="bg-blue-50" title={en ? "In Review" : "검토중"} value={numberOf(page?.inReviewCount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-emerald-600" surfaceClassName="bg-emerald-50" title={en ? "Scheduled / Completed" : "이체 예정 / 완료"} value={(numberOf(page?.transferScheduledCount) + numberOf(page?.completedCount)).toLocaleString()} />
        </section>

        {alerts.length > 0 ? (
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {alerts.map((item, index) => (
              <article className="gov-card" key={`${stringOf(item, "title")}-${index}`}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{stringOf(item, "tone") || "info"}</p>
                <h3 className="mt-2 text-lg font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "detail")}</p>
              </article>
            ))}
          </section>
        ) : null}

        <CollectionResultPanel
          data-help-id="refund-list-filter"
          description={en ? "Filter the queue by refund status, risk level, applicant, account, or refund reason." : "환불 상태, 리스크, 신청자, 계좌, 환불 사유 기준으로 운영 큐를 좁힙니다."}
          icon="filter_alt"
          title={en ? "Refund Search Conditions" : "환불 조회 조건"}
        >
          <form
            className="grid grid-cols-1 gap-6 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters({ ...draft, pageIndex: 1 });
            }}
          >
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="refundStatus">{en ? "Status" : "처리 상태"}</label>
              <AdminSelect id="refundStatus" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
                {statusOptions.map((option, index) => (
                  <option key={`${stringOf(option, "code")}-${index}`} value={stringOf(option, "code")}>{stringOf(option, "label")}</option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="refundRiskLevel">{en ? "Risk" : "리스크"}</label>
              <AdminSelect id="refundRiskLevel" value={draft.riskLevel} onChange={(event) => setDraft((current) => ({ ...current, riskLevel: event.target.value }))}>
                {riskLevelOptions.map((option, index) => (
                  <option key={`${stringOf(option, "code")}-${index}`} value={stringOf(option, "code")}>{stringOf(option, "label")}</option>
                ))}
              </AdminSelect>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="refundSearchKeyword">{en ? "Keyword" : "검색어"}</label>
              <div className="flex gap-2">
                <AdminInput
                  className="flex-1"
                  id="refundSearchKeyword"
                  placeholder={en ? "Refund ID, company, applicant, account, or reason" : "환불번호, 기업명, 신청자, 계좌, 환불 사유 검색"}
                  value={draft.searchKeyword}
                  onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))}
                />
                <button className="gov-btn gov-btn-primary" type="submit">{en ? "Search" : "검색"}</button>
              </div>
            </div>
          </form>
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="refund-list-table">
          <GridToolbar
            meta={en ? "Prioritize evidence validation, account checks, and treasury batching from the same table." : "증빙 검증, 계좌 확인, 자금 배치 우선순위를 동일한 운영 테이블에서 확인합니다."}
            title={en ? "Refund Operations Queue" : "환불 운영 목록"}
          />
          <div className="overflow-x-auto">
            <table className="min-w-[1380px] w-full text-sm text-left">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-6 py-4 text-center w-16">{en ? "No." : "번호"}</th>
                  <th className="px-6 py-4">{en ? "Refund / Company" : "환불 / 기업"}</th>
                  <th className="px-6 py-4">{en ? "Applicant" : "신청자"}</th>
                  <th className="px-6 py-4">{en ? "Payment / Account" : "결제 / 환불계좌"}</th>
                  <th className="px-6 py-4">{en ? "Requested" : "요청 금액"}</th>
                  <th className="px-6 py-4">{en ? "Refundable" : "환불 가능 금액"}</th>
                  <th className="px-6 py-4">{en ? "Requested At" : "요청 일시"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Status" : "상태"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Risk" : "리스크"}</th>
                  <th className="px-6 py-4">{en ? "Reason / Next Action" : "사유 / 다음 조치"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-gray-500" colSpan={10}>{en ? "No refund requests found." : "조회된 환불 요청이 없습니다."}</td>
                  </tr>
                ) : rows.map((row, index) => (
                  <tr className="hover:bg-gray-50/50 transition-colors" key={`${stringOf(row, "refundId")}-${index}`}>
                    <td className="px-6 py-4 text-center text-gray-500">{totalCount - ((currentPage - 1) * pageSize + index)}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "refundId")}</div>
                      <div className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "companyName")}</div>
                    </td>
                    <td className="px-6 py-4">{stringOf(row, "applicantName")}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold">{stringOf(row, "paymentMethodLabel")}</div>
                      <div className="mt-1 text-xs text-gray-500">{stringOf(row, "accountMasked")}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold">{stringOf(row, "requestedAmount")}</td>
                    <td className="px-6 py-4 font-semibold text-[var(--kr-gov-blue)]">{stringOf(row, "refundableAmount")}</td>
                    <td className="px-6 py-4 text-gray-500">{stringOf(row, "requestedAt")}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${badgeClass(stringOf(row, "statusCode"), "status")}`}>
                        {stringOf(row, "statusLabel")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${badgeClass(stringOf(row, "riskLevelCode"), "risk")}`}>
                        {stringOf(row, "riskLevelLabel")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[var(--kr-gov-text-primary)]">{stringOf(row, "reasonSummary")}</div>
                      <div className="mt-2 text-xs font-semibold text-[var(--kr-gov-blue)]">{stringOf(row, "nextActionLabel")}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MemberPagination currentPage={currentPage} totalPages={totalPages} onPageChange={(pageNumber) => setFilters((current) => ({ ...current, pageIndex: pageNumber }))} />
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
