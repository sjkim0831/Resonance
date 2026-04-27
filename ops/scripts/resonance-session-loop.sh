#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: resonance-session-loop.sh <session-number|tmux-session> [interval-seconds]

Examples:
  resonance-session-loop.sh 02
  resonance-session-loop.sh 04 60
  resonance-session-loop.sh 08 60
  resonance-session-loop.sh res-02-proposal 30

Environment:
  LOOP_PROMPT        Override the prompt sent into the loop command.
  LOOP_COMMAND       Override the full command sent into the loop command.
  LOOP_WORKDIR       Working directory for a newly created tmux session.
  LOOP_WINDOW        Target window index or name. Default: 0
  LOOP_MODE          auto|rerun. Default: auto
  LOOP_TRANSPORT     auto|tmux|direct. Default: auto
  LOOP_LOG_FILE      Optional log file path.
  TMUX_SOCKET        Optional tmux socket path for isolated loop control.
  DEPLOY_RELEASE_UNIT_ID   Optional deploy evidence field for lane 08.
  DEPLOY_RUNTIME_PACKAGE_ID Optional deploy evidence field for lane 08.
  DEPLOY_TRACE_ID          Optional deploy evidence field for lane 08.
  DEPLOY_OWNER_LANE        Optional deploy evidence field for lane 08.
Default numeric prompt:
  docs/ai/80-skills/resonance-10-session-assignment.md N번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘
EOF
}

if [ "${1:-}" = "" ] || [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 1
fi

SESSION_INPUT="$1"
INTERVAL_SECONDS="${2:-60}"
WINDOW_TARGET="${LOOP_WINDOW:-0}"
WORKDIR="${LOOP_WORKDIR:-/opt/Resonance}"
LOOP_MODE="${LOOP_MODE:-auto}"
LOOP_TRANSPORT="${LOOP_TRANSPORT:-auto}"
LOG_FILE="${LOOP_LOG_FILE:-}"
TMUX_SOCKET="${TMUX_SOCKET:-}"
LOCK_ROOT="${LOOP_LOCK_ROOT:-/tmp/resonance-session-loop-locks}"
DEPLOY_RELEASE_UNIT_ID="${DEPLOY_RELEASE_UNIT_ID:-}"
DEPLOY_RUNTIME_PACKAGE_ID="${DEPLOY_RUNTIME_PACKAGE_ID:-}"
DEPLOY_TRACE_ID="${DEPLOY_TRACE_ID:-}"
DEPLOY_OWNER_LANE="${DEPLOY_OWNER_LANE:-}"
LOCK_DIR=""
LOCK_OWNER=0

tmux_cmd() {
  if [ -n "$TMUX_SOCKET" ]; then
    tmux -S "$TMUX_SOCKET" "$@"
  else
    tmux "$@"
  fi
}

resolve_session_name() {
  case "$1" in
    1|01) echo "res-01-contract" ;;
    2|02) echo "res-02-proposal" ;;
    3|03) echo "res-03-theme" ;;
    4|04) echo "res-04-builder" ;;
    5|05) echo "res-05-frontend" ;;
    6|06) echo "res-06-backend" ;;
    7|07) echo "res-07-db" ;;
    8|08) echo "res-08-deploy" ;;
    9|09) echo "res-09-verify" ;;
    10) echo "res-10-module" ;;
    *) echo "$1" ;;
  esac
}

resolve_default_prompt() {
  case "$1" in
    [0-9]|[0-9][0-9])
      local lane
      lane=$((10#$1))
      echo "docs/ai/80-skills/resonance-10-session-assignment.md ${lane}번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘"
      ;;
    *)
      echo "재실행 혹은 이어서 해줘"
      ;;
  esac
}

sanitize_name() {
  printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '_'
}

shell_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

build_default_command() {
  printf "codex exec --skip-git-repo-check -C %s -- %s" \
    "$(shell_quote "$WORKDIR")" \
    "$(shell_quote "$PROMPT")"
}

refresh_lock() {
  if [ -n "${LOCK_DIR:-}" ] && [ -d "$LOCK_DIR" ]; then
    printf '%s\n' "$$" > "${LOCK_DIR}/pid"
    printf '%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" > "${LOCK_DIR}/heartbeat"
  fi
}

release_lock() {
  if [ "${LOCK_OWNER:-0}" -eq 1 ] && [ -n "${LOCK_DIR:-}" ] && [ -d "$LOCK_DIR" ]; then
    rm -rf "$LOCK_DIR"
  fi
}

SESSION_NAME="$(resolve_session_name "$SESSION_INPUT")"
DEFAULT_PROMPT="$(resolve_default_prompt "$SESSION_INPUT")"
LOCK_DIR="${LOCK_ROOT}/$(sanitize_name "$SESSION_NAME")"

PROMPT="${LOOP_PROMPT:-$DEFAULT_PROMPT}"
COMMAND="${LOOP_COMMAND:-}"

if ! [[ "$INTERVAL_SECONDS" =~ ^[0-9]+$ ]] || [ "$INTERVAL_SECONDS" -le 0 ]; then
  echo "Interval must be a positive integer: $INTERVAL_SECONDS" >&2
  exit 2
fi

if [ "$LOOP_TRANSPORT" = "tmux" ] && ! command -v tmux >/dev/null 2>&1; then
  echo "tmux not found in PATH." >&2
  exit 3
fi

