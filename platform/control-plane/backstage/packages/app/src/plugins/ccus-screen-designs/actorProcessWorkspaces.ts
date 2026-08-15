export type ActorProcessWorkspaceId =
  | 'operate'
  | 'design'
  | 'verify'
  | 'delivery';

export type ActorProcessTab = {
  id: string;
  label: string;
  description: string;
  capability: string;
  uiRestoration: 'FULL' | 'PARTIAL';
};

export type ActorProcessWorkspace = {
  id: ActorProcessWorkspaceId;
  label: string;
  description: string;
  tabs: ActorProcessTab[];
};

export type ProcessGraphStep = {
  stepCode?: unknown;
  stepName?: unknown;
  stepOrder?: unknown;
  actorCode?: unknown;
  fromState?: unknown;
  toState?: unknown;
  inputContract?: unknown;
  outputContract?: unknown;
  exceptionRule?: unknown;
  userPath?: unknown;
  adminPath?: unknown;
};

export type ProcessGraphEdge<T extends ProcessGraphStep> = {
  from: T;
  to: T;
  kind: 'NORMAL' | 'CORRECTION' | 'RECOVERY' | 'EXCEPTION';
  condition: string;
};

export const REQUIRED_SIMULATION_TYPES = [
  'HAPPY_PATH',
  'AUTHORITY',
  'ISOLATION',
  'EXCEPTION',
  'RECOVERY',
] as const;

export const hydrateStringDraft = <T extends Record<string, string>>(
  defaults: T,
  row: Record<string, unknown>,
): T => {
  const hydrated = { ...defaults } as Record<string, string>;
  Object.keys(defaults).forEach(key => {
    if (row[key] !== undefined && row[key] !== null) {
      hydrated[key] = String(row[key]);
    }
  });
  return hydrated as T;
};

export const professionalContractSaveValues = <
  T extends Record<string, string> & {
    contractId: string;
    permissionCodes: string;
    layoutCode: string;
    themeCode: string;
  },
>(
  draft: T,
): Record<string, unknown> => ({
  ...draft,
  contractId: Number(draft.contractId),
  layout: draft.layoutCode,
  theme: draft.themeCode,
});

const rowValue = (row: Record<string, unknown>, camel: string, snake: string) =>
  row[camel] ?? row[snake];

export const buildCustomerJourneySimulation = <
  T extends ProcessGraphStep & Record<string, unknown>,
>(
  steps: T[],
  cases: Array<Record<string, unknown>>,
  artifacts: Array<Record<string, unknown>>,
  jobs: Array<Record<string, unknown>>,
  gaps: Array<Record<string, unknown>>,
) => {
  const graph = buildProcessGraph(steps);
  const processCode = String(steps[0]?.processCode ?? '');
  const processCases = cases.filter(
    row =>
      String(rowValue(row, 'processCode', 'process_code') ?? '') ===
      processCode,
  );
  const scenarioCoverage = REQUIRED_SIMULATION_TYPES.map(type => {
    const matches = processCases.filter(
      row => String(rowValue(row, 'caseType', 'case_type') ?? '') === type,
    );
    return {
      type,
      count: matches.length,
      approved: matches.some(row =>
        ['APPROVED', 'PASSED'].includes(
          String(rowValue(row, 'status', 'case_status') ?? ''),
        ),
      ),
      cases: matches,
    };
  });

  const journeySteps = graph.steps.map(step => {
    const stepCode = String(step.stepCode ?? '');
    const route = String(step.userPath ?? step.adminPath ?? '');
    const stepArtifacts = artifacts.filter(
      row =>
        String(rowValue(row, 'processCode', 'process_code') ?? '') ===
          processCode &&
        (!rowValue(row, 'stepCode', 'step_code') ||
          String(rowValue(row, 'stepCode', 'step_code')) === stepCode),
    );
    const stepJobs = jobs.filter(
      row =>
        String(rowValue(row, 'processCode', 'process_code') ?? '') ===
          processCode &&
        (!rowValue(row, 'stepCode', 'step_code') ||
          String(rowValue(row, 'stepCode', 'step_code')) === stepCode),
    );
    const stepGaps = gaps.filter(row => {
      const objectCode = String(
        rowValue(row, 'objectCode', 'object_code') ?? '',
      );
      const targetUrl = String(rowValue(row, 'targetUrl', 'target_url') ?? '');
      return (
        objectCode === processCode ||
        objectCode === stepCode ||
        (route && targetUrl.split('?')[0] === route.split('?')[0])
      );
    });
    const contractReady = Boolean(
      step.actorCode &&
        step.fromState &&
        step.toState &&
        step.inputContract &&
        step.outputContract,
    );
    const screenReady = Boolean(route);
    const testReady = processCases.length > 0;
    const developmentReady =
      stepJobs.length > 0 &&
      stepJobs.every(row =>
        ['COMPLETED', 'VERIFIED', 'PROMOTED'].includes(
          String(rowValue(row, 'jobStatus', 'job_status') ?? ''),
        ),
      );
    const blockerCount = stepGaps.filter(
      row => String(row.severity ?? '') === 'BLOCKER',
    ).length;
    const score = [
      contractReady,
      screenReady,
      testReady,
      stepArtifacts.length > 0,
      developmentReady,
      blockerCount === 0,
    ].filter(Boolean).length;
    return {
      step,
      route,
      contractReady,
      screenReady,
      testReady,
      artifactCount: stepArtifacts.length,
      developmentReady,
      blockerCount,
      readinessPercent: Math.round((score / 6) * 100),
    };
  });

  return {
    processCode,
    graph,
    scenarioCoverage,
    journeySteps,
    missingScenarioTypes: scenarioCoverage
      .filter(item => item.count === 0)
      .map(item => item.type),
    blockerCount: journeySteps.reduce(
      (total, step) => total + step.blockerCount,
      0,
    ),
    readinessPercent:
      journeySteps.length === 0
        ? 0
        : Math.round(
            journeySteps.reduce(
              (total, step) => total + step.readinessPercent,
              0,
            ) / journeySteps.length,
          ),
  };
};

