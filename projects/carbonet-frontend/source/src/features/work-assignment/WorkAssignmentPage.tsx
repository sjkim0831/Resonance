import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HeaderMobileMenu, HomeInlineStyles } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import type { HomePayload } from "../home-entry/homeEntryTypes";

type Project = { projectId: string; projectName: string };
type Account = { accountId: string; accountName: string; department?: string; actorCodes?: string };
type Step = { stepCode: string; stepName: string; stepOrder: number; actorCode?: string; actorName?: string; accountId?: string };
type WorkType = { workTypeCode: string; workTypeName: string; processCount: number };
type Process = { processCode: string; processName: string; workTypeCode: string; status: string; ownerActorCode?: string; stepCount: number; processOrder?: number; laneOrder?: number; executionMode?: string };
type Workspace = { canManage?: boolean; projects?: Project[]; accounts?: Account[]; workTypes?: WorkType[]; processes?: Process[]; actors?: Array<{ actorCode: string; actorName: string }>; steps?: Step[]; processAssignment?: { accountId?: string; actorCode?: string }; assignedStepCount?: number; updatedTaskCount?: number };

const WORK_TYPE_LABELS: Record<string, string> = {
  EMISSION: "탄소배출 관리", LCA: "제품 LCA", REDUCTION: "감축 관리", MONITORING: "모니터링·분석",
  TRADE: "탄소·자원 거래", EDUCATION: "교육·지원", MEMBER: "회원·기업·권한", CERTIFICATE: "인증서",
  SYSTEM: "시스템 관리", DATA_GOVERNANCE: "데이터 거버넌스", FACILITY_OPERATION: "설비 운영",
  COMPLIANCE: "규제·컴플라이언스", MRV: "MRV", PORTFOLIO: "포트폴리오", COMMON: "공통 업무",
  WORK_ASSIGNMENT: "업무 배정",
};

const ACTORS: Record<string, { label: string; icon: string; color: string }> = {
  COMPANY_MANAGER: { label: "기업 관리자", icon: "business", color: "bg-blue-600" },
  SITE_DATA_MANAGER: { label: "사업장 자료 담당자", icon: "assignment", color: "bg-cyan-600" },
  SITE_DATA_OWNER: { label: "사업장 자료 담당자", icon: "assignment", color: "bg-cyan-600" },
  EMISSION_CALCULATOR: { label: "배출량 산정 담당자", icon: "monitoring", color: "bg-emerald-600" },
  CALCULATOR: { label: "배출량 산정 담당자", icon: "monitoring", color: "bg-emerald-600" },
  EMISSION_VERIFIER: { label: "검증 담당자", icon: "verified_user", color: "bg-violet-600" },
  VERIFIER: { label: "검증 담당자", icon: "verified_user", color: "bg-violet-600" },
  EMISSION_APPROVER: { label: "승인 담당자", icon: "approval", color: "bg-indigo-600" },
  APPROVER: { label: "승인 담당자", icon: "approval", color: "bg-indigo-600" },
  WORK_ASSIGNMENT_MANAGER: { label: "업무 배정 담당자", icon: "assignment_ind", color: "bg-slate-700" },
};

const actorInfo = (code = "") => ACTORS[code] || { label: "담당자 미지정", icon: "person", color: "bg-slate-500" };
const ASSIGNMENT_SWITCH_GUARD = "carbonet:work-assignment-auto-switch";

