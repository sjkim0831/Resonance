# Carbonet Database Migration Policy

Carbonet runtime includes both Flyway and Liquibase, but only one engine must be enabled for a runtime process.

## Runtime switches

- `CARBONET_FLYWAY_ENABLED=true`: run SQL-first migrations from `classpath:db/migration/postgresql`.
- `CARBONET_LIQUIBASE_ENABLED=true`: run Liquibase changelogs from `classpath:db/changelog/db.changelog-master.yaml`.
- Do not enable both flags together. The runtime fails fast when both are enabled.

## Default mode

Both engines are disabled by default so that a newly deployed runtime does not mutate an existing Patroni database unless the operator explicitly enables migration execution.

## Existing database baseline

The configured Flyway baseline is `20260710000000`, which represents the existing Carbonet schema before managed migrations.

Flyway uses:

- history table: `carbonet_flyway_schema_history`
- `baseline-on-migrate=true`
- `clean-disabled=true`

Liquibase uses:

- changelog table: `carbonet_databasechangelog`
- lock table: `carbonet_databasechangeloglock`
- `drop-first=false`

## Recommended usage

Use Flyway for operational SQL migrations that must be reviewable and easy to replay on Patroni. Keep Liquibase available for larger structured changelog work or DB-diff-driven reviews.

Before enabling either engine in production, take a Patroni backup and verify the migration in a copied database.
