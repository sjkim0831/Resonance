# 관리자 시스템 화면 및 자산 감사

감사일: 2026-07-11

## 요약

- 시스템 메뉴 화면: 60개
- 파일 기반 SDUI 화면 등록: 249개
- Patroni `UI_PAGE_MANIFEST`: 전체 61개, 시스템 경로 14개
- 소스 컴포넌트: 439개, 파일 자산 등록 439개
- Patroni `UI_COMPONENT_REGISTRY`: 118개
- 활성 소스 컨트롤러: 100개
- 탐지 API 엔드포인트: 766개, 파일 자산 등록 32개
- DB 변경 자산: 54개, 파일 자산 등록 10개
- 재사용 섹션: 1개
- 디자인 프리셋: 1개
- 빌더 테마: 1개

정적 검사는 후보를 찾는 용도다. 로딩/오류 신호가 공통 훅이나 하위 컴포넌트에 있으면 오탐이 발생할 수 있으므로 아래 확정 목록은 소스와 데이터 제공 계층을 함께 확인했다.

## P0: 실제 데이터 전환이 필요한 화면

### 인프라 (`/admin/system/infra`)

- `INFRA_ROWS`, `INCIDENT_ROWS`가 프론트 코드의 정적 샘플이다.
- 화면 자체에서 라이브 토폴로지, 임계치, 인시던트, 승인, 감사 연결이 없다고 명시한다.
- 필요한 기능: Kubernetes node/pod/service, CPU/메모리/디스크, source timestamp, 임계치 정책, incident 생성, drain 승인/롤백.

### 배치 관리 (`/admin/system/batch`)

- scheduler bootstrap의 고정 잡/노드/실행 데이터를 사용한다.
- 큐 적체도 `Q-SETTLEMENT`, `Q-CERT`, `Q-TOKEN`, `Q-BACKFILL` 고정값이다.
- pause/resume/retry/drain/audit 변경 API가 차단되어 있다.
- 필요한 기능: 실제 Kubernetes Job/CronJob 및 사용 중인 메시지 큐, 재실행 권한, 중복 실행 방지, 감사 로그.

### IP 화이트리스트 (`/admin/system/ip_whitelist`)

- DB 저장 기능은 있으나 조회 결과에 `WL-001`~`WL-004` 기본 예시 행과 예시 요청을 항상 병합한다.
- 운영 데이터가 예시 데이터와 섞일 수 있다.
- 필요한 기능: 기본 행 제거, DB 원장만 조회, gateway 적용 상태, 만료 자동 해제, 승인·반려·감사.

### AI 격납고 (`/admin/system/ai-hangar`)

- 런타임 API를 사용하지만 AI 항목은 `Planned`, `Ready for rules` 고정 목록이다.
- 필요한 기능: 실제 모델 프로세스, GPU/메모리, 모델 상태, agent binding, 재기동·격리, 작업 이력.

## P1: 저장·변경 계약이 미완성인 화면

### 홈 페이지 작업대 (`/admin/system/home-page-workbench`)

- 작업 상태가 브라우저 `localStorage`에만 저장된다.
- 사용자·브라우저·서버 간 공유되지 않고 감사·복구가 불가능하다.
- Patroni 작업 원장, 담당자, 상태 이력, 커밋·검증 연결이 필요하다.

### 성능 (`/admin/system/performance`)

- 최근 요청 및 JVM 신호는 실제 데이터다.
- 임계치, 알림 규칙, export, 보존기간, 추세, incident handoff, 감사 기능이 미연결이다.

### 알림센터 (`/admin/system/notification`)

- 발송·활동 조회는 있으나 범용 알림센터 완료 게이트가 남아 있다.
- 채널 정책, 재시도, 템플릿, 수신 확인, 보존·감사 계약을 점검해야 한다.

### 화면 흐름 관리 (`/admin/system/screen-flow-management`)

- 현재 읽기 전용 체인 점검 중심이다.
- 흐름 변경, 영향도 계산, 충돌 차단, rollback, 감사 저장이 필요하다.

### 화면-메뉴 귀속 관리 (`/admin/system/screen-menu-assignment-management`)

- 단일 메뉴 매핑은 가능하다.
- 충돌 검증, 권한 영향도, rollback, 감사 증적은 미완성이다.

### WBS 관리 (`/admin/system/wbs-management`)

- 기본 WBS 기능은 있으나 SR 연계, 일괄 작업, 감사 export 계약이 남아 있다.

### 백업·복구 (`/admin/system/backup_config`, `/backup`, `/restore`)

- 공통 화면과 실행 계약이 존재한다.
- 실제 PITR·스냅샷·복구 검증 결과, 승인, 실행 잠금, 복구 증적을 화면별로 재검증해야 한다.

### 모듈 관리 (`/admin/system/module`)

- 라우트 카탈로그는 실제 소스에서 계산한다.
- eGovFrame 표준 모듈은 참조용 정적 목록이며 등록·수정·버전·의존성 관리 기능은 없다.

## P1: SDUI 관리 화면 미완성

### 빌더 스튜디오 (`/admin/system/builder-studio`)

- DB 드래프트 저장·게시와 런타임 이벤트 실행은 연결됐다.
- 속성/API/이벤트/권한 검증, 버전 비교·롤백, 실제 메뉴 런타임 치환은 통합 진행 중이다.

### 컴포넌트 관리 (`/admin/system/component-management`)

- 파일 레지스트리를 편집하고 DB에는 동기화한다.
- 정식 DB 레지스트리를 직접 편집·비교하는 단일 관리 계약으로 전환해야 한다.

