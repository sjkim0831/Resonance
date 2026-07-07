import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderMobileMenu } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import type { HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";

type NavItem = { label: string; href: string; active?: boolean };
type InsightCard = { tone: string; toneClass: string; meta: string; title: string; description: string };
type SiteCard = {
  status: string;
  statusClass: string;
  id: string;
  title: string;
  pinClass: string;
  metricLabel: string;
  metricValue: string;
  metricUnit: string;
  metricTone: string;
  efficiencyLabel: string;
  efficiencyValue: string;
  efficiencyTone: string;
  chartBars: number[];
  footerTone: string;
  footerTitle: string;
  footerDescription: string;
  primaryAction: string;
  secondaryAction: string;
};
type ReportBar = { label: string; current: number; scenario: number; highlight?: boolean };

function handleGovSymbolError(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = GOV_SYMBOL_FALLBACK;
}

function EmissionReductionInlineStyles() {
  return (
    <style>{`
      :root {
        --kr-gov-blue: #00378b;
        --kr-gov-blue-hover: #002d72;
        --kr-gov-text-primary: #1a1a1a;
        --kr-gov-text-secondary: #4d4d4d;
        --kr-gov-border-light: #d9d9d9;
        --kr-gov-focus: #005fde;
        --kr-gov-bg-gray: #f2f2f2;
        --kr-gov-radius: 5px;
        --scenario-indigo: #6d6ff6;
        --scenario-indigo-soft: rgba(109, 111, 246, 0.22);
        --scenario-emerald: #4bd0a0;
        --scenario-emerald-soft: rgba(75, 208, 160, 0.24);
        --scenario-rose: #ff5575;
      }
      body {
        font-family: 'Noto Sans KR', 'Public Sans', sans-serif;
        -webkit-font-smoothing: antialiased;
        background: #f4f5f8;
        color: var(--kr-gov-text-primary);
      }
      .skip-link {
        position: absolute;
        top: -100px;
        left: 0;
        background: var(--kr-gov-blue);
        color: white;
        padding: 12px;
        z-index: 100;
        transition: top .2s ease;
      }
      .skip-link:focus { top: 0; }
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus);
        outline-offset: 2px;
      }
      .material-symbols-outlined {
        font-variation-settings: 'wght' 400, 'opsz' 24;
        font-size: 24px;
      }
      .gov-btn {
        padding: 0.625rem 1.25rem;
        font-weight: 700;
        border-radius: var(--kr-gov-radius);
        transition: background-color .2s ease, color .2s ease, border-color .2s ease;
        outline: none;
      }
      .scenario-shell {
        min-height: 100vh;
        background:
          radial-gradient(circle at top right, rgba(109, 111, 246, 0.08), transparent 28%),
          linear-gradient(180deg, #f5f6fa 0%, #f3f4f7 100%);
      }
      .hero-grid {
        background:
          linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)),
          repeating-linear-gradient(0deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05) 1px, transparent 1px, transparent 40px),
          repeating-linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05) 1px, transparent 1px, transparent 40px);
      }
      .scenario-card {
        border: 1px solid rgba(255, 255, 255, 0.09);
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(8px);
        border-radius: 18px;
      }
      .slider-thumb::-webkit-slider-thumb {
        width: 16px;
        height: 16px;
        background: #8b8dff;
        border-radius: 9999px;
        cursor: pointer;
        appearance: none;
        border: 2px solid white;
        box-shadow: 0 0 0 3px rgba(139, 141, 255, 0.2);
      }
      .slider-thumb::-moz-range-thumb {
        width: 16px;
        height: 16px;
        background: #8b8dff;
        border-radius: 9999px;
        cursor: pointer;
        border: 2px solid white;
        box-shadow: 0 0 0 3px rgba(139, 141, 255, 0.2);
      }
      .section-card {
        border: 1px solid #eceef4;
        background: white;
        border-radius: 20px;
        box-shadow: 0 14px 30px rgba(15, 23, 42, 0.04);
      }
      .site-card {
        border: 1px solid #eceef4;
        background: white;
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 12px 24px rgba(15, 23, 42, 0.04);
      }
      .mini-wave {
        position: relative;
        height: 78px;
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(109, 111, 246, 0.08) 0%, rgba(109, 111, 246, 0) 100%);
        overflow: hidden;
      }
      .mini-wave svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      .chart-column {
        position: relative;
        flex: 1;
        min-width: 0;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
      }
      .chart-column.current {
        background: var(--scenario-indigo-soft);
        border-top: 2px solid var(--scenario-indigo);
      }
      .chart-column.scenario::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--scenario-emerald-soft);
        border-top: 2px solid var(--scenario-emerald);
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
      }
      body.mobile-menu-open { overflow: hidden; }
    `}</style>
  );
}

function formatScenarioPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatScenarioMwh(value: number) {
  return `${Math.round(value)} MWh`;
}

export function EmissionReductionMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fuelSwitch, setFuelSwitch] = useState(12.5);
  const [efficiency, setEfficiency] = useState(5.0);
  const [renewable, setRenewable] = useState(300);
  const payloadState = useAsyncValue<HomePayload>(
    () => fetchHomePayload(),
    [en],
    {
      initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
      onError: () => undefined
    }
  );

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  useEffect(() => {
    function handleNavigationSync() {
      void payloadState.reload();
      void session.reload();
    }

    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => {
      window.removeEventListener(getNavigationEventName(), handleNavigationSync);
    };
  }, [payloadState, session]);

  const payload = payloadState.value || { isLoggedIn: false, isEn: en, homeMenu: [] };
  const reductionEffect = Math.round(fuelSwitch * 28 + efficiency * 82 + renewable * 1.8);
  const verificationRate = Math.min(99.8, 92 + fuelSwitch * 0.08 + efficiency * 0.22);
  const targetGap = Math.max(4.2, 20.5 - fuelSwitch * 0.4 - efficiency * 0.8);

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-reduction", {
      language: en ? "en" : "ko",
      fuelSwitch,
      efficiency,
      renewable,
      reductionEffect,
      verificationRate: Number(verificationRate.toFixed(1))
    });
  }, [efficiency, en, fuelSwitch, reductionEffect, renewable, verificationRate]);

  const navItems = useMemo<NavItem[]>(() => en ? [
    { label: "Real-time Emissions", href: "/en/emission/project_list" },
    { label: "Scenario Simulation", href: "/en/emission/reduction", active: true },
    { label: "Process Analysis", href: "/en/emission/validate" },
    { label: "Strategic Reports", href: "/en/emission/report_submit" }
  ] : [
    { label: "실시간 배출 현황", href: "/emission/project_list" },
    { label: "감축 시나리오 시뮬레이션", href: "/emission/reduction", active: true },
    { label: "공정 최적화 분석", href: "/emission/validate" },
    { label: "전략 보고서", href: "/emission/report_submit" }
  ], [en]);

  const insights = useMemo<InsightCard[]>(() => en ? [
    { tone: "OPTIMAL PATH", toneClass: "border-l-emerald-500 text-emerald-300", meta: "Confidence 92%", title: "Increase LNG co-firing by 15%", description: "Potential additional 8.2% reduction versus annual target with lower carbon tax exposure." },
    { tone: "POTENTIAL RISK", toneClass: "border-l-orange-500 text-orange-300", meta: "Impact High", title: "Production-line expansion scenario", description: "If Q4 utilization reaches 110%, the current quota line is likely to be exceeded within D-45." }
  ] : [
    { tone: "OPTIMAL PATH", toneClass: "border-l-emerald-500 text-emerald-300", meta: "Confidence 92%", title: "LNG 혼소율 15% 상향시", description: "연간 목표 대비 8.2% 추가 감축 가능. 탄소세 부담을 함께 낮출 수 있습니다." },
    { tone: "POTENTIAL RISK", toneClass: "border-l-orange-500 text-orange-300", meta: "Impact High", title: "생산 라인 증설 시나리오", description: "Q4 가동률 110% 상향 시 현재 할당량 기준을 D-45 이내 초과할 가능성이 높습니다." }
  ], [en]);

  const siteCards = useMemo<SiteCard[]>(() => en ? [
    { status: "Strategically Active", statusClass: "bg-indigo-100 text-indigo-700", id: "PH-001", title: "Pohang Hot Rolling Mill #1", pinClass: "text-indigo-600", metricLabel: "Current Real-time", metricValue: "2,341", metricUnit: "tCO2", metricTone: "text-indigo-600", efficiencyLabel: "Scenario Efficiency", efficiencyValue: `+${(10 + fuelSwitch * 0.19).toFixed(1)}%`, efficiencyTone: "text-emerald-600", chartBars: [42, 50, 48, 44, 45, 51, 64, 38], footerTone: "bg-indigo-50 text-indigo-700", footerTitle: "Main reduction scenario", footerDescription: "LNG co-firing + waste-heat reuse", primaryAction: "Open Strategy", secondaryAction: "Edit" },
    { status: "Needs Action", statusClass: "bg-rose-100 text-rose-700", id: "US-042", title: "Ulsan Base #3 Chemical Site", pinClass: "text-rose-500", metricLabel: "Accumulated", metricValue: "4,812", metricUnit: "tCO2", metricTone: "text-rose-500", efficiencyLabel: "Target Gap", efficiencyValue: `+${targetGap.toFixed(1)}%`, efficiencyTone: "text-rose-500", chartBars: [36, 29, 24, 31, 48, 58, 62, 54], footerTone: "bg-rose-50 text-rose-700", footerTitle: "Action required", footerDescription: "Supplementary evidence and process-factor tuning", primaryAction: "Upload Now", secondaryAction: "Review" },
    { status: "High Target Achievement", statusClass: "bg-emerald-100 text-emerald-700", id: "GN-112", title: "Gwangyang Energy Center #2", pinClass: "text-slate-300", metricLabel: "Year-to-date", metricValue: "12,890", metricUnit: "tCO2", metricTone: "text-slate-700", efficiencyLabel: "Target Achievement", efficiencyValue: `+${(6.4 + efficiency * 0.36).toFixed(1)}%`, efficiencyTone: "text-emerald-600", chartBars: [30, 32, 34, 34, 40, 42, 45, 44], footerTone: "bg-emerald-50 text-emerald-700", footerTitle: "Verification ready", footerDescription: "Scenario adoption rate is stable across this quarter", primaryAction: "Open Status", secondaryAction: "Report" }
  ] : [
    { status: "전략 가동중", statusClass: "bg-indigo-100 text-indigo-700", id: "PH-001", title: "포항 제1 열연공장", pinClass: "text-indigo-600", metricLabel: "Current Real-time", metricValue: "2,341", metricUnit: "tCO2", metricTone: "text-indigo-600", efficiencyLabel: "Scenario Efficiency", efficiencyValue: `+${(10 + fuelSwitch * 0.19).toFixed(1)}%`, efficiencyTone: "text-emerald-600", chartBars: [42, 50, 48, 44, 45, 51, 64, 38], footerTone: "bg-indigo-50 text-indigo-700", footerTitle: "주력 감축 시나리오", footerDescription: "LNG 혼소 + 폐열 회수 시나리오 적용", primaryAction: "전략 상세", secondaryAction: "편집" },
    { status: "즉시 조치", statusClass: "bg-rose-100 text-rose-700", id: "US-042", title: "울산 제3 화학기지", pinClass: "text-rose-500", metricLabel: "Accumulated", metricValue: "4,812", metricUnit: "tCO2", metricTone: "text-rose-500", efficiencyLabel: "Target Gap", efficiencyValue: `+${targetGap.toFixed(1)}%`, efficiencyTone: "text-rose-500", chartBars: [36, 29, 24, 31, 48, 58, 62, 54], footerTone: "bg-rose-50 text-rose-700", footerTitle: "보완 대응 필요", footerDescription: "증빙 업로드 및 공정계수 재조정 필요", primaryAction: "즉시 업로드", secondaryAction: "검토" },
    { status: "목표 초과 달성", statusClass: "bg-emerald-100 text-emerald-700", id: "GN-112", title: "광양 제2 에너지센터", pinClass: "text-slate-300", metricLabel: "Year-to-date", metricValue: "12,890", metricUnit: "tCO2", metricTone: "text-slate-700", efficiencyLabel: "Target Achievement", efficiencyValue: `+${(6.4 + efficiency * 0.36).toFixed(1)}%`, efficiencyTone: "text-emerald-600", chartBars: [30, 32, 34, 34, 40, 42, 45, 44], footerTone: "bg-emerald-50 text-emerald-700", footerTitle: "검증 준비 완료", footerDescription: "이번 분기 시나리오 적용률이 안정적으로 유지됩니다.", primaryAction: "상태 확인", secondaryAction: "리포트" }
  ], [en, efficiency, fuelSwitch, targetGap]);

  const reportBars = useMemo<ReportBar[]>(() => [
    { label: "2024 Q3", current: 38, scenario: 0 },
    { label: "2024 Q4", current: 54, scenario: 0 },
    { label: "2025 Q1", current: 66, scenario: 42, highlight: true },
    { label: "2025 Q2", current: 74, scenario: 54, highlight: true },
    { label: "2025 Q3", current: 60, scenario: 48 },
    { label: "2025 Q4", current: 52, scenario: 39 }
  ], []);

  return (
    <>
      <EmissionReductionInlineStyles />
      <a className="skip-link" href="#main-content">{en ? "Skip to Main Content" : "본문 바로가기"}</a>
      <div className="scenario-shell">
        <div className="border-b border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-gray)]">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-2 lg:px-8">
            <div className="flex items-center gap-2">
              <img alt={en ? "Republic of Korea Government Emblem" : "대한민국 정부 상징"} className="h-4" src={GOV_SYMBOL} onError={handleGovSymbolError} />
              <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">
                {en ? "Official Government Service of the Republic of Korea | Site Overseer Strategic Portal" : "대한민국 정부 공식 서비스 | 현장 감독관 전략 플래닝 포털"}
              </span>
            </div>
            <p className="hidden text-xs font-medium text-[var(--kr-gov-text-secondary)] md:block">
              {en ? "Analysis Timestamp" : "시나리오 분석 시점"}: 2025.08.14 16:30
            </p>
          </div>
        </div>
        <header className="sticky top-0 z-50 border-b border-[var(--kr-gov-border-light)] bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="flex h-20 items-center justify-between gap-4">
              <button aria-label={en ? "Open menu" : "전체 메뉴 열기"} className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-text-secondary)] xl:hidden" onClick={() => setMobileMenuOpen(true)} type="button">
                <span className="material-symbols-outlined">menu</span>
              </button>
              <a className="flex items-center gap-2 shrink-0" href={buildLocalizedPath("/home", "/en/home")}>
                <span className="material-symbols-outlined text-[34px] text-indigo-600" style={{ fontVariationSettings: "'wght' 700" }}>query_stats</span>
                <div className="flex flex-col">
                  <h1 className="text-base font-black tracking-tight text-[var(--kr-gov-text-primary)] sm:text-xl">{en ? "Carbon Analysis & Reduction" : "탄소배출 분석 · 감축 시나리오"}</h1>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--kr-gov-text-secondary)]">Strategic Scenario Planner</p>
                </div>
              </a>
              <nav aria-label={en ? "Reduction analysis navigation" : "감축 분석 내비게이션"} className="hidden h-full flex-1 items-center justify-center xl:flex">
                {navItems.map((item) => (
                  <a className={`flex h-full items-center border-b-4 px-4 text-[15px] font-bold transition-all ${item.active ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:border-indigo-600 hover:text-indigo-600"}`} href={item.href} key={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden text-right md:block">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Lead Site Overseer" : "현장 총괄 감독관"}</p>
                  <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Admin Lee Hyun-jang" : "이현장 관리자님"}</p>
                </div>
                <button className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 text-indigo-600" type="button">
                  <span className="material-symbols-outlined">insights</span>
                </button>
                <button className="gov-btn hidden bg-slate-800 text-sm text-white hover:bg-slate-900 md:inline-flex" onClick={() => {
                  if (payload.isLoggedIn) {
                    void session.logout();
                  } else {
                    navigate(buildLocalizedPath("/signin/loginView", "/en/signin/loginView"));
                  }
                }} type="button">
                  {payload.isLoggedIn ? (en ? "Logout" : "로그아웃") : (en ? "Login" : "로그인")}
                </button>
              </div>
            </div>
          </div>
          {mobileMenuOpen ? (
            <div className="fixed inset-0 z-50 bg-slate-950/45 xl:hidden">
              <div className="absolute inset-0" onClick={() => setMobileMenuOpen(false)} />
              <HeaderMobileMenu content={content} en={en} homeMenu={payload.homeMenu || []} isLoggedIn={Boolean(payload.isLoggedIn)} onClose={() => setMobileMenuOpen(false)} onLogout={() => session.logout()} />
            </div>
          ) : null}
        </header>
        <main id="main-content">
          <section className="relative overflow-hidden bg-[#0f172b] py-10 text-white" data-help-id="emission-reduction-hero">
            <div className="hero-grid absolute inset-0 opacity-30" />
            <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
              <div className="grid gap-8 xl:grid-cols-[0.9fr_2.1fr]">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/20 px-3 py-1 text-[11px] font-bold text-indigo-300">
                      <span className="material-symbols-outlined text-[15px]">monitoring</span>
                      STRATEGIC MODE
                    </div>
                    <h2 className="whitespace-pre-line text-4xl font-black leading-[1.05]">Proactive Reduction{"\n"}Scenario Planner</h2>
                    <p className="mt-5 max-w-[340px] text-sm leading-7 text-slate-300">
                      {en
                        ? "Move beyond passive reporting and design future reduction pathways directly. Simulate fuel switching and process optimization to compare the most viable reduction curve."
                        : "과거 데이터 기반의 수동 보고를 넘어 미래 감축 경로를 직접 설계합니다. 연료 전환과 공정 최적화를 시뮬레이션해 가장 실행력 높은 감축 곡선을 비교합니다."}
                    </p>
                  </div>
                  <div className="mt-8 space-y-4" data-help-id="emission-reduction-insights">
                    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                      <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                      Scenario Insights
                    </p>
                    {insights.map((card) => (
                      <article className={`scenario-card border-l-4 p-5 ${card.toneClass}`} key={card.title}>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[10px] font-bold tracking-[0.18em]">{card.tone}</span>
                          <span className="text-[10px] text-slate-400">{card.meta}</span>
                        </div>
                        <h3 className="text-sm font-bold text-white">{card.title}</h3>
                        <p className="mt-2 text-[11px] leading-5 text-slate-400">{card.description}</p>
                      </article>
                    ))}
                  </div>
                </div>
                <div className="scenario-card overflow-hidden border border-white/10 bg-white/[0.04] p-5 lg:p-7" data-help-id="emission-reduction-planner">
                  <div className="grid gap-6 lg:grid-cols-[1.7fr_0.85fr]">
                    <div>
                      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <h3 className="text-lg font-bold">Projected Emission Trajectory</h3>
                        <div className="flex flex-wrap gap-4 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[var(--scenario-indigo)]" />{en ? "Current Trend" : "현재 추세"}</span>
                          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[var(--scenario-emerald)]" />{en ? "Scenario Applied" : "시나리오 적용"}</span>
                          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[var(--scenario-rose)]" />{en ? "Reduction Target" : "감축 목표"}</span>
                        </div>
                      </div>
                      <div className="relative flex min-h-[340px] items-end rounded-[24px] border border-white/8 bg-slate-900/30 px-5 py-6">
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-15">
                          <span className="material-symbols-outlined text-[200px] text-slate-500">stacked_line_chart</span>
                        </div>
                        <div className="relative z-10 flex h-[250px] w-full items-end gap-3">
                          {reportBars.map((bar, index) => (
                            <div className="flex flex-1 flex-col items-center justify-end" key={`${bar.label}-${index}`}>
                              <div className="relative flex h-full w-full items-end gap-0.5">
                                <div className="chart-column current" style={{ height: `${bar.current}%` }}>
                                  {bar.highlight ? <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-slate-950 px-2 py-1 text-[9px] font-bold text-white">NOW</span> : null}
                                </div>
                                <div className="chart-column scenario" style={{ height: `${bar.current}%` }}>
                                  <div style={{ height: `${bar.scenario}%` }} />
                                </div>
                                {index >= 4 ? (
                                  <div className="absolute left-0 right-0" style={{ bottom: "40%" }}>
                                    <div className="h-[2px] bg-[var(--scenario-rose)]/80" />
                                  </div>
                                ) : null}
                              </div>
                              <span className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{bar.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <aside className="rounded-[18px] border border-white/8 bg-slate-950/35 p-5" data-help-id="emission-reduction-variables">
                      <h4 className="mb-6 flex items-center gap-2 text-xs font-bold text-white">
                        <span className="material-symbols-outlined text-[18px]">tune</span>
                        Scenario Variables
                      </h4>
                      <div className="space-y-6">
                        <label className="block">
                          <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                            <span>{en ? "Fuel switch (LNG/Hydrogen)" : "연료 전환율 (LNG/Hydrogen)"}</span>
                            <strong className="text-indigo-300">{formatScenarioPercent(fuelSwitch)}</strong>
                          </div>
                          <input className="slider-thumb h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700" max="30" min="0" onChange={(event) => setFuelSwitch(Number(event.target.value))} type="range" value={fuelSwitch} />
                        </label>
                        <label className="block">
                          <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                            <span>{en ? "Efficiency optimization (R&D)" : "에너지 효율 개선 (R&D)"}</span>
                            <strong className="text-indigo-300">{formatScenarioPercent(efficiency)}</strong>
                          </div>
                          <input className="slider-thumb h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700" max="20" min="0" onChange={(event) => setEfficiency(Number(event.target.value))} type="range" value={efficiency} />
                        </label>
                        <label className="block">
                          <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                            <span>{en ? "Renewable energy PPA" : "재생에너지 직접 구매(PPA)"}</span>
                            <strong className="text-indigo-300">{formatScenarioMwh(renewable)}</strong>
                          </div>
                          <input className="slider-thumb h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700" max="1000" min="0" onChange={(event) => setRenewable(Number(event.target.value))} type="range" value={renewable} />
                        </label>
                        <div className="rounded-xl border border-indigo-500/30 bg-indigo-600/20 p-4">
                          <p className="text-[10px] font-bold text-indigo-200">Expected Impact</p>
                          <div className="mt-2 flex items-end gap-1">
                            <span className="text-4xl font-black tracking-[-0.05em] text-white">-{reductionEffect.toLocaleString()}</span>
                            <span className="pb-1 text-xs font-bold text-indigo-300">tCO2e / Yr</span>
                          </div>
                        </div>
                        <button className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700" type="button">
                          {en ? "Apply & Save Scenario" : "시나리오 반영 및 저장"}
                        </button>
                      </div>
                    </aside>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8" data-help-id="emission-reduction-sites">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-[28px] font-black tracking-[-0.03em] text-slate-900">
                  <span className="material-symbols-outlined text-indigo-600" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                  {en ? "Strategic Deep-Dive by Emission Source" : "배출원별 심층 분석 (Strategic Deep-Dive)"}
                </h2>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Review scenario progress and risk posture for the major emission sites." : "주요 배출지별 시나리오 이행 현황과 전략적 리스크를 한 번에 검토합니다."}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600" type="button"><span className="material-symbols-outlined text-[18px]">filter_list</span>{en ? "Filter" : "필터"}</button>
                <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600" type="button"><span className="material-symbols-outlined text-[18px]">download</span>{en ? "Export Data" : "데이터 내보내기"}</button>
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              {siteCards.map((card) => (
                <article className="site-card" key={card.id}>
                  <div className="flex items-start justify-between border-b border-gray-100 bg-slate-50 px-6 py-5">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${card.statusClass}`}>{card.status}</span>
                        <span className="text-[10px] font-bold text-gray-400">{card.id}</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-800">{card.title}</h3>
                    </div>
                    <span className={`material-symbols-outlined ${card.pinClass}`} style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span>
                  </div>
                  <div className="space-y-6 px-6 py-6">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">{card.metricLabel}</p>
                        <div className="flex items-end gap-1">
                          <span className={`text-4xl font-black tracking-[-0.05em] ${card.metricTone}`}>{card.metricValue}</span>
                          <span className="pb-1 text-xs font-bold uppercase text-gray-400">{card.metricUnit}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="mb-1 text-[10px] font-bold text-gray-400">{card.efficiencyLabel}</p>
                        <span className={`text-sm font-black ${card.efficiencyTone}`}>{card.efficiencyValue}</span>
                      </div>
                    </div>
                    <div className="mini-wave">
                      <svg fill="none" viewBox="0 0 280 80" xmlns="http://www.w3.org/2000/svg">
                        <path d={`M0 ${card.chartBars[0]} C 20 ${card.chartBars[1]}, 40 ${card.chartBars[2]}, 70 ${card.chartBars[3]} S 120 ${card.chartBars[4]}, 150 ${card.chartBars[5]} S 220 ${card.chartBars[6]}, 280 ${card.chartBars[7]}`} stroke="#6d6ff6" strokeLinecap="round" strokeWidth="4" />
                      </svg>
                    </div>
                    <div className={`rounded-2xl px-4 py-3 text-sm ${card.footerTone}`}>
                      <p className="font-bold">{card.footerTitle}</p>
                      <p className="mt-1 text-xs opacity-80">{card.footerDescription}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-px border-t border-gray-100 bg-gray-100">
                    <button className="bg-white px-4 py-4 text-sm font-bold text-slate-700" type="button">{card.primaryAction}</button>
                    <button className="bg-white px-4 py-4 text-sm font-bold text-gray-500" type="button">{card.secondaryAction}</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="mx-auto max-w-[1440px] px-4 pb-12 lg:px-8" data-help-id="emission-reduction-report">
            <div className="section-card p-6 lg:p-8">
              <div className="mb-6">
                <h3 className="text-xl font-black text-slate-900">{en ? "Full-site Reduction Progress and Simulation Report" : "전사적 탄소 배출 추이 및 감축 시뮬레이션 리포트"}</h3>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Compare the current site trajectory against the scenario-applied forecast." : "통합 시나리오 기반의 현재 추이와 감축 예상 데이터를 리포트 형태로 확인합니다."}</p>
              </div>
              <div className="grid gap-5 xl:grid-cols-[1.8fr_0.7fr]">
                <div className="rounded-[18px] border border-[#eef0f5] bg-[#fafbff] px-5 pb-5 pt-7">
                  <div className="flex h-[260px] items-end gap-4">
                    {reportBars.map((bar) => (
                      <div className="flex flex-1 items-end gap-1" key={`report-${bar.label}`}>
                        <div className={`w-full rounded-t-[10px] ${bar.highlight ? "bg-[#b9b3ff]" : "bg-[#cdc8ff]"}`} style={{ height: `${bar.current}%` }} />
                        {bar.scenario > 0 ? <div className={`w-full rounded-t-[10px] ${bar.highlight ? "bg-[#76d9b8]" : "bg-[#dfe3f4]"} ${bar.highlight ? "" : "border border-dashed border-[#cfd6ec]"}`} style={{ height: `${bar.scenario}%` }} /> : null}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 grid grid-cols-6 gap-4 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    {reportBars.map((bar) => <span key={`label-${bar.label}`}>{bar.label}</span>)}
                  </div>
                </div>
                <aside className="rounded-[18px] border border-[#eef0f5] bg-[#fafbff] p-5">
                  <div className="mb-5 flex items-center gap-2 text-[12px] font-bold text-indigo-600">
                    <span className="material-symbols-outlined text-[18px]">insights</span>
                    {en ? "Verification Metric" : "검증 지표"}
                  </div>
                  <div className="rounded-[16px] bg-white p-5 shadow-sm">
                    <p className="text-sm font-bold text-slate-900">{en ? "Verification Rate" : "검증 반영률"}</p>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-4xl font-black tracking-[-0.06em] text-indigo-600">{verificationRate.toFixed(1)}%</span>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-indigo-100">
                      <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${verificationRate}%` }} />
                    </div>
                    <dl className="mt-5 space-y-3 text-sm">
                      <div className="flex items-center justify-between"><dt className="text-gray-500">{en ? "Applied sites" : "적용 완료 사이트"}</dt><dd className="font-bold text-slate-900">{en ? "12 of 18" : "18개 중 12개"}</dd></div>
                      <div className="flex items-center justify-between"><dt className="text-gray-500">{en ? "Avg. reduction effect" : "평균 감축 효과"}</dt><dd className="font-bold text-emerald-600">+{(4.2 + efficiency * 0.38).toFixed(1)}%</dd></div>
                      <div className="flex items-center justify-between"><dt className="text-gray-500">{en ? "Last analysis" : "최종 분석 시점"}</dt><dd className="font-bold text-slate-900">2025.08.13</dd></div>
                    </dl>
                  </div>
                </aside>
              </div>
            </div>
          </section>
          <section className="mx-auto max-w-[1440px] px-4 pb-16 lg:px-8" data-help-id="emission-reduction-footer">
            <div className="flex flex-col gap-6 border-t border-[#e8ebf3] pt-8 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">
                  <span className="material-symbols-outlined text-[15px]">factory</span>
                  CCUS Strategy
                </div>
                <p className="max-w-[720px] text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en ? "[04551] Strategic planning base, Seoul | This report summarizes the latest full-site emission trajectory and reduction scenario status." : "[04551] 서울특별시 중구 세종대로 110 정부서울청사 | 본 분석은 최신 전사 탄소배출 추이 및 감축 시뮬레이션 현황을 종합합니다."}
                </p>
                <p className="mt-6 text-xs text-gray-400">© 2025 CCUS Strategic Planning Platform. Proactive Carbon Reduction Portal.</p>
              </div>
              <div className="flex flex-wrap gap-5 text-sm font-bold text-slate-500">
                <a href={buildLocalizedPath("/mypage", "/en/mypage")}>{en ? "My Page" : "마이페이지"}</a>
                <a href={buildLocalizedPath("/emission/report_submit", "/en/emission/report_submit")}>{en ? "Usage Guide" : "이용 안내"}</a>
                <a href={buildLocalizedPath("/emission/validate", "/en/emission/validate")}>{en ? "Scenario Guide" : "시뮬레이션 가이드"}</a>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
