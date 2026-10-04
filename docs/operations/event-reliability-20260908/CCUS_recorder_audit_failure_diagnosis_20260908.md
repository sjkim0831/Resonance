# 녹화 감사 API 500 오류 원인 점검

## 1. 범위·시간

2026-09-08 14:11~14:13 KST 약 2분. 운영 API, 서버 로그, 컨트롤러 소스, 현재 운영 PostgreSQL 카탈로그를 읽기 전용 점검했다. 코드·DB 변경 및 재시작 0건.

## 2. 확인된 원인

오늘 13:57:08 관리자 요청의 서버 예외:

`BadSqlGrammarException` → `ERROR: relation "process_preview_recording_audit" does not exist`

위치: ProcessPreviewRecorderAuditController.list, SQL 조회 구간.

현재 운영 DB carbonet, 포트 35433에서 아래 3개 테이블이 모두 없다. public.to_regclass 결과 NULL이며 전체 스키마 pg_tables에도 process_preview 접두사 테이블이 없다.

| 테이블 | 사용 기능 | 현재 |
|---|---|---|
| process_preview_recording_audit | 목록, 미확인 수, 장애 조치 상태 | 없음 |
| process_preview_runtime_alert_delivery | 알림 발송 시도·결과 집계 | 없음 |
| process_preview_recording_audit_transition | 배정·해결·종료 전이 이력 | 없음 |

테이블이 언제 또는 어떤 작업으로 사라졌는지는 이번 증거로 확정할 수 없다. 이전 정리나 DB 이전이 원인이라고 단정하지 않는다.

## 3. 인증과 오류 구분

- 비로그인 GET /api/admin/process-preview-recorder-audit: 직접 백엔드와 공개 주소 모두 HTTP 302 로그인 페이지 이동.
- 이 결과는 관리자 기능 정상 판정이 아니다. 관리자 인증을 통과한 요청은 SQL 조회로 들어가며, 위 서버 로그가 테이블 부재 실패를 입증한다.
- 인증을 우회하거나 관리자 계정·토큰을 임의 생성하지 않았다.
- 실제 관리자 세션을 사용한 현재 브라우저 재현·시각 검수는 미수행이다.

## 4. 코드 계약

소스: /opt/Resonance/apps/carbonet-api/src/main/java/egovframework/com/web/ProcessPreviewRecorderAuditController.java

- 목록: 최신 500건과 미확인 실패 건수.
- 전이: /{id}/transitions.
- 조치: ASSIGNED → RESOLVED.
- 확인: RESOLVED → CLOSED와 ACKNOWLEDGED.
- 관리자 권한 검사 후만 실행.

목록 오류를 빈 배열 success=true로 덮으면 실제 녹화·감사 상태를 정상처럼 표시하게 되므로 그렇게 처리하지 않았다.

## 5. 다음 복구 설계

1. 기존 DDL·마이그레이션과 기록 생산자를 찾아 컬럼·기본값·제약·인덱스 계약을 확정한다. 이번 제한 검색 경로에서는 원본 DDL을 발견하지 못했다.
2. 원본을 찾지 못하면 기존 API와 생산자 기준으로 신규 원장 스키마를 설계한다. 신규 빈 원장 생성은 과거 감사 이력 복구가 아니다.
3. 배정·조치·종료를 트랜잭션 단위로 검증하고 관리자 인증 후 목록/알림센터 실제 화면을 확인한다.
4. 스키마 존재·계약 검사 자동화를 추가하여 기동 또는 사전 검증에서 누락을 탐지한다. 자동 재시도만으로 누락 테이블은 복구되지 않는다.

원씽: 녹화 자체의 성공 여부와 감사 저장소 장애를 분리하고, 없는 원장을 정상으로 표시하지 않는다.

대상: http://172.16.1.232/api/admin/process-preview-recorder-audit