### 섹션 관리 (`/admin/system/section-management`)

- 등록 섹션이 1개뿐이다.
- 페이지에서 추출한 섹션의 DB 저장, 버전, 사용처, 영향도, 미리보기 기능이 필요하다.

### 테마 관리 (`/admin/system/theme`, `/theme-management`)

- 빌더 저장소의 테마는 1개다.
- 별도 `ThemeManagementPage`에는 미리보기와 저장이 “준비 중”인 과거 구현도 남아 있다.
- 테마·디자인 토큰·컴포넌트 스타일 저장소를 하나로 합쳐야 한다.

## 운영 데이터 사용이 확인된 주요 화면

- 모니터링 대시보드
- 크론 모니터링: Kubernetes CronJob/Job/Event
- DB 모니터링: Prometheus/Patroni 데이터
- Git 빌드 모니터링: 실제 Git·빌드 상태
- 스케줄러 관리: 프론트에서 실제 Cron 모니터링 데이터로 전환 완료
- 성능: JVM 및 최근 요청 실행 로그
- 설치 프로그램·시스템 자원: 런타임 및 시스템 명령 결과
- 메뉴 관리: 실제 메뉴 API/DB
- 보안 정책·감사·접속 이력: 운영 데이터 조회 계층

이 화면들도 로그인 상태에서 브라우저 동작과 변경 API 권한을 최종 회귀 검증해야 완료로 확정할 수 있다.

## 미등록·부분 등록 자산

### API와 컨트롤러

- 활성 컨트롤러 100개, 탐지 엔드포인트 766개다.
- 현재 자동 등록기는 `apps/carbonet-api` 중심으로 32개만 등록한다.
- 모듈의 컨트롤러와 엔드포인트 약 752개가 파일 자산 레지스트리에서 누락됐다.
- 다음 수집기는 `apps`, `modules`, `projects`의 실제 빌드 대상만 포함하고 `var/backups`, archive, generated output은 제외해야 한다.

### DB 자산

- 활성 DB 자산 54개 중 10개만 등록됐다.
- `ops/db/carbonet`, 루트 Flyway/Liquibase, 모듈별 migration을 함께 수집해야 한다.
- `.check.sql`, rollback, 적용 엔진, 적용 상태, checksum, 관련 테이블을 별도 필드로 관리해야 한다.

### 페이지 매니페스트

- 파일 레지스트리 화면은 249개지만 Patroni `UI_PAGE_MANIFEST`는 61개다.
- 시스템 화면은 60개 중 14개만 DB 매니페스트에 있다.
- 나머지 46개를 menu code, route, source, component map, design token, version status와 함께 등록해야 한다.

### 컴포넌트

- 소스 컴포넌트 439개는 파일 자산 레지스트리에 모두 등록됐다.
- Patroni 런타임 레지스트리는 118개이며, 이 중 `BUILDER_STUDIO` 소유는 6개다.
- 모든 소스 컴포넌트를 팔레트에 넣으면 안 된다. SDUI 렌더링 계약과 props schema가 있는 컴포넌트만 승격해야 한다.

### 섹션·테마·디자인

- 섹션 1개, 프리셋 1개, 테마 1개로 실제 시스템 디자인을 대표하지 못한다.
- 화면별 섹션을 자동 추출한 뒤 검색/목록/상세/폼/요약/차트/작업 패널로 정규화해야 한다.
- 실제 KRDS 토큰과 홈·관리자 레이아웃, 헤더·푸터 변형을 등록해야 한다.

### 이벤트·함수·권한·DB 관계

- 파일 저장소에는 events, functions, controllers, columns 전용 collection이 없다.
- screen-builder의 이벤트는 화면 문서 내부에만 존재한다.
- 이벤트 → 함수 → API → 컨트롤러 → 서비스 → DB → 권한의 추적 자산을 별도 등록해야 한다.

## 권장 구현 순서

1. API·컨트롤러·DB·페이지 매니페스트 자동 수집 범위를 바로잡는다.
2. 인프라, 배치, IP 화이트리스트, AI 격납고의 고정 데이터를 제거한다.
3. 홈 페이지 작업대를 Patroni 작업 원장으로 전환한다.
4. 성능, 알림, 화면 흐름, 화면-메뉴 귀속, WBS, 백업·복구의 변경 계약을 완성한다.
5. 컴포넌트·섹션·테마 레지스트리를 DB 하나로 통합한다.
6. 완료된 화면과 자산만 SDUI 팔레트에 승격한다.
7. 게시·권한·감사·롤백·실제 메뉴 런타임을 통합 검증한다.

## 진행 결과

### 2026-07-11 자산 수집 범위 정상화

- Gradle `settings.gradle.kts`에 포함된 실제 활성 프로젝트만 수집하도록 변경했다.
- 호환용으로 남은 중복 모듈과 backup/archive/generated output은 제외했다.
- 활성 컨트롤러 96개를 모두 등록했다.
- 배열형 class/method mapping과 관리자·영문 별칭을 분리해 API 매핑 1,843개를 등록했다.
- 모든 API 경로가 `/`로 시작하며 비정상 장문 경로가 없음을 검사했다.
- Flyway, Liquibase, 운영 SQL, 검증 SQL을 포함한 활성 DB 자산 57개를 등록했다.
- 따라서 이 문서 상단의 API·컨트롤러·DB 미등록 수치는 최초 감사 시점의 값이며 현재는 해소됐다.
- 남은 핵심 등록 격차는 시스템 화면 46개의 Patroni 페이지 매니페스트와 섹션·테마·이벤트·함수·권한 관계 자산이다.
