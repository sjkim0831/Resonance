#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="$root/ops/scripts/auto-deploy-main.sh"

bash -n "$script"

python3 - "$script" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")

copy_start = source.index('source_overlay="$source_root/')
copy_end = source.index('ROOT_DIR="$clean_worktree"', copy_start)
copy_block = source[copy_start:copy_end]
assert '"$PLAN_RUNTIME_REQUIRED" == "true"' in copy_block
assert "isolated frontend overlay copy skipped for catalog-only work" in copy_block
assert "restore_tracked_build_artifacts" in source
assert "xargs -0 -r git" in source
assert 'if [[ "$worktree_advanced" != "true" ]]' in source
assert 'for generated_path in "${persistent_build_artifacts[@]}"' not in source

snapshot_start = source.index('merge_overlay_backup="$(mktemp')
snapshot_end = source.index("restore_live_frontend_overlay() {", snapshot_start)
snapshot_block = source[snapshot_start:snapshot_end]
assert 'CARBONET_CLEAN_WORKTREE_ACTIVE' in snapshot_block
assert '"$PLAN_RUNTIME_REQUIRED" != "true"' in snapshot_block
assert "isolated overlay snapshot skipped for catalog-only work" in snapshot_block

print("CATALOG_OVERLAY_FAST_PATH_PASS")
PY
