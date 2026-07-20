CREATE TABLE IF NOT EXISTS framework_project_process_applicability (
  project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
  process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code),
  work_type_code varchar(40) NOT NULL REFERENCES framework_business_work_type(work_type_code),
  applicability_status varchar(24) NOT NULL,
  implementation_status varchar(24) NOT NULL,
  task_generation_status varchar(24) NOT NULL DEFAULT 'NOT_GENERATED',
  execution_status varchar(24) NOT NULL DEFAULT 'NOT_STARTED',
  reason_code varchar(80) NOT NULL,
  reason_text text NOT NULL,
  criteria_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  manual_override boolean NOT NULL DEFAULT false,
  evaluated_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(project_id,process_code),
  CONSTRAINT ck_project_process_applicability CHECK(applicability_status IN ('APPLICABLE','CONDITIONAL','EXCLUDED')),
  CONSTRAINT ck_project_process_implementation CHECK(implementation_status IN ('READY','DESIGN_REQUIRED','BLOCKED')),
  CONSTRAINT ck_project_process_task_generation CHECK(task_generation_status IN ('NOT_GENERATED','GENERATED','EXISTING','WAITING_FOR_DESIGN','EXCLUDED')),
  CONSTRAINT ck_project_process_execution CHECK(execution_status IN ('NOT_STARTED','READY','IN_PROGRESS','BLOCKED','COMPLETED','NOT_APPLICABLE'))
);

CREATE INDEX IF NOT EXISTS idx_project_process_applicability_status
  ON framework_project_process_applicability(project_id,applicability_status,implementation_status,execution_status);

