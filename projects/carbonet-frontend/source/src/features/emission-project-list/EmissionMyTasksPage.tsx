import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CommonContentCard,
  CommonDataTable,
  CommonStatusBadge,
} from "../../components/common-design/CommonDesignPrimitives";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import screenContract from "./emissionMyTasksScreen.contract.json";

type Task = {
  id: number;
  taskCode?: string;
  stepOrder?: number;
  projectId: string;
  projectName: string;
  site: string;
  name: string;
  type: string;
  status: string;
  priority: string;
  assignee: string;
  dueDate: string;
  targetUrl: string;
  processCode?: string;
  processName?: string;
  processStepCode?: string;
  actorCode?: string;
  domainCode?: string;
  completionRule?: string;
  blockedReason?: string;
  pendingPredecessors?: string;
  actionable?: boolean;
  completionSatisfied?: boolean;
  completionEvidence?: string;
  nextTaskName?: string;
  nextActorCode?: string;
  workPurpose?: string;
  requiredInputs?: unknown;
  expectedOutput?: unknown;
  commandCode?: string;
};

type WorkflowNotification = {
  id: number;
  projectId: string;
  taskId: number;
  eventType: string;
  title: string;
  message: string;
  targetUrl?: string;
  readAt?: string;
  createdAt: string;
};

type RuntimeScope = {
  domainCode?: string;
  workTypeName?: string;
  coverageStatus?: string;
  taskLedger?: string;
};

type Data = {
  items: Task[];
  actorId: string;
  allVisible: boolean;
  assignmentManager?: boolean;
  runtimeScope?: RuntimeScope;
  summary: { total: number; completed: number; today: number; overdue: number; approval: number; serverDate?: string };
  notifications: WorkflowNotification[];
  unreadNotificationCount: number;
};

type LocaleText = { ko: string; en: string };
type PriorityFactor = (typeof screenContract.priorityModel.factors)[number];

const EMPTY_TASKS: Task[] = [];
const STATUS_STYLE: Record<string, string> = {
  READY: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  WAITING: "bg-slate-100 text-slate-700",
  BLOCKED: "bg-rose-100 text-rose-800",
  DONE: "bg-emerald-100 text-emerald-800",
};
const STATUS_KO: Record<string, string> = {
  READY: "실행 가능",
  IN_PROGRESS: "진행 중",
  WAITING: "대기",
  BLOCKED: "차단",
  DONE: "완료",
};
const STATUS_EN: Record<string, string> = {
  READY: "Ready",
  IN_PROGRESS: "In progress",
  WAITING: "Waiting",
  BLOCKED: "Blocked",
  DONE: "Done",
};
const PRIORITY_KO: Record<string, string> = { URGENT: "긴급", HIGH: "높음", NORMAL: "보통", LOW: "낮음" };

function localized(value: LocaleText, en: boolean) {
  return en ? value.en : value.ko;
}

async function responseJson(response: Response, en: boolean): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(en ? `Unexpected server response. (${response.status})` : `서버 응답 형식이 올바르지 않습니다. (${response.status})`);
  }
  return response.json();
}

function errorMessage(error: unknown, en: boolean) {
  return error instanceof Error ? error.message : (en ? "An unknown error occurred." : "알 수 없는 오류가 발생했습니다.");
}

function kstDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dueHours(task: Task) {
  if (!task.dueDate) return Number.POSITIVE_INFINITY;
  const dateKey = task.dueDate.slice(0, 10);
  const value = new Date(`${dateKey}T23:59:59+09:00`).getTime();
  return Number.isFinite(value) ? (value - Date.now()) / 3_600_000 : Number.POSITIVE_INFINITY;
}

function isOverdue(task: Task) {
  return task.status !== "DONE" && dueHours(task) < 0;
}

function factorValues(task: Task, source: string) {
  const record = task as unknown as Record<string, unknown>;
  return source.split(",").map((path) => record[path.trim().replace(/^task\./, "")]);
}

function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value != null && value !== false;
}

