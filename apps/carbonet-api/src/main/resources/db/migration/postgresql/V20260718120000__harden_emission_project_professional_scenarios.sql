-- Implemented process steps are immutable. Operational SLA and segregation
-- policy is versioned separately so design hardening never rewrites the
-- established process definition.
CREATE TABLE IF NOT EXISTS framework_process_step_operating_policy (
 process_code varchar(80) NOT NULL,
 step_code varchar(100) NOT NULL,
 policy_version integer NOT NULL DEFAULT 1,
 sla_hours integer NOT NULL CHECK(sla_hours BETWEEN 1 AND 720),
 escalation_actor_code varchar(80) NOT NULL REFERENCES framework_actor_definition(actor_code),
 segregation_actor_codes varchar(1000) NOT NULL,
 effective_from timestamp NOT NULL DEFAULT current_timestamp,
 active_yn char(1) NOT NULL DEFAULT 'Y' CHECK(active_yn IN('Y','N')),
 created_at timestamp NOT NULL DEFAULT current_timestamp,
 updated_at timestamp NOT NULL DEFAULT current_timestamp,
 PRIMARY KEY(process_code,step_code,policy_version),
 FOREIGN KEY(process_code,step_code) REFERENCES framework_process_step(process_code,step_code)
);

INSERT INTO framework_process_step_operating_policy
(process_code,step_code,policy_version,sla_hours,escalation_actor_code,segregation_actor_codes)
SELECT 'EMISSION_PROJECT',v.step_code,1,v.sla_hours,v.escalation_actor_code,v.segregation_actor_codes
FROM (VALUES
 ('EMISSION_PROJECT_SETUP',24,'PLATFORM_OPERATOR','APPROVER'),
 ('EMISSION_PROJECT_COLLECT',72,'COMPANY_MANAGER','APPROVER'),
 ('EMISSION_PROJECT_CALCULATE',4,'COMPANY_MANAGER','VERIFIER,APPROVER'),
 ('EMISSION_PROJECT_VALIDATE',24,'COMPANY_MANAGER','CALCULATOR,APPROVER'),
 ('EMISSION_PROJECT_CORRECT',48,'COMPANY_MANAGER','VERIFIER,APPROVER'),
 ('EMISSION_PROJECT_APPROVE',24,'COMPANY_MANAGER','CALCULATOR,VERIFIER'),
 ('EMISSION_PROJECT_REPORT',8,'PLATFORM_OPERATOR','APPROVER')
) v(step_code,sla_hours,escalation_actor_code,segregation_actor_codes)
ON CONFLICT(process_code,step_code,policy_version) DO UPDATE SET
 sla_hours=excluded.sla_hours,escalation_actor_code=excluded.escalation_actor_code,
 segregation_actor_codes=excluded.segregation_actor_codes,active_yn='Y',updated_at=current_timestamp;

INSERT INTO framework_simulation_case
(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,
 case_status,severity,required_evidence,automated,expected_duration_minutes)
VALUES
('EMISSION_PROJECT_CONCURRENCY','EMISSION_PROJECT','동시 수정과 낙관적 잠금','CONCURRENCY',
 '같은 프로젝트 버전을 조회한 두 개의 허가된 세션이 존재한다.',
 '["두 세션이 같은 version으로 수정 요청","첫 요청 커밋","두 번째 요청 커밋"]',
 '["첫 요청만 성공","두 번째 요청은 409","기존 값과 첫 변경 이력 보존","재조회 후 재시도 가능"]',
 'READY','CRITICAL','HTTP_STATUS,ROW_VERSION,AUDIT_EVENT,DATA_SNAPSHOT',true,10),
('EMISSION_PROJECT_IDEMPOTENCY','EMISSION_PROJECT','중복 명령 멱등 처리','IDEMPOTENCY',
 '동일한 actor, project, command와 idempotency key가 준비되어 있다.',
 '["동일 명령을 동시에 두 번 전송","완료 후 같은 키로 다시 전송"]',
 '["업무 결과 한 건","상태 전이 한 건","알림과 증거 한 건","모든 응답이 같은 결과 식별자 반환"]',
 'READY','CRITICAL','IDEMPOTENCY_RECORD,STATE_TRANSITION,AUDIT_EVENT,NOTIFICATION_EVENT',true,10),
