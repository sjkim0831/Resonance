#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
AUTO="$ROOT/ops/scripts/auto-deploy-main.sh"
[[ -f "$AUTO" && ! -L "$AUTO" ]]

python3 - "$AUTO" <<'PY'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text()
branch = text.split("if automation_only_fast_path_eligible; then", 1)[1].split(
    "\nfi\n\n# Source catalog closure", 1
)[0]
required = (
    "require_prevalidated_automation_only_contract || exit 79",
    'curl -fsS --max-time 10 http://127.0.0.1/actuator/health',
    'verify-react-asset-closure.mjs',
    'BASE_URL="${CARBONET_PUBLIC_BASE_URL:-http://127.0.0.1}"',
    'resonance-frontend-overlay-guard.sh verify-http',
    'verify_operational_usage_ledger_current_runtime_identity "$runtime_deployed_commit" proof-only',
    'write_applied_deploy_state "$target_commit" || exit 79',
    'prove_backstage_terminal_success "$target_commit"',
)
for token in required:
    if token not in branch:
        raise SystemExit(f"automation terminal contract missing: {token}")
for forbidden in (
    'run_operational_usage_ledger_current_runtime_e2e_if_required',
    'run_actor_process_role_e2e_if_required',
    'run_screen_contract_runtime_save_gate_if_required',
    'test-plan-incremental-work.sh',
    'test-postdeploy-candidate-evidence-contract.sh',
):
    if forbidden in branch:
        raise SystemExit(f"automation terminal repeats a prevalidated/serving E2E: {forbidden}")
if not (
    branch.index("require_prevalidated_automation_only_contract")
    < branch.index("resonance-frontend-overlay-guard.sh verify-http")
    < branch.index("verify_operational_usage_ledger_current_runtime_identity")
    < branch.index("write_applied_deploy_state")
    < branch.index("prove_backstage_terminal_success")
):
    raise SystemExit("automation terminal proof ordering drifted")

prevalidation = text.split("prevalidate_target_contract_lanes_before_mutation() {", 1)[1].split(
    "\n}\n\nrequire_prevalidated_automation_only_contract()", 1
)[0]
if prevalidation.count("path=ops/scripts/test-automation-only-deploy-contract.sh") != 1:
    raise SystemExit("automation contract is not selected exactly once before mutation")
if 'automation_contract_required="$(automation_only_fast_path_eligible && echo true || echo false)"' not in prevalidation:
    raise SystemExit("automation contract lane is not mandatory")

proof = text.split("require_prevalidated_automation_only_contract() {", 1)[1].split("\n}", 1)[0]
for token in (
    'prevalidated_catalog_contract_sha256[$path]',
    '-f "$ROOT_DIR/$path"',
    '! -L "$ROOT_DIR/$path"',
    'sha256sum "$ROOT_DIR/$path"',
    '[[ "$merged_sha" == "$recorded_sha" ]]',
):
    if token not in proof:
        raise SystemExit(f"post-merge exact SHA proof missing: {token}")
PY

bash -n "$AUTO"
printf '[automation-only-deploy-contract] PASS prevalidation=clean+sha-bound serving=health+asset+public-provenance authority=runtime-ledger+backstage longE2E=runtime-or-frontend-only\n'
