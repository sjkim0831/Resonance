import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HeaderMobileMenu, HomeInlineStyles } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import type { HomePayload } from "../home-entry/homeEntryTypes";

type Project = {
  id: string; name: string; site: string; period: string; scope: string; owner: string;
  progress: number; step: string; due?: string; dueDate?: string; status: string;
};
type PortfolioPayload = { items: Project[]; total: number; sites: string[] };
type Task = {
  id: number; projectId: string; name: string; status: string; assignee?: string; dueDate?: string;
  targetUrl?: string; completionRule?: string; pendingPredecessors?: string; blockedReason?: string; actionable?: boolean;
};
type TaskPayload = { items: Task[]; actorId?: string; allVisible?: boolean };
type ProcessExecution = {
  found?: boolean; executionId?: string; executionStatus?: string;
  execution?: { executionId?: string; executionStatus?: string };
  nextProcessCode?: string; nextProcessStepCode?: string; nextProcessActorCode?: string; nextProcessUserPath?: string;
};

const EMPTY: PortfolioPayload = { items: [], total: 0, sites: [] };
const STEPS = ["기본정보", "활동자료", "산정", "검증", "승인", "보고·인증"];
const STATUS_STYLE: Record<string, string> = {
  진행: "bg-blue-100 text-blue-800", 검증: "bg-amber-100 text-amber-800", 완료: "bg-emerald-100 text-emerald-800",
};

function stageOf(project: Project) {
  const value = project.step || "";
  if (project.status === "완료" || /보고서|인증/.test(value)) return 5;
  if (/승인|검토/.test(value)) return 4;
  if (/검증/.test(value)) return 3;
  if (/산정|배출계수/.test(value)) return 2;
  if (/활동|증빙|자료/.test(value)) return 1;
  return 0;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!(response.headers.get("content-type") || "").includes("application/json")) {
    throw new Error(`서버 응답 형식이 올바르지 않습니다. (${response.status})`);
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || `HTTP ${response.status}`);
  return body;
}

function taskHref(task: Task, en: boolean) {
  const base = task.targetUrl?.startsWith("/") && !task.targetUrl.startsWith("/admin/")
    ? task.targetUrl : `/emission/project/detail?id=${encodeURIComponent(task.projectId)}`;
  const url = new URL(base, window.location.origin);
  url.searchParams.set("projectId", task.projectId);
  url.searchParams.set("taskId", String(task.id));
  url.searchParams.set("guide", "1");
  const path = `${url.pathname}${url.search}`;
  return buildLocalizedPath(path, `/en${path}`);
}

