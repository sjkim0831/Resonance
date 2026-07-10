INSERT INTO carbonet_liquibase_governance (governance_key, governance_value, description)
VALUES ('report.visual-profile', 'page-grid-v1', 'Liquibase governance registration for issued PDF visual fingerprint comparison')
ON CONFLICT (governance_key) DO UPDATE
SET governance_value = EXCLUDED.governance_value,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;
