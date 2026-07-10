CREATE TABLE IF NOT EXISTS carbonet_schema_migration_control (
    control_key varchar(80) PRIMARY KEY,
    control_value varchar(4000) NOT NULL,
    description text,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE carbonet_schema_migration_control IS 'Carbonet database migration control flags and baseline metadata.';
COMMENT ON COLUMN carbonet_schema_migration_control.control_key IS 'Unique control key.';
COMMENT ON COLUMN carbonet_schema_migration_control.control_value IS 'Current control value.';
COMMENT ON COLUMN carbonet_schema_migration_control.description IS 'Human readable control description.';

INSERT INTO carbonet_schema_migration_control (control_key, control_value, description)
VALUES
    ('migration.baseline', '20260710000000', 'Existing Carbonet schema before managed Flyway/Liquibase migrations'),
    ('migration.flyway.role', 'versioned-sql', 'Flyway owns ordered SQL DDL and data transformations'),
    ('migration.liquibase.role', 'declarative-governance', 'Liquibase owns reviewed declarative metadata and governance changes'),
    ('migration.dual_engine', 'true', 'Flyway and Liquibase run together with non-overlapping ownership'),
    ('migration.clean_disabled', 'true', 'Destructive clean/drop operations must stay disabled in runtime')
ON CONFLICT (control_key) DO UPDATE
SET control_value = EXCLUDED.control_value,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;
