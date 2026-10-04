CREATE TABLE IF NOT EXISTS emission_calculation_submission (
  calculation_submission_id bigserial PRIMARY KEY,
  tenant_id varchar(100) NOT NULL,
  project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE RESTRICT,
  calculation_id bigint NOT NULL REFERENCES emission_calculation_run(calculation_id) ON DELETE RESTRICT,
  submission_id bigint NOT NULL REFERENCES emission_activity_submission(submission_id) ON DELETE RESTRICT,
  idempotency_key varchar(100) NOT NULL,
  submission_status varchar(20) NOT NULL DEFAULT 'SUBMITTED' CHECK (submission_status IN ('SUBMITTED','CANCELLED')),
  submitted_by varchar(100) NOT NULL,
  submitted_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE (tenant_id,project_id,idempotency_key),
  UNIQUE (calculation_id)
);

CREATE TABLE IF NOT EXISTS emission_verification_finding (
  finding_id bigserial PRIMARY KEY,
  tenant_id varchar(100) NOT NULL,
  project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE RESTRICT,
  review_id bigint NOT NULL REFERENCES emission_submission_review(review_id) ON DELETE RESTRICT,
  submission_id bigint NOT NULL REFERENCES emission_activity_submission(submission_id) ON DELETE RESTRICT,
  request_id bigint NOT NULL REFERENCES emission_activity_request(request_id) ON DELETE RESTRICT,
  finding_code varchar(80) NOT NULL,
  finding_detail varchar(1000) NOT NULL,
  finding_status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (finding_status IN ('OPEN','RESOLVED')),
  created_by varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  resolved_at timestamp,
  UNIQUE (review_id,request_id,finding_code)
);

CREATE TABLE IF NOT EXISTS emission_result_lock (
  result_lock_id bigserial PRIMARY KEY,
  tenant_id varchar(100) NOT NULL,
  project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE RESTRICT,
  submission_id bigint NOT NULL REFERENCES emission_activity_submission(submission_id) ON DELETE RESTRICT,
  calculation_id bigint NOT NULL REFERENCES emission_calculation_run(calculation_id) ON DELETE RESTRICT,
  idempotency_key varchar(100) NOT NULL,
  lock_status varchar(20) NOT NULL DEFAULT 'LOCKED' CHECK (lock_status='LOCKED'),
  locked_by varchar(100) NOT NULL,
  locked_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE (tenant_id,project_id,idempotency_key),
  UNIQUE (calculation_id)
);

CREATE INDEX IF NOT EXISTS ix_emission_finding_request ON emission_verification_finding(request_id,finding_status);
CREATE INDEX IF NOT EXISTS ix_emission_calculation_submission_scope ON emission_calculation_submission(tenant_id,project_id,submitted_at DESC);
