-- Close the duplicated carbon-emission relay.
-- EMISSION_PROJECT remains the immutable parent design/history aggregate, while
-- only its professional child processes are executable in the live relay.

insert into framework_process_design_revision(process_code,revision_reason,snapshot)
select d.process_code,
       '2026-08-06 remove duplicated macro execution and establish parent orchestrator',
       jsonb_build_object(
         'definition',to_jsonb(d),
         'steps',coalesce((select jsonb_agg(to_jsonb(s) order by s.step_order) from framework_process_step s where s.process_code=d.process_code),'[]'::jsonb),
         'chain',coalesce((select jsonb_agg(to_jsonb(c) order by c.process_order) from framework_process_chain c where c.chain_code='EMISSION_TWENTY_STEP_RELAY'),'[]'::jsonb)
       )
from framework_process_definition d
where d.process_code in ('EMISSION_PROJECT','ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION','REGULATORY_SUBMISSION');

alter table framework_process_definition disable trigger trg_guard_locked_process_definition;

update framework_process_definition
set definition_locked=false,
    definition_lock_reason='Controlled orchestrator correction V20260806170000; snapshot stored',
    updated_at=current_timestamp
where process_code in ('EMISSION_PROJECT','ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION','REGULATORY_SUBMISSION');

update framework_process_definition
set process_version='4.0.0',
    automation_mode='ORCHESTRATOR',
    process_level=1,
    parent_process_code=null,
    goal='조직경계, 활동자료, 산정·검증, 보고·인증 및 규제 제출 전문 프로세스의 상태와 산출물을 한 번만 집계한다.',
    start_condition='포트폴리오에서 프로젝트가 선택되고 실행 주기와 책임자가 확정된 경우 하위 전문 프로세스를 시작한다.',
    completion_condition='필수 하위 프로세스가 순서와 완료 계약을 충족하고 최종 제출·접수 증적까지 연결된 경우에만 상위 업무를 완료한다.',
    updated_at=current_timestamp
where process_code='EMISSION_PROJECT';

update framework_process_definition
set parent_process_code='EMISSION_PROJECT',
    process_level=2,
    updated_at=current_timestamp
where process_code in ('ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION','REGULATORY_SUBMISSION');

update framework_process_definition
set definition_locked=true,
    definition_lock_reason='Parent orchestrator and child relay verified by V20260806170000',
    last_reviewed_at=current_timestamp,
    updated_at=current_timestamp
where process_code in ('EMISSION_PROJECT','ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION','REGULATORY_SUBMISSION');

alter table framework_process_definition enable trigger trg_guard_locked_process_definition;

delete from framework_process_chain where chain_code='EMISSION_TWENTY_STEP_RELAY';

insert into framework_process_chain
 (chain_code,process_code,process_order,next_process_code,auto_start_yn,use_at,created_at,updated_at)
values
 ('EMISSION_TWENTY_STEP_RELAY','EMISSION_PROJECT_PORTFOLIO',1,'ORGANIZATIONAL_BOUNDARY','Y','Y',current_timestamp,current_timestamp),
 ('EMISSION_TWENTY_STEP_RELAY','ORGANIZATIONAL_BOUNDARY',2,'ACTIVITY_DATA','Y','Y',current_timestamp,current_timestamp),
 ('EMISSION_TWENTY_STEP_RELAY','ACTIVITY_DATA',3,'EMISSION_CALCULATION','Y','Y',current_timestamp,current_timestamp),
 ('EMISSION_TWENTY_STEP_RELAY','EMISSION_CALCULATION',4,'REPORT_CERTIFICATION','Y','Y',current_timestamp,current_timestamp),
 ('EMISSION_TWENTY_STEP_RELAY','REPORT_CERTIFICATION',5,'REGULATORY_SUBMISSION','Y','Y',current_timestamp,current_timestamp),
 ('EMISSION_TWENTY_STEP_RELAY','REGULATORY_SUBMISSION',6,null,'N','Y',current_timestamp,current_timestamp);

