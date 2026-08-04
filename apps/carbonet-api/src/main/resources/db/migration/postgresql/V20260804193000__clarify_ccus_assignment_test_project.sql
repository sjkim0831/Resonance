-- Keep the stable project key because task, process and audit records reference it.
-- Clarify the customer-facing label so it is not mistaken for a non-CCUS project.
UPDATE emission_project_registry
SET project_name = 'CCUS 통합 업무 검증 프로젝트',
    site_name = 'CCUS 테스트 사업장',
    updated_at = current_timestamp
WHERE tenant_id = 'TEST_COMPANY_001'
  AND project_id = 'PRJ-ACTOR-TEST';