const isCorrectionStep = (step: ProcessGraphStep) =>
  String(step.fromState ?? '') === 'CORRECTION_REQUIRED' ||
  String(step.stepCode ?? '').includes('CORRECT');

export const buildProcessGraph = <T extends ProcessGraphStep>(steps: T[]) => {
  const orderedSteps = [...steps].sort(
    (left, right) => Number(left.stepOrder ?? 0) - Number(right.stepOrder ?? 0),
  );
  const edges: ProcessGraphEdge<T>[] = [];

  orderedSteps.forEach(from => {
    orderedSteps
      .filter(
        to =>
          String(to.fromState ?? '') === String(from.toState ?? '') &&
          String(to.stepCode ?? '') !== String(from.stepCode ?? ''),
      )
      .forEach(to => {
        const correction = isCorrectionStep(to);
        const recovery =
          !correction &&
          Number(to.stepOrder ?? 0) <= Number(from.stepOrder ?? 0);
        edges.push({
          from,
          to,
          kind: correction ? 'CORRECTION' : recovery ? 'RECOVERY' : 'NORMAL',
          condition: String(to.fromState ?? from.toState ?? ''),
        });
      });

    const correctionTarget = orderedSteps.find(isCorrectionStep);
    const supportsCorrection =
      String(from.stepCode ?? '').includes('VALIDATE') ||
      String(from.stepCode ?? '').includes('APPROVE') ||
      String(from.toState ?? '') === 'VERIFIED';
    if (
      supportsCorrection &&
      correctionTarget &&
      correctionTarget !== from &&
      !edges.some(
        edge =>
          edge.from === from &&
          edge.to === correctionTarget &&
          edge.kind === 'CORRECTION',
      )
    ) {
      edges.push({
        from,
        to: correctionTarget,
        kind: 'CORRECTION',
        condition: '보완 필요 또는 승인 반려',
      });
    }

    if (
      from.exceptionRule &&
      !edges.some(
        edge =>
          edge.from === from &&
          edge.kind === 'EXCEPTION' &&
          edge.condition === String(from.exceptionRule),
      )
    ) {
      const recoveryTarget = correctionTarget ?? orderedSteps[0];
      if (recoveryTarget && recoveryTarget !== from) {
        edges.push({
          from,
          to: recoveryTarget,
          kind: 'EXCEPTION',
          condition: String(from.exceptionRule),
        });
      }
    }
  });

  const incoming = new Set(edges.map(edge => String(edge.to.stepCode ?? '')));
  const outgoing = new Set(
    edges
      .filter(edge => edge.kind === 'NORMAL')
      .map(edge => String(edge.from.stepCode ?? '')),
  );

  return {
    steps: orderedSteps,
    edges,
    entrySteps: orderedSteps.filter(
      step => !incoming.has(String(step.stepCode ?? '')),
    ),
    terminalSteps: orderedSteps.filter(
      step => !outgoing.has(String(step.stepCode ?? '')),
    ),
  };
};

