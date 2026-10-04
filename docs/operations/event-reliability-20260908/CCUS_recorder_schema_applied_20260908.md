# 녹화 감사 원장 스키마 복구·검증

2026-09-08 약 4분. 운영 carbonet PostgreSQL 35433에 기존 계약 기반 원장 3개를 생성했다. 서비스 재시작 0회, 기존 데이터 삭제 0건, 외부 알림 발송 0건.

## 적용 설계

기존 record-process-preview-recorder-audit.sh, escalate-runtime-alerts.sh 및 V20260902133000__add_runtime_alert_delivery_ledger.sql에서 스키마 계약을 취합했다. 예전 데이터 보정 UPDATE와 기록·알림 실행 코드는 제외했다.

1. process_preview_recording_audit: 감사 상태, payload, 담당 역할, 조치 기한, 해결·확인·에스컬레이션 정보.
2. process_preview_recording_audit_transition: 원장 FK 및 상태 전이 이력.
3. process_preview_runtime_alert_delivery: 발송 시도와 결과, 원장/채널/시도 번호 유일성.

기존 source별 미확인 실패 유일 인덱스와 조회 인덱스를 유지했다. 해당 3개 테이블이 하나라도 이미 존재하면 운영 적용 스크립트는 중단한다. 부분 스키마 덮어쓰기나 과거 데이터 변경을 하지 않는다.

## 격리 검증

운영과 분리된 임시 스키마를 하나의 트랜잭션에서 생성했다. 테스트 종료 시 ROLLBACK하여 스키마·합성 데이터가 남지 않음을 확인했다.

- 동일 DDL 2회 실행 성공.
- 동일 source 미확인 실패 중복 삽입 거부.
- 없는 audit_id의 전이 삽입 거부.
- 동일 발송 시도 중복 삽입 거부.
- ASSIGNED → RESOLVED → CLOSED 및 전이 2건 확인.
- 컨트롤러 목록 SQL 실행 성공: WEBHOOK:DELIVERED(2), 발송 시도 2건 반환.
- 미확인 수 0 반환, 종료 후 테스트 스키마 없음 확인.

이는 DB 계약 검증이다. 기존 Java 컨트롤러의 다중 SQL 작업이 원자적으로 처리된다는 증거는 아니며 컨트롤러 트랜잭션 개선은 별도다.

## 운영 검증

- 3개 원장 생성 트랜잭션 COMMIT 성공.
- 기존 trace_event 소유자와 동일한 소유자로 생성.
- 실행 중 서비스의 DB 사용자명을 안전하게 읽어 그 ROLE로 목록·미확인 집계 SQL을 실행: 성공. 자격증명 출력 없음.
- 운영 원장 목록은 신규 빈 원장으로 0건이다. 과거 감사 이력이나 과거 녹화 성공이 복원된 것이 아니다.
- 현재 수집기 및 외부 알림 서비스를 활성화하지 않았다. 수집 경로의 예전 18000 프로세스 참조 문제는 남아 있다.
- 관리자 인증 브라우저에서 API와 알림센터 재검증은 미수행이다. SQL 성공을 전체 E2E 성공이라고 보고하지 않는다.

## 시각 확인

홈 HTTP 200, pageerror 0. 캡처를 확인하여 헤더, 아이콘, 업무 길잡이·QA·화면 설계 버튼 표시를 확인했다. 홈 점검은 관리자 감사 화면 검수와 다르다.

![홈 상태](CCUS_recorder_schema_home_20260908.png)

## 재현 가능한 파일

/opt/Resonance/ops/tests/event-reliability/

- recorder-audit-schema.sql: 생성 DDL
- test-recorder-schema.sql: 격리 테스트(종료 시 롤백)
- recorder-list-query.sql: 실제 컨트롤러 목록 SQL
- apply-recorder-schema.sql: 신규 생성 전용 운영 적용(이미 존재하면 중단)
- verify-recorder-runtime-role.py: 실제 사용자 ROLE 확인용 보조 스크립트. 현재 목록 SQL 입력 위치는 /tmp/recorder-list-query.sql이므로 실행 전 해당 파일을 준비해야 한다.

## 다음 작업

원씽: 감사 저장소 부재는 해소했지만 빈 원장을 정상 녹화 완료로 간주하지 않는다.
다음은 수집기의 현재 서비스·DB 연결 경로를 정정하고 외부 발송 없이 실제 상태 기록을 검증하는 것이다. 관리자 인증 후 API·알림센터 확인도 남아 있다.

대상 API: http://172.16.1.232/api/admin/process-preview-recorder-audit
