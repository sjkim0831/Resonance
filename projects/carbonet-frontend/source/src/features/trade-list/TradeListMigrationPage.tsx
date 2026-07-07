import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter, UserPortalHeader } from "../../components/user-shell/UserPortalChrome";
import { readBootstrappedTradeListPageData } from "../../lib/api/bootstrap";
import { fetchTradeListPage } from "../../lib/api/trade";
import type { TradeListPagePayload } from "../../lib/api/tradeTypes";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import {
  AdminInput,
  AdminSelect,
  GridToolbar,
  MemberButton,
  MemberButtonGroup,
  MemberPagination,
  PageStatusNotice,
  SummaryMetricCard
} from "../admin-ui/common";
import { AdminListPageFrame } from "../admin-ui/pageFrames";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  tradeStatus: string;
  settlementStatus: string;
};

type PendingActionCard = {
  key: string;
  tone: "danger" | "warning" | "info" | "healthy";
  badge: string;
  title: string;
  detail: string;
  timeLabel: string;
  primaryLabel: string;
  href: string;
  filterStatus?: string;
};

const DEFAULT_FILTERS: Filters = {
  pageIndex: 1,
  searchKeyword: "",
  tradeStatus: "",
  settlementStatus: ""
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
    tradeStatus: search.get("tradeStatus") || "",
    settlementStatus: search.get("settlementStatus") || ""
  };
}

function sameFilters(left: Filters, right: Filters) {
  return left.pageIndex === right.pageIndex
    && left.searchKeyword === right.searchKeyword
    && left.tradeStatus === right.tradeStatus
    && left.settlementStatus === right.settlementStatus;
}

