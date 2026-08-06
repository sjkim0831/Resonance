-- Keep the approved transition contract and its executable command binding atomic.
-- A terminal-state correction previously changed transition_contract only, leaving
-- the common command runtime with a stale resultState. The trigger below makes the
-- transition the source of truth whenever the same command is materialized.

CREATE OR REPLACE FUNCTION framework_align_step_execution_command_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transition_command text;
  transition_from text;
  transition_to text;
  transition_actor text;
BEGIN
  IF jsonb_typeof(NEW.transition_contract) <> 'object'
     OR jsonb_typeof(NEW.command_contract) <> 'array' THEN
    RETURN NEW;
  END IF;

  transition_command := NEW.transition_contract->>'commandCode';
  transition_from := NEW.transition_contract->>'fromState';
  transition_to := NEW.transition_contract->>'toState';
  transition_actor := NEW.actor_contract->>'actorCode';
  IF coalesce(transition_command, '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(jsonb_agg(
           CASE WHEN command_item->>'commandCode' = transition_command THEN
             command_item || jsonb_strip_nulls(jsonb_build_object(
               'actorCode', transition_actor,
               'entryState', transition_from,
               'resultState', transition_to,
               'serverAuthorization', true,
               'idempotencyRequired', true
             ))
           ELSE command_item END
           ORDER BY command_order
         ), '[]'::jsonb)
  INTO NEW.command_contract
  FROM jsonb_array_elements(NEW.command_contract) WITH ORDINALITY
       AS commands(command_item, command_order);

  NEW.source_hash := encode(sha256(convert_to(concat_ws('|',
    NEW.actor_contract::text, NEW.business_contract::text,
    NEW.transition_contract::text, NEW.input_contract::text,
    NEW.output_contract::text, NEW.screen_contract::text,
    NEW.field_contract::text, NEW.command_contract::text,
    NEW.api_contract::text, NEW.persistence_contract::text,
    NEW.handoff_contract::text, NEW.test_contract::text,
    NEW.guide_contract::text, NEW.nonfunctional_contract::text
  ), 'UTF8')), 'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_align_step_execution_command_transition
  ON framework_step_execution_spec;
CREATE TRIGGER trg_align_step_execution_command_transition
BEFORE INSERT OR UPDATE OF actor_contract, transition_contract, command_contract
ON framework_step_execution_spec
FOR EACH ROW
EXECUTE FUNCTION framework_align_step_execution_command_transition();

-- Repair all pre-existing compiled specifications, not only the currently
-- observed regulatory-submission terminal step.
UPDATE framework_step_execution_spec
SET command_contract = command_contract
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(command_contract) command_item
  WHERE command_item->>'commandCode' = transition_contract->>'commandCode'
    AND (
      command_item->>'actorCode' IS DISTINCT FROM actor_contract->>'actorCode'
      OR command_item->>'entryState' IS DISTINCT FROM transition_contract->>'fromState'
      OR command_item->>'resultState' IS DISTINCT FROM transition_contract->>'toState'
      OR coalesce((command_item->>'serverAuthorization')::boolean, false) IS NOT TRUE
      OR coalesce((command_item->>'idempotencyRequired')::boolean, false) IS NOT TRUE
    )
);

DO $$
DECLARE
  mismatch_count integer;
BEGIN
  SELECT count(*)
  INTO mismatch_count
  FROM framework_step_execution_spec execution_spec
  CROSS JOIN LATERAL jsonb_array_elements(execution_spec.command_contract) command_item
  WHERE command_item->>'commandCode' = execution_spec.transition_contract->>'commandCode'
    AND (
      command_item->>'actorCode' IS DISTINCT FROM execution_spec.actor_contract->>'actorCode'
      OR command_item->>'entryState' IS DISTINCT FROM execution_spec.transition_contract->>'fromState'
      OR command_item->>'resultState' IS DISTINCT FROM execution_spec.transition_contract->>'toState'
      OR coalesce((command_item->>'serverAuthorization')::boolean, false) IS NOT TRUE
      OR coalesce((command_item->>'idempotencyRequired')::boolean, false) IS NOT TRUE
    );
  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'step transition and command contracts remain misaligned: %', mismatch_count;
  END IF;
END;
$$;
