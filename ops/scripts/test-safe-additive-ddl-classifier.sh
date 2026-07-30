#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLASSIFIER="$ROOT_DIR/ops/scripts/classify-safe-additive-ddl.py"
DEPLOY_SCRIPT="$ROOT_DIR/ops/scripts/auto-deploy-main.sh"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

cat >"$tmp_dir/safe.sql" <<'SQL'
CREATE TABLE IF NOT EXISTS framework_safe_example (
 id bigserial PRIMARY KEY,
 name varchar(100) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_framework_safe_example_name
 ON framework_safe_example(name);
COMMENT ON TABLE framework_safe_example IS 'safe additive fixture';
SQL
python3 "$CLASSIFIER" "$tmp_dir/safe.sql" | grep -q '^safe-additive '

for fixture in drop update alter existing_index insert do_block; do
  case "$fixture" in
    drop) sql='DROP TABLE framework_safe_example;' ;;
    update) sql='UPDATE framework_safe_example SET name='\''changed'\'';' ;;
    alter) sql='ALTER TABLE framework_safe_example ADD COLUMN note text;' ;;
    existing_index) sql='CREATE INDEX idx_existing ON framework_development_job(job_status);' ;;
    insert) sql='INSERT INTO framework_safe_example(name) VALUES ('\''x'\'');' ;;
    do_block) sql='DO $$ BEGIN RAISE NOTICE '\''x'\''; END $$;' ;;
  esac
  printf '%s\n' "$sql" >"$tmp_dir/$fixture.sql"
  if python3 "$CLASSIFIER" "$tmp_dir/$fixture.sql" >/dev/null 2>&1; then
    echo "unsafe fixture was accepted: $fixture" >&2
    exit 1
  fi
done

grep -q 'backup_scope="safe-additive-schema"' "$DEPLOY_SCRIPT"
grep -q 'pg_dump -U' "$DEPLOY_SCRIPT"
grep -q -- '--format=custom' "$DEPLOY_SCRIPT"
grep -q 'pg_restore --list' "$DEPLOY_SCRIPT"
grep -q "interval '5 minutes'" "$DEPLOY_SCRIPT"

echo "[safe-additive-ddl] PASS safe=1 unsafe=6 archive=custom restoreCatalog=verified orphanReap=5m fail-closed=true"
