CREATE TABLE IF NOT EXISTS emission_organizational_boundary (
  boundary_id bigserial PRIMARY KEY,
  tenant_id varchar(100) NOT NULL,
  project_id varchar(100) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  boundary_method varchar(30) NOT NULL CHECK(boundary_method IN ('OPERATIONAL_CONTROL','FINANCIAL_CONTROL','EQUITY_SHARE')),
  reporting_basis varchar(60) NOT NULL DEFAULT 'GHG_PROTOCOL_CORPORATE',
  rationale text NOT NULL,
  effective_from date NOT NULL,
  effective_until date,
  boundary_status varchar(24) NOT NULL DEFAULT 'DRAFT' CHECK(boundary_status IN ('DRAFT','REVIEW_READY','CONSOLIDATED','APPROVED','REJECTED')),
  row_version integer NOT NULL DEFAULT 1,
  created_by varchar(100) NOT NULL,
  approved_by varchar(100),approved_at timestamp,
  created_at timestamp NOT NULL DEFAULT current_timestamp,updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(tenant_id,project_id,version_no),CHECK(effective_until IS NULL OR effective_until>=effective_from)
);

CREATE TABLE IF NOT EXISTS emission_organizational_boundary_member (
  member_id bigserial PRIMARY KEY,boundary_id bigint NOT NULL REFERENCES emission_organizational_boundary(boundary_id) ON DELETE CASCADE,
  entity_code varchar(80) NOT NULL,entity_name varchar(200) NOT NULL,entity_type varchar(30) NOT NULL,
  country_code varchar(2) NOT NULL DEFAULT 'KR',ownership_percent numeric(7,4) NOT NULL DEFAULT 100 CHECK(ownership_percent BETWEEN 0 AND 100),
  control_type varchar(30) NOT NULL CHECK(control_type IN ('OPERATIONAL','FINANCIAL','EQUITY','NONE')),
  included_yn char(1) NOT NULL CHECK(included_yn IN ('Y','N')),exclusion_reason text,evidence_ref text,
  created_at timestamp NOT NULL DEFAULT current_timestamp,updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(boundary_id,entity_code),CHECK(included_yn='Y' OR nullif(btrim(exclusion_reason),'') IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS emission_organizational_boundary_elimination (
  elimination_id bigserial PRIMARY KEY,boundary_id bigint NOT NULL REFERENCES emission_organizational_boundary(boundary_id) ON DELETE CASCADE,
  source_entity_code varchar(80) NOT NULL,counterparty_entity_code varchar(80) NOT NULL,activity_category varchar(100) NOT NULL,
  gross_emission numeric(24,8) NOT NULL CHECK(gross_emission>=0),eliminated_emission numeric(24,8) NOT NULL CHECK(eliminated_emission>=0),
  unit varchar(30) NOT NULL DEFAULT 'tCO2e',evidence_ref text NOT NULL,created_by varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp,CHECK(source_entity_code<>counterparty_entity_code),CHECK(eliminated_emission<=gross_emission)
);

CREATE TABLE IF NOT EXISTS emission_organizational_boundary_consolidation (
  consolidation_id bigserial PRIMARY KEY,boundary_id bigint NOT NULL REFERENCES emission_organizational_boundary(boundary_id) ON DELETE CASCADE,
  gross_emission numeric(24,8) NOT NULL,eliminated_emission numeric(24,8) NOT NULL,net_emission numeric(24,8) NOT NULL,
  included_entity_count integer NOT NULL,excluded_entity_count integer NOT NULL,reconciliation_difference numeric(24,8) NOT NULL DEFAULT 0,
  calculation_hash varchar(64) NOT NULL,calculated_by varchar(100) NOT NULL,calculated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(boundary_id,calculation_hash),CHECK(net_emission=gross_emission-eliminated_emission)
);

CREATE INDEX IF NOT EXISTS ix_org_boundary_project ON emission_organizational_boundary(tenant_id,project_id,version_no DESC);
CREATE INDEX IF NOT EXISTS ix_org_boundary_member ON emission_organizational_boundary_member(boundary_id,included_yn,entity_code);

UPDATE framework_process_step SET
  to_state=CASE WHEN step_code='ORGANIZATIONAL_BOUNDARY_S4' THEN 'COMPLETED' ELSE to_state END,
  user_path='/emission/organizational-boundary',
  admin_path='/admin/emission/organizational-boundary',
  api_contract=CASE step_code
    WHEN 'ORGANIZATIONAL_BOUNDARY_S1' THEN 'GET|PUT /home/api/emission-projects/{id}/organizational-boundary'
    WHEN 'ORGANIZATIONAL_BOUNDARY_S2' THEN 'PUT /home/api/emission-projects/{id}/organizational-boundary; POST /home/api/emission-projects/{id}/organizational-boundary/review-ready'
    WHEN 'ORGANIZATIONAL_BOUNDARY_S3' THEN 'POST /home/api/emission-projects/{id}/organizational-boundary/consolidate'
    ELSE 'POST /home/api/emission-projects/{id}/organizational-boundary/decision' END,
  requires_user_page=true,requires_admin_page=true,requires_api=true,requires_database=true,
  automation_status='PLANNED'
WHERE process_code='ORGANIZATIONAL_BOUNDARY';

DELETE FROM framework_professional_screen_contract WHERE process_code='ORGANIZATIONAL_BOUNDARY';
WITH source_contract AS (
  SELECT DISTINCT ON (audience) * FROM framework_professional_screen_contract
  WHERE process_code='EMISSION_PROJECT' ORDER BY audience,contract_id
), steps AS (
  SELECT * FROM framework_process_step WHERE process_code='ORGANIZATIONAL_BOUNDARY'
)
INSERT INTO framework_professional_screen_contract(
  process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,entry_condition,exit_condition,
  kpi_contract,section_contract,field_contract,command_contract,state_contract,api_contract,data_contract,evidence_contract,
  responsive_contract,accessibility_contract,security_contract,api_verified,database_verified,authority_verified,
  responsive_verified,accessibility_verified,exception_states_verified,audit_evidence_ref,contract_status,updated_by,menu_visibility,menu_verified)
SELECT s.process_code,s.step_code,c.audience,
  CASE c.audience WHEN 'USER' THEN s.user_path ELSE s.admin_path END,s.step_name,s.actor_code,s.requirement_text,s.from_state,s.completion_rule,
  '["includedEntityCount","excludedEntityCount","grossEmission","eliminatedEmission","netEmission","reconciliationDifference"]',
  '["workflowSummary","boundaryVersion","entityRegister","inclusionDecision","eliminationLedger","consolidationResult","approvalHistory"]',
  '["boundaryMethod","reportingBasis","effectiveFrom","effectiveUntil","entityCode","entityName","entityType","countryCode","ownershipPercent","controlType","includedYn","exclusionReason","evidenceRef","grossEmission","eliminatedEmission","netEmission","reviewComment"]',
  '["saveDraft","markReviewReady","runConsolidation","approve","reject","viewHistory","continueGuide"]',
  '["LOADING","EMPTY","EDITING","VALIDATION_ERROR","FORBIDDEN","CONFLICT","READY","LOCKED"]',s.api_contract,
  '["emission_organizational_boundary","emission_organizational_boundary_member","emission_organizational_boundary_elimination","emission_organizational_boundary_consolidation","framework_process_execution_event"]',
  '["ownershipEvidence","controlEvidence","exclusionReason","internalTransactionEvidence","approvalAudit"]',
  c.responsive_contract,c.accessibility_contract,c.security_contract,false,true,true,true,true,true,
  'schema-and-contract:V20260721093000','REVIEW_REQUIRED','FLYWAY','HIDDEN',false
FROM steps s CROSS JOIN source_contract c;

UPDATE framework_process_definition SET process_version='1.1.0',process_status='IN_DEVELOPMENT',automation_mode='AUTOMATIC',updated_at=current_timestamp
WHERE process_code='ORGANIZATIONAL_BOUNDARY';
