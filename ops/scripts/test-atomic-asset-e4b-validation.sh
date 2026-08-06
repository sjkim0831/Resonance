#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
sync_script="$root/ops/scripts/sync-unified-asset-catalog.sh"
deploy_script="$root/ops/scripts/auto-deploy-main.sh"

bash -n "$sync_script"
bash -n "$deploy_script"

python3 - "$sync_script" "$deploy_script" <<'PY'
from pathlib import Path
import sys

sync = Path(sys.argv[1]).read_text(encoding="utf-8")
deploy = Path(sys.argv[2]).read_text(encoding="utf-8")

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
assert "e4b=verified" in sync
assert "CREATE TEMP TABLE asset_sync_delta" in sync
assert "asset_sync_delta(active_before integer,additions integer,deletions integer) ON COMMIT DROP" in sync
assert sync.count("CREATE TEMP TABLE asset_sync_delta") == 1
assert sync.count("INSERT INTO asset_sync_delta") == 1
assert "active_before + additions - deletions" in sync
assert "sync_scope LIKE 'GIT_SOURCE_%'" in sync
delta_snapshot = sync.index("INSERT INTO asset_sync_delta")
source_upsert = sync.index("INSERT INTO framework_unified_asset(asset_id", delta_snapshot)
audit_insert = sync.index("INSERT INTO framework_asset_catalog_sync_run", source_upsert)
assert delta_snapshot < source_upsert < audit_insert
assert sync.index("FROM asset_sync_delta", audit_insert) > audit_insert
assert sync.count("FROM asset_sync_delta") == 1

adjacent = (
    'bash ops/scripts/sync-unified-asset-catalog.sh "$deployed_commit" "$target_commit"\n'
    "  bash ops/scripts/validate-e4b-selectable-assets.sh"
)
assert adjacent not in deploy

print("ATOMIC_ASSET_E4B_VALIDATION_PASS")
PY
