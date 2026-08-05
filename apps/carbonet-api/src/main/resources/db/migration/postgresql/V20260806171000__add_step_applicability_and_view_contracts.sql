create table if not exists framework_step_guidance_contract (
    process_code varchar(100) not null,
    step_code varchar(100) not null,
    applicability_type varchar(20) not null default 'REQUIRED',
    applicability_rule text not null default 'ALWAYS',
    view_mode varchar(60) not null,
    completion_gate text not null,
    skip_authority_actor varchar(100),
    required_sections jsonb not null default '[]'::jsonb,
    use_at char(1) not null default 'Y',
    created_at timestamp not null default current_timestamp,
    updated_at timestamp not null default current_timestamp,
    primary key(process_code,step_code),
    constraint ck_step_guidance_applicability check(applicability_type in ('REQUIRED','CONDITIONAL','OPTIONAL','AUTOMATIC'))
);

comment on table framework_step_guidance_contract is
  'DB-driven user guidance contract: applicability, page mode, visible work scope and completion gate for each reusable process step.';

insert into framework_step_guidance_contract
 (process_code,step_code,applicability_type,applicability_rule,view_mode,completion_gate,skip_authority_actor,required_sections,use_at)
select s.process_code,
       s.step_code,
       case
         when s.process_code='REGULATORY_SUBMISSION' then 'CONDITIONAL'
         when s.step_code='ORGANIZATIONAL_BOUNDARY_S3' then 'CONDITIONAL'
         when s.step_code in ('REPORT_CERTIFICATION_03_VERIFY','REPORT_CERTIFICATION_04_APPROVE') then 'CONDITIONAL'
         else 'REQUIRED'
       end,
       case
         when s.process_code='REGULATORY_SUBMISSION' then 'REGULATORY_PROGRAM_SELECTED'
         when s.step_code='ORGANIZATIONAL_BOUNDARY_S3' then 'MULTI_ENTITY_OR_INTERNAL_TRANSACTION_EXISTS'
         when s.step_code='REPORT_CERTIFICATION_03_VERIFY' then 'CERTIFICATE_ISSUANCE_REQUESTED'
         when s.step_code='REPORT_CERTIFICATION_04_APPROVE' then 'DOWNLOADABLE_CERTIFICATE_REQUIRED'
         else 'ALWAYS'
       end,
       case s.process_code
         when 'EMISSION_PROJECT_PORTFOLIO' then 'PORTFOLIO_SELECT'
         when 'ORGANIZATIONAL_BOUNDARY' then 'BOUNDARY_'||s.step_order
         when 'ACTIVITY_DATA' then 'ACTIVITY_'||s.step_order
         when 'EMISSION_CALCULATION' then 'CALCULATION_'||s.step_order
         when 'REPORT_CERTIFICATION' then 'REPORT_'||s.step_order
         when 'REGULATORY_SUBMISSION' then 'SUBMISSION_'||s.step_order
       end,
       coalesce(nullif(s.completion_rule,''),'필수 입력·검증·증적 계약을 충족해야 완료한다.'),
       case when s.process_code='REGULATORY_SUBMISSION' then 'COMPANY_MANAGER' else null end,
       jsonb_build_array(jsonb_build_object(
         'stepCode',s.step_code,
         'route',coalesce(nullif(s.user_path,''),nullif(s.admin_path,''),''),
         'mode',case s.process_code
           when 'EMISSION_PROJECT_PORTFOLIO' then 'PORTFOLIO_SELECT'
           when 'ORGANIZATIONAL_BOUNDARY' then 'BOUNDARY_'||s.step_order
           when 'ACTIVITY_DATA' then 'ACTIVITY_'||s.step_order
           when 'EMISSION_CALCULATION' then 'CALCULATION_'||s.step_order
           when 'REPORT_CERTIFICATION' then 'REPORT_'||s.step_order
           when 'REGULATORY_SUBMISSION' then 'SUBMISSION_'||s.step_order
         end
       )),
       'Y'
  from framework_process_step s
 where s.process_code in ('EMISSION_PROJECT_PORTFOLIO','ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION','REGULATORY_SUBMISSION')
on conflict(process_code,step_code) do update set
 applicability_type=excluded.applicability_type,
 applicability_rule=excluded.applicability_rule,
 view_mode=excluded.view_mode,
 completion_gate=excluded.completion_gate,
 skip_authority_actor=excluded.skip_authority_actor,
 required_sections=excluded.required_sections,
 use_at='Y',updated_at=current_timestamp;

do $$
declare contract_count integer;
begin
  select count(*) into contract_count from framework_step_guidance_contract
   where use_at='Y' and process_code in ('EMISSION_PROJECT_PORTFOLIO','ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION','REGULATORY_SUBMISSION');
  if contract_count <> 21 then
    raise exception 'Emission guidance contract closure mismatch: %/21',contract_count;
  end if;
end $$;
