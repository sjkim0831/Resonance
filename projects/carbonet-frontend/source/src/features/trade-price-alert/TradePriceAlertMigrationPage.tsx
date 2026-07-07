import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminInput, AdminSelect, MemberButton, PageStatusNotice } from "../member/common";

type SummaryCard = {
  key: string;
  label: string;
  value: string;
  delta: string;
  deltaClassName: string;
  accentClassName?: string;
};

type AlertCard = {
  id: string;
  category: string;
  title: string;
  body: string;
  timeAgo: string;
  tone: "critical" | "positive" | "signal" | "report";
  currentValue?: string;
  changeValue?: string;
  primaryAction: string;
  secondaryAction?: string;
};

type WatchItem = {
  key: string;
  label: string;
  price: string;
  target: string;
  statusLabel: string;
  statusClassName: string;
};

type InsightItem = {
  key: string;
  title: string;
  body: string;
  badge: string;
};

type LocalizedContent = {
  pageTitle: string;
  pageSubtitle: string;
  navItems: string[];
  statusLabel: string;
  memberLabel: string;
  memberName: string;
  myPageLabel: string;
  governmentText: string;
  guidelineText: string;
  heroEyebrow: string;
  heroBody: string;
  summaryTitle: string;
  summaryBody: string;
  alertCenterTitle: string;
  alertCenterHint: string;
  settingsLabel: string;
  filterAll: string;
  filterCritical: string;
  filterPositive: string;
  filterSignal: string;
  watchTitle: string;
  watchBody: string;
  configTitle: string;
  configAssetLabel: string;
  configThresholdLabel: string;
  configChannelLabel: string;
  configSaveLabel: string;
  configPreviewLabel: string;
  assistantTitle: string;
  assistantBody: string;
  note: string;
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerCopyright: string;
  footerLastModified: string;
  footerWaAlt: string;
  summaryCards: SummaryCard[];
  alerts: AlertCard[];
  watchItems: WatchItem[];
  insights: InsightItem[];
  configAssets: Array<{ value: string; label: string }>;
  configChannels: Array<{ value: string; label: string }>;
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    pageTitle: "가격 알림",
    pageSubtitle: "PRICE ALERT CENTER",
    navItems: ["시장 개요", "거래 및 시세", "내 자산 관리", "AI 리포트"],
    statusLabel: "실시간 시장 연결: 정상",
    memberLabel: "거래소 회원",
    memberName: "김마켓 투자자님",
    myPageLabel: "마이페이지",
    governmentText: "대한민국 정부 공식 서비스",
    guidelineText: "대한민국 정부 공식 서비스 | 탄소 배출권 거래 포털",
    heroEyebrow: "Market Context & Strategic Overview",
    heroBody: "탄소배출권, 에너지, 전력 가격 흐름을 하나의 알림 워크스페이스에서 확인하고 즉시 대응합니다.",
    summaryTitle: "오늘의 시장 펄스",
    summaryBody: "선택 자산의 가격 변동, 목표가 도달, 상관관계 신호, 주간 시황 요약을 우선순위 기준으로 재정렬했습니다.",
    alertCenterTitle: "가격 알림 센터",
    alertCenterHint: "치명 알림부터 정기 리포트까지 시간순으로 정렬됩니다.",
    settingsLabel: "설정",
    filterAll: "전체",
    filterCritical: "급변",
    filterPositive: "목표가",
    filterSignal: "지표",
    watchTitle: "나의 감시 자산",
    watchBody: "현재가와 목표가 간 간격을 바로 확인하고 기준을 조정합니다.",
    configTitle: "신규 알림 설정",
    configAssetLabel: "감시 자산",
    configThresholdLabel: "알림 기준 가격",
    configChannelLabel: "수신 채널",
    configSaveLabel: "알림 저장",
    configPreviewLabel: "시뮬레이션 실행",
    assistantTitle: "AI 전략 코멘트",
    assistantBody: "천연가스 상승과 EUA 강세가 동시에 이어질 경우 KAU 단기 반등 확률이 높습니다. 오후 장에서는 KAU24 13,600원 회복 여부를 우선 관찰하세요.",
    note: "Reference HTML의 시각 방향을 유지하되, 현재 앱 구조에 맞춰 공통 포털 셸과 공통 입력 컴포넌트로 재구성한 React 마이그레이션 화면입니다.",
    footerOrg: "CCUS 통합 거래 포털",
    footerAddress: "30121 세종특별자치시 도움6로 42 정부세종청사",
    footerServiceLine: "거래 지원센터 044-000-1800",
    footerCopyright: "Copyright 2026. Carbonet Trade Portal. All rights reserved.",
    footerLastModified: "최종 갱신",
    footerWaAlt: "웹 접근성 품질마크",
    summaryCards: [
      { key: "kau24", label: "KAU24 (탄소배출권)", value: "13,450", delta: "▲ 1.2%", deltaClassName: "text-rose-500" },
      { key: "eua", label: "EUA (유럽 배출권)", value: "€68.42", delta: "▼ 0.5%", deltaClassName: "text-blue-500" },
      { key: "wti", label: "WTI 원유", value: "$82.14", delta: "▲ 2.1%", deltaClassName: "text-rose-500" },
      { key: "gas", label: "천연가스", value: "$2.45", delta: "▲ 4.8%", deltaClassName: "text-rose-500" },
      { key: "smp", label: "전력 계통 한계 가격", value: "142.1", delta: "▼ 0.2%", deltaClassName: "text-blue-500" },
      { key: "portfolio", label: "나의 예상 자산 가치", value: "4.2억", delta: "전일 대비 +2.4%", deltaClassName: "text-indigo-500", accentClassName: "border-l-4 border-l-indigo-500" }
    ],
    alerts: [
      { id: "alert-kau-break", category: "급격한 변동 감지", title: "KAU24 가격 하방 돌파", body: "설정하신 알림 가격 13,000원을 하회하며 급락 중입니다. 현재 체결 호가는 12,980원입니다.", timeAgo: "방금 전", tone: "critical", currentValue: "12,980원", changeValue: "-3.8%", primaryAction: "매수 주문 검토", secondaryAction: "차트 보기" },
      { id: "alert-eua-target", category: "목표가 도달", title: "EU-ETS 가격 신고가 경신", body: "유럽 시장 배출권 가격이 목표가인 €68를 넘어서며 새로운 박스권 진입 신호를 보이고 있습니다.", timeAgo: "14분 전", tone: "positive", currentValue: "€68.42", changeValue: "+4.2%", primaryAction: "리포트 열기", secondaryAction: "알림 유지" },
      { id: "alert-correlation", category: "기술적 지표 알림", title: "에너지 가격-배출권 상관관계 상승", body: "천연가스 가격 급등에 따라 배출권 수요 증가 신호가 감지됐습니다. 단기 골든크로스 직전 구간입니다.", timeAgo: "1시간 전", tone: "signal", currentValue: "상관계수 0.78", changeValue: "+0.12", primaryAction: "기술 보고서" },
      { id: "alert-weekly", category: "정기 보고", title: "8월 2주차 주간 시황 요약", body: "국내 KAU 시장 거래량이 전주 대비 15% 감소하며 관망세가 짙어지고 있습니다. 고점 추격 매수는 신중히 접근하세요.", timeAgo: "3시간 전", tone: "report", primaryAction: "전문 보기" }
    ],
    watchItems: [
      { key: "kau24", label: "KAU24", price: "12,980원", target: "13,000원 하단", statusLabel: "경보 발생", statusClassName: "bg-rose-50 text-rose-700" },
      { key: "eua", label: "EUA", price: "€68.42", target: "€68 돌파", statusLabel: "목표 달성", statusClassName: "bg-emerald-50 text-emerald-700" },
      { key: "wti", label: "WTI", price: "$82.14", target: "$81 상단", statusLabel: "추세 지속", statusClassName: "bg-amber-50 text-amber-700" },
      { key: "lng", label: "천연가스", price: "$2.45", target: "$2.50 접근", statusLabel: "주의 관찰", statusClassName: "bg-indigo-50 text-indigo-700" }
    ],
    insights: [
      { key: "ai", title: "AI 시황 메모", body: "원자재 강세와 배출권 민감도가 동시 확대되고 있어 오후장 변동성이 커질 가능성이 높습니다.", badge: "AI" },
      { key: "risk", title: "리스크 캘린더", body: "금일 15:30 전력거래소 SMP 발표와 18:00 EU 탄소선물 마감 전후 가격 이탈 가능성을 체크하세요.", badge: "CHECK" }
    ],
    configAssets: [
      { value: "kau24", label: "KAU24 (탄소배출권)" },
      { value: "eua", label: "EUA (유럽 배출권)" },
      { value: "wti", label: "WTI 원유" },
      { value: "lng", label: "천연가스" }
    ],
    configChannels: [
      { value: "app", label: "앱 푸시" },
      { value: "sms", label: "SMS" },
      { value: "mail", label: "이메일" }
    ]
  },
  en: {
    pageTitle: "Price Alerts",
    pageSubtitle: "PRICE ALERT CENTER",
    navItems: ["Market Overview", "Trading & Quotes", "My Assets", "AI Reports"],
    statusLabel: "Real-time market link: normal",
    memberLabel: "Exchange Member",
    memberName: "Kim Market Investor",
    myPageLabel: "My Page",
    governmentText: "Official Government Service of the Republic of Korea",
    guidelineText: "Official Government Service | Carbon Allowance Trading Portal",
    heroEyebrow: "Market Context & Strategic Overview",
    heroBody: "Track carbon credits, energy, and power pricing in one alert workspace and react immediately.",
    summaryTitle: "Today's market pulse",
    summaryBody: "Selected asset moves, target hits, correlation signals, and weekly commentary were re-ranked by urgency.",
    alertCenterTitle: "Price Alert Center",
    alertCenterHint: "Alerts are sorted from critical signals to scheduled reports.",
    settingsLabel: "Settings",
    filterAll: "All",
    filterCritical: "Shock",
    filterPositive: "Target",
    filterSignal: "Signal",
    watchTitle: "My watchlist",
    watchBody: "Review the gap between current price and your target, then adjust thresholds.",
    configTitle: "New Alert Setup",
    configAssetLabel: "Watched asset",
    configThresholdLabel: "Alert threshold price",
    configChannelLabel: "Delivery channel",
    configSaveLabel: "Save alert",
    configPreviewLabel: "Run simulation",
    assistantTitle: "AI strategy note",
    assistantBody: "If natural gas strength and EUA momentum continue together, the probability of a short-term KAU rebound increases. Watch whether KAU24 can reclaim KRW 13,600 in the afternoon session.",
    note: "The visual direction from the reference HTML is preserved, but the runtime page was rebuilt in React using the current shared portal shell and shared field components.",
    footerOrg: "CCUS Integrated Trading Portal",
    footerAddress: "42 Doum 6-ro, Sejong-si, Republic of Korea",
    footerServiceLine: "Trade support center +82-44-000-1800",
    footerCopyright: "Copyright 2026. Carbonet Trade Portal. All rights reserved.",
    footerLastModified: "Last updated",
    footerWaAlt: "Web accessibility quality mark",
    summaryCards: [
      { key: "kau24", label: "KAU24 (Korea Allowance)", value: "13,450", delta: "+1.2%", deltaClassName: "text-rose-500" },
      { key: "eua", label: "EUA (EU Allowance)", value: "€68.42", delta: "-0.5%", deltaClassName: "text-blue-500" },
      { key: "wti", label: "WTI Crude", value: "$82.14", delta: "+2.1%", deltaClassName: "text-rose-500" },
      { key: "gas", label: "Natural Gas", value: "$2.45", delta: "+4.8%", deltaClassName: "text-rose-500" },
      { key: "smp", label: "System Marginal Price", value: "142.1", delta: "-0.2%", deltaClassName: "text-blue-500" },
      { key: "portfolio", label: "My projected asset value", value: "KRW 420M", delta: "+2.4% vs yesterday", deltaClassName: "text-indigo-500", accentClassName: "border-l-4 border-l-indigo-500" }
    ],
    alerts: [
      { id: "alert-kau-break", category: "Volatility detected", title: "KAU24 downside break", body: "Your alert threshold of KRW 13,000 was breached and price is falling rapidly. The current quote is KRW 12,980.", timeAgo: "Just now", tone: "critical", currentValue: "KRW 12,980", changeValue: "-3.8%", primaryAction: "Review buy order", secondaryAction: "Open chart" },
      { id: "alert-eua-target", category: "Target reached", title: "EU-ETS made a new high", body: "The European allowance price moved above your EUR 68 target and is showing a new range formation signal.", timeAgo: "14 min ago", tone: "positive", currentValue: "€68.42", changeValue: "+4.2%", primaryAction: "Open report", secondaryAction: "Keep alert" },
      { id: "alert-correlation", category: "Technical signal", title: "Energy-carbon correlation is rising", body: "A demand increase signal for allowances was detected as natural gas spikes. The market is close to a short-term golden cross.", timeAgo: "1 hour ago", tone: "signal", currentValue: "Correlation 0.78", changeValue: "+0.12", primaryAction: "Technical report" },
      { id: "alert-weekly", category: "Scheduled report", title: "Weekly market wrap for week 2 of August", body: "Domestic KAU volume fell 15% week over week and the market is leaning toward a wait-and-see posture. Avoid chasing highs without confirmation.", timeAgo: "3 hours ago", tone: "report", primaryAction: "Read full note" }
    ],
    watchItems: [
      { key: "kau24", label: "KAU24", price: "KRW 12,980", target: "Below KRW 13,000", statusLabel: "Alert fired", statusClassName: "bg-rose-50 text-rose-700" },
      { key: "eua", label: "EUA", price: "€68.42", target: "Above €68", statusLabel: "Target hit", statusClassName: "bg-emerald-50 text-emerald-700" },
      { key: "wti", label: "WTI", price: "$82.14", target: "Above $81", statusLabel: "Trend intact", statusClassName: "bg-amber-50 text-amber-700" },
      { key: "lng", label: "Natural Gas", price: "$2.45", target: "Near $2.50", statusLabel: "Watch closely", statusClassName: "bg-indigo-50 text-indigo-700" }
    ],
    insights: [
      { key: "ai", title: "AI market memo", body: "Commodity strength and allowance sensitivity are expanding together, which raises the chance of a volatile afternoon session.", badge: "AI" },
      { key: "risk", title: "Risk calendar", body: "Watch for price dislocation around the 15:30 SMP publication and the 18:00 EU carbon futures close.", badge: "CHECK" }
    ],
    configAssets: [
      { value: "kau24", label: "KAU24" },
      { value: "eua", label: "EUA" },
      { value: "wti", label: "WTI Crude" },
      { value: "lng", label: "Natural Gas" }
    ],
    configChannels: [
      { value: "app", label: "App push" },
      { value: "sms", label: "SMS" },
      { value: "mail", label: "Email" }
    ]
  }
};

