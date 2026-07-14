import { useEffect, useMemo, useState } from "react";
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
  completionRule?: string;
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

export function TaskQuestPanel() {
  const en = isEnglish();
  const api = buildLocalizedPath("/home/api/emission-tasks", "/en/home/api/emission-tasks");
  const [data, setData] = useState<QuestResponse | null>(null);
  const [open, setOpen] = useState(() => localStorage.getItem("task-quest-open") !== "0");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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

  const task = useMemo(() => {
    return [...(data?.items || [])]
      .filter((item) => item.status !== "DONE")
      .sort((a, b) => {
        const aw = taskWeight(a), bw = taskWeight(b);
        return aw[0] - bw[0] || aw[1] - bw[1];
      })[0];
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
      const base = task.targetUrl || "/emission/my-tasks";
      const glue = base.includes("?") ? "&" : "?";
      const target = `${base}${glue}projectId=${encodeURIComponent(task.projectId)}`;
      window.location.href = buildLocalizedPath(target, `/en${target}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  const blocked = Boolean(task && task.actionable === false);
  const total = Number(data?.summary?.total || 0);
  const completed = Number(data?.summary?.completed || 0);
  const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <aside className="fixed right-3 top-[4.75rem] z-[950] w-[calc(100vw-1.5rem)] max-w-[23rem] sm:right-5 lg:right-8" data-task-quest-panel="">
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
                  <div className="flex gap-2"><dt className="w-16 shrink-0 font-bold text-slate-500">{en ? "Done when" : "완료 조건"}</dt><dd className="line-clamp-2 text-slate-700">{task.completionRule || (en ? "Complete the required action on the task page." : "업무 화면의 필수 처리를 완료하세요.")}</dd></div>
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
              <a className="text-[#246beb] hover:underline" href={buildLocalizedPath("/emission/my-tasks", "/en/emission/my-tasks")}>{en ? "View all tasks" : "전체 업무 보기"}</a>
              <a className="flex items-center gap-1 text-slate-600 hover:text-[#246beb]" href={buildLocalizedPath("/support/inquiry", "/en/support/inquiry")}><span className="material-symbols-outlined text-[18px]">help</span>{en ? "Q&A" : "업무 질문"}</a>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
