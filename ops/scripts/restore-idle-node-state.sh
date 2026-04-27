#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="restore-idle-node-state"
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/idle-node-common.sh"

TARGET_IP="${TARGET_IP:-34.82.132.175}"
STATE_DIR="${1:-}"
MAIN_TARGET="${MAIN_TARGET:-carbonet2026@136.117.100.221}"
IDLE_SSH_PASSWORD="${IDLE_SSH_PASSWORD:-}"
NGINX_CONTROL_TARGET="${NGINX_CONTROL_TARGET:-$MAIN_TARGET}"
NGINX_IDLE_INCLUDE_PATH="${NGINX_IDLE_INCLUDE_PATH:-/etc/nginx/carbonet/carbonet-idle-upstream.inc}"
NGINX_UPSTREAM_NAME="${NGINX_UPSTREAM_NAME:-carbonet_app}"
UPSTREAM_WRITER="${UPSTREAM_WRITER:-/opt/Resonance/ops/scripts/write-idle-upstream.sh}"

restore_jobs() {
  local state_dir="$1"
  local jobs_dir="$state_dir/jobs"
  if [[ ! -d "$jobs_dir" ]]; then
    return 0
  fi

  local job_file=""
  for job_file in "$jobs_dir"/*.json; do
    [[ ! -f "$job_file" ]] && continue
    log "restore saved job: $(basename "$job_file" .json)"
    nomad job run "$job_file"
  done
}

resolve_state_dir() {
  if [[ -n "$STATE_DIR" ]]; then
    printf '%s\n' "$STATE_DIR"
    return 0
  fi

  if [[ -f "$STATE_ROOT/${TARGET_IP}/current-switch.json" ]]; then
    jq -r '.stateDir' "$STATE_ROOT/${TARGET_IP}/current-switch.json"
    return 0
  fi

  latest_state_dir "$TARGET_IP"
}

main() {
  ensure_requirements
  require_command nomad
  if [[ -n "$IDLE_SSH_PASSWORD" ]]; then
    require_command sshpass
  fi

  export IDLE_SSH_PASSWORD

  local state_dir
  state_dir="$(resolve_state_dir)"
  if [[ -z "$state_dir" || ! -d "$state_dir" ]]; then
    echo "State directory not found for target: $TARGET_IP" >&2
    exit 1
  fi

  log "disable idle upstream on nginx"
  run_remote "$NGINX_CONTROL_TARGET" \
    "sudo NGINX_IDLE_INCLUDE_PATH='$NGINX_IDLE_INCLUDE_PATH' NGINX_UPSTREAM_NAME='$NGINX_UPSTREAM_NAME' '$UPSTREAM_WRITER' disable"

  log "stop idle Carbonet job if present"
  nomad job stop -purge -yes "$IDLE_JOB_NAME" >/dev/null 2>&1 || true

  restore_jobs "$state_dir"

  rm -f "$STATE_ROOT/${TARGET_IP}/current-switch.json"

  log "restore completed: $state_dir"
  cat "$state_dir/manifest.json"
}

main "$@"
