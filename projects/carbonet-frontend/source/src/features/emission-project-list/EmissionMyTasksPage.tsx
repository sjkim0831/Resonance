import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmissionPageIntro } from "../emission-common/EmissionPageIntro";
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
  workTypeName?: string;
  processName?: string;
  stepName?: string;
};

type RuntimeScope = {
  domainCode?: string;
  workTypeName?: string;
  coverageStatus?: string;
  taskLedger?: string;
};

type WorkType = {
  workTypeCode: string;
  workTypeName: string;
  workTypeNameEn?: string;
  definedProcessCount?: number;
  activeProcessCount?: number;
  taskCount?: number;
};

type ProcessCatalogItem = {
  processCode: string;
  processName: string;
  domainCode?: string;
  targetUrl?: string;
  status?: string;
  ownerActorCode?: string;
  stepCount?: number;
};

type ProcessCatalogStep = {
  processCode: string;
  stepOrder: number;
  stepCode: string;
  stepName: string;
  actorCode?: string;
  fromState?: string;
  commandCode?: string;
  toState?: string;
  workPurpose?: string;
  completionRule?: string;
  inputContract?: unknown;
  outputContract?: unknown;
  userPath?: string;
  adminPath?: string;
  automationStatus?: string;
};

type ProcessAssignment = {
  projectId?: string;
  processCode: string;
  stepCode?: string;
  actorCode?: string;
  accountId?: string;
};

type DesignAssurance = {
  processCode: string;
  assuranceStatus?: string;
  designAccuracyScore?: number;
  actorContractGaps?: number;
  stateFlowGaps?: number;
  businessRuleGaps?: number;
  dataContractGaps?: number;
  routeGaps?: number;
  screenContractGaps?: number;
  apiContractGaps?: number;
  nextAction?: string;
};

type PageDesignCoverage = {
  processCode: string;
  pageDesignCount?: number;
  userPageCount?: number;
  adminPageCount?: number;
  fieldCount?: number;
  requiredFieldCount?: number;
  implementationFieldCount?: number;
  fieldContractGapCount?: number;
  implementationPendingPageCount?: number;
  handoffCount?: number;
  pageDesignStatus?: string;
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
  workTypes?: WorkType[];
  processCatalog?: ProcessCatalogItem[];
  processCatalogSteps?: ProcessCatalogStep[];
  processAssignments?: ProcessAssignment[];
  designAssurance?: DesignAssurance[];
  pageDesignCoverage?: PageDesignCoverage[];
};

type LocaleText = { ko: string; en: string };
type PriorityFactor = (typeof screenContract.priorityModel.factors)[number];
type DesignTab = "WORK" | "STEP" | "ACTOR" | "ASSIGNMENT";

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
const ACTOR_KO: Record<string, string> = {
  COMPANY_MANAGER: "기업 업무 관리자", LCA_SPECIALIST: "LCA 전문가", EMISSION_SPECIALIST: "배출량 전문가",
  EMISSION_MANAGER: "배출 업무 관리자", DATA_MANAGER: "데이터 관리자", PROJECT_MANAGER: "프로젝트 관리자",
  REVIEWER: "검토 담당자", APPROVER: "승인 담당자", AUDITOR: "감사 담당자", OPERATOR: "운영 담당자",
  ANALYST: "분석 담당자", SYSTEM_ADMIN: "시스템 관리자", PLATFORM_ADMIN: "플랫폼 관리자", USER: "일반 사용자",
};
const WORK_VIEWS = ["ALL", "TODO", "IN_PROGRESS", "MONITORING", "RECENT", "DONE", "RISK"] as const;
type WorkView = (typeof WORK_VIEWS)[number];
const WORK_VIEW_LABELS: Record<WorkView, LocaleText> = {
  ALL: { ko: "전체", en: "All" },
  TODO: { ko: "해야 할 업무", en: "To do" },
  IN_PROGRESS: { ko: "진행 중", en: "In progress" },
  MONITORING: { ko: "모니터링", en: "Monitoring" },
  RECENT: { ko: "최근 수행", en: "Recent" },
  DONE: { ko: "마감 완료", en: "Completed" },
  RISK: { ko: "지연·위험", en: "Delayed / risk" },
};

function localized(value: LocaleText, en: boolean) {
  return en ? value.en : value.ko;
}

