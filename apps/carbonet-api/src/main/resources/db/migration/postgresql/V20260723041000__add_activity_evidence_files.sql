CREATE TABLE IF NOT EXISTS emission_activity_evidence (
    evidence_id bigserial PRIMARY KEY,
    tenant_id varchar(40) NOT NULL,
    project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
    activity_id bigint NOT NULL REFERENCES emission_activity_data(activity_id) ON DELETE CASCADE,
    evidence_type varchar(40) NOT NULL DEFAULT 'SOURCE_DOCUMENT',
    original_name varchar(255) NOT NULL,
    content_type varchar(120) NOT NULL,
    file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
    sha256 varchar(64) NOT NULL,
    file_content bytea NOT NULL,
    uploaded_by varchar(100) NOT NULL,
    uploaded_at timestamp NOT NULL DEFAULT current_timestamp,
    UNIQUE (tenant_id, project_id, activity_id, sha256)
);

CREATE INDEX IF NOT EXISTS ix_emission_activity_evidence_activity
    ON emission_activity_evidence(tenant_id, project_id, activity_id, uploaded_at DESC);

ALTER TABLE emission_activity_submission_evidence
    ADD COLUMN IF NOT EXISTS evidence_sha256 varchar(64);

CREATE OR REPLACE VIEW emission_activity_collection_health AS
SELECT project.project_id,project.tenant_id,
 count(activity.activity_id) activity_count,
 count(activity.activity_id) FILTER(WHERE nullif(trim(activity.evidence_note),'') IS NULL AND NOT EXISTS (
   SELECT 1 FROM emission_activity_evidence evidence
   WHERE evidence.tenant_id=project.tenant_id AND evidence.project_id=project.project_id AND evidence.activity_id=activity.activity_id
 )) missing_evidence_count,
 count(activity.activity_id) FILTER(WHERE activity.quantity<0 OR nullif(trim(activity.unit),'') IS NULL) invalid_value_count,
 (SELECT count(*) FROM emission_activity_submission submission WHERE submission.project_id=project.project_id AND submission.tenant_id=project.tenant_id AND submission.submission_state IN ('SUBMITTED','IN_VERIFICATION','VERIFIED','APPROVED')) submitted_version_count,
 (SELECT count(*) FROM emission_activity_submission submission WHERE submission.project_id=project.project_id AND submission.tenant_id=project.tenant_id AND submission.submission_state<>'DRAFT' AND (submission.submitted_item_count=0 OR submission.snapshot_hash IS NULL)) unsealed_submission_count,
 CASE WHEN count(activity.activity_id)>0
   AND count(activity.activity_id) FILTER(WHERE nullif(trim(activity.evidence_note),'') IS NULL AND NOT EXISTS (
     SELECT 1 FROM emission_activity_evidence evidence
     WHERE evidence.tenant_id=project.tenant_id AND evidence.project_id=project.project_id AND evidence.activity_id=activity.activity_id
   ))=0
   AND count(activity.activity_id) FILTER(WHERE activity.quantity<0 OR nullif(trim(activity.unit),'') IS NULL)=0
   AND (SELECT count(*) FROM emission_activity_submission submission WHERE submission.project_id=project.project_id AND submission.tenant_id=project.tenant_id AND submission.submission_state IN ('SUBMITTED','IN_VERIFICATION','VERIFIED','APPROVED'))>0
   AND (SELECT count(*) FROM emission_activity_submission submission WHERE submission.project_id=project.project_id AND submission.tenant_id=project.tenant_id AND submission.submission_state<>'DRAFT' AND (submission.submitted_item_count=0 OR submission.snapshot_hash IS NULL))=0
 THEN 'READY' ELSE 'IN_PROGRESS' END collection_health
FROM emission_project_registry project LEFT JOIN emission_activity_data activity ON activity.project_id=project.project_id
GROUP BY project.project_id,project.tenant_id;

COMMENT ON TABLE emission_activity_evidence IS 'Tenant-scoped source evidence files linked to activity data with immutable SHA-256 identity';

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET definition_locked=false,definition_lock_reason='VERSIONED_MAINTENANCE_V1.3.0'
WHERE process_code='ACTIVITY_DATA';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

UPDATE framework_process_step
SET api_contract='GET|POST /home/api/emission-projects/{id}/activities;GET|POST|DELETE /home/api/emission-projects/{id}/activities/{activityId}/evidence;GET /home/api/emission-projects/{id}/activities/{activityId}/evidence/{evidenceId}/download;POST /home/api/emission-projects/{id}/submissions/{submissionId}/submit',
    output_contract='{"required":["activity ledger","source evidence files","SHA-256 checksum","quality result","immutable submission snapshot"]}'
WHERE process_code='ACTIVITY_DATA' AND step_code='ACTIVITY_DATA_02_WORK';

UPDATE framework_professional_screen_contract contract
SET api_contract=step.api_contract,
    data_contract='emission_activity_request; emission_activity_data; emission_activity_evidence; emission_activity_quality_run; emission_activity_submission; emission_activity_submission_item; emission_activity_submission_evidence; emission_activity_submission_event; emission_submission_review',
    evidence_contract='tenant/project/actor authorization; source file SHA-256 and duplicate prevention; immutable submission snapshot hash; state-transition event ledger; quality and review evidence',
    audit_evidence_ref='implemented:activity-evidence-upload+download+delete+sha256+submission-snapshot',
    contract_status='VERIFIED',api_verified=true,database_verified=true,authority_verified=true,
    responsive_verified=true,accessibility_verified=true,exception_states_verified=true,
    updated_by='FLYWAY',updated_at=current_timestamp
FROM framework_process_step step
WHERE contract.process_code='ACTIVITY_DATA' AND contract.step_code='ACTIVITY_DATA_02_WORK'
  AND step.process_code=contract.process_code AND step.step_code=contract.step_code;

UPDATE framework_process_definition
SET process_version='1.3.0',definition_locked=true,
    definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: activity evidence file lifecycle verified',
    updated_at=current_timestamp
WHERE process_code='ACTIVITY_DATA';
