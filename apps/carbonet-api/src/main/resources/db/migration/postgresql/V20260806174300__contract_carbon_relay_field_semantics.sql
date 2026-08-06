-- Canonical carbon relay edges and their field-level semantic mappings.
-- Source payload remains immutable; only mapped fields may seed the next draft.
WITH edges(process_code,from_step_code,to_process_code,to_step_code,handoff_type) AS (VALUES
 ('EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT_PORTFOLIO_LIST','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S1','PROCESS'),
 ('ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S1','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S2','STEP'),
 ('ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S2','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S3','STEP'),
 ('ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S3','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S4','STEP'),
 ('ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S4','ACTIVITY_DATA','ACTIVITY_DATA_01_PLAN','PROCESS'),
 ('ACTIVITY_DATA','ACTIVITY_DATA_01_PLAN','ACTIVITY_DATA','ACTIVITY_DATA_02_WORK','STEP'),
 ('ACTIVITY_DATA','ACTIVITY_DATA_02_WORK','ACTIVITY_DATA','ACTIVITY_DATA_03_VERIFY','STEP'),
 ('ACTIVITY_DATA','ACTIVITY_DATA_03_VERIFY','ACTIVITY_DATA','ACTIVITY_DATA_04_APPROVE','STEP'),
 ('ACTIVITY_DATA','ACTIVITY_DATA_04_APPROVE','EMISSION_CALCULATION','EMISSION_CALCULATION_01_PLAN','PROCESS'),
 ('EMISSION_CALCULATION','EMISSION_CALCULATION_01_PLAN','EMISSION_CALCULATION','EMISSION_CALCULATION_02_WORK','STEP'),
 ('EMISSION_CALCULATION','EMISSION_CALCULATION_02_WORK','EMISSION_CALCULATION','EMISSION_CALCULATION_03_VERIFY','STEP'),
 ('EMISSION_CALCULATION','EMISSION_CALCULATION_03_VERIFY','EMISSION_CALCULATION','EMISSION_CALCULATION_04_APPROVE','STEP'),
 ('EMISSION_CALCULATION','EMISSION_CALCULATION_04_APPROVE','REPORT_CERTIFICATION','REPORT_CERTIFICATION_01_PLAN','PROCESS'),
 ('REPORT_CERTIFICATION','REPORT_CERTIFICATION_01_PLAN','REPORT_CERTIFICATION','REPORT_CERTIFICATION_02_WORK','STEP'),
 ('REPORT_CERTIFICATION','REPORT_CERTIFICATION_02_WORK','REPORT_CERTIFICATION','REPORT_CERTIFICATION_03_VERIFY','STEP'),
 ('REPORT_CERTIFICATION','REPORT_CERTIFICATION_03_VERIFY','REPORT_CERTIFICATION','REPORT_CERTIFICATION_04_APPROVE','STEP'),
 ('REPORT_CERTIFICATION','REPORT_CERTIFICATION_04_APPROVE','REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S1','PROCESS'),
 ('REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S1','REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S2','STEP'),
 ('REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S2','REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S3','STEP'),
 ('REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S3','REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S4','STEP')
)
INSERT INTO framework_process_data_handoff(
 process_code,from_step_code,to_process_code,to_step_code,handoff_type,context_keys,
 payload_contract,integrity_contract,authorization_contract,failure_contract,design_status)
SELECT process_code,from_step_code,to_process_code,to_step_code,handoff_type,
 '["tenantId","projectId","cycleType","periodStart","periodEnd","executionVersion"]'::jsonb,
 jsonb_build_object('schemaVersion',1,'fieldMappings','[]'::jsonb),
 '{"sourceDraftStatus":"SUBMITTED","sourceImmutable":true,"currentDraftPrecedence":true}'::jsonb,
 '{"sourceActor":"completed step assignment","targetActor":"next step assignment","tenantIsolation":true,"projectIsolation":true}'::jsonb,
 '{"missingSource":"BLOCK","missingMapping":"USER_INPUT","conversionFailure":"BLOCK","staleDraft":"RELOAD"}'::jsonb,
 'DESIGN_COMPLETE'
