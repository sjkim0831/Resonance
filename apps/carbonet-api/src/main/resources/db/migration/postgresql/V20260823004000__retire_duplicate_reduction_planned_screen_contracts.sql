CREATE TABLE IF NOT EXISTS framework_professional_screen_contract_retirement (
  retirement_id bigserial PRIMARY KEY,
  original_contract_id bigint NOT NULL UNIQUE,
  process_code varchar(100) NOT NULL,
  step_code varchar(100) NOT NULL,
  audience varchar(20) NOT NULL,
  route_path varchar(500) NOT NULL,
  retirement_reason varchar(100) NOT NULL,
  contract_snapshot jsonb NOT NULL,
  dependent_snapshot jsonb NOT NULL,
  retired_by varchar(100) NOT NULL,
  retired_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TEMP TABLE reduction_planned_contract_retirement ON COMMIT DROP AS
SELECT contract.*
  FROM framework_professional_screen_contract contract
  JOIN framework_process_step step USING(process_code,step_code)
 WHERE contract.process_code IN(
   'REDUCTION_TARGET_PLANNING','REDUCTION_PROJECT_REGISTRATION','REDUCTION_PROJECT_APPROVAL',
   'REDUCTION_ROADMAP','REDUCTION_SCENARIO','REDUCTION_PERFORMANCE','REDUCTION_REPORTING')
   AND contract.route_path LIKE '%/planned/reduction/%'
   AND lower(split_part(contract.route_path,'?',1))<>
       lower(split_part(CASE upper(contract.audience)
         WHEN 'USER' THEN step.user_path WHEN 'ADMIN' THEN step.admin_path ELSE '' END,'?',1));

DO $$
DECLARE retirement_count integer; authority_reference_count integer;
BEGIN
  SELECT count(*) INTO retirement_count FROM reduction_planned_contract_retirement;
  IF retirement_count<>56 THEN
    RAISE EXCEPTION 'expected 56 orphan reduction planned contracts, found %',retirement_count;
  END IF;
  SELECT count(*) INTO authority_reference_count
    FROM integrated_design_authority authority
    JOIN reduction_planned_contract_retirement retired
      ON retired.contract_id=authority.contract_id;
  IF authority_reference_count<>0 THEN
    RAISE EXCEPTION 'orphan reduction contract still owns integrated authority: %',authority_reference_count;
  END IF;
END $$;

INSERT INTO framework_professional_screen_contract_retirement(
  original_contract_id,process_code,step_code,audience,route_path,retirement_reason,
  contract_snapshot,dependent_snapshot,retired_by)
SELECT retired.contract_id,retired.process_code,retired.step_code,retired.audience,
       retired.route_path,'NON_CANONICAL_PLANNED_ROUTE',to_jsonb(retired),
       jsonb_build_object(
         'assetAssembly',coalesce((SELECT jsonb_agg(to_jsonb(row)) FROM framework_screen_asset_assembly row WHERE row.contract_id=retired.contract_id),'[]'::jsonb),
         'contractBinding',coalesce((SELECT jsonb_agg(to_jsonb(row)) FROM framework_screen_contract_binding row WHERE row.contract_id=retired.contract_id),'[]'::jsonb),
         'contractVersion',coalesce((SELECT jsonb_agg(to_jsonb(row)) FROM framework_screen_contract_version row WHERE row.contract_id=retired.contract_id),'[]'::jsonb),
         'fieldBinding',coalesce((SELECT jsonb_agg(to_jsonb(row)) FROM framework_screen_field_binding row WHERE row.contract_id=retired.contract_id),'[]'::jsonb)),
       'FLYWAY_REDUCTION_CONTRACT_CANONICALIZATION'
  FROM reduction_planned_contract_retirement retired
ON CONFLICT(original_contract_id) DO NOTHING;

DELETE FROM framework_professional_screen_contract contract
 USING reduction_planned_contract_retirement retired
 WHERE contract.contract_id=retired.contract_id;

DO $$
DECLARE process text; result record; contract_count integer;
BEGIN
  FOREACH process IN ARRAY ARRAY[
    'REDUCTION_TARGET_PLANNING','REDUCTION_PROJECT_REGISTRATION','REDUCTION_PROJECT_APPROVAL',
    'REDUCTION_ROADMAP','REDUCTION_SCENARIO','REDUCTION_PERFORMANCE','REDUCTION_REPORTING'
  ] LOOP
    SELECT count(*) INTO contract_count
      FROM framework_professional_screen_contract contract
      JOIN framework_process_step step USING(process_code,step_code)
     WHERE contract.process_code=process
       AND ((upper(contract.audience)='USER' AND lower(split_part(contract.route_path,'?',1))=lower(split_part(step.user_path,'?',1)))
         OR (upper(contract.audience)='ADMIN' AND lower(split_part(contract.route_path,'?',1))=lower(split_part(step.admin_path,'?',1))));
    IF contract_count<>8 THEN
      RAISE EXCEPTION 'canonical reduction screen coverage must be 8: process=% count=%',process,contract_count;
    END IF;
    SELECT * INTO result FROM framework_validate_process_design(
      process,'FLYWAY_REDUCTION_CONTRACT_CANONICALIZATION');
    IF result.blocker_count<>0 THEN
      RAISE EXCEPTION 'reduction contract canonicalization failed: process=% blockers=%',
        process,result.blocker_count;
    END IF;
  END LOOP;
END $$;