CREATE OR REPLACE FUNCTION framework_sync_project_processes(target_project_id varchar,requested_by varchar DEFAULT 'SYSTEM')
RETURNS TABLE(applicable_count integer,conditional_count integer,design_required_count integer,generated_task_count integer)
LANGUAGE plpgsql AS $$
DECLARE inserted_tasks integer := 0;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM emission_project_registry WHERE project_id=target_project_id) THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND:%',target_project_id;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('PROJECT_PROCESS_SYNC:'||target_project_id));

  INSERT INTO framework_project_process_applicability(
    project_id,process_code,work_type_code,applicability_status,implementation_status,
    task_generation_status,execution_status,reason_code,reason_text,criteria_snapshot
  )
  SELECT target_project_id,p.process_code,seq.work_type_code,
    CASE WHEN seq.process_role IN ('BRANCH','SUPPORT') THEN 'CONDITIONAL' ELSE 'APPLICABLE' END,
    CASE WHEN EXISTS(
      SELECT 1 FROM framework_process_step missing
      WHERE missing.process_code=p.process_code AND missing.requires_user_page
        AND nullif(missing.user_path,'') IS NULL
    ) THEN 'DESIGN_REQUIRED' ELSE 'READY' END,
    CASE WHEN seq.process_role IN ('BRANCH','SUPPORT') THEN 'EXCLUDED'
         WHEN EXISTS(SELECT 1 FROM emission_project_task existing WHERE existing.project_id=target_project_id AND existing.process_code=p.process_code) THEN 'EXISTING'
         WHEN EXISTS(SELECT 1 FROM framework_process_step missing WHERE missing.process_code=p.process_code AND missing.requires_user_page AND nullif(missing.user_path,'') IS NULL) THEN 'WAITING_FOR_DESIGN'
         ELSE 'NOT_GENERATED' END,
    CASE WHEN seq.process_role IN ('BRANCH','SUPPORT') THEN 'NOT_APPLICABLE'
         WHEN EXISTS(SELECT 1 FROM emission_project_task existing WHERE existing.project_id=target_project_id AND existing.process_code=p.process_code AND existing.task_status='IN_PROGRESS') THEN 'IN_PROGRESS'
         WHEN EXISTS(SELECT 1 FROM emission_project_task existing WHERE existing.project_id=target_project_id AND existing.process_code=p.process_code AND existing.task_status IN ('READY','WAITING','BLOCKED')) THEN 'READY'
         WHEN EXISTS(SELECT 1 FROM emission_project_task existing WHERE existing.project_id=target_project_id AND existing.process_code=p.process_code)
          AND NOT EXISTS(SELECT 1 FROM emission_project_task existing WHERE existing.project_id=target_project_id AND existing.process_code=p.process_code AND existing.task_status<>'DONE') THEN 'COMPLETED'
         ELSE 'NOT_STARTED' END,
    CASE WHEN seq.process_role IN ('BRANCH','SUPPORT') THEN 'CONDITIONAL_TRIGGER_REQUIRED'
         WHEN EXISTS(SELECT 1 FROM framework_process_step missing WHERE missing.process_code=p.process_code AND missing.requires_user_page AND nullif(missing.user_path,'') IS NULL) THEN 'SCREEN_CONTRACT_MISSING'
         ELSE 'PROJECT_DOMAIN_MATCH' END,
    CASE WHEN seq.process_role IN ('BRANCH','SUPPORT') THEN 'A business event must activate this optional process.'
         WHEN EXISTS(SELECT 1 FROM framework_process_step missing WHERE missing.process_code=p.process_code AND missing.requires_user_page AND nullif(missing.user_path,'') IS NULL) THEN 'Required user screens must be generated and verified before task creation.'
         ELSE 'The process belongs to the carbon-emission project workflow and is ready for task instantiation.' END,
    jsonb_build_object('projectId',target_project_id,'workTypeCode',seq.work_type_code,'processRole',seq.process_role,'workflowOrder',seq.workflow_order,'evaluatedBy',requested_by)
  FROM framework_business_process_sequence seq
  JOIN framework_process_definition p ON p.process_code=seq.process_code
  WHERE seq.work_type_code='EMISSION' AND seq.sequence_status='ACTIVE'
  ON CONFLICT(project_id,process_code) DO UPDATE SET
    work_type_code=excluded.work_type_code,
    applicability_status=CASE WHEN framework_project_process_applicability.manual_override THEN framework_project_process_applicability.applicability_status ELSE excluded.applicability_status END,
    implementation_status=excluded.implementation_status,
    reason_code=CASE WHEN framework_project_process_applicability.manual_override THEN framework_project_process_applicability.reason_code ELSE excluded.reason_code END,
    reason_text=CASE WHEN framework_project_process_applicability.manual_override THEN framework_project_process_applicability.reason_text ELSE excluded.reason_text END,
    criteria_snapshot=excluded.criteria_snapshot,evaluated_at=current_timestamp,updated_at=current_timestamp;

  WITH ready_process AS (
    SELECT a.process_code,seq.workflow_order,coalesce(seq.prerequisite_process_codes,'') AS prerequisite_process_codes
    FROM framework_project_process_applicability a
    JOIN framework_business_process_sequence seq ON seq.process_code=a.process_code
    WHERE a.project_id=target_project_id AND a.applicability_status='APPLICABLE'
      AND a.implementation_status='READY'
      AND NOT EXISTS(SELECT 1 FROM emission_project_task existing WHERE existing.project_id=target_project_id AND existing.process_code=a.process_code)
  ), candidate AS (
    SELECT s.*,r.workflow_order,r.prerequisite_process_codes,
      'AUTO_'||substr(md5(s.process_code||':'||s.step_code),1,24) AS generated_task_code,
      lag('AUTO_'||substr(md5(s.process_code||':'||s.step_code),1,24)) OVER(PARTITION BY s.process_code ORDER BY s.step_order) AS prior_task_code
    FROM ready_process r JOIN framework_process_step s ON s.process_code=r.process_code
  )
  INSERT INTO emission_project_task(
    project_id,task_code,task_name,step_order,task_status,progress_weight,due_date,
    process_code,process_step_code,actor_code,predecessor_codes,completion_rule,
    target_url,assignee_id,priority,blocked_reason
  )
  SELECT target_project_id,c.generated_task_code,c.step_name,c.workflow_order*100+c.step_order,
    CASE WHEN c.step_order=1 AND NOT EXISTS(
      SELECT 1 FROM unnest(string_to_array(nullif(c.prerequisite_process_codes,''),',')) required(process_code)
      WHERE NOT EXISTS(
        SELECT 1 FROM emission_project_task prerequisite
        WHERE prerequisite.project_id=target_project_id
          AND prerequisite.process_code=trim(required.process_code)
        GROUP BY prerequisite.process_code
        HAVING bool_and(prerequisite.task_status='DONE')
      )
    ) THEN 'READY' ELSE 'BLOCKED' END,
    greatest(1,round(100.0/count(*) OVER(PARTITION BY c.process_code))::integer),project.due_date,
    c.process_code,c.step_code,c.actor_code,coalesce(c.prior_task_code,''),c.completion_rule,
    c.user_path||CASE WHEN c.user_path LIKE '%?%' THEN '&' ELSE '?' END||'projectId='||target_project_id,
    coalesce((SELECT assignment.user_id FROM framework_project_actor_assignment assignment WHERE assignment.project_id=target_project_id AND assignment.actor_code=c.actor_code AND assignment.active_yn='Y' ORDER BY assignment.assigned_at LIMIT 1),project.owner_name),
    CASE WHEN c.step_type='DECISION' THEN 'HIGH' ELSE 'NORMAL' END,
    CASE WHEN c.step_order>1 THEN 'PREDECESSOR_TASK_REQUIRED'
         WHEN nullif(c.prerequisite_process_codes,'') IS NOT NULL THEN 'PREREQUISITE_PROCESS_REQUIRED'
         ELSE null END
  FROM candidate c CROSS JOIN emission_project_registry project
  WHERE project.project_id=target_project_id AND nullif(c.user_path,'') IS NOT NULL
  ON CONFLICT(project_id,task_code) DO NOTHING;
  GET DIAGNOSTICS inserted_tasks = ROW_COUNT;

  UPDATE framework_project_process_applicability a SET
    task_generation_status=CASE
      WHEN a.applicability_status<>'APPLICABLE' THEN 'EXCLUDED'
      WHEN a.implementation_status<>'READY' THEN 'WAITING_FOR_DESIGN'
      WHEN EXISTS(SELECT 1 FROM emission_project_task t WHERE t.project_id=a.project_id AND t.process_code=a.process_code) THEN
        CASE WHEN a.task_generation_status='EXISTING' THEN 'EXISTING' ELSE 'GENERATED' END
      ELSE 'NOT_GENERATED' END,
    execution_status=CASE
      WHEN a.applicability_status<>'APPLICABLE' THEN 'NOT_APPLICABLE'
      WHEN EXISTS(SELECT 1 FROM emission_project_task t WHERE t.project_id=a.project_id AND t.process_code=a.process_code AND t.task_status='IN_PROGRESS') THEN 'IN_PROGRESS'
      WHEN EXISTS(SELECT 1 FROM emission_project_task t WHERE t.project_id=a.project_id AND t.process_code=a.process_code AND t.task_status IN ('READY','WAITING')) THEN 'READY'
      WHEN EXISTS(SELECT 1 FROM emission_project_task t WHERE t.project_id=a.project_id AND t.process_code=a.process_code AND t.task_status='BLOCKED') THEN 'BLOCKED'
      WHEN EXISTS(SELECT 1 FROM emission_project_task t WHERE t.project_id=a.project_id AND t.process_code=a.process_code)
       AND NOT EXISTS(SELECT 1 FROM emission_project_task t WHERE t.project_id=a.project_id AND t.process_code=a.process_code AND t.task_status<>'DONE') THEN 'COMPLETED'
      ELSE 'NOT_STARTED' END,
    updated_at=current_timestamp
  WHERE a.project_id=target_project_id;

  RETURN QUERY SELECT
    count(*) FILTER(WHERE a.applicability_status='APPLICABLE')::integer,
    count(*) FILTER(WHERE a.applicability_status='CONDITIONAL')::integer,
    count(*) FILTER(WHERE a.implementation_status='DESIGN_REQUIRED')::integer,
    inserted_tasks
  FROM framework_project_process_applicability a WHERE a.project_id=target_project_id;
