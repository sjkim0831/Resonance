#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/start-18000.sh

Purpose:
  Start a local runtime from the canonical app jar and copy it into
  the runtime jar path for the selected port.

Canonical app jar:
  apps/carbonet-app/target/carbonet.jar

Related checks:
  bash ops/scripts/run-large-move-app-closure.sh
  bash ops/scripts/codex-verify-18000-freshness.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/ops/scripts/runtime-url-common.sh"
PORT="${PORT:-18000}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/var/logs}"
RUN_DIR="${RUN_DIR:-$ROOT_DIR/var/run}"
CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/ops/config}"
APP_TARGET_JAR_PATH="$ROOT_DIR/apps/carbonet-app/target/carbonet.jar"
SOURCE_JAR_PATH="${SOURCE_JAR_PATH:-$APP_TARGET_JAR_PATH}"
JAR_PATH="${JAR_PATH:-$RUN_DIR/carbonet-${PORT}.jar}"
PID_FILE="$RUN_DIR/carbonet-${PORT}.pid"
LOG_FILE="$LOG_DIR/carbonet-${PORT}.log"
LOCK_FILE="$RUN_DIR/carbonet-${PORT}.lock"
STARTUP_WAIT_SECONDS="${STARTUP_WAIT_SECONDS:-60}"
START_RETRY_COUNT="${START_RETRY_COUNT:-10}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-5}"
LOG_ROTATE_MAX_BYTES="${LOG_ROTATE_MAX_BYTES:-104857600}"

resolve_running_pid() {
  ps -eo pid=,args= | awk -v jar_path="$JAR_PATH" -v port="--server.port=${PORT}" '
    index($0, jar_path) && index($0, port) {
      print $1;
      exit 0;
    }
  '
}

load_optional_env() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    # shellcheck disable=SC1090
    set -a
    source "$env_file"
    set +a
  fi
}

load_optional_env "$CONFIG_DIR/carbonet-${PORT}.defaults.env"
load_optional_env "$CONFIG_DIR/carbonet-${PORT}.env"
load_optional_env "$CONFIG_DIR/codex-runner.env"
carbonet_set_curl_args

require_env() {
  local env_name="$1"
  if [[ -z "${!env_name:-}" ]]; then
    echo "[start-18000] missing required env: $env_name" >&2
    exit 1
  fi
}

rotate_large_log_if_needed() {
  local file_path="$1"
  local max_bytes="$2"
  local file_size
  local rotated_path

  if [[ ! -f "$file_path" ]]; then
    return 0
  fi

  file_size="$(stat -c %s "$file_path" 2>/dev/null || echo 0)"
  if [[ "${file_size:-0}" -lt "$max_bytes" ]]; then
    return 0
  fi

  rotated_path="${file_path}.bak-$(date '+%Y%m%d-%H%M%S')"
  mv "$file_path" "$rotated_path"
  echo "[start-18000] rotated oversized log: $file_path -> $rotated_path size=$file_size" >&2
}

mkdir -p "$LOG_DIR" "$RUN_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[start-18000] another startup is already in progress: port=$PORT lock=$LOCK_FILE" >&2
  exit 1
fi

rotate_large_log_if_needed "$LOG_FILE" "$LOG_ROTATE_MAX_BYTES"

DB_HOST="${CUBRID_HOST:-127.0.0.1}"
DB_PORT="${CUBRID_PORT:-33000}"
DB_NAME="${CUBRID_DB:-carbonet}"
DB_USER="${CUBRID_USER:-dba}"
DB_PASSWORD="${CUBRID_PASSWORD:-}"
DB_URL="jdbc:cubrid:${DB_HOST}:${DB_PORT}:${DB_NAME}:::?charset=UTF-8"

require_env "TOKEN_ACCESS_SECRET"
require_env "TOKEN_REFRESH_SECRET"

if carbonet_bool_true "${SERVER_SSL_ENABLED:-false}"; then
  require_env "SERVER_SSL_KEY_STORE"
  require_env "SERVER_SSL_KEY_STORE_PASSWORD"
  if [[ ! -f "$SERVER_SSL_KEY_STORE" ]]; then
    echo "[start-18000] missing SSL key store: $SERVER_SSL_KEY_STORE" >&2
    exit 1
  fi
