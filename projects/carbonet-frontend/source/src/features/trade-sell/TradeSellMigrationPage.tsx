import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminInput, AdminSelect, MemberButton, PageStatusNotice } from "../member/common";

type AlertCard = {
  key: string;
  icon: string;
  label: string;
  detail: string;
  accentClassName: string;
};

type OrderRow = {
  id: string;
  time: string;
  customer: string;
  item: string;
  quantity: number;
  statusLabel: string;
  statusClassName: string;
  deadlineLabel: string;
  deadlineMeta: string;
  stageLabel: string;
  stageClassName: string;
};

type ActivityItem = {
  key: string;
  title: string;
  detail: string;
  timeAgo: string;
  bulletClassName: string;
};

type LocalizedContent = {
  pageTitle: string;
  pageSubtitle: string;
  navDashboard: string;
  navOrders: string;
  navInventory: string;
  navSell: string;
  systemLabel: string;
  operatorName: string;
  summaryLabel: string;
  alertTitle: string;
  tableTitle: string;
  queueLabel: string;
  searchPlaceholder: string;
  filterLabel: string;
  quickEntryTitle: string;
  customerLabel: string;
  itemCodeLabel: string;
  quantityLabel: string;
  shipDateLabel: string;
  submitLabel: string;
  helperLabel: string;
  activityTitle: string;
  activityResetLabel: string;
  pageStatusMessage: string;
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerCopyright: string;
  footerLastModified: string;
  footerWaAlt: string;
  customerOptions: Array<{ value: string; label: string }>;
  alerts: AlertCard[];
  orders: OrderRow[];
  activityItems: ActivityItem[];
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    pageTitle: "판매 등록",
    pageSubtitle: "TRADE SELL OPERATIONS",
    navDashboard: "대시보드",
    navOrders: "주문 관리",
    navInventory: "재고 현황",
    navSell: "판매 등록",
    systemLabel: "SYSTEM LIVE",
    operatorName: "김거래 매니저",
    summaryLabel: "금일 주문 1,240건 중 100% 처리 목표",
    alertTitle: "우선 경보",
    tableTitle: "주문/체결 현황",
    queueLabel: "142건 대기",
    searchPlaceholder: "주문번호, 고객사명 검색...",
    filterLabel: "필터",
    quickEntryTitle: "판매 등록 (Quick Entry)",
    customerLabel: "고객사 선택",
    itemCodeLabel: "품목 코드",
    quantityLabel: "수량",
    shipDateLabel: "희망 납기일",
    submitLabel: "등록 및 전송",
    helperLabel: "수량 주문 입력 시 즉시 담당 대기 큐에 반영됩니다.",
    activityTitle: "처리 이력 (Activity Log)",
    activityResetLabel: "새로고침",
    pageStatusMessage: "선택 주문과 우측 빠른 등록 패널이 연동됩니다. 실제 저장 API는 아직 연결되지 않았습니다.",
    footerOrg: "탄소넷 거래 포털",
    footerAddress: "30121 세종특별자치시 도움6로 42 정부세종청사",
    footerServiceLine: "거래 운영 지원센터 044-000-1800",
    footerCopyright: "Copyright 2026. Carbonet Trade Operations. All rights reserved.",
    footerLastModified: "최종 갱신",
    footerWaAlt: "웹 접근성 품질마크",
    customerOptions: [
      { value: "hansol", label: "(주) 한솔케미칼" },
      { value: "mirae", label: "미래솔루션" },
      { value: "stx", label: "STX 에너지" },
      { value: "greenlab", label: "그린랩 파트너스" }
    ],
    alerts: [
      { key: "shipping", icon: "local_shipping", label: "출하 지연", detail: "긴급: 주문 ORD-250814-001 외 3건 마감 임박", accentClassName: "border-red-500 bg-red-500/10 text-red-200" },
      { key: "inventory", icon: "inventory_2", label: "재고 부족", detail: "[A-3구역] 탭 모니터 재고 2일치 도달", accentClassName: "border-amber-500 bg-amber-500/10 text-amber-200" },
      { key: "inbound", icon: "move_to_inbox", label: "입고 예정", detail: "오후 14:00 대형 컨테이너 2대 입고 예정", accentClassName: "border-blue-500 bg-blue-500/10 text-blue-200" },
      { key: "summary", icon: "monitoring", label: "처리 요약", detail: "전일 주문 1,240건 중 1,240건 처리 (100%)", accentClassName: "border-slate-500 bg-slate-500/10 text-slate-200" }
    ],
    orders: [
      { id: "ORD-20250814-001", time: "08:12:45", customer: "(주) 테크글로벌", item: "데스크탑 워크스테이션 Z2 G9", quantity: 12, statusLabel: "긴급", statusClassName: "bg-red-50 text-red-600", deadlineLabel: "오늘 15:00", deadlineMeta: "TAC 4시간 남음", stageLabel: "검토", stageClassName: "bg-blue-600 text-white" },
      { id: "ORD-20250814-002", time: "09:05:12", customer: "미래솔루션", item: "무선 키보드/마우스 콤보", quantity: 50, statusLabel: "배송대기", statusClassName: "bg-blue-50 text-blue-600", deadlineLabel: "오늘 17:00", deadlineMeta: "D-Day", stageLabel: "포장", stageClassName: "bg-slate-100 text-slate-600" },
      { id: "ORD-20250814-003", time: "09:20:33", customer: "스타트업 캠퍼스", item: "커브드 모니터 34인치", quantity: 8, statusLabel: "재고검토", statusClassName: "bg-amber-50 text-amber-700", deadlineLabel: "내일 10:00", deadlineMeta: "D-1", stageLabel: "확인", stageClassName: "bg-slate-100 text-slate-600" },
      { id: "ORD-20250814-004", time: "10:45:00", customer: "한양 시스템", item: "서버용 랙 Mount Kit", quantity: 100, statusLabel: "보통", statusClassName: "bg-slate-100 text-slate-600", deadlineLabel: "08/16 12:00", deadlineMeta: "D-2", stageLabel: "실사", stageClassName: "bg-slate-100 text-slate-600" },
      { id: "ORD-20250814-005", time: "11:15:22", customer: "에듀케이션 플러스", item: "태블릿 PC 보호필름 500매", quantity: 500, statusLabel: "출하완료", statusClassName: "bg-emerald-50 text-emerald-600", deadlineLabel: "08/16 18:00", deadlineMeta: "확정", stageLabel: "출고", stageClassName: "bg-emerald-500 text-white" },
      { id: "ORD-20250814-006", time: "11:30:10", customer: "글로벌 무역", item: "복사용지 A4 100박스", quantity: 100, statusLabel: "검수중", statusClassName: "bg-indigo-50 text-indigo-600", deadlineLabel: "08/17 09:00", deadlineMeta: "D-3", stageLabel: "조정", stageClassName: "bg-slate-100 text-slate-600" }
    ],
    activityItems: [
      { key: "done", title: "RD-8812 출고 완료", detail: "배송사 CJ대한통운 | 송장: 6023-****-0012", timeAgo: "방금 전", bulletClassName: "bg-emerald-500" },
      { key: "inbound", title: "A 구역 오후 4시 입고", detail: "ERP 시스템으로 로트번호 신규 수신", timeAgo: "12분 전", bulletClassName: "bg-blue-500" },
      { key: "delay", title: "고객사 보고", detail: "C구역 일부 품목 배송 지연 안내 발송", timeAgo: "45분 전", bulletClassName: "bg-amber-500" },
      { key: "reserve", title: "수급 검토 요청", detail: "주문 F-0070 재고 재배치 지시", timeAgo: "1시간 전", bulletClassName: "bg-rose-500" },
      { key: "issue", title: "입지 시스템 점검", detail: "입지 배치 모듈 재기동 (PC-WS-05)", timeAgo: "2시간 전", bulletClassName: "bg-slate-500" }
    ]
  },
  en: {
    pageTitle: "Trade Sell",
    pageSubtitle: "TRADE SELL OPERATIONS",
    navDashboard: "Dashboard",
    navOrders: "Order Desk",
    navInventory: "Inventory",
    navSell: "Sell Entry",
    systemLabel: "SYSTEM LIVE",
    operatorName: "Kim Trade Manager",
    summaryLabel: "Targeting full completion across 1,240 orders today",
    alertTitle: "Priority Alerts",
    tableTitle: "Order & Settlement Queue",
    queueLabel: "142 pending",
    searchPlaceholder: "Search by order number or customer...",
    filterLabel: "Filter",
    quickEntryTitle: "Sell Entry (Quick Entry)",
    customerLabel: "Customer",
    itemCodeLabel: "Item code",
    quantityLabel: "Quantity",
    shipDateLabel: "Requested ship date",
    submitLabel: "Register and send",
    helperLabel: "Submitted entries are reflected in the operator queue immediately.",
    activityTitle: "Activity Log",
    activityResetLabel: "Refresh",
    pageStatusMessage: "The selected order and the quick entry panel are linked. A real save API is not wired yet.",
    footerOrg: "Carbonet Trade Portal",
    footerAddress: "42 Doum 6-ro, Sejong-si, Republic of Korea",
    footerServiceLine: "Trade Operations Support Center +82-44-000-1800",
    footerCopyright: "Copyright 2026. Carbonet Trade Operations. All rights reserved.",
    footerLastModified: "Last updated",
    footerWaAlt: "Web accessibility quality mark",
    customerOptions: [
      { value: "hansol", label: "Hansol Chemical Co." },
      { value: "mirae", label: "Mirae Solution" },
      { value: "stx", label: "STX Energy" },
      { value: "greenlab", label: "Greenlab Partners" }
    ],
    alerts: [
      { key: "shipping", icon: "local_shipping", label: "Shipping overdue", detail: "Urgent: ORD-250814-001 and 3 more orders are close to cutoff", accentClassName: "border-red-500 bg-red-500/10 text-red-200" },
      { key: "inventory", icon: "inventory_2", label: "Inventory shortage", detail: "[Zone A-3] Curved monitor stock has reached a 2-day threshold", accentClassName: "border-amber-500 bg-amber-500/10 text-amber-200" },
      { key: "inbound", icon: "move_to_inbox", label: "Inbound expected", detail: "Two large containers are scheduled to arrive at 14:00", accentClassName: "border-blue-500 bg-blue-500/10 text-blue-200" },
      { key: "summary", icon: "monitoring", label: "Process summary", detail: "Yesterday 1,240 of 1,240 orders were completed (100%)", accentClassName: "border-slate-500 bg-slate-500/10 text-slate-200" }
    ],
    orders: [
      { id: "ORD-20250814-001", time: "08:12:45", customer: "Tech Global", item: "Desktop Workstation Z2 G9", quantity: 12, statusLabel: "Urgent", statusClassName: "bg-red-50 text-red-600", deadlineLabel: "Today 15:00", deadlineMeta: "4 hours left", stageLabel: "Review", stageClassName: "bg-blue-600 text-white" },
      { id: "ORD-20250814-002", time: "09:05:12", customer: "Mirae Solution", item: "Wireless keyboard/mouse combo", quantity: 50, statusLabel: "Dispatch wait", statusClassName: "bg-blue-50 text-blue-600", deadlineLabel: "Today 17:00", deadlineMeta: "D-Day", stageLabel: "Pack", stageClassName: "bg-slate-100 text-slate-600" },
      { id: "ORD-20250814-003", time: "09:20:33", customer: "Startup Campus", item: "34-inch curved monitor", quantity: 8, statusLabel: "Stock review", statusClassName: "bg-amber-50 text-amber-700", deadlineLabel: "Tomorrow 10:00", deadlineMeta: "D-1", stageLabel: "Check", stageClassName: "bg-slate-100 text-slate-600" },
      { id: "ORD-20250814-004", time: "10:45:00", customer: "Hanyang Systems", item: "Server rack mount kit", quantity: 100, statusLabel: "Normal", statusClassName: "bg-slate-100 text-slate-600", deadlineLabel: "08/16 12:00", deadlineMeta: "D-2", stageLabel: "Inspect", stageClassName: "bg-slate-100 text-slate-600" },
      { id: "ORD-20250814-005", time: "11:15:22", customer: "Education Plus", item: "Tablet screen film x500", quantity: 500, statusLabel: "Dispatched", statusClassName: "bg-emerald-50 text-emerald-600", deadlineLabel: "08/16 18:00", deadlineMeta: "Confirmed", stageLabel: "Ship", stageClassName: "bg-emerald-500 text-white" },
      { id: "ORD-20250814-006", time: "11:30:10", customer: "Global Trade", item: "A4 paper x100 boxes", quantity: 100, statusLabel: "Inspection", statusClassName: "bg-indigo-50 text-indigo-600", deadlineLabel: "08/17 09:00", deadlineMeta: "D-3", stageLabel: "Adjust", stageClassName: "bg-slate-100 text-slate-600" }
    ],
    activityItems: [
      { key: "done", title: "RD-8812 shipment completed", detail: "Carrier CJ Logistics | Tracking 6023-****-0012", timeAgo: "Just now", bulletClassName: "bg-emerald-500" },
      { key: "inbound", title: "Zone A inbound at 4 PM", detail: "ERP received a new lot number feed", timeAgo: "12 min ago", bulletClassName: "bg-blue-500" },
      { key: "delay", title: "Customer notification sent", detail: "Delay notice delivered for part of zone C inventory", timeAgo: "45 min ago", bulletClassName: "bg-amber-500" },
      { key: "reserve", title: "Supply review requested", detail: "Reallocation order issued for F-0070", timeAgo: "1 hour ago", bulletClassName: "bg-rose-500" },
      { key: "issue", title: "Location system check", detail: "Location batch module restarted (PC-WS-05)", timeAgo: "2 hours ago", bulletClassName: "bg-slate-500" }
    ]
  }
};

