#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_SCRIPT="$ROOT_DIR/ops/scripts/auto-deploy-main.sh"

python3 - "$DEPLOY_SCRIPT" <<'PY'
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text(encoding="utf-8")

stale_scope = text.index('case "$stale_real" in')
stale_chown = text.index('sudo -n chown -R "$(id -u):$(id -g)" "$stale_real"', stale_scope)
stale_remove = text.index('worktree remove --force "$stale_real"', stale_chown)
snapshot = text.index('merge_overlay_backup="$(mktemp -d')
generated_restore = text.index('generated_paths=(')
catalog_branch = text.index('if [[ "$PLAN_RUNTIME_REQUIRED" != "true" ]]')
catalog_merge = text.index('git merge --ff-only "$target_commit"', catalog_branch)
catalog_restore = text.index('restore_live_frontend_overlay', catalog_merge)
catalog_exit = text.index('exit 0', catalog_restore)
runtime_merge = text.index('git merge --ff-only "$target_commit"', catalog_exit)
runtime_restore = text.index('restore_live_frontend_overlay', runtime_merge)

assert stale_scope < stale_chown < stale_remove, "stale deployment worktrees must repair ownership before removal"
assert snapshot < generated_restore, "live overlay must be captured before generated files are restored"
assert catalog_merge < catalog_restore < catalog_exit, "catalog-only merge must restore the live overlay"
assert runtime_merge < runtime_restore, "runtime merge must restore the live overlay"
print("PASS auto-deploy preserves the live frontend closure across every merge path")
PY
