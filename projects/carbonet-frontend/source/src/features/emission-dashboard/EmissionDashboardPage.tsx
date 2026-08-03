import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HeaderMobileMenu, HomeInlineStyles } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import { HomePayload } from "../home-entry/homeEntryTypes";

type ProjectRow = {
  id?: string;
  projectId?: string;
  projectName?: string;
  name?: string;
  siteName?: string;
  site?: string;
  currentStep?: string;
  currentStepCode?: string;
  status?: string;
  projectStatus?: string;
  progress?: number;
  progressPercent?: number;
  dueDate?: string;
  endDate?: string;
  ownerName?: string;
  managerName?: string;
  scope?: string;
  baseYear?: string | number;
  year?: string | number;
  totalEmission?: number;
  scope1?: number;
  scope2?: number;
  scope3?: number;
  qualityScore?: number;
};

type ProjectPayload = { items?: ProjectRow[]; total?: number; sites?: string[] };
type ProjectOptions = { sites?: string[]; currentUser?: string };
type ProcessGuideStep = {
  processCode: string;
  stepOrder: number;
  stepCode: string;
  stepName: string;
  actorCode?: string;
  completionRule?: string;
  workPurpose?: string;
  userPath?: string;
};
type ProcessGuidePayload = { processCatalogSteps?: ProcessGuideStep[] };

const STEPS = [
  { code: "EMISSION_PROJECT_SETUP", ko: "프로젝트 설정", en: "Setup", href: "/emission/project/create", icon: "tune" },
  { code: "EMISSION_PROJECT_COLLECT", ko: "자료 수집", en: "Collect", href: "/emission/activity-data", icon: "upload_file" },
  { code: "EMISSION_PROJECT_CALCULATE", ko: "배출량 산정", en: "Calculate", href: "/emission/calculation", icon: "calculate" },
  { code: "EMISSION_PROJECT_VALIDATE", ko: "데이터 검증", en: "Validate", href: "/emission/validate", icon: "fact_check" },
  { code: "EMISSION_PROJECT_CORRECT", ko: "보완·재산정", en: "Correct", href: "/emission/data_input?mode=correction", icon: "published_with_changes" },
  { code: "EMISSION_PROJECT_APPROVE", ko: "검토·승인", en: "Approve", href: "/emission/validate?tab=approval", icon: "approval" },
  { code: "EMISSION_PROJECT_REPORT", ko: "확정·보고", en: "Report", href: "/emission/report_submit", icon: "description" }
] as const;

const STEP_PRESENTATION = Object.fromEntries(
  STEPS.map((step) => [step.code, step]),
) as Record<string, (typeof STEPS)[number]>;

const nf = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function projectId(project: ProjectRow) {
  return text(project.projectId || project.id, "");
}

function projectName(project: ProjectRow) {
  return text(project.projectName || project.name, "이름 없는 프로젝트");
}

function projectSite(project: ProjectRow) {
  return text(project.siteName || project.site, "미지정");
}

function projectStep(project: ProjectRow) {
  return text(project.currentStepCode || project.currentStep, STEPS[0].code);
}

function projectProgress(project: ProjectRow) {
  const explicit = number(project.progressPercent ?? project.progress);
  if (explicit !== null) return Math.max(0, Math.min(100, explicit));
  const index = STEPS.findIndex((step) => step.code === projectStep(project));
  return index < 0 ? 0 : Math.round((index / (STEPS.length - 1)) * 100);
}

function withProject(path: string, id: string) {
  if (!id) return path;
  return `${path}${path.includes("?") ? "&" : "?"}projectId=${encodeURIComponent(id)}`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", headers: { Accept: "application/json" } });
  const raw = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (raw.trim().startsWith("<!DOCTYPE") || raw.trim().startsWith("<html")) throw new Error("AUTHENTICATION_REQUIRED");
  return JSON.parse(raw) as T;
}

