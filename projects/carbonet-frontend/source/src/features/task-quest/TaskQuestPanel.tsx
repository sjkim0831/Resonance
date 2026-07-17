import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

type QuestTask = {
  id: number;
  projectId: string;
  projectName: string;
  name: string;
  status: string;
  priority: string;
  dueDate: string;
  targetUrl: string;
  actorCode?: string;
  processCode?: string;
  processStepCode?: string;
  completionRule?: string;
  entryState?: string;
  workPurpose?: string;
  requiredInputs?: string;
  expectedOutput?: string;
  commandCode?: string;
  nextTaskName?: string;
  nextActorCode?: string;
  nextTaskUrl?: string;
  blockedReason?: string;
  pendingPredecessors?: string;
  actionable?: boolean;
};

type QuestResponse = {
  items?: QuestTask[];
  summary?: { total?: number; completed?: number; overdue?: number };
};

function dueLabel(value: string, en: boolean) {
  if (!value) return en ? "No deadline" : "기한 미설정";
  const due = new Date(`${value}T23:59:59`);
  if (Number.isNaN(due.getTime())) return value;
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return en ? `${Math.abs(days)}d overdue` : `${Math.abs(days)}일 지연`;
  if (days === 0) return en ? "Due today" : "오늘 마감";
  return `D-${days}`;
}

function taskWeight(task: QuestTask) {
  const status = task.status === "IN_PROGRESS" ? 0 : task.status === "READY" ? 1 : 3;
  const actionable = task.actionable === false ? 2 : 0;
  const deadline = task.dueDate ? new Date(`${task.dueDate}T23:59:59`).getTime() : Number.MAX_SAFE_INTEGER;
  return [status + actionable, deadline];
}

function taskHref(task: QuestTask, en: boolean) {
  const base = task.targetUrl || "/emission/my-tasks";
  const glue = base.includes("?") ? "&" : "?";
  const target = `${base}${glue}projectId=${encodeURIComponent(task.projectId)}`;
  return en ? `/en${target}` : target;
}

function statusPresentation(task: QuestTask, en: boolean) {
  if (task.status === "DONE") return { label: en ? "Complete" : "완료", icon: "check", style: "border-emerald-400 bg-emerald-50 text-emerald-900" };
  if (task.status === "IN_PROGRESS") return { label: en ? "In progress" : "진행 중", icon: "play_arrow", style: "border-blue-500 bg-blue-50 text-blue-950" };
  if (task.actionable === false) return { label: en ? "Blocked" : "선행 대기", icon: "lock_clock", style: "border-slate-300 bg-slate-100 text-slate-600" };
  return { label: en ? "Ready" : "시작 가능", icon: "flag", style: "border-amber-400 bg-amber-50 text-amber-950" };
}