fi

if [[ ! -f "$SOURCE_JAR_PATH" ]]; then
  echo "[start-18000] missing source jar: $SOURCE_JAR_PATH" >&2
  exit 1
fi

cp "$SOURCE_JAR_PATH" "$JAR_PATH"

LOG_START_OFFSET=0
if [[ -f "$LOG_FILE" ]]; then
  LOG_START_OFFSET="$(stat -c %s "$LOG_FILE" 2>/dev/null || echo 0)"
fi

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${EXISTING_PID:-}" ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "[start-18000] already running: pid=$EXISTING_PID port=$PORT"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if ss -ltn "( sport = :$PORT )" 2>/dev/null | grep -q ":$PORT"; then
  EXISTING_PID="$(resolve_running_pid || true)"
  if [[ -n "${EXISTING_PID:-}" ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    printf '%s\n' "$EXISTING_PID" > "$PID_FILE"
    echo "[start-18000] recovered pid file: pid=$EXISTING_PID port=$PORT"
    exit 0
  fi
  echo "[start-18000] port already in use: $PORT" >&2
  exit 1
fi

for attempt in $(seq 1 "$START_RETRY_COUNT"); do
  printf '\n[start-18000] %s attempt=%s/%s db=%s log=%s\n' \
    "$(date '+%Y-%m-%d %H:%M:%S')" "$attempt" "$START_RETRY_COUNT" "$DB_URL" "$LOG_FILE" >>"$LOG_FILE"
  printf '[start-18000] codex enabled=%s runner=%s repo=%s workspace=%s plan=%s build=%s\n' \
    "${SECURITY_CODEX_ENABLED:-false}" \
    "${SECURITY_CODEX_RUNNER_ENABLED:-false}" \
    "${SECURITY_CODEX_RUNNER_REPO_ROOT:-}" \
    "${SECURITY_CODEX_RUNNER_WORKSPACE_ROOT:-/tmp/carbonet-sr-codex-runner}" \
    "$([[ -n "${SECURITY_CODEX_RUNNER_PLAN_COMMAND:-}" ]] && echo configured || echo missing)" \
    "$([[ -n "${SECURITY_CODEX_RUNNER_BUILD_COMMAND:-}" ]] && echo configured || echo missing)" \
    >>"$LOG_FILE"
  setsid bash -c 'exec 9>&-; exec java "$@"' bash \
    -jar "$JAR_PATH" \
    --server.port="$PORT" \
    --spring.datasource.url="$DB_URL" \
    --spring.datasource.username="$DB_USER" \
    --spring.datasource.password="$DB_PASSWORD" \
    >>"$LOG_FILE" 2>&1 </dev/null &

  APP_PID=$!
  echo "$APP_PID" > "$PID_FILE"

  for _ in $(seq 1 "$STARTUP_WAIT_SECONDS"); do
    if ! kill -0 "$APP_PID" 2>/dev/null; then
      break
    fi
    if ss -ltn "( sport = :$PORT )" 2>/dev/null | grep -q ":$PORT"; then
      printf '%s\n' "$APP_PID" > "$PID_FILE"
      echo "[start-18000] started: pid=$APP_PID port=$PORT log=$LOG_FILE"
      exit 0
    fi
    sleep 1
  done

  if ! kill -0 "$APP_PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    if [[ "$attempt" -lt "$START_RETRY_COUNT" ]]; then
      echo "[start-18000] startup attempt ${attempt}/${START_RETRY_COUNT} exited early. retrying in ${RETRY_DELAY_SECONDS}s..." >&2
      sleep "$RETRY_DELAY_SECONDS"
      continue
    fi
    echo "[start-18000] process exited early. recent log:" >&2
    tail -c +"$((LOG_START_OFFSET + 1))" "$LOG_FILE" | tail -n 60 >&2 || true
    exit 1
  fi

  echo "[start-18000] process is running but startup was not confirmed in ${STARTUP_WAIT_SECONDS}s. recent log:" >&2
  tail -c +"$((LOG_START_OFFSET + 1))" "$LOG_FILE" | tail -n 60 >&2 || true
  exit 1
done

exit 1