async function recoverTestAssignmentManager(): Promise<boolean> {
  if (new URLSearchParams(location.search).get("testMode") !== "1" || sessionStorage.getItem(ASSIGNMENT_SWITCH_GUARD) === "1") return false;
  sessionStorage.setItem(ASSIGNMENT_SWITCH_GUARD, "1");
  const response = await fetch(buildLocalizedPath("/signin/testAccountSwitch", "/en/signin/testAccountSwitch"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Carbonet-Test-Mode": "1" },
    body: JSON.stringify({ userId: "qaassign26" }),
  });
  return response.ok;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!(response.headers.get("content-type") || "").includes("application/json")) throw new Error(`서버 응답 형식이 올바르지 않습니다. (${response.status})`);
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
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projectId, setProjectId] = useState(new URLSearchParams(location.search).get("projectId") || "");
  const [workTypeCode, setWorkTypeCode] = useState(new URLSearchParams(location.search).get("workTypeCode") || "EMISSION");
  const [processCode, setProcessCode] = useState(new URLSearchParams(location.search).get("processCode") || "EMISSION_PROJECT");
  const [processAccountId, setProcessAccountId] = useState("");
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load(nextProjectId = projectId, nextProcessCode = processCode) {
    const query = new URLSearchParams();
    if (nextProcessCode) query.set("processCode", nextProcessCode);
    if (nextProjectId) query.set("projectId", nextProjectId);
    const response = await fetch(`${buildLocalizedPath("/home/api/work-assignments", "/en/home/api/work-assignments")}?${query}`, { credentials: "include", headers: { Accept: "application/json" } });
    if (response.status === 401) {
      const returnUrl = encodeURIComponent(location.pathname + location.search);
      location.href = buildLocalizedPath(`/signin/loginView?returnUrl=${returnUrl}`, `/en/signin/loginView?returnUrl=${returnUrl}`);
      return;
    }
    if (response.status === 403 && await recoverTestAssignmentManager()) {
      location.reload();
      return;
    }
    const body = await readJson<Workspace>(response);
    sessionStorage.removeItem(ASSIGNMENT_SWITCH_GUARD);
    const resolved = nextProjectId || body.projects?.[0]?.projectId || "";
    if (!nextProjectId && resolved) { setProjectId(resolved); await load(resolved); return; }
    setWorkspace(body);
    setAssignees(Object.fromEntries((body.steps || []).map(step => [step.stepCode, step.accountId || ""])));
    setProcessAccountId(body.processAssignment?.accountId || "");
    const url = new URL(location.href);
    if (resolved) url.searchParams.set("projectId", resolved);
    if (nextProcessCode) url.searchParams.set("processCode", nextProcessCode);
    url.searchParams.set("workTypeCode", workTypeCode);
    history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  useEffect(() => { void load().catch(error => setMessage(error instanceof Error ? error.message : String(error))); }, []);
  useEffect(() => { document.body.classList.toggle("mobile-menu-open", mobileMenuOpen); return () => document.body.classList.remove("mobile-menu-open"); }, [mobileMenuOpen]);

  const steps = workspace?.steps || [];
  const visibleProcesses = (workspace?.processes || [])
    .filter(process => process.workTypeCode === workTypeCode)
    .sort((left, right) => (left.processOrder ?? Number.MAX_SAFE_INTEGER) - (right.processOrder ?? Number.MAX_SAFE_INTEGER) || (left.laneOrder ?? 1) - (right.laneOrder ?? 1) || left.processCode.localeCompare(right.processCode));
  const actorCodes = [...new Set(steps.map(step => step.actorCode || "UNASSIGNED"))];
  const unassigned = steps.filter(step => !assignees[step.stepCode]).length;

  function setActorDefault(actorCode: string, accountId: string) {
    setAssignees(current => ({ ...current, ...Object.fromEntries(steps.filter(step => (step.actorCode || "UNASSIGNED") === actorCode).map(step => [step.stepCode, accountId])) }));
  }

  async function save() {
    const assignments = steps.map(step => ({ stepCode: step.stepCode, accountId: assignees[step.stepCode] || "" }));
    if (!projectId || !processCode || !processAccountId || !assignments.length || assignments.some(item => !item.accountId)) { setMessage(en ? "Select the process manager and an account for every task." : "프로세스 담당자와 모든 세부 업무의 담당 계정을 선택해 주세요."); return; }
    setBusy(true); setMessage("");
    try {
      const csrfHeaders: Record<string, string> = {};
      if (session.value?.csrfHeaderName && session.value.csrfToken) {
        csrfHeaders[session.value.csrfHeaderName] = session.value.csrfToken;
      }
      const response = await fetch(buildLocalizedPath("/home/api/work-assignments", "/en/home/api/work-assignments"), {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json", ...csrfHeaders },
        body: JSON.stringify({ projectId, processCode, processAccountId, assignments }),
      });
      const body = await readJson<Workspace>(response);
      await load(projectId, processCode);
      setMessage(en ? `${body.assignedStepCount || assignments.length} steps assigned.` : `${body.assignedStepCount || assignments.length}개 절차를 배정했고 실행 태스크 ${body.updatedTaskCount || 0}개를 동기화했습니다.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  const accountOptions = (key: string) => (workspace?.accounts || []).map(account => <option key={`${key}-${account.accountId}`} value={account.accountId}>{account.accountName} · {account.accountId}{account.department ? ` · ${account.department}` : ""}</option>);

  return <><HomeInlineStyles en={en} /><div className="min-h-screen bg-[#f4f7fb] text-[var(--kr-gov-text-primary)]">
    <a className="skip-link" href="#assignment-main">{content.skipLink}</a>
    <header className="fixed inset-x-0 top-0 z-50 border-b-2 border-[#001e40] bg-white"><div className="mx-auto max-w-[96rem] px-4 lg:px-8"><div className="relative flex h-16 items-center">
      <div className="h-11 w-11 shrink-0 xl:hidden" aria-hidden="true" /><HeaderBrand content={content} en={en} /><HeaderDesktopNav en={en} homeMenu={home.value?.homeMenu || []} />
      <div className="ml-auto flex items-center gap-2"><button className="hidden rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold xl:block" onClick={() => navigate(en ? "/emission/work-assignment" : "/en/emission/work-assignment")} type="button">{en ? "KO" : "EN"}</button>{home.value?.isLoggedIn ? <button className="hidden rounded-lg bg-[#246beb] px-4 py-2.5 font-bold text-white xl:block" onClick={() => void session.logout()} type="button">{content.logout}</button> : null}<button aria-label={content.openAllMenu} className="flex h-11 w-11 items-center justify-center rounded border border-slate-300 xl:hidden" onClick={() => setMobileMenuOpen(true)} type="button"><span className="material-symbols-outlined">menu</span></button></div>
    </div></div></header><div className="h-16" aria-hidden="true" />
    <div className={`${mobileMenuOpen ? "" : "hidden"} fixed inset-0 z-[70] xl:hidden`}><button aria-label={content.closeAllMenu} className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} type="button" /><HeaderMobileMenu content={content} en={en} homeMenu={home.value?.homeMenu || []} isLoggedIn={Boolean(home.value?.isLoggedIn)} onClose={() => setMobileMenuOpen(false)} onLogout={session.logout} /></div>

    <main className="mx-auto max-w-[96rem] px-4 py-7 lg:px-8" id="assignment-main">
      <section className="overflow-hidden rounded-3xl border border-[#0b3b70] bg-[#052b57] text-white shadow-xl">
        <div className="px-6 py-5 lg:px-8"><p className="text-sm font-bold text-blue-200">{en ? "Enterprise work orchestration" : "기업 업무 오케스트레이션"}</p><h1 className="mt-1 text-3xl font-black">{en ? "Process and task assignment" : "프로세스·세부 업무 배정"}</h1><p className="mt-2 text-sm text-blue-100">{en ? "Choose a work type and process, then assign its owner, actors, and every detailed step." : "업무 종류와 프로세스를 선택한 뒤 프로세스 책임자, 액터, 세부 절차 담당 계정을 배정합니다."}</p>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <label className="text-sm font-black">{en ? "Work type" : "업무 종류"}<select className="mt-2 h-12 w-full rounded-lg border border-white/30 bg-white px-3 text-[#052b57]" value={workTypeCode} onChange={event => { const nextType=event.target.value; const nextProcess=(workspace?.processes || []).find(item => item.workTypeCode===nextType)?.processCode || ""; setWorkTypeCode(nextType); setProcessCode(nextProcess); if(nextProcess) void load(projectId,nextProcess).catch(error => setMessage(error instanceof Error ? error.message : String(error))); }}>{(workspace?.workTypes || []).map(type => <option key={type.workTypeCode} value={type.workTypeCode}>{WORK_TYPE_LABELS[type.workTypeCode] || type.workTypeName} · {type.processCount}개</option>)}</select></label>
            <label className="text-sm font-black">{en ? "Process" : "업무 프로세스"}<select className="mt-2 h-12 w-full rounded-lg border border-white/30 bg-white px-3 text-[#052b57]" value={processCode} onChange={event => { setProcessCode(event.target.value); void load(projectId,event.target.value).catch(error => setMessage(error instanceof Error ? error.message : String(error))); }}>{visibleProcesses.map((process, index) => <option key={process.processCode} value={process.processCode}>{index + 1}. {process.processName} · {process.stepCount}단계</option>)}</select></label>
            <label className="text-sm font-black">{en ? "Project" : "배정 프로젝트"}<select className="mt-2 h-12 w-full rounded-lg border border-white/30 bg-white px-3 text-[#052b57]" value={projectId} onChange={event => { setProjectId(event.target.value); void load(event.target.value,processCode).catch(error => setMessage(error instanceof Error ? error.message : String(error))); }}>{(workspace?.projects || []).map(project => <option key={project.projectId} value={project.projectId}>{project.projectName} · {project.projectId}</option>)}</select></label>
          </div>
        </div>
      </section>

      {!workspace ? <section className="mt-5 rounded-2xl bg-white p-8 text-center shadow-sm">{message || (en ? "Loading assignment workspace..." : "업무 배정 정보를 불러오는 중입니다.")}</section> : !workspace.canManage ? <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-6 font-bold text-amber-900">{en ? "Only a work assignment manager can access this page." : "업무 배정 담당자만 접근할 수 있습니다."}</section> : <>
        <section className="mt-5 grid gap-3 sm:grid-cols-3"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-sm font-bold text-slate-500">{en ? "Detailed tasks" : "세부 업무"}</span><strong className="mt-2 block text-3xl text-[#052b57]">{steps.length}</strong></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-sm font-bold text-slate-500">{en ? "Assigned" : "배정 완료"}</span><strong className="mt-2 block text-3xl text-emerald-700">{steps.length - unassigned}</strong></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-sm font-bold text-slate-500">{en ? "Unassigned" : "미배정"}</span><strong className="mt-2 block text-3xl text-amber-700">{unassigned}</strong></article></section>

        <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)] lg:items-end"><div><p className="text-xs font-black uppercase tracking-wide text-[#246beb]">{en ? "PROCESS OWNER" : "프로세스 책임자"}</p><h2 className="mt-1 text-xl font-black text-[#052b57]">{visibleProcesses.find(item => item.processCode===processCode)?.processName || processCode}</h2><p className="mt-1 text-sm text-blue-900">{en ? "This account owns coordination, deadlines, escalation, and completion of the selected process." : "선택 프로세스의 일정·조정·에스컬레이션·완료 책임을 맡는 동일 기업 계정을 지정합니다."}</p></div><label className="text-sm font-black text-[#052b57]">{en ? "Responsible account" : "프로세스 담당 계정"}<select className="mt-2 h-12 w-full rounded-lg border border-blue-300 bg-white px-3" value={processAccountId} onChange={event => setProcessAccountId(event.target.value)}><option value="">{en ? "Select responsible account" : "프로세스 담당 계정 선택"}</option>{accountOptions(`process-${processCode}`)}</select></label></div>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="text-xl font-black text-[#052b57]">{en ? "Actor swimlane assignment" : "담당자별 업무 프로세스 배정"}</h2><p className="mt-1 text-sm text-slate-600">{en ? "Set an actor default, then override any individual task in its lane." : "행별 기본 계정을 지정한 뒤 각 세부 업무 셀에서 담당자를 개별 변경할 수 있습니다."}</p></div>

          <div className="hidden overflow-x-auto lg:block" data-testid="assignment-swimlane">
            <div className="min-w-[82rem]">
              <div className="grid border-b border-slate-300 bg-[#f3f7fc]" style={{ gridTemplateColumns: `13rem repeat(${Math.max(steps.length, 1)}, minmax(11.5rem, 1fr))` }}><div className="flex items-center justify-center border-r border-slate-300 p-4 text-sm font-black text-[#052b57]">{en ? "Assignee" : "담당자"}</div>{steps.map(step => <div className="border-r border-slate-200 p-3 text-center last:border-r-0" key={`head-${step.stepCode}`}><span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0755b5] text-xs font-black text-white">{step.stepOrder}</span><strong className="mt-2 block text-sm text-[#052b57]">{step.stepName}</strong></div>)}</div>
              {actorCodes.map(actorCode => { const info = actorInfo(actorCode); const actorSteps = steps.filter(step => (step.actorCode || "UNASSIGNED") === actorCode); const selected = [...new Set(actorSteps.map(step => assignees[step.stepCode]).filter(Boolean))]; return <div className="grid min-h-36 border-b border-slate-200 last:border-b-0" key={actorCode} style={{ gridTemplateColumns: `13rem repeat(${Math.max(steps.length, 1)}, minmax(11.5rem, 1fr))` }}>
                <div className="border-r border-slate-300 bg-[#f8fafc] p-4"><div className={`flex h-11 w-11 items-center justify-center rounded-full text-white ${info.color}`}><span className="material-symbols-outlined">{info.icon}</span></div><strong className="mt-2 block text-sm text-[#052b57]">{info.label}</strong><select aria-label={`${info.label} 기본 계정`} className="mt-3 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs" value={selected.length === 1 ? selected[0] : ""} onChange={event => setActorDefault(actorCode, event.target.value)}><option value="">{en ? "Actor default" : "기본 계정 선택"}</option>{accountOptions(`actor-${actorCode}`)}</select></div>
                {steps.map(step => { const belongs = (step.actorCode || "UNASSIGNED") === actorCode; return <div className={`flex border-r border-slate-200 p-3 last:border-r-0 ${belongs ? "items-center bg-white" : "items-center justify-center bg-slate-50/70"}`} key={`${actorCode}-${step.stepCode}`}>{belongs ? <label className="block w-full rounded-xl border-2 border-blue-200 bg-blue-50 p-3"><span className="flex items-center gap-2 text-xs font-black text-[#0755b5]"><span className="material-symbols-outlined text-lg">assignment_ind</span>{en ? "Assigned account" : "세부 업무 담당"}</span><select aria-label={`${step.stepName} 담당 계정`} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs" value={assignees[step.stepCode] || ""} onChange={event => setAssignees(current => ({ ...current, [step.stepCode]: event.target.value }))}><option value="">{en ? "Select account" : "담당 계정 선택"}</option>{accountOptions(step.stepCode)}</select></label> : <span className="h-px w-10 bg-slate-200" aria-hidden="true" />}</div>})}
              </div>; })}
            </div>
          </div>

          <ol className="divide-y divide-slate-200 lg:hidden">{steps.map(step => { const info = actorInfo(step.actorCode); return <li className="p-4" key={`mobile-${step.stepCode}`}><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0755b5] text-sm font-black text-white">{step.stepOrder}</span><div><strong className="block text-sm text-[#052b57]">{step.stepName}</strong><span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-600"><span className="material-symbols-outlined text-base">{info.icon}</span>{info.label}</span></div></div><select aria-label={`${step.stepName} 모바일 담당 계정`} className="mt-3 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" value={assignees[step.stepCode] || ""} onChange={event => setAssignees(current => ({ ...current, [step.stepCode]: event.target.value }))}><option value="">{en ? "Select account" : "담당 계정 선택"}</option>{accountOptions(`mobile-${step.stepCode}`)}</select></li>; })}</ol>
        </section>

        {message ? <p className={`mt-5 rounded-xl p-4 text-sm font-bold ${message.includes("저장") || message.includes("assigned") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} role="status">{message}</p> : null}
        <div className="sticky bottom-0 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur"><span className="text-sm font-bold text-slate-600">{unassigned ? (en ? `${unassigned} tasks need an assignee.` : `${unassigned}개 세부 업무의 담당자를 지정해야 합니다.`) : (en ? "Every task has an assignee." : "모든 세부 업무에 담당자가 지정되었습니다.")}</span><button className="min-h-12 rounded-lg bg-[#0755b5] px-7 font-black text-white disabled:bg-slate-300" disabled={busy || !steps.length || unassigned > 0} onClick={() => void save()} type="button">{busy ? (en ? "Saving..." : "저장 중...") : (en ? "Save and notify" : "배정 저장·담당자 알림")}</button></div>
      </>}
    </main>
  </div></>;
}
