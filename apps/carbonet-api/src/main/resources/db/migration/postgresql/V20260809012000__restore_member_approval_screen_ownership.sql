WITH route_map(step_code,user_path,admin_path) AS (VALUES
  ('MEMBER_APPROVAL_S1','/join/companyJoinStatusSearch','/admin/member/approve'),
  ('MEMBER_APPROVAL_S2','/join/companyJoinStatusDetail','/admin/member/approve'),
  ('MEMBER_APPROVAL_S3','/join/companyJoinStatusDetail','/admin/member/approve'),
  ('MEMBER_APPROVAL_S4','/signin/loginView','/admin/member/list')
)
UPDATE framework_process_step step
SET user_path=route_map.user_path,
    admin_path=route_map.admin_path,
    requires_user_page=true,
    requires_admin_page=true
FROM route_map
WHERE step.process_code='MEMBER_APPROVAL'
  AND step.step_code=route_map.step_code;

WITH route_map(step_code,user_path,admin_path) AS (VALUES
  ('MEMBER_APPROVAL_S1','/join/companyJoinStatusSearch','/admin/member/approve'),
  ('MEMBER_APPROVAL_S2','/join/companyJoinStatusDetail','/admin/member/approve'),
  ('MEMBER_APPROVAL_S3','/join/companyJoinStatusDetail','/admin/member/approve'),
  ('MEMBER_APPROVAL_S4','/signin/loginView','/admin/member/list')
), rewritten AS (
  SELECT spec.process_code,spec.step_code,
         jsonb_agg(
           jsonb_set(
             jsonb_set(
               jsonb_set(
                 jsonb_set(screen,'{actualRoute}',to_jsonb(
                   CASE screen->>'audience' WHEN 'ADMIN' THEN route_map.admin_path ELSE route_map.user_path END
                 ),true),
                 '{routePath}',to_jsonb(
                   CASE screen->>'audience' WHEN 'ADMIN' THEN route_map.admin_path ELSE route_map.user_path END
                 ),true),
               '{routeStatus}',to_jsonb('IMPLEMENTED'::text),true),
             '{plannedRoute}','null'::jsonb,true
           ) ORDER BY screen->>'audience'
         ) AS screen_contract,
         md5(spec.process_code||'|'||spec.step_code||'|'||route_map.user_path||'|'||route_map.admin_path) AS source_hash
  FROM framework_step_execution_spec spec
  JOIN route_map USING(step_code)
  CROSS JOIN LATERAL jsonb_array_elements(spec.screen_contract) screen
  WHERE spec.process_code='MEMBER_APPROVAL'
  GROUP BY spec.process_code,spec.step_code,route_map.user_path,route_map.admin_path
)
UPDATE framework_step_execution_spec spec
SET screen_contract=rewritten.screen_contract,
    source_hash=rewritten.source_hash,
    updated_at=current_timestamp
FROM rewritten
WHERE spec.process_code=rewritten.process_code AND spec.step_code=rewritten.step_code;

DO $$
DECLARE step_count integer; implemented_screen_count integer; missing_contract_count integer;
BEGIN
  SELECT count(*) INTO step_count FROM framework_process_step
   WHERE process_code='MEMBER_APPROVAL' AND requires_user_page AND requires_admin_page
     AND user_path NOT LIKE '/admin/%' AND admin_path LIKE '/admin/%';
  SELECT count(*) INTO implemented_screen_count
  FROM framework_step_execution_spec spec
  CROSS JOIN LATERAL jsonb_array_elements(spec.screen_contract) screen
  WHERE spec.process_code='MEMBER_APPROVAL'
    AND screen->>'routeStatus'='IMPLEMENTED'
    AND nullif(screen->>'actualRoute','') IS NOT NULL;
  SELECT missing_user_screen_contract_count+missing_admin_screen_contract_count
    INTO missing_contract_count
  FROM framework_process_design_assurance_matrix WHERE process_code='MEMBER_APPROVAL';
  IF step_count<>4 OR implemented_screen_count<>8 OR missing_contract_count<>0 THEN
    RAISE EXCEPTION 'member approval screen ownership failed steps=% screens=% missing=%',
      step_count,implemented_screen_count,missing_contract_count;
  END IF;
END $$;
