#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PRESSURE_CHECK_SCRIPT="${PRESSURE_CHECK_SCRIPT:-$ROOT_DIR/ops/scripts/check-runtime-pressure.sh}"
NOMAD_RENDER_SCRIPT="${NOMAD_RENDER_SCRIPT:-$ROOT_DIR/ops/scripts/render-idle-nomad-job.sh}"

MAIN_TARGET="${MAIN_TARGET:-carbonet2026@136.117.100.221}"
MAIN_HTTP_HOST="${MAIN_HTTP_HOST:-136.117.100.221}"
MAIN_PORT="${MAIN_PORT:-18000}"
SOURCE_JAR_PATH="${SOURCE_JAR_PATH:-$ROOT_DIR/apps/carbonet-app/target/carbonet.jar}"

IDLE_TARGET="${IDLE_TARGET:-sjkim08314@34.82.132.175}"
IDLE_HTTP_HOST="${IDLE_HTTP_HOST:-34.82.132.175}"
IDLE_PORT="${IDLE_PORT:-18000}"
IDLE_SSH_PASSWORD="${IDLE_SSH_PASSWORD:-}"

MAIN_REMOTE_ROOT="${MAIN_REMOTE_ROOT:-/opt/Resonance}"
IDLE_REMOTE_ROOT="${IDLE_REMOTE_ROOT:-/opt/Resonance}"
IDLE_JOB_NAME="${IDLE_JOB_NAME:-carbonet-idle}"
IDLE_JOB_FILE="${IDLE_JOB_FILE:-/tmp/carbonet-idle.nomad.hcl}"
IDLE_HEALTH_URL="${IDLE_HEALTH_URL:-http://${IDLE_HTTP_HOST}:${IDLE_PORT}/actuator/health}"

NGINX_CONTROL_TARGET="${NGINX_CONTROL_TARGET:-$MAIN_TARGET}"
NGINX_IDLE_INCLUDE_PATH="${NGINX_IDLE_INCLUDE_PATH:-/etc/nginx/carbonet/carbonet-idle-upstream.inc}"
NGINX_UPSTREAM_NAME="${NGINX_UPSTREAM_NAME:-carbonet_app}"
UPSTREAM_WRITER="${UPSTREAM_WRITER:-$MAIN_REMOTE_ROOT/ops/scripts/write-idle-upstream.sh}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)
SCP_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)

log() {
  printf '[scale-out-idle-runtime] %s\n' "$*"
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

run_remote() {
  local target="$1"
  shift
  ssh "${SSH_OPTS[@]}" "$target" "$@"
}

copy_remote() {
  scp "${SCP_OPTS[@]}" "$@"
}

extract_severity() {
  sed -n 's/.*severity=\([^ ]*\).*/\1/p'
}

main_pressure_report() {
  SSH_PASSWORD="${MAIN_SSH_PASSWORD:-}" "$PRESSURE_CHECK_SCRIPT" "$MAIN_TARGET"
}

require_pressure() {
  local report
  report="$(main_pressure_report)"
  printf '%s\n' "$report"

  local severity
  severity="$(printf '%s\n' "$report" | extract_severity | tail -n 1)"
  case "$severity" in
    warning|critical) return 0 ;;
    healthy)
      log "main runtime is healthy; scale-out skipped"
      return 1
      ;;
    *)
      echo "Could not determine pressure severity" >&2
      return 1
      ;;
  esac
}

copy_idle_jar() {
  local idle_target_jar="${IDLE_TARGET}:${IDLE_REMOTE_ROOT}/apps/carbonet-app/target/carbonet.jar"

  if [[ ! -f "$SOURCE_JAR_PATH" ]]; then
    echo "Source jar not found: $SOURCE_JAR_PATH" >&2
    exit 1
  fi

  log "upload local jar to ${IDLE_TARGET}"
  run_remote "$IDLE_TARGET" "mkdir -p '$IDLE_REMOTE_ROOT/apps/carbonet-app/target' '$IDLE_REMOTE_ROOT/var/logs'"
  copy_remote "$SOURCE_JAR_PATH" "$idle_target_jar"
}

render_and_run_nomad_job() {
  local tmp_job
  tmp_job="$(mktemp)"
  TARGET_HOST="$IDLE_HTTP_HOST" REPO_ROOT="$IDLE_REMOTE_ROOT" JAR_PATH="$IDLE_REMOTE_ROOT/apps/carbonet-app/target/carbonet.jar" TARGET_PORT="$IDLE_PORT" JOB_NAME="$IDLE_JOB_NAME" \
    "$NOMAD_RENDER_SCRIPT" >"$tmp_job"

  log "upload Nomad job file to ${IDLE_TARGET}"
  copy_remote "$tmp_job" "${IDLE_TARGET}:${IDLE_JOB_FILE}"
  rm -f "$tmp_job"

  log "run Nomad job on ${IDLE_TARGET}"
  run_remote "$IDLE_TARGET" "nomad job run '$IDLE_JOB_FILE'"
}

wait_for_idle_health() {
  local attempt
  for attempt in $(seq 1 20); do
    if run_remote "$IDLE_TARGET" "curl -fsS '$IDLE_HEALTH_URL'" >/dev/null 2>&1; then
      log "idle health is up: $IDLE_HEALTH_URL"
      return 0
    fi
    sleep 5
  done

  echo "Idle health check failed: $IDLE_HEALTH_URL" >&2
  return 1
}

enable_idle_upstream() {
  log "enable idle upstream in nginx"
  run_remote "$NGINX_CONTROL_TARGET" \
    "sudo NGINX_IDLE_INCLUDE_PATH='$NGINX_IDLE_INCLUDE_PATH' NGINX_UPSTREAM_NAME='$NGINX_UPSTREAM_NAME' '$UPSTREAM_WRITER' enable '$IDLE_HTTP_HOST' '$IDLE_PORT'"
}

verify_nginx_path() {
  local url="http://127.0.0.1/"
  run_remote "$NGINX_CONTROL_TARGET" "curl -sI '$url' | head -n 1"
}

main() {
  require_command ssh
  require_command scp
  require_command curl
  if [[ -n "$IDLE_SSH_PASSWORD" ]]; then
    require_command sshpass
  fi

  export IDLE_SSH_PASSWORD
  if ! require_pressure; then
    exit 0
  fi

  copy_idle_jar
  render_and_run_nomad_job
  wait_for_idle_health
  enable_idle_upstream
  verify_nginx_path

  log "scale-out completed"
}

main "$@"
