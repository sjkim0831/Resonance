#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
BASE_URL="${BASE_URL:-http://127.0.0.1}"
RUNTIME_DEPLOYMENT="${RUNTIME_DEPLOYMENT:-carbonet-runtime}"
WEB_DEPLOYMENT="${WEB_DEPLOYMENT:-carbonet-web}"
RUNTIME_CONTAINER="${RUNTIME_CONTAINER:-carbonet-runtime}"
WEB_CONTAINER="${WEB_CONTAINER:-web}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/projects/carbonet-frontend/source}"
OVERLAY_DIR="${OVERLAY_DIR:-$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app}"
STATE_DIR="${FULL_SCREEN_GATE_STATE_DIR:-$ROOT_DIR/var/run/full-screen-deploy-gate}"
REPORT_DIR="${FULL_SCREEN_GATE_REPORT_DIR:-$ROOT_DIR/var/reports/full-screen-deploy-gate}"
CREDENTIAL_SECRET="${FULL_SCREEN_GATE_CREDENTIAL_SECRET:-carbonet-screen-smoke}"
ACTIVE_FILE="$STATE_DIR/active.env"
ACTION="${1:-verify}"

log() { printf '[full-screen-gate] %s %s\n' "$(date -Is)" "$*"; }
fail() { log "FAIL: $*" >&2; exit 1; }