('EMISSION_PROJECT_DEADLINE','EMISSION_PROJECT','마감과 에스컬레이션','DEADLINE',
 '단계별 SLA와 담당자 및 에스컬레이션 액터가 배정되어 있다.',
 '["SLA 80% 도달","마감 도달","마감 초과","담당자가 작업 완료"]',
 '["사전 알림 한 건","지연 상태 표시","에스컬레이션 알림 한 건","완료 시 지연 해제와 이력 보존"]',
 'READY','MAJOR','TASK_DEADLINE,NOTIFICATION_EVENT,AUDIT_EVENT,STATE_TRANSITION',true,10),
('EMISSION_PROJECT_INTEGRATION','EMISSION_PROJECT','외부 연계 실패와 재시도','INTEGRATION',
 '외부 활동자료 또는 보고 연계가 활성화되고 장애 응답을 재현할 수 있다.',
 '["연계 요청","타임아웃 또는 5xx 발생","지수 백오프 재시도","운영자 수동 재처리"]',
 '["업무 트랜잭션 부분 커밋 없음","재시도 횟수와 원인 기록","중복 데이터 없음","복구 후 다음 업무 한 번만 개방"]',
 'READY','MAJOR','INTEGRATION_LOG,RETRY_EVENT,DATA_SNAPSHOT,AUDIT_EVENT',true,15),
('EMISSION_PROJECT_FILE_SECURITY','EMISSION_PROJECT','증빙 파일 보안과 무결성','FILE_SECURITY',
 '정상 파일, 허용되지 않은 확장자, 위조 MIME, 악성 파일과 대용량 파일을 준비한다.',
 '["각 파일 업로드","서버 측 MIME 및 크기 검사","악성코드 검사","다운로드 권한 검사"]',
 '["비정상 파일 격리 또는 거부","정상 파일 해시 저장","다른 tenant 다운로드 차단","검사 결과 감사 기록"]',
 'READY','CRITICAL','FILE_HASH,MALWARE_SCAN,HTTP_STATUS,AUTHORITY_RESULT,AUDIT_EVENT',true,15),
('EMISSION_PROJECT_DATA_QUALITY','EMISSION_PROJECT','단위·배출계수·이상치 품질','DATA_QUALITY',
 '서로 다른 단위, 배출계수 버전, 결측값, 중복값과 이상치가 포함된 활동자료가 존재한다.',
 '["업로드 및 매핑","단위 환산","배출계수 버전 고정","이상치 검증","보완 후 재산정"]',
 '["원본과 정규화 값 동시 보존","적용 계수 버전 스냅샷","품질 오류별 조치","재산정 전후 차이와 사유 기록"]',
 'READY','CRITICAL','DATA_SNAPSHOT,FACTOR_VERSION,VALIDATION_RESULT,CALCULATION_TRACE,AUDIT_EVENT',true,20),
('EMISSION_PROJECT_SEGREGATION','EMISSION_PROJECT','산정·검증·승인 직무분리','SEGREGATION',
 '한 계정에 충돌 역할을 부여한 경우와 분리된 정상 계정을 준비한다.',
 '["산정자가 자기 결과 검증 시도","검증자가 승인 시도","승인권자가 정상 승인"]',
 '["충돌 액션 403","상태 변경 없음","위반 시도 감사 기록","분리된 승인만 APPROVED 전이"]',
 'READY','CRITICAL','AUTHORITY_RESULT,ROLE_ASSIGNMENT,STATE_TRANSITION,AUDIT_EVENT',true,10),
('EMISSION_PROJECT_REPORT_INTEGRITY','EMISSION_PROJECT','보고서·인증서 원본 무결성','REPORT_INTEGRITY',
 '승인된 산정 버전과 보고서 생성 권한 및 공개 검증 경로가 준비되어 있다.',
 '["보고서 생성","데이터셋·시각지문·QR 저장","PDF 다운로드","정상 원본 검증","변조 파일 검증"]',
 '["화면과 PDF 수치 일치","원본 해시와 데이터셋 연결","정상 원본 일치","변조 항목 불일치","검증 접근 이력 저장"]',
 'READY','CRITICAL','REPORT_HASH,DATASET_HASH,VISUAL_FINGERPRINT,VERIFY_RESULT,ACCESS_LEDGER',true,20)
ON CONFLICT(case_code) DO UPDATE SET
 case_name=excluded.case_name,case_type=excluded.case_type,preconditions=excluded.preconditions,
 steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,case_status='READY',
 severity=excluded.severity,required_evidence=excluded.required_evidence,automated=true,
 expected_duration_minutes=excluded.expected_duration_minutes,updated_at=current_timestamp;
