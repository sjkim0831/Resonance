-- Enrich deterministic design metadata for every page without claiming that
-- runtime authorization, recovery, audit, API, or persistence evidence exists.

CREATE TABLE IF NOT EXISTS framework_screen_design_enrichment_audit (
  enrichment_id bigserial PRIMARY KEY,
  page_design_id bigint NOT NULL REFERENCES framework_page_design(page_design_id) ON DELETE CASCADE,
  page_field_id bigint REFERENCES framework_page_field_definition(page_field_id) ON DELETE CASCADE,
  enrichment_type varchar(80) NOT NULL,
  before_value jsonb NOT NULL,
  after_value jsonb NOT NULL,
  enriched_by varchar(100) NOT NULL,
  enriched_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_screen_design_enrichment_page
  ON framework_screen_design_enrichment_audit(page_design_id,enriched_at DESC);

-- The row trigger recompiles the complete step schema after every field
-- mutation. That is correct for interactive edits but quadratic for a catalog
-- enrichment. Disable it only for this set operation; the changed blueprints
-- are marked DIRTY once below.
ALTER TABLE framework_page_field_definition
  DISABLE TRIGGER trg_page_field_schema_propagation;

WITH target AS (
  SELECT f.page_field_id,f.page_design_id,f.data_type,f.control_type,
         f.required,f.editable,f.validation_contract,
         CASE
           WHEN f.control_type IN ('HIDDEN','READ_ONLY')
             THEN jsonb_build_object(
               'source','SERVER_CONTEXT','immutable',true,
               'required',f.required
             )
           WHEN f.data_type IN ('NUMBER','DECIMAL','INTEGER','LONG')
             THEN jsonb_build_object(
               'type','number','required',f.required,
               'finite',true,'nullable',NOT f.required
             )
           WHEN f.data_type IN ('DATE','DATETIME','TIMESTAMP')
             THEN jsonb_build_object(
               'type','date-time','required',f.required,
               'nullable',NOT f.required
             )
           WHEN f.control_type IN ('SELECT','MULTI_SELECT','CODE_SELECT','PROJECT_SELECT')
             THEN jsonb_build_object(
               'type','code','required',f.required,
               'allowUnknown',false,'nullable',NOT f.required
             )
           WHEN f.data_type IN ('BOOLEAN','BOOL')
             THEN jsonb_build_object(
               'type','boolean','required',f.required,
               'nullable',NOT f.required
             )
           ELSE jsonb_build_object(
             'type','string','required',f.required,
             'minLength',CASE WHEN f.required THEN 1 ELSE 0 END,
             'maxLength',4000,'trim',true,'nullable',NOT f.required
           )
         END next_validation
  FROM framework_page_field_definition f
  WHERE f.validation_contract IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
), audited AS (
  INSERT INTO framework_screen_design_enrichment_audit(
    page_design_id,page_field_id,enrichment_type,before_value,after_value,enriched_by
  )
  SELECT page_design_id,page_field_id,'CANONICAL_FIELD_VALIDATION',
         validation_contract,next_validation,'MASS_PROFESSIONAL_DESIGN_V1'
  FROM target
  RETURNING page_field_id
)
UPDATE framework_page_field_definition f
SET validation_contract=t.next_validation,
    updated_at=current_timestamp
FROM target t
WHERE f.page_field_id=t.page_field_id;

ALTER TABLE framework_page_field_definition
  ENABLE TRIGGER trg_page_field_schema_propagation;

UPDATE framework_screen_generation_state state
SET sync_status=CASE
      WHEN state.ownership_mode='MANUAL' THEN 'MANUAL'
      ELSE 'DIRTY'
    END,
    last_error=NULL,
    updated_at=current_timestamp
FROM framework_screen_blueprint blueprint
WHERE state.blueprint_id=blueprint.blueprint_id
  AND EXISTS (
    SELECT 1
    FROM framework_page_design page
    WHERE page.process_code=blueprint.process_code
      AND page.step_code=blueprint.step_code
  );

CREATE OR REPLACE VIEW framework_professional_screen_design_update_gate AS
WITH classified AS (
  SELECT gate.*,
    array(
      SELECT blocker
      FROM unnest(gate.blocker_codes) blocker
      WHERE blocker NOT IN (
        'AUTHORITY_NOT_VERIFIED',
        'EXCEPTION_RECOVERY_NOT_VERIFIED',
        'VERSION_AUDIT_NOT_VERIFIED'
      )
        AND NOT (
          blocker='ROUTE_IDENTITY_COLLISION'
          AND EXISTS (
            SELECT 1
            FROM framework_screen_resource resource
            WHERE resource.route_key=gate.route_key
          )
        )
      ORDER BY blocker
    ) design_blocker_codes,
    array(
      SELECT blocker
      FROM unnest(gate.blocker_codes) blocker
      WHERE blocker IN (
        'AUTHORITY_NOT_VERIFIED',
        'EXCEPTION_RECOVERY_NOT_VERIFIED',
        'VERSION_AUDIT_NOT_VERIFIED'
      )
      ORDER BY blocker
    ) implementation_evidence_codes,
    (
      gate.route_unique_passed
      OR EXISTS (
        SELECT 1
        FROM framework_screen_resource resource
        WHERE resource.route_key=gate.route_key
      )
    ) route_identity_valid
  FROM framework_executable_screen_design_gate gate
)
SELECT classified.*,
       cardinality(design_blocker_codes)=0 professional_design_ready,
       CASE
         WHEN cardinality(design_blocker_codes)>0 THEN 'DESIGN_BLOCKED'
         WHEN executable_status='VERIFIED' THEN 'VERIFIED'
         ELSE 'DESIGN_READY_IMPLEMENTATION_PENDING'
       END professional_status,
       CASE
         WHEN cardinality(design_blocker_codes)>0
           THEN 'Resolve design: '||array_to_string(design_blocker_codes,', ')
         WHEN executable_status<>'VERIFIED'
           THEN 'Design is complete. Implement and attach runtime evidence: '||
                array_to_string(implementation_evidence_codes,', ')
         ELSE 'Professional design and runtime evidence are verified.'
       END professional_next_action
FROM classified;

COMMENT ON VIEW framework_professional_screen_design_update_gate IS
  'Separates deterministic professional design defects from runtime implementation evidence. Shared N:M routes are valid when backed by one canonical screen resource.';
