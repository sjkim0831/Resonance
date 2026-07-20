CREATE OR REPLACE FUNCTION framework_guard_project_process_by_design()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE assurance varchar(32); score integer; action text;
BEGIN
  SELECT assurance_status,design_accuracy_score,next_action
    INTO assurance,score,action
  FROM framework_process_design_assurance_matrix
  WHERE process_code=NEW.process_code;

  NEW.criteria_snapshot=coalesce(NEW.criteria_snapshot,'{}'::jsonb)||jsonb_build_object(
    'designAssuranceStatus',coalesce(assurance,'DESIGN_NOT_AUDITED'),
    'designAccuracyScore',coalesce(score,0),
    'designNextAction',coalesce(action,'Run process design assurance audit')
  );

  IF assurance='DESIGN_BLOCKED' THEN
    NEW.implementation_status='BLOCKED';
    NEW.task_generation_status='WAITING_FOR_DESIGN';
    NEW.execution_status=CASE WHEN EXISTS(
      SELECT 1 FROM emission_project_task t
      WHERE t.project_id=NEW.project_id
        AND framework_task_matches_process(t.process_code,t.task_code,NEW.process_code)
    ) THEN NEW.execution_status ELSE 'BLOCKED' END;
    NEW.reason_code='DESIGN_ASSURANCE_BLOCKED';
    NEW.reason_text=coalesce(nullif(action,''),'The executable process design has unresolved blockers.');
  ELSIF assurance IN ('IMPLEMENTATION_PENDING','REVIEW_REQUIRED') AND NOT EXISTS(
    SELECT 1 FROM emission_project_task t
    WHERE t.project_id=NEW.project_id
      AND framework_task_matches_process(t.process_code,t.task_code,NEW.process_code)
  ) THEN
    NEW.implementation_status='DESIGN_REQUIRED';
    NEW.task_generation_status='WAITING_FOR_DESIGN';
    NEW.execution_status='NOT_STARTED';
    NEW.reason_code='IMPLEMENTATION_EVIDENCE_REQUIRED';
    NEW.reason_text=coalesce(nullif(action,''),'Implementation evidence must be verified before task generation.');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_project_process_by_design ON framework_project_process_applicability;
CREATE TRIGGER trg_guard_project_process_by_design
BEFORE INSERT OR UPDATE ON framework_project_process_applicability
FOR EACH ROW EXECUTE FUNCTION framework_guard_project_process_by_design();

-- Re-evaluate existing project bindings through the same trigger without
-- creating or deleting customer-authored runtime tasks.
UPDATE framework_project_process_applicability
SET updated_at=current_timestamp;

CREATE OR REPLACE VIEW framework_work_type_design_assurance AS
SELECT w.work_type_code,w.work_type_name,w.work_type_name_en,w.sort_order,
  count(m.process_code)::integer AS process_count,
  count(m.process_code) FILTER(WHERE m.assurance_status='IMPLEMENTATION_VERIFIED')::integer AS verified_process_count,
  count(m.process_code) FILTER(WHERE m.assurance_status='DESIGN_BLOCKED')::integer AS blocked_process_count,
  count(m.process_code) FILTER(WHERE m.assurance_status IN ('IMPLEMENTATION_PENDING','REVIEW_REQUIRED'))::integer AS pending_process_count,
  coalesce(round(avg(m.design_accuracy_score),1),0) AS average_accuracy_score
FROM framework_business_work_type w
LEFT JOIN framework_process_design_assurance_matrix m ON upper(m.domain_code)=w.work_type_code
WHERE w.use_at='Y'
GROUP BY w.work_type_code,w.work_type_name,w.work_type_name_en,w.sort_order;
