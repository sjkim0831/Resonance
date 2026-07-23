-- Close the blockers found by the first canonical SchemaSet compilation.
-- Updates pass through propagation triggers so affected screens and
-- development layers are invalidated incrementally.

UPDATE framework_page_field_definition field_definition
SET source_column='input_snapshot_hash',
    help_text=CASE
      WHEN nullif(btrim(help_text),'') IS NULL
        THEN 'Canonical SHA-256 hash of activity data, emission factors, and decisions used for the calculation run.'
      ELSE help_text END,
    updated_at=current_timestamp
FROM framework_page_design page_design
WHERE field_definition.page_design_id=page_design.page_design_id
  AND field_definition.field_code='snapshotHash'
  AND field_definition.source_table='emission_calculation_run'
  AND field_definition.source_column='snapshot_hash'
  AND page_design.process_code IN (
    'ACTIVITY_DATA','CUSTOMER_WORK_COORDINATION',
    'EMISSION_CALCULATION','EMISSION_PROJECT');

ALTER TABLE framework_process_step
  DISABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_process_step
SET requirement_text='Return the immutable receipt number, submission timestamp, review status, due date, and permitted next actions after membership application submission.',
    input_contract='{"required":["applicationId","receiptNo","applicantId","submittedAt"],"context":["tenantId","processCode","stepCode","actorCode"],"constraints":["application state must be APPLICATION_SUBMITTED","receipt belongs to applicant"]}',
    output_contract='{"required":["applicationId","receiptNo","applicationStatus","submittedAt","expectedReviewDueAt","nextActions"],"states":["APPLICATION_PENDING_APPROVAL"],"nextActions":["CHECK_STATUS","GO_TO_LOGIN","CONTACT_SUPPORT"]}',
    automation_status='PLANNED'
WHERE process_code='MEMBER_REGISTRATION'
  AND step_code='MEMBER_REGISTRATION_S5'
  AND (input_contract='{}' OR output_contract='{}');

ALTER TABLE framework_process_step
  ENABLE TRIGGER trg_guard_locked_process_step;

DO $$
DECLARE blocked integer;
BEGIN
  SELECT count(*) INTO blocked
  FROM framework_step_schema_set
  WHERE completeness_status<>'COMPLETE';
  IF blocked<>0 THEN
    RAISE EXCEPTION 'STEP_SCHEMA_SET_BLOCKERS_REMAIN count=%',blocked;
  END IF;
END $$;
