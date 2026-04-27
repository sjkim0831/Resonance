#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "Usage: $0 <prompt-file> <worktree-dir> [output-file]"
  echo
  echo "Environment:"
  echo "  CODEX_BIN     Optional codex binary path"
  echo "  CODEX_MODEL   Optional codex model override"
}

if [ "${1:-}" = "" ] || [ "${2:-}" = "" ] || [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 1
fi

PROMPT_FILE="$1"
WORKTREE_DIR="$2"
OUTPUT_FILE="${3:-}"
CODEX_BIN="${CODEX_BIN:-codex}"

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Prompt file not found: $PROMPT_FILE" >&2
  exit 2
fi

if [ ! -d "$WORKTREE_DIR" ]; then
  echo "Worktree directory not found: $WORKTREE_DIR" >&2
  exit 3
fi

if ! command -v "$CODEX_BIN" >/dev/null 2>&1; then
  echo "Codex CLI not found: $CODEX_BIN" >&2
  exit 4
fi

if ! "$CODEX_BIN" login status >/dev/null 2>&1; then
  echo "Codex CLI is not logged in. Run 'codex login' first." >&2
  exit 5
fi

cmd=("$CODEX_BIN" exec --skip-git-repo-check --sandbox read-only -C "$WORKTREE_DIR")

if [ -n "${CODEX_MODEL:-}" ]; then
  cmd+=(--model "$CODEX_MODEL")
fi

if [ -n "$OUTPUT_FILE" ]; then
  mkdir -p "$(dirname "$OUTPUT_FILE")"
  cmd+=(--output-last-message "$OUTPUT_FILE")
fi

cat "$PROMPT_FILE" | "${cmd[@]}" -
