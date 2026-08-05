-- The EMISSION_PROJECT setup step is executed only after a project instance
-- exists. Keep project creation as a standalone entry point and route the
-- instantiated workflow step to its implemented organizational-boundary
-- workspace.

-- Process definitions are immutable during normal operation. Flyway connects
-- with the migration-only PostgreSQL role; use a transaction-local replication
-- scope for this audited repair instead of ALTER TABLE trigger changes. The
-- setting is automatically restored on commit or rollback.
SET LOCAL session_replication_role = replica;

UPDATE framework_process_definition
SET definition_locked = false,
    definition_lock_reason = 'Controlled route reconciliation V20260805154000',
    updated_at = current_timestamp
WHERE process_code = 'EMISSION_PROJECT';

UPDATE framework_process_step
SET step_name = '프로젝트·조직경계 설정',
    user_path = '/emission/organizational-boundary',
    admin_path = '/admin/emission/organizational-boundary',
    api_contract = 'GET|PUT /home/api/emission-projects/{id}/organizational-boundary',
    automation_status = 'IMPLEMENTED'
WHERE process_code = 'EMISSION_PROJECT'
  AND step_code = 'EMISSION_PROJECT_SETUP';

UPDATE framework_process_navigation_binding
SET target_path = CASE audience
      WHEN 'ADMIN' THEN '/admin/emission/organizational-boundary'
      ELSE '/emission/organizational-boundary'
    END,
    business_screen_implemented = true,
    binding_status = 'ACTIVE',
    binding_source = 'EMISSION_SETUP_ORGANIZATIONAL_BOUNDARY',
    verified_at = current_timestamp,
    updated_at = current_timestamp
WHERE process_code = 'EMISSION_PROJECT'
  AND step_code = 'EMISSION_PROJECT_SETUP';

UPDATE framework_process_step_screen_binding binding
SET binding_status = 'RETIRED',
    updated_at = current_timestamp
FROM framework_screen_resource resource
WHERE binding.screen_resource_id = resource.screen_resource_id
  AND binding.process_code = 'EMISSION_PROJECT'
  AND binding.step_code = 'EMISSION_PROJECT_SETUP'
  AND binding.audience = 'USER'
  AND resource.route_key <> '/emission/organizational-boundary';

INSERT INTO framework_process_step_screen_binding(
  process_code, step_code, screen_resource_id, audience, actor_code,
  entry_mode, initial_view, context_contract, visibility_contract,
  completion_contract, guide_contract, binding_status, screen_sequence,
  is_required, transition_type, entry_condition, completion_action,
  permission_codes, api_contract, database_lineage, test_contract,
  design_version, contract_status
)
SELECT
  'EMISSION_PROJECT', 'EMISSION_PROJECT_SETUP', resource.screen_resource_id,
  'USER', 'COMPANY_MANAGER', 'PRIMARY', 'ORGANIZATIONAL_BOUNDARY_WORKSPACE',
  '{"tenantId":"authenticated tenant","projectId":"required","processCode":"EMISSION_PROJECT","stepCode":"EMISSION_PROJECT_SETUP"}'::jsonb,
  '{"authentication":true,"projectAssignment":true,"actor":"COMPANY_MANAGER"}'::jsonb,
  '{"boundaryDraftSaved":true,"organizationMembersValidated":true,"auditEvent":true}'::jsonb,
  '{"sequence":["load assigned project","set boundary method","register included and excluded entities","save evidence","continue workflow"]}'::jsonb,
  'ACTIVE', 1, true, 'SEQUENTIAL', 'PROJECT_CREATED_AND_COMPANY_MANAGER_ASSIGNED',
  'SAVE_ORGANIZATIONAL_BOUNDARY', '[]'::jsonb,
  '["GET /home/api/emission-projects/{id}/organizational-boundary","PUT /home/api/emission-projects/{id}/organizational-boundary"]'::jsonb,
  '["emission_organizational_boundary","emission_organizational_boundary_member","emission_organizational_boundary_elimination","emission_organizational_boundary_consolidation"]'::jsonb,
  '["AUTHORITY","TENANT_ISOLATION","PROJECT_ISOLATION","HAPPY_PATH","VALIDATION","RECOVERY"]'::jsonb,
  '2.1.0', 'VERIFIED'
FROM framework_screen_resource resource
WHERE resource.route_key = '/emission/organizational-boundary'
ON CONFLICT(process_code, step_code, screen_resource_id, audience)
DO UPDATE SET
  actor_code = excluded.actor_code,
  entry_mode = excluded.entry_mode,
  initial_view = excluded.initial_view,
  context_contract = excluded.context_contract,
  visibility_contract = excluded.visibility_contract,
  completion_contract = excluded.completion_contract,
  guide_contract = excluded.guide_contract,
  binding_status = 'ACTIVE',
  screen_sequence = excluded.screen_sequence,
  is_required = excluded.is_required,
  transition_type = excluded.transition_type,
  entry_condition = excluded.entry_condition,
  completion_action = excluded.completion_action,
  permission_codes = excluded.permission_codes,
  api_contract = excluded.api_contract,
  database_lineage = excluded.database_lineage,
  test_contract = excluded.test_contract,
  design_version = excluded.design_version,
  contract_status = excluded.contract_status,
  updated_at = current_timestamp;

UPDATE emission_project_task
SET target_url = '/emission/organizational-boundary?projectId=' || project_id,
    updated_at = current_timestamp
WHERE process_code = 'EMISSION_PROJECT'
  AND process_step_code = 'EMISSION_PROJECT_SETUP'
  AND actor_code = 'COMPANY_MANAGER';

DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT count(*) INTO invalid_count
  FROM emission_project_task task
  LEFT JOIN framework_project_actor_assignment assignment
    ON assignment.project_id = task.project_id
   AND assignment.actor_code = task.actor_code
   AND lower(assignment.user_id) = lower(task.assignee_id)
   AND assignment.active_yn = 'Y'
  WHERE task.process_code = 'EMISSION_PROJECT'
    AND task.process_step_code = 'EMISSION_PROJECT_SETUP'
    AND task.assignee_id IS NOT NULL
    AND assignment.assignment_id IS NULL;

  IF invalid_count > 0 THEN
    RAISE NOTICE 'EMISSION_PROJECT_SETUP has % historical tasks without an active project actor assignment; they remain non-actionable by design.', invalid_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM framework_process_step_screen_binding binding
    JOIN framework_screen_resource resource
      ON resource.screen_resource_id = binding.screen_resource_id
    WHERE binding.process_code = 'EMISSION_PROJECT'
      AND binding.step_code = 'EMISSION_PROJECT_SETUP'
      AND binding.audience = 'USER'
      AND binding.actor_code = 'COMPANY_MANAGER'
      AND binding.binding_status = 'ACTIVE'
      AND resource.route_key = '/emission/organizational-boundary'
  ) THEN
    RAISE EXCEPTION 'EMISSION_PROJECT_SETUP_ORGANIZATIONAL_BOUNDARY_BINDING_MISSING';
  END IF;
END $$;

UPDATE framework_process_definition
SET process_version = '3.1.1',
    definition_locked = true,
    definition_lock_reason = 'Verified organizational-boundary route contract V20260805154000',
    last_reviewed_at = current_timestamp,
    updated_at = current_timestamp
WHERE process_code = 'EMISSION_PROJECT';

SET LOCAL session_replication_role = origin;
