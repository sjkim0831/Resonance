CREATE TABLE IF NOT EXISTS emission_site_registry (
  site_id bigserial PRIMARY KEY,
  tenant_id varchar(100) NOT NULL,
  site_code varchar(40) NOT NULL,
  site_name varchar(160) NOT NULL,
  country_code varchar(2) NOT NULL DEFAULT 'KR',
  postal_code varchar(10),
  address varchar(300) NOT NULL,
  detail_address varchar(300),
  boundary_method varchar(40) NOT NULL DEFAULT 'OPERATIONAL_CONTROL',
  data_owner_id varchar(100),
  site_status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  effective_from date NOT NULL DEFAULT current_date,
  effective_until date,
  source_type varchar(30) NOT NULL DEFAULT 'ADMIN_REGISTERED',
  version_no integer NOT NULL DEFAULT 1,
  created_by varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_by varchar(100) NOT NULL,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  CONSTRAINT ck_emission_site_country CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT ck_emission_site_boundary CHECK (boundary_method IN ('OPERATIONAL_CONTROL','FINANCIAL_CONTROL','EQUITY_SHARE')),
  CONSTRAINT ck_emission_site_status CHECK (site_status IN ('DRAFT','ACTIVE','INACTIVE')),
  CONSTRAINT ck_emission_site_dates CHECK (effective_until IS NULL OR effective_until >= effective_from),
  CONSTRAINT uq_emission_site_code UNIQUE (tenant_id, site_code)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_emission_site_active_name
  ON emission_site_registry (tenant_id, lower(trim(site_name)))
  WHERE site_status <> 'INACTIVE';
CREATE INDEX IF NOT EXISTS idx_emission_site_tenant_status
  ON emission_site_registry (tenant_id, site_status, site_name);

INSERT INTO emission_site_registry
  (tenant_id,site_code,site_name,address,site_status,source_type,created_by,updated_by)
SELECT p.tenant_id,
       'LEGACY-' || upper(substr(md5(p.tenant_id || ':' || p.site_name),1,10)),
       p.site_name,
       '기존 프로젝트에서 이관됨',
       'ACTIVE',
       'LEGACY_PROJECT',
       'flyway',
       'flyway'
  FROM emission_project_registry p
 WHERE trim(p.site_name) <> ''
 GROUP BY p.tenant_id,p.site_name
ON CONFLICT (tenant_id,site_code) DO NOTHING;

INSERT INTO framework_process_definition
  (process_code,process_name,domain_code,process_version,goal,start_condition,completion_condition,process_status)
VALUES
  ('COMPANY_ONBOARDING','기업·사업장 온보딩','IDENTITY','2.0.0',
   '승인된 기업, 등록 사업장, 책임 액터와 업무분리를 갖춘 고객만 탄소배출 프로젝트를 시작하게 한다.',
   '회원가입 신청과 기업 증빙이 제출되어 있다.',
   '기업 승인, 활성 사업장, 프로젝트 필수 액터 준비 상태가 모두 충족된다.','ACTIVE')
ON CONFLICT (process_code) DO UPDATE SET
  process_name=excluded.process_name,domain_code=excluded.domain_code,process_version=excluded.process_version,
  goal=excluded.goal,start_condition=excluded.start_condition,completion_condition=excluded.completion_condition,
  process_status=excluded.process_status,updated_at=current_timestamp;

DELETE FROM framework_process_step WHERE process_code='COMPANY_ONBOARDING';
INSERT INTO framework_process_step
  (process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,
   completion_rule,user_path,admin_path,api_contract,parent_step_code,step_type,requirement_text,
   input_contract,output_contract,requires_user_page,requires_admin_page,requires_api,requires_database,
   requires_notification,automation_status,sla_hours,escalation_actor_code,evidence_required,evidence_types,
   segregation_actor_codes,rollback_command_code,decision_rule)
VALUES
 ('COMPANY_ONBOARDING',1,'COMPANY_ONBOARDING_APPLY','기업 등록 신청','COMPANY_MANAGER','READY','APPLY_COMPANY','APPLIED',
  '법인 기본정보, 담당자, 사업자등록 증빙이 저장된다.','/join/companyRegister','/admin/member/company-approve','POST /join/api/company-register',null,'USER_ACTION','기업 등록 신청과 증빙 제출',
  '{"required":["company","representative","businessNumber","contact","evidence"]}','{"state":"APPLIED"}',true,true,true,true,true,'VERIFIED',24,'PLATFORM_OPERATOR',true,'DATA_SNAPSHOT,AUDIT_LOG','','CANCEL_COMPANY_APPLICATION','필수값·중복·증빙 검증'),
 ('COMPANY_ONBOARDING',2,'COMPANY_ONBOARDING_APPROVE','기업 심사·승인','APPROVER','APPLIED','APPROVE_COMPANY','APPROVED',
  '독립 승인자가 증빙과 대표권을 확인하고 승인 또는 사유 있는 반려를 저장한다.','/join/companyJoinStatusDetail','/admin/member/company-approve','POST /api/admin/member/company-approve/action','COMPANY_ONBOARDING_APPLY','APPROVAL','기업 승인과 반려·재신청',
  '{"required":["institutionId","decision","reasonWhenRejected"]}','{"state":"APPROVED"}',true,true,true,true,true,'VERIFIED',48,'PLATFORM_OPERATOR',true,'DECISION_NOTE,AUDIT_LOG','COMPANY_MANAGER','REOPEN_COMPANY_APPLICATION','신청자와 승인자 업무분리'),
 ('COMPANY_ONBOARDING',3,'COMPANY_ONBOARDING_SITE','조직·사업장 등록','COMPANY_MANAGER','APPROVED','REGISTER_SITE','SITE_READY',
  '승인 기업에 유효한 주소·경계방법·담당자가 있는 활성 사업장이 한 곳 이상 존재한다.','/mypage/company','/admin/emission/site-management','GET|POST /api/admin/emission/sites','COMPANY_ONBOARDING_APPROVE','ADMIN_ACTION','조직과 사업장 운영경계 등록',
  '{"required":["siteCode","siteName","countryCode","address","boundaryMethod"]}','{"state":"SITE_READY"}',true,true,true,true,true,'IMPLEMENTED',24,'PLATFORM_OPERATOR',true,'DATA_SNAPSHOT,AUDIT_LOG','','DEACTIVATE_SITE','사업장 코드·명칭 중복 및 유효기간 검증'),
 ('COMPANY_ONBOARDING',4,'COMPANY_ONBOARDING_ACTORS','담당 액터·업무분리 배정','COMPANY_MANAGER','SITE_READY','ASSIGN_ACTORS','ACTORS_READY',
  '기업 책임자·자료담당·산정·검증·승인 액터가 활성이고 산정·검증·승인 계정이 서로 다르다.','/mypage/staff','/admin/system/actor-process','POST /api/admin/system/actor-process/assign','COMPANY_ONBOARDING_SITE','APPROVAL','프로젝트 수행 담당자와 데이터 범위 설정',
  '{"requiredActors":["COMPANY_MANAGER","SITE_DATA_OWNER","CALCULATOR","VERIFIER","APPROVER"]}','{"state":"ACTORS_READY"}',true,true,true,true,true,'IMPLEMENTED',24,'PLATFORM_OPERATOR',true,'AUDIT_LOG','CALCULATOR,VERIFIER,APPROVER','REVOKE_ACTOR_ASSIGNMENT','산정·검증·승인 상호 분리'),
 ('COMPANY_ONBOARDING',5,'COMPANY_ONBOARDING_READY','프로젝트 착수 준비 진단','COMPANY_MANAGER','ACTORS_READY','CHECK_PROJECT_READINESS','READY_FOR_PROJECT',
  '기업 승인·활성 사업장·필수 액터·업무분리 상태가 서버 진단을 통과한다.','/emission/project/create','/admin/emission/project-operations','GET /home/api/emission-projects/options','COMPANY_ONBOARDING_ACTORS','SYSTEM_ACTION','프로젝트 생성 전 준비 상태 검사',
  '{"required":["approvedCompany","activeSite","actorCoverage","segregation"]}','{"ready":true}',true,true,true,true,true,'IMPLEMENTED',1,'PLATFORM_OPERATOR',true,'VALIDATION_REPORT,AUDIT_LOG','','RECHECK_ONBOARDING','모든 차단 사유가 해소된 경우에만 프로젝트 생성 허용');

INSERT INTO framework_simulation_case
  (case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,case_status,severity,required_evidence,automated,expected_duration_minutes)
VALUES
 ('COMPANY_ONBOARDING_HAPPY','COMPANY_ONBOARDING','승인 기업 정상 착수','HAPPY_PATH','승인 기업, 활성 사업장, 역할별 계정 존재','[{"command":"CHECK_PROJECT_READINESS","actor":"COMPANY_MANAGER"}]','[{"path":"$.ready","equals":true},{"path":"$.missing","size":0}]','AUTOMATED','CRITICAL','HTTP_STATUS,STATE_TRANSITION,AUDIT_EVENT',true,2),
 ('COMPANY_ONBOARDING_NO_COMPANY','COMPANY_ONBOARDING','미승인 기업 차단','VALIDATION','기업 상태가 승인 전','[{"command":"CHECK_PROJECT_READINESS"}]','[{"contains":"COMPANY_NOT_APPROVED"},{"projectCreate":"BLOCKED"}]','AUTOMATED','CRITICAL','HTTP_STATUS,VALIDATION_RESULT',true,2),
 ('COMPANY_ONBOARDING_NO_SITE','COMPANY_ONBOARDING','사업장 미등록 차단','VALIDATION','승인 기업이지만 활성 사업장 없음','[{"command":"CHECK_PROJECT_READINESS"}]','[{"contains":"ACTIVE_SITE_REQUIRED"},{"projectCreate":"BLOCKED"}]','AUTOMATED','CRITICAL','HTTP_STATUS,VALIDATION_RESULT',true,2),
 ('COMPANY_ONBOARDING_ROLE_GAP','COMPANY_ONBOARDING','필수 액터 누락 차단','AUTHORITY','검증 담당자 배정 없음','[{"command":"CHECK_PROJECT_READINESS"}]','[{"contains":"REQUIRED_ACTOR_MISSING:VERIFIER"},{"projectCreate":"BLOCKED"}]','AUTOMATED','CRITICAL','AUTHORITY_RESULT,AUDIT_EVENT',true,2),
 ('COMPANY_ONBOARDING_SOD','COMPANY_ONBOARDING','업무분리 위반 차단','AUTHORITY','산정자와 승인자가 동일 계정','[{"command":"CREATE_PROJECT"}]','[{"error":"PROJECT_SEGREGATION_OF_DUTIES_REQUIRED"}]','AUTOMATED','CRITICAL','AUTHORITY_RESULT,AUDIT_EVENT',true,2),
 ('COMPANY_ONBOARDING_TENANT','COMPANY_ONBOARDING','타 기업 사업장 격리','ISOLATION','다른 tenant의 사업장 코드 사용','[{"command":"CREATE_PROJECT"}]','[{"error":"PROJECT_SITE_NOT_REGISTERED"},{"crossTenantWrite":false}]','AUTOMATED','CRITICAL','HTTP_STATUS,AUTHORITY_RESULT,AUDIT_EVENT',true,3),
 ('COMPANY_ONBOARDING_RETRY','COMPANY_ONBOARDING','진단 재시도 복구','RECOVERY','차단 항목을 모두 보완함','[{"command":"CHECK_PROJECT_READINESS"},{"command":"CREATE_PROJECT"}]','[{"path":"$.ready","equals":true},{"projectCreated":true}]','AUTOMATED','MAJOR','STATE_TRANSITION,AUDIT_EVENT',true,4)
ON CONFLICT (case_code) DO UPDATE SET preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,case_status='AUTOMATED',automated=true,updated_at=current_timestamp;

INSERT INTO ui_component_registry
  (component_id,component_name,component_type,owner_domain,props_schema_json,design_reference,active_yn,category,default_props,asset_fingerprint,created_at,updated_at)
VALUES
  ('EmissionSiteRegistry','EmissionSiteRegistry','DATA_TABLE','admin',
   '{"properties":{"siteRows":{"type":"array"},"tenantId":{"type":"string"},"boundaryMethod":{"type":"string"},"siteStatus":{"type":"string"}}}',
   'KRDS_CURRENT','Y','MANIFEST','{}',md5('EmissionSiteRegistry|siteRows|tenantId|boundaryMethod|siteStatus'),current_timestamp,current_timestamp)
ON CONFLICT (component_id) DO UPDATE SET props_schema_json=excluded.props_schema_json,design_reference='KRDS_CURRENT',active_yn='Y',asset_fingerprint=excluded.asset_fingerprint,updated_at=current_timestamp;

INSERT INTO ui_section_registry
  (section_id,section_name,section_type,layout_contract,responsive_contract,accessibility_contract,design_reference,asset_fingerprint,active_yn,created_at,updated_at)
VALUES
  ('SEC_EMISSION_SITE_REGISTRY','조직·사업장 원장','CONTENT',
   'readiness summary, tenant-scoped site form, registry table, edit action',
   'single column form on mobile, two columns on tablet, four columns on desktop; table scrolls only inside its container',
   'labelled controls, keyboard actions, textual status, error status announcement, no color-only meaning',
   'KRDS_CURRENT',md5('SEC_EMISSION_SITE_REGISTRY|v1'),'Y',current_timestamp,current_timestamp)
ON CONFLICT (section_id) DO UPDATE SET layout_contract=excluded.layout_contract,responsive_contract=excluded.responsive_contract,accessibility_contract=excluded.accessibility_contract,design_reference='KRDS_CURRENT',asset_fingerprint=excluded.asset_fingerprint,active_yn='Y',updated_at=current_timestamp;

INSERT INTO framework_design_asset_registry
  (design_asset_id,page_id,route_path,menu_code,domain_code,layout_version,design_token_version,composition_json,source_path,asset_fingerprint,active_yn,created_at,updated_at)
VALUES
  ('DSN_EMISSION_SITE_MANAGEMENT','emission-site-management','/admin/emission/site-management','A0020105','admin','v2','KRDS_CURRENT',
   '[{"componentId":"EmissionSiteSummary","instanceKey":"emission-site-summary","layoutZone":"actions","props":["summaryCards","menuCode"]},{"componentId":"EmissionSiteRegistry","instanceKey":"emission-site-registry","layoutZone":"content","props":["siteRows","tenantId","boundaryMethod","siteStatus"]},{"componentId":"EmissionSiteQuickLinks","instanceKey":"emission-site-quick-links","layoutZone":"content","props":["quickLinks","menuCode"]},{"componentId":"EmissionSiteOperations","instanceKey":"emission-site-operation-cards","layoutZone":"content","props":["operationCards","statusLabel"]},{"componentId":"EmissionSiteFeatureCatalog","instanceKey":"emission-site-feature-catalog","layoutZone":"content","props":["featureRows","featureCode","manageUrl"]}]'::jsonb,
   'projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts',md5('emission-site-management|v2|EmissionSiteRegistry'),'Y',current_timestamp,current_timestamp)
ON CONFLICT (design_asset_id) DO UPDATE SET layout_version='v2',composition_json=excluded.composition_json,asset_fingerprint=excluded.asset_fingerprint,active_yn='Y',updated_at=current_timestamp;

UPDATE framework_process_definition
   SET definition_locked=true,
       definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY',
       lifecycle_status='ACTIVE',
       last_reviewed_at=current_timestamp,
       next_review_at=current_timestamp + interval '180 days',
       updated_at=current_timestamp
 WHERE process_code='COMPANY_ONBOARDING';
