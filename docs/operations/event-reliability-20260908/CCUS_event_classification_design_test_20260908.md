# CCUS 사용자·QA·자동 요청 분류 — 설계 및 검증

대상: `/opt/Resonance`, http://172.16.1.232. 검증일: 2026-09-08 KST.

## 1. 이번에 한 일

CCUS 브라우저 이벤트 수집기와 서버 요청 기록기에 분석용 분류 정보를 추가했다. 신규 기록부터 적용된다. 원본 이벤트 삭제, DB 스키마 변경, 샘플링, 보존 기간 변경은 하지 않았다. AI 자동 수정·배포도 활성화하지 않았다.

원씽: **사람의 사용 기록과 테스트·자동 요청을 구분한 다음, 불필요한 정상 로그의 증가량을 줄인다.** 분류 없이 삭제하면 장애 근거까지 잃을 수 있다.

## 2. 분류 구조

브라우저 이벤트의 `payload_summary.summary.usageClassification`에 저장한다.

|필드|값과 판정 기준|
|version|1|
|origin|QA: test=true 또는 QA_ 액션 표식. AUTOMATION: webdriver 힌트. USER_CANDIDATE: 자동화 표식이 없는 브라우저|
|originEvidence|client_test_marker / webdriver_hint / no_automation_hint|
|activity|명시적 polling=true는 POLLING. 지정된 세션·상태 경로는 TECHNICAL_READ. 그 외 UI_ACTION / API / OBSERVATION|
|attention|ui_error, 실패 결과 또는 HTTP 400 이상이면 ERROR_OR_SECURITY. 그 외 NORMAL|
|analyticsEligible|QA·자동화·기술 조회·명시적 폴링은 false. 그 외 분석 후보만 true|
|trust|CLIENT_HINT_NOT_AUTHORITY: 클라이언트 분석 힌트이며 권한 판단 근거가 아님|

일반 브라우저는 실제 사람이라고 확정하지 않는다. QA 표식과 webdriver는 누락·조작될 수 있다. 이 값을 로그인, 권한, 과금, 보안 차단에 사용하면 안 된다.

서버 REQUEST_OUT에는 `payload_summary.usageClassification`을 추가한다.

- origin=UNKNOWN: 서버가 사용자/봇을 단정하지 않는다.
- GET `/api/frontend/session`, GET `/actuator/health`: TECHNICAL_READ.
- `/api/telemetry/events`: TELEMETRY_INGEST.
- 나머지: API_REQUEST.
- HTTP 400 이상은 ERROR_OR_SECURITY를 유지한다.
- 서버 요청 로그 자체는 사용자 사용량 집계 후보로 취급하지 않아 analyticsEligible=false다.
- trust=SERVER_ROUTE_CLASSIFICATION.

경로 목록에 없는 자동 요청을 전부 탐지하는 것은 아니다. POLLING은 명시적으로 표시된 경우만 확정하며, 짧은 시간에 반복했다는 이유만으로 사용자의 반복 클릭을 폴링으로 분류하지 않는다.

## 3. 구현과 적용

변경된 원본 소스:

1. `/opt/Resonance/projects/carbonet-frontend/source/src/platform/telemetry/events.ts`: 분류 함수.
2. 같은 telemetry 폴더의 `useTelemetryTransport.ts`: 대기열에 넣을 때 분류를 한 번 계산하여 재전송 시 유지.
3. `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/common/trace/TraceEventService.java`: 서버 요청 분류와 안전한 JSON 직렬화.

현재 Vite 소스와 실제 실행 JAR에 반영했다. 전체 재빌드 대신 대상 Java 클래스만 교체했다. 적용 재시작부터 health UP까지 **9초**였다. 전체 조사·개발 시간이 9초라는 뜻은 아니다.

## 4. 자동 검증

`bash /opt/Resonance/ops/tests/event-reliability/run-idempotency-regression.sh`

총 **29개 통과**:

- 기존 이벤트 전송·부분 ACK·같은 ID 재전송: 7개.
- 기존 서버 저장·중복 방지·오류·MyBatis 검증: 11개.
- QA 액션, test 표식, 자동 브라우저, 사람으로 단정하지 않음, 명시적 폴링, 기술 조회, QA 오류, 폴링 실패: 8개.
- 서버 세션 조회 분류, 기술 요청 오류 보존, 서버 요청의 사용자 출처 미확정: 3개.

모의 QA 오류 테스트는 테스트 프로세스에서만 수행했다. 운영 오류 원장에 인위적인 오류를 신고하지 않았다.

## 5. 실제 화면·DB 검증

계정: 비로그인 공개 방문자, 자동 브라우저. 화면: `/home`.

- 화면 렌더링 오류 0건.
- 브라우저 이벤트 저장 승인 10건, 2개 묶음.
- 별도 QA 이벤트 2건을 `ccus-qa-classification-20260908`로 표시하여 저장하고 DB에서 다시 읽었다.

|이벤트|origin|activity|analyticsEligible|
|UI_ACTION|QA|UI_ACTION|false|
|API_REQUEST|QA|POLLING|false|

최신 1,000건 이내의 신규 서버 분류 기록: TECHNICAL_READ 8건, API_REQUEST 6건, TELEMETRY_INGEST 2건. 짧은 검증 구간의 관측치이며 전체 사용자 통계나 일간 사용량으로 해석하면 안 된다.

CCUS 백엔드·프론트, P006·Omniverse 서비스 active 확인. 관리자 로그인 이후 업무 완료, PDF 발급·검증 전체 E2E는 이번 범위가 아니다.

## 6. 활용 방법과 한계

1. 사용자 행동 분석은 프론트 page_view/ui_action 등 필요한 이벤트 종류를 고른 뒤 analyticsEligible=true인 신규 기록을 분석 후보로 사용한다. 이것만으로 실제 사람임을 보증하지는 않는다.
2. QA 회귀 분석은 origin=QA, 자동 브라우저 분석은 origin=AUTOMATION으로 분리한다.
3. 오류 분석은 QA 여부와 무관하게 attention=ERROR_OR_SECURITY를 포함해야 한다.
4. 기존 기록은 분류 정보가 없으므로 UNKNOWN/LEGACY로 분리한다. 과거 기록을 실제 사용자로 간주하지 않는다.
5. 기존 대시보드의 모든 SQL과 마케팅 집계 화면까지 자동 변경한 것은 아니다. 분류값을 저장하는 기반과 검증 쿼리를 추가한 단계다.
6. 이번 변경은 메타데이터를 추가하므로 건별 저장량이 소폭 늘어난다. **용량 감소 조치는 아직 아니다.** 다음 단계에서 정상 기술 조회의 집계·샘플링·보존 기간을 적용해야 실제 증가량이 감소한다.
7. 오류·보안·승인 이력은 단순 정상 폴링과 같은 삭제 규칙을 적용하면 안 된다.
8. 도움말·화면 설계·업무 길잡이의 기존 업무 내용과 권한은 바꾸지 않았다. 시스템 수집 기반 변경을 본 설계 문서에 기록했다.

## 7. 다음 작업

정상 TECHNICAL_READ와 TELEMETRY_INGEST의 반복 저장을 집계로 전환할 범위를 결정한다. 우선 세션·상태 조회부터 시작하고 오류는 개별 보존한다. 저장량과 장애 분석 가능성을 함께 비교한 뒤 보존 기간을 적용한다. 기존 데이터의 대량 삭제는 별도 승인 없이 수행하지 않는다.

[홈 확인](http://172.16.1.232/home)

![홈 검수](C:/Users/jwchoo/Downloads/CCUS_event_classification_home_20260908.png)
