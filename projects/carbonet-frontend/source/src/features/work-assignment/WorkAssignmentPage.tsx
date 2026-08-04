import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HeaderMobileMenu, HomeInlineStyles } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import type { HomePayload } from "../home-entry/homeEntryTypes";

type AssignmentProject = { projectId: string; projectName: string };
type AssignmentAccount = { accountId: string; accountName: string; department?: string; actorCodes?: string[] };
type AssignmentStep = { stepCode: string; stepName: string; stepOrder: number; actorCode?: string; accountId?: string; accountName?: string };
type AssignmentWorkspace = {
  canManage?: boolean;
  projects?: AssignmentProject[];
  accounts?: AssignmentAccount[];
  steps?: AssignmentStep[];
  updatedTaskCount?: number;
  message?: string;
};

const ACTOR_LABELS: Record<string, string> = {
  COMPANY_MANAGER: "기업 관리자",
  SITE_DATA_MANAGER: "사업장 자료 담당자",
  SITE_DATA_OWNER: "사업장 자료 담당자",
  EMISSION_CALCULATOR: "배출량 산정 담당자",
  CALCULATOR: "배출량 산정 담당자",
  EMISSION_VERIFIER: "검증 담당자",
  VERIFIER: "검증 담당자",
  EMISSION_APPROVER: "승인 담당자",
  APPROVER: "승인 담당자",
  WORK_ASSIGNMENT_MANAGER: "업무 배정 담당자",
};

async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error(`서버 응답 형식이 올바르지 않습니다. (${response.status})`);
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || `HTTP ${response.status}`);
  return body as T;
}

