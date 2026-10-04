# CCUS 이벤트 중복 저장 방지 — 설계·구현·검증

검증일: 2026-09-08 KST. 대상: http://172.16.1.232, /opt/Resonance.

## 1. 목적과 범위

누가: CCUS 브라우저 이벤트 수집기와 서버 수집 API.
언제: 네트워크 실패, 응답 유실, 부분 저장 등으로 같은 이벤트를 재전송할 때.
어디서: `/api/telemetry/events` → PostgreSQL `TRACE_EVENT`, 신규 이벤트에 한해 접근·오류 보조 기록.
무엇을: 동일 이벤트의 중복 저장을 방지하고 이벤트별 저장 확인 응답을 제공한다.
어떻게: 브라우저의 고정 이벤트 ID + 서버의 결정적 원장 키 + 기존 DB 기본키 충돌 처리.
왜: 재전송으로 로그 용량·조회 수·분석 통계가 부풀려지는 문제를 줄인다.

원씽: **응답 유실이 발생해도 같은 이벤트는 다시 저장하지 않고 저장 사실만 다시 확인한다.**

## 2. 변경 설계

1. 브라우저가 대기열에 넣는 순간 128비트 난수 `eventId`를 만든다. HTTP 환경에서도 동작하는 `crypto.getRandomValues`를 사용한다.
2. 재시도할 때 새 ID를 만들지 않고 최초 ID와 입력 내용을 유지한다.
3. 서버는 프로젝트 ID, 클라이언트 ID를 포함한 이벤트 전체 내용을 결정적으로 직렬화하여 `FE_...` 원장 키를 만든다. 동일 ID에 다른 내용이 들어오면 별도 이벤트로 취급하므로 다른 기록을 잘못 억제하지 않는다.
4. PostgreSQL의 기존 `TRACE_EVENT.EVENT_ID` 기본키를 활용한다. `INSERT ... ON CONFLICT (EVENT_ID) DO NOTHING`으로 동시에 들어온 동일 이벤트도 1건만 저장한다.
5. 응답은 `acceptedCount`, `acceptedEventIds`, `newCount`, `success`를 제공한다. 이미 저장된 이벤트도 acceptedEventIds에 포함되며 newCount에는 포함되지 않는다.
6. 접근·오류 보조 기록 생성에는 이번에 새로 저장된 이벤트만 전달한다. 재전송은 반복 생성하지 않는다.
7. 브라우저는 ACK에 포함된 ID만 대기열에서 제거한다. 일부만 저장되면 나머지만 재전송한다.
8. 한 요청은 최대 100건으로 제한한다. 브라우저 기존 묶음 크기는 20건, 대기열 상한은 1,000건이다.

DB 스키마 변경 0건, 기존 데이터 삭제 0건, 새 대용량 테이블 0개. 과거 데이터 전체 스캔·변환·재작성은 수행하지 않았다.

## 3. 구현 파일

- `projects/carbonet-frontend/source/src/platform/telemetry/useTelemetryTransport.ts`
- `modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/common/trace/FrontendTelemetryEvent.java`
- 같은 trace 폴더의 `TraceEventService.java`
- `.../common/mapper/ObservabilityMapper.java`
- `.../common/web/TelemetryController.java`
- `modules/resonance-common/carbonet-common-core/src/main/resources/egovframework/mapper/com/common/ObservabilityMapper.xml`

모두 `/opt/Resonance` 기준이다. 현재 Java 실행 JAR의 해당 클래스와 MyBatis XML만 교체했고 원본 소스도 동기화했다. 프론트는 현재 Vite 소스에 직접 반영했다. 전체 재빌드는 하지 않았다.

반영 후 최초 재시작부터 health UP까지 **6초**. 진단·구현·테스트 전체 소요시간을 의미하지 않는다.

## 4. 자동 회귀 테스트 18개

### 프론트 7개

1. 정상 승인 후 대기열 제거.
2. 세션 조회 실패 시 유지·재시도.
3. 토큰 미발급 정상 세션 처리.
4. 네트워크 실패 후 같은 ID로 재전송.
5. HTTP 오류 후 같은 ID로 재전송.
6. 기존 acceptedCount 응답과의 호환.
7. 2개 중 1개만 승인된 경우 남은 1개만 같은 ID로 재전송.

