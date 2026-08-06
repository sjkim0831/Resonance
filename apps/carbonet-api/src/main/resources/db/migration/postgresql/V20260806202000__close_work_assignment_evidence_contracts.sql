-- Close the three evidence-required assignment steps with domain evidence,
-- then lock the reviewed process definition.  Evidence declarations are not
-- runtime verification; the nine implementation jobs remain pending.

UPDATE framework_process_step
SET evidence_types=CASE step_code
  WHEN 'WORK_ASSIGNMENT_ACTOR' THEN
    '["ACCOUNT_ELIGIBILITY_DECISION","ACTOR_ACCOUNT_ASSIGNMENT","TENANT_SCOPE_VALIDATION","AUDIT_EVENT"]'
  WHEN 'WORK_ASSIGNMENT_STEP' THEN
    '["STEP_ASSIGNEE_ASSIGNMENT","NOTIFICATION_DELIVERY","TENANT_SCOPE_VALIDATION","AUDIT_EVENT"]'
  WHEN 'WORK_ASSIGNMENT_CONFIRM' THEN
    '["ASSIGNMENT_SNAPSHOT","ASSIGNMENT_AUDIT","WORK_GUIDE_VISIBILITY","NOTIFICATION_DELIVERY"]'
  ELSE evidence_types
END
WHERE process_code='WORK_ASSIGNMENT'
  AND step_code IN (
    'WORK_ASSIGNMENT_ACTOR','WORK_ASSIGNMENT_STEP','WORK_ASSIGNMENT_CONFIRM'
  )
  AND (
    evidence_types IS NULL OR btrim(evidence_types) IN ('','[]')
  );

UPDATE framework_process_definition
SET process_version='1.1.0',definition_locked=true,updated_at=current_timestamp
WHERE process_code='WORK_ASSIGNMENT';

DO $$
DECLARE
  blocker_count integer;
BEGIN
  SELECT design_blocker_count
  INTO blocker_count
  FROM framework_process_design_assurance_matrix
  WHERE process_code='WORK_ASSIGNMENT';

  IF blocker_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION
      'WORK_ASSIGNMENT design closure failed: % blockers remain',blocker_count;
  END IF;
END $$;
