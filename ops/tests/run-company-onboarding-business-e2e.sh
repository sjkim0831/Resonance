#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
# The harness runs on the application host. Loopback reaches the canonical
# nginx vhost without the host's public-IP hairpin path, which can select the
# admin fallback shell and falsely report that the user React app did not mount.
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
LOCK_FILE="${COMPANY_ONBOARDING_E2E_LOCK_FILE:-/tmp/resonance-company-onboarding-e2e.lock}"
STEPS=(
  COMPANY_ONBOARDING_APPLY
  COMPANY_ONBOARDING_APPROVE
  COMPANY_ONBOARDING_SITE
  COMPANY_ONBOARDING_ACTORS
  COMPANY_ONBOARDING_READY
)
REQUIRED_CHECKS="api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup,desktop,mobile"

exec 9>"$LOCK_FILE"
flock -n 9 || { echo "COMPANY_ONBOARDING_E2E_ALREADY_RUNNING" >&2; exit 75; }

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf -- "$TMP_DIR"; }
trap cleanup EXIT

if [[ -z "${PATRONI_POD:-}" ]]; then
  PATRONI_POD="$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")"
fi
if [[ -z "${CARBONET_ACTOR_TEST_PASSWORD:-}" ]]; then
  CARBONET_ACTOR_TEST_PASSWORD="$(kubectl -n "$NAMESPACE" get secret carbonet-test-account-switch -o jsonpath='{.data.password}' | base64 -d)"
fi
if [[ -z "${CARBONET_ADMIN_TEST_PASSWORD:-}" ]]; then
  CARBONET_ADMIN_TEST_PASSWORD="$(kubectl -n "$NAMESPACE" get secret carbonet-runtime-smoke-admin -o jsonpath='{.data.password}' | base64 -d)"
fi
export PATRONI_POD CARBONET_ACTOR_TEST_PASSWORD CARBONET_ADMIN_TEST_PASSWORD
export K8S_NAMESPACE="$NAMESPACE" CARBONET_RUNTIME_BASE_URL="$BASE_URL"

for step in "${STEPS[@]}"; do
  RESONANCE_ROOT="$ROOT" bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" COMPANY_ONBOARDING "$step"
done | jq -s '.' >"$TMP_DIR/contracts.json"

E2E_CONTRACTS_FILE="$TMP_DIR/contracts.json" RESONANCE_ROOT="$ROOT" \
  node "$ROOT/ops/scripts/resonance-company-onboarding-e2e.mjs" >"$TMP_DIR/evidence.json"

jq -e --argjson steps 5 --argjson cases 7 '
  .status=="PASS" and .promotionEligible==true and
  .processCode=="COMPANY_ONBOARDING" and .stepCount==$steps and .caseCount==$cases and
  .cleanup==1 and (.routes|length)==20
' "$TMP_DIR/evidence.json" >/dev/null

for step in "${STEPS[@]}"; do
  jq -e --arg step "$step" '.steps[$step].result=="PASSED" and (.steps[$step].dbReread|type)=="object"' "$TMP_DIR/evidence.json" >/dev/null
done

# Validate every target first. No current-version evidence is written unless
# the complete five-step suite and every individual step are successful.
for step in "${STEPS[@]}"; do
  RESONANCE_ROOT="$ROOT" bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" \
    COMPANY_ONBOARDING "$step" "$REQUIRED_CHECKS" ALL --validate-only <"$TMP_DIR/evidence.json" >/dev/null
done

for step in "${STEPS[@]}"; do
  RESONANCE_ROOT="$ROOT" E2E_EXECUTION_ENVIRONMENT="$NAMESPACE" \
    bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" \
      COMPANY_ONBOARDING "$step" "$REQUIRED_CHECKS" ALL <"$TMP_DIR/evidence.json"
done

cat "$TMP_DIR/evidence.json"
