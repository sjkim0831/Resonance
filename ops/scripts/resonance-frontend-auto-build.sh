#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC_DIR="$ROOT_DIR/projects/carbonet-frontend/source"
OUT_DIR="$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app"
RUN_DIR="$ROOT_DIR/var/run"
LOG_DIR="$ROOT_DIR/var/logs"
LOCK_FILE="$RUN_DIR/resonance-frontend-auto-build.lock"
STAMP_FILE="$RUN_DIR/frontend-source.fingerprint"
STAGING_ROOT="$RUN_DIR/frontend-build-staging"
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
    ! -path '*/src/features/builder-studio/pageCompletenessInventory.ts' \
    ! -path '*/src/features/builder-studio/routeSourceInventory.ts' \
    ! -name '*.tsbuildinfo' \
    -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}'
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
  node "$ROOT_DIR/ops/scripts/generate-builder-asset-registry.mjs"
  cd "$SRC_DIR"
  if [[ ! -d node_modules || "${FORCE_NPM_CI:-false}" == "true" ]]; then
    npm ci
  fi
  staging_dir="$STAGING_ROOT/$(date +%s)-$$"
  mkdir -p "$staging_dir"
  cleanup() { rm -rf -- "$staging_dir"; }
  trap cleanup EXIT

  CARBONET_NODE_HEAP_MB="${CARBONET_NODE_HEAP_MB:-8192}" \
    VITE_OUT_DIR="$staging_dir" npm run build

  test -f "$staging_dir/index.html"
  test -f "$staging_dir/.vite/manifest.json"
  mkdir -p "$OUT_DIR/assets" "$OUT_DIR/.vite"

  # Publish immutable hashed assets first. Existing bundles remain available to
  # in-flight pages until their HTML/bootstrap references move to the new hash.
  rsync -a "$staging_dir/assets/" "$OUT_DIR/assets/"
  for optional_dir in api ocr; do
    if [[ -d "$staging_dir/$optional_dir" ]]; then
      mkdir -p "$OUT_DIR/$optional_dir"
      rsync -a "$staging_dir/$optional_dir/" "$OUT_DIR/$optional_dir/"
    fi
  done

  install -m 0644 "$staging_dir/.vite/manifest.json" "$OUT_DIR/.vite/manifest.json.next"
  mv -f "$OUT_DIR/.vite/manifest.json.next" "$OUT_DIR/.vite/manifest.json"
  install -m 0644 "$staging_dir/index.html" "$OUT_DIR/index.html.next"
  mv -f "$OUT_DIR/index.html.next" "$OUT_DIR/index.html"
  printf '%s\n' "$new_fp" > "$STAMP_FILE"
  echo "[$(date -Is)] frontend build complete: $OUT_DIR"
  echo "[$(date -Is)] running bundle integrity check..."
  bash "$ROOT_DIR/ops/scripts/resonance-react-bundle-integrity.sh" || {
    echo "[$(date -Is)] BUNDLE INTEGRITY FAILED — build output does not match index.html references"
    exit 1
  }
  echo "[$(date -Is)] bundle integrity OK"
} >> "$LOG_DIR/resonance-frontend-auto-build.log" 2>&1
