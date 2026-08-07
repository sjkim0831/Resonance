-- Follow-up: V20260807134000 is installed, so preserve its Flyway checksum.
INSERT INTO framework_process_execution_topology(
 process_code,work_type_code,stage_code,execution_wave,lane_code,lane_order,
 execution_mode,join_strategy,predecessor_process_codes,successor_process_codes,
 shared_milestone_code,required_for_join,applicability_rule,topology_status)
VALUES (
 'COMPANY_REAPPLICATION_PUBLIC','MEMBER','기업 신청 반려 보완',4,'SUPPORT',2,
 'CONDITIONAL','ALL','["MEMBER_REGISTRATION"]'::jsonb,'["COMPANY_ONBOARDING"]'::jsonb,
 'MEMBER_COMPANY_REAPPLICATION_SUPPORT_W4',false,
 'COMPANY_APPLICATION_STATUS=REJECTED','DESIGN_COMPLETE')
ON CONFLICT(process_code) DO UPDATE SET
 work_type_code=excluded.work_type_code,stage_code=excluded.stage_code,
 execution_wave=excluded.execution_wave,lane_code=excluded.lane_code,
 lane_order=excluded.lane_order,execution_mode=excluded.execution_mode,
 join_strategy=excluded.join_strategy,
 predecessor_process_codes=excluded.predecessor_process_codes,
 successor_process_codes=excluded.successor_process_codes,
 shared_milestone_code=excluded.shared_milestone_code,
 required_for_join=excluded.required_for_join,
 applicability_rule=excluded.applicability_rule,
 topology_status='DESIGN_COMPLETE',updated_at=current_timestamp;

UPDATE framework_process_execution_topology
SET successor_process_codes=CASE
 WHEN successor_process_codes @> '["COMPANY_REAPPLICATION_PUBLIC"]'::jsonb THEN successor_process_codes
 ELSE successor_process_codes || '["COMPANY_REAPPLICATION_PUBLIC"]'::jsonb END,
 updated_at=current_timestamp
WHERE process_code='MEMBER_REGISTRATION';

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET domain_code='MEMBER',updated_at=current_timestamp
WHERE process_code='COMPANY_REAPPLICATION_PUBLIC' AND upper(domain_code)<>'MEMBER';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

INSERT INTO framework_process_navigation_binding(
 process_code,menu_code,step_code,actor_code,audience,navigation_type,target_path,
 business_screen_implemented,binding_status,binding_source,verified_at)
SELECT 'COMPANY_REAPPLICATION_PUBLIC',menu.menu_code,
 'COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC_APPLICANT','USER','HIDDEN_ROUTE',
 '/join/companyReapply',true,'ACTIVE','COMPANY_REAPPLICATION_PUBLIC_1_0_1',current_timestamp
FROM LATERAL (
 SELECT m.menu_code FROM comtnmenuinfo m
 WHERE m.use_at='Y' AND coalesce(m.expsr_at,'Y')='Y'
   AND btrim(coalesce(m.menu_url,'')) NOT IN ('','#') AND m.menu_url LIKE '/%'
   AND (m.menu_code LIKE 'H108%' OR m.menu_code LIKE 'A111%')
 ORDER BY CASE WHEN m.menu_code LIKE 'H108%' THEN 0 ELSE 1 END,
   length(m.menu_code),m.menu_code LIMIT 1
) menu
ON CONFLICT(process_code) DO UPDATE SET
 menu_code=excluded.menu_code,step_code=excluded.step_code,actor_code=excluded.actor_code,
 audience=excluded.audience,navigation_type=excluded.navigation_type,
 target_path=excluded.target_path,business_screen_implemented=true,binding_status='ACTIVE',
 binding_source=excluded.binding_source,verified_at=current_timestamp,updated_at=current_timestamp;

DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM framework_process_execution_topology topology
  JOIN framework_process_execution_topology predecessor
   ON predecessor.process_code='MEMBER_REGISTRATION'
  WHERE topology.process_code='COMPANY_REAPPLICATION_PUBLIC'
   AND topology.work_type_code='MEMBER'
   AND topology.execution_mode='CONDITIONAL'
   AND topology.lane_code='SUPPORT'
   AND topology.predecessor_process_codes='["MEMBER_REGISTRATION"]'::jsonb
   AND topology.successor_process_codes='["COMPANY_ONBOARDING"]'::jsonb
   AND NOT topology.required_for_join
   AND topology.topology_status='DESIGN_COMPLETE'
   AND predecessor.work_type_code=topology.work_type_code
   AND predecessor.execution_wave<topology.execution_wave
 ) THEN
  RAISE EXCEPTION 'COMPANY_REAPPLICATION_PUBLIC_TOPOLOGY_MISSING_OR_INVALID';
 END IF;
END $$;