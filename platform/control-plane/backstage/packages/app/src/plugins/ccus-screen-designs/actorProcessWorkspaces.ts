export type ActorProcessWorkspaceId =
  | 'operate'
  | 'design'
  | 'verify'
  | 'delivery';

export type ActorProcessTab = {
  id: string;
  label: string;
  description: string;
};

export type ActorProcessWorkspace = {
  id: ActorProcessWorkspaceId;
  label: string;
  description: string;
  tabs: ActorProcessTab[];
};

const tab = (id: string, label: string, description: string) => ({
  id,
  label,
  description,
});

export const ACTOR_PROCESS_WORKSPACES: ActorProcessWorkspace[] = [
  {
    id: 'operate',
    label: '업무 운영',
    description:
      '업무 종류·액터·프로젝트 문맥에서 전체 흐름과 실제 실행을 관리합니다.',
    tabs: [
      tab('work-dashboard', '업무 운영 지도', '선택 프로젝트의 전체 업무 흐름과 현재 단계를 조회합니다.'),
      tab('work-completion', '완료·개발 현황', '업무별 완료율과 개발 준비 상태를 확인합니다.'),
      tab('process-map', '전체 프로세스 설계도', '프로세스와 단계 관계를 순서대로 확인합니다.'),
      tab('execution', '종단간 업무 실행', '프로젝트 업무 실행을 시작하고 단계 명령을 수행합니다.'),
      tab('work-types', '업무 종류', '프로세스의 최상위 업무 분류를 관리합니다.'),
      tab('actors', '액터', '역할·책임·권한 범위를 정의합니다.'),
      tab('assignments', '계정 배정', '계정·테넌트·프로젝트에 액터를 배정합니다.'),
      tab('account-readiness', '액터 계정 검증', '계정·권한·업무 연결의 준비 상태를 검사합니다.'),
      tab('processes', '프로세스', '업무 목표·시작·완료 조건을 관리합니다.'),
      tab('steps', '단계', '상태 전이·수행 액터·완료 규칙을 관리합니다.'),
    ],
  },
  {
    id: 'design',
    label: '설계',
    description:
      '프로세스·화면·필드·메뉴·공통 기능 계약을 프로젝트별 설계 원장으로 관리합니다.',
    tabs: [
      tab('vertical-screen-map', '전체 화면 세로 지도', '프로세스 순서로 전체 화면을 나열합니다.'),
      tab('screen-flow-canvas', '전체 화면 순서도', '화면 호출·분기·팝업 관계를 시각화합니다.'),
      tab('common-centered-canvas', '공통 중심 시스템 지도', '공통 섹션·컴포넌트·스키마 재사용을 확인합니다.'),
      tab('process-archetypes', '프로세스 원형 60', '표준 프로세스 원형과 적용 화면을 관리합니다.'),
      tab('design-canvas', '전체 화면 캔버스', '확대·축소 가능한 설계 캔버스를 제공합니다.'),
      tab('professional', '전문가 준비도', '전문성·완전성·연계 준비도를 평가합니다.'),
      tab('page-fields', '페이지·컬럼 설계', '페이지 입출력 필드와 데이터 계약을 편집합니다.'),
      tab('screen-contracts', '화면 완성 계약', '기능·상태·권한·테스트·완료 조건을 관리합니다.'),
      tab('registration-coverage', '프로젝트 등록 요건', '프로젝트 업무 시작 전 준비 정보를 검사합니다.'),
      tab('common-features', '공통 특수기능', '재사용 가능한 공통 기능 패키지를 관리합니다.'),
      tab('menu-bindings', '액터·프로세스 메뉴', '메뉴·화면·프로세스·액터 관계를 관리합니다.'),
      tab('screen-space', '가상 화면 공간', '메타데이터 조합 화면 공간을 확인합니다.'),
      tab('references', '레퍼런스 자동설계', '요구·참조 문서와 설계 근거를 연결합니다.'),
      tab('generation', '대량 화면 생성', '승인 설계에서 화면 패키지를 생성합니다.'),
    ],
  },
  {
    id: 'verify',
    label: '검증',
    description:
      '설계 정확도·고객 여정·디자인·규정·예외·복구를 검증합니다.',
    tabs: [
      tab('design-assurance', '설계 정확도', '액터·상태·데이터·KPI·화면 계약 일치를 검사합니다.'),
      tab('customer-journey', '고객 여정 자동검증', '사용자 업무가 시작부터 완료까지 도달하는지 검사합니다.'),
      tab('design', '디자인 사전검증', '공통 디자인 자산 재사용과 접근성을 검사합니다.'),
      tab('rules', '개발 규칙', '프로젝트에 적용할 개발·검증 규칙을 관리합니다.'),
      tab('simulation', '시나리오·실행', '테스트 시나리오와 실행 증적을 관리합니다.'),
    ],
  },
  {
    id: 'delivery',
    label: '개발·배포',
    description:
      '승격된 설계에서 작업·산출물·품질 게이트와 배포 상태를 추적합니다.',
    tabs: [
      tab('delivery', '개발 실행 큐', '개발 작업 우선순위·점유·재시도를 관리합니다.'),
      tab('automation', '프로세스 자동개발', '설계 기반 자동개발 작업을 실행합니다.'),
      tab('artifacts', '개발 산출물', '메뉴·화면·API·DB·테스트 증적을 관리합니다.'),
      tab('overview', '전체 현황', '프로젝트 개발·검증·배포 완성도를 확인합니다.'),
    ],
  },
];

export const ACTOR_PROCESS_TAB_COUNT = ACTOR_PROCESS_WORKSPACES.reduce(
  (count, workspace) => count + workspace.tabs.length,
  0,
);
