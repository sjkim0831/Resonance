#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_ID="${RUN_ID:-$(date +%Y%m%d-%H%M%S)}"
SESSION_NAME="${SESSION_NAME:-res-refactor-${RUN_ID}}"
WORKDIR="${WORKDIR:-$ROOT_DIR}"
BASE_DIR="${BASE_DIR:-/tmp/opencode-fanout/${RUN_ID}}"
PROMPT_FILE="${PROMPT_FILE:-$BASE_DIR/refactor-prompt.txt}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [launch|status|collect]

Environment:
  RUN_ID         Stable run identifier. Default: current timestamp
  SESSION_NAME   tmux session name. Default: res-refactor-\$RUN_ID
  WORKDIR        Project root passed to opencode. Default: repo root
  BASE_DIR       Scratch directory for configs, data, and outputs
  PROMPT_FILE    Optional prompt file path. Default: \$BASE_DIR/refactor-prompt.txt

Examples:
  $(basename "$0") launch
  RUN_ID=demo-01 $(basename "$0") status
  RUN_ID=demo-01 $(basename "$0") collect
EOF
}

ensure_tmux() {
  if ! command -v tmux >/dev/null 2>&1; then
    echo "tmux not found in PATH." >&2
    exit 1
  fi
}

ensure_opencode() {
  if ! command -v opencode >/dev/null 2>&1; then
    echo "opencode not found in PATH." >&2
    exit 1
  fi
}

ensure_base() {
  mkdir -p "$BASE_DIR"
  mkdir -p "$BASE_DIR/config/opencode"
  mkdir -p "$BASE_DIR/results"
  mkdir -p "$BASE_DIR/logs"
}

write_config() {
  cat > "$BASE_DIR/config/opencode/opencode.json" <<'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "model": "ollama/minimax-m2.7:cloud",
  "provider": {
    "ollama": {
      "name": "Ollama",
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "http://127.0.0.1:11434/v1"
      },
      "models": {
        "minimax-m2.7:cloud": {
          "name": "minimax-m2.7:cloud",
          "limit": {
            "context": 204800,
            "output": 128000
          }
        },
        "qwen3.5:cloud": {
          "name": "qwen3.5:cloud",
          "limit": {
            "context": 131072,
            "output": 65536
          }
        },
        "qwen2.5-coder:7b": {
          "name": "qwen2.5-coder:7b",
          "limit": {
            "context": 32768,
            "output": 8192
          }
        }
      }
    }
  }
}
EOF
}

write_prompt() {
  if [ -f "$PROMPT_FILE" ]; then
    return 0
  fi

  cat > "$PROMPT_FILE" <<'EOF'
You are doing refactor analysis only for the Carbonet repository.

Rules:
- Do not edit files.
- Do not run git write commands.
- Read only the allowed paths assigned below.
- Return concise findings with exact file paths.
- Focus on duplication, oversized files, dead abstractions, contract drift, and extraction candidates.
- End with a short "Top 3 next edits" section.

Output format:
1. Summary
2. Findings
3. Top 3 next edits
EOF
}

lane_prompt() {
  local lane="$1"
  case "$lane" in
    frontend)
      cat <<'EOF'
Lane: frontend
Allowed paths:
- frontend/src/app
- frontend/src/features
- frontend/src/components
- frontend/src/lib
- frontend/src/platform
- frontend/src/framework

Task:
Analyze frontend refactor opportunities. Prioritize shared component extraction, route registry cleanup, API client deduplication, and overgrown migration pages.
EOF
      ;;
    backend)
      cat <<'EOF'
Lane: backend
Allowed paths:
- src/main/java
- src/main/resources/egovframework/mapper
- src/main/resources/application.yml
- src/main/resources/framework/contracts

Task:
Analyze backend refactor opportunities. Prioritize service and mapper duplication, oversized VO/DTO families, controller-service boundary drift, and resource/config ownership cleanup.
EOF
      ;;
    opsdocs)
      cat <<'EOF'
Lane: opsdocs
Allowed paths:
- ops/scripts
- docs/ai
- docs/architecture
- docs/operations
- README.md
- STRUCTURE.md
- PROJECT_PATHS.md

Task:
Analyze ops and docs refactor opportunities. Prioritize duplicate scripts, overlapping governance docs, naming inconsistency, and places where a shared helper or consolidated guide would reduce drift.
EOF
      ;;
    *)
      echo "Unknown lane: $lane" >&2
      return 1
      ;;
  esac
}

launch_lane() {
  local lane="$1"
  local model="$2"
  local window="$3"
  local lane_dir="$BASE_DIR/$lane"
  local result_file="$BASE_DIR/results/${lane}.jsonl"
  local log_file="$BASE_DIR/logs/${lane}.log"
  local prompt_tmp="$lane_dir/prompt.txt"
  local cmd_file="$lane_dir/run.sh"

  mkdir -p "$lane_dir/data" "$lane_dir"
  {
    cat "$PROMPT_FILE"
    printf '\n'
    lane_prompt "$lane"
  } > "$prompt_tmp"

  cat > "$cmd_file" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd $(printf '%q' "$WORKDIR")
env XDG_DATA_HOME=$(printf '%q' "$lane_dir/data") XDG_CONFIG_HOME=$(printf '%q' "$BASE_DIR/config") \\
  opencode run -m ollama/${model} --dir $(printf '%q' "$WORKDIR") --format json "\$(cat $(printf '%q' "$prompt_tmp"))" \\
  | tee $(printf '%q' "$result_file")
EOF
  chmod +x "$cmd_file"

  if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    tmux new-session -d -s "$SESSION_NAME" -n "$window" -c "$WORKDIR"
  else
    tmux new-window -t "$SESSION_NAME" -n "$window" -c "$WORKDIR"
  fi

  tmux send-keys -t "${SESSION_NAME}:${window}" "bash $(printf '%q' "$cmd_file") 2>&1 | tee $(printf '%q' "$log_file")" C-m
}

launch() {
  ensure_tmux
  ensure_opencode
  ensure_base
  write_config
  write_prompt

  launch_lane "frontend" "qwen3.5:cloud" "frontend"
  launch_lane "backend" "minimax-m2.7:cloud" "backend"
  launch_lane "opsdocs" "qwen2.5-coder:7b" "opsdocs"

  cat <<EOF
run_id=$RUN_ID
session_name=$SESSION_NAME
base_dir=$BASE_DIR
status_hint=tmux attach -t $SESSION_NAME
collect_hint=RUN_ID=$RUN_ID $(basename "$0") collect
EOF
}

status() {
  ensure_tmux
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    tmux list-windows -t "$SESSION_NAME"
  else
    echo "tmux session not found: $SESSION_NAME" >&2
    exit 1
  fi
}

collect() {
  local lane
  for lane in frontend backend opsdocs; do
    local result_file="$BASE_DIR/results/${lane}.jsonl"
    echo "=== ${lane} ==="
    if [ -f "$result_file" ]; then
      sed -n '1,200p' "$result_file"
    else
      echo "missing result: $result_file"
    fi
    echo
  done
}

main() {
  local action="${1:-launch}"
  case "$action" in
    launch) launch ;;
    status) status ;;
    collect) collect ;;
    -h|--help|help) usage ;;
    *)
      echo "Unknown action: $action" >&2
      usage
      exit 1
      ;;
  esac
}

main "${1:-launch}"