const ALERT_TONE_CLASSNAME: Record<AlertCard["tone"], string> = {
  critical: "border-rose-200 bg-rose-50",
  positive: "border-emerald-200 bg-white",
  signal: "border-indigo-200 bg-white",
  report: "border-slate-200 bg-white"
};

const ALERT_BADGE_CLASSNAME: Record<AlertCard["tone"], string> = {
  critical: "bg-rose-600 text-white",
  positive: "bg-emerald-50 text-emerald-700",
  signal: "bg-indigo-50 text-indigo-700",
  report: "bg-slate-100 text-slate-500"
};

function InlineStyles() {
  return (
    <style>{`
      :root {
        --kr-gov-blue: #00378b;
        --kr-gov-blue-hover: #002d72;
        --kr-gov-text-primary: #111827;
        --kr-gov-text-secondary: #4b5563;
        --kr-gov-border-light: #d1d5db;
        --kr-gov-bg-gray: #f3f4f6;
        --kr-gov-radius: 10px;
      }
      body {
        font-family: "Noto Sans KR", "Public Sans", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .price-alert-shell {
        background:
          radial-gradient(circle at top right, rgba(99,102,241,0.10), transparent 24%),
          radial-gradient(circle at top left, rgba(59,130,246,0.12), transparent 28%),
          linear-gradient(180deg, #f8fbff 0%, #f8fafc 36%, #eef2ff 100%);
      }
      .price-alert-hero::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(135deg, rgba(255,255,255,0.55), transparent 48%),
          linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px),
          linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px);
        background-size: auto, 28px 28px, 28px 28px;
        pointer-events: none;
      }
      .price-alert-scroll::-webkit-scrollbar {
        width: 8px;
      }
      .price-alert-scroll::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 999px;
      }
    `}</style>
  );
}

