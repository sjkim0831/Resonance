#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NS="${K8S_NAMESPACE:-carbonet-prod}"; LOCK="${COMPANY_MANAGER_DELEGATION_E2E_LOCK:-/tmp/resonance-company-manager-delegation-e2e.lock}"
exec 9>"$LOCK"; flock -n 9 || { echo COMPANY_MANAGER_DELEGATION_E2E_ALREADY_RUNNING >&2; exit 75; }
TMP="$(mktemp -d)"; cleanup(){ rm -rf -- "$TMP"; }; trap cleanup EXIT
if [[ -z "${CARBONET_ADMIN_TEST_PASSWORD:-}" ]]; then CARBONET_ADMIN_TEST_PASSWORD="$(kubectl -n "$NS" get secret carbonet-runtime-smoke-admin -o jsonpath='{.data.password}' | base64 -d)"; fi
export CARBONET_ADMIN_TEST_PASSWORD
for step in CMD_REQUEST CMD_APPROVE CMD_HANDOVER; do RESONANCE_ROOT="$ROOT" bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" COMPANY_MANAGER_DELEGATION "$step"; done | jq -s '.' >"$TMP/contracts.json"
node "$ROOT/ops/scripts/resonance-company-manager-delegation-e2e.mjs" >"$TMP/raw.json"
POD="${PATRONI_POD:-$(K8S_NAMESPACE="$NS" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")}"; export PATRONI_POD="$POD"
kubectl -n "$NS" exec -i "$POD" -c patroni -- psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q -At <<'SQL' >"$TMP/cleanup.out"
DELETE FROM framework_company_manager_delegation WHERE idempotency_key LIKE 'qa-delegation-delegation-e2e-%';
SELECT count(*) FROM framework_company_manager_delegation WHERE idempotency_key LIKE 'qa-delegation-delegation-e2e-%';
SELECT count(*) FROM emission_project_registry WHERE project_name LIKE 'QA delegation delegation-e2e-%';
SQL
mapfile -t counts < <(tail -2 "$TMP/cleanup.out"); [[ "${counts[0]}" == 0 && "${counts[1]}" == 0 ]] || { echo DELEGATION_E2E_CLEANUP_FAILED >&2; exit 1; }
SOURCE="$(kubectl -n "$NS" get deploy carbonet-runtime -o jsonpath='{.metadata.annotations.resonance\.ai/target-commit}')"; VALIDATION="$(tr -d '[:space:]' < /opt/resonance-data/deploy/carbonet-main-success.commit)"
jq --arg source "$SOURCE" --arg validation "$VALIDATION" --slurpfile contracts "$TMP/contracts.json" '.cleanup=1|.promotionEligible=true|.sourceCommit=$source|.validationCommit=$validation|.contracts=$contracts[0]' "$TMP/raw.json" >"$TMP/evidence.json"
install -D -m 0644 "$TMP/evidence.json" "$ROOT/var/test-evidence/company-manager-delegation-latest.json"
bash "$ROOT/ops/scripts/promote-company-manager-delegation-after-e2e.sh" --validate-only <"$TMP/evidence.json" >/dev/null
for step in CMD_REQUEST CMD_APPROVE CMD_HANDOVER; do bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" COMPANY_MANAGER_DELEGATION "$step" api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup,desktop,mobile ALL --validate-only <"$TMP/evidence.json" >/dev/null; done
bash "$ROOT/ops/scripts/promote-company-manager-delegation-after-e2e.sh" <"$TMP/evidence.json"
for step in CMD_REQUEST CMD_APPROVE CMD_HANDOVER; do E2E_VALIDATION_COMMIT="$VALIDATION" bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" COMPANY_MANAGER_DELEGATION "$step" api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup,desktop,mobile ALL <"$TMP/evidence.json"; done
cat "$TMP/evidence.json"
