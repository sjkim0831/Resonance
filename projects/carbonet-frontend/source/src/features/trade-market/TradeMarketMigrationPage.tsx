import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminInput, MemberButton, PageStatusNotice } from "../member/common";

type TrendTone = "emerald" | "blue" | "amber";

type TrendingAsset = {
  key: string;
  badge: string;
  badgeClassName: string;
  title: string;
  subtitle: string;
  price: string;
  delta: string;
  deltaClassName: string;
  volume: string;
  bars: number[];
  tone: TrendTone;
};

type MarketTheme = {
  pageTitle: string;
  pageSubtitle: string;
  heroTitle: string;
  heroBody: string;
  liveLabel: string;
  homeLabel: string;
  sectionLabel: string;
  currentLabel: string;
  analystRole: string;
  analystName: string;
  navItems: string[];
  strategyLabel: string;
  reportLabel: string;
  trendingLabel: string;
  searchPlaceholder: string;
  statusLabel: string;
  categoryLabel: string;
  regionLabel: string;
  summaryTitle: string;
  summaryBody: string;
  emptyState: string;
  explorerTitle: string;
  explorerBody: string;
  overviewTitle: string;
  watchlistTitle: string;
  watchlistBody: string;
  marketPulseTitle: string;
  marketPulseBody: string;
  cards: Array<{ label: string; value: string; hint: string; accentClassName: string; }>;
  filters: {
    statuses: string[];
    categories: string[];
    regions: string[];
  };
  assets: TrendingAsset[];
  tableHeaders: string[];
  watchItems: Array<{ key: string; label: string; detail: string; toneClassName: string; }>;
  pulseItems: Array<{ key: string; title: string; detail: string; icon: string; }>;
};

