#!/usr/bin/env bash
set -euo pipefail

export KUBECONFIG="${KUBECONFIG:-/home/sjkim/.kube/config}"
PROVISIONER="/opt/Resonance/ops/scripts/provision-separated-server-accounts.sh"
FAILURES=0

pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; FAILURES=$((FAILURES + 1)); }

expect_can_i() {
  local account="$1" expected="$2" verb="$3" resource="$4" namespace="$5"
  local actual
  actual="$(sudo -u "$account" -H kubectl auth can-i "$verb" "$resource" -n "$namespace" 2>/dev/null || true)"
  [[ "$actual" == "$expected" ]] && pass "$account $verb $resource $namespace=$actual" ||
    fail "$account $verb $resource $namespace expected=$expected actual=$actual"
}

for account in carbonet-ops carbonet-dev jwchoo-dev center-director; do
  id "$account" >/dev/null 2>&1 && pass "Linux account $account exists" || fail "Linux account $account missing"
  [[ -s "/home/$account/.kube/config" ]] && pass "$account kubeconfig exists" || fail "$account kubeconfig missing"
  status="$(passwd -S "$account" 2>/dev/null | awk '{print $2}')"
  [[ "$status" == "L" ]] && pass "$account password is locked" || fail "$account password is not locked"
done

expect_can_i carbonet-ops yes get pods carbonet-prod
expect_can_i carbonet-ops yes patch deployments carbonet-prod
expect_can_i carbonet-ops no get secrets carbonet-prod
expect_can_i carbonet-dev yes create deployments carbonet-dev
expect_can_i carbonet-dev no get pods carbonet-prod
expect_can_i jwchoo-dev yes create deployments carbonet-dev
expect_can_i jwchoo-dev no get secrets carbonet-dev
expect_can_i jwchoo-dev no get pods carbonet-prod
expect_can_i center-director yes get deployments carbonet-prod
expect_can_i center-director no patch deployments carbonet-prod
expect_can_i center-director no get secrets carbonet-prod
expect_can_i center-director yes get pods monitoring

health="$(curl -fsS http://127.0.0.1/actuator/health 2>/dev/null || true)"
[[ "$health" == *'"status":"UP"'* ]] && pass "Carbonet runtime health=UP" || fail "Carbonet runtime health is not UP"

if [[ "$FAILURES" -gt 0 && "${1:-}" == "--repair" ]]; then
  printf 'INFO running idempotent repair\n'
  exec sudo bash "$PROVISIONER"
fi

if [[ "$FAILURES" -gt 0 ]]; then
  printf 'RESULT failures=%s\n' "$FAILURES" >&2
  exit 1
fi
printf 'RESULT all account-separation checks passed\n'
