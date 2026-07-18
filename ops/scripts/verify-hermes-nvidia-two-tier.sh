#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
P="$ROOT/data/ai-runtime/hermes-nvidia-two-tier-policy.json"
command -v jq >/dev/null
jq empty "$P"
jq -e '.exclusiveModels==true and .selector.model=="gemma4-e4b-gpu-shadow" and .selector.generationAllowed==false' "$P" >/dev/null
jq -e '.workers.SIMPLE.provider=="nvidia" and .workers.SIMPLE.model=="minimaxai/minimax-m2.7"' "$P" >/dev/null
jq -e '.workers.COMPLEX.provider=="nvidia" and .workers.COMPLEX.model=="minimaxai/minimax-m3" and .fallback=="FAIL_CLOSED"' "$P" >/dev/null
jq -e '.disabledModels|index("qwen3.6-40b-deck-opus-q4") and index("all-unlisted-models")' "$P" >/dev/null
echo 'PASS Hermes routing is E4B selector plus NVIDIA M2.7/M3 only'
