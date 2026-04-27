import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  readBootstrappedSettlementCalendarPageData
} from "../../lib/api/bootstrap";
import { fetchSettlementCalendarPage } from "../../lib/api/trade";
import type { SettlementCalendarPagePayload } from "../../lib/api/tradeTypes";
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
  selectedMonth: string;
  searchKeyword: string;
  settlementStatus: string;
  riskLevel: string;
};

const DEFAULT_FILTERS: Filters = {
  pageIndex: 1,
  selectedMonth: "2026-04",
  searchKeyword: "",
  settlementStatus: "",
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
    selectedMonth: search.get("selectedMonth") || DEFAULT_FILTERS.selectedMonth,
    searchKeyword: search.get("searchKeyword") || "",
    settlementStatus: search.get("settlementStatus") || "",
    riskLevel: search.get("riskLevel") || ""
  };
}

function sameFilters(left: Filters, right: Filters) {
  return left.pageIndex === right.pageIndex
    && left.selectedMonth === right.selectedMonth
    && left.searchKeyword === right.searchKeyword
    && left.settlementStatus === right.settlementStatus
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
    case "READY": return "bg-blue-100 text-blue-700";
    case "PENDING": return "bg-amber-100 text-amber-700";
    default: return "bg-rose-100 text-rose-700";
  }
}

