#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OVERLAY_DIR="${1:?overlay directory is required}"
PREVIOUS_MANIFEST="${2:-}"
THRESHOLD="${REACT_ASSET_PRUNE_THRESHOLD:-1200}"

[[ "$THRESHOLD" =~ ^[0-9]+$ ]] || {
  echo "[asset-prune] invalid threshold=$THRESHOLD" >&2
  exit 2
}
[[ -d "$OVERLAY_DIR/assets" ]] || {
  echo "[asset-prune] assets directory missing: $OVERLAY_DIR/assets" >&2
  exit 2
}

asset_count="$(find "$OVERLAY_DIR/assets" -type f -printf '.' | wc -c)"
if (( asset_count <= THRESHOLD )); then
  echo "[asset-prune] deferred assets=$asset_count threshold=$THRESHOLD"
  exit 0
fi

echo "[asset-prune] threshold exceeded assets=$asset_count threshold=$THRESHOLD"
node "$ROOT_DIR/ops/scripts/prune-react-asset-generations.mjs" \
  "$OVERLAY_DIR" "$PREVIOUS_MANIFEST"
