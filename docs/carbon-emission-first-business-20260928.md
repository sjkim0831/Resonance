# 탄소배출 관리 첫 업무 실행 계약

작성일: 2026-09-28 (KST)

## 정본 업무

개발 정의 DB `framework_business_work_type`와 `framework_business_process_sequence`를 실제 정렬로 조회했다.

| 순서 | 업무 종류 | 프로세스 | 상태 | 절차 |
|---|---|---|---|---|
| 1 | 탄소배출 관리 (`EMISSION`, sort 20) | 배출량 프로젝트 포트폴리오 관리 (`EMISSION_PROJECT_PORTFOLIO`, workflow 10, ACTIVE / DEVELOPMENT_READY) | 활성 | `EMISSION_PROJECT_PORTFOLIO_LIST` (step 1) |
| 2 | 탄소배출 관리 | 탄소배출 프로젝트 수행 (`EMISSION_PROJECT`, workflow 20, ACTIVE / DEVELOPMENT_READY) | 활성 | `EMISSION_PROJECT_SETUP`이 첫 후속 절차 |

첫 프로세스는 실제 정의상 조회·선택 절차다. 선택된 `projectId`를 상세로 넘기면 이 절차가 완료된다. 새 프로젝트가 없고 `canCreate=true`이면 등록 화면에서 새 프로젝트를 만들어 동일한 다음 절차로 이어갈 수 있다. 이 등록은 포트폴리오 절차의 별도 DB 단계가 아니라 다음 프로젝트 업무를 시작하기 위한 기존 진입 기능이다.

## 수행 계약

1. **수행자:** 로그인 사용자. 기존 프로젝트는 활성 프로젝트 액터 배정과 tenant 범위로 조회한다. 신규 프로젝트 등록은 활성 전체 범위 `COMPANY_MANAGER` 권한과 회사 승인 상태가 필요하다.
2. **시작 데이터:** 접근 가능한 프로젝트가 있으면 project row와 그 프로젝트 ID. 새 업무인 경우 프로젝트명, 시작일, 종료일, 활성 사업장 ID 1개 이상, 선택 설명이 필요하다.
3. **입력·처리:** 키워드·상태·사업장·기간 검색, 페이지/정렬, 프로젝트 선택. 신규 프로젝트는 동일 입력과 동일 내용 재시도에 고정되는 `clientRequestId`를 포함한다.
4. **저장·완료:** 기존 항목은 선택 동작이라 저장하지 않는다. 신규 항목은 `POST /home/api/emission-project-drafts`가 성공하고 응답 `id`를 반환하면 생성이 완료된다. API는 서버 세션에서 tenant를 정하고 트랜잭션 내 프로젝트·사업장 연결·초기 업무를 저장한다.
5. **재조회·인계:** `/emission/project/detail?projectId={id}`에서 `GET /home/api/emission-projects/{id}/workspace`를 호출한다. `BASIC_INFO` 확인은 기존 `POST /home/api/emission-projects/{id}/setup/confirm`을 사용한다. 성공하면 같은 ID의 상세를 다시 조회하고 `ACTIVITY_DATA`의 `/emission/activity-data?projectId={id}`로 이동한다. 실패하면 현재 업무를 유지한다.

## 화면·API 매핑

- 업무 화면: `/emission/project_list` → `EmissionProjectListMigrationPage` → `GET /home/api/emission-project-list-v1`
- 포트폴리오 호환 화면: `/emission/project-portfolio` → `EmissionProjectPortfolioPage`
- 신규 프로젝트: `/emission/project/create` → `EmissionProjectCreatePage` → `GET /home/api/emission-project-drafts/options`, `POST /home/api/emission-project-drafts`
- 다음 절차/프로젝트 준비 확인: `/emission/project/detail?projectId=...` → `EmissionProjectDetailPage` → `GET /home/api/emission-projects/{id}/workspace`, `POST /home/api/emission-projects/{id}/setup/confirm`
- 담당 역할 배정은 기존 `/emission/work-assignment?projectId=...&processCode=EMISSION_PROJECT` 화면/API를 재사용한다.
- 절차 정의에는 관리자 운영 Route `/admin/emission/project-operations`도 바인딩돼 있다.

