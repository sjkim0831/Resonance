# CCUS 세션 조회 중복 원장 개선 설계·검증

## 1. 작업 범위와 목적

- 일자: 2026-09-08, 이번 적용·검증 약 5분. 백엔드 재시작 2회, 각 5초(합계 10초). 이전 준비·테스트 시간은 제외.
- 대상: /opt/Resonance CCUS 운영 런타임, http://172.16.1.232/api/frontend/session
- 목적: 정상 기술 폴링이 추적·접근·일반 API 감사 원장에 중복 누적되는 현상을 줄인다.
- 기존 데이터 삭제, DB 스키마 변경, 권한 변경, P006 변경 없음.

## 2. 처리 설계

1. 요청 실행 로그 파일 기록은 유지한다.
2. GET /api/frontend/session, HTTP 2xx, 요청 예외 없음인 경우에만 집계를 검토한다.
3. 회사 범위 사유가 비어 있고 판단 값이 비어 있거나 NOT_REQUIRED인 경우 허용한다. ANONYMOUS는 쿠키가 전혀 없는 요청만 허용한다.
4. 분 집계 DB 저장이 1행 성공한 경우에만 접근·일반 API 감사 원장의 중복 기록을 생략한다.
5. 요청 TraceContext에 집계 완료 표시를 남겨 외부 추적 필터가 같은 요청을 두 번 집계하지 않게 한다.
6. 집계 실패, 3xx/4xx/5xx, 권한 판단, 쿠키가 있는 익명 요청, 업무 API 등은 원래 접근·감사 기록을 유지한다.

실제 인터셉터 확인 결과 ANONYMOUS는 인증 쿠키 없음뿐 아니라 유효하지 않은 토큰에도 설정될 수 있다. 따라서 ANONYMOUS 전체를 생략하지 않고 쿠키 없는 정상 공개 세션 조회만 제한적으로 허용한다. ALLOW_GLOBAL 등 실제 권한 판단 기록은 유지한다.

## 3. 수정 소스

기준: /opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/

- common/trace/TraceContext.java: 요청 단위 집계 완료 표시.
- common/trace/TraceEventService.java: 성공 확인 집계 메서드 분리 및 중복 증가 방지.
- common/filter/RequestExecutionLoggingFilter.java: 집계 저장 성공 후에만 중복 원장 생략.
- config/filter/FilterConfig.java: 실제 필터 생성 시 TraceEventService 주입.

실제 런타임 JAR: /opt/Resonance/runtime/host-data/dev-runtime/certificate-verification/backend/runtime/BOOT-INF/lib/carbonet-common-core-1.0.0.jar

필요 클래스만 갱신했다. 전체 프런트엔드 빌드는 하지 않았다. 임시 적용 전 사본은 정상 기동 확인 후 제거했다.

## 4. 자동 테스트

총 51개 PASS. 실제 런타임 의존성을 사용하여 정식 소스로 다시 컴파일·검증했다.

- 새 필터 회귀 테스트 15개: 정상 집계/두 원장 생략/중복 집계 방지, 저장 실패, 302·401·403·500, DENY, 예외, 업무 POST, 컨텍스트 없음, 기능 비활성화, 쿠키 없는 익명 요청, 쿠키 있는 익명 요청, NOT_REQUIRED, ALLOW_GLOBAL 보존.
- 기존 서버·프런트엔드 전달/멱등성/집계 회귀 테스트 36개.
- 테스트 위치: /opt/Resonance/ops/tests/event-reliability/
- 재실행: bash /opt/Resonance/ops/tests/event-reliability/run-idempotency-regression.sh

## 5. 실제 API→DB 검증

프로세스: 비로그인 기술 세션 조회 → 분 집계 저장 → 중복 원장 확인.
계정: 없음. 입력: 쿠키 없는 GET 20건, 고유 QA trace/request ID. 업무 데이터 변경 없음.

| 항목 | 결과 |
|---|---:|
| HTTP 200 및 추적 헤더 확인 | 20/20 |
| 집계 누계 | 57 → 77 |
| 증가량 | 20 |
| QA 추적 ID 개별 TRACE_EVENT | 0 |
| QA 추적 ID ACCESS_EVENT | 0 |
| QA 추적 ID AUDIT_EVENT | 0 |

초기 테스트에서 임의 qaMarker 쿼리를 붙이면 302 로그인 이동이 발생하여 테스트가 실패했다. 기존의 쿼리 없는 실제 엔드포인트로 검증을 정정하고 redirect:manual로 리다이렉트가 성공으로 오인되지 않게 했다. 이 쿼리 포함 경로의 인증 처리는 이번 작업에서 수정하지 않았다.

## 6. 화면 검수

홈 HTTP 200, 브라우저 pageerror 0. 직접 스크린샷을 확인하여 헤더·검색 아이콘·업무 길잡이·화면 설계·QA 업무·도움말 버튼 표시를 확인했다.

![적용 후 홈 화면](CCUS_session_ledger_dedup_home_20260908.png)

비로그인 홈 검수이며 관리자 로그인·PDF 발급 전체 E2E 완료를 의미하지 않는다. 비로그인 screen-context API의 401은 별도이며 pageerror 0과 모든 API 성공은 같은 의미가 아니다.

## 7. 운영 안전과 한계

- 비활성화: ccus.telemetry.technical-rollup.enabled=false 설정 후 백엔드 재시작. 기존 원장 방식으로 돌아간다.
- 과거 DB 용량은 줄어들지 않는다. 앞으로 증가하는 정상 폴링의 중복 행만 감소한다.
- 분 집계도 요청마다 UPSERT하므로 DB 쓰기 자체가 없어지는 것은 아니다.
- 실행 로그 파일은 유지하며, 집계 오류 시 원장 보존 경로를 사용한다. 모든 저장소 동시 장애에 대한 절대적 무손실 보장은 아니다.
- 사용자 업무 안내와 프로세스 내용은 변경하지 않았다. 이 문서는 공통 기술 로깅 설계이며 업무 가이드에 임의 업무를 추가하지 않았다.

## 8. 다음 작업

원씽: 오류 증거는 보존하고 정상 기술 폴링의 중복만 줄인다.
다음: 실행 로그 파일의 중복·보존 기간·회전 설정을 조사하여 신규 증가량을 줄일 후보를 제시한다. 과거 기록 삭제는 별도로 결정한다.
