import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

type QuestTask = {
  id: number;
  taskCode?: string;
  stepOrder?: number;
  projectId: string;
  projectName: string;
  name: string;
  status: string;
  priority: string;
  dueDate: string;
  targetUrl: string;
  actorCode?: string;
  processCode?: string;
  processName?: string;
  domainCode?: string;
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
  actorActionable?: boolean;
  completionSatisfied?: boolean;
  completionEvidence?: string;
};

type QuestResponse = {
  items?: QuestTask[];
  workflows?: QuestTask[];
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
  const url = new URL(base, window.location.origin);
  if (!url.searchParams.has("projectId") && !url.searchParams.has("id")) {
    url.searchParams.set("projectId", task.projectId);
  }
  const target = `${url.pathname}${url.search}${url.hash}`;
  return en ? `/en${target}` : target;
}

function statusPresentation(task: QuestTask, en: boolean) {
  if (task.status === "DONE") return { label: en ? "Complete" : "완료", icon: "check", style: "border-emerald-400 bg-emerald-50 text-emerald-900" };
  if (task.status === "IN_PROGRESS") return { label: en ? "In progress" : "진행 중", icon: "play_arrow", style: "border-blue-500 bg-blue-50 text-blue-950" };
  if (task.actionable === false) return { label: en ? "Blocked" : "선행 대기", icon: "lock_clock", style: "border-slate-300 bg-slate-100 text-slate-600" };
  return { label: en ? "Ready" : "시작 가능", icon: "flag", style: "border-amber-400 bg-amber-50 text-amber-950" };
}

function workTypeLabel(code: string, en: boolean) {
  const normalized = String(code || "COMMON").toUpperCase();
  const labels: Record<string, [string, string]> = {
    EMISSION: ["탄소배출 관리", "Carbon Emissions"],
    CARBON_EMISSION: ["탄소배출 관리", "Carbon Emissions"],
    LCA: ["제품 LCA", "Product LCA"],
    REDUCTION: ["감축 관리", "Reduction Management"],
    MONITORING: ["모니터링·분석", "Monitoring & Analytics"],
    TRADE: ["탄소·자원 거래", "Carbon & Resource Trading"],
    CERTIFICATE: ["보고서·인증", "Reports & Certificates"],
    EDUCATION: ["교육·지원", "Education & Support"],
    MEMBER: ["회원·기업·권한", "Members & Organizations"],
    SYSTEM: ["시스템 운영", "System Operations"],
    COMMON: ["공통 업무", "Common Tasks"]
  };
  const matched = Object.entries(labels).find(([key]) => normalized === key || normalized.includes(key));
  return matched ? matched[1][en ? 1 : 0] : code || labels.COMMON[en ? 1 : 0];
}

