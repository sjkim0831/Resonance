#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TASK="${*:-}"
[[ -n "$TASK" ]] || { echo 'usage: run-hermes-nvidia-task.sh TASK' >&2; exit 2; }
bash "$ROOT/ops/scripts/verify-hermes-nvidia-two-tier.sh"
POLICY="$ROOT/data/ai-runtime/hermes-nvidia-two-tier-policy.json"
SELECTOR_URL="$(jq -r '.selector.baseUrl' "$POLICY")"
SELECTOR_API_KEY="${E4B_SELECTOR_API_KEY:-qwer1234}"
HERMES_BIN="${HERMES_BIN:-$ROOT/modules/hermes-core/hermes}"
[[ -x "$HERMES_BIN" ]] || { echo "FAIL Hermes unavailable: $HERMES_BIN" >&2; exit 1; }

selector_prompt="Classify only. Output exactly SIMPLE or COMPLEX. SIMPLE means one-file boilerplate, a tiny code function, a small test, or short explanation. COMPLEX means multi-file work, architecture, workflow, database, security, deployment, debugging, or uncertainty. Task: $TASK"
selector_model="$(jq -r '.selector.model' "$POLICY")"
payload="$(jq -n --arg model "$selector_model" --arg prompt "$selector_prompt" '{model:$model,temperature:0,max_tokens:512,messages:[{role:"user",content:$prompt}]}')"
selection=""
for selector_attempt in 1 2 3; do
  selection_raw="$(curl -fsS --retry 1 --retry-all-errors --max-time 45 "$SELECTOR_URL/chat/completions" -H 'Content-Type: application/json' -H "Authorization: Bearer $SELECTOR_API_KEY" -d "$payload" || true)"
  selection="$(jq -r '.choices[0].message.content // ""' <<<"${selection_raw:-{}}" 2>/dev/null | tr '[:lower:]' '[:upper:]' | grep -Eo 'SIMPLE|COMPLEX' | head -1 || true)"
  [[ "$selection" == SIMPLE || "$selection" == COMPLEX ]] && break
  echo "[hermes-router] selector attempt=$selector_attempt returned no allowed route" >&2
done
[[ "$selection" == SIMPLE || "$selection" == COMPLEX ]] || { echo 'FAIL E4B selector returned no allowed route' >&2; exit 1; }
model="$(jq -r --arg route "$selection" '.workers[$route].model' "$POLICY")"
provider="$(jq -r --arg route "$selection" '.workers[$route].provider' "$POLICY")"
[[ "$provider" == nvidia ]] || { echo 'FAIL non-NVIDIA generation route blocked' >&2; exit 1; }
echo "[hermes-router] selector=$selector_model route=$selection worker=$provider/$model" >&2
started="$(date +%s%N)"
(cd "$ROOT" && timeout --signal=TERM --kill-after=15s "${HERMES_TASK_TIMEOUT:-600}" "$HERMES_BIN" chat -q "$TASK" -m "$model" --provider "$provider" -Q --max-turns "${HERMES_MAX_TURNS:-20}")
ended="$(date +%s%N)"
echo "[hermes-router] completed route=$selection elapsed_ms=$(((ended-started)/1000000))" >&2