### 서버 11개

8. 같은 입력 재전송 시 신규 기록 0건, 저장 확인 1건.
9. 이벤트별 ACK ID 반환.
10. 같은 클라이언트 ID에 다른 내용이 오면 잘못 억제하지 않음.
11. 잘못된 ID는 승인하지 않음.
12. null·잘못된 이벤트를 안전하게 제외.
13. ID가 없는 기존 클라이언트 호환.
14. DB 저장 실패를 승인하지 않음.
15. 컨트롤러가 재전송의 newCount=0을 반환.
16. 재전송을 접근·오류 보조 기록 대상에서 제외.
17. 101건 요청을 400으로 거절.
18. 실제 MyBatis XML 파싱 및 기본키 충돌 방지 SQL 확인.

반복 실행: `bash /opt/Resonance/ops/tests/event-reliability/run-idempotency-regression.sh`

## 5. 실제 서버·DB 검증

계정: 비로그인 공개 방문자. 화면: `/home`.
입력: `QA_IDEMPOTENCY_SELFTEST`로 표시한 page_view 1개를 동시에 20회 전송.
고정 trace ID: `ccus-qa-idempotency-20260908`.

- HTTP 저장 확인 응답: 20/20 정상.
- 신규 이벤트 합계: 1건.
- PostgreSQL 최근 기록 재조회: 해당 trace ID의 TRACE_EVENT 1건, ACCESS_EVENT 1건.
- 브라우저 실행 오류: 0건.
- Java 서비스를 재시작한 후 같은 이벤트를 1회 다시 전송: 저장 확인 1건, 신규 저장 0건. DB 재조회도 TRACE_EVENT 1건·ACCESS_EVENT 1건 유지. 메모리 캐시에만 의존하지 않는 것을 확인했다.
- 오류 신고·자동 SR 생성·자동 코드 실행을 유발하는 입력은 사용하지 않았다.

여기서 1건이라는 수치는 **해당 사용자 이벤트** 기준이다. 실제 HTTP 요청 20회에 대한 서버 요청 로그는 별도 기술 기록이므로 합쳐서 1건으로 줄이지 않는다.

## 6. 호환·한계·다음 작업

- eventId가 없는 구형 클라이언트는 계속 수집하되 중복 방지를 보장하지 않는다. 오래 열린 탭은 새로고침하여 새 전송기를 사용한다.
- 중복 방지는 동일 프로젝트·클라이언트 ID·내용의 재전송 기준이다. 사용자가 같은 버튼을 실제로 두 번 누르면 서로 다른 이벤트로 남긴다.
- TRACE_EVENT가 기준 원장이고 접근·오류 보조 기록은 기존처럼 최선 노력 방식이다. 원장 저장 직후 서버가 중단되거나 보조 저장이 실패하면 보조 기록이 누락될 수 있다. 모든 원장을 원자적으로 보장하는 트랜잭션·outbox는 아직 구현하지 않았다.
- 서버에서 유효하지 않다고 판단한 이벤트는 승인하지 않는다. 클라이언트의 영구 실패 분류·폐기 통계는 후속 과제다.
- 대기열은 메모리 기반이다. 탭 종료·새로고침·상한 초과 시 영구 보존을 보장하지 않는다.
- 기존 보존 기간·샘플링·파티션 정책 및 AI 자동 수정 비활성 설정은 변경하지 않았다.
- 다음 우선순위: 실제 사용자/QA·자동 폴링 구분과 반복 정상 요청 집계, 그다음 목적별 보존 기간 적용.
- 사용자 업무 절차가 바뀐 작업이 아니므로 도움말·업무 길잡이·메뉴·화면 설계 카드의 업무 설명을 임의 변경하지 않았다. 수집 기반 변경은 본 설계·검증 문서로 기록한다.

## 7. 확인 링크

- [홈](http://172.16.1.232/home)
- [화면 증거](C:/Users/jwchoo/Downloads/CCUS_event_idempotency_home_20260908.png)
- [이전 1차 개선 설계](C:/Users/jwchoo/Downloads/CCUS_event_reliability_implementation_20260908.md)
