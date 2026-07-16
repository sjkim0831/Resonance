import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HomeInlineStyles } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";

type Task = {
  id: number; projectId: string; projectName: string; site: string; name: string;
  type: string; status: string; priority: string; assignee: string; dueDate: string;
  targetUrl: string; processCode?: string; processStepCode?: string; actorCode?: string;
  completionRule?: string; blockedReason?: string; pendingPredecessors?: string; actionable?: boolean;
};
type Data = {
  items: Task[]; actorId: string; allVisible: boolean;
  summary: { total: number; completed: number; today: number; overdue: number; approval: number };
};

const STATUS_STYLE: Record<string, string> = {
  READY: "bg-blue-100 text-blue-800", IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  WAITING: "bg-slate-100 text-slate-700", BLOCKED: "bg-rose-100 text-rose-800",
  DONE: "bg-emerald-100 text-emerald-800",
};
const STATUS_KO: Record<string, string> = { READY: "실행 가능", IN_PROGRESS: "진행 중", WAITING: "대기", BLOCKED: "차단", DONE: "완료" };
const STATUS_EN: Record<string, string> = { READY: "Ready", IN_PROGRESS: "In progress", WAITING: "Waiting", BLOCKED: "Blocked", DONE: "Done" };
const PRIORITY_KO: Record<string, string> = { URGENT: "긴급", HIGH: "높음", NORMAL: "보통", LOW: "낮음" };

async function responseJson(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error(`서버 응답 형식이 올바르지 않습니다. (${response.status})`);
  return response.json();
}

