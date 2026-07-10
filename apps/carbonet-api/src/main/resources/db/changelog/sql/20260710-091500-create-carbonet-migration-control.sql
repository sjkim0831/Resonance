CREATE TABLE IF NOT EXISTS carbonet_liquibase_governance (
    governance_key varchar(80) PRIMARY KEY,
    governance_value varchar(4000) NOT NULL,
    description text,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE carbonet_liquibase_governance IS 'Liquibase-owned declarative governance and metadata registry.';

INSERT INTO carbonet_liquibase_governance (governance_key, governance_value, description)
VALUES
    ('liquibase.role', 'declarative-governance', 'Liquibase owns reviewed metadata and declarative governance changes'),
    ('liquibase.flyway.coexistence', 'enabled', 'Flyway independently owns ordered SQL DDL and data transformations'),
    ('liquibase.drop_first', 'false', 'Destructive drop-first operation stays disabled')
ON CONFLICT (governance_key) DO UPDATE
SET governance_value = EXCLUDED.governance_value,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;
