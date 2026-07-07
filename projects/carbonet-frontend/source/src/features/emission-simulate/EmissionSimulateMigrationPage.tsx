import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HeaderMobileMenu } from "../home-entry/HomeEntrySections";
import { HOME_ENTRY_ASSETS, LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import type { HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";
const WA_MARK = HOME_ENTRY_ASSETS.WA_MARK;

type Recommendation = {
  category: string;
  categoryClass: string;
  icon: string;
  title: string;
  description: string;
};

type MetricCard = {
  label: string;
  value: string;
  caption: string;
  toneClass: string;
  badge?: string;
};

type ScenarioCard = {
  id: "balanced" | "accelerated";
  label: string;
};

type BuilderCopy = {
  tech: string;
  efficiency: string;
  renewable: string;
  ccus: string;
  projectedOutcome: string;
  projectedCaption: string;
  reset: string;
  save: string;
};

function handleGovSymbolError(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = GOV_SYMBOL_FALLBACK;
}

function EmissionSimulateInlineStyles() {
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
        --kr-gov-radius: 8px;
        --planner-accent: #10b981;
        --planner-deep: #0f172a;
      }
      body {
        font-family: 'Noto Sans KR', 'Public Sans', sans-serif;
        -webkit-font-smoothing: antialiased;
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
      .material-symbols-outlined {
        font-variation-settings: 'wght' 400, 'opsz' 24;
        font-size: 24px;
      }
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus);
        outline-offset: 2px;
      }
      .planner-card {
        border: 1px solid var(--kr-gov-border-light);
        border-radius: var(--kr-gov-radius);
        background: white;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
      }
      .scenario-tab-active {
        background: #ecfdf5;
        color: #047857;
        border-color: #a7f3d0;
      }
      .scenario-slider {
        width: 100%;
        height: 8px;
        appearance: none;
        border-radius: 9999px;
        background: linear-gradient(90deg, #d1fae5 0%, #86efac 45%, #10b981 100%);
        cursor: pointer;
      }
      .scenario-slider::-webkit-slider-thumb {
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 9999px;
        background: white;
        border: 3px solid var(--planner-accent);
        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
      }
      .home-brand-copy { min-width: 0; }
      .home-brand-title {
        margin: 0 !important;
        font-size: inherit !important;
        line-height: 1.2 !important;
      }
      .home-brand-subtitle {
        margin: 0 !important;
        line-height: 1.2;
      }
      .gnb-item:hover .gnb-depth2 { display: block; }
      .gnb-depth2 { width: 560px !important; padding: 10px; }
      .gnb-sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .gnb-section { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; background: #fafafa; }
      .gnb-section-title { display: block; font-size: 12px; font-weight: 700; color: var(--kr-gov-blue); margin-bottom: 6px; padding: 0 4px; }
      body.mobile-menu-open { overflow: hidden; }
    `}</style>
  );
}

export function EmissionSimulateMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scenarioId, setScenarioId] = useState<ScenarioCard["id"]>("balanced");
  const [techInvestment, setTechInvestment] = useState(50);
  const [efficiencyGain, setEfficiencyGain] = useState(62);
  const [renewableRate, setRenewableRate] = useState(35);
  const [ccusScale, setCcusScale] = useState(20);

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
  const homeMenu = payload.homeMenu || [];

  const recommendations = useMemo<Recommendation[]>(
    () => en
      ? [
          { category: "ENERGY MIX", categoryClass: "text-blue-400 bg-blue-500/20", icon: "bolt", title: "Increase renewable sourcing", description: "Raising the PPA mix by 15% shortens the net-zero arrival by roughly two years." },
          { category: "TECH INVEST", categoryClass: "text-emerald-400 bg-emerald-500/20", icon: "precision_manufacturing", title: "Replace high-load motors", description: "A targeted retrofit in Pohang Plant 1 yields an estimated 1,200 tCO2e reduction per year." },
          { category: "COST OPTIM", categoryClass: "text-orange-400 bg-orange-500/20", icon: "payments", title: "Monetize excess allowances", description: "Selling 5,000 surplus tons in Q3 recovers about KRW 150M in operating budget." },
          { category: "COMPLIANCE", categoryClass: "text-violet-400 bg-violet-500/20", icon: "gavel", title: "Refresh K-ETS factors", description: "Indirect-emission factor revisions require a reporting workflow update within 15 days." }
        ]
      : [
          { category: "ENERGY MIX", categoryClass: "text-blue-400 bg-blue-500/20", icon: "bolt", title: "신재생 에너지 비중 확대", description: "PPA 구매 비중을 15% 높이면 Net-Zero 도달 시점을 약 2년 단축할 수 있습니다." },
          { category: "TECH INVEST", categoryClass: "text-emerald-400 bg-emerald-500/20", icon: "precision_manufacturing", title: "고효율 모터 교체 사업", description: "포항 제1공장 설비 교체 시 연간 약 1,200 tCO2e 감축 효과가 예상됩니다." },
          { category: "COST OPTIM", categoryClass: "text-orange-400 bg-orange-500/20", icon: "payments", title: "배출권 거래 수익화", description: "3분기 잉여 배출권 5,000톤 매도 시 약 1.5억원의 운영 재원을 확보할 수 있습니다." },
          { category: "COMPLIANCE", categoryClass: "text-violet-400 bg-violet-500/20", icon: "gavel", title: "K-ETS 대응 고도화", description: "간접 배출 계수 변경에 맞춰 15일 이내 보고 체계를 보정해야 합니다." }
        ],
    [en]
  );

  const metrics = useMemo<MetricCard[]>(
    () => en
      ? [
          { label: "Cost savings", value: "₩2.4B", caption: "12% lower than last year", toneClass: "bg-emerald-50 border-emerald-100 text-emerald-900", badge: "ESTIMATED" },
          { label: "Compliance score", value: "94.8/100", caption: "Aligned with current policy thresholds", toneClass: "bg-blue-50 border-blue-100 text-blue-900", badge: "TARGET" },
          { label: "Carbon intensity", value: "0.42 tCO2/₩M", caption: "Ahead of sector average", toneClass: "bg-slate-900 border-slate-800 text-white", badge: "REALTIME" }
        ]
      : [
          { label: "비용 절감", value: "₩2.4B", caption: "전년 대비 12% 절감", toneClass: "bg-emerald-50 border-emerald-100 text-emerald-900", badge: "ESTIMATED" },
          { label: "규제 적합도", value: "94.8/100", caption: "현재 규제 기준에 부합", toneClass: "bg-blue-50 border-blue-100 text-blue-900", badge: "TARGET" },
          { label: "탄소 집약도", value: "0.42 tCO2/₩M", caption: "업계 평균 대비 우수", toneClass: "bg-slate-900 border-slate-800 text-white", badge: "REALTIME" }
        ],
    [en]
  );

  const scenarioTabs = useMemo<ScenarioCard[]>(
    () => en
      ? [
          { id: "balanced", label: "Balanced pathway" },
          { id: "accelerated", label: "Accelerated decarbonization" }
        ]
      : [
          { id: "balanced", label: "균형형 시나리오" },
          { id: "accelerated", label: "공격형 감축 시나리오" }
        ],
    [en]
  );

  const builderCopy = useMemo<BuilderCopy>(
    () => en
      ? {
          tech: "Tech investment",
          efficiency: "Efficiency improvements",
          renewable: "Renewable transition",
          ccus: "CCUS capture scale",
          projectedOutcome: "Projected outcome (2030)",
          projectedCaption: "Expected reduction versus current BAU",
          reset: "Reset",
          save: "Save scenario"
        }
      : {
          tech: "기술 투자",
          efficiency: "공정 효율 개선",
          renewable: "재생에너지 전환",
          ccus: "탄소 포집/저장",
          projectedOutcome: "예상 감축량 (2030)",
          projectedCaption: "현행 유지 대비 예상 감축 효과",
          reset: "설정 초기화",
          save: "시나리오 저장"
        },
    [en]
  );

  const projectedReduction = useMemo(() => {
    const base = Math.round(techInvestment * 120 + efficiencyGain * 90 + renewableRate * 130 + ccusScale * 80);
    return scenarioId === "accelerated" ? Math.round(base * 1.18) : base;
  }, [ccusScale, efficiencyGain, renewableRate, scenarioId, techInvestment]);

  const projectedWidth = `${Math.min(100, Math.round(projectedReduction / 350))}%`;
  const reportHref = buildLocalizedPath("/emission/report_submit", "/en/emission/report_submit");
  const validateHref = buildLocalizedPath("/emission/validate", "/en/emission/validate");

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-simulate", {
      language: en ? "en" : "ko",
      menuCount: homeMenu.length,
      isLoggedIn: Boolean(payload.isLoggedIn),
      mobileMenuOpen,
      scenarioId
    });
    logGovernanceScope("COMPONENT", "emission-simulate-builder", {
      techInvestment,
      efficiencyGain,
      renewableRate,
      ccusScale,
      projectedReduction
    });
  }, [ccusScale, efficiencyGain, en, homeMenu.length, mobileMenuOpen, payload.isLoggedIn, projectedReduction, renewableRate, scenarioId, techInvestment]);

  return (
    <>
      <EmissionSimulateInlineStyles />
      <div className="bg-[#f8fafc] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{content.skipLink}</a>

        <div className="bg-[var(--kr-gov-bg-gray)] border-b border-[var(--kr-gov-border-light)]">
          <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={content.govAlt} className="h-4" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
              <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">
                {en ? "Carbon simulation service | Sustainability strategy desk" : "탄소배출 분석 및 시뮬레이션 시스템 | 지속가능경영 전략실"}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-[var(--kr-gov-text-secondary)]">
              <p>{en ? "Simulation engine: Active (v4.2)" : "시뮬레이션 엔진: Active (v4.2)"}</p>
            </div>
          </div>
        </div>

        <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50 shadow-sm">
          <div className="max-w-[1600px] mx-auto px-4 lg:px-8">
            <div className="relative flex items-center h-24">
              <div className="xl:hidden w-11 h-11 shrink-0" aria-hidden="true" />
              <HeaderBrand content={content} en={en} />
              <HeaderDesktopNav en={en} homeMenu={homeMenu} />
              <div className={`ml-auto flex items-center ${en ? "gap-2" : "gap-3"} shrink-0`}>
                <div className="hidden xl:flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible ${en ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate("/home")}>KO</button>
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible border-l border-[var(--kr-gov-border-light)] ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} onClick={() => navigate("/en/home")}>EN</button>
                </div>
                {payload.isLoggedIn ? (
                  <button type="button" className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--planner-deep)] text-white hover:bg-slate-950" onClick={() => void session.logout()}>{content.logout}</button>
                ) : (
                  <>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] items-center" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{content.login}</a>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-white text-[var(--kr-gov-blue)] border border-[var(--kr-gov-blue)] hover:bg-[var(--kr-gov-bg-gray)] items-center" href={buildLocalizedPath("/join/step1", "/join/en/step1")}>{content.signup}</a>
                  </>
                )}
                <button
                  id="mobile-menu-toggle"
                  className="xl:hidden w-11 h-11 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-blue)] flex items-center justify-center hover:bg-[var(--kr-gov-bg-gray)] focus-visible"
                  type="button"
                  aria-controls="mobile-menu"
                  aria-expanded={mobileMenuOpen}
                  aria-label={content.openAllMenu}
                  onClick={() => setMobileMenuOpen((current) => !current)}
                >
                  <span className="material-symbols-outlined">menu</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div id="mobile-menu" className={`${mobileMenuOpen ? "" : "hidden"} xl:hidden fixed inset-0 z-[70]`} aria-hidden={!mobileMenuOpen}>
          <button type="button" id="mobile-menu-backdrop" className="absolute inset-0 bg-black/50" aria-label={content.closeAllMenu} onClick={() => setMobileMenuOpen(false)} />
          <HeaderMobileMenu
            content={content}
            en={en}
            homeMenu={homeMenu}
            isLoggedIn={Boolean(payload.isLoggedIn)}
            onClose={() => setMobileMenuOpen(false)}
            onLogout={session.logout}
          />
        </div>

        <main className="pb-20" id="main-content">
          <section className="bg-slate-900 py-8 border-b border-slate-800" data-help-id="emission-simulate-hero">
            <div className="max-w-[1600px] mx-auto px-4 lg:px-8">
              <div className="flex flex-col xl:flex-row gap-8 items-start">
                <div className="xl:w-1/4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <span className="material-symbols-outlined text-white text-[28px]">lightbulb</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">{en ? "Strategic recommendations" : "전략 제언"}</h2>
                      <p className="text-emerald-400 text-xs font-bold flex items-center gap-1 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Scenario insights
                      </p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">
                    {en
                      ? "The planner combines current emissions, reduction projects, and investment priorities into a decision-ready pathway."
                      : "현재 배출량, 감축 프로젝트, 투자 우선순위를 결합해 바로 의사결정에 쓸 수 있는 경로를 제안합니다."}
                  </p>
                  <a className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-sm font-bold transition-all flex items-center justify-center gap-2" href={reportHref}>
                    {en ? "Export report" : "보고서 내보내기"} <span className="material-symbols-outlined text-sm">download</span>
                  </a>
                </div>
                <div className="xl:w-3/4 w-full" data-help-id="emission-simulate-recommendations">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">analytics</span>
                    {en ? "Strategic recommendations" : "전략 추천 카드"}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {recommendations.map((item) => (
                      <article className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-lg group hover:bg-white/10 transition-all" key={item.title}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`p-1 rounded material-symbols-outlined text-[18px] ${item.categoryClass}`}>{item.icon}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.categoryClass}`}>{item.category}</span>
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1">{item.title}</h4>
                        <p className="text-slate-400 text-[11px]">{item.description}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-[1600px] mx-auto px-4 lg:px-8 py-8">
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-8 space-y-6">
                <section className="planner-card p-6 h-[500px]" data-help-id="emission-simulate-chart">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-600">show_chart</span>
                        {en ? "Emission trend analysis and simulation result" : "탄소 배출 트렌드 분석 및 시뮬레이션 결과"}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {en ? "A combined view of live data and scenario-model forecasting." : "실시간 데이터와 시나리오 모델이 결합된 예측 곡선입니다."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {scenarioTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-colors ${scenarioId === tab.id ? "scenario-tab-active" : "bg-white border-gray-200 text-gray-500 hover:border-emerald-200 hover:text-emerald-700"}`}
                          onClick={() => setScenarioId(tab.id)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 relative border-l border-b border-gray-100 min-h-[320px]">
                    <div className="absolute inset-0 flex items-end">
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 300">
                        <path d="M0 50 L200 65 L400 60 L600 75 L800 80 L1000 85" fill="none" stroke="#e2e8f0" strokeDasharray="5,5" strokeWidth="2" />
                        <path
                          d={scenarioId === "accelerated" ? "M0 50 L200 40 L400 24 L600 12 L800 6 L1000 2" : "M0 50 L200 45 L400 35 L600 20 L800 10 L1000 5"}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="4"
                        />
                        <line stroke="#fecaca" strokeDasharray="10,5" strokeWidth="1" x1="0" x2="1000" y1="90" y2="90" />
                        <circle cx="600" cy={scenarioId === "accelerated" ? "12" : "20"} fill="#10b981" r="6" stroke="white" strokeWidth="2" />
                      </svg>
                    </div>
                    <div className="absolute -left-12 top-0 h-full flex flex-col justify-between text-[10px] font-bold text-gray-400 py-2">
                      <span>100k</span>
                      <span>75k</span>
                      <span>50k</span>
                      <span>25k</span>
                      <span>0</span>
                    </div>
                    <div className="absolute -bottom-6 left-0 w-full flex justify-between text-[10px] font-bold text-gray-400 px-4">
                      <span>2024</span>
                      <span>2025</span>
                      <span>2026</span>
                      <span>2027</span>
                      <span>2028</span>
                      <span>2029</span>
                    </div>
                  </div>
                  <div className="mt-10 flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-gray-600">{en ? "Scenario-applied forecast" : "시나리오 적용 예측"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-slate-200" />
                      <span className="text-xs font-bold text-gray-400">{en ? "Current BAU" : "현행 유지(BAU)"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-10 h-[1px] border-t border-red-200 border-dashed" />
                      <span className="text-xs font-bold text-red-400">{en ? "Emission cap threshold" : "배출 허용 총량 한계선"}</span>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {metrics.map((metric) => (
                    <article className={`planner-card p-5 ${metric.toneClass}`} key={metric.label}>
                      <div className="flex justify-between items-start mb-4">
                        <span className="material-symbols-outlined">{metric.label.includes("Cost") || metric.label.includes("비용") ? "savings" : metric.label.includes("규제") || metric.label.includes("Compliance") ? "task_alt" : "energy_savings_leaf"}</span>
                        {metric.badge ? <span className="text-[10px] font-black bg-white/70 px-2 py-0.5 rounded shadow-sm">{metric.badge}</span> : null}
                      </div>
                      <p className="text-xs font-bold uppercase opacity-70">{metric.label}</p>
                      <h4 className="text-2xl font-black mt-1">{metric.value}</h4>
                      <p className="text-[11px] mt-2 font-medium opacity-80">{metric.caption}</p>
                    </article>
                  ))}
                </section>
              </div>

              <aside className="col-span-12 lg:col-span-4" data-help-id="emission-simulate-builder">
                <section className="planner-card p-6 sticky top-24">
                  <div className="flex items-center gap-2 mb-8">
                    <span className="material-symbols-outlined text-emerald-600">tune</span>
                    <h3 className="text-lg font-black">{en ? "Scenario builder" : "시나리오 빌더"}</h3>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm font-bold">
                        <span>{builderCopy.tech}</span>
                        <span className="text-emerald-600">₩{techInvestment.toLocaleString()}M</span>
                      </div>
                      <input className="scenario-slider" max="100" min="0" onChange={(event) => setTechInvestment(Number(event.target.value))} type="range" value={techInvestment} />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm font-bold">
                        <span>{builderCopy.efficiency}</span>
                        <span className="text-emerald-600">+{efficiencyGain}%</span>
                      </div>
                      <input className="scenario-slider" max="100" min="0" onChange={(event) => setEfficiencyGain(Number(event.target.value))} type="range" value={efficiencyGain} />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm font-bold">
                        <span>{builderCopy.renewable}</span>
                        <span className="text-emerald-600">{renewableRate}%</span>
                      </div>
                      <input className="scenario-slider" max="100" min="0" onChange={(event) => setRenewableRate(Number(event.target.value))} type="range" value={renewableRate} />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm font-bold">
                        <span>{builderCopy.ccus}</span>
                        <span className="text-emerald-600">{ccusScale}%</span>
                      </div>
                      <input className="scenario-slider" max="100" min="0" onChange={(event) => setCcusScale(Number(event.target.value))} type="range" value={ccusScale} />
                    </div>

                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">{builderCopy.projectedOutcome}</p>
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <div className="text-3xl font-black text-emerald-600">-{projectedReduction.toLocaleString()} tCO2e</div>
                          <p className="text-xs text-slate-500 mt-1">{builderCopy.projectedCaption}</p>
                        </div>
                        <a className="text-xs font-bold text-[var(--kr-gov-blue)] underline" href={validateHref}>
                          {en ? "Open validation" : "산정 검증 열기"}
                        </a>
                      </div>
                      <div className="mt-4 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: projectedWidth }} />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        className="flex-1 px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-600 hover:bg-gray-50"
                        type="button"
                        onClick={() => {
                          setScenarioId("balanced");
                          setTechInvestment(50);
                          setEfficiencyGain(62);
                          setRenewableRate(35);
                          setCcusScale(20);
                        }}
                      >
                        {builderCopy.reset}
                      </button>
                      <button className="flex-1 px-4 py-3 rounded-lg bg-slate-900 text-sm font-bold text-white hover:bg-slate-950" type="button">
                        {builderCopy.save}
                      </button>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          </section>
        </main>

        <footer className="border-t border-gray-200 bg-white">
          <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-600">eco</span>
                  </div>
                  <div>
                    <strong className="block text-lg font-black text-slate-900">{en ? "Carbon analysis HQ" : "탄소배출 종합분석 센터"}</strong>
                    <p className="text-sm text-slate-500">
                      {en
                        ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Support 02-987-6543"
                        : "(04551) 서울특별시 중구 세종대로 110 | 전략 수립 지원실: 02-987-6543"}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  {en
                    ? "Simulation results are for planning use only and should be finalized through the verification workflow."
                    : "본 시뮬레이션 결과는 전략 검토용이며 최종 판단 수립은 검증 절차 완료 후 가능합니다."}
                </p>
              </div>
              <div className="flex flex-col items-start gap-4 lg:items-end">
                <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-500">
                  <a href="#">{en ? "Data retention policy" : "데이터 보관 지침"}</a>
                  <a href="#">{en ? "System guide" : "시스템 가이드라인"}</a>
                  <a href="#">{en ? "No unauthorized analysis" : "분석 변환물 금지"}</a>
                </nav>
                <img alt={content.waAlt} className="h-10 w-auto" src={WA_MARK} />
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
