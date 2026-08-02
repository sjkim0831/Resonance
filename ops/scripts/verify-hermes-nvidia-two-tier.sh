#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
P="$ROOT/data/ai-runtime/hermes-nvidia-two-tier-policy.json"
command -v jq >/dev/null
jq empty "$P"
jq -e '.policyId=="hermes-e4b-only" and .exclusiveModels==true and .selector.model=="gemma4-e4b-gpu-shadow" and .selector.generationAllowed==false' "$P" >/dev/null
jq -e '(.workers|length)==0 and .fallback=="FAIL_CLOSED"' "$P" >/dev/null
jq -e '.disabledModels|index("minimaxai/minimax-m2.7") and index("minimaxai/minimax-m3") and index("qwen3.6-40b-deck-opus-q4") and index("all-unlisted-models")' "$P" >/dev/null
echo 'PASS Hermes routing allows E4B selection only; NVIDIA workers are disabled'