if [ "$LOOP_MODE" != "auto" ] && [ "$LOOP_MODE" != "rerun" ]; then
  echo "LOOP_MODE must be auto or rerun: $LOOP_MODE" >&2
  exit 4
fi

if [ "$LOOP_TRANSPORT" != "auto" ] && [ "$LOOP_TRANSPORT" != "tmux" ] && [ "$LOOP_TRANSPORT" != "direct" ]; then
  echo "LOOP_TRANSPORT must be auto, tmux, or direct: $LOOP_TRANSPORT" >&2
  exit 6
fi

mkdir -p "$LOCK_ROOT"
if mkdir "$LOCK_DIR" 2>/dev/null; then
  printf '%s\n' "$$" > "${LOCK_DIR}/pid"
  LOCK_OWNER=1
  trap release_lock EXIT INT TERM
elif [ -f "${LOCK_DIR}/pid" ] && kill -0 "$(cat "${LOCK_DIR}/pid")" 2>/dev/null; then
  echo "loop already running for ${SESSION_NAME} (pid $(cat "${LOCK_DIR}/pid"))" >&2
  exit 7
else
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
  printf '%s\n' "$$" > "${LOCK_DIR}/pid"
  LOCK_OWNER=1
  trap release_lock EXIT INT TERM
fi

log_line() {
  local line
  line="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$line"
  if [ -n "$LOG_FILE" ]; then
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "$line" >> "$LOG_FILE"
  fi
}

write_deploy_evidence() {
  if [ "$SESSION_NAME" != "res-08-deploy" ]; then
    return 0
  fi

  local evidence_file
  evidence_file="${LOCK_DIR}/deploy-evidence.env"

  {
    printf 'releaseUnitId=%s\n' "${DEPLOY_RELEASE_UNIT_ID}"
    printf 'runtimePackageId=%s\n' "${DEPLOY_RUNTIME_PACKAGE_ID}"
    printf 'deployTraceId=%s\n' "${DEPLOY_TRACE_ID}"
    printf 'ownerLane=%s\n' "${DEPLOY_OWNER_LANE:-res-08-deploy}"
    printf 'sessionName=%s\n' "${SESSION_NAME}"
    printf 'prompt=%s\n' "${PROMPT}"
    printf 'updatedAt=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  } > "$evidence_file"
}

ensure_session() {
  if ! tmux_cmd has-session -t "$SESSION_NAME" 2>/dev/null; then
    tmux_cmd new-session -d -s "$SESSION_NAME" -c "$WORKDIR"
    log_line "created tmux session $SESSION_NAME at $WORKDIR"
  fi
}

ensure_target() {
  if ! tmux_cmd list-panes -t "${SESSION_NAME}:${WINDOW_TARGET}" >/dev/null 2>&1; then
    echo "tmux target not found: ${SESSION_NAME}:${WINDOW_TARGET}" >&2
    exit 5
  fi
}

pane_command() {
  tmux_cmd display-message -p -t "${SESSION_NAME}:${WINDOW_TARGET}" '#{pane_current_command}'
}

pane_idle() {
  case "$(pane_command)" in
    bash|zsh|sh|fish) return 0 ;;
    *) return 1 ;;
  esac
}

send_prompt() {
  refresh_lock

  if [ "$LOOP_MODE" = "rerun" ]; then
    tmux_cmd send-keys -t "${SESSION_NAME}:${WINDOW_TARGET}" C-c
  elif ! pane_idle; then
    log_line "pane busy on ${SESSION_NAME}:${WINDOW_TARGET}; current command=$(pane_command); continuing current run"
    return 0
  fi

  if [ -z "$COMMAND" ]; then
    COMMAND="$(build_default_command)"
  fi

  tmux_cmd send-keys -t "${SESSION_NAME}:${WINDOW_TARGET}" "$COMMAND" C-m
  write_deploy_evidence
  log_line "sent command to ${SESSION_NAME}:${WINDOW_TARGET}: $COMMAND"
}

resolve_transport() {
  if [ "$LOOP_TRANSPORT" = "tmux" ] || [ "$LOOP_TRANSPORT" = "direct" ]; then
    echo "$LOOP_TRANSPORT"
    return 0
  fi

  if command -v tmux >/dev/null 2>&1 && tmux_cmd start-server >/dev/null 2>&1; then
    echo "tmux"
  else
    echo "direct"
  fi
}

run_direct() {
  local direct_command

  refresh_lock

  if [ -n "$COMMAND" ]; then
    direct_command="$COMMAND"
  else
    direct_command="$(build_default_command)"
  fi

  log_line "running direct loop command: $direct_command"
  (
    cd "$WORKDIR"
    bash -lc "$direct_command"
  )
}

TRANSPORT="$(resolve_transport)"

log_line "starting loop for $SESSION_NAME every ${INTERVAL_SECONDS}s via ${TRANSPORT}"

while true; do
  if [ "$TRANSPORT" = "tmux" ]; then
    if ! ensure_session || ! ensure_target || ! send_prompt; then
      loop_status=$?
      log_line "loop iteration failed for ${SESSION_NAME} via tmux; exit=${loop_status}; retrying after ${INTERVAL_SECONDS}s"
    fi
  else
    if ! run_direct; then
      loop_status=$?
      log_line "loop iteration failed for ${SESSION_NAME} via direct; exit=${loop_status}; retrying after ${INTERVAL_SECONDS}s"
    fi
  fi
  sleep "$INTERVAL_SECONDS"
done
