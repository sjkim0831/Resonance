# Carbonet DB Patch Notes

Use `ops/scripts/apply-project-db-migration.sh` for these SQL files so every apply is recorded in `db_migration_history`.

Recommended release layout:

```text
<release-dir>/config/manifest.json
<release-dir>/db/*.sql
<release-dir>/db/*.check.sql
```

For local Kubernetes CUBRID, use the k8s CSQL wrapper under `var/tmp/bin/k8s-csql-wrapper.sh` or create an equivalent wrapper that executes CSQL inside the target DB pod.