export function SettlementCalendarMigrationPage() {
  const en = isEnglish();
  const initial = useMemo<Filters>(() => readInitialFilters(), []);
  const initialPayload = useMemo(() => readBootstrappedSettlementCalendarPageData(), []);
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const pageState = useAsyncValue<SettlementCalendarPagePayload>(
    () => fetchSettlementCalendarPage(filters),
    [filters.pageIndex, filters.selectedMonth, filters.searchKeyword, filters.settlementStatus, filters.riskLevel],
    {
      initialValue: initialPayload,
      skipInitialLoad: Boolean(initialPayload),
      onSuccess(payload) {
        const next = {
          pageIndex: numberOf(payload.pageIndex) || 1,
          selectedMonth: stringOf(payload.selectedMonth) || DEFAULT_FILTERS.selectedMonth,
          searchKeyword: stringOf(payload.searchKeyword),
          settlementStatus: stringOf(payload.settlementStatus),
          riskLevel: stringOf(payload.riskLevel)
        };
        setFilters((current) => sameFilters(current, next) ? current : next);
        setDraft((current) => sameFilters(current, next) ? current : next);
      }
    }
  );
  const page = pageState.value;
  const monthOptions = (page?.monthOptions || []) as Array<Record<string, unknown>>;
  const statusOptions = (page?.settlementStatusOptions || []) as Array<Record<string, unknown>>;
  const riskOptions = (page?.riskLevelOptions || []) as Array<Record<string, unknown>>;
  const calendarDays = (page?.calendarDays || []) as Array<Record<string, unknown>>;
  const scheduleRows = (page?.scheduleRows || []) as Array<Record<string, unknown>>;
  const alertRows = (page?.alertRows || []) as Array<Record<string, unknown>>;
  const currentPage = numberOf(page?.pageIndex) || 1;
  const totalPages = numberOf(page?.totalPages) || 1;
  const pageSize = numberOf(page?.pageSize) || 10;
  const totalCount = numberOf(page?.totalScheduledCount);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const search = new URLSearchParams();
    if (filters.pageIndex > 1) search.set("pageIndex", String(filters.pageIndex));
    if (filters.selectedMonth) search.set("selectedMonth", filters.selectedMonth);
    if (filters.searchKeyword) search.set("searchKeyword", filters.searchKeyword);
    if (filters.settlementStatus) search.set("settlementStatus", filters.settlementStatus);
    if (filters.riskLevel) search.set("riskLevel", filters.riskLevel);
    const query = search.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [filters]);

  useEffect(() => {
    logGovernanceScope("PAGE", "settlement-calendar", {
      language: en ? "en" : "ko",
      selectedMonth: filters.selectedMonth,
      searchKeyword: filters.searchKeyword,
      settlementStatus: filters.settlementStatus,
      riskLevel: filters.riskLevel,
      scheduleRowCount: scheduleRows.length
    });
  }, [en, filters.riskLevel, filters.searchKeyword, filters.selectedMonth, filters.settlementStatus, scheduleRows.length]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Trading & Settlement" : "거래/정산" },
        { label: en ? "Settlement Calendar" : "정산 캘린더" }
      ]}
      title={en ? "Settlement Calendar" : "정산 캘린더"}
      subtitle={en ? "Coordinate month-end settlement checkpoints, due dates, and exception queues in one operational calendar." : "월 마감 정산 일정, 마감 기한, 예외 큐를 하나의 운영 캘린더에서 조정합니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="settlement-calendar-summary">
          <SummaryMetricCard title={en ? "Scheduled" : "예정 건수"} value={totalCount.toLocaleString()} />
          <SummaryMetricCard accentClassName="text-blue-700" surfaceClassName="bg-blue-50" title={en ? "Due Today" : "금일 마감"} value={numberOf(page?.dueTodayCount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-rose-700" surfaceClassName="bg-rose-50" title={en ? "High Risk" : "고위험"} value={numberOf(page?.highRiskCount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-emerald-700" surfaceClassName="bg-emerald-50" title={en ? "Completed" : "완료"} value={numberOf(page?.completedCount).toLocaleString()} />
        </section>

        <CollectionResultPanel
          data-help-id="settlement-calendar-filter"
          title={en ? "Settlement Control Filters" : "정산 운영 필터"}
          description={en ? "Narrow the monthly control board by settlement month, operator keyword, readiness state, and risk." : "정산 월, 운영 키워드, 준비 상태, 위험도 기준으로 월간 관리 보드를 좁힙니다."}
          icon="calendar_month"
        >
          <form
            className="grid grid-cols-1 gap-6 lg:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters({ ...draft, pageIndex: 1 });
            }}
          >
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="selectedMonth">{en ? "Month" : "정산 월"}</label>
              <AdminSelect id="selectedMonth" value={draft.selectedMonth} onChange={(event) => setDraft((current) => ({ ...current, selectedMonth: event.target.value }))}>
                {monthOptions.map((option, index) => (
                  <option key={`${stringOf(option, "value")}-${index}`} value={stringOf(option, "value")}>{stringOf(option, "label")}</option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="settlementStatus">{en ? "Status" : "정산 상태"}</label>
              <AdminSelect id="settlementStatus" value={draft.settlementStatus} onChange={(event) => setDraft((current) => ({ ...current, settlementStatus: event.target.value }))}>
                {statusOptions.map((option, index) => (
                  <option key={`${stringOf(option, "code")}-${index}`} value={stringOf(option, "code")}>{stringOf(option, "label")}</option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="riskLevel">{en ? "Risk" : "위험도"}</label>
              <AdminSelect id="riskLevel" value={draft.riskLevel} onChange={(event) => setDraft((current) => ({ ...current, riskLevel: event.target.value }))}>
                {riskOptions.map((option, index) => (
                  <option key={`${stringOf(option, "code")}-${index}`} value={stringOf(option, "code")}>{stringOf(option, "label")}</option>
                ))}
              </AdminSelect>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="settlementSearchKeyword">{en ? "Keyword" : "검색어"}</label>
              <div className="flex gap-2">
                <AdminInput
                  className="flex-1"
                  id="settlementSearchKeyword"
                  placeholder={en ? "Institution, owner, item, or settlement ID" : "기관명, 담당자, 항목명, 정산 ID 검색"}
                  value={draft.searchKeyword}
                  onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))}
                />
                <button className="gov-btn gov-btn-primary" type="submit">{en ? "Search" : "조회"}</button>
              </div>
            </div>
          </form>
        </CollectionResultPanel>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <article className="gov-card" data-help-id="settlement-calendar-board">
            <GridToolbar
              title={en ? "Monthly Due Calendar" : "월간 마감 캘린더"}
              meta={en ? "Daily settlement load, exception counts, and due concentration are shown together." : "일별 정산 물량, 예외 건수, 마감 집중 구간을 함께 보여줍니다."}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              {calendarDays.map((item, index) => (
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4" key={`${stringOf(item, "date")}-${index}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--kr-gov-text-secondary)]">{stringOf(item, "weekdayLabel")}</p>
                      <h3 className="mt-2 text-2xl font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "dayLabel")}</h3>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeClass(stringOf(item, "riskLevelCode"), "risk")}`}>
                      {stringOf(item, "riskLevelLabel")}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--kr-gov-text-secondary)]">{en ? "Due" : "마감 예정"}</span>
                      <span className="font-bold">{stringOf(item, "scheduledCount")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--kr-gov-text-secondary)]">{en ? "Exceptions" : "예외"}</span>
                      <span className="font-bold text-rose-700">{stringOf(item, "exceptionCount")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--kr-gov-text-secondary)]">{en ? "Owner" : "담당"}</span>
                      <span className="font-bold">{stringOf(item, "ownerName")}</span>
                    </div>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "focusNote")}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="gov-card" data-help-id="settlement-calendar-alerts">
            <GridToolbar
              title={en ? "Operator Alerts" : "운영 알림"}
              meta={en ? "Escalations and dependencies that should move before month close." : "월 마감 전에 선조치가 필요한 에스컬레이션과 의존 이슈입니다."}
            />
            <div className="space-y-3">
              {alertRows.map((item, index) => (
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4" key={`${stringOf(item, "title")}-${index}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "description")}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${stringOf(item, "badgeClassName")}`}>{stringOf(item, "badgeLabel")}</span>
                  </div>
                  <a className="mt-3 inline-flex text-sm font-bold text-[var(--kr-gov-blue)] hover:underline" href={stringOf(item, "actionUrl")}>
                    {stringOf(item, "actionLabel")}
                  </a>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="settlement-calendar-table">
          <GridToolbar
            title={en ? "Settlement Schedule Queue" : "정산 일정 큐"}
            meta={en ? "Prioritize counterparties, owners, and blockers from the same queue." : "동일한 큐에서 상대 기관, 담당자, 차단 사유를 우선순위로 점검합니다."}
          />
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-6 py-4 text-center w-16">{en ? "No." : "번호"}</th>
                  <th className="px-6 py-4">{en ? "Settlement" : "정산 항목"}</th>
                  <th className="px-6 py-4">{en ? "Institution" : "기관"}</th>
                  <th className="px-6 py-4">{en ? "Owner" : "담당자"}</th>
                  <th className="px-6 py-4">{en ? "Due Date" : "마감일"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Amount" : "정산 금액"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Status" : "정산 상태"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Risk" : "위험도"}</th>
                  <th className="px-6 py-4">{en ? "Blocker" : "차단 사유"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scheduleRows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-gray-500" colSpan={9}>{en ? "No settlement schedules found." : "조회된 정산 일정이 없습니다."}</td>
                  </tr>
                ) : scheduleRows.map((row, index) => (
                  <tr className="hover:bg-gray-50/50 transition-colors" key={`${stringOf(row, "settlementId")}-${index}`}>
                    <td className="px-6 py-4 text-center text-gray-500">{totalCount - ((currentPage - 1) * pageSize + index)}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "settlementTitle")}</div>
                      <div className="mt-1 text-xs text-gray-400">{stringOf(row, "settlementId")}</div>
                    </td>
                    <td className="px-6 py-4">{stringOf(row, "institutionName")}</td>
                    <td className="px-6 py-4">{stringOf(row, "ownerName")}</td>
                    <td className="px-6 py-4">{stringOf(row, "dueDate")}</td>
                    <td className="px-6 py-4 text-right font-semibold">{stringOf(row, "amount")}</td>
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
                    <td className="px-6 py-4 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "blockerReason")}</td>
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
