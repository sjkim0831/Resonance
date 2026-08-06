#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
if [[ -z "${CARBONET_ADMIN_TEST_PASSWORD:-}" ]]; then
  CARBONET_ADMIN_TEST_PASSWORD="$(kubectl -n "$NAMESPACE" get secret carbonet-runtime-smoke-admin -o jsonpath='{.data.password}' | base64 -d)"
fi
export CARBONET_ADMIN_TEST_PASSWORD
export CARBONET_RUNTIME_BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://172.16.1.232}"
EVIDENCE="$(RESONANCE_ROOT="$ROOT" node "$ROOT/ops/scripts/resonance-project-portfolio-admin-e2e.mjs")"
printf '%s\n' "$EVIDENCE"
printf '%s' "$EVIDENCE" | RESONANCE_ROOT="$ROOT" bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" \
  EMISSION_PROJECT_PORTFOLIO EMISSION_PROJECT_PORTFOLIO_LIST \
  api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,admin,desktop,mobile ADMIN
printf '%s' "$EVIDENCE" | RESONANCE_ROOT="$ROOT" bash "$ROOT/ops/scripts/promote-project-portfolio-admin-after-e2e.sh"
