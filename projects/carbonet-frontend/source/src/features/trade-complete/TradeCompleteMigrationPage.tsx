import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminInput, AdminSelect, MemberButton, PageStatusNotice } from "../member/common";

type AlertTone = "danger" | "success" | "warning" | "signal";

type InsightCard = {
  key: string;
  tag: string;
  status: string;
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
  tone: AlertTone;
};

type StrategyCard = {
  id: string;
  code: string;
  name: string;
  statusLabel: string;
  benchmarkLabel: string;
  returnLabel: string;
  returnValue: string;
  returnToneClassName: string;
  fillRateLabel: string;
  fillRateValue: string;
  intensityLabel: string;
  intensityValue: string;
  riskLabel: string;
  riskValue: string;
  horizonLabel: string;
  horizonValue: string;
  highlights: string[];
  riskFilter: string;
  chartStroke: string;
  chartPath: string;
  accentClassName: string;
  badgeClassName: string;
};

type ReportCard = {
  key: string;
  title: string;
  value: string;
  detail: string;
  helper: string;
  toneClassName: string;
};

type LocalizedContent = {
  pageTitle: string;
  pageSubtitle: string;
  navDashboard: string;
  navComplete: string;
  navPortfolio: string;
  navRisk: string;
  syncLabel: string;
  roleLabel: string;
  managerName: string;
  queueTitle: string;
  queueEyebrow: string;
  queueBody: string;
  queueHighlight: string;
  settingsLabel: string;
  searchPlaceholder: string;
  filterLabel: string;
  reportLabel: string;
  strategiesTitle: string;
  strategiesBody: string;
  streamLabel: string;
  visibleCountLabel: string;
  riskFilterLabel: string;
  riskOptions: Array<{ value: string; label: string }>;
  noResultsTitle: string;
  noResultsBody: string;
  reportSectionTitle: string;
  reportSectionBody: string;
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerCopyright: string;
  footerLastModified: string;
  footerWaAlt: string;
  pageStatusMessage: string;
  insights: InsightCard[];
  strategies: StrategyCard[];
  reportCards: ReportCard[];
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    pageTitle: "전략적 체결 현황",
    pageSubtitle: "Strategic Order Overview",
    navDashboard: "대시보드",
    navComplete: "거래/체결 현황",
    navPortfolio: "전략 포트폴리오",
    navRisk: "리스크 관리",
    syncLabel: "시장 데이터 최종 동기화: 방금 전 (실시간)",
    roleLabel: "수석 자산운용역",
    managerName: "이현장 매니저님",
    queueTitle: "포트폴리오 알림",
    queueEyebrow: "Intelligent Alerts",
    queueBody: "AI가 전략적 체결 데이터를 분석하여 주요 마켓 이벤트를 탐지했습니다.",
    queueHighlight: "5개의 중요 신호를 우선 확인하세요.",
    settingsLabel: "알림 환경설정",
    searchPlaceholder: "자산 코드, 전략 명칭, 또는 관리 중인 포트폴리오명을 입력하세요...",
    filterLabel: "필터링",
    reportLabel: "통합 리포트",
    strategiesTitle: "핵심 전략 포트폴리오",
    strategiesBody: "관리 중인 핵심 자산군의 전략 성과와 체결 품질을 카드 단위로 확인합니다.",
    streamLabel: "실시간 데이터 연결 활성",
    visibleCountLabel: "현재 표시 전략",
    riskFilterLabel: "위험도",
    riskOptions: [
      { value: "ALL", label: "전체" },
      { value: "LOW", label: "Low" },
      { value: "MEDIUM", label: "Medium" },
      { value: "HIGH", label: "High" }
    ],
    noResultsTitle: "조건에 맞는 전략이 없습니다.",
    noResultsBody: "검색어 또는 위험도 필터를 조정해 다시 확인하십시오.",
    reportSectionTitle: "전략적 운용 성과 통합 리포트",
    reportSectionBody: "현재 운용 전략의 수익성, 자산군 배분, 체결 품질을 운영 요약 카드로 제공합니다.",
    footerOrg: "자산운용 통합관리본부",
    footerAddress: "(04515) 서울특별시 중구 금융로 10 | 전략 지원선 02-1234-5678",
    footerServiceLine: "운용정보 포트폴리오 관리 및 전략적 의사결정 지원을 위해 최적화되었습니다.",
    footerCopyright: "Copyright 2026. Strategic Asset Management Platform. All rights reserved.",
    footerLastModified: "최종 갱신",
    footerWaAlt: "웹 접근성 품질마크",
    pageStatusMessage: "reference의 포트폴리오 대시보드 구조를 현재 거래 체결 현황 라우트로 이식했습니다. 실거래 API 연동은 아직 연결되지 않았습니다.",
    insights: [
      {
        key: "rebalance",
        tag: "REBALANCING",
        status: "URGENT",
        title: "인공지능 테마: 비중 과다",
        detail: "전략적 비중 한도(25%)를 2.4% 초과했습니다. 일부 이익 실현 체결 검토가 필요합니다.",
        actionLabel: "전략 실행",
        actionHref: "/trade/list",
        tone: "danger"
      },
      {
        key: "execution",
        tag: "EXECUTION",
        status: "FILLED",
        title: "K-반도체 대량 체결 완료",
        detail: "분할 매수 4단계가 전량 체결됐고 평균 단가는 목표 대비 0.5% 낮게 확보됐습니다.",
        actionLabel: "체결 상세 분석",
        actionHref: "/trade/list",
        tone: "success"
      },
      {
        key: "volatility",
        tag: "VOLATILITY",
        status: "WATCH",
        title: "나스닥 선물 변동성 경고",
        detail: "야간 선물 지수 변동폭이 확대됐습니다. 헷지 포지션 진입 조건을 다시 확인하세요.",
        actionLabel: "리스크 점검",
        actionHref: "/trade/statistics",
        tone: "warning"
      },
      {
        key: "signal",
        tag: "SIGNAL",
        status: "NEW",
        title: "그린 에너지 리서치 발표",
        detail: "해외 수주 모멘텀 가능성이 감지됐습니다. 전략 편입 여부를 검토할 시점입니다.",
        actionLabel: "리포트 읽기",
        actionHref: "/certificate/list",
        tone: "signal"
      }
    ],
    strategies: [
      {
        id: "STR-EQUITY-01",
        code: "STR-EQUITY-01",
        name: "그로쓰 코어 상장주식",
        statusLabel: "초과 달성",
        benchmarkLabel: "벤치마크(KOSPI) 대비 +3.2% Outperform",
        returnLabel: "일간 전략 수익률",
        returnValue: "+1.85%",
        returnToneClassName: "text-rose-500",
        fillRateLabel: "체결 성공률",
        fillRateValue: "98.2%",
        intensityLabel: "평균 체결 강도",
        intensityValue: "112.5%",
        riskLabel: "리스크 수준",
        riskValue: "Low",
        horizonLabel: "투자 호흡",
        horizonValue: "98.2%",
        highlights: ["대형 배당 테마 재편", "미국 채권 매도분 신규 편입", "자동 리밸런싱 예약"],
        riskFilter: "LOW",
        chartStroke: "#ef4444",
        chartPath: "M0 25 L10 20 L20 22 L30 12 L40 15 L50 5 L60 8 L70 2 L80 6 L90 1 L100 3",
        accentClassName: "border-t-[var(--kr-gov-blue)]",
        badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-700"
      },
      {
        id: "STR-BOND-04",
        code: "STR-GLOBAL-04",
        name: "글로벌 하이일드 채권",
        statusLabel: "리스크 점검",
        benchmarkLabel: "미국채 대비 듀레이션 조정 필요",
        returnLabel: "누적 수익률",
        returnValue: "428.5 bp",
        returnToneClassName: "text-slate-900",
        fillRateLabel: "변동성 지표",
        fillRateValue: "12.5%",
        intensityLabel: "리스크 수준",
        intensityValue: "Medium",
        riskLabel: "롤다운 효과",
        riskValue: "4.8%",
        horizonLabel: "헤지 커버",
        horizonValue: "82%",
        highlights: ["신흥국 채권 스프레드 확대", "선진국 회사채 축소", "시장 변동 시 Limit Sell 발동"],
        riskFilter: "MEDIUM",
        chartStroke: "#f97316",
        chartPath: "M0 10 L10 12 L20 15 L30 18 L40 17 L50 21 L60 26 L70 20 L80 24 L90 18 L100 19",
        accentClassName: "border-t-orange-500",
        badgeClassName: "border-orange-200 bg-orange-100 text-orange-700"
      },
      {
        id: "STR-ESG-09",
        code: "STR-ESG-09",
        name: "친환경 전환 ESG 펀드",
        statusLabel: "안정적",
        benchmarkLabel: "ESG 지수 대비 추적 오차 안정권",
        returnLabel: "연환산 기대수익",
        returnValue: "+12.4%",
        returnToneClassName: "text-blue-600",
        fillRateLabel: "체결 속도",
        fillRateValue: "High",
        intensityLabel: "추적 오차",
        intensityValue: "0.85",
        riskLabel: "리스크 수준",
        riskValue: "High",
        horizonLabel: "자본 재배치",
        horizonValue: "36h",
        highlights: ["수소 인프라 테마 신규 편입", "탄소 집약 섹터 비중 재배분", "친환경 설비 보조금 추적"],
        riskFilter: "HIGH",
        chartStroke: "#3b82f6",
        chartPath: "M0 22 L10 21 L20 20 L30 19 L40 17 L50 15 L60 13 L70 12 L80 10 L90 9 L100 8",
        accentClassName: "border-t-blue-500",
        badgeClassName: "border-blue-200 bg-blue-100 text-blue-700"
      }
    ],
    reportCards: [
      {
        key: "roi",
        title: "총 자산 수익률 (Current ROI)",
        value: "+8.42",
        detail: "전일 대비 +1.2% 상승",
        helper: "연간 누적 목표 15% 중 56.1% 달성",
        toneClassName: "text-rose-500"
      },
      {
        key: "allocation",
        title: "자산군 배분 현황",
        value: "45 / 30 / 15 / 10",
        detail: "주식 45% | 채권 30% | 대체 15% | 현금 10%",
        helper: "리밸런싱 기준치 안에서 운용 중입니다.",
        toneClassName: "text-slate-900"
      },
      {
        key: "quality",
        title: "체결 효율성 (Execution Quality)",
        value: "88%",
        detail: "슬리피지 관리 등급 Excellent",
        helper: "목표 범위 80% 이상 유지",
        toneClassName: "text-emerald-600"
      }
    ]
  },
  en: {
    pageTitle: "Strategic Order Overview",
    pageSubtitle: "Portfolio Management Suite",
    navDashboard: "Dashboard",
    navComplete: "Trade/Execution",
    navPortfolio: "Strategy Portfolio",
    navRisk: "Risk Management",
    syncLabel: "Market Data Last Sync: Just Now (Real-time)",
    roleLabel: "Senior Portfolio Manager",
    managerName: "Manager David Lee",
    queueTitle: "Portfolio Alerts",
    queueEyebrow: "Intelligent Alerts",
    queueBody: "AI analyzed strategic execution data and surfaced the most relevant market events for the current book.",
    queueHighlight: "Review 5 high-priority signals first.",
    settingsLabel: "Alert Settings",
    searchPlaceholder: "Enter asset code, strategy name, or managed portfolio ID...",
    filterLabel: "Filters",
    reportLabel: "Consolidated Report",
    strategiesTitle: "Active Strategic Portfolios",
    strategiesBody: "Review strategic performance and execution quality for the core portfolios under management.",
    streamLabel: "Real-time Data Stream Active",
    visibleCountLabel: "Visible strategies",
    riskFilterLabel: "Risk",
    riskOptions: [
      { value: "ALL", label: "All" },
      { value: "LOW", label: "Low" },
      { value: "MEDIUM", label: "Medium" },
      { value: "HIGH", label: "High" }
    ],
    noResultsTitle: "No strategy matched the current filters.",
    noResultsBody: "Adjust the keyword or risk filter and try again.",
    reportSectionTitle: "Strategic Performance Snapshot",
    reportSectionBody: "Current profitability, allocation, and execution quality are summarized below.",
    footerOrg: "Integrated Asset Management Division",
    footerAddress: "10 Geumyung-ro, Jung-gu, Seoul | Strategy support line +82-2-1234-5678",
    footerServiceLine: "Optimized for portfolio operations and strategic execution review.",
    footerCopyright: "Copyright 2026. Strategic Asset Management Platform. All rights reserved.",
    footerLastModified: "Last updated",
    footerWaAlt: "Web accessibility quality mark",
    pageStatusMessage: "The reference portfolio dashboard was migrated into the current trade completion route. Live execution APIs are not wired yet.",
    insights: [
      {
        key: "rebalance",
        tag: "REBALANCING",
        status: "URGENT",
        title: "AI Theme: Overweight",
        detail: "The strategic exposure cap was exceeded by 2.4%. Review a partial profit-taking execution.",
        actionLabel: "Execute Strategy",
        actionHref: "/trade/list",
        tone: "danger"
      },
      {
        key: "execution",
        tag: "EXECUTION",
        status: "FILLED",
        title: "K-Semiconductor Block Trade",
        detail: "All four staged accumulation orders were filled with an average price 0.5% below target.",
        actionLabel: "Detailed Analysis",
        actionHref: "/trade/list",
        tone: "success"
      },
      {
        key: "volatility",
        tag: "VOLATILITY",
        status: "WATCH",
        title: "Nasdaq Futures Volatility",
        detail: "Overnight futures volatility expanded. Recheck hedge entry conditions before the next session.",
        actionLabel: "Risk Assessment",
        actionHref: "/trade/statistics",
        tone: "warning"
      },
      {
        key: "signal",
        tag: "SIGNAL",
        status: "NEW",
        title: "Green Energy Research Released",
        detail: "Overseas contract momentum is emerging. Review whether the theme should enter the book.",
        actionLabel: "Read Report",
        actionHref: "/certificate/list",
        tone: "signal"
      }
    ],
    strategies: [
      {
        id: "STR-EQUITY-01",
        code: "STR-EQUITY-01",
        name: "Growth Core Equities",
        statusLabel: "Outperforming",
        benchmarkLabel: "+3.2% outperformance vs KOSPI",
        returnLabel: "Daily strategy return",
        returnValue: "+1.85%",
        returnToneClassName: "text-rose-500",
        fillRateLabel: "Fill rate",
        fillRateValue: "98.2%",
        intensityLabel: "Avg trade intensity",
        intensityValue: "112.5%",
        riskLabel: "Risk level",
        riskValue: "Low",
        horizonLabel: "Investment horizon",
        horizonValue: "98.2%",
        highlights: ["Large-cap dividend theme rotation", "US bond proceeds newly deployed", "Auto-rebalancing reserved"],
        riskFilter: "LOW",
        chartStroke: "#ef4444",
        chartPath: "M0 25 L10 20 L20 22 L30 12 L40 15 L50 5 L60 8 L70 2 L80 6 L90 1 L100 3",
        accentClassName: "border-t-[var(--kr-gov-blue)]",
        badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-700"
      },
      {
        id: "STR-BOND-04",
        code: "STR-GLOBAL-04",
        name: "Global High-Yield Bonds",
        statusLabel: "Review Needed",
        benchmarkLabel: "Duration adjustment required vs UST benchmark",
        returnLabel: "Cumulative return",
        returnValue: "428.5 bp",
        returnToneClassName: "text-slate-900",
        fillRateLabel: "Volatility",
        fillRateValue: "12.5%",
        intensityLabel: "Risk level",
        intensityValue: "Medium",
        riskLabel: "Roll-down effect",
        riskValue: "4.8%",
        horizonLabel: "Hedge cover",
        horizonValue: "82%",
        highlights: ["EM bond spread expansion", "Developed IG trimmed", "Limit sell trigger armed for stress"],
        riskFilter: "MEDIUM",
        chartStroke: "#f97316",
        chartPath: "M0 10 L10 12 L20 15 L30 18 L40 17 L50 21 L60 26 L70 20 L80 24 L90 18 L100 19",
        accentClassName: "border-t-orange-500",
        badgeClassName: "border-orange-200 bg-orange-100 text-orange-700"
      },
      {
        id: "STR-ESG-09",
        code: "STR-ESG-09",
        name: "Energy Transition ESG Fund",
        statusLabel: "Stable",
        benchmarkLabel: "Tracking error remains within the ESG index band",
        returnLabel: "Annualized expected return",
        returnValue: "+12.4%",
        returnToneClassName: "text-blue-600",
        fillRateLabel: "Execution speed",
        fillRateValue: "High",
        intensityLabel: "Tracking error",
        intensityValue: "0.85",
        riskLabel: "Risk level",
        riskValue: "High",
        horizonLabel: "Capital rotation",
        horizonValue: "36h",
        highlights: ["Hydrogen infra theme added", "Carbon-heavy sector weights cut", "Clean facility subsidy feed tracked"],
        riskFilter: "HIGH",
        chartStroke: "#3b82f6",
        chartPath: "M0 22 L10 21 L20 20 L30 19 L40 17 L50 15 L60 13 L70 12 L80 10 L90 9 L100 8",
        accentClassName: "border-t-blue-500",
        badgeClassName: "border-blue-200 bg-blue-100 text-blue-700"
      }
    ],
    reportCards: [
      {
        key: "roi",
        title: "Current ROI",
        value: "+8.42",
        detail: "+1.2% vs previous session",
        helper: "56.1% of the 15% annual target has been achieved.",
        toneClassName: "text-rose-500"
      },
      {
        key: "allocation",
        title: "Asset Allocation",
        value: "45 / 30 / 15 / 10",
        detail: "Equity 45% | Bonds 30% | Alternatives 15% | Cash 10%",
        helper: "The book remains within the rebalancing guardrails.",
        toneClassName: "text-slate-900"
      },
      {
        key: "quality",
        title: "Execution Quality",
        value: "88%",
        detail: "Slippage control rating: Excellent",
        helper: "The target floor of 80% is being maintained.",
        toneClassName: "text-emerald-600"
      }
    ]
  }
};

