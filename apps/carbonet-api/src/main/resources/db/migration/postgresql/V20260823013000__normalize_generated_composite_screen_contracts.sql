-- Upgrade requirement-generated screen contracts at the canonical compiler
-- boundary. Persisted design input remains reviewable, while the generated
-- contract becomes an exact executable command adapter with field, authority,
-- response, failure, and recovery semantics.
CREATE OR REPLACE FUNCTION public.framework_normalize_generated_composite_design(
  source_design jsonb
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public AS $$
DECLARE
  identity jsonb:=source_design->'identity';
  step_contract jsonb:=source_design->'step';
  frontend jsonb:=source_design#>'{lanes,FRONTEND}';
  command_code text:=step_contract->>'commandCode';
  actor_code text:=identity->>'actorCode';
  normalized_fields jsonb;
  field_codes jsonb;
  projections jsonb;
  permission_codes jsonb;
  success_fields jsonb;
  status_responses jsonb;
  normalized_action jsonb;
  normalized_api jsonb;
  result jsonb:=source_design;
BEGIN
  IF jsonb_typeof(source_design)<>'object'
     OR jsonb_typeof(identity)<>'object'
     OR jsonb_typeof(step_contract)<>'object'
     OR jsonb_typeof(frontend)<>'object'
     OR command_code!~'^[A-Z][A-Z0-9_]{1,79}$'
     OR actor_code!~'^[A-Z][A-Z0-9_]{1,79}$' THEN
    RAISE EXCEPTION 'generated composite source identity is invalid'
      USING ERRCODE='22023';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'fieldCode',field->>'fieldCode',
           'direction','BOTH',
           'dataType',case upper(coalesce(field->>'dataType','STRING'))
             when 'INTEGER' then 'INTEGER' when 'NUMBER' then 'NUMBER'
             when 'DECIMAL' then 'NUMBER' when 'BOOLEAN' then 'BOOLEAN'
             when 'DATE' then 'DATE' when 'DATETIME' then 'DATETIME'
             when 'OBJECT' then 'OBJECT' when 'ARRAY' then 'ARRAY'
             else 'STRING' end,
           'required',coalesce((field->>'required')::boolean,false))
         order by field->>'fieldCode'),'[]'::jsonb)
    INTO normalized_fields
    FROM jsonb_array_elements(case when jsonb_typeof(frontend->'fields')='array'
      then frontend->'fields' else '[]'::jsonb end) field
   WHERE jsonb_typeof(field)='object'
     AND coalesce((field->>'editable')::boolean,false)
     AND coalesce(field->>'fieldCode','')~'^[A-Za-z][A-Za-z0-9_]{0,79}$'
     AND field->>'fieldCode' NOT IN('actorCode','idempotencyKey','projectId','tenantId',
       'executionId','processCode','stepCode','commandCode','requestJson','resultJson',
       'requireDraft','routePath','audience');
  IF jsonb_array_length(normalized_fields)=0 THEN
    RAISE EXCEPTION 'generated composite business fields are missing'
      USING ERRCODE='55000';
  END IF;

  SELECT jsonb_agg(to_jsonb(field->>'fieldCode') order by field->>'fieldCode'),
         jsonb_agg(jsonb_build_object('fieldCode',field->>'fieldCode',
           'source','REQUEST','sourcePath',field->>'fieldCode')
           order by field->>'fieldCode')
    INTO field_codes,projections
    FROM jsonb_array_elements(normalized_fields) field;
  permission_codes:=public.framework_design_causality_json_set(
    coalesce(frontend->'permissionCodes','[]'::jsonb));
  success_fields:=jsonb_build_array('success','idempotent','eventId','toState')||field_codes;
  status_responses:=jsonb_build_array(
    jsonb_build_object('statusCase','SUCCESS','httpStatus',200,'bodyFields',success_fields),
    jsonb_build_object('statusCase','VALIDATION_ERROR','httpStatus',400,
      'bodyFields',jsonb_build_array('success','code','message')),
    jsonb_build_object('statusCase','FORBIDDEN','httpStatus',403,
      'bodyFields',jsonb_build_array('success','code','message')),
    jsonb_build_object('statusCase','CONFLICT','httpStatus',409,
      'bodyFields',jsonb_build_array('success','code','message')),
    jsonb_build_object('statusCase','RECOVERY','httpStatus',200,
      'bodyFields',jsonb_build_array('success','idempotent','eventId','toState','recovered')||field_codes));
  normalized_action:=jsonb_build_object('commandCode',command_code,
    'actorCode',actor_code,'primary',true);
  normalized_api:=jsonb_build_object('commandCode',command_code,'method','POST',
    'path','/home/api/process-executions/{executionId}/commands',
    'permissionCodes',permission_codes,'requestFields',field_codes,
    'responseFields',field_codes,'responseProjection',projections,
    'statusResponses',status_responses);
  result:=jsonb_set(result,'{lanes,FRONTEND,fields}',normalized_fields,true);
  result:=jsonb_set(result,'{lanes,FRONTEND,actions}',jsonb_build_array(normalized_action),true);
  result:=jsonb_set(result,'{lanes,API}',jsonb_build_array(normalized_api),true);
  RETURN result;
END
$$;

DO $patch$
DECLARE original_definition text;
DECLARE patched_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.framework_canonical_screen_design(character varying,character varying,character varying,character varying,jsonb)'::regprocedure)
    INTO original_definition;
  patched_definition:=replace(original_definition,'RETURN canonical_design;',
    'RETURN public.framework_normalize_generated_composite_design(canonical_design);');
  IF patched_definition=original_definition THEN
    RAISE EXCEPTION 'canonical design normalization patch target is not exact'
      USING ERRCODE='55000';
  END IF;
  EXECUTE patched_definition;
END
$patch$;

REVOKE ALL ON FUNCTION public.framework_normalize_generated_composite_design(jsonb) FROM PUBLIC;
DO $$ BEGIN
  IF to_regrole('carbonet_app') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.framework_normalize_generated_composite_design(jsonb) TO carbonet_app;
  END IF;
END $$;
