import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  readBootstrappedTradeStatisticsPageData
} from "../../lib/api/bootstrap";
import { fetchTradeStatisticsPage } from "../../lib/api/trade";
import type { TradeStatisticsPagePayload } from "../../lib/api/tradeTypes";
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
  periodFilter: string;
  tradeType: string;
  settlementStatus: string;
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

export function TradeStatisticsMigrationPage() {
  const en = isEnglish();
  const initial = useMemo<Filters>(() => {
    const search = new URLSearchParams(window.location.search);
    return {
      pageIndex: Number(search.get("pageIndex") || "1") || 1,
      searchKeyword: search.get("searchKeyword") || "",
      periodFilter: search.get("periodFilter") || "LAST_12_MONTHS",
      tradeType: search.get("tradeType") || "",
      settlementStatus: search.get("settlementStatus") || ""
    };
  }, []);
  const initialPayload = useMemo(() => readBootstrappedTradeStatisticsPageData(), []);
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const pageState = useAsyncValue<TradeStatisticsPagePayload>(
    () => fetchTradeStatisticsPage(filters),
    [filters.pageIndex, filters.searchKeyword, filters.periodFilter, filters.tradeType, filters.settlementStatus],
    {
      initialValue: initialPayload,
      skipInitialLoad: Boolean(initialPayload),
      onSuccess(payload) {
        setDraft({
          pageIndex: numberOf(payload.pageIndex) || 1,
          searchKeyword: stringOf(payload.searchKeyword),
          periodFilter: stringOf(payload.periodFilter) || "LAST_12_MONTHS",
          tradeType: stringOf(payload.tradeType),
          settlementStatus: stringOf(payload.settlementStatus)
        });
      }
    }
  );
  const page = pageState.value;
  const monthlyRows = (page?.monthlyRows || []) as Array<Record<string, unknown>>;
  const tradeTypeRows = (page?.tradeTypeRows || []) as Array<Record<string, unknown>>;
  const institutionRows = (page?.institutionRows || []) as Array<Record<string, unknown>>;
  const alertRows = (page?.alertRows || []) as Array<Record<string, unknown>>;
  const currentPage = numberOf(page?.pageIndex) || 1;
  const totalPages = numberOf(page?.totalPages) || 1;
  const maxVolume = Math.max(1, ...monthlyRows.map((item) => numberOf(item.tradeVolume)));

  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.pageIndex > 1) next.set("pageIndex", String(filters.pageIndex));
    if (filters.searchKeyword) next.set("searchKeyword", filters.searchKeyword);
    if (filters.periodFilter && filters.periodFilter !== "LAST_12_MONTHS") next.set("periodFilter", filters.periodFilter);
    if (filters.tradeType) next.set("tradeType", filters.tradeType);
    if (filters.settlementStatus) next.set("settlementStatus", filters.settlementStatus);
    const query = next.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [filters]);

  useEffect(() => {
    logGovernanceScope("PAGE", "trade-statistics", {
      language: en ? "en" : "ko",
      searchKeyword: filters.searchKeyword,
      periodFilter: filters.periodFilter,
      tradeType: filters.tradeType,
      settlementStatus: filters.settlementStatus,
      institutionRowCount: institutionRows.length
    });
  }, [en, filters.periodFilter, filters.searchKeyword, filters.settlementStatus, filters.tradeType, institutionRows.length]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Trading & Settlement" : "거래/정산" },
        { label: en ? "Settlement Reports" : "정산 리포트" }
      ]}
      title={en ? "Settlement Reports" : "정산 리포트"}
      subtitle={en ? "Monitor settlement throughput, backlog, exceptions, and institution concentration from one reporting workspace." : "정산 처리량, 백로그, 예외, 기관별 집중도를 하나의 리포트 작업공간에서 확인합니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-5" data-help-id="trade-statistics-summary">
          <SummaryMetricCard title={en ? "Trade Volume" : "거래 물량"} value={numberOf(page?.totalTradeVolume).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-blue-700" surfaceClassName="bg-blue-50" title={en ? "Settlement Amount" : "정산 금액"} value={numberOf(page?.totalSettlementAmount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-amber-700" surfaceClassName="bg-amber-50" title={en ? "Pending" : "정산 대기"} value={numberOf(page?.pendingSettlementCount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-rose-700" surfaceClassName="bg-rose-50" title={en ? "Exceptions" : "예외"} value={numberOf(page?.exceptionCount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-emerald-700" surfaceClassName="bg-emerald-50" title={en ? "Completion Rate" : "완료율"} value={`${stringOf(page?.settlementCompletionRate)}%`} description={`${stringOf(page?.avgSettlementDays)}${en ? " days avg." : "일 평균"}`} />
        </section>

        <CollectionResultPanel
          data-help-id="trade-statistics-filter"
          title={en ? "Report Filters" : "리포트 조회 조건"}
          description={en ? "Slice the report by period, trade type, settlement state, and institution keyword." : "기간, 거래 유형, 정산 상태, 기관 키워드 기준으로 리포트 범위를 좁힙니다."}
          icon="monitoring"
        >
          <form className="grid grid-cols-1 gap-4 lg:grid-cols-5" onSubmit={(event) => {
            event.preventDefault();
            setFilters({ ...draft, pageIndex: 1 });
          }}>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="periodFilter">{en ? "Period" : "기간"}</label>
              <AdminSelect id="periodFilter" value={draft.periodFilter} onChange={(event) => setDraft((current) => ({ ...current, periodFilter: event.target.value }))}>
                <option value="LAST_12_MONTHS">{en ? "Last 12 months" : "최근 12개월"}</option>
                <option value="LAST_6_MONTHS">{en ? "Last 6 months" : "최근 6개월"}</option>
                <option value="Q1_2026">{en ? "2026 Q1" : "2026년 1분기"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="tradeType">{en ? "Trade Type" : "거래 유형"}</label>
              <AdminSelect id="tradeType" value={draft.tradeType} onChange={(event) => setDraft((current) => ({ ...current, tradeType: event.target.value }))}>
                <option value="">{en ? "All" : "전체"}</option>
                <option value="KETS">{en ? "K-ETS Credit" : "배출권"}</option>
                <option value="REC">{en ? "REC Package" : "REC 패키지"}</option>
                <option value="VOLUNTARY">{en ? "Voluntary Credit" : "자발적 감축실적"}</option>
                <option value="MIXED">{en ? "Mixed Settlement" : "혼합 정산"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="settlementStatus">{en ? "Settlement Status" : "정산 상태"}</label>
              <AdminSelect id="settlementStatus" value={draft.settlementStatus} onChange={(event) => setDraft((current) => ({ ...current, settlementStatus: event.target.value }))}>
                <option value="">{en ? "All" : "전체"}</option>
                <option value="PENDING">{en ? "Pending" : "대기"}</option>
                <option value="IN_PROGRESS">{en ? "In Progress" : "진행중"}</option>
                <option value="EXCEPTION">{en ? "Exception" : "예외"}</option>
                <option value="DONE">{en ? "Done" : "완료"}</option>
              </AdminSelect>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="searchKeyword">{en ? "Institution Keyword" : "기관 키워드"}</label>
              <div className="flex gap-2">
                <AdminInput className="flex-1" id="searchKeyword" placeholder={en ? "Institution, counterparty, or contract keyword" : "기관명, 상대 기관, 계약명 키워드"} value={draft.searchKeyword} onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))} />
                <button className="gov-btn gov-btn-primary" type="submit">{en ? "Search" : "조회"}</button>
              </div>
            </div>
          </form>
        </CollectionResultPanel>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="gov-card" data-help-id="trade-statistics-trend">
            <GridToolbar title={en ? "Monthly Settlement Trend" : "월별 정산 추이"} meta={en ? "Compare monthly trade volume, pending queue, and exception shifts." : "월별 거래 물량, 대기 큐, 예외 변화를 함께 비교합니다."} />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {monthlyRows.map((item) => {
                const volumeHeight = Math.max(18, Math.round((numberOf(item.tradeVolume) / maxVolume) * 148));
                return (
                  <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-4" key={stringOf(item, "monthLabel")}>
                    <div className="flex h-[170px] items-end justify-center gap-2">
                      <div className="w-8 rounded-t-md bg-[var(--kr-gov-blue)]" style={{ height: `${volumeHeight}px` }} />
                      <div className="w-5 rounded-t-md bg-amber-300" style={{ height: `${Math.max(10, numberOf(item.pendingCount) * 8)}px` }} />
                      <div className="w-5 rounded-t-md bg-rose-300" style={{ height: `${Math.max(10, numberOf(item.exceptionCount) * 12)}px` }} />
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-sm font-bold">{stringOf(item, "monthLabel")}</p>
                      <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">{en ? "Volume" : "물량"} {numberOf(item.tradeVolume).toLocaleString()}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </article>

          <article className="gov-card" data-help-id="trade-statistics-alerts">
            <GridToolbar title={en ? "Operational Alerts" : "운영 알림"} meta={en ? "Prioritize queues or institutions that need same-day operator attention." : "당일 우선 확인이 필요한 큐와 기관을 우선순위로 정리합니다."} />
            <div className="space-y-3">
              {alertRows.map((item, index) => (
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4" key={`${stringOf(item, "title")}-${index}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</p>
                      <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item, "description")}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${stringOf(item, "toneClassName")}`}>{stringOf(item, "badge")}</span>
                  </div>
                  <a className="mt-3 inline-flex text-sm font-bold text-[var(--kr-gov-blue)] hover:underline" href={stringOf(item, "actionUrl")}>{stringOf(item, "actionLabel")}</a>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="trade-statistics-type-table">
          <GridToolbar title={en ? "Trade Type Distribution" : "거래 유형별 분포"} meta={en ? "Compare request, completed, pending, exception, and lead-time by settlement type." : "정산 유형별 신청, 완료, 대기, 예외, 평균 처리일을 비교합니다."} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-6 py-4">{en ? "Type" : "유형"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Requests" : "신청"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Completed" : "완료"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Pending" : "대기"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Exceptions" : "예외"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Avg. Days" : "평균 처리일"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Share" : "비중"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tradeTypeRows.map((item) => (
                  <tr key={stringOf(item, "tradeTypeCode")}>
                    <td className="px-6 py-4 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "tradeTypeLabel")}</td>
                    <td className="px-6 py-4 text-right">{numberOf(item.requestCount).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-[var(--kr-gov-blue)]">{numberOf(item.completedCount).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-amber-700">{numberOf(item.pendingCount).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-rose-700">{numberOf(item.exceptionCount).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">{stringOf(item, "avgSettlementDays")}</td>
                    <td className="px-6 py-4 text-right">{stringOf(item, "shareRate")}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="trade-statistics-institution-table">
          <GridToolbar title={en ? "Institution Settlement Pace" : "기관별 정산 처리 현황"} meta={en ? "Track institution and counterparty-level volume, amount, pending, and exception concentration." : "기관과 상대 기관 단위의 물량, 금액, 대기, 예외 집중도를 추적합니다."} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-6 py-4">{en ? "Institution / Counterparty" : "기관 / 상대 기관"}</th>
                  <th className="px-6 py-4">{en ? "Primary Contract" : "대표 계약"}</th>
                  <th className="px-6 py-4">{en ? "Type" : "유형"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Volume" : "물량"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Amount" : "정산 금액"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Pending" : "대기"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Exceptions" : "예외"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Avg. Days" : "평균 처리일"}</th>
                  <th className="px-6 py-4">{en ? "Last Settled" : "최근 정산일"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {institutionRows.map((item) => (
                  <tr key={stringOf(item, "insttId")}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "insttName")}</div>
                      <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(item, "counterpartyName")}</div>
                    </td>
                    <td className="px-6 py-4">{stringOf(item, "primaryContractName")}</td>
                    <td className="px-6 py-4">{stringOf(item, "tradeTypeLabel")}</td>
                    <td className="px-6 py-4 text-right">{numberOf(item.tradeVolume).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-semibold">{numberOf(item.settlementAmount).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-amber-700">{numberOf(item.pendingCount).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-rose-700">{numberOf(item.exceptionCount).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">{stringOf(item, "avgSettlementDays")}</td>
                    <td className="px-6 py-4">
                      <a className="font-bold text-[var(--kr-gov-blue)] hover:underline" href={stringOf(item, "detailUrl")}>{stringOf(item, "lastSettledAt")}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MemberPagination className="border-t-0" currentPage={currentPage} onPageChange={(pageIndex) => setFilters((current) => ({ ...current, pageIndex }))} totalPages={totalPages} />
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
