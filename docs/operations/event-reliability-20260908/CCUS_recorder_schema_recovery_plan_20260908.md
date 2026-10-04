# 녹화 감사 원장 복구 범위 확정

2026-09-08, 약 2분 읽기 전용 조사. DB 변경·재시작·외부 알림 발송 0건. 과거 데이터 복구 미수행.

## 발견한 기존 원본

기준 경로: /opt/Resonance/runtime/platform-data/dev-worktrees/certificate-verification/

1. ops/scripts/record-process-preview-recorder-audit.sh: 감사 원장·상태 전이 원장의 CREATE/ALTER SQL, 상태 변화 기록, 실패 중복 제한 인덱스.
2. apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260902133000__add_runtime_alert_delivery_ledger.sql: 알림 발송 원장 DDL.
3. ops/scripts/escalate-runtime-alerts.sh: escalation_level, escalated_at 추가와 담당 역할 이관.
4. ops/scripts/dispatch-runtime-alerts.sh: 발송 원장 생성, 재시도, 외부 Slack/메일/webhook 발송.

임의로 테이블 구조를 추정할 필요 없이 기존 계약을 재구성할 근거를 찾았다. 원본 전체 스크립트를 그대로 실행하면 과거 상태 갱신 및 알림 발송까지 포함될 수 있으므로 실행하지 않았다.

## 3개 원장 계약

| 원장 | 핵심 정보·제약 |
|---|---|
| process_preview_recording_audit | bigserial id, source/event/status, alert, reason, process, failures, duration, payload jsonb, occurred_at, acknowledgement, severity, assigned_actor, due_at, workflow, resolution, escalation |
| process_preview_recording_audit_transition | id, audit_id 외래키, from/to 상태, actor, detail, occurred_at |
| process_preview_runtime_alert_delivery | id, audit_id 외래키, channel, attempt_no, delivery_status, http_status, detail, destination_fingerprint, attempted/retry/delivered 시간; audit_id/channel/attempt_no 유일성 |

기존 상태 흐름: DETECTED → ASSIGNED → RESOLVED → CLOSED. 실패 기록은 UNACKNOWLEDGED 상태로 만들고 해결 후 ACKNOWLEDGED 처리한다. source별 미확인 실패 유일 인덱스로 중복 열린 장애를 제한한다.

## 운영 불일치

- 기록·발송·에스컬레이션 스크립트는 18000 포트 프로세스에서 DB 연결 설정을 찾는다.
- 현재 백엔드는 18080을 사용한다. 연결 경로를 최신 운영 서비스 기준으로 맞춰야 한다.
- 18000에도 리스너가 있으므로 단순히 포트가 닫혔다고 판단해서는 안 된다. 그 프로세스를 CCUS 백엔드로 간주해 환경 변수를 읽는 설계가 부정확하다.
- 추가 확인: 수집 서비스 Result=start-limit-hit, ExecMainStatus=0; 에스컬레이션 Result=exit-code, ExecMainStatus=1. 수집기 파일과 PostgreSQL 질의 라이브러리는 존재한다.
- 수집과 에스컬레이션 systemd 서비스는 failed 상태다. 포트 불일치 외에 실행 파일·라이브러리 누락도 별도로 검사해야 하며, failed 원인을 포트 하나로 단정하지 않는다.
- 현재 녹화 서비스의 ExecStart는 /opt/Resonance/ops/scripts/ccus-record-real-pages.cjs이다. 예전 감사 기록 스크립트와의 연결 여부를 검증해야 한다.

## 복구 순서와 완료 기준

1. 기존 DDL에서 스키마 생성 부분만 분리한다. 예전 데이터 보정 UPDATE와 외부 발송은 제외한다.
2. 격리 스키마에서 목록 SQL·발송 집계 SQL·중복 실패 제한·상태 전이·외래키를 검증한다.
3. 운영에 기존 계약의 3개 원장을 생성하되 신규 빈 원장임을 명시한다. 과거 녹화 성공 기록을 만들어 넣지 않는다.
4. 관리자 인증으로 실제 API와 알림센터를 확인한다. 미확인 0건을 녹화 성공이나 전체 검증 완료로 표시하면 안 된다.
5. 현재 실행 경로 기준으로 수집기를 연결하고 실제 상태 변화가 저장되는지 확인한다. 외부 알림 발송·자동 에스컬레이션 활성화는 별도 작업이다.
6. 상태 변경과 전이 이력은 하나의 트랜잭션으로 검증한다. 기존 컨트롤러의 분리 UPDATE/INSERT는 부분 실패 위험이 있어 함께 검토한다.

이번 완료 범위는 원본 발견과 복구 범위 확정이다. 운영 테이블 생성과 화면 검수는 아직 하지 않았다.

원씽: 테이블 생성, 수집 복구, 외부 발송을 분리하여 빈 원장을 정상 녹화 결과로 오인하지 않게 한다.

대상 API: http://172.16.1.232/api/admin/process-preview-recorder-audit
