-- Keep DATA_INTEGRATION command contracts executable by the common command runtime.
-- The professionalization migration stored transition aliases (fromState/toState)
-- in command_contract. Runtime packages require explicit command entry/result state
-- and server-side authorization declarations.

UPDATE framework_professional_screen_contract c
SET command_contract = jsonb_build_array(jsonb_build_object(
      'commandCode', s.command_code,
      'actorCode', s.actor_code,
      'entryState', s.from_state,
      'resultState', s.to_state,
      'serverAuthorization', true,
      'validationRequired', true,
      'idempotencyRequired', true,
      'auditRequired', true
    ))::text,
    updated_by = 'DATA_INTEGRATION_COMMAND_CONTRACT_ALIGNMENT',
    updated_at = current_timestamp
FROM framework_process_step s
WHERE c.process_code = 'DATA_INTEGRATION'
  AND s.process_code = c.process_code
  AND s.step_code = c.step_code;

UPDATE framework_step_execution_spec e
SET command_contract = jsonb_build_array(jsonb_build_object(
      'commandCode', s.command_code,
      'actorCode', s.actor_code,
      'entryState', s.from_state,
      'resultState', s.to_state,
      'serverAuthorization', true,
      'validationRequired', true,
      'idempotencyRequired', true,
      'auditRequired', true
    )),
    generation_status = 'READY',
    source_hash = md5(
      e.actor_contract::text || e.business_contract::text || e.transition_contract::text ||
      e.input_contract::text || e.output_contract::text || e.screen_contract::text ||
      e.field_contract::text ||
      jsonb_build_array(jsonb_build_object(
        'commandCode', s.command_code,
        'actorCode', s.actor_code,
        'entryState', s.from_state,
        'resultState', s.to_state,
        'serverAuthorization', true,
        'validationRequired', true,
        'idempotencyRequired', true,
        'auditRequired', true
      ))::text ||
      e.api_contract::text || e.persistence_contract::text || e.handoff_contract::text ||
      e.test_contract::text || e.guide_contract::text || e.nonfunctional_contract::text
    ),
    updated_at = current_timestamp
FROM framework_process_step s
WHERE e.process_code = 'DATA_INTEGRATION'
  AND s.process_code = e.process_code
  AND s.step_code = e.step_code;

DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT count(*) INTO invalid_count
  FROM framework_step_execution_spec e
  CROSS JOIN LATERAL jsonb_array_elements(e.command_contract) command_item
  WHERE e.process_code = 'DATA_INTEGRATION'
    AND (
      command_item->>'entryState' IS DISTINCT FROM e.transition_contract->>'fromState'
      OR command_item->>'resultState' IS DISTINCT FROM e.transition_contract->>'toState'
      OR coalesce((command_item->>'serverAuthorization')::boolean, false) IS NOT TRUE
    );

  IF invalid_count <> 0 THEN
    RAISE EXCEPTION 'DATA_INTEGRATION command contracts remain invalid: %', invalid_count;
  END IF;
END $$;
