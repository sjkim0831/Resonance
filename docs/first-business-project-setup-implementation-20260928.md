# 탄소배출 첫 업무 — 프로젝트 준비 입력·저장 연결

작성: 2026-09-28 11:30 KST  
범위: 개발 소스만. 운영 배포·운영 DB 변경·서비스 재기동 없음.

## 실제 업무 경로

1. `/emission/project_list`에서 회사 관리자가 프로젝트를 선택하거나 등록합니다.
2. 등록 화면(`/emission/project/create`)은 활성 사업장, 산정 기간, 보고연도, Scope, 조직 경계, 표준·방법론, 검증수준, 자료수집 주기, 중요성 기준과 마감일을 받습니다. `/options`의 `projectSetupContractVersion=2`가 확인된 경우에만 저장을 허용해 구버전 API의 부분 저장을 막습니다.
3. `POST /home/api/emission-project-drafts`는 tenant를 인증 컨텍스트에서 구하고 입력을 다시 검증합니다. 인증 관리자 계정을 총괄 책임자로 기록합니다.
4. 저장은 `emission_project_registry`의 기존 필드와 `settings_snapshot`에 기록되고, 선택한 동일 `site_id`를 `emission_project_site`에 저장합니다. 생성 요청 ID는 동일 payload 재시도 중 중복 생성을 막습니다.
5. 저장된 `projectId`로 상세 작업공간을 엽니다. 단계별 역할은 기존 `/emission/work-assignment?projectId=<id>&processCode=EMISSION_PROJECT` 및 `POST /home/api/work-assignments` 경로에서 지정합니다.
6. 준비 확인 API는 필수 산정 설정과 5개 프로젝트 역할 배정을 서버에서 검증한 뒤, 통과한 경우에만 `BASIC_INFO`를 완료하고 같은 프로젝트의 `ACTIVITY_DATA`로 넘깁니다.

## 바뀐 소스

- `EmissionProjectCreatePage.tsx`: 계약상 필수 입력, 범위/경계/기준 선택, clientRequestId 기반 재시도, 등록 후 동일 ID 상세 이동.
- `EmissionProjectDraftController.java`: 서버 입력 검증, idempotency fingerprint에 전체 설정 포함, 기존 프로젝트 컬럼과 JSONB 설정 스냅샷에 저장.
- `emission-project-first-business.spec.ts`: 등록화면의 실제 이벤트와 HTTP payload를 검증하고 입력 화면 캡처 생성.

## 검증 결과

- Playwright first-business fixture E2E: 4/4 통과(프로젝트 선택·동일 ID 인계, 설정 입력·생성 응답 유지, 준비 조건 미충족 유지, 구버전 API 부분 저장 차단).
- Backend `EmissionProjectListV1ControllerTest`: 2/2 통과.
- Backend `compile test-compile`: 통과.
- Backend 관련 service 테스트 묶음: 16개 중 15개 통과, 1개가 테스트 DataSource 연결을 얻지 못해 실패. DB 통합 검증으로 보지 않음.
- Frontend 변경 화면 focused TypeScript: 통과.
- Vite production build: `/tmp/carbonet-first-business-build-20260928-final-v2`로 출력, 통과.
- 일반 전체 typecheck: 실패. 기존 test files에서 `vitest`와 `@testing-library/react` 설치 누락.
- `typecheck:incremental` pre-hook: 실패. 프로젝트 정책상 generated closure는 격리 candidate worktree에서만 생성 가능.
- DB/API 실저장, 인증 계정의 역할 배정, 실제 `ACTIVITY_DATA` handoff: 아직 실행 검증 아님.

## 업무상 제한

현재 화면은 방법론 버전, 검증 수준, 중요성 기준 등 기존 화면 계약의 값을 수집·저장합니다. 회사별로 어떤 값을 선택할지 정책이 정본화되어 있지 않다면 임의 기본값을 선택하지 않고 사용자가 지정해야 합니다. 업무 배정 화면에서 같은 projectId로 COMPANY_MANAGER, SITE_DATA_OWNER, CALCULATOR, VERIFIER, APPROVER를 지정하고 업무 분리 규칙을 만족해야 준비 확인이 통과합니다.

## 남은 실제 Gate

정상 인증 세션으로 등록 → 상세 재조회 → 역할 배정 저장 → 준비 확인 → 활동자료 화면에서 동일 projectId 조회를 확인해야 `FIRST_BUSINESS_STATUS=COMPLETE`로 승격할 수 있습니다. 현재 시험은 TEST fixture와 mock API이므로 이 판정을 내리지 않습니다. Frontend는 options API의 `projectSetupContractVersion=2`가 없는 Backend에서 저장을 막습니다.

개발 경로 주의: `172.16.1.232:5175` 화면은 열리지만 Vite의 `/home/api` proxy는 `localhost:18000`을 향합니다. 해당 포트는 systemd `carbonet-production-direct.service`(18080)와 별개인 unmanaged JAR 프로세스이며, 실행 DB/환경 역할을 이 점검에서 확정하지 못했습니다. Controller 변경은 compile만 했고 이 JAR/service는 바꾸지 않았으므로 실제 저장을 시도하지 마세요. 부분 저장 차단이 예상되지만 정상 관리자 세션의 options 응답은 아직 확인하지 않았습니다.