require_safe_path() {
  local path="$1" parent="$2"
  [[ "$path" == "$parent"/* ]] || fail "unsafe path: $path"
}

load_active() {
  [[ -s "$ACTIVE_FILE" ]] || fail "deployment snapshot is missing: $ACTIVE_FILE"
  # shellcheck disable=SC1090
  source "$ACTIVE_FILE"
  require_safe_path "$SNAPSHOT_DIR" "$STATE_DIR"
}

capture() {
  mkdir -p "$STATE_DIR" "$REPORT_DIR"
  local snapshot_id snapshot_dir runtime_image web_image git_sha
  snapshot_id="$(date +%Y%m%d-%H%M%S)-$$"
  snapshot_dir="$STATE_DIR/snapshots/$snapshot_id"
  require_safe_path "$snapshot_dir" "$STATE_DIR"
  mkdir -p "$snapshot_dir"

  runtime_image="$(kubectl -n "$NAMESPACE" get deployment "$RUNTIME_DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}')"
  web_image="$(kubectl -n "$NAMESPACE" get deployment "$WEB_DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}')"
  git_sha="$(git -C "$ROOT_DIR" rev-parse HEAD)"
  test -s "$OVERLAY_DIR/index.html"
  tar -C "$OVERLAY_DIR" -czf "$snapshot_dir/frontend-overlay.tar.gz" .
  kubectl -n "$NAMESPACE" get configmap carbonet-web-nginx -o jsonpath='{.data.nginx\.conf}' > "$snapshot_dir/nginx.conf"
  test -s "$snapshot_dir/nginx.conf"

  cat > "$ACTIVE_FILE.tmp" <<EOF
SNAPSHOT_ID='$snapshot_id'
SNAPSHOT_DIR='$snapshot_dir'
RUNTIME_IMAGE='$runtime_image'
WEB_IMAGE='$web_image'
GIT_SHA='$git_sha'
EOF
  mv "$ACTIVE_FILE.tmp" "$ACTIVE_FILE"
  log "captured snapshot=$snapshot_id runtime=$runtime_image web=$web_image git=$git_sha"
}

restore() {
  load_active
  local restore_dir current_runtime current_web
  restore_dir="$(mktemp -d "$STATE_DIR/restore.XXXXXX")"
  require_safe_path "$restore_dir" "$STATE_DIR"
  tar -C "$restore_dir" -xzf "$SNAPSHOT_DIR/frontend-overlay.tar.gz"
  node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$restore_dir"
  rsync -a --exclude='/index.html' "$restore_dir/" "$OVERLAY_DIR/"
  cp "$restore_dir/index.html" "$OVERLAY_DIR/.index.html.rollback"
  mv -f "$OVERLAY_DIR/.index.html.rollback" "$OVERLAY_DIR/index.html"
  node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$OVERLAY_DIR"

  kubectl -n "$NAMESPACE" get configmap carbonet-web-nginx -o jsonpath='{.data.nginx\.conf}' > "$restore_dir/current-nginx.conf"
  if ! cmp -s "$restore_dir/current-nginx.conf" "$SNAPSHOT_DIR/nginx.conf"; then
    kubectl -n "$NAMESPACE" create configmap carbonet-web-nginx \
      --from-file="nginx.conf=$SNAPSHOT_DIR/nginx.conf" --dry-run=client -o yaml | kubectl apply -f -
    kubectl -n "$NAMESPACE" rollout restart "deployment/$WEB_DEPLOYMENT"
  fi

  current_runtime="$(kubectl -n "$NAMESPACE" get deployment "$RUNTIME_DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}')"
  current_web="$(kubectl -n "$NAMESPACE" get deployment "$WEB_DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}')"
  [[ "$current_runtime" == "$RUNTIME_IMAGE" ]] || kubectl -n "$NAMESPACE" set image "deployment/$RUNTIME_DEPLOYMENT" "$RUNTIME_CONTAINER=$RUNTIME_IMAGE" >/dev/null
  [[ "$current_web" == "$WEB_IMAGE" ]] || kubectl -n "$NAMESPACE" set image "deployment/$WEB_DEPLOYMENT" "$WEB_CONTAINER=$WEB_IMAGE" >/dev/null
  kubectl -n "$NAMESPACE" rollout status "deployment/$RUNTIME_DEPLOYMENT" --timeout=600s
  kubectl -n "$NAMESPACE" rollout status "deployment/$WEB_DEPLOYMENT" --timeout=180s
  curl -fsS --max-time 15 "$BASE_URL/actuator/health" | grep -q '"status":"UP"'
  rm -rf "$restore_dir"
  log "restored snapshot=$SNAPSHOT_ID"
}

read_credentials() {
  if [[ -z "${FULL_SCREEN_SMOKE_ADMIN_USER:-}" ]]; then
    FULL_SCREEN_SMOKE_ADMIN_USER="$(kubectl -n "$NAMESPACE" get secret "$CREDENTIAL_SECRET" -o jsonpath='{.data.username}' | base64 -d)"
  fi
  if [[ -z "${FULL_SCREEN_SMOKE_ADMIN_PASSWORD:-}" ]]; then
    FULL_SCREEN_SMOKE_ADMIN_PASSWORD="$(kubectl -n "$NAMESPACE" get secret "$CREDENTIAL_SECRET" -o jsonpath='{.data.password}' | base64 -d)"
  fi
  export FULL_SCREEN_SMOKE_ADMIN_USER FULL_SCREEN_SMOKE_ADMIN_PASSWORD
  [[ -n "$FULL_SCREEN_SMOKE_ADMIN_USER" && -n "$FULL_SCREEN_SMOKE_ADMIN_PASSWORD" ]] || fail "smoke credentials are empty"
}

verify() {
  load_active
  read_credentials
  local run_id run_report smoke_status=0 summary_status=0
  run_id="$(date +%Y%m%d-%H%M%S)-$SNAPSHOT_ID"
  run_report="$REPORT_DIR/$run_id"
  mkdir -p "$run_report"

  log "verifying snapshot=$SNAPSHOT_ID changedOnly=${FULL_SCREEN_SMOKE_CHANGED_ONLY:-false}"
  set +e
  (
    cd "$FRONTEND_DIR"
    FULL_SCREEN_SMOKE_CHANGED_ONLY="${FULL_SCREEN_SMOKE_CHANGED_ONLY:-false}" \
    FULL_SCREEN_SMOKE_WORKERS="${FULL_SCREEN_SMOKE_WORKERS:-8}" \
    FULL_SCREEN_SMOKE_SUMMARY="$run_report/summary.json" \
      bash scripts/run-full-screen-smoke.sh
  ) 2>&1 | tee "$run_report/run.log"
  smoke_status=${PIPESTATUS[0]}
  set -e
  [[ -f "$FRONTEND_DIR/.cache/full-screen-smoke/manifest.json" ]] && cp "$FRONTEND_DIR/.cache/full-screen-smoke/manifest.json" "$run_report/manifest.json"
  [[ -f "$run_report/summary.json" ]] || summary_status=1
  [[ "${FULL_SCREEN_GATE_TEST_FORCE_FAILURE:-false}" == "true" ]] && smoke_status=97

  node - "$run_report/gate-status.json" "$smoke_status" "$SNAPSHOT_ID" <<'NODE'
const fs = require('node:fs');
const [path, status, snapshotId] = process.argv.slice(2);
fs.writeFileSync(path, JSON.stringify({
  schemaVersion: 1,
  completedAt: new Date().toISOString(),
  snapshotId,
  ok: Number(status) === 0,
  smokeExitCode: Number(status)
}, null, 2) + '\n');
NODE

  if [[ "$smoke_status" -ne 0 || "$summary_status" -ne 0 ]]; then
    log "deployment rejected report=$run_report"
    if [[ "${FULL_SCREEN_GATE_AUTO_ROLLBACK:-true}" == "true" ]]; then
      restore
      log "automatic rollback completed"
    fi
    return 1
  fi
  rm -f "$ACTIVE_FILE"
  find "$REPORT_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf -- {} +
  log "PASS report=$run_report"
}

case "$ACTION" in
  capture) capture ;;
  verify) verify ;;
  restore) restore ;;
  *) fail "usage: $0 {capture|verify|restore}" ;;
esac