export function WorkAssignmentPage() {
  const en = isEnglish();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const emptyHome = useMemo<HomePayload>(() => ({ isLoggedIn: false, isEn: en, homeMenu: [] }), [en]);
  const home = useAsyncValue<HomePayload>(() => fetchHomePayload(), [en], { initialValue: emptyHome, onError: () => undefined });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspace, setWorkspace] = useState<AssignmentWorkspace | null>(null);
  const [projectId, setProjectId] = useState(new URLSearchParams(window.location.search).get("projectId") || "");
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load(nextProjectId = projectId) {
    const query = new URLSearchParams({ processCode: "EMISSION_PROJECT" });
    if (nextProjectId) query.set("projectId", nextProjectId);
    const response = await fetch(`${buildLocalizedPath("/home/api/work-assignments", "/en/home/api/work-assignments")}?${query}`, { credentials: "include", headers: { Accept: "application/json" } });
    if (response.status === 401) {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = buildLocalizedPath(`/signin/loginView?returnUrl=${returnUrl}`, `/en/signin/loginView?returnUrl=${returnUrl}`);
      return;
    }
    const body = await readJson<AssignmentWorkspace>(response);
    const resolvedProjectId = nextProjectId || body.projects?.[0]?.projectId || "";
    if (!nextProjectId && resolvedProjectId) {
      setProjectId(resolvedProjectId);
      await load(resolvedProjectId);
      return;
    }
    setWorkspace(body);
    setAssignees(Object.fromEntries((body.steps || []).map(step => [step.stepCode, step.accountId || ""])));
    const url = new URL(window.location.href);
    if (resolvedProjectId) url.searchParams.set("projectId", resolvedProjectId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  useEffect(() => { void load().catch(error => setMessage(error instanceof Error ? error.message : String(error))); }, []);
  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  const steps = workspace?.steps || [];
  const actors = [...new Set(steps.map(step => step.actorCode || "UNASSIGNED"))];
  const unassignedCount = steps.filter(step => !assignees[step.stepCode]).length;

  function assignActor(actorCode: string, accountId: string) {
    setAssignees(current => ({ ...current, ...Object.fromEntries(steps.filter(step => (step.actorCode || "UNASSIGNED") === actorCode).map(step => [step.stepCode, accountId])) }));
  }

  async function save() {
    const assignments = steps.map(step => ({ stepCode: step.stepCode, accountId: assignees[step.stepCode] || "" }));
    if (!projectId || !assignments.length || assignments.some(item => !item.accountId)) {
      setMessage(en ? "Select an account for every step." : "모든 단계의 담당 계정을 선택해 주세요.");
      return;
    }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(buildLocalizedPath("/home/api/work-assignments", "/en/home/api/work-assignments"), {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ projectId, processCode: "EMISSION_PROJECT", assignments }),
      });
      const body = await readJson<AssignmentWorkspace>(response);
      setWorkspace(body);
      setAssignees(Object.fromEntries((body.steps || []).map(step => [step.stepCode, step.accountId || ""])));
      setMessage(en ? `${body.updatedTaskCount || assignments.length} steps assigned.` : `${body.updatedTaskCount || assignments.length}개 단계 배정과 알림을 저장했습니다.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  return <><HomeInlineStyles en={en} /><div className="min-h-screen bg-[#f4f7fb] text-[var(--kr-gov-text-primary)]">
    <a className="skip-link" href="#assignment-main">{content.skipLink}</a>
    <header className="fixed inset-x-0 top-0 z-50 border-b-2 border-[#001e40] bg-white"><div className="mx-auto max-w-7xl px-4 lg:px-8"><div className="relative flex h-16 items-center">
      <div className="h-11 w-11 shrink-0 xl:hidden" aria-hidden="true" /><HeaderBrand content={content} en={en} /><HeaderDesktopNav en={en} homeMenu={home.value?.homeMenu || []} />
      <div className="ml-auto flex items-center gap-2"><button className="hidden rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold xl:block" onClick={() => navigate(en ? "/emission/work-assignment" : "/en/emission/work-assignment")} type="button">{en ? "KO" : "EN"}</button>{home.value?.isLoggedIn ? <button className="hidden rounded-lg bg-[#246beb] px-4 py-2.5 font-bold text-white xl:block" onClick={() => void session.logout()} type="button">{content.logout}</button> : null}<button aria-label={content.openAllMenu} className="flex h-11 w-11 items-center justify-center rounded border border-slate-300 xl:hidden" onClick={() => setMobileMenuOpen(true)} type="button"><span className="material-symbols-outlined">menu</span></button></div>
    </div></div></header><div className="h-16" aria-hidden="true" />
    <div className={`${mobileMenuOpen ? "" : "hidden"} fixed inset-0 z-[70] xl:hidden`}><button className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} type="button" /><HeaderMobileMenu content={content} en={en} homeMenu={home.value?.homeMenu || []} isLoggedIn={Boolean(home.value?.isLoggedIn)} onClose={() => setMobileMenuOpen(false)} onLogout={session.logout} /></div>
    <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8" id="assignment-main">
      <section className="rounded-3xl bg-[#052b57] px-6 py-8 text-white shadow-xl lg:px-10"><p className="text-sm font-bold text-blue-200">{en ? "Carbon emission operation" : "탄소배출 운영"}</p><h1 className="mt-2 text-3xl font-black">{en ? "Project work assignment" : "프로젝트 업무 배정"}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100">{en ? "Assign company accounts to actors and workflow steps, then notify every assignee." : "동일 기업의 활성 계정을 액터와 단계별 담당자로 배정하고 담당자 알림까지 한 번에 저장합니다."}</p></section>
      {!workspace ? <section className="mt-5 rounded-2xl bg-white p-8 text-center shadow-sm">{message || (en ? "Loading assignment workspace..." : "업무 배정 정보를 불러오는 중입니다.")}</section> : !workspace.canManage ? <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-6 font-bold text-amber-900">{en ? "Only a work assignment manager can access this page." : "업무 배정 담당자만 접근할 수 있습니다."}</section> : <>
        <section className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white p-5 shadow-sm"><span className="text-sm font-bold text-slate-500">{en ? "Workflow steps" : "프로세스 단계"}</span><strong className="mt-2 block text-3xl text-[#052b57]">{steps.length}</strong></div><div className="rounded-2xl bg-white p-5 shadow-sm"><span className="text-sm font-bold text-slate-500">{en ? "Assigned" : "배정 완료"}</span><strong className="mt-2 block text-3xl text-emerald-700">{steps.length - unassignedCount}</strong></div><div className="rounded-2xl bg-white p-5 shadow-sm"><span className="text-sm font-bold text-slate-500">{en ? "Unassigned" : "미배정"}</span><strong className="mt-2 block text-3xl text-amber-700">{unassignedCount}</strong></div></section>
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><label className="block text-sm font-black text-[#052b57]">{en ? "Project" : "배정 프로젝트"}<select className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3" value={projectId} onChange={event => { setProjectId(event.target.value); void load(event.target.value).catch(error => setMessage(error instanceof Error ? error.message : String(error))); }}>{(workspace.projects || []).map(project => <option key={project.projectId} value={project.projectId}>{project.projectName} · {project.projectId}</option>)}</select></label></section>
        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.5fr)]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-[#052b57]">{en ? "Actor defaults" : "담당자별 기본 계정"}</h2><div className="mt-4 space-y-3">{actors.map(actorCode => { const actorSteps = steps.filter(step => (step.actorCode || "UNASSIGNED") === actorCode); const assigned = [...new Set(actorSteps.map(step => assignees[step.stepCode]).filter(Boolean))]; return <label className="block rounded-xl border border-slate-200 bg-slate-50 p-3" key={actorCode}><span className="text-sm font-black text-[#052b57]">{ACTOR_LABELS[actorCode] || actorCode} <small className="text-slate-500">· {actorSteps.length}{en ? " steps" : "단계"}</small></span><select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3" value={assigned.length === 1 ? assigned[0] : ""} onChange={event => assignActor(actorCode, event.target.value)}><option value="">{en ? "Select company account" : "기업 계정 선택"}</option>{(workspace.accounts || []).map(account => <option key={`${actorCode}-${account.accountId}`} value={account.accountId}>{account.accountName} · {account.accountId}{account.department ? ` · ${account.department}` : ""}</option>)}</select></label>; })}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-[#052b57]">{en ? "Step assignments" : "단계별 담당 계정"}</h2><ol className="mt-4 space-y-3">{steps.map(step => <li className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(14rem,0.9fr)] sm:items-center" key={step.stepCode}><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#052b57] text-sm font-black text-white">{step.stepOrder}</span><span><strong className="block text-sm text-[#052b57]">{step.stepName}</strong><small className="font-bold text-slate-500">{ACTOR_LABELS[step.actorCode || ""] || step.actorCode}</small></span><select aria-label={`${step.stepName} 담당 계정`} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3" value={assignees[step.stepCode] || ""} onChange={event => setAssignees(current => ({ ...current, [step.stepCode]: event.target.value }))}><option value="">{en ? "Select account" : "담당 계정 선택"}</option>{(workspace.accounts || []).map(account => <option key={`${step.stepCode}-${account.accountId}`} value={account.accountId}>{account.accountName} · {account.accountId}</option>)}</select></li>)}</ol></div>
        </section>
        {message ? <p className={`mt-5 rounded-xl p-4 text-sm font-bold ${message.includes("저장") || message.includes("assigned") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} role="status">{message}</p> : null}
        <div className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur"><span className="text-sm font-bold text-slate-600">{unassignedCount ? (en ? `${unassignedCount} steps need an assignee.` : `${unassignedCount}개 단계의 담당자를 지정해야 합니다.`) : (en ? "Every step has an assignee." : "모든 단계에 담당자가 지정되었습니다.")}</span><button className="min-h-12 rounded-lg bg-[#0755b5] px-7 font-black text-white disabled:bg-slate-300" disabled={busy || !steps.length || unassignedCount > 0} onClick={() => void save()} type="button">{busy ? (en ? "Saving..." : "저장 중...") : (en ? "Save and notify" : "배정 저장·담당자 알림")}</button></div>
      </>}
    </main>
  </div></>;
}
