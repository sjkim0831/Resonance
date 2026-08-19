#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLASSIFIER="$ROOT_DIR/ops/scripts/classify-safe-additive-ddl.py"
DEPLOY_SCRIPT="$ROOT_DIR/ops/scripts/auto-deploy-main.sh"
BACKUP_SCOPE_CLASSIFIER="$ROOT_DIR/ops/scripts/classify-db-backup-scope.sh"
MIGRATIONS="$ROOT_DIR/apps/carbonet-api/src/main/resources/db/migration/postgresql"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

pinned_migrations=(
  "$MIGRATIONS/V20260813093000__compile_canonical_screen_design_release.sql"
  "$MIGRATIONS/V20260813113000__compile_canonical_endpoint_contract_catalog.sql"
  "$MIGRATIONS/V20260813150000__stage_validate_publish_legacy_endpoint_upgrade.sql"
)
pinned_result="$(python3 "$CLASSIFIER" --schema-reversible "${pinned_migrations[@]}")"
grep -q '^safe-additive pinned-schema-reversible-bundle=' <<<"$pinned_result"
if python3 "$CLASSIFIER" "${pinned_migrations[@]}" >/dev/null 2>&1; then
  echo "pinned bundle was accepted without explicit schema-reversible mode" >&2
  exit 1
fi
if python3 "$CLASSIFIER" --schema-reversible "${pinned_migrations[@]:0:2}" >/dev/null 2>&1; then
  echo "incomplete pinned bundle was accepted" >&2
  exit 1
fi

