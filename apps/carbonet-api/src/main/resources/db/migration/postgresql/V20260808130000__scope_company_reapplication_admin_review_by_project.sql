-- Keep the admin reapplication queue in the same project scope handed off by the public step.
DO $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE framework_screen_capability capability
     SET command_contract = jsonb_set(
           capability.command_contract,
           '{query}',
           '["pageIndex","searchKeyword","sbscrbSttus","result","projectId"]'::jsonb,
           true),
         evidence_contract = capability.evidence_contract
           || '{"projectScoped":true,"crossProjectRowsExcluded":true}'::jsonb,
         updated_at = current_timestamp
    FROM framework_screen_resource resource
   WHERE resource.screen_resource_id = capability.screen_resource_id
     AND resource.route_key = '/admin/member/company-approve'
     AND capability.capability_code = 'LOAD_COMPANY_REAPPLICATION_REVIEW';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one company reapplication review capability, updated %',
      updated_count;
  END IF;
END $$;
