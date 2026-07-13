CREATE TABLE IF NOT EXISTS framework_actor_definition (
 actor_code varchar(60) PRIMARY KEY, actor_name varchar(120) NOT NULL, actor_name_en varchar(120), actor_type varchar(30) NOT NULL DEFAULT 'BUSINESS', purpose text NOT NULL, capability_codes text NOT NULL DEFAULT '', delegation_allowed boolean NOT NULL DEFAULT false, use_at char(1) NOT NULL DEFAULT 'Y', created_at timestamp NOT NULL DEFAULT current_timestamp, updated_at timestamp NOT NULL DEFAULT current_timestamp
);
CREATE TABLE IF NOT EXISTS framework_account_actor_assignment (
 assignment_id bigserial PRIMARY KEY, account_id varchar(100) NOT NULL, tenant_id varchar(100) NOT NULL DEFAULT 'DEFAULT', project_id varchar(100) NOT NULL DEFAULT '*', actor_code varchar(60) NOT NULL REFERENCES framework_actor_definition(actor_code), data_scope varchar(300) NOT NULL DEFAULT '*', valid_from date NOT NULL DEFAULT current_date, valid_until date, assignment_status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamp NOT NULL DEFAULT current_timestamp, UNIQUE(account_id,tenant_id,project_id,actor_code)
);
CREATE TABLE IF NOT EXISTS framework_process_definition (
 process_code varchar(80) PRIMARY KEY, process_name varchar(160) NOT NULL, domain_code varchar(60) NOT NULL, process_version varchar(20) NOT NULL DEFAULT '1.0.0', goal text NOT NULL, start_condition text NOT NULL, completion_condition text NOT NULL, process_status varchar(30) NOT NULL DEFAULT 'DRAFT', created_at timestamp NOT NULL DEFAULT current_timestamp, updated_at timestamp NOT NULL DEFAULT current_timestamp
);
CREATE TABLE IF NOT EXISTS framework_process_step (
 step_id bigserial PRIMARY KEY, process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE, step_order integer NOT NULL, step_code varchar(80) NOT NULL, step_name varchar(160) NOT NULL, actor_code varchar(60) NOT NULL REFERENCES framework_actor_definition(actor_code), from_state varchar(60) NOT NULL, command_code varchar(80) NOT NULL, to_state varchar(60) NOT NULL, completion_rule text NOT NULL, user_path varchar(300), admin_path varchar(300), api_contract varchar(300), UNIQUE(process_code,step_code), UNIQUE(process_code,step_order)
);
CREATE TABLE IF NOT EXISTS framework_simulation_case (
 case_code varchar(100) PRIMARY KEY, process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE, case_name varchar(180) NOT NULL, case_type varchar(30) NOT NULL DEFAULT 'HAPPY_PATH', preconditions text NOT NULL, steps_json text NOT NULL, assertions_json text NOT NULL, case_status varchar(30) NOT NULL DEFAULT 'DRAFT', created_at timestamp NOT NULL DEFAULT current_timestamp, updated_at timestamp NOT NULL DEFAULT current_timestamp
);
CREATE TABLE IF NOT EXISTS framework_simulation_run (
 run_id bigserial PRIMARY KEY, case_code varchar(100) NOT NULL REFERENCES framework_simulation_case(case_code), process_version varchar(20) NOT NULL, result varchar(20) NOT NULL, failure_reason text, evidence_json text NOT NULL DEFAULT '{}', executed_by varchar(100) NOT NULL, executed_at timestamp NOT NULL DEFAULT current_timestamp
);
CREATE INDEX IF NOT EXISTS idx_actor_assignment_context ON framework_account_actor_assignment(tenant_id,project_id,account_id,assignment_status);

INSERT INTO framework_actor_definition(actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,delegation_allowed) VALUES
('COMPANY_MANAGER','기업 책임자','Company Manager','BUSINESS','프로젝트를 개설하고 최종 결과와 보고 책임을 관리한다.','PROJECT_CREATE,PROJECT_ASSIGN,REPORT_FINALIZE',true),
('SITE_DATA_OWNER','사업장 자료 담당자','Site Data Owner','BUSINESS','사업장 활동자료와 증빙을 정확하게 제출하고 보완한다.','DATA_VIEW,DATA_EDIT,EVIDENCE_UPLOAD,SUBMIT',true),
('CALCULATOR','산정 담당자','Calculator','BUSINESS','단위와 배출계수를 검토하고 배출량을 산정한다.','FACTOR_MAP,CALCULATE,RECALCULATE',true),
('VERIFIER','검증 담당자','Verifier','REVIEW','입력·산정 결과와 증빙을 검증하고 보완을 요청한다.','VALIDATE,CORRECTION_REQUEST,VALIDATION_PASS',true),
('APPROVER','승인권자','Approver','APPROVAL','검증 완료 결과를 승인·반려하고 확정한다.','APPROVE,REJECT,REOPEN',true),
('PLATFORM_OPERATOR','플랫폼 운영자','Platform Operator','OPERATION','프로세스와 프로젝트 운영 상태를 관리한다.','PROCESS_MANAGE,ASSIGNMENT_MANAGE,OVERRIDE',false)
ON CONFLICT(actor_code) DO NOTHING;

INSERT INTO comtccmmndetailcode(code_id,code,code_nm,code_dc,use_at,frst_regist_pnttm,frst_register_id,last_updt_pnttm,last_updusr_id) VALUES('AMENU1','A1110111','액터·프로세스 관리','/admin/system/actor-process','Y',current_timestamp,'ACTOR_PROCESS',current_timestamp,'ACTOR_PROCESS') ON CONFLICT(code_id,code) DO UPDATE SET code_nm=excluded.code_nm,code_dc=excluded.code_dc,use_at='Y',last_updt_pnttm=current_timestamp;
INSERT INTO comtnmenuinfo(menu_code,menu_nm,menu_nm_en,menu_url,menu_icon,use_at,frst_regist_pnttm,last_updt_pnttm,expsr_at) VALUES('A1110111','액터·프로세스 관리','Actor & Process Governance','/admin/system/actor-process','diversity_3','Y',current_timestamp,current_timestamp,'Y') ON CONFLICT(menu_code) DO UPDATE SET menu_nm=excluded.menu_nm,menu_nm_en=excluded.menu_nm_en,menu_url=excluded.menu_url,menu_icon=excluded.menu_icon,use_at='Y',expsr_at='Y',last_updt_pnttm=current_timestamp;
INSERT INTO comtnmenuorder(menu_code,sort_ordr,frst_regist_pnttm,last_updt_pnttm) VALUES('A1110111',1110111,current_timestamp,current_timestamp) ON CONFLICT(menu_code) DO UPDATE SET sort_ordr=excluded.sort_ordr,last_updt_pnttm=current_timestamp;