FROM edges
ON CONFLICT(process_code,from_step_code,to_process_code,to_step_code,handoff_type) DO UPDATE SET
 context_keys=excluded.context_keys,
 integrity_contract=excluded.integrity_contract,
 authorization_contract=excluded.authorization_contract,
 failure_contract=excluded.failure_contract,
 design_status='DESIGN_COMPLETE',updated_at=current_timestamp;

WITH edges(process_code,from_step_code,to_process_code,to_step_code,handoff_type) AS (VALUES
 ('EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT_PORTFOLIO_LIST','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S1','PROCESS'),
 ('ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S1','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S2','STEP'),
 ('ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S2','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S3','STEP'),
 ('ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S3','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S4','STEP'),
 ('ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S4','ACTIVITY_DATA','ACTIVITY_DATA_01_PLAN','PROCESS'),
 ('ACTIVITY_DATA','ACTIVITY_DATA_01_PLAN','ACTIVITY_DATA','ACTIVITY_DATA_02_WORK','STEP'),
 ('ACTIVITY_DATA','ACTIVITY_DATA_02_WORK','ACTIVITY_DATA','ACTIVITY_DATA_03_VERIFY','STEP'),
 ('ACTIVITY_DATA','ACTIVITY_DATA_03_VERIFY','ACTIVITY_DATA','ACTIVITY_DATA_04_APPROVE','STEP'),
 ('ACTIVITY_DATA','ACTIVITY_DATA_04_APPROVE','EMISSION_CALCULATION','EMISSION_CALCULATION_01_PLAN','PROCESS'),
 ('EMISSION_CALCULATION','EMISSION_CALCULATION_01_PLAN','EMISSION_CALCULATION','EMISSION_CALCULATION_02_WORK','STEP'),
 ('EMISSION_CALCULATION','EMISSION_CALCULATION_02_WORK','EMISSION_CALCULATION','EMISSION_CALCULATION_03_VERIFY','STEP'),
 ('EMISSION_CALCULATION','EMISSION_CALCULATION_03_VERIFY','EMISSION_CALCULATION','EMISSION_CALCULATION_04_APPROVE','STEP'),
 ('EMISSION_CALCULATION','EMISSION_CALCULATION_04_APPROVE','REPORT_CERTIFICATION','REPORT_CERTIFICATION_01_PLAN','PROCESS'),
 ('REPORT_CERTIFICATION','REPORT_CERTIFICATION_01_PLAN','REPORT_CERTIFICATION','REPORT_CERTIFICATION_02_WORK','STEP'),
 ('REPORT_CERTIFICATION','REPORT_CERTIFICATION_02_WORK','REPORT_CERTIFICATION','REPORT_CERTIFICATION_03_VERIFY','STEP'),
 ('REPORT_CERTIFICATION','REPORT_CERTIFICATION_03_VERIFY','REPORT_CERTIFICATION','REPORT_CERTIFICATION_04_APPROVE','STEP'),
 ('REPORT_CERTIFICATION','REPORT_CERTIFICATION_04_APPROVE','REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S1','PROCESS'),
 ('REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S1','REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S2','STEP'),
 ('REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S2','REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S3','STEP'),
 ('REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S3','REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S4','STEP')
), field_sets AS (
 SELECT edge.*,
   coalesce(nullif(source_spec.field_contract->'fields','[]'::jsonb),(select framework_try_jsonb(c.field_contract) from framework_professional_screen_contract c where c.process_code=edge.process_code and c.step_code=edge.from_step_code order by case c.audience when 'USER' then 0 else 1 end limit 1),'[]'::jsonb) source_fields,
   coalesce(nullif(target_spec.field_contract->'fields','[]'::jsonb),(select framework_try_jsonb(c.field_contract) from framework_professional_screen_contract c where c.process_code=edge.to_process_code and c.step_code=edge.to_step_code order by case c.audience when 'USER' then 0 else 1 end limit 1),'[]'::jsonb) target_fields
 FROM edges edge
 -- Select the canonical compiled step contract deterministically.
 LEFT JOIN LATERAL (
   SELECT candidate.field_contract
   FROM framework_step_execution_spec candidate
   WHERE candidate.process_code=edge.process_code
     AND candidate.step_code=edge.from_step_code
   ORDER BY candidate.updated_at DESC NULLS LAST,
            candidate.spec_version DESC
   LIMIT 1
 ) source_spec ON true
 LEFT JOIN LATERAL (
   SELECT candidate.field_contract
   FROM framework_step_execution_spec candidate
   WHERE candidate.process_code=edge.to_process_code
     AND candidate.step_code=edge.to_step_code
   ORDER BY candidate.updated_at DESC NULLS LAST,
            candidate.spec_version DESC
   LIMIT 1
 ) target_spec ON true
), aliases(process_code,from_step_code,to_process_code,to_step_code,from_field,to_field,transform) AS (VALUES
 ('EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT_PORTFOLIO_LIST','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S1','calculationPeriod','reportingPeriod','IDENTITY'),
 ('EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT_PORTFOLIO_LIST','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S1','siteName','sites','ARRAY_WRAP'),
 ('ACTIVITY_DATA','ACTIVITY_DATA_02_WORK','ACTIVITY_DATA','ACTIVITY_DATA_03_VERIFY','siteId','siteName','LOOKUP_SITE_LABEL'),
 ('ACTIVITY_DATA','ACTIVITY_DATA_02_WORK','ACTIVITY_DATA','ACTIVITY_DATA_03_VERIFY','emissionValue','totalEmission','AGGREGATE_SUM'),
 ('ACTIVITY_DATA','ACTIVITY_DATA_04_APPROVE','EMISSION_CALCULATION','EMISSION_CALCULATION_01_PLAN','snapshotHash','acceptedSubmissionSnapshotId','IDENTITY'),
 ('EMISSION_CALCULATION','EMISSION_CALCULATION_03_VERIFY','EMISSION_CALCULATION','EMISSION_CALCULATION_04_APPROVE','exceptions','openExceptions','IDENTITY'),
 ('EMISSION_CALCULATION','EMISSION_CALCULATION_04_APPROVE','REPORT_CERTIFICATION','REPORT_CERTIFICATION_01_PLAN','resultSnapshotHash','datasetHash','IDENTITY'),
 ('EMISSION_CALCULATION','EMISSION_CALCULATION_04_APPROVE','REPORT_CERTIFICATION','REPORT_CERTIFICATION_01_PLAN','resultSnapshotHash','integrityHash','IDENTITY')
), mappings AS (
 SELECT fields.process_code,fields.from_step_code,fields.to_process_code,fields.to_step_code,
        source_field->>'fieldCode' from_field,target_field->>'fieldCode' to_field,'IDENTITY' transform
 FROM field_sets fields
 CROSS JOIN LATERAL jsonb_array_elements(fields.source_fields) source_field
 CROSS JOIN LATERAL jsonb_array_elements(fields.target_fields) target_field
 WHERE source_field->>'fieldCode'=target_field->>'fieldCode'
 UNION ALL
 SELECT alias.*
 FROM aliases alias
 JOIN field_sets fields
   ON fields.process_code=alias.process_code
  AND fields.from_step_code=alias.from_step_code
  AND fields.to_process_code=alias.to_process_code
  AND fields.to_step_code=alias.to_step_code
 WHERE EXISTS (
   SELECT 1 FROM jsonb_array_elements(fields.source_fields) source_field
   WHERE source_field->>'fieldCode'=alias.from_field
 )
 AND EXISTS (
   SELECT 1 FROM jsonb_array_elements(fields.target_fields) target_field
   WHERE target_field->>'fieldCode'=alias.to_field
 )
), grouped AS (
 SELECT fields.process_code,fields.from_step_code,fields.to_process_code,fields.to_step_code,
        coalesce((SELECT jsonb_agg(jsonb_build_object('fromField',mapping.from_field,'toField',mapping.to_field,'transform',mapping.transform,'source','EXPLICIT_SEMANTIC_CONTRACT') order by mapping.to_field,mapping.from_field)
                  FROM (SELECT DISTINCT from_field,to_field,transform FROM mappings candidate
                        WHERE candidate.process_code=fields.process_code AND candidate.from_step_code=fields.from_step_code
                          AND candidate.to_process_code=fields.to_process_code AND candidate.to_step_code=fields.to_step_code) mapping),'[]'::jsonb) field_mappings,
        coalesce((SELECT jsonb_agg(target_field->>'fieldCode' order by target_field->>'fieldCode')
                  FROM jsonb_array_elements(fields.target_fields) target_field
                  WHERE NOT EXISTS(SELECT 1 FROM mappings candidate
                                   WHERE candidate.process_code=fields.process_code AND candidate.from_step_code=fields.from_step_code
                                     AND candidate.to_process_code=fields.to_process_code AND candidate.to_step_code=fields.to_step_code
                                     AND candidate.to_field=target_field->>'fieldCode')),'[]'::jsonb) unmapped_target_fields,
        jsonb_array_length(fields.target_fields) target_field_count
 FROM field_sets fields
)
UPDATE framework_process_data_handoff handoff
SET payload_contract=coalesce(handoff.payload_contract,'{}'::jsonb) || jsonb_build_object(
      'fieldMappings',grouped.field_mappings,
      'unmappedTargetFields',grouped.unmapped_target_fields,
      'unmappedPolicy','USER_INPUT_REQUIRED',
      'targetFieldCount',grouped.target_field_count,
      'contextMappings',jsonb_build_array(
        jsonb_build_object('from','execution.tenantId','to','execution.tenantId'),
        jsonb_build_object('from','execution.projectId','to','execution.projectId'),
        jsonb_build_object('from','execution.periodStart','to','execution.periodStart'),
        jsonb_build_object('from','execution.periodEnd','to','execution.periodEnd')
      )
    ),
    updated_at=current_timestamp
