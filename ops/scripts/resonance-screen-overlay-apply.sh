#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SOURCE_DIR="${SOURCE_DIR:-$ROOT_DIR/projects/carbonet-frontend/source}"
OVERLAY_DIR="${OVERLAY_DIR:-$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app}"
GUARD_SCRIPT="${GUARD_SCRIPT:-$ROOT_DIR/ops/scripts/resonance-frontend-overlay-guard.sh}"
STATUS_DIR="${STATUS_DIR:-$ROOT_DIR/var/run}"
STATUS_FILE="${STATUS_FILE:-$STATUS_DIR/frontend-screen-apply-status.json}"
LOCK_FILE="${LOCK_FILE:-$STATUS_DIR/frontend-screen-apply.lock}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
BASE_URL="${BASE_URL:-http://127.0.0.1}"
CARBONET_NODE_HEAP_MB="${CARBONET_NODE_HEAP_MB:-8192}"
SKIP_FRONTEND_BUILD="${SKIP_FRONTEND_BUILD:-false}"
FRONTEND_TYPECHECK_MODE="${FRONTEND_TYPECHECK_MODE:-project}"
UPDATE_GIT_METADATA="${UPDATE_GIT_METADATA:-true}"
SHARED_FRONTEND_NODE_MODULES="${SHARED_FRONTEND_NODE_MODULES:-/opt/Resonance/projects/carbonet-frontend/source/node_modules}"