export const resolveProcessBranches = <T extends ProcessGraphStep>(
  steps: T[],
  activeStep?: T,
) => {
  const stepCode = String(activeStep?.stepCode ?? '');
  const nextStep = steps.find(
    step =>
      String(step.fromState ?? '') === String(activeStep?.toState ?? '') &&
      String(step.stepCode ?? '') !== stepCode,
  );
  const correctionStep = steps.find(
    step =>
      String(step.fromState ?? '') === 'CORRECTION_REQUIRED' ||
      String(step.stepCode ?? '') === 'EMISSION_PROJECT_CORRECT',
  );
  return {
    nextStep,
    correctionStep,
    supportsCorrectionBranch: [
      'EMISSION_PROJECT_VALIDATE',
      'EMISSION_PROJECT_APPROVE',
    ].includes(stepCode),
  };
};

export const ACTOR_PROCESS_DATASET_BY_TAB: Record<string, string> = {
  actors: 'actors',
  processes: 'processes',
  steps: 'steps',
  'screen-flow': 'screenArchetypeBindings',
  'data-contracts': 'professionalScreenContracts',
  'test-scenarios': 'cases',
  'design-assets': 'referenceAssets',
  'design-release': 'professionalScreenContracts',
  'development-plan': 'processDevelopmentProgress',
  'generation-queue': 'developmentJobs',
  frontend: 'screenDevelopmentGates',
  backend: 'backendProcessReadiness',
  database: 'pageDesigns',
  'automated-tests': 'qualityGateResults',
  'screen-workflow-tests': 'processes',
  artifacts: 'artifacts',
  'source-immediate': 'deliveryQueue',
  'work-dashboard': 'processExecutions',
  execution: 'processExecutionEvents',
  assignments: 'assignments',
  completion: 'projectCompletionRuns',
  runtime: 'automationMetrics',
  deployments: 'deliveryQueue',
  incidents: 'customerJourneyGaps',
  audit: 'developmentEvents',
};

const tab = (
  id: string,
  label: string,
  description: string,
  capability: string,
) => ({
  id,
  label,
  description,
  capability,
  uiRestoration: [
    'work-dashboard',
    'execution',
    'assignments',
    'completion',
    'actors',
    'processes',
    'steps',
    'screen-flow',
    'data-contracts',
    'screen-workflow-tests',
  ].includes(id)
    ? ('FULL' as const)
    : ('PARTIAL' as const),
});

