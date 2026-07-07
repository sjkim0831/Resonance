#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC_DIR="$ROOT_DIR/projects/carbonet-frontend/source"
OUT_DIR="$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app"
RUN_DIR="$ROOT_DIR/var/run"
LOG_DIR="$ROOT_DIR/var/logs"
LOCK_FILE="$RUN_DIR/resonance-frontend-auto-build.lock"
STAMP_FILE="$RUN_DIR/frontend-source.fingerprint"
mkdir -p "$RUN_DIR" "$LOG_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0
fingerprint() {
  find "$SRC_DIR" -type f \
    ! -path '*/node_modules/*' \
    ! -path '*/dist/*' \
    ! -path '*/.vite/*' \
    ! -path '*/src/generated/*' \
    ! -path '*/src/assets/generated/*' \
    ! -path '*/src/generated/**' \
    ! -name '*.tsbuildinfo' \
    -printf '%T@ %s %p\n' | sort | sha256sum | awk '{print $1}'
}
new_fp="$(fingerprint)"
old_fp="$(cat "$STAMP_FILE" 2>/dev/null || true)"
if [[ ! -d "$SRC_DIR" || ! -f "$SRC_DIR/package.json" ]]; then
  echo "[$(date -Is)] ERROR: frontend source not found at $SRC_DIR — cannot auto-build. Restore with: git checkout <commit> -- projects/carbonet-frontend/source/" >&2
  exit 1
fi
if [[ "$new_fp" == "$old_fp" && -f "$OUT_DIR/.vite/manifest.json" ]]; then
  echo "[$(date -Is)] frontend unchanged, skipping build"
  exit 0
fi
{
  echo "[$(date -Is)] frontend change detected; building React assets"
  cd "$SRC_DIR"
  if [[ ! -d node_modules || "${FORCE_NPM_CI:-false}" == "true" ]]; then
    npm ci
  fi
  CARBONET_NODE_HEAP_MB="${CARBONET_NODE_HEAP_MB:-8192}" npm run build
  printf '%s\n' "$new_fp" > "$STAMP_FILE"
  echo "[$(date -Is)] frontend build complete: $OUT_DIR"
  echo "[$(date -Is)] running bundle integrity check..."
  bash "$ROOT_DIR/ops/scripts/resonance-react-bundle-integrity.sh" || {
    echo "[$(date -Is)] BUNDLE INTEGRITY FAILED — build output does not match index.html references"
    exit 1
  }
  echo "[$(date -Is)] bundle integrity OK"
} >> "$LOG_DIR/resonance-frontend-auto-build.log" 2>&1
