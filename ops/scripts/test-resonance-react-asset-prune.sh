#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT
overlay="$TMP_ROOT/overlay"
request="$overlay/.asset-prune-request"
mkdir -p "$overlay/.vite" "$overlay/assets"
printf '<html></html>\n' > "$overlay/index.html"
printf 'current\n' > "$overlay/assets/current.js"
printf 'previous\n' > "$overlay/assets/previous.js"
printf 'stale\n' > "$overlay/assets/stale.js"
printf '{"entry":{"file":"assets/current.js"}}\n' > "$overlay/.vite/manifest.json"
printf '{"entry":{"file":"assets/previous.js"}}\n' > "$overlay/.vite/previous-manifest.json"
printf 'queued\n' > "$request"

exec 7>"$TMP_ROOT/deploy.lock"
flock -n 7
ROOT_DIR="$ROOT_DIR" OVERLAY_DIR="$overlay" \
CARBONET_DEPLOY_LOCK_FILE="$TMP_ROOT/deploy.lock" \
FRONTEND_APPLY_LOCK_FILE="$TMP_ROOT/frontend.lock" \
REACT_ASSET_PRUNE_REQUEST_FILE="$request" \
  bash "$SCRIPT_DIR/resonance-react-asset-prune.sh"
test -f "$request"
test -f "$overlay/assets/stale.js"
flock -u 7

ROOT_DIR="$ROOT_DIR" OVERLAY_DIR="$overlay" \
CARBONET_DEPLOY_LOCK_FILE="$TMP_ROOT/deploy.lock" \
FRONTEND_APPLY_LOCK_FILE="$TMP_ROOT/frontend.lock" \
REACT_ASSET_PRUNE_REQUEST_FILE="$request" \
  bash "$SCRIPT_DIR/resonance-react-asset-prune.sh"
test ! -e "$request"
test ! -e "$overlay/assets/stale.js"
test -f "$overlay/assets/current.js"
test -f "$overlay/assets/previous.js"
echo '[asset-prune-worker-test] PASS lock deferral and low-priority cleanup contract'
