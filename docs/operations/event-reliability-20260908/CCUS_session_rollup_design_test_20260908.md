# CCUS 정상 세션 조회 1분 집계 — 설계·구현·검증

검증일: 2026-09-08 KST. 서비스: http://172.16.1.232. 소스: `/opt/Resonance`.

## 1. 목적·적용 범위

누가: 서버 TraceEventService. 언제: 정상 세션 상태 조회가 완료될 때. 어디서: GET `/api/frontend/session`. 무엇을: 요청별 TRACE_EVENT 대신 1분 단위 카운터. 어떻게: PostgreSQL 기본키 + 원자적 UPSERT. 왜: 정상 반복 조회의 개별 추적 행 증가를 줄이되 횟수·지연 측정치를 유지하기 위해서다.

원씽: **정상 반복 조회는 집계하고 오류·업무 기록은 개별 보존한다.**

이번 조건은 모두 만족해야 한다.

1. 기능 설정이 활성화되어 있음.
2. HTTP 메서드가 GET.
3. 경로가 정확히 `/api/frontend/session`.
4. resultCode=SUCCESS.
5. HTTP 상태가 200~299.

`/actuator`는 기존 필터에서 이미 제외되어 있어 새로 수집하지 않았다. 다른 경로, POST, 리다이렉트 3xx, 인증·권한 오류 401/403, 서버 오류 5xx는 기존 개별 추적 방식 그대로다. ACCESS_EVENT, AUDIT_EVENT, ERROR_EVENT와 실제 사용자 UI 이벤트 수집은 변경하지 않았다.

## 2. 집계 데이터 설계

새 테이블: `public.telemetry_technical_minute`.

기본키: `bucket_start + project_id + route + http_method + response_status`.

|항목|내용|
|bucket_start|DB 시각 기준 1분 구간, timestamptz|
|request_count|구간 내 정상 요청 수, bigint|
|duration_sum_ms|응답 시간 합계, bigint|
|duration_max_ms|응답 시간 최댓값|
|first_seen / last_seen|최초·마지막 관측 시각|

평균 응답 시간은 duration_sum_ms / request_count로 계산한다. 개인 계정·이메일·토큰·요청 본문은 집계 테이블에 넣지 않았다. 프로젝트별 기술 성능 집계이며 개인 사용자별 사용 내역은 아니다.

UPSERT 충돌 시 카운터와 응답 시간 합계를 더하고 최댓값을 갱신한다. 프로세스 메모리 버퍼가 아니므로 재시작으로 미전송 버퍼를 잃는 방식은 아니다. 집계 테이블에는 기존 trace_event 소유자를 적용했다.

기존 데이터 삭제 0건. 과거 TRACE_EVENT를 이동·변환·압축하지 않았다. 새 테이블 1개만 추가했다.

## 3. 실패 및 비활성화

- 집계 저장 성공이 확인되면 개별 TRACE_EVENT를 생략한다.
- 집계 SQL 실패 또는 영향 행 수가 1이 아니면 해당 요청의 개별 TRACE_EVENT 저장을 시도한다.
- 집계와 기존 추적 저장이 모두 실패하는 DB 전체 장애까지 무손실을 보장하는 것은 아니다.
- `ccus.telemetry.technical-rollup.enabled=false`로 설정하고 서비스를 재시작하면 개별 추적으로 돌아간다. Spring 환경변수 표기는 `CCUS_TELEMETRY_TECHNICAL_ROLLUP_ENABLED=false`다.
- 설정 변경 시 기존 환경 파일의 다른 값은 보존해야 한다. 집계 테이블은 비활성화만으로 삭제되지 않는다.

## 4. 구현·설치 경로

원본 변경:

- `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/common/trace/TraceEventService.java`
- 같은 모듈의 `src/main/java/egovframework/com/common/mapper/ObservabilityMapper.java`
- 같은 모듈의 `src/main/resources/egovframework/mapper/com/common/ObservabilityMapper.xml`

DB 마이그레이션:

`/opt/Resonance/ops/migrations/20260908_telemetry_technical_minute.sql`

현재 네이티브 PostgreSQL 운영 DB `carbonet`, 포트 35433에 적용했다. 다른 DB 또는 전달용 설치본에서는 해당 DB에 마이그레이션을 별도로 적용해야 한다. 테이블 없는 DB에서는 개별 추적으로 복귀하므로 집계에 의한 절감은 적용되지 않는다.

현재 서버 실행 방법:

```sh
sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -h /opt/Resonance/runtime/postgresql16/socket -p 35433 -d carbonet \
  -f /opt/Resonance/ops/migrations/20260908_telemetry_technical_minute.sql
```

실제 Java 실행 JAR의 대상 클래스 2개와 매퍼 XML만 교체했다. 전체 재빌드는 하지 않았으며 다음 빌드에도 남도록 원본 소스를 수정했다. 반영 재시작부터 health UP까지 **8초**였다. 전체 조사·작업 소요시간이 8초라는 뜻은 아니다.

## 5. 자동 테스트 36개 통과

기존 이벤트 전송·부분 ACK·중복 방지·분류 테스트 29개를 재실행했다. 추가 7개:

1. 정상 세션 조회는 집계하고 개별 trace를 만들지 않음.
2. 302·401·403·500은 개별 trace 유지.
3. POST와 다른 업무 경로는 변경 없음.
4. 집계 성공을 확인하지 못하면 개별 trace로 복귀.
5. 집계 예외 시 개별 trace로 복귀.
6. 기능 설정 비활성화 시 개별 trace로 복귀.
7. 실제 MyBatis 집계 SQL이 request_count를 누적하는지 확인.

명령:

`bash /opt/Resonance/ops/tests/event-reliability/run-idempotency-regression.sh`

## 6. 실제 요청·DB·화면 검증

비로그인 공개 세션 조회 GET 20개를 동시에 전송했다. 확인용 trace ID는 `ccus-qa-rollup-20260908`. 각 응답의 trace ID가 요청과 일치하는지 확인했으며 응답 본문에 포함된 사용자·인증 정보는 출력하지 않았다.

|검증 항목|결과|
|정상 HTTP 200|20/20|
|집계 요청 수|0 → 20|
|집계 행 수|1|
|해당 QA 요청의 개별 TRACE_EVENT|0건|
|응답 시간 합계|471ms|
|응답 시간 최댓값|27ms|
|계산 평균|23.55ms|
|당시 집계 테이블 전체 크기|24kB|

해당 구간의 개별 추적 행은 20개 대신 집계 행 1개가 되어 **행 수 기준 95% 감소**했다. 저장 바이트, DB 쓰기 횟수, 전체 DB 용량이 95% 감소했다는 의미는 아니다. 카운터 갱신을 위한 DB 쓰기는 여전히 요청마다 1회 수행된다. 다른 동시 사용자나 분 경계가 있으면 실시간 재검증 결과는 달라질 수 있다.

실시간 검증 명령은 정상 QA 요청 20건을 발생시킨다:

`bash /opt/Resonance/ops/tests/event-reliability/verify-rollup-live.sh`

홈 화면 HTTP 200, 브라우저 실행 오류 0건, 메뉴와 고정 버튼 렌더링 확인. CCUS 백엔드·프론트 및 P006·Omniverse 서비스 active. 관리자 인증 후 전체 업무, PDF 발급·진위검증 E2E는 이번 범위가 아니다.

## 7. 용량·성능 관리와 다음 작업

- 분 단위 집계도 장기간 보관하면 증가한다. 아직 보존 기간과 자동 삭제는 적용하지 않았다.
- 동일 분·경로의 카운터는 여러 요청이 공유하므로 높은 부하에서 행 잠금 경합이 생길 수 있다. 실제 부하를 측정한 뒤 필요하면 집계 버킷 분할이나 더 적은 빈도의 일괄 기록을 검토한다.
- PostgreSQL UPDATE에 따른 공간 재사용은 autovacuum 상태를 함께 봐야 한다. 과거 대용량 테이블의 디스크 반환은 이번 작업으로 이루어지지 않는다.
- 접근·감사 원장의 정상 세션 중복 기록 여부를 다음에 검토한다. 승인·권한 변경·로그인 실패 등 중요한 업무·보안 기록을 정상 기술 조회와 함께 줄이면 안 된다.
- 원씽 다음 단계: **같은 정상 세션 요청이 접근·감사 원장에 중복 저장되는 부분만 구분하여 추가 절감**.
- 사용자 업무와 화면 기능은 바뀌지 않았으므로 도움말·업무 길잡이·화면 설계 카드의 업무 내용은 임의 수정하지 않았다. 기반 변경 설계와 검증은 이 문서에 기록했다.

[홈 확인](http://172.16.1.232/home)

![홈 검수](C:/Users/jwchoo/Downloads/CCUS_session_rollup_home_20260908.png)
