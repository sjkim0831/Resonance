#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="$root/ops/scripts/auto-deploy-main.sh"
validation_groups="$root/ops/scripts/run-post-deploy-validation-groups.sh"
browser_e2e="$root/ops/scripts/resonance-project-task-browser-e2e.mjs"

bash -n "$script"
bash -n "$validation_groups"

python3 - "$script" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
start = source.index('catalog_identity_sync_log="$ROOT_DIR/var/logs/catalog-identity-sync-')
end = source.index('record_deploy_phase "backstage_visual_e2e"', start)
block = source[start:end]

required = [
    "sync_keycloak_actor_assignments_if_required",
    'catalog_identity_sync_pid="$!"',
    "test-only visual E2E started concurrently with catalog synchronization",
    "bash ops/scripts/sync-unified-asset-catalog.sh",
    'wait "$catalog_identity_sync_pid"',
    "run_actor_process_role_e2e_if_required",
]
positions = {token: block.index(token) for token in required}

assert positions['catalog_identity_sync_pid="$!"'] < positions[
    "test-only visual E2E started concurrently with catalog synchronization"
]
assert positions[
    "test-only visual E2E started concurrently with catalog synchronization"
] < positions[
    "bash ops/scripts/sync-unified-asset-catalog.sh"
]
assert positions["bash ops/scripts/sync-unified-asset-catalog.sh"] < positions[
    'wait "$catalog_identity_sync_pid"'
]
assert positions['wait "$catalog_identity_sync_pid"'] < positions[
    "run_actor_process_role_e2e_if_required"
]
assert "concurrent identity reconciliation failed" in block
assert 'exit 25' in block
assert 'if [[ -z "$backstage_visual_e2e_pid" ]]; then' in block
assert block.count("start_backstage_visual_e2e") == 2
for phase in [
    'catalog_sync',
    'backstage_build_rollout',
    'identity_reconcile',
    'actor_role_e2e',
]:
    assert f'record_deploy_phase "{phase}"' in block

cleanup_start = source.index("cleanup_deploy() {")
cleanup_end = source.index("trap cleanup_deploy", cleanup_start)
cleanup = source[cleanup_start:cleanup_end]
assert 'kill "$catalog_identity_sync_pid"' in cleanup

identity_start = source.index("sync_keycloak_actor_assignments_if_required() {")
identity_end = source.index("run_backstage_screen_space_e2e_if_required() {", identity_start)
identity = source[identity_start:identity_end]
assert "ops/scripts/auto-deploy-main.sh" not in identity
assert "no identity contract change" in identity

e2e_start = source.index("run_actor_process_role_e2e_if_required() {")
e2e_end = source.index("sync_keycloak_actor_assignments_if_required() {", e2e_start)
e2e = source[e2e_start:e2e_end]
for job in ["actor_pid", "delivery_pid", "browser_pid", "lifecycle_pid"]:
    assert f'{job}=$!' in e2e
    assert f'wait "${job}"' in e2e
for status in ["actor_status", "delivery_status", "browser_status", "lifecycle_status"]:
    assert f'{status} != 0' in e2e
assert "parallel actor/process E2E PASS jobs=4" in e2e
assert "parallel actor/process E2E failed" in e2e

print("CATALOG_IDENTITY_PARALLEL_DEPLOY_PASS")
PY

grep -q 'resolve_postgres_leader_once' "$validation_groups"
grep -q 'export RESONANCE_POSTGRES_LEADER_POD=' "$validation_groups"
for cached_consumer in \
  validate-emission-project-workflow.sh \
  validate-emission-activity-collection.sh \
  complete-activity-data-evidence-jobs.sh \
  complete-emission-calculation-evidence-jobs.sh \
  complete-report-certification-evidence-jobs.sh \
  validate-unified-work-design-runtime.sh; do
  grep -q 'RESONANCE_POSTGRES_LEADER_POD' "$root/ops/scripts/$cached_consumer"
done

echo "POSTDEPLOY_POSTGRES_LEADER_CACHE_PASS consumers=6"

python3 - "$browser_e2e" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
parallel = source.index("await Promise.all(accounts.map(async (account) => {")
barrier = source.index("const protectedTarget = routeResults[0]?.target", parallel)
transition = source.index("const ownerApi = await authenticatedApi", barrier)
assert parallel < barrier < transition
assert source.count("await Promise.all(accounts.map(async (account) => {") == 1
print("PROJECT_TASK_BROWSER_ACCOUNT_PARALLEL_PASS accounts=5 transition=single-after-barrier")
PY