export function EmissionProjectPortfolioPage() {
  const en = isEnglish();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const queryContext = useMemo(() => new URLSearchParams(window.location.search), []);
  const requestedProjectId = queryContext.get("projectId") || "";
  const guideMode = queryContext.get("guide") === "1";
  const processCode = queryContext.get("processCode") || "EMISSION_PROJECT_PORTFOLIO";
  const stepCode = queryContext.get("stepCode") || "EMISSION_PROJECT_PORTFOLIO_LIST";
  const actorCode = queryContext.get("actorCode") || "";
  const emptyHome = useMemo<HomePayload>(() => ({ isLoggedIn: false, isEn: en, homeMenu: [] }), [en]);
  const home = useAsyncValue<HomePayload>(() => fetchHomePayload(), [en], { initialValue: emptyHome, onError: () => undefined });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [site, setSite] = useState("");
  const [selectedId, setSelectedId] = useState(requestedProjectId);
  const [taskPayload, setTaskPayload] = useState<TaskPayload | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [startingId, setStartingId] = useState<number | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  const portfolio = useAsyncValue<PortfolioPayload>(async () => {
    const query = new URLSearchParams({ keyword, status, site, page: "1", size: "100" });
    const response = await fetch(`${buildLocalizedPath("/home/api/emission-projects", "/en/home/api/emission-projects")}?${query}`, {
      credentials: "include", headers: { Accept: "application/json" },
    });
    if (response.status === 401) {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = buildLocalizedPath(`/signin/loginView?returnUrl=${returnUrl}`, `/en/signin/loginView?returnUrl=${returnUrl}`);
      return EMPTY;
    }
    return readJson<PortfolioPayload>(response);
  }, [en, keyword, status, site], { initialValue: EMPTY });

  const data = portfolio.value || EMPTY;
  const projects = data.items || [];
  const selected = projects.find((project) => project.id === selectedId) || null;

  useEffect(() => {
    if (!selected) return;
    const url = new URL(window.location.href);
    url.searchParams.set("projectId", selected.id);
    url.searchParams.set("processCode", processCode);
    url.searchParams.set("stepCode", stepCode);
    if (actorCode) url.searchParams.set("actorCode", actorCode);
    if (guideMode) url.searchParams.set("guide", "1");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [selected, processCode, stepCode, actorCode, guideMode]);

  useEffect(() => {
    if (!selectedId) { setTaskPayload(null); setTaskError(""); return; }
    let mounted = true;
    setTaskLoading(true);
    setTaskError("");
    fetch(buildLocalizedPath("/home/api/emission-tasks", "/en/home/api/emission-tasks"), {
      credentials: "include", headers: { Accept: "application/json" },
    })
      .then((response) => readJson<TaskPayload>(response))
      .then((body) => { if (mounted) setTaskPayload({ ...body, items: (body.items || []).filter((task) => task.projectId === selectedId) }); })
      .catch((error) => { if (mounted) { setTaskPayload(null); setTaskError(error instanceof Error ? error.message : String(error)); } })
      .finally(() => { if (mounted) setTaskLoading(false); });
    return () => { mounted = false; };
  }, [selectedId, en]);

  const tasks = taskPayload?.items || [];
  const nextTask = tasks.find((task) => task.actionable && task.status !== "DONE") || tasks.find((task) => task.status !== "DONE") || null;
  const checks = [
    { label: en ? "Project selected" : "프로젝트 1개 선택", ok: Boolean(selected) },
    { label: en ? "Access verified" : "접근 권한 확인", ok: Boolean(selected) },
    { label: en ? "Current workflow loaded" : "현재 프로세스 상태 조회", ok: Boolean(selected && taskPayload) },
    { label: en ? "Next task confirmed" : "실행 가능한 다음 업무 확정", ok: Boolean(nextTask?.actionable) },
    { label: en ? "Guide start recorded" : "업무 길잡이 실행 기록", ok: nextTask?.status === "IN_PROGRESS" },
  ];
  const checkCount = checks.filter((item) => item.ok).length;
  const active = projects.filter((project) => project.status !== "완료");
  const average = active.length ? Math.round(active.reduce((sum, project) => sum + project.progress, 0) / active.length) : 0;
  const missingRequested = Boolean(requestedProjectId && !portfolio.loading && !projects.some((project) => project.id === requestedProjectId));

  async function startGuide() {
    if (!nextTask) return;
    setStartingId(nextTask.id);
    setTaskError("");
    try {
      if (nextTask.status === "READY") {
        const response = await fetch(`${buildLocalizedPath("/home/api/emission-tasks", "/en/home/api/emission-tasks")}/${nextTask.id}/status`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ status: "IN_PROGRESS" }),
        });
        await readJson(response);
      }
      window.location.href = taskHref(nextTask, en);
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : String(error));
      setStartingId(null);
    }
  }

  async function continueWorkflow() {
    if (!selected) return;
    setStartingId(nextTask?.id ?? -1);
    setTaskError("");
    try {
      const optionsResponse = await fetch(buildLocalizedPath("/home/api/emission-projects/options", "/en/home/api/emission-projects/options"), {
        credentials: "include", headers: { Accept: "application/json" },
      });
      const options = await readJson<{ tenantId?: string }>(optionsResponse);
      const tenantId = String(options.tenantId || "").trim();
      if (!tenantId) throw new Error(en ? "Tenant context is missing." : "테넌트 정보를 확인할 수 없습니다.");
      const executionBase = buildLocalizedPath("/home/api/process-executions", "/en/home/api/process-executions");
      const query = new URLSearchParams({ tenantId, projectId: selected.id, processCode: "EMISSION_PROJECT_PORTFOLIO" });
      const executionResponse = await fetch(`${executionBase}?${query}`, { credentials: "include", headers: { Accept: "application/json" } });
      let execution = await readJson<ProcessExecution>(executionResponse);

      if (execution.executionStatus !== "COMPLETED") {
        let executionId = String(execution.executionId || "");
        if (!execution.found || !executionId) {
          const startResponse = await fetch(`${executionBase}/start`, {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ tenantId, projectId: selected.id, processCode: "EMISSION_PROJECT_PORTFOLIO", actorCode: "COMPANY_MANAGER" }),
          });
          const started = await readJson<ProcessExecution>(startResponse);
          executionId = String(started.executionId || started.execution?.executionId || "");
          if (!executionId) throw new Error(en ? "The portfolio execution could not be started." : "포트폴리오 실행 건을 시작하지 못했습니다.");
        }
        const commandResponse = await fetch(`${executionBase}/${encodeURIComponent(executionId)}/commands`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ tenantId, projectId: selected.id, processCode: "EMISSION_PROJECT_PORTFOLIO", stepCode: "EMISSION_PROJECT_PORTFOLIO_LIST", actorCode: "COMPANY_MANAGER", commandCode: "SELECT_PROJECT", idempotencyKey: `PORTFOLIO-${selected.id}-${Date.now()}`, requestJson: JSON.stringify({ selectedProjectId: selected.id }), resultJson: JSON.stringify({ completed: true, nextTaskCode: "ORGANIZATIONAL_BOUNDARY_S1" }) }),
        });
        execution = await readJson<ProcessExecution>(commandResponse);
        const nextPath = execution.nextProcessUserPath || "/emission/organizational-boundary";
        const target = new URL(buildLocalizedPath(nextPath, `/en${nextPath}`), window.location.origin);
        target.searchParams.set("projectId", selected.id);
        target.searchParams.set("processCode", execution.nextProcessCode || "ORGANIZATIONAL_BOUNDARY");
        target.searchParams.set("stepCode", execution.nextProcessStepCode || "ORGANIZATIONAL_BOUNDARY_S1");
        target.searchParams.set("actorCode", execution.nextProcessActorCode || "COMPANY_MANAGER");
        target.searchParams.set("guide", "1");
        window.location.href = `${target.pathname}${target.search}`;
        return;
      }

      if (!nextTask) throw new Error(en ? "No remaining task is available for this project." : "이 프로젝트에서 진행할 남은 업무가 없습니다.");
      if (!nextTask.actionable) throw new Error(en ? "The next task is assigned to another actor or its prerequisite is incomplete." : "다음 업무는 다른 담당자에게 배정되었거나 선행 업무가 완료되지 않았습니다.");
      await startGuide();
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : String(error));
      setStartingId(null);
    }
  }

  async function copyProject() {
    if (!selected || copying) return;
    if (!window.confirm(en ? `Copy ${selected.name}?` : `${selected.name} 프로젝트를 복사하시겠습니까?`)) return;
    setCopying(true);
    setTaskError("");
    try {
      const response = await fetch(buildLocalizedPath(`/home/api/emission-projects/${encodeURIComponent(selected.id)}/copy`, `/en/home/api/emission-projects/${encodeURIComponent(selected.id)}/copy`), {
        method: "POST", credentials: "include", headers: { Accept: "application/json" },
      });
      const body = await readJson<{ success: boolean; id: string }>(response);
      await portfolio.reload();
      setSelectedId(body.id);
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : String(error));
    } finally {
      setCopying(false);
    }
  }

  const text = en ? {
    title: "Emission Project Portfolio", desc: "Select a project, verify its current state, and start the next authorized task.",
    list: "Project list", create: "New project", all: "Total", active: "Active", review: "Review", complete: "Complete", average: "Average progress",
  } : {
    title: "배출량 프로젝트 포트폴리오", desc: "담당 프로젝트를 선택하고 현재 상태와 권한을 확인한 뒤, 실행 가능한 다음 업무를 시작합니다.",
    list: "프로젝트 목록", create: "새 프로젝트", all: "전체", active: "진행 중", review: "검증·승인", complete: "완료", average: "평균 진행률",
  };

  return <><HomeInlineStyles en={en} /><div className="min-h-screen bg-[#f4f7fb] text-[var(--kr-gov-text-primary)]">
    <a className="skip-link" href="#portfolio-main">{content.skipLink}</a>
    <header className="fixed inset-x-0 top-0 z-50 border-b-2 border-[#001e40] bg-white">
      <div className="mx-auto max-w-7xl px-4 lg:px-8"><div className="relative flex h-16 items-center">
        <div className="h-11 w-11 shrink-0 xl:hidden" aria-hidden="true" />
        <HeaderBrand content={content} en={en} />
        <HeaderDesktopNav en={en} homeMenu={home.value?.homeMenu || []} />
        <div className="ml-auto flex items-center gap-2">
          <button className="hidden rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold xl:block" onClick={() => navigate(en ? "/emission/project-portfolio" : "/en/emission/project-portfolio")} type="button">{en ? "KO" : "EN"}</button>
          {home.value?.isLoggedIn ? <button className="hidden rounded-lg bg-[#246beb] px-4 py-2.5 font-bold text-white xl:block" onClick={() => void session.logout()} type="button">{content.logout}</button> : null}
          <button aria-label={content.openAllMenu} className="flex h-11 w-11 items-center justify-center rounded border border-slate-300 xl:hidden" onClick={() => setMobileMenuOpen(true)} type="button"><span className="material-symbols-outlined">menu</span></button>
        </div>
      </div></div>
    </header>
    <div className="h-16" aria-hidden="true" />
    <div className={`${mobileMenuOpen ? "" : "hidden"} fixed inset-0 z-[70] xl:hidden`}>
      <button className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} type="button" />
      <HeaderMobileMenu content={content} en={en} homeMenu={home.value?.homeMenu || []} isLoggedIn={Boolean(home.value?.isLoggedIn)} onClose={() => setMobileMenuOpen(false)} onLogout={session.logout} />
    </div>

    <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8" id="portfolio-main">
      <section className="overflow-hidden rounded-3xl bg-[#052b57] px-6 py-8 text-white shadow-xl lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-bold text-blue-200">{en ? "Carbon Emission Management" : "탄소배출 관리"}</p><h1 className="mt-2 text-3xl font-black tracking-tight lg:text-4xl">{text.title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100 lg:text-base">{text.desc}</p></div><div className="flex flex-wrap gap-2"><a className="inline-flex min-h-11 items-center rounded-lg border border-white/40 px-4 font-bold hover:bg-white/10" href={buildLocalizedPath("/emission/project_list", "/en/emission/project_list")}>{text.list}</a><a className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 font-black text-[#052b57]" href={buildLocalizedPath("/emission/project/create", "/en/emission/project/create")}><span className="material-symbols-outlined">add</span>{text.create}</a></div></div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
        [text.all, data.total || projects.length, "folder_open", ""], [text.active, active.length, "play_circle", "진행"], [text.review, projects.filter((project) => project.status === "검증").length, "fact_check", "검증"], [text.complete, projects.filter((project) => project.status === "완료").length, "workspace_premium", "완료"], [text.average, `${average}%`, "monitoring", "metric"],
      ].map(([label, value, icon, filter]) => <button className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 disabled:cursor-default" disabled={filter === "metric"} key={String(label)} onClick={() => setStatus(String(filter))} type="button"><span className="material-symbols-outlined text-[#246beb]">{icon}</span><span className="ml-2 text-sm font-bold text-slate-500">{label}</span><strong className="mt-3 block text-3xl font-black text-[#052b57]">{value}</strong></button>)}</section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3 lg:grid-cols-[1fr_190px_220px_auto]">
        <label className="text-sm font-bold">{en ? "Search" : "검색"}<input className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" onChange={(event) => setKeyword(event.target.value)} placeholder={en ? "Project, site, owner" : "프로젝트명, 사업장, 담당자"} value={keyword} /></label>
        <label className="text-sm font-bold">{en ? "Status" : "상태"}<select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">{en ? "All" : "전체"}</option><option value="진행">{en ? "Active" : "진행"}</option><option value="검증">{en ? "Review" : "검증"}</option><option value="완료">{en ? "Complete" : "완료"}</option></select></label>
        <label className="text-sm font-bold">{en ? "Site" : "사업장"}<select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal" onChange={(event) => setSite(event.target.value)} value={site}><option value="">{en ? "All sites" : "전체 사업장"}</option>{(data.sites || []).map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className="mt-auto h-11 rounded-lg border border-slate-300 px-4 font-bold" onClick={() => { setKeyword(""); setStatus(""); setSite(""); }} type="button">{en ? "Reset" : "초기화"}</button>
      </div></section>

      <nav aria-label={en ? "Portfolio shortcuts" : "포트폴리오 빠른 메뉴"} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["assignment", en ? "My tasks" : "내 업무", "/emission/my-tasks"],
          ["event_busy", en ? "Deadlines and delays" : "마감·지연 현황", "/emission/deadline-status"],
          ["group_add", en ? "Work assignment" : "업무 배정", "/emission/work-assignment"],
          ["inventory_2", en ? "Completed projects" : "완료 프로젝트", "/emission/project-completion"],
        ].map(([icon, label, path]) => <a className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 font-bold text-[#052b57] shadow-sm transition hover:border-blue-300 hover:bg-blue-50" href={buildLocalizedPath(path, `/en${path}`)} key={path}><span className="material-symbols-outlined text-[#246beb]">{icon}</span>{label}</a>)}
      </nav>

      {missingRequested ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 font-bold text-amber-900">{requestedProjectId} 프로젝트가 없거나 현재 계정에 조회 권한이 없습니다.</p> : null}
      {portfolio.error ? <div className="mt-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"><strong>{portfolio.error}</strong><button className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white" onClick={() => void portfolio.reload()} type="button">{en ? "Retry" : "다시 시도"}</button></div> : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b px-6 py-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black text-[#052b57]">{en ? "Select a project" : "프로젝트 선택"}</h2><p className="mt-1 text-sm text-slate-500">{en ? "Only projects available to this account are listed." : "로그인 계정이 접근할 수 있는 프로젝트만 표시됩니다."}</p></div><strong className="text-sm text-slate-500">{projects.length}{en ? " projects" : "개"}</strong></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{(en ? ["Select", "Project", "Site / period", "Owner", "Current step", "Progress", "Status"] : ["선택", "프로젝트", "사업장·기간", "담당자", "현재 단계", "진행률", "상태"]).map((label) => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{projects.map((project) => {
            const isSelected = project.id === selectedId;
            return <tr className={`cursor-pointer border-t ${isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : "hover:bg-slate-50"}`} key={project.id} onClick={() => setSelectedId(project.id)}><td className="px-4 py-4"><input aria-label={`${project.name} 선택`} checked={isSelected} onChange={() => setSelectedId(project.id)} type="radio" /></td><td className="px-4 py-4"><strong className="block text-[#052b57]">{project.name}</strong><span className="mt-1 block text-xs text-slate-500">{project.id}</span></td><td className="px-4"><strong className="block">{project.site || "-"}</strong><span className="text-xs text-slate-500">{project.period || "-"}</span></td><td className="px-4">{project.owner || "-"}</td><td className="px-4 font-bold text-blue-700">{project.step || "-"}</td><td className="px-4"><strong>{project.progress}%</strong><div className="mt-2 h-1.5 w-20 rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#246beb]" style={{ width: `${Math.max(0, Math.min(100, project.progress))}%` }} /></div></td><td className="px-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${STATUS_STYLE[project.status] || "bg-slate-100 text-slate-700"}`}>{project.status}</span></td></tr>;
          })}</tbody></table></div>
          {portfolio.loading ? <p className="p-8 text-center font-bold text-blue-800">{en ? "Loading portfolio..." : "포트폴리오를 불러오는 중입니다."}</p> : null}
          {!portfolio.loading && !portfolio.error && !projects.length ? <p className="p-10 text-center text-slate-500">{en ? "No accessible projects." : "조회 가능한 프로젝트가 없습니다."}</p> : null}
        </section>

        <aside className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-[#246beb]">STEP 1 COMPLETION</p><h2 className="mt-1 text-xl font-black text-[#052b57]">{en ? "Completion criteria" : "1단계 완료 기준"}</h2></div><strong className={`rounded-full px-3 py-1 text-sm ${checkCount === 5 ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>{checkCount}/5</strong></div>
          <div className="mt-5 space-y-3">{checks.map((item) => <div className={`flex items-center gap-3 rounded-xl border p-3 ${item.ok ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`} key={item.label}><span className={`material-symbols-outlined ${item.ok ? "text-emerald-600" : "text-slate-400"}`}>{item.ok ? "check_circle" : "radio_button_unchecked"}</span><span className="text-sm font-bold">{item.label}</span></div>)}</div>
          {taskLoading ? <p className="mt-4 text-sm font-bold text-blue-700">{en ? "Checking workflow..." : "업무 상태를 확인하는 중입니다."}</p> : null}
          {taskError ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{taskError}</p> : null}
        </aside>
      </div>

      {selected ? <section className="mt-5 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm"><div className="grid xl:grid-cols-[1.25fr_.75fr]">
        <article className="p-6 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">{selected.id}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${STATUS_STYLE[selected.status] || "bg-slate-100"}`}>{selected.status}</span></div><button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-[#052b57] hover:bg-slate-50 disabled:opacity-50" disabled={copying} onClick={() => void copyProject()} type="button"><span className="material-symbols-outlined text-[20px]">content_copy</span>{copying ? (en ? "Copying..." : "복사 중...") : (en ? "Copy project" : "프로젝트 복사")}</button></div>
          <h2 className="mt-3 text-2xl font-black text-[#052b57]">{selected.name}</h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-slate-500">{en ? "Site" : "사업장"}</dt><dd className="mt-1 font-black">{selected.site || "-"}</dd></div><div><dt className="text-slate-500">{en ? "Period" : "산정기간"}</dt><dd className="mt-1 font-black">{selected.period || "-"}</dd></div><div><dt className="text-slate-500">{en ? "Owner" : "담당자"}</dt><dd className="mt-1 font-black">{selected.owner || "-"}</dd></div><div><dt className="text-slate-500">{en ? "Due" : "마감"}</dt><dd className="mt-1 font-black">{selected.dueDate || selected.due || "-"}</dd></div></dl>
          <div className="mt-6"><div className="flex justify-between text-sm font-bold"><span>{en ? "Project progress" : "프로젝트 진행률"}</span><strong>{selected.progress}%</strong></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#246beb]" style={{ width: `${Math.max(0, Math.min(100, selected.progress))}%` }} /></div></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">{STEPS.map((label, index) => <div className={`rounded-xl border p-3 ${index === stageOf(selected) ? "border-blue-500 bg-blue-50" : "border-slate-200"}`} key={label}><span className="text-xs font-black text-blue-600">STEP {index + 1}</span><strong className="mt-1 block text-sm">{label}</strong></div>)}</div>
        </article>
        <aside className="border-t bg-[#f7faff] p-6 lg:p-7 xl:border-l xl:border-t-0">
          <p className="text-xs font-black text-[#246beb]">{en ? "NEXT ACTION" : "다음 실행 업무"}</p>
          {nextTask ? <><h3 className="mt-2 text-xl font-black text-[#052b57]">{nextTask.name}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{nextTask.completionRule || (en ? "Complete the required data and evidence for this step." : "이 단계에 필요한 필수 데이터와 증적을 완료하십시오.")}</p><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">{en ? "Assignee" : "담당자"}</dt><dd className="font-black">{nextTask.assignee || "-"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">{en ? "Status" : "상태"}</dt><dd className="font-black">{nextTask.status}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">{en ? "Due" : "마감"}</dt><dd className="font-black">{nextTask.dueDate || "-"}</dd></div></dl>{nextTask.pendingPredecessors || nextTask.blockedReason ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">{nextTask.pendingPredecessors || nextTask.blockedReason}</p> : null}<button className="mt-6 min-h-12 w-full rounded-lg bg-[#0755b5] px-5 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={startingId !== null} onClick={() => void continueWorkflow()} type="button">{startingId !== null ? (en ? "Starting..." : "인계 처리 중...") : (en ? "Continue work" : "업무 계속하기")} <span className="material-symbols-outlined ml-1 align-middle">arrow_forward</span></button></> : selected.status === "완료" ? <><h3 className="mt-2 text-xl font-black text-[#052b57]">{en ? "Project completed" : "프로젝트 업무 완료"}</h3><p className="mt-2 text-sm text-slate-600">{en ? "Review the final report, certificate, and audit history." : "최종 보고서·인증서·변경 이력을 확인할 수 있습니다."}</p><div className="mt-5 grid gap-2"><a className="rounded-lg bg-[#0755b5] px-4 py-3 text-center font-black text-white" href={buildLocalizedPath(`/emission/report-download?projectId=${selected.id}`, `/en/emission/report-download?projectId=${selected.id}`)}>{en ? "Reports & certificates" : "보고서·인증서 확인"}</a><a className="rounded-lg border border-slate-300 px-4 py-3 text-center font-bold" href={buildLocalizedPath(`/emission/project/detail?id=${selected.id}`, `/en/emission/project/detail?id=${selected.id}`)}>{en ? "Project history" : "프로젝트 이력"}</a></div></> : <><h3 className="mt-2 text-xl font-black text-[#052b57]">{en ? "No actionable task" : "실행 가능한 다음 업무 없음"}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{taskError || (en ? "Check prerequisites and task assignment." : "선행 업무 완료 여부와 담당 계정 배정을 확인하십시오.")}</p><a className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#246beb] font-black text-[#246beb]" href={buildLocalizedPath(`/emission/project/detail?id=${selected.id}`, `/en/emission/project/detail?id=${selected.id}`)}>{en ? "Open project workspace" : "프로젝트 작업공간 확인"}</a></>}
        </aside>
      </div></section> : null}
    </main>
  </div></>;
}
