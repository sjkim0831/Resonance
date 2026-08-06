#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance/var/deploy-worktrees/runtime-build}"
OVERLAY_DIR="${OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}"
REQUEST_FILE="${REACT_ASSET_PRUNE_REQUEST_FILE:-$OVERLAY_DIR/.asset-prune-request}"
PREVIOUS_MANIFEST="${REACT_ASSET_PREVIOUS_MANIFEST:-$OVERLAY_DIR/.vite/previous-manifest.json}"
DEPLOY_LOCK="${CARBONET_DEPLOY_LOCK_FILE:-/tmp/carbonet-auto-deploy.lock}"
FRONTEND_LOCK="${FRONTEND_APPLY_LOCK_FILE:-/opt/Resonance/var/run/frontend-screen-apply.lock}"

[[ -f "$REQUEST_FILE" ]] || {
  echo '[asset-prune-worker] no request'
  exit 0
}

exec 8>"$DEPLOY_LOCK"
flock -n 8 || {
  echo '[asset-prune-worker] deployment active; deferred'
  exit 0
}
exec 9>"$FRONTEND_LOCK"
flock -n 9 || {
  echo '[asset-prune-worker] frontend apply active; deferred'
  exit 0
}

node "$ROOT_DIR/ops/scripts/prune-react-asset-generations.mjs" \
  "$OVERLAY_DIR" "$PREVIOUS_MANIFEST"
node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$OVERLAY_DIR"
rm -f -- "$REQUEST_FILE"
echo '[asset-prune-worker] PASS request cleared'
