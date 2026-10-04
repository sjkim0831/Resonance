# CCUS 이벤트 수집 신뢰성 개선 — 설계·구현·검증

작성: 2026-09-08 12:40 KST. 대상: 172.16.1.232, /opt/Resonance.

## 1. 이번 작업의 범위

이벤트를 삭제하거나 자동 AI 수정·배포를 활성화하지 않고, 브라우저 이벤트 전송과 프론트엔드 오류 접수의 신뢰성을 개선했다. 담당자/결재자 업무 규칙, 권한, 메뉴 및 화면 디자인은 변경하지 않았다.

원씽: 기록량을 줄이기 전에 **실제로 저장됐는지 확인할 수 있는 수집 경로**부터 만든다.

## 2. 변경 설계

|구분|이전 문제|이번 변경|
|전송 대기열|전송 전에 20건을 제거하여 토큰 누락 시 유실|최대 20건을 복사해서 보내고 서버의 전체 저장 승인 후 제거|
|실패 처리|HTTP 4xx/5xx도 성공으로 취급|HTTP 상태, success, acceptedCount를 모두 확인|
|재시도|실패 시 짧은 간격 반복|지수형 지연, 최대 60초 간격|
|메모리|대기열 무제한|1,000건 상한, 초과 신규 이벤트는 폐기하고 콘솔 경고|
|토큰|토큰을 발급하지 않는 현재 세션에서도 무조건 중단|세션 조회 성공 시 동일 출처 JSON 요청을 시도, 서버가 허용 여부 결정. 서버 보안 설정은 변경하지 않음|
|반복 오류|카운트가 10에서 멈춰 차단 조건에 도달하지 않음|원자적 접수 판정, 동일 fingerprint 60분당 최대 10건|
|중복 상태|만료된 fingerprint가 계속 남음|오류 접수 시 만료 항목 제거|
|SR 티켓|문자열만 생성하고 ticket_created 응답|기존 SR 저장 포트를 호출하고 성공 응답 확인 후 실제 ticketId 반환|
|상태 표현|승인 대기도 자동 복구 완료처럼 표현|티켓이 없는 승인 대기를 티켓 생성 또는 복구 완료로 표현하지 않음|

수집 흐름: 화면 이벤트 → 최대 1,000건 메모리 대기열 → 최대 20건 전송 → 서버 승인 → 대기열 제거. 실패 시 대기열 유지 후 재시도.

오류 흐름: 오류 신고 → 반복 접수 제한 → 오류 원장 기록 → 분석 → 검토용 SR 저장 → 실제 티켓 ID 응답. **티켓 저장과 코드 자동 수정은 별개다.**

## 3. 변경 파일 및 실행 경로

- 프론트 소스: `/opt/Resonance/projects/carbonet-frontend/source/src/platform/telemetry/useTelemetryTransport.ts`
- 백엔드 소스: `/opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/FrontendErrorReportController.java`
- 실제 Java 실행본: `/opt/Resonance/runtime/host-data/dev-runtime/certificate-verification/backend/runtime/BOOT-INF/lib/carbonet-common-core-1.0.0.jar`
- 자동 회귀 테스트: `/opt/Resonance/ops/tests/event-reliability/run-event-regression.sh`
- 테스트 실행: `bash /opt/Resonance/ops/tests/event-reliability/run-event-regression.sh`

Vite 현재 소스에 프론트 변경을 반영했다. 백엔드는 현재 실행 JAR의 대상 클래스 2개만 교체했다. 전체 빌드·전체 배포는 하지 않았다. 이후 정상 빌드에도 반영되도록 원본 Java 소스도 수정했다.

## 4. 자동 테스트 — 14개 통과

1. 정상 전송 승인 후 대기열 제거.
2. 세션 조회 실패·토큰 없음: 이벤트 유지 후 재시도.
3. 토큰을 발급하지 않는 정상 세션: 서버로 요청 가능.
4. 네트워크 실패: 동일 이벤트 재시도.
5. HTTP 오류: 성공으로 취급하지 않음.
6. 일부 승인: 전체 승인 전까지 대기열 유지.
7. 실제 SR 포트 호출 및 응답 ticketId 일치.
8. 동일 오류 11번째 접수 제한.
9. 저장 예외: logged 응답, 생성 완료라고 표시하지 않음.
10. 저장 포트의 success=false 처리.
11. 사람 승인 필요 응답을 자동 복구 완료로 오인하지 않음.
12. 동시 40건 신고 중 정확히 10건 접수.
13. 실제 SR 저장 구현으로 격리 임시 JSONL 파일에 저장하고 ticketId 재조회·일치 확인.
14. 저장된 SR의 queueStatus=IDLE 확인: 자동 코드 실행을 예약하지 않음.

