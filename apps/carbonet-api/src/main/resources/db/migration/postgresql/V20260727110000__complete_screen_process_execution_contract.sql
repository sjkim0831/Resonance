-- Canonical context and ordering contract for large-scale screen generation.
-- Names are searchable snapshots; codes and foreign keys remain the source of truth.

ALTER TABLE framework_screen_resource
  ADD COLUMN IF NOT EXISTS screen_code varchar(120),
  ADD COLUMN IF NOT EXISTS screen_description text,
  ADD COLUMN IF NOT EXISTS business_domain_code varchar(80),
  ADD COLUMN IF NOT EXISTS layout_type varchar(60) NOT NULL DEFAULT 'RESPONSIVE_WORKSPACE',
  ADD COLUMN IF NOT EXISTS mobile_strategy varchar(40) NOT NULL DEFAULT 'REFLOW',
  ADD COLUMN IF NOT EXISTS generator_template_code varchar(120),
  ADD COLUMN IF NOT EXISTS design_version varchar(40) NOT NULL DEFAULT '1.0.0';

UPDATE framework_screen_resource
SET screen_code='SCR_'||upper(substr(md5(route_key),1,20))
WHERE screen_code IS NULL OR btrim(screen_code)='';

ALTER TABLE framework_screen_resource ALTER COLUMN screen_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_framework_screen_resource_code
  ON framework_screen_resource(screen_code);
CREATE INDEX IF NOT EXISTS ix_framework_screen_resource_domain
  ON framework_screen_resource(business_domain_code,screen_type,implementation_status);

ALTER TABLE framework_professional_screen_contract
  ADD COLUMN IF NOT EXISTS screen_code varchar(120),
  ADD COLUMN IF NOT EXISTS project_context_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tenant_context_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS process_sequence integer,
  ADD COLUMN IF NOT EXISTS step_sequence integer,
  ADD COLUMN IF NOT EXISTS screen_sequence integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS screen_usage_type varchar(24) NOT NULL DEFAULT 'PRIMARY',
  ADD COLUMN IF NOT EXISTS transition_type varchar(24) NOT NULL DEFAULT 'SEQUENTIAL',
  ADD COLUMN IF NOT EXISTS transition_condition text,
  ADD COLUMN IF NOT EXISTS parallel_group_code varchar(100),
  ADD COLUMN IF NOT EXISTS previous_step_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS next_step_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS permission_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS data_scope_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS test_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS design_version varchar(40) NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS contract_revision bigint NOT NULL DEFAULT 1;

UPDATE framework_professional_screen_contract c
SET screen_code=r.screen_code,
    process_sequence=p.development_order,
    step_sequence=s.step_order,
    screen_sequence=coalesce(c.screen_sequence,1),
    project_context_required=(c.route_path LIKE '/emission/%' OR c.route_path LIKE '/admin/emission/%')
FROM framework_process_definition p,
     framework_process_step s,
     framework_screen_resource r
WHERE p.process_code=c.process_code
  AND s.process_code=c.process_code AND s.step_code=c.step_code
  AND r.route_key=lower(split_part(c.route_path,'?',1))
  AND (c.screen_code IS NULL OR c.process_sequence IS NULL OR c.step_sequence IS NULL);

ALTER TABLE framework_process_step_screen_binding
  ADD COLUMN IF NOT EXISTS screen_sequence integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS transition_type varchar(24) NOT NULL DEFAULT 'SEQUENTIAL',
  ADD COLUMN IF NOT EXISTS transition_condition text,
  ADD COLUMN IF NOT EXISTS parallel_group_code varchar(100),
  ADD COLUMN IF NOT EXISTS entry_condition text,
  ADD COLUMN IF NOT EXISTS completion_action text,
  ADD COLUMN IF NOT EXISTS input_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS output_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS permission_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS api_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS database_lineage jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS test_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS design_version varchar(40) NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS contract_status varchar(24) NOT NULL DEFAULT 'DESIGNED';

CREATE INDEX IF NOT EXISTS ix_step_screen_execution_order
  ON framework_process_step_screen_binding(process_code,step_code,screen_sequence,binding_status);
CREATE INDEX IF NOT EXISTS ix_step_screen_parallel
  ON framework_process_step_screen_binding(process_code,parallel_group_code)
  WHERE parallel_group_code IS NOT NULL;

-- Design-time contract: one row contains every stable identifier and display name
-- required by generators, canvases and human review.
CREATE OR REPLACE VIEW framework_screen_design_execution_contract AS
SELECT
  r.screen_resource_id,
  r.screen_code,
  r.screen_name,
  r.route_key AS route_path,
  r.screen_type,
  r.screen_description,
  r.business_domain_code,
  r.layout_type,
  r.mobile_strategy,
  r.generator_template_code,
  r.design_version AS screen_design_version,
  p.process_code,
  p.process_name,
  p.domain_code,
  p.process_version,
  p.development_order AS process_sequence,
  s.step_id AS process_step_id,
  s.step_code,
  s.step_name,
  s.step_order AS step_sequence,
  b.screen_sequence,
  b.audience,
  b.actor_code,
  a.actor_name,
  b.entry_mode AS screen_usage_type,
  b.is_required,
  b.transition_type,
  b.transition_condition,
  b.parallel_group_code,
  b.entry_condition,
  coalesce(b.completion_action,s.completion_rule) AS completion_action,
  b.input_contract,
  b.output_contract,
  b.permission_codes,
  b.api_contract,
  b.database_lineage,
  b.test_contract,
  b.contract_status,
  b.design_version AS binding_design_version,
  coalesce(pc.project_context_required,
    r.route_key LIKE '/emission/%' OR r.route_key LIKE '/admin/emission/%') AS project_context_required,
  coalesce(pc.tenant_context_required,true) AS tenant_context_required,
  coalesce(pc.data_scope_contract,'{}'::jsonb) AS data_scope_contract,
  s.from_state,
  s.command_code,
  s.to_state,
  s.user_path,
  s.admin_path