export function TradePriceAlertMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const [filter, setFilter] = useState("all");
  const [asset, setAsset] = useState(content.configAssets[0]?.value || "");
  const [threshold, setThreshold] = useState(en ? "6800" : "13000");
  const [channel, setChannel] = useState(content.configChannels[0]?.value || "");
  const [savedMessage, setSavedMessage] = useState("");

  const filteredAlerts = useMemo(() => {
    if (filter === "all") {
      return content.alerts;
    }
    return content.alerts.filter((item) => {
      if (filter === "critical") {
        return item.tone === "critical";
      }
      if (filter === "positive") {
        return item.tone === "positive";
      }
      if (filter === "signal") {
        return item.tone === "signal";
      }
      return true;
    });
  }, [content.alerts, filter]);

  useEffect(() => {
    logGovernanceScope("PAGE", "trade-price-alert", {
      language: en ? "en" : "ko",
      filter,
      asset,
      threshold,
      channel,
      alertCount: filteredAlerts.length
    });
  }, [asset, channel, en, filter, filteredAlerts.length, threshold]);

  function handleSave() {
    const assetLabel = content.configAssets.find((item) => item.value === asset)?.label || asset;
    const channelLabel = content.configChannels.find((item) => item.value === channel)?.label || channel;
    setSavedMessage(
      en
        ? `Prepared a ${channelLabel.toLowerCase()} alert for ${assetLabel} at ${threshold}.`
        : `${assetLabel} ${threshold} 기준의 ${channelLabel} 알림 초안을 준비했습니다.`
    );
  }

  const filterButtons = [
    { key: "all", label: content.filterAll },
    { key: "critical", label: content.filterCritical },
    { key: "positive", label: content.filterPositive },
    { key: "signal", label: content.filterSignal }
  ];

  return (
    <>
      <InlineStyles />
      <div className="price-alert-shell min-h-screen text-[var(--kr-gov-text-primary)]">
        <UserGovernmentBar governmentText={content.governmentText} guidelineText={content.guidelineText} />
        <header className="sticky top-0 z-50 border-b border-[var(--kr-gov-border-light)] bg-white/90 shadow-sm backdrop-blur">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="flex min-h-20 flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-3 bg-transparent p-0 text-left" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))} type="button">
                  <span className="material-symbols-outlined text-[36px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 700" }}>monitoring</span>
                  <div>
                    <h1 className="text-xl font-black tracking-tight">{content.pageTitle}</h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-500">{content.heroEyebrow}</p>
                  </div>
                </button>
                <nav className="hidden items-center gap-1 xl:flex" data-help-id="trade-price-alert-hero">
                  {content.navItems.map((item, index) => (
                    <a
                      className={index === 1 ? "rounded-lg border-b-4 border-[var(--kr-gov-blue)] px-4 py-3 text-sm font-black text-[var(--kr-gov-blue)]" : "rounded-lg border-b-4 border-transparent px-4 py-3 text-sm font-black text-slate-500 transition hover:text-[var(--kr-gov-blue)]"}
                      href={index === 1 ? buildLocalizedPath("/trade/price_alert", "/en/trade/price_alert") : "#"}
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
                <div className="hidden rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500 md:block">{content.statusLabel}</div>
                <div className="hidden text-right md:block">
                  <p className="text-xs font-bold text-slate-500">{content.memberLabel}</p>
                  <p className="text-sm font-black text-slate-900">{content.memberName}</p>
                </div>
                <UserLanguageToggle en={en} onKo={() => navigate("/trade/price_alert")} onEn={() => navigate("/en/trade/price_alert")} />
                {session.value?.authenticated ? (
                  <MemberButton onClick={() => navigate(buildLocalizedPath("/mypage", "/en/mypage"))} variant="primary">{content.myPageLabel}</MemberButton>
                ) : (
                  <a className="inline-flex items-center justify-center rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>
                    {en ? "Login" : "로그인"}
                  </a>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-8 lg:px-8">
          <section className="price-alert-hero relative overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.08)]" data-help-id="trade-price-alert-hero">
            <div className="relative z-10 grid gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:px-8">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-500">{content.pageSubtitle}</p>
                <h2 className="mt-3 text-3xl font-black text-slate-950">{content.pageTitle}</h2>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-slate-600">{content.heroBody}</p>
              </div>
              <div className="rounded-[24px] border border-indigo-100 bg-indigo-50/80 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">{content.summaryTitle}</p>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-700">{content.summaryBody}</p>
              </div>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6" data-help-id="trade-price-alert-summary">
            {content.summaryCards.map((card) => (
              <article className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${card.accentClassName || ""}`} key={card.key}>
                <p className="text-[11px] font-black text-slate-400">{card.label}</p>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <p className="text-lg font-black tracking-tight text-slate-900">{card.value}</p>
                  <span className={`text-xs font-black ${card.deltaClassName}`}>{card.delta}</span>
                </div>
              </article>
            ))}
          </section>

          {savedMessage ? <PageStatusNotice tone="success">{savedMessage}</PageStatusNotice> : null}
          <PageStatusNotice tone="warning">{content.note}</PageStatusNotice>

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]" data-help-id="trade-price-alert-alerts">
            <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-950">{content.alertCenterTitle}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{content.alertCenterHint}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {filterButtons.map((item) => (
                    <button
                      className={filter === item.key ? "rounded-full bg-[var(--kr-gov-blue)] px-4 py-2 text-xs font-black text-white" : "rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-500"}
                      key={item.key}
                      onClick={() => setFilter(item.key)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                  <button className="inline-flex items-center gap-1 text-xs font-black text-slate-400" type="button">
                    <span className="material-symbols-outlined text-base">settings</span>
                    {content.settingsLabel}
                  </button>
                </div>
              </div>
              <div className="price-alert-scroll max-h-[920px] space-y-4 overflow-y-auto px-6 py-6">
                {filteredAlerts.map((alert) => (
                  <article className={`rounded-[24px] border p-5 transition hover:shadow-md ${ALERT_TONE_CLASSNAME[alert.tone]}`} key={alert.id}>
                    <div className="flex items-start justify-between gap-4">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black ${ALERT_BADGE_CLASSNAME[alert.tone]}`}>{alert.category}</span>
                      <span className="text-[11px] font-bold text-slate-400">{alert.timeAgo}</span>
                    </div>
                    <h4 className="mt-4 text-lg font-black text-slate-900">{alert.title}</h4>
                    <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">{alert.body}</p>
                    {alert.currentValue || alert.changeValue ? (
                      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-sm">
                        {alert.currentValue ? <span className="font-black text-slate-900">{alert.currentValue}</span> : null}
                        {alert.changeValue ? <span className="font-black text-slate-500">{alert.changeValue}</span> : null}
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <MemberButton size="sm" variant={alert.tone === "critical" ? "primary" : "secondary"}>{alert.primaryAction}</MemberButton>
                      {alert.secondaryAction ? <MemberButton size="sm" variant="ghost">{alert.secondaryAction}</MemberButton> : null}
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <div className="space-y-6">
              <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]" data-help-id="trade-price-alert-watch">
                <h3 className="text-lg font-black text-slate-950">{content.watchTitle}</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-slate-500">{content.watchBody}</p>
                <div className="mt-5 space-y-3">
                  {content.watchItems.map((item) => (
                    <article className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4" key={item.key}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-slate-900">{item.label}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{item.target}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-black ${item.statusClassName}`}>{item.statusLabel}</span>
                      </div>
                      <p className="mt-3 text-lg font-black text-slate-950">{item.price}</p>
                    </article>
                  ))}
                </div>
              </aside>

              <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]" data-help-id="trade-price-alert-config">
                <h3 className="text-lg font-black text-slate-950">{content.configTitle}</h3>
                <div className="mt-5 space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-500">{content.configAssetLabel}</span>
                    <AdminSelect value={asset} onChange={(event) => setAsset(event.target.value)}>
                      {content.configAssets.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </AdminSelect>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-500">{content.configThresholdLabel}</span>
                    <AdminInput value={threshold} onChange={(event) => setThreshold(event.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-500">{content.configChannelLabel}</span>
                    <AdminSelect value={channel} onChange={(event) => setChannel(event.target.value)}>
                      {content.configChannels.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </AdminSelect>
                  </label>
                  <div className="flex gap-2">
                    <MemberButton className="flex-1 justify-center" onClick={handleSave} variant="primary">{content.configSaveLabel}</MemberButton>
                    <MemberButton className="flex-1 justify-center" variant="secondary">{content.configPreviewLabel}</MemberButton>
                  </div>
                </div>
              </aside>

              <aside className="rounded-[28px] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]" data-help-id="trade-price-alert-insight">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-500">auto_awesome</span>
                  <h3 className="text-lg font-black text-slate-950">{content.assistantTitle}</h3>
                </div>
                <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">{content.assistantBody}</p>
                <div className="mt-5 space-y-3">
                  {content.insights.map((item) => (
                    <article className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4" key={item.key}>
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
                        <span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black text-indigo-700">{item.badge}</span>
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-6 text-slate-500">{item.body}</p>
                    </article>
                  ))}
                </div>
              </aside>
            </div>
          </section>
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
