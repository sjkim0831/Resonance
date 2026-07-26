#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="${1:-prepare}"
CONTRACT_ID="${2:-}"
MODEL="${KILO_M27_MODEL:-nvidia/minimaxai/minimax-m2.7}"
AGENT="${KILO_M27_AGENT:-codex-m27}"
KILO_BIN="${KILO_BIN:-$(command -v kilo || true)}"
PROMPT="$ROOT/ops/prompts/kilo-design-driven-development.md"
LATEST="$ROOT/var/ai-runtime/system-design-generator/latest"

[[ -x "$KILO_BIN" ]] || { echo '[kilo-design] Kilo CLI unavailable' >&2; exit 1; }
[[ -s "$PROMPT" ]] || { echo "[kilo-design] prompt missing: $PROMPT" >&2; exit 1; }
bash "$ROOT/ops/scripts/generate-system-design-deliverables.sh" generate >/dev/null
bash "$ROOT/ops/scripts/generate-system-design-deliverables.sh" check >/dev/null

if [[ -z "$CONTRACT_ID" ]]; then
  CONTRACT_ID="$(jq -r 'map(select(.lane=="NO_BUILD_METADATA"))[0].contractId // empty' "$LATEST/development/work-queue.json")"
fi
[[ "$CONTRACT_ID" =~ ^[0-9]+$ ]] || { echo '[kilo-design] valid contract ID required' >&2; exit 2; }
PACKET="$(rg -l --fixed-strings "\"contractId\": $CONTRACT_ID," "$LATEST/development/packets" | head -1)"
[[ -s "$PACKET" ]] || { echo "[kilo-design] packet not found: $CONTRACT_ID" >&2; exit 3; }

summary() {
  jq '{identity,intent,execution:{lane:.execution.lane,preferredPaths:.execution.preferredPaths,verification:.execution.verification,acceptance:.execution.acceptance},packetHash}' "$PACKET"
}

case "$MODE" in
  prepare)
    timeout 50 "$KILO_BIN" roll-call "$MODEL" 2>&1 | grep -q 'YES' || {
      echo "[kilo-design] provider preflight failed: $MODEL" >&2; exit 1;
    }
    summary
    echo "READY model=$MODEL agent=$AGENT contract=$CONTRACT_ID packet=$PACKET"
    ;;
  plan)
    run_dir="$ROOT/var/ai-runtime/kilo-design-driven/$(date -u +%Y%m%dT%H%M%SZ)-$CONTRACT_ID"
    mkdir -p "$run_dir"
    cp "$PACKET" "$run_dir/contract-packet.json"
    summary > "$run_dir/summary.json"
    printf '%s\n' "Read $PROMPT and $run_dir/contract-packet.json. Produce a bounded implementation plan; do not edit files." > "$run_dir/request.txt"
    echo "PASS plan=$run_dir/request.txt packet=$run_dir/contract-packet.json"
    ;;
  interactive)
    request="$(cat "$PROMPT")

SELECTED CONTRACT PACKET:
$(cat "$PACKET")

Continue only within this contract. Re-run live preflight before applying changes."
    data_dir="$ROOT/var/ai-runtime/kilo-design-driven/kilo-data"
    mkdir -p "$data_dir"
    exec env XDG_DATA_HOME="$data_dir" "$KILO_BIN" run --interactive --pure --agent "$AGENT" --model "$MODEL" --dir "$ROOT" -- "$request"
    ;;
  *)
    echo 'usage: start-kilo-design-driven-agent.sh [prepare|plan|interactive] [contract_id]' >&2
    exit 2
    ;;
esac
