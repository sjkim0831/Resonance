#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
sync_script="$root/ops/scripts/sync-unified-asset-catalog.sh"
deploy_script="$root/ops/scripts/auto-deploy-main.sh"
postgres_adapter="$root/ops/scripts/lib/carbonet-postgres-query.sh"

bash -n "$sync_script"
bash -n "$deploy_script"

python3 - "$sync_script" "$deploy_script" "$postgres_adapter" <<'PY'
from pathlib import Path
import sys

sync = Path(sys.argv[1]).read_text(encoding="utf-8")
deploy = Path(sys.argv[2]).read_text(encoding="utf-8")
adapter = Path(sys.argv[3]).read_text(encoding="utf-8")

validation = sync.index("-- E4B selection integrity belongs")
commit = sync.index("COMMIT;", validation)
assert validation < commit
for token in (
    "framework_asset_canonical_map",
    "framework_unified_asset_relation",
    "framework_e4b_selectable_asset",
    "framework_e4b_page_development_queue",
    "RAISE EXCEPTION",
):
    assert token in sync[validation:commit]
assert 'validate_e4b=false' in sync
assert '*.md|*.txt)' in sync
assert "IF NOT (SELECT validate_e4b FROM asset_sync_control)" in sync
assert "IF (SELECT is_full FROM asset_sync_control) THEN" in sync
assert "JOIN source_asset_stage changed ON changed.asset_path=asset.asset_path" in sync
assert '-v validate_e4b="$validate_e4b"' in sync
assert 'echo verified || echo unchanged' in sync
assert 'chmod 0600 "$password_file"' in sync
assert 'password_prefetch_pid="$!"' in sync
assert 'CARBONET_PG_PASSWORD="$(<"$password_file")"' in sync
assert 'rm -f "$password_file"' in sync
assert 'CARBONET_PG_PASSWORD="${CARBONET_PG_PASSWORD:-}"' in adapter
assert "carbonet_postgres_find_leader()" in adapter
assert 'CARBONET_PG_DEFER_WRITABLE_CHECK:-false' in adapter
assert "CARBONET_WRITABLE_LEADER_REQUIRED" in sync
assert "run_catalog_sync_via_kubectl()" in sync
assert "direct PostgreSQL path unavailable; retrying elected Patroni leader" in sync
assert 'direct_sql="$(mktemp)"' in sync
assert 'cp "$sql" "$direct_sql"' in sync
assert '"$direct_sql"' in sync
assert '-f "$direct_sql" 2>"$direct_error"' in sync
assert 'rm -f "$tsv" "$deleted_tsv" "$manifest_tsv" "$sql" "$direct_sql"' in sync
assert "CREATE TEMP TABLE asset_sync_delta" in sync
assert "asset_sync_delta(active_before integer,additions integer,deletions integer) ON COMMIT DROP" in sync
assert sync.count("CREATE TEMP TABLE asset_sync_delta") == 1
assert sync.count("INSERT INTO asset_sync_delta") == 1
assert "active_before + additions - deletions" in sync
assert "sync_scope LIKE 'GIT_SOURCE_%'" in sync
delta_snapshot = sync.index("INSERT INTO asset_sync_delta")
transaction_start = sync.rindex("BEGIN;", 0, delta_snapshot)
source_upsert = sync.index("INSERT INTO framework_unified_asset(asset_id", delta_snapshot)
audit_insert = sync.index("INSERT INTO framework_asset_catalog_sync_run", source_upsert)
assert transaction_start < delta_snapshot < source_upsert < audit_insert
assert sync.index("FROM asset_sync_delta", audit_insert) > audit_insert
assert sync.count("FROM asset_sync_delta") == 1

adjacent = (
    'bash ops/scripts/sync-unified-asset-catalog.sh "$deployed_commit" "$target_commit"\n'
    "  bash ops/scripts/validate-e4b-selectable-assets.sh"
)
assert adjacent not in deploy

print("ATOMIC_ASSET_E4B_VALIDATION_PASS")
PY
