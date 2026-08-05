import { useEffect, useMemo, useRef, useState } from "react";

const ACTOR_LABELS: Record<string, string> = {
  "*": "전체 담당자",
  AUTHORITY_ADMIN: "기관 관리자",
  BUSINESS_USER: "기업 업무 담당자",
  COMPANY_MANAGER: "기업 관리자",
  COMPANY_ADMIN: "기업 운영 관리자",
  WORK_ASSIGNMENT_MANAGER: "업무 배정 담당자",
  PROJECT_OWNER: "프로젝트 책임자",
  SITE_DATA_OWNER: "자료 담당자",
  DATA_OWNER: "자료 담당자",
  CALCULATOR: "산정 담당자",
  EMISSION_CALCULATOR: "산정 담당자",
  VERIFIER: "검증 담당자",
  APPROVER: "승인 담당자",
  REGULATOR: "관리기관",
  AUDITOR: "감사 담당자",
  REVIEWER: "검토 담당자",
  DATA_ANALYST: "데이터 분석 담당자",
  FACILITY_OPERATOR: "설비 운영 담당자",
  HSE_MANAGER: "안전·환경 관리자",
  INSTRUMENT_ENGINEER: "계측 담당자",
  LAB_ANALYST: "시험·분석 담당자",
  LCA_PRACTITIONER: "LCA 수행 담당자",
  MAINTENANCE_ENGINEER: "유지보수 담당자",
  MEMBER_ADMIN: "회원 관리자",
  MEMBER_USER: "일반 회원",
  PUBLIC_APPLICANT: "외부 신청자",
  REPORT_MANAGER: "보고서 담당자",
  CERTIFICATE_OFFICER: "인증서 발급 담당자",
  CERTIFICATE_QA_OPERATOR: "인증서 품질 담당자",
  REDUCTION_MANAGER: "감축 관리 담당자",
  STORAGE_SITE_MANAGER: "저장소 관리 담당자",
  TRADE_OPERATOR: "거래 운영 담당자",
  SETTLEMENT_OPERATOR: "정산 담당자",
  CONTENT_MANAGER: "콘텐츠 담당자",
  EDUCATION_MANAGER: "교육 담당자",
  PRIVACY_OFFICER: "개인정보 보호 담당자",
  PLATFORM_ADMIN: "플랫폼 관리자",
  PLATFORM_OPERATOR: "플랫폼 운영자",
  SUPPORT_AGENT: "고객지원 담당자",
  SYSTEM_INTEGRATOR: "시스템 연계 담당자",
  GENERAL_ADMIN: "일반 관리자",
  MEMBER: "회원",
  CUSTOMER: "고객",
  SYSTEM_ADMIN: "시스템 관리자",
  UNASSIGNED: "담당 미지정",
};

function actorLabel(actorCode?: string | null) {
  if (!actorCode) return "담당 미지정";
  return ACTOR_LABELS[actorCode] || "업무 담당자";
}
import { createPortal } from "react-dom";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

type QuestTask = {
  id: number;
  taskCode?: string;
  stepOrder?: number;
  executionWave?: number;
  predecessorCodes?: string;
  projectId: string;
  projectName: string;
  name: string;
  status: string;
  priority: string;
  dueDate: string;
  targetUrl: string;
  actorCode?: string;
  assignee?: string;
  explicitlyAssigned?: boolean;
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

type DesignAssurance = {
  processCode: string;
  assuranceStatus: string;
  designAccuracyScore?: number;
  designBlockerCount?: number;
  actorContractGaps?: number;
  stateFlowGaps?: number;
  businessRuleGaps?: number;
  dataContractGaps?: number;
  routeGaps?: number;
  screenContractGaps?: number;
  apiContractGaps?: number;
  approvedSafetyTestTypeCount?: number;
  requiredJobCount?: number;
  verifiedJobCount?: number;
  nextAction?: string;
};
type ProjectProcess = {
  projectId: string;
  projectName: string;
  processCode: string;
  processName: string;
  workflowOrder?: number;
  workflowPhase?: string;
  processRole?: string;
  applicabilityStatus: string;
  implementationStatus: string;
  taskGenerationStatus: string;
  executionStatus: string;
  reasonCode?: string;
  reasonText?: string;
  taskCount?: number;
  completedTaskCount?: number;
};
type WorkTypeAssurance = {
  workTypeCode: string;
  processCount?: number;
  verifiedProcessCount?: number;
  blockedProcessCount?: number;
  pendingProcessCount?: number;
  averageAccuracyScore?: number;
};
type PageDesignCoverage = {
  processCode: string;
  pageDesignCount?: number;
  userPageCount?: number;
  adminPageCount?: number;
  fieldCount?: number;
  requiredFieldCount?: number;
  dbResolvedFieldCount?: number;
  implementationFieldCount?: number;
  fieldContractGapCount?: number;
  implementationPendingPageCount?: number;
  handoffCount?: number;
  pageDesignStatus?: string;
};

type QuestResponse = {
  items?: QuestTask[];
  workflows?: QuestTask[];
  workTypes?: Array<{
    workTypeCode: string;
    workTypeName: string;
    workTypeNameEn?: string;
    description?: string;
    sortOrder?: number;
    definedProcessCount?: number;
    activeProcessCount?: number;
    taskCount?: number;
  }>;
  processCatalog?: Array<{
    processCode: string;
    processName: string;
    domainCode: string;
    goal?: string;
    status?: string;
    ownerActorCode?: string;
    developmentOrder?: number;
    workflowOrder?: number;
    workflowPhase?: string;
    processRole?: string;
    executionWave?: number;
    laneCode?: string;
    laneOrder?: number;
    executionMode?: string;
    joinStrategy?: string;
    predecessorProcessCodes?: string[];
    sharedMilestoneCode?: string;
    requiredForJoin?: boolean;
    applicabilityRule?: string;
    prerequisiteCodes?: string;
    nextProcessCode?: string;
    stepCount?: number;
    completionScore?: number;
    requiredTasks?: number;
    completedTasks?: number;
    blockedTasks?: number;
    nextAction?: string;
    targetUrl?: string;
    menuCode?: string;
    navigationType?: string;
    navigationStatus?: string;
    businessScreenImplemented?: boolean;
    runtimeTaskCount?: number;
    runtimeCompletedCount?: number;
    runtimeState?: string;
  }>;
  processCatalogSteps?: Array<{
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
    inputContract?: string;
    outputContract?: string;
    userPath?: string;
    adminPath?: string;
    automationStatus?: string;
  }>;
  processAssignments?: Array<{
    projectId: string;
    processCode: string;
    stepCode: string;
    actorCode?: string;
    accountId: string;
    assignedBy?: string;
    updatedAt?: string;
  }>;
  designAssurance?: DesignAssurance[];
  designAssuranceSummary?: {
    processCount?: number;
    verifiedCount?: number;
    blockedCount?: number;
    pendingCount?: number;
    averageAccuracyScore?: number;
  };
  projectProcesses?: ProjectProcess[];
  workTypeAssurance?: WorkTypeAssurance[];
  pageDesignCoverage?: PageDesignCoverage[];
  pageDesignSummary?: {
    pageCount?: number;
    implementedPageCount?: number;
    designOnlyPageCount?: number;
    fieldCount?: number;
    requiredFieldCount?: number;
    dbResolvedFieldCount?: number;
    implementationFieldCount?: number;
    incompletePageCount?: number;
    handoffCount?: number;
  };
  workCatalogAudit?: {
    workTypeCount?: number;
    processCount?: number;
    processesWithoutSequence?: number;
    processesWithoutSteps?: number;
    processesWithoutSafetyTests?: number;
    processesWithoutDevelopmentJobs?: number;
    menusWithoutProcessBinding?: number;
    processesWithoutScreenRoute?: number;
  };
  processNavigationSummary?: {
    processCount?: number;
    navigationBoundCount?: number;
    navigationMissingCount?: number;
    businessScreenReadyCount?: number;
    designWorkspaceOnlyCount?: number;
    pageDesignMissingCount?: number;
  };
  allVisible?: boolean;
  assignmentManager?: boolean;
  actorId?: string;
  accountActors?: string[];
  summary?: { total?: number; completed?: number; overdue?: number };
};

type AssignmentWorkspace = {
  canManage?: boolean;
  projects?: Array<{ projectId: string; projectName: string }>;
  accounts?: Array<{ accountId: string; accountName: string; department?: string; actorCodes?: string }>;
  steps?: Array<{ stepCode: string; stepName: string; stepOrder: number; actorCode: string; actorName: string; accountId?: string }>;
};

type TaskGuideFocusDetail = {
  processCode: string;
  stepCode?: string;
  projectId?: string;
  openOverview?: boolean;
};

function dueLabel(value: string, en: boolean) {
  if (!value) return en ? "No deadline" : "기한 미설정";
  const due = new Date(`${value}T23:59:59`);
  if (Number.isNaN(due.getTime())) return value;
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  if (days < 0)
    return en ? `${Math.abs(days)}d overdue` : `${Math.abs(days)}일 지연`;
  if (days === 0) return en ? "Due today" : "오늘 마감";
  return `D-${days}`;
}

function taskWeight(task: QuestTask) {
  const status =
    task.status === "IN_PROGRESS" ? 0 : task.status === "READY" ? 1 : 3;
  const actionable = task.actionable === false ? 2 : 0;
  const deadline = task.dueDate
    ? new Date(`${task.dueDate}T23:59:59`).getTime()
    : Number.MAX_SAFE_INTEGER;
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
  if (task.status === "DONE")
    return {
      label: en ? "Complete" : "완료",
      icon: "check",
      style: "border-emerald-400 bg-emerald-50 text-emerald-900",
    };
  if (task.status === "IN_PROGRESS")
    return {
      label: en ? "In progress" : "진행 중",
      icon: "play_arrow",
      style: "border-blue-500 bg-blue-50 text-blue-950",
    };
  if (task.actionable === false)
    return {
      label: en ? "Blocked" : "선행 대기",
      icon: "lock_clock",
      style: "border-slate-300 bg-slate-100 text-slate-600",
    };
  return {
    label: en ? "Ready" : "시작 가능",
    icon: "flag",
    style: "border-amber-400 bg-amber-50 text-amber-950",
  };
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
    WORK_ASSIGNMENT: ["업무 배정", "Work Assignment"],
    COMMON: ["공통 업무", "Common Tasks"],
  };
  const matched = Object.entries(labels).find(
    ([key]) => normalized === key || normalized.includes(key),
  );
  return matched ? matched[1][en ? 1 : 0] : code || labels.COMMON[en ? 1 : 0];
}

function workflowPhaseLabel(code: string | undefined, en: boolean) {
  const labels: Record<string, [string, string]> = {
    REGISTRATION_AUTH: ["가입·인증", "Registration & auth"],
    COMPANY_ONBOARDING: ["기업·조직 온보딩", "Company onboarding"],
    ACCOUNT_OPERATION: ["계정 운영", "Account operation"],
    PROJECT_DATA_CALCULATION: [
      "프로젝트·자료·산정",
      "Project, data & calculation",
    ],
    VERIFICATION_SUBMISSION: ["검증·제출", "Verification & submission"],
    MRV_TRACE_CLOSE: ["MRV·추적·종료", "MRV, trace & close"],
    LCA_CALCULATION_REVIEW: ["LCA 산정·검토", "LCA calculation & review"],
    TARGET_PROJECT: ["목표·과제", "Targets & projects"],
    ANALYSIS_PERFORMANCE: ["분석·성과", "Analysis & performance"],
    MONITORING_ANALYSIS: ["관제·분석", "Monitoring & analysis"],
    SUPPLY_DEMAND_TRADE: ["공급·수요·거래", "Supply, demand & trade"],
    PAYMENT_SETTLEMENT: ["결제·정산", "Payment & settlement"],
    REPORT: ["보고서", "Report"],
    CERTIFICATE_VERIFICATION: ["인증·진위", "Certificate & verification"],
    CONTENT_SUPPORT: ["콘텐츠·지원", "Content & support"],
    EDUCATION_OPERATION: ["교육 운영", "Education operation"],
    AUTH_WORKFLOW: ["권한·워크플로", "Authority & workflow"],
    EXTERNAL_INTEGRATION: ["외부 연계", "External integration"],
    PLATFORM_OPERATION: ["플랫폼 운영", "Platform operation"],
    COMMON_WORK: ["공통 업무", "Common work"],
    NEW_WORK: ["신규 업무", "New work"],
  };
  const label = labels[String(code || "NEW_WORK")];
  return label ? label[en ? 1 : 0] : String(code || "-");
}

function runtimeStateLabel(state: string, en: boolean) {
  const labels: Record<string, [string, string]> = {
    DESIGN_BLOCKED: ["설계 보완 필요", "Design blocked"],
    IMPLEMENTATION_PENDING: ["구현 검증 대기", "Implementation pending"],
    CONDITIONAL: ["조건 충족 시 실행", "Conditional"],
    NOT_APPLICABLE: ["현재 프로젝트 제외", "Not applicable"],
    PROJECT_NOT_SELECTED: ["프로젝트 선택 필요", "Select a project"],
    PAGE_NOT_IMPLEMENTED: ["화면 개발 대기", "Page pending"],
    TASK_NOT_CREATED: ["실행 업무 미생성", "Task not created"],
    READY: ["시작 전", "Ready"],
    IN_PROGRESS: ["진행 중", "In progress"],
    COMPLETED: ["완료", "Complete"],
  };
  return (labels[state] || [state, state])[en ? 1 : 0];
}

