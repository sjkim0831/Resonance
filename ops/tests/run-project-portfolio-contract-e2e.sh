#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ -z "${CARBONET_ACTOR_TEST_PASSWORD:-}" ]]; then
  CARBONET_ACTOR_TEST_PASSWORD="$(kubectl -n "${K8S_NAMESPACE:-carbonet-prod}" get secret carbonet-test-account-switch -o jsonpath='{.data.password}' | base64 -d)"
fi
export CARBONET_ACTOR_TEST_PASSWORD
export CARBONET_RUNTIME_BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://172.16.1.232}"
EVIDENCE="$(node "$ROOT/ops/scripts/resonance-project-portfolio-contract-e2e.mjs")"
printf '%s\n' "$EVIDENCE"
printf '%s' "$EVIDENCE" | bash "$ROOT/ops/scripts/promote-project-portfolio-after-e2e.sh"