usage() {
  cat <<'USAGE'
Usage:
  bash ops/scripts/resonance-screen-overlay-apply.sh
  SKIP_FRONTEND_BUILD=true bash ops/scripts/resonance-screen-overlay-apply.sh
  FRONTEND_TYPECHECK_MODE=noemit bash ops/scripts/resonance-screen-overlay-apply.sh

Purpose:
  Apply any existing React-admin/user screen change without container rebuild,
  image rebuild, pod deletion, rollout restart, or backend redeploy.

What this guarantees:
  - TSX/React source changes: npm/vite build is run, then the hostPath overlay
    is verified. Kubernetes deployment is untouched.
  - FRONTEND_TYPECHECK_MODE=noemit runs a non-writing full typecheck once and
    skips the slower project-reference typecheck inside the npm build.
  - Runtime JSON/static-only changes already under the overlay can set
    SKIP_FRONTEND_BUILD=true and only run marker/guard verification.
  - The running pod must already mount:
      /opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app
      -> /app/react-app-overlay

Important boundary:
  This is no-redeploy for all screens. It is not magic no-build for TSX edits.
  Complete no-build screens must be implemented as DB/backend-metadata/JSON
  schema driven runtime pages instead of compiled React modules.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

mkdir -p "$STATUS_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[screen-overlay-apply] another frontend screen apply is running: $LOCK_FILE" >&2
  exit 75
fi

started_at="$(date +%s)"
started_iso="$(date -Is)"

require_file() {
  local path="$1"
  [[ -f "$path" ]] || { echo "[screen-overlay-apply] missing required file: $path" >&2; exit 1; }
}

require_dir() {
  local path="$1"
  [[ -d "$path" ]] || { echo "[screen-overlay-apply] missing required directory: $path" >&2; exit 1; }
}

require_dir "$SOURCE_DIR"
require_dir "$OVERLAY_DIR"
require_file "$GUARD_SCRIPT"

cd "$ROOT_DIR"

ensure_frontend_dependencies() {
  local node_modules_dir="$SOURCE_DIR/node_modules"
  local typescript_entry="$node_modules_dir/typescript/package.json"

  if [[ -f "$typescript_entry" && -x "$node_modules_dir/.bin/vite" ]]; then
    return
  fi

  # Deployment commits are built in isolated Git worktrees. Reuse the
  # dependency tree owned by the stable checkout so every frontend-only deploy
  # does not pay for npm ci and so prebuild generators can import TypeScript.
  if [[ "$node_modules_dir" != "$SHARED_FRONTEND_NODE_MODULES" \
     && -f "$SHARED_FRONTEND_NODE_MODULES/typescript/package.json" \
     && -x "$SHARED_FRONTEND_NODE_MODULES/.bin/vite" ]]; then
    rm -rf "$node_modules_dir"
    ln -s "$SHARED_FRONTEND_NODE_MODULES" "$node_modules_dir"
    echo "[screen-overlay-apply] linked shared frontend dependencies"
    return
  fi

  echo "[screen-overlay-apply] frontend dependencies missing; installing from lockfile"
  (
    cd "$SOURCE_DIR"
    npm ci --ignore-scripts --prefer-offline --no-audit --no-fund
  )
  [[ -f "$typescript_entry" && -x "$node_modules_dir/.bin/vite" ]] || {
    echo "[screen-overlay-apply] frontend dependency readiness check failed" >&2
    exit 1
  }
}

echo "[screen-overlay-apply] mode=all-screens-no-redeploy started=$started_iso"
echo "[screen-overlay-apply] source=$SOURCE_DIR"
echo "[screen-overlay-apply] overlay=$OVERLAY_DIR"

pod="$(kubectl -n "$NAMESPACE" get pod -l "app=$DEPLOYMENT" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
image="$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)"
if [[ -z "$pod" ]]; then
  echo "[screen-overlay-apply] WARN running pod not found for $NAMESPACE/$DEPLOYMENT; local overlay will still be validated" >&2
else
  echo "[screen-overlay-apply] pod=$pod image=$image"
  kubectl -n "$NAMESPACE" exec "$pod" -- sh -lc 'test -d /app/react-app-overlay && test -f /app/react-app-overlay/index.html'
fi

echo "[screen-overlay-apply] backup overlay"
bash "$GUARD_SCRIPT" backup >/dev/null

if [[ "$SKIP_FRONTEND_BUILD" != "true" ]]; then
  ensure_frontend_dependencies
  echo "[screen-overlay-apply] isolated npm build only; no gradle, no image, no rollout"
  staging_dir="$(mktemp -d "$STATUS_DIR/react-overlay-build.XXXXXX")"
  skip_build_typecheck=false
  if [[ "$FRONTEND_TYPECHECK_MODE" == "noemit" ]]; then
    echo "[screen-overlay-apply] typecheck mode=noemit (single pass, no project build metadata writes)"
    (cd "$SOURCE_DIR" && CARBONET_NODE_HEAP_MB="$CARBONET_NODE_HEAP_MB" npx tsc --noEmit --pretty false)
    skip_build_typecheck=true
  elif [[ "$FRONTEND_TYPECHECK_MODE" != "project" ]]; then
    echo "[screen-overlay-apply] unsupported FRONTEND_TYPECHECK_MODE=$FRONTEND_TYPECHECK_MODE" >&2
    rm -rf "$staging_dir"
    exit 2
  fi
  if ! (cd "$SOURCE_DIR" && \
    CARBONET_NODE_HEAP_MB="$CARBONET_NODE_HEAP_MB" \
    CARBONET_SKIP_BUILD_TYPECHECK="$skip_build_typecheck" \
    VITE_OUT_DIR="$staging_dir" \
    npm run build); then
    rm -rf "$staging_dir"
    exit 1
  fi
  node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$staging_dir"
  # Copy immutable assets before atomically replacing the entry document. Do
  # not delete old hashes here: already-open browsers may still request them.
  rsync -a --exclude='/index.html' "$staging_dir/" "$OVERLAY_DIR/"
  cp "$staging_dir/index.html" "$OVERLAY_DIR/.index.html.next"
  mv -f "$OVERLAY_DIR/.index.html.next" "$OVERLAY_DIR/index.html"
  node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$OVERLAY_DIR"
  rm -rf "$staging_dir"
else
  echo "[screen-overlay-apply] frontend build skipped by SKIP_FRONTEND_BUILD=true"
fi

echo "[screen-overlay-apply] write marker"
bash "$GUARD_SCRIPT" write-marker

echo "[screen-overlay-apply] verify overlay/http/source"
BASE_URL="$BASE_URL" bash "$GUARD_SCRIPT" verify-all
echo "[screen-overlay-apply] verify React runtime mount"
smoke_secret="/etc/resonance/secrets/admin-smoke.env"
if [[ -r "$smoke_secret" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$smoke_secret"
  set +a
fi
if ! (cd "$SOURCE_DIR" && BASE_URL="$BASE_URL" node "$ROOT_DIR/ops/scripts/verify-react-mount.mjs"); then
  echo "[screen-overlay-apply] React mount failed; restore latest known overlay backup" >&2
  bash "$GUARD_SCRIPT" restore-latest
  BASE_URL="$BASE_URL" bash "$GUARD_SCRIPT" verify-all
  exit 18
fi

if [[ "$UPDATE_GIT_METADATA" == "true" && -x "$ROOT_DIR/ops/scripts/resonance-write-git-build-metadata.sh" ]]; then
  echo "[screen-overlay-apply] refresh git/build metadata"
  bash "$ROOT_DIR/ops/scripts/resonance-write-git-build-metadata.sh" >/dev/null || true
fi

finished_iso="$(date -Is)"
elapsed="$(( $(date +%s) - started_at ))"
source_hash="$(python3 - "$OVERLAY_DIR/.resonance-build.json" <<'PY'
import json, sys
from pathlib import Path
p=Path(sys.argv[1])
print(json.loads(p.read_text()).get('sourceHash','') if p.exists() else '')
PY
)"
asset_count="$(find "$OVERLAY_DIR/assets" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$SKIP_FRONTEND_BUILD" == "true" ]]; then
  react_build_py=False
else
  react_build_py=True
fi

python3 - "$STATUS_FILE" <<PY
import json
from pathlib import Path
Path(r"$STATUS_FILE").write_text(json.dumps({
  "mode": "all-screens-no-redeploy",
  "startedAt": "$started_iso",
  "finishedAt": "$finished_iso",
  "elapsedSeconds": $elapsed,
  "reactBuild": $react_build_py,
  "gradleBuild": False,
  "imageBuild": False,
  "rolloutRestart": False,
  "podDeleted": False,
  "namespace": "$NAMESPACE",
  "deployment": "$DEPLOYMENT",
  "pod": "$pod",
  "image": "$image",
  "overlayDir": "projects/carbonet-frontend/src/main/resources/static/react-app",
  "sourceHash": "$source_hash",
  "assetCount": int("$asset_count"),
  "baseUrl": "$BASE_URL"
}, ensure_ascii=False, indent=2) + "\n")
PY

cat "$STATUS_FILE"
echo "[screen-overlay-apply] done: no container/image/deployment change was performed"
