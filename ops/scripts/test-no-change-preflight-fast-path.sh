#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="$root/ops/scripts/auto-deploy-main.sh"

bash -n "$script"

python3 - "$script" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
fetch = source.index('git fetch --quiet --prune "$REMOTE" "$BRANCH"')
no_change = source.index('if [[ "$deployed_commit" == "$target_commit" ]]', fetch)
kubeconfig = source.index('if [[ ! -r "$KUBECONFIG" ]]', fetch)
capacity = source.index('deploy-capacity-gate.sh', fetch)
patroni = source.index('mapfile -t patroni_rows', fetch)

assert fetch < no_change < kubeconfig < capacity < patroni

block_end = source.index("fi", no_change) + 2
block = source[no_change:block_end]
assert "no_change_elapsed_ms" in block
assert 'rm -f -- "$DEPLOY_PHASE_FILE"' in block
assert "exit 0" in block
assert 'record_deploy_phase "remote_change_detection"' in source[fetch:no_change]
assert 'record_deploy_phase "incremental_plan"' in source

print("NO_CHANGE_PREFLIGHT_FAST_PATH_PASS")
PY
