ALTER TABLE emission_activity_submission
  ADD COLUMN IF NOT EXISTS quality_run_id bigint REFERENCES emission_activity_quality_run(run_id),
  ADD COLUMN IF NOT EXISTS snapshot_hash varchar(64),
  ADD COLUMN IF NOT EXISTS submitted_item_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS emission_activity_submission_item (
  submission_id bigint NOT NULL REFERENCES emission_activity_submission(submission_id) ON DELETE CASCADE,
  activity_id bigint NOT NULL REFERENCES emission_activity_data(activity_id) ON DELETE RESTRICT,
  activity_name varchar(200) NOT NULL,
  category varchar(80) NOT NULL,
  activity_period varchar(20) NOT NULL,
  quantity numeric(20,6) NOT NULL,
  unit varchar(30) NOT NULL,
  evidence_note varchar(500) NOT NULL,
  source_hash varchar(64) NOT NULL,
  captured_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(submission_id,activity_id)
);

CREATE INDEX IF NOT EXISTS ix_emission_submission_item_activity
  ON emission_activity_submission_item(activity_id,submission_id);

INSERT INTO emission_activity_submission_item
(submission_id,activity_id,activity_name,category,activity_period,quantity,unit,evidence_note,source_hash)
SELECT submission.submission_id,activity.activity_id,activity.activity_name,activity.category,
       activity.activity_period,activity.quantity,activity.unit,coalesce(nullif(trim(activity.evidence_note),''),'LEGACY_SUBMISSION'),
       md5(concat_ws('|',activity.activity_name,activity.category,activity.activity_period,activity.quantity,activity.unit,activity.evidence_note))
FROM emission_activity_submission submission
JOIN emission_activity_submission_evidence evidence ON evidence.submission_id=submission.submission_id
JOIN emission_activity_data activity ON activity.activity_id=evidence.activity_id
WHERE submission.submission_state<>'DRAFT'
ON CONFLICT(submission_id,activity_id) DO NOTHING;

UPDATE emission_activity_submission submission SET
 submitted_item_count=(SELECT count(*) FROM emission_activity_submission_item item WHERE item.submission_id=submission.submission_id),
 snapshot_hash=(SELECT md5(coalesce(string_agg(item.source_hash,'|' ORDER BY item.activity_id),'')) FROM emission_activity_submission_item item WHERE item.submission_id=submission.submission_id)
WHERE submission.submission_state<>'DRAFT';

CREATE OR REPLACE VIEW emission_activity_collection_health AS
SELECT project.project_id,project.tenant_id,
 count(activity.activity_id) activity_count,
 count(activity.activity_id) FILTER(WHERE nullif(trim(activity.evidence_note),'') IS NULL) missing_evidence_count,
 count(activity.activity_id) FILTER(WHERE activity.quantity<0 OR nullif(trim(activity.unit),'') IS NULL) invalid_value_count,
 (SELECT count(*) FROM emission_activity_submission submission WHERE submission.project_id=project.project_id AND submission.tenant_id=project.tenant_id AND submission.submission_state IN ('SUBMITTED','IN_VERIFICATION','VERIFIED','APPROVED')) submitted_version_count,
 (SELECT count(*) FROM emission_activity_submission submission WHERE submission.project_id=project.project_id AND submission.tenant_id=project.tenant_id AND submission.submission_state<>'DRAFT' AND (submission.submitted_item_count=0 OR submission.snapshot_hash IS NULL)) unsealed_submission_count,
 CASE WHEN count(activity.activity_id)>0
   AND count(activity.activity_id) FILTER(WHERE nullif(trim(activity.evidence_note),'') IS NULL)=0
   AND count(activity.activity_id) FILTER(WHERE activity.quantity<0 OR nullif(trim(activity.unit),'') IS NULL)=0
   AND (SELECT count(*) FROM emission_activity_submission submission WHERE submission.project_id=project.project_id AND submission.tenant_id=project.tenant_id AND submission.submission_state IN ('SUBMITTED','IN_VERIFICATION','VERIFIED','APPROVED'))>0
   AND (SELECT count(*) FROM emission_activity_submission submission WHERE submission.project_id=project.project_id AND submission.tenant_id=project.tenant_id AND submission.submission_state<>'DRAFT' AND (submission.submitted_item_count=0 OR submission.snapshot_hash IS NULL))=0
 THEN 'READY' ELSE 'IN_PROGRESS' END collection_health
FROM emission_project_registry project LEFT JOIN emission_activity_data activity ON activity.project_id=project.project_id
GROUP BY project.project_id,project.tenant_id;
