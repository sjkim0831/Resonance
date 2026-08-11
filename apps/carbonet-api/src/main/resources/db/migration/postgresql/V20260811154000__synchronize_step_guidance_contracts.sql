-- Keep workflow guidance complete as canonical process steps are added or revised.
-- Curated guidance is preserved; only CANONICAL_STEP generated rows are refreshed.

CREATE OR REPLACE FUNCTION framework_sync_step_guidance_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  generated_rule text := 'CANONICAL_STEP:ACTOR_AUTHORIZED';
  generated_mode text;
  generated_sections jsonb;
BEGIN
  generated_mode := CASE
    WHEN NEW.requires_user_page AND NEW.requires_admin_page THEN 'USER_ADMIN_RELAY'
    WHEN NEW.requires_user_page THEN 'USER_WORK'
    WHEN NEW.requires_admin_page THEN 'ADMIN_WORK'
    ELSE 'AUTOMATED_WORK'
  END;

  SELECT coalesce(jsonb_agg(section ORDER BY section->>'audience'), '[]'::jsonb)
  INTO generated_sections
  FROM (
    SELECT jsonb_build_object(
      'audience', 'USER', 'route', NEW.user_path, 'stepCode', NEW.step_code,
      'actorCode', NEW.actor_code, 'commandCode', NEW.command_code
    ) AS section
    WHERE NEW.requires_user_page AND nullif(btrim(NEW.user_path), '') IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object(
      'audience', 'ADMIN', 'route', NEW.admin_path, 'stepCode', NEW.step_code,
      'actorCode', NEW.actor_code, 'commandCode', NEW.command_code
    ) AS section
    WHERE NEW.requires_admin_page AND nullif(btrim(NEW.admin_path), '') IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object(
      'audience', 'SYSTEM', 'route', null, 'stepCode', NEW.step_code,
      'actorCode', NEW.actor_code, 'commandCode', NEW.command_code,
      'apiContract', coalesce(NEW.api_contract, '')
    ) AS section
    WHERE NOT NEW.requires_user_page AND NOT NEW.requires_admin_page
  ) sections;

  INSERT INTO framework_step_guidance_contract(
    process_code, step_code, applicability_type, applicability_rule,
    view_mode, completion_gate, skip_authority_actor, required_sections,
    use_at, created_at, updated_at
  ) VALUES (
    NEW.process_code, NEW.step_code, 'REQUIRED', generated_rule,
    generated_mode, NEW.completion_rule, NULL, generated_sections,
    'Y', current_timestamp, current_timestamp
  )
  ON CONFLICT(process_code, step_code) DO UPDATE
  SET view_mode = excluded.view_mode,
      completion_gate = excluded.completion_gate,
      required_sections = excluded.required_sections,
      use_at = 'Y',
      updated_at = current_timestamp
  WHERE framework_step_guidance_contract.applicability_rule LIKE 'CANONICAL_STEP:%';

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_step_guidance_contract ON framework_process_step;
CREATE TRIGGER trg_sync_step_guidance_contract
AFTER INSERT OR UPDATE OF actor_code, command_code, completion_rule,
  requires_user_page, requires_admin_page, user_path, admin_path, api_contract
ON framework_process_step
FOR EACH ROW EXECUTE FUNCTION framework_sync_step_guidance_contract();

INSERT INTO framework_step_guidance_contract(
  process_code, step_code, applicability_type, applicability_rule,
  view_mode, completion_gate, skip_authority_actor, required_sections,
  use_at, created_at, updated_at
)
SELECT step.process_code, step.step_code, 'REQUIRED', 'CANONICAL_STEP:ACTOR_AUTHORIZED',
  CASE
    WHEN step.requires_user_page AND step.requires_admin_page THEN 'USER_ADMIN_RELAY'
    WHEN step.requires_user_page THEN 'USER_WORK'
    WHEN step.requires_admin_page THEN 'ADMIN_WORK'
    ELSE 'AUTOMATED_WORK'
  END,
  step.completion_rule, NULL,
  CASE
    WHEN step.requires_user_page AND step.requires_admin_page THEN
      jsonb_build_array(
        jsonb_build_object('audience','USER','route',step.user_path,'stepCode',step.step_code,'actorCode',step.actor_code,'commandCode',step.command_code),
        jsonb_build_object('audience','ADMIN','route',step.admin_path,'stepCode',step.step_code,'actorCode',step.actor_code,'commandCode',step.command_code)
      )
    WHEN step.requires_user_page THEN
      jsonb_build_array(jsonb_build_object('audience','USER','route',step.user_path,'stepCode',step.step_code,'actorCode',step.actor_code,'commandCode',step.command_code))
    WHEN step.requires_admin_page THEN
      jsonb_build_array(jsonb_build_object('audience','ADMIN','route',step.admin_path,'stepCode',step.step_code,'actorCode',step.actor_code,'commandCode',step.command_code))
    ELSE
      jsonb_build_array(jsonb_build_object('audience','SYSTEM','route',null,'stepCode',step.step_code,'actorCode',step.actor_code,'commandCode',step.command_code,'apiContract',coalesce(step.api_contract,'')))
  END,
  'Y', current_timestamp, current_timestamp
FROM framework_process_step step
ON CONFLICT(process_code, step_code) DO NOTHING;

DO $$
DECLARE
  total_steps integer;
  guided_steps integer;
BEGIN

  SELECT count(*) INTO total_steps FROM framework_process_step;
  SELECT count(*) INTO guided_steps
  FROM framework_process_step step
  WHERE EXISTS (
    SELECT 1 FROM framework_step_guidance_contract guidance
    WHERE guidance.process_code = step.process_code
      AND guidance.step_code = step.step_code
      AND guidance.use_at = 'Y'
      AND nullif(btrim(guidance.completion_gate), '') IS NOT NULL
      AND jsonb_array_length(guidance.required_sections) > 0
  );

  IF guided_steps <> total_steps THEN
    RAISE EXCEPTION 'STEP_GUIDANCE_SYNC_INCOMPLETE guided=% total=%', guided_steps, total_steps;
  END IF;
END $$;