13~14번은 운영 티켓 파일을 오염시키지 않는 격리 파일 테스트이며, 테스트 파일은 종료 후 제거했다. SR의 현재 저장 구현은 JSONL 파일이며 DB 테이블 저장으로 바꾼 것이 아니다.

## 5. 실제 브라우저와 DB 검증

검증 계정: 비로그인 공개 방문자. 홈 → 로그인 화면 → 인증서 진위확인 화면 순서.

|화면|HTTP|브라우저 실행 오류|확인 범위|
|/home|200|0|메뉴·홈·고정 버튼 렌더링|
|/signin/loginView|200|0|로그인 입력 및 통합인증 버튼 표시|
|/home/certificate-verify|200|0|파일 업로드와 검증 결과 대기 화면|

실제 브라우저의 이벤트 저장 응답: acceptedCount **8 → 2 → 3 → 1**, 모두 HTTP 200 / success=true.

마지막 1건은 `QA_TRANSPORT_SELFTEST`로 표시한 정상 동작 검증용 이벤트다. 운영 PostgreSQL의 최근 1,000건 안에서 다음 1행을 다시 읽어 확인했다.

`trace_id=ccus-qa-telemetry-20260908`, `event_type=UI_ACTION`, `page_id=/home/certificate-verify`.

로그인 인증 수행, 실제 PDF 발급·파일 진위검증, 관리자 SR 화면의 인증된 E2E는 이번 검증에 포함하지 않았다. 화면 렌더링과 전체 업무 완료를 구분한다.

## 6. 재시작 중 발견한 별도 장애와 조치

첫 적용의 상태 확인이 실패하여 실행본을 자동 되돌렸다. 원인은 Java 코드가 아니라 `/home/sjkim/snap/chromium/common/carbonet-pdf-tmp`가 삭제된 디렉터리에 bind mount되어 있었기 때문이다. Tomcat 임시 폴더 생성이 NoSuchFileException으로 실패했다.

`/opt/Resonance/runtime/host-data/pdf-tmp`를 빈 필수 폴더로 다시 생성하고 bind mount를 정상화했다. 과거 PDF·백업 데이터는 복원하지 않았다. 두 번째 적용에서 **재시작부터 health UP까지 4초**였다. 초기 실패·진단 시간을 포함한 전체 작업 시간이 4초라는 뜻은 아니다.

재발 방지 운영 원칙: 실행 프로세스의 임시 폴더와 bind mount 원본 디렉터리는 삭제 대상에서 제외한다. 임시 파일 정리는 디렉터리 자체 삭제와 분리한다. 이번 작업에서는 시스템 전역 정리 도구를 수정하지 않았다.

최종 확인: CCUS 백엔드·프론트엔드, P006·Omniverse 서비스 active. Qwen40 자동 수정 봇 disabled 표식 유지.

## 7. 남은 제한과 다음 작업

1. **정확히 한 번 저장은 아직 보장하지 않는다.** 부분 저장 또는 응답 유실 후 묶음 재시도는 일부 중복 기록을 만들 수 있다. 다음 우선순위는 eventId + DB 고유키 + 이벤트별 ACK다.
2. 대기열은 메모리에만 있다. 탭 종료·새로고침·1,000건 초과 시 영구 보존을 보장하지 않는다.
3. 오류 제한 상태는 프로세스 메모리다. 재시작 시 초기화되고 여러 서버 사이에 공유되지 않는다. 고유 fingerprint 대량 유입에 대한 전체 상한·사용자별 제한도 후속 과제다.
4. 함수명·컴포넌트·사용자와 자동 테스트 구분 등 풍부한 이벤트 설계, UX 집계, 개인정보 마스킹 강화는 후속 범위다.
5. 보존 기간·파티션·샘플링은 아직 적용하지 않았다. 기존 이벤트 삭제 0건, DB 스키마 변경 0건.
6. 도움말·업무 길잡이·QA·화면 설계 카드의 기존 업무 내용은 이번 수집 기반 수정 때문에 임의 변경하지 않았다. 이 문서에 변경 설계와 테스트 근거를 남겼다.

## 8. 화면 증거와 확인 링크

- [홈](http://172.16.1.232/home)
- [로그인](http://172.16.1.232/signin/loginView)
- [인증서 진위확인](http://172.16.1.232/home/certificate-verify)
- [SR 검토 화면](http://172.16.1.232/admin/system/sr-workbench)

![홈](CCUS_event_home_20260908.png)
![로그인](CCUS_event_login_20260908.png)
![인증서 진위확인](CCUS_event_certificate_20260908.png)