function InlineStyles() {
  return (
    <style>{`
      :root {
        --kr-gov-blue: #00378b;
        --kr-gov-blue-hover: #002d72;
        --kr-gov-text-primary: #1a1a1a;
        --kr-gov-text-secondary: #4d4d4d;
        --kr-gov-border-light: #d9d9d9;
        --kr-gov-bg-gray: #f4f6f8;
        --kr-gov-radius: 8px;
      }
      body { font-family: 'Noto Sans KR', 'Public Sans', sans-serif; -webkit-font-smoothing: antialiased; }
      .trade-shell {
        background:
          radial-gradient(circle at top right, rgba(59,130,246,0.16), transparent 30%),
          linear-gradient(180deg, #081225 0%, #0d1729 280px, #eef2f7 280px, #f8fafc 100%);
      }
      .trade-hero-grid::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image: linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
        background-size: 36px 36px;
        opacity: 0.34;
        pointer-events: none;
      }
      .trade-scrollbar::-webkit-scrollbar { width: 10px; }
      .trade-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
    `}</style>
  );
}

export function TradeSellMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(content.orders[0]?.id ?? "");
  const [customer, setCustomer] = useState(content.customerOptions[0]?.value ?? "");
  const [itemCode, setItemCode] = useState("SKU-000");
  const [quantity, setQuantity] = useState("1");
  const [shipDate, setShipDate] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");

  const visibleOrders = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return content.orders;
    }
    return content.orders.filter((row) => `${row.id} ${row.customer} ${row.item}`.toLowerCase().includes(keyword));
  }, [content.orders, searchKeyword]);

  const selectedOrder = visibleOrders.find((row) => row.id === selectedOrderId) || visibleOrders[0] || null;

  useEffect(() => {
    if (!selectedOrder && visibleOrders[0]) {
      setSelectedOrderId(visibleOrders[0].id);
    }
  }, [selectedOrder, visibleOrders]);

  useEffect(() => {
    if (!selectedOrder) {
      return;
    }
    setCustomer((current) => current || content.customerOptions[0]?.value || "");
    setItemCode(selectedOrder.id.replace("ORD", "SKU"));
    setQuantity(String(selectedOrder.quantity));
  }, [content.customerOptions, selectedOrder]);

  useEffect(() => {
    logGovernanceScope("PAGE", "trade-sell", {
      language: en ? "en" : "ko",
      selectedOrderId,
      searchKeyword,
      visibleOrderCount: visibleOrders.length,
      customer,
      itemCode,
      quantity,
      shipDate
    });
  }, [customer, en, itemCode, quantity, searchKeyword, selectedOrderId, shipDate, visibleOrders.length]);

  function handleSubmit() {
    const customerLabel = content.customerOptions.find((option) => option.value === customer)?.label || customer;
    setSubmittedMessage(en
      ? `Prepared quick sell entry for ${customerLabel} with ${itemCode} x ${quantity}.`
      : `${customerLabel} 대상으로 ${itemCode} ${quantity}건 판매 등록 초안을 준비했습니다.`);
  }

  return (
    <>
      <InlineStyles />
      <div className="trade-shell min-h-screen text-[var(--kr-gov-text-primary)]">
        <UserGovernmentBar
          governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
          guidelineText={en ? "Carbonet trade sell workflow" : "대한민국 정부 공식 서비스 | 탄소넷 거래 판매 등록"}
        />

        <header className="border-b border-white/10 bg-[#0b1528]/90 backdrop-blur">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="flex min-h-20 flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-8">
                <button className="flex items-center gap-3 bg-transparent p-0 text-left text-white" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))} type="button">
                  <span className="material-symbols-outlined text-[34px] text-blue-300">storefront</span>
                  <div>
                    <h1 className="text-lg font-black tracking-tight">{content.pageTitle}</h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">{content.pageSubtitle}</p>
                  </div>
                </button>
                <nav className="hidden items-center gap-1 xl:flex" data-help-id="trade-sell-hero">
                  {[content.navDashboard, content.navOrders, content.navInventory, content.navSell].map((item, index) => (
                    <a
                      className={index === 3
                        ? "rounded-lg bg-white/10 px-4 py-3 text-sm font-bold text-white"
                        : "rounded-lg px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"}
                      href={index === 3 ? buildLocalizedPath("/trade/sell", "/en/trade/sell") : "#"}
                      key={item}
                      onClick={(event) => {
                        if (index !== 3) {
                          event.preventDefault();
                        }
                      }}
                    >
                      {item}
                    </a>
                  ))}
                </nav>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {content.systemLabel}
                </span>
                <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 md:block">
                  {content.summaryLabel}
                </div>
                <div className="hidden text-right text-white lg:block">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{content.alertTitle}</p>
                  <p className="text-sm font-black">{content.operatorName}</p>
                </div>
                <UserLanguageToggle en={en} onKo={() => navigate("/trade/sell")} onEn={() => navigate("/en/trade/sell")} />
                {session.value?.authenticated ? (
                  <MemberButton onClick={() => void session.logout()} size="md" variant="primary">{en ? "Logout" : "로그아웃"}</MemberButton>
                ) : (
                  <a className="inline-flex items-center justify-center rounded-[var(--kr-gov-radius)] border border-blue-300 px-4 py-2 text-sm font-bold text-blue-100" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>
                    {en ? "Login" : "로그인"}
                  </a>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="pb-12">
          <section className="trade-hero-grid relative" data-help-id="trade-sell-hero">
            <div className="relative z-10 mx-auto max-w-[1440px] px-4 pb-10 pt-8 lg:px-8">
              <div className="mb-6 flex flex-col gap-3 text-white lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">{content.pageSubtitle}</p>
                  <h2 className="mt-2 text-3xl font-black">{content.pageTitle}</h2>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-200">
                  {content.summaryLabel}
                </div>
              </div>

              <section className="grid gap-4 xl:grid-cols-4" data-help-id="trade-sell-alerts">
                {content.alerts.map((alert) => (
                  <article className={`rounded-2xl border-l-4 px-5 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.12)] ${alert.accentClassName}`} key={alert.key}>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-lg">{alert.icon}</span>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em]">{alert.label}</p>
                        <p className="mt-1 text-sm font-semibold leading-6">{alert.detail}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            </div>
          </section>

          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            {submittedMessage ? <PageStatusNotice tone="success">{submittedMessage}</PageStatusNotice> : null}
            <PageStatusNotice tone="warning">{content.pageStatusMessage}</PageStatusNotice>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_360px]">
              <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]" data-help-id="trade-sell-table">
                <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{content.tableTitle}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{content.queueLabel}</p>
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <AdminInput
                      className="min-w-[280px]"
                      placeholder={content.searchPlaceholder}
                      value={searchKeyword}
                      onChange={(event) => setSearchKeyword(event.target.value)}
                    />
                    <button className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[var(--kr-gov-blue)]" type="button">
                      <span className="material-symbols-outlined">{content.filterLabel === "Filter" ? "filter_alt" : "filter_alt"}</span>
                    </button>
                  </div>
                </div>

                <div className="trade-scrollbar overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-slate-50 text-left">
                      <tr className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        <th className="px-4 py-4">#</th>
                        <th className="px-4 py-4">{en ? "Order" : "주문번호"}</th>
                        <th className="px-4 py-4">{en ? "Time" : "주문시각"}</th>
                        <th className="px-4 py-4">{en ? "Customer" : "고객사"}</th>
                        <th className="px-4 py-4">{en ? "Item" : "품목 리스트"}</th>
                        <th className="px-4 py-4 text-right">{en ? "Qty" : "수량"}</th>
                        <th className="px-4 py-4">{en ? "Status" : "상태"}</th>
                        <th className="px-4 py-4">{en ? "Deadline" : "데드라인"}</th>
                        <th className="px-4 py-4 text-center">{en ? "Stage" : "관리단계"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.map((row, index) => {
                        const active = row.id === selectedOrder?.id;
                        return (
                          <tr
                            className={active ? "cursor-pointer border-t border-blue-100 bg-blue-50/50" : "cursor-pointer border-t border-slate-100 bg-white hover:bg-slate-50"}
                            key={row.id}
                            onClick={() => setSelectedOrderId(row.id)}
                          >
                            <td className="px-4 py-4 align-top">
                              <input checked={active} onChange={() => setSelectedOrderId(row.id)} type="checkbox" />
                            </td>
                            <td className="px-4 py-4 align-top text-sm font-black text-[var(--kr-gov-blue)]">{row.id}<br /><span className="text-xs font-semibold text-slate-400">{String(index + 1).padStart(3, "0")}</span></td>
                            <td className="px-4 py-4 align-top text-sm font-semibold text-slate-500">{row.time}</td>
                            <td className="px-4 py-4 align-top text-sm font-bold text-slate-700">{row.customer}</td>
                            <td className="px-4 py-4 align-top text-sm font-semibold text-slate-700">{row.item}</td>
                            <td className="px-4 py-4 align-top text-right text-sm font-black text-slate-700">{row.quantity}</td>
                            <td className="px-4 py-4 align-top"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${row.statusClassName}`}>{row.statusLabel}</span></td>
                            <td className="px-4 py-4 align-top text-sm font-bold text-slate-700">{row.deadlineLabel}<br /><span className="text-xs font-semibold text-slate-400">{row.deadlineMeta}</span></td>
                            <td className="px-4 py-4 align-top text-center"><span className={`inline-flex min-w-12 justify-center rounded-lg px-3 py-2 text-xs font-black ${row.stageClassName}`}>{row.stageLabel}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 text-xs font-bold text-slate-400">
                  <p>{en ? `Showing 1-${visibleOrders.length} of ${content.orders.length} items` : `1-${visibleOrders.length} / 총 ${content.orders.length}건 표시`}</p>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map((page) => (
                      <button
                        className={page === 1
                          ? "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white"
                          : "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500"}
                        key={page}
                        type="button"
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                </div>
              </article>

              <div className="space-y-6">
                <aside className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]" data-help-id="trade-sell-quick-entry">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h3 className="text-lg font-black text-slate-900">{content.quickEntryTitle}</h3>
                    {selectedOrder ? <p className="mt-1 text-sm font-semibold text-slate-500">{selectedOrder.id} · {selectedOrder.customer}</p> : null}
                  </div>
                  <div className="space-y-5 px-6 py-6">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-500">{content.customerLabel}</span>
                      <AdminSelect value={customer} onChange={(event) => setCustomer(event.target.value)}>
                        {content.customerOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </AdminSelect>
                    </label>
                    <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-500">{content.itemCodeLabel}</span>
                        <AdminInput value={itemCode} onChange={(event) => setItemCode(event.target.value)} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-500">{content.quantityLabel}</span>
                        <AdminInput inputMode="numeric" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-500">{content.shipDateLabel}</span>
                      <AdminInput type="date" value={shipDate} onChange={(event) => setShipDate(event.target.value)} />
                    </label>
                    <MemberButton className="w-full justify-center" onClick={handleSubmit} variant="primary">
                      {content.submitLabel}
                    </MemberButton>
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold leading-6 text-slate-500">{content.helperLabel}</p>
                  </div>
                </aside>

                <aside className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]" data-help-id="trade-sell-activity-log">
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                    <h3 className="text-lg font-black text-slate-900">{content.activityTitle}</h3>
                    <button className="text-xs font-black text-blue-700" type="button">{content.activityResetLabel}</button>
                  </div>
                  <div className="space-y-5 px-6 py-6">
                    {content.activityItems.map((item) => (
                      <article className="flex items-start gap-3" key={item.key}>
                        <span className={`mt-2 h-2.5 w-2.5 rounded-full ${item.bulletClassName}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="text-sm font-black text-slate-800">{item.title}</h4>
                            <span className="shrink-0 text-xs font-bold text-slate-400">{item.timeAgo}</span>
                          </div>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.detail}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </aside>
              </div>
            </section>
          </div>
        </main>

        <UserPortalFooter
          addressLine={content.footerAddress}
          copyright={content.footerCopyright}
          footerLinks={en ? ["Sitemap", "Privacy Policy", "Terms of Use"] : ["사이트맵", "개인정보처리방침", "이용약관"]}
          lastModifiedLabel={content.footerLastModified}
          orgName={content.footerOrg}
          serviceLine={content.footerServiceLine}
          waAlt={content.footerWaAlt}
        />
      </div>
    </>
  );
}
