#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
TRAINING_ROOT="${TRAINING_ROOT:-/opt/util/ai/fine-tuning/hermes-agent-7b}"
DOC_DIR="$TRAINING_ROOT/data/version-docs"
VERSION_FILE="$TRAINING_ROOT/data/tool_versions.json"
EVENT_LOG="$ROOT_DIR/var/ai-runtime/self-evolving-events.jsonl"
mkdir -p "$DOC_DIR" "$(dirname "$EVENT_LOG")"

version_of() {
  local bin="$1"
  if command -v "$bin" >/dev/null 2>&1; then
    "$bin" --version 2>&1 | head -1
  else
    echo "missing"
  fi
}

codex_version="$(version_of codex)"
hermes_version="$(version_of hermes)"
now="$(date -Iseconds)"
new_json="$(python3 - <<PY
import json
print(json.dumps({"ts":"$now","codex":"$codex_version","hermes":"$hermes_version"}, ensure_ascii=False))
PY
)"
old_json="$(cat "$VERSION_FILE" 2>/dev/null || true)"

if [[ "$new_json" != "$old_json" ]]; then
  printf '%s\n' "$new_json" >"$VERSION_FILE"
  codex --help >"$DOC_DIR/codex-help.txt" 2>&1 || true
  hermes --help >"$DOC_DIR/hermes-help.txt" 2>&1 || true
  printf '{"ts":"%s","script":"hermes-agent-version-tracker","status":"OK","code":"TOOL_VERSION_CAPTURED","versions":%s}\n' \
    "$now" "$new_json" >>"$EVENT_LOG"
  if [[ "${RUN_TRAINING_ON_VERSION_CHANGE:-false}" == "true" ]]; then
    "$TRAINING_ROOT/scripts/run_training_guarded.sh" || true
  fi
else
  echo "tool versions unchanged"
fi

cat "$VERSION_FILE"