const CONTENT: Record<"ko" | "en", MarketTheme> = {
  ko: {
    pageTitle: "탄소 시장 거래 센터",
    pageSubtitle: "Interactive Market Discovery",
    heroTitle: "시장 분석 도구",
    heroBody: "탄소 상쇄 기회를 탐색하고 프로젝트별 가치를 빠르게 비교합니다. 현재 자발적 탄소 시장(VCM)과 CCUS 크레딧 수요가 동시에 상승하고 있습니다.",
    liveLabel: "Live Discovery",
    homeLabel: "홈",
    sectionLabel: "거래",
    currentLabel: "거래 시장",
    analystRole: "지속가능경영 관리자",
    analystName: "김지속 팀장님",
    navItems: ["대시보드", "거래 시장", "시장 동향", "포트폴리오"],
    strategyLabel: "맞춤형 상쇄 전략 제안",
    reportLabel: "시장 주간 보고서 (PDF)",
    trendingLabel: "Trending Assets (실시간 급상승 자산)",
    searchPlaceholder: "프로젝트명, 국가, 인증 기준, 기술 키워드를 검색하세요.",
    statusLabel: "거래 상태",
    categoryLabel: "자산 카테고리",
    regionLabel: "권역",
    summaryTitle: "시장 탐색 결과",
    summaryBody: "검색어와 필터 조합에 맞는 프로젝트 후보만 정리했습니다.",
    emptyState: "현재 조건에 맞는 프로젝트가 없습니다. 필터를 완화해 다시 확인하세요.",
    explorerTitle: "시장 탐색 보드",
    explorerBody: "실시간 인기 자산과 기본 필터를 함께 배치해 설계 원본의 탐색 흐름을 React 페이지로 재구성했습니다.",
    overviewTitle: "시장 개요",
    watchlistTitle: "우선 관찰 포인트",
    watchlistBody: "거래량 급증 또는 규제 이벤트가 있는 자산을 우선 추렸습니다.",
    marketPulseTitle: "시장 펄스",
    marketPulseBody: "오늘 주목해야 할 흐름입니다.",
    cards: [
      { label: "활성 프로젝트", value: "24", hint: "즉시 비교 가능", accentClassName: "text-emerald-600" },
      { label: "실시간 급등 자산", value: "3", hint: "24시간 기준", accentClassName: "text-blue-600" },
      { label: "평균 거래 단가", value: "$42.9", hint: "tCO2e 당", accentClassName: "text-amber-600" },
      { label: "추적 중 규제 이슈", value: "5", hint: "정책/인증 업데이트", accentClassName: "text-rose-600" }
    ],
    filters: {
      statuses: ["전체", "급상승", "안정", "검토 필요"],
      categories: ["전체", "CCUS", "산림복원", "재생에너지", "직접포집"],
      regions: ["전체", "남미", "유럽", "아시아", "국내"]
    },
    assets: [
      {
        key: "br-02",
        badge: "HOT 1",
        badgeClassName: "bg-rose-500 text-white",
        title: "열대림 복원 프로젝트 (BR-02)",
        subtitle: "아마존 분지 생물 다양성 보존 프로젝트",
        price: "$14.25",
        delta: "▲ 8.4%",
        deltaClassName: "text-emerald-400",
        volume: "1.2k tCO2e",
        bars: [60, 75, 100],
        tone: "emerald"
      },
      {
        key: "is-11",
        badge: "NEW",
        badgeClassName: "bg-blue-500 text-white",
        title: "DAC 직접 탄소 포집 (IS-11)",
        subtitle: "아이슬란드 지열 기반 공기 중 포집",
        price: "$245.00",
        delta: "▼ 0.2%",
        deltaClassName: "text-rose-400",
        volume: "0.4k tCO2e",
        bars: [40, 90, 85],
        tone: "blue"
      },
      {
        key: "vn-08",
        badge: "LIQUID",
        badgeClassName: "bg-amber-500 text-slate-950",
        title: "신재생 에너지 윈드팜 (VN-08)",
        subtitle: "베트남 중부 해안 풍력 발전 단지",
        price: "$6.80",
        delta: "▲ 2.1%",
        deltaClassName: "text-emerald-400",
        volume: "8.9k tCO2e",
        bars: [70, 65, 75],
        tone: "amber"
      }
    ],
    tableHeaders: ["프로젝트", "유형", "권역", "현재가", "24H 거래량", "상태"],
    watchItems: [
      { key: "watch-1", label: "EU CBAM 후속 공시", detail: "산업 크레딧 수요 변동성 확대 가능성", toneClassName: "bg-blue-50 text-blue-700 border-blue-100" },
      { key: "watch-2", label: "브라질 산림복원 매수세", detail: "대형 기관 수요 유입으로 스프레드 축소", toneClassName: "bg-emerald-50 text-emerald-700 border-emerald-100" },
      { key: "watch-3", label: "DAC 인증 단가 재산정", detail: "고단가 자산의 가격 재평가 구간 진입", toneClassName: "bg-amber-50 text-amber-700 border-amber-100" }
    ],
    pulseItems: [
      { key: "pulse-1", title: "VCM 거래량 가속", detail: "전일 대비 14% 증가, 산림복원 카테고리 주도", icon: "trending_up" },
      { key: "pulse-2", title: "CCUS 관심도 상승", detail: "직접포집과 저장형 프로젝트 조회수 급등", icon: "query_stats" },
      { key: "pulse-3", title: "아시아 공급 확대", detail: "재생에너지 크레딧 신규 물량 유입", icon: "public" }
    ]
  },
  en: {
    pageTitle: "Carbon Market Trading Center",
    pageSubtitle: "Interactive Market Discovery",
    heroTitle: "Market Analysis Toolkit",
    heroBody: "Explore offset opportunities and compare project value quickly. Demand is rising across both voluntary carbon markets and CCUS-linked credits.",
    liveLabel: "Live Discovery",
    homeLabel: "Home",
    sectionLabel: "Trade",
    currentLabel: "Trade Market",
    analystRole: "Sustainability Manager",
    analystName: "Jisok Kim, Lead Manager",
    navItems: ["Dashboard", "Trade Market", "Market Trends", "Portfolio"],
    strategyLabel: "Recommend Offset Strategy",
    reportLabel: "Weekly Market Report (PDF)",
    trendingLabel: "Trending Assets",
    searchPlaceholder: "Search project, country, standard, or technology keyword.",
    statusLabel: "Trade status",
    categoryLabel: "Asset category",
    regionLabel: "Region",
    summaryTitle: "Market explorer results",
    summaryBody: "Only the projects matching your keyword and filter mix are shown here.",
    emptyState: "No projects matched the current filters.",
    explorerTitle: "Market Discovery Board",
    explorerBody: "The reference flow was rebuilt as a React page with shared portal chrome and a filtered asset board.",
    overviewTitle: "Market Overview",
    watchlistTitle: "Priority Watch Points",
    watchlistBody: "Assets with volume spikes or regulatory events are highlighted first.",
    marketPulseTitle: "Market Pulse",
    marketPulseBody: "Signals to watch today.",
    cards: [
      { label: "Active projects", value: "24", hint: "Ready to compare", accentClassName: "text-emerald-600" },
      { label: "Trending assets", value: "3", hint: "Past 24h", accentClassName: "text-blue-600" },
      { label: "Average price", value: "$42.9", hint: "Per tCO2e", accentClassName: "text-amber-600" },
      { label: "Regulatory events", value: "5", hint: "Policy and standard updates", accentClassName: "text-rose-600" }
    ],
    filters: {
      statuses: ["All", "Rising", "Stable", "Needs review"],
      categories: ["All", "CCUS", "Forestry", "Renewables", "Direct Air Capture"],
      regions: ["All", "South America", "Europe", "Asia", "Korea"]
    },
    assets: [
      {
        key: "br-02",
        badge: "HOT 1",
        badgeClassName: "bg-rose-500 text-white",
        title: "Tropical Forest Restoration (BR-02)",
        subtitle: "Amazon basin biodiversity preservation project",
        price: "$14.25",
        delta: "▲ 8.4%",
        deltaClassName: "text-emerald-400",
        volume: "1.2k tCO2e",
        bars: [60, 75, 100],
        tone: "emerald"
      },
      {
        key: "is-11",
        badge: "NEW",
        badgeClassName: "bg-blue-500 text-white",
        title: "DAC Carbon Removal (IS-11)",
        subtitle: "Geothermal direct-air capture in Iceland",
        price: "$245.00",
        delta: "▼ 0.2%",
        deltaClassName: "text-rose-400",
        volume: "0.4k tCO2e",
        bars: [40, 90, 85],
        tone: "blue"
      },
      {
        key: "vn-08",
        badge: "LIQUID",
        badgeClassName: "bg-amber-500 text-slate-950",
        title: "Renewable Wind Farm (VN-08)",
        subtitle: "Coastal wind generation cluster in Vietnam",
        price: "$6.80",
        delta: "▲ 2.1%",
        deltaClassName: "text-emerald-400",
        volume: "8.9k tCO2e",
        bars: [70, 65, 75],
        tone: "amber"
      }
    ],
    tableHeaders: ["Project", "Type", "Region", "Price", "24H Volume", "Status"],
    watchItems: [
      { key: "watch-1", label: "EU CBAM follow-up notice", detail: "Industrial credit demand may stay volatile", toneClassName: "bg-blue-50 text-blue-700 border-blue-100" },
      { key: "watch-2", label: "Brazil forestry accumulation", detail: "Institutional inflow is narrowing spreads", toneClassName: "bg-emerald-50 text-emerald-700 border-emerald-100" },
      { key: "watch-3", label: "DAC pricing reset", detail: "Premium assets are entering a repricing window", toneClassName: "bg-amber-50 text-amber-700 border-amber-100" }
    ],
    pulseItems: [
      { key: "pulse-1", title: "VCM volume accelerating", detail: "Up 14% day-over-day, led by forestry assets", icon: "trending_up" },
      { key: "pulse-2", title: "CCUS attention rising", detail: "Search traffic is jumping for removal projects", icon: "query_stats" },
      { key: "pulse-3", title: "Asian supply expanding", detail: "Fresh renewable credit supply is entering the market", icon: "public" }
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
        --kr-gov-radius: 8px;
      }
      body { font-family: 'Noto Sans KR', 'Public Sans', sans-serif; -webkit-font-smoothing: antialiased; }
      .skip-link { position: absolute; top: -100px; left: 0; z-index: 100; padding: 12px; background: var(--kr-gov-blue); color: white; transition: top .2s ease; }
      .skip-link:focus { top: 0; }
      .market-grid::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image: linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px);
        background-size: 52px 52px;
        opacity: 0.45;
        pointer-events: none;
      }
    `}</style>
  );
}

function toneBarClassName(tone: TrendTone) {
  switch (tone) {
    case "blue":
      return "bg-blue-500";
    case "amber":
      return "bg-amber-500";
    default:
      return "bg-teal-500";
  }
}

export function TradeMarketMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState(content.filters.statuses[0] ?? "");
  const [category, setCategory] = useState(content.filters.categories[0] ?? "");
  const [region, setRegion] = useState(content.filters.regions[0] ?? "");

  const filteredAssets = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return content.assets.filter((asset) => {
      const matchKeyword = !normalizedKeyword || `${asset.title} ${asset.subtitle}`.toLowerCase().includes(normalizedKeyword);
      const matchStatus = status === content.filters.statuses[0]
        || (status === (en ? "Rising" : "급상승") && asset.delta.startsWith("▲"))
        || (status === (en ? "Stable" : "안정") && asset.delta.includes("0.2"))
        || (status === (en ? "Needs review" : "검토 필요") && asset.badge === "NEW");
      const matchCategory = category === content.filters.categories[0]
        || asset.title.toLowerCase().includes(category.toLowerCase())
        || asset.subtitle.toLowerCase().includes(category.toLowerCase());
      const matchRegion = region === content.filters.regions[0]
        || asset.subtitle.toLowerCase().includes(region.toLowerCase())
        || asset.title.toLowerCase().includes(region.toLowerCase());
      return matchKeyword && matchStatus && matchCategory && matchRegion;
    });
  }, [category, content.assets, content.filters.categories, content.filters.regions, content.filters.statuses, en, keyword, region, status]);

  useEffect(() => {
    logGovernanceScope("PAGE", "trade-market", {
      language: en ? "en" : "ko",
      keyword,
      status,
      category,
      region,
      resultCount: filteredAssets.length
    });
  }, [category, en, filteredAssets.length, keyword, region, status]);

  return (
    <>
      <InlineStyles />
      <div className="min-h-screen bg-[#f8fafc] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>
        <UserGovernmentBar
          governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
          guidelineText={en ? "Carbon market trading analysis portal" : "대한민국 정부 공식 서비스 | 탄소 시장 거래 분석 시스템"}
        />

        <header className="sticky top-0 z-40 border-b border-[var(--kr-gov-border-light)] bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="flex min-h-20 flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-3 bg-transparent p-0 text-left" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))} type="button">
                  <span className="material-symbols-outlined text-[36px] font-black text-[var(--kr-gov-blue)]">monitoring</span>
                  <div>
                    <h1 className="text-xl font-black leading-tight">{content.pageTitle}</h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--kr-gov-text-secondary)]">{content.pageSubtitle}</p>
                  </div>
                </button>
                <nav className="hidden xl:flex items-center gap-1">
                  {content.navItems.map((item, index) => (
                    <a
                      className={index === 1
                        ? "border-b-4 border-[var(--kr-gov-blue)] px-4 py-6 text-[15px] font-bold text-[var(--kr-gov-blue)]"
                        : "px-4 py-6 text-[15px] font-bold text-slate-500 transition hover:text-[var(--kr-gov-blue)]"}
                      href={index === 0 ? buildLocalizedPath("/trade/list", "/en/trade/list") : index === 1 ? buildLocalizedPath("/trade/market", "/en/trade/market") : "#"}
                      key={item}
                      onClick={(event) => {
                        if (index > 1) {
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
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{content.analystRole}</p>
                  <p className="text-sm font-black">{content.analystName}</p>
                </div>
                <UserLanguageToggle en={en} onKo={() => navigate("/trade/market")} onEn={() => navigate("/en/trade/market")} />
                {session.value?.authenticated ? (
                  <MemberButton onClick={() => void session.logout()} size="md" variant="primary">{en ? "Logout" : "로그아웃"}</MemberButton>
                ) : (
                  <a className="inline-flex items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>
                    {en ? "Login" : "로그인"}
                  </a>
                )}
              </div>
            </div>
          </div>
        </header>

        <main id="main-content">
          <section className="market-grid relative overflow-hidden bg-slate-950 py-14" data-help-id="trade-market-hero">
            <div className="relative z-10 mx-auto max-w-[1440px] px-4 lg:px-8">
              <div className="grid gap-10 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div>
                  <nav aria-label="Breadcrumb" className="mb-4 flex text-sm text-slate-400">
                    <ol className="flex items-center gap-2">
                      <li><a className="hover:text-white" href={buildLocalizedPath("/home", "/en/home")}>{content.homeLabel}</a></li>
                      <li><span className="material-symbols-outlined text-base">chevron_right</span></li>
                      <li>{content.sectionLabel}</li>
                      <li><span className="material-symbols-outlined text-base">chevron_right</span></li>
                      <li className="font-bold text-white">{content.currentLabel}</li>
                    </ol>
                  </nav>
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500 text-white shadow-lg shadow-teal-500/20">
                      <span className="material-symbols-outlined text-[28px]">search_insights</span>
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white">{content.heroTitle}</h2>
                      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-teal-300">{content.liveLabel}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-7 text-slate-300">{content.heroBody}</p>
                  <div className="mt-8 space-y-3">
                    <MemberButton className="w-full justify-center" size="lg" variant="success">{content.strategyLabel}</MemberButton>
                    <button className="inline-flex w-full items-center justify-center rounded-[var(--kr-gov-radius)] border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10" type="button">
                      <span className="material-symbols-outlined mr-2 text-[18px]">download</span>
                      {content.reportLabel}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">{content.trendingLabel}</p>
                      <h3 className="mt-2 text-lg font-black text-white">{content.explorerTitle}</h3>
                    </div>
                    <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 md:block">
                      {content.explorerBody}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-help-id="trade-market-trending">
                    {content.assets.map((asset) => (
                      <article className="rounded-[24px] border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.22)] transition hover:-translate-y-1 hover:border-white/20" key={asset.key}>
                        <div className="flex items-start justify-between gap-3">
                          <span className={`inline-flex rounded px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${asset.badgeClassName}`}>{asset.badge}</span>
                          <div className="flex h-8 items-end gap-1">
                            {asset.bars.map((bar, index) => (
                              <span className={`w-1 rounded-t-sm ${toneBarClassName(asset.tone)}`} key={`${asset.key}-${index}`} style={{ height: `${bar}%` }} />
                            ))}
                          </div>
                        </div>
                        <h4 className="mt-5 text-base font-bold text-white">{asset.title}</h4>
                        <p className="mt-1 min-h-[40px] text-xs leading-5 text-slate-400">{asset.subtitle}</p>
                        <div className="mt-6 flex items-end justify-between border-t border-white/5 pt-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{en ? "Current Price" : "현재가"}</p>
                            <p className="mt-1 text-lg font-black text-white">
                              {asset.price}
                              <span className={`ml-2 text-xs font-bold ${asset.deltaClassName}`}>{asset.delta}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{en ? "24H Volume" : "24H 거래량"}</p>
                            <p className="mt-1 text-sm font-bold text-slate-200">{asset.volume}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-[1440px] px-4 py-10 lg:px-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="trade-market-overview">
              {content.cards.map((card) => (
                <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm" key={card.label}>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
                  <p className={`mt-3 text-3xl font-black ${card.accentClassName}`}>{card.value}</p>
                  <p className="mt-2 text-sm text-slate-500">{card.hint}</p>
                </article>
              ))}
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_380px]">
              <section className="rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]" data-help-id="trade-market-filter">
                <div className="border-b border-slate-100 px-6 py-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--kr-gov-blue)]">{content.overviewTitle}</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{content.summaryTitle}</h3>
                  <p className="mt-2 text-sm text-slate-500">{content.summaryBody}</p>
                </div>
                <div className="grid gap-4 px-6 py-6 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "검색어"}</span>
                    <AdminInput placeholder={content.searchPlaceholder} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{content.statusLabel}</span>
                    <select className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm outline-none transition focus:border-[var(--kr-gov-blue)] focus:ring-2 focus:ring-[var(--kr-gov-blue)]/20" value={status} onChange={(event) => setStatus(event.target.value)}>
                      {content.filters.statuses.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{content.categoryLabel}</span>
                    <select className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm outline-none transition focus:border-[var(--kr-gov-blue)] focus:ring-2 focus:ring-[var(--kr-gov-blue)]/20" value={category} onChange={(event) => setCategory(event.target.value)}>
                      {content.filters.categories.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{content.regionLabel}</span>
                    <select className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm outline-none transition focus:border-[var(--kr-gov-blue)] focus:ring-2 focus:ring-[var(--kr-gov-blue)]/20" value={region} onChange={(event) => setRegion(event.target.value)}>
                      {content.filters.regions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                </div>

                {filteredAssets.length === 0 ? (
                  <PageStatusNotice className="mx-6 mb-6" tone="warning">{content.emptyState}</PageStatusNotice>
                ) : (
                  <div className="overflow-x-auto px-6 pb-6" data-help-id="trade-market-table">
                    <table className="min-w-[860px] w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                          {content.tableHeaders.map((header) => (
                            <th className="px-3 py-4 first:pl-0 last:pr-0" key={header}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAssets.map((asset) => (
                          <tr className="transition hover:bg-slate-50/70" key={asset.key}>
                            <td className="px-3 py-4 first:pl-0">
                              <div className="font-bold text-slate-950">{asset.title}</div>
                              <div className="mt-1 text-xs text-slate-500">{asset.subtitle}</div>
                            </td>
                            <td className="px-3 py-4 text-slate-600">{asset.title.includes("DAC") ? "CCUS" : asset.title.includes("윈드") || asset.title.includes("Wind") ? (en ? "Renewable" : "재생에너지") : (en ? "Forestry" : "산림복원")}</td>
                            <td className="px-3 py-4 text-slate-600">{asset.title.includes("IS-11") ? "Europe" : asset.title.includes("VN-08") ? (en ? "Asia" : "아시아") : (en ? "South America" : "남미")}</td>
                            <td className="px-3 py-4 font-bold text-slate-900">{asset.price}</td>
                            <td className="px-3 py-4 text-slate-600">{asset.volume}</td>
                            <td className="px-3 py-4 pr-0">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${asset.badgeClassName}`}>{asset.badge}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <aside className="space-y-6">
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]" data-help-id="trade-market-watchlist">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">visibility</span>
                    <h3 className="text-lg font-black text-slate-950">{content.watchlistTitle}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{content.watchlistBody}</p>
                  <div className="mt-5 space-y-3">
                    {content.watchItems.map((item) => (
                      <article className={`rounded-[20px] border px-4 py-4 ${item.toneClassName}`.trim()} key={item.key}>
                        <h4 className="text-sm font-bold">{item.label}</h4>
                        <p className="mt-1 text-xs leading-5 opacity-80">{item.detail}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]" data-help-id="trade-market-pulse">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-300">bolt</span>
                    <h3 className="text-lg font-black">{content.marketPulseTitle}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{content.marketPulseBody}</p>
                  <div className="mt-5 space-y-4">
                    {content.pulseItems.map((item) => (
                      <article className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4" key={item.key}>
                        <div className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-teal-300">{item.icon}</span>
                          <div>
                            <h4 className="text-sm font-bold text-white">{item.title}</h4>
                            <p className="mt-1 text-xs leading-5 text-slate-300">{item.detail}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </section>
        </main>

        <UserPortalFooter
          addressLine={en ? "Government Complex Sejong, Republic of Korea" : "세종특별자치시 정부청사로 370"}
          copyright="Copyright 2026. Carbonet. All rights reserved."
          footerLinks={en ? ["Sitemap", "Privacy Policy", "Terms of Use"] : ["사이트맵", "개인정보처리방침", "이용약관"]}
          lastModifiedLabel={en ? "Updated" : "최종 수정"}
          orgName={en ? "Carbonet Service" : "Carbonet 서비스"}
          serviceLine={en ? "Carbon market discovery workspace" : "탄소 시장 탐색 워크스페이스"}
          waAlt={en ? "Web accessibility mark" : "웹 접근성 품질마크"}
        />
      </div>
    </>
  );
}
