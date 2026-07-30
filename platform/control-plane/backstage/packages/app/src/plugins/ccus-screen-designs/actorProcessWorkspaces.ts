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
};

export type ActorProcessWorkspace = {
  id: ActorProcessWorkspaceId;
  label: string;
  description: string;
  tabs: ActorProcessTab[];
};

export const ACTOR_PROCESS_DATASET_BY_TAB: Record<string, string> = {
  actors: 'actors',
  processes: 'processes',
  steps: 'steps',
  'screen-flow': 'screenArchetypeBindings',
  'data-contracts': 'professionalScreenContracts',
  'test-scenarios': 'cases',
  'design-assets': 'referenceAssets',
  'design-release': 'designValidationRuns',
  'development-plan': 'processDevelopmentProgress',
  'generation-queue': 'developmentJobs',
  frontend: 'screenDevelopmentGates',
  backend: 'backendProcessReadiness',
  database: 'pageDesigns',
  'automated-tests': 'qualityGateResults',
  artifacts: 'artifacts',
  promotion: 'deliveryQueue',
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
) => ({ id, label, description, capability });

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
      '액터, 프로세스, 화면, 데이터와 테스트 계약을 하나의 버전으로 설계하고 승인합니다.',
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
        '설계 검증·승인',
        '누락과 충돌을 검사하고 개발 기준 버전으로 승격합니다.',
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
      '승격된 설계를 Resonance 생성 계약으로 전달하고 구현·검증 증적을 관리합니다.',
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
        'promotion',
        '통합·승격',
        '모든 게이트 통과 후 Resonance 배포 대상으로 승격합니다.',
        'PROMOTION',
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