function factorScore(task: Task, factor: PriorityFactor) {
  const values = factorValues(task, factor.source);
  const hours = dueHours(task);
  let ratio = 0;

  switch (factor.rule) {
    case "DUE_WINDOW":
      ratio = !Number.isFinite(hours) ? 0 : hours <= 4 ? 1 : hours <= 24 ? 0.8 : hours <= 72 ? 0.45 : 0.15;
      break;
    case "PRIORITY_BAND": {
      const priorityRatio: Record<string, number> = { URGENT: 1, HIGH: 0.72, NORMAL: 0.4, LOW: 0.2 };
      ratio = priorityRatio[String(values[0] || "").toUpperCase()] || 0;
      break;
    }
    case "OVERDUE_WINDOW":
      ratio = hours < -72 ? 1 : hours < -24 ? 0.7 : hours < 0 ? 0.4 : 0;
      break;
    case "BLOCKED_OR_HAS_REASON":
      ratio = String(values[0] || "").toUpperCase() === "BLOCKED" || hasValue(values[1]) ? 1 : 0;
      break;
    case "HAS_PENDING_PREDECESSORS":
      ratio = hasValue(values[0]) ? 1 : 0;
      break;
    default:
      ratio = 0;
  }

  return factor.weight * ratio;
}

function priorityScore(task: Task) {
  const score = screenContract.priorityModel.factors.reduce((total, factor) => total + factorScore(task, factor), 0);
  return Math.min(100, Math.max(0, Math.round(score)));
}

function priorityBand(score: number) {
  const bands = Object.entries(screenContract.priorityModel.bands as Record<string, number>)
    .sort((left, right) => right[1] - left[1]);
  return bands.find(([, threshold]) => score >= threshold)?.[0] || "P3";
}

