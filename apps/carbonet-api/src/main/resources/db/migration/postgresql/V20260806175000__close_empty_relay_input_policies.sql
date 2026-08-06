update framework_process_data_handoff handoff
   set payload_contract=handoff.payload_contract || jsonb_build_object(
           'unmappedFieldPolicies', coalesce(handoff.payload_contract->'unmappedFieldPolicies','[]'::jsonb),
           'inputPolicyVersion', 1,
           'inputPolicyMode', 'FAIL_CLOSED'
       ),
       updated_at=current_timestamp
  from framework_carbon_relay_field_audit canonical
 where canonical.process_code=handoff.process_code
   and canonical.from_step_code=handoff.from_step_code
   and canonical.to_process_code=handoff.to_process_code
   and canonical.to_step_code=handoff.to_step_code
   and (
       handoff.payload_contract->>'inputPolicyMode' is distinct from 'FAIL_CLOSED'
       or handoff.payload_contract->>'inputPolicyVersion' is distinct from '1'
       or handoff.payload_contract->'unmappedFieldPolicies' is null
   );

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
         = jsonb_array_length(coalesce(handoff.payload_contract->'unmappedFieldPolicies','[]'::jsonb))
       and handoff.payload_contract->>'inputPolicyMode'='FAIL_CLOSED'
       and handoff.payload_contract->>'inputPolicyVersion'='1' policy_ready
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
        raise exception 'Carbon relay policy envelope closure failed edges=% ready=% unmapped=% policies=%',
            v_edges,v_ready,v_unmapped,v_policies;
    end if;
end $$;
