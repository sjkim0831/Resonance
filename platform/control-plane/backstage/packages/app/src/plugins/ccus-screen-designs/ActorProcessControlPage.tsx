import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import LaunchIcon from '@material-ui/icons/Launch';
import SaveIcon from '@material-ui/icons/Save';
import PublishIcon from '@material-ui/icons/Publish';
import {
  ACTOR_PROCESS_TAB_COUNT,
  ACTOR_PROCESS_FULL_UI_COUNT,
  ACTOR_PROCESS_PARTIAL_UI_COUNT,
  ACTOR_PROCESS_SOURCE_TAB_COUNT,
  ACTOR_PROCESS_DATASET_BY_TAB,
  ACTOR_PROCESS_WORKSPACES,
  ActorProcessTab,
  ActorProcessWorkspaceId,
  buildCustomerJourneySimulation,
  buildProcessGraph,
  REQUIRED_SIMULATION_TYPES,
  resolveProcessBranches,
} from './actorProcessWorkspaces';
import { RESONANCE_PROJECT_REGISTRY } from './generatedProjectRegistry';

type ProjectOption = (typeof RESONANCE_PROJECT_REGISTRY)[number] & {
  status?: string;
  tasks?: ProjectTask[];
};
type ProjectTask = {
  taskId: string;
  taskType: string;
  status: string;
  errorMessage?: string;
};
type DesignRelease = {
  designVersion: number;
  status: string;
  contractSha256: string;
};
type OperationsSummary = {
  inventory?: {
    projectCount?: number;
    taskCount?: number;
    controlAssetCount?: number;
    designAssetCount?: number;
  };
  taskStatuses?: Record<string, number>;
};
type RuntimeRow = Record<string, unknown>;
type RuntimeDashboard = Record<string, unknown>;
type CommandField = {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  type?: 'text' | 'number' | 'textarea';
};
type TabCommand = {
  command: string;
  label: string;
  description: string;
  fields: CommandField[];
};
type DesignDocument = {
  documentType: string;
  title: string;
  content: string;
  status: string;
  revision: number;
  updatedBy?: string;
  updatedAt?: string;
};

const TAB_COMMANDS: Record<string, TabCommand> = {
  actors: {
    command: 'actor.save',
    label: '액터 등록·수정',
    description:
      '역할, 책임, 목적과 보유 역량을 동일한 액터 코드로 등록하거나 갱신합니다.',
    fields: [
      { name: 'actorCode', label: '액터 코드', required: true },
      { name: 'actorName', label: '액터명', required: true },
      { name: 'actorNameEn', label: '영문명' },
      { name: 'actorType', label: '액터 유형', defaultValue: 'BUSINESS' },
      { name: 'purpose', label: '업무 목적', required: true, type: 'textarea' },
      { name: 'capabilityCodes', label: '역량 코드' },
    ],
  },
  processes: {
    command: 'process.save',
    label: '프로세스 등록·수정',
    description:
      '업무 종류와 시작·완료 조건을 포함한 실행 가능한 프로세스를 저장합니다.',
    fields: [
      { name: 'processCode', label: '프로세스 코드', required: true },
      { name: 'processName', label: '프로세스명', required: true },
      { name: 'domainCode', label: '업무 종류 코드', required: true },
      { name: 'version', label: '버전', defaultValue: '1.0.0' },
      { name: 'goal', label: '목표', required: true, type: 'textarea' },
      { name: 'startCondition', label: '시작 조건', required: true },
      { name: 'completionCondition', label: '완료 조건', required: true },
    ],
  },
  steps: {
    command: 'step.save',
    label: '단계 등록·수정',
    description:
      '액터, 명령, 상태 전이, 완료 조건을 연결하고 개발 작업을 자동 생성합니다.',
    fields: [
      { name: 'processCode', label: '프로세스 코드', required: true },
      { name: 'stepOrder', label: '단계 순서', required: true, type: 'number' },
      { name: 'stepCode', label: '단계 코드', required: true },
      { name: 'stepName', label: '단계명', required: true },
      { name: 'actorCode', label: '담당 액터', required: true },
      { name: 'fromState', label: '시작 상태', required: true },
      { name: 'commandCode', label: '실행 명령', required: true },
      { name: 'toState', label: '완료 상태', required: true },
      {
        name: 'completionRule',
        label: '완료 조건',
        required: true,
        type: 'textarea',
      },
    ],
  },
  'screen-flow': {
    command: 'screen.bind-archetype',
    label: '화면·프로세스 연결',
    description:
      '등록된 화면 경로를 프로세스 원형, 단계, 액터와 연결하고 주 화면·하위 절차·예외·공통 화면 역할을 지정합니다.',
    fields: [
      { name: 'routePath', label: '화면 경로', required: true },
      { name: 'archetypeCode', label: '프로세스 원형 코드', required: true },
      { name: 'bindingRole', label: '연결 역할', defaultValue: 'PRIMARY' },
      { name: 'processCode', label: '프로세스 코드', required: true },
      { name: 'stepCode', label: '단계 코드', required: true },
      { name: 'actorCode', label: '담당 액터', required: true },
      { name: 'entryCondition', label: '진입 조건', type: 'textarea' },
      {
        name: 'completionCondition',
        label: '완료 조건',
        type: 'textarea',
      },
      { name: 'bindingOptions', label: '연결 옵션 JSON', defaultValue: '{}' },
      {
        name: 'sortOrder',
        label: '표시 순서',
        defaultValue: '1',
        type: 'number',
      },
    ],
  },
  'data-contracts': {
    command: 'screen.contract.save',
    label: '화면·API·DB 계약 저장',
    description:
      '선택 화면의 업무 목적, 진입·종료 조건, 필드, 명령, 상태, API, DB, 증적과 품질 검증 계약을 한 트랜잭션으로 저장합니다.',
    fields: [
      {
        name: 'contractId',
        label: '화면 계약 ID',
        required: true,
        type: 'number',
      },
      {
        name: 'businessPurpose',
        label: '업무 목적',
        required: true,
        type: 'textarea',
      },
      {
        name: 'entryCondition',
        label: '진입 조건',
        required: true,
        type: 'textarea',
      },
      {
        name: 'exitCondition',
        label: '종료 조건',
        required: true,
        type: 'textarea',
      },
      {
        name: 'kpiContract',
        label: 'KPI 계약 JSON',
        defaultValue: '[]',
        type: 'textarea',
      },
      {
        name: 'sectionContract',
        label: '섹션 계약 JSON',
        defaultValue: '[]',
        type: 'textarea',
      },
      {
        name: 'fieldContract',
        label: '필드 계약 JSON',
        defaultValue: '[]',
        type: 'textarea',
      },
      {
        name: 'commandContract',
        label: '명령 계약 JSON',
        defaultValue: '[]',
        type: 'textarea',
      },
      {
        name: 'stateContract',
        label: '상태 계약 JSON',
        defaultValue: '[]',
        type: 'textarea',
      },
      {
        name: 'apiContract',
        label: 'API 계약 JSON',
        defaultValue: '[]',
        type: 'textarea',
      },
      {
        name: 'dataContract',
        label: 'DB·데이터 계약 JSON',
        defaultValue: '[]',
        type: 'textarea',
      },
      {
        name: 'evidenceContract',
        label: '증적 계약 JSON',
        defaultValue: '[]',
        type: 'textarea',
      },
      {
        name: 'responsiveContract',
        label: '반응형 계약',
        defaultValue: '360px, 768px, 1280px 검증',
      },
      {
        name: 'accessibilityContract',
        label: '접근성 계약',
        defaultValue: 'KRDS 및 WCAG 2.1 AA',
      },
      {
        name: 'securityContract',
        label: '보안 계약',
        defaultValue: '테넌트·프로젝트·액터 권한 서버 검증',
      },
      { name: 'apiVerified', label: 'API 검증', defaultValue: 'false' },
      { name: 'databaseVerified', label: 'DB 검증', defaultValue: 'false' },
      { name: 'authorityVerified', label: '권한 검증', defaultValue: 'false' },
      {
        name: 'responsiveVerified',
        label: '반응형 검증',
        defaultValue: 'false',
      },
      {
        name: 'accessibilityVerified',
        label: '접근성 검증',
        defaultValue: 'false',
      },
      {
        name: 'exceptionStatesVerified',
        label: '예외 상태 검증',
        defaultValue: 'false',
      },
      { name: 'auditEvidenceRef', label: '감사 증적 경로' },
      {
        name: 'contractStatus',
        label: '계약 상태',
        defaultValue: 'REVIEW_REQUIRED',
      },
    ],
  },
  assignments: {
    command: 'assignment.save',
    label: '계정·액터 배정',
    description: '계정에 프로젝트별 액터와 데이터 접근 범위를 배정합니다.',
    fields: [
      { name: 'accountId', label: '계정 ID', required: true },
      { name: 'tenantId', label: '테넌트 ID', defaultValue: 'DEFAULT' },
      { name: 'projectId', label: '프로젝트 ID', defaultValue: '*' },
      { name: 'actorCode', label: '액터 코드', required: true },
      { name: 'dataScope', label: '데이터 범위', defaultValue: '*' },
      { name: 'validUntil', label: '유효 종료일' },
    ],
  },
  'test-scenarios': {
    command: 'case.save',
    label: '테스트 시나리오 등록',
    description: '정상·권한·격리·예외·복구 기대값을 프로세스에 연결합니다.',
    fields: [
      { name: 'caseCode', label: '시나리오 코드', required: true },
      { name: 'processCode', label: '프로세스 코드', required: true },
      { name: 'caseName', label: '시나리오명', required: true },
      { name: 'caseType', label: '유형', defaultValue: 'HAPPY_PATH' },
      {
        name: 'preconditions',
        label: '사전 조건',
        required: true,
        type: 'textarea',
      },
      {
        name: 'stepsJson',
        label: '단계 JSON',
        defaultValue: '[]',
        type: 'textarea',
      },
      {
        name: 'assertionsJson',
        label: '기대값 JSON',
        defaultValue: '[]',
        type: 'textarea',
      },
    ],
  },
  'design-release': {
    command: 'design.validate',
    label: '프로세스 설계 검증',
    description:
      '액터·상태·데이터·라우트·테스트 계약의 누락과 충돌을 검증합니다.',
    fields: [{ name: 'processCode', label: '프로세스 코드', required: true }],
  },
  'development-plan': {
    command: 'development.plan',
    label: '개발 계획 생성',
    description:
      '선택 단계에 필요한 설계·DB·API·화면·테스트 작업을 자동 생성합니다.',
    fields: [
      { name: 'processCode', label: '프로세스 코드', required: true },
      { name: 'stepCode', label: '단계 코드', required: true },
    ],
  },
  frontend: {
    command: 'development.preflight',
    label: '화면 개발 사전검사',
    description:
      '설계 메모, 공통 디자인, 액터 계약과 안전 테스트 준비 상태를 검사합니다.',
    fields: [
      { name: 'processCode', label: '프로세스 코드', required: true },
      { name: 'stepCode', label: '단계 코드', required: true },
    ],
  },
  backend: {
    command: 'backend.verify',
    label: '백엔드 계약 검증',
    description:
      '프로세스별 API·DB·권한·롤백 계약을 검증하고 증적을 기록합니다.',
    fields: [{ name: 'sourceCommit', label: '소스 커밋' }],
  },
  execution: {
    command: 'execution.start',
    label: '프로세스 실행 시작',
    description:
      '프로젝트와 액터 범위를 지정하여 실제 업무 실행 인스턴스를 시작합니다.',
    fields: [
      { name: 'processCode', label: '프로세스 코드', required: true },
      { name: 'projectId', label: '프로젝트 ID', required: true },
      { name: 'actorCode', label: '시작 액터', required: true },
    ],
  },
};

const columnLabels: Record<string, string> = {
  actorCode: '액터 코드',
  actorName: '액터명',
  actorType: '유형',
  processCode: '프로세스 코드',
  processName: '프로세스명',
  stepCode: '단계 코드',
  stepName: '단계명',
  routePath: '화면 경로',
  status: '상태',
  executionStatus: '실행 상태',
  taskStatus: '작업 상태',
  jobStatus: '작업 상태',
  readinessStatus: '준비 상태',
  validationStatus: '검증 상태',
  resultStatus: '결과',
  createdAt: '등록 시각',
  updatedAt: '수정 시각',
};

