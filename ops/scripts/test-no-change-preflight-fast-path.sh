#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="$root/ops/scripts/auto-deploy-main.sh"

bash -n "$script"

python3 - "$script" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
fetch = source.index('git fetch --quiet --no-tags "$REMOTE"')
webhook_cache = source.index('target revision reused from authenticated webhook cache')
no_change = source.index('if [[ "$deployed_commit" == "$target_commit" ]]', fetch)
kubeconfig = source.index('if [[ ! -r "$KUBECONFIG" ]]', fetch)
capacity = source.index('deploy-capacity-gate.sh', fetch)
patroni = source.index('mapfile -t patroni_rows', fetch)

assert webhook_cache < fetch < no_change < kubeconfig < capacity < patroni
assert 'desired_commit" =~ ^[0-9a-f]{40}$' in source
assert '"$desired_commit" != "$deployed_commit"' in source
assert 'git cat-file -e "${desired_commit}^{commit}"' in source
assert 'refs/heads/$BRANCH:refs/remotes/$REMOTE/$BRANCH' in source[fetch:no_change]
assert '--prune' not in source[fetch:no_change]

block_end = source.index("fi", no_change) + 2
block = source[no_change:block_end]
assert "no_change_elapsed_ms" in block
assert 'rm -f -- "$DEPLOY_PHASE_FILE"' in block
assert "exit 0" in block
assert 'record_deploy_phase "remote_change_detection"' in source[fetch:no_change]
assert 'record_deploy_phase "incremental_plan"' in source

print("NO_CHANGE_PREFLIGHT_FAST_PATH_PASS")
PY
