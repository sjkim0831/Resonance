#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="${1:-prepare}"
MODEL="${KILO_M27_MODEL:-nvidia/minimaxai/minimax-m2.7}"
AGENT="${KILO_M27_AGENT:-codex-m27}"
KILO_BIN="${KILO_BIN:-$(command -v kilo || true)}"
PROMPT="$ROOT/ops/prompts/kilo-m27-screen-continuation.md"
PREFLIGHT="$ROOT/var/ai-runtime/kilo-m27-screen-handoff/latest-preflight.json"
OUT_ROOT="$ROOT/var/ai-runtime/kilo-m27-screen-handoff"

[[ -x "$KILO_BIN" ]] || { echo 'FAIL Kilo CLI unavailable' >&2; exit 1; }
[[ -s "$PROMPT" ]] || { echo "FAIL prompt missing: $PROMPT" >&2; exit 1; }

bash "$ROOT/ops/scripts/kilo-m27-screen-preflight.sh" >/dev/null
"$KILO_BIN" models | grep -Fx "$MODEL" >/dev/null || { echo "FAIL model unavailable: $MODEL" >&2; exit 1; }

case "$MODE" in
  prepare)
    timeout 50 "$KILO_BIN" roll-call "$MODEL" 2>&1 | grep -q 'YES' || { echo "FAIL provider preflight: $MODEL" >&2; exit 1; }
    jq '{generatedAt,target,quality:.quality.summary,deployGate,runtime,stopConditions,nextAction}' "$PREFLIGHT"
    echo "READY model=$MODEL agent=$AGENT"
    ;;
  plan)
    run_id="$(date -u +%Y%m%dT%H%M%SZ)-plan"
    run_dir="$OUT_ROOT/$run_id"
    mkdir -p "$run_dir"
    jq '{verifiedBaseline:{target,quality:.quality.summary,deployGate,runtime},activeWorkConflicts:.activeWork,stopConditions,nextAction}' "$PREFLIGHT" > "$run_dir/verified-plan.json"
    jq . "$run_dir/verified-plan.json"
    echo "PASS plan=$run_dir/verified-plan.json"
    ;;
  interactive)
    interactive_data="$OUT_ROOT/kilo-data"
    mkdir -p "$interactive_data"
    request="$(cat "$PROMPT")

CURRENT PREFLIGHT JSON:
$(jq -c . "$PREFLIGHT")

Continue from this verified handoff. Re-run preflight before any apply operation."
    echo "Starting permission-gated interactive session in $ROOT"
    exec env XDG_DATA_HOME="$interactive_data" "$KILO_BIN" run --interactive --pure --agent "$AGENT" --model "$MODEL" \
      --dir "$ROOT" \
      -- "$request"
    ;;
  *)
    echo 'usage: start-kilo-m27-screen-agent.sh [prepare|plan|interactive]' >&2
    exit 2
    ;;
esac
