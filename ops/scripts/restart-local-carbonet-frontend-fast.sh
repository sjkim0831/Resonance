#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/restart-local-carbonet-frontend-fast.sh

Purpose:
  Rebuild only the Carbonet React bundle and copy it into the running local
  Kubernetes pod filesystem override directory. This avoids Maven packaging,
  Docker image builds, image loading, and pod rollout for frontend-only edits.

Useful env:
  NAMESPACE=carbonet-prod
  DEPLOYMENT=carbonet-runtime
  CONTAINER=carbonet-runtime
  LOCAL_PORT=18080
  CARBONET_NODE_HEAP_MB=4096
  SKIP_FRONTEND_BUILD=true
  OVERLAY_PATH=/app/react-app-overlay

Prerequisite:
  The running pod must have CARBONET_REACT_APP_FS_OVERRIDE_ENABLED=true and
  CARBONET_REACT_APP_FS_OVERRIDE_PATH=/app/react-app-overlay. If not, run one
  full restart with APPLY_CONFIG=true first.
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
CONTAINER="${CONTAINER:-carbonet-runtime}"
LOCAL_PORT="${LOCAL_PORT:-18080}"
OVERLAY_PATH="${OVERLAY_PATH:-/app/react-app-overlay}"
REACT_SOURCE_DIR="$ROOT_DIR/projects/carbonet-frontend/source"
REACT_BUILD_DIR="$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app"

started_at="$(date +%s)"

echo "[frontend-fast] board=context $(kubectl config current-context)"
echo "[frontend-fast] move=find-pod namespace=$NAMESPACE deployment=$DEPLOYMENT"
POD="$(kubectl -n "$NAMESPACE" get pod -l "app=$DEPLOYMENT" -o jsonpath='{.items[0].metadata.name}')"
if [[ -z "$POD" ]]; then
  echo "[frontend-fast] ERROR no pod found for app=$DEPLOYMENT in namespace=$NAMESPACE" >&2
  exit 1
fi

echo "[frontend-fast] move=check-override pod=$POD"
override_enabled="$(kubectl -n "$NAMESPACE" exec "$POD" -c "$CONTAINER" -- sh -lc 'printf "%s" "${CARBONET_REACT_APP_FS_OVERRIDE_ENABLED:-}"')"
override_path="$(kubectl -n "$NAMESPACE" exec "$POD" -c "$CONTAINER" -- sh -lc 'printf "%s" "${CARBONET_REACT_APP_FS_OVERRIDE_PATH:-}"')"
if [[ "$override_enabled" != "true" || "$override_path" != "$OVERLAY_PATH" ]]; then
  cat >&2 <<EOF
[frontend-fast] ERROR filesystem override is not active in the running pod.
[frontend-fast] current enabled='$override_enabled' path='$override_path'
[frontend-fast] expected enabled='true' path='$OVERLAY_PATH'
[frontend-fast] Run once:
[frontend-fast]   APPLY_CONFIG=true SKIP_FRONTEND=true SKIP_MAVEN_CLEAN=true bash ops/scripts/restart-local-carbonet-k8s.sh
EOF
  exit 1
fi

if [[ "${SKIP_FRONTEND_BUILD:-false}" != "true" ]]; then
  echo "[frontend-fast] move=frontend-build"
  (cd "$REACT_SOURCE_DIR" && CARBONET_NODE_HEAP_MB="${CARBONET_NODE_HEAP_MB:-4096}" npm run build)
else
  echo "[frontend-fast] move=frontend-build skipped"
fi

if [[ ! -f "$REACT_BUILD_DIR/index.html" || ! -f "$REACT_BUILD_DIR/.vite/manifest.json" ]]; then
  echo "[frontend-fast] ERROR React build output not found at $REACT_BUILD_DIR" >&2
  exit 1
fi

tmp_overlay="${OVERLAY_PATH}.tmp.$$"
echo "[frontend-fast] move=copy-assets source=$REACT_BUILD_DIR target=$OVERLAY_PATH"
kubectl -n "$NAMESPACE" exec "$POD" -c "$CONTAINER" -- sh -lc "rm -rf '$tmp_overlay'; mkdir -p '$tmp_overlay'"
tar -C "$REACT_BUILD_DIR" -cf - . | kubectl -n "$NAMESPACE" exec -i "$POD" -c "$CONTAINER" -- tar -C "$tmp_overlay" -xf -
kubectl -n "$NAMESPACE" exec "$POD" -c "$CONTAINER" -- sh -lc "rm -rf '${OVERLAY_PATH}.prev'; if [ -d '$OVERLAY_PATH' ]; then mv '$OVERLAY_PATH' '${OVERLAY_PATH}.prev'; fi; mv '$tmp_overlay' '$OVERLAY_PATH'; rm -rf '${OVERLAY_PATH}.prev'"

echo "[frontend-fast] move=verify"
manifest_file="$(mktemp)"
curl -fsS --max-time 10 "http://127.0.0.1:$LOCAL_PORT/assets/react/.vite/manifest.json" >"$manifest_file"
if grep -q "EmissionSurveyReportMigrationPage" "$manifest_file"; then
  rm -f "$manifest_file"
  elapsed="$(( $(date +%s) - started_at ))"
  echo "[frontend-fast] CHECKMATE React overlay is served on :$LOCAL_PORT elapsed=${elapsed}s"
else
  rm -f "$manifest_file"
  echo "[frontend-fast] WARN report bundle marker not found on :$LOCAL_PORT" >&2
  exit 1
fi
