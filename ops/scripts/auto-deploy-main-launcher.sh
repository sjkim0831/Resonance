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

# Native build/test processes can leave thousands of extracted shared objects
# in tmpfs. When the per-user tmp quota is exhausted, `git show > file` exits
# with 255 before the deploy script can emit useful evidence. Reclaim only
# stale, launcher-owned patterns and fail with an explicit capacity signal.
tmp_probe="/tmp/.carbonet-deploy-write-probe.$$"
if ! (umask 077 && printf 'ok\n' >"$tmp_probe") 2>/dev/null; then
  find /tmp -xdev -maxdepth 1 -type f -user "$(id -un)" \
    -name '.5bf*.so' -mmin +30 -delete 2>/dev/null || true
  find /tmp -xdev -maxdepth 1 -type d -user "$(id -un)" \
    -name 'tomcat.18000.*' -mmin +60 -empty -delete 2>/dev/null || true
fi
if ! (umask 077 && printf 'ok\n' >"$tmp_probe") 2>/dev/null; then
  echo "[capacity-gate] FAIL: /tmp user quota prevents deployment writes" >&2
  exit 24
fi
rm -f -- "$tmp_probe"

git -C "$ROOT_DIR" fetch --quiet --prune "$REMOTE" "$BRANCH"
target_commit="$(git -C "$ROOT_DIR" rev-parse "$REMOTE/$BRANCH")"
snapshot_dir="$(mktemp -d /tmp/carbonet-auto-deploy-main.XXXXXX)"
snapshot_script="$snapshot_dir/auto-deploy-main.sh"
snapshot_plan="$snapshot_dir/plan-incremental-work.sh"
trap 'rm -rf -- "$snapshot_dir"' EXIT INT TERM

git -C "$ROOT_DIR" show \
  "$target_commit:ops/scripts/auto-deploy-main.sh" >"$snapshot_script"
git -C "$ROOT_DIR" show \
  "$target_commit:ops/scripts/plan-incremental-work.sh" >"$snapshot_plan"
chmod 700 "$snapshot_script" "$snapshot_plan"

CARBONET_DEPLOY_SNAPSHOT_ACTIVE=true \
CARBONET_DEPLOY_ORIGINAL_ROOT="$ROOT_DIR" \
CARBONET_DEPLOY_SNAPSHOT_PATH="$snapshot_script" \
CARBONET_DEPLOY_PLAN_SCRIPT="$snapshot_plan" \
  bash "$snapshot_script" "$@"
