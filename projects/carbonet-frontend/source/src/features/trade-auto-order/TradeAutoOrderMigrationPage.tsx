import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminInput, AdminSelect, MemberButton, PageStatusNotice } from "../member/common";

type OpportunityCard = {
  key: string;
  label: string;
  confidence: string;
  title: string;
  detail: string;
  valueLabel: string;
  value: string;
  accentClassName: string;
  valueClassName: string;
};

type TickerItem = {
  code: string;
  price: string;
  delta: string;
  deltaClassName: string;
  chartClassName: string;
  chartPath?: string;
};

type AllocationItem = {
  key: string;
  label: string;
  value: string;
  share: string;
  meterClassName: string;
  width: string;
};

type MatchRow = {
  id: string;
  market: string;
  asset: string;
  quantity: string;
  spread: string;
  expectedProfit: string;
  urgency: string;
  urgencyClassName: string;
  stage: string;
};

type ActivityItem = {
  key: string;
  title: string;
  detail: string;
  timeAgo: string;
  bulletClassName: string;
};

type EngineMetric = {
  label: string;
  value: string;
  hint: string;
};

type LocalizedContent = {
  pageTitle: string;
  pageSubtitle: string;
  navDashboard: string;
  navMarket: string;
  navAutoOrder: string;
  navHistory: string;
  portfolioLabel: string;
  portfolioValue: string;
  portfolioDelta: string;
  assistantLabel: string;
  analystRole: string;
  analystName: string;
  heroTitle: string;
  heroStatus: string;
  heroBody: string;
  heroHighlight: string;
  heroAction: string;
  opportunitiesLabel: string;
  marketPanelTitle: string;
  marketPanelCaption: string;
  marketAction: string;
  allocationTitle: string;
  workspaceTitle: string;
  workspaceCaption: string;
  searchPlaceholder: string;
  settingsTitle: string;
  selectedAssetLabel: string;
  modeLabel: string;
  thresholdLabel: string;
  capLabel: string;
  approvalLabel: string;
  submitLabel: string;
  helperLabel: string;
  activityTitle: string;
  activityAction: string;
  pageStatusMessage: string;
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerCopyright: string;
  footerLastModified: string;
  footerWaAlt: string;
  engineMetrics: EngineMetric[];
  opportunities: OpportunityCard[];
  tickers: TickerItem[];
  allocations: AllocationItem[];
  rows: MatchRow[];
  activityItems: ActivityItem[];
  modeOptions: Array<{ value: string; label: string }>;
  approvalOptions: Array<{ value: string; label: string }>;
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    pageTitle: "자동 매칭",
    pageSubtitle: "AUTO MATCHING ENGINE",
    navDashboard: "시장 대시보드",
    navMarket: "거래 시장",
    navAutoOrder: "자동 매칭 설정",
    navHistory: "거래 이력",
    portfolioLabel: "Portfolio Value",
    portfolioValue: "₩14,285,400,000",
    portfolioDelta: "▲ 2.4%",
    assistantLabel: "5",
    analystRole: "Senior Analyst",
    analystName: "김철수 분석가",
    heroTitle: "자동 매칭 엔진",
    heroStatus: "Matching Active",
    heroBody: "실시간 시장 가격과 포트폴리오 전략을 분석하여",
    heroHighlight: "5개의 최적 거래 기회",
    heroAction: "전체 자동 매칭 설정",
    opportunitiesLabel: "AI Recommended Opportunities",
    marketPanelTitle: "실시간 시세",
    marketPanelCaption: "Live Update",
    marketAction: "상세 마켓 데이터 보기",
    allocationTitle: "자산 분포",
    workspaceTitle: "자동 매칭 대기 주문",
    workspaceCaption: "엔진이 선택한 우선 거래 큐와 예상 수익성을 비교합니다.",
    searchPlaceholder: "자산 코드, 시장명, 거래전략 검색...",
    settingsTitle: "자동 매칭 설정",
    selectedAssetLabel: "선택 자산",
    modeLabel: "매칭 모드",
    thresholdLabel: "허용 스프레드",
    capLabel: "1회 최대 수량",
    approvalLabel: "실행 승인 방식",
    submitLabel: "자동 매칭 적용",
    helperLabel: "저장 시 현재 선택한 자산과 허용치가 엔진 큐에 반영됩니다. 실거래 API는 아직 연결되지 않았습니다.",
    activityTitle: "처리 이력",
    activityAction: "새로고침",
    pageStatusMessage: "reference의 자동 매칭 대시보드 구조를 현재 홈 거래 앱으로 이식했습니다. 추천 카드, 시세 패널, 주문 큐, 우측 설정 패널은 데모 데이터 기준입니다.",
    footerOrg: "탄소넷 거래 포털",
    footerAddress: "30121 세종특별자치시 도움6로 42 정부세종청사",
    footerServiceLine: "거래 운영 지원센터 044-000-1800",
    footerCopyright: "Copyright 2026. Carbonet Trade Operations. All rights reserved.",
    footerLastModified: "최종 갱신",
    footerWaAlt: "웹 접근성 품질마크",
    engineMetrics: [
      { label: "실시간 매칭률", value: "92.4%", hint: "최근 30분" },
      { label: "예상 총 수익", value: "₩84,200,000", hint: "현재 추천 기준" },
      { label: "대기 전략", value: "12건", hint: "즉시 실행 가능" }
    ],
    opportunities: [
      { key: "profit", label: "Profit Op", confidence: "Match 98%", title: "KAU23 매수 기회", detail: "시장가 대비 1.2% 저가 매칭 성공", valueLabel: "Profit Est.", value: "+₩12.4M", accentClassName: "border-l-emerald-500 bg-emerald-500/10", valueClassName: "text-emerald-300" },
      { key: "rebalance", label: "Rebalance", confidence: "Match 85%", title: "KOC 외부사업 매도", detail: "고점 도달 알림에 따른 차익 실현", valueLabel: "ROI Est.", value: "+18.2%", accentClassName: "border-l-amber-500 bg-amber-500/10", valueClassName: "text-amber-300" },
      { key: "liquidity", label: "Liquidity", confidence: "Match 92%", title: "i-REC 패키지 매수", detail: "RE100 이행을 위한 저비용 확보", valueLabel: "Savings", value: "₩4.5M", accentClassName: "border-l-sky-500 bg-sky-500/10", valueClassName: "text-sky-300" },
      { key: "arbitrage", label: "Arbitrage", confidence: "Match 77%", title: "시장 간 차익 매칭", detail: "A거래소-B거래소 가격 편차 감지", valueLabel: "Net Profit", value: "₩22.1M", accentClassName: "border-l-indigo-500 bg-indigo-500/10", valueClassName: "text-indigo-300" }
    ],
    tickers: [
      { code: "KAU23", price: "₩13,450", delta: "▼ 0.37%", deltaClassName: "text-rose-500", chartClassName: "bg-rose-100", chartPath: "M0 5 L20 12 L40 8 L60 15 L80 18 L100 20" },
      { code: "KAU24", price: "₩14,800", delta: "▲ 1.42%", deltaClassName: "text-emerald-500", chartClassName: "bg-emerald-100", chartPath: "M0 20 L20 15 L40 18 L60 10 L80 5 L100 2" },
      { code: "KOC", price: "₩11,200", delta: "0.00%", deltaClassName: "text-slate-400", chartClassName: "bg-slate-200" }
    ],
    allocations: [
      { key: "allowance", label: "배출권 현물", value: "₩6.1B", share: "42%", meterClassName: "bg-emerald-500", width: "42%" },
      { key: "renewable", label: "재생에너지 인증", value: "₩3.8B", share: "27%", meterClassName: "bg-sky-500", width: "27%" },
      { key: "offset", label: "상쇄 크레딧", value: "₩2.7B", share: "19%", meterClassName: "bg-indigo-500", width: "19%" },
      { key: "cash", label: "대기 현금", value: "₩1.6B", share: "12%", meterClassName: "bg-slate-400", width: "12%" }
    ],
    rows: [
      { id: "AM-20260402-001", market: "KRX / Spot", asset: "KAU23 대량 매수", quantity: "25,000", spread: "-1.2%", expectedProfit: "₩12.4M", urgency: "긴급", urgencyClassName: "bg-rose-50 text-rose-600", stage: "승인 대기" },
      { id: "AM-20260402-002", market: "KOC / OTC", asset: "KOC 외부사업 매도", quantity: "12,500", spread: "+2.1%", expectedProfit: "₩9.8M", urgency: "우선", urgencyClassName: "bg-amber-50 text-amber-700", stage: "조건 충족" },
      { id: "AM-20260402-003", market: "I-REC / Package", asset: "i-REC 묶음 확보", quantity: "3,200", spread: "-0.8%", expectedProfit: "₩4.5M", urgency: "일반", urgencyClassName: "bg-sky-50 text-sky-700", stage: "자동 실행" },
      { id: "AM-20260402-004", market: "Cross Exchange", asset: "차익 거래 탐지", quantity: "18,900", spread: "+1.9%", expectedProfit: "₩22.1M", urgency: "주의", urgencyClassName: "bg-indigo-50 text-indigo-700", stage: "리스크 검토" },
      { id: "AM-20260402-005", market: "VCM / Block", asset: "해외 상쇄 패키지 전환", quantity: "9,000", spread: "-0.5%", expectedProfit: "₩6.3M", urgency: "일반", urgencyClassName: "bg-slate-100 text-slate-600", stage: "대기" }
    ],
    activityItems: [
      { key: "done", title: "KAU24 자동 매칭 실행", detail: "3개 계정에 분산 체결, 평균 체결가 목표 대비 0.4% 우위", timeAgo: "방금 전", bulletClassName: "bg-emerald-500" },
      { key: "review", title: "차익 거래 검토 요청", detail: "A거래소와 B거래소 가격 편차 1.9% 감지", timeAgo: "8분 전", bulletClassName: "bg-indigo-500" },
      { key: "risk", title: "리스크 제한 자동 조정", detail: "KOC 매도 포지션 상한을 12,500으로 조정", timeAgo: "25분 전", bulletClassName: "bg-amber-500" },
      { key: "sync", title: "시장 데이터 동기화 완료", detail: "KRX, OTC, 외부 패키지 시세 소스 재수집", timeAgo: "42분 전", bulletClassName: "bg-sky-500" }
    ],
    modeOptions: [
      { value: "profit", label: "수익 우선" },
      { value: "balanced", label: "균형형" },
      { value: "safe", label: "보수형" }
    ],
    approvalOptions: [
      { value: "manual", label: "사전 승인 후 실행" },
      { value: "semi", label: "고수익만 자동 실행" },
      { value: "full", label: "조건 충족 시 즉시 실행" }
    ]
  },
  en: {
    pageTitle: "Auto Matching",
    pageSubtitle: "AUTO MATCHING ENGINE",
    navDashboard: "Market Dashboard",
    navMarket: "Trade Market",
    navAutoOrder: "Auto Match Setup",
    navHistory: "Trade History",
    portfolioLabel: "Portfolio Value",
    portfolioValue: "KRW 14,285,400,000",
    portfolioDelta: "▲ 2.4%",
    assistantLabel: "5",
    analystRole: "Senior Analyst",
    analystName: "Chulsoo Kim",
    heroTitle: "Auto Matching Engine",
    heroStatus: "Matching Active",
    heroBody: "The engine reviewed live market prices and portfolio strategy and found",
    heroHighlight: "five high-confidence opportunities",
    heroAction: "Configure global auto matching",
    opportunitiesLabel: "AI Recommended Opportunities",
    marketPanelTitle: "Live Quotes",
    marketPanelCaption: "Live Update",
    marketAction: "Open detailed market data",
    allocationTitle: "Asset Allocation",
    workspaceTitle: "Auto Matching Queue",
    workspaceCaption: "Compare prioritized orders, spreads, and estimated profit before execution.",
    searchPlaceholder: "Search asset code, market, or strategy...",
    settingsTitle: "Auto Match Settings",
    selectedAssetLabel: "Selected asset",
    modeLabel: "Matching mode",
    thresholdLabel: "Allowed spread",
    capLabel: "Max quantity per run",
    approvalLabel: "Approval policy",
    submitLabel: "Apply auto matching",
    helperLabel: "Saving pushes the selected asset and thresholds into the engine queue. A real trading API is not wired yet.",
    activityTitle: "Activity Log",
    activityAction: "Refresh",
    pageStatusMessage: "The reference auto-matching dashboard was rebuilt for the current home trading app. Opportunity cards, quote panels, queue, and the settings panel use demo data.",
    footerOrg: "Carbonet Trade Portal",
    footerAddress: "42 Doum 6-ro, Sejong-si, Republic of Korea",
    footerServiceLine: "Trade Operations Support Center +82-44-000-1800",
    footerCopyright: "Copyright 2026. Carbonet Trade Operations. All rights reserved.",
    footerLastModified: "Last updated",
    footerWaAlt: "Web accessibility quality mark",
    engineMetrics: [
      { label: "Live match rate", value: "92.4%", hint: "last 30 minutes" },
      { label: "Estimated total profit", value: "KRW 84.2M", hint: "current recommendations" },
      { label: "Queued strategies", value: "12", hint: "ready to execute" }
    ],
    opportunities: [
      { key: "profit", label: "Profit Op", confidence: "Match 98%", title: "KAU23 buy window", detail: "Matched 1.2% below current market price", valueLabel: "Profit Est.", value: "+KRW 12.4M", accentClassName: "border-l-emerald-500 bg-emerald-500/10", valueClassName: "text-emerald-300" },
      { key: "rebalance", label: "Rebalance", confidence: "Match 85%", title: "KOC external project sell", detail: "Take profit after the high-price signal was reached", valueLabel: "ROI Est.", value: "+18.2%", accentClassName: "border-l-amber-500 bg-amber-500/10", valueClassName: "text-amber-300" },
      { key: "liquidity", label: "Liquidity", confidence: "Match 92%", title: "i-REC package buy", detail: "Secure low-cost supply for RE100 obligations", valueLabel: "Savings", value: "KRW 4.5M", accentClassName: "border-l-sky-500 bg-sky-500/10", valueClassName: "text-sky-300" },
      { key: "arbitrage", label: "Arbitrage", confidence: "Match 77%", title: "Cross-market spread match", detail: "Detected a spread between exchange A and B", valueLabel: "Net Profit", value: "KRW 22.1M", accentClassName: "border-l-indigo-500 bg-indigo-500/10", valueClassName: "text-indigo-300" }
    ],
    tickers: [
      { code: "KAU23", price: "KRW 13,450", delta: "▼ 0.37%", deltaClassName: "text-rose-500", chartClassName: "bg-rose-100", chartPath: "M0 5 L20 12 L40 8 L60 15 L80 18 L100 20" },
      { code: "KAU24", price: "KRW 14,800", delta: "▲ 1.42%", deltaClassName: "text-emerald-500", chartClassName: "bg-emerald-100", chartPath: "M0 20 L20 15 L40 18 L60 10 L80 5 L100 2" },
      { code: "KOC", price: "KRW 11,200", delta: "0.00%", deltaClassName: "text-slate-400", chartClassName: "bg-slate-200" }
    ],
    allocations: [
      { key: "allowance", label: "Allowance spot", value: "KRW 6.1B", share: "42%", meterClassName: "bg-emerald-500", width: "42%" },
      { key: "renewable", label: "Renewable certificates", value: "KRW 3.8B", share: "27%", meterClassName: "bg-sky-500", width: "27%" },
      { key: "offset", label: "Offset credits", value: "KRW 2.7B", share: "19%", meterClassName: "bg-indigo-500", width: "19%" },
      { key: "cash", label: "Cash reserve", value: "KRW 1.6B", share: "12%", meterClassName: "bg-slate-400", width: "12%" }
    ],
    rows: [
      { id: "AM-20260402-001", market: "KRX / Spot", asset: "KAU23 bulk buy", quantity: "25,000", spread: "-1.2%", expectedProfit: "KRW 12.4M", urgency: "Urgent", urgencyClassName: "bg-rose-50 text-rose-600", stage: "Awaiting approval" },
      { id: "AM-20260402-002", market: "KOC / OTC", asset: "KOC project sell", quantity: "12,500", spread: "+2.1%", expectedProfit: "KRW 9.8M", urgency: "Priority", urgencyClassName: "bg-amber-50 text-amber-700", stage: "Conditions met" },
      { id: "AM-20260402-003", market: "I-REC / Package", asset: "i-REC bundle buy", quantity: "3,200", spread: "-0.8%", expectedProfit: "KRW 4.5M", urgency: "Standard", urgencyClassName: "bg-sky-50 text-sky-700", stage: "Auto execute" },
      { id: "AM-20260402-004", market: "Cross Exchange", asset: "Arbitrage detection", quantity: "18,900", spread: "+1.9%", expectedProfit: "KRW 22.1M", urgency: "Watch", urgencyClassName: "bg-indigo-50 text-indigo-700", stage: "Risk review" },
      { id: "AM-20260402-005", market: "VCM / Block", asset: "Overseas offset rotation", quantity: "9,000", spread: "-0.5%", expectedProfit: "KRW 6.3M", urgency: "Standard", urgencyClassName: "bg-slate-100 text-slate-600", stage: "Queued" }
    ],
    activityItems: [
      { key: "done", title: "KAU24 auto match executed", detail: "Filled across three accounts at 0.4% better than the target price", timeAgo: "Just now", bulletClassName: "bg-emerald-500" },
      { key: "review", title: "Arbitrage review created", detail: "Detected a 1.9% spread between exchange A and B", timeAgo: "8 min ago", bulletClassName: "bg-indigo-500" },
      { key: "risk", title: "Risk cap adjusted", detail: "KOC sell ceiling reduced to 12,500 units", timeAgo: "25 min ago", bulletClassName: "bg-amber-500" },
      { key: "sync", title: "Market sync completed", detail: "KRX, OTC, and external package feeds refreshed", timeAgo: "42 min ago", bulletClassName: "bg-sky-500" }
    ],
    modeOptions: [
      { value: "profit", label: "Profit first" },
      { value: "balanced", label: "Balanced" },
      { value: "safe", label: "Conservative" }
    ],
    approvalOptions: [
      { value: "manual", label: "Approve before execution" },
      { value: "semi", label: "Auto only for top profit" },
      { value: "full", label: "Execute on threshold match" }
    ]
  }
};

function InlineStyles() {
  return (
    <style>{`
      :root {
        --trade-blue: #0f172a;
        --trade-accent: #3b82f6;
        --trade-surface: #f8fafc;
        --trade-border: #e2e8f0;
        --trade-text: #1e293b;
      }
      body { font-family: 'Noto Sans KR', 'Public Sans', sans-serif; -webkit-font-smoothing: antialiased; }
      .trade-auto-shell {
        background:
          radial-gradient(circle at top left, rgba(99, 102, 241, 0.16), transparent 24%),
          linear-gradient(180deg, #0f172a 0, #0f172a 340px, #f8fafc 340px, #f8fafc 100%);
      }
      .trade-auto-hero::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image: linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px);
        background-size: 40px 40px;
        opacity: 0.28;
        pointer-events: none;
      }
      .matching-pulse {
        animation: trade-auto-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      @keyframes trade-auto-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.1); }
      }
      .trade-auto-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
      .trade-auto-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
    `}</style>
  );
}

export function TradeAutoOrderMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(content.rows[0]?.id ?? "");
  const [mode, setMode] = useState(content.modeOptions[0]?.value ?? "profit");
  const [selectedAsset, setSelectedAsset] = useState(content.rows[0]?.asset ?? "");
  const [spreadThreshold, setSpreadThreshold] = useState("1.20");
  const [maxQuantity, setMaxQuantity] = useState("25000");
  const [approvalPolicy, setApprovalPolicy] = useState(content.approvalOptions[0]?.value ?? "manual");
  const [submittedMessage, setSubmittedMessage] = useState("");

  const visibleRows = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return content.rows;
    }
    return content.rows.filter((row) => `${row.id} ${row.market} ${row.asset}`.toLowerCase().includes(keyword));
  }, [content.rows, searchKeyword]);

  const selectedRow = visibleRows.find((row) => row.id === selectedOrderId) || visibleRows[0] || null;

  useEffect(() => {
    if (!selectedRow && visibleRows[0]) {
      setSelectedOrderId(visibleRows[0].id);
    }
  }, [selectedRow, visibleRows]);

  useEffect(() => {
    if (selectedRow) {
      setSelectedAsset(selectedRow.asset);
      setMaxQuantity(selectedRow.quantity.replace(/,/g, ""));
    }
  }, [selectedRow]);

  useEffect(() => {
    logGovernanceScope("PAGE", "trade-auto-order", {
      language: en ? "en" : "ko",
      searchKeyword,
      selectedOrderId,
      selectedAsset,
      mode,
      spreadThreshold,
      maxQuantity,
      approvalPolicy,
      visibleRowCount: visibleRows.length
    });
  }, [approvalPolicy, en, maxQuantity, mode, searchKeyword, selectedAsset, selectedOrderId, spreadThreshold, visibleRows.length]);

  function handleApply() {
    const approvalLabel = content.approvalOptions.find((option) => option.value === approvalPolicy)?.label ?? approvalPolicy;
    setSubmittedMessage(en
      ? `Prepared auto-matching rules for ${selectedAsset} with ${spreadThreshold}% spread and ${approvalLabel}.`
      : `${selectedAsset} 기준으로 허용 스프레드 ${spreadThreshold}%와 ${approvalLabel} 정책을 적용할 준비를 마쳤습니다.`);
  }

  return (
    <>
      <InlineStyles />
      <div className="trade-auto-shell min-h-screen text-[var(--trade-text)]">
        <UserGovernmentBar
          governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
          guidelineText={en ? "Carbonet auto matching workspace" : "대한민국 정부 공식 서비스 | 탄소넷 자동 매칭"}
        />

        <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--trade-blue)]/95 text-white backdrop-blur">
          <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
            <div className="flex min-h-16 flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-8">
                <button className="flex items-center gap-3 bg-transparent p-0 text-left" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))} type="button">
                  <span className="material-symbols-outlined text-[32px] text-blue-400">insights</span>
                  <div>
                    <h1 className="text-lg font-black tracking-tight">CARBON TRADE <span className="text-blue-400">PRO</span></h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-slate-400">Financial Analyst Dashboard</p>
                  </div>
                </button>
                <nav className="hidden items-center gap-1 xl:flex" data-help-id="trade-auto-order-hero">
                  {[
                    { label: content.navDashboard, href: "#" },
                    { label: content.navMarket, href: buildLocalizedPath("/trade/market", "/en/trade/market") },
                    { label: content.navAutoOrder, href: buildLocalizedPath("/trade/auto_order", "/en/trade/auto_order") },
                    { label: content.navHistory, href: "#" }
                  ].map((item, index) => (
                    <a
                      className={index === 2
                        ? "rounded-lg bg-white/10 px-4 py-2 text-sm font-bold text-white"
                        : "rounded-lg px-4 py-2 text-sm font-bold text-slate-400 transition hover:text-white"}
                      href={item.href}
                      key={item.label}
                      onClick={(event) => {
                        if (item.href === "#") {
                          event.preventDefault();
                        }
                      }}
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-4">
                <div className="hidden border-r border-white/10 pr-5 text-right lg:block">
                  <p className="text-[10px] font-bold uppercase text-slate-400">{content.portfolioLabel}</p>
                  <p className="text-sm font-black text-blue-400">{content.portfolioValue} <span className="text-[10px] text-emerald-400">{content.portfolioDelta}</span></p>
                </div>
                <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/5 bg-white/10 text-indigo-300 transition hover:bg-white/20" type="button">
                  <span className="material-symbols-outlined">smart_toy</span>
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white">{content.assistantLabel}</span>
                </button>
                <div className="hidden text-right lg:block">
                  <p className="text-[11px] font-bold text-slate-400">{content.analystRole}</p>
                  <p className="text-sm font-black">{content.analystName}</p>
                </div>
                <UserLanguageToggle en={en} onKo={() => navigate("/trade/auto_order")} onEn={() => navigate("/en/trade/auto_order")} />
                {session.value?.authenticated ? (
                  <MemberButton onClick={() => void session.logout()} size="md" variant="primary">{en ? "Logout" : "로그아웃"}</MemberButton>
                ) : (
                  <a className="inline-flex items-center justify-center rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-100" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>
                    {en ? "Login" : "로그인"}
                  </a>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="pb-14">
          <section className="trade-auto-hero relative overflow-hidden border-b border-white/10 bg-[var(--trade-blue)] py-8" data-help-id="trade-auto-order-hero">
            <div className="relative z-10 mx-auto max-w-[1600px] px-4 lg:px-8">
              <div className="flex flex-col gap-8 xl:flex-row xl:items-stretch">
                <div className="xl:w-[320px] xl:border-r xl:border-white/10 xl:pr-8">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-[0_18px_40px_rgba(59,130,246,0.28)]">
                      <span className="material-symbols-outlined text-[28px] text-white">auto_awesome</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white">{content.heroTitle}</h2>
                      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-indigo-300">
                        <span className="matching-pulse h-2 w-2 rounded-full bg-indigo-400" />
                        {content.heroStatus}
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-7 text-slate-300">
                    {content.heroBody} <strong className="text-white">{content.heroHighlight}</strong>.
                  </p>
                  <div className="mt-5 grid gap-3">
                    {content.engineMetrics.map((metric) => (
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3" key={metric.label}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{metric.label}</p>
                        <p className="mt-1 text-lg font-black text-white">{metric.value}</p>
                        <p className="text-xs font-semibold text-slate-400">{metric.hint}</p>
                      </div>
                    ))}
                  </div>
                  <MemberButton className="mt-6 w-full justify-center" onClick={handleApply} variant="primary">{content.heroAction}</MemberButton>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500" data-help-id="trade-auto-order-opportunities">
                    <span className="material-symbols-outlined text-base text-slate-400">priority_high</span>
                    {content.opportunitiesLabel}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {content.opportunities.map((item) => (
                      <article className={`group rounded-r-2xl border border-white/10 border-l-4 p-4 text-white backdrop-blur transition hover:bg-white/10 ${item.accentClassName}`} key={item.key}>
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <span className="rounded bg-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white">{item.label}</span>
                          <span className="text-[10px] font-bold text-slate-400">{item.confidence}</span>
                        </div>
                        <h4 className="text-sm font-black">{item.title}</h4>
                        <p className="mt-2 min-h-10 text-[11px] leading-5 text-slate-300">{item.detail}</p>
                        <div className="mt-4 flex items-end justify-between">
                          <div>
                            <p className="text-[10px] font-semibold text-slate-500">{item.valueLabel}</p>
                            <p className={`text-sm font-black ${item.valueClassName}`}>{item.value}</p>
                          </div>
                          <span className="material-symbols-outlined text-sm text-indigo-300 transition group-hover:translate-x-1">arrow_forward</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="mx-auto max-w-[1600px] px-4 py-8 lg:px-8">
            {submittedMessage ? <PageStatusNotice tone="success">{submittedMessage}</PageStatusNotice> : null}
            <PageStatusNotice tone="warning">{content.pageStatusMessage}</PageStatusNotice>

            <section className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
              <aside className="space-y-6" data-help-id="trade-auto-order-market">
                <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <h3 className="text-sm font-black text-slate-900">{content.marketPanelTitle}</h3>
                    <span className="text-[10px] font-bold text-slate-400">{content.marketPanelCaption}</span>
                  </div>
                  <div className="space-y-4 p-5">
                    {content.tickers.map((ticker) => (
                      <div className="rounded-2xl bg-slate-50 p-4" key={ticker.code}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-slate-500">{ticker.code}</p>
                            <p className="text-sm font-black text-slate-900">{ticker.price}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-[10px] font-bold ${ticker.deltaClassName}`}>{ticker.delta}</p>
                            <div className={`mt-1 h-4 w-16 overflow-hidden rounded ${ticker.chartClassName}`}>
                              {ticker.chartPath ? (
                                <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 20">
                                  <path d={ticker.chartPath} fill="none" stroke="currentColor" strokeWidth="2" className={ticker.deltaClassName} />
                                </svg>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button className="text-xs font-black text-blue-700 underline" type="button">{content.marketAction}</button>
                  </div>
                </section>

                <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
                  <div className="border-b border-white/10 px-5 py-4">
                    <h3 className="text-sm font-black">{content.allocationTitle}</h3>
                  </div>
                  <div className="space-y-5 p-5">
                    {content.allocations.map((item) => (
                      <article key={item.key}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold">{item.label}</p>
                            <p className="text-xs font-semibold text-slate-400">{item.value}</p>
                          </div>
                          <span className="text-sm font-black text-white">{item.share}</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full rounded-full ${item.meterClassName}`} style={{ width: item.width }} />
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </aside>

              <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]" data-help-id="trade-auto-order-workspace">
                <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{content.workspaceTitle}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{content.workspaceCaption}</p>
                  </div>
                  <AdminInput
                    className="lg:min-w-[320px]"
                    placeholder={content.searchPlaceholder}
                    value={searchKeyword}
                    onChange={(event) => setSearchKeyword(event.target.value)}
                  />
                </div>

                <div className="trade-auto-scrollbar overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-slate-50 text-left">
                      <tr className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        <th className="px-4 py-4">#</th>
                        <th className="px-4 py-4">{en ? "Queue ID" : "큐 번호"}</th>
                        <th className="px-4 py-4">{en ? "Market" : "시장"}</th>
                        <th className="px-4 py-4">{en ? "Asset" : "자산"}</th>
                        <th className="px-4 py-4 text-right">{en ? "Qty" : "수량"}</th>
                        <th className="px-4 py-4">{en ? "Spread" : "스프레드"}</th>
                        <th className="px-4 py-4">{en ? "Expected profit" : "예상 수익"}</th>
                        <th className="px-4 py-4">{en ? "Priority" : "우선도"}</th>
                        <th className="px-4 py-4">{en ? "Stage" : "진행 상태"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row, index) => {
                        const active = row.id === selectedRow?.id;
                        return (
                          <tr
                            className={active ? "cursor-pointer border-t border-blue-100 bg-blue-50/60" : "cursor-pointer border-t border-slate-100 bg-white hover:bg-slate-50"}
                            key={row.id}
                            onClick={() => setSelectedOrderId(row.id)}
                          >
                            <td className="px-4 py-4 align-top">
                              <input checked={active} onChange={() => setSelectedOrderId(row.id)} type="checkbox" />
                            </td>
                            <td className="px-4 py-4 align-top text-sm font-black text-[var(--trade-accent)]">
                              {row.id}
                              <br />
                              <span className="text-xs font-semibold text-slate-400">{String(index + 1).padStart(3, "0")}</span>
                            </td>
                            <td className="px-4 py-4 align-top text-sm font-semibold text-slate-500">{row.market}</td>
                            <td className="px-4 py-4 align-top text-sm font-bold text-slate-800">{row.asset}</td>
                            <td className="px-4 py-4 align-top text-right text-sm font-black text-slate-800">{row.quantity}</td>
                            <td className="px-4 py-4 align-top text-sm font-bold text-slate-700">{row.spread}</td>
                            <td className="px-4 py-4 align-top text-sm font-black text-emerald-600">{row.expectedProfit}</td>
                            <td className="px-4 py-4 align-top"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${row.urgencyClassName}`}>{row.urgency}</span></td>
                            <td className="px-4 py-4 align-top text-sm font-semibold text-slate-600">{row.stage}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="space-y-6">
                <aside className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]" data-help-id="trade-auto-order-settings">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h3 className="text-lg font-black text-slate-900">{content.settingsTitle}</h3>
                    {selectedRow ? <p className="mt-1 text-sm font-semibold text-slate-500">{selectedRow.id} · {selectedRow.market}</p> : null}
                  </div>
                  <div className="space-y-5 px-6 py-6">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-500">{content.selectedAssetLabel}</span>
                      <AdminInput value={selectedAsset} onChange={(event) => setSelectedAsset(event.target.value)} />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-500">{content.modeLabel}</span>
                      <AdminSelect value={mode} onChange={(event) => setMode(event.target.value)}>
                        {content.modeOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </AdminSelect>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-500">{content.thresholdLabel}</span>
                        <AdminInput inputMode="decimal" value={spreadThreshold} onChange={(event) => setSpreadThreshold(event.target.value)} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-500">{content.capLabel}</span>
                        <AdminInput inputMode="numeric" value={maxQuantity} onChange={(event) => setMaxQuantity(event.target.value)} />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-500">{content.approvalLabel}</span>
                      <AdminSelect value={approvalPolicy} onChange={(event) => setApprovalPolicy(event.target.value)}>
                        {content.approvalOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </AdminSelect>
                    </label>
                    <MemberButton className="w-full justify-center" onClick={handleApply} variant="primary">
                      {content.submitLabel}
                    </MemberButton>
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold leading-6 text-slate-500">{content.helperLabel}</p>
                  </div>
                </aside>

                <aside className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]" data-help-id="trade-auto-order-activity">
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                    <h3 className="text-lg font-black text-slate-900">{content.activityTitle}</h3>
                    <button className="text-xs font-black text-blue-700" type="button">{content.activityAction}</button>
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