## 검증 결과 구분

- 정본 정렬·정의·route binding: 개발 정의 DB에서 읽기 전용 조회.
- 서버: 개발 API는 인증 없이 `401`을 반환. 이는 인증 경계를 확인한 결과이지 업무 데이터 조회 성공이 아니다.
- 브라우저: 개발 URL이 `/signin/loginView`로 이동했다. 정상 로그인된 브라우저 E2E는 아직 실행되지 않았다.
- Playwright 테스트: test-only 사용자·프로젝트·사업장 fixture를 API route mock으로 공급하여 실제 React 화면의 목록→상세→준비 확인 POST→상태 재조회→활동자료 Task 인계, 미충족 조건의 `409` 보존, 등록→POST payload→같은 ID 상세 재조회를 검사한다. 3/3 통과. 실제 DB 저장 검증으로 승격하지 않는다.
- 구현 수정: `EmissionProjectDetailPage`가 데이터가 로드되면 무조건 요약 화면을 반환해 작업상세의 업무 시작·현재 업무 버튼을 숨기던 분기를, 업무 Task가 비어 있는 경우에만 레거시 요약을 사용하도록 좁혔다. 따라서 정의된 프로젝트 Task가 있으면 담당 역할·완료 조건·업무 시작·다음 Route가 표시된다.
- 연결 보정: `BASIC_INFO` target은 조직경계 화면이 아니라 프로젝트 상세 작업공간을 열도록 보정했다. 상세에 서버의 실제 설정 확인 API와 기존 업무 배정 화면으로 가는 링크를 연결했다. 인증·역할·프로젝트 설정 검증은 서버 그대로 적용된다.
- 완료 조건 잔여 gap: 서버는 프로젝트 기본 필드와 5개 역할 배정을 확인한다. 신규 draft 등록은 일부 추가 설정 필드를 채우지 않을 수 있어 서버가 아직 완료를 거부할 수 있다. UI는 이를 우회하지 않고 API 오류를 표시하며 미완료 Task로 남긴다. 이 추가 설정값 입력·저장은 후속 구현 필요.
- Backend test compile: 변경된 Controller 생성자를 반영하도록 `HomePageControllerAuthenticationTest` Fixture에 `EmissionProjectRegistryService` mock 주입을 추가했다. 기존 인증 Assertion은 유지했다.
- 실행: Playwright 2/2 PASS. JUnit Controller 2/2 PASS 및 관련 전체 testCompile PASS. Frontend 표준 typecheck는 격리 Worktree 사전검사에서 중단됐고, 직접 전체 strict 검사에서는 기존 미설치 Vitest/RTL 타입 및 여러 미정리 소스 타입 오류가 확인됐다. 변경 화면의 의존 경로 직접 컴파일(non-strict, 타입 범위 제한)은 PASS다.
- 개발 서버: Vite가 소스 변경을 HMR로 제공 중이며 API Health 200. 서비스 재기동·배포는 하지 않았다.
- 증거 스크린샷은 실제 화면 UI의 Playwright 테스트 결과지만 TEST fixture / API mock / test session 사용이다. 실제 사용자 계정·실제 DB의 브라우저 증거가 아니다.
- DB와 정의 변경: 0건. 프로젝트 fixture는 Playwright mock에만 존재한다.

## 완료 판정

`FIRST_BUSINESS_STATUS=SOURCE_FLOW_CONNECTED_AND_FIXTURE_TESTED; REAL_SETUP_GUARD_REMAINS`로 제한한다. 실사용자의 정상 로그인 개발 브라우저와 DB에서 준비 정보·역할 배정 저장, setup confirm 성공, 활동자료 입력 후 실제 재조회를 검증하기 전에는 `COMPLETE`로 승격하지 않는다.
