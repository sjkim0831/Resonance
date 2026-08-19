insert into framework_actor_definition(actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,delegation_allowed) values
('LCA_PROGRAM_MANAGER','LCA 프로그램 관리자','LCA Program Manager','BUSINESS','LCA 포트폴리오와 전체 SLA 책임','LCA_PORTFOLIO,LCA_ESCALATION',true),
('LCA_PROJECT_OWNER','LCA 프로젝트 책임자','LCA Project Owner','BUSINESS','LCA 프로젝트 목적·범위·완료 책임','LCA_PROJECT,LCA_SCOPE',true),
('LCA_SPECIALIST','LCA 전문가','LCA Specialist','BUSINESS','LCA 모델링·산정·해석 수행','LCA_MODEL,LCA_CALCULATE,LCA_REPORT',true),
('LCA_APPROVER','LCA 승인자','LCA Approver','AUTHORITY','LCA 결과·보고서 최종 승인','LCA_APPROVE',false),
('LCA_METHOD_REVIEWER','LCA 방법론 검토자','LCA Method Reviewer','REVIEW','방법론·범위·계산 독립 검토','LCA_METHOD_REVIEW',false),
('LCA_PROCESS_MODELER','LCA 공정 모델러','LCA Process Modeler','BUSINESS','제품·공정·흐름 모델링','LCA_PROCESS_MODEL',true),
('LCA_DATA_REVIEWER','LCA 데이터 검토자','LCA Data Reviewer','REVIEW','원천 데이터 완전성·품질 검토','LCA_DATA_REVIEW',false),
('LCA_DATA_STEWARD','LCA 데이터 스튜어드','LCA Data Steward','BUSINESS','LCI 데이터셋·매핑·버전 관리','LCA_DATASET,LCA_MAPPING',true),
('FINANCE_DATA_OWNER','재무 데이터 책임자','Finance Data Owner','BUSINESS','경제적 배분 근거 확인','LCA_ALLOCATION_BASIS',false),
('LCA_CALCULATION_ENGINE','LCA 계산 엔진','LCA Calculation Engine','SYSTEM','재현 가능한 LCI·LCIA 계산','LCA_CALCULATE',false),
('LCA_CRITICAL_REVIEWER','LCA 독립 검토자','LCA Critical Reviewer','REVIEW','결과의 독립·비판적 검토','LCA_CRITICAL_REVIEW',false),
('LCA_REPORT_AUTHOR','LCA 보고서 작성자','LCA Report Author','BUSINESS','LCA 보고서·양식 작성','LCA_REPORT',true),
('DESIGN_SYSTEM_MANAGER','디자인시스템 관리자','Design System Manager','PLATFORM','KRDS·공통 컴포넌트 품질 관리','SCREEN_DESIGN',false),
('REPORT_VERIFIER','보고서 검증자','Report Verifier','REVIEW','식별값·데이터·표·차트·페이지 진위 검증','REPORT_VERIFY',false),
('AUDIT_MANAGER','감사 관리자','Audit Manager','AUTHORITY','변조·불일치 사건 감사 조치','AUDIT_CASE',false)
on conflict(actor_code) do update set actor_name=excluded.actor_name,actor_name_en=excluded.actor_name_en,
 actor_type=excluded.actor_type,purpose=excluded.purpose,capability_codes=excluded.capability_codes,
 delegation_allowed=excluded.delegation_allowed,updated_at=current_timestamp;

create table if not exists framework_lca_workspace_record (
    workspace_id uuid primary key default gen_random_uuid(),
    process_code varchar(80) not null,
    business_key varchar(160) not null,
    payload_json jsonb not null default '{}'::jsonb,
    workflow_status varchar(24) not null default 'DRAFT',
    assigned_actor varchar(80) not null,
    version integer not null default 1,
    created_by varchar(100) not null,
    updated_by varchar(100) not null,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    constraint uq_framework_lca_workspace_business unique(process_code,business_key),
    constraint chk_framework_lca_workspace_process check(process_code ~ '^LCA_[A-Z0-9_]+$'),
    constraint chk_framework_lca_workspace_payload check(jsonb_typeof(payload_json)='object'),
    constraint chk_framework_lca_workspace_status check(workflow_status in('DRAFT','VALIDATED','SUBMITTED','APPROVED','REJECTED')),
    constraint chk_framework_lca_workspace_actor check(btrim(assigned_actor)<>'')
);

create table if not exists framework_lca_workspace_event (
    event_id bigserial primary key,
    workspace_id uuid not null references framework_lca_workspace_record(workspace_id) on delete restrict,
    process_code varchar(80) not null,
    command_code varchar(24) not null,
    from_status varchar(24) not null,
    to_status varchar(24) not null,
    evidence_json jsonb not null default '{}'::jsonb,
    executed_by varchar(100) not null,
    executed_at timestamptz not null default current_timestamp,
    constraint chk_framework_lca_workspace_event_evidence check(jsonb_typeof(evidence_json)='object')
);

create index if not exists idx_framework_lca_workspace_process_status
    on framework_lca_workspace_record(process_code,workflow_status,updated_at desc);
create index if not exists idx_framework_lca_workspace_event_workspace
    on framework_lca_workspace_event(workspace_id,event_id desc);

do $$
begin
    if to_regclass('framework_lca_workspace_record') is null
       or to_regclass('framework_lca_workspace_event') is null then
        raise exception 'LCA workspace execution tables were not created';
    end if;
    if exists(select 1 from pg_roles where rolname='carbonet_app') then
        execute 'grant select,insert,update on framework_lca_workspace_record to carbonet_app';
        execute 'grant select,insert on framework_lca_workspace_event to carbonet_app';
        execute 'grant usage,select on sequence framework_lca_workspace_event_event_id_seq to carbonet_app';
    end if;
end $$;
