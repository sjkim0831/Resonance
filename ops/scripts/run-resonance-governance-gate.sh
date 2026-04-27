#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/governance-gates}"
RUN_MODEL_GATE="${RUN_MODEL_GATE:-false}"
MODEL="${MODEL:-gemma3:4b}"

mkdir -p "$OUT_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="$OUT_DIR/resonance-governance-gate-$STAMP.md"

write() {
  printf '%s\n' "$*" | tee -a "$REPORT"
}

fail() {
  write ""
  write "FAIL $*"
  write ""
  write "Report: $REPORT"
  exit 1
}

run_gate() {
  local name="$1"
  shift

  write ""
  write "## $name"
  write ""
  write '```text'
  set +e
  (cd "$ROOT_DIR" && "$@") 2>&1 | tee -a "$REPORT"
  local code="${PIPESTATUS[0]}"
  set -e
  write '```'

  if [ "$code" != "0" ]; then
    fail "$name failed"
  fi
}

write "# Resonance Governance Gate"
write ""
write "- time: $(date -Is)"
write "- root: $ROOT_DIR"
write "- model gate: $RUN_MODEL_GATE"
write ""

run_gate "Build Version Metadata" bash ops/scripts/verify-build-version-metadata.sh
run_gate "Theme Registry" bash ops/scripts/verify-theme-registry.sh
run_gate "Project Boundary" bash ops/scripts/verify-project-boundary.sh
run_gate "Deterministic Agent Policy" bash ops/scripts/verify-deterministic-agent-policy.sh

if [ "$RUN_MODEL_GATE" = "true" ]; then
  run_gate "Hermes RAG Smoke With Model Gate" env RUN_MODEL_GATE=true MODEL="$MODEL" bash ops/scripts/run-hermes-rag-smoke.sh
else
  run_gate "Hermes RAG Smoke" bash ops/scripts/run-hermes-rag-smoke.sh
fi

write ""
write "PASS Resonance governance gate"
write ""
write "Report: $REPORT"
