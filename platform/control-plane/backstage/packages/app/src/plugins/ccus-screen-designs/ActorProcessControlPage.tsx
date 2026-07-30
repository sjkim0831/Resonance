import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Chip,
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

const TAB_COMMANDS: Record<string, TabCommand> = {
  actors: {
    command: 'actor.save',
    label: '액터 등록·수정',
    description: '역할, 책임, 목적과 보유 역량을 동일한 액터 코드로 등록하거나 갱신합니다.',
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
    description: '업무 종류와 시작·완료 조건을 포함한 실행 가능한 프로세스를 저장합니다.',
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
    description: '액터, 명령, 상태 전이, 완료 조건을 연결하고 개발 작업을 자동 생성합니다.',
    fields: [
      { name: 'processCode', label: '프로세스 코드', required: true },
      { name: 'stepOrder', label: '단계 순서', required: true, type: 'number' },
      { name: 'stepCode', label: '단계 코드', required: true },
      { name: 'stepName', label: '단계명', required: true },
      { name: 'actorCode', label: '담당 액터', required: true },
      { name: 'fromState', label: '시작 상태', required: true },
      { name: 'commandCode', label: '실행 명령', required: true },
      { name: 'toState', label: '완료 상태', required: true },
      { name: 'completionRule', label: '완료 조건', required: true, type: 'textarea' },
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
      { name: 'sortOrder', label: '표시 순서', defaultValue: '1', type: 'number' },
    ],
  },
  'data-contracts': {
    command: 'screen.contract.save',
    label: '화면·API·DB 계약 저장',
    description:
      '선택 화면의 업무 목적, 진입·종료 조건, 필드, 명령, 상태, API, DB, 증적과 품질 검증 계약을 한 트랜잭션으로 저장합니다.',
    fields: [
      { name: 'contractId', label: '화면 계약 ID', required: true, type: 'number' },
      { name: 'businessPurpose', label: '업무 목적', required: true, type: 'textarea' },
      { name: 'entryCondition', label: '진입 조건', required: true, type: 'textarea' },
      { name: 'exitCondition', label: '종료 조건', required: true, type: 'textarea' },
      { name: 'kpiContract', label: 'KPI 계약 JSON', defaultValue: '[]', type: 'textarea' },
      { name: 'sectionContract', label: '섹션 계약 JSON', defaultValue: '[]', type: 'textarea' },
      { name: 'fieldContract', label: '필드 계약 JSON', defaultValue: '[]', type: 'textarea' },
      { name: 'commandContract', label: '명령 계약 JSON', defaultValue: '[]', type: 'textarea' },
      { name: 'stateContract', label: '상태 계약 JSON', defaultValue: '[]', type: 'textarea' },
      { name: 'apiContract', label: 'API 계약 JSON', defaultValue: '[]', type: 'textarea' },
      { name: 'dataContract', label: 'DB·데이터 계약 JSON', defaultValue: '[]', type: 'textarea' },
      { name: 'evidenceContract', label: '증적 계약 JSON', defaultValue: '[]', type: 'textarea' },
      { name: 'responsiveContract', label: '반응형 계약', defaultValue: '360px, 768px, 1280px 검증' },
      { name: 'accessibilityContract', label: '접근성 계약', defaultValue: 'KRDS 및 WCAG 2.1 AA' },
      { name: 'securityContract', label: '보안 계약', defaultValue: '테넌트·프로젝트·액터 권한 서버 검증' },
      { name: 'apiVerified', label: 'API 검증', defaultValue: 'false' },
      { name: 'databaseVerified', label: 'DB 검증', defaultValue: 'false' },
      { name: 'authorityVerified', label: '권한 검증', defaultValue: 'false' },
      { name: 'responsiveVerified', label: '반응형 검증', defaultValue: 'false' },
      { name: 'accessibilityVerified', label: '접근성 검증', defaultValue: 'false' },
      { name: 'exceptionStatesVerified', label: '예외 상태 검증', defaultValue: 'false' },
      { name: 'auditEvidenceRef', label: '감사 증적 경로' },
      { name: 'contractStatus', label: '계약 상태', defaultValue: 'REVIEW_REQUIRED' },
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
      { name: 'preconditions', label: '사전 조건', required: true, type: 'textarea' },
      { name: 'stepsJson', label: '단계 JSON', defaultValue: '[]', type: 'textarea' },
      { name: 'assertionsJson', label: '기대값 JSON', defaultValue: '[]', type: 'textarea' },
    ],
  },
  'design-release': {
    command: 'design.validate',
    label: '프로세스 설계 검증',
    description: '액터·상태·데이터·라우트·테스트 계약의 누락과 충돌을 검증합니다.',
    fields: [{ name: 'processCode', label: '프로세스 코드', required: true }],
  },
  'development-plan': {
    command: 'development.plan',
    label: '개발 계획 생성',
    description: '선택 단계에 필요한 설계·DB·API·화면·테스트 작업을 자동 생성합니다.',
    fields: [
      { name: 'processCode', label: '프로세스 코드', required: true },
      { name: 'stepCode', label: '단계 코드', required: true },
    ],
  },
  frontend: {
    command: 'development.preflight',
    label: '화면 개발 사전검사',
    description: '설계 메모, 공통 디자인, 액터 계약과 안전 테스트 준비 상태를 검사합니다.',
    fields: [
      { name: 'processCode', label: '프로세스 코드', required: true },
      { name: 'stepCode', label: '단계 코드', required: true },
    ],
  },
  backend: {
    command: 'backend.verify',
    label: '백엔드 계약 검증',
    description: '프로세스별 API·DB·권한·롤백 계약을 검증하고 증적을 기록합니다.',
    fields: [{ name: 'sourceCommit', label: '소스 커밋' }],
  },
  execution: {
    command: 'execution.start',
    label: '프로세스 실행 시작',
    description: '프로젝트와 액터 범위를 지정하여 실제 업무 실행 인스턴스를 시작합니다.',
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
  design: '/design-assets',
  develop: '/system-development',
  operate: '/system-operations',
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

  const loadRuntimeDataset = async (targetDatasetKey: string) => {
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
  };

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
      setCommandResult(
        `처리 완료\n${JSON.stringify(payload, null, 2)}`,
      );
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

  return (
    <Page themeId="tool">
      <Header
        title="Actor·Process 프로젝트 제어"
        subtitle="Backstage를 설계·개발·운영의 단일 기준으로 사용하고 Resonance 실행 환경을 제어합니다."
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
            <Box
              mt={3}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gridGap={12}
              flexWrap="wrap"
            >
              <Box>
                <Typography variant="subtitle2">실제 운영 데이터</Typography>
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
