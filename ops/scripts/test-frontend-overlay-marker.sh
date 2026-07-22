#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="$ROOT_DIR/ops/scripts/resonance-frontend-overlay-guard.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

SOURCE_DIR="$TMP_DIR/source"
OVERLAY_DIR="$TMP_DIR/overlay"
mkdir -p "$SOURCE_DIR/src" "$OVERLAY_DIR/.vite"
printf '{"scripts":{}}\n' > "$SOURCE_DIR/package.json"
printf 'export const value = 1;\n' > "$SOURCE_DIR/src/main.ts"
printf '<script type="module" src="/assets/react/assets/index-new.js"></script>\n' > "$OVERLAY_DIR/index.html"
printf '{"index.html":{"file":"assets/index-new.js"}}\n' > "$OVERLAY_DIR/.vite/manifest.json"

SOURCE_DIR="$SOURCE_DIR" OVERLAY_DIR="$OVERLAY_DIR" \
  bash "$GUARD" write-marker >/dev/null
SOURCE_DIR="$SOURCE_DIR" OVERLAY_DIR="$OVERLAY_DIR" \
  bash "$GUARD" verify-source >/dev/null

printf '<script type="module" src="/assets/react/assets/index-stale.js"></script>\n' > "$OVERLAY_DIR/index.html"
set +e
SOURCE_DIR="$SOURCE_DIR" OVERLAY_DIR="$OVERLAY_DIR" \
  bash "$GUARD" verify-source >/dev/null 2>&1
status=$?
set -e

if [[ "$status" -ne 32 ]]; then
  echo "FAIL expected stale entry graph status=32 actual=$status" >&2
  exit 1
fi

echo "PASS frontend overlay marker rejects a stale entry graph"
