import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { readBootstrappedTradeDuplicatePageData } from "../../lib/api/bootstrap";
import { fetchTradeDuplicatePage } from "../../lib/api/trade";
import type { TradeDuplicatePagePayload } from "../../lib/api/tradeTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import {
  AdminInput,
  AdminSelect,
  CollectionResultPanel,
  GridToolbar,
  MemberPagination,
  PageStatusNotice,
  SummaryMetricCard
} from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  detectionType: string;
  reviewStatus: string;
  riskLevel: string;
};

const DEFAULT_FILTERS: Filters = {
  pageIndex: 1,
  searchKeyword: "",
  detectionType: "",
  reviewStatus: "",
  riskLevel: ""
};

function stringOf(value: unknown, key?: string) {
  if (typeof key === "string" && value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return typeof record[key] === "string" ? (record[key] as string) : "";
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
    detectionType: search.get("detectionType") || "",
    reviewStatus: search.get("reviewStatus") || "",
    riskLevel: search.get("riskLevel") || ""
  };
}

function sameFilters(left: Filters, right: Filters) {
  return left.pageIndex === right.pageIndex
    && left.searchKeyword === right.searchKeyword
    && left.detectionType === right.detectionType
    && left.reviewStatus === right.reviewStatus
    && left.riskLevel === right.riskLevel;
}

function riskBadgeClass(code: string) {
  switch (code) {
    case "HIGH":
      return "bg-rose-100 text-rose-700";
    case "MEDIUM":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-emerald-100 text-emerald-700";
  }
}