export const ACTOR_PROCESS_WORKSPACES: ActorProcessWorkspace[] = [
  {
    id: 'operate',
    label: '업무 운영',
    description:
      '업무 종류와 액터를 선택하고 전체 흐름, 현재 단계, 길잡이와 실제 실행을 함께 관리합니다.',
    tabs: [
      tab(
        'work-dashboard',
        '업무 운영 지도',
        '업무 종류·액터·프로젝트별 전체 순서와 현재 실행 단계를 한 화면에서 확인합니다.',
        'WORK_DASHBOARD',
      ),
      tab(
        'execution',
        '종단간 업무 실행',
        '프로젝트 업무를 시작하고 단계별 명령과 다음 업무를 수행합니다.',
        'PROCESS_EXECUTION',
      ),
      tab(
        'assignments',
        '계정·액터 배정',
        '계정에 프로젝트별 액터와 데이터 범위를 배정합니다.',
        'ACTOR_ASSIGNMENT',
      ),
      tab(
        'completion',
        '완료·개발 현황',
        '프로세스와 화면별 완료, 차단, 재시도 상태를 봅니다.',
        'COMPLETION_STATUS',
      ),
    ],
  },
  {
    id: 'design',
    label: '설계',
    description:
      '액터, 프로세스, 화면, 데이터와 테스트 계약을 SOURCE에 저장해 즉시 반영합니다.',
    tabs: [
      tab(
        'actors',
        '액터·권한',
        '역할, 책임, 데이터 범위와 명령 권한을 정의합니다.',
        'ACTOR_POLICY',
      ),
      tab(
        'processes',
        '프로세스',
        '업무 목적, 시작·종료 조건과 담당 액터를 정의합니다.',
        'PROCESS_DEFINITION',
      ),
      tab(
        'steps',
        '단계·상태 전이',
        '단계 순서, 분기, 완료 조건과 다음 상태를 정의합니다.',
        'STATE_MACHINE',
      ),
      tab(
        'screen-flow',
        '화면 흐름',
        '단계별 화면, 팝업, 공통 화면과 이동 경로를 연결합니다.',
        'SCREEN_FLOW',
      ),
      tab(
        'data-contracts',
        '데이터 계약',
        '화면·API·DB 간 입력, 출력, 필드와 타입을 일치시킵니다.',
        'DATA_CONTRACT',
      ),
      tab(
        'design-assets',
        '공통 디자인 자산',
        '테마, 섹션, 컴포넌트와 CSS 재사용 계약을 선택합니다.',
        'DESIGN_ASSET',
      ),
      tab(
        'design-release',
        '설계 검증·즉시 반영',
        '누락과 충돌을 검사하고 SOURCE 저장 즉시 코드·권한·엔드포인트 입력에 반영합니다.',
        'DESIGN_RELEASE',
      ),
    ],
  },
  {
    id: 'verify',
    label: '검증',
    description:
      '설계 정확성, 고객 여정과 정상·예외·권한·격리·복구 시나리오를 검증합니다.',
    tabs: [
      tab(
        'test-scenarios',
        '테스트 시나리오',
        '정상·권한·격리·예외·복구 기대값을 정의합니다.',
        'TEST_CONTRACT',
      ),
      tab(
        'automated-tests',
        '자동 테스트',
        '계약·단위·통합·E2E 결과와 실패 원인을 확인합니다.',
        'TEST_EXECUTION',
      ),
      tab(
        'screen-workflow-tests',
        '화면 업무·기능 테스트',
        '업무 종류, 프로세스, 화면, 절차와 기능을 선택하고 기능별 데이터셋 선입력, 실제 화면 미리보기와 결정론적 테스트를 수행합니다.',
        'SCREEN_WORKFLOW_TEST',
      ),
      tab(
        'incidents',
        '장애·자가복구',
        '장애 감지, 격리, 자동 복구와 재발 방지 증적을 검증합니다.',
        'INCIDENT_RECOVERY',
      ),
      tab(
        'audit',
        '검증·감사 이력',
        '설계부터 실제 업무까지 검증 주체와 결과를 추적합니다.',
        'AUDIT_TRAIL',
      ),
    ],
  },
  {
    id: 'delivery',
    label: '개발·배포',
    description:
      'SOURCE에 저장된 설계를 Resonance 생성 계약에 즉시 동기화하고 구현·검증 증적을 관리합니다.',
    tabs: [
      tab(
        'development-plan',
        '개발 계획',
        '설계 기준으로 화면·API·DB·테스트 작업을 산출합니다.',
        'DEVELOPMENT_PLAN',
      ),
      tab(
        'generation-queue',
        '생성·작업 큐',
        '공통 제너레이터 작업과 실행기를 관리합니다.',
        'GENERATION_QUEUE',
      ),
      tab(
        'frontend',
        '프론트엔드',
        'KRDS 공통 섹션 기반 화면과 모바일 결과를 추적합니다.',
        'FRONTEND_BUILD',
      ),
      tab(
        'backend',
        '백엔드·API',
        '명령, 조회, 상태 전이와 트랜잭션 구현을 추적합니다.',
        'BACKEND_BUILD',
      ),
      tab(
        'database',
        'DB·마이그레이션',
        '스키마, 컬럼, 인덱스와 롤백 계약을 관리합니다.',
        'DATABASE_BUILD',
      ),
      tab(
        'artifacts',
        '산출물·증적',
        '소스, 빌드, 스크린샷과 검증 증적을 연결합니다.',
        'EVIDENCE',
      ),
      tab(
        'source-immediate',
        'SOURCE 즉시 동기화',
        '설계 저장 즉시 생성 코드, 화면 권한과 엔드포인트를 같은 SOURCE 기준으로 동기화합니다.',
        'SOURCE_IMMEDIATE',
      ),
      tab(
        'runtime',
        '런타임 상태',
        'Resonance, DB, 인증과 연계 서비스 상태를 확인합니다.',
        'RUNTIME_HEALTH',
      ),
      tab(
        'deployments',
        '빌드·배포',
        '변경 범위, 증분 빌드, 배포와 롤백을 관리합니다.',
        'DEPLOYMENT',
      ),
    ],
  },
];

export const ACTOR_PROCESS_TAB_COUNT = ACTOR_PROCESS_WORKSPACES.reduce(
  (count, workspace) => count + workspace.tabs.length,
  0,
);

// Resonance 원본의 4개 작업공간, 32개 기능 탭을 이관 기준선으로 유지한다.
// Backstage는 일부 기능을 25개 탭으로 통합하므로 탭 수와 UI 복원 수준을
// 별도로 추적해야 미완성 화면을 네이티브 완료로 오인하지 않는다.
export const ACTOR_PROCESS_SOURCE_TAB_COUNT = 32;
export const ACTOR_PROCESS_FULL_UI_COUNT = ACTOR_PROCESS_WORKSPACES.flatMap(
  workspace => workspace.tabs,
).filter(item => item.uiRestoration === 'FULL').length;
export const ACTOR_PROCESS_PARTIAL_UI_COUNT =
  ACTOR_PROCESS_TAB_COUNT - ACTOR_PROCESS_FULL_UI_COUNT;