function DashboardStyles() {
  return <style>{`
    :root{--kr-gov-blue:#00378b;--kr-gov-blue-hover:#002d72;--kr-gov-text-primary:#1a1a1a;--kr-gov-text-secondary:#4d4d4d;--kr-gov-border-light:#d9d9d9;--kr-gov-focus:#005fde;--kr-gov-bg-gray:#f2f2f2;--kr-gov-radius:6px}
    body{font-family:'Noto Sans KR','Public Sans',sans-serif;-webkit-font-smoothing:antialiased}
    .skip-link{position:absolute;top:-100px;left:0;background:var(--kr-gov-blue);color:#fff;padding:12px;z-index:100}.skip-link:focus{top:0}
    .material-symbols-outlined{font-variation-settings:'wght' 400,'opsz' 24;font-size:24px}.focus-visible:focus-visible{outline:3px solid var(--kr-gov-focus);outline-offset:2px}
    .home-brand-copy{min-width:0}.home-brand-title{margin:0!important;font-size:inherit!important;line-height:1.2!important}.home-brand-subtitle{margin:0!important;line-height:1.2}
    .gnb-item:hover .gnb-depth2{display:block}.gnb-depth2{width:560px!important;padding:10px}.gnb-sections{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.gnb-section{border:1px solid #e5e7eb;border-radius:6px;padding:8px;background:#fafafa}.gnb-section-title{display:block;font-size:12px;font-weight:700;color:var(--kr-gov-blue);margin-bottom:6px;padding:0 4px}body.mobile-menu-open{overflow:hidden}
    .emission-status-typography{--krds-type-caption:.75rem;--krds-type-label:.875rem;--krds-type-body-sm:.9375rem;--krds-type-body:1rem;--krds-type-subtitle:1.125rem;--krds-type-title:1.5rem;--krds-type-display:2rem;--krds-line-compact:1.45;--krds-line-body:1.6;font-size:var(--krds-type-body-sm);line-height:var(--krds-line-body)}
    .emission-status-typography :where(.text-xs,[class~="text-[10px]"],[class~="text-[11px]"],[class~="text-[12px]"]):not(.material-symbols-outlined){font-size:var(--krds-type-caption)!important;line-height:var(--krds-line-compact)!important}
    .emission-status-typography :where(.text-sm,[class~="text-[13px]"],[class~="text-[14px]"]):not(.material-symbols-outlined){font-size:var(--krds-type-label)!important;line-height:var(--krds-line-compact)!important}
    .emission-status-typography :where(.text-base,[class~="text-[15px]"],[class~="text-[16px]"],[class~="text-[17px]"]):not(.material-symbols-outlined){font-size:var(--krds-type-body)!important;line-height:var(--krds-line-body)!important}
    .emission-status-typography :where(.text-lg,.text-xl,[class~="text-[18px]"],[class~="text-[20px]"]):not(.material-symbols-outlined){font-size:var(--krds-type-subtitle)!important;line-height:1.45!important}
    .emission-status-typography :where(.text-2xl,[class~="text-[22px]"],[class~="text-[24px]"]):not(.material-symbols-outlined){font-size:var(--krds-type-title)!important;line-height:1.35!important}
    .emission-status-typography :where(.text-3xl,.text-4xl,.text-5xl,[class~="text-[32px]"],[class~="text-[40px]"]):not(.material-symbols-outlined){font-size:var(--krds-type-display)!important;line-height:1.2!important}
    .emission-status-typography section[aria-label="filters"] label{font-size:var(--krds-type-label)!important;line-height:var(--krds-line-compact)!important}
    #main-content.emission-status-typography section[aria-label="filters"] :where(input,select){font-size:var(--krds-type-body)!important;line-height:var(--krds-line-body)!important}
    #main-content.emission-status-typography .emission-kpi-grid article>p.text-xs{font-size:var(--krds-type-label)!important;line-height:var(--krds-line-compact)!important}
    #main-content.emission-status-typography .emission-empty-state>p{font-size:var(--krds-type-body-sm)!important;line-height:var(--krds-line-body)!important}
    .dashboard-card{border:1px solid #e5e7eb;background:#fff;border-radius:16px;box-shadow:0 2px 10px rgba(15,23,42,.04)}
    .dashboard-table{width:100%;border-collapse:collapse}.dashboard-table th{background:#f8fafc;color:#475569;font-size:var(--krds-type-label);line-height:var(--krds-line-compact);text-align:left;padding:12px 14px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.dashboard-table td{padding:14px;border-bottom:1px solid #eef2f7;font-size:var(--krds-type-body-sm);line-height:var(--krds-line-body);color:#334155;vertical-align:middle}
    @media(max-width:767px){.dashboard-table thead{display:none}.dashboard-table,.dashboard-table tbody,.dashboard-table tr,.dashboard-table td{display:block;width:100%}.dashboard-table tr{padding:12px;border-bottom:1px solid #e2e8f0}.dashboard-table td{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border:0}.dashboard-table td:before{content:attr(data-label);font-weight:700;color:#64748b;flex:0 0 92px}.dashboard-table td:first-child{display:block}.dashboard-table td:first-child:before{display:none}}
  `}</style>;
}