export function EmissionMyTasksPage() {
  const en = isEnglish();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const home = useAsyncValue(() => fetchHomePayload(), [en]);
  const [data, setData] = useState<Data | null>(null);
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [busyTask, setBusyTask] = useState<number | null>(null);
  const api = buildLocalizedPath("/home/api/emission-tasks", "/en/home/api/emission-tasks");

  async function load() {
    setMessage("");
    const response = await fetch(`${api}?status=${encodeURIComponent(status)}&period=${encodeURIComponent(period)}`, { credentials: "include" });
    if (response.status === 401) {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = buildLocalizedPath(`/signin/loginView?returnUrl=${returnUrl}`, `/en/signin/loginView?returnUrl=${returnUrl}`);
      return;
    }
    const body = await responseJson(response);
    if (!response.ok) throw new Error(body.message || (en ? "Could not load tasks." : "업무를 불러오지 못했습니다."));
    setData(body);
  }

  useEffect(() => { void load().catch((error) => setMessage(error.message)); }, [status, period]);

  async function startTask(task: Task) {
    setBusyTask(task.id);
    setMessage("");
    try {
      const response = await fetch(`${api}/${task.id}/status`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      const body = await responseJson(response);
      if (!response.ok) throw new Error(body.message || (en ? "The task could not be started." : "업무를 시작할 수 없습니다."));
      await load();
    } finally { setBusyTask(null); }
  }

  function isSafeTaskTarget(task: Task) {
    return Boolean(task.targetUrl && task.targetUrl.startsWith("/") && task.targetUrl !== "#" && !task.targetUrl.startsWith("/admin/"));
  }

  function taskHref(task: Task) {
    const safeTarget = isSafeTaskTarget(task) ? task.targetUrl : `/emission/project/detail?id=${encodeURIComponent(task.projectId)}`;
    const target = new URL(safeTarget, window.location.origin);
    target.searchParams.set("projectId", task.projectId);
    target.searchParams.set("taskId", String(task.id));
    const path = `${target.pathname}${target.search}`;
    return buildLocalizedPath(path, `/en${path}`);
  }

  const nextTask = useMemo(() => data?.items.find((item) => item.actionable && item.status !== "DONE") || null, [data]);
  const focusProjectTasks = useMemo(() => nextTask ? data?.items.filter((item) => item.projectId === nextTask.projectId) || [] : [], [data, nextTask]);
  const completionPercent = data?.summary.total ? Math.round((data.summary.completed / data.summary.total) * 100) : 0;
  const statusLabel = (value: string) => (en ? STATUS_EN : STATUS_KO)[value] || value;

  return <>
    <HomeInlineStyles en={en} />
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center px-4 lg:px-8">
          <HeaderBrand content={content} en={en} />
          <HeaderDesktopNav en={en} homeMenu={home.value?.homeMenu || []} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <nav className="text-sm font-bold text-slate-500">{en ? "Carbon Emission Management / My Tasks" : "탄소배출 관리 / 내 업무"}</nav>
        <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-black text-[#246beb]">{data?.allVisible ? (en ? "Administrator work queue" : "관리자 전체 업무 큐") : `${data?.actorId || "-"} · ${en ? "Assigned work" : "배정 업무"}`}</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#052b57]">{en ? "My Tasks" : "내 업무"}</h1>
            <p className="mt-2 max-w-3xl text-slate-600">{en ? "Complete the next actionable task, its evidence, and completion rule. The following task opens automatically." : "지금 실행할 업무와 필수 증적·완료 조건을 확인하십시오. 업무가 완료되면 다음 단계가 자동으로 열립니다."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex min-h-11 items-center rounded-lg border border-[#246beb] bg-white px-4 font-bold text-[#246beb]" href={buildLocalizedPath("/emission/project_list", "/en/emission/project_list")}>{en ? "All projects" : "전체 프로젝트"}</a>
            <a className="inline-flex min-h-11 items-center rounded-lg bg-[#052b57] px-4 font-bold text-white" href={buildLocalizedPath("/emission/project/create", "/en/emission/project/create")}>{en ? "New project" : "새 프로젝트 등록"}</a>
          </div>
        </div>

        {message && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-800" role="alert">{message}</div>}

        <section className="mt-7 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="bg-gradient-to-br from-[#052b57] to-[#164b7d] p-6 text-white lg:p-8">
              <p className="text-sm font-black text-blue-200">{en ? "NEXT ACTION" : "다음 실행 업무"}</p>
              {nextTask ? <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black">{nextTask.projectName}</span>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black">{nextTask.site || (en ? "No site" : "사업장 미지정")}</span>
                  <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">{en ? nextTask.priority : PRIORITY_KO[nextTask.priority] || nextTask.priority}</span>
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-[-0.03em]">{nextTask.name}</h2>
                <p className="mt-2 text-sm leading-6 text-blue-100">{nextTask.completionRule || (en ? "Complete the required data and evidence for this process step." : "이 단계의 필수 데이터와 증적을 모두 갖추어 완료하십시오.")}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {nextTask.status === "READY" && <button className="min-h-11 rounded-lg bg-white px-5 font-black text-[#052b57] disabled:opacity-60" disabled={busyTask === nextTask.id} onClick={() => void startTask(nextTask).catch((error) => setMessage(error.message))} type="button">{busyTask === nextTask.id ? (en ? "Starting…" : "시작 중…") : (en ? "Start task" : "업무 시작")}</button>}
                  {isSafeTaskTarget(nextTask) ? <a className="inline-flex min-h-11 items-center rounded-lg border border-white/60 px-5 font-black text-white" href={taskHref(nextTask)}>{en ? "Open workspace →" : "업무 화면 열기 →"}</a> : <span className="inline-flex min-h-11 items-center rounded-lg border border-amber-200 bg-amber-100 px-5 font-black text-amber-950">{en ? "Workspace connection required" : "업무 화면 연결 필요"}</span>}
                </div>
              </> : <div className="mt-4"><h2 className="text-2xl font-black">{en ? "No actionable task" : "현재 실행 가능한 업무가 없습니다"}</h2><p className="mt-2 text-blue-100">{en ? "Review waiting tasks or create a project." : "대기 업무의 선행조건을 확인하거나 새 프로젝트를 등록하십시오."}</p></div>}
            </div>
            <div className="flex flex-col justify-center p-6">
              <div className="flex items-end justify-between"><span className="text-sm font-bold text-slate-500">{en ? "Overall completion" : "전체 업무 완료율"}</span><strong className="text-3xl text-[#052b57]">{completionPercent}%</strong></div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#246beb]" style={{ width: `${completionPercent}%` }} /></div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">{en ? "Assignee" : "담당자"}</dt><dd className="mt-1 font-black">{nextTask?.assignee || "-"}</dd></div><div><dt className="text-slate-500">{en ? "Due" : "마감일"}</dt><dd className="mt-1 font-black">{nextTask?.dueDate || "-"}</dd></div></dl>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [en ? "All tasks" : "전체 업무", data?.summary.total || 0, "assignment"],
            [en ? "Due today" : "오늘 마감", data?.summary.today || 0, "today"],
            [en ? "Overdue" : "지연", data?.summary.overdue || 0, "warning"],
            [en ? "Awaiting approval" : "승인 대기", data?.summary.approval || 0, "approval"],
            [en ? "Completed" : "완료", data?.summary.completed || 0, "task_alt"],
          ].map(([label, value, icon]) => <article className="rounded-xl border border-slate-200 bg-white p-5" key={String(label)}><div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-500">{label}</p><span className="material-symbols-outlined text-slate-400">{icon}</span></div><strong className="mt-2 block text-3xl text-[#052b57]">{value}</strong></article>)}
        </section>

        {focusProjectTasks.length > 0 && <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-black text-[#246beb]">{focusProjectTasks[0].projectName}</p><h2 className="mt-1 text-xl font-black text-[#052b57]">{en ? "Project workflow" : "프로젝트 업무 흐름"}</h2></div><span className="text-sm font-bold text-slate-500">{en ? "Click an available step to continue" : "실행 가능한 단계를 선택해 계속 진행하십시오"}</span></div>
          <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{focusProjectTasks.map((task, index) => <li className={`relative rounded-xl border p-4 ${task.actionable ? "border-blue-300 bg-blue-50" : task.status === "DONE" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`} key={task.id}><div className="flex items-center justify-between"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-[#052b57]">{index + 1}</span><span className={`rounded-full px-2 py-1 text-[11px] font-black ${STATUS_STYLE[task.status] || STATUS_STYLE.WAITING}`}>{statusLabel(task.status)}</span></div><h3 className="mt-3 font-black leading-5">{task.name}</h3><p className="mt-2 text-xs leading-5 text-slate-600">{task.pendingPredecessors ? `${en ? "Waiting for" : "선행 업무"}: ${task.pendingPredecessors}` : task.actorCode || task.assignee}</p></li>)}</ol>
        </section>}

        <section className="mt-7">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end"><div><h2 className="text-xl font-black text-[#052b57]">{en ? "Assigned task queue" : "배정 업무 목록"}</h2><p className="mt-1 text-sm text-slate-600">{en ? "Completion is recorded only by the actual business action, not by manually checking a task." : "업무 완료는 임의 체크가 아니라 실제 제출·산정·검증·승인 결과로 기록됩니다."}</p></div><div className="flex flex-wrap gap-2"><select aria-label={en ? "Due date filter" : "마감일 필터"} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setPeriod(event.target.value)} value={period}><option value="">{en ? "All dates" : "전체 일정"}</option><option value="TODAY">{en ? "Due today" : "오늘 마감"}</option><option value="WEEK">{en ? "This week" : "이번 주"}</option><option value="OVERDUE">{en ? "Overdue" : "지연"}</option></select><select aria-label={en ? "Status filter" : "상태 필터"} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">{en ? "All statuses" : "전체 상태"}</option>{["READY", "IN_PROGRESS", "WAITING", "BLOCKED", "DONE"].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></div></div>

          <div className="mt-4 grid gap-4">{data?.items.map((task) => {
            const overdue = new Date(task.dueDate) < new Date() && task.status !== "DONE";
            return <article className={`rounded-xl border bg-white p-5 ${task.actionable ? "border-blue-300 shadow-sm" : "border-slate-200"}`} key={task.id}>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px_180px] lg:items-center">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${STATUS_STYLE[task.status] || STATUS_STYLE.WAITING}`}>{statusLabel(task.status)}</span><span className="text-xs font-black text-slate-500">{en ? task.priority : PRIORITY_KO[task.priority] || task.priority}</span><span className="text-xs font-bold text-slate-400">{task.processStepCode || task.type}</span></div><h3 className="mt-3 text-lg font-black text-[#052b57]">{task.name}</h3><p className="mt-1 text-sm font-bold text-[#246beb]">{task.projectName} · {task.site || "-"}</p><p className="mt-3 text-sm leading-6 text-slate-600"><strong>{en ? "Completion rule" : "완료 조건"}: </strong>{task.completionRule || "-"}</p>{(task.pendingPredecessors || task.blockedReason) && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">{task.pendingPredecessors ? `${en ? "Prerequisites" : "선행 업무"}: ${task.pendingPredecessors}` : task.blockedReason}</p>}</div>
                <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-1"><div><dt className="text-slate-500">{en ? "Assignee / Actor" : "담당자 / 액터"}</dt><dd className="mt-1 font-black">{task.assignee || "-"} <span className="font-medium text-slate-500">{task.actorCode ? `· ${task.actorCode}` : ""}</span></dd></div><div><dt className="text-slate-500">{en ? "Due date" : "마감일"}</dt><dd className={`mt-1 font-black ${overdue ? "text-rose-700" : ""}`}>{task.dueDate || "-"}{overdue ? (en ? " · overdue" : " · 지연") : ""}</dd></div></dl>
                <div className="flex flex-col gap-2">{task.actionable ? <>{task.status === "READY" && <button className="min-h-11 rounded-lg border border-[#246beb] bg-white px-4 font-black text-[#246beb] disabled:opacity-60" disabled={busyTask === task.id} onClick={() => void startTask(task).catch((error) => setMessage(error.message))} type="button">{en ? "Start" : "업무 시작"}</button>}{isSafeTaskTarget(task) ? <a className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#246beb] px-4 font-black text-white" href={taskHref(task)}>{en ? "Open task" : "업무 화면 열기"}</a> : <span className="rounded-lg bg-amber-100 px-3 py-3 text-center text-xs font-black text-amber-900">{en ? "Workspace connection required" : "업무 화면 연결 필요"}</span>}</> : <span className="rounded-lg bg-slate-100 px-3 py-3 text-center text-xs font-bold text-slate-600">{task.status === "DONE" ? (en ? "Completed by business action" : "실제 업무 처리로 완료됨") : (en ? "Complete prerequisites first" : "선행 업무 완료 필요")}</span>}<a className="text-center text-sm font-bold text-slate-600 underline" href={buildLocalizedPath(`/emission/project/detail?id=${task.projectId}`, `/en/emission/project/detail?id=${task.projectId}`)}>{en ? "Project details" : "프로젝트 상세"}</a></div>
              </div>
            </article>;
          })}</div>
          {!data?.items.length && <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center"><span className="material-symbols-outlined text-4xl text-slate-400">task_alt</span><p className="mt-3 font-bold text-slate-600">{en ? "No tasks match the selected filters." : "선택한 조건에 해당하는 업무가 없습니다."}</p></div>}
        </section>
      </main>
    </div>
  </>;
}
