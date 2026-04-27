#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="switch-idle-node-to-carbonet"
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/idle-node-common.sh"

PRESSURE_CHECK_SCRIPT="${PRESSURE_CHECK_SCRIPT:-$ROOT_DIR/ops/scripts/check-runtime-pressure.sh}"
SAVE_STATE_SCRIPT="${SAVE_STATE_SCRIPT:-$ROOT_DIR/ops/scripts/save-idle-node-state.sh}"
JOB_RENDER_SCRIPT="${JOB_RENDER_SCRIPT:-$ROOT_DIR/ops/scripts/render-idle-nomad-job.sh}"

TARGET_IP="${TARGET_IP:-34.82.132.175}"
IDLE_TARGET="${IDLE_TARGET:-sjkim08314@34.82.132.175}"
IDLE_HTTP_HOST="${IDLE_HTTP_HOST:-$TARGET_IP}"
IDLE_PORT="${IDLE_PORT:-18000}"
IDLE_SSH_PASSWORD="${IDLE_SSH_PASSWORD:-}"
STATE_NAME="${STATE_NAME:-switch-$(date '+%Y%m%d-%H%M%S')}"

MAIN_TARGET="${MAIN_TARGET:-carbonet2026@136.117.100.221}"
MAIN_PRESSURE_REQUIRED="${MAIN_PRESSURE_REQUIRED:-false}"
SOURCE_JAR_PATH="${SOURCE_JAR_PATH:-$ROOT_DIR/apps/carbonet-app/target/carbonet.jar}"
IDLE_REMOTE_ROOT="${IDLE_REMOTE_ROOT:-/opt/Resonance}"
IDLE_REMOTE_JOB_FILE="${IDLE_REMOTE_JOB_FILE:-/tmp/carbonet-idle.nomad.hcl}"

NGINX_CONTROL_TARGET="${NGINX_CONTROL_TARGET:-$MAIN_TARGET}"
NGINX_IDLE_INCLUDE_PATH="${NGINX_IDLE_INCLUDE_PATH:-/etc/nginx/carbonet/carbonet-idle-upstream.inc}"
NGINX_UPSTREAM_NAME="${NGINX_UPSTREAM_NAME:-carbonet_app}"
UPSTREAM_WRITER="${UPSTREAM_WRITER:-/opt/Resonance/ops/scripts/write-idle-upstream.sh}"

wait_for_health() {
  local attempt
  for attempt in $(seq 1 24); do
    if run_remote "$IDLE_TARGET" "curl -fsS 'http://127.0.0.1:${IDLE_PORT}/actuator/health'" >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  return 1
}

require_scale_trigger() {
  if [[ "$MAIN_PRESSURE_REQUIRED" != "true" ]]; then
    return 0
  fi

  local report
  report="$("$PRESSURE_CHECK_SCRIPT" "$MAIN_TARGET")"
  printf '%s\n' "$report"
  local severity
  severity="$(printf '%s\n' "$report" | sed -n 's/.*severity=\([^ ]*\).*/\1/p' | tail -n 1)"
  case "$severity" in
    warning|critical) return 0 ;;
    *)
      echo "main runtime pressure does not require scale-out: ${severity:-unknown}" >&2
      return 1
      ;;
  esac
}

stop_saved_jobs() {
  local jobs_file="$1"
  if [[ ! -s "$jobs_file" ]]; then
    return 0
  fi

  local job_id=""
  while IFS= read -r job_id; do
    [[ -z "$job_id" ]] && continue
    log "stop saved job: $job_id"
    nomad job stop -purge -yes "$job_id"
  done <"$jobs_file"
}

main() {
  ensure_requirements
  require_command nomad
  require_command "$SAVE_STATE_SCRIPT"
  require_command "$JOB_RENDER_SCRIPT"
  if [[ -n "$IDLE_SSH_PASSWORD" ]]; then
    require_command sshpass
  fi

  if [[ ! -f "$SOURCE_JAR_PATH" ]]; then
    echo "Source jar not found: $SOURCE_JAR_PATH" >&2
    exit 1
  fi

  export IDLE_SSH_PASSWORD
  require_scale_trigger

  TARGET_IP="$TARGET_IP" STATE_NAME="$STATE_NAME" "$SAVE_STATE_SCRIPT" >/dev/null
  local state_dir
  state_dir="$(latest_state_dir "$TARGET_IP")"
  if [[ -z "$state_dir" ]]; then
    echo "Saved state directory not found" >&2
    exit 1
  fi

  stop_saved_jobs "$state_dir/job_ids.txt"

  log "stop existing idle Carbonet job if present"
  nomad job stop -purge -yes "$IDLE_JOB_NAME" >/dev/null 2>&1 || true

  log "upload jar to idle node"
  run_remote "$IDLE_TARGET" "mkdir -p '$IDLE_REMOTE_ROOT/apps/carbonet-app/target' '$IDLE_REMOTE_ROOT/var/logs'"
  copy_remote "$SOURCE_JAR_PATH" "${IDLE_TARGET}:${IDLE_REMOTE_ROOT}/apps/carbonet-app/target/carbonet.jar"

  log "render and upload Nomad job"
  local tmp_job
  tmp_job="$(mktemp)"
  TARGET_HOST="$IDLE_HTTP_HOST" REPO_ROOT="$IDLE_REMOTE_ROOT" JAR_PATH="$IDLE_REMOTE_ROOT/apps/carbonet-app/target/carbonet.jar" TARGET_PORT="$IDLE_PORT" JOB_NAME="$IDLE_JOB_NAME" \
    "$JOB_RENDER_SCRIPT" >"$tmp_job"
  copy_remote "$tmp_job" "${IDLE_TARGET}:${IDLE_REMOTE_JOB_FILE}"
  rm -f "$tmp_job"

  log "run idle Carbonet job"
  run_remote "$IDLE_TARGET" "nomad job run '$IDLE_REMOTE_JOB_FILE'"

  log "wait for idle health"
  if ! wait_for_health; then
    echo "Idle Carbonet health check failed" >&2
    exit 1
  fi

  log "enable idle upstream on nginx"
  run_remote "$NGINX_CONTROL_TARGET" \
    "sudo NGINX_IDLE_INCLUDE_PATH='$NGINX_IDLE_INCLUDE_PATH' NGINX_UPSTREAM_NAME='$NGINX_UPSTREAM_NAME' '$UPSTREAM_WRITER' enable '$IDLE_HTTP_HOST' '$IDLE_PORT'"

  jq -n \
    --arg state_dir "$state_dir" \
    --arg target_ip "$TARGET_IP" \
    --arg idle_target "$IDLE_TARGET" \
    --arg idle_job "$IDLE_JOB_NAME" \
    --arg switched_at "$(date '+%Y-%m-%d %H:%M:%S %Z')" \
    '{
      stateDir: $state_dir,
      targetIp: $target_ip,
      idleTarget: $idle_target,
      idleJobName: $idle_job,
      switchedAt: $switched_at
    }' >"$STATE_ROOT/${TARGET_IP}/current-switch.json"

  log "switch completed: $TARGET_IP"
  cat "$STATE_ROOT/${TARGET_IP}/current-switch.json"
}

main "$@"
