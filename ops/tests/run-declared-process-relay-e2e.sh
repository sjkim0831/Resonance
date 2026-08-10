#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
: "${RELAY_PROCESS:?}" "${RELAY_STEPS:?}" "${RELAY_STEP_ACTORS:?}" "${RELAY_ACCOUNTS_JSON:?}" "${RELAY_ROUTE:?}" "${RELAY_PREFIX:?}"
[[ "$RELAY_PROCESS" =~ ^[A-Z0-9_]+$ && "$RELAY_PREFIX" =~ ^[A-Z0-9_-]+$ ]] || { echo "RELAY_IDENTIFIER_INVALID" >&2; exit 3; }
IFS=',' read -r -a STEPS <<<"$RELAY_STEPS"
IFS=',' read -r -a ACTORS <<<"$RELAY_STEP_ACTORS"
[[ ${#STEPS[@]} -eq ${#ACTORS[@]} && ${#STEPS[@]} -gt 0 ]] || { echo "RELAY_TOPOLOGY_INVALID" >&2; exit 3; }
ENV_FILE="${CARBONET_ACTOR_TEST_ENV_FILE:-/opt/carbonet-data/config/actor-test.env}"
[[ -r "$ENV_FILE" ]] && { set -a; source "$ENV_FILE"; set +a; }
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
PROJECT_ID="QA-${RELAY_PREFIX}-$(date +%s)-$RANDOM"
EVIDENCE="$ROOT/var/test-evidence/${RELAY_PROCESS,,}-latest.json"
VALIDATION_COMMIT="$(tr -d '[:space:]' </opt/resonance-data/deploy/carbonet-main-success.commit)"
cleanup(){
  carbonet_postgres_query "begin;
    delete from framework_process_execution_event where execution_id in (select execution_id from framework_process_execution where project_id='$PROJECT_ID');
    delete from framework_process_work_draft where project_id='$PROJECT_ID';
    delete from framework_process_execution where project_id='$PROJECT_ID';
    delete from framework_account_actor_assignment where tenant_id='TEST_COMPANY_001' and project_id='$PROJECT_ID';
    commit;" >/dev/null
}
trap cleanup EXIT
mkdir -p "$(dirname "$EVIDENCE")"
values=""
for actor in $(printf '%s\n' "${ACTORS[@]}" | sort -u); do
  [[ "$actor" =~ ^[A-Z0-9_]+$ ]] || { echo "RELAY_ACTOR_INVALID" >&2; exit 3; }
  account="$(jq -er --arg actor "$actor" '.[$actor]' <<<"$RELAY_ACCOUNTS_JSON")"
  [[ "$account" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo "RELAY_ACCOUNT_INVALID" >&2; exit 3; }
  [[ -z "$values" ]] || values+=","
  values+="('$account','TEST_COMPANY_001','$PROJECT_ID','$actor','$PROJECT_ID','ACTIVE')"
done
carbonet_postgres_query "insert into framework_account_actor_assignment(account_id,tenant_id,project_id,actor_code,data_scope,assignment_status) values $values
  on conflict(account_id,tenant_id,project_id,actor_code) do update set assignment_status='ACTIVE',data_scope=excluded.data_scope,valid_from=current_date,valid_until=null;" >/dev/null
contracts='[]'
for step in "${STEPS[@]}"; do
  contract="$(bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" "$RELAY_PROCESS" "$step")"
  contracts="$(jq -cn --argjson current "$contracts" --argjson next "$contract" '$current+[$next]')"
done
RUNTIME_COMMIT="$(jq -r '[.[] | .sourceCommit] | unique | if length == 1 then .[0] else empty end' <<<"$contracts")"
[[ "$RUNTIME_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo "RELAY_RUNTIME_IDENTITY_INVALID" >&2; exit 3; }
CARBONET_RELAY_QA_PROJECT_ID="$PROJECT_ID" CARBONET_RELAY_PROCESS_CODE="$RELAY_PROCESS" CARBONET_RELAY_STEPS="$RELAY_STEPS" \
CARBONET_RELAY_STEP_ACTORS="$RELAY_STEP_ACTORS" CARBONET_RELAY_ACCOUNTS_JSON="$RELAY_ACCOUNTS_JSON" CARBONET_RELAY_ROUTE="$RELAY_ROUTE" \
CARBONET_RELAY_EVIDENCE_FILE="$EVIDENCE" RESONANCE_ROOT="$ROOT" node "$ROOT/ops/scripts/resonance-facility-operation-monitoring-e2e.mjs"
cleanup
trap - EXIT
residue="$(carbonet_postgres_query "select (select count(*) from framework_process_execution where project_id='$PROJECT_ID')+(select count(*) from framework_process_work_draft where project_id='$PROJECT_ID')+(select count(*) from framework_account_actor_assignment where project_id='$PROJECT_ID');")"
[[ "$residue" == 0 ]] || { echo "RELAY_CLEANUP_FAILED residue=$residue" >&2; exit 3; }
jq --argjson contracts "$contracts" --arg sourceCommit "$RUNTIME_COMMIT" --arg validationCommit "$VALIDATION_COMMIT" '.cleanup=true|.contracts=$contracts|.sourceCommit=$sourceCommit|.validationCommit=$validationCommit' "$EVIDENCE" >"$EVIDENCE.tmp"
mv "$EVIDENCE.tmp" "$EVIDENCE"
required="api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup"
for step in "${STEPS[@]}"; do
  contract="$(jq -c --arg step "$step" '.contracts[]|select(.stepCode==$step)' "$EVIDENCE")"
  jq -c --argjson contract "$contract" '.contract=$contract' "$EVIDENCE" | E2E_DEPLOYED_COMMIT="$RUNTIME_COMMIT" E2E_VALIDATION_COMMIT="$VALIDATION_COMMIT" bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" "$RELAY_PROCESS" "$step" "$required" USER >/dev/null
done
printf '{"status":"PROMOTED","processCode":"%s","steps":%d,"cleanup":true,"sourceCommit":"%s","validationCommit":"%s"}\n' "$RELAY_PROCESS" "${#STEPS[@]}" "$RUNTIME_COMMIT" "$VALIDATION_COMMIT"
