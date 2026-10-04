-- Phase 1A candidate definition. Apply only after canonical source approval.
-- Keeps BUSINESS_SITE_ADMINISTRATION unchanged and introduces an additive pilot process.
INSERT INTO framework_process_definition
  (process_code, process_name, domain_code, process_version, goal, start_condition, completion_condition, process_status)
VALUES
  ('BUSINESS_SITE_ADMINISTRATION_PHASE1A', '사업장 관리 Phase 1A', 'CARBON_EMISSION', '1.0.0',
   '사업장 상세·등록·수정과 담당자·조직경계 설정을 일관된 site_id로 관리한다.',
   '관리자 권한과 유효한 Tenant 컨텍스트가 존재한다.',
   '사업장 변경과 설정 결과가 저장되고 동일 site_id로 재조회된다.', 'DRAFT')
ON CONFLICT (process_code) DO NOTHING;

INSERT INTO framework_process_step
  (process_code, step_order, step_code, step_name, actor_code, from_state, command_code, to_state,
   completion_rule, user_path, admin_path, api_contract)
VALUES
  ('BUSINESS_SITE_ADMINISTRATION_PHASE1A', 1, 'SITE_DETAIL', '사업장 목록·상세 조회', 'PLATFORM_OPERATOR', 'READY', 'VIEW_SITE', 'SITE_VIEWED',
   'Tenant 범위의 사업장 목록과 상세 정보가 조회된다.', NULL, '/admin/emission/site-management', 'GET /api/admin/emission/sites; GET /api/admin/emission/sites/{siteId}'),
  ('BUSINESS_SITE_ADMINISTRATION_PHASE1A', 2, 'SITE_CREATE_UPDATE', '사업장 등록·기본정보 수정', 'PLATFORM_OPERATOR', 'SITE_VIEWED', 'SAVE_SITE', 'SITE_SAVED',
   '중복 코드와 stale version 검증을 통과하고 저장 후 재조회된다.', NULL, '/admin/emission/site-management/new', 'POST /api/admin/emission/sites; PUT /api/admin/emission/sites/{siteId}'),
  ('BUSINESS_SITE_ADMINISTRATION_PHASE1A', 3, 'SITE_CONFIGURATION', '담당자·조직경계·지분율 설정', 'PLATFORM_OPERATOR', 'SITE_SAVED', 'CONFIGURE_SITE', 'SITE_CONFIGURED',
   '동일 Tenant의 활성 담당자와 유효한 경계·지분율이 저장된다.', NULL, '/admin/emission/site-management/{siteId}/configuration', 'PUT /api/admin/emission/sites/{siteId}/owner; PUT /api/admin/emission/sites/{siteId}/boundary'),
  ('BUSINESS_SITE_ADMINISTRATION_PHASE1A', 4, 'SITE_HANDOFF', '후속 업무 인계 확인', 'PLATFORM_OPERATOR', 'SITE_CONFIGURED', 'CONFIRM_SITE_HANDOFF', 'COMPLETED',
   'site_id가 후속 프로젝트·활동자료 업무에 전달 가능한 상태로 확인된다.', '/emission/project/create', '/admin/emission/project-operations', 'GET /api/admin/emission/sites/{siteId}/handoff')
ON CONFLICT (process_code, step_code) DO NOTHING;