function toneClassName(tone: AlertTone) {
  switch (tone) {
    case "danger":
      return "border-l-red-500 bg-white/5 text-white";
    case "success":
      return "border-l-emerald-500 bg-white/5 text-white";
    case "warning":
      return "border-l-amber-500 bg-white/5 text-white";
    default:
      return "border-l-indigo-500 bg-white/5 text-white";
  }
}

function InlineStyles() {
  return (
    <style>{`
      :root {
        --kr-gov-blue: #00378b;
        --kr-gov-blue-hover: #002d72;
        --kr-gov-text-primary: #111827;
        --kr-gov-text-secondary: #4b5563;
        --kr-gov-border-light: #dbe2ea;
        --kr-gov-radius: 8px;
      }
      body { font-family: 'Noto Sans KR', 'Public Sans', sans-serif; -webkit-font-smoothing: antialiased; }
      .trade-complete-shell {
        background:
          radial-gradient(circle at top right, rgba(99, 102, 241, 0.18), transparent 26%),
          linear-gradient(180deg, #0f172a 0, #0f172a 280px, #eef2f7 280px, #f8fafc 100%);
      }
      .trade-complete-grid::before {
        content: "";
        position: absolute;
        inset: 0;
        opacity: 0.08;
        background-image: linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px);
        background-size: 40px 40px;
        pointer-events: none;
      }
      .trade-complete-glow {
        animation: trade-complete-glow 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      @keyframes trade-complete-glow {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.78; transform: scale(1.08); }
      }
    `}</style>
  );
}

