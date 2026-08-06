#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OVERLAY_DIR="${1:?overlay directory is required}"
THRESHOLD="${REACT_ASSET_PRUNE_THRESHOLD:-1200}"
REQUEST_FILE="${REACT_ASSET_PRUNE_REQUEST_FILE:-$OVERLAY_DIR/.asset-prune-request}"

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

printf 'requestedAt=%s\nassetCount=%s\nthreshold=%s\n' \
  "$(date -Is)" "$asset_count" "$THRESHOLD" >"${REQUEST_FILE}.tmp"
mv -f "${REQUEST_FILE}.tmp" "$REQUEST_FILE"
echo "[asset-prune] queued assets=$asset_count threshold=$THRESHOLD request=$REQUEST_FILE"
