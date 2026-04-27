#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/stop-18000.sh

Purpose:
  Stop the local :18000 runtime and clean up the runtime pid file.

Related start path:
  bash ops/scripts/start-18000.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-18000}"
RUN_DIR="${RUN_DIR:-$ROOT_DIR/var/run}"
CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/ops/config}"
PID_FILE="$RUN_DIR/carbonet-${PORT}.pid"
TMUX_SESSION_NAME="${TMUX_SESSION_NAME:-carbonet${PORT}}"
JAR_PATH="$RUN_DIR/carbonet-${PORT}.jar"

load_optional_env() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    # shellcheck disable=SC1090
    set -a
    source "$env_file"
    set +a
  fi
}

is_truthy() {
  case "${1:-}" in
    1|Y|y|YES|yes|TRUE|true|ON|on) return 0 ;;
    *) return 1 ;;
  esac
}

purge_remote_cas_if_requested() {
  if ! is_truthy "${REMOTE_CUBRID_CONNECTION_PURGE_ON_STOP:-false}"; then
    return 0
  fi

  local remote_user="${REMOTE_CUBRID_SSH_USER:-}"
  local remote_host="${REMOTE_CUBRID_SSH_HOST:-${CUBRID_HOST:-}}"
  local remote_port="${REMOTE_CUBRID_SSH_PORT:-22}"
  local remote_password="${REMOTE_CUBRID_SSH_PASSWORD:-}"
  local broker_port="${CUBRID_PORT:-33000}"
  local client_ips="${REMOTE_CUBRID_CLIENT_IPS:-}"

  if [[ -z "$remote_user" || -z "$remote_host" || -z "$client_ips" ]]; then
    echo "[stop-18000] remote CAS purge skipped: ssh target or client IPs are not configured"
    return 0
  fi

  local remote_target="${remote_user}@${remote_host}"
  local remote_cmd='set -e; for ip in '"$client_ips"'; do sudo -n ss -K dst "$ip" dport = '"$broker_port"' >/dev/null 2>&1 || true; done'
  local ssh_cmd=(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p "$remote_port" "$remote_target" "$remote_cmd")

  if [[ -n "$remote_password" ]]; then
    local askpass_script
    askpass_script="$(mktemp)"
    chmod 700 "$askpass_script"
    cat >"$askpass_script" <<EOF
#!/usr/bin/env bash
printf '%s\n' '${remote_password}'
EOF
    if DISPLAY=:0 SSH_ASKPASS="$askpass_script" SSH_ASKPASS_REQUIRE=force setsid "${ssh_cmd[@]}" </dev/null; then
      rm -f "$askpass_script"
      echo "[stop-18000] remote CAS purge completed for: $client_ips"
      return 0
    fi
    rm -f "$askpass_script"
    echo "[stop-18000] remote CAS purge failed for: $client_ips"
    return 0
  fi

  if ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p "$remote_port" "$remote_target" "$remote_cmd"; then
    echo "[stop-18000] remote CAS purge completed for: $client_ips"
    return 0
  fi

  echo "[stop-18000] remote CAS purge failed for: $client_ips"
  return 0
}

find_running_pid_without_pid_file() {
  ps -eo pid=,args= | awk -v jar_path="$JAR_PATH" -v port="--server.port=${PORT}" '
    index($0, jar_path) && index($0, port) {
      print $1;
      exit 0;
    }
  '
}

load_optional_env "$CONFIG_DIR/carbonet-${PORT}.env"
load_optional_env "$CONFIG_DIR/codex-runner.env"

if command -v tmux >/dev/null 2>&1 && tmux has-session -t "$TMUX_SESSION_NAME" 2>/dev/null; then
  tmux kill-session -t "$TMUX_SESSION_NAME" 2>/dev/null || true
fi

if [[ ! -f "$PID_FILE" ]]; then
  APP_PID="$(find_running_pid_without_pid_file || true)"
  if [[ -z "${APP_PID:-}" ]]; then
    echo "[stop-18000] pid file not found: $PID_FILE"
    exit 0
  fi
  echo "[stop-18000] pid file missing; recovered running pid=$APP_PID"
else
  APP_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
fi

if [[ -z "${APP_PID:-}" ]]; then
  rm -f "$PID_FILE"
  echo "[stop-18000] stale pid file removed"
  exit 0
fi

if ! kill -0 "$APP_PID" 2>/dev/null; then
  RECOVERED_PID="$(find_running_pid_without_pid_file || true)"
  if [[ -n "${RECOVERED_PID:-}" ]] && kill -0 "$RECOVERED_PID" 2>/dev/null; then
    APP_PID="$RECOVERED_PID"
    printf '%s\n' "$APP_PID" > "$PID_FILE"
    echo "[stop-18000] recovered running pid from process table: pid=$APP_PID"
  else
    rm -f "$PID_FILE"
    echo "[stop-18000] process already stopped: pid=$APP_PID"
    exit 0
  fi
fi

kill "$APP_PID" 2>/dev/null || true

for _ in $(seq 1 20); do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    purge_remote_cas_if_requested
    echo "[stop-18000] stopped: pid=$APP_PID"
    exit 0
  fi
  sleep 1
done

kill -9 "$APP_PID" 2>/dev/null || true
rm -f "$PID_FILE"
purge_remote_cas_if_requested
echo "[stop-18000] force stopped: pid=$APP_PID"
