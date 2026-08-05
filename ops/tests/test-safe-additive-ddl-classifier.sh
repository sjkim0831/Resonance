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
CREATE TABLE IF NOT EXISTS framework_safe_example_history (
 id bigserial PRIMARY KEY,
 source_id bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_framework_safe_example_name
 ON framework_safe_example(name);
INSERT INTO framework_safe_example(id,name)
VALUES (1,'seed')
ON CONFLICT (id) DO NOTHING;
COMMENT ON TABLE framework_safe_example IS 'safe additive fixture';
CREATE FUNCTION record_framework_safe_example_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO framework_safe_example_history(source_id) VALUES(NEW.id);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_framework_safe_example_history ON framework_safe_example;
CREATE TRIGGER trg_framework_safe_example_history
AFTER INSERT ON framework_safe_example
FOR EACH ROW EXECUTE FUNCTION record_framework_safe_example_history();
SQL
python3 "$CLASSIFIER" "$tmp_dir/safe.sql" | grep -q '^safe-additive '

for fixture in drop update alter existing_index insert do_block replace_function function_existing_write existing_trigger; do
  case "$fixture" in
    drop) sql='DROP TABLE framework_safe_example;' ;;
    update) sql='UPDATE framework_safe_example SET name='\''changed'\'';' ;;
    alter) sql='ALTER TABLE framework_safe_example ADD COLUMN note text;' ;;
    existing_index) sql='CREATE INDEX idx_existing ON framework_development_job(job_status);' ;;
    insert) sql='INSERT INTO framework_safe_example(name) VALUES ('\''x'\'');' ;;
    do_block) sql='DO $$ BEGIN RAISE NOTICE '\''x'\''; END $$;' ;;
    replace_function) sql='CREATE OR REPLACE FUNCTION unsafe_replace() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;' ;;
    function_existing_write) sql='CREATE FUNCTION unsafe_write() RETURNS void LANGUAGE sql AS $$ UPDATE framework_development_job SET job_status='\''DONE'\'' $$;' ;;
    existing_trigger) sql='CREATE FUNCTION unsafe_trigger_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$; CREATE TRIGGER unsafe_trigger AFTER INSERT ON framework_development_job FOR EACH ROW EXECUTE FUNCTION unsafe_trigger_fn();' ;;
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
grep -q 'restoredFlywayRows' "$DEPLOY_SCRIPT"
grep -q "interval '5 minutes'" "$DEPLOY_SCRIPT"

echo "[safe-additive-ddl] PASS safe=1 unsafe=9 functions=bounded triggers=new-schema-only archive=custom restoreCatalog=verified orphanReap=5m fail-closed=true"
