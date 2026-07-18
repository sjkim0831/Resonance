#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
POLICY="$ROOT/data/ai-runtime/kilo-m3-process-policy.json"
PROMPT="$ROOT/ops/prompts/kilo-m3-process-worker.md"
command -v jq >/dev/null || { echo 'FAIL jq is required' >&2; exit 1; }
jq empty "$POLICY"
[[ -s "$PROMPT" ]] || { echo 'FAIL prompt missing' >&2; exit 1; }
jq -e '.model=="kilo/minimax/minimax-m3" and .defaultMode=="plan" and .isolation=="git-worktree"' "$POLICY" >/dev/null
jq -e '.forbiddenDirectOperations|index("deploy") and index("database mutation") and index("push")' "$POLICY" >/dev/null
jq -e '.implementationRequirements|index("explicit --approve") and index("deterministic verification")' "$POLICY" >/dev/null
echo 'PASS Kilo M3 policy is bounded and promotion-gated'
