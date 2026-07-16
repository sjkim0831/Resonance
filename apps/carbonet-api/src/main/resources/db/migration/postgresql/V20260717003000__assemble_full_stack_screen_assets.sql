CREATE TABLE IF NOT EXISTS framework_screen_asset_assembly (
  assembly_id bigserial PRIMARY KEY,
  contract_id bigint NOT NULL REFERENCES framework_professional_screen_contract(contract_id) ON DELETE CASCADE,
  asset_layer varchar(30) NOT NULL CHECK(asset_layer IN ('THEME','SECTION','COMPONENT','DESIGN','FRONTEND','API','BACKEND','DATABASE','TEST')),
  asset_ref text NOT NULL,
  management_route varchar(400) NOT NULL,
  decision varchar(30) NOT NULL CHECK(decision IN ('REUSED','LINKED','REGISTERED','MISSING','REPAIR_REQUIRED')),
  evidence_ref text NOT NULL DEFAULT '',
  protected boolean NOT NULL DEFAULT false,
  updated_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(contract_id,asset_layer)
);

CREATE INDEX IF NOT EXISTS idx_screen_asset_assembly_decision
 ON framework_screen_asset_assembly(decision,asset_layer,contract_id);

CREATE OR REPLACE VIEW framework_screen_asset_assembly_summary AS
SELECT c.contract_id,c.process_code,c.step_code,c.audience,c.route_path,c.screen_name,
       count(a.assembly_id) AS asset_count,
       count(a.assembly_id) FILTER(WHERE a.decision IN ('REUSED','LINKED','REGISTERED')) AS ready_asset_count,
       count(a.assembly_id) FILTER(WHERE a.decision IN ('MISSING','REPAIR_REQUIRED')) AS gap_asset_count,
       coalesce(round(100.0*count(a.assembly_id) FILTER(WHERE a.decision IN ('REUSED','LINKED','REGISTERED'))/nullif(count(a.assembly_id),0)),0)::integer AS assembly_score,
       string_agg(a.asset_layer||':'||a.decision,', ' ORDER BY a.asset_layer) AS assembly_status
FROM framework_professional_screen_contract c
LEFT JOIN framework_screen_asset_assembly a ON a.contract_id=c.contract_id
GROUP BY c.contract_id,c.process_code,c.step_code,c.audience,c.route_path,c.screen_name;