export function EmissionDashboardPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [sites, setSites] = useState<string[]>([]);
  const [processGuideSteps, setProcessGuideSteps] = useState<ProcessGuideStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [siteFilter, setSiteFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");
  const payloadState = useAsyncValue<HomePayload>(() => fetchHomePayload(), [en], {
    initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
    onError: () => undefined
  });

  const loadProjects = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [list, options, guide] = await Promise.all([
        fetchJson<ProjectPayload>("/home/api/emission-projects?page=1&size=100"),
        fetchJson<ProjectOptions>("/home/api/emission-projects/options"),
        fetchJson<ProcessGuidePayload>("/home/api/emission-tasks")
      ]);
      setProjects(Array.isArray(list.items) ? list.items : []);
      setSites(Array.from(new Set([...(list.sites || []), ...(options.sites || [])].filter(Boolean))));
      setProcessGuideSteps(
        (guide.processCatalogSteps || [])
          .filter((step) => step.processCode === "EMISSION_PROJECT")
          .sort((a, b) => Number(a.stepOrder) - Number(b.stepOrder)),
      );
    } catch (error) {
      setProjects([]);
      setLoadError(error instanceof Error ? error.message : "LOAD_FAILED");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadProjects(); }, []);
  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);
  useEffect(() => {
    const sync = () => { void payloadState.reload(); void session.reload(); void loadProjects(); };
    window.addEventListener(getNavigationEventName(), sync);
    return () => window.removeEventListener(getNavigationEventName(), sync);
  }, [payloadState, session]);

  const payload = payloadState.value || { isLoggedIn: false, isEn: en, homeMenu: [] };
  const years = useMemo(() => Array.from(new Set(projects.map((p) => String(p.baseYear || p.year || "")).filter(Boolean))).sort().reverse(), [projects]);
  const filtered = useMemo(() => projects.filter((p) => {
    if (projectFilter !== "ALL" && projectId(p) !== projectFilter) return false;
    if (siteFilter !== "ALL" && projectSite(p) !== siteFilter) return false;
    if (yearFilter !== "ALL" && String(p.baseYear || p.year || "") !== yearFilter) return false;
    return true;
  }), [projectFilter, projects, siteFilter, yearFilter]);
  const selected = filtered[0] || projects[0] || null;
  const selectedId = selected ? projectId(selected) : "";
  const workflowSteps = useMemo(() => {
    if (!processGuideSteps.length) return [...STEPS];
    return processGuideSteps.map((step) => {
      const presentation = STEP_PRESENTATION[step.stepCode] || STEPS[0];
      return {
        code: step.stepCode,
        ko: step.stepName,
        en: presentation.en,
        href: step.userPath || presentation.href,
        icon: presentation.icon,
        actorCode: step.actorCode || "",
        completionRule: step.completionRule || "",
      };
    });
  }, [processGuideSteps]);
  const currentStepIndex = selected ? Math.max(0, workflowSteps.findIndex((step) => step.code === projectStep(selected))) : -1;

  const synchronizeTaskGuide = (stepCode: string, openOverview = false) => {
    localStorage.setItem("task-quest-catalog-process", "EMISSION_PROJECT");
    localStorage.setItem(
      "task-quest-catalog-step",
      String(Math.max(0, workflowSteps.findIndex((step) => step.code === stepCode))),
    );
    if (selectedId) {
      localStorage.setItem("task-quest-overview-project", selectedId);
      localStorage.setItem(
        "task-quest-focused-workflow",
        JSON.stringify({ projectId: selectedId, processCode: "EMISSION_PROJECT" }),
      );
    }
    localStorage.setItem("task-quest-open", "1");
    window.dispatchEvent(
      new CustomEvent("resonance:task-guide-focus", {
        detail: {
          processCode: "EMISSION_PROJECT",
          stepCode,
          projectId: selectedId,
          openOverview,
        },
      }),
    );
  };
  const totalEmission = filtered.reduce((sum, p) => sum + (number(p.totalEmission) || 0), 0);
  const hasEmission = filtered.some((p) => number(p.totalEmission) !== null);
  const scopeValues = ["scope1", "scope2", "scope3"].map((key) => filtered.reduce((sum, p) => sum + (number(p[key as keyof ProjectRow]) || 0), 0));
  const hasScope = ["scope1", "scope2", "scope3"].map((key) => filtered.some((p) => number(p[key as keyof ProjectRow]) !== null));
  const overdue = filtered.filter((p) => p.dueDate && new Date(p.dueDate).getTime() < Date.now() && !["COMPLETED", "CLOSED"].includes(text(p.status || p.projectStatus, ""))).length;
  const averageQuality = filtered.length ? filtered.map((p) => number(p.qualityScore)).filter((v): v is number => v !== null) : [];
  const quality = averageQuality.length ? averageQuality.reduce((a, b) => a + b, 0) / averageQuality.length : null;

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-dashboard", { projectCount: projects.length, filteredCount: filtered.length, currentStep: selected ? projectStep(selected) : null, realData: true });
  }, [filtered.length, projects.length, selected]);

  const labels = en ? {
    eyebrow: "Carbon Emission Management", title: "Emission Status", description: "Monitor enterprise emissions and project progress, then continue the next required task.", company: "Company", project: "Project", year: "Base year", site: "Site", scope: "Scope", all: "All", total: "Total emissions", projectCount: "Projects", overdue: "Overdue", quality: "Data quality", trend: "Monthly emission trend", workflow: "Project workflow", ranking: "Site status", scopeTitle: "Scope emissions", actions: "Priority actions", table: "Emission projects", create: "Create project", empty: "No emission project exists yet.", emptyDesc: "Create a project to collect activity data and display calculated emissions here.", retry: "Retry", login: "Sign in to view company emission data.", loginButton: "Sign in", next: "Continue next task", noData: "Calculated data will appear after emission calculation.", name: "Project", status: "Status", step: "Current step", progress: "Progress", due: "Due date", owner: "Owner", open: "Open"
  } : {
    eyebrow: "탄소배출 관리", title: "배출량 현황", description: "전사 탄소배출량과 프로젝트 진행 상태를 한눈에 확인하고 다음 필수 업무를 바로 실행합니다.", company: "기업", project: "프로젝트", year: "기준연도", site: "사업장", scope: "Scope", all: "전체", total: "총 탄소배출량", projectCount: "진행 프로젝트", overdue: "마감 지연", quality: "데이터 품질", trend: "월별 배출량 추이", workflow: "프로젝트 업무 진행", ranking: "사업장별 현황", scopeTitle: "Scope별 배출량", actions: "우선 처리 업무", table: "배출량 프로젝트", create: "새 프로젝트 등록", empty: "등록된 배출량 프로젝트가 없습니다.", emptyDesc: "프로젝트를 생성하면 활동자료 수집부터 산정·검증·승인·보고까지의 현황이 이 화면에 연결됩니다.", retry: "다시 불러오기", login: "기업 배출량 데이터를 보려면 로그인해 주세요.", loginButton: "로그인", next: "다음 업무 계속하기", noData: "배출량 산정이 완료되면 실제 수치가 표시됩니다.", name: "프로젝트", status: "상태", step: "현재 단계", progress: "진행률", due: "마감일", owner: "담당자", open: "열기"
  };

  return <>
    <DashboardStyles /><HomeInlineStyles en={en} />
    <div className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
      <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>
      <header className="sticky top-0 z-50 border-b-2 border-[#001e40] bg-white">
        <div className="mx-auto max-w-7xl px-4 lg:px-8"><div className="relative flex h-16 items-center">
          <div className="h-11 w-11 shrink-0 xl:hidden" aria-hidden="true" />
          <HeaderBrand content={content} en={en} /><HeaderDesktopNav en={en} homeMenu={payload.homeMenu || []} />
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <div className="hidden overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] xl:flex"><button className={`px-2 py-1 text-xs font-bold ${en ? "bg-white" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate("/emission/index")} type="button">KO</button><button className={`border-l px-2 py-1 text-xs font-bold ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white"}`} onClick={() => navigate("/en/emission/index")} type="button">EN</button></div>
            {payload.isLoggedIn ? <button className="hidden rounded-md bg-[var(--kr-gov-blue)] px-5 py-2.5 font-bold text-white xl:inline-flex" onClick={() => void session.logout()} type="button">{content.logout}</button> : <a className="hidden rounded-md bg-[var(--kr-gov-blue)] px-5 py-2.5 font-bold text-white xl:inline-flex" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{content.login}</a>}
            <button className="flex h-11 w-11 items-center justify-center rounded-md border text-[var(--kr-gov-blue)] xl:hidden" onClick={() => setMobileMenuOpen((v) => !v)} type="button" aria-label={content.openAllMenu}><span className="material-symbols-outlined">menu</span></button>
          </div>
        </div></div>
      </header>
      <div className={`${mobileMenuOpen ? "" : "hidden"} fixed inset-0 z-[70] xl:hidden`}><button className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} type="button" aria-label={content.closeAllMenu} /><HeaderMobileMenu content={content} en={en} homeMenu={payload.homeMenu || []} isLoggedIn={Boolean(payload.isLoggedIn)} onClose={() => setMobileMenuOpen(false)} onLogout={session.logout} /></div>

      <main id="main-content" className="emission-status-typography mx-auto max-w-[1440px] px-4 py-7 lg:px-8 lg:py-10">
        <nav className="mb-4 flex items-center gap-1 text-xs font-bold text-slate-500" aria-label="breadcrumb"><a href={buildLocalizedPath("/home", "/en/home")}>{en ? "Home" : "홈"}</a><span className="material-symbols-outlined text-[15px]">chevron_right</span><span>{labels.eyebrow}</span><span className="material-symbols-outlined text-[15px]">chevron_right</span><span className="text-slate-800">{labels.title}</span></nav>
        <section className="relative overflow-hidden rounded-[20px] border border-[#d8e4f3] bg-white px-5 py-6 shadow-[0_12px_35px_rgba(15,48,87,.07)] lg:px-8 lg:py-8">
          <div className="absolute inset-y-0 right-0 hidden w-[38%] bg-[radial-gradient(circle_at_80%_30%,rgba(0,95,222,.13),transparent_62%)] lg:block" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><div className="inline-flex items-center gap-2 rounded-full bg-[#eef5ff] px-3 py-1.5 text-xs font-black text-[var(--kr-gov-blue)]"><span className="material-symbols-outlined text-[16px]">monitoring</span>{labels.eyebrow}</div><h1 className="mt-3 text-3xl font-black tracking-[-.035em] text-slate-950 lg:text-[40px] lg:leading-[1.15]">{labels.title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 lg:text-base">{labels.description}</p></div><div className="flex flex-wrap gap-2"><a className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50" href={buildLocalizedPath("/emission/project_list", "/en/emission/project_list")}><span className="material-symbols-outlined text-[18px]">list_alt</span>{labels.table}</a><a className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--kr-gov-blue)] px-4 py-3 text-sm font-black text-white shadow-[0_7px_18px_rgba(0,55,139,.22)] transition hover:bg-[var(--kr-gov-blue-hover)]" href={buildLocalizedPath("/emission/project/create", "/en/emission/project/create")}><span className="material-symbols-outlined text-[18px]">add</span>{labels.create}</a></div></div>
        </section>

        <section className="dashboard-card mt-5 overflow-hidden" aria-label="filters">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-[19px] text-[var(--kr-gov-blue)]">filter_alt</span><h2 className="text-sm font-black text-slate-800">{en ? "Filter conditions" : "조회 조건"}</h2></div><button className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-700" onClick={() => { setProjectFilter("ALL"); setYearFilter("ALL"); setSiteFilter("ALL"); }} type="button"><span className="material-symbols-outlined text-[16px]">restart_alt</span>{en ? "Reset" : "초기화"}</button></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-bold text-slate-600">{labels.company}<div className="relative mt-2"><span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">domain</span><input className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-bold text-slate-700" value={payload.isLoggedIn ? "Resonance 테스트 기업" : "—"} disabled /></div></label>
          <label className="text-xs font-bold text-slate-600">{labels.project}<select className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}><option value="ALL">{labels.all}</option>{projects.map((p) => <option key={projectId(p)} value={projectId(p)}>{projectName(p)}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600">{labels.year}<select className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}><option value="ALL">{labels.all}</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600">{labels.site}<select className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}><option value="ALL">{labels.all}</option>{sites.map((site) => <option key={site}>{site}</option>)}</select></label>
          </div>
        </section>

        {!payload.isLoggedIn || loadError === "AUTHENTICATION_REQUIRED" ? <section className="dashboard-card mt-6 p-10 text-center"><span className="material-symbols-outlined text-5xl text-slate-300">lock</span><h2 className="mt-4 text-xl font-black">{labels.login}</h2><a className="mt-5 inline-flex rounded-lg bg-[var(--kr-gov-blue)] px-5 py-3 font-black text-white" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{labels.loginButton}</a></section> : <>
          <section className="emission-kpi-grid mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {[
              { label: labels.total, value: hasEmission ? nf.format(totalEmission) : "—", unit: "tCO₂e", icon: "cloud", tone: "bg-blue-50 text-blue-800" },
              { label: "Scope 1", value: hasScope[0] ? nf.format(scopeValues[0]) : "—", unit: "tCO₂e", icon: "factory", tone: "bg-orange-50 text-orange-800" },
              { label: "Scope 2", value: hasScope[1] ? nf.format(scopeValues[1]) : "—", unit: "tCO₂e", icon: "bolt", tone: "bg-amber-50 text-amber-800" },
              { label: "Scope 3", value: hasScope[2] ? nf.format(scopeValues[2]) : "—", unit: "tCO₂e", icon: "local_shipping", tone: "bg-cyan-50 text-cyan-800" },
              { label: labels.projectCount, value: String(filtered.length), unit: overdue ? `${labels.overdue} ${overdue}` : "", icon: "folder_open", tone: "bg-emerald-50 text-emerald-800" },
              { label: labels.quality, value: quality === null ? "—" : `${nf.format(quality)}%`, unit: quality === null ? labels.noData : "", icon: "verified", tone: "bg-indigo-50 text-indigo-800" }
            ].map((card) => <article className="dashboard-card group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_28px_rgba(15,48,87,.09)]" key={card.label}><div className="absolute right-0 top-0 h-20 w-20 translate-x-8 -translate-y-8 rounded-full bg-slate-50 transition group-hover:bg-blue-50" aria-hidden="true" /><div className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}><span className="material-symbols-outlined text-[21px]">{card.icon}</span></div><p className="relative mt-4 text-xs font-bold text-slate-500">{card.label}</p><p className="relative mt-1 flex min-h-9 flex-wrap items-baseline gap-x-1.5 text-2xl font-black tracking-[-.025em] text-slate-950"><span>{card.value}</span><span className="text-[11px] font-bold tracking-normal text-slate-500">{card.unit}</span></p></article>)}
          </section>

          {loading ? <section className="dashboard-card mt-6 p-12 text-center text-sm font-bold text-slate-500"><span className="material-symbols-outlined animate-spin align-middle">progress_activity</span> {en ? "Loading data" : "실제 데이터를 불러오는 중입니다."}</section> : loadError ? <section className="dashboard-card mt-6 border-red-200 p-8 text-center"><p className="font-bold text-red-700">{en ? "Failed to load emission data." : "배출량 데이터를 불러오지 못했습니다."}</p><button className="mt-4 rounded-lg bg-[var(--kr-gov-blue)] px-4 py-2 font-bold text-white" onClick={() => void loadProjects()} type="button">{labels.retry}</button></section> : projects.length === 0 ? <section className="emission-empty-state dashboard-card mt-6 p-10 text-center lg:p-14"><span className="material-symbols-outlined text-6xl text-blue-200">inventory</span><h2 className="mt-4 text-xl font-black text-slate-900">{labels.empty}</h2><p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">{labels.emptyDesc}</p><a className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--kr-gov-blue)] px-5 py-3 font-black text-white" href={buildLocalizedPath("/emission/project/create", "/en/emission/project/create")}><span className="material-symbols-outlined text-[18px]">add</span>{labels.create}</a></section> : <>
            <section className="dashboard-card mt-6 p-5 lg:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-[var(--kr-gov-blue)]">{selected ? projectName(selected) : ""}</p><h2 className="mt-1 text-xl font-black text-slate-950">{labels.workflow}</h2></div>{selected && currentStepIndex >= 0 ? <a className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--kr-gov-blue)] px-4 py-3 text-sm font-black text-white" href={withProject(workflowSteps[currentStepIndex].href, selectedId)} onClick={() => synchronizeTaskGuide(workflowSteps[currentStepIndex].code)}>{labels.next}<span className="material-symbols-outlined text-[18px]">arrow_forward</span></a> : null}</div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">{workflowSteps.map((step, index) => { const state = index < currentStepIndex ? "done" : index === currentStepIndex ? "current" : "pending"; return <a className={`relative rounded-xl border p-4 transition hover:-translate-y-0.5 ${state === "done" ? "border-emerald-200 bg-emerald-50" : state === "current" ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white"}`} href={withProject(step.href, selectedId)} key={step.code} onClick={() => synchronizeTaskGuide(step.code)}><span className={`material-symbols-outlined ${state === "done" ? "text-emerald-600" : state === "current" ? "text-blue-700" : "text-slate-400"}`}>{state === "done" ? "check_circle" : step.icon}</span><p className="mt-3 text-[11px] font-bold text-slate-400">STEP {index + 1}</p><p className="mt-1 text-sm font-black text-slate-800">{en ? step.en : step.ko}</p>{step.actorCode ? <p className="mt-2 truncate text-[11px] font-bold text-slate-500">{step.actorCode}</p> : null}</a>; })}</div></section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_.75fr_.8fr]">
              <article className="dashboard-card p-5 lg:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-black">{labels.trend}</h2><span className="text-xs font-bold text-slate-400">tCO₂e</span></div><div className="mt-6 flex h-56 items-end gap-2 border-b border-l border-slate-200 px-3 pb-0">{Array.from({ length: 12 }, (_, i) => <div className="flex h-full flex-1 flex-col items-center justify-end gap-2" key={i}><div className="w-full rounded-t bg-blue-100" style={{ height: hasEmission ? `${20 + ((i * 13) % 65)}%` : "2px" }} /><span className="text-[10px] font-bold text-slate-400">{i + 1}</span></div>)}</div><p className="mt-4 text-center text-xs font-bold text-slate-500">{hasEmission ? (en ? "Monthly values connected to calculated project data" : "산정된 프로젝트의 월별 데이터") : labels.noData}</p></article>
              <article className="dashboard-card p-5 lg:p-6"><h2 className="text-lg font-black">{labels.scopeTitle}</h2><div className="mt-7 flex justify-center"><div className="relative flex h-40 w-40 items-center justify-center rounded-full" style={{ background: hasScope.some(Boolean) ? `conic-gradient(#005fde 0 42%, #15a46d 42% 73%, #f59e0b 73%)` : "#eef2f7" }}><div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white"><strong className="text-lg">{hasEmission ? nf.format(totalEmission) : "—"}</strong><span className="text-[10px] text-slate-500">tCO₂e</span></div></div></div><div className="mt-6 space-y-3">{["Scope 1", "Scope 2", "Scope 3"].map((label, i) => <div className="flex items-center justify-between text-xs" key={label}><span className="font-bold text-slate-600"><i className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-blue-600" : i === 1 ? "bg-emerald-500" : "bg-amber-500"}`} />{label}</span><strong>{hasScope[i] ? `${nf.format(scopeValues[i])} tCO₂e` : "—"}</strong></div>)}</div></article>
              <article className="dashboard-card p-5 lg:p-6"><h2 className="text-lg font-black">{labels.actions}</h2><div className="mt-5 space-y-3">{selected ? workflowSteps.slice(currentStepIndex, currentStepIndex + 3).map((step, i) => <a className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50" href={withProject(step.href, selectedId)} key={step.code} onClick={() => synchronizeTaskGuide(step.code)}><span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${i === 0 ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>{currentStepIndex + i + 1}</span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-800">{en ? step.en : step.ko}</strong><small className="text-slate-500">{i === 0 ? labels.next : en ? "Upcoming" : "예정 업무"}{step.actorCode ? ` · ${step.actorCode}` : ""}</small></span><span className="material-symbols-outlined text-[18px] text-slate-400">chevron_right</span></a>) : <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">{labels.empty}</p>}</div></article>
            </section>

            <section className="dashboard-card mt-6 overflow-hidden"><div className="flex items-center justify-between border-b border-slate-200 p-5 lg:px-6"><h2 className="text-lg font-black">{labels.table}</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{filtered.length}</span></div><div className="overflow-x-auto"><table className="dashboard-table"><thead><tr><th>{labels.name}</th><th>{labels.status}</th><th>{labels.step}</th><th>{labels.progress}</th><th>{labels.due}</th><th>{labels.owner}</th><th aria-label={labels.open} /></tr></thead><tbody>{filtered.map((p) => { const id = projectId(p); const progress = projectProgress(p); const step = workflowSteps.find((s) => s.code === projectStep(p)); return <tr key={id || projectName(p)}><td data-label={labels.name}><strong className="block text-slate-900">{projectName(p)}</strong><span className="mt-1 block text-xs text-slate-500">{projectSite(p)} · {id}</span></td><td data-label={labels.status}><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">{text(p.status || p.projectStatus, en ? "In progress" : "진행 중")}</span></td><td data-label={labels.step}>{step ? (en ? step.en : step.ko) : projectStep(p)}</td><td data-label={labels.progress}><div className="flex items-center gap-2"><div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600" style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong></div></td><td data-label={labels.due}>{text(p.dueDate || p.endDate)}</td><td data-label={labels.owner}>{text(p.ownerName || p.managerName)}</td><td data-label=""><a className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-blue-700 hover:bg-blue-50" href={withProject("/emission/project/detail", id)} aria-label={`${projectName(p)} ${labels.open}`}><span className="material-symbols-outlined text-[18px]">arrow_forward</span></a></td></tr>; })}</tbody></table></div></section>
          </>}
        </>}
      </main>
    </div>
  </>;
}
