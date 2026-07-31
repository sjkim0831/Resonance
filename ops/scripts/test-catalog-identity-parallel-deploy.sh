#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="$root/ops/scripts/auto-deploy-main.sh"

bash -n "$script"

python3 - "$script" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
start = source.index('catalog_identity_sync_log="$ROOT_DIR/var/logs/catalog-identity-sync-')
end = source.index('record_deploy_phase "catalog_apply_and_verify"', start)
block = source[start:end]

required = [
    "sync_keycloak_actor_assignments_if_required",
    'catalog_identity_sync_pid="$!"',
    "bash ops/scripts/sync-unified-asset-catalog.sh",
    "bash ops/scripts/validate-e4b-selectable-assets.sh",
    'wait "$catalog_identity_sync_pid"',
    "run_actor_process_role_e2e_if_required",
]
positions = {token: block.index(token) for token in required}

assert positions['catalog_identity_sync_pid="$!"'] < positions[
    "bash ops/scripts/sync-unified-asset-catalog.sh"
]
assert positions["bash ops/scripts/validate-e4b-selectable-assets.sh"] < positions[
    'wait "$catalog_identity_sync_pid"'
]
assert positions['wait "$catalog_identity_sync_pid"'] < positions[
    "run_actor_process_role_e2e_if_required"
]
assert "concurrent identity reconciliation failed" in block
assert 'exit 25' in block

cleanup_start = source.index("cleanup_deploy() {")
cleanup_end = source.index("trap cleanup_deploy", cleanup_start)
cleanup = source[cleanup_start:cleanup_end]
assert 'kill "$catalog_identity_sync_pid"' in cleanup

identity_start = source.index("sync_keycloak_actor_assignments_if_required() {")
identity_end = source.index("run_backstage_screen_space_e2e_if_required() {", identity_start)
identity = source[identity_start:identity_end]
assert "ops/scripts/auto-deploy-main.sh" not in identity
assert "no identity contract change" in identity

print("CATALOG_IDENTITY_PARALLEL_DEPLOY_PASS")
PY