FROM framework_process_step_screen_binding b
JOIN framework_screen_resource r USING(screen_resource_id)
JOIN framework_process_definition p USING(process_code)
JOIN framework_process_step s
  ON s.process_code=b.process_code AND s.step_code=b.step_code
JOIN framework_actor_definition a ON a.actor_code=b.actor_code
LEFT JOIN framework_professional_screen_contract pc
  ON pc.process_code=b.process_code
 AND pc.step_code=b.step_code
 AND pc.audience=b.audience
 AND lower(split_part(pc.route_path,'?',1))=r.route_key
WHERE b.binding_status='ACTIVE';

-- Runtime contract: project, tenant, task and assignee are instance data and
-- therefore deliberately not duplicated into the static screen table.
CREATE OR REPLACE VIEW framework_project_screen_execution_contract AS
SELECT
  project.project_id,
  project.project_name,
  project.tenant_id,
  applicability.work_type_code,
  design.*,
  task.task_id,
  task.task_code,
  task.task_name,
  task.step_order AS task_sequence,
  task.task_status,
  task.assignee_id,
  task.due_date,
  task.priority,
  task.predecessor_codes,
  task.completion_rule AS task_completion_rule,
  applicability.execution_status AS process_execution_status,
  applicability.implementation_status AS process_implementation_status
FROM framework_project_process_applicability applicability
JOIN emission_project_registry project USING(project_id)
JOIN framework_screen_design_execution_contract design
  ON design.process_code=applicability.process_code
LEFT JOIN emission_project_task task
  ON task.project_id=project.project_id
 AND task.process_code=design.process_code
 AND task.process_step_code=design.step_code;

-- Fail-fast quality gate for 1,000-screen generation.
CREATE OR REPLACE VIEW framework_screen_contract_gap AS
SELECT screen_resource_id,screen_code,route_path,process_code,step_code,actor_code,gap_code
FROM framework_screen_design_execution_contract c
CROSS JOIN LATERAL unnest(ARRAY[
  CASE WHEN nullif(c.screen_name,'') IS NULL THEN 'SCREEN_NAME_MISSING' END,
  CASE WHEN nullif(c.process_name,'') IS NULL THEN 'PROCESS_NAME_MISSING' END,
  CASE WHEN c.process_sequence IS NULL THEN 'PROCESS_SEQUENCE_MISSING' END,
  CASE WHEN c.step_sequence IS NULL THEN 'STEP_SEQUENCE_MISSING' END,
  CASE WHEN c.screen_sequence IS NULL OR c.screen_sequence<1 THEN 'SCREEN_SEQUENCE_INVALID' END,
  CASE WHEN nullif(c.actor_name,'') IS NULL THEN 'ACTOR_NAME_MISSING' END,
  CASE WHEN c.transition_type<>'SEQUENTIAL' AND nullif(c.transition_condition,'') IS NULL THEN 'TRANSITION_CONDITION_MISSING' END,
  CASE WHEN c.transition_type='PARALLEL' AND nullif(c.parallel_group_code,'') IS NULL THEN 'PARALLEL_GROUP_MISSING' END,
  CASE WHEN c.project_context_required AND coalesce(c.data_scope_contract,'{}'::jsonb)='{}'::jsonb THEN 'PROJECT_DATA_SCOPE_MISSING' END,
  CASE WHEN coalesce(c.permission_codes,'[]'::jsonb)='[]'::jsonb THEN 'PERMISSION_CONTRACT_MISSING' END,
  CASE WHEN coalesce(c.test_contract,'{}'::jsonb)='{}'::jsonb THEN 'TEST_CONTRACT_MISSING' END
]) gap_code
WHERE gap_code IS NOT NULL;

CREATE OR REPLACE FUNCTION framework_screen_generation_preflight()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'screenCount',(SELECT count(DISTINCT screen_resource_id) FROM framework_screen_resource),
    'mappedScreenCount',(SELECT count(DISTINCT screen_resource_id) FROM framework_screen_design_execution_contract),
    'processCount',(SELECT count(DISTINCT process_code) FROM framework_screen_design_execution_contract),
    'stepCount',(SELECT count(DISTINCT (process_code,step_code)) FROM framework_screen_design_execution_contract),
    'blockingGapCount',(SELECT count(*) FROM framework_screen_contract_gap),
    'generationAllowed',NOT EXISTS(SELECT 1 FROM framework_screen_contract_gap),
    'gapSummary',coalesce((SELECT jsonb_object_agg(gap_code,gap_count)
      FROM (SELECT gap_code,count(*) gap_count FROM framework_screen_contract_gap GROUP BY gap_code) x),'{}'::jsonb)
  )
$$;

COMMENT ON VIEW framework_screen_design_execution_contract IS
  '화면명·라우트·액터·프로세스명·프로세스순서·단계순서·화면순서·분기·권한·API·DB·테스트를 한 행으로 제공하는 설계 정본';
COMMENT ON VIEW framework_project_screen_execution_contract IS
  '설계 정본에 프로젝트명·테넌트·실행 태스크·담당자·마감일을 결합한 실제 업무 실행 계약';
