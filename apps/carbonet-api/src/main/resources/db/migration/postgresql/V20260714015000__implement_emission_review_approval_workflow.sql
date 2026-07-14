ALTER TABLE emission_activity_submission
  DROP CONSTRAINT IF EXISTS emission_activity_submission_submission_state_check;
ALTER TABLE emission_activity_submission
  ADD CONSTRAINT emission_activity_submission_submission_state_check
  CHECK (submission_state IN ('DRAFT','SUBMITTED','IN_VERIFICATION','CORRECTION_REQUIRED','VERIFIED','APPROVED','REJECTED','ACCEPTED'));
ALTER TABLE emission_activity_submission_event
  DROP CONSTRAINT IF EXISTS emission_activity_submission_event_event_type_check;
ALTER TABLE emission_activity_submission_event
  ADD CONSTRAINT emission_activity_submission_event_event_type_check
  CHECK (event_type IN ('CREATED','SUBMITTED','ACCEPTED','REJECTED','CORRECTION_REQUESTED','VERIFICATION_STARTED','VERIFIED','APPROVED'));

CREATE TABLE IF NOT EXISTS emission_submission_review (
  review_id bigserial PRIMARY KEY,
  tenant_id varchar(100) NOT NULL,
  project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE RESTRICT,
  submission_id bigint NOT NULL REFERENCES emission_activity_submission(submission_id) ON DELETE RESTRICT,
  review_stage varchar(30) NOT NULL CHECK (review_stage IN ('VERIFICATION','APPROVAL')),
  decision varchar(30) NOT NULL CHECK (decision IN ('STARTED','PASSED','CORRECTION_REQUESTED','APPROVED','REJECTED')),
  reviewer_id varchar(100) NOT NULL,
  comment_text varchar(1000),
  issue_count integer NOT NULL DEFAULT 0 CHECK (issue_count >= 0),
  calculation_id bigint REFERENCES emission_calculation_run(calculation_id) ON DELETE RESTRICT,
  created_at timestamp NOT NULL DEFAULT current_timestamp
);
CREATE INDEX IF NOT EXISTS idx_emission_review_scope
  ON emission_submission_review(tenant_id,project_id,submission_id,created_at DESC);

ALTER TABLE emission_calculation_run ADD COLUMN IF NOT EXISTS locked_at timestamp;
ALTER TABLE emission_calculation_run ADD COLUMN IF NOT EXISTS locked_by varchar(100);

INSERT INTO framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,case_status) VALUES
('EMISSION_REVIEW_HAPPY','EMISSION_PROJECT','검증 통과 후 승인·확정','HAPPY_PATH','제출 완료 자료와 산정 결과, 검증자·승인자 배정이 존재한다.','["검증 시작","검증 통과","승인"]','["상태=APPROVED","산정버전 잠금","REPORT Task 활성화","검증·승인 이력 보존"]','READY'),
('EMISSION_REVIEW_CORRECTION','EMISSION_PROJECT','검증 보완 요청과 재제출','EXCEPTION','제출 완료 자료에 검증 오류가 존재한다.','["검증 시작","보완 요청","자료 수정","재제출"]','["반려사유 필수","ACTIVITY_DATA Task 재활성화","버전 증가","이전 이력 보존"]','READY'),
('EMISSION_REVIEW_AUTHORITY','EMISSION_PROJECT','검증·승인 액터 권한 분리','AUTHORITY','자료담당자·검증자·승인자가 각각 배정되어 있다.','["자료담당자 승인 시도","검증자 승인 시도","승인자 승인"]','["비인가 액션=403","승인자만 APPROVED 전이"]','READY'),
('EMISSION_REVIEW_TENANT','EMISSION_PROJECT','검증·승인 교차 테넌트 차단','ISOLATION','서로 다른 두 테넌트에 프로젝트와 제출 건이 존재한다.','["A 계정으로 B 제출 검증","A 계정으로 B 제출 승인"]','["모든 교차 접근=403","B 상태·이력 불변"]','READY')
ON CONFLICT(case_code) DO UPDATE SET case_name=excluded.case_name,case_type=excluded.case_type,preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,case_status=excluded.case_status,updated_at=current_timestamp;
