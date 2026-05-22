#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_DIR="$ROOT_DIR/var/run"
LOG_DIR="$ROOT_DIR/var/logs"
LOCK_FILE="$RUN_DIR/resonance-backend-auto-redeploy.lock"
STAMP_FILE="$RUN_DIR/backend-source.fingerprint"
DEPLOY_SCRIPT="$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80.sh"
DEBUG_LOG="$LOG_DIR/resonance-backend-auto-redeploy-debug.log"

fingerprint() {
  (
    export LC_ALL=C
    cd "$ROOT_DIR"
    find pom.xml apps modules projects/carbonet-adapter projects/carbonet-runtime ops/docker -type f \
      \( -name '*.java' -o -name '*.xml' -o -name '*.yml' -o -name '*.yaml' -o -name 'Dockerfile*' -o -name '*.sh' \) \
      ! -path '*/target/*' \
      ! -path '*/node_modules/*' \
      ! -path '*/src/main/resources/static/react-app/*' \
      ! -path '*/src/main/resources/static/assets/react/*' \
      -print0 2>/dev/null | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}'
  )
}

if [[ "${1:-run}" == "fingerprint" ]]; then
  fingerprint
  exit 0
fi

mkdir -p "$RUN_DIR" "$LOG_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

new_fp="$(fingerprint)"
if [[ "${1:-run}" == "service-fingerprint" ]]; then
  printf '%s\n' "$new_fp"
  exit 0
fi

old_fp="$(cat "$STAMP_FILE" 2>/dev/null || true)"
if [[ "${AUTO_REDEPLOY_DEBUG:-false}" == "true" || "$new_fp" != "$old_fp" ]]; then
  printf '[%s] uid=%s root=%s stamp=%s old_len=%s new_len=%s old=%s new=%s\n' \
    "$(date -Is)" "$(id -u)" "$ROOT_DIR" "$STAMP_FILE" "${#old_fp}" "${#new_fp}" "$old_fp" "$new_fp" >>"$DEBUG_LOG"
fi
if [[ "${1:-run}" == "compare-only" ]]; then
  printf 'old=%s\nnew=%s\nmatch=%s\n' "$old_fp" "$new_fp" "$([[ "$new_fp" == "$old_fp" ]] && echo yes || echo no)"
  exit 0
fi
if [[ "$new_fp" == "$old_fp" ]]; then
  if [[ "${AUTO_REDEPLOY_DEBUG:-false}" == "true" ]]; then
    printf '[%s] no-change; skip redeploy\n' "$(date -Is)" >>"$DEBUG_LOG"
  fi
  exit 0
fi

{
  echo "[$(date -Is)] backend/runtime change detected; building image and rolling deployment through :80"
  cd "$ROOT_DIR"
  deploy_exit=0
  SKIP_FRONTEND=false SKIP_MAVEN_CLEAN=false VERIFY_SURVEY_ADMIN_PRODUCT_COMBOBOX=true RESONANCE_AUTO_GIT_COMMIT=false RESONANCE_AUTO_GIT_PUSH=false TERMINATE_EXISTING_DEPLOY_ON_START=false CLEANUP_STALE_REPLICASETS=true VERIFY_REACT_BOOTSTRAP_ASSETS=true \
    bash "$DEPLOY_SCRIPT" || deploy_exit=$?
  if [[ "$deploy_exit" -eq 75 ]]; then
    echo "[$(date -Is)] deploy skipped because another deployment is running; fingerprint not updated"
    exit 0
  fi
  if [[ "$deploy_exit" -ne 0 ]]; then
    echo "[$(date -Is)] backend redeploy failed with exit code $deploy_exit; fingerprint not updated"
    exit "$deploy_exit"
  fi
  if id sjkim >/dev/null 2>&1; then
    chown -R sjkim:sjkim "$ROOT_DIR/var/releases" "$ROOT_DIR/var/run" "$ROOT_DIR/var/logs" "$ROOT_DIR/var/ai-runtime" "$ROOT_DIR/var/backups" "$ROOT_DIR/var/k8s" 2>/dev/null || true
  fi
  printf '%s\n' "$new_fp" >"$STAMP_FILE"
  echo "[$(date -Is)] backend redeploy complete"
} >>"$LOG_DIR/resonance-backend-auto-redeploy.log" 2>&1