function actorLabel(actorCode: string, en: boolean) {
  if (en) return actorCode;
  const code = String(actorCode || "").toUpperCase();
  if (!code) return "-";
  if (ACTOR_KO[code]) return ACTOR_KO[code];
  if (code.endsWith("_SPECIALIST")) return "전문가";
  if (code.endsWith("_MANAGER")) return "업무 관리자";
  if (code.endsWith("_REVIEWER")) return "검토 담당자";
  if (code.endsWith("_APPROVER")) return "승인 담당자";
  if (code.endsWith("_OPERATOR")) return "운영 담당자";
  if (code.endsWith("_AUDITOR")) return "감사 담당자";
  if (code.endsWith("_ANALYST")) return "분석 담당자";
  return "업무 담당자";
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

function matchesPeriod(task: Task, period: string) {
  if (!period) return true;
  if (period === "NO_DUE") return !task.dueDate;
  if (!task.dueDate) return false;
  const hours = dueHours(task);
  if (period === "TODAY") return hours >= 0 && hours <= 24;
  if (period === "WEEK") return hours >= 0 && hours <= 24 * 7;
  if (period === "MONTH") return hours >= 0 && hours <= 24 * 30;
  if (period === "OVERDUE") return isOverdue(task);
  return true;
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

function DesignField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="gov-text-label block font-bold text-slate-700"><span className="mb-2 block">{label}</span>{children}</label>;
}

export function EmissionMyTasksPage() {
  const en = isEnglish();
  const [taskScope, setTaskScope] = useState<"ALL" | "MINE">("ALL");
  const [data, setData] = useState<Data | null>(null);
  const [period, setPeriod] = useState("");
  const [project, setProject] = useState("");
  const [workType, setWorkType] = useState("ALL");
  const [processCode, setProcessCode] = useState("");
  const [screenPath, setScreenPath] = useState("");
  const [testActor, setTestActor] = useState("");
  const [testAccount, setTestAccount] = useState("");
  const [workView, setWorkView] = useState<WorkView>("ALL");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyTask, setBusyTask] = useState<number | null>(null);
  const [designTab, setDesignTab] = useState<DesignTab>("WORK");
  const [designBusy, setDesignBusy] = useState(false);
  const [designMessage, setDesignMessage] = useState("");
  const [workDraft, setWorkDraft] = useState({ processCode: "", processName: "", domainCode: "EMISSION", ownerActorCode: "", goal: "", startCondition: "", completionCondition: "" });
  const [stepDraft, setStepDraft] = useState({ stepCode: "", stepOrder: "1", stepName: "", actorCode: "", fromState: "READY", commandCode: "", toState: "DONE", completionRule: "", userPath: "", adminPath: "", inputContract: "{}", outputContract: "{}" });
  const [actorDraft, setActorDraft] = useState({ actorCode: "", actorName: "", purpose: "", capabilityCodes: "" });
  const [assignmentDraft, setAssignmentDraft] = useState({ accountId: "", actorCode: "", projectId: "*", dataScope: "*" });
  const loadSequence = useRef(0);
  const api = buildLocalizedPath("/home/api/emission-tasks", "/en/home/api/emission-tasks");
  const governanceApi = buildLocalizedPath("/admin/api/system/actor-process", "/en/admin/api/system/actor-process");

  const load = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setMessage("");
    try {
      const query = taskScope === "MINE" ? "?scope=mine&compact=true" : "?scope=all&compact=false";
      const response = await fetch(`${api}${query}`, {
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
  }, [api, en, taskScope]);

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

  async function readNotification(notification: WorkflowNotification, refresh = true) {
    const response = await fetch(
      buildLocalizedPath(`/home/api/emission-task-notifications/${notification.id}/read`, `/en/home/api/emission-task-notifications/${notification.id}/read`),
      { method: "POST", credentials: "include" },
    );
    const body = await responseJson(response, en) as { message?: string };
    if (!response.ok) throw new Error(body.message || (en ? "Could not mark the notification as read." : "알림을 읽음 처리하지 못했습니다."));
    if (refresh) await load();
  }

  function notificationHref(notification: WorkflowNotification) {
    if (!notification.targetUrl?.startsWith("/") || notification.targetUrl.startsWith("//") || notification.targetUrl.startsWith("/admin/")) return "";
    return buildLocalizedPath(notification.targetUrl, `/en${notification.targetUrl}`);
  }

  async function openNotification(notification: WorkflowNotification) {
    const href = notificationHref(notification);
    if (!href) return;
    if (!notification.readAt) await readNotification(notification, false);
    window.location.assign(href);
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
  const processes = useMemo(
    () => taskScope === "ALL" && data?.processCatalog?.length
      ? data.processCatalog
        .filter((item) => workType === "ALL" || String(item.domainCode || "EMISSION").toUpperCase() === workType)
        .map((item) => [item.processCode, item.processName] as [string, string])
      : [...new Map(scopedItems
        .filter((task) => workType === "ALL" || String(task.domainCode || "EMISSION").toUpperCase() === workType)
        .filter((task) => task.processCode)
        .map((task) => [String(task.processCode), task.processName || task.processCode || "-"])).entries()],
    [data?.processCatalog, scopedItems, taskScope, workType],
  );
  const screens = useMemo(
    () => [...new Map([
      ...(taskScope === "ALL" ? (data?.processCatalogSteps || [])
        .filter((step) => !processCode || step.processCode === processCode)
        .flatMap((step) => [
          ...(step.userPath ? [[step.userPath, `${step.stepName} · USER`] as [string, string]] : []),
          ...(step.adminPath ? [[step.adminPath, `${step.stepName} · ADMIN`] as [string, string]] : []),
        ]) : []),
      ...(taskScope === "ALL" ? (data?.processCatalog || [])
        .filter((item) => workType === "ALL" || String(item.domainCode || "EMISSION").toUpperCase() === workType)
        .filter((item) => !processCode || item.processCode === processCode)
        .filter((item) => Boolean(item.targetUrl))
        .map((item) => [String(item.targetUrl), item.processName] as [string, string]) : []),
      ...scopedItems
        .filter((task) => workType === "ALL" || String(task.domainCode || "EMISSION").toUpperCase() === workType)
        .filter((task) => !processCode || task.processCode === processCode)
        .filter((task) => isSafeTaskTarget(task))
        .map((task) => [task.targetUrl, task.name] as [string, string]),
    ]).entries()],
    [data?.processCatalog, data?.processCatalogSteps, processCode, scopedItems, taskScope, workType],
  );
  const visibleCatalog = useMemo(
    () => (data?.processCatalog || [])
      .filter((item) => workType === "ALL" || String(item.domainCode || "EMISSION").toUpperCase() === workType)
      .filter((item) => !processCode || item.processCode === processCode),
    [data?.processCatalog, processCode, workType],
  );
  const selectedProcess = useMemo(
    () => (data?.processCatalog || []).find((item) => item.processCode === processCode) || null,
    [data?.processCatalog, processCode],
  );
  const selectedStep = useMemo(
    () => (data?.processCatalogSteps || []).find((step) => step.processCode === processCode && (!screenPath || step.userPath === screenPath || step.adminPath === screenPath)) || null,
    [data?.processCatalogSteps, processCode, screenPath],
  );
  useEffect(() => {
    if (!selectedStep) return;
    setStepDraft({
      stepCode: selectedStep.stepCode || "",
      stepOrder: String(selectedStep.stepOrder || 1),
      stepName: selectedStep.stepName || "",
      actorCode: selectedStep.actorCode || "",
      fromState: selectedStep.fromState || "READY",
      commandCode: selectedStep.commandCode || "",
      toState: selectedStep.toState || "DONE",
      completionRule: selectedStep.completionRule || "",
      userPath: selectedStep.userPath || "",
      adminPath: selectedStep.adminPath || "",
      inputContract: JSON.stringify(selectedStep.inputContract || {}, null, 2),
      outputContract: JSON.stringify(selectedStep.outputContract || {}, null, 2),
    });
    setAssignmentDraft((current) => ({ ...current, actorCode: selectedStep.actorCode || current.actorCode }));
  }, [selectedStep]);
  useEffect(() => {
    if (workType !== "ALL") setWorkDraft((current) => ({ ...current, domainCode: workType }));
  }, [workType]);
  const selectedAudience = screenPath && selectedStep?.adminPath === screenPath ? "ADMIN" : "USER";
  const selectedAssurance = useMemo(
    () => (data?.designAssurance || []).find((item) => item.processCode === processCode) || null,
    [data?.designAssurance, processCode],
  );
  const selectedPageCoverage = useMemo(
    () => (data?.pageDesignCoverage || []).find((item) => item.processCode === processCode) || null,
    [data?.pageDesignCoverage, processCode],
  );
  const selectedAssignments = useMemo(
    () => (data?.processAssignments || []).filter((item) => !processCode || item.processCode === processCode),
    [data?.processAssignments, processCode],
  );
  const testActors = useMemo(
    () => [...new Set([
      ...(data?.processCatalogSteps || []).filter((item) => !processCode || item.processCode === processCode).map((item) => item.actorCode),
      ...selectedAssignments.map((item) => item.actorCode),
    ].filter(Boolean) as string[])].sort(),
    [data?.processCatalogSteps, processCode, selectedAssignments],
  );
  const testAccounts = useMemo(
    () => [...new Set(selectedAssignments.filter((item) => !testActor || item.actorCode === testActor).map((item) => item.accountId).filter(Boolean) as string[])].sort(),
    [selectedAssignments, testActor],
  );
  const projectBased = useMemo(
    () => Boolean(processCode) && (workType === "EMISSION" || selectedAssignments.some((item) => Boolean(item.projectId && item.projectId !== "*")) || scopedItems.some((item) => item.processCode === processCode && Boolean(item.projectId))),
    [processCode, scopedItems, selectedAssignments, workType],
  );
  const periodBased = useMemo(
    () => Boolean(processCode) && scopedItems.some((item) => item.processCode === processCode && Boolean(item.dueDate)),
    [processCode, scopedItems],
  );
  const recentTaskIds = useMemo(
    () => new Set((data?.notifications || []).map((item) => Number(item.taskId)).filter(Number.isFinite)),
    [data?.notifications],
  );
  const matchesWorkView = useCallback((task: Task, view: WorkView) => {
    if (view === "TODO") return task.status === "READY";
    if (view === "IN_PROGRESS") return task.status === "IN_PROGRESS";
    if (view === "MONITORING") return task.status === "WAITING" || Boolean(task.pendingPredecessors);
    if (view === "RECENT") return recentTaskIds.has(task.id);
    if (view === "DONE") return task.status === "DONE";
    if (view === "RISK") return task.status === "BLOCKED" || Boolean(task.blockedReason) || isOverdue(task);
    return true;
  }, [recentTaskIds]);
  const selectedContextItems = useMemo(
    () => scopedItems
      .filter((task) => workType === "ALL" || String(task.domainCode || "EMISSION").toUpperCase() === workType)
      .filter((task) => !processCode || task.processCode === processCode)
      .filter((task) => !screenPath || task.targetUrl === screenPath)
      .filter((task) => !project || task.projectId === project)
      .filter((task) => !testActor || task.actorCode === testActor)
      .filter((task) => !testAccount || task.assignee === testAccount)
      .filter((task) => matchesPeriod(task, period)),
    [period, processCode, project, scopedItems, screenPath, testAccount, testActor, workType],
  );
  const visibleItems = useMemo(
    () => selectedContextItems
      .filter((task) => matchesWorkView(task, workView))
      .sort((left, right) => priorityScore(right) - priorityScore(left) || Number(left.stepOrder || 0) - Number(right.stepOrder || 0)),
    [matchesWorkView, selectedContextItems, workView],
  );
  const workTypes: WorkType[] = data?.workTypes?.length ? data.workTypes : screenContract.workTypes;
  const workViewCounts = useMemo(() => Object.fromEntries(
    WORK_VIEWS.map((view) => [view, selectedContextItems.filter((task) => matchesWorkView(task, view)).length]),
  ) as Record<WorkView, number>, [matchesWorkView, selectedContextItems]);
  const nextTask = visibleItems.find((item) => item.actionable && item.status !== "DONE") || null;
  const workflowTask = nextTask || visibleItems[0] || selectedContextItems[0] || null;
  const focusProjectTasks = useMemo(
    () => workflowTask
      ? scopedItems.filter((item) => item.projectId === workflowTask.projectId && (!workflowTask.processCode || item.processCode === workflowTask.processCode))
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
    setTaskScope("ALL");
    setWorkType("ALL");
    setProcessCode("");
    setScreenPath("");
    setProject("");
    setTestActor("");
    setTestAccount("");
    setPeriod("ALL");
    setWorkView("ALL");
    window.dispatchEvent(new CustomEvent("resonance:task-guide-focus", {
      detail: {
        processCode: workflowTask?.processCode || "EMISSION_PROJECT",
        stepCode: workflowTask?.processStepCode || "",
        projectId: workflowTask?.projectId || "",
        openOverview: true,
      },
    }));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById("all-work-catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  async function saveDesign(endpoint: string, payload: Record<string, unknown>, successText: string) {
    setDesignBusy(true);
    setDesignMessage("");
    try {
      const response = await fetch(`${governanceApi}/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await responseJson(response, en) as { message?: string; processCode?: string };
      if (!response.ok) throw new Error(body.message || (en ? "The design could not be saved." : "설계를 저장하지 못했습니다."));
      setDesignMessage(successText);
      if (body.processCode) setProcessCode(body.processCode);
      await load();
    } catch (error) {
      setDesignMessage(errorMessage(error, en));
    } finally {
      setDesignBusy(false);
    }
  }

  function parseContract(value: string, label: string) {
    try { return JSON.stringify(JSON.parse(value || "{}")); }
    catch { throw new Error(`${label}${en ? " must be valid JSON." : "은(는) 올바른 JSON이어야 합니다."}`); }
  }

  async function saveStepDesign() {
    let inputContract: string;
    let outputContract: string;
    try {
      inputContract = parseContract(stepDraft.inputContract, en ? "Input contract" : "입력 계약");
      outputContract = parseContract(stepDraft.outputContract, en ? "Output contract" : "출력 계약");
    } catch (error) {
      setDesignMessage(errorMessage(error, en));
      return;
    }
    await saveDesign("steps", {
      processCode, ...stepDraft, stepOrder: Number(stepDraft.stepOrder), inputContract, outputContract,
      requiresUserPage: Boolean(stepDraft.userPath), requiresAdminPage: Boolean(stepDraft.adminPath),
      requiresApi: false, requiresDatabase: true, requiresNotification: false,
    }, en ? "The screen, functions and workflow step were saved." : "화면·기능·워크플로우 단계가 저장되었습니다.");
  }

  const loadState = loading ? "loading" : message ? "error" : visibleItems.length ? "ready" : "empty";
  const priorityLabel = localized(screenContract.priorityModel.label, en);
  const priorityDisclosure = localized(screenContract.priorityModel.disclosure, en);

  return <div
    className="min-h-screen bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)]"
    data-my-work-summary=""
    data-page-id={screenContract.pageId}
    data-screen-contract={screenContract.templateCode}
    data-runtime-scope={screenContract.runtimeScope}
    data-load-state={loadState}
    data-selected-work-type={workType}
    data-selected-work-view={workView}
  >
    <main className="krds-responsive-container py-8" aria-busy={loading}>
      <nav className="gov-text-label font-bold text-slate-500" aria-label={en ? "Breadcrumb" : "현재 위치"}>
        {en ? "My Work / My Work Summary" : "내 업무 / 내 업무 요약"}
      </nav>
      <EmissionPageIntro category={en ? "Emission tasks" : "탄소배출 업무"} title={localized(screenContract.screenName, en)} description={en ? "Review assigned work and continue the next available action." : "배정된 업무와 처리 상태를 확인하고 현재 진행 가능한 업무를 실행합니다."} actions={<><button
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
          </button></>} />

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
        aria-label={en ? "My work filters" : "내 업무 선택"}
      >
        <CommonContentCard className="krds-component p-5">
          <div className="flex flex-col gap-4">
            <div className="inline-flex w-fit rounded-[var(--kr-gov-radius)] border border-slate-300 bg-slate-50 p-1" role="group" aria-label={en ? "Task scope" : "업무 조회 범위"}>
              <button className={`min-h-10 rounded-[var(--kr-gov-radius)] px-4 text-sm font-black ${taskScope === "ALL" ? "bg-[var(--kr-gov-blue)] text-white" : "bg-transparent text-slate-700"}`} onClick={() => setTaskScope("ALL")} type="button">{en ? "All work" : "전체 업무"}{data?.processCatalog ? ` ${data.processCatalog.length}` : ""}</button>
              <button className={`min-h-10 rounded-[var(--kr-gov-radius)] px-4 text-sm font-black ${taskScope === "MINE" ? "bg-[var(--kr-gov-blue)] text-white" : "bg-transparent text-slate-700"}`} onClick={() => setTaskScope("MINE")} type="button">{en ? "My work" : "내 업무"}{taskScope === "MINE" ? ` ${scopedItems.length}` : ""}</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="gov-text-label block font-bold text-slate-700" data-my-work-type-filter="">
                {en ? "Work type" : "업무 종류"}
                <select className="krds-select mt-2 min-h-10 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 text-sm" aria-label={en ? "Work type" : "업무 종류"} onChange={(event) => { setWorkType(event.target.value); setProcessCode(""); setScreenPath(""); setProject(""); setPeriod(""); setTestActor(""); setTestAccount(""); }} value={workType}>
                <option value="ALL">{en ? "All work" : "전체 업무"} ({taskScope === "ALL" ? processes.length : scopedItems.length})</option>
                {workTypes.map((item) => {
                  const code = String(item.workTypeCode || "").toUpperCase();
                  const count = taskScope === "ALL"
                    ? Number(item.definedProcessCount || 0)
                    : scopedItems.filter((task) => String(task.domainCode || "EMISSION").toUpperCase() === code).length;
                  return <option key={code} value={code}>{en ? item.workTypeNameEn || item.workTypeName : item.workTypeName} ({count})</option>;
                })}
                </select>
              </label>
              <label className="gov-text-label block font-bold text-slate-700" htmlFor="my-work-process">
                {en ? "Process" : "업무"}
                <select className="krds-select mt-2 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white" id="my-work-process" onChange={(event) => { setProcessCode(event.target.value); setScreenPath(""); setProject(""); setPeriod(""); setTestActor(""); setTestAccount(""); }} value={processCode}>
                  <option value="">{en ? "All processes" : "전체 업무"}</option>
                  {processes.map(([code, name]) => <option key={code} value={code}>{name} · {code}</option>)}
                </select>
              </label>
              <label className="gov-text-label block font-bold text-slate-700" htmlFor="my-work-screen">
                {en ? "Screen" : "관련 화면"}
                <select className="krds-select mt-2 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white" disabled={!processCode} id="my-work-screen" onChange={(event) => setScreenPath(event.target.value)} value={screenPath}>
                  <option value="">{processCode ? (en ? "All screens" : "전체 화면") : (en ? "Select a process first" : "업무를 먼저 선택")}</option>
                  {screens.map(([path, name]) => <option key={path} value={path}>{name}</option>)}
                </select>
              </label>
              <label className="gov-text-label block font-bold text-slate-700" htmlFor="my-work-test-actor">
                {en ? "Role" : "역할"}
                <select className="krds-select mt-2 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white" id="my-work-test-actor" onChange={(event) => { setTestActor(event.target.value); setTestAccount(""); }} value={testActor}>
                  <option value="">{en ? "All roles" : "전체 역할"}</option>
                  {testActors.map((actor) => <option key={actor} value={actor}>{actorLabel(actor, en)}</option>)}
                </select>
              </label>
              <label className="gov-text-label block font-bold text-slate-700" htmlFor="my-work-test-account">
                {en ? "Assignee account" : "담당자 계정"}
                <select className="krds-select mt-2 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white" disabled={!testAccounts.length} id="my-work-test-account" onChange={(event) => setTestAccount(event.target.value)} value={testAccount}>
                  <option value="">{testAccounts.length ? (en ? "All assignees" : "전체 담당자 계정") : (en ? "No assignee" : "담당자 계정 없음")}</option>
                  {testAccounts.map((account) => <option key={account} value={account}>{account}</option>)}
                </select>
              </label>
            </div>
            {(projectBased || periodBased) && <div className="grid w-full gap-3 border-t border-slate-300 pt-4 sm:grid-cols-5">
              {projectBased && <label className="gov-text-label block font-bold text-slate-700" htmlFor="my-work-project">
                {en ? "Project" : "프로젝트"}
                <select className="krds-select mt-2 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white" id="my-work-project" onChange={(event) => setProject(event.target.value)} value={project}>
                  <option value="">{en ? "All" : "전체"}</option>
                  {projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>}
              {periodBased && <label className="gov-text-label block font-bold text-slate-700" htmlFor="my-work-period">
                {en ? "Period" : "기간"}
                <select className="krds-select mt-2 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white" id="my-work-period" onChange={(event) => setPeriod(event.target.value)} value={period}>
                  <option value="">{en ? "All" : "전체"}</option><option value="TODAY">{en ? "Today" : "오늘"}</option><option value="WEEK">{en ? "This week" : "이번 주"}</option><option value="MONTH">{en ? "Within 30 days" : "30일 이내"}</option><option value="OVERDUE">{en ? "Overdue" : "지연"}</option><option value="NO_DUE">{en ? "No due date" : "기한 없음"}</option>
                </select>
              </label>}
            </div>}
            <div data-my-work-status-filter="">
              <span className="gov-text-label block font-black text-[#052b57]">{en ? "Execution task status" : "실행 업무 상태"}</span>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-7" role="tablist" aria-label={en ? "Execution task status" : "실행 업무 상태"}>
                {WORK_VIEWS.map((view) => <button className={`min-h-14 rounded-[var(--kr-gov-radius)] border px-3 text-left ${workView === view ? "border-blue-500 bg-blue-50 text-blue-950" : "border-slate-200 bg-white text-slate-700"}`} data-work-view={view} key={view} onClick={() => setWorkView(view)} role="tab" aria-selected={workView === view} type="button"><span className="block text-xs font-bold">{localized(WORK_VIEW_LABELS[view], en)}</span><strong className="mt-1 block text-xl">{workViewCounts[view]}</strong></button>)}
              </div>
            </div>
            <p className="gov-text-body-sm text-slate-600">
              <strong>{en ? "Account" : "계정"}:</strong> {data?.actorId || "-"} · <strong>{en ? "Active roles" : "활성 역할"}:</strong> {actors.map((actor) => actorLabel(String(actor), en)).join(", ") || "-"} · <strong>{en ? "Visible projects" : "노출 프로젝트"}:</strong> {projects.length}{en ? " projects" : "개"}
              {data?.runtimeScope?.taskLedger ? <> · <strong>{en ? "Task ledger" : "업무 원장"}:</strong> {data.runtimeScope.taskLedger}</> : null}
            </p>
          </div>
        </CommonContentCard>
      </section>

      {(data?.assignmentManager || data?.allVisible) && <section className="mt-6" aria-labelledby="workflow-design-heading" data-section-code="WORKFLOW_DESIGN">
        <CommonContentCard className="krds-component overflow-hidden p-0">
          <div className="border-b border-slate-200 p-5">
            <p className="gov-text-caption font-black text-[var(--kr-gov-blue)]">{en ? "WORKFLOW DESIGN" : "업무·권한 설계"}</p>
            <h2 className="gov-text-heading-sm mt-1 font-black text-[#052b57]" id="workflow-design-heading">{en ? "Create work and connect execution authority" : "업무 생성 및 실행 권한 연결"}</h2>
            <p className="gov-text-body-sm mt-2 text-slate-600">{en ? "Save work type → work → screen/function → actor → account permission as one workflow." : "업무 종류 → 업무 → 화면·기능 → 액터 → 계정 권한을 하나의 워크플로우로 저장합니다."}</p>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 p-3" role="tablist">
            {(["WORK", "STEP", "ACTOR", "ASSIGNMENT"] as DesignTab[]).map((tab, index) => <button className={`min-h-10 rounded-[var(--kr-gov-radius)] px-4 text-sm font-black ${designTab === tab ? "bg-[var(--kr-gov-blue)] text-white" : "border border-slate-300 bg-white text-slate-700"}`} key={tab} onClick={() => setDesignTab(tab)} role="tab" aria-selected={designTab === tab} type="button">{index + 1}. {en ? ({ WORK: "Work", STEP: "Screen & function", ACTOR: "Actor", ASSIGNMENT: "Account permission" } as Record<DesignTab, string>)[tab] : ({ WORK: "업무 생성", STEP: "화면·기능", ACTOR: "액터 생성", ASSIGNMENT: "계정·권한" } as Record<DesignTab, string>)[tab]}</button>)}
          </div>
          <div className="p-5">
            {designTab === "WORK" && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DesignField label={en ? "Work type" : "업무 종류"}><select className="krds-select w-full" value={workDraft.domainCode} onChange={(e) => setWorkDraft({ ...workDraft, domainCode: e.target.value })}>{workTypes.map((item) => <option key={item.workTypeCode} value={item.workTypeCode}>{en ? item.workTypeNameEn || item.workTypeName : item.workTypeName}</option>)}</select></DesignField>
              <DesignField label={en ? "Work code" : "업무 코드"}><input className="krds-input w-full" placeholder="EMISSION_NEW_WORK" value={workDraft.processCode} onChange={(e) => setWorkDraft({ ...workDraft, processCode: e.target.value.toUpperCase() })}/></DesignField>
              <DesignField label={en ? "Work name" : "업무명"}><input className="krds-input w-full" value={workDraft.processName} onChange={(e) => setWorkDraft({ ...workDraft, processName: e.target.value })}/></DesignField>
              <DesignField label={en ? "Owner actor" : "책임 액터"}><input className="krds-input w-full" list="known-actors" value={workDraft.ownerActorCode} onChange={(e) => setWorkDraft({ ...workDraft, ownerActorCode: e.target.value.toUpperCase() })}/></DesignField>
              <DesignField label={en ? "Goal" : "업무 목표"}><input className="krds-input w-full" value={workDraft.goal} onChange={(e) => setWorkDraft({ ...workDraft, goal: e.target.value })}/></DesignField>
              <DesignField label={en ? "Start condition" : "시작 조건"}><input className="krds-input w-full" value={workDraft.startCondition} onChange={(e) => setWorkDraft({ ...workDraft, startCondition: e.target.value })}/></DesignField>
              <DesignField label={en ? "Completion condition" : "완료 조건"}><input className="krds-input w-full" value={workDraft.completionCondition} onChange={(e) => setWorkDraft({ ...workDraft, completionCondition: e.target.value })}/></DesignField>
              <div className="flex items-end"><button className="krds-button bg-[var(--kr-gov-blue)] font-black text-white disabled:opacity-50" disabled={designBusy || !workDraft.processCode || !workDraft.processName || !workDraft.ownerActorCode || !workDraft.goal || !workDraft.startCondition || !workDraft.completionCondition} onClick={() => void saveDesign("processes", { ...workDraft, processStatus: "DRAFT", automationMode: "MANUAL", riskLevel: "MEDIUM" }, en ? "The work was created." : "업무가 생성되었습니다.")} type="button">{en ? "Create work" : "업무 생성"}</button></div>
            </div>}
            {designTab === "STEP" && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DesignField label={en ? "Selected work" : "선택 업무"}><input className="krds-input w-full bg-slate-100" readOnly value={processCode}/></DesignField>
              <DesignField label={en ? "Step code" : "단계 코드"}><input className="krds-input w-full" value={stepDraft.stepCode} onChange={(e) => setStepDraft({ ...stepDraft, stepCode: e.target.value.toUpperCase() })}/></DesignField>
              <DesignField label={en ? "Order" : "순서"}><input className="krds-input w-full" min="1" type="number" value={stepDraft.stepOrder} onChange={(e) => setStepDraft({ ...stepDraft, stepOrder: e.target.value })}/></DesignField>
              <DesignField label={en ? "Classification / step name" : "분류·단계명"}><input className="krds-input w-full" value={stepDraft.stepName} onChange={(e) => setStepDraft({ ...stepDraft, stepName: e.target.value })}/></DesignField>
              <DesignField label={en ? "Function code" : "기능 코드"}><input className="krds-input w-full" value={stepDraft.commandCode} onChange={(e) => setStepDraft({ ...stepDraft, commandCode: e.target.value.toUpperCase() })}/></DesignField>
              <DesignField label={en ? "Execution actor" : "수행 액터"}><input className="krds-input w-full" list="known-actors" value={stepDraft.actorCode} onChange={(e) => setStepDraft({ ...stepDraft, actorCode: e.target.value.toUpperCase() })}/></DesignField>
              <DesignField label={en ? "User screen" : "사용자 화면"}><input className="krds-input w-full" placeholder="/emission/..." value={stepDraft.userPath} onChange={(e) => setStepDraft({ ...stepDraft, userPath: e.target.value })}/></DesignField>
              <DesignField label={en ? "Admin screen" : "관리자 화면"}><input className="krds-input w-full" placeholder="/admin/emission/..." value={stepDraft.adminPath} onChange={(e) => setStepDraft({ ...stepDraft, adminPath: e.target.value })}/></DesignField>
              <DesignField label={en ? "State transition" : "상태 전이"}><div className="flex gap-2"><input className="krds-input min-w-0" value={stepDraft.fromState} onChange={(e) => setStepDraft({ ...stepDraft, fromState: e.target.value.toUpperCase() })}/><span className="self-center">→</span><input className="krds-input min-w-0" value={stepDraft.toState} onChange={(e) => setStepDraft({ ...stepDraft, toState: e.target.value.toUpperCase() })}/></div></DesignField>
              <DesignField label={en ? "Input JSON" : "입력값 JSON"}><textarea className="krds-input min-h-24 w-full font-mono text-xs" value={stepDraft.inputContract} onChange={(e) => setStepDraft({ ...stepDraft, inputContract: e.target.value })}/></DesignField>
              <DesignField label={en ? "Output JSON" : "출력값 JSON"}><textarea className="krds-input min-h-24 w-full font-mono text-xs" value={stepDraft.outputContract} onChange={(e) => setStepDraft({ ...stepDraft, outputContract: e.target.value })}/></DesignField>
              <DesignField label={en ? "Completion rule" : "완료 규칙"}><textarea className="krds-input min-h-24 w-full" value={stepDraft.completionRule} onChange={(e) => setStepDraft({ ...stepDraft, completionRule: e.target.value })}/></DesignField>
              <div className="flex items-end"><button className="krds-button bg-[var(--kr-gov-blue)] font-black text-white disabled:opacity-50" disabled={designBusy || !processCode || !stepDraft.stepCode || !stepDraft.stepName || !stepDraft.actorCode || !stepDraft.commandCode || !stepDraft.completionRule} onClick={() => void saveStepDesign()} type="button">{en ? "Save screen & function" : "화면·기능 저장"}</button></div>
            </div>}
            {designTab === "ACTOR" && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DesignField label={en ? "Actor code" : "액터 코드"}><input className="krds-input w-full" value={actorDraft.actorCode} onChange={(e) => setActorDraft({ ...actorDraft, actorCode: e.target.value.toUpperCase() })}/></DesignField>
              <DesignField label={en ? "Actor name" : "액터명"}><input className="krds-input w-full" value={actorDraft.actorName} onChange={(e) => setActorDraft({ ...actorDraft, actorName: e.target.value })}/></DesignField>
              <DesignField label={en ? "Purpose" : "역할 목적"}><input className="krds-input w-full" value={actorDraft.purpose} onChange={(e) => setActorDraft({ ...actorDraft, purpose: e.target.value })}/></DesignField>
              <DesignField label={en ? "Function permissions" : "기능 권한 코드"}><input className="krds-input w-full" placeholder="READ,WRITE,APPROVE" value={actorDraft.capabilityCodes} onChange={(e) => setActorDraft({ ...actorDraft, capabilityCodes: e.target.value.toUpperCase() })}/></DesignField>
              <div><button className="krds-button bg-[var(--kr-gov-blue)] font-black text-white disabled:opacity-50" disabled={designBusy || !actorDraft.actorCode || !actorDraft.actorName || !actorDraft.purpose} onClick={() => void saveDesign("actors", { ...actorDraft, actorType: "BUSINESS", delegationAllowed: false }, en ? "The actor was created." : "액터가 생성되었습니다.")} type="button">{en ? "Create actor" : "액터 생성"}</button></div>
            </div>}
            {designTab === "ASSIGNMENT" && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DesignField label={en ? "Account ID" : "계정 ID"}><input className="krds-input w-full" list="known-accounts" value={assignmentDraft.accountId} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, accountId: e.target.value })}/></DesignField>
              <DesignField label={en ? "Actor" : "부여 액터"}><input className="krds-input w-full" list="known-actors" value={assignmentDraft.actorCode} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, actorCode: e.target.value.toUpperCase() })}/></DesignField>
              <DesignField label={en ? "Project scope" : "프로젝트 범위"}><select className="krds-select w-full" value={assignmentDraft.projectId} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, projectId: e.target.value })}><option value="*">{en ? "All projects" : "전체 프로젝트"}</option>{projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></DesignField>
              <DesignField label={en ? "Data scope" : "데이터 권한 범위"}><input className="krds-input w-full" value={assignmentDraft.dataScope} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, dataScope: e.target.value })}/></DesignField>
              <div><button className="krds-button bg-[var(--kr-gov-blue)] font-black text-white disabled:opacity-50" disabled={designBusy || !assignmentDraft.accountId || !assignmentDraft.actorCode} onClick={() => void saveDesign("assignments", { ...assignmentDraft, tenantId: "DEFAULT" }, en ? "The actor and permission were assigned to the account." : "계정에 액터와 권한이 부여되었습니다.")} type="button">{en ? "Grant permission" : "권한 부여"}</button></div>
            </div>}
            <datalist id="known-actors">{testActors.map((actor) => <option key={actor} value={actor}/>)}</datalist>
            <datalist id="known-accounts">{[...new Set((data?.processAssignments || []).map((item) => item.accountId).filter(Boolean) as string[])].map((account) => <option key={account} value={account}/>)}</datalist>
            {designMessage && <p className={`mt-4 rounded-[var(--kr-gov-radius)] border p-3 font-bold ${designMessage.includes(en ? "could not" : "못했습니다") || designMessage.includes("JSON") ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`} role="status">{designMessage}</p>}
          </div>
        </CommonContentCard>
      </section>}

      {taskScope === "ALL" && <section className="mt-6 scroll-mt-24" id="all-work-catalog" aria-labelledby="all-work-catalog-heading">
        <CommonContentCard className="krds-component overflow-hidden p-0">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2 className="gov-text-heading-sm font-black text-[#052b57]" id="all-work-catalog-heading">{en ? "All designed work" : "전체 설계 업무"}</h2>
              <p className="gov-text-body-sm mt-1 text-slate-600">{en ? "The canonical work catalog is shown independently from generated execution tasks." : "실행 업무 생성 여부와 관계없이 정본 업무 설계를 모두 표시합니다."}</p>
            </div>
            <div className="flex gap-2 text-sm font-black"><span className="rounded-full bg-blue-100 px-3 py-2 text-blue-800">{en ? "Designed" : "설계"} {visibleCatalog.length}</span><span className="rounded-full bg-emerald-100 px-3 py-2 text-emerald-800">{en ? "Execution tasks" : "실행 업무"} {scopedItems.length}</span></div>
          </div>
          <div className="max-h-[440px] overflow-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-700"><tr><th className="px-4 py-3">{en ? "Work" : "업무"}</th><th className="px-4 py-3">{en ? "Work type" : "업무 종류"}</th><th className="px-4 py-3">{en ? "Owner actor" : "책임 액터"}</th><th className="px-4 py-3">{en ? "Steps" : "단계"}</th><th className="px-4 py-3">{en ? "Screen" : "화면"}</th><th className="px-4 py-3">{en ? "Status" : "상태"}</th></tr></thead>
              <tbody>{visibleCatalog.map((item) => <tr className="border-t border-slate-200" key={item.processCode}><td className="px-4 py-3"><strong className="text-[#052b57]">{item.processName}</strong><p className="mt-1 text-xs text-slate-500">{item.processCode}</p></td><td className="px-4 py-3">{item.domainCode || "-"}</td><td className="px-4 py-3">{item.ownerActorCode || "-"}</td><td className="px-4 py-3">{item.stepCount ?? 0}</td><td className="px-4 py-3">{item.targetUrl ? <a className="font-bold text-[var(--kr-gov-blue)] underline" href={buildLocalizedPath(item.targetUrl, `/en${item.targetUrl}`)}>{en ? "Open" : "화면 열기"}</a> : <span className="text-slate-400">-</span>}</td><td className="px-4 py-3"><CommonStatusBadge className="bg-slate-100 text-slate-700">{item.status || "-"}</CommonStatusBadge></td></tr>)}</tbody>
            </table>
          </div>
        </CommonContentCard>
      </section>}

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
              <caption className="sr-only">{en ? "Task priority estimate, process, project, actor, status, due date and action" : "업무 추정 우선순위, 업무, 프로젝트, 액터, 상태, 마감일과 실행 항목"}</caption>
              <thead className="bg-[#052b57] text-white">
                <tr>
                  {(en
                    ? ["Estimated priority", "Work", "Process / step", "Project", "Assignee / actor", "Status", "Due", "Action"]
                    : ["추정 우선", "업무", "업무 / 단계", "프로젝트", "담당계정 / 액터", "상태", "마감", "실행"]
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
          {!visibleItems.length && <p className="p-12 text-center font-bold text-slate-600">{loading ? (en ? "Loading tasks…" : "업무를 불러오는 중…") : (en ? "No tasks match the selected filters." : "선택한 조건에 해당하는 업무가 없습니다.")}</p>}
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
              <h2 className="gov-text-heading-sm mt-1 font-black text-[#052b57]" id="my-work-progress-heading">{en ? "Process progress" : "업무 진행 현황"}</h2>
              <p className="gov-text-body-sm mt-1 font-bold text-slate-600">{focusProjectTasks[0] ? `${focusProjectTasks[0].projectName} · ${focusProjectTasks[0].processName || focusProjectTasks[0].processCode || "-"}` : (en ? "No project process is available in the current scope." : "현재 범위에 표시할 프로젝트 업무가 없습니다.")}</p>
            </div>
            <button className="krds-button self-start rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-blue)] font-black text-[var(--kr-gov-blue)]" onClick={openFullWorkflow} type="button">{en ? "View full workflow" : "업무 전체 보기"}</button>
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
          </ol> : <p className="mt-5 rounded-[var(--kr-gov-radius)] border border-dashed border-slate-300 bg-slate-50 p-8 text-center font-bold text-slate-600">{loading ? (en ? "Loading process progress…" : "업무 진행 현황을 불러오는 중…") : (en ? "No process steps are available for the selected context." : "선택한 조건에 표시할 업무 단계가 없습니다.")}</p>}
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
                    {notification.processName && <p className="gov-text-caption mt-1 font-bold text-[var(--kr-gov-blue)]">{[notification.workTypeName, notification.processName, notification.stepName].filter(Boolean).join(" · ")}</p>}
                    <p className="gov-text-body-sm mt-1 text-slate-600">{notification.message}</p>
                    <time className="mt-1 block text-xs text-slate-500" dateTime={notification.createdAt}>{formatActivityTime(notification.createdAt, en)}</time>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {notificationHref(notification) && <button className="krds-button rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] font-black text-white disabled:opacity-60" disabled={loading} onClick={() => void openNotification(notification).catch((error) => setMessage(errorMessage(error, en)))} type="button">{en ? "Open work" : "업무 보기"}</button>}
                    {!notification.readAt && <button className="krds-button rounded-[var(--kr-gov-radius)] border border-amber-400 font-black text-amber-900 disabled:opacity-60" disabled={loading} onClick={() => void readNotification(notification).catch((error) => setMessage(errorMessage(error, en)))} type="button">{en ? "Mark read" : "읽음"}</button>}
                  </div>
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
