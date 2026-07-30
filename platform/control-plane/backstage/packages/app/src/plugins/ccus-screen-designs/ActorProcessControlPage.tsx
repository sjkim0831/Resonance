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
  onSelect,
  onOpenTab,
  executeRuntimeCommand,
  loadDesignDocuments,
  saveDesignDocument,
}: {
  dashboard: RuntimeDashboard;
  projectId: string;
  onSelect: (row: RuntimeRow) => void;
  onOpenTab: (tabId: string) => void;
  executeRuntimeCommand: (
    command: 'execution.validate' | 'execution.advance',
    executionId: string,
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
  const [selectedScenarioType, setSelectedScenarioType] =
    useState<(typeof REQUIRED_SIMULATION_TYPES)[number]>('HAPPY_PATH');
  const [designWorkbenchOpen, setDesignWorkbenchOpen] = useState(false);
  const processes = (dashboard.processes ?? []) as RuntimeRow[];
  const workTypes = (dashboard.workTypes ?? []) as RuntimeRow[];
  const steps = (dashboard.steps ?? []) as RuntimeRow[];
  const actors = (dashboard.actors ?? []) as RuntimeRow[];
  const executions = (dashboard.processExecutions ?? []) as RuntimeRow[];
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
  const route = String(activeStep?.userPath ?? activeStep?.adminPath ?? '');
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
              INTEGRATED DESIGN WORKBENCH
            </Typography>
            <Typography variant="h6">통합 설계 문서·액티브 UI 관리</Typography>
            <Typography variant="body2">
              선택한 프로세스·단계·화면의 설계 문서 18종을 버전으로 관리합니다.
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={() => setDesignWorkbenchOpen(true)}
            style={{ background: '#fff', color: '#174ea6' }}
          >
            설계 워크벤치 열기
          </Button>
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
                  activeExecution?.executionStatus ??
                    activeExecution?.status ??
                    '설계 상태',
                )}
              />
            </Box>
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
              정상, 권한, 데이터 격리, 예외, 복구 시나리오를 동일한 업무
              단계에 투영하여 고객이 실제 업무를 끝낼 수 있는지 검토합니다.
            </Typography>
          </Box>
          <Box display="flex" gridGap={8} flexWrap="wrap">
            <Chip
              color={
                customerJourney.blockerCount > 0 ? 'secondary' : 'primary'
              }
              label={`차단 ${customerJourney.blockerCount}건`}
            />
            <Chip
              label={`실행 준비도 ${customerJourney.readinessPercent}%`}
            />
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
                  ? `미등록: ${customerJourney.missingScenarioTypes.join(
                      ', ',
                    )}`
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
            <Paper
              variant="outlined"
              style={{ padding: 14, marginBottom: 12 }}
            >
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
                      <th
                        key={head}
                        style={{ padding: 10, textAlign: 'left' }}
                      >
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
    if (selectedTab.id !== 'work-dashboard') return;
    const required = [
      'processes',
      'steps',
      'actors',
      'workTypes',
      'cases',
      'artifacts',
      'developmentJobs',
      'customerJourneyGaps',
      'processExecutions',
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
              전체 {ACTOR_PROCESS_TAB_COUNT}개 제어 기능
            </Typography>
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
                  <Typography variant="caption">{item.capability}</Typography>
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
                loadDesignDocuments={loadDesignDocuments}
                saveDesignDocument={saveDesignDocument}
              />
            )}
            {selectedTab.id !== 'work-dashboard' && (
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
            {activeCommand && (
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
            {selectedTab.id !== 'work-dashboard' && (
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
