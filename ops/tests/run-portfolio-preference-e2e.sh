#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ -z "${CARBONET_ACTOR_TEST_PASSWORD:-}" ]]; then
  CARBONET_ACTOR_TEST_PASSWORD="$(kubectl -n "${K8S_NAMESPACE:-carbonet-prod}" get secret carbonet-test-account-switch -o jsonpath='{.data.password}' | base64 -d)"
fi
export CARBONET_ACTOR_TEST_PASSWORD
export CARBONET_RUNTIME_BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://172.16.1.232}"
RAW_EVIDENCE="$(node "$ROOT/ops/scripts/resonance-portfolio-preference-e2e.mjs")"
EVIDENCE="$(jq -c \
  --arg executedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg sourceCommit "$(git -C "$ROOT" rev-parse HEAD)" \
  '. + {executedAt:$executedAt,sourceCommit:$sourceCommit}' <<<"$RAW_EVIDENCE")"
printf '%s\n' "$EVIDENCE"
printf '%s' "$EVIDENCE" | "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" \
  EMISSION_PROJECT_PORTFOLIO EMISSION_PROJECT_PORTFOLIO_LIST \
  read,write,reread,staleConflict,restore
