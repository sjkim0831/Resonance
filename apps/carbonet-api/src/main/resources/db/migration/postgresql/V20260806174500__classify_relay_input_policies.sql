with target_contract as (
    select distinct on (contract.process_code, contract.step_code)
           contract.process_code, contract.step_code,
           framework_try_jsonb(contract.field_contract) fields
      from framework_professional_screen_contract contract
     order by contract.process_code, contract.step_code,
              case contract.audience when 'USER' then 0 else 1 end,
              contract.updated_at desc
), classified as (
    select handoff.process_code, handoff.from_step_code,
           handoff.to_process_code, handoff.to_step_code, handoff.handoff_type,
           coalesce(jsonb_agg(jsonb_build_object(
               'fieldCode', target_field->>'fieldCode',
               'fieldName', coalesce(target_field->>'fieldName', target_field->>'fieldCode'),
               'inputClass', case
                   when target_field->>'fieldCode' in
                       ('tenantId','projectId','processCode','stepCode','actorCode',
                        'reportingYear','periodStart','periodEnd') then 'AUTO_CONTEXT'
                   when upper(coalesce(target_field->>'controlType','')) in ('DOMAIN_CONTROL','ACTION_GROUP') then 'DOMAIN_ACTION'
                   when not coalesce((target_field->>'editable')::boolean,false) then 'SYSTEM_DERIVED'
                   when coalesce((target_field->>'required')::boolean,false) then 'USER_REQUIRED'
                   else 'USER_OPTIONAL'
               end,
               'required', coalesce((target_field->>'required')::boolean,false),
               'editable', coalesce((target_field->>'editable')::boolean,false),
               'controlType', upper(coalesce(target_field->>'controlType','TEXT')),
               'defaultSource', case
                   when target_field->>'fieldCode' in
                       ('tenantId','projectId','processCode','stepCode','actorCode',
                        'reportingYear','periodStart','periodEnd') then 'EXECUTION_CONTEXT'
                   when upper(coalesce(target_field->>'controlType','')) in ('DOMAIN_CONTROL','ACTION_GROUP') then 'DOMAIN_SERVICE'
                   when not coalesce((target_field->>'editable')::boolean,false) then 'SYSTEM_STATE'
                   else 'USER'
               end,
               'prerequisiteType', case upper(coalesce(target_field->>'controlType',''))
                   when 'ORGANIZATION_SELECT' then 'ORGANIZATION_REGISTRY'
                   when 'SITE_SELECT' then 'SITE_REGISTRY'
                   when 'ACTOR_SELECT' then 'ACTOR_ASSIGNMENT'
                   when 'FACILITY_SELECT' then 'FACILITY_REGISTRY'
                   when 'UNIT_SELECT' then 'UNIT_REFERENCE'
                   when 'FACTOR_SEARCH' then 'EMISSION_FACTOR_REFERENCE'
                   when 'REPORT_SELECT' then 'REPORT_REGISTRY'
                   when 'SOURCE_SELECT' then 'DATA_SOURCE_REGISTRY'
                   when 'SOURCE_LINK' then 'DATA_SOURCE_REGISTRY'
                   else 'NONE'
               end,
               'sourceTable', coalesce(target_field->>'sourceTable',''),
               'sourceColumn', coalesce(target_field->>'sourceColumn',''),
               'blocking', (
                   upper(coalesce(target_field->>'controlType','')) in ('DOMAIN_CONTROL','ACTION_GROUP')
                   or (coalesce((target_field->>'editable')::boolean,false)
                       and coalesce((target_field->>'required')::boolean,false))
               )
           ) order by target_field->>'fieldCode'), '[]'::jsonb) policies
      from framework_process_data_handoff handoff
      join target_contract contract
        on contract.process_code=handoff.to_process_code
       and contract.step_code=handoff.to_step_code
      cross join lateral jsonb_array_elements_text(
          coalesce(handoff.payload_contract->'unmappedTargetFields','[]'::jsonb)
      ) unmapped(field_code)
      join lateral (
          select field
            from jsonb_array_elements(coalesce(contract.fields,'[]'::jsonb)) field
           where field->>'fieldCode'=unmapped.field_code
           order by coalesce((field->>'editable')::boolean,false) desc
           limit 1
      ) selected on true
      cross join lateral (select selected.field as target_field) normalized
     group by handoff.process_code, handoff.from_step_code,
              handoff.to_process_code, handoff.to_step_code, handoff.handoff_type
)
update framework_process_data_handoff handoff
   set payload_contract=handoff.payload_contract || jsonb_build_object(
           'unmappedFieldPolicies', classified.policies,
           'inputPolicyVersion', 1,
           'inputPolicyMode', 'FAIL_CLOSED'
       ),
       updated_at=current_timestamp
  from classified
 where handoff.process_code=classified.process_code
   and handoff.from_step_code=classified.from_step_code
   and handoff.to_process_code=classified.to_process_code
   and handoff.to_step_code=classified.to_step_code
   and handoff.handoff_type=classified.handoff_type;

create or replace view framework_carbon_relay_input_policy_audit as
select handoff.process_code,handoff.from_step_code,
       handoff.to_process_code,handoff.to_step_code,
       jsonb_array_length(coalesce(handoff.payload_contract->'unmappedTargetFields','[]'::jsonb)) unmapped_count,
       jsonb_array_length(coalesce(handoff.payload_contract->'unmappedFieldPolicies','[]'::jsonb)) policy_count,
       count(*) filter(where policy->>'inputClass'='AUTO_CONTEXT') auto_context_count,
       count(*) filter(where policy->>'inputClass'='SYSTEM_DERIVED') system_derived_count,
       count(*) filter(where policy->>'inputClass'='DOMAIN_ACTION') domain_action_count,
       count(*) filter(where policy->>'inputClass'='USER_REQUIRED') user_required_count,
       count(*) filter(where policy->>'inputClass'='USER_OPTIONAL') user_optional_count,
       count(*) filter(where policy->>'prerequisiteType'<>'NONE') prerequisite_count,
       jsonb_array_length(coalesce(handoff.payload_contract->'unmappedTargetFields','[]'::jsonb))
         = jsonb_array_length(coalesce(handoff.payload_contract->'unmappedFieldPolicies','[]'::jsonb)) policy_ready
  from framework_process_data_handoff handoff
  join framework_carbon_relay_field_audit canonical
    on canonical.process_code=handoff.process_code
   and canonical.from_step_code=handoff.from_step_code
   and canonical.to_process_code=handoff.to_process_code
   and canonical.to_step_code=handoff.to_step_code
  left join lateral jsonb_array_elements(coalesce(handoff.payload_contract->'unmappedFieldPolicies','[]'::jsonb)) policy on true
 group by handoff.process_code,handoff.from_step_code,handoff.to_process_code,handoff.to_step_code,
          handoff.payload_contract;

do $$
declare
    v_edges integer;
    v_ready integer;
    v_unmapped integer;
    v_policies integer;
begin
    select count(*),count(*) filter(where policy_ready),sum(unmapped_count),sum(policy_count)
      into v_edges,v_ready,v_unmapped,v_policies
      from framework_carbon_relay_input_policy_audit;
    if v_edges<>20 or v_ready<>20 or v_unmapped<>244 or v_policies<>244 then
        raise exception 'Carbon relay input policy closure failed edges=% ready=% unmapped=% policies=%',
            v_edges,v_ready,v_unmapped,v_policies;
    end if;
end $$;