export function TaskQuestPanel() {
  const en = isEnglish();
  const api = buildLocalizedPath("/home/api/emission-tasks", "/en/home/api/emission-tasks");
  const [data, setData] = useState<QuestResponse | null>(null);
  const [open, setOpen] = useState(() => localStorage.getItem("task-quest-open") !== "0");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [flowOpen, setFlowOpen] = useState(false);

  async function load() {
    try {
      const response = await fetch(api, { credentials: "include" });
      if (response.status === 401 || response.status === 403) return;
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || (en ? "Unable to load tasks." : "업무를 불러오지 못했습니다."));
      setData(body);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [api]);

  useEffect(() => {
    if (!flowOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFlowOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [flowOpen]);

  const task = useMemo(() => {
    return [...(data?.items || [])]
      .filter((item) => item.status !== "DONE")
      .sort((a, b) => {
        const aw = taskWeight(a), bw = taskWeight(b);
        return aw[0] - bw[0] || aw[1] - bw[1];
      })[0];
  }, [data]);

  const processGroups = useMemo(() => {
    const groups = new Map<string, QuestTask[]>();
    (data?.items || []).forEach((item) => {
      const key = `${item.projectId}::${item.processCode || "PROCESS"}`;
      const items = groups.get(key) || [];
      items.push(item);
      groups.set(key, items);
    });
    return Array.from(groups.entries());
  }, [data]);

  if (!loading && !data) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    localStorage.setItem("task-quest-open", next ? "1" : "0");
  }

  async function startTask() {
    if (!task || task.actionable === false) return;
    setMessage("");
    try {
      if (task.status === "READY") {
        const response = await fetch(`${api}/${task.id}/status`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "IN_PROGRESS" })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || (en ? "Unable to start the task." : "업무를 시작하지 못했습니다."));
      }
      window.location.href = taskHref(task, en);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  const blocked = Boolean(task && task.actionable === false);
  const total = Number(data?.summary?.total || 0);
  const completed = Number(data?.summary?.completed || 0);
  const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return <>
    <aside className="fixed right-3 top-[6.75rem] z-[950] w-[calc(100vw-1.5rem)] max-w-[23rem] sm:right-5 lg:right-8" data-task-quest-panel="">
      {!open ? (
        <button className="ml-auto flex min-h-12 items-center gap-2 rounded-full border border-[#16408d] bg-white px-4 py-2 font-bold text-[#12356b] shadow-[0_10px_30px_rgba(15,43,87,.2)]" onClick={toggle} type="button">
          <span className="material-symbols-outlined text-[21px]">assistant_navigation</span>
          {en ? "My next task" : "다음 업무"}
          {task ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">1</span> : null}
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,43,87,.22)]">
          <div className="flex items-center justify-between bg-[#052b57] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[21px]">assistant_navigation</span>
              <strong>{en ? "Task navigator" : "업무 길잡이"}</strong>
            </div>
            <button aria-label={en ? "Collapse" : "접기"} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15" onClick={toggle} type="button"><span className="material-symbols-outlined">remove</span></button>
          </div>
          <div className="p-4">
            {loading ? <p className="py-5 text-center text-sm text-slate-500">{en ? "Loading your tasks..." : "담당 업무를 확인하고 있습니다."}</p> : task ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#246beb]">{task.projectName || task.projectId}</p>
                    <h2 className="mt-1 text-lg font-black leading-6 text-slate-900">{task.name}</h2>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${dueLabel(task.dueDate, en).includes(en ? "overdue" : "지연") ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-800"}`}>{dueLabel(task.dueDate, en)}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#246beb]" style={{ width: `${progress}%` }} /></div>
                <p className="mt-1 text-right text-xs font-bold text-slate-500">{en ? `${completed} of ${total} completed` : `전체 업무 ${total}개 중 ${completed}개 완료`}</p>
                <dl className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="flex gap-2"><dt className="w-16 shrink-0 font-bold text-slate-500">{en ? "Actor" : "담당 액터"}</dt><dd className="font-semibold text-slate-800">{task.actorCode || "-"}</dd></div>
                  <div className="flex gap-2"><dt className="w-16 shrink-0 font-bold text-slate-500">{en ? "Purpose" : "업무 목적"}</dt><dd className="line-clamp-2 text-slate-700">{task.workPurpose || task.name}</dd></div>
                  <div className="flex gap-2"><dt className="w-16 shrink-0 font-bold text-slate-500">{en ? "Done when" : "완료 조건"}</dt><dd className="line-clamp-2 text-slate-700">{task.completionRule || (en ? "Complete the required action on the task page." : "업무 화면의 필수 처리를 완료하세요.")}</dd></div>
                  {task.nextTaskName ? <div className="flex gap-2"><dt className="w-16 shrink-0 font-bold text-slate-500">{en ? "Next" : "다음 업무"}</dt><dd className="text-slate-700"><b>{task.nextTaskName}</b>{task.nextActorCode ? ` · ${task.nextActorCode}` : ""}</dd></div> : null}
                </dl>
                {blocked ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900"><span className="material-symbols-outlined mr-1 align-middle text-[18px]">lock_clock</span>{task.pendingPredecessors || task.blockedReason || (en ? "Complete the preceding task first." : "선행 업무를 먼저 완료해야 합니다.")}</p> : null}
                {message ? <p className="mt-3 text-sm font-bold text-red-700">{message}</p> : null}
                <button className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#246beb] px-4 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={blocked} onClick={() => void startTask()} type="button">
                  {task.status === "IN_PROGRESS" ? (en ? "Continue task" : "업무 계속하기") : (en ? "Start task" : "업무 시작하기")}
                  <span className="material-symbols-outlined text-[19px]">arrow_forward</span>
                </button>
              </>
            ) : <div className="py-4 text-center"><span className="material-symbols-outlined text-4xl text-emerald-600">task_alt</span><p className="mt-2 font-black text-slate-900">{en ? "All assigned tasks are complete." : "배정된 업무를 모두 완료했습니다."}</p></div>}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-bold">
              <button className="text-[#246beb] hover:underline" onClick={() => setFlowOpen(true)} type="button">{en ? "View full workflow" : "전체 업무 보기"}</button>
              <a className="flex items-center gap-1 text-slate-600 hover:text-[#246beb]" href={buildLocalizedPath("/support/inquiry", "/en/support/inquiry")}><span className="material-symbols-outlined text-[18px]">help</span>{en ? "Q&A" : "업무 질문"}</a>
            </div>
          </div>
        </div>
      )}
    </aside>
    {flowOpen ? createPortal(
      <div aria-labelledby="task-process-map-title" aria-modal="true" className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[2px] sm:p-6" role="dialog">
        <button aria-label={en ? "Close workflow" : "전체 업무 닫기"} className="absolute inset-0 cursor-default" onClick={() => setFlowOpen(false)} type="button" />
        <section className="relative flex max-h-[88vh] w-full max-w-[78rem] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7 sm:py-5">
            <div>
              <p className="text-sm font-bold text-[#246beb]">{en ? "Personal workflow guide" : "로그인 사용자 맞춤 업무 안내"}</p>
              <h2 className="mt-1 text-xl font-black text-[#052b57] sm:text-2xl" id="task-process-map-title">{en ? "My full task workflow" : "전체 업무 프로세스"}</h2>
              <p className="mt-1 text-sm text-slate-600">{en ? "Follow the flow from left to right. Select a task to open its working screen." : "왼쪽에서 오른쪽 순서로 진행합니다. 업무를 선택하면 해당 처리 화면으로 바로 이동합니다."}</p>
            </div>
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100" onClick={() => setFlowOpen(false)} type="button"><span className="material-symbols-outlined">close</span></button>
          </header>
          <div className="overflow-y-auto bg-slate-50 px-5 py-5 sm:px-7 sm:py-6">
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [en ? "Total" : "전체", total, "assignment"],
                [en ? "Complete" : "완료", completed, "task_alt"],
                [en ? "Remaining" : "남은 업무", Math.max(0, total - completed), "pending_actions"],
                [en ? "Progress" : "진행률", `${progress}%`, "monitoring"]
              ].map(([label, value, icon]) => <div className="rounded-xl border border-slate-200 bg-white p-3" key={String(label)}><span className="material-symbols-outlined text-[20px] text-[#246beb]">{icon}</span><p className="mt-1 text-xs font-bold text-slate-500">{label}</p><strong className="text-lg text-[#052b57]">{value}</strong></div>)}
            </div>
            {processGroups.length ? <div className="space-y-5">
              {processGroups.map(([key, items]) => {
                const first = items[0];
                return <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" key={key}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div><h3 className="font-black text-[#052b57]">{first.projectName || first.projectId}</h3><p className="text-xs font-semibold text-slate-500">{first.processCode || (en ? "Assigned process" : "배정 프로세스")} · {first.actorCode || (en ? "Assigned actor" : "담당 액터")}</p></div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{items.filter((item) => item.status === "DONE").length}/{items.length} {en ? "complete" : "완료"}</span>
                  </div>
                  <div className="overflow-x-auto pb-2">
                    <ol className="flex min-w-max items-stretch gap-0">
                      {items.map((item, index) => {
                        const state = statusPresentation(item, en);
                        return <li className="flex items-center" key={item.id}>
                          <a className={`group flex min-h-[9.5rem] w-[12.5rem] flex-col rounded-xl border-2 p-3 transition hover:-translate-y-0.5 hover:shadow-lg ${state.style}`} href={taskHref(item, en)}>
                            <div className="flex items-center justify-between gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black shadow-sm">{index + 1}</span><span className="flex items-center gap-1 text-xs font-black"><span className="material-symbols-outlined text-[16px]">{state.icon}</span>{state.label}</span></div>
                            <strong className="mt-3 line-clamp-2 text-sm leading-5">{item.name}</strong>
                            <span className="mt-auto pt-2 text-xs font-bold opacity-75">{dueLabel(item.dueDate, en)}</span>
                            <span className="mt-1 flex items-center gap-1 text-xs font-black text-[#246beb] opacity-0 transition group-hover:opacity-100">{en ? "Open screen" : "화면 바로가기"}<span className="material-symbols-outlined text-[15px]">open_in_new</span></span>
                          </a>
                          {index < items.length - 1 ? <span aria-hidden="true" className="material-symbols-outlined mx-2 text-3xl text-slate-300">arrow_forward</span> : null}
                        </li>;
                      })}
                    </ol>
                  </div>
                </article>;
              })}
            </div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center font-bold text-slate-500">{en ? "No assigned workflow was found." : "현재 계정에 배정된 업무 프로세스가 없습니다."}</div>}
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
            <p className="hidden text-sm text-slate-500 sm:block">{en ? "Blocked tasks can be opened for guidance, but require preceding tasks to be completed." : "선행 대기 업무도 안내 확인을 위해 열 수 있으며, 실제 완료에는 선행 업무 처리가 필요합니다."}</p>
            <div className="ml-auto flex gap-2"><a className="rounded-lg border border-[#246beb] px-4 py-2.5 text-sm font-bold text-[#246beb]" href={buildLocalizedPath("/support/inquiry", "/en/support/inquiry")}>{en ? "Ask a question" : "업무 질문"}</a><button className="rounded-lg bg-[#052b57] px-4 py-2.5 text-sm font-bold text-white" onClick={() => setFlowOpen(false)} type="button">{en ? "Close" : "닫기"}</button></div>
          </footer>
        </section>
      </div>, document.body
    ) : null}
  </>;
}
