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
PATRONI_POD="${PATRONI_POD:-postgres-patroni-2}"
RELAY_CONTRACT="$(kubectl -n "$K8S_NAMESPACE" exec -i "$PATRONI_POD" -c patroni -- \
  psql -h 127.0.0.1 -U postgres -d carbonet -X -At -F '|' <<'SQL'
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
       count(DISTINCT process_code||'/'||step_code),count(DISTINCT actor_code)
FROM contract;
SQL
)"
IFS='|' read -r CARBONET_RELAY_EXPECTED_PROCESSES CARBONET_RELAY_EXPECTED_STEP_COUNT CARBONET_RELAY_EXPECTED_ACCOUNT_COUNT <<<"$RELAY_CONTRACT"
[[ -n "$CARBONET_RELAY_EXPECTED_PROCESSES" && "$CARBONET_RELAY_EXPECTED_STEP_COUNT" -gt 0 ]] || {
  echo '[twenty-step-relay-e2e] FAIL executable relay contract is empty' >&2
  exit 3
}
correction_replay=0
[[ ",$CARBONET_RELAY_EXPECTED_PROCESSES," == *,EMISSION_PROJECT,* ]] && correction_replay=1
CARBONET_RELAY_EXPECTED_TRANSITION_COUNT=$((CARBONET_RELAY_EXPECTED_STEP_COUNT+correction_replay))
export CARBONET_RELAY_EXPECTED_PROCESSES CARBONET_RELAY_EXPECTED_STEP_COUNT \
  CARBONET_RELAY_EXPECTED_TRANSITION_COUNT CARBONET_RELAY_EXPECTED_ACCOUNT_COUNT

RESONANCE_ROOT="$ROOT" node "$ROOT/ops/scripts/resonance-twenty-step-relay-e2e.mjs"
# Contract promotion is fail-closed: API/state-transition evidence alone is not
# sufficient. Every canonical step must also mount its authenticated user route
# and complete the same actor relay in the browser.
RESONANCE_ROOT="$ROOT" node "$ROOT/ops/scripts/resonance-twenty-step-relay-visual-e2e.mjs"
bash "$ROOT/ops/scripts/promote-relay-contracts-after-e2e.sh" \
  "$ROOT/var/test-evidence/twenty-step-relay-e2e-latest.json"