-- The portfolio handoff must agree with the executable relay, not the parent summary.
update framework_process_data_handoff
set to_process_code='ORGANIZATIONAL_BOUNDARY',
    to_step_code='ORGANIZATIONAL_BOUNDARY_S1',
    context_keys='["tenantId","projectId","cycleId","reportingPeriod","selectedProjectId"]'::jsonb,
    payload_contract='{"required":["selectedProjectId","cycleId","reportingPeriod"],"nextProcessCode":"ORGANIZATIONAL_BOUNDARY","nextStepCode":"ORGANIZATIONAL_BOUNDARY_S1"}'::jsonb,
    design_status='APPROVED',
    updated_at=current_timestamp
where process_code='EMISSION_PROJECT_PORTFOLIO'
  and from_step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
  and handoff_type='PROCESS';

insert into framework_process_dependency
 (parent_process_code,parent_step_code,child_process_code,dependency_order,dependency_type,completion_required,use_at,created_at,updated_at)
values
 ('EMISSION_PROJECT','EMISSION_PROJECT_SETUP','ORGANIZATIONAL_BOUNDARY',1,'COMPLETION_GATE',true,'Y',current_timestamp,current_timestamp),
 ('EMISSION_PROJECT','EMISSION_PROJECT_COLLECT','ACTIVITY_DATA',2,'COMPLETION_GATE',true,'Y',current_timestamp,current_timestamp),
 ('EMISSION_PROJECT','EMISSION_PROJECT_CALCULATE','EMISSION_CALCULATION',3,'COMPLETION_GATE',true,'Y',current_timestamp,current_timestamp),
 ('EMISSION_PROJECT','EMISSION_PROJECT_REPORT','REPORT_CERTIFICATION',4,'COMPLETION_GATE',true,'Y',current_timestamp,current_timestamp),
 ('EMISSION_PROJECT','EMISSION_PROJECT_REPORT','REGULATORY_SUBMISSION',5,'COMPLETION_GATE',true,'Y',current_timestamp,current_timestamp)
on conflict(parent_process_code,parent_step_code,child_process_code) do update set
 dependency_order=excluded.dependency_order,
 dependency_type=excluded.dependency_type,
 completion_required=excluded.completion_required,
 use_at='Y',updated_at=current_timestamp;

do $$
declare
  actual_chain text;
  child_count integer;
  executable_step_count integer;
begin
  select string_agg(process_code,'>' order by process_order)
    into actual_chain
    from framework_process_chain
   where chain_code='EMISSION_TWENTY_STEP_RELAY' and use_at='Y';
  if actual_chain <> 'EMISSION_PROJECT_PORTFOLIO>ORGANIZATIONAL_BOUNDARY>ACTIVITY_DATA>EMISSION_CALCULATION>REPORT_CERTIFICATION>REGULATORY_SUBMISSION' then
    raise exception 'Emission executable relay mismatch: %',actual_chain;
  end if;
  if exists(select 1 from framework_process_chain where chain_code='EMISSION_TWENTY_STEP_RELAY' and process_code='EMISSION_PROJECT' and use_at='Y') then
    raise exception 'Parent orchestrator must not be executable in relay';
  end if;
  select count(*) into child_count from framework_process_definition
   where parent_process_code='EMISSION_PROJECT' and process_level=2
     and process_code in ('ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION','REGULATORY_SUBMISSION');
  if child_count <> 5 then raise exception 'Emission child hierarchy incomplete: %/5',child_count; end if;
  select count(*) into executable_step_count from framework_process_step
   where process_code in ('EMISSION_PROJECT_PORTFOLIO','ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION','REGULATORY_SUBMISSION');
  if executable_step_count <> 21 then raise exception 'Executable emission relay step count mismatch: %/21',executable_step_count; end if;
end $$;