FROM grouped
WHERE handoff.process_code=grouped.process_code AND handoff.from_step_code=grouped.from_step_code
  AND handoff.to_process_code=grouped.to_process_code AND handoff.to_step_code=grouped.to_step_code;

CREATE OR REPLACE VIEW framework_carbon_relay_field_audit AS
WITH canonical AS (
 SELECT handoff.* FROM framework_process_data_handoff handoff
 JOIN framework_process_chain chain ON chain.process_code=handoff.process_code AND chain.next_process_code=handoff.to_process_code AND chain.use_at='Y'
 WHERE handoff.handoff_type='PROCESS'
 UNION ALL
 SELECT handoff.* FROM framework_process_data_handoff handoff
 WHERE handoff.handoff_type='STEP' AND handoff.process_code=handoff.to_process_code
   AND handoff.process_code IN ('ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION','REGULATORY_SUBMISSION')
)
SELECT process_code,from_step_code,to_process_code,to_step_code,
       jsonb_array_length(coalesce(payload_contract->'fieldMappings','[]'::jsonb)) mapping_count,
       jsonb_array_length(coalesce(payload_contract->'unmappedTargetFields','[]'::jsonb)) user_input_count,
       coalesce((payload_contract->>'targetFieldCount')::integer,0) target_field_count,
       (payload_contract ?& array['fieldMappings','unmappedTargetFields','contextMappings','targetFieldCount']
        AND jsonb_array_length(coalesce(payload_contract->'fieldMappings','[]'::jsonb))
            + jsonb_array_length(coalesce(payload_contract->'unmappedTargetFields','[]'::jsonb))
            = coalesce((payload_contract->>'targetFieldCount')::integer,0)) mapping_ready,
       design_status
FROM canonical;

DO $$
DECLARE edge_count integer; ready_count integer;
BEGIN
 SELECT count(*),count(*) FILTER(WHERE mapping_ready AND design_status='DESIGN_COMPLETE')
 INTO edge_count,ready_count FROM framework_carbon_relay_field_audit;
 IF edge_count<>20 OR ready_count<>20 THEN
   RAISE EXCEPTION 'Canonical carbon semantic handoff contract incomplete edges=% ready=%',edge_count,ready_count;
 END IF;
END $$;
