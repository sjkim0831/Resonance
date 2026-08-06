-- Keep the executable screen graph and the page-development ledger in sync.
-- Screen generators and professional-contract projection may add resources
-- after SERVICE_PAGE_MASTER was first populated.  Missing ledger rows make a
-- deterministic contract audit fail before it can report honest BLOCKED/PASS
-- evidence, so registration is automatic and deliberately fail-closed.

CREATE OR REPLACE FUNCTION framework_sync_page_development_master(
  requested_screen_resource_id bigint DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  inserted_count integer := 0;
BEGIN
  -- sequence_no is unique inside the plan.  Serialize only this very small
  -- metadata allocation; no business table or runtime command is locked.
  PERFORM pg_advisory_xact_lock(hashtext('framework:page-development-master'));

  WITH plan_base AS (
    SELECT coalesce(max(sequence_no),0) AS base_sequence
    FROM framework_page_development_item
    WHERE plan_code='SERVICE_PAGE_MASTER'
  ), missing AS (
    SELECT r.screen_resource_id,r.route_key,r.screen_name,r.implementation_status,
           row_number() OVER (ORDER BY r.route_key,r.screen_resource_id) AS offset_sequence
    FROM framework_screen_resource r
    LEFT JOIN framework_page_development_item item
      ON item.plan_code='SERVICE_PAGE_MASTER'
     AND item.screen_resource_id=r.screen_resource_id
    WHERE item.item_id IS NULL
      AND (requested_screen_resource_id IS NULL OR r.screen_resource_id=requested_screen_resource_id)
  )
  INSERT INTO framework_page_development_item(
    plan_code,screen_resource_id,sequence_no,priority_score,
    design_status,frontend_status,backend_status,test_status,deployment_status,
    menu_code,menu_name,menu_status,
    permission_code,permission_name,permission_status,
    blocker_reason,next_action,updated_by
  )
  SELECT
    'SERVICE_PAGE_MASTER',missing.screen_resource_id,
    (plan_base.base_sequence+missing.offset_sequence)::integer,
    CASE
      WHEN missing.route_key LIKE '/join/%' OR missing.route_key LIKE '/emission/%' THEN 100
      WHEN missing.route_key LIKE '/home/%' THEN 90
      ELSE 70
    END,
    'REVIEW_REQUIRED',
    CASE WHEN missing.implementation_status IN('VERIFIED','IMPLEMENTED')
      THEN missing.implementation_status ELSE 'PLANNED' END,
    'PLANNED','PLANNED',
    CASE WHEN missing.implementation_status='VERIFIED' THEN 'DEPLOYED' ELSE 'PLANNED' END,
    menu.menu_code,menu.menu_nm,
    CASE WHEN menu.menu_code IS NULL THEN 'NOT_CONNECTED' ELSE 'CONNECTED' END,
    'PAGE_'||upper(substr(md5(missing.route_key),1,16)),
    missing.screen_name||' 접근','DEFINED',
    'DESIGN_GATE_NOT_EVALUATED',
    '설계·데이터·권한·API·브라우저 증적을 검증한 뒤 상태를 승격합니다.',
    'PAGE_DEVELOPMENT_AUTO_REGISTRATION'
  FROM missing
  CROSS JOIN plan_base
  LEFT JOIN LATERAL (
    SELECT m.menu_code,m.menu_nm
    FROM comtnmenuinfo m
    WHERE lower(split_part(m.menu_url,'?',1))=missing.route_key
    ORDER BY length(m.menu_code) DESC,m.menu_code
    LIMIT 1
  ) menu ON true
  ON CONFLICT(plan_code,screen_resource_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END
$function$;

CREATE OR REPLACE FUNCTION framework_register_page_development_item_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM framework_sync_page_development_master(NEW.screen_resource_id);
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_framework_screen_resource_page_development
  ON framework_screen_resource;
CREATE TRIGGER trg_framework_screen_resource_page_development
AFTER INSERT ON framework_screen_resource
FOR EACH ROW
EXECUTE FUNCTION framework_register_page_development_item_trigger();

-- These contracts were added after the original graph projection migration.
-- Reprojecting is idempotent and binds all four work-assignment procedures to
-- the shared professional workspace without manufacturing duplicate pages.
SELECT framework_sync_professional_contract_screen_graph('WORK_ASSIGNMENT');
SELECT framework_sync_page_development_master(NULL);

DO $block$
DECLARE
  missing_ledger integer;
  missing_active_binding integer;
BEGIN
  SELECT count(*) INTO missing_ledger
  FROM framework_process_step_screen_binding binding
  JOIN framework_screen_resource screen USING(screen_resource_id)
  LEFT JOIN framework_page_development_item item
    ON item.plan_code='SERVICE_PAGE_MASTER'
   AND item.screen_resource_id=screen.screen_resource_id
  WHERE binding.binding_status='ACTIVE' AND item.item_id IS NULL;

  SELECT count(*) INTO missing_active_binding
  FROM framework_process_step step
  JOIN framework_process_definition process USING(process_code)
  LEFT JOIN framework_process_step_screen_binding binding
    ON binding.process_code=step.process_code
   AND binding.step_code=step.step_code
   AND binding.binding_status='ACTIVE'
  WHERE process.process_status='ACTIVE' AND binding.binding_id IS NULL;

  IF missing_ledger<>0 OR missing_active_binding<>0 THEN
    RAISE EXCEPTION
      'screen development synchronization failed missing_ledger=% missing_active_binding=%',
      missing_ledger,missing_active_binding;
  END IF;
END
$block$;

COMMENT ON FUNCTION framework_sync_page_development_master(bigint) IS
  'Idempotently registers new screen resources in SERVICE_PAGE_MASTER without promoting unverified design or test status.';
