#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NS="${K8S_NAMESPACE:-carbonet-prod}"
LOCK="${COMPANY_MANAGER_DELEGATION_GATE_LOCK:-/tmp/company-manager-delegation-no-build-gate.lock}"
exec 9>"$LOCK"
flock -n 9 || { echo COMPANY_MANAGER_DELEGATION_GATE_ALREADY_RUNNING >&2; exit 75; }
cd "$ROOT"
bash ops/tests/test-company-manager-delegation-source-coverage.sh
export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE="${PLAYWRIGHT_HOST_PLATFORM_OVERRIDE:-ubuntu24.04-x64}"
if [[ -z "${CARBONET_ADMIN_TEST_PASSWORD:-}" ]]; then
  CARBONET_ADMIN_TEST_PASSWORD="$(kubectl -n "$NS" get secret carbonet-runtime-smoke-admin -o jsonpath='{.data.password}' | base64 -d)"
fi
export CARBONET_ADMIN_TEST_PASSWORD
tmp="$(mktemp)"
cleanup() { rm -f -- "$tmp"; }
trap cleanup EXIT
node ops/scripts/resonance-company-manager-delegation-e2e.mjs >"$tmp"
jq -e '.status=="PASS" and .request==1 and .approval==1 and .atomicHandover==1 and .successorVisible==1 and .projectCleanup==1 and (.routes|length)==12 and .performanceSampleCount>=20' "$tmp" >/dev/null
install -D -m 0644 "$tmp" var/test-evidence/company-manager-delegation-no-build-latest.json
cat "$tmp"