function badgeClass(code: string, kind: "trade" | "settlement") {
  if (kind === "trade") {
    switch (code) {
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-700";
      case "APPROVED":
        return "bg-blue-100 text-blue-700";
      case "MATCHING":
        return "bg-amber-100 text-amber-700";
      case "HOLD":
        return "bg-rose-100 text-rose-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }
  switch (code) {
    case "DONE":
      return "bg-emerald-100 text-emerald-700";
    case "IN_PROGRESS":
      return "bg-indigo-100 text-indigo-700";
    case "EXCEPTION":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

function queueToneClassName(tone: PendingActionCard["tone"]) {
  switch (tone) {
    case "danger":
      return "border-l-red-400 bg-red-500/10 text-red-200";
    case "warning":
      return "border-l-amber-400 bg-amber-500/10 text-amber-200";
    case "healthy":
      return "border-l-emerald-400 bg-emerald-500/10 text-emerald-200";
    default:
      return "border-l-blue-400 bg-blue-500/10 text-blue-200";
  }
}

function buildTradeRejectHref(tradeId: string) {
  const baseUrl = buildLocalizedPath("/admin/trade/reject", "/en/admin/trade/reject");
  const params = new URLSearchParams();
  params.set("tradeId", tradeId);
  if (typeof window !== "undefined") {
    params.set("returnUrl", `${window.location.pathname}${window.location.search}`);
  }
  return `${baseUrl}?${params.toString()}`;
}

function reviewLabel(row: Record<string, unknown>, en: boolean) {
  return stringOf(row, "tradeStatusCode") === "HOLD" || stringOf(row, "settlementStatusCode") === "EXCEPTION"
    ? (en ? "Reject Review" : "반려 검토")
    : (en ? "Review" : "검토");
}

function pendingTone(row: Record<string, unknown>): PendingActionCard["tone"] {
  if (stringOf(row, "tradeStatusCode") === "HOLD" || stringOf(row, "settlementStatusCode") === "EXCEPTION") {
    return "danger";
  }
  if (stringOf(row, "tradeStatusCode") === "MATCHING") {
    return "warning";
  }
  if (stringOf(row, "settlementStatusCode") === "DONE" || stringOf(row, "tradeStatusCode") === "COMPLETED") {
    return "healthy";
  }
  return "info";
}

function buildPendingActions(rows: Array<Record<string, unknown>>, en: boolean) {
  return rows
    .filter((row) => stringOf(row, "tradeStatusCode") !== "COMPLETED" || stringOf(row, "settlementStatusCode") !== "DONE")
    .slice(0, 4)
    .map((row, index) => ({
      key: `${stringOf(row, "tradeId") || "trade"}-${index}`,
      tone: pendingTone(row),
      badge: stringOf(row, "tradeStatusLabel") || stringOf(row, "settlementStatusLabel") || (en ? "Pending" : "대기"),
      title: stringOf(row, "contractName") || stringOf(row, "tradeId") || (en ? "Pending Trade" : "검토 필요 거래"),
      detail: [
        stringOf(row, "quantity"),
        stringOf(row, "amount"),
        stringOf(row, "buyerName")
      ].filter(Boolean).join(" | "),
      timeLabel: stringOf(row, "requestedAt") || (en ? "Awaiting review" : "검토 대기"),
      primaryLabel: reviewLabel(row, en),
      href: buildTradeRejectHref(stringOf(row, "tradeId")),
      filterStatus: stringOf(row, "tradeStatusCode")
    } satisfies PendingActionCard));
}

function buildQueueHeadline(count: number, en: boolean) {
  if (en) {
    return count === 0 ? "No pending actions were detected in the current queue." : `${count.toLocaleString()} trade actions require operator review right now.`;
  }
  return count === 0 ? "현재 즉시 처리할 거래 액션이 없습니다." : `현재 검토가 필요한 ${count.toLocaleString()}건의 거래 액션이 감지되었습니다.`;
}

export function TradeListMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const initial = useMemo<Filters>(() => readInitialFilters(), []);
  const initialPayload = useMemo(() => readBootstrappedTradeListPageData(), []);
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const pageState = useAsyncValue<TradeListPagePayload>(
    () => fetchTradeListPage(filters),
    [filters.pageIndex, filters.searchKeyword, filters.tradeStatus, filters.settlementStatus],
    {
      initialValue: initialPayload,
      skipInitialLoad: Boolean(initialPayload),
      onSuccess(payload) {
        const next = {
          pageIndex: numberOf(payload.pageIndex) || 1,
          searchKeyword: stringOf(payload.searchKeyword),
          tradeStatus: stringOf(payload.tradeStatus),
          settlementStatus: stringOf(payload.settlementStatus)
        };
        setFilters((current) => (sameFilters(current, next) ? current : next));
        setDraft((current) => (sameFilters(current, next) ? current : next));
      }
    }
  );
  const page = pageState.value;
  const rows = (page?.tradeRows || []) as Array<Record<string, unknown>>;
  const tradeStatusOptions = (page?.tradeStatusOptions || []) as Array<Record<string, unknown>>;
  const settlementStatusOptions = (page?.settlementStatusOptions || []) as Array<Record<string, unknown>>;
  const alerts = (page?.settlementAlerts || []) as Array<Record<string, unknown>>;
  const pendingActions = buildPendingActions(rows, en);
  const currentPage = numberOf(page?.pageIndex) || 1;
  const totalPages = numberOf(page?.totalPages) || 1;
  const pageSize = numberOf(page?.pageSize) || 10;
  const totalCount = numberOf(page?.totalCount);
  const queueCount = pendingActions.length || alerts.length;

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
    if (filters.tradeStatus) {
      search.set("tradeStatus", filters.tradeStatus);
    }
    if (filters.settlementStatus) {
      search.set("settlementStatus", filters.settlementStatus);
    }
    const query = search.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [filters]);

  useEffect(() => {
    logGovernanceScope("PAGE", "trade-list", {
      language: en ? "en" : "ko",
      pageIndex: currentPage,
      searchKeyword: filters.searchKeyword,
      tradeStatus: filters.tradeStatus,
      settlementStatus: filters.settlementStatus,
      rowCount: rows.length,
      pendingActionCount: queueCount
    });
  }, [currentPage, en, filters.searchKeyword, filters.settlementStatus, filters.tradeStatus, queueCount, rows.length]);

  return (
    <>
      <div className="min-h-screen bg-[linear-gradient(180deg,#eef4fb_0%,#f8fbff_18%,#ffffff_52%)] text-[var(--kr-gov-text-primary)]">
        <UserGovernmentBar
          governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
          guidelineText={en ? "Carbon trade workspace for members." : "탄소 거래 현황과 정산 흐름을 확인하는 사용자 포털입니다."}
        />
        <UserPortalHeader
          brandTitle={en ? "Trade Workspace" : "거래 워크스페이스"}
          brandSubtitle={en ? "Member Trade Dashboard" : "Member Trade Dashboard"}
          onHomeClick={() => navigate(buildLocalizedPath("/home", "/en/home"))}
          rightContent={(
            <>
              <nav className="hidden xl:flex items-center gap-2 text-sm font-bold text-[var(--kr-gov-text-secondary)]">
                <a className="rounded-full border border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] px-4 py-2 text-white" href={buildLocalizedPath("/trade/list", "/en/trade/list")}>
                  {en ? "Trade List" : "거래 목록"}
                </a>
                <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/trade/buy_request", "/en/trade/buy_request")}>
                  {en ? "Buy Request" : "구매 요청"}
                </a>
                <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/trade/sell", "/en/trade/sell")}>
                  {en ? "Trade Sell" : "판매 등록"}
                </a>
              </nav>
              <UserLanguageToggle en={en} onKo={() => navigate("/trade/list")} onEn={() => navigate("/en/trade/list")} />
              {session.value?.authenticated ? (
                <button className="rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-white" type="button" onClick={() => void session.logout()}>
                  {en ? "Logout" : "로그아웃"}
                </button>
              ) : (
                <a className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>
                  {en ? "Login" : "로그인"}
                </a>
              )}
            </>
          )}
        />
        <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-10">
          <section className="mb-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-8">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <a className="font-semibold text-[var(--kr-gov-blue)] hover:underline" href={buildLocalizedPath("/home", "/en/home")}>{en ? "Home" : "홈"}</a>
                  <span>/</span>
                  <span>{en ? "Trade" : "거래"}</span>
                  <span>/</span>
                  <span className="font-semibold text-slate-900">{en ? "Trade List" : "거래 목록"}</span>
                </div>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--kr-gov-blue)]">{en ? "Member Trade Overview" : "회원 거래 현황"}</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{en ? "Trade List Workspace" : "거래 목록 워크스페이스"}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{en ? "Review active trades, settlement progress, and review-needed items from the home portal without switching to the admin console." : "관리자 콘솔로 넘어가지 않고 홈 포털에서 진행 중 거래, 정산 상태, 검토 필요 항목을 한 번에 확인합니다."}</p>
              </div>
              <div className="flex items-start lg:items-center">
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
                  {en ? "Pending queue" : "대기 큐"} {queueCount.toLocaleString()}
                </span>
              </div>
            </div>
          </section>

          <AdminListPageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="overflow-hidden rounded-[calc(var(--kr-gov-radius)+10px)] border border-slate-800 bg-slate-950 shadow-xl" data-help-id="trade-list-pending-queue">
          <div className="relative overflow-hidden px-6 py-7 lg:px-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.28),transparent_34%),radial-gradient(circle_at_left,rgba(59,130,246,0.16),transparent_30%)]" />
            <div className="relative grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/90 text-white shadow-lg shadow-indigo-500/30">
                  <span className="material-symbols-outlined text-[26px]">speed</span>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-300">{en ? "Pending Action Queue" : "처리 대기 큐"}</p>
                  <h2 className="mt-2 text-2xl font-black text-white">{queueCount.toLocaleString()}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{buildQueueHeadline(queueCount, en)}</p>
                </div>
                <MemberButton
                  className="w-full justify-center"
                  icon="tune"
                  size="lg"
                  variant="info"
                  type="button"
                  onClick={() => {
                    const next = { ...draft, tradeStatus: "MATCHING", pageIndex: 1 };
                    setDraft(next);
                    setFilters(next);
                  }}
                >
                  {en ? "Batch Review Mode" : "일괄 처리 모드"}
                </MemberButton>
              </div>

              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">{en ? "Priority Queue" : "우선 처리 항목"}</p>
                    <p className="mt-1 text-sm text-slate-300">{en ? "Sorted by trade and settlement urgency." : "거래 상태와 정산 이슈 기준으로 우선순위를 정렬했습니다."}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {pendingActions.length === 0 ? (
                    <article className="col-span-full rounded-[var(--kr-gov-radius)] border border-white/10 bg-white/5 px-5 py-8 text-center text-sm text-slate-300">
                      {en ? "No items require immediate review. Check settlement alerts below for follow-up tasks." : "즉시 검토가 필요한 거래가 없습니다. 아래 운영 알림으로 후속 작업을 확인하세요."}
                    </article>
                  ) : pendingActions.map((item) => (
                    <article className={`flex h-full flex-col rounded-[var(--kr-gov-radius)] border border-white/10 border-l-4 px-4 py-4 backdrop-blur ${queueToneClassName(item.tone)}`} key={item.key}>
                      <div className="flex items-start justify-between gap-3">
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/90">{item.badge}</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{item.timeLabel}</span>
                      </div>
                      <h3 className="mt-4 text-sm font-bold text-white">{item.title}</h3>
                      <p className="mt-2 min-h-[54px] text-xs leading-5 text-slate-300">{item.detail || (en ? "Counterparty and amount details were not provided." : "상대 기관 및 금액 정보가 제공되지 않았습니다.")}</p>
                      <MemberButtonGroup className="mt-auto pt-4">
                        <a className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-[var(--kr-gov-radius)] border border-emerald-400/70 bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-400" href={item.href}>
                          {item.primaryLabel}
                        </a>
                        <MemberButton
                          className="flex-1 justify-center border-white/10 bg-slate-800 text-white hover:bg-slate-700"
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            const next = { ...draft, tradeStatus: item.filterStatus || "", pageIndex: 1 };
                            setDraft(next);
                            setFilters(next);
                          }}
                        >
                          {en ? "View Similar" : "동일 상태 보기"}
                        </MemberButton>
                      </MemberButtonGroup>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="trade-list-summary">
          <SummaryMetricCard title={en ? "Visible Trades" : "조회 거래"} value={totalCount.toLocaleString()} />
          <SummaryMetricCard accentClassName="text-amber-600" surfaceClassName="bg-amber-50" title={en ? "Matching" : "매칭중"} value={numberOf(page?.matchingCount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-blue-600" surfaceClassName="bg-blue-50" title={en ? "Settlement Pending" : "정산 대기"} value={numberOf(page?.settlementPendingCount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-emerald-600" surfaceClassName="bg-emerald-50" title={en ? "Completed" : "거래 완료"} value={numberOf(page?.completedCount).toLocaleString()} />
        </section>

        <section className="rounded-[calc(var(--kr-gov-radius)+10px)] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]" data-help-id="trade-list-filter">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--kr-gov-blue)]">{en ? "Trade Search" : "거래 검색"}</p>
                <h2 className="mt-2 text-lg font-bold text-[var(--kr-gov-text-primary)]">{en ? "Operator Query Workspace" : "운영자 조회 작업공간"}</h2>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Narrow the trade queue by status, settlement condition, and counterpart keyword." : "거래 상태, 정산 상태, 기관 키워드 기준으로 거래 큐를 빠르게 좁힙니다."}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">
                <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                {en ? "Real-time trade monitoring" : "실시간 거래 모니터링"}
              </div>
            </div>
          </div>

          <form
            className="grid grid-cols-1 gap-4 px-6 py-6 lg:grid-cols-[minmax(0,1.6fr)_220px_220px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters({ ...draft, pageIndex: 1 });
            }}
          >
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="tradeSearchKeyword">
                {en ? "Keyword" : "검색어"}
              </label>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                <AdminInput
                  className="pl-12"
                  id="tradeSearchKeyword"
                  placeholder={en ? "Trade ID, contract, seller, buyer" : "거래번호, 계약명, 매도기관, 매수기관"}
                  value={draft.searchKeyword}
                  onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="tradeStatus">
                {en ? "Trade Status" : "거래 상태"}
              </label>
              <AdminSelect id="tradeStatus" value={draft.tradeStatus} onChange={(event) => setDraft((current) => ({ ...current, tradeStatus: event.target.value }))}>
                {tradeStatusOptions.map((option, index) => (
                  <option key={`${stringOf(option, "code")}-${index}`} value={stringOf(option, "code")}>
                    {stringOf(option, "label")}
                  </option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="settlementStatus">
                {en ? "Settlement" : "정산 상태"}
              </label>
              <AdminSelect id="settlementStatus" value={draft.settlementStatus} onChange={(event) => setDraft((current) => ({ ...current, settlementStatus: event.target.value }))}>
                {settlementStatusOptions.map((option, index) => (
                  <option key={`${stringOf(option, "code")}-${index}`} value={stringOf(option, "code")}>
                    {stringOf(option, "label")}
                  </option>
                ))}
              </AdminSelect>
            </div>
            <div className="flex items-end gap-2">
              <MemberButton className="flex-1 justify-center" size="lg" type="submit" variant="primary">
                {en ? "Search" : "조회"}
              </MemberButton>
              <MemberButton
                className="flex-1 justify-center"
                size="lg"
                type="button"
                variant="secondary"
                onClick={() => {
                  setDraft(DEFAULT_FILTERS);
                  setFilters(DEFAULT_FILTERS);
                }}
              >
                {en ? "Reset" : "초기화"}
              </MemberButton>
            </div>
          </form>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <section className="gov-card overflow-hidden p-0" data-help-id="trade-list-table">
            <GridToolbar
              actions={(
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {en ? "Page" : "페이지"} {currentPage} / {Math.max(totalPages, 1)}
                </span>
              )}
              meta={en ? "Track trade, matching, and settlement state in a single queue table." : "거래, 매칭, 정산 상태를 하나의 운영 테이블에서 함께 추적합니다."}
              title={en ? "Trade Queue" : "거래 운영 목록"}
            />
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full text-sm text-left">
                <thead>
                  <tr className="gov-table-header">
                    <th className="w-16 px-6 py-4 text-center">{en ? "No." : "번호"}</th>
                    <th className="px-6 py-4">{en ? "Trade / Contract" : "거래 / 계약"}</th>
                    <th className="px-6 py-4">{en ? "Product" : "상품"}</th>
                    <th className="px-6 py-4">{en ? "Seller" : "매도 기관"}</th>
                    <th className="px-6 py-4">{en ? "Buyer" : "매수 기관"}</th>
                    <th className="px-6 py-4">{en ? "Quantity" : "거래 수량"}</th>
                    <th className="px-6 py-4">{en ? "Amount" : "거래 금액"}</th>
                    <th className="px-6 py-4">{en ? "Requested At" : "요청 일시"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Trade Status" : "거래 상태"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Settlement" : "정산 상태"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Action" : "작업"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-gray-500" colSpan={11}>
                        {en ? "No trades found." : "조회된 거래가 없습니다."}
                      </td>
                    </tr>
                  ) : rows.map((row, index) => (
                    <tr className="transition-colors hover:bg-gray-50/60" key={`${stringOf(row, "tradeId")}-${index}`}>
                      <td className="px-6 py-4 text-center text-gray-500">{totalCount - ((currentPage - 1) * pageSize + index)}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "contractName")}</div>
                        <div className="mt-1 text-xs text-gray-400">{stringOf(row, "tradeId")}</div>
                      </td>
                      <td className="px-6 py-4">{stringOf(row, "productType")}</td>
                      <td className="px-6 py-4">{stringOf(row, "sellerName")}</td>
                      <td className="px-6 py-4">{stringOf(row, "buyerName")}</td>
                      <td className="px-6 py-4 font-semibold text-[var(--kr-gov-blue)]">{stringOf(row, "quantity")}</td>
                      <td className="px-6 py-4 font-semibold">{stringOf(row, "amount")}</td>
                      <td className="px-6 py-4 text-gray-500">{stringOf(row, "requestedAt")}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${badgeClass(stringOf(row, "tradeStatusCode"), "trade")}`}>
                          {stringOf(row, "tradeStatusLabel")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${badgeClass(stringOf(row, "settlementStatusCode"), "settlement")}`}>
                          {stringOf(row, "settlementStatusLabel")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <a
                          className="inline-flex items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 py-2 text-xs font-bold text-[var(--kr-gov-blue)] transition-colors hover:bg-blue-50"
                          href={buildTradeRejectHref(stringOf(row, "tradeId"))}
                        >
                          {reviewLabel(row, en)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <MemberPagination currentPage={currentPage} totalPages={totalPages} onPageChange={(pageIndex) => setFilters((current) => ({ ...current, pageIndex }))} />
          </section>

          <div className="space-y-6">
            <section className="gov-card" data-help-id="trade-list-alerts">
              <GridToolbar
                meta={en ? "Settlement and exception notes generated by the current query." : "현재 조회 결과를 기준으로 생성된 정산 및 예외 알림입니다."}
                title={en ? "Operational Alerts" : "운영 알림"}
              />
              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    {en ? "No alert messages are available for the current filter set." : "현재 필터 조건에 대한 운영 알림이 없습니다."}
                  </div>
                ) : alerts.map((item, index) => (
                  <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4" key={`${stringOf(item, "title")}-${index}`}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{stringOf(item, "tone") || (en ? "Alert" : "알림")}</p>
                    <h3 className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "detail")}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="gov-card" data-help-id="trade-list-status-guide">
              <GridToolbar
                meta={en ? "Quick interpretation of queue status colors used across this page." : "이 페이지 전반에서 사용하는 상태 색상 해석입니다."}
                title={en ? "Queue Guide" : "상태 가이드"}
              />
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-[var(--kr-gov-radius)] bg-rose-50 px-4 py-3">
                  <span className="font-bold text-rose-700">{en ? "Hold / Exception" : "보류 / 예외"}</span>
                  <span className="text-rose-700">{en ? "Immediate operator action" : "즉시 검토 필요"}</span>
                </div>
                <div className="flex items-center justify-between rounded-[var(--kr-gov-radius)] bg-amber-50 px-4 py-3">
                  <span className="font-bold text-amber-700">{en ? "Matching" : "매칭중"}</span>
                  <span className="text-amber-700">{en ? "Counterparty coordination" : "상대 기관 조율 단계"}</span>
                </div>
                <div className="flex items-center justify-between rounded-[var(--kr-gov-radius)] bg-blue-50 px-4 py-3">
                  <span className="font-bold text-blue-700">{en ? "Settlement Progress" : "정산 진행"}</span>
                  <span className="text-blue-700">{en ? "Back-office processing" : "정산 처리 진행중"}</span>
                </div>
                <div className="flex items-center justify-between rounded-[var(--kr-gov-radius)] bg-emerald-50 px-4 py-3">
                  <span className="font-bold text-emerald-700">{en ? "Completed" : "완료"}</span>
                  <span className="text-emerald-700">{en ? "Trade closed successfully" : "거래 종료 완료"}</span>
                </div>
              </div>
            </section>
          </div>
        </section>
          </AdminListPageFrame>
        </main>
        <UserPortalFooter
          orgName={en ? "Ministry of Environment Carbonet" : "환경부 Carbonet"}
          addressLine={en ? "Government Complex Sejong, 94 Dasom 2-ro, Sejong-si" : "세종특별자치시 다솜2로 94 정부세종청사"}
          serviceLine={en ? "Member trade portal support center" : "회원 거래 포털 지원센터"}
          footerLinks={en ? ["Privacy Policy", "Sitemap", "User Guide"] : ["개인정보처리방침", "사이트맵", "이용안내"]}
          copyright={en ? "Copyright 2026. Ministry of Environment. All rights reserved." : "Copyright 2026. 환경부. All rights reserved."}
          lastModifiedLabel={en ? "Last updated" : "최종 업데이트"}
          waAlt={en ? "Web accessibility quality mark" : "웹 접근성 품질인증 마크"}
        />
      </div>
    </>
  );
}