export function TaskQuestPanel() {
  const en = isEnglish();
  const api = buildLocalizedPath(
    "/home/api/emission-tasks",
    "/en/home/api/emission-tasks",
  );
  const [data, setData] = useState<QuestResponse | null>(null);
  const [open, setOpen] = useState(
    () => localStorage.getItem("task-quest-open") === "1",
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [flowOpen, setFlowOpen] = useState(false);
  const [processKeyword, setProcessKeyword] = useState("");
  const [processMapZoom, setProcessMapZoom] = useState(100);
  const [processMapMode] = useState<"FLOW" | "ACTOR" | "CANVAS">("CANVAS");
  const processCanvasRef = useRef<HTMLDivElement | null>(null);
  const [processViewport, setProcessViewport] = useState({ left: 0, width: 100 });
  const [selectedWorkType, setSelectedWorkType] = useState(
    () => localStorage.getItem("task-quest-work-type") || "ALL",
  );
  const [selectedCatalogProcessCode, setSelectedCatalogProcessCode] = useState(
    () => localStorage.getItem("task-quest-catalog-process") || "",
  );
  const [selectedCatalogStep, setSelectedCatalogStep] = useState(
    () => Number(localStorage.getItem("task-quest-catalog-step") || 0),
  );
  const [selectedOverviewProjectId, setSelectedOverviewProjectId] = useState(
    () => localStorage.getItem("task-quest-overview-project") || "",
  );
  const [focusedWorkflow, setFocusedWorkflow] = useState<{
    projectId: string;
    processCode: string;
  } | null>(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("task-quest-focused-workflow") || "null",
      );
      return value?.projectId && value?.processCode ? value : null;
    } catch {
      return null;
    }
  });
  const [focusedStepCode, setFocusedStepCode] = useState(
    () => localStorage.getItem("task-quest-focused-step") || "",
  );
  const [assignmentWorkspace, setAssignmentWorkspace] = useState<AssignmentWorkspace | null>(null);
  const [stepAssignees, setStepAssignees] = useState<Record<string, string>>({});
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState("");

  async function load() {
    try {
      const response = await fetch(api, { credentials: "include" });
      if (response.status === 401 || response.status === 403) return;
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.message ||
            (en ? "Unable to load tasks." : "업무를 불러오지 못했습니다."),
        );
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
    const synchronizeGuide = (event: Event) => {
      const detail = (event as CustomEvent<TaskGuideFocusDetail>).detail;
      if (!detail?.processCode) return;
      const processSteps = (data?.processCatalogSteps || [])
        .filter((step) => step.processCode === detail.processCode)
        .sort((a, b) => Number(a.stepOrder) - Number(b.stepOrder));
      const stepIndex = Math.max(
        0,
        detail.stepCode
          ? processSteps.findIndex((step) => step.stepCode === detail.stepCode)
          : 0,
      );
      setSelectedCatalogProcessCode(detail.processCode);
      setSelectedCatalogStep(stepIndex);
      setFocusedStepCode(detail.stepCode || "");
      localStorage.setItem("task-quest-catalog-process", detail.processCode);
      localStorage.setItem("task-quest-catalog-step", String(stepIndex));
      if (detail.stepCode)
        localStorage.setItem("task-quest-focused-step", detail.stepCode);
      else localStorage.removeItem("task-quest-focused-step");
      if (detail.projectId) {
        const focus = {
          projectId: detail.projectId,
          processCode: detail.processCode,
        };
        setSelectedOverviewProjectId(detail.projectId);
        setFocusedWorkflow(focus);
        localStorage.setItem("task-quest-overview-project", detail.projectId);
        localStorage.setItem("task-quest-focused-workflow", JSON.stringify(focus));
      } else if (detail.processCode === "EMISSION_PROJECT_PORTFOLIO") {
        setSelectedOverviewProjectId("");
        setFocusedWorkflow(null);
        localStorage.removeItem("task-quest-overview-project");
        localStorage.removeItem("task-quest-focused-workflow");
      }
      setOpen(true);
      localStorage.setItem("task-quest-open", "1");
      if (detail.openOverview) setFlowOpen(true);
    };
    window.addEventListener("resonance:task-guide-focus", synchronizeGuide);
    return () =>
      window.removeEventListener("resonance:task-guide-focus", synchronizeGuide);
  }, [data?.processCatalogSteps]);

  useEffect(() => {
    const pathname = window.location.pathname.replace(/\/$/, "") || "/";
    if (pathname !== "/emission/index" && pathname !== "/en/emission/index")
      return;
    const processCode = "EMISSION_PROJECT_PORTFOLIO";
    const stepCode = "EMISSION_PROJECT_PORTFOLIO_LIST";
    const processSteps = (data?.processCatalogSteps || [])
      .filter((step) => step.processCode === processCode)
      .sort((left, right) => Number(left.stepOrder) - Number(right.stepOrder));
    const stepIndex = Math.max(
      0,
      processSteps.findIndex((step) => step.stepCode === stepCode),
    );
    setSelectedCatalogProcessCode(processCode);
    setSelectedCatalogStep(stepIndex);
    setFocusedStepCode(stepCode);
    setSelectedWorkType("EMISSION");
    setSelectedOverviewProjectId("");
    setFocusedWorkflow(null);
    setOpen(true);
    localStorage.setItem("task-quest-catalog-process", processCode);
    localStorage.setItem("task-quest-catalog-step", String(stepIndex));
    localStorage.setItem("task-quest-focused-step", stepCode);
    localStorage.setItem("task-quest-work-type", "EMISSION");
    localStorage.setItem("task-quest-open", "1");
    localStorage.removeItem("task-quest-overview-project");
    localStorage.removeItem("task-quest-focused-workflow");
  }, [data?.processCatalogSteps]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("assignment") !== "1") return;
    setSelectedWorkType("EMISSION");
    setSelectedCatalogProcessCode("WORK_ASSIGNMENT");
    setSelectedCatalogStep(0);
    setOpen(true);
    setFlowOpen(true);
    localStorage.setItem("task-quest-work-type", "EMISSION");
    localStorage.setItem("task-quest-catalog-process", "WORK_ASSIGNMENT");
    localStorage.setItem("task-quest-catalog-step", "0");
    localStorage.setItem("task-quest-open", "1");
  }, []);

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

  const contextProjectId =
    new URLSearchParams(location.search).get("projectId") ||
    new URLSearchParams(location.search).get("id") ||
    "";

  const rawWorkflowItems = useMemo(() => {
    const source = data?.workflows || data?.items || [];
    const unique = new Map<string, QuestTask>();
    source.forEach((item) => {
      const businessKey =
        item.processStepCode ||
        item.taskCode ||
        `${item.commandCode || "TASK"}:${item.targetUrl || ""}`;
      const key = `${item.projectId}|${item.processCode || "PROJECT"}|${businessKey}`;
      if (!unique.has(key)) unique.set(key, item);
    });
    return [...unique.values()];
  }, [data]);

  const overviewProjects = useMemo(() => {
    const projects = new Map<string, string>();
    rawWorkflowItems.forEach((item) =>
      projects.set(item.projectId, item.projectName || item.projectId),
    );
    return [...projects.entries()].map(([id, name]) => ({ id, name }));
  }, [rawWorkflowItems]);

  const effectiveProjectId =
    contextProjectId || selectedOverviewProjectId || focusedWorkflow?.projectId || "";

  useEffect(() => {
    if (contextProjectId || !overviewProjects.length) return;
    if (
      selectedOverviewProjectId &&
      overviewProjects.some((project) => project.id === selectedOverviewProjectId)
    )
      return;
    const pendingProject = rawWorkflowItems.find(
      (item) => item.status !== "DONE",
    )?.projectId;
    const next = pendingProject || overviewProjects[0].id;
    setSelectedOverviewProjectId(next);
    localStorage.setItem("task-quest-overview-project", next);
  }, [contextProjectId, overviewProjects, rawWorkflowItems, selectedOverviewProjectId]);

  const task = useMemo(() => {
    if (selectedCatalogProcessCode === "EMISSION_PROJECT_PORTFOLIO") {
      const catalogProcess = (data?.processCatalog || []).find(
        (item) => item.processCode === selectedCatalogProcessCode,
      );
      const catalogSteps = (data?.processCatalogSteps || [])
        .filter((item) => item.processCode === selectedCatalogProcessCode)
        .sort((left, right) => Number(left.stepOrder) - Number(right.stepOrder));
      const catalogStep =
        catalogSteps.find((item) => item.stepCode === focusedStepCode) ||
        catalogSteps[0];
      if (catalogProcess && catalogStep) {
        return {
          id: -1,
          projectId: "",
          projectName: en ? "Emission status" : "배출량 현황",
          name: catalogStep.stepName,
          status: "IN_PROGRESS",
          priority: "NORMAL",
          dueDate: "",
          targetUrl:
            catalogStep.userPath ||
            (catalogProcess.processCode === "EMISSION_PROJECT_PORTFOLIO"
              ? "/emission/project-portfolio"
              : "/emission/index"),
          actorCode: catalogStep.actorCode || catalogProcess.ownerActorCode,
          processCode: catalogProcess.processCode,
          processName: catalogProcess.processName,
          domainCode: catalogProcess.domainCode,
          processStepCode: catalogStep.stepCode,
          stepOrder: catalogStep.stepOrder,
          completionRule: catalogStep.completionRule,
          workPurpose: catalogStep.workPurpose || catalogProcess.goal,
          actionable: true,
        } satisfies QuestTask;
      }
    }
    const pending = [...(data?.items || [])].filter(
      (item) => item.status !== "DONE",
    );
    const focused = focusedWorkflow
      ? pending.filter(
          (item) =>
            item.projectId === focusedWorkflow.projectId &&
            item.processCode === focusedWorkflow.processCode,
        )
      : [];
    const contextual = effectiveProjectId
      ? pending.filter((item) => item.projectId === effectiveProjectId)
      : [];
    const exactStep = focusedStepCode
      ? pending.find(
          (item) =>
            item.projectId === effectiveProjectId &&
            item.processStepCode === focusedStepCode,
        )
      : undefined;
    if (exactStep) return exactStep;
    return [
      ...(focused.length ? focused : contextual.length ? contextual : pending),
    ].sort((a, b) => {
      const aw = taskWeight(a),
        bw = taskWeight(b);
      return aw[0] - bw[0] || aw[1] - bw[1];
    })[0];
  }, [
    data,
    effectiveProjectId,
    en,
    focusedStepCode,
    focusedWorkflow,
    selectedCatalogProcessCode,
  ]);

  const workflowItems = useMemo(() => {
    const scoped = effectiveProjectId
      ? rawWorkflowItems.filter((item) => item.projectId === effectiveProjectId)
      : rawWorkflowItems;
    return [...scoped].sort(
      (a, b) =>
        a.projectId.localeCompare(b.projectId) ||
        String(a.processCode || "").localeCompare(
          String(b.processCode || ""),
        ) ||
        Number(a.stepOrder || 0) - Number(b.stepOrder || 0),
    );
  }, [effectiveProjectId, rawWorkflowItems]);

  const availableWorkTypes = useMemo(() => {
    const counts = new Map<string, number>();
    workflowItems.forEach((item) => {
      const code = String(item.domainCode || "EMISSION").toUpperCase();
      counts.set(code, (counts.get(code) || 0) + 1);
    });
    const definitions = new Map(
      (data?.workTypes || []).map((item) => [
        String(item.workTypeCode).toUpperCase(),
        item,
      ]),
    );
    counts.forEach((_count, code) => {
      if (!definitions.has(code))
        definitions.set(code, {
          workTypeCode: code,
          workTypeName: workTypeLabel(code, false),
          workTypeNameEn: workTypeLabel(code, true),
          description: "",
        });
    });
    const assurance = new Map(
      (data?.workTypeAssurance || []).map((item) => [
        String(item.workTypeCode).toUpperCase(),
        item,
      ]),
    );
    return [...definitions.values()]
      .sort(
        (a, b) =>
          Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) ||
          a.workTypeCode.localeCompare(b.workTypeCode),
      )
      .map((item) => {
        const code = String(item.workTypeCode).toUpperCase(),
          quality = assurance.get(code);
        return {
          code,
          count: counts.get(code) || 0,
          definedCount: Number(item.definedProcessCount || 0),
          verifiedCount: Number(quality?.verifiedProcessCount || 0),
          blockedCount: Number(quality?.blockedProcessCount || 0),
          pendingCount: Number(quality?.pendingProcessCount || 0),
          accuracy: Number(quality?.averageAccuracyScore || 0),
          label:
            (en ? item.workTypeNameEn : item.workTypeName) ||
            workTypeLabel(item.workTypeCode, en),
          description: item.description || "",
        };
      });
  }, [data?.workTypeAssurance, data?.workTypes, en, workflowItems]);
  const definedProcessTotal = useMemo(
    () => availableWorkTypes.reduce((sum, item) => sum + item.definedCount, 0),
    [availableWorkTypes],
  );
  useEffect(() => {
    if (
      selectedWorkType !== "ALL" &&
      !availableWorkTypes.some((item) => item.code === selectedWorkType)
    ) {
      setSelectedWorkType("ALL");
      localStorage.setItem("task-quest-work-type", "ALL");
    }
  }, [availableWorkTypes, selectedWorkType]);

  const selectedWorkflowItems = useMemo(
    () =>
      selectedWorkType === "ALL"
        ? workflowItems
        : workflowItems.filter(
            (item) =>
              String(item.domainCode || "EMISSION").toUpperCase() ===
              selectedWorkType,
          ),
    [selectedWorkType, workflowItems],
  );
  const selectedProjectId = effectiveProjectId;
  const selectedDefinedProcesses = useMemo(
    () =>
      (data?.processCatalog || [])
        .filter(
          (item) =>
            selectedWorkType === "ALL" ||
            String(item.domainCode).toUpperCase() === selectedWorkType,
        )
        .map((item) => {
          const runtimeTasks = workflowItems.filter(
            (task) => task.processCode === item.processCode,
          );
          const runtimeCompleted = runtimeTasks.filter(
            (task) => task.status === "DONE",
          ).length;
          const runtimeProgress = runtimeTasks.length
            ? Math.round((runtimeCompleted * 100) / runtimeTasks.length)
            : Number(item.completionScore || 0);
          const assurance = (data?.designAssurance || []).find(
            (entry) => entry.processCode === item.processCode,
          );
          const applicability = (data?.projectProcesses || []).find(
            (entry) =>
              entry.processCode === item.processCode &&
              (!selectedProjectId || entry.projectId === selectedProjectId),
          );
          const pageDesign = (data?.pageDesignCoverage || []).find(
            (entry) => entry.processCode === item.processCode,
          );
          const runtimeState = runtimeTasks.length
            ? runtimeCompleted === runtimeTasks.length
              ? "COMPLETED"
              : runtimeTasks.some((task) => task.status === "IN_PROGRESS")
                ? "IN_PROGRESS"
                : "READY"
            : applicability?.applicabilityStatus === "EXCLUDED"
              ? "NOT_APPLICABLE"
              : applicability?.applicabilityStatus === "CONDITIONAL"
                ? "CONDITIONAL"
                : applicability?.implementationStatus === "BLOCKED" ||
                    assurance?.assuranceStatus === "DESIGN_BLOCKED"
                  ? "DESIGN_BLOCKED"
                  : applicability?.implementationStatus === "DESIGN_REQUIRED" ||
                      assurance?.assuranceStatus === "IMPLEMENTATION_PENDING" ||
                      assurance?.assuranceStatus === "REVIEW_REQUIRED"
                    ? "IMPLEMENTATION_PENDING"
                    : !item.businessScreenImplemented
                      ? "PAGE_NOT_IMPLEMENTED"
                    : selectedProjectId && !applicability
                      ? "NOT_APPLICABLE"
                      : item.targetUrl
                        ? "TASK_NOT_CREATED"
                        : "PAGE_NOT_IMPLEMENTED";
          const reason =
            applicability?.reasonText || assurance?.nextAction || "";
          return {
            ...item,
            workflowPhase: `${workflowPhaseLabel(item.workflowPhase, en)} · ${runtimeStateLabel(runtimeState, en)}`,
            completionScore: runtimeProgress,
            completedTasks: runtimeTasks.length
              ? runtimeCompleted
              : item.completedTasks,
            requiredTasks: runtimeTasks.length
              ? runtimeTasks.length
              : item.requiredTasks,
            runtimeTaskCount: runtimeTasks.length,
            runtimeCompletedCount: runtimeCompleted,
            runtimeState,
            designAccuracyScore: Number(assurance?.designAccuracyScore || 0),
            designBlockerCount: Number(assurance?.designBlockerCount || 0),
            assuranceStatus: assurance?.assuranceStatus || "DESIGN_NOT_AUDITED",
            applicabilityStatus:
              applicability?.applicabilityStatus || "UNASSESSED",
            implementationStatus:
              applicability?.implementationStatus || "UNASSESSED",
            executionStatus: applicability?.executionStatus || "NOT_STARTED",
            stateReason: reason,
            pageDesignCount: Number(pageDesign?.pageDesignCount || 0),
            userPageCount: Number(pageDesign?.userPageCount || 0),
            adminPageCount: Number(pageDesign?.adminPageCount || 0),
            fieldCount: Number(pageDesign?.fieldCount || 0),
            requiredFieldCount: Number(pageDesign?.requiredFieldCount || 0),
            dbResolvedFieldCount: Number(pageDesign?.dbResolvedFieldCount || 0),
            implementationFieldCount: Number(
              pageDesign?.implementationFieldCount || 0,
            ),
            handoffCount: Number(pageDesign?.handoffCount || 0),
            pageDesignStatus:
              pageDesign?.pageDesignStatus || "PAGE_DESIGN_NOT_AUDITED",
          };
        }),
    [
      data?.designAssurance,
      data?.processCatalog,
      data?.projectProcesses,
      data?.pageDesignCoverage,
      selectedProjectId,
      selectedWorkType,
      en,
      workflowItems,
    ],
  );
  const selectedCatalogProcess = useMemo(
    () =>
      selectedDefinedProcesses.find(
        (item) => item.processCode === selectedCatalogProcessCode,
      ),
    [selectedDefinedProcesses, selectedCatalogProcessCode],
  );
  const selectedProcessWaves = useMemo(() => {
    if (selectedCatalogProcess && selectedCatalogProcess.processCode !== "WORK_ASSIGNMENT") {
      const selectedProcessSteps = (data?.processCatalogSteps || [])
        .filter((step) => step.processCode === selectedCatalogProcess.processCode)
        .sort((left, right) => Number(left.stepOrder) - Number(right.stepOrder));
      if (selectedProcessSteps.length) {
        return selectedProcessSteps.map((step, index) => ({
          wave: index + 1,
          processes: [selectedCatalogProcess],
          stepCode: step.stepCode,
          stepName: step.stepName,
        }));
      }
    }
    const waves = new Map<number, typeof selectedDefinedProcesses>();
    selectedDefinedProcesses.forEach((process) => {
      const wave = Number(process.executionWave || process.workflowOrder || 1);
      const lane = waves.get(wave) || [];
      lane.push(process);
      waves.set(wave, lane);
    });
    return [...waves.entries()]
      .sort(([left], [right]) => left - right)
      .map(([wave, processes]) => ({
        wave,
        processes: processes.sort(
          (left, right) => Number(left.laneOrder || 1) - Number(right.laneOrder || 1),
        ),
        stepCode: "",
        stepName: "",
      }));
  }, [data?.processCatalogSteps, selectedCatalogProcess, selectedDefinedProcesses]);
  const visibleProcessWaves = useMemo(() => {
    const keyword = processKeyword.trim().toLocaleLowerCase();
    if (!keyword) return selectedProcessWaves;
    return selectedProcessWaves
      .map((wave) => ({
        ...wave,
        processes: wave.processes.filter((process) =>
          [
            process.processName,
            process.processCode,
            process.workflowPhase,
            process.laneCode,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase()
            .includes(keyword),
        ),
      }))
      .filter((wave) => wave.processes.length > 0);
  }, [processKeyword, selectedProcessWaves]);
  const visibleActorLanes = useMemo(() => {
    const accountActors = new Set(data?.accountActors || []);
    const actorVisible = (actorCode?: string) =>
      Boolean(
        data?.allVisible ||
          (actorCode && accountActors.has(actorCode)) ||
          (data?.assignmentManager && actorCode === "WORK_ASSIGNMENT_MANAGER"),
      );
    const laneMap = new Map<
      string,
      Array<{
        wave: number;
        process: (typeof selectedDefinedProcesses)[number];
        step?: NonNullable<QuestResponse["processCatalogSteps"]>[number];
      }>
    >();
    visibleProcessWaves.forEach((wave) => {
      wave.processes.forEach((process) => {
        if (process.processCode === "WORK_ASSIGNMENT") {
          const actorCode = process.ownerActorCode || "WORK_ASSIGNMENT_MANAGER";
          if (!actorVisible(actorCode)) return;
          const lane = laneMap.get(actorCode) || [];
          lane.push({ wave: wave.wave, process });
          laneMap.set(actorCode, lane);
          return;
        }
        const processSteps = (data?.processCatalogSteps || [])
          .filter((step) => step.processCode === process.processCode)
          .filter((step) => !wave.stepCode || step.stepCode === wave.stepCode)
          .sort((left, right) => Number(left.stepOrder) - Number(right.stepOrder));
        if (processSteps.length) {
          processSteps.forEach((step) => {
            const actorCode = step.actorCode || process.ownerActorCode || "UNASSIGNED";
            const lane = laneMap.get(actorCode) || [];
            lane.push({ wave: wave.wave, process, step });
            laneMap.set(actorCode, lane);
          });
          return;
        }
        const actorCode = process.ownerActorCode || "UNASSIGNED";
        const lane = laneMap.get(actorCode) || [];
        lane.push({ wave: wave.wave, process });
        laneMap.set(actorCode, lane);
      });
    });
    return [...laneMap.entries()].map(([actorCode, processes]) => ({
      actorCode,
      processes: processes.sort(
        (left, right) =>
          left.wave - right.wave ||
          Number(left.process.laneOrder || 1) - Number(right.process.laneOrder || 1),
      ),
    }));
  }, [data?.accountActors, data?.allVisible, data?.processCatalogSteps, visibleProcessWaves]);
  function synchronizeProcessViewport() {
    const canvas = processCanvasRef.current;
    if (!canvas) return;
    const total = Math.max(canvas.scrollWidth, 1);
    const width = Math.min(100, Math.max(6, (canvas.clientWidth / total) * 100));
    setProcessViewport({
      left: Math.min(100 - width, (canvas.scrollLeft / total) * 100),
      width,
    });
  }
  function fitProcessCanvas() {
    setProcessMapZoom(80);
    const canvas = processCanvasRef.current;
    if (canvas) canvas.scrollTo({ left: 0, top: 0, behavior: "smooth" });
    window.requestAnimationFrame(synchronizeProcessViewport);
  }
  useEffect(() => {
    if (!flowOpen || processMapMode !== "CANVAS") return;
    const frame = window.requestAnimationFrame(synchronizeProcessViewport);
    window.addEventListener("resize", synchronizeProcessViewport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", synchronizeProcessViewport);
    };
  }, [flowOpen, processMapMode, processMapZoom, visibleProcessWaves.length]);
  const selectedUnifiedProcess = useMemo(
    () =>
      selectedDefinedProcesses.find(
        (item) => item.processCode === selectedCatalogProcessCode,
      ),
    [selectedDefinedProcesses, selectedCatalogProcessCode],
  );
  const selectedCatalogSteps = useMemo(
    () =>
      (data?.processCatalogSteps || [])
        .filter((item) => item.processCode === selectedCatalogProcessCode)
        .sort((a, b) => Number(a.stepOrder) - Number(b.stepOrder)),
    [data?.processCatalogSteps, selectedCatalogProcessCode],
  );
  const assignmentSteps = useMemo(
    () => assignmentWorkspace?.steps || [],
    [assignmentWorkspace?.steps],
  );
  const assignmentTargetProcessCode = selectedCatalogProcessCode === "WORK_ASSIGNMENT"
    ? "EMISSION_PROJECT"
    : selectedCatalogProcessCode;
  useEffect(() => {
    if (!flowOpen || !data?.assignmentManager || selectedCatalogProcessCode !== "WORK_ASSIGNMENT") return;
    const query = new URLSearchParams();
    if (effectiveProjectId) query.set("projectId", effectiveProjectId);
    if (assignmentTargetProcessCode) query.set("processCode", assignmentTargetProcessCode);
    let cancelled = false;
    fetch(`${buildLocalizedPath("/home/api/work-assignments", "/en/home/api/work-assignments")}?${query}`, { credentials: "include" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "WORK_ASSIGNMENT_LOAD_FAILED");
        return body as AssignmentWorkspace;
      })
      .then(body => {
        if (cancelled) return;
        setAssignmentWorkspace(body);
        const next: Record<string, string> = {};
        (body.steps || []).forEach(step => { next[step.stepCode] = step.accountId || ""; });
        setStepAssignees(next);
        setAssignmentMessage("");
      })
      .catch(error => { if (!cancelled) setAssignmentMessage(error instanceof Error ? error.message : String(error)); });
    return () => { cancelled = true; };
  }, [assignmentTargetProcessCode, data?.assignmentManager, effectiveProjectId, flowOpen, selectedCatalogProcessCode]);

  useEffect(() => {
    if (!assignmentWorkspace || new URLSearchParams(window.location.search).get("assignment") !== "1") return;
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>("[data-work-assignment-console]")?.scrollIntoView({ block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [assignmentWorkspace]);

  function assignActorDefault(actorCode: string, accountId: string) {
    setStepAssignees(current => {
      const next = { ...current };
      assignmentSteps.filter(step => step.actorCode === actorCode).forEach(step => { next[step.stepCode] = accountId; });
      return next;
    });
  }

  async function saveAssignments() {
    if (!effectiveProjectId || !assignmentTargetProcessCode) return;
    const assignments = assignmentSteps.map(step => ({ stepCode: step.stepCode, accountId: stepAssignees[step.stepCode] || "" }));
    if (!assignments.length || assignments.some(item => !item.accountId)) {
      setAssignmentMessage(en ? "Select an account for every step." : "모든 단계의 담당 계정을 선택해 주세요.");
      return;
    }
    setAssignmentBusy(true); setAssignmentMessage("");
    try {
      const response = await fetch(buildLocalizedPath("/home/api/work-assignments", "/en/home/api/work-assignments"), {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ projectId: effectiveProjectId, processCode: assignmentTargetProcessCode, assignments }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "WORK_ASSIGNMENT_SAVE_FAILED");
      setAssignmentWorkspace(body);
      setAssignmentMessage(en ? `${body.updatedTaskCount || assignments.length} steps assigned.` : `${body.updatedTaskCount || assignments.length}개 단계 배정을 저장했습니다.`);
      await load();
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : String(error));
    } finally { setAssignmentBusy(false); }
  }
  const selectedNextProcess = useMemo(
    () =>
      selectedDefinedProcesses.find(
        (item) => item.processCode === selectedCatalogProcess?.nextProcessCode,
      ),
    [selectedCatalogProcess?.nextProcessCode, selectedDefinedProcesses],
  );

  useEffect(() => {
    if (
      selectedCatalogProcessCode &&
      !selectedDefinedProcesses.some(
        (item) => item.processCode === selectedCatalogProcessCode,
      )
    ) {
      setSelectedCatalogProcessCode("");
      localStorage.removeItem("task-quest-catalog-process");
    }
  }, [selectedCatalogProcessCode, selectedDefinedProcesses]);

  useEffect(() => {
    if (!flowOpen || !selectedCatalogProcessCode) return;
    const frame = window.requestAnimationFrame(() => {
      const guideLabel = en
        ? "Selected process guide"
        : "선택한 프로세스 업무 길잡이";
      const guide = Array.from(
        document.querySelectorAll<HTMLElement>("section"),
      ).find((element) => element.textContent?.includes(guideLabel));
      if (guide) {
        guide.tabIndex = -1;
        guide.scrollIntoView({ behavior: "smooth", block: "start" });
        guide.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [en, flowOpen, selectedCatalogProcessCode]);

  const processGroups = useMemo(() => {
    const groups = new Map<string, QuestTask[]>();
    selectedWorkflowItems
      .filter((item) => item.processCode === selectedCatalogProcessCode)
      .forEach((item) => {
        const key = `${item.projectId}|${item.processCode || "PROJECT_WORKFLOW"}`;
        const items = groups.get(key) || [];
        items.push(item);
        groups.set(key, items);
      });
    return Array.from(groups.entries());
  }, [selectedCatalogProcessCode, selectedWorkflowItems]);

  if (!data) return null;

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
    setFocusedStepCode(item.processStepCode || "");
    setSelectedWorkType(domainCode);
    localStorage.setItem("task-quest-focused-workflow", JSON.stringify(next));
    if (item.processStepCode)
      localStorage.setItem("task-quest-focused-step", item.processStepCode);
    localStorage.setItem("task-quest-work-type", domainCode);
    setOpen(true);
    setFlowOpen(false);
  }

  function selectWorkType(code: string) {
    setSelectedWorkType(code);
    setSelectedCatalogStep(0);
    localStorage.setItem("task-quest-work-type", code);
    localStorage.setItem("task-quest-catalog-step", "0");
    clearWorkflowFocus();
    const processes = (data?.processCatalog || [])
      .filter((process) => code !== "ALL" && String(process.domainCode).toUpperCase() === code)
      .sort(
        (left, right) =>
          Number(left.workflowOrder || Number.MAX_SAFE_INTEGER) -
            Number(right.workflowOrder || Number.MAX_SAFE_INTEGER) ||
          left.processCode.localeCompare(right.processCode),
      );
    const onlyProcessCode = processes.length === 1 ? processes[0].processCode : "";
    setSelectedCatalogProcessCode(onlyProcessCode);
    if (onlyProcessCode) {
      localStorage.setItem("task-quest-catalog-process", onlyProcessCode);
    } else {
      localStorage.removeItem("task-quest-catalog-process");
    }
  }

  function selectCatalogProcess(code: string) {
    setSelectedCatalogProcessCode(code);
    setSelectedCatalogStep(0);
    localStorage.setItem("task-quest-catalog-step", "0");
    localStorage.setItem("task-quest-catalog-process", code);
    const runtime = workflowItems.find((item) => item.processCode === code);
    if (runtime) {
      const focus = { projectId: runtime.projectId, processCode: code };
      setFocusedWorkflow(focus);
      localStorage.setItem(
        "task-quest-focused-workflow",
        JSON.stringify(focus),
      );
    } else {
      clearWorkflowFocus();
    }
  }

  function openFullWorkflow() {
    const processCode = focusedWorkflow?.processCode || task?.processCode || "";
    const process = (data?.processCatalog || []).find(
      (item) => item.processCode === processCode,
    );
    const domainCode = String(
      task?.domainCode || process?.domainCode || selectedWorkType || "ALL",
    ).toUpperCase();
    if (domainCode && domainCode !== "ALL") {
      setSelectedWorkType(domainCode);
      localStorage.setItem("task-quest-work-type", domainCode);
    }
    if (processCode) {
      const processSteps = (data?.processCatalogSteps || [])
        .filter((step) => step.processCode === processCode)
        .sort((left, right) => Number(left.stepOrder) - Number(right.stepOrder));
      const requestedStepCode = focusedStepCode || task?.processStepCode || "";
      const stepIndex = Math.max(
        0,
        requestedStepCode
          ? processSteps.findIndex((step) => step.stepCode === requestedStepCode)
          : 0,
      );
      setSelectedCatalogProcessCode(processCode);
      setSelectedCatalogStep(stepIndex);
      localStorage.setItem("task-quest-catalog-process", processCode);
      localStorage.setItem("task-quest-catalog-step", String(stepIndex));
    }
    setFlowOpen(true);
  }

  function guideRuntimeStep(step: NonNullable<QuestResponse["processCatalogSteps"]>[number]) {
    return workflowItems.find(
      (item) =>
        item.processCode === step.processCode &&
        (item.processStepCode === step.stepCode || Number(item.stepOrder) === Number(step.stepOrder)),
    );
  }

  function explicitProcessAssignment(processCode: string, stepCode: string) {
    return (data?.processAssignments || []).find(
      (assignment) =>
        assignment.projectId === effectiveProjectId &&
        assignment.processCode === processCode &&
        assignment.stepCode === stepCode,
    );
  }

  function guideRoute(step: NonNullable<QuestResponse["processCatalogSteps"]>[number],runtime?: QuestTask) {
    if(runtime?.targetUrl) return runtime.targetUrl;
    const userPortal = !window.location.pathname.startsWith("/admin/") &&
      window.location.pathname !== "/admin";
    if(userPortal) return step.userPath || step.adminPath || "";
    if(data?.allVisible) return step.adminPath || step.userPath || "";
    return step.userPath || "";
  }

  function guideActorAllowed(step: NonNullable<QuestResponse["processCatalogSteps"]>[number],runtime?: QuestTask) {
    if(data?.allVisible) return true;
    if(runtime) return runtime.actorActionable !== false;
    return (data?.accountActors || []).includes(String(step.actorCode || ""));
  }

  function guideTarget(route:string,step:NonNullable<QuestResponse["processCatalogSteps"]>[number],runtime?:QuestTask) {
    const localized=en&&!route.startsWith("/en/")&&!route.startsWith("/join/")?`/en${route}`:route;
    const target=new URL(localized,window.location.origin);
    if(effectiveProjectId&&!target.searchParams.has("projectId")) target.searchParams.set("projectId",effectiveProjectId);
    target.searchParams.set("processCode",step.processCode);
    target.searchParams.set("stepCode",step.stepCode);
    if(step.actorCode) target.searchParams.set("actorCode",step.actorCode);
    if(runtime?.id) target.searchParams.set("taskId",String(runtime.id));
    target.searchParams.set("guide","1");
    return `${target.pathname}${target.search}${target.hash}`;
  }

  function startSelectedProcessGuide() {
    if (selectedCatalogProcessCode === "WORK_ASSIGNMENT" && data?.assignmentManager) {
      const target = new URL(
        buildLocalizedPath("/emission/work-assignment", "/en/emission/work-assignment"),
        window.location.origin,
      );
      if (effectiveProjectId) target.searchParams.set("projectId", effectiveProjectId);
      target.searchParams.set("workTypeCode", "EMISSION");
      target.searchParams.set("processCode", "EMISSION_PROJECT");
      if (new URLSearchParams(window.location.search).get("testMode") === "1") {
        target.searchParams.set("testMode", "1");
      }
      target.searchParams.set("guide", "1");
      window.location.href = `${target.pathname}${target.search}`;
      return;
    }
    const available=(step:NonNullable<QuestResponse["processCatalogSteps"]>[number]) => {
      const runtime=guideRuntimeStep(step),route=guideRoute(step,runtime);
      if(!route||!guideActorAllowed(step,runtime)||runtime?.pendingPredecessors) return false;
      return !runtime || runtime.status === "DONE" || runtime.actionable !== false;
    };
    const index = Math.min(
      Math.max(0, selectedCatalogStep),
      Math.max(0, selectedCatalogSteps.length - 1),
    );
    if (!selectedCatalogSteps[index] || !available(selectedCatalogSteps[index])) return;
    const step=selectedCatalogSteps[index],runtime=guideRuntimeStep(step),route=guideRoute(step,runtime);
    setSelectedCatalogStep(index);
    localStorage.setItem("task-quest-catalog-step",String(index));
    window.location.href=guideTarget(route,step,runtime);
  }

  function clearWorkflowFocus() {
    setFocusedWorkflow(null);
    setFocusedStepCode("");
    localStorage.removeItem("task-quest-focused-workflow");
    localStorage.removeItem("task-quest-focused-step");
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
          body: JSON.stringify({ status: "IN_PROGRESS" }),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.message ||
              (en
                ? "Unable to start the task."
                : "업무를 시작하지 못했습니다."),
          );
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
          body: JSON.stringify({ status: "IN_PROGRESS" }),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.message ||
              (en
                ? "Unable to start the task."
                : "업무를 시작하지 못했습니다."),
          );
      }
      window.location.href = taskHref(task, en);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  const blocked = Boolean(task && task.actionable === false);
  const focusedTasks = focusedWorkflow
    ? (data?.items || []).filter(
        (item) =>
          item.projectId === focusedWorkflow.projectId &&
          item.processCode === focusedWorkflow.processCode,
      )
    : [];
  const total = focusedTasks.length || Number(data?.summary?.total || 0);
  const completed = focusedTasks.length
    ? focusedTasks.filter((item) => item.status === "DONE").length
    : Number(data?.summary?.completed || 0);
  const progress =
    total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const workflowTotal = selectedWorkflowItems.length;
  const workflowCompleted = selectedWorkflowItems.filter(
    (item) => item.status === "DONE",
  ).length;
  const workflowProgress =
    workflowTotal > 0
      ? Math.min(100, Math.round((workflowCompleted / workflowTotal) * 100))
      : 0;

  return (
    <>
      <aside
        className="fixed right-3 top-[6.75rem] z-[950] w-[calc(100vw-1.5rem)] max-w-[23rem] sm:right-5 lg:right-8"
        data-task-quest-panel=""
      >
        {!open ? (
          <button
            className="ml-auto flex min-h-12 items-center gap-2 rounded-full border border-[#16408d] bg-white px-4 py-2 font-bold text-[#12356b] shadow-[0_10px_30px_rgba(15,43,87,.2)]"
            onClick={toggle}
            type="button"
          >
            <span className="material-symbols-outlined text-[21px]">
              assistant_navigation
            </span>
            {en ? "My next task" : "다음 업무"}
            {task ? (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                1
              </span>
            ) : null}
          </button>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,43,87,.22)]">
            <div className="flex items-center justify-between bg-[#052b57] px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[21px]">
                  assistant_navigation
                </span>
                <strong>{en ? "Task navigator" : "업무 길잡이"}</strong>
              </div>
              <button
                aria-label={en ? "Collapse" : "접기"}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15"
                onClick={toggle}
                type="button"
              >
                <span className="material-symbols-outlined">remove</span>
              </button>
            </div>
            <div className="p-4">
              {loading ? (
                <p className="py-5 text-center text-sm text-slate-500">
                  {en
                    ? "Loading your tasks..."
                    : "담당 업무를 확인하고 있습니다."}
                </p>
              ) : task ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#246beb]">
                        {task.projectName || task.projectId}
                      </p>
                      <h2 className="mt-1 text-lg font-black leading-6 text-slate-900">
                        {task.name}
                      </h2>
                      {focusedWorkflow ? (
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {task.processName || task.processCode} ·{" "}
                          {en ? "Focused workflow" : "선택 프로세스 진행 중"}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${dueLabel(task.dueDate, en).includes(en ? "overdue" : "지연") ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-800"}`}
                    >
                      {dueLabel(task.dueDate, en)}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#246beb]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-xs font-bold text-slate-500">
                    {en
                      ? `${completed} of ${total} completed`
                      : `전체 업무 ${total}개 중 ${completed}개 완료`}
                  </p>
                  <dl className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-bold text-slate-500">
                        {en ? "Process" : "프로세스"}
                      </dt>
                      <dd className="font-semibold text-slate-800">
                        {task.processName || task.processCode || "-"}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-bold text-slate-500">
                        {en ? "Step" : "현재 단계"}
                      </dt>
                      <dd className="font-semibold text-[#16408d]">
                        {task.stepOrder ? `${task.stepOrder}. ` : ""}
                        {task.name}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-bold text-slate-500">
                        {en ? "Assignee" : "담당자"}
                      </dt>
                      <dd className="font-semibold text-slate-800">
                        {actorLabel(task.actorCode)}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-bold text-slate-500">
                        {en ? "Account" : "담당 계정"}
                      </dt>
                      <dd className="font-semibold text-slate-800">
                        {task.assignee || (en ? "Not assigned" : "미배정")}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-bold text-slate-500">
                        {en ? "Purpose" : "업무 목적"}
                      </dt>
                      <dd className="line-clamp-2 text-slate-700">
                        {task.workPurpose || task.name}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-bold text-slate-500">
                        {en ? "Done when" : "완료 조건"}
                      </dt>
                      <dd className="line-clamp-2 text-slate-700">
                        {task.completionRule ||
                          (en
                            ? "Complete the required action on the task page."
                            : "업무 화면의 필수 처리를 완료하세요.")}
                      </dd>
                    </div>
                    {task.nextTaskName ? (
                      <div className="flex gap-2">
                        <dt className="w-16 shrink-0 font-bold text-slate-500">
                          {en ? "Next" : "다음 업무"}
                        </dt>
                        <dd className="text-slate-700">
                          <b>{task.nextTaskName}</b>
                          {task.nextActorCode ? ` · ${task.nextActorCode}` : ""}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {blocked ? (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                      <span className="material-symbols-outlined mr-1 align-middle text-[18px]">
                        lock_clock
                      </span>
                      {task.pendingPredecessors ||
                        task.blockedReason ||
                        (en
                          ? "Complete the preceding task first."
                          : "선행 업무를 먼저 완료해야 합니다.")}
                    </p>
                  ) : null}
                  {message ? (
                    <p className="mt-3 text-sm font-bold text-red-700">
                      {message}
                    </p>
                  ) : null}
                  <button
                    className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#246beb] px-4 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={blocked}
                    onClick={() => void startTask()}
                    type="button"
                  >
                    {task.status === "IN_PROGRESS"
                      ? en
                        ? "Continue task"
                        : "업무 계속하기"
                      : en
                        ? "Start task"
                        : "업무 시작하기"}
                    <span className="material-symbols-outlined text-[19px]">
                      arrow_forward
                    </span>
                  </button>
                  {focusedWorkflow ? (
                    <button
                      className="mt-2 w-full text-xs font-bold text-slate-500 hover:text-[#246beb]"
                      onClick={clearWorkflowFocus}
                      type="button"
                    >
                      {en
                        ? "Return to automatic recommendations"
                        : "자동 업무 추천으로 돌아가기"}
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="py-4 text-center">
                  <span className="material-symbols-outlined text-4xl text-emerald-600">
                    task_alt
                  </span>
                  <p className="mt-2 font-black text-slate-900">
                    {en
                      ? "All assigned tasks are complete."
                      : "배정된 업무를 모두 완료했습니다."}
                  </p>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-bold">
                <button
                  className="text-[#246beb] hover:underline"
                  onClick={openFullWorkflow}
                  type="button"
                >
                  {en ? "View full workflow" : "전체 업무 보기"}
                </button>
                <a
                  className="flex items-center gap-1 text-slate-600 hover:text-[#246beb]"
                  href={buildLocalizedPath(
                    "/support/inquiry",
                    "/en/support/inquiry",
                  )}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    help
                  </span>
                  {en ? "Q&A" : "업무 질문"}
                </a>
              </div>
            </div>
          </div>
        )}
      </aside>
      {flowOpen
        ? createPortal(
            <div
              aria-labelledby="task-process-map-title"
              aria-modal="true"
              className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[2px] sm:p-6"
              role="dialog"
            >
              <button
                aria-label={en ? "Close workflow" : "전체 업무 닫기"}
                className="absolute inset-0 cursor-default"
                onClick={() => setFlowOpen(false)}
                type="button"
              />
              <section className="relative flex max-h-[94vh] w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7 sm:py-5">
                  <div>
                    <p className="text-sm font-bold text-[#246beb]">
                      {en
                        ? "Personal workflow guide"
                        : "로그인 사용자 맞춤 업무 안내"}
                    </p>
                    <h2
                      className="mt-1 text-xl font-black text-[#052b57] sm:text-2xl"
                      id="task-process-map-title"
                    >
                      {en ? "My full task workflow" : "전체 업무 프로세스"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {en
                        ? "Follow the flow from left to right. Select a task to open its working screen."
                        : "왼쪽에서 오른쪽 순서로 진행합니다. 업무를 선택하면 해당 처리 화면으로 바로 이동합니다."}
                    </p>
                  </div>
                  <button
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
                    onClick={() => setFlowOpen(false)}
                    type="button"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </header>
                <div className="overflow-y-auto bg-slate-50 px-5 py-5 sm:px-7 sm:py-6">
                  <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <h3 className="mt-1 text-lg font-black text-[#052b57]">
                          {en ? "Select work type" : "업무 종류 선택"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {en
                            ? "Select a work type to view its available processes."
                            : "업무 종류를 선택하면 관련 업무 프로세스가 바로 표시됩니다."}
                        </p>
                      </div>
                      <label className="text-sm font-bold text-slate-700">
                        {en ? "Work type" : "업무 종류"}
                        <select
                          className="ml-2 min-h-10 rounded-lg border border-slate-300 bg-white px-3"
                          onChange={(event) =>
                            selectWorkType(event.target.value)
                          }
                          value={selectedWorkType}
                        >
                          <option value="ALL">
                            {en ? "All work" : "전체 업무"} (
                            {definedProcessTotal})
                          </option>
                          {availableWorkTypes.map((item) => (
                            <option key={item.code} value={item.code}>
                              {item.label} ({item.definedCount})
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </section>
                  {selectedDefinedProcesses.length ? (
                    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-[#246beb]">
                            {en ? "Select process" : "업무 프로세스 선택"}
                          </p>
                          <h3 className="mt-1 text-lg font-black text-[#052b57]">
                            {en
                              ? "Review the workflow and select the work to continue"
                              : "전체 흐름을 확인하고 진행할 업무를 선택하세요"}
                          </h3>
                        </div>
                        <label className="min-w-[18rem] text-sm font-bold text-slate-700">
                          {en ? "Process" : "업무 프로세스"}
                          <select
                            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-semibold text-[#052b57]"
                            onChange={(event) => selectCatalogProcess(event.target.value)}
                            value={selectedCatalogProcessCode}
                          >
                            <option value="">{en ? "Select a process" : "프로세스를 선택하세요"}</option>
                            {selectedDefinedProcesses.map((process, index) => (
                              <option key={`process-select-${process.processCode}`} value={process.processCode}>
                                {index + 1}. {process.processName}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className={`mt-4 grid overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${processMapMode === "FLOW" ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : "grid-cols-1"}`}>
                        <div className={`min-w-0 border-b border-slate-200 ${processMapMode === "FLOW" ? "lg:border-b-0 lg:border-r" : ""}`}>
                          <div className="flex flex-col gap-2 border-b border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
                            <label className="relative block min-w-0 flex-1">
                              <span className="sr-only">
                                {en ? "Search processes" : "업무 프로세스 검색"}
                              </span>
                              <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
                                search
                              </span>
                              <input
                                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#246beb] focus:ring-2 focus:ring-blue-100"
                                onChange={(event) => setProcessKeyword(event.target.value)}
                                placeholder={en ? "Search by process name or code" : "프로세스명 또는 코드 검색"}
                                type="search"
                                value={processKeyword}
                              />
                            </label>
                            <div className="flex h-10 shrink-0 items-center rounded-lg border border-slate-300 bg-white">
                              <button
                                aria-label={en ? "Zoom out" : "축소"}
                                className="h-full w-10 text-lg font-bold text-slate-600 disabled:text-slate-300"
                                disabled={processMapZoom <= 80}
                                onClick={() => setProcessMapZoom((value) => Math.max(80, value - 20))}
                                type="button"
                              >
                                −
                              </button>
                              <span className="min-w-14 border-x border-slate-200 text-center text-xs font-black text-slate-700">
                                {processMapZoom}%
                              </span>
                              <button
                                aria-label={en ? "Zoom in" : "확대"}
                                className="h-full w-10 text-lg font-bold text-slate-600 disabled:text-slate-300"
                                disabled={processMapZoom >= 120}
                                onClick={() => setProcessMapZoom((value) => Math.min(120, value + 20))}
                                type="button"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div
                            className={`relative overflow-auto p-4 ${processMapMode === "CANVAS" ? "min-h-[38rem] bg-slate-100" : processMapMode === "FLOW" ? "min-h-[25rem]" : "min-h-0"}`}
                            onScroll={processMapMode === "CANVAS" ? synchronizeProcessViewport : undefined}
                            ref={processCanvasRef}
                          >
                            {processMapMode === "CANVAS" ? (
                              <div className="sticky left-full top-0 z-30 w-40 -translate-x-full rounded-xl border border-slate-300 bg-white/95 p-2 shadow-lg backdrop-blur">
                                <div className="flex items-center justify-between text-[10px] font-black text-slate-600">
                                  <span>{en ? "Process minimap" : "전체 프로세스 위치"}</span>
                                  <button className="text-[#246beb]" onClick={fitProcessCanvas} type="button">
                                    {en ? "Fit" : "화면 맞춤"}
                                  </button>
                                </div>
                                <button
                                  aria-label={en ? "Move process canvas" : "전체 프로세스 위치 이동"}
                                  className="relative mt-2 block h-12 w-full cursor-pointer overflow-hidden rounded border border-slate-200 bg-slate-50"
                                  onClick={(event) => {
                                    const canvas = processCanvasRef.current;
                                    if (!canvas) return;
                                    const bounds = event.currentTarget.getBoundingClientRect();
                                    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
                                    canvas.scrollTo({ left: Math.max(0, ratio * canvas.scrollWidth - canvas.clientWidth / 2), behavior: "smooth" });
                                  }}
                                  type="button"
                                >
                                  {visibleActorLanes.slice(0, 5).map((lane, laneIndex) => (
                                    <div className="absolute left-2 right-2 flex items-center gap-1" key={`minimap-${lane.actorCode}`} style={{ top: `${5 + laneIndex * 8}px` }}>
                                      {visibleProcessWaves.map((wave) => (
                                        <i className="h-1 flex-1 rounded-full bg-blue-300" key={`minimap-${lane.actorCode}-${wave.wave}`} />
                                      ))}
                                    </div>
                                  ))}
                                  <span
                                    className="pointer-events-none absolute inset-y-1 rounded border-2 border-[#246beb] bg-blue-100/20 transition-[left,width]"
                                    style={{ left: `${processViewport.left}%`, width: `${processViewport.width}%` }}
                                  />
                                </button>
                              </div>
                            ) : null}
                            {visibleProcessWaves.length ? (processMapMode === "FLOW" ? (
                              <ol
                                className="flex min-w-max items-center py-5 transition-transform"
                                style={{
                                  transform: `scale(${processMapZoom / 100})`,
                                  transformOrigin: "left top",
                                }}
                              >
                                <li className="flex items-center">
                                  <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-xs font-black text-slate-600">
                                    {en ? "Start" : "시작"}
                                  </span>
                                  <span className="h-0.5 w-8 bg-[#246beb]" />
                                </li>
                                {visibleProcessWaves.map((wave, waveIndex) => (
                                  <li className="flex items-center" key={`wave-${wave.wave}`}>
                                    <section className="relative w-52 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                                      <div className="mb-2 flex items-center justify-between gap-2">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#052b57] text-xs font-black text-white">
                                          {wave.wave}
                                        </span>
                                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${wave.processes.length > 1 ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-600"}`}>
                                          {wave.processes.length > 1
                                            ? en ? `${wave.processes.length} parallel` : `${wave.processes.length}개 병렬`
                                            : en ? "Sequential" : "순차"}
                                        </span>
                                      </div>
                                      <div className={`space-y-2 ${wave.processes.length > 1 ? "border-l-2 border-violet-200 pl-2" : ""}`}>
                                        {wave.processes.map((process) => {
                                          const selected = selectedCatalogProcessCode === process.processCode;
                                          return (
                                            <button
                                              aria-pressed={selected}
                                              className={`group w-full rounded-xl border-2 p-3 text-left transition ${selected ? "border-[#246beb] bg-blue-50 shadow" : "border-slate-200 bg-white hover:border-blue-300"}`}
                                              key={`map-${process.processCode}`}
                                              onClick={() => selectCatalogProcess(process.processCode)}
                                              type="button"
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <strong className="text-sm leading-5 text-[#052b57]">
                                                  {process.processName}
                                                </strong>
                                                <span className={`material-symbols-outlined shrink-0 text-[19px] ${selected ? "text-[#246beb]" : "text-slate-300"}`}>
                                                  {selected ? "check_circle" : "radio_button_unchecked"}
                                                </span>
                                              </div>
                                              <span className="mt-2 block text-[11px] font-bold text-slate-500">
                                                {actorLabel(process.ownerActorCode)}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </section>
                                    <span className={`material-symbols-outlined mx-2 text-2xl ${waveIndex < visibleProcessWaves.length - 1 ? "text-[#246beb]" : "text-slate-400"}`}>
                                      arrow_forward
                                    </span>
                                  </li>
                                ))}
                                <li>
                                  <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-emerald-400 bg-white text-xs font-black text-emerald-700">
                                    {en ? "Done" : "완료"}
                                  </span>
                                </li>
                              </ol>
                            ) : (
                              <div
                                className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${processMapMode === "CANVAS" ? "my-4 max-w-none shadow-xl" : "w-full max-w-full"}`}
                                style={{
                                  ...(processMapMode === "CANVAS"
                                    ? {
                                        width: `${selectedWorkType === "WORK_ASSIGNMENT" ? 44 : Math.max(112, 9 + visibleProcessWaves.length * 14)}rem`,
                                        minWidth: `${selectedWorkType === "WORK_ASSIGNMENT" ? 44 : Math.max(112, 9 + visibleProcessWaves.length * 14)}rem`,
                                        zoom: processMapZoom / 100,
                                      }
                                    : {
                                        transform: `scale(${processMapZoom / 100})`,
                                        transformOrigin: "left top",
                                      }),
                                }}
                              >
                                <div
                                  className="grid border-b border-slate-200 bg-slate-50"
                                  style={{ gridTemplateColumns: `9rem repeat(${Math.max(1, visibleProcessWaves.length)}, ${processMapMode === "CANVAS" ? (selectedWorkType === "WORK_ASSIGNMENT" ? "32rem" : "14rem") : "minmax(0, 1fr)"})` }}
                                >
                                  <strong className="flex min-h-14 items-center border-r border-slate-200 px-4 text-xs text-[#052b57]">
                                    {en ? "Assignee" : "담당자"}
                                  </strong>
                                  {visibleProcessWaves.map((wave) => (
                                    <div className="flex min-h-16 flex-col items-center justify-center border-r border-dashed border-slate-200 px-3 py-2 text-center last:border-r-0" key={`actor-head-${wave.wave}`}>
                                      <strong className="line-clamp-2 text-xs leading-5 text-[#052b57]" title={wave.processes.map((process) => process.processName).join(" · ")}>
                                        {wave.stepName || wave.processes.map((process) => process.processName).join(" · ")}
                                      </strong>
                                      <span className="mt-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-[#164f86]">
                                        {en ? `Step ${wave.wave}` : `${wave.wave}단계`}
                                        {wave.processes.length > 1 ? (en ? " · Parallel" : " · 병렬") : ""}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {visibleActorLanes.map((lane) => (
                                  <div
                                    className="grid border-b border-slate-200 last:border-b-0"
                                    key={`actor-lane-${lane.actorCode}`}
                                    style={{ gridTemplateColumns: `9rem repeat(${Math.max(1, visibleProcessWaves.length)}, ${processMapMode === "CANVAS" ? (selectedWorkType === "WORK_ASSIGNMENT" ? "32rem" : "14rem") : "minmax(0, 1fr)"})` }}
                                  >
                                    <div className="flex min-h-28 items-center gap-2 border-r border-slate-200 bg-[#052b57] px-3 text-white">
                                      <span className="material-symbols-outlined flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[18px] text-[#052b57]">person</span>
                                      <span className="min-w-0">
                                        <strong className="block break-words text-xs leading-5">{actorLabel(lane.actorCode)}</strong>
                                      </span>
                                    </div>
                                    {visibleProcessWaves.map((wave) => {
                                      const waveProcesses = lane.processes.filter((item) => item.wave === wave.wave);
                                      return (
                                        <div className="relative flex min-h-28 items-center justify-center border-r border-dashed border-slate-200 px-3 py-4 last:border-r-0" key={`${lane.actorCode}-${wave.wave}`}>
                                          {waveProcesses.length ? (
                                            <div className="relative z-10 w-full space-y-2">
                                              {waveProcesses.map(({ process, step }) => {
                                                const runtimeStep = step
                                                  ? guideRuntimeStep(step)
                                                  : workflowItems.find((item) => item.processCode === process.processCode);
                                                const assignment = explicitProcessAssignment(
                                                  process.processCode,
                                                  step?.stepCode || "__PROCESS__",
                                                );
                                                const assignedAccount = assignment?.accountId ||
                                                  (runtimeStep?.explicitlyAssigned ? runtimeStep.assignee : undefined);
                                                const assignedToAccount = Boolean(
                                                  assignedAccount && data?.actorId &&
                                                  assignedAccount.toLocaleLowerCase() === data.actorId.toLocaleLowerCase(),
                                                );
                                                const explicitlyAssigned = Boolean(assignedAccount);
                                                const stepIndex = step
                                                  ? selectedCatalogSteps.findIndex((item) => item.stepCode === step.stepCode)
                                                  : 0;
                                                const selected = selectedCatalogProcessCode === process.processCode && stepIndex === selectedCatalogStep;
                                                const feedback = /REJECT|REVISION|RECALC|SUPPLEMENT|RETURN/i.test(`${step?.commandCode || ""} ${step?.toState || ""}`);
                                                const status = Number(process.blockedTasks || 0) > 0
                                                  ? (en ? "Revision" : "보완")
                                                  : process.runtimeState === "COMPLETED" || Number(process.completionScore || 0) >= 100
                                                    ? (en ? "Done" : "완료")
                                                    : Number(process.runtimeTaskCount || 0) > 0
                                                      ? (en ? "Active" : "진행중")
                                                      : (en ? "Waiting" : "대기");
                                                return (
                                                  <button
                                                    aria-pressed={selected}
                                                    className={`relative w-full rounded-xl border-2 px-3 py-2.5 text-left text-xs font-black leading-5 transition ${feedback ? "border-violet-300 bg-violet-50" : selected ? "border-[#246beb] bg-blue-50 text-[#052b57] shadow" : "border-blue-200 bg-white text-slate-700 hover:border-[#246beb]"}`}
                                                    key={`actor-process-${process.processCode}-${step?.stepCode || "process"}`}
                                                    onClick={() => {
                                                      selectCatalogProcess(process.processCode);
                                                      const processSteps = (data?.processCatalogSteps || [])
                                                        .filter((item) => item.processCode === process.processCode)
                                                        .sort((left, right) => Number(left.stepOrder) - Number(right.stepOrder));
                                                      const nextIndex = Math.max(0, step ? processSteps.findIndex((item) => item.stepCode === step.stepCode) : 0);
                                                      setSelectedCatalogStep(nextIndex);
                                                      localStorage.setItem("task-quest-catalog-step", String(nextIndex));
                                                    }}
                                                    type="button"
                                                  >
                                                    <span className="block pr-12">{step?.stepName || process.processName}</span>
                                                    {process.processCode === "WORK_ASSIGNMENT" && !step ? (
                                                      <span className="mt-3 grid grid-cols-4 gap-1.5">
                                                        {(data?.processCatalogSteps || [])
                                                          .filter((item) => item.processCode === "WORK_ASSIGNMENT")
                                                          .sort((left, right) => Number(left.stepOrder) - Number(right.stepOrder))
                                                          .map((item) => (
                                                            <span className="rounded-lg border border-blue-200 bg-white px-1.5 py-2 text-center" key={`assignment-mini-${item.stepCode}`}>
                                                              <b className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-[#0755b5] text-[10px] text-white">{item.stepOrder}</b>
                                                              <small className="mt-1 block break-keep text-[9px] leading-3 text-slate-600">{item.stepName}</small>
                                                            </span>
                                                          ))}
                                                      </span>
                                                    ) : null}
                                                    <small className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] ${status === "완료" || status === "Done" ? "bg-emerald-100 text-emerald-700" : status === "보완" || status === "Revision" ? "bg-orange-100 text-orange-700" : status === "진행중" || status === "Active" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{status}</small>
                                                    <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${assignedToAccount ? "bg-[#052b57] text-white" : explicitlyAssigned ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                                      {assignedToAccount
                                                        ? (en ? "Assigned to me" : "내 배정 업무")
                                                        : explicitlyAssigned
                                                          ? (en ? `Assigned to ${assignedAccount}` : `배정됨 · ${assignedAccount}`)
                                                          : (en ? "Unassigned" : "미배정")}
                                                    </span>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          ) : <span className="h-px w-full bg-slate-100" aria-hidden="true" />}
                                          {wave.wave < visibleProcessWaves[visibleProcessWaves.length - 1]?.wave && waveProcesses.length ? (
                                            <span className="material-symbols-outlined absolute -right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[18px] text-[#246beb]" aria-hidden="true">arrow_forward</span>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            )) : (
                              <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-400">search_off</span>
                                <p className="mt-2 text-sm font-bold text-slate-700">
                                  {en ? "No matching processes" : "일치하는 업무 프로세스가 없습니다."}
                                </p>
                                <button className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold" onClick={() => setProcessKeyword("")} type="button">
                                  {en ? "Clear search" : "검색 초기화"}
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4 border-t border-slate-200 bg-white px-4 py-3 text-[11px] font-bold text-slate-600">
                            <span className="flex items-center gap-1.5"><i className="h-0.5 w-6 bg-[#246beb]" />{en ? "Sequential path" : "순차 업무 흐름"}</span>
                            <span className="flex items-center gap-1.5"><i className="h-3 w-0.5 bg-violet-300" />{en ? "Parallel branch" : "병렬 업무"}</span>
                            <span>
                              {selectedWorkType === "WORK_ASSIGNMENT"
                                ? `1${en ? " process" : "개 프로세스"}`
                                : `${visibleProcessWaves.reduce((count, wave) => count + wave.processes.length, 0)}${en ? " processes" : "개 프로세스"}`}
                            </span>
                          </div>
                        </div>
                        <aside className={`flex flex-col bg-white p-5 ${processMapMode === "FLOW" ? "min-h-[25rem]" : "min-h-0"}`}>
                          {selectedCatalogProcess ? (
                            <>
                              <p className="text-xs font-black uppercase tracking-wide text-[#246beb]">
                                {en ? "Selected work" : "선택한 업무"}
                              </p>
                              <div className="mt-3 flex items-start gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 font-black text-[#246beb]">
                                  {selectedCatalogProcess.executionWave || selectedCatalogProcess.workflowOrder || 1}
                                </span>
                                <div>
                                  <h4 className="text-lg font-black leading-6 text-[#052b57]">
                                    {selectedCatalogProcess.processName}
                                  </h4>
                                  <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {selectedCatalogProcess.goal || selectedCatalogSteps[0]?.workPurpose || (en ? "Follow the guided steps to complete this work." : "길잡이의 절차에 따라 업무를 완료합니다.")}
                                  </p>
                                </div>
                              </div>
                              <dl className={`mt-5 border-y border-slate-200 text-sm ${processMapMode !== "FLOW" ? "grid divide-y divide-slate-200 lg:grid-cols-3 lg:divide-x lg:divide-y-0" : "divide-y divide-slate-200"}`}>
                                <div className="grid grid-cols-[6rem_1fr] gap-3 py-3">
                                  <dt className="font-bold text-slate-600">{en ? "Owner" : "담당 주체"}</dt>
                                  <dd className="font-black text-slate-900">{actorLabel(selectedCatalogProcess.ownerActorCode)}</dd>
                                </div>
                                <div className="grid grid-cols-[6rem_1fr] gap-3 py-3">
                                  <dt className="font-bold text-slate-600">{en ? "Steps" : "진행 절차"}</dt>
                                  <dd className="font-black text-slate-900">{selectedCatalogSteps.length}{en ? " steps" : "단계"}</dd>
                                </div>
                                <div className="grid grid-cols-[6rem_1fr] gap-3 py-3">
                                  <dt className="font-bold text-slate-600">{en ? "Complete when" : "완료 조건"}</dt>
                                  <dd className="leading-5 text-slate-700">{selectedCatalogSteps[selectedCatalogSteps.length - 1]?.completionRule || (en ? "All required steps are complete" : "필수 절차가 모두 완료됨")}</dd>
                                </div>
                              </dl>
                              {selectedNextProcess ? (
                                <div className="mt-4 rounded-xl bg-slate-50 p-3">
                                  <span className="text-[11px] font-bold text-slate-500">{en ? "Next work" : "다음 업무"}</span>
                                  <strong className="mt-1 block text-sm text-[#052b57]">{selectedNextProcess.processName}</strong>
                                </div>
                              ) : null}
                              <button
                                className="mt-auto rounded-xl bg-[#052b57] px-4 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                                disabled={(() => {
                                  if (selectedCatalogProcessCode === "WORK_ASSIGNMENT") {
                                    return !data?.assignmentManager;
                                  }
                                  const step = selectedCatalogSteps[selectedCatalogStep];
                                  if (!step) return true;
                                  const runtimeStep = guideRuntimeStep(step);
                                  return !guideRoute(step, runtimeStep) ||
                                    !guideActorAllowed(step, runtimeStep) ||
                                    Boolean(runtimeStep?.pendingPredecessors) ||
                                    (runtimeStep?.status !== "DONE" &&
                                      runtimeStep?.actionable === false);
                                })()}
                                onClick={startSelectedProcessGuide}
                                type="button"
                              >
                                {en ? "Open selected step" : "선택 단계 업무 길잡이 시작"}
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-1 flex-col items-center justify-center text-center">
                              <span className="material-symbols-outlined text-4xl text-slate-300">account_tree</span>
                              <p className="mt-3 text-sm font-bold text-slate-700">
                                {en ? "Select a process on the map." : "왼쪽 순서도에서 업무를 선택하세요."}
                              </p>
                            </div>
                          )}
                        </aside>
                      </div>
                    </section>
                  ) : null}
                  {data?.assignmentManager && selectedCatalogProcessCode === "WORK_ASSIGNMENT" && selectedCatalogProcess ? (
                    <section className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm sm:p-5" data-work-assignment-console="">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-[#246beb]">{en ? "WORK ASSIGNMENT" : "기업 업무 배정"}</p>
                          <h3 className="mt-1 text-lg font-black text-[#052b57]">{en ? "Review assignment status" : "프로젝트 담당자 배정 현황"}</h3>
                          <p className="mt-1 text-sm leading-6 text-blue-900">{en ? "Use the dedicated workspace to assign or change company accounts and notify assignees." : "전체 업무 보기에서는 배정 현황을 확인하고, 전용 화면에서 계정 지정·변경·알림을 처리합니다."}</p>
                        </div>
                        <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#0755b5] px-5 font-black text-white" href={buildLocalizedPath(`/emission/work-assignment${effectiveProjectId ? `?projectId=${encodeURIComponent(effectiveProjectId)}` : ""}`, `/en/emission/work-assignment${effectiveProjectId ? `?projectId=${encodeURIComponent(effectiveProjectId)}` : ""}`)}>
                          <span className="material-symbols-outlined">assignment_ind</span>{en ? "Open assignment workspace" : "업무 배정 관리 열기"}
                        </a>
                      </div>
                    </section>
                  ) : null}
                  {false && data?.assignmentManager && selectedCatalogProcessCode === "WORK_ASSIGNMENT" && selectedCatalogProcess && effectiveProjectId ? (
                    <section className="mb-5 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5" data-work-assignment-console="">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-[#246beb]">{en ? "WORK ASSIGNMENT" : "기업 업무 배정"}</p>
                          <h3 className="mt-1 text-lg font-black text-[#052b57]">{en ? "Assign actors and process steps" : "액터·단계별 담당 계정 배정"}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{en ? "Only active accounts in your company can be assigned. Actor defaults can be overridden per step." : "현재 기업의 활성 계정만 선택할 수 있습니다. 액터 기본 담당자를 적용한 뒤 단계별로 변경할 수 있습니다."}</p>
                        </div>
                        <label className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-900">
                          {en ? "Project" : "배정 프로젝트"}
                          <select className="max-w-64 bg-transparent outline-none" onChange={(event) => {
                            setSelectedOverviewProjectId(event.target.value);
                            localStorage.setItem("task-quest-overview-project", event.target.value);
                          }} value={effectiveProjectId}>
                            {(assignmentWorkspace?.projects || []).map(project => <option key={project.projectId} value={project.projectId}>{project.projectName} · {project.projectId}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.5fr)]">
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{en ? "Actor defaults" : "액터 기본 담당자"}</h4>
                          <div className="mt-3 space-y-3">
                            {[...new Set(assignmentSteps.map(step => step.actorCode || "UNASSIGNED"))].map(actorCode => {
                              const actorSteps = assignmentSteps.filter(step => (step.actorCode || "UNASSIGNED") === actorCode);
                              const assigned = [...new Set(actorSteps.map(step => stepAssignees[step.stepCode]).filter(Boolean))];
                              return <label className="block rounded-xl border border-slate-200 bg-slate-50 p-3" key={actorCode}>
                                <span className="text-xs font-black text-[#052b57]">{actorLabel(actorCode)} <small className="ml-1 font-bold text-slate-500">{actorSteps.length}{en ? " steps" : "개 단계"}</small></span>
                                <select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" onChange={event => assignActorDefault(actorCode, event.target.value)} value={assigned.length === 1 ? assigned[0] : ""}>
                                  <option value="">{en ? "Select company account" : "기업 계정 선택"}</option>
                                  {(assignmentWorkspace?.accounts || []).map(account => <option key={`${actorCode}-${account.accountId}`} value={account.accountId}>{account.accountName} · {account.accountId}{account.department ? ` · ${account.department}` : ""}</option>)}
                                </select>
                              </label>;
                            })}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-black text-slate-900">{en ? "Step assignments" : "단계별 담당 계정"}</h4><span className="text-xs font-bold text-slate-500">{selectedCatalogSteps.length}{en ? " steps" : "개 단계"}</span></div>
                          <ol className="mt-3 space-y-2">
                            {assignmentSteps.map(step => <li className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(13rem,0.9fr)] sm:items-center" key={`assign-${step.stepCode}`}>
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#052b57] text-xs font-black text-white">{step.stepOrder}</span>
                              <span><strong className="block text-sm text-[#052b57]">{step.stepName}</strong><small className="font-bold text-slate-500">{actorLabel(step.actorCode)}</small></span>
                              <select aria-label={`${step.stepName} 담당 계정`} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" onChange={event => setStepAssignees(current => ({ ...current, [step.stepCode]: event.target.value }))} value={stepAssignees[step.stepCode] || ""}>
                                <option value="">{en ? "Select account" : "담당 계정 선택"}</option>
                                {(assignmentWorkspace?.accounts || []).map(account => <option key={`${step.stepCode}-${account.accountId}`} value={account.accountId}>{account.accountName} · {account.accountId}</option>)}
                              </select>
                            </li>)}
                          </ol>
                        </div>
                      </div>
                      {assignmentMessage ? <p className={`mt-4 rounded-lg p-3 text-sm font-bold ${assignmentMessage.includes("저장") || assignmentMessage.includes("assigned") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} role="status">{assignmentMessage}</p> : null}
                      <div className="mt-4 flex justify-end"><button className="min-h-12 rounded-lg bg-[#0755b5] px-6 font-black text-white disabled:bg-slate-300" disabled={assignmentBusy || !selectedCatalogSteps.length} onClick={() => void saveAssignments()} type="button">{assignmentBusy ? (en ? "Saving..." : "저장 중...") : (en ? "Save assignments and notify" : "배정 저장·담당자 알림")}</button></div>
                    </section>
                  ) : null}
                  {false && selectedCatalogProcessCode === "EMISSION_PROJECT_PORTFOLIO" ? (
                    <section className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                            {en ? "Connected project workflow" : "프로젝트 선택 후 연결 업무"}
                          </p>
                          <h3 className="mt-1 text-lg font-black text-[#052b57]">
                            {en ? "Carbon emission project · 7 steps" : "탄소배출 프로젝트 수행 · 7단계"}
                          </h3>
                          <p className="mt-1 text-sm text-blue-900">
                            {en
                              ? "The dashboard selects a project, then the same seven steps shown on the page continue here."
                              : "배출량 현황에서 프로젝트를 선택하면 화면의 STEP 1~7과 동일한 순서로 업무가 이어집니다."}
                          </p>
                        </div>
                        <button
                          className="rounded-lg bg-[#246beb] px-4 py-2.5 text-sm font-black text-white"
                          onClick={() => selectCatalogProcess("EMISSION_PROJECT")}
                          type="button"
                        >
                          {en ? "Open 7-step workflow" : "7단계 프로세스 열기"}
                        </button>
                      </div>
                      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                        {(data?.processCatalogSteps || [])
                          .filter((step) => step.processCode === "EMISSION_PROJECT")
                          .sort((left, right) => Number(left.stepOrder) - Number(right.stepOrder))
                          .map((step) => (
                            <li className="rounded-xl border border-blue-100 bg-white p-3" key={step.stepCode}>
                              <span className="text-[11px] font-black text-blue-700">STEP {step.stepOrder}</span>
                              <strong className="mt-1 block text-sm text-slate-900">{step.stepName}</strong>
                              <span className="mt-2 block text-[11px] font-bold text-slate-500">{actorLabel(step.actorCode)}</span>
                            </li>
                          ))}
                      </ol>
                    </section>
                  ) : null}
                  {false && data?.processNavigationSummary ? (
                    <section className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                            {en ? "Navigation and implementation" : "메뉴·화면 실제 연결"}
                          </p>
                          <h3 className="mt-1 font-black text-[#052b57]">
                            {Number(data.processNavigationSummary.navigationMissingCount || 0) === 0
                              ? en ? "Every process has a safe destination" : "모든 프로세스 안전한 진입점 연결"
                              : en ? "Navigation gaps remain" : "프로세스 진입점 누락 있음"}
                          </h3>
                        </div>
                        <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-blue-800">
                          {data.processNavigationSummary.navigationBoundCount || 0}/{data.processNavigationSummary.processCount || 0}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        {[
                          [en ? "Navigation gaps" : "진입점 누락", data.processNavigationSummary.navigationMissingCount],
                          [en ? "Business screens" : "실제 업무 화면", data.processNavigationSummary.businessScreenReadyCount],
                          [en ? "Design workspaces" : "설계 작업공간", data.processNavigationSummary.designWorkspaceOnlyCount],
                          [en ? "Design gaps" : "화면 설계 누락", data.processNavigationSummary.pageDesignMissingCount],
                        ].map(([label, count]) => (
                          <div className="rounded-lg bg-white px-3 py-2 text-slate-700" key={String(label)}>
                            <span className="block font-bold">{label}</span>
                            <strong className="text-lg text-[#052b57]">{count || 0}</strong>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  <div className="hidden">
                    {[
                      [en ? "Total" : "전체", workflowTotal, "assignment"],
                      [en ? "Complete" : "완료", workflowCompleted, "task_alt"],
                      [
                        en ? "Remaining" : "남은 업무",
                        Math.max(0, workflowTotal - workflowCompleted),
                        "pending_actions",
                      ],
                      [
                        en ? "Progress" : "진행률",
                        `${workflowProgress}%`,
                        "monitoring",
                      ],
                    ].map(([label, value, icon]) => (
                      <div
                        className="rounded-xl border border-slate-200 bg-white p-3"
                        key={String(label)}
                      >
                        <span className="material-symbols-outlined text-[20px] text-[#246beb]">
                          {icon}
                        </span>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {label}
                        </p>
                        <strong className="text-lg text-[#052b57]">
                          {value}
                        </strong>
                      </div>
                    ))}
                  </div>
                  {false && data?.workCatalogAudit ? (
                    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-[#246beb]">
                            {en ? "Completeness audit" : "업무 누락 자동 점검"}
                          </p>
                          <h3 className="mt-1 font-black text-[#052b57]">
                            {Number(
                              data.workCatalogAudit.processesWithoutSteps || 0,
                            ) +
                              Number(
                                data.workCatalogAudit
                                  .processesWithoutSafetyTests || 0,
                              ) +
                              Number(
                                data.workCatalogAudit
                                  .processesWithoutDevelopmentJobs || 0,
                              ) +
                              Number(
                                data.workCatalogAudit
                                  .menusWithoutProcessBinding || 0,
                              ) ===
                            0
                              ? en
                                ? "Core design contracts are complete"
                                : "핵심 설계 계약 누락 없음"
                              : en
                                ? "Design gaps require attention"
                                : "설계 누락 확인 필요"}
                          </h3>
                        </div>
                        <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-800">
                          {data.workCatalogAudit.workTypeCount}{" "}
                          {en ? "types" : "종류"} ·{" "}
                          {data.workCatalogAudit.processCount}{" "}
                          {en ? "processes" : "프로세스"}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                        {[
                          [
                            en ? "No steps" : "단계 누락",
                            data.workCatalogAudit.processesWithoutSteps,
                          ],
                          [
                            en ? "Test gaps" : "테스트 누락",
                            data.workCatalogAudit.processesWithoutSafetyTests,
                          ],
                          [
                            en ? "No dev tasks" : "개발 Task 누락",
                            data.workCatalogAudit
                              .processesWithoutDevelopmentJobs,
                          ],
                          [
                            en ? "Menu gaps" : "메뉴 연결 누락",
                            data.workCatalogAudit.menusWithoutProcessBinding,
                          ],
                          [
                            en ? "Screens pending" : "화면 경로 대기",
                            data.workCatalogAudit.processesWithoutScreenRoute,
                          ],
                        ].map(([label, count]) => (
                          <div
                            className={`rounded-lg px-3 py-2 ${Number(count || 0) === 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
                            key={String(label)}
                          >
                            <span className="block font-bold">{label}</span>
                            <strong className="text-lg">{count || 0}</strong>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {false && selectedCatalogProcess ? (
                    <section className="mb-5 rounded-2xl border-2 border-[#246beb] bg-white p-4 sm:p-5">
                      <div>
                        <p className="text-xs font-black text-[#246beb]">
                          {en ? "Step-by-step guide" : "업무 진행 절차"}
                        </p>
                        <h3 className="mt-1 text-lg font-black text-[#052b57]">
                          {en ? "Complete the selected work in this order" : "선택한 업무를 아래 순서대로 진행합니다"}
                        </h3>
                      </div>
                      <div className="mt-4 overflow-x-auto pb-2">
                        <ol className="flex min-w-max items-stretch gap-2">
                          {selectedCatalogSteps.map((step, index) => {
                            const runtimeStep = guideRuntimeStep(step);
                            const route = guideRoute(step,runtimeStep) ||
                              (data.allVisible ? selectedCatalogProcess.targetUrl || "" : "");
                            const blockedByPredecessor = Boolean(runtimeStep?.pendingPredecessors);
                            const actorAllowed = guideActorAllowed(step,runtimeStep);
                            const canStart = Boolean(
                              route && actorAllowed && !blockedByPredecessor &&
                                (!runtimeStep || runtimeStep.actionable !== false),
                            );
                            const canReview = Boolean(
                              route && runtimeStep?.status === "DONE" &&
                                runtimeStep.actorActionable !== false,
                            );
                            const active = index === selectedCatalogStep;
                            return (
                              <li
                                className={`flex w-64 flex-col rounded-xl border-2 p-3 ${active ? "border-[#246beb] bg-blue-50" : "border-slate-200 bg-white"}`}
                                key={step.stepCode}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black shadow">
                                    {index + 1}
                                  </span>
                                  <span className="text-[11px] font-black text-slate-500">
                                    {actorLabel(step.actorCode)}
                                  </span>
                                </div>
                                <strong className="mt-3 text-sm text-[#052b57]">
                                  {step.stepName}
                                </strong>
                                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">
                                  {step.completionRule}
                                </p>
                                {runtimeStep ? (
                                  <div className="mt-2 space-y-1 text-[11px] font-bold text-slate-600">
                                    <p>{en ? "Actual task" : "실제 업무"}: {runtimeStep.name}</p>
                                    <p>{en ? "Status" : "상태"}: {runtimeStep.status}</p>
                                    {blockedByPredecessor ? (
                                      <p className="text-amber-700">
                                        {en ? "Waiting for" : "선행 업무 대기"}: {runtimeStep.pendingPredecessors}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-[11px] font-bold text-amber-700">
                                    {en ? "The actual project task has not been created." : "실제 프로젝트 업무가 아직 생성되지 않았습니다."}
                                  </p>
                                )}
                                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                                  <button
                                    className="text-xs font-black text-blue-700"
                                    onClick={() => {
                                      setSelectedCatalogStep(index);
                                      localStorage.setItem("task-quest-catalog-step",String(index));
                                    }}
                                    type="button"
                                  >
                                    {en ? "Select step" : "단계 선택"}
                                  </button>
                                  {canStart || canReview ? (
                                    <a
                                      className="rounded-lg bg-[#246beb] px-3 py-2 text-xs font-black text-white"
                                      href={guideTarget(route,step,runtimeStep)}
                                    >
                                      {canReview
                                        ? en ? "View result" : "결과 보기"
                                        : en ? "Start task" : "업무 진행"}
                                    </a>
                                  ) : route && runtimeStep ? (
                                    <span className="text-xs font-bold text-slate-500">
                                      {blockedByPredecessor
                                        ? en ? "Predecessor pending" : "선행 업무 대기"
                                        : !actorAllowed
                                          ? en ? "Assignee only" : "담당자만 진행 가능"
                                          : en ? "Not ready" : "업무 시작 대기"}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-bold text-amber-700">
                                      {en ? "Page pending" : "페이지 개발 대기"}
                                    </span>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          className="rounded-lg border border-blue-300 px-4 py-2 text-xs font-black text-blue-700 disabled:opacity-40"
                          disabled={
                            selectedCatalogStep >=
                            selectedCatalogSteps.length - 1
                          }
                          onClick={() =>
                            setSelectedCatalogStep((value) => {
                              const next=Math.min(
                                selectedCatalogSteps.length - 1,
                                value + 1,
                              );
                              localStorage.setItem("task-quest-catalog-step",String(next));
                              return next;
                            })
                          }
                          type="button"
                        >
                          {en ? "Next step" : "다음 단계"}
                        </button>
                      </div>
                    </section>
                  ) : null}
                  {false && selectedUnifiedProcess ? (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-[#246beb]">
                          {en ? "Project execution" : "실제 프로젝트 실행 업무"}
                        </p>
                        <h3 className="mt-1 text-lg font-black text-[#052b57]">
                          {selectedUnifiedProcess.processName}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!contextProjectId && overviewProjects.length ? (
                          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
                            {en ? "Project" : "실행 프로젝트"}
                            <select
                              className="max-w-56 bg-transparent font-black text-[#052b57] outline-none"
                              onChange={(event) => {
                                setSelectedOverviewProjectId(event.target.value);
                                localStorage.setItem("task-quest-overview-project", event.target.value);
                                clearWorkflowFocus();
                              }}
                              value={effectiveProjectId}
                            >
                              {overviewProjects.map((project) => (
                                <option key={project.id} value={project.id}>{project.name}</option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${selectedUnifiedProcess.runtimeState === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : selectedUnifiedProcess.runtimeState === "IN_PROGRESS" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}
                      >
                        {runtimeStateLabel(
                          String(
                            selectedUnifiedProcess.runtimeState ||
                              "TASK_NOT_CREATED",
                          ),
                          en,
                        )}
                      </span>
                      </div>
                    </div>
                  ) : null}
                  {false && processGroups.length ? (
                    <div className="space-y-5">
                      {processGroups.map(([key, items]) => {
                        const first = items[0];
                        const isFocused =
                          focusedWorkflow?.projectId === first.projectId &&
                          focusedWorkflow?.processCode === first.processCode;
                        return (
                          <article
                            className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
                            key={key}
                          >
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                              <div className="w-full text-sm font-black text-[#246beb]">
                                {first.processName ||
                                  first.processCode ||
                                  (en
                                    ? "Project workflow"
                                    : "프로젝트 업무")}{" "}
                                · {items.length}{" "}
                                {en ? "deduplicated steps" : "중복 제외 단계"}
                              </div>
                              <button
                                className={`rounded-lg border px-3 py-2 text-xs font-black ${isFocused ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-blue-300 text-blue-700"}`}
                                onClick={() => focusWorkflow(first)}
                                type="button"
                              >
                                {isFocused
                                  ? en
                                    ? "Guide selected"
                                    : "길잡이 선택됨"
                                  : en
                                    ? "Use in task guide"
                                    : "업무 길잡이로 진행"}
                              </button>
                              <div>
                                <h3 className="font-black text-[#052b57]">
                                  {first.projectName || first.projectId}
                                </h3>
                                <p className="text-xs font-semibold text-slate-500">
                                  {en
                                    ? `${items.length}-step integrated workflow`
                                    : `${items.length}단계 통합 업무`}{" "}
                                  ·{" "}
                                  {en
                                    ? `${new Set(items.map((item) => item.actorCode).filter(Boolean)).size} participating roles`
                                    : `참여 액터 ${new Set(items.map((item) => item.actorCode).filter(Boolean)).size}종`}
                                </p>
                              </div>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                {
                                  items.filter((item) => item.status === "DONE")
                                    .length
                                }
                                /{items.length} {en ? "complete" : "완료"}
                              </span>
                            </div>
                            <div className="overflow-x-auto pb-2">
                              <ol className="grid min-w-max auto-cols-[15rem] grid-flow-col items-stretch gap-3">
                                {items.map((item, index) => {
                                  const state = statusPresentation(item, en);
                                  const executionWave = Number(item.executionWave || item.stepOrder || index + 1);
                                  const parallelLane = items
                                    .slice(0, index)
                                    .filter((candidate) => Number(candidate.executionWave || candidate.stepOrder || 0) === executionWave).length + 1;
                                  return (
                                    <li
                                      className="flex items-stretch"
                                      key={item.id}
                                      style={{ gridColumnStart: executionWave, gridRowStart: parallelLane }}
                                    >
                                      <button
                                        className={`group flex min-h-[15rem] w-[15rem] flex-col rounded-xl border-2 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${state.style} ${focusedStepCode === item.processStepCode ? "ring-4 ring-[#246beb]/30 shadow-lg" : ""}`}
                                        onClick={() =>
                                          item.actionable === false
                                            ? focusWorkflow(item)
                                            : void activateTask(item)
                                        }
                                        type="button"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black shadow-sm">
                                            {executionWave}
                                          </span>
                                          <span className="flex items-center gap-1 text-xs font-black">
                                            <span className="material-symbols-outlined text-[16px]">
                                              {state.icon}
                                            </span>
                                            {state.label}
                                          </span>
                                        </div>
                                        <strong className="mt-3 line-clamp-2 text-sm leading-5">
                                          {item.name}
                                        </strong>
                                        <dl className="mt-2 space-y-1 text-[11px] leading-4 opacity-85">
                                          <div>
                                            <dt className="inline font-black">
                                              {en ? "Actor" : "액터"}:{" "}
                                            </dt>
                                            <dd className="inline">
                                              {actorLabel(item.actorCode)}
                                            </dd>
                                          </div>
                                          <div>
                                            <dt className="inline font-black">
                                              {en ? "Account" : "담당 계정"}:{" "}
                                            </dt>
                                            <dd className="inline">
                                              {item.assignee || (en ? "Not assigned" : "미배정")}
                                            </dd>
                                          </div>
                                          <div>
                                            <dt className="inline font-black">
                                              {en ? "Step code" : "단계 코드"}:{" "}
                                            </dt>
                                            <dd className="inline break-all">
                                              {item.processStepCode || "-"}
                                            </dd>
                                          </div>
                                          <div>
                                            <dt className="inline font-black">
                                              {en ? "Purpose" : "목적"}:{" "}
                                            </dt>
                                            <dd className="inline line-clamp-2">
                                              {item.workPurpose || item.name}
                                            </dd>
                                          </div>
                                          <div>
                                            <dt className="inline font-black">
                                              {en ? "Done" : "완료"}:{" "}
                                            </dt>
                                            <dd className="inline line-clamp-2">
                                              {item.completionRule || "-"}
                                            </dd>
                                          </div>
                                          <div>
                                            <dt className="inline font-black">
                                              {en ? "Input" : "입력"}:{" "}
                                            </dt>
                                            <dd className="inline line-clamp-1">
                                              {item.requiredInputs || "-"}
                                            </dd>
                                          </div>
                                          <div>
                                            <dt className="inline font-black">
                                              {en ? "Output" : "산출물"}:{" "}
                                            </dt>
                                            <dd className="inline line-clamp-1">
                                              {item.expectedOutput || "-"}
                                            </dd>
                                          </div>
                                        </dl>
                                        <span className="mt-auto pt-2 text-xs font-bold opacity-75">
                                          {dueLabel(item.dueDate, en)}
                                        </span>
                                        <span className="mt-1 flex items-center gap-1 text-xs font-black text-[#246beb] opacity-0 transition group-hover:opacity-100">
                                          {en ? "Open screen" : "화면 바로가기"}
                                          <span className="material-symbols-outlined text-[15px]">
                                            open_in_new
                                          </span>
                                        </span>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ol>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
                  <p className="hidden text-sm text-slate-500 sm:block">
                    {en
                      ? "Blocked tasks can be opened for guidance, but require preceding tasks to be completed."
                      : "선행 대기 업무도 안내 확인을 위해 열 수 있으며, 실제 완료에는 선행 업무 처리가 필요합니다."}
                  </p>
                  <div className="ml-auto flex gap-2">
                    <a
                      className="rounded-lg border border-[#246beb] px-4 py-2.5 text-sm font-bold text-[#246beb]"
                      href={buildLocalizedPath(
                        "/support/inquiry",
                        "/en/support/inquiry",
                      )}
                    >
                      {en ? "Ask a question" : "업무 질문"}
                    </a>
                    <button
                      className="rounded-lg bg-[#052b57] px-4 py-2.5 text-sm font-bold text-white"
                      onClick={() => setFlowOpen(false)}
                      type="button"
                    >
                      {en ? "Close" : "닫기"}
                    </button>
                  </div>
                </footer>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