END $$;

DO $$ DECLARE project_code varchar; BEGIN
  FOR project_code IN SELECT project_id FROM emission_project_registry LOOP
    PERFORM framework_sync_project_processes(project_code,'FLYWAY_BACKFILL');
  END LOOP;
END $$;

CREATE OR REPLACE VIEW framework_project_process_readiness AS
SELECT a.project_id,p.tenant_id,p.project_name,a.process_code,d.process_name,
       seq.workflow_order,seq.workflow_phase,seq.process_role,
       a.applicability_status,a.implementation_status,a.task_generation_status,a.execution_status,
       a.reason_code,a.reason_text,
       count(t.task_id) AS task_count,
       count(t.task_id) FILTER(WHERE t.task_status='DONE') AS completed_task_count
FROM framework_project_process_applicability a
JOIN emission_project_registry p ON p.project_id=a.project_id
JOIN framework_process_definition d ON d.process_code=a.process_code
JOIN framework_business_process_sequence seq ON seq.process_code=a.process_code
LEFT JOIN emission_project_task t ON t.project_id=a.project_id AND t.process_code=a.process_code
GROUP BY a.project_id,p.tenant_id,p.project_name,a.process_code,d.process_name,
         seq.workflow_order,seq.workflow_phase,seq.process_role,
         a.applicability_status,a.implementation_status,a.task_generation_status,a.execution_status,
         a.reason_code,a.reason_text;