function reviewBadgeClass(code: string) {
  switch (code) {
    case "ESCALATED":
      return "bg-rose-100 text-rose-700";
    case "UNDER_REVIEW":
      return "bg-amber-100 text-amber-700";
    case "CLEARED":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function TradeDuplicateMigrationPage() {
  const en = isEnglish();
  const initial = useMemo<Filters>(() => readInitialFilters(), []);
  const initialPayload = useMemo(() => readBootstrappedTradeDuplicatePageData(), []);
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);

  const pageState = useAsyncValue<TradeDuplicatePagePayload>(
    () => fetchTradeDuplicatePage(filters),
    [filters.pageIndex, filters.searchKeyword, filters.detectionType, filters.reviewStatus, filters.riskLevel],
    {
      initialValue: initialPayload,
      skipInitialLoad: Boolean(initialPayload),
      onSuccess(payload) {
        const next = {
          pageIndex: numberOf(payload.pageIndex) || 1,
          searchKeyword: stringOf(payload.searchKeyword),
          detectionType: stringOf(payload.detectionType),
          reviewStatus: stringOf(payload.reviewStatus),
          riskLevel: stringOf(payload.riskLevel)
        };
        setFilters((current) => sameFilters(current, next) ? current : next);
        setDraft((current) => sameFilters(current, next) ? current : next);
      }
    }
  );

  const page = pageState.value;
  const rows = (page?.abnormalTradeRows || []) as Array<Record<string, unknown>>;
  const detectionTypeOptions = (page?.detectionTypeOptions || []) as Array<Record<string, unknown>>;
  const reviewStatusOptions = (page?.reviewStatusOptions || []) as Array<Record<string, unknown>>;
  const riskLevelOptions = (page?.riskLevelOptions || []) as Array<Record<string, unknown>>;
  const escalationAlerts = (page?.escalationAlerts || []) as Array<Record<string, unknown>>;
  const operatorGuidance = (page?.operatorGuidance || []) as Array<Record<string, unknown>>;
  const currentPage = numberOf(page?.pageIndex) || 1;
  const totalPages = numberOf(page?.totalPages) || 1;
  const pageSize = numberOf(page?.pageSize) || 10;
  const totalCount = numberOf(page?.totalCount);
  const selectedRow = rows[0] || null;

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
    if (filters.detectionType) {
      search.set("detectionType", filters.detectionType);
    }
    if (filters.reviewStatus) {
      search.set("reviewStatus", filters.reviewStatus);
    }
    if (filters.riskLevel) {
      search.set("riskLevel", filters.riskLevel);
    }
    const query = search.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [filters]);

  useEffect(() => {
    logGovernanceScope("PAGE", "trade-duplicate", {
      language: en ? "en" : "ko",
      pageIndex: currentPage,
      searchKeyword: filters.searchKeyword,
      detectionType: filters.detectionType,
      reviewStatus: filters.reviewStatus,
      riskLevel: filters.riskLevel,
      rowCount: rows.length
    });
  }, [currentPage, en, filters.detectionType, filters.reviewStatus, filters.riskLevel, filters.searchKeyword, rows.length]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Trade" : "거래" },
        { label: en ? "Abnormal Trade Review" : "이상거래 점검" }
      ]}
      title={en ? "Abnormal Trade Review" : "이상거래 점검"}
      subtitle={en ? "Filter suspicious patterns, compare risk signals, and review the highest-priority case in one workspace." : "의심 거래 패턴을 필터링하고 위험 신호를 비교한 뒤 우선순위가 높은 건을 한 화면에서 검토합니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="trade-duplicate-summary">
          <SummaryMetricCard title={en ? "Open Cases" : "오픈 건수"} value={totalCount.toLocaleString()} />
          <SummaryMetricCard accentClassName="text-rose-600" surfaceClassName="bg-rose-50" title={en ? "Critical" : "치명 위험"} value={numberOf(page?.criticalCount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-amber-600" surfaceClassName="bg-amber-50" title={en ? "In Review" : "검토 진행"} value={numberOf(page?.reviewCount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-indigo-600" surfaceClassName="bg-indigo-50" title={en ? "Settlement Blocked" : "정산 보류"} value={numberOf(page?.settlementBlockedCount).toLocaleString()} />
        </section>

        {escalationAlerts.length > 0 ? (
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-help-id="trade-duplicate-alerts">
            {escalationAlerts.map((item, index) => (
              <article className="gov-card" key={`${stringOf(item, "title")}-${index}`}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{stringOf(item, "tone") || "info"}</p>
                <h3 className="mt-2 text-lg font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "detail")}</p>
              </article>
            ))}
          </section>
        ) : null}

        <CollectionResultPanel
          data-help-id="trade-duplicate-filters"
          description={en ? "Narrow the queue by detection type, review status, risk level, and involved institutions." : "탐지 유형, 검토 상태, 위험도, 관련 기관 기준으로 조사 대상을 좁힙니다."}
          icon="filter_alt"
          title={en ? "Review Conditions" : "점검 조건"}
        >
          <form
            className="grid grid-cols-1 gap-6 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters({ ...draft, pageIndex: 1 });
            }}
          >
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="duplicateDetectionType">{en ? "Detection Type" : "탐지 유형"}</label>
              <AdminSelect id="duplicateDetectionType" value={draft.detectionType} onChange={(event) => setDraft((current) => ({ ...current, detectionType: event.target.value }))}>
                {detectionTypeOptions.map((option, index) => (
                  <option key={`${stringOf(option, "code")}-${index}`} value={stringOf(option, "code")}>{stringOf(option, "label")}</option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="duplicateReviewStatus">{en ? "Review Status" : "검토 상태"}</label>
              <AdminSelect id="duplicateReviewStatus" value={draft.reviewStatus} onChange={(event) => setDraft((current) => ({ ...current, reviewStatus: event.target.value }))}>
                {reviewStatusOptions.map((option, index) => (
                  <option key={`${stringOf(option, "code")}-${index}`} value={stringOf(option, "code")}>{stringOf(option, "label")}</option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="duplicateRiskLevel">{en ? "Risk Level" : "위험도"}</label>
              <AdminSelect id="duplicateRiskLevel" value={draft.riskLevel} onChange={(event) => setDraft((current) => ({ ...current, riskLevel: event.target.value }))}>
                {riskLevelOptions.map((option, index) => (
                  <option key={`${stringOf(option, "code")}-${index}`} value={stringOf(option, "code")}>{stringOf(option, "label")}</option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="duplicateSearchKeyword">{en ? "Keyword" : "검색어"}</label>
              <div className="flex gap-2">
                <AdminInput
                  className="flex-1"
                  id="duplicateSearchKeyword"
                  placeholder={en ? "Review ID, trade ID, contract, institution" : "점검번호, 거래번호, 계약명, 기관명 검색"}
                  value={draft.searchKeyword}
                  onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))}
                />
                <button className="gov-btn gov-btn-primary" type="submit">{en ? "Search" : "검색"}</button>
              </div>
            </div>
          </form>
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="trade-duplicate-table">
          <GridToolbar meta={en ? "Compare suspicious party overlap, repeated price deviation, and settlement blocking signals in one queue." : "의심 당사자 중복, 반복 가격 편차, 정산 차단 신호를 하나의 큐에서 비교합니다."} title={en ? "Abnormal Trade Queue" : "이상거래 큐"} />
          <div className="overflow-x-auto">
            <table className="min-w-[1280px] w-full text-sm text-left">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-6 py-4 text-center w-16">{en ? "No." : "번호"}</th>
                  <th className="px-6 py-4">{en ? "Review / Trade" : "점검 / 거래"}</th>
                  <th className="px-6 py-4">{en ? "Counterparties" : "거래 당사자"}</th>
                  <th className="px-6 py-4">{en ? "Detection Type" : "탐지 유형"}</th>
                  <th className="px-6 py-4">{en ? "Score" : "위험 점수"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Risk" : "위험도"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Review Status" : "검토 상태"}</th>
                  <th className="px-6 py-4">{en ? "Settlement Impact" : "정산 영향"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-gray-500" colSpan={8}>{en ? "No abnormal trades found." : "조회된 이상거래가 없습니다."}</td>
                  </tr>
                ) : rows.map((row, index) => (
                  <tr className="hover:bg-gray-50/50 transition-colors" key={`${stringOf(row, "reviewId")}-${index}`}>
                    <td className="px-6 py-4 text-center text-gray-500">{totalCount - ((currentPage - 1) * pageSize + index)}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "reviewId")}</div>
                      <div className="mt-1 text-xs text-gray-400">{stringOf(row, "tradeId")}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{stringOf(row, "sellerName")}</div>
                      <div className="mt-1 text-xs text-gray-400">{stringOf(row, "buyerName")}</div>
                    </td>
                    <td className="px-6 py-4">{stringOf(row, "detectionTypeLabel")}</td>
                    <td className="px-6 py-4 font-semibold text-[var(--kr-gov-blue)]">{stringOf(row, "riskScore")}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${riskBadgeClass(stringOf(row, "riskLevelCode"))}`}>
                        {stringOf(row, "riskLevelLabel")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${reviewBadgeClass(stringOf(row, "reviewStatusCode"))}`}>
                        {stringOf(row, "reviewStatusLabel")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "settlementActionLabel")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.9fr]">
          <section className="gov-card" data-help-id="trade-duplicate-detail">
            <GridToolbar meta={en ? "Inspect the highest-priority case in the current filtered queue." : "현재 필터 조건에서 우선순위가 가장 높은 건을 확인합니다."} title={en ? "Selected Review Detail" : "선택 상세"} />
            {selectedRow ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  [en ? "Review ID" : "점검번호", stringOf(selectedRow, "reviewId")],
                  [en ? "Trade ID" : "거래번호", stringOf(selectedRow, "tradeId")],
                  [en ? "Contract" : "계약명", stringOf(selectedRow, "contractName")],
                  [en ? "Detection Type" : "탐지 유형", stringOf(selectedRow, "detectionTypeLabel")],
                  [en ? "Recommended Action" : "권고 조치", stringOf(selectedRow, "recommendedAction")],
                  [en ? "Settlement Action" : "정산 조치", stringOf(selectedRow, "settlementActionLabel")],
                  [en ? "Review Owner" : "검토 담당", stringOf(selectedRow, "reviewOwner")],
                  [en ? "Last Updated" : "최근 갱신", stringOf(selectedRow, "updatedAt")]
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{label}</p>
                    <div className="mt-2 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3 text-sm font-medium text-[var(--kr-gov-text-primary)]">
                      {value}
                    </div>
                  </div>
                ))}
                <div className="md:col-span-2">
                  <p className="text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Review Note" : "검토 메모"}</p>
                  <div className="mt-2 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3 text-sm leading-6 text-[var(--kr-gov-text-primary)]">
                    {stringOf(selectedRow, "reviewNote")}
                  </div>
                </div>
              </div>
            ) : (
              <PageStatusNotice tone="warning">{en ? "No review item is selected." : "선택된 점검 대상이 없습니다."}</PageStatusNotice>
            )}
          </section>

          <CollectionResultPanel
            data-help-id="trade-duplicate-guidance"
            description={en ? "Keep the same operator sequence for block, escalate, and release decisions." : "차단, 상향 검토, 해제 판단 시 동일한 운영 순서를 유지합니다."}
            icon="rule"
            title={en ? "Operator Guidance" : "운영 가이드"}
          >
            <div className="space-y-3">
              {operatorGuidance.map((item, index) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3" key={`${stringOf(item, "title")}-${index}`}>
                  <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "detail")}</p>
                </div>
              ))}
              <div className="rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? `Last refreshed: ${stringOf(page, "lastRefreshedAt") || "-"}` : `최근 갱신: ${stringOf(page, "lastRefreshedAt") || "-"}`}
              </div>
            </div>
          </CollectionResultPanel>
        </section>

        <MemberPagination currentPage={currentPage} totalPages={totalPages} onPageChange={(pageIndex) => setFilters((current) => ({ ...current, pageIndex }))} />
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
