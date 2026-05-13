#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MODEL="${CARBONET_AI_OLLAMA_MODEL:-qwen3:0.6b}"
HOST="${CARBONET_AI_OLLAMA_HOST:-0.0.0.0}"
CHECK_HOST="${CARBONET_AI_OLLAMA_CHECK_HOST:-127.0.0.1}"
PORT="${CARBONET_AI_OLLAMA_PORT:-11434}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/var/logs}"
RUN_DIR="${RUN_DIR:-$ROOT_DIR/var/run}"
LOG_FILE="$LOG_DIR/ollama-${PORT}.log"
PID_FILE="$RUN_DIR/ollama-${PORT}.pid"

mkdir -p "$LOG_DIR" "$RUN_DIR"

if ! command -v ollama >/dev/null 2>&1; then
  echo "[local-ai] ollama command not found; AI recommendations will stay disabled" >&2
  exit 0
fi

if curl -fsS --max-time 2 "http://$CHECK_HOST:$PORT/api/tags" >/dev/null 2>&1; then
  echo "[local-ai] ollama already listening on $CHECK_HOST:$PORT"
else
  echo "[local-ai] starting ollama on $HOST:$PORT"
  OLLAMA_HOST="$HOST:$PORT" nohup ollama serve >"$LOG_FILE" 2>&1 &
  echo "$!" >"$PID_FILE"
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 2 "http://$CHECK_HOST:$PORT/api/tags" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if ! curl -fsS --max-time 2 "http://$CHECK_HOST:$PORT/api/tags" >/dev/null 2>&1; then
  echo "[local-ai] ollama health check failed; see $LOG_FILE" >&2
  exit 0
fi

if ollama list | awk 'NR > 1 { print $1 }' | grep -Fxq "$MODEL"; then
  echo "[local-ai] model ready: $MODEL"
elif [[ "${CARBONET_AI_OLLAMA_PULL:-false}" == "true" ]]; then
  echo "[local-ai] pulling model: $MODEL"
  ollama pull "$MODEL"
else
  echo "[local-ai] model not installed: $MODEL (set CARBONET_AI_OLLAMA_PULL=true to pull automatically)" >&2
fi