const displayValue = (value: unknown) => {
  if (value == null || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

function WorkOperationsMap({
  dashboard,
  projectId,
  mode = 'dashboard',
  onSelect,
  onOpenTab,
  executeRuntimeCommand,
  executeDevelopmentPipeline,
  retryDevelopmentJob,
  requestDevelopmentRollback,
  approveDevelopmentRollback,
  loadDesignDocuments,
  saveDesignDocument,
}: {
  dashboard: RuntimeDashboard;
  projectId: string;
  mode?: 'dashboard' | 'execution';
  onSelect: (row: RuntimeRow) => void;
  onOpenTab: (tabId: string) => void;
  executeRuntimeCommand: (
    command: 'execution.validate' | 'execution.advance',
    executionId: string,
  ) => Promise<Record<string, unknown>>;
  executeDevelopmentPipeline: (
    processCode: string,
    stepCode: string,
  ) => Promise<Record<string, unknown>>;
  retryDevelopmentJob: (jobId: string) => Promise<Record<string, unknown>>;
  requestDevelopmentRollback: (
    jobId: string,
    reason: string,
  ) => Promise<Record<string, unknown>>;
  approveDevelopmentRollback: (
    rollbackRequestId: string,
  ) => Promise<Record<string, unknown>>;
  loadDesignDocuments: (
    processCode: string,
    stepCode: string,
    routePath: string,
  ) => Promise<DesignDocument[]>;
  saveDesignDocument: (
    document: DesignDocument & {
      processCode: string;
      stepCode: string;
      routePath: string;
    },
  ) => Promise<void>;
}) {
  const [detailTab, setDetailTab] = useState<
    'design' | 'data' | 'screen' | 'test' | 'task'
  >('design');
  const [selectedStepCode, setSelectedStepCode] = useState('');
  const [selectedProcessCode, setSelectedProcessCode] = useState('');
  const [selectedActorCode, setSelectedActorCode] = useState('');
  const [selectedWorkType, setSelectedWorkType] = useState('');
  const [runtimeProjectId, setRuntimeProjectId] = useState('');
  const [runtimeCommandPending, setRuntimeCommandPending] = useState(false);
  const [runtimeCommandResult, setRuntimeCommandResult] = useState('');
  const [developmentPipelinePending, setDevelopmentPipelinePending] =
    useState(false);
  const [developmentPipelineResult, setDevelopmentPipelineResult] =
    useState('');
  const [selectedScenarioType, setSelectedScenarioType] =
    useState<(typeof REQUIRED_SIMULATION_TYPES)[number]>('HAPPY_PATH');
  const [designWorkbenchOpen, setDesignWorkbenchOpen] = useState(false);
  const processes = (dashboard.processes ?? []) as RuntimeRow[];
  const workTypes = (dashboard.workTypes ?? []) as RuntimeRow[];
  const steps = (dashboard.steps ?? []) as RuntimeRow[];
  const actors = (dashboard.actors ?? []) as RuntimeRow[];
  const executions = (dashboard.processExecutions ?? []) as RuntimeRow[];
  const emissionProjectTasks = (dashboard.emissionProjectTasks ??
    []) as RuntimeRow[];
  const runnableExecutions = useMemo(
    () => executions.filter(row => row.domainOrphaned !== true),
    [executions],
  );
  const runtimeProjects = useMemo(
    () => [
      ...new Set(
        runnableExecutions
          .map(row => String(row.projectId ?? ''))
          .filter(Boolean),
      ),
    ],
    [runnableExecutions],
  );
  useEffect(() => {
    if (
      runtimeProjects.length > 0 &&
      !runtimeProjects.includes(runtimeProjectId)
    ) {
      const running = runnableExecutions.find(
        row => String(row.executionStatus) === 'RUNNING',
      );
      setRuntimeProjectId(String(running?.projectId ?? runtimeProjects[0]));
    }
  }, [runnableExecutions, runtimeProjectId, runtimeProjects]);
  const scopedExecutions = runtimeProjectId
    ? runnableExecutions.filter(
        row => String(row.projectId) === runtimeProjectId,
      )
    : runnableExecutions;
  const executionProcess =
    processes.find(row =>
      scopedExecutions.some(
        execution => execution.processCode === row.processCode,
      ),
    ) ?? processes[0];
  const filteredProcesses = selectedWorkType
    ? processes.filter(
        row =>
          String(row.domainCode ?? row.workTypeCode ?? '') === selectedWorkType,
      )
    : processes;
  const selectedProcess =
    filteredProcesses.find(
      row => String(row.processCode) === selectedProcessCode,
    ) ??
    filteredProcesses.find(
      row => String(row.processCode) === String(executionProcess?.processCode),
    ) ??
    filteredProcesses[0] ??
    executionProcess;
  const processCode = String(selectedProcess?.processCode ?? '');
  useEffect(() => {
    if (
      filteredProcesses.length > 0 &&
      !filteredProcesses.some(
        row => String(row.processCode) === selectedProcessCode,
      )
    ) {
      setSelectedProcessCode(
        String(
          filteredProcesses.find(
            row =>
              String(row.processCode) === String(executionProcess?.processCode),
          )?.processCode ?? filteredProcesses[0].processCode,
        ),
      );
    }
  }, [executionProcess?.processCode, filteredProcesses, selectedProcessCode]);
  const processSteps = steps
    .filter(row => !processCode || String(row.processCode) === processCode)
    .sort(
      (a, b) =>
        Number(a.stepOrder ?? a.sortOrder ?? 0) -
        Number(b.stepOrder ?? b.sortOrder ?? 0),
    )
    .slice(0, 12);
  const processGraph = useMemo(
    () => buildProcessGraph(processSteps),
    [processSteps],
  );
  const activeExecution =
    scopedExecutions.find(
      row =>
        (!processCode || String(row.processCode) === processCode) &&
        String(row.executionStatus) === 'RUNNING',
    ) ??
    scopedExecutions.find(
      row => !processCode || String(row.processCode) === processCode,
    );
  const activeStepCode = String(
    activeExecution?.currentStepCode ?? activeExecution?.stepCode ?? '',
  );
  const activeStep =
    processSteps.find(row => String(row.stepCode) === selectedStepCode) ??
    processSteps.find(row => String(row.stepCode) === activeStepCode) ??
    processSteps[0];
  const scopedProjectTasks = useMemo(
    () =>
      emissionProjectTasks
        .filter(
          row =>
            !runtimeProjectId ||
            String(row.projectId ?? '') === runtimeProjectId,
        )
        .sort((a, b) => Number(a.stepOrder ?? 0) - Number(b.stepOrder ?? 0)),
    [emissionProjectTasks, runtimeProjectId],
  );
  const taskForStep = (step?: RuntimeRow) => {
    const stepCode = String(step?.stepCode ?? '');
    const fallbackTaskCode =
      stepCode === 'EMISSION_PROJECT_SETUP'
        ? 'BASIC_INFO'
        : stepCode === 'EMISSION_PROJECT_COLLECT' ||
          stepCode === 'EMISSION_PROJECT_CORRECT'
        ? 'ACTIVITY_DATA'
        : stepCode === 'EMISSION_PROJECT_CALCULATE'
        ? 'CALCULATION'
        : stepCode === 'EMISSION_PROJECT_VALIDATE'
        ? 'VERIFICATION'
        : stepCode === 'EMISSION_PROJECT_APPROVE'
        ? 'APPROVAL'
        : stepCode === 'EMISSION_PROJECT_REPORT'
        ? 'REPORT'
        : stepCode === 'EMISSION_PROJECT_REGULATORY_SUBMISSION'
        ? 'REGULATORY_SUBMISSION'
        : '';
    return scopedProjectTasks.find(
      row =>
        String(row.processStepCode ?? '') === stepCode ||
        (fallbackTaskCode && String(row.taskCode ?? '') === fallbackTaskCode),
    );
  };
  const activeProjectTask = taskForStep(activeStep);
  useEffect(() => {
    if (
      processSteps.length > 0 &&
      !processSteps.some(row => String(row.stepCode) === selectedStepCode)
    ) {
      setSelectedStepCode(
        String(
          processSteps.find(row => String(row.stepCode) === activeStepCode)
            ?.stepCode ?? processSteps[0].stepCode,
        ),
      );
    }
  }, [activeStepCode, processSteps, selectedStepCode]);
  const stepActor = actors.find(
    row => String(row.actorCode) === String(activeStep?.actorCode ?? ''),
  );
  const selectedActor =
    actors.find(row => String(row.actorCode) === selectedActorCode) ??
    stepActor ??
    actors[0];
  useEffect(() => {
    if (
      actors.length > 0 &&
      !actors.some(row => String(row.actorCode) === selectedActorCode)
    ) {
      setSelectedActorCode(String(stepActor?.actorCode ?? actors[0].actorCode));
    }
  }, [actors, selectedActorCode, stepActor?.actorCode]);
  const cases = ((dashboard.cases ?? []) as RuntimeRow[]).filter(
    row => String(row.processCode) === processCode,
  );
  const jobs = ((dashboard.developmentJobs ?? []) as RuntimeRow[]).filter(
    row =>
      String(row.processCode) === processCode &&
      (!row.stepCode || String(row.stepCode) === String(activeStep?.stepCode)),
  );
  const executableJobs = jobs.filter(row =>
    ['PLANNED', 'RETRY'].includes(String(row.jobStatus ?? '')),
  );
  const jobIds = new Set(jobs.map(row => String(row.jobId ?? '')));
  const developmentEvents = (
    (dashboard.developmentEvents ?? []) as RuntimeRow[]
  ).filter(row => jobIds.has(String(row.jobId ?? '')));
  const qualityGateResults = (
    (dashboard.qualityGateResults ?? []) as RuntimeRow[]
  ).filter(row => jobIds.has(String(row.jobId ?? '')));
  const rollbackRequests = (
    (dashboard.rollbackRequests ?? []) as RuntimeRow[]
  ).filter(row => jobIds.has(String(row.sourceJobId ?? '')));
  const jobStatusCounts = jobs.reduce<Record<string, number>>((counts, row) => {
    const status = String(row.jobStatus ?? 'UNKNOWN');
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const artifacts = ((dashboard.artifacts ?? []) as RuntimeRow[]).filter(
    row =>
      String(row.processCode) === processCode &&
      (!row.stepCode || String(row.stepCode) === String(activeStep?.stepCode)),
  );
  const customerJourney = useMemo(
    () =>
      buildCustomerJourneySimulation(
        processSteps,
        (dashboard.cases ?? []) as RuntimeRow[],
        (dashboard.artifacts ?? []) as RuntimeRow[],
        (dashboard.developmentJobs ?? []) as RuntimeRow[],
        (dashboard.customerJourneyGaps ?? []) as RuntimeRow[],
      ),
    [
      dashboard.artifacts,
      dashboard.cases,
      dashboard.customerJourneyGaps,
      dashboard.developmentJobs,
      processSteps,
    ],
  );
  const selectedScenario =
    customerJourney.scenarioCoverage.find(
      scenario => scenario.type === selectedScenarioType,
    ) ?? customerJourney.scenarioCoverage[0];
  const route = String(
    activeProjectTask?.targetUrl ??
      activeStep?.userPath ??
      activeStep?.adminPath ??
      '',
  );
  const runtimeRoute = route.startsWith('/')
    ? `${route}${route.includes('?') ? '&' : '?'}projectId=${encodeURIComponent(
        runtimeProjectId,
      )}`
    : route;
  const { nextStep, correctionStep, supportsCorrectionBranch } =
    resolveProcessBranches(processSteps, activeStep);
  const runRuntimeCommand = async (
    command: 'execution.validate' | 'execution.advance',
  ) => {
    const executionId = String(activeExecution?.executionId ?? '');
    if (!executionId || runtimeCommandPending) return;
    setRuntimeCommandPending(true);
    setRuntimeCommandResult('');
    try {
      const result = await executeRuntimeCommand(command, executionId);
      setRuntimeCommandResult(
        command === 'execution.validate'
          ? '완료 조건·필수 데이터·액터 권한을 검증했습니다. 실제 데이터는 변경하지 않았습니다.'
          : String(result.executionStatus) === 'COMPLETED'
          ? '프로세스의 모든 업무가 완료되었습니다.'
          : `다음 업무로 전환했습니다: ${displayValue(result.nextStepCode)}`,
      );
      if (command === 'execution.advance') {
        setSelectedStepCode(String(result.nextStepCode ?? ''));
      }
    } catch (error) {
      setRuntimeCommandResult(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setRuntimeCommandPending(false);
    }
  };
  const runDevelopmentPipeline = async () => {
    const stepCode = String(activeStep?.stepCode ?? '');
    if (!processCode || !stepCode || developmentPipelinePending) return;
    setDevelopmentPipelinePending(true);
    setDevelopmentPipelineResult('');
    try {
      const result = await executeDevelopmentPipeline(processCode, stepCode);
      const status = String(result.status ?? '');
      setDevelopmentPipelineResult(
        status === 'DESIGN_REQUIRED'
          ? `설계 보완 필요: ${displayValue(result.nextAction)}`
          : `자동 개발 파이프라인이 준비되었습니다: ${displayValue(
              status,
            )}. 생성 작업은 품질 게이트 통과 후에만 배포됩니다.`,
      );
    } catch (error) {
      setDevelopmentPipelineResult(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setDevelopmentPipelinePending(false);
    }
  };
  const runDevelopmentRetry = async (jobId: string) => {
    if (!jobId || developmentPipelinePending) return;
    setDevelopmentPipelinePending(true);
    setDevelopmentPipelineResult('');
    try {
      await retryDevelopmentJob(jobId);
      setDevelopmentPipelineResult(
        `개발 작업 ${jobId}을 RETRY 상태로 전환했습니다. 실행기가 의존성과 품질 게이트를 다시 확인합니다.`,
      );
    } catch (error) {
      setDevelopmentPipelineResult(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setDevelopmentPipelinePending(false);
    }
  };
  const runRollbackRequest = async (jobId: string) => {
    if (!jobId || developmentPipelinePending) return;
    const reason = window.prompt(
      '롤백 요청 사유를 입력하세요. 요청자와 다른 관리자의 승인이 필요합니다.',
      '운영 안정성 복구',
    );
    if (reason === null) return;
    setDevelopmentPipelinePending(true);
    setDevelopmentPipelineResult('');
    try {
      const result = await requestDevelopmentRollback(jobId, reason);
      setDevelopmentPipelineResult(
        `롤백 요청 ${displayValue(
          result.rollbackRequestId,
        )}이 등록되었습니다. 사전 검증을 통과했으며 다른 관리자의 승인을 기다립니다.`,
      );
    } catch (error) {
      setDevelopmentPipelineResult(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setDevelopmentPipelinePending(false);
    }
  };
  const runRollbackApproval = async (rollbackRequestId: string) => {
    if (!rollbackRequestId || developmentPipelinePending) return;
    if (
      !window.confirm(
        `롤백 요청 ${rollbackRequestId}을 승인하고 안전 실행 큐에 등록하시겠습니까?`,
      )
    )
      return;
    setDevelopmentPipelinePending(true);
    setDevelopmentPipelineResult('');
    try {
      const result = await approveDevelopmentRollback(rollbackRequestId);
      setDevelopmentPipelineResult(
        `롤백 작업 ${displayValue(
          result.rollbackJobId,
        )}이 승인된 실행 큐에 등록되었습니다. 실패 시 현재 운영 버전을 유지합니다.`,
      );
    } catch (error) {
      setDevelopmentPipelineResult(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setDevelopmentPipelinePending(false);
    }
  };
  const detailRows: Record<
    'design' | 'data' | 'screen' | 'test' | 'task',
    Array<Array<unknown>>
  > = {
    design: [
      ['프로세스', selectedProcess?.processName, processCode],
      ['단계', activeStep?.stepName, activeStep?.stepCode],
      ['담당 액터', stepActor?.actorName, activeStep?.actorCode],
      [
        '상태 전이',
        activeStep?.transitionRule ?? activeStep?.completionRule,
        activeStep?.automationStatus ?? activeExecution?.executionStatus,
      ],
    ],
    data: [
      ['입력 계약', activeStep?.inputContract, '필수 입력'],
      ['출력 계약', activeStep?.outputContract, '다음 단계 전달'],
      ['완료 조건', activeStep?.completionRule, '상태 전이 기준'],
      ['예외 규칙', activeStep?.exceptionRule, '실패·복구'],
    ],
    screen: artifacts.map(row => [
      row.artifactType,
      row.artifactName,
      row.targetPath ?? row.contractRef,
    ]),
    test: cases.map(row => [
      row.caseType,
      row.caseName,
      row.status ?? row.expectedResult,
    ]),
    task: jobs.map(row => [
      row.jobType,
      row.jobName ?? row.jobId,
      row.jobStatus ?? row.evidenceRef,
    ]),
  };

  return (
    <Box mt={3}>
      <Paper
        elevation={0}
        style={{
          marginBottom: 16,
          padding: 16,
          borderRadius: 10,
          color: '#fff',
          background: 'linear-gradient(110deg,#052b57,#174ea6)',
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          gridGap={16}
          flexWrap="wrap"
        >
          <Box>
            <Typography variant="overline" style={{ color: '#bfdbfe' }}>
              {mode === 'execution'
                ? 'END-TO-END PROCESS EXECUTION'
                : 'INTEGRATED DESIGN WORKBENCH'}
            </Typography>
            <Typography variant="h6">
              {mode === 'execution'
                ? '프로젝트 업무 실행·완료 전환'
                : '통합 설계 문서·액티브 UI 관리'}
            </Typography>
            <Typography variant="body2">
              {mode === 'execution'
                ? '실제 프로젝트와 담당 액터를 선택하고 완료 조건 검증, 업무 화면 실행, 다음 단계 전환을 한곳에서 수행합니다.'
                : '선택한 프로세스·단계·화면의 설계 문서 18종을 버전으로 관리합니다.'}
            </Typography>
          </Box>
          {mode === 'dashboard' && (
            <Button
              variant="contained"
              onClick={() => setDesignWorkbenchOpen(true)}
              style={{ background: '#fff', color: '#174ea6' }}
            >
              설계 워크벤치 열기
            </Button>
          )}
        </Box>
      </Paper>
      <Grid container spacing={2}>
        <Grid item xs={12} lg={3}>
          <Paper variant="outlined" style={{ padding: 16, height: '100%' }}>
            <Typography variant="overline">1. 업무 선택</Typography>
            <Typography variant="h6">프로젝트·액터</Typography>
            <Box mt={2}>
              <Chip size="small" color="primary" label={projectId} />
            </Box>
            <FormControl
              variant="outlined"
              size="small"
              fullWidth
              style={{ marginTop: 16 }}
            >
              <InputLabel>실행 업무 프로젝트</InputLabel>
              <Select
                value={runtimeProjectId}
                label="실행 업무 프로젝트"
                onChange={event => {
                  setRuntimeProjectId(String(event.target.value));
                  setSelectedProcessCode('');
                  setSelectedStepCode('');
                  setRuntimeCommandResult('');
                }}
              >
                {runtimeProjects.map(value => (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="textSecondary">
              상단 프로젝트는 설계 범위이며, 실행 업무 프로젝트는 고객
              업무·상태·권한 범위입니다.
            </Typography>
            <FormControl
              variant="outlined"
              size="small"
              fullWidth
              style={{ marginTop: 16 }}
            >
              <InputLabel>업무 종류 선택</InputLabel>
              <Select
                value={selectedWorkType}
                label="업무 종류 선택"
                displayEmpty
                renderValue={value => {
                  const code = String(value ?? '');
                  if (!code) return '전체 업무';
                  const selected = workTypes.find(
                    row =>
                      String(
                        row.workTypeCode ??
                          row.domainCode ??
                          row.typeCode ??
                          '',
                      ) === code,
                  );
                  return `${displayValue(
                    selected?.workTypeName ??
                      selected?.domainName ??
                      selected?.typeName,
                  )} (${code})`;
                }}
                onChange={event => {
                  setSelectedWorkType(String(event.target.value));
                  setSelectedProcessCode('');
                  setSelectedStepCode('');
                }}
              >
                <MenuItem value="">전체 업무</MenuItem>
                {workTypes.map(row => {
                  const code = String(
                    row.workTypeCode ?? row.domainCode ?? row.typeCode ?? '',
                  );
                  return (
                    <MenuItem key={code} value={code}>
                      {displayValue(
                        row.workTypeName ?? row.domainName ?? row.typeName,
                      )}{' '}
                      ({code})
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            <FormControl
              variant="outlined"
              size="small"
              fullWidth
              style={{ marginTop: 16 }}
            >
              <InputLabel>프로세스 선택</InputLabel>
              <Select
                value={processCode}
                label="프로세스 선택"
                onChange={event => {
                  const nextCode = String(event.target.value);
                  setSelectedProcessCode(nextCode);
                  setSelectedStepCode('');
                  const firstStep = steps
                    .filter(row => String(row.processCode) === nextCode)
                    .sort(
                      (a, b) =>
                        Number(a.stepOrder ?? 0) - Number(b.stepOrder ?? 0),
                    )[0];
                  if (firstStep?.actorCode) {
                    setSelectedActorCode(String(firstStep.actorCode));
                  }
                }}
              >
                {filteredProcesses.map(row => (
                  <MenuItem
                    key={String(row.processCode)}
                    value={String(row.processCode)}
                  >
                    {displayValue(row.processName)} (
                    {displayValue(row.processCode)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl
              variant="outlined"
              size="small"
              fullWidth
              style={{ marginTop: 12 }}
            >
              <InputLabel>액터 선택</InputLabel>
              <Select
                value={String(selectedActor?.actorCode ?? '')}
                label="액터 선택"
                onChange={event =>
                  setSelectedActorCode(String(event.target.value))
                }
              >
                {actors.map(row => (
                  <MenuItem
                    key={String(row.actorCode)}
                    value={String(row.actorCode)}
                  >
                    {displayValue(row.actorName)} ({displayValue(row.actorCode)}
                    )
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="body2" style={{ marginTop: 12 }}>
              선택 액터: {displayValue(selectedActor?.actorName)}
            </Typography>
            <Typography variant="caption" display="block" color="textSecondary">
              현재 단계 담당:{' '}
              {displayValue(stepActor?.actorName ?? activeStep?.actorCode)}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              전체 프로세스 {processes.length}개 · 액터 {actors.length}개
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Paper variant="outlined" style={{ padding: 16, height: '100%' }}>
            <Typography variant="overline">2. 전체 업무 실행 순서</Typography>
            <Typography variant="h6">
              {displayValue(selectedProcess?.processName)}
            </Typography>
            <Box
              mt={2}
              display="flex"
              alignItems="stretch"
              gridGap={8}
              style={{ overflowX: 'auto', paddingBottom: 8 }}
            >
              {processSteps.length ? (
                processSteps.map((step, index) => {
                  const selected =
                    String(step.stepCode) === String(activeStep?.stepCode);
                  const projectTask = taskForStep(step);
                  return (
                    <Box
                      key={`${step.stepCode}-${index}`}
                      onClick={() => {
                        setSelectedStepCode(String(step.stepCode));
                        onSelect(step);
                      }}
                      role="button"
                      tabIndex={0}
                      style={{
                        flex: '0 0 150px',
                        padding: 12,
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: selected
                          ? '2px solid #005ea8'
                          : '1px solid #cbd5e1',
                        background: selected ? '#e8f2ff' : '#fff',
                      }}
                    >
                      <Typography variant="caption">{index + 1}단계</Typography>
                      <Typography variant="subtitle2">
                        {displayValue(step.stepName)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {displayValue(step.actorCode)}
                      </Typography>
                      {projectTask && (
                        <Box mt={1} display="flex" gridGap={4} flexWrap="wrap">
                          <Chip
                            size="small"
                            label={displayValue(projectTask.taskStatus)}
                            color={
                              String(projectTask.taskStatus) === 'DONE'
                                ? 'primary'
                                : 'default'
                            }
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={displayValue(projectTask.assigneeId)}
                          />
                        </Box>
                      )}
                    </Box>
                  );
                })
              ) : (
                <Typography variant="body2" color="textSecondary">
                  이 프로세스에 등록된 단계가 없습니다.
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={3}>
          <Paper variant="outlined" style={{ padding: 16, height: '100%' }}>
            <Typography variant="overline">3. 실시간 업무 길잡이</Typography>
            <Typography variant="h6">
              {displayValue(activeStep?.stepName) || '시작할 단계 없음'}
            </Typography>
            <Typography variant="body2" style={{ marginTop: 12 }}>
              완료 조건
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {displayValue(
                activeStep?.completionRule ?? activeStep?.completionCondition,
              )}
            </Typography>
            <Box mt={2}>
              <Chip
                size="small"
                label={displayValue(
                  activeProjectTask?.taskStatus ??
                    activeExecution?.executionStatus ??
                    activeExecution?.status ??
                    '설계 상태',
                )}
              />
            </Box>
            {activeProjectTask && (
              <Box
                mt={2}
                p={1.5}
                style={{
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                }}
              >
                <Typography variant="subtitle2">
                  실제 프로젝트 실행 업무
                </Typography>
                <Typography variant="body2" style={{ marginTop: 6 }}>
                  {displayValue(activeProjectTask.taskName)}
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  color="textSecondary"
                >
                  담당자 {displayValue(activeProjectTask.assigneeId)} · 마감일{' '}
                  {displayValue(activeProjectTask.dueDate)}
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  color="textSecondary"
                  style={{ marginTop: 6 }}
                >
                  완료 근거:{' '}
                  {displayValue(activeProjectTask.completionEvidence)}
                </Typography>
                {Boolean(activeProjectTask.nextTaskName) && (
                  <Typography
                    variant="caption"
                    display="block"
                    color="primary"
                    style={{ marginTop: 6, fontWeight: 700 }}
                  >
                    다음 인계: {displayValue(activeProjectTask.nextTaskName)} ·{' '}
                    {displayValue(activeProjectTask.nextActorCode)}
                  </Typography>
                )}
              </Box>
            )}
            <Box mt={2} display="grid" gridGap={8}>
              {route.startsWith('/') ? (
                <Button
                  variant="contained"
                  color="primary"
                  href={runtimeRoute}
                  target="_blank"
                >
                  업무 화면 열기
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => onOpenTab('data-contracts')}
                >
                  화면·필드 설계하기
                </Button>
              )}
              {supportsCorrectionBranch && (
                <Paper
                  variant="outlined"
                  style={{
                    padding: 12,
                    borderColor: '#b8c7dc',
                    background: '#f8fafc',
                  }}
                >
                  <Typography variant="subtitle2">처리 결과 분기</Typography>
                  <Typography variant="caption" color="textSecondary">
                    판정과 사유는 실제 업무 화면에서 저장하며, 길잡이는 저장된
                    결과에 따라 다음 단계만 개방합니다.
                  </Typography>
                  <Box mt={1} display="grid" gridGap={8}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      href={runtimeRoute}
                      target="_blank"
                    >
                      정상 처리 → {displayValue(nextStep?.stepName)}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      href={runtimeRoute}
                      target="_blank"
                    >
                      보완 요청 → {displayValue(correctionStep?.stepName)}
                    </Button>
                  </Box>
                </Paper>
              )}
              {String(activeStep?.stepCode) === 'EMISSION_PROJECT_CORRECT' && (
                <Paper
                  variant="outlined"
                  style={{
                    padding: 12,
                    borderColor: '#f59e0b',
                    background: '#fffbeb',
                  }}
                >
                  <Typography variant="subtitle2">보완·재산정 경로</Typography>
                  <Typography variant="caption" color="textSecondary">
                    보완자료와 변경 사유를 저장하고 재산정한 뒤 재검증 단계로
                    돌아갑니다.
                  </Typography>
                </Paper>
              )}
              <Button
                variant="outlined"
                disabled={
                  !activeExecution?.executionId ||
                  runtimeCommandPending ||
                  String(activeExecution?.executionStatus) !== 'RUNNING'
                }
                onClick={() => void runRuntimeCommand('execution.validate')}
              >
                {runtimeCommandPending ? '처리 중...' : '완료 조건 검증'}
              </Button>
              <Button
                variant="outlined"
                disabled={
                  !activeExecution?.executionId ||
                  runtimeCommandPending ||
                  String(activeExecution?.executionStatus) !== 'RUNNING'
                }
                onClick={() => void runRuntimeCommand('execution.advance')}
              >
                {nextStep
                  ? `상태 동기화 복구: ${displayValue(nextStep.stepName)} →`
                  : '현재 업무 완료 상태 복구'}
              </Button>
              {mode === 'dashboard' && (
                <Paper
                  variant="outlined"
                  style={{
                    padding: 12,
                    borderColor: executableJobs.length ? '#2563eb' : '#cbd5e1',
                    background: executableJobs.length ? '#eff6ff' : '#f8fafc',
                  }}
                >
                  <Typography variant="subtitle2">
                    설계 → 개발 자동 실행
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    선택 단계의 PLANNED/RETRY 작업 {executableJobs.length}건을
                    설계·공통자산·테스트 사전검사 후 생성 큐에 등록합니다.
                    테스트와 배포 게이트를 통과하지 못하면 운영 반영되지
                    않습니다.
                  </Typography>
                  <Box mt={1}>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      disabled={
                        executableJobs.length === 0 ||
                        developmentPipelinePending ||
                        !activeStep?.stepCode
                      }
                      onClick={() => void runDevelopmentPipeline()}
                    >
                      {developmentPipelinePending
                        ? '자동화 실행 중…'
                        : `자동 개발 시작 (${executableJobs.length})`}
                    </Button>
                  </Box>
                </Paper>
              )}
            </Box>
            {runtimeCommandResult && (
              <Typography
                variant="body2"
                color="textSecondary"
                style={{ marginTop: 12 }}
              >
                {runtimeCommandResult}
              </Typography>
            )}
            {mode === 'dashboard' && developmentPipelineResult && (
              <Typography
                variant="body2"
                color="textSecondary"
                style={{ marginTop: 8 }}
              >
                {developmentPipelineResult}
              </Typography>
            )}
            {mode === 'dashboard' && (
              <Paper
                variant="outlined"
                style={{ marginTop: 12, padding: 12, background: '#f8fafc' }}
              >
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  gridGap={8}
                  flexWrap="wrap"
                >
                  <Box>
                    <Typography variant="subtitle2">
                      자동 개발 실행 타임라인
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      생성·테스트·배포 게이트의 현재 상태와 증적을 실시간
                      데이터로 표시합니다.
                    </Typography>
                  </Box>
                  <Box display="flex" gridGap={4} flexWrap="wrap">
                    {Object.entries(jobStatusCounts).map(([status, count]) => (
                      <Chip
                        key={status}
                        size="small"
                        color={
                          status === 'VERIFIED'
                            ? 'primary'
                            : status === 'FAILED'
                            ? 'secondary'
                            : 'default'
                        }
                        label={`${status} ${count}`}
                      />
                    ))}
                  </Box>
                </Box>
                <Box mt={1.5} display="grid" gridGap={8}>
                  {jobs.length === 0 && (
                    <Typography variant="body2" color="textSecondary">
                      선택 단계에 등록된 개발 작업이 없습니다.
                    </Typography>
                  )}
                  {jobs.slice(0, 8).map(job => {
                    const jobId = String(job.jobId ?? '');
                    const status = String(job.jobStatus ?? 'UNKNOWN');
                    const latestEvent = developmentEvents.find(
                      event => String(event.jobId ?? '') === jobId,
                    );
                    const latestGate = qualityGateResults.find(
                      gate => String(gate.jobId ?? '') === jobId,
                    );
                    const targetPath = String(job.targetPath ?? '');
                    const canRetry = ['FAILED', 'RETRY'].includes(status);
                    const rollbackRequest = rollbackRequests.find(
                      request => String(request.sourceJobId ?? '') === jobId,
                    );
                    const canRequestRollback =
                      ['VERIFIED', 'COMPLETED'].includes(status) &&
                      String(job.qualityStatus ?? '') === 'VERIFIED' &&
                      Boolean(job.rollbackRef) &&
                      !rollbackRequest;
                    const canApproveRollback =
                      String(rollbackRequest?.requestStatus ?? '') ===
                      'PENDING';
                    return (
                      <Paper
                        key={jobId}
                        variant="outlined"
                        style={{ padding: 10, background: '#fff' }}
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          gridGap={8}
                          flexWrap="wrap"
                        >
                          <Box style={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2">
                              {displayValue(job.jobName ?? job.jobType)}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {displayValue(job.jobType)} · 최근 이벤트{' '}
                              {displayValue(
                                latestEvent?.eventType ?? job.updatedAt,
                              )}
                            </Typography>
                            {Boolean(job.lastError || latestGate?.summary) && (
                              <Typography
                                variant="caption"
                                color="error"
                                display="block"
                              >
                                {displayValue(
                                  job.lastError ?? latestGate?.summary,
                                )}
                              </Typography>
                            )}
                            {Boolean(
                              job.evidenceRef || latestGate?.evidenceRef,
                            ) && (
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                display="block"
                              >
                                증적:{' '}
                                {displayValue(
                                  job.evidenceRef ?? latestGate?.evidenceRef,
                                )}
                              </Typography>
                            )}
                          </Box>
                          <Box display="flex" gridGap={6} alignItems="center">
                            <Chip size="small" label={status} />
                            {targetPath.startsWith('/') && (
                              <Button
                                size="small"
                                variant="outlined"
                                href={targetPath}
                                target="_blank"
                              >
                                미리보기
                              </Button>
                            )}
                            {canRetry && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="secondary"
                                disabled={developmentPipelinePending}
                                onClick={() => void runDevelopmentRetry(jobId)}
                              >
                                안전 재시도
                              </Button>
                            )}
                            {canRequestRollback && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="secondary"
                                disabled={developmentPipelinePending}
                                onClick={() => void runRollbackRequest(jobId)}
                              >
                                롤백 요청
                              </Button>
                            )}
                            {canApproveRollback && (
                              <Button
                                size="small"
                                variant="contained"
                                color="secondary"
                                disabled={developmentPipelinePending}
                                onClick={() =>
                                  void runRollbackApproval(
                                    String(
                                      rollbackRequest?.rollbackRequestId ?? '',
                                    ),
                                  )
                                }
                              >
                                롤백 승인
                              </Button>
                            )}
                          </Box>
                        </Box>
                        {rollbackRequest && (
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            display="block"
                            style={{ marginTop: 6 }}
                          >
                            롤백 #
                            {displayValue(rollbackRequest.rollbackRequestId)} ·{' '}
                            {displayValue(rollbackRequest.requestStatus)} · 사전
                            검증 {displayValue(rollbackRequest.preflightStatus)}{' '}
                            · 요청자 {displayValue(rollbackRequest.requestedBy)}
                          </Typography>
                        )}
                      </Paper>
                    );
                  })}
                </Box>
              </Paper>
            )}
          </Paper>
        </Grid>
      </Grid>
      <Paper
        variant="outlined"
        style={{ marginTop: 16, padding: 16, overflow: 'hidden' }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          gridGap={16}
          flexWrap="wrap"
        >
          <Box>
            <Typography variant="overline">프로세스 계약 지도</Typography>
            <Typography variant="h6">정상·분기·복구·입출력 흐름</Typography>
            <Typography variant="body2" color="textSecondary">
              단계의 상태 계약을 기준으로 화면, 담당 액터, 입력·출력과 예외 복구
              경로를 함께 추적합니다.
            </Typography>
          </Box>
          <Box display="flex" gridGap={8} flexWrap="wrap">
            <Chip size="small" label={`단계 ${processGraph.steps.length}개`} />
            <Chip
              size="small"
              color="primary"
              label={`연결 ${processGraph.edges.length}개`}
            />
            <Chip
              size="small"
              label={`종료 ${processGraph.terminalSteps.length}개`}
            />
          </Box>
        </Box>
        <Box
          mt={2}
          display="flex"
          alignItems="stretch"
          gridGap={12}
          style={{ overflowX: 'auto', paddingBottom: 12 }}
        >
          {processGraph.steps.map((step, index) => {
            const code = String(step.stepCode ?? '');
            const selected =
              code === String(activeStep?.stepCode ?? selectedStepCode);
            const normalTargets = processGraph.edges.filter(
              edge =>
                String(edge.from.stepCode ?? '') === code &&
                edge.kind === 'NORMAL',
            );
            const exceptionTargets = processGraph.edges.filter(
              edge =>
                String(edge.from.stepCode ?? '') === code &&
                edge.kind !== 'NORMAL',
            );
            const screenPath = String(step.userPath ?? step.adminPath ?? '');
            return (
              <Box
                key={code || index}
                display="flex"
                alignItems="center"
                gridGap={12}
              >
                <Paper
                  role="button"
                  tabIndex={0}
                  variant="outlined"
                  onClick={() => {
                    setSelectedStepCode(code);
                    onSelect(step);
                  }}
                  style={{
                    width: 260,
                    minHeight: 250,
                    padding: 14,
                    cursor: 'pointer',
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? '#005ea8' : '#cbd5e1',
                    background: selected ? '#f0f7ff' : '#fff',
                  }}
                >
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    gridGap={8}
                  >
                    <Chip size="small" label={`${index + 1}단계`} />
                    <Typography variant="caption" color="textSecondary">
                      {displayValue(step.actorCode)}
                    </Typography>
                  </Box>
                  <Typography
                    variant="subtitle1"
                    style={{ marginTop: 10, fontWeight: 700 }}
                  >
                    {displayValue(step.stepName)}
                  </Typography>
                  <Typography
                    variant="caption"
                    display="block"
                    color="textSecondary"
                  >
                    {displayValue(step.fromState)} →{' '}
                    {displayValue(step.toState)}
                  </Typography>
                  <Box mt={1}>
                    <Typography variant="caption" display="block">
                      입력
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {displayValue(step.inputContract)}
                    </Typography>
                  </Box>
                  <Box mt={1}>
                    <Typography variant="caption" display="block">
                      출력
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {displayValue(step.outputContract)}
                    </Typography>
                  </Box>
                  <Box mt={1}>
                    <Typography variant="caption" display="block">
                      화면·경로
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {screenPath || '화면 계약 필요'}
                    </Typography>
                  </Box>
                  {exceptionTargets.length > 0 && (
                    <Box
                      mt={1}
                      p={1}
                      style={{
                        borderRadius: 6,
                        color: '#7c2d12',
                        background: '#fff7ed',
                      }}
                    >
                      <Typography variant="caption">
                        예외·복구:{' '}
                        {exceptionTargets
                          .map(edge => displayValue(edge.to.stepName))
                          .join(', ')}
                      </Typography>
                    </Box>
                  )}
                </Paper>
                {index < processGraph.steps.length - 1 && (
                  <Box
                    minWidth={88}
                    textAlign="center"
                    aria-label={`${displayValue(step.stepName)} 다음 상태 연결`}
                  >
                    <Typography
                      variant="caption"
                      display="block"
                      color="primary"
                    >
                      {normalTargets.length > 0
                        ? normalTargets
                            .map(edge => edge.condition)
                            .filter(Boolean)
                            .join(', ')
                        : '상태 계약 확인'}
                    </Typography>
                    <Typography
                      aria-hidden="true"
                      style={{ color: '#005ea8', fontSize: 24 }}
                    >
                      →
                    </Typography>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
        {processGraph.edges.some(edge => edge.kind !== 'NORMAL') && (
          <Box
            p={1.5}
            display="flex"
            gridGap={8}
            flexWrap="wrap"
            style={{ borderRadius: 8, background: '#f8fafc' }}
          >
            {processGraph.edges
              .filter(edge => edge.kind !== 'NORMAL')
              .map((edge, index) => (
                <Chip
                  key={`${String(edge.from.stepCode)}-${String(
                    edge.to.stepCode,
                  )}-${index}`}
                  size="small"
                  variant="outlined"
                  label={`${edge.kind}: ${displayValue(
                    edge.from.stepName,
                  )} → ${displayValue(edge.to.stepName)}`}
                  style={{
                    color:
                      edge.kind === 'CORRECTION' || edge.kind === 'EXCEPTION'
                        ? '#9a3412'
                        : '#1e40af',
                  }}
                />
              ))}
          </Box>
        )}
      </Paper>
      <Paper variant="outlined" style={{ marginTop: 16, padding: 16 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          gridGap={16}
          flexWrap="wrap"
        >
          <Box>
            <Typography variant="overline">고객 여정 시뮬레이션</Typography>
            <Typography variant="h6">
              액터·화면·데이터·테스트 실행 준비도
            </Typography>
            <Typography variant="body2" color="textSecondary">
              정상, 권한, 데이터 격리, 예외, 복구 시나리오를 동일한 업무 단계에
              투영하여 고객이 실제 업무를 끝낼 수 있는지 검토합니다.
            </Typography>
          </Box>
          <Box display="flex" gridGap={8} flexWrap="wrap">
            <Chip
              color={customerJourney.blockerCount > 0 ? 'secondary' : 'primary'}
              label={`차단 ${customerJourney.blockerCount}건`}
            />
            <Chip label={`실행 준비도 ${customerJourney.readinessPercent}%`} />
          </Box>
        </Box>
        <Grid container spacing={2} style={{ marginTop: 4 }}>
          <Grid item xs={12} md={4}>
            <Box display="grid" gridGap={8}>
              {customerJourney.scenarioCoverage.map(scenario => {
                const labels: Record<string, string> = {
                  HAPPY_PATH: '정상 업무',
                  AUTHORITY: '권한·직무분리',
                  ISOLATION: '테넌트·프로젝트 격리',
                  EXCEPTION: '오류·예외',
                  RECOVERY: '복구·재처리',
                };
                const selected = scenario.type === selectedScenarioType;
                return (
                  <Button
                    key={scenario.type}
                    variant={selected ? 'contained' : 'outlined'}
                    color={selected ? 'primary' : 'default'}
                    onClick={() => setSelectedScenarioType(scenario.type)}
                    style={{
                      minHeight: 48,
                      justifyContent: 'space-between',
                      textTransform: 'none',
                    }}
                  >
                    <span>{labels[scenario.type] ?? scenario.type}</span>
                    <span>
                      {scenario.count}건 ·{' '}
                      {scenario.approved ? '승인' : '검토 필요'}
                    </span>
                  </Button>
                );
              })}
            </Box>
            <Box
              mt={2}
              p={1.5}
              style={{
                borderRadius: 8,
                background:
                  customerJourney.missingScenarioTypes.length > 0
                    ? '#fff7ed'
                    : '#f0fdf4',
              }}
            >
              <Typography variant="subtitle2">
                5대 안전 시나리오 계약
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {customerJourney.missingScenarioTypes.length > 0
                  ? `미등록: ${customerJourney.missingScenarioTypes.join(', ')}`
                  : '필수 시나리오가 모두 등록되었습니다.'}
              </Typography>
              <Button
                size="small"
                style={{ marginTop: 8 }}
                onClick={() => onOpenTab('test-scenarios')}
              >
                테스트 시나리오 관리
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12} md={8}>
            <Paper variant="outlined" style={{ padding: 14, marginBottom: 12 }}>
              <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
                {displayValue(selectedScenario?.type)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                등록 {selectedScenario?.count ?? 0}건 · 승인 여부{' '}
                {selectedScenario?.approved ? '충족' : '검토 필요'}
              </Typography>
              {(selectedScenario?.cases ?? []).slice(0, 3).map(row => (
                <Box
                  key={String(row.caseCode ?? row.case_code)}
                  mt={1}
                  p={1}
                  style={{ borderRadius: 6, background: '#f8fafc' }}
                >
                  <Typography variant="body2">
                    {displayValue(row.caseName ?? row.case_name)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {displayValue(row.preconditions)} ·{' '}
                    {displayValue(row.status ?? row.case_status)}
                  </Typography>
                </Box>
              ))}
            </Paper>
            <Box style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: 760,
                  borderCollapse: 'collapse',
                  fontSize: 13,
                }}
              >
                <thead style={{ background: '#f1f5f9' }}>
                  <tr>
                    {[
                      '순서·업무',
                      '담당 액터',
                      '화면',
                      '계약',
                      '증적',
                      '개발',
                      '차단',
                      '준비도',
                    ].map(head => (
                      <th key={head} style={{ padding: 10, textAlign: 'left' }}>
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customerJourney.journeySteps.map((item, index) => (
                    <tr key={String(item.step.stepCode ?? index)}>
                      <td
                        style={{
                          padding: 10,
                          borderTop: '1px solid #e2e8f0',
                        }}
                      >
                        {index + 1}. {displayValue(item.step.stepName)}
                      </td>
                      <td style={{ borderTop: '1px solid #e2e8f0' }}>
                        {displayValue(item.step.actorCode)}
                      </td>
                      <td style={{ borderTop: '1px solid #e2e8f0' }}>
                        {item.screenReady ? '연결' : '미연결'}
                      </td>
                      <td style={{ borderTop: '1px solid #e2e8f0' }}>
                        {item.contractReady ? '완료' : '보완'}
                      </td>
                      <td style={{ borderTop: '1px solid #e2e8f0' }}>
                        {item.artifactCount}건
                      </td>
                      <td style={{ borderTop: '1px solid #e2e8f0' }}>
                        {item.developmentReady ? '검증됨' : '진행 중'}
                      </td>
                      <td style={{ borderTop: '1px solid #e2e8f0' }}>
                        {item.blockerCount}건
                      </td>
                      <td
                        style={{
                          borderTop: '1px solid #e2e8f0',
                          fontWeight: 700,
                        }}
                      >
                        {item.readinessPercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      {mode === 'dashboard' && (
        <Box mt={2}>
          <Paper variant="outlined" style={{ padding: 16 }}>
            <Typography variant="overline">
              4. 설계·입출력·화면·API·테스트·태스크 증적
            </Typography>
            <Box mt={1} display="flex" gridGap={8} flexWrap="wrap">
              {[
                ['액터', actors.length],
                ['프로세스', processes.length],
                ['단계', steps.length],
                ['실행 업무', executions.length],
                ['테스트', ((dashboard.cases ?? []) as RuntimeRow[]).length],
                [
                  '개발 태스크',
                  ((dashboard.developmentJobs ?? []) as RuntimeRow[]).length,
                ],
              ].map(([label, count]) => (
                <Chip key={String(label)} label={`${label} ${count}개`} />
              ))}
            </Box>
          </Paper>
        </Box>
      )}
      {mode === 'dashboard' && (
        <Paper variant="outlined" style={{ marginTop: 16, overflow: 'hidden' }}>
          <Box
            display="flex"
            style={{
              overflowX: 'auto',
              borderBottom: '1px solid #dbe4ea',
              background: '#f8fafc',
            }}
          >
            {(
              [
                ['design', '설계'],
                ['data', '입출력 데이터'],
                ['screen', '화면·API'],
                ['test', '테스트'],
                ['task', '태스크·증적'],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                onClick={() => setDetailTab(id)}
                style={{
                  minHeight: 48,
                  borderRadius: 0,
                  borderBottom:
                    detailTab === id
                      ? '3px solid #005ea8'
                      : '3px solid transparent',
                  background: detailTab === id ? '#fff' : 'transparent',
                }}
              >
                {label}
              </Button>
            ))}
          </Box>
          <Box p={2} style={{ overflowX: 'auto' }}>
            {detailRows[detailTab].length ? (
              <table
                style={{
                  width: '100%',
                  minWidth: 700,
                  borderCollapse: 'collapse',
                  fontSize: 13,
                }}
              >
                <thead style={{ background: '#f1f5f9' }}>
                  <tr>
                    {['구분', '내용', '계약·상태'].map(head => (
                      <th key={head} style={{ padding: 12, textAlign: 'left' }}>
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailRows[detailTab].map((row, index) => (
                    <tr key={`${detailTab}-${index}`}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          style={{
                            padding: 12,
                            borderTop: '1px solid #e2e8f0',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {displayValue(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Typography variant="body2" color="textSecondary">
                선택한 단계에 연결된 {detailTab} 데이터가 없습니다.
              </Typography>
            )}
          </Box>
          <Box
            p={2}
            display="flex"
            justifyContent="flex-end"
            gridGap={8}
            flexWrap="wrap"
            style={{ borderTop: '1px solid #dbe4ea', background: '#f8fafc' }}
          >
            <Button
              variant="outlined"
              onClick={() => onOpenTab('data-contracts')}
            >
              설계 수정
            </Button>
            <Button
              variant="outlined"
              onClick={() => onOpenTab('test-scenarios')}
            >
              테스트 실행
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => onOpenTab('generation-queue')}
            >
              개발 요청
            </Button>
          </Box>
        </Paper>
      )}
      {mode === 'dashboard' && (
        <DesignWorkbenchDialog
          open={designWorkbenchOpen}
          onClose={() => setDesignWorkbenchOpen(false)}
          process={selectedProcess}
          step={activeStep}
          routePath={route}
          loadDocuments={loadDesignDocuments}
          saveDocument={saveDesignDocument}
          onOpenTab={onOpenTab}
        />
      )}
    </Box>
  );
}

const DESIGN_DOCUMENT_GROUPS = [
  [
    '업무·거버넌스',
    [
      'REQUIREMENT',
      'ACTOR_RACI',
      'AUTHORITY',
      'PROCESS',
      'STATE',
      'NAVIGATION',
    ],
  ],
  [
    '화면·데이터',
    [
      'ACTIVE_UI',
      'DESIGN_ASSET',
      'FIELD_DICTIONARY',
      'DATA_HANDOFF',
      'DATABASE',
      'API',
    ],
  ],
  [
    '품질·운영',
    [
      'BUSINESS_RULE',
      'VALIDATION',
      'NOTIFICATION',
      'TEST',
      'TASK_EVIDENCE',
      'RELEASE_AUDIT',
    ],
  ],
] as const;

function DesignWorkbenchDialog({
  open,
  onClose,
  process,
  step,
  routePath,
  loadDocuments,
  saveDocument,
  onOpenTab,
}: {
  open: boolean;
  onClose: () => void;
  process: RuntimeRow;
  step: RuntimeRow;
  routePath: string;
  loadDocuments: (
    processCode: string,
    stepCode: string,
    routePath: string,
  ) => Promise<DesignDocument[]>;
  saveDocument: (
    document: DesignDocument & {
      processCode: string;
      stepCode: string;
      routePath: string;
    },
  ) => Promise<void>;
  onOpenTab: (tabId: string) => void;
}) {
  const processCode = String(process?.processCode ?? '');
  const stepCode = String(step?.stepCode ?? '');
  const [documents, setDocuments] = useState<DesignDocument[]>([]);
  const [selectedType, setSelectedType] = useState('REQUIREMENT');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const current = documents.find(row => row.documentType === selectedType);
  const ready = documents.filter(row =>
    ['READY', 'APPROVED', 'VERIFIED'].includes(row.status),
  ).length;

  useEffect(() => {
    if (!open || !processCode) return;
    setBusy(true);
    setMessage('');
    void loadDocuments(processCode, stepCode, routePath)
      .then(setDocuments)
      .catch(error =>
        setMessage(error instanceof Error ? error.message : String(error)),
      )
      .finally(() => setBusy(false));
  }, [loadDocuments, open, processCode, routePath, stepCode]);

  const updateCurrent = (patch: Partial<DesignDocument>) => {
    setDocuments(rows =>
      rows.map(row =>
        row.documentType === selectedType ? { ...row, ...patch } : row,
      ),
    );
  };
  const save = async () => {
    if (!current) return;
    setBusy(true);
    setMessage('');
    try {
      await saveDocument({
        ...current,
        processCode,
        stepCode,
        routePath,
      });
      const refreshed = await loadDocuments(processCode, stepCode, routePath);
      setDocuments(refreshed);
      setMessage(`${current.title} 저장과 새 버전 생성을 완료했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle style={{ background: '#052b57', color: '#fff' }}>
        통합 설계 워크벤치
        <Typography variant="body2" style={{ color: '#bfdbfe' }}>
          {displayValue(process?.processName)} · {displayValue(step?.stepName)}{' '}
          · 설계 준비 {ready}/18
        </Typography>
      </DialogTitle>
      <DialogContent style={{ padding: 0 }}>
        <Grid container>
          <Grid
            item
            xs={12}
            md={3}
            style={{ padding: 16, background: '#f8fafc' }}
          >
            {DESIGN_DOCUMENT_GROUPS.map(([group, types]) => (
              <Box key={group} mb={2}>
                <Typography variant="overline">{group}</Typography>
                {types.map(type => {
                  const document = documents.find(
                    row => row.documentType === type,
                  );
                  return (
                    <Button
                      key={type}
                      fullWidth
                      onClick={() => setSelectedType(type)}
                      style={{
                        justifyContent: 'space-between',
                        marginTop: 4,
                        background: selectedType === type ? '#e8f2ff' : '#fff',
                        border:
                          selectedType === type
                            ? '1px solid #005ea8'
                            : '1px solid #e2e8f0',
                      }}
                    >
                      <span>{document?.title ?? type}</span>
                      <span>
                        {document &&
                        ['READY', 'APPROVED', 'VERIFIED'].includes(
                          document.status,
                        )
                          ? '●'
                          : '○'}
                      </span>
                    </Button>
                  );
                })}
              </Box>
            ))}
          </Grid>
          <Grid item xs={12} md={6} style={{ padding: 20 }}>
            {current ? (
              <>
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  label="설계서 제목"
                  value={current.title}
                  onChange={event =>
                    updateCurrent({ title: event.target.value })
                  }
                />
                <FormControl
                  variant="outlined"
                  size="small"
                  fullWidth
                  style={{ marginTop: 12 }}
                >
                  <InputLabel>설계 상태</InputLabel>
                  <Select
                    value={current.status}
                    label="설계 상태"
                    onChange={event =>
                      updateCurrent({ status: String(event.target.value) })
                    }
                  >
                    <MenuItem value="DRAFT">초안</MenuItem>
                    <MenuItem value="READY">개발 준비</MenuItem>
                    <MenuItem value="IN_REVIEW">검토 중</MenuItem>
                    <MenuItem value="APPROVED">승인</MenuItem>
                    <MenuItem value="VERIFIED">검증 완료</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  multiline
                  minRows={16}
                  variant="outlined"
                  label="설계 내용"
                  placeholder="목적, 액터, 선행조건, 입력, 처리 규칙, 출력, 예외, 완료 조건과 연결 화면을 구조적으로 기록합니다."
                  value={current.content}
                  onChange={event =>
                    updateCurrent({ content: event.target.value })
                  }
                  style={{ marginTop: 12 }}
                />
                <Typography variant="caption" color="textSecondary">
                  버전 {current.revision} · {current.updatedBy ?? '미저장'} ·{' '}
                  {current.updatedAt ?? '-'} · {current.content.length}자
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="textSecondary">
                {busy
                  ? '설계 문서를 불러오는 중입니다.'
                  : '설계 문서를 선택하세요.'}
              </Typography>
            )}
          </Grid>
          <Grid
            item
            xs={12}
            md={3}
            style={{ padding: 16, background: '#f8fafc' }}
          >
            <Typography variant="h6">현재 설계 문맥</Typography>
            <Typography variant="body2" style={{ marginTop: 12 }}>
              프로세스: {displayValue(process?.processName)} ({processCode})
            </Typography>
            <Typography variant="body2" style={{ marginTop: 8 }}>
              단계: {displayValue(step?.stepName)} ({stepCode})
            </Typography>
            <Typography variant="body2" style={{ marginTop: 8 }}>
              액터: {displayValue(step?.actorCode)}
            </Typography>
            <Typography variant="body2" style={{ marginTop: 8 }}>
              화면: {routePath || '연결 필요'}
            </Typography>
            <Box mt={3} display="grid" gridGap={8}>
              <Button
                variant="outlined"
                onClick={() => onOpenTab('data-contracts')}
              >
                페이지·컬럼 설계
              </Button>
              <Button
                variant="outlined"
                onClick={() => onOpenTab('design-assets')}
              >
                테마·섹션·컴포넌트
              </Button>
              <Button
                variant="outlined"
                onClick={() => onOpenTab('test-scenarios')}
              >
                테스트 시나리오
              </Button>
              <Button
                variant="outlined"
                onClick={() => onOpenTab('generation-queue')}
              >
                개발 태스크
              </Button>
            </Box>
            <Box
              mt={3}
              p={2}
              style={{ border: '1px solid #f59e0b', background: '#fffbeb' }}
            >
              <Typography variant="caption">
                18종 설계서와 화면·API·테스트·태스크 증적이 일치해야 개발 완료로
                판정합니다.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginRight: 'auto' }}
        >
          {message || '설계 변경은 버전으로 보존됩니다.'}
        </Typography>
        <Button onClick={onClose}>닫기</Button>
        <Button
          variant="contained"
          color="primary"
          disabled={busy || !current}
          onClick={() => void save()}
        >
          {busy ? '처리 중…' : '저장·버전 생성'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type ProcessStepDraft = {
  processCode: string;
  stepOrder: string;
  stepCode: string;
  stepName: string;
  parentStepCode: string;
  stepType: string;
  actorCode: string;
  fromState: string;
  commandCode: string;
  toState: string;
  completionRule: string;
  requirementText: string;
  inputContract: string;
  outputContract: string;
  requiresUserPage: string;
  requiresAdminPage: string;
  requiresApi: string;
  requiresDatabase: string;
  requiresNotification: string;
  userPath: string;
  adminPath: string;
  apiContract: string;
  slaHours: string;
  escalationActorCode: string;
  evidenceRequired: string;
  evidenceTypes: string;
  segregationActorCodes: string;
  rollbackCommandCode: string;
  decisionRule: string;
};

const emptyProcessStep = (processCode = ''): ProcessStepDraft => ({
  processCode,
  stepOrder: '1',
  stepCode: '',
  stepName: '',
  parentStepCode: '',
  stepType: 'TASK',
  actorCode: '',
  fromState: 'DRAFT',
  commandCode: '',
  toState: 'COMPLETED',
  completionRule: '',
  requirementText: '',
  inputContract: '{}',
  outputContract: '{}',
  requiresUserPage: 'false',
  requiresAdminPage: 'false',
  requiresApi: 'false',
  requiresDatabase: 'false',
  requiresNotification: 'false',
  userPath: '',
  adminPath: '',
  apiContract: '',
  slaHours: '0',
  escalationActorCode: '',
  evidenceRequired: 'true',
  evidenceTypes: '',
  segregationActorCodes: '',
  rollbackCommandCode: '',
  decisionRule: '',
});

function ProcessStepWorkspace({
  steps,
  processes,
  actors,
  pending,
  result,
  onSave,
  onOpenFlow,
}: {
  steps: RuntimeRow[];
  processes: RuntimeRow[];
  actors: RuntimeRow[];
  pending: boolean;
  result: string;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onOpenFlow: () => void;
}) {
  const initialProcess = String(processes[0]?.processCode ?? '');
  const [processCode, setProcessCode] = useState(initialProcess);
  const [selectedCode, setSelectedCode] = useState('');
  const [draft, setDraft] = useState<ProcessStepDraft>(
    emptyProcessStep(initialProcess),
  );
  useEffect(() => {
    if (!processCode && processes.length) {
      const first = String(processes[0].processCode ?? '');
      setProcessCode(first);
      setDraft(emptyProcessStep(first));
    }
  }, [processCode, processes]);
  const processSteps = steps.filter(
    row => String(row.processCode ?? '') === processCode,
  );
  const sortedSteps = [...processSteps].sort(
    (a, b) => Number(a.stepOrder ?? 0) - Number(b.stepOrder ?? 0),
  );
  const missingContracts = processSteps.filter(
    row =>
      !String(row.completionRule ?? '').trim() ||
      !String(row.inputContract ?? '').trim() ||
      !String(row.outputContract ?? '').trim(),
  ).length;
  const update = (field: keyof ProcessStepDraft, value: string) =>
    setDraft(current => ({ ...current, [field]: value }));
  const changeProcess = (value: string) => {
    setProcessCode(value);
    setSelectedCode('');
    setDraft(emptyProcessStep(value));
  };
  const selectStep = (row: RuntimeRow) => {
    const boolText = (value: unknown, fallback = false) =>
      String(value ?? fallback);
    const code = String(row.stepCode ?? '');
    setSelectedCode(code);
    setDraft({
      processCode: String(row.processCode ?? processCode),
      stepOrder: String(row.stepOrder ?? '1'),
      stepCode: code,
      stepName: String(row.stepName ?? ''),
      parentStepCode: String(row.parentStepCode ?? ''),
      stepType: String(row.stepType ?? 'TASK'),
      actorCode: String(row.actorCode ?? ''),
      fromState: String(row.fromState ?? ''),
      commandCode: String(row.commandCode ?? ''),
      toState: String(row.toState ?? ''),
      completionRule: String(row.completionRule ?? ''),
      requirementText: String(row.requirementText ?? ''),
      inputContract: String(row.inputContract ?? '{}'),
      outputContract: String(row.outputContract ?? '{}'),
      requiresUserPage: boolText(row.requiresUserPage),
      requiresAdminPage: boolText(row.requiresAdminPage),
      requiresApi: boolText(row.requiresApi),
      requiresDatabase: boolText(row.requiresDatabase),
      requiresNotification: boolText(row.requiresNotification),
      userPath: String(row.userPath ?? ''),
      adminPath: String(row.adminPath ?? ''),
      apiContract: String(row.apiContract ?? ''),
      slaHours: String(row.slaHours ?? '0'),
      escalationActorCode: String(row.escalationActorCode ?? ''),
      evidenceRequired: boolText(row.evidenceRequired, true),
      evidenceTypes: String(row.evidenceTypes ?? ''),
      segregationActorCodes: String(row.segregationActorCodes ?? ''),
      rollbackCommandCode: String(row.rollbackCommandCode ?? ''),
      decisionRule: String(row.decisionRule ?? ''),
    });
  };
  const newStep = () => {
    setSelectedCode('');
    setDraft(
      emptyProcessStep(processCode || String(processes[0]?.processCode ?? '')),
    );
  };
  const requiredMissing = [
    draft.processCode,
    draft.stepCode,
    draft.stepName,
    draft.actorCode,
    draft.fromState,
    draft.commandCode,
    draft.toState,
    draft.completionRule,
  ].some(value => !value.trim());
  const invalidInput = !draft.inputContract.trim().startsWith('{');
  const invalidOutput = !draft.outputContract.trim().startsWith('{');
  const pageContractMissing = Boolean(
    (draft.requiresUserPage === 'true' && !draft.userPath.trim()) ||
      (draft.requiresAdminPage === 'true' && !draft.adminPath.trim()) ||
      (draft.requiresApi === 'true' && !draft.apiContract.trim()),
  );
  const booleanFields: Array<[keyof ProcessStepDraft, string]> = [
    ['requiresUserPage', '사용자 화면'],
    ['requiresAdminPage', '관리자 화면'],
    ['requiresApi', 'API'],
    ['requiresDatabase', 'DB'],
    ['requiresNotification', '알림'],
    ['evidenceRequired', '증적 필수'],
  ];

  return (
    <Box mt={3}>
      <Grid container spacing={2}>
        {[
          ['전체 단계', steps.length],
          ['선택 프로세스 단계', processSteps.length],
          ['계약 보완 필요', missingContracts],
          [
            '자동화 준비',
            processSteps.filter(
              row => String(row.automationStatus) !== 'PLANNED',
            ).length,
          ],
        ].map(([label, value]) => (
          <Grid item xs={6} md={3} key={String(label)}>
            <Paper variant="outlined" style={{ padding: 16, height: '100%' }}>
              <Typography variant="caption" color="textSecondary">
                {label}
              </Typography>
              <Typography variant="h5">{value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Box mt={2}>
        <TextField
          fullWidth
          select
          size="small"
          variant="outlined"
          label="설계할 프로세스"
          value={processCode}
          onChange={event => changeProcess(String(event.target.value))}
        >
          {processes.map(row => (
            <MenuItem
              key={String(row.processCode)}
              value={String(row.processCode)}
            >
              {displayValue(row.processName)} ({displayValue(row.processCode)})
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Grid container spacing={2} style={{ marginTop: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" style={{ padding: 16, height: '100%' }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="h6">단계 실행 순서</Typography>
              <Button size="small" onClick={newStep}>
                신규 단계
              </Button>
            </Box>
            <Box
              mt={1.5}
              display="grid"
              gridGap={8}
              style={{ maxHeight: 900, overflowY: 'auto' }}
            >
              {sortedSteps.map(row => {
                const code = String(row.stepCode ?? '');
                return (
                  <Box
                    key={code}
                    p={1.5}
                    onClick={() => selectStep(row)}
                    style={{
                      cursor: 'pointer',
                      border: '1px solid #dbe4ea',
                      borderRadius: 8,
                      background: selectedCode === code ? '#e8f2ff' : '#fff',
                    }}
                  >
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      gridGap={8}
                    >
                      <Typography variant="body2" style={{ fontWeight: 700 }}>
                        {displayValue(row.stepOrder)}.{' '}
                        {displayValue(row.stepName)}
                      </Typography>
                      <Chip size="small" label={displayValue(row.stepType)} />
                    </Box>
                    <Typography variant="caption" color="textSecondary">
                      {displayValue(row.actorCode)} ·{' '}
                      {displayValue(row.fromState)} →{' '}
                      {displayValue(row.toState)}
                    </Typography>
                  </Box>
                );
              })}
              {!sortedSteps.length && (
                <Typography variant="body2" color="textSecondary">
                  등록된 단계가 없습니다.
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper variant="outlined" style={{ padding: 20 }}>
            <Typography variant="overline">
              STATE TRANSITION & EXECUTION CONTRACT
            </Typography>
            <Typography variant="h6">단계·상태 전이 전문 설계</Typography>
            <form
              onSubmit={event => {
                event.preventDefault();
                if (
                  requiredMissing ||
                  invalidInput ||
                  invalidOutput ||
                  pageContractMissing
                )
                  return;
                const values: Record<string, unknown> = {
                  ...draft,
                  stepOrder: Number(draft.stepOrder),
                  slaHours: Number(draft.slaHours),
                };
                booleanFields.forEach(([field]) => {
                  values[field] = draft[field] === 'true';
                });
                void onSave(values);
              }}
            >
              <Grid container spacing={2} style={{ marginTop: 4 }}>
                <Grid item xs={6} md={3}>
                  <TextField
                    fullWidth
                    required
                    type="number"
                    size="small"
                    variant="outlined"
                    label="단계 순서"
                    inputProps={{ min: 1 }}
                    value={draft.stepOrder}
                    onChange={event => update('stepOrder', event.target.value)}
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    fullWidth
                    required
                    disabled={Boolean(selectedCode)}
                    size="small"
                    variant="outlined"
                    label="단계 코드"
                    value={draft.stepCode}
                    onChange={event =>
                      update('stepCode', event.target.value.toUpperCase())
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    size="small"
                    variant="outlined"
                    label="단계명"
                    value={draft.stepName}
                    onChange={event => update('stepName', event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    variant="outlined"
                    label="단계 유형"
                    value={draft.stepType}
                    onChange={event =>
                      update('stepType', String(event.target.value))
                    }
                  >
                    {[
                      'TASK',
                      'DECISION',
                      'APPROVAL',
                      'SYSTEM',
                      'MILESTONE',
                    ].map(value => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    select
                    size="small"
                    variant="outlined"
                    label="담당 액터"
                    value={draft.actorCode}
                    onChange={event =>
                      update('actorCode', String(event.target.value))
                    }
                  >
                    {actors
                      .filter(row => String(row.useAt ?? 'Y') === 'Y')
                      .map(row => (
                        <MenuItem
                          key={String(row.actorCode)}
                          value={String(row.actorCode)}
                        >
                          {displayValue(row.actorName)} (
                          {displayValue(row.actorCode)})
                        </MenuItem>
                      ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    variant="outlined"
                    label="상위 단계"
                    value={draft.parentStepCode}
                    onChange={event =>
                      update('parentStepCode', String(event.target.value))
                    }
                  >
                    <MenuItem value="">없음</MenuItem>
                    {sortedSteps
                      .filter(row => String(row.stepCode) !== draft.stepCode)
                      .map(row => (
                        <MenuItem
                          key={String(row.stepCode)}
                          value={String(row.stepCode)}
                        >
                          {displayValue(row.stepName)}
                        </MenuItem>
                      ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    size="small"
                    variant="outlined"
                    label="시작 상태"
                    value={draft.fromState}
                    onChange={event =>
                      update('fromState', event.target.value.toUpperCase())
                    }
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    size="small"
                    variant="outlined"
                    label="실행 명령"
                    value={draft.commandCode}
                    onChange={event =>
                      update('commandCode', event.target.value.toUpperCase())
                    }
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    size="small"
                    variant="outlined"
                    label="완료 상태"
                    value={draft.toState}
                    onChange={event =>
                      update('toState', event.target.value.toUpperCase())
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={2}
                    size="small"
                    variant="outlined"
                    label="완료 조건"
                    value={draft.completionRule}
                    onChange={event =>
                      update('completionRule', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    variant="outlined"
                    label="업무 요구사항"
                    value={draft.requirementText}
                    onChange={event =>
                      update('requirementText', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={4}
                    size="small"
                    variant="outlined"
                    label="입력 데이터 계약(JSON)"
                    error={invalidInput}
                    value={draft.inputContract}
                    onChange={event =>
                      update('inputContract', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={4}
                    size="small"
                    variant="outlined"
                    label="출력 데이터 계약(JSON)"
                    error={invalidOutput}
                    value={draft.outputContract}
                    onChange={event =>
                      update('outputContract', event.target.value)
                    }
                  />
                </Grid>
                {booleanFields.map(([field, label]) => (
                  <Grid item xs={6} md={2} key={field}>
                    <TextField
                      fullWidth
                      select
                      size="small"
                      variant="outlined"
                      label={label}
                      value={draft[field]}
                      onChange={event =>
                        update(field, String(event.target.value))
                      }
                    >
                      <MenuItem value="true">필요</MenuItem>
                      <MenuItem value="false">불필요</MenuItem>
                    </TextField>
                  </Grid>
                ))}
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    label="사용자 화면 경로"
                    error={draft.requiresUserPage === 'true' && !draft.userPath}
                    value={draft.userPath}
                    onChange={event => update('userPath', event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    label="관리자 화면 경로"
                    error={
                      draft.requiresAdminPage === 'true' && !draft.adminPath
                    }
                    value={draft.adminPath}
                    onChange={event => update('adminPath', event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    label="API 계약"
                    error={draft.requiresApi === 'true' && !draft.apiContract}
                    value={draft.apiContract}
                    onChange={event =>
                      update('apiContract', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    size="small"
                    variant="outlined"
                    label="SLA(시간)"
                    inputProps={{ min: 0 }}
                    value={draft.slaHours}
                    onChange={event => update('slaHours', event.target.value)}
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    variant="outlined"
                    label="에스컬레이션 액터"
                    value={draft.escalationActorCode}
                    onChange={event =>
                      update('escalationActorCode', String(event.target.value))
                    }
                  >
                    <MenuItem value="">없음</MenuItem>
                    {actors
                      .filter(row => String(row.useAt ?? 'Y') === 'Y')
                      .map(row => (
                        <MenuItem
                          key={String(row.actorCode)}
                          value={String(row.actorCode)}
                        >
                          {displayValue(row.actorName)}
                        </MenuItem>
                      ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    label="필수 증적 유형"
                    value={draft.evidenceTypes}
                    onChange={event =>
                      update('evidenceTypes', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    label="직무분리 액터 코드"
                    value={draft.segregationActorCodes}
                    onChange={event =>
                      update('segregationActorCodes', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    label="롤백 명령"
                    value={draft.rollbackCommandCode}
                    onChange={event =>
                      update(
                        'rollbackCommandCode',
                        event.target.value.toUpperCase(),
                      )
                    }
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    variant="outlined"
                    label="의사결정·분기 규칙"
                    value={draft.decisionRule}
                    onChange={event =>
                      update('decisionRule', event.target.value)
                    }
                  />
                </Grid>
              </Grid>
              {pageContractMissing && (
                <Typography
                  variant="body2"
                  color="error"
                  style={{ marginTop: 8 }}
                >
                  필요로 표시한 화면·API의 경로 계약을 입력하세요.
                </Typography>
              )}
              <Box mt={2} display="flex" gridGap={8} flexWrap="wrap">
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={
                    pending ||
                    requiredMissing ||
                    invalidInput ||
                    invalidOutput ||
                    pageContractMissing
                  }
                >
                  {pending
                    ? '저장 중…'
                    : selectedCode
                    ? '단계 갱신'
                    : '단계 등록'}
                </Button>
                <Button variant="outlined" onClick={onOpenFlow}>
                  화면 흐름 연결
                </Button>
              </Box>
            </form>
            {result && (
              <Box
                component="pre"
                mt={2}
                p={2}
                style={{
                  whiteSpace: 'pre-wrap',
                  background: '#eef5fa',
                  fontSize: 12,
                }}
              >
                {result}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

type ProcessDefinitionDraft = {
  processCode: string;
  processName: string;
  domainCode: string;
  version: string;
  parentProcessCode: string;
  processLevel: string;
  automationMode: string;
  developmentOrder: string;
  prerequisiteCodes: string;
  goal: string;
  startCondition: string;
  completionCondition: string;
  processStatus: string;
  ownerActorCode: string;
  riskLevel: string;
  slaHours: string;
  reviewCycleDays: string;
  regulationRefs: string;
  lifecycleStatus: string;
  effectiveFrom: string;
  effectiveUntil: string;
};

const emptyProcessDefinition = (): ProcessDefinitionDraft => ({
  processCode: '',
  processName: '',
  domainCode: '',
  version: '1.0.0',
  parentProcessCode: '',
  processLevel: '1',
  automationMode: 'ASSISTED',
  developmentOrder: '0',
  prerequisiteCodes: '',
  goal: '',
  startCondition: '',
  completionCondition: '',
  processStatus: 'DRAFT',
  ownerActorCode: '',
  riskLevel: 'MEDIUM',
  slaHours: '0',
  reviewCycleDays: '365',
  regulationRefs: '',
  lifecycleStatus: 'DRAFT',
  effectiveFrom: '',
  effectiveUntil: '',
});

function ProcessDefinitionWorkspace({
  processes,
  actors,
  workTypes,
  pending,
  result,
  onSave,
  onOpenSteps,
}: {
  processes: RuntimeRow[];
  actors: RuntimeRow[];
  workTypes: RuntimeRow[];
  pending: boolean;
  result: string;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onOpenSteps: () => void;
}) {
  const [draft, setDraft] = useState<ProcessDefinitionDraft>(
    emptyProcessDefinition,
  );
  const [selectedCode, setSelectedCode] = useState('');
  const [search, setSearch] = useState('');
  const visibleProcesses = processes.filter(row =>
    JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  );
  const activeCount = processes.filter(
    row => String(row.status ?? '') === 'ACTIVE',
  ).length;
  const stepCount = processes.reduce(
    (sum, row) => sum + Number(row.stepCount ?? 0),
    0,
  );
  const blockedCount = processes.filter(
    row =>
      Number(row.approvedCaseCount ?? 0) < Number(row.caseCount ?? 0) ||
      Number(row.verifiedArtifactCount ?? 0) < Number(row.artifactCount ?? 0),
  ).length;
  const update = (field: keyof ProcessDefinitionDraft, value: string) =>
    setDraft(current => ({ ...current, [field]: value }));
  const selectProcess = (row: RuntimeRow) => {
    const processCode = String(row.processCode ?? '');
    setSelectedCode(processCode);
    setDraft({
      processCode,
      processName: String(row.processName ?? ''),
      domainCode: String(row.domainCode ?? ''),
      version: String(row.version ?? '1.0.0'),
      parentProcessCode: String(row.parentProcessCode ?? ''),
      processLevel: String(row.processLevel ?? '1'),
      automationMode: String(row.automationMode ?? 'ASSISTED'),
      developmentOrder: String(row.developmentOrder ?? '0'),
      prerequisiteCodes: String(row.prerequisiteCodes ?? ''),
      goal: String(row.goal ?? ''),
      startCondition: String(row.startCondition ?? ''),
      completionCondition: String(row.completionCondition ?? ''),
      processStatus: String(row.status ?? 'DRAFT'),
      ownerActorCode: String(row.ownerActorCode ?? ''),
      riskLevel: String(row.riskLevel ?? 'MEDIUM'),
      slaHours: String(row.slaHours ?? '0'),
      reviewCycleDays: String(row.reviewCycleDays ?? '365'),
      regulationRefs: String(row.regulationRefs ?? ''),
      lifecycleStatus: String(row.lifecycleStatus ?? 'DRAFT'),
      effectiveFrom: String(row.effectiveFrom ?? '').slice(0, 10),
      effectiveUntil: String(row.effectiveUntil ?? '').slice(0, 10),
    });
  };
  const reset = () => {
    setSelectedCode('');
    setDraft(emptyProcessDefinition());
  };
  const requiredMissing = [
    draft.processCode,
    draft.processName,
    draft.domainCode,
    draft.goal,
    draft.startCondition,
    draft.completionCondition,
    draft.ownerActorCode,
  ].some(value => !value.trim());
  const invalidDates = Boolean(
    draft.effectiveFrom &&
      draft.effectiveUntil &&
      draft.effectiveFrom > draft.effectiveUntil,
  );

  return (
    <Box mt={3}>
      <Grid container spacing={2}>
        {[
          ['등록 프로세스', processes.length],
          ['활성 프로세스', activeCount],
          ['전체 단계', stepCount],
          ['검증 보완 필요', blockedCount],
        ].map(([label, value]) => (
          <Grid item xs={6} md={3} key={String(label)}>
            <Paper variant="outlined" style={{ padding: 16, height: '100%' }}>
              <Typography variant="caption" color="textSecondary">
                {label}
              </Typography>
              <Typography variant="h5">{value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} style={{ marginTop: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" style={{ padding: 16, height: '100%' }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="h6">프로세스 사전</Typography>
              <Button size="small" onClick={reset}>
                신규
              </Button>
            </Box>
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              label="프로세스 검색"
              value={search}
              onChange={event => setSearch(event.target.value)}
              style={{ marginTop: 12 }}
            />
            <Box
              mt={1.5}
              display="grid"
              gridGap={8}
              style={{ maxHeight: 760, overflowY: 'auto' }}
            >
              {visibleProcesses.map(row => {
                const code = String(row.processCode ?? '');
                return (
                  <Box
                    key={code}
                    p={1.5}
                    onClick={() => selectProcess(row)}
                    style={{
                      cursor: 'pointer',
                      border: '1px solid #dbe4ea',
                      borderRadius: 8,
                      background: selectedCode === code ? '#e8f2ff' : '#fff',
                    }}
                  >
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      gridGap={8}
                    >
                      <Box>
                        <Typography variant="body2" style={{ fontWeight: 700 }}>
                          {displayValue(row.processName)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {code} · {displayValue(row.domainCode)}
                        </Typography>
                      </Box>
                      <Chip size="small" label={displayValue(row.status)} />
                    </Box>
                    <Typography variant="caption" color="textSecondary">
                      단계 {Number(row.stepCount ?? 0)} · 테스트{' '}
                      {Number(row.caseCount ?? 0)} · 증적{' '}
                      {Number(row.verifiedArtifactCount ?? 0)}/
                      {Number(row.artifactCount ?? 0)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper variant="outlined" style={{ padding: 20 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gridGap={8}
            >
              <Box>
                <Typography variant="overline">
                  PROCESS GOVERNANCE CONTRACT
                </Typography>
                <Typography variant="h6">
                  프로세스 정의·수명주기 설계
                </Typography>
              </Box>
              {selectedCode && <Chip label={selectedCode} color="primary" />}
            </Box>
            <form
              onSubmit={event => {
                event.preventDefault();
                if (requiredMissing || invalidDates) return;
                void onSave({
                  ...draft,
                  processLevel: Number(draft.processLevel),
                  developmentOrder: Number(draft.developmentOrder),
                  slaHours: Number(draft.slaHours),
                  reviewCycleDays: Number(draft.reviewCycleDays),
                });
              }}
            >
              <Grid container spacing={2} style={{ marginTop: 4 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    disabled={Boolean(selectedCode)}
                    size="small"
                    variant="outlined"
                    label="프로세스 코드"
                    value={draft.processCode}
                    onChange={event =>
                      update('processCode', event.target.value.toUpperCase())
                    }
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    size="small"
                    variant="outlined"
                    label="프로세스명"
                    value={draft.processName}
                    onChange={event =>
                      update('processName', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    select
                    size="small"
                    variant="outlined"
                    label="업무 종류"
                    value={draft.domainCode}
                    onChange={event =>
                      update('domainCode', String(event.target.value))
                    }
                  >
                    {workTypes.map(row => (
                      <MenuItem
                        key={String(row.workTypeCode)}
                        value={String(row.workTypeCode)}
                      >
                        {displayValue(row.workTypeName)} (
                        {displayValue(row.workTypeCode)})
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    select
                    size="small"
                    variant="outlined"
                    label="책임 액터"
                    value={draft.ownerActorCode}
                    onChange={event =>
                      update('ownerActorCode', String(event.target.value))
                    }
                  >
                    {actors
                      .filter(row => String(row.useAt ?? 'Y') === 'Y')
                      .map(row => (
                        <MenuItem
                          key={String(row.actorCode)}
                          value={String(row.actorCode)}
                        >
                          {displayValue(row.actorName)} (
                          {displayValue(row.actorCode)})
                        </MenuItem>
                      ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    variant="outlined"
                    label="상위 프로세스"
                    value={draft.parentProcessCode}
                    onChange={event =>
                      update('parentProcessCode', String(event.target.value))
                    }
                  >
                    <MenuItem value="">없음</MenuItem>
                    {processes
                      .filter(
                        row => String(row.processCode) !== draft.processCode,
                      )
                      .map(row => (
                        <MenuItem
                          key={String(row.processCode)}
                          value={String(row.processCode)}
                        >
                          {displayValue(row.processName)}
                        </MenuItem>
                      ))}
                  </TextField>
                </Grid>
                <Grid item xs={6} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    variant="outlined"
                    label="프로세스 레벨"
                    inputProps={{ min: 1 }}
                    value={draft.processLevel}
                    onChange={event =>
                      update('processLevel', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    variant="outlined"
                    label="개발 순서"
                    inputProps={{ min: 0 }}
                    value={draft.developmentOrder}
                    onChange={event =>
                      update('developmentOrder', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    label="버전"
                    value={draft.version}
                    onChange={event => update('version', event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    variant="outlined"
                    label="상태"
                    value={draft.processStatus}
                    onChange={event =>
                      update('processStatus', String(event.target.value))
                    }
                  >
                    {[
                      'DRAFT',
                      'DEVELOPMENT_READY',
                      'IN_DEVELOPMENT',
                      'ACTIVE',
                      'SUSPENDED',
                      'RETIRED',
                    ].map(value => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    variant="outlined"
                    label="자동화 방식"
                    value={draft.automationMode}
                    onChange={event =>
                      update('automationMode', String(event.target.value))
                    }
                  >
                    {['MANUAL', 'ASSISTED', 'AUTOMATED'].map(value => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={2}
                    size="small"
                    variant="outlined"
                    label="업무 목표"
                    value={draft.goal}
                    onChange={event => update('goal', event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={2}
                    size="small"
                    variant="outlined"
                    label="시작 조건"
                    value={draft.startCondition}
                    onChange={event =>
                      update('startCondition', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={2}
                    size="small"
                    variant="outlined"
                    label="완료 조건"
                    value={draft.completionCondition}
                    onChange={event =>
                      update('completionCondition', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    variant="outlined"
                    label="선행 프로세스 코드"
                    helperText="쉼표로 구분"
                    value={draft.prerequisiteCodes}
                    onChange={event =>
                      update('prerequisiteCodes', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    variant="outlined"
                    label="관련 법령·기준"
                    value={draft.regulationRefs}
                    onChange={event =>
                      update('regulationRefs', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    variant="outlined"
                    label="위험 수준"
                    value={draft.riskLevel}
                    onChange={event =>
                      update('riskLevel', String(event.target.value))
                    }
                  >
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(value => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    size="small"
                    variant="outlined"
                    label="SLA(시간)"
                    inputProps={{ min: 0 }}
                    value={draft.slaHours}
                    onChange={event => update('slaHours', event.target.value)}
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    size="small"
                    variant="outlined"
                    label="정기 검토 주기(일)"
                    inputProps={{ min: 1 }}
                    value={draft.reviewCycleDays}
                    onChange={event =>
                      update('reviewCycleDays', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    variant="outlined"
                    label="수명주기"
                    value={draft.lifecycleStatus}
                    onChange={event =>
                      update('lifecycleStatus', String(event.target.value))
                    }
                  >
                    {[
                      'DRAFT',
                      'DESIGN',
                      'VALIDATED',
                      'PROMOTED',
                      'ACTIVE',
                      'DEPRECATED',
                      'RETIRED',
                    ].map(value => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    size="small"
                    variant="outlined"
                    label="적용 시작일"
                    InputLabelProps={{ shrink: true }}
                    value={draft.effectiveFrom}
                    onChange={event =>
                      update('effectiveFrom', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    size="small"
                    variant="outlined"
                    label="적용 종료일"
                    InputLabelProps={{ shrink: true }}
                    error={invalidDates}
                    helperText={
                      invalidDates
                        ? '종료일은 시작일보다 빠를 수 없습니다.'
                        : ''
                    }
                    value={draft.effectiveUntil}
                    onChange={event =>
                      update('effectiveUntil', event.target.value)
                    }
                  />
                </Grid>
              </Grid>
              <Box
                mt={2}
                display="flex"
                alignItems="center"
                gridGap={8}
                flexWrap="wrap"
              >
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={pending || requiredMissing || invalidDates}
                >
                  {pending
                    ? '저장 중…'
                    : selectedCode
                    ? '프로세스 갱신'
                    : '프로세스 등록'}
                </Button>
                <Button variant="outlined" onClick={onOpenSteps}>
                  단계·상태 전이 열기
                </Button>
              </Box>
            </form>
            {result && (
              <Box
                component="pre"
                mt={2}
                p={2}
                style={{
                  whiteSpace: 'pre-wrap',
                  background: '#eef5fa',
                  fontSize: 12,
                }}
              >
                {result}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

type ActorPolicyDraft = {
  actorCode: string;
  actorName: string;
  actorNameEn: string;
  actorType: string;
  purpose: string;
  capabilityCodes: string;
  responsibility: string;
  accountability: string;
  competency: string;
  conflictActorCodes: string;
  maxConcurrentAssignments: string;
  reviewCycleDays: string;
  delegationAllowed: string;
  useAt: string;
};

const emptyActorPolicy = (): ActorPolicyDraft => ({
  actorCode: '',
  actorName: '',
  actorNameEn: '',
  actorType: 'BUSINESS',
  purpose: '',
  capabilityCodes: '',
  responsibility: '',
  accountability: '',
  competency: '',
  conflictActorCodes: '',
  maxConcurrentAssignments: '0',
  reviewCycleDays: '365',
  delegationAllowed: 'false',
  useAt: 'Y',
});

function ActorPolicyWorkspace({
  actors,
  assignments,
  steps,
  pending,
  result,
  onSave,
  onOpenAssignments,
}: {
  actors: RuntimeRow[];
  assignments: RuntimeRow[];
  steps: RuntimeRow[];
  pending: boolean;
  result: string;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onOpenAssignments: () => void;
}) {
  const [draft, setDraft] = useState<ActorPolicyDraft>(emptyActorPolicy);
  const [selectedCode, setSelectedCode] = useState('');
  const [search, setSearch] = useState('');
  const activeActors = actors.filter(
    actor => String(actor.useAt ?? 'Y') === 'Y',
  );
  const activeAssignments = assignments.filter(assignment => {
    const validUntil = String(assignment.validUntil ?? '');
    return (
      String(assignment.status ?? 'ACTIVE') === 'ACTIVE' &&
      (!validUntil || validUntil >= new Date().toISOString().slice(0, 10))
    );
  });
  const assignedCodes = new Set(
    activeAssignments.map(row => String(row.actorCode ?? '')),
  );
  const unassigned = activeActors.filter(
    actor => !assignedCodes.has(String(actor.actorCode ?? '')),
  ).length;
  const visibleActors = actors.filter(actor =>
    JSON.stringify(actor).toLowerCase().includes(search.toLowerCase()),
  );
  const selected = actors.find(
    actor => String(actor.actorCode ?? '') === selectedCode,
  );
  const selectedAssignments = activeAssignments.filter(
    row => String(row.actorCode ?? '') === selectedCode,
  );
  const selectedSteps = steps.filter(
    row => String(row.actorCode ?? '') === selectedCode,
  );
  const update = (field: keyof ActorPolicyDraft, value: string) =>
    setDraft(current => ({ ...current, [field]: value }));
  const selectActor = (actor: RuntimeRow) => {
    const actorCode = String(actor.actorCode ?? '');
    setSelectedCode(actorCode);
    setDraft({
      actorCode,
      actorName: String(actor.actorName ?? ''),
      actorNameEn: String(actor.actorNameEn ?? ''),
      actorType: String(actor.actorType ?? 'BUSINESS'),
      purpose: String(actor.purpose ?? ''),
      capabilityCodes: String(actor.capabilityCodes ?? ''),
      responsibility: String(actor.responsibility ?? ''),
      accountability: String(actor.accountability ?? ''),
      competency: String(actor.competency ?? ''),
      conflictActorCodes: String(actor.conflictActorCodes ?? ''),
      maxConcurrentAssignments: String(actor.maxConcurrentAssignments ?? '0'),
      reviewCycleDays: String(actor.reviewCycleDays ?? '365'),
      delegationAllowed: String(actor.delegationAllowed ?? false),
      useAt: String(actor.useAt ?? 'Y'),
    });
  };
  const reset = () => {
    setSelectedCode('');
    setDraft(emptyActorPolicy());
  };
  const activeDeactivationBlocked =
    draft.useAt === 'N' && selectedAssignments.length > 0;
  const requiredMissing = [
    draft.actorCode,
    draft.actorName,
    draft.purpose,
    draft.responsibility,
    draft.accountability,
    draft.competency,
  ].some(value => !value.trim());
  let saveLabel = selectedCode ? '액터 갱신' : '액터 등록';
  if (pending) saveLabel = '저장 중…';

  return (
    <Box mt={3}>
      <Grid container spacing={2}>
        {[
          ['등록 액터', actors.length],
          ['활성 액터', activeActors.length],
          ['활성 배정', activeAssignments.length],
          ['미배정 액터', unassigned],
        ].map(([label, value]) => (
          <Grid item xs={6} md={3} key={String(label)}>
            <Paper variant="outlined" style={{ padding: 16, height: '100%' }}>
              <Typography variant="caption" color="textSecondary">
                {label}
              </Typography>
              <Typography variant="h5">{value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} style={{ marginTop: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" style={{ padding: 16, height: '100%' }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="h6">액터 사전</Typography>
              <Button size="small" onClick={reset}>
                신규
              </Button>
            </Box>
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              label="액터 검색"
              value={search}
              onChange={event => setSearch(event.target.value)}
              style={{ marginTop: 12 }}
            />
            <Box
              mt={1.5}
              display="grid"
              gridGap={8}
              style={{ maxHeight: 680, overflowY: 'auto' }}
            >
              {visibleActors.map(actor => {
                const actorCode = String(actor.actorCode ?? '');
                const assignmentCount = activeAssignments.filter(
                  row => String(row.actorCode ?? '') === actorCode,
                ).length;
                const stepCount = steps.filter(
                  row => String(row.actorCode ?? '') === actorCode,
                ).length;
                return (
                  <Box
                    key={actorCode}
                    p={1.5}
                    onClick={() => selectActor(actor)}
                    style={{
                      cursor: 'pointer',
                      border: '1px solid #dbe4ea',
                      borderRadius: 8,
                      background:
                        selectedCode === actorCode ? '#e8f2ff' : '#fff',
                    }}
                  >
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      gridGap={8}
                    >
                      <Box>
                        <Typography variant="body2" style={{ fontWeight: 700 }}>
                          {displayValue(actor.actorName)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {actorCode} · {displayValue(actor.actorType)}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={
                          String(actor.useAt ?? 'Y') === 'Y'
                            ? 'primary'
                            : 'default'
                        }
                        label={
                          String(actor.useAt ?? 'Y') === 'Y' ? '활성' : '비활성'
                        }
                      />
                    </Box>
                    <Typography variant="caption" color="textSecondary">
                      계정 {assignmentCount} · 프로세스 단계 {stepCount}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper variant="outlined" style={{ padding: 20 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gridGap={8}
            >
              <Box>
                <Typography variant="overline">
                  ACTOR RESPONSIBILITY & POLICY
                </Typography>
                <Typography variant="h6">액터 책임·권한 설계</Typography>
              </Box>
              {selected && (
                <Chip
                  label={`${selectedAssignments.length}개 계정 배정 · ${selectedSteps.length}개 단계 사용`}
                />
              )}
            </Box>
            <form
              onSubmit={event => {
                event.preventDefault();
                if (!requiredMissing && !activeDeactivationBlocked)
                  void onSave({
                    ...draft,
                    delegationAllowed: draft.delegationAllowed === 'true',
                    maxConcurrentAssignments: Number(
                      draft.maxConcurrentAssignments,
                    ),
                    reviewCycleDays: Number(draft.reviewCycleDays),
                  });
              }}
            >
              <Grid container spacing={2} style={{ marginTop: 4 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    disabled={Boolean(selectedCode)}
                    size="small"
                    variant="outlined"
                    label="액터 코드"
                    helperText="영문 대문자·숫자·밑줄"
                    value={draft.actorCode}
                    onChange={event =>
                      update('actorCode', event.target.value.toUpperCase())
                    }
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    size="small"
                    variant="outlined"
                    label="액터명"
                    value={draft.actorName}
                    onChange={event => update('actorName', event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    label="영문명"
                    value={draft.actorNameEn}
                    onChange={event =>
                      update('actorNameEn', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small" variant="outlined">
                    <InputLabel>액터 유형</InputLabel>
                    <Select
                      label="액터 유형"
                      value={draft.actorType}
                      onChange={event =>
                        update('actorType', String(event.target.value))
                      }
                    >
                      {[
                        'BUSINESS',
                        'REVIEW',
                        'APPROVAL',
                        'OPERATION',
                        'AUDIT',
                        'EXTERNAL',
                        'SYSTEM',
                      ].map(value => (
                        <MenuItem key={value} value={value}>
                          {value}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small" variant="outlined">
                    <InputLabel>위임 허용</InputLabel>
                    <Select
                      label="위임 허용"
                      value={draft.delegationAllowed}
                      onChange={event =>
                        update('delegationAllowed', String(event.target.value))
                      }
                    >
                      <MenuItem value="true">허용</MenuItem>
                      <MenuItem value="false">불가</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small" variant="outlined">
                    <InputLabel>사용 상태</InputLabel>
                    <Select
                      label="사용 상태"
                      value={draft.useAt}
                      onChange={event =>
                        update('useAt', String(event.target.value))
                      }
                    >
                      <MenuItem value="Y">활성</MenuItem>
                      <MenuItem value="N">비활성</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={2}
                    size="small"
                    variant="outlined"
                    label="업무 목적"
                    value={draft.purpose}
                    onChange={event => update('purpose', event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={3}
                    size="small"
                    variant="outlined"
                    label="수행 책임(Responsibility)"
                    value={draft.responsibility}
                    onChange={event =>
                      update('responsibility', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={3}
                    size="small"
                    variant="outlined"
                    label="최종 책무(Accountability)"
                    value={draft.accountability}
                    onChange={event =>
                      update('accountability', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={2}
                    size="small"
                    variant="outlined"
                    label="필수 역량·자격"
                    value={draft.competency}
                    onChange={event => update('competency', event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    variant="outlined"
                    label="명령·역량 코드"
                    helperText="쉼표로 구분"
                    value={draft.capabilityCodes}
                    onChange={event =>
                      update('capabilityCodes', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    label="충돌 액터 코드"
                    helperText="동시 보유 금지 역할"
                    value={draft.conflictActorCodes}
                    onChange={event =>
                      update('conflictActorCodes', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    variant="outlined"
                    label="동시 배정 한도"
                    inputProps={{ min: 0 }}
                    value={draft.maxConcurrentAssignments}
                    onChange={event =>
                      update('maxConcurrentAssignments', event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    variant="outlined"
                    label="정기 검토 주기(일)"
                    inputProps={{ min: 1 }}
                    value={draft.reviewCycleDays}
                    onChange={event =>
                      update('reviewCycleDays', event.target.value)
                    }
                  />
                </Grid>
              </Grid>
              {activeDeactivationBlocked && (
                <Box
                  mt={2}
                  p={1.5}
                  style={{ background: '#fff1f2', border: '1px solid #fda4af' }}
                >
                  <Typography variant="body2">
                    활성 계정 배정 {selectedAssignments.length}건을 먼저
                    해제해야 액터를 비활성화할 수 있습니다.
                  </Typography>
                </Box>
              )}
              <Box
                mt={2}
                display="flex"
                alignItems="center"
                gridGap={8}
                flexWrap="wrap"
              >
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={
                    pending || requiredMissing || activeDeactivationBlocked
                  }
                >
                  {saveLabel}
                </Button>
                <Button variant="outlined" onClick={onOpenAssignments}>
                  계정·액터 배정 열기
                </Button>
              </Box>
            </form>
            {result && (
              <Box
                component="pre"
                mt={2}
                p={2}
                style={{
                  whiteSpace: 'pre-wrap',
                  background: '#eef5fa',
                  fontSize: 12,
                }}
              >
                {result}
              </Box>
            )}
          </Paper>

          {selected && (
            <Grid container spacing={2} style={{ marginTop: 4 }}>
              <Grid item xs={12} md={6}>
                <Paper
                  variant="outlined"
                  style={{ padding: 16, height: '100%' }}
                >
                  <Typography variant="subtitle2">
                    계정·프로젝트 배정
                  </Typography>
                  <Box mt={1} display="grid" gridGap={6}>
                    {selectedAssignments.slice(0, 12).map(row => (
                      <Box
                        key={String(row.assignmentId)}
                        display="flex"
                        justifyContent="space-between"
                      >
                        <Typography variant="body2">
                          {displayValue(row.accountId)}
                        </Typography>
                        <Typography variant="caption">
                          {displayValue(row.projectId)} ·{' '}
                          {displayValue(row.dataScope)}
                        </Typography>
                      </Box>
                    ))}
                    {selectedAssignments.length === 0 && (
                      <Typography variant="body2" color="textSecondary">
                        활성 배정이 없습니다.
                      </Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper
                  variant="outlined"
                  style={{ padding: 16, height: '100%' }}
                >
                  <Typography variant="subtitle2">
                    프로세스 단계 사용처
                  </Typography>
                  <Box mt={1} display="grid" gridGap={6}>
                    {selectedSteps.slice(0, 12).map(row => (
                      <Box key={`${row.processCode}-${row.stepCode}`}>
                        <Typography variant="body2">
                          {displayValue(row.stepName)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {displayValue(row.processCode)} ·{' '}
                          {displayValue(row.fromState)} →{' '}
                          {displayValue(row.toState)}
                        </Typography>
                      </Box>
                    ))}
                    {selectedSteps.length === 0 && (
                      <Typography variant="body2" color="textSecondary">
                        연결된 프로세스 단계가 없습니다.
                      </Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

type ActorAssignmentDraft = {
  accountId: string;
  tenantId: string;
  projectId: string;
  actorCode: string;
  dataScope: string;
  validUntil: string;
};

const emptyActorAssignment = (projectId: string): ActorAssignmentDraft => ({
  accountId: '',
  tenantId: 'DEFAULT',
  projectId: projectId || '*',
  actorCode: '',
  dataScope: '*',
  validUntil: '',
});

function ActorAssignmentWorkspace({
  rows,
  actors,
  projects,
  projectId,
  pending,
  result,
  onCommand,
}: {
  rows: RuntimeRow[];
  actors: RuntimeRow[];
  projects: ProjectOption[];
  projectId: string;
  pending: boolean;
  result: string;
  onCommand: (
    command: 'assignment.save' | 'assignment.deactivate',
    values: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ActorAssignmentDraft>(() =>
    emptyActorAssignment(projectId),
  );
  const [selectedId, setSelectedId] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const activeRows = rows.filter(row => {
    const validUntil = String(row.validUntil ?? '');
    return (
      String(row.status ?? 'ACTIVE') === 'ACTIVE' &&
      (!validUntil || validUntil >= today)
    );
  });
  const expiredRows = rows.filter(row => {
    const validUntil = String(row.validUntil ?? '');
    return Boolean(validUntil && validUntil < today);
  });
  const accountCount = new Set(rows.map(row => String(row.accountId ?? '')))
    .size;
  const projectCoverage = new Set(
    activeRows
      .map(row => String(row.projectId ?? ''))
      .filter(value => value && value !== '*'),
  ).size;
  const duplicate = rows.find(
    row =>
      String(row.assignmentId ?? '') !== selectedId &&
      String(row.accountId ?? '') === draft.accountId.trim() &&
      String(row.tenantId ?? 'DEFAULT') === draft.tenantId.trim() &&
      String(row.projectId ?? '*') === draft.projectId &&
      String(row.actorCode ?? '') === draft.actorCode,
  );
  const selected = rows.find(
    row => String(row.assignmentId ?? '') === selectedId,
  );
  let submitLabel = '배정 저장';
  if (selectedId) submitLabel = '배정 갱신';
  if (pending) submitLabel = '처리 중…';
  const selectRow = (row: RuntimeRow) => {
    setSelectedId(String(row.assignmentId ?? ''));
    setDraft({
      accountId: String(row.accountId ?? ''),
      tenantId: String(row.tenantId ?? 'DEFAULT'),
      projectId: String(row.projectId ?? '*'),
      actorCode: String(row.actorCode ?? ''),
      dataScope: String(row.dataScope ?? '*'),
      validUntil: String(row.validUntil ?? ''),
    });
  };
  const update = (field: keyof ActorAssignmentDraft, value: string) =>
    setDraft(current => ({ ...current, [field]: value }));
  const reset = () => {
    setSelectedId('');
    setDraft(emptyActorAssignment(projectId));
  };

  return (
    <Box mt={3}>
      <Grid container spacing={2}>
        {[
          ['배정 계정', accountCount],
          ['유효 배정', activeRows.length],
          ['프로젝트 적용', projectCoverage],
          ['만료 확인', expiredRows.length],
        ].map(([label, value]) => (
          <Grid item xs={6} md={3} key={String(label)}>
            <Paper variant="outlined" style={{ padding: 16, height: '100%' }}>
              <Typography variant="caption" color="textSecondary">
                {label}
              </Typography>
              <Typography variant="h5">{value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined" style={{ padding: 20, marginTop: 16 }}>
        <Box display="flex" justifyContent="space-between" flexWrap="wrap">
          <Box>
            <Typography variant="h6">계정별 업무 액터·데이터 범위</Typography>
            <Typography variant="body2" color="textSecondary">
              한 계정에 여러 액터를 배정할 수 있으며, 프로젝트와 유효기간까지
              서버에서 검증합니다.
            </Typography>
          </Box>
          <Button onClick={reset}>신규 배정</Button>
        </Box>
        <form
          onSubmit={event => {
            event.preventDefault();
            if (!duplicate) void onCommand('assignment.save', draft);
          }}
        >
          <Grid container spacing={2} style={{ marginTop: 4 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                size="small"
                variant="outlined"
                label="계정 ID"
                value={draft.accountId}
                onChange={event => update('accountId', event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                size="small"
                variant="outlined"
                label="테넌트 ID"
                value={draft.tenantId}
                onChange={event => update('tenantId', event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" variant="outlined">
                <InputLabel>프로젝트 범위</InputLabel>
                <Select
                  label="프로젝트 범위"
                  value={draft.projectId}
                  onChange={event =>
                    update('projectId', String(event.target.value))
                  }
                >
                  <MenuItem value="*">전체 프로젝트(*)</MenuItem>
                  {projects.map(project => (
                    <MenuItem key={project.projectId} value={project.projectId}>
                      {project.projectName} · {project.projectId}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required size="small" variant="outlined">
                <InputLabel>액터</InputLabel>
                <Select
                  label="액터"
                  value={draft.actorCode}
                  onChange={event =>
                    update('actorCode', String(event.target.value))
                  }
                >
                  {actors.map(actor => (
                    <MenuItem
                      key={String(actor.actorCode)}
                      value={String(actor.actorCode)}
                    >
                      {displayValue(actor.actorName)} ·{' '}
                      {displayValue(actor.actorCode)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                size="small"
                variant="outlined"
                label="데이터 범위"
                helperText="* 또는 조직·사업장·데이터 범위 코드"
                value={draft.dataScope}
                onChange={event => update('dataScope', event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                label="유효 종료일"
                type="date"
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: today }}
                value={draft.validUntil}
                onChange={event => update('validUntil', event.target.value)}
              />
            </Grid>
          </Grid>
          {duplicate && (
            <Box
              mt={2}
              p={1.5}
              style={{ background: '#fff7ed', border: '1px solid #fdba74' }}
            >
              <Typography variant="body2">
                같은 계정·테넌트·프로젝트·액터 배정이 이미 존재합니다. 목록에서
                해당 행을 선택해 수정하세요.
              </Typography>
            </Box>
          )}
          <Box mt={2} display="flex" gridGap={8} flexWrap="wrap">
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={pending || Boolean(duplicate)}
            >
              {submitLabel}
            </Button>
            {selected && String(selected.status ?? 'ACTIVE') === 'ACTIVE' && (
              <Button
                variant="outlined"
                color="secondary"
                disabled={pending}
                onClick={() =>
                  void onCommand('assignment.deactivate', {
                    assignmentId: selected.assignmentId,
                  })
                }
              >
                배정 비활성화
              </Button>
            )}
          </Box>
        </form>
        {result && (
          <Box
            component="pre"
            mt={2}
            p={2}
            style={{
              whiteSpace: 'pre-wrap',
              background: '#eef5fa',
              fontSize: 12,
            }}
          >
            {result}
          </Box>
        )}
      </Paper>

      <Box
        mt={2}
        style={{
          overflowX: 'auto',
          border: '1px solid #dbe4ea',
          borderRadius: 8,
        }}
      >
        <table
          style={{
            width: '100%',
            minWidth: 900,
            borderCollapse: 'collapse',
            fontSize: 13,
          }}
        >
          <thead style={{ background: '#f1f5f9' }}>
            <tr>
              {[
                '계정',
                '테넌트',
                '프로젝트',
                '액터',
                '데이터 범위',
                '유효기간',
                '상태',
              ].map(label => (
                <th key={label} style={{ padding: 12, textAlign: 'left' }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const validUntil = String(row.validUntil ?? '');
              const expired = Boolean(validUntil && validUntil < today);
              const active =
                String(row.status ?? 'ACTIVE') === 'ACTIVE' && !expired;
              let statusLabel = '비활성';
              if (active) statusLabel = '활성';
              if (expired) statusLabel = '만료';
              const actor = actors.find(
                item => String(item.actorCode) === String(row.actorCode),
              );
              return (
                <tr
                  key={String(row.assignmentId)}
                  onClick={() => selectRow(row)}
                  style={{
                    cursor: 'pointer',
                    background:
                      String(row.assignmentId) === selectedId
                        ? '#e8f2ff'
                        : undefined,
                  }}
                >
                  {[
                    row.accountId,
                    row.tenantId,
                    row.projectId,
                    actor?.actorName ?? row.actorCode,
                    row.dataScope,
                  ].map((value, index) => (
                    <td
                      key={index}
                      style={{ padding: 12, borderTop: '1px solid #e2e8f0' }}
                    >
                      {displayValue(value)}
                    </td>
                  ))}
                  <td style={{ padding: 12, borderTop: '1px solid #e2e8f0' }}>
                    {validUntil || '제한 없음'}
                  </td>
                  <td style={{ padding: 12, borderTop: '1px solid #e2e8f0' }}>
                    <Chip
                      size="small"
                      color={active ? 'primary' : 'default'}
                      label={statusLabel}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <Box p={3}>
            <Typography color="textSecondary">
              등록된 배정이 없습니다.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function CompletionDevelopmentWorkspace({
  dashboard,
  projectId,
  onRetry,
  onOpenTab,
}: {
  dashboard: RuntimeDashboard;
  projectId: string;
  onRetry: (jobId: string) => Promise<Record<string, unknown>>;
  onOpenTab: (tabId: string) => void;
}) {
  const progressRows = (dashboard.processDevelopmentProgress ??
    []) as RuntimeRow[];
  const jobs = (dashboard.developmentJobs ?? []) as RuntimeRow[];
  const gates = (dashboard.qualityGateResults ?? []) as RuntimeRow[];
  const gaps = (dashboard.customerJourneyGaps ?? []) as RuntimeRow[];
  const artifacts = (dashboard.artifacts ?? []) as RuntimeRow[];
  const runs = (dashboard.projectCompletionRuns ?? []) as RuntimeRow[];
  const [selectedProcess, setSelectedProcess] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [retryingJob, setRetryingJob] = useState('');
  const [message, setMessage] = useState('');

  const summaries = progressRows.map(row => {
    const processCode = String(row.processCode ?? '');
    const requiredJobs = Number(row.requiredJobs ?? 0);
    const verifiedJobs = Number(row.verifiedJobs ?? 0);
    const failedJobs = Number(row.failedJobs ?? 0);
    const processGaps = gaps.filter(
      gap => String(gap.objectCode ?? '') === processCode,
    );
    const blockers = processGaps.filter(
      gap => gap.severity === 'BLOCKER',
    ).length;
    const processJobs = jobs.filter(
      job => String(job.processCode ?? '') === processCode,
    );
    const requiredArtifacts = artifacts.filter(
      artifact =>
        String(artifact.processCode ?? '') === processCode &&
        artifact.required !== false,
    );
    const verifiedArtifacts = requiredArtifacts.filter(artifact =>
      ['VERIFIED', 'PROMOTED', 'COMPLETED'].includes(
        String(artifact.deliveryStatus ?? artifact.status ?? ''),
      ),
    ).length;
    const complete =
      requiredJobs > 0 &&
      verifiedJobs >= requiredJobs &&
      failedJobs === 0 &&
      blockers === 0 &&
      verifiedArtifacts >= requiredArtifacts.length;
    let status = 'PLANNED';
    if (
      verifiedJobs > 0 ||
      processJobs.some(job => job.jobStatus === 'RUNNING')
    )
      status = 'RUNNING';
    if (failedJobs > 0 || blockers > 0) status = 'BLOCKED';
    if (complete) status = 'VERIFIED';
    return {
      ...row,
      processCode,
      requiredJobs,
      verifiedJobs,
      failedJobs,
      blockers,
      requiredArtifacts: requiredArtifacts.length,
      verifiedArtifacts,
      completionPercent: Number(row.completionPercent ?? 0),
      status,
      complete,
      processJobs,
      processGaps,
    };
  });
  const visible = summaries.filter(
    row => statusFilter === 'ALL' || row.status === statusFilter,
  );
  const selected =
    summaries.find(row => row.processCode === selectedProcess) ?? visible[0];
  const selectedJobs = selected?.processJobs ?? [];
  const latestRun = runs[0];
  const totalRequired = summaries.reduce(
    (total, row) => total + row.requiredJobs,
    0,
  );
  const totalVerified = summaries.reduce(
    (total, row) => total + row.verifiedJobs,
    0,
  );
  const totalFailed = summaries.reduce(
    (total, row) => total + row.failedJobs,
    0,
  );
  const totalBlockers = summaries.reduce(
    (total, row) => total + row.blockers,
    0,
  );
  const completionPercent =
    totalRequired === 0 ? 0 : Math.round((totalVerified / totalRequired) * 100);
  let completionMessage = '필수 개발 게이트를 통과했습니다.';
  if (totalVerified < totalRequired) {
    completionMessage = '검증되지 않은 필수 작업이 남아 있습니다.';
  }
  if (totalFailed > 0 || totalBlockers > 0) {
    completionMessage = '실패 작업과 차단 이슈를 먼저 해결해야 합니다.';
  }
  if (totalRequired === 0) {
    completionMessage = '필수 개발 작업이 생성되지 않아 완료할 수 없습니다.';
  }

  const retry = async (jobId: string) => {
    setRetryingJob(jobId);
    setMessage('');
    try {
      await onRetry(jobId);
      setMessage(`개발 작업 ${jobId}을 안전 재시도 큐에 등록했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRetryingJob('');
    }
  };

  const statusColor = (status: string): 'primary' | 'secondary' | 'default' => {
    if (status === 'VERIFIED') return 'primary';
    if (status === 'BLOCKED') return 'secondary';
    return 'default';
  };

  return (
    <Box mt={3}>
      <Box
        p={2}
        style={{
          border: '1px solid #bfdbfe',
          borderRadius: 10,
          background: '#f8fbff',
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gridGap={12}
        >
          <Box>
            <Typography variant="overline">
              PROJECT COMPLETION CONTROL
            </Typography>
            <Typography variant="h6">{projectId} 완료·개발 게이트</Typography>
            <Typography variant="body2" color="textSecondary">
              필수 작업·품질·증적·차단 조건이 모두 충족될 때만 완료로
              판정합니다.
            </Typography>
          </Box>
          <Box minWidth={220}>
            <Typography variant="caption">
              전체 개발 완성도 {completionPercent}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(completionPercent, 100)}
              style={{ height: 9, borderRadius: 8, marginTop: 6 }}
            />
          </Box>
        </Box>
      </Box>

      <Grid container spacing={2} style={{ marginTop: 4 }}>
        {[
          [
            '검증 프로세스',
            summaries.filter(row => row.complete).length,
            `${summaries.length}개 중`,
          ],
          ['필수 작업', `${totalVerified}/${totalRequired}`, '검증 완료'],
          ['실패 작업', totalFailed, '재시도 필요'],
          ['차단 이슈', totalBlockers, '해결 전 완료 불가'],
        ].map(([label, value, note]) => (
          <Grid item xs={6} md={3} key={String(label)}>
            <Paper variant="outlined" style={{ padding: 16, height: '100%' }}>
              <Typography variant="caption" color="textSecondary">
                {label}
              </Typography>
              <Typography variant="h5">{value}</Typography>
              <Typography variant="caption" color="textSecondary">
                {note}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} style={{ marginTop: 4 }}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" style={{ padding: 18, height: '100%' }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gridGap={8}
            >
              <Box>
                <Typography variant="h6">프로세스별 완료 판정</Typography>
                <Typography variant="body2" color="textSecondary">
                  행을 선택하면 작업·게이트·증적과 실패 원인을 확인합니다.
                </Typography>
              </Box>
              <FormControl
                size="small"
                variant="outlined"
                style={{ minWidth: 150 }}
              >
                <InputLabel>상태</InputLabel>
                <Select
                  label="상태"
                  value={statusFilter}
                  onChange={event =>
                    setStatusFilter(String(event.target.value))
                  }
                >
                  {['ALL', 'PLANNED', 'RUNNING', 'BLOCKED', 'VERIFIED'].map(
                    status => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ),
                  )}
                </Select>
              </FormControl>
            </Box>
            <Box mt={2} style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: 650,
                  borderCollapse: 'collapse',
                  fontSize: 13,
                }}
              >
                <thead style={{ background: '#f1f5f9' }}>
                  <tr>
                    {[
                      '프로세스',
                      '필수 작업',
                      '증적',
                      '차단',
                      '완성도',
                      '판정',
                    ].map(label => (
                      <th
                        key={label}
                        style={{ padding: 10, textAlign: 'left' }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(row => (
                    <tr
                      key={row.processCode}
                      onClick={() => setSelectedProcess(row.processCode)}
                      style={{
                        cursor: 'pointer',
                        background:
                          selected?.processCode === row.processCode
                            ? '#e8f2ff'
                            : undefined,
                      }}
                    >
                      <td
                        style={{
                          padding: 10,
                          borderTop: '1px solid #e2e8f0',
                          fontWeight: 600,
                        }}
                      >
                        {row.processCode}
                      </td>
                      <td
                        style={{ padding: 10, borderTop: '1px solid #e2e8f0' }}
                      >
                        {row.verifiedJobs}/{row.requiredJobs}
                      </td>
                      <td
                        style={{ padding: 10, borderTop: '1px solid #e2e8f0' }}
                      >
                        {row.verifiedArtifacts}/{row.requiredArtifacts}
                      </td>
                      <td
                        style={{ padding: 10, borderTop: '1px solid #e2e8f0' }}
                      >
                        {row.blockers + row.failedJobs}
                      </td>
                      <td
                        style={{ padding: 10, borderTop: '1px solid #e2e8f0' }}
                      >
                        {displayValue(row.completionPercent)}%
                      </td>
                      <td
                        style={{ padding: 10, borderTop: '1px solid #e2e8f0' }}
                      >
                        <Chip
                          size="small"
                          color={statusColor(row.status)}
                          label={row.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length === 0 && (
                <Box p={3}>
                  <Typography color="textSecondary">
                    조건에 맞는 프로세스가 없습니다.
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper variant="outlined" style={{ padding: 18, height: '100%' }}>
            <Typography variant="h6">최근 자동 완료 실행</Typography>
            {latestRun ? (
              <Box mt={1} display="grid" gridGap={8}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">실행 상태</Typography>
                  <Chip
                    size="small"
                    label={displayValue(latestRun.runStatus)}
                  />
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">선택 프로세스</Typography>
                  <Typography variant="body2">
                    {displayValue(latestRun.selectedProcessCount)}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">완료/차단</Typography>
                  <Typography variant="body2">
                    {displayValue(latestRun.completedProcessCount)} /{' '}
                    {displayValue(latestRun.blockedProcessCount)}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">재시도 작업</Typography>
                  <Typography variant="body2">
                    {displayValue(latestRun.retriedJobCount)}
                  </Typography>
                </Box>
                <Typography variant="caption" color="textSecondary">
                  {displayValue(latestRun.startedAt)} →{' '}
                  {displayValue(latestRun.completedAt)}
                </Typography>
              </Box>
            ) : (
              <Typography
                variant="body2"
                color="textSecondary"
                style={{ marginTop: 12 }}
              >
                자동 완료 실행 이력이 없습니다.
              </Typography>
            )}
            <Box
              mt={2}
              p={1.5}
              style={{
                background:
                  totalRequired > 0 && totalFailed === 0 && totalBlockers === 0
                    ? '#ecfdf5'
                    : '#fff7ed',
              }}
            >
              <Typography variant="body2">{completionMessage}</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {selected && (
        <Paper variant="outlined" style={{ padding: 18, marginTop: 16 }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gridGap={8}
          >
            <Box>
              <Typography variant="overline">선택 프로세스</Typography>
              <Typography variant="h6">{selected.processCode}</Typography>
            </Box>
            <Box display="flex" gridGap={8} flexWrap="wrap">
              <Button
                size="small"
                variant="outlined"
                onClick={() => onOpenTab('generation-queue')}
              >
                작업 큐
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => onOpenTab('automated-tests')}
              >
                품질 게이트
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => onOpenTab('incidents')}
              >
                차단 이슈
              </Button>
            </Box>
          </Box>
          <Grid container spacing={2} style={{ marginTop: 2 }}>
            <Grid item xs={12} md={8}>
              <Typography variant="subtitle2">개발 작업</Typography>
              <Box mt={1} display="grid" gridGap={8}>
                {selectedJobs.slice(0, 20).map(job => {
                  const jobId = String(job.jobId ?? '');
                  const failed = ['FAILED', 'RETRY'].includes(
                    String(job.jobStatus ?? ''),
                  );
                  const latestGate = gates.find(
                    gate => String(gate.jobId ?? '') === jobId,
                  );
                  return (
                    <Box
                      key={jobId}
                      p={1.5}
                      style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}
                    >
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        gridGap={8}
                      >
                        <Box>
                          <Typography
                            variant="body2"
                            style={{ fontWeight: 600 }}
                          >
                            {displayValue(job.jobName)}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {displayValue(job.jobType)} ·{' '}
                            {displayValue(job.targetPath)}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gridGap={6}>
                          <Chip
                            size="small"
                            label={displayValue(job.jobStatus)}
                          />
                          {failed && (
                            <Button
                              size="small"
                              color="secondary"
                              disabled={retryingJob === jobId}
                              onClick={() => void retry(jobId)}
                            >
                              재시도
                            </Button>
                          )}
                        </Box>
                      </Box>
                      <Typography variant="caption" color="textSecondary">
                        게이트: {displayValue(latestGate?.result)} · 증적:{' '}
                        {displayValue(job.evidenceRef)} · 오류:{' '}
                        {displayValue(job.lastError)}
                      </Typography>
                    </Box>
                  );
                })}
                {selectedJobs.length === 0 && (
                  <Typography variant="body2" color="textSecondary">
                    필수 개발 작업이 아직 생성되지 않았습니다.
                  </Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2">차단·보완 사항</Typography>
              <Box mt={1} display="grid" gridGap={8}>
                {selected.processGaps.map((gap, index) => (
                  <Box
                    key={`${gap.objectCode}-${index}`}
                    p={1.5}
                    style={{
                      background:
                        gap.severity === 'BLOCKER' ? '#fff1f2' : '#fffbeb',
                      borderRadius: 8,
                    }}
                  >
                    <Typography variant="body2" style={{ fontWeight: 600 }}>
                      {displayValue(gap.reason)}
                    </Typography>
                    <Typography variant="caption">
                      {displayValue(gap.remediation)}
                    </Typography>
                  </Box>
                ))}
                {selected.processGaps.length === 0 && (
                  <Typography variant="body2" color="textSecondary">
                    등록된 차단 이슈가 없습니다.
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
          {message && (
            <Box mt={2} p={1.5} style={{ background: '#eef5fa' }}>
              <Typography variant="body2">{message}</Typography>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}

const useStyles = makeStyles(theme => ({
  context: {
    padding: theme.spacing(2.5),
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    marginBottom: theme.spacing(2),
  },
  workspace: {
    padding: theme.spacing(2),
    borderRadius: 10,
    border: '1px solid #dbe4ea',
    height: '100%',
    cursor: 'pointer',
  },
  active: {
    borderColor: '#005ea8',
    boxShadow: 'inset 4px 0 #005ea8',
    background: '#f0f7ff',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(250px,0.8fr) minmax(0,2.2fr)',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  tab: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    border: '1px solid #dbe4ea',
    borderRadius: 8,
    cursor: 'pointer',
  },
  selectedTab: { borderColor: '#005ea8', background: '#f0f7ff' },
  detail: {
    padding: theme.spacing(3),
    borderRadius: 12,
    border: '1px solid #dbe4ea',
  },
  metric: {
    padding: theme.spacing(2),
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
}));

const routeForWorkspace: Record<ActorProcessWorkspaceId, string> = {
  operate: '/system-operations',
  design: '/design-assets',
  verify: '/system-development',
  delivery: '/system-development',
};

export function ActorProcessControlPage(props: {
  initialWorkspaceId?: ActorProcessWorkspaceId;
}) {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const query = new URLSearchParams(window.location.search);
  const requestedWorkspace = query.get(
    'workspace',
  ) as ActorProcessWorkspaceId | null;
  const initialWorkspace: ActorProcessWorkspaceId =
    props.initialWorkspaceId ??
    (requestedWorkspace &&
    ACTOR_PROCESS_WORKSPACES.some(item => item.id === requestedWorkspace)
      ? requestedWorkspace
      : 'design');
  const [projects, setProjects] = useState<ProjectOption[]>(
    RESONANCE_PROJECT_REGISTRY,
  );
  const [projectId, setProjectId] = useState(
    query.get('projectId') ??
      RESONANCE_PROJECT_REGISTRY[0]?.projectId ??
      'CCUS-PLATFORM',
  );
  const [designVersion, setDesignVersion] = useState(1);
  const [release, setRelease] = useState<DesignRelease | null>(null);
  const [summary, setSummary] = useState<OperationsSummary>({});
  const [runtimeDashboard, setRuntimeDashboard] = useState<RuntimeDashboard>(
    {},
  );
  const [rowFilter, setRowFilter] = useState('');
  const [message, setMessage] = useState('');
  const [selectedRow, setSelectedRow] = useState<RuntimeRow | null>(null);
  const [commandPending, setCommandPending] = useState(false);
  const [commandResult, setCommandResult] = useState('');
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] =
    useState<ActorProcessWorkspaceId>(initialWorkspace);
  const [tabId, setTabId] = useState(
    query.get('tab') ??
      ACTOR_PROCESS_WORKSPACES.find(item => item.id === initialWorkspace)
        ?.tabs[0].id ??
      'actors',
  );
  const workspace =
    ACTOR_PROCESS_WORKSPACES.find(item => item.id === workspaceId) ??
    ACTOR_PROCESS_WORKSPACES[0];
  const selectedTab = useMemo<ActorProcessTab>(
    () => workspace.tabs.find(item => item.id === tabId) ?? workspace.tabs[0],
    [tabId, workspace],
  );
  const selectedProject =
    projects.find(item => item.projectId === projectId) ?? projects[0];
  const datasetKey = ACTOR_PROCESS_DATASET_BY_TAB[selectedTab.id];
  const activeCommand = TAB_COMMANDS[selectedTab.id];
  const sourceRows = Array.isArray(runtimeDashboard[datasetKey])
    ? (runtimeDashboard[datasetKey] as RuntimeRow[])
    : [];
  const visibleRows = sourceRows
    .filter(row =>
      JSON.stringify(row).toLowerCase().includes(rowFilter.toLowerCase()),
    )
    .slice(0, 100);
  const visibleColumns = [
    ...new Set(
      visibleRows
        .slice(0, 20)
        .flatMap(row => Object.keys(row))
        .filter(key => !/json|payload|content|description/i.test(key)),
    ),
  ].slice(0, 7);
  const tasks = selectedProject?.tasks ?? [];
  const completedTasks = tasks.filter(task =>
    ['COMPLETED', 'VERIFIED', 'PROMOTED'].includes(task.status),
  ).length;
  const taskProgress =
    tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);
  const developmentContractUrl = `/api/resonance-projects/${encodeURIComponent(
    projectId,
  )}/development-contract`;

  const loadReleases = async (targetProjectId: string) => {
    const response = await fetchApi.fetch(
      `/api/resonance-projects/${encodeURIComponent(
        targetProjectId,
      )}/design-releases`,
    );
    if (!response.ok) return;
    const payload = (await response.json()) as {
      releases?: DesignRelease[];
    };
    const latest = payload.releases?.[0] ?? null;
    setRelease(latest);
    if (latest) setDesignVersion(latest.designVersion);
  };

  const loadRuntimeDataset = useCallback(
    async (targetDatasetKey: string) => {
      const response = await fetchApi.fetch(
        `/api/resonance-projects/actor-process/runtime-dashboard?dataset=${encodeURIComponent(
          targetDatasetKey,
        )}`,
        { cache: 'no-store' },
      );
      if (!response.ok) {
        throw new Error(`Actor·Process runtime dataset ${response.status}`);
      }
      const payload = (await response.json()) as RuntimeDashboard;
      setRuntimeDashboard(current => ({ ...current, ...payload }));
    },
    [fetchApi],
  );
  const loadDesignDocuments = useCallback(
    async (processCode: string, stepCode: string, routePath: string) => {
      const parameters = new URLSearchParams({
        processCode,
        stepCode,
        routePath,
      });
      const response = await fetchApi.fetch(
        `/api/resonance-projects/actor-process/design-documents?${parameters}`,
        { cache: 'no-store' },
      );
      const payload = (await response.json()) as {
        message?: string;
        documents?: DesignDocument[];
      };
      if (!response.ok) {
        throw new Error(payload.message ?? '설계 문서 조회에 실패했습니다.');
      }
      return payload.documents ?? [];
    },
    [fetchApi],
  );
  const saveDesignDocument = useCallback(
    async (
      document: DesignDocument & {
        processCode: string;
        stepCode: string;
        routePath: string;
      },
    ) => {
      const response = await fetchApi.fetch(
        '/api/resonance-projects/actor-process/design-documents',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(document),
        },
      );
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? '설계 문서 저장에 실패했습니다.');
      }
    },
    [fetchApi],
  );
  const executeRuntimeCommand = useCallback(
    async (
      command: 'execution.validate' | 'execution.advance',
      executionId: string,
    ) => {
      const response = await fetchApi.fetch(
        '/api/resonance-projects/actor-process/commands',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            command,
            executionId,
            requireDraft: true,
          }),
        },
      );
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(
          String(payload.message ?? payload.error ?? `HTTP ${response.status}`),
        );
      }
      await loadRuntimeDataset('processExecutions');
      await loadRuntimeDataset('processExecutionEvents');
      return payload;
    },
    [fetchApi, loadRuntimeDataset],
  );
  const executeDevelopmentPipeline = useCallback(
    async (processCode: string, stepCode: string) => {
      const response = await fetchApi.fetch(
        '/api/resonance-projects/actor-process/commands',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            command: 'development.execute',
            processCode,
            stepCode,
            force: false,
          }),
        },
      );
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(
          String(payload.message ?? payload.error ?? `HTTP ${response.status}`),
        );
      }
      await Promise.all([
        loadRuntimeDataset('developmentJobs'),
        loadRuntimeDataset('artifacts'),
        loadRuntimeDataset('deliveryQueue'),
      ]);
      return payload;
    },
    [fetchApi, loadRuntimeDataset],
  );
  const retryDevelopmentJob = useCallback(
    async (jobId: string) => {
      const response = await fetchApi.fetch(
        '/api/resonance-projects/actor-process/commands',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            command: 'development.retry',
            jobId,
          }),
        },
      );
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(
          String(payload.message ?? payload.error ?? `HTTP ${response.status}`),
        );
      }
      await Promise.all([
        loadRuntimeDataset('developmentJobs'),
        loadRuntimeDataset('developmentEvents'),
        loadRuntimeDataset('qualityGateResults'),
      ]);
      return payload;
    },
    [fetchApi, loadRuntimeDataset],
  );
  const runRollbackCommand = useCallback(
    async (
      command: 'development.rollback.request' | 'development.rollback.approve',
      body: Record<string, unknown>,
    ) => {
      const response = await fetchApi.fetch(
        '/api/resonance-projects/actor-process/commands',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ command, ...body }),
        },
      );
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(
          String(payload.message ?? payload.error ?? `HTTP ${response.status}`),
        );
      }
      await Promise.all([
        loadRuntimeDataset('developmentJobs'),
        loadRuntimeDataset('developmentEvents'),
        loadRuntimeDataset('rollbackRequests'),
      ]);
      return payload;
    },
    [fetchApi, loadRuntimeDataset],
  );
  const requestDevelopmentRollback = useCallback(
    (jobId: string, reason: string) =>
      runRollbackCommand('development.rollback.request', { jobId, reason }),
    [runRollbackCommand],
  );
  const approveDevelopmentRollback = useCallback(
    (rollbackRequestId: string) =>
      runRollbackCommand('development.rollback.approve', {
        rollbackRequestId,
      }),
    [runRollbackCommand],
  );

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [projectResponse, summaryResponse, runtimeResponse] =
        await Promise.all([
          fetchApi.fetch('/api/resonance-projects'),
          fetchApi.fetch('/api/resonance-projects/operations/summary'),
          fetchApi.fetch(
            `/api/resonance-projects/actor-process/runtime-dashboard?dataset=${encodeURIComponent(
              datasetKey,
            )}`,
            { cache: 'no-store' },
          ),
        ]);
      if (projectResponse.ok) {
        const payload = (await projectResponse.json()) as {
          projects?: ProjectOption[];
        };
        const dynamic = payload.projects ?? [];
        setProjects([
          ...new Map(
            [...RESONANCE_PROJECT_REGISTRY, ...dynamic].map(project => [
              project.projectId,
              project,
            ]),
          ).values(),
        ] as ProjectOption[]);
      }
      if (summaryResponse.ok) {
        setSummary((await summaryResponse.json()) as OperationsSummary);
      }
      if (runtimeResponse.ok) {
        const payload = (await runtimeResponse.json()) as RuntimeDashboard;
        setRuntimeDashboard(current => ({ ...current, ...payload }));
      } else {
        throw new Error(
          `Actor·Process runtime dashboard ${runtimeResponse.status}`,
        );
      }
      await loadReleases(projectId);
    } catch {
      setMessage(
        'Actor·Process 운영 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    // projectId 변경 시 선택 프로젝트의 릴리스와 태스크를 다시 조회합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!datasetKey || runtimeDashboard[datasetKey] !== undefined) {
      return;
    }
    void loadRuntimeDataset(datasetKey).catch(() => {
      setMessage(
        '선택한 Actor·Process 운영 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.',
      );
    });
    // 선택 탭이 바뀔 때 필요한 데이터셋만 지연 조회합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetKey]);

  useEffect(() => {
    if (!['work-dashboard', 'execution'].includes(selectedTab.id)) return;
    const required = [
      'processes',
      'steps',
      'actors',
      'workTypes',
      'cases',
      'artifacts',
      'developmentJobs',
      'developmentEvents',
      'rollbackRequests',
      'qualityGateResults',
      'customerJourneyGaps',
      'processExecutions',
      'emissionProjectTasks',
    ];
    required
      .filter(key => runtimeDashboard[key] === undefined)
      .forEach(key => {
        void loadRuntimeDataset(key).catch(() => {
          setMessage(`업무 운영 지도 데이터(${key})를 불러오지 못했습니다.`);
        });
      });
    // 업무 운영 지도는 여러 원본 데이터셋을 조합하므로 필요한 것만 병렬 지연 조회합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab.id]);

  useEffect(() => {
    if (selectedTab.id !== 'assignments') return;
    ['actors', 'actorAccountReadiness']
      .filter(key => runtimeDashboard[key] === undefined)
      .forEach(key => {
        void loadRuntimeDataset(key).catch(() => {
          setMessage(`계정·액터 배정 데이터(${key})를 불러오지 못했습니다.`);
        });
      });
    // 계정·액터 전용 화면은 액터 사전과 계정 준비 상태를 함께 사용합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab.id]);

  useEffect(() => {
    if (selectedTab.id !== 'completion') return;
    [
      'processDevelopmentProgress',
      'developmentJobs',
      'qualityGateResults',
      'customerJourneyGaps',
      'artifacts',
    ]
      .filter(key => runtimeDashboard[key] === undefined)
      .forEach(key => {
        void loadRuntimeDataset(key).catch(() => {
          setMessage(`완료·개발 현황 데이터(${key})를 불러오지 못했습니다.`);
        });
      });
    // 완료 판정은 작업·품질·증적·차단 데이터 계약을 함께 검증합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab.id]);

  useEffect(() => {
    if (selectedTab.id !== 'actors') return;
    ['assignments', 'steps']
      .filter(key => runtimeDashboard[key] === undefined)
      .forEach(key => {
        void loadRuntimeDataset(key).catch(() => {
          setMessage(`액터·권한 설계 데이터(${key})를 불러오지 못했습니다.`);
        });
      });
    // 액터의 계정 배정과 실제 프로세스 사용처를 함께 검증합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab.id]);

  useEffect(() => {
    if (selectedTab.id !== 'processes') return;
    ['actors', 'workTypes']
      .filter(key => runtimeDashboard[key] === undefined)
      .forEach(key => {
        void loadRuntimeDataset(key).catch(() => {
          setMessage(`프로세스 설계 데이터(${key})를 불러오지 못했습니다.`);
        });
      });
    // 프로세스 정의는 활성 업무 종류와 책임 액터 계약을 함께 검증합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab.id]);

  useEffect(() => {
    if (selectedTab.id !== 'steps') return;
    ['processes', 'actors']
      .filter(key => runtimeDashboard[key] === undefined)
      .forEach(key => {
        void loadRuntimeDataset(key).catch(() => {
          setMessage(
            `단계·상태 전이 설계 데이터(${key})를 불러오지 못했습니다.`,
          );
        });
      });
    // 상태 전이 편집은 프로세스와 활성 액터 계약을 함께 검증합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab.id]);

  useEffect(() => {
    setSelectedRow(null);
    setCommandResult('');
  }, [selectedTab.id]);

  const executeTabCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeCommand || commandPending) return;
    setCommandPending(true);
    setCommandResult('');
    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());
    const body: Record<string, unknown> = {
      command: activeCommand.command,
      ...values,
    };
    activeCommand.fields
      .filter(field => field.type === 'number')
      .forEach(field => {
        const raw = body[field.name];
        if (raw !== '' && raw !== undefined) body[field.name] = Number(raw);
      });
    try {
      const response = await fetchApi.fetch(
        '/api/resonance-projects/actor-process/commands',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(
          String(payload.message ?? payload.error ?? `HTTP ${response.status}`),
        );
      }
      setCommandResult(`처리 완료\n${JSON.stringify(payload, null, 2)}`);
      await loadRuntimeDataset(datasetKey);
    } catch (error) {
      setCommandResult(
        `처리 실패\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setCommandPending(false);
    }
  };

  const executeAssignmentCommand = async (
    command: 'assignment.save' | 'assignment.deactivate',
    values: Record<string, unknown>,
  ) => {
    if (commandPending) return;
    setCommandPending(true);
    setCommandResult('');
    try {
      const response = await fetchApi.fetch(
        '/api/resonance-projects/actor-process/commands',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ command, ...values }),
        },
      );
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(
          String(payload.message ?? payload.error ?? `HTTP ${response.status}`),
        );
      }
      setCommandResult(`처리 완료\n${JSON.stringify(payload, null, 2)}`);
      await Promise.all([
        loadRuntimeDataset('assignments'),
        loadRuntimeDataset('actorAccountReadiness'),
      ]);
    } catch (error) {
      setCommandResult(
        `처리 실패\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setCommandPending(false);
    }
  };

  const executeActorCommand = async (values: Record<string, unknown>) => {
    if (commandPending) return;
    setCommandPending(true);
    setCommandResult('');
    try {
      const response = await fetchApi.fetch(
        '/api/resonance-projects/actor-process/commands',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ command: 'actor.save', ...values }),
        },
      );
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(
          String(payload.message ?? payload.error ?? `HTTP ${response.status}`),
        );
      }
      setCommandResult(`처리 완료\n${JSON.stringify(payload, null, 2)}`);
      await Promise.all([
        loadRuntimeDataset('actors'),
        loadRuntimeDataset('assignments'),
        loadRuntimeDataset('steps'),
      ]);
    } catch (error) {
      setCommandResult(
        `처리 실패\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setCommandPending(false);
    }
  };

  const executeProcessCommand = async (values: Record<string, unknown>) => {
    if (commandPending) return;
    setCommandPending(true);
    setCommandResult('');
    try {
      const response = await fetchApi.fetch(
        '/api/resonance-projects/actor-process/commands',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ command: 'process.save', ...values }),
        },
      );
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(
          String(payload.message ?? payload.error ?? `HTTP ${response.status}`),
        );
      }
      setCommandResult(`처리 완료\n${JSON.stringify(payload, null, 2)}`);
      await loadRuntimeDataset('processes');
    } catch (error) {
      setCommandResult(
        `처리 실패\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setCommandPending(false);
    }
  };

  const executeStepCommand = async (values: Record<string, unknown>) => {
    if (commandPending) return;
    setCommandPending(true);
    setCommandResult('');
    try {
      const response = await fetchApi.fetch(
        '/api/resonance-projects/actor-process/commands',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ command: 'step.save', ...values }),
        },
      );
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(
          String(payload.message ?? payload.error ?? `HTTP ${response.status}`),
        );
      }
      setCommandResult(`처리 완료\n${JSON.stringify(payload, null, 2)}`);
      await Promise.all([
        loadRuntimeDataset('steps'),
        loadRuntimeDataset('developmentJobs'),
      ]);
    } catch (error) {
      setCommandResult(
        `처리 실패\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setCommandPending(false);
    }
  };

  const saveDesignRelease = async () => {
    setMessage('설계 계약을 검증하고 저장하는 중입니다.');
    const contract = {
      schemaVersion: 2,
      projectId,
      tenantId: 'DEFAULT',
      designVersion,
      source: 'BACKSTAGE_ACTOR_PROCESS_CONTROL',
      sourceOfTruth: 'BACKSTAGE',
      contextFields: [
        'projectId',
        'tenantId',
        'designVersion',
        'actorCode',
        'processCode',
        'stepCode',
      ],
      workspaces: ACTOR_PROCESS_WORKSPACES,
      runtimeBinding: {
        designContract: developmentContractUrl,
        runtime: 'RESONANCE',
        generator:
          '/admin/api/system/actor-process/generation/compile-and-queue',
      },
    };
    const response = await fetchApi.fetch(
      `/api/resonance-projects/${encodeURIComponent(
        projectId,
      )}/design-releases`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ designVersion, contract }),
      },
    );
    const payload = (await response.json()) as {
      message?: string;
      validation?: { failures?: string[] };
    };
    if (!response.ok) {
      setMessage(
        payload.validation?.failures?.join(', ') ??
          payload.message ??
          '설계 저장에 실패했습니다.',
      );
      return;
    }
    setMessage('설계가 검증되어 Backstage에 저장되었습니다.');
    await loadReleases(projectId);
  };

  const promoteDesignRelease = async () => {
    setMessage('검증된 설계를 Resonance 개발 기준으로 승격하는 중입니다.');
    const response = await fetchApi.fetch(
      `/api/resonance-projects/${encodeURIComponent(
        projectId,
      )}/design-releases/${designVersion}/promote`,
      { method: 'POST' },
    );
    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      setMessage(payload.message ?? '설계 승격에 실패했습니다.');
      return;
    }
    setMessage(
      '승격 완료: Resonance는 이 Backstage 개발 계약을 기준으로 생성·검증합니다.',
    );
    await loadDashboard();
  };

  const selectWorkspace = (id: ActorProcessWorkspaceId) => {
    const next = ACTOR_PROCESS_WORKSPACES.find(item => item.id === id)!;
    setWorkspaceId(id);
    setTabId(next.tabs[0].id);
    window.history.replaceState(
      null,
      '',
      `${
        window.location.pathname
      }?workspace=${id}&projectId=${encodeURIComponent(projectId)}`,
    );
  };

  const openControlTab = (targetTabId: string) => {
    const targetWorkspace = ACTOR_PROCESS_WORKSPACES.find(item =>
      item.tabs.some(tab => tab.id === targetTabId),
    );
    if (!targetWorkspace) return;
    setWorkspaceId(targetWorkspace.id);
    setTabId(targetTabId);
    setRowFilter('');
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?workspace=${
        targetWorkspace.id
      }&tab=${targetTabId}&projectId=${encodeURIComponent(projectId)}`,
    );
  };

  return (
    <Page themeId="tool">
      <Header
        title="Actor·Process 프로젝트 제어"
        subtitle="Backstage를 업무 운영·설계·검증·개발·배포의 단일 기준으로 사용하고 Resonance 실행 환경을 제어합니다."
      />
      <Content>
        {loading && <LinearProgress />}
        <Paper className={classes.context} elevation={0}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl variant="outlined" size="small" fullWidth>
                <InputLabel>프로젝트</InputLabel>
                <Select
                  value={projectId}
                  label="프로젝트"
                  onChange={event => {
                    setProjectId(String(event.target.value));
                    setMessage('');
                  }}
                >
                  {projects.map(project => (
                    <MenuItem key={project.projectId} value={project.projectId}>
                      {project.projectName} ({project.projectId})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={8}>
              <Typography variant="subtitle1">
                {selectedProject?.projectName ?? projectId}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                projectId={projectId} · tenantId=DEFAULT · designVersion=
                {designVersion}
              </Typography>
              <Box mt={1} display="flex" gridGap={8} flexWrap="wrap">
                <Chip
                  size="small"
                  label={`설계 릴리스 ${release?.status ?? '미등록'}`}
                  color={release?.status === 'PROMOTED' ? 'primary' : 'default'}
                />
                <Chip size="small" label={`개발 태스크 ${tasks.length}개`} />
                <Chip size="small" label={`완료율 ${taskProgress}%`} />
                {release?.contractSha256 && (
                  <Chip
                    size="small"
                    label={`SHA-256 ${release.contractSha256.slice(0, 12)}`}
                  />
                )}
              </Box>
            </Grid>
          </Grid>
          <Box mt={2} display="flex" gridGap={8} flexWrap="wrap">
            <Button
              variant="outlined"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={saveDesignRelease}
            >
              설계 검증·저장
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<PublishIcon />}
              disabled={release?.status !== 'VALIDATED'}
              onClick={promoteDesignRelease}
            >
              Resonance 개발 기준으로 승격
            </Button>
            <Button
              variant="outlined"
              href={`${developmentContractUrl}?mode=preview`}
              target="_blank"
              rel="noreferrer"
            >
              개발 계약 JSON
            </Button>
          </Box>
          {message && (
            <Typography variant="body2" style={{ marginTop: 12 }}>
              {message}
            </Typography>
          )}
        </Paper>

        <Grid container spacing={2}>
          {ACTOR_PROCESS_WORKSPACES.map(item => (
            <Grid item xs={12} md={4} key={item.id}>
              <Paper
                className={`${classes.workspace} ${
                  item.id === workspace.id ? classes.active : ''
                }`}
                elevation={0}
                role="button"
                tabIndex={0}
                onClick={() => selectWorkspace(item.id)}
              >
                <Typography variant="overline">
                  {item.tabs.length}개 기능
                </Typography>
                <Typography variant="h6">{item.label}</Typography>
                <Typography variant="body2">{item.description}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box className={classes.layout} mt={2}>
          <Paper className={classes.detail} elevation={0}>
            <Typography variant="overline">
              원본 {ACTOR_PROCESS_SOURCE_TAB_COUNT}개 · 이관{' '}
              {ACTOR_PROCESS_TAB_COUNT}개
            </Typography>
            <Box display="flex" gridGap={8} mt={1} mb={1} flexWrap="wrap">
              <Chip
                size="small"
                color="primary"
                label={`UI 완전 복원 ${ACTOR_PROCESS_FULL_UI_COUNT}개`}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`UI 부분 복원 ${ACTOR_PROCESS_PARTIAL_UI_COUNT}개`}
              />
            </Box>
            <Typography variant="h6">{workspace.label}</Typography>
            <Box mt={2}>
              {workspace.tabs.map(item => (
                <Box
                  key={item.id}
                  className={`${classes.tab} ${
                    item.id === selectedTab.id ? classes.selectedTab : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setTabId(item.id);
                    setRowFilter('');
                    window.history.replaceState(
                      null,
                      '',
                      `${window.location.pathname}?workspace=${
                        workspace.id
                      }&tab=${item.id}&projectId=${encodeURIComponent(
                        projectId,
                      )}`,
                    );
                  }}
                >
                  <Typography variant="subtitle2">{item.label}</Typography>
                  <Typography variant="caption">
                    {item.capability} ·{' '}
                    {item.uiRestoration === 'FULL'
                      ? 'UI 완전 복원'
                      : 'UI 복원 필요'}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          <Paper className={classes.detail} elevation={0}>
            <Box display="flex" justifyContent="space-between" flexWrap="wrap">
              <Box>
                <Typography variant="overline">{workspace.label}</Typography>
                <Typography variant="h5">{selectedTab.label}</Typography>
              </Box>
              <Chip label={projectId} color="primary" />
            </Box>
            <Typography variant="body1" style={{ marginTop: 16 }}>
              {selectedTab.description}
            </Typography>
            {selectedTab.id === 'work-dashboard' && (
              <WorkOperationsMap
                dashboard={runtimeDashboard}
                projectId={projectId}
                onSelect={setSelectedRow}
                onOpenTab={openControlTab}
                executeRuntimeCommand={executeRuntimeCommand}
                executeDevelopmentPipeline={executeDevelopmentPipeline}
                retryDevelopmentJob={retryDevelopmentJob}
                requestDevelopmentRollback={requestDevelopmentRollback}
                approveDevelopmentRollback={approveDevelopmentRollback}
                loadDesignDocuments={loadDesignDocuments}
                saveDesignDocument={saveDesignDocument}
              />
            )}
            {selectedTab.id === 'execution' && (
              <WorkOperationsMap
                dashboard={runtimeDashboard}
                projectId={projectId}
                mode="execution"
                onSelect={setSelectedRow}
                onOpenTab={openControlTab}
                executeRuntimeCommand={executeRuntimeCommand}
                executeDevelopmentPipeline={executeDevelopmentPipeline}
                retryDevelopmentJob={retryDevelopmentJob}
                requestDevelopmentRollback={requestDevelopmentRollback}
                approveDevelopmentRollback={approveDevelopmentRollback}
                loadDesignDocuments={loadDesignDocuments}
                saveDesignDocument={saveDesignDocument}
              />
            )}
            {selectedTab.id === 'actors' && (
              <ActorPolicyWorkspace
                actors={sourceRows}
                assignments={
                  Array.isArray(runtimeDashboard.assignments)
                    ? (runtimeDashboard.assignments as RuntimeRow[])
                    : []
                }
                steps={
                  Array.isArray(runtimeDashboard.steps)
                    ? (runtimeDashboard.steps as RuntimeRow[])
                    : []
                }
                pending={commandPending}
                result={commandResult}
                onSave={executeActorCommand}
                onOpenAssignments={() => openControlTab('assignments')}
              />
            )}
            {selectedTab.id === 'processes' && (
              <ProcessDefinitionWorkspace
                processes={sourceRows}
                actors={
                  Array.isArray(runtimeDashboard.actors)
                    ? (runtimeDashboard.actors as RuntimeRow[])
                    : []
                }
                workTypes={
                  Array.isArray(runtimeDashboard.workTypes)
                    ? (runtimeDashboard.workTypes as RuntimeRow[])
                    : []
                }
                pending={commandPending}
                result={commandResult}
                onSave={executeProcessCommand}
                onOpenSteps={() => openControlTab('steps')}
              />
            )}
            {selectedTab.id === 'steps' && (
              <ProcessStepWorkspace
                steps={sourceRows}
                processes={
                  Array.isArray(runtimeDashboard.processes)
                    ? (runtimeDashboard.processes as RuntimeRow[])
                    : []
                }
                actors={
                  Array.isArray(runtimeDashboard.actors)
                    ? (runtimeDashboard.actors as RuntimeRow[])
                    : []
                }
                pending={commandPending}
                result={commandResult}
                onSave={executeStepCommand}
                onOpenFlow={() => openControlTab('screen-flow')}
              />
            )}
            {selectedTab.id === 'assignments' && (
              <ActorAssignmentWorkspace
                rows={sourceRows}
                actors={
                  Array.isArray(runtimeDashboard.actors)
                    ? (runtimeDashboard.actors as RuntimeRow[])
                    : []
                }
                projects={projects}
                projectId={projectId}
                pending={commandPending}
                result={commandResult}
                onCommand={executeAssignmentCommand}
              />
            )}
            {selectedTab.id === 'completion' && (
              <CompletionDevelopmentWorkspace
                dashboard={runtimeDashboard}
                projectId={projectId}
                onRetry={retryDevelopmentJob}
                onOpenTab={openControlTab}
              />
            )}
            {![
              'work-dashboard',
              'execution',
              'assignments',
              'completion',
              'actors',
              'processes',
              'steps',
            ].includes(selectedTab.id) && (
              <Grid container spacing={2} style={{ marginTop: 8 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box className={classes.metric}>
                    <Typography variant="caption">프로젝트</Typography>
                    <Typography variant="h6">
                      {summary.inventory?.projectCount ?? projects.length}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box className={classes.metric}>
                    <Typography variant="caption">개발 태스크</Typography>
                    <Typography variant="h6">
                      {summary.inventory?.taskCount ?? tasks.length}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box className={classes.metric}>
                    <Typography variant="caption">제어 자산</Typography>
                    <Typography variant="h6">
                      {summary.inventory?.controlAssetCount ?? 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box className={classes.metric}>
                    <Typography variant="caption">디자인 자산</Typography>
                    <Typography variant="h6">
                      {summary.inventory?.designAssetCount ?? 0}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            )}
            {activeCommand &&
              ![
                'assignments',
                'completion',
                'actors',
                'processes',
                'steps',
              ].includes(selectedTab.id) && (
                <Box
                  mt={3}
                  p={2}
                  style={{
                    border: '1px solid #bfdbfe',
                    borderRadius: 10,
                    background: '#f8fbff',
                  }}
                >
                  <Typography variant="h6">{activeCommand.label}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {activeCommand.description}
                  </Typography>
                  <form
                    key={`${selectedTab.id}-${String(
                      selectedRow?.actorCode ??
                        selectedRow?.processCode ??
                        selectedRow?.stepCode ??
                        'new',
                    )}`}
                    onSubmit={executeTabCommand}
                  >
                    <Grid container spacing={2} style={{ marginTop: 4 }}>
                      {activeCommand.fields.map(field => (
                        <Grid
                          item
                          xs={12}
                          md={field.type === 'textarea' ? 12 : 6}
                          key={field.name}
                        >
                          <TextField
                            fullWidth
                            size="small"
                            variant="outlined"
                            name={field.name}
                            label={field.label}
                            required={field.required}
                            type={field.type === 'number' ? 'number' : 'text'}
                            multiline={field.type === 'textarea'}
                            rows={field.type === 'textarea' ? 3 : undefined}
                            defaultValue={
                              selectedRow?.[field.name] ??
                              (field.name === 'projectId'
                                ? projectId
                                : field.defaultValue ?? '')
                            }
                          />
                        </Grid>
                      ))}
                    </Grid>
                    <Box mt={2} display="flex" alignItems="center" gridGap={12}>
                      <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        disabled={commandPending}
                      >
                        {commandPending ? '처리 중…' : activeCommand.label}
                      </Button>
                      <Typography variant="caption" color="textSecondary">
                        표의 행을 선택하면 등록값을 불러와 수정할 수 있습니다.
                      </Typography>
                    </Box>
                  </form>
                  {commandResult && (
                    <Box
                      component="pre"
                      mt={2}
                      p={2}
                      style={{
                        marginBottom: 0,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        borderRadius: 6,
                        background: '#eaf2f8',
                        fontSize: 12,
                      }}
                    >
                      {commandResult}
                    </Box>
                  )}
                </Box>
              )}
            {![
              'work-dashboard',
              'assignments',
              'completion',
              'actors',
            ].includes(selectedTab.id) && (
              <>
                <Box
                  mt={3}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  gridGap={12}
                  flexWrap="wrap"
                >
                  <Box>
                    <Typography variant="subtitle2">
                      실제 운영 데이터
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Resonance 원본 데이터셋 {datasetKey} · 전체{' '}
                      {sourceRows.length}건 · 최대 100건 표시
                    </Typography>
                  </Box>
                  <TextField
                    variant="outlined"
                    size="small"
                    label="현재 탭 검색"
                    value={rowFilter}
                    onChange={event => setRowFilter(event.target.value)}
                  />
                </Box>
                <Box
                  mt={2}
                  style={{
                    overflowX: 'auto',
                    border: '1px solid #dbe4ea',
                    borderRadius: 8,
                  }}
                >
                  {visibleRows.length > 0 ? (
                    <table
                      style={{
                        width: '100%',
                        minWidth: 760,
                        borderCollapse: 'collapse',
                        fontSize: 13,
                      }}
                    >
                      <thead style={{ background: '#f1f5f9' }}>
                        <tr>
                          {visibleColumns.map(column => (
                            <th
                              key={column}
                              style={{
                                padding: 12,
                                textAlign: 'left',
                                borderBottom: '1px solid #cbd5e1',
                              }}
                            >
                              {columnLabels[column] ?? column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((row, index) => (
                          <tr
                            key={`${selectedTab.id}-${index}`}
                            onClick={() => setSelectedRow(row)}
                            style={{
                              cursor: 'pointer',
                              background:
                                selectedRow === row ? '#e8f2ff' : undefined,
                            }}
                          >
                            {visibleColumns.map(column => (
                              <td
                                key={column}
                                style={{
                                  padding: 12,
                                  borderBottom: '1px solid #e2e8f0',
                                  maxWidth: 320,
                                  overflowWrap: 'anywhere',
                                }}
                              >
                                {displayValue(row[column])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <Box p={3}>
                      <Typography variant="body2" color="textSecondary">
                        {rowFilter
                          ? '검색 조건에 맞는 데이터가 없습니다.'
                          : '이 기능에 등록된 운영 데이터가 없습니다. 설계에서 필요한 항목을 등록하면 이곳에 즉시 표시됩니다.'}
                      </Typography>
                    </Box>
                  )}
                </Box>
                {selectedRow && (
                  <Box
                    mt={2}
                    p={2}
                    style={{
                      border: '1px solid #dbe4ea',
                      borderRadius: 8,
                      background: '#f8fafc',
                    }}
                  >
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography variant="subtitle2">
                        선택 항목 전체 상세
                      </Typography>
                      <Button size="small" onClick={() => setSelectedRow(null)}>
                        닫기
                      </Button>
                    </Box>
                    <Box
                      component="pre"
                      mt={1}
                      style={{
                        marginBottom: 0,
                        maxHeight: 360,
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        fontSize: 12,
                      }}
                    >
                      {JSON.stringify(selectedRow, null, 2)}
                    </Box>
                  </Box>
                )}
              </>
            )}
            <Box mt={3} display="flex" gridGap={8} flexWrap="wrap">
              <Button
                variant="contained"
                color="primary"
                href={routeForWorkspace[workspace.id]}
                startIcon={<LaunchIcon />}
              >
                {workspace.label} 공통 관리 열기
              </Button>
              {workspace.id === 'operate' && (
                <Button
                  variant="outlined"
                  href={`http://172.16.1.232/admin/system/actor-process?projectId=${encodeURIComponent(
                    projectId,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Resonance 실제 업무 실행
                </Button>
              )}
            </Box>
          </Paper>
        </Box>
      </Content>
    </Page>
  );
}