export function TaskQuestPanel() {
  const en = isEnglish();
  const api = buildLocalizedPath("/home/api/emission-tasks", "/en/home/api/emission-tasks");
  const [data, setData] = useState<QuestResponse | null>(null);
  const [open, setOpen] = useState(() => localStorage.getItem("task-quest-open") === "1");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [flowOpen, setFlowOpen] = useState(false);
  const [selectedWorkType, setSelectedWorkType] = useState(() => localStorage.getItem("task-quest-work-type") || "ALL");
  const [focusedWorkflow, setFocusedWorkflow] = useState<{ projectId: string; processCode: string } | null>(() => {
    try {
      const value = JSON.parse(localStorage.getItem("task-quest-focused-workflow") || "null");
      return value?.projectId && value?.processCode ? value : null;
    } catch {
      return null;
    }
  });

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

  const contextProjectId = new URLSearchParams(location.search).get("projectId")
    || new URLSearchParams(location.search).get("id")
    || "";

  const task = useMemo(() => {
    const pending = [...(data?.items || [])].filter((item) => item.status !== "DONE");
    const focused = focusedWorkflow ? pending.filter((item) => item.projectId === focusedWorkflow.projectId && item.processCode === focusedWorkflow.processCode) : [];
    const contextual = contextProjectId ? pending.filter((item) => item.projectId === contextProjectId) : [];
    return [...(focused.length ? focused : contextual.length ? contextual : pending)]
      .sort((a, b) => {
        const aw = taskWeight(a), bw = taskWeight(b);
        return aw[0] - bw[0] || aw[1] - bw[1];
      })[0];
  }, [contextProjectId, data, focusedWorkflow]);

  const workflowItems = useMemo(() => {
    const source = data?.workflows || data?.items || [];
    const scoped = contextProjectId ? source.filter((item) => item.projectId === contextProjectId) : source;
    const unique = new Map<string, QuestTask>();
    scoped.forEach((item) => {
      const businessKey = item.processStepCode || item.taskCode || `${item.commandCode || "TASK"}:${item.targetUrl || ""}`;
      const key = `${item.projectId}|${item.processCode || "PROJECT"}|${businessKey}`;
      if (!unique.has(key)) unique.set(key, item);
    });
    return [...unique.values()].sort((a, b) => a.projectId.localeCompare(b.projectId) || String(a.processCode || "").localeCompare(String(b.processCode || "")) || Number(a.stepOrder || 0) - Number(b.stepOrder || 0));
  }, [contextProjectId, data]);

  const availableWorkTypes = useMemo(() => {
    const counts = new Map<string, number>();
    workflowItems.forEach((item) => {
      const code = String(item.domainCode || "EMISSION").toUpperCase();
      counts.set(code, (counts.get(code) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => workTypeLabel(a[0], en).localeCompare(workTypeLabel(b[0], en)));
  }, [en, workflowItems]);

  useEffect(() => {
    if (selectedWorkType !== "ALL" && !availableWorkTypes.some(([code]) => code === selectedWorkType)) {
      setSelectedWorkType("ALL");
      localStorage.setItem("task-quest-work-type", "ALL");
    }
  }, [availableWorkTypes, selectedWorkType]);

  const selectedWorkflowItems = useMemo(() => selectedWorkType === "ALL"
    ? workflowItems
    : workflowItems.filter((item) => String(item.domainCode || "EMISSION").toUpperCase() === selectedWorkType), [selectedWorkType, workflowItems]);

  const processGroups = useMemo(() => {
    const groups = new Map<string, QuestTask[]>();
    selectedWorkflowItems.forEach((item) => {
      const key = `${item.projectId}|${item.processCode || "PROJECT_WORKFLOW"}`;
      const items = groups.get(key) || [];
      items.push(item);
      groups.set(key, items);
    });
    return Array.from(groups.entries());
  }, [selectedWorkflowItems]);

  if (!loading && !data) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    localStorage.setItem("task-quest-open", next ? "1" : "0");
  }

  function focusWorkflow(item: QuestTask) {
    if (!item.projectId || !item.processCode) return;
    const domainCode = String(item.domainCode || "EMISSION").toUpperCase();
    const next = { projectId: item.projectId, processCode: item.processCode };
    setFocusedWorkflow(next);
    setSelectedWorkType(domainCode);
    localStorage.setItem("task-quest-focused-workflow", JSON.stringify(next));
    localStorage.setItem("task-quest-work-type", domainCode);
    setOpen(true);
    setFlowOpen(false);
  }

  function selectWorkType(code: string) {
    setSelectedWorkType(code);
    localStorage.setItem("task-quest-work-type", code);
  }

  function clearWorkflowFocus() {
    setFocusedWorkflow(null);
    localStorage.removeItem("task-quest-focused-workflow");
  }

  async function activateTask(selected: QuestTask) {
    if (selected.actionable === false) return;
    setMessage("");
    focusWorkflow(selected);
    try {
      if (selected.status === "READY") {
        const response = await fetch(`${api}/${selected.id}/status`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "IN_PROGRESS" })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || (en ? "Unable to start the task." : "업무를 시작하지 못했습니다."));
      }
      window.location.href = taskHref(selected, en);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function startTask() {
    if (!task || task.actionable === false) return;
    setMessage("");
    focusWorkflow(task);
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
  const focusedTasks = focusedWorkflow ? (data?.items || []).filter((item) => item.projectId === focusedWorkflow.projectId && item.processCode === focusedWorkflow.processCode) : [];
  const total = focusedTasks.length || Number(data?.summary?.total || 0);
  const completed = focusedTasks.length ? focusedTasks.filter((item) => item.status === "DONE").length : Number(data?.summary?.completed || 0);
  const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const workflowTotal = selectedWorkflowItems.length;
  const workflowCompleted = selectedWorkflowItems.filter((item) => item.status === "DONE").length;
  const workflowProgress = workflowTotal > 0 ? Math.min(100, Math.round((workflowCompleted / workflowTotal) * 100)) : 0;

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
                    {focusedWorkflow ? <p className="mt-1 text-xs font-semibold text-slate-500">{task.processName || task.processCode} · {en ? "Focused workflow" : "선택 프로세스 진행 중"}</p> : null}
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
                {focusedWorkflow ? <button className="mt-2 w-full text-xs font-bold text-slate-500 hover:text-[#246beb]" onClick={clearWorkflowFocus} type="button">{en ? "Return to automatic recommendations" : "자동 업무 추천으로 돌아가기"}</button> : null}
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
            <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-wide text-[#246beb]">{en ? "Step 1 · Select work type" : "1단계 · 업무 종류 선택"}</p><h3 className="mt-1 text-lg font-black text-[#052b57]">{en ? "Available work types" : "현재 선택 가능한 업무 종류"}</h3><p className="mt-1 text-sm text-slate-600">{en ? "The popup lists every instantiated process in the selected category." : "선택한 종류에 실제 생성된 업무 프로세스를 빠짐없이 나열합니다."}</p></div><label className="text-sm font-bold text-slate-700">{en ? "Work type" : "업무 종류"}<select className="ml-2 min-h-10 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => selectWorkType(event.target.value)} value={selectedWorkType}><option value="ALL">{en ? "All work" : "전체 업무"} ({workflowItems.length})</option>{availableWorkTypes.map(([code, count]) => <option key={code} value={code}>{workTypeLabel(code, en)} ({count})</option>)}</select></label></div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1"><button className={`shrink-0 rounded-xl border px-4 py-3 text-left ${selectedWorkType === "ALL" ? "border-[#246beb] bg-blue-50 text-blue-900" : "border-slate-200 text-slate-700"}`} onClick={() => selectWorkType("ALL")} type="button"><strong className="block text-sm">{en ? "All work" : "전체 업무"}</strong><span className="text-xs">{workflowItems.length} {en ? "steps" : "단계"}</span></button>{availableWorkTypes.map(([code, count]) => <button className={`shrink-0 rounded-xl border px-4 py-3 text-left ${selectedWorkType === code ? "border-[#246beb] bg-blue-50 text-blue-900" : "border-slate-200 text-slate-700"}`} key={code} onClick={() => selectWorkType(code)} type="button"><strong className="block text-sm">{workTypeLabel(code, en)}</strong><span className="text-xs">{count} {en ? "steps" : "단계"} · {new Set(workflowItems.filter((item) => String(item.domainCode || "EMISSION").toUpperCase() === code).map((item) => `${item.projectId}|${item.processCode}`)).size} {en ? "processes" : "프로세스"}</span></button>)}</div>
            </section>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [en ? "Total" : "전체", workflowTotal, "assignment"],
                [en ? "Complete" : "완료", workflowCompleted, "task_alt"],
                [en ? "Remaining" : "남은 업무", Math.max(0, workflowTotal - workflowCompleted), "pending_actions"],
                [en ? "Progress" : "진행률", `${workflowProgress}%`, "monitoring"]
              ].map(([label, value, icon]) => <div className="rounded-xl border border-slate-200 bg-white p-3" key={String(label)}><span className="material-symbols-outlined text-[20px] text-[#246beb]">{icon}</span><p className="mt-1 text-xs font-bold text-slate-500">{label}</p><strong className="text-lg text-[#052b57]">{value}</strong></div>)}
            </div>
            <div className="mb-3"><p className="text-xs font-black uppercase tracking-wide text-[#246beb]">{en ? "Step 2 · Select a process" : "2단계 · 업무 프로세스 선택"}</p><h3 className="mt-1 text-lg font-black text-[#052b57]">{selectedWorkType === "ALL" ? (en ? "All available processes" : "전체 업무 프로세스") : workTypeLabel(selectedWorkType, en)}</h3><p className="text-sm text-slate-600">{processGroups.length} {en ? "project-process workflows are available. Select Use in task guide to proceed in order." : "개의 프로젝트·프로세스 흐름이 있습니다. ‘업무 길잡이로 진행’을 선택하면 순서대로 진행합니다."}</p></div>
            {processGroups.length ? <div className="space-y-5">
              {processGroups.map(([key, items]) => {
                const first = items[0];
                const isFocused = focusedWorkflow?.projectId === first.projectId && focusedWorkflow?.processCode === first.processCode;
                return <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" key={key}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="w-full text-sm font-black text-[#246beb]">{first.processName || first.processCode || (en ? "Project workflow" : "프로젝트 업무")} · {items.length} {en ? "deduplicated steps" : "중복 제외 단계"}</div>
                    <button className={`rounded-lg border px-3 py-2 text-xs font-black ${isFocused ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-blue-300 text-blue-700"}`} onClick={() => focusWorkflow(first)} type="button">{isFocused ? (en ? "Guide selected" : "길잡이 선택됨") : (en ? "Use in task guide" : "업무 길잡이로 진행")}</button>
                    <div><h3 className="font-black text-[#052b57]">{first.projectName || first.projectId}</h3><p className="text-xs font-semibold text-slate-500">{en ? `${items.length}-step integrated workflow` : `${items.length}단계 통합 업무`} · {en ? `${new Set(items.map((item) => item.actorCode).filter(Boolean)).size} participating roles` : `참여 액터 ${new Set(items.map((item) => item.actorCode).filter(Boolean)).size}종`}</p></div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{items.filter((item) => item.status === "DONE").length}/{items.length} {en ? "complete" : "완료"}</span>
                  </div>
                  <div className="overflow-x-auto pb-2">
                    <ol className="flex min-w-max items-stretch gap-0">
                      {items.map((item, index) => {
                        const state = statusPresentation(item, en);
                        return <li className="flex items-center" key={item.id}>
                          <button className={`group flex min-h-[15rem] w-[15rem] flex-col rounded-xl border-2 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${state.style}`} onClick={() => item.actionable === false ? focusWorkflow(item) : void activateTask(item)} type="button">
                            <div className="flex items-center justify-between gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black shadow-sm">{index + 1}</span><span className="flex items-center gap-1 text-xs font-black"><span className="material-symbols-outlined text-[16px]">{state.icon}</span>{state.label}</span></div>
                            <strong className="mt-3 line-clamp-2 text-sm leading-5">{item.name}</strong>
                            <dl className="mt-2 space-y-1 text-[11px] leading-4 opacity-85"><div><dt className="inline font-black">{en ? "Actor" : "액터"}: </dt><dd className="inline">{item.actorCode || "-"}</dd></div><div><dt className="inline font-black">{en ? "Purpose" : "목적"}: </dt><dd className="inline line-clamp-2">{item.workPurpose || item.name}</dd></div><div><dt className="inline font-black">{en ? "Done" : "완료"}: </dt><dd className="inline line-clamp-2">{item.completionRule || "-"}</dd></div><div><dt className="inline font-black">{en ? "Input" : "입력"}: </dt><dd className="inline line-clamp-1">{item.requiredInputs || "-"}</dd></div><div><dt className="inline font-black">{en ? "Output" : "산출물"}: </dt><dd className="inline line-clamp-1">{item.expectedOutput || "-"}</dd></div></dl>
                            <span className="mt-auto pt-2 text-xs font-bold opacity-75">{dueLabel(item.dueDate, en)}</span>
                            <span className="mt-1 flex items-center gap-1 text-xs font-black text-[#246beb] opacity-0 transition group-hover:opacity-100">{en ? "Open screen" : "화면 바로가기"}<span className="material-symbols-outlined text-[15px]">open_in_new</span></span>
                          </button>
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