function displayContract(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatActivityTime(value: string, en: boolean) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(en ? "en-US" : "ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function EmissionMyTasksPage() {
  const en = isEnglish();
  const [data, setData] = useState<Data | null>(null);
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("");
  const [project, setProject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyTask, setBusyTask] = useState<number | null>(null);
  const loadSequence = useRef(0);
  const api = buildLocalizedPath("/home/api/emission-tasks", "/en/home/api/emission-tasks");

  const load = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${api}?status=${encodeURIComponent(status)}&period=${encodeURIComponent(period)}`, {
        credentials: "include",
        signal: signal,
      });
      if (response.status === 401) {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = buildLocalizedPath(`/signin/loginView?returnUrl=${returnUrl}`, `/en/signin/loginView?returnUrl=${returnUrl}`);
        return;
      }
      const body = await responseJson(response, en) as Data & { message?: string };
      if (!response.ok) throw new Error(body.message || (en ? "Could not load tasks." : "업무를 불러오지 못했습니다."));
      if (sequence === loadSequence.current && !signal?.aborted) setData(body);
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return;
      if (sequence === loadSequence.current) setMessage(errorMessage(error, en));
    } finally {
      if (sequence === loadSequence.current && !signal?.aborted) setLoading(false);
    }
  }, [api, en, period, status]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function startTask(task: Task) {
    setBusyTask(task.id);
    setMessage("");
    try {
      const response = await fetch(`${api}/${task.id}/status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      const body = await responseJson(response, en) as { message?: string };
      if (!response.ok) throw new Error(body.message || (en ? "The task could not be started." : "업무를 시작할 수 없습니다."));
      await load();
    } finally {
      setBusyTask(null);
    }
  }

  async function readNotification(notification: WorkflowNotification) {
    const response = await fetch(
      buildLocalizedPath(`/home/api/emission-task-notifications/${notification.id}/read`, `/en/home/api/emission-task-notifications/${notification.id}/read`),
      { method: "POST", credentials: "include" },
    );
    const body = await responseJson(response, en) as { message?: string };
    if (!response.ok) throw new Error(body.message || (en ? "Could not mark the notification as read." : "알림을 읽음 처리하지 못했습니다."));
    await load();
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

  const allItems = data?.items ?? EMPTY_TASKS;
  const runtimeScopeCode = (data?.runtimeScope?.domainCode || screenContract.runtimeScope).toUpperCase();
  const scopedItems = useMemo(
    () => runtimeScopeCode === screenContract.runtimeScope ? allItems : EMPTY_TASKS,
    [allItems, runtimeScopeCode],
  );
  const projects = useMemo(
    () => [...new Map(scopedItems.map((task) => [task.projectId, task.projectName])).entries()],
    [scopedItems],
  );
  const visibleItems = useMemo(
    () => scopedItems
      .filter((task) => !project || task.projectId === project)
      .sort((left, right) => priorityScore(right) - priorityScore(left) || Number(left.stepOrder || 0) - Number(right.stepOrder || 0)),
    [project, scopedItems],
  );
  const nextTask = visibleItems.find((item) => item.actionable && item.status !== "DONE") || null;
  const workflowTask = nextTask || visibleItems[0] || scopedItems[0] || null;
  const focusProjectTasks = useMemo(
    () => workflowTask
      ? scopedItems.filter((item) => item.projectId === workflowTask.projectId)
        .sort((left, right) => Number(left.stepOrder || 0) - Number(right.stepOrder || 0))
      : EMPTY_TASKS,
    [scopedItems, workflowTask],
  );
  const completionPercent = data?.summary.total
    ? Math.min(100, Math.round((data.summary.completed / data.summary.total) * 100))
    : 0;
  const statusLabel = (value: string) => (en ? STATUS_EN : STATUS_KO)[value] || value;
  const todayKey = data?.summary.serverDate || kstDateKey();
  const metrics = {
    needsAction: visibleItems.filter((task) => task.status !== "DONE").length,
    dueToday: visibleItems.filter((task) => task.status !== "DONE" && task.dueDate?.slice(0, 10) === todayKey).length,
    overdue: visibleItems.filter(isOverdue).length,
    inProgress: visibleItems.filter((task) => task.status === "IN_PROGRESS").length,
    blocked: visibleItems.filter((task) => task.status === "BLOCKED" || Boolean(task.blockedReason)).length,
  };
  const actors = [...new Set(visibleItems.map((task) => task.actorCode).filter(Boolean))];
  const risks = [
    {
      icon: "schedule",
      label: en ? "Overdue tasks" : "지연 업무",
      value: metrics.overdue,
      detail: en ? "Actual due date has passed and status is not Done." : "실제 마감일이 지났고 완료 상태가 아닙니다.",
      valueClass: "text-rose-700",
    },
    {
      icon: "person_off",
      label: en ? "No explicit assignment" : "명시 배정 없음",
      value: visibleItems.filter((task) => !String(task.assignee || "").trim()).length,
      detail: en ? "The task ledger has no assignee account for the step." : "업무 원장에 해당 단계의 담당 계정이 등록되지 않았습니다.",
      valueClass: "text-amber-700",
    },
    {
      icon: "block",
      label: en ? "Blocked state" : "차단 상태",
      value: metrics.blocked,
      detail: en ? "The task is Blocked or has a server-provided blocked reason." : "업무가 차단 상태이거나 서버 차단 사유가 있습니다.",
      valueClass: "text-blue-700",
    },
  ];

  function openFullWorkflow() {
    window.dispatchEvent(new CustomEvent("resonance:task-guide-focus", {
      detail: {
        processCode: workflowTask?.processCode || "EMISSION_PROJECT",
        stepCode: workflowTask?.processStepCode || "",
        projectId: workflowTask?.projectId || "",
        openOverview: true,
      },
    }));
  }

  const loadState = loading ? "loading" : message ? "error" : visibleItems.length ? "ready" : "empty";
  const scopeName = data?.runtimeScope?.workTypeName || (en ? "Carbon emissions management" : "탄소배출 관리");
  const priorityLabel = localized(screenContract.priorityModel.label, en);
  const priorityDisclosure = localized(screenContract.priorityModel.disclosure, en);

  return <div
    className="min-h-screen bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)]"
    data-my-work-summary=""
    data-page-id={screenContract.pageId}
    data-screen-contract={screenContract.templateCode}
    data-runtime-scope={screenContract.runtimeScope}
    data-load-state={loadState}
  >
    <main className="krds-responsive-container py-8" aria-busy={loading}>
      <nav className="gov-text-label font-bold text-slate-500" aria-label={en ? "Breadcrumb" : "현재 위치"}>
        {en ? "My Work / My Work Summary" : "내 업무 / 내 업무 요약"}
      </nav>
      <header className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="gov-text-label font-black text-[var(--kr-gov-blue)]">
            {data?.allVisible
              ? (en ? "Administrator work queue" : "관리자 전체 업무 큐")
              : `${data?.actorId || "-"} · ${actors.join(" · ") || (en ? "Assigned work" : "배정 업무")}`}
          </p>
          <h1 className="gov-text-heading-lg mt-1 font-black tracking-[-0.04em] text-[#052b57]">
            {localized(screenContract.screenName, en)}
          </h1>
          <p className="gov-text-body-sm mt-2 max-w-3xl text-slate-600">{localized(screenContract.objective, en)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="krds-button rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-blue)] bg-white font-black text-[var(--kr-gov-blue)] disabled:opacity-60"
            disabled={loading}
            onClick={() => void load()}
            type="button"
          >
            <span className="material-symbols-outlined mr-2" aria-hidden="true">refresh</span>
            {loading ? (en ? "Refreshing…" : "새로고침 중…") : (en ? "Refresh" : "새로고침")}
          </button>
          <button
            className="krds-button rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] font-black text-white"
            onClick={openFullWorkflow}
            type="button"
          >
            {en ? "View all work" : "전체 업무 보기"}
          </button>
        </div>
      </header>

      <div className="sr-only" aria-live="polite" role="status">
        {loading ? (en ? "Loading emission tasks." : "배출 업무를 불러오는 중입니다.") : (en ? "Emission tasks loaded." : "배출 업무를 불러왔습니다.")}
      </div>
      {message && <div className="mt-5 rounded-[var(--kr-gov-radius)] border border-rose-200 bg-rose-50 p-4 font-bold text-rose-800" role="alert" aria-live="assertive">{message}</div>}

      <section
        className="mt-6"
        data-section-code="WORK_CONTEXT"
        data-my-work-section="WORK_CONTEXT"
        data-my-work-work-context=""
        data-help-id="emission-my-tasks-work-context"
        aria-labelledby="my-work-context-heading"
      >
        <CommonContentCard className="krds-component p-5">
          <div className="flex flex-col gap-4">
            <div>
              <p className="gov-text-caption font-black tracking-[0.08em] text-[var(--kr-gov-blue)]">01 WORK CONTEXT</p>
              <h2 className="gov-text-heading-sm mt-1 font-black text-[#052b57]" id="my-work-context-heading">{en ? "Work context" : "업무 문맥"}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="gov-text-label block font-bold text-slate-700">{en ? "Work scope" : "업무 범위"}</span>
                <span className="mt-2 inline-flex min-h-11 w-full items-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 font-black">
                  {scopeName} · {runtimeScopeCode}
                </span>
              </div>
              <label className="gov-text-label block font-bold text-slate-700" htmlFor="my-work-project">
                {en ? "Project" : "프로젝트"}
                <select className="krds-select mt-2 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white" id="my-work-project" onChange={(event) => setProject(event.target.value)} value={project}>
                  <option value="">{en ? "All" : "전체"}</option>
                  {projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
              <label className="gov-text-label block font-bold text-slate-700" htmlFor="my-work-period">
                {en ? "Period" : "기간"}
                <select className="krds-select mt-2 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white" id="my-work-period" onChange={(event) => setPeriod(event.target.value)} value={period}>
                  <option value="">{en ? "All" : "전체"}</option>
                  <option value="TODAY">{en ? "Today" : "오늘"}</option>
                  <option value="WEEK">{en ? "This week" : "이번 주"}</option>
                  <option value="OVERDUE">{en ? "Overdue" : "지연"}</option>
                </select>
              </label>
              <label className="gov-text-label block font-bold text-slate-700" htmlFor="my-work-status">
                {en ? "Status" : "상태"}
                <select className="krds-select mt-2 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white" id="my-work-status" onChange={(event) => setStatus(event.target.value)} value={status}>
                  <option value="">{en ? "All" : "전체"}</option>
                  {["READY", "IN_PROGRESS", "WAITING", "BLOCKED", "DONE"].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
                </select>
              </label>
            </div>
            <p className="gov-text-body-sm text-slate-600">
              <strong>{en ? "Account" : "계정"}:</strong> {data?.actorId || "-"} · <strong>{en ? "Active actors" : "활성 액터"}:</strong> {actors.join(", ") || "-"} · <strong>{en ? "Visible projects" : "노출 프로젝트"}:</strong> {projects.length}{en ? " projects" : "개"}
              {data?.runtimeScope?.taskLedger ? <> · <strong>{en ? "Task ledger" : "업무 원장"}:</strong> {data.runtimeScope.taskLedger}</> : null}
            </p>
          </div>
        </CommonContentCard>
      </section>

      <section
        className="mt-6"
        data-section-code="TODAY_STATUS"
        data-my-work-section="TODAY_STATUS"
        data-my-work-today-status=""
        data-help-id="emission-my-tasks-today-status"
        aria-labelledby="my-work-today-heading"
      >
        <p className="gov-text-caption font-black tracking-[0.08em] text-[var(--kr-gov-blue)]">02 TODAY STATUS</p>
        <h2 className="gov-text-heading-sm mt-1 font-black text-[#052b57]" id="my-work-today-heading">{en ? "Today's work status" : "오늘의 업무 상태"}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [en ? "Needs action" : "처리 필요", metrics.needsAction, "assignment", "text-blue-800"],
            [en ? "Due today" : "오늘 마감", metrics.dueToday, "today", "text-indigo-800"],
            [en ? "Overdue" : "지연", metrics.overdue, "warning", "text-rose-700"],
            [en ? "In progress" : "진행 중", metrics.inProgress, "pending_actions", "text-emerald-800"],
            [en ? "Blocked" : "차단", metrics.blocked, "block", "text-amber-800"],
          ].map(([label, value, icon, color]) => <CommonContentCard className="krds-component p-5" key={String(label)}>
            <div className="flex items-center justify-between">
              <p className="gov-text-label font-bold text-slate-500">{label}</p>
              <span className={`material-symbols-outlined ${color}`} aria-hidden="true">{icon}</span>
            </div>
            <strong className={`gov-text-heading-lg mt-2 block ${color}`}>{value}</strong>
          </CommonContentCard>)}
        </div>
      </section>

      <section
        className="mt-7 overflow-hidden rounded-[var(--kr-gov-radius)] border border-blue-200 bg-white shadow-sm"
        data-section-code="NEXT_ACTION"
        data-my-work-section="NEXT_ACTION"
        data-my-work-next-action=""
        data-primary-task-id={nextTask?.id ?? ""}
        data-help-id="emission-my-tasks-next-action"
        aria-labelledby="my-work-next-action-heading"
      >
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bg-gradient-to-br from-[#052b57] to-[#164b7d] p-6 text-white lg:p-8">
            <p className="gov-text-label font-black text-blue-200">03 {en ? "FIRST ACTION" : "가장 먼저 할 일"}</p>
            {nextTask ? <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950" title={priorityDisclosure}>
                  {priorityBand(priorityScore(nextTask))} · {priorityScore(nextTask)} {en ? "estimated" : "추정"}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black">{nextTask.projectName}</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black">{nextTask.actorCode || "-"}</span>
              </div>
              <h2 className="gov-text-heading-md mt-4 font-black" id="my-work-next-action-heading">{nextTask.name}</h2>
              <p className="gov-text-body-sm mt-2 text-blue-100">{nextTask.workPurpose || nextTask.completionRule || "-"}</p>
              <dl className="mt-4 grid gap-3 gov-text-label text-blue-50 md:grid-cols-2">
                <div><dt className="font-black">{en ? "Required input" : "필수 입력"}</dt><dd className="mt-1 break-all">{displayContract(nextTask.requiredInputs)}</dd></div>
                <div><dt className="font-black">{en ? "Expected output" : "기대 출력"}</dt><dd className="mt-1 break-all">{displayContract(nextTask.expectedOutput)}</dd></div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                {nextTask.status === "READY" && <button
                  className="krds-button rounded-[var(--kr-gov-radius)] bg-white font-black text-[#052b57] disabled:opacity-60"
                  disabled={busyTask === nextTask.id || loading}
                  onClick={() => void startTask(nextTask).catch((error) => setMessage(errorMessage(error, en)))}
                  type="button"
                >
                  {busyTask === nextTask.id ? (en ? "Starting…" : "시작 중…") : (en ? "Start task" : "업무 시작")}
                </button>}
                {isSafeTaskTarget(nextTask) ? <a className="krds-button inline-flex items-center rounded-[var(--kr-gov-radius)] border border-white/60 font-black text-white" href={taskHref(nextTask)}>{en ? "Open workspace →" : "업무 화면 열기 →"}</a> : <span className="rounded-[var(--kr-gov-radius)] bg-amber-100 px-4 py-3 font-black text-amber-950">{en ? "Workspace connection required" : "업무 화면 연결 필요"}</span>}
              </div>
            </> : <div className="mt-4">
              <h2 className="gov-text-heading-md font-black" id="my-work-next-action-heading">{en ? "No actionable task" : "현재 실행 가능한 업무가 없습니다"}</h2>
              <p className="gov-text-body-sm mt-2 text-blue-100">{en ? "Review the server-provided prerequisites and assignment scope." : "서버가 제공한 선행조건과 배정 범위를 확인하십시오."}</p>
            </div>}
          </div>
          <div className="flex flex-col justify-center p-6">
            <div className="flex items-end justify-between gap-3">
              <span className="gov-text-label font-bold text-slate-500">{en ? "All emission tasks completion (not affected by filters)" : "전체 배출 업무 완료율(현재 필터와 무관)"}</span>
              <strong className="gov-text-heading-lg text-[#052b57]">{completionPercent}%</strong>
            </div>
            <div
              className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-label={en ? "All emission tasks completion" : "전체 배출 업무 완료율"}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completionPercent}
            >
              <div className="h-full rounded-full bg-[var(--kr-gov-blue)]" style={{ width: `${completionPercent}%` }} />
            </div>
            <dl className="mt-5 grid gap-3 gov-text-label">
              <div><dt className="text-slate-500">{en ? "Due date" : "마감일"}</dt><dd className="mt-1 font-black">{nextTask?.dueDate || "-"}</dd></div>
              <div><dt className="text-slate-500">{en ? "Completion rule" : "완료 조건"}</dt><dd className="mt-1 font-bold leading-6">{nextTask?.completionRule || "-"}</dd></div>
              <div>
                <dt className="text-slate-500">{en ? "Registered next step (may change after execution)" : "등록된 다음 단계(실행 결과에 따라 변경)"}</dt>
                <dd className="mt-1 font-black">{nextTask?.nextTaskName || "-"} · {nextTask?.nextActorCode || "-"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section
        className="mt-7"
        data-section-code="TASK_QUEUE"
        data-my-work-section="TASK_QUEUE"
        data-my-work-task-queue=""
        data-help-id="emission-my-tasks-task-queue"
        aria-labelledby="my-work-queue-heading"
      >
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="gov-text-caption font-black tracking-[0.08em] text-[var(--kr-gov-blue)]">04 TASK QUEUE</p>
            <h2 className="gov-text-heading-sm mt-1 font-black text-[#052b57]" id="my-work-queue-heading">{en ? "My action queue" : "내 처리 대기함"}</h2>
            <p className="gov-text-body-sm mt-1 text-slate-600"><strong>{priorityLabel}:</strong> {priorityDisclosure}</p>
          </div>
          <strong className="self-start rounded-full bg-blue-100 px-3 py-2 gov-text-label text-blue-800">{visibleItems.length}{en ? " tasks" : "건"}</strong>
        </div>
        <CommonContentCard className="mt-4 overflow-hidden">
          <div className="min-w-[1120px]">
            <CommonDataTable label={en ? "Emission work action queue" : "배출 업무 처리 대기함"}>
              <caption className="sr-only">{en ? "Task priority estimate, process, project, actor, status, due date and action" : "업무 추정 우선순위, 프로세스, 프로젝트, 액터, 상태, 마감일과 실행 항목"}</caption>
              <thead className="bg-[#052b57] text-white">
                <tr>
                  {(en
                    ? ["Estimated priority", "Work", "Process / step", "Project", "Assignee / actor", "Status", "Due", "Action"]
                    : ["추정 우선", "업무", "프로세스 / 단계", "프로젝트", "담당계정 / 액터", "상태", "마감", "실행"]
                  ).map((label) => <th className="px-4 py-4 font-black" key={label} scope="col">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((task) => {
                  const score = priorityScore(task);
                  const overdue = isOverdue(task);
                  return <tr className="border-t border-slate-200 align-top hover:bg-blue-50" data-task-id={task.id} key={task.id}>
                    <td className="px-4 py-4"><CommonStatusBadge className={score >= 80 ? "bg-rose-100 text-rose-800" : score >= 60 ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}>{priorityBand(score)} · {score} {en ? "est." : "추정"}</CommonStatusBadge></td>
                    <td className="px-4 py-4"><strong className="text-[#052b57]">{task.name}</strong><p className="mt-1 text-xs text-slate-500">{task.workPurpose || task.type}</p></td>
                    <td className="px-4 py-4"><strong>{task.processName || task.processCode || "-"}</strong><p className="mt-1 text-xs text-slate-500">{task.stepOrder || "-"}. {task.processStepCode || task.taskCode || "-"}</p></td>
                    <td className="px-4 py-4"><strong>{task.projectName}</strong><p className="mt-1 text-xs text-slate-500">{task.site || "-"}</p></td>
                    <td className="px-4 py-4"><strong>{task.assignee || "-"}</strong><p className="mt-1 text-xs text-slate-500">{task.actorCode || "-"}</p></td>
                    <td className="px-4 py-4"><CommonStatusBadge className={STATUS_STYLE[task.status] || STATUS_STYLE.WAITING}>{statusLabel(task.status)}</CommonStatusBadge>{task.blockedReason && <p className="mt-2 max-w-44 text-xs font-bold text-rose-700">{task.blockedReason}</p>}</td>
                    <td className={`px-4 py-4 font-black ${overdue ? "text-rose-700" : ""}`}>{task.dueDate || "-"}{overdue && <p className="mt-1 text-xs">{en ? "Overdue" : "지연"}</p>}</td>
                    <td className="px-4 py-4">{task.actionable && isSafeTaskTarget(task) ? <a className="krds-button inline-flex items-center rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] font-black text-white" href={taskHref(task)}>{en ? "Open" : "업무 열기"}</a> : <span className="text-xs font-bold text-slate-500">{task.status === "DONE" ? (en ? "Completed" : "완료") : (en ? "Prerequisite required" : "선행 업무 필요")}</span>}</td>
                  </tr>;
                })}
              </tbody>
            </CommonDataTable>
          </div>
          {!visibleItems.length && <p className="p-12 text-center font-bold text-slate-600">{loading ? (en ? "Loading tasks…" : "업무를 불러오는 중…") : (en ? "No tasks match the selected context." : "선택한 업무 문맥에 해당하는 업무가 없습니다.")}</p>}
        </CommonContentCard>
      </section>

      <section
        className="mt-7"
        data-section-code="PROCESS_PROGRESS"
        data-my-work-section="PROCESS_PROGRESS"
        data-my-work-process-progress=""
        data-help-id="emission-my-tasks-process-progress"
        aria-labelledby="my-work-progress-heading"
      >
        <CommonContentCard className="krds-component p-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="gov-text-caption font-black tracking-[0.08em] text-[var(--kr-gov-blue)]">05 PROCESS PROGRESS</p>
              <h2 className="gov-text-heading-sm mt-1 font-black text-[#052b57]" id="my-work-progress-heading">{en ? "Process progress" : "프로세스 진행 현황"}</h2>
              <p className="gov-text-body-sm mt-1 font-bold text-slate-600">{focusProjectTasks[0] ? `${focusProjectTasks[0].projectName} · ${focusProjectTasks[0].processName || focusProjectTasks[0].processCode || "-"}` : (en ? "No project process is available in the current scope." : "현재 범위에 표시할 프로젝트 프로세스가 없습니다.")}</p>
            </div>
            <button className="krds-button self-start rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-blue)] font-black text-[var(--kr-gov-blue)]" onClick={openFullWorkflow} type="button">{en ? "View full workflow" : "프로세스 전체 보기"}</button>
          </div>
          {focusProjectTasks.length ? <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {focusProjectTasks.map((task, index) => <li className={`rounded-[var(--kr-gov-radius)] border p-4 ${task.actionable ? "border-blue-300 bg-blue-50" : task.status === "DONE" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`} key={task.id}>
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-[#052b57]">{index + 1}</span>
                <CommonStatusBadge className={STATUS_STYLE[task.status] || STATUS_STYLE.WAITING}>{statusLabel(task.status)}</CommonStatusBadge>
              </div>
              <h3 className="mt-3 font-black leading-5">{task.name}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">{task.assignee || "-"} · {task.actorCode || "-"}</p>
              {task.pendingPredecessors && <p className="mt-2 text-xs font-bold text-rose-700">{en ? "Waiting for" : "선행"}: {task.pendingPredecessors}</p>}
            </li>)}
          </ol> : <p className="mt-5 rounded-[var(--kr-gov-radius)] border border-dashed border-slate-300 bg-slate-50 p-8 text-center font-bold text-slate-600">{loading ? (en ? "Loading process progress…" : "프로세스 진행 현황을 불러오는 중…") : (en ? "No process steps are available for the selected context." : "선택한 문맥에 표시할 프로세스 단계가 없습니다.")}</p>}
          <p className="gov-text-body-sm mt-4 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 p-4 font-bold text-amber-950">
            {en ? "The sequence shown comes from the registered task ledger. The next step may change based on execution results, correction needs, authority and prerequisites." : "표시된 순서는 등록 업무 원장 기준입니다. 실제 다음 단계는 실행 결과·보완 여부·권한·선행조건에 따라 변경될 수 있습니다."}
          </p>
        </CommonContentCard>
      </section>

      <section
        className="mt-7"
        data-section-code="RISKS"
        data-my-work-section="RISKS"
        data-my-work-risks=""
        data-help-id="emission-my-tasks-risks"
        aria-labelledby="my-work-risks-heading"
      >
        <p className="gov-text-caption font-black tracking-[0.08em] text-[var(--kr-gov-blue)]">06 RISKS &amp; EXCEPTIONS</p>
        <h2 className="gov-text-heading-sm mt-1 font-black text-[#052b57]" id="my-work-risks-heading">{en ? "Delays, risks and exceptions" : "지연·위험·예외"}</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {risks.map((risk) => <CommonContentCard className="krds-component p-5" key={risk.label}>
            <div className="flex items-start justify-between">
              <div><p className="gov-text-label font-bold text-slate-500">{risk.label}</p><strong className={`gov-text-heading-lg mt-2 block ${risk.valueClass}`}>{risk.value}</strong></div>
              <span className="material-symbols-outlined text-3xl text-slate-400" aria-hidden="true">{risk.icon}</span>
            </div>
            <p className="gov-text-body-sm mt-3 text-slate-600">{risk.detail}</p>
          </CommonContentCard>)}
        </div>
      </section>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <section
          data-section-code="HANDOFF_ACTIVITY"
          data-my-work-section="HANDOFF_ACTIVITY"
          data-my-work-handoff-activity=""
          data-help-id="emission-my-tasks-handoff-activity"
          aria-labelledby="my-work-handoff-heading"
        >
          <CommonContentCard className="krds-component h-full p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="gov-text-caption font-black tracking-[0.08em] text-[var(--kr-gov-blue)]">07 HANDOFF ACTIVITY</p>
                <h2 className="gov-text-heading-sm mt-1 font-black text-[#052b57]" id="my-work-handoff-heading">{en ? "Recent handoffs and activity" : "최근 인계와 활동"}</h2>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-2 gov-text-label font-black text-amber-900">{data?.unreadNotificationCount || 0} {en ? "unread" : "미확인"}</span>
            </div>
            <div className="mt-4 divide-y divide-slate-200">
              {(data?.notifications || []).slice(0, 5).map((notification) => <article className="py-4" key={notification.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-[#052b57]">{notification.title}</h3>
                    <p className="gov-text-body-sm mt-1 text-slate-600">{notification.message}</p>
                    <time className="mt-1 block text-xs text-slate-500" dateTime={notification.createdAt}>{formatActivityTime(notification.createdAt, en)}</time>
                  </div>
                  {!notification.readAt && <button className="krds-button shrink-0 rounded-[var(--kr-gov-radius)] border border-amber-400 font-black text-amber-900 disabled:opacity-60" disabled={loading} onClick={() => void readNotification(notification).catch((error) => setMessage(errorMessage(error, en)))} type="button">{en ? "Mark read" : "읽음"}</button>}
                </div>
              </article>)}
              {!data?.notifications?.length && <p className="py-8 text-center gov-text-label font-bold text-slate-500">{loading ? (en ? "Loading activity…" : "활동을 불러오는 중…") : (en ? "No recent handoff activity." : "최근 인계 활동이 없습니다.")}</p>}
            </div>
          </CommonContentCard>
        </section>

        <section
          data-section-code="NEXT_GUIDANCE"
          data-my-work-section="NEXT_GUIDANCE"
          data-my-work-next-guidance=""
          data-help-id="emission-my-tasks-next-guidance"
          aria-labelledby="my-work-guidance-heading"
        >
          <CommonContentCard className="krds-component h-full border-blue-200 bg-blue-50 p-6">
            <p className="gov-text-caption font-black tracking-[0.08em] text-[var(--kr-gov-blue)]">08 NEXT GUIDANCE</p>
            <h2 className="gov-text-heading-sm mt-1 font-black text-[#052b57]" id="my-work-guidance-heading">{en ? "What may happen next" : "다음 업무 안내"}</h2>
            <p className="gov-text-body-sm mt-4 text-slate-700">
              {nextTask
                ? nextTask.nextTaskName
                  ? (en ? `The registered next-step candidate after “${nextTask.name}” is “${nextTask.nextTaskName}” (${nextTask.nextActorCode || "actor not registered"}). Execution results, authority and prerequisites may change it.` : `“${nextTask.name}” 이후 등록된 다음 단계 후보는 “${nextTask.nextTaskName}”(${nextTask.nextActorCode || "액터 미등록"})입니다. 실행 결과·권한·선행조건에 따라 변경될 수 있습니다.`)
                  : (en ? `“${nextTask.name}” is actionable, but the API has not registered a following step.` : `“${nextTask.name}”은 실행 가능하지만 API에 후속 단계가 등록되어 있지 않습니다.`)
                : (en ? "There is no actionable task in the current scope." : "현재 범위에는 실행 가능한 업무가 없습니다.")}
            </p>
            <button className="krds-button mt-5 rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] font-black text-white" onClick={openFullWorkflow} type="button">{en ? "Open work overview" : "전체 업무 보기"}</button>
          </CommonContentCard>
        </section>
      </div>
    </main>
  </div>;
}
