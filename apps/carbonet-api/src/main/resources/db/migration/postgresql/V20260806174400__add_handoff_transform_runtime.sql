create or replace function framework_apply_handoff_transform(
    p_transform text,
    p_value jsonb,
    p_tenant_id text
) returns jsonb
language plpgsql
stable
as $$
declare
    v_transform text := upper(coalesce(nullif(trim(p_transform), ''), 'IDENTITY'));
    v_result jsonb;
    v_text text;
    v_total numeric;
begin
    if p_value is null or p_value = 'null'::jsonb then
        return p_value;
    end if;

    case v_transform
        when 'IDENTITY' then
            return p_value;
        when 'ARRAY_WRAP' then
            return case when jsonb_typeof(p_value) = 'array' then p_value else jsonb_build_array(p_value) end;
        when 'AGGREGATE_SUM' then
            if jsonb_typeof(p_value) = 'array' then
                select coalesce(sum(replace(element #>> '{}', ',', '')::numeric), 0)
                  into v_total
                  from jsonb_array_elements(p_value) element
                 where replace(element #>> '{}', ',', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$';
                return to_jsonb(v_total);
            end if;
            v_text := replace(p_value #>> '{}', ',', '');
            if v_text ~ '^[+-]?[0-9]+([.][0-9]+)?$' then
                return to_jsonb(v_text::numeric);
            end if;
            raise exception 'AGGREGATE_SUM requires a number or numeric array, received %', p_value;
        when 'LOOKUP_SITE_LABEL' then
            select to_jsonb(site.site_name)
              into v_result
              from emission_site_registry site
             where site.tenant_id = p_tenant_id
               and (site.site_code = p_value #>> '{}' or site.site_name = p_value #>> '{}')
               and site.site_status = 'ACTIVE'
             order by site.updated_at desc nulls last
             limit 1;
            return coalesce(v_result, p_value);
        else
            raise exception 'Unsupported handoff transform: %', v_transform;
    end case;
end;
$$;

comment on function framework_apply_handoff_transform(text,jsonb,text) is
    'Applies fail-closed semantic field transforms for actor/process work handoffs.';

do $$
begin
    if framework_apply_handoff_transform('AGGREGATE_SUM', '[1,"2.5","ignored"]'::jsonb, 'DEFAULT') <> '3.5'::jsonb then
        raise exception 'AGGREGATE_SUM transform contract failed';
    end if;
    if framework_apply_handoff_transform('ARRAY_WRAP', '"SITE-1"'::jsonb, 'DEFAULT') <> '["SITE-1"]'::jsonb then
        raise exception 'ARRAY_WRAP transform contract failed';
    end if;
    if framework_apply_handoff_transform('IDENTITY', '{"value":1}'::jsonb, 'DEFAULT') <> '{"value":1}'::jsonb then
        raise exception 'IDENTITY transform contract failed';
    end if;
end $$;
