import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import {
  HeaderBrand,
  HeaderDesktopNav,
  HeaderMobileMenu
} from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import { HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";

type EmissionHubSection = {
  title: string;
  subtitle: string;
  href: string;
  icon: string;
  metric: string;
  metricLabel: string;
  status: string;
  statusClass: string;
  progress: number;
  primaryAction: string;
  features: string[];
  adminHref?: string;
  adminLabel?: string;
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

function EmissionDashboardInlineStyles() {
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

export function EmissionDashboardPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const sections = useMemo<EmissionHubSection[]>(() => en ? [
    {
      title: "Emission Dashboard",
      subtitle: "Monthly work status, overdue tasks, and next action.",
      href: buildLocalizedPath("/emission/project_list", "/en/emission/project_list"),
      icon: "dashboard",
      metric: "91.4%",
      metricLabel: "data ready",
      status: "5 actions",
      statusClass: "bg-orange-50 text-orange-700 border-orange-200",
      progress: 91,
      primaryAction: "Continue work",
      features: ["Priority queue", "Site status", "Due tasks", "Report readiness"],
      adminHref: buildLocalizedPath("/admin/emission/site-management", "/en/admin/emission/site-management"),
      adminLabel: "Site admin"
    },
    {
      title: "Activity Data Input",
      subtitle: "Fuel, electricity, steam, process, transport, and evidence input.",
      href: buildLocalizedPath("/emission/data_input", "/en/emission/data_input"),
      icon: "edit_square",
      metric: "5",
      metricLabel: "sites need input",
      status: "Input",
      statusClass: "bg-blue-50 text-blue-700 border-blue-200",
      progress: 76,
      primaryAction: "Enter data",
      features: ["Monthly data", "Evidence upload", "Validation checklist", "Draft save"],
      adminHref: buildLocalizedPath("/admin/emission/data_history", "/en/admin/emission/data_history"),
      adminLabel: "Change history"
    },
    {
      title: "Calculation Simulation",
      subtitle: "Apply factors and GWP, then check variance before reporting.",
      href: buildLocalizedPath("/emission/simulate", "/en/emission/simulate"),
      icon: "calculate",
      metric: "88%",
      metricLabel: "calculation ready",
      status: "Ready",
      statusClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      progress: 88,
      primaryAction: "Run calculation",
      features: ["Factor mapping", "GWP conversion", "Variance check", "Site aggregation"],
      adminHref: buildLocalizedPath("/admin/emission/management", "/en/admin/emission/management"),
      adminLabel: "Criteria admin"
    },
    {
      title: "Emission Verification",
      subtitle: "Review calculated results and respond to verifier requests.",
      href: buildLocalizedPath("/emission/validate", "/en/emission/validate"),
      icon: "fact_check",
      metric: "7",
      metricLabel: "verification queue",
      status: "Review",
      statusClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
      progress: 64,
      primaryAction: "Open verification",
      features: ["Verifier queue", "Supplement request", "Evidence review", "Approval status"],
      adminHref: buildLocalizedPath("/admin/emission/validate", "/en/admin/emission/validate"),
      adminLabel: "Verifier admin"
    },
    {
      title: "Report Submission",
      subtitle: "Prepare submission packages, PDF reports, and evidence bundles.",
      href: buildLocalizedPath("/emission/report_submit", "/en/emission/report_submit"),
      icon: "description",
      metric: "4",
      metricLabel: "reports ready",
      status: "Submit",
      statusClass: "bg-sky-50 text-sky-700 border-sky-200",
      progress: 72,
      primaryAction: "Prepare report",
      features: ["Report package", "PDF download", "Evidence bundle", "Submission status"],
      adminHref: buildLocalizedPath("/admin/emission/result_list", "/en/admin/emission/result_list"),
      adminLabel: "Result admin"
    },
    {
      title: "LCA Analysis",
      subtitle: "Analyze product and process impact by lifecycle stage.",
      href: buildLocalizedPath("/emission/lca", "/en/emission/lca"),
      icon: "analytics",
      metric: "12",
      metricLabel: "products tracked",
      status: "Analyze",
      statusClass: "bg-purple-50 text-purple-700 border-purple-200",
      progress: 58,
      primaryAction: "Open LCA",
      features: ["Product footprint", "Lifecycle stage", "Contribution chart", "Sensitivity view"],
      adminHref: buildLocalizedPath("/admin/emission/lci-classification", "/en/admin/emission/lci-classification"),
      adminLabel: "LCI admin"
    },
    {
      title: "Reduction Scenario",
      subtitle: "Compare reduction options, cost, payback, and expected effect.",
      href: buildLocalizedPath("/emission/reduction", "/en/emission/reduction"),
      icon: "trending_down",
      metric: "3",
      metricLabel: "active options",
      status: "Plan",
      statusClass: "bg-teal-50 text-teal-700 border-teal-200",
      progress: 42,
      primaryAction: "Plan reduction",
      features: ["Scenario portfolio", "Cost effect", "Payback", "Target gap"],
      adminHref: buildLocalizedPath("/admin/emission/gwp-values", "/en/admin/emission/gwp-values"),
      adminLabel: "GWP admin"
    },
    {
      title: "LCI DB & Factors",
      subtitle: "Search LCI datasets, emission factors, and source definitions.",
      href: buildLocalizedPath("/emission/lci", "/en/emission/lci"),
      icon: "inventory_2",
      metric: "328",
      metricLabel: "factor records",
      status: "Reference",
      statusClass: "bg-slate-50 text-slate-700 border-slate-200",
      progress: 100,
      primaryAction: "Search DB",
      features: ["LCI search", "Factor lookup", "Source definition", "ecoinvent reference"],
      adminHref: buildLocalizedPath("/admin/emission/ecoinvent", "/en/admin/emission/ecoinvent"),
      adminLabel: "Factor admin"
    }
  ] : [
    {
      title: "배출 대시보드",
      subtitle: "이번 달 업무 상태, 지연 업무, 다음 작업을 확인합니다.",
      href: buildLocalizedPath("/emission/project_list", "/en/emission/project_list"),
      icon: "dashboard",
      metric: "91.4%",
      metricLabel: "자료 준비",
      status: "5건 처리",
      statusClass: "bg-orange-50 text-orange-700 border-orange-200",
      progress: 91,
      primaryAction: "업무 계속하기",
      features: ["우선순위 업무", "배출지 상태", "마감 업무", "보고서 준비도"],
      adminHref: buildLocalizedPath("/admin/emission/site-management", "/en/admin/emission/site-management"),
      adminLabel: "배출지 관리"
    },
    {
      title: "활동자료 입력",
      subtitle: "연료, 전력, 스팀, 공정, 운송, 증빙 자료를 입력합니다.",
      href: buildLocalizedPath("/emission/data_input", "/en/emission/data_input"),
      icon: "edit_square",
      metric: "5",
      metricLabel: "입력 필요",
      status: "입력",
      statusClass: "bg-blue-50 text-blue-700 border-blue-200",
      progress: 76,
      primaryAction: "자료 입력",
      features: ["월별 자료", "증빙 업로드", "검증 체크", "임시 저장"],
      adminHref: buildLocalizedPath("/admin/emission/data_history", "/en/admin/emission/data_history"),
      adminLabel: "변경 이력"
    },
    {
      title: "배출량 산정",
      subtitle: "배출계수와 GWP를 적용하고 보고 전 편차를 확인합니다.",
      href: buildLocalizedPath("/emission/simulate", "/en/emission/simulate"),
      icon: "calculate",
      metric: "88%",
      metricLabel: "산정 준비",
      status: "실행 가능",
      statusClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      progress: 88,
      primaryAction: "산정 실행",
      features: ["계수 매핑", "GWP 변환", "편차 검사", "배출지 집계"],
      adminHref: buildLocalizedPath("/admin/emission/management", "/en/admin/emission/management"),
      adminLabel: "산정 기준"
    },
    {
      title: "산정 검증",
      subtitle: "산정 결과를 검토하고 검증자 보완 요청에 대응합니다.",
      href: buildLocalizedPath("/emission/validate", "/en/emission/validate"),
      icon: "fact_check",
      metric: "7",
      metricLabel: "검증 대기",
      status: "검토",
      statusClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
      progress: 64,
      primaryAction: "검증 열기",
      features: ["검증 큐", "보완 요청", "증빙 검토", "승인 상태"],
      adminHref: buildLocalizedPath("/admin/emission/validate", "/en/admin/emission/validate"),
      adminLabel: "검증 관리"
    },
    {
      title: "보고서 작성",
      subtitle: "제출 패키지, PDF 보고서, 증빙 묶음을 준비합니다.",
      href: buildLocalizedPath("/emission/report_submit", "/en/emission/report_submit"),
      icon: "description",
      metric: "4",
      metricLabel: "제출 가능",
      status: "제출",
      statusClass: "bg-sky-50 text-sky-700 border-sky-200",
      progress: 72,
      primaryAction: "보고서 작성",
      features: ["보고서 패키지", "PDF 다운로드", "증빙 묶음", "제출 상태"],
      adminHref: buildLocalizedPath("/admin/emission/result_list", "/en/admin/emission/result_list"),
      adminLabel: "결과 관리"
    },
    {
      title: "LCA 분석",
      subtitle: "제품과 공정의 생애주기 단계별 영향을 분석합니다.",
      href: buildLocalizedPath("/emission/lca", "/en/emission/lca"),
      icon: "analytics",
      metric: "12",
      metricLabel: "제품 추적",
      status: "분석",
      statusClass: "bg-purple-50 text-purple-700 border-purple-200",
      progress: 58,
      primaryAction: "LCA 보기",
      features: ["제품 탄소발자국", "생애주기 단계", "기여도 차트", "민감도"],
      adminHref: buildLocalizedPath("/admin/emission/lci-classification", "/en/admin/emission/lci-classification"),
      adminLabel: "LCI 관리"
    },
    {
      title: "감축 시나리오",
      subtitle: "감축 옵션, 비용, 회수기간, 예상 효과를 비교합니다.",
      href: buildLocalizedPath("/emission/reduction", "/en/emission/reduction"),
      icon: "trending_down",
      metric: "3",
      metricLabel: "실행 옵션",
      status: "계획",
      statusClass: "bg-teal-50 text-teal-700 border-teal-200",
      progress: 42,
      primaryAction: "감축 계획",
      features: ["시나리오 묶음", "비용 효과", "회수기간", "목표 차이"],
      adminHref: buildLocalizedPath("/admin/emission/gwp-values", "/en/admin/emission/gwp-values"),
      adminLabel: "GWP 관리"
    },
    {
      title: "LCI DB 조회",
      subtitle: "LCI 데이터셋, 배출계수, 배출원 정의를 조회합니다.",
      href: buildLocalizedPath("/emission/lci", "/en/emission/lci"),
      icon: "inventory_2",
      metric: "328",
      metricLabel: "계수 레코드",
      status: "참조",
      statusClass: "bg-slate-50 text-slate-700 border-slate-200",
      progress: 100,
      primaryAction: "DB 조회",
      features: ["LCI 검색", "계수 조회", "배출원 정의", "ecoinvent 참조"],
      adminHref: buildLocalizedPath("/admin/emission/ecoinvent", "/en/admin/emission/ecoinvent"),
      adminLabel: "계수 관리"
    }
  ], [en]);

  const overallProgress = useMemo(() => {
    const total = sections.reduce((sum, section) => sum + section.progress, 0);
    return Math.round(total / sections.length);
  }, [sections]);

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-dashboard", {
      language: en ? "en" : "ko",
      mobileMenuOpen,
      menuCount: homeMenu.length,
      isLoggedIn: Boolean(payload.isLoggedIn),
      sectionCount: sections.length,
      overallProgress
    });
  }, [en, homeMenu.length, mobileMenuOpen, overallProgress, payload.isLoggedIn, sections.length]);

  return (
    <>
      <EmissionDashboardInlineStyles />
      <div className="bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>

        <div className="bg-[var(--kr-gov-bg-gray)] border-b border-[var(--kr-gov-border-light)]">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={en ? "Government symbol" : "대한민국 정부 상징"} className="h-4" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
              <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">
                {en ? "Official Government Service | Carbon Emission Portal" : "대한민국 정부 공식 서비스 | 탄소 배출 포털"}
              </span>
            </div>
            <p className="hidden md:block text-xs font-medium text-[var(--kr-gov-text-secondary)]">
              {en ? "Last update: just now" : "마지막 업데이트: 방금 전"}
            </p>
          </div>
        </div>

        <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 lg:px-8">
            <div className="relative flex items-center h-24">
              <div className="xl:hidden w-11 h-11 shrink-0" aria-hidden="true" />
              <HeaderBrand content={content} en={en} />
              <HeaderDesktopNav en={en} homeMenu={homeMenu} />
              <div className={`ml-auto flex items-center ${en ? "gap-2" : "gap-3"} shrink-0`}>
                <div className="hidden xl:flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible ${en ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate("/emission/index")}>KO</button>
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible border-l border-[var(--kr-gov-border-light)] ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} onClick={() => navigate("/en/emission/index")}>EN</button>
                </div>
                {payload.isLoggedIn ? (
                  <button type="button" className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)]" onClick={() => void session.logout()}>{content.logout}</button>
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

        <main id="main-content">
          <section className="border-b border-slate-200 bg-white">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--kr-gov-blue)]">{en ? "Carbon Emission" : "탄소 배출"}</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">{en ? "Emission Work Dashboard" : "탄소 배출 업무 대시보드"}</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                    {en
                      ? "Monitor eight emission work areas at a glance and jump directly to the screen that needs action."
                      : "탄소/배출 관련 8개 화면의 상태를 한눈에 확인하고, 필요한 업무 화면으로 바로 이동합니다."}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:min-w-[420px]">
                  <div className="rounded-xl border border-gray-100 bg-slate-50 p-4">
                    <p className="text-xs font-bold text-gray-500">{en ? "Overall" : "전체 진행"}</p>
                    <p className="mt-1 text-2xl font-black text-gray-900">{overallProgress}%</p>
                  </div>
                  <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                    <p className="text-xs font-bold text-orange-700">{en ? "Needs Action" : "처리 필요"}</p>
                    <p className="mt-1 text-2xl font-black text-orange-700">5</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-xs font-bold text-emerald-700">{en ? "Ready" : "준비 완료"}</p>
                    <p className="mt-1 text-2xl font-black text-emerald-700">4</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <a className="inline-flex items-center gap-2 rounded-lg bg-[var(--kr-gov-blue)] px-5 py-3 text-sm font-black text-white hover:bg-[var(--kr-gov-blue-hover)]" href={buildLocalizedPath("/emission/project_list", "/en/emission/project_list")}>
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  {en ? "Continue next task" : "다음 작업 계속하기"}
                </a>
                <a className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-black text-gray-700 hover:bg-gray-50" href={buildLocalizedPath("/emission/data_input", "/en/emission/data_input")}>
                  <span className="material-symbols-outlined text-[18px]">edit_square</span>
                  {en ? "Enter activity data" : "활동자료 입력"}
                </a>
                <a className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-black text-gray-700 hover:bg-gray-50" href={buildLocalizedPath("/emission/report_submit", "/en/emission/report_submit")}>
                  <span className="material-symbols-outlined text-[18px]">description</span>
                  {en ? "Prepare report" : "보고서 작성"}
                </a>
              </div>
            </div>
          </section>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8" data-help-id="emission-index-eight-section-dashboard">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {sections.map((section) => (
                <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" key={section.title}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                      <span className="material-symbols-outlined flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[var(--kr-gov-blue)]">{section.icon}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-black text-gray-900">{section.title}</h2>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${section.statusClass}`}>{section.status}</span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-gray-500">{section.subtitle}</p>
                      </div>
                    </div>
                    <div className="shrink-0 rounded-xl bg-slate-50 px-4 py-3 text-right">
                      <p className="text-2xl font-black text-gray-900">{section.metric}</p>
                      <p className="text-[11px] font-bold text-gray-500">{section.metricLabel}</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-xs font-bold text-gray-500">
                      <span>{en ? "Work readiness" : "업무 준비도"}</span>
                      <span>{section.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-[var(--kr-gov-blue)]" style={{ width: `${section.progress}%` }} />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {section.features.map((feature) => (
                      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-gray-600" key={`${section.title}-${feature}`}>
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <a className="inline-flex items-center gap-2 rounded-lg bg-[var(--kr-gov-blue)] px-4 py-2.5 text-xs font-black text-white hover:bg-[var(--kr-gov-blue-hover)]" href={section.href}>
                      {section.primaryAction}
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </a>
                    {section.adminHref ? (
                      <a className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-600 hover:bg-gray-50" href={section.adminHref}>
                        <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                        {section.adminLabel}
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
