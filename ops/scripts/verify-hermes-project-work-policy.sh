#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
P="$ROOT/data/ai-runtime/hermes-project-work-policy.json"
R="$ROOT/data/ai-runtime/hermes-nvidia-two-tier-policy.json"
command -v jq >/dev/null
jq empty "$P" "$R"
jq -e '.taskKinds|length==17 and all(.[]; length>0)' "$P" >/dev/null
jq -e '.allowedModes==["design","implement","verify","diagnose","document"]' "$P" >/dev/null
jq -e '.directProductionMutationByModel==false and .fallback=="FAIL_CLOSED"' "$P" >/dev/null
jq -e '.promotionGates==["policy","source","test","build","runtime","health"]' "$P" >/dev/null
jq -e '.exclusiveModels and .selector.model=="gemma4-e4b-gpu-shadow" and .workers.SIMPLE.model=="minimaxai/minimax-m2.7" and .workers.COMPLEX.model=="minimaxai/minimax-m3"' "$R" >/dev/null
grep -q 'run-hermes-project-work.sh' "$ROOT/ops/scripts/run-process-development-worker.sh"
grep -q 'HERMES_PROJECT_WORK_POLICY_INVALID' "$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
if grep -Eq 'kilo run|KILO_GATEWAY_AUTH_REQUIRED' \
  "$ROOT/ops/scripts/run-process-development-worker.sh" \
  "$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"; then
  echo 'FAIL legacy Kilo execution remains in the active project completion path' >&2
  exit 1
fi
echo 'PASS universal project work policy covers 17 work kinds with fail-closed promotion gates'
