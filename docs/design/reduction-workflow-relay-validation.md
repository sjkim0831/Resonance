# 감축 관리 17개 화면 계정 릴레이 검증

## 판정

- 화면 설계: 17개
- 실제 런타임 프로세스: 7종
- 실행한 런타임 단계: 28개(프로세스당 4단계)
- QA 시나리오: 필수값, 저장 재조회, 버전 충돌, 테넌트 격리, 액터 권한, 예외, 완료·인계
- 결과: 7종 모두 PASS, 업무 실행·이벤트·임시저장 데이터는 트랜잭션 롤백
- 공통 셸: GNB·푸터 변경 없음

## 화면 → 실제 프로세스 → 계정·액터

| 순서 | 화면 | 실제 프로세스/단계 | 기본 QA 계정 | 실행 액터 | 핵심 출력 |
|---:|---|---|---|---|---|
| 1 | 감축 목표 | REDUCTION_TARGET_PLANNING / REQUEST | qaowner26 | REDUCTION_MANAGER | 감축 목표안 |
| 2 | 기준연도 | REDUCTION_TARGET_PLANNING / EXECUTE | qaowner26 | REDUCTION_MANAGER | 확정 기준선 |
| 3 | 조직·사업장 목표 | REDUCTION_TARGET_PLANNING / REVIEW | qaverify26 | VERIFIER | 조직·사업장 목표 |
| 4 | 감축 로드맵 | REDUCTION_ROADMAP / REQUEST | qaowner26 | REDUCTION_MANAGER | 감축 로드맵 |
| 5 | 감축 과제 목록 | REDUCTION_ROADMAP / EXECUTE | qaowner26 | REDUCTION_MANAGER | 과제 포트폴리오 |
| 6 | 감축 과제 등록 | REDUCTION_PROJECT_REGISTRATION / REQUEST | qaowner26 | REDUCTION_MANAGER | 감축 과제안 |
| 7 | 담당자·예산·일정 | REDUCTION_PROJECT_REGISTRATION / EXECUTE | qaowner26 | REDUCTION_MANAGER | 실행 자원계획 |
| 8 | 예상 감축량 | REDUCTION_PROJECT_REGISTRATION / REVIEW | qaverify26 | VERIFIER | 예상 감축량 |
| 9 | 과제 승인 | REDUCTION_PROJECT_APPROVAL / REQUEST | qaapprove26 | APPROVER | 승인 과제 |
| 10 | 감축 실적 | REDUCTION_PERFORMANCE / REQUEST | qaowner26 | REDUCTION_MANAGER | 감축 실적 |
| 11 | 목표 대비 실적 | REDUCTION_PERFORMANCE / REVIEW | qaverify26 | VERIFIER | 목표 차이 검증결과 |
| 12 | 비용 대비 효과 | REDUCTION_SCENARIO / REQUEST | qacalc26 | DATA_ANALYST | 비용효과 분석 |
| 13 | 감축 수단 분석 | REDUCTION_SCENARIO / EXECUTE | qacalc26 | DATA_ANALYST | 감축 수단 후보 |
| 14 | 한계감축비용 | REDUCTION_SCENARIO / REVIEW | qaverify26 | VERIFIER | 한계감축비용 곡선 |
| 15 | 우선순위 | REDUCTION_ROADMAP / REVIEW | qaverify26 | VERIFIER | 감축 투자 우선순위 |
| 16 | 투자 계획 | REDUCTION_PROJECT_APPROVAL / COMPLETE | 감사자 배정 계정 | AUDITOR | 확정 투자계획 |
| 17 | 성과 보고서 | REDUCTION_REPORTING / REQUEST | qaowner26 | REDUCTION_MANAGER | 감축 성과보고서 |

## 자동 검증 결과

| 프로세스 | 단계 | 필수값 | 저장·재조회 | 충돌 | 격리 | 권한 | 예외 | 완료·인계 |
|---|---:|---|---|---|---|---|---|---|
| REDUCTION_TARGET_PLANNING | 4 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| REDUCTION_ROADMAP | 4 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| REDUCTION_PROJECT_REGISTRATION | 4 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| REDUCTION_PROJECT_APPROVAL | 4 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| REDUCTION_PERFORMANCE | 4 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| REDUCTION_SCENARIO | 4 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| REDUCTION_REPORTING | 4 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

## 운영 규칙

1. 프로젝트별 `REDUCTION_MANAGER`, `DATA_ANALYST`, `VERIFIER`, `APPROVER`, `AUDITOR` 활성 배정이 선행되어야 한다.
2. 화면은 `tenantId`, `projectId`, `processCode`, `stepCode`를 실제 업무 실행 작업공간으로 전달한다.
3. 저장은 `draftVersion`, 완료는 `idempotencyKey`와 현재 액터 권한을 검증한다.
4. 다른 테넌트·프로젝트·액터 요청은 거부하고 감사 증거를 남긴다.
5. 화면별 기능 추가 시 JSON 계약과 런타임 카탈로그를 함께 수정하고 자동 계약을 재실행한다.

## QA 프로젝트 공식 업무배정 (2026-08-21)

- 대상: `PRJ-ACTOR-TEST`
- 공식 저장 API: `POST /home/api/work-assignments`
- 저장·재조회: 8개 프로세스, 프로세스 담당 8건, 단계 담당 32건 모두 PASS
- 계정 릴레이: `qaowner26`(REDUCTION_MANAGER), `qacalc26`(DATA_ANALYST), `qaverify26`(VERIFIER/AUDITOR), `qaapprove26`(APPROVER)
- 기존 감축 배정: 0건을 저장 직전 다시 확인했으므로 덮어쓴 데이터 0건
- 다른 프로젝트: 저장 요청의 `projectId`를 `PRJ-ACTOR-TEST`로 고정했으며 변경 대상 0건
- 빌드·배포·DB 백업: 각 0회

### 발견된 폐쇄 결함과 수정

배정 저장 후 공식 프로세스 동기화를 실행했지만 감축 task는 0건이었다. 원인은
`framework_sync_project_processes`의 적용 업무 종류에 `REDUCTION`이 빠져 있었기
때문이다. `V20260821112000__include_reduction_in_project_process_sync.sql`은 다음을
보장한다.

1. 프로젝트 프로세스 동기화 범위에 `REDUCTION`을 추가한다.
2. 이미 감축 단계 배정이 존재하는 프로젝트만 선택적으로 재동기화한다.
3. `framework_reduction_assignment_delivery_audit`에서 프로세스·32단계 배정과
   실제 `emission_project_task`의 누락 수를 한 행으로 검증한다.
4. Flyway 적용 후 완료 기준은 `assigned_process_count=8`,
   `assigned_step_count=32`, `generated_process_count=8`,
   `generated_task_count=32`, `missing_task_count=0`이다.
