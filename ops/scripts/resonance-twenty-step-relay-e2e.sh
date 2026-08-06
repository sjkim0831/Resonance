#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ENV_FILE="${CARBONET_ACTOR_TEST_ENV_FILE:-/opt/carbonet-data/config/actor-test.env}"
if [[ -r "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi
[[ -d "$ROOT/projects/carbonet-frontend/source/node_modules/@playwright/test" ]] || {
  echo '[twenty-step-relay-e2e] FAIL Playwright dependency missing' >&2
  exit 2
}

K8S_NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
PATRONI_POD="${PATRONI_POD:-$(K8S_NAMESPACE="$K8S_NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")}"
DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
DEPLOYED_COMMIT="${E2E_DEPLOYED_COMMIT:-$(tr -d '[:space:]' < "$DEPLOY_STATE_FILE" 2>/dev/null || true)}"
[[ "$DEPLOYED_COMMIT" =~ ^[0-9a-fA-F]{7,80}$ ]] || { echo '[twenty-step-relay-e2e] FAIL deployed commit unavailable' >&2; exit 2; }
RELAY_CONTRACT="$(kubectl -n "$K8S_NAMESPACE" exec -i "$PATRONI_POD" -c patroni -- \
  psql -h 127.0.0.1 -U postgres -d carbonet -X -At -F '|' -v source_commit="$DEPLOYED_COMMIT" <<'SQL'
WITH RECURSIVE chain(process_code,next_process_code,depth,path) AS (
  SELECT process_code,next_process_code,1,ARRAY[process_code::text]
  FROM framework_process_chain
  WHERE process_code='EMISSION_PROJECT_PORTFOLIO' AND use_at='Y'
  UNION ALL
  SELECT next_chain.process_code,next_chain.next_process_code,chain.depth+1,chain.path||next_chain.process_code::text
  FROM chain
  JOIN framework_process_chain next_chain ON next_chain.process_code=chain.next_process_code AND next_chain.use_at='Y'
  WHERE chain.next_process_code<>'' AND chain.depth<100 AND NOT next_chain.process_code=ANY(chain.path)
), contract AS (
  SELECT chain.depth,chain.process_code,step.step_code,step.actor_code
  FROM chain JOIN framework_process_step step USING(process_code)
)
SELECT (SELECT string_agg(process_code,',' ORDER BY depth)
          FROM (SELECT DISTINCT depth,process_code FROM contract) ordered),
       count(DISTINCT process_code||'/'||step_code),count(DISTINCT actor_code),
       replace(encode(convert_to((SELECT jsonb_agg(jsonb_build_object(
         'processCode',contract.process_code,'stepCode',contract.step_code,
         'processVersion',definition.process_version,
         'contractFingerprint',framework_current_process_step_contract_fingerprint(contract.process_code,contract.step_code),
         'sourceCommit',:'source_commit','capturedAt',to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
       ) ORDER BY contract.depth,step.step_order)::text
       FROM contract JOIN framework_process_definition definition USING(process_code)
       JOIN framework_process_step step USING(process_code,step_code)),'UTF8'),'base64'),E'\n','')
FROM contract;
SQL
)"
IFS='|' read -r CARBONET_RELAY_EXPECTED_PROCESSES CARBONET_RELAY_EXPECTED_STEP_COUNT CARBONET_RELAY_EXPECTED_ACCOUNT_COUNT CONTRACTS_B64 <<<"$RELAY_CONTRACT"
PRE_RUN_CONTRACTS="$(printf '%s' "$CONTRACTS_B64" | base64 -d)"
[[ "$(jq 'length' <<<"$PRE_RUN_CONTRACTS")" == "$CARBONET_RELAY_EXPECTED_STEP_COUNT" ]] || { echo '[twenty-step-relay-e2e] FAIL contract envelope count mismatch' >&2; exit 3; }
[[ -n "$CARBONET_RELAY_EXPECTED_PROCESSES" && "$CARBONET_RELAY_EXPECTED_STEP_COUNT" -gt 0 ]] || {
  echo '[twenty-step-relay-e2e] FAIL executable relay contract is empty' >&2
  exit 3
}
# Every canonical step executes exactly once. Recovery is proven separately by
# replaying the first command with the same idempotency key and asserting that
# the original event is returned without adding a transition.
CARBONET_RELAY_EXPECTED_TRANSITION_COUNT="$CARBONET_RELAY_EXPECTED_STEP_COUNT"
export CARBONET_RELAY_EXPECTED_PROCESSES CARBONET_RELAY_EXPECTED_STEP_COUNT \
  CARBONET_RELAY_EXPECTED_TRANSITION_COUNT CARBONET_RELAY_EXPECTED_ACCOUNT_COUNT

RESONANCE_ROOT="$ROOT" node "$ROOT/ops/scripts/resonance-twenty-step-relay-e2e.mjs"
# Contract promotion is fail-closed: API/state-transition evidence alone is not
# sufficient. Every canonical step must also mount its authenticated user route
# and complete the same actor relay in the browser.
RESONANCE_ROOT="$ROOT" node "$ROOT/ops/scripts/resonance-twenty-step-relay-visual-e2e.mjs"
PRE_RUN_CONTRACTS="$PRE_RUN_CONTRACTS" bash "$ROOT/ops/scripts/promote-relay-contracts-after-e2e.sh" \
  "$ROOT/var/test-evidence/twenty-step-relay-e2e-latest.json"
