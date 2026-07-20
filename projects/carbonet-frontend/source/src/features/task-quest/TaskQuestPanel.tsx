import { useEffect, useMemo, useState } from "react";
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
  summary?: { total?: number; completed?: number; overdue?: number };
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
  const [selectedWorkType, setSelectedWorkType] = useState(
    () => localStorage.getItem("task-quest-work-type") || "ALL",
  );
  const [selectedCatalogProcessCode, setSelectedCatalogProcessCode] = useState(
    () => localStorage.getItem("task-quest-catalog-process") || "",
  );
  const [selectedCatalogStep, setSelectedCatalogStep] = useState(0);
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
    if (contextProjectId || selectedOverviewProjectId || !overviewProjects.length)
      return;
    const pendingProject = rawWorkflowItems.find(
      (item) => item.status !== "DONE",
    )?.projectId;
    const next = pendingProject || overviewProjects[0].id;
    setSelectedOverviewProjectId(next);
    localStorage.setItem("task-quest-overview-project", next);
  }, [contextProjectId, overviewProjects, rawWorkflowItems, selectedOverviewProjectId]);

  const task = useMemo(() => {
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
    return [
      ...(focused.length ? focused : contextual.length ? contextual : pending),
    ].sort((a, b) => {
      const aw = taskWeight(a),
        bw = taskWeight(b);
      return aw[0] - bw[0] || aw[1] - bw[1];
    })[0];
  }, [data, effectiveProjectId, focusedWorkflow]);

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
  const selectedWorkTypeQuality = useMemo(
    () =>
      selectedWorkType === "ALL"
        ? {
            verifiedCount: Number(
              data?.designAssuranceSummary?.verifiedCount || 0,
            ),
            blockedCount: Number(
              data?.designAssuranceSummary?.blockedCount || 0,
            ),
            pendingCount: Number(
              data?.designAssuranceSummary?.pendingCount || 0,
            ),
            accuracy: Number(
              data?.designAssuranceSummary?.averageAccuracyScore || 0,
            ),
          }
        : availableWorkTypes.find((item) => item.code === selectedWorkType) || {
            verifiedCount: 0,
            blockedCount: 0,
            pendingCount: 0,
            accuracy: 0,
          },
    [availableWorkTypes, data?.designAssuranceSummary, selectedWorkType],
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
      ) ||
      (data?.processCatalog || []).find(
        (item) => item.processCode === selectedCatalogProcessCode,
      ),
    [
      data?.processCatalog,
      selectedDefinedProcesses,
      selectedCatalogProcessCode,
    ],
  );
  const selectedProcessWaves = useMemo(() => {
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
      }));
  }, [selectedDefinedProcesses]);
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

  useEffect(() => {
    if (
      selectedCatalogProcessCode &&
      !(data?.processCatalog || []).some(
        (item) => item.processCode === selectedCatalogProcessCode,
      )
    ) {
      setSelectedCatalogProcessCode("");
      localStorage.removeItem("task-quest-catalog-process");
    }
  }, [data?.processCatalog, selectedCatalogProcessCode]);

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

  function selectCatalogProcess(code: string) {
    setSelectedCatalogProcessCode(code);
    setSelectedCatalogStep(0);
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
                        {en ? "Actor" : "담당 액터"}
                      </dt>
                      <dd className="font-semibold text-slate-800">
                        {task.actorCode || "-"}
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
                  onClick={() => setFlowOpen(true)}
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
              <section className="relative flex max-h-[88vh] w-full max-w-[78rem] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
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
                  <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <span className="text-xs font-bold text-emerald-700">
                        {en ? "Verified design" : "검증 완료 설계"}
                      </span>
                      <strong className="mt-1 block text-xl text-emerald-900">
                        {selectedWorkTypeQuality.verifiedCount}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <span className="text-xs font-bold text-red-700">
                        {en ? "Design blocked" : "설계 보완 필요"}
                      </span>
                      <strong className="mt-1 block text-xl text-red-900">
                        {selectedWorkTypeQuality.blockedCount}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <span className="text-xs font-bold text-amber-700">
                        {en ? "Implementation pending" : "구현 검증 대기"}
                      </span>
                      <strong className="mt-1 block text-xl text-amber-900">
                        {selectedWorkTypeQuality.pendingCount}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <span className="text-xs font-bold text-blue-700">
                        {en ? "Design accuracy" : "설계 정확도"}
                      </span>
                      <strong className="mt-1 block text-xl text-blue-900">
                        {selectedWorkTypeQuality.accuracy}%
                      </strong>
                    </div>
                  </section>
                  {data?.workCatalogAudit ? (
                    <div
                      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${Number(data.workCatalogAudit.processesWithoutSequence || 0) === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}
                    >
                      <div>
                        <strong className="block text-sm">
                          {en
                            ? "Business sequence audit"
                            : "업무 순서 등록 점검"}
                        </strong>
                        <span className="text-xs">
                          {en
                            ? "Every process must have an executable order."
                            : "모든 프로세스가 실행 순서 원장에 등록되어야 합니다."}
                        </span>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-sm font-black">
                        {data.workCatalogAudit.processesWithoutSequence || 0}{" "}
                        {en ? "missing" : "개 누락"}
                      </span>
                    </div>
                  ) : null}
                  <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-[#246beb]">
                          {en
                            ? "Step 1 · Select work type"
                            : "1단계 · 업무 종류 선택"}
                        </p>
                        <h3 className="mt-1 text-lg font-black text-[#052b57]">
                          {en
                            ? "Available work types"
                            : "현재 선택 가능한 업무 종류"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {en
                            ? "Counts show registered processes, not project task steps."
                            : "괄호 안 개수는 프로젝트 단계가 아닌 등록된 업무 프로세스 수입니다."}
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
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                      <button
                        className={`shrink-0 rounded-xl border px-4 py-3 text-left ${selectedWorkType === "ALL" ? "border-[#246beb] bg-blue-50 text-blue-900" : "border-slate-200 text-slate-700"}`}
                        onClick={() => selectWorkType("ALL")}
                        type="button"
                      >
                        <strong className="block text-sm">
                          {en ? "All work" : "전체 업무"}
                        </strong>
                        <span className="text-xs">
                          {definedProcessTotal}{" "}
                          {en ? "registered processes" : "등록 프로세스"} ·{" "}
                          {workflowItems.length}{" "}
                          {en ? "active steps" : "진행 단계"}
                        </span>
                      </button>
                      {availableWorkTypes.map((item) => (
                        <button
                          className={`shrink-0 rounded-xl border px-4 py-3 text-left ${selectedWorkType === item.code ? "border-[#246beb] bg-blue-50 text-blue-900" : "border-slate-200 text-slate-700"}`}
                          key={item.code}
                          onClick={() => selectWorkType(item.code)}
                          title={item.description}
                          type="button"
                        >
                          <strong className="block text-sm">
                            {item.label}
                          </strong>
                          <span className="text-xs">
                            {item.definedCount}{" "}
                            {en ? "registered processes" : "등록 프로세스"} ·{" "}
                            {item.count} {en ? "active steps" : "진행 단계"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                  {selectedDefinedProcesses.length ? (
                    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-[#246beb]">
                            {en ? "Execution order" : "업무 실행 순서"}
                          </p>
                          <h3 className="mt-1 text-lg font-black text-[#052b57]">
                            {en
                              ? "Select one process and proceed step by step"
                              : "프로세스를 선택해 하나씩 구현·검증"}
                          </h3>
                        </div>
                        <span className="text-xs font-bold text-slate-500">
                          {selectedDefinedProcesses.length}{" "}
                          {en ? "processes" : "개 프로세스"}
                        </span>
                      </div>
                      <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${String(selectedUnifiedProcess?.runtimeState)==="DESIGN_BLOCKED"?"border-red-200 bg-red-50 text-red-800":"border-blue-200 bg-blue-50 text-blue-900"}`}><div className="flex flex-wrap items-center justify-between gap-2"><strong>{runtimeStateLabel(String(selectedUnifiedProcess?.runtimeState||"PROJECT_NOT_SELECTED"),en)}</strong><span className="text-xs font-black">{en?"Design accuracy":"설계 정확도"} {Number(selectedUnifiedProcess?.designAccuracyScore||0)}%</span></div>{selectedUnifiedProcess?.stateReason?<p className="mt-1 text-xs leading-5">{selectedUnifiedProcess.stateReason}</p>:null}</div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          [en ? "Page designs" : "화면 설계", selectedUnifiedProcess?.pageDesignCount || 0],
                          [en ? "Field contracts" : "컬럼 계약", selectedUnifiedProcess?.fieldCount || 0],
                          [en ? "DB resolved" : "DB 연결", selectedUnifiedProcess?.dbResolvedFieldCount || 0],
                          [en ? "Data handoffs" : "데이터 인계", selectedUnifiedProcess?.handoffCount || 0],
                        ].map(([label, metric]) => <div className="rounded-lg bg-slate-50 px-3 py-2" key={String(label)}><span className="block text-[11px] font-bold text-slate-500">{label}</span><strong className="text-base text-[#052b57]">{metric}</strong></div>)}
                      </div>
                      <div className="mt-4 overflow-x-auto pb-2">
                        <ol className="flex min-w-max items-center gap-0">
                          {selectedProcessWaves.map((wave, waveIndex) => (
                            <li className="flex items-center" key={`wave-${wave.wave}`}>
                              <section className="w-64 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <strong className="text-xs text-[#052b57]">{en ? `Wave ${wave.wave}` : `${wave.wave}차 실행`}</strong>
                                  <span className={`rounded-full px-2 py-1 text-[11px] font-black ${wave.processes.length > 1 ? "bg-violet-100 text-violet-800" : "bg-slate-200 text-slate-700"}`}>
                                    {wave.processes.length > 1 ? (en ? `${wave.processes.length} parallel lanes` : `${wave.processes.length}개 병렬 레인`) : (en ? "Sequential" : "순차")}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                {wave.processes.map((process) => (
                              <button
                                className={`flex min-h-32 w-full flex-col rounded-xl border-2 p-3 text-left ${selectedCatalogProcessCode === process.processCode ? "border-[#246beb] bg-blue-50" : "border-slate-200 bg-white"}`}
                                key={`sequence-${process.processCode}`}
                                onClick={() =>
                                  selectCatalogProcess(process.processCode)
                                }
                                type="button"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-black text-[#246beb]">
                                    {process.laneCode || "PRIMARY"} · {process.executionMode || "SEQUENTIAL"}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">
                                    {process.workflowPhase}
                                  </span>
                                </div>
                                <strong className="mt-3 text-sm text-[#052b57]">
                                  {process.processName}
                                </strong>
                                <div className="mt-auto pt-3">
                                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className="h-full rounded-full bg-[#246beb]"
                                      style={{
                                        width: `${Math.max(0, Math.min(100, Number(process.completionScore || 0)))}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="mt-1 block text-[11px] font-bold text-slate-500">
                                    {process.completedTasks || 0}/
                                    {process.requiredTasks || 0} Task ·{" "}
                                    {Number(process.completionScore || 0)}%
                                  </span>
                                </div>
                              </button>
                                ))}
                                </div>
                                <p className="mt-2 text-[11px] font-bold text-slate-500">
                                  {wave.wave === 1 ? (en ? "Entry wave" : "시작 파동") : `${wave.processes[0]?.joinStrategy || "ALL"} ${en ? "join" : "합류"}`}
                                </p>
                              </section>
                              {waveIndex < selectedProcessWaves.length - 1 ? (
                                <span
                                  aria-hidden="true"
                                  className="material-symbols-outlined mx-2 text-2xl text-slate-300"
                                >
                                  arrow_forward
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </section>
                  ) : null}
                  {data?.processNavigationSummary ? (
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
                  <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                  {data?.workCatalogAudit ? (
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
                  <div className="mb-3">
                    <p className="text-xs font-black uppercase tracking-wide text-[#246beb]">
                      {en
                        ? "Step 2 · Select a process"
                        : "2단계 · 업무 프로세스 선택"}
                    </p>
                    <h3 className="mt-1 text-lg font-black text-[#052b57]">
                      {selectedWorkType === "ALL"
                        ? en
                          ? "All available processes"
                          : "전체 업무 프로세스"
                        : availableWorkTypes.find(
                            (item) => item.code === selectedWorkType,
                          )?.label || workTypeLabel(selectedWorkType, en)}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {selectedDefinedProcesses.length}{" "}
                      {en ? "processes are registered" : "개 프로세스 등록"} ·{" "}
                      {processGroups.length}{" "}
                      {en
                        ? "active project workflows"
                        : "개 프로젝트에서 진행 중"}
                    </p>
                  </div>
                  {selectedDefinedProcesses.length ? (
                    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {selectedDefinedProcesses.map((process) => {
                        const active = workflowItems.find(
                          (item) => item.processCode === process.processCode,
                        );
                        const state = String(process.runtimeState || "TASK_NOT_CREATED");
                        const blocked = state === "DESIGN_BLOCKED";
                        const ready = state === "READY" || state === "COMPLETED";
                        const selected =
                          selectedCatalogProcessCode === process.processCode;
                        return (
                          <article
                            className={`flex min-h-44 flex-col rounded-2xl border bg-white p-4 ${selected ? "border-[#246beb] ring-2 ring-blue-100" : "border-slate-200"}`}
                            key={process.processCode}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-black text-[#246beb]">
                                  {process.processCode}
                                </p>
                                <h4 className="mt-1 font-black text-[#052b57]">
                                  {process.processName}
                                </h4>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${active && !blocked ? "bg-emerald-100 text-emerald-800" : blocked ? "bg-red-100 text-red-800" : state === "IMPLEMENTATION_PENDING" || state === "CONDITIONAL" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}
                              >
                                {active && !blocked
                                  ? en
                                    ? "Active"
                                    : "진행 중"
                                  : ready
                                    ? en
                                      ? "Ready"
                                      : "구현 완료"
                                    : runtimeStateLabel(state, en)}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">
                              {process.goal}
                            </p>
                            <p className={`mt-2 line-clamp-2 text-xs font-bold ${blocked ? "text-red-700" : "text-slate-500"}`}>
                              {en ? "Design accuracy" : "설계 정확도"} {Number(process.designAccuracyScore || 0)}%
                              {process.stateReason ? ` · ${process.stateReason}` : ""}
                            </p>
                            <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
                              <span className="text-xs font-bold text-slate-500">
                                {process.stepCount || 0} {en ? "steps" : "단계"}{" "}
                                · {process.ownerActorCode || "-"}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-black text-blue-700"
                                  onClick={() =>
                                    selectCatalogProcess(process.processCode)
                                  }
                                  type="button"
                                >
                                  {selected
                                    ? en
                                      ? "Guide selected"
                                      : "길잡이 선택됨"
                                    : en
                                      ? "View process"
                                      : "프로세스 보기"}
                                </button>
                                {active ? (
                                  <button
                                    className="rounded-lg bg-[#052b57] px-3 py-2 text-xs font-black text-white"
                                    onClick={() => focusWorkflow(active)}
                                    type="button"
                                  >
                                    {en ? "Active work" : "진행 업무"}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : null}
                  {selectedCatalogProcess ? (
                    <section className="mb-5 rounded-2xl border-2 border-[#246beb] bg-white p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black text-[#246beb]">
                            {en
                              ? "Selected process guide"
                              : "선택한 프로세스 업무 길잡이"}
                          </p>
                          <h3 className="mt-1 text-lg font-black text-[#052b57]">
                            {selectedCatalogProcess.processName}
                          </h3>
                          <p className="mt-1 max-w-3xl text-sm text-slate-600">
                            {selectedCatalogProcess.goal}
                          </p>
                        </div>
                        {data.allVisible ? (
                          <a
                            className="rounded-lg bg-[#052b57] px-4 py-2.5 text-xs font-black text-white"
                            href={buildLocalizedPath(
                              `/admin/system/actor-process?process=${encodeURIComponent(selectedCatalogProcess.processCode)}`,
                              `/en/admin/system/actor-process?process=${encodeURIComponent(selectedCatalogProcess.processCode)}`,
                            )}
                          >
                            {en ? "Open development board" : "개발 현황 열기"}
                          </a>
                        ) : null}
                      </div>
                      <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${String(selectedUnifiedProcess?.runtimeState)==="DESIGN_BLOCKED"?"border-red-200 bg-red-50 text-red-800":"border-blue-200 bg-blue-50 text-blue-900"}`}><div className="flex flex-wrap items-center justify-between gap-2"><strong>{runtimeStateLabel(String(selectedUnifiedProcess?.runtimeState||"PROJECT_NOT_SELECTED"),en)}</strong><span className="text-xs font-black">{en?"Design accuracy":"설계 정확도"} {Number(selectedUnifiedProcess?.designAccuracyScore||0)}%</span></div>{selectedUnifiedProcess?.stateReason?<p className="mt-1 text-xs leading-5">{selectedUnifiedProcess.stateReason}</p>:null}</div>
                      <div className="mt-4 overflow-x-auto pb-2">
                        <ol className="flex min-w-max items-stretch gap-2">
                          {selectedCatalogSteps.map((step, index) => {
                            const route = selectedCatalogProcess.businessScreenImplemented
                              ? step.userPath || (data.allVisible ? step.adminPath : "")
                              : data.allVisible
                                ? selectedCatalogProcess.targetUrl || ""
                                : "";
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
                                    {step.actorCode}
                                  </span>
                                </div>
                                <strong className="mt-3 text-sm text-[#052b57]">
                                  {step.stepName}
                                </strong>
                                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">
                                  {step.completionRule}
                                </p>
                                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                                  <button
                                    className="text-xs font-black text-blue-700"
                                    onClick={() =>
                                      setSelectedCatalogStep(index)
                                    }
                                    type="button"
                                  >
                                    {en ? "Select step" : "단계 선택"}
                                  </button>
                                  {route ? (
                                    <a
                                      className="rounded-lg bg-[#246beb] px-3 py-2 text-xs font-black text-white"
                                      href={en ? `/en${route}` : route}
                                    >
                                      {en ? "Open" : "화면 이동"}
                                    </a>
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
                            setSelectedCatalogStep((value) =>
                              Math.min(
                                selectedCatalogSteps.length - 1,
                                value + 1,
                              ),
                            )
                          }
                          type="button"
                        >
                          {en ? "Next step" : "다음 단계"}
                        </button>
                      </div>
                    </section>
                  ) : null}
                  {selectedUnifiedProcess ? (
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
                  {processGroups.length ? (
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
                                        className={`group flex min-h-[15rem] w-[15rem] flex-col rounded-xl border-2 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${state.style}`}
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
                                              {item.actorCode || "-"}
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
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center font-bold text-slate-500">
                      {en
                        ? "No assigned workflow was found."
                        : "현재 계정에 배정된 업무 프로세스가 없습니다."}
                    </div>
                  )}
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
