-- resonance-deploy-profile: safe-additive-schema
-- generated-by: create-safe-additive-migration.py

-- design-schema-hash: 9c551a25b0f0f435f7c4e6e3b80dc85c0a1756a15e72ae61180b9831e6ee4fa2
-- design-package: EMISSION_PROJECT_PORTFOLIO__EMISSION_PROJECT_PORTFOLIO_LIST.json

CREATE TABLE emission_project_portfolio_preference (
  preference_id uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  tenant_id varchar(64) NOT NULL,
  account_id varchar(100) NOT NULL,
  selected_project_id varchar(80) REFERENCES emission_project_registry(project_id) ON DELETE SET NULL,
  keyword varchar(200) NOT NULL DEFAULT '',
  status_filter varchar(40) NOT NULL DEFAULT '',
  site_filter varchar(200) NOT NULL DEFAULT '',
  sort_code varchar(40) NOT NULL DEFAULT 'UPDATED_DESC',
  next_task_code varchar(120),
  preference_version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, account_id)
);
CREATE INDEX idx_emission_portfolio_preference_project ON emission_project_portfolio_preference (tenant_id, selected_project_id);
