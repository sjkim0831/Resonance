#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT
overlay="$TMP_ROOT/overlay"
mkdir -p "$overlay/.vite" "$overlay/assets"
printf 'current\n' > "$overlay/assets/current.js"
printf 'previous\n' > "$overlay/assets/previous.js"
printf 'stale\n' > "$overlay/assets/stale.js"
printf '{"entry":{"file":"assets/current.js"}}\n' > "$overlay/.vite/manifest.json"
printf '{"entry":{"file":"assets/previous.js"}}\n' > "$TMP_ROOT/previous.json"

REACT_ASSET_PRUNE_THRESHOLD=3 \
  bash "$SCRIPT_DIR/prune-react-assets-if-needed.sh" "$overlay"
test -f "$overlay/assets/stale.js"
test ! -e "$overlay/.asset-prune-request"

REACT_ASSET_PRUNE_THRESHOLD=2 \
  bash "$SCRIPT_DIR/prune-react-assets-if-needed.sh" "$overlay"
test -f "$overlay/.asset-prune-request"
test -f "$overlay/assets/stale.js"
echo '[asset-prune-test] PASS deployment path only queues bounded pruning'