export function TradeCompleteMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [submittedMessage, setSubmittedMessage] = useState("");

  const filteredStrategies = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    return content.strategies.filter((strategy) => {
      const riskMatches = riskFilter === "ALL" || strategy.riskFilter === riskFilter;
      const keywordMatches = !keyword || `${strategy.id} ${strategy.name} ${strategy.code}`.toLowerCase().includes(keyword);
      return riskMatches && keywordMatches;
    });
  }, [content.strategies, riskFilter, searchKeyword]);

  useEffect(() => {
    logGovernanceScope("PAGE", "trade-complete", {
      language: en ? "en" : "ko",
      searchKeyword,
      riskFilter,
      visibleStrategyCount: filteredStrategies.length
    });
  }, [en, filteredStrategies.length, riskFilter, searchKeyword]);

  function handleReportExport() {
    setSubmittedMessage(en
      ? `Prepared a consolidated report for ${filteredStrategies.length} visible strategies.`
      : `현재 노출된 ${filteredStrategies.length}개 전략 기준으로 통합 리포트 준비를 완료했습니다.`);
  }

  return (
    <>
      <InlineStyles />
      <div className="trade-complete-shell min-h-screen text-[var(--kr-gov-text-primary)]">
        <UserGovernmentBar
          governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
          guidelineText={en ? "Strategic order overview" : "대한민국 정부 공식 서비스 | 전략적 체결 현황"}
        />

        <div className="border-b border-white/10 bg-slate-900">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-2 text-xs font-medium text-white/70 lg:px-8">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-white/50">account_balance</span>
              <span>{en ? "Institutional Asset Management Portal | Portfolio Manager Access" : "기관 전용 자산운용 포털 | Portfolio Manager Access"}</span>
            </div>
            <span className="hidden md:block text-white/50">{content.syncLabel}</span>
          </div>
        </div>

        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="flex min-h-20 flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-8">
                <button className="flex items-center gap-3 bg-transparent p-0 text-left" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))} type="button">
                  <span className="material-symbols-outlined text-[36px] text-[var(--kr-gov-blue)]">query_stats</span>
                  <div>
                    <h1 className="text-xl font-black tracking-tight">{content.pageTitle}</h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">{content.pageSubtitle}</p>
                  </div>
                </button>
                <nav className="hidden items-center gap-1 xl:flex" data-help-id="trade-complete-hero">
                  {[content.navDashboard, content.navComplete, content.navPortfolio, content.navRisk].map((item, index) => (
                    <a
                      className={index === 1
                        ? "border-b-4 border-[var(--kr-gov-blue)] px-4 py-6 text-sm font-bold text-[var(--kr-gov-blue)]"
                        : "border-b-4 border-transparent px-4 py-6 text-sm font-bold text-slate-500 transition hover:text-[var(--kr-gov-blue)]"}
                      href={index === 1 ? buildLocalizedPath("/trade/complete", "/en/trade/complete") : "#"}
                      key={item}
                      onClick={(event) => {
                        if (index !== 1) {
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
                <div className="hidden text-right md:block">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{content.roleLabel}</p>
                  <p className="text-sm font-black text-slate-900">{content.managerName}</p>
                </div>
                <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100" type="button">
                  <span className="material-symbols-outlined">notifications_active</span>
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[8px] font-bold text-white">5</span>
                </button>
                <UserLanguageToggle en={en} onKo={() => navigate("/trade/complete")} onEn={() => navigate("/en/trade/complete")} />
                {session.value?.authenticated ? (
                  <MemberButton onClick={() => void session.logout()} size="md" variant="primary">{en ? "Logout" : "로그아웃"}</MemberButton>
                ) : (
                  <a className="inline-flex items-center justify-center rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-white" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>
                    {en ? "Login" : "로그인"}
                  </a>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="pb-12">
          <section className="trade-complete-grid relative overflow-hidden bg-[#0f172a] py-10" data-help-id="trade-complete-hero">
            <div className="relative z-10 mx-auto grid max-w-[1440px] gap-8 px-4 xl:grid-cols-[0.28fr_0.72fr] lg:px-8">
              <aside className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="mb-4 flex items-center gap-3">
                  <div className="trade-complete-glow flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 shadow-[0_0_24px_rgba(99,102,241,0.45)]">
                    <span className="material-symbols-outlined text-[28px] text-white">insights</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">{content.queueTitle}</h2>
                    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-indigo-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
                      {content.queueEyebrow}
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-7 text-slate-300">
                  {content.queueBody}
                  <br />
                  <strong className="font-bold text-white">{content.queueHighlight}</strong>
                </p>
                <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15" type="button">
                  <span className="material-symbols-outlined text-[18px]">filter_list</span>
                  {content.settingsLabel}
                </button>
              </aside>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="trade-complete-alerts">
                {content.insights.map((insight) => (
                  <article className={`flex flex-col rounded-r-2xl border border-white/10 border-l-4 p-5 ${toneClassName(insight.tone)}`} key={insight.key}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <span className="rounded bg-white/10 px-2 py-1 text-[10px] font-bold tracking-[0.18em] text-slate-200">{insight.tag}</span>
                      <span className="text-[10px] font-bold tracking-[0.16em] text-slate-400">{insight.status}</span>
                    </div>
                    <h3 className="text-sm font-black text-white">{insight.title}</h3>
                    <p className="mt-2 flex-1 text-[12px] leading-6 text-slate-300">{insight.detail}</p>
                    <a className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-300 hover:text-indigo-200" href={buildLocalizedPath(insight.actionHref, `/en${insight.actionHref}`)}>
                      {insight.actionLabel}
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </a>
                  </article>
                ))}
              </section>
            </div>
          </section>

          <section className="relative z-10 mx-auto -mt-7 max-w-[1440px] px-4 lg:px-8" data-help-id="trade-complete-filters">
            <div className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[20px] text-slate-400">search</span>
                  <AdminInput
                    className="h-14 border-transparent bg-slate-50 pl-12 pr-4"
                    placeholder={content.searchPlaceholder}
                    value={searchKeyword}
                    onChange={(event) => setSearchKeyword(event.target.value)}
                  />
                </div>
                <div className="w-full lg:w-[220px]">
                  <AdminSelect className="h-14 bg-slate-50" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
                    {content.riskOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </AdminSelect>
                </div>
                <button className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-slate-100 px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-200" type="button">
                  <span className="material-symbols-outlined text-[20px]">tune</span>
                  {content.filterLabel}
                </button>
                <button className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[var(--kr-gov-blue)] px-6 text-sm font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]" onClick={handleReportExport} type="button">
                  <span className="material-symbols-outlined text-[20px]">download</span>
                  {content.reportLabel}
                </button>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8">
            {submittedMessage ? <PageStatusNotice tone="success">{submittedMessage}</PageStatusNotice> : null}
            <PageStatusNotice tone="warning">{content.pageStatusMessage}</PageStatusNotice>

            <div className="mb-8 mt-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-black" data-help-id="trade-complete-strategies">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">account_balance_wallet</span>
                  {content.strategiesTitle}
                </h2>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{content.strategiesBody}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[11px] font-bold text-indigo-700">
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  {content.streamLabel}
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-bold text-slate-600">
                  <span className="material-symbols-outlined text-[18px]">stacked_bar_chart</span>
                  {content.visibleCountLabel} {filteredStrategies.length}
                </div>
              </div>
            </div>

            {filteredStrategies.length === 0 ? (
              <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-14 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]" data-help-id="trade-complete-strategies">
                <h3 className="text-lg font-black text-slate-900">{content.noResultsTitle}</h3>
                <p className="mt-2 text-sm text-slate-500">{content.noResultsBody}</p>
              </section>
            ) : (
              <div className="grid gap-8 lg:grid-cols-3" data-help-id="trade-complete-strategies">
                {filteredStrategies.map((strategy) => (
                  <article className={`overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] ${strategy.accentClassName}`} key={strategy.id}>
                    <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-6">
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${strategy.badgeClassName}`}>{strategy.statusLabel}</span>
                          <span className="text-[10px] font-bold text-slate-400">{strategy.code}</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900">{strategy.name}</h3>
                      </div>
                      <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">star</span>
                    </div>
                    <div className="border-b border-indigo-100 bg-indigo-50/70 px-6 py-3 text-[11px] font-bold text-indigo-800">{strategy.benchmarkLabel}</div>
                    <div className="space-y-8 p-6">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-400">{strategy.returnLabel}</p>
                          <p className={`mt-1 text-3xl font-black tracking-tight ${strategy.returnToneClassName}`}>{strategy.returnValue}</p>
                        </div>
                        <svg className="h-16 w-32" viewBox="0 0 100 30">
                          <path d={strategy.chartPath} fill="none" stroke={strategy.chartStroke} strokeLinecap="round" strokeWidth="2.5" />
                        </svg>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-[10px] font-bold uppercase text-slate-400">{strategy.fillRateLabel}</p>
                          <p className="mt-1 text-lg font-black text-slate-900">{strategy.fillRateValue}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-[10px] font-bold uppercase text-slate-400">{strategy.intensityLabel}</p>
                          <p className="mt-1 text-lg font-black text-slate-900">{strategy.intensityValue}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-[10px] font-bold uppercase text-slate-400">{strategy.riskLabel}</p>
                          <p className="mt-1 text-lg font-black text-slate-900">{strategy.riskValue}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-[10px] font-bold uppercase text-slate-400">{strategy.horizonLabel}</p>
                          <p className="mt-1 text-lg font-black text-slate-900">{strategy.horizonValue}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Strategy Insights</p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                          {strategy.highlights.map((highlight) => <li key={highlight}>• {highlight}</li>)}
                        </ul>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <section className="mt-14 rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]" data-help-id="trade-complete-report">
              <div className="mb-6">
                <h2 className="text-2xl font-black text-slate-900">{content.reportSectionTitle}</h2>
                <p className="mt-2 text-sm text-slate-500">{content.reportSectionBody}</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {content.reportCards.map((card) => (
                  <article className="rounded-2xl bg-slate-50 p-5" key={card.key}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{card.title}</p>
                    <p className={`mt-3 text-4xl font-black tracking-tight ${card.toneClassName}`}>{card.value}</p>
                    <p className="mt-3 text-sm font-semibold text-slate-700">{card.detail}</p>
                    <p className="mt-2 text-xs leading-6 text-slate-500">{card.helper}</p>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </main>

        <UserPortalFooter
          orgName={content.footerOrg}
          addressLine={content.footerAddress}
          serviceLine={content.footerServiceLine}
          copyright={content.footerCopyright}
          lastModifiedLabel={content.footerLastModified}
          waAlt={content.footerWaAlt}
        />
      </div>
    </>
  );
}
