#!/usr/bin/env bash
set -euo pipefail

# The operator checkout is intentionally allowed to contain local diagnostics
# and generated evidence. Running the tracked script directly from that dirty
# checkout freezes deployment automation at its old commit forever. Load only
# the launcher script from the latest remote main commit, then let that script
# create its existing isolated deployment worktree.
ROOT_DIR="${CARBONET_DEPLOY_ORIGINAL_ROOT:-/opt/Resonance}"
REMOTE="${CARBONET_DEPLOY_REMOTE:-origin}"
BRANCH="${CARBONET_DEPLOY_BRANCH:-main}"

git -C "$ROOT_DIR" fetch --quiet --prune "$REMOTE" "$BRANCH"
target_commit="$(git -C "$ROOT_DIR" rev-parse "$REMOTE/$BRANCH")"
snapshot_script="$(mktemp /tmp/carbonet-auto-deploy-main.XXXXXX.sh)"
trap 'rm -f -- "$snapshot_script"' EXIT INT TERM

git -C "$ROOT_DIR" show \
  "$target_commit:ops/scripts/auto-deploy-main.sh" >"$snapshot_script"
chmod 700 "$snapshot_script"

CARBONET_DEPLOY_SNAPSHOT_ACTIVE=true \
CARBONET_DEPLOY_ORIGINAL_ROOT="$ROOT_DIR" \
CARBONET_DEPLOY_SNAPSHOT_PATH="$snapshot_script" \
  bash "$snapshot_script" "$@"
