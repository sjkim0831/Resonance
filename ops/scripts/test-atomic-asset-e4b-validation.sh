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
assert "active_before + additions - deletions" in sync
assert "sync_scope LIKE 'GIT_SOURCE_%'" in sync

adjacent = (
    'bash ops/scripts/sync-unified-asset-catalog.sh "$deployed_commit" "$target_commit"\n'
    "  bash ops/scripts/validate-e4b-selectable-assets.sh"
)
assert adjacent not in deploy

print("ATOMIC_ASSET_E4B_VALIDATION_PASS")
PY