for mutant in data_write drop destructive_alter; do
  mutant_dir="$tmp_dir/pinned-$mutant"
  mkdir -p "$mutant_dir"
  cp "${pinned_migrations[@]}" "$mutant_dir/"
  target="$mutant_dir/V20260813093000__compile_canonical_screen_design_release.sql"
  case "$mutant" in
    data_write) printf '\nUPDATE framework_screen_blueprint SET validation_status='\''VALID'\'';\n' >>"$target" ;;
    drop) printf '\nDROP TABLE framework_screen_blueprint;\n' >>"$target" ;;
    destructive_alter) printf '\nALTER TABLE framework_screen_blueprint DROP COLUMN blueprint_code;\n' >>"$target" ;;
  esac
  if python3 "$CLASSIFIER" --schema-reversible "$mutant_dir"/*.sql >/dev/null 2>&1; then
    echo "mutated pinned bundle was accepted: $mutant" >&2
    exit 1
  fi
done

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

cat >"$tmp_dir/flyway-forward.sql" <<'SQL'
INSERT INTO framework_actor_definition(actor_code,actor_name)
VALUES ('LCA_REVIEWER','LCA reviewer')
ON CONFLICT(actor_code) DO UPDATE SET actor_name=excluded.actor_name;
CREATE TABLE IF NOT EXISTS framework_flyway_delta (id bigint PRIMARY KEY);
CREATE INDEX IF NOT EXISTS idx_framework_flyway_delta_actor
  ON framework_actor_definition(actor_code);
DO $$ BEGIN IF false THEN EXECUTE 'grant select on framework_flyway_delta to carbonet_app'; END IF; END $$;
SQL
python3 "$CLASSIFIER" --flyway-forward-only "$tmp_dir/flyway-forward.sql" | grep -q 'mode=flyway-forward-only'
for sql in \
  'UPDATE framework_actor_definition SET actor_name='"'"'unsafe'"'"';' \
  'DELETE FROM framework_actor_definition;' \
  'DROP TABLE framework_actor_definition;' \
  'ALTER TABLE framework_actor_definition DROP COLUMN actor_name;' \
  'TRUNCATE TABLE framework_actor_definition;'; do
  printf '%s\nCREATE TABLE framework_flyway_guard(id bigint);\n' "$sql" >"$tmp_dir/flyway-destructive.sql"
  if python3 "$CLASSIFIER" --flyway-forward-only "$tmp_dir/flyway-destructive.sql" >/dev/null 2>&1; then
    echo "destructive Flyway delta was accepted: $sql" >&2
    exit 1
  fi
done

cat >"$tmp_dir/reversible_function.sql" <<'SQL'
CREATE OR REPLACE FUNCTION framework_safe_selector(payload jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$ SELECT payload $$;
DO $$
BEGIN
  IF (SELECT count(*) FROM framework_development_job) < 0 THEN
    RAISE EXCEPTION 'unreachable';
  END IF;
END $$;
SQL
python3 "$CLASSIFIER" --schema-reversible "$tmp_dir/reversible_function.sql" | grep -q '^safe-additive '
if python3 "$CLASSIFIER" "$tmp_dir/reversible_function.sql" >/dev/null 2>&1; then
  echo "reversible function was accepted without explicit mode" >&2
  exit 1
fi

printf '%s\n' 'CREATE OR REPLACE FUNCTION unsafe_replace_write() RETURNS void LANGUAGE sql AS $$ UPDATE framework_development_job SET job_status='"'"'DONE'"'"' $$;' >"$tmp_dir/reversible_write.sql"
if python3 "$CLASSIFIER" --schema-reversible "$tmp_dir/reversible_write.sql" >/dev/null 2>&1; then
  echo "writing replacement function was accepted" >&2
  exit 1
fi

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
grep -q 'backup_scope="flyway-forward-only"' "$DEPLOY_SCRIPT"
grep -q 'backup_required=false' "$DEPLOY_SCRIPT"
grep -q -- '--schema-reversible' "$DEPLOY_SCRIPT"
grep -q 'pg_dump -U' "$DEPLOY_SCRIPT"
grep -q -- '--format=custom' "$DEPLOY_SCRIPT"
grep -q 'pg_restore --list' "$DEPLOY_SCRIPT"
grep -q 'restoredFlywayRows' "$DEPLOY_SCRIPT"
grep -q "interval '5 minutes'" "$DEPLOY_SCRIPT"

[[ "$(printf '%s\n' 'apps/carbonet-api/src/main/resources/db/migration/postgresql/V1__reset_company_reapplication_policy_for_response_revision.sql' | bash "$BACKUP_SCOPE_CLASSIFIER")" == governance ]]
for table in framework_screen_resource framework_screen_workflow_policy \
  framework_process_step_screen_binding framework_professional_screen_contract \
  framework_process_work_draft \
  framework_screen_data_binding \
  framework_screen_blueprint \
  framework_page_design framework_page_field_definition \
  framework_company_reapplication_audit comtninsttinfo comtninsttfile; do
  grep -Eq -- "-t[[:space:]]+$table([[:space:]\\]|$)" "$DEPLOY_SCRIPT" || {
    echo "governance backup omits reapplication table: $table" >&2
    exit 1
  }
done

member_migration='apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260814052000__close_member_lifecycle_canonical_runtime_contract.sql'
[[ "$(printf '%s\n' "$member_migration" | bash "$BACKUP_SCOPE_CLASSIFIER")" == governance ]]
lineage_migration='apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260814171000__add_process_work_draft_evidence_count_runtime_bridge.sql'
[[ "$(printf '%s\n' "$lineage_migration" | bash "$BACKUP_SCOPE_CLASSIFIER")" == governance ]]
governance_branch="$(sed -n '/elif \[\[ "$governance_backup_only"/,/elif \[\[ "$activity_backup_only"/p' "$DEPLOY_SCRIPT")"
[[ "$(grep -Ec -- '-t[[:space:]]+framework_screen_data_binding([[:space:]\\]|$)' <<<"$governance_branch")" == 1 ]] || {
  echo "governance backup must dump framework_screen_data_binding exactly once" >&2
  exit 1
}
[[ "$(grep -Ec -- '-t[[:space:]]+framework_process_work_draft([[:space:]\\]|$)' <<<"$governance_branch")" == 1 ]] || {
  echo "governance backup must dump framework_process_work_draft exactly once" >&2
  exit 1
}
[[ "$(grep -Ec -- '-t[[:space:]]+framework_screen_blueprint([[:space:]\\]|$)' <<<"$governance_branch")" == 1 ]] || {
  echo "governance backup must dump framework_screen_blueprint exactly once" >&2
  exit 1
}
governance_data_binding_mutant="${governance_branch//          -t framework_screen_data_binding \\/}"
if grep -Eq -- '-t[[:space:]]+framework_screen_data_binding([[:space:]\\]|$)' <<<"$governance_data_binding_mutant"; then
  echo "governance backup omission mutant unexpectedly retained framework_screen_data_binding" >&2
  exit 1
fi
governance_work_draft_mutant="${governance_branch//          -t framework_process_work_draft \\/}"
if grep -Eq -- '-t[[:space:]]+framework_process_work_draft([[:space:]\\]|$)' <<<"$governance_work_draft_mutant"; then
  echo "governance backup omission mutant unexpectedly retained framework_process_work_draft" >&2
  exit 1
fi
governance_mutant="${governance_branch//          -t framework_screen_blueprint \\/}"
if grep -Eq -- '-t[[:space:]]+framework_screen_blueprint([[:space:]\\]|$)' <<<"$governance_mutant"; then
  echo "governance backup omission mutant unexpectedly retained framework_screen_blueprint" >&2
  exit 1
fi

echo "[safe-additive-ddl] PASS safe=1 reversible=1 pinnedBundle=3 pinnedMutants=3 unsafe=10 functions=bounded triggers=new-schema-only archive=custom restoreCatalog=verified governanceReapplication=12 governanceWorkDraftDump=1 governanceDataBindingDump=1 governanceBlueprintDump=1 omissionMutants=3/rejected orphanReap=5m fail-closed=true"
