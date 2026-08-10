#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ENV_FILE="${CARBONET_ACTOR_TEST_ENV_FILE:-/opt/carbonet-data/config/actor-test.env}"
[[ -r "$ENV_FILE" ]] && { set -a; source "$ENV_FILE"; set +a; }
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
PROJECT_ID="QA-FOM-$(date +%s)-$RANDOM"
EVIDENCE="$ROOT/var/test-evidence/facility-operation-monitoring-latest.json"
SOURCE_COMMIT="$(tr -d '[:space:]' </opt/resonance-data/deploy/carbonet-main-success.commit)"
cleanup(){
  carbonet_postgres_query "begin;
    delete from framework_process_execution_event where execution_id in (select execution_id from framework_process_execution where project_id='$PROJECT_ID');
    delete from framework_process_work_draft where project_id='$PROJECT_ID';
    delete from framework_process_execution where project_id='$PROJECT_ID';
    delete from framework_account_actor_assignment where tenant_id='TEST_COMPANY_001' and project_id='$PROJECT_ID' and account_id in ('qacalc26','qaverify26');
    commit;" >/dev/null
}
trap cleanup EXIT
mkdir -p "$(dirname "$EVIDENCE")"

carbonet_postgres_query "insert into framework_account_actor_assignment(account_id,tenant_id,project_id,actor_code,data_scope,assignment_status)
  values ('qacalc26','TEST_COMPANY_001','$PROJECT_ID','FACILITY_OPERATOR','$PROJECT_ID','ACTIVE'),
         ('qaverify26','TEST_COMPANY_001','$PROJECT_ID','HSE_MANAGER','$PROJECT_ID','ACTIVE')
  on conflict(account_id,tenant_id,project_id,actor_code) do update set assignment_status='ACTIVE',data_scope=excluded.data_scope,valid_from=current_date,valid_until=null;" >/dev/null

contracts='[]'
for step in FOM_PLAN FOM_OPERATE FOM_HANDOVER; do
  contract="$(bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" FACILITY_OPERATION_MONITORING "$step")"
  contracts="$(jq -cn --argjson current "$contracts" --argjson next "$contract" '$current+[$next]')"
done

CARBONET_FOM_QA_PROJECT_ID="$PROJECT_ID" CARBONET_FOM_EVIDENCE_FILE="$EVIDENCE" RESONANCE_ROOT="$ROOT" \
  node "$ROOT/ops/scripts/resonance-facility-operation-monitoring-e2e.mjs"
cleanup
trap - EXIT
residue="$(carbonet_postgres_query "select (select count(*) from framework_process_execution where project_id='$PROJECT_ID')+(select count(*) from framework_process_work_draft where project_id='$PROJECT_ID')+(select count(*) from framework_account_actor_assignment where project_id='$PROJECT_ID');")"
[[ "$residue" == 0 ]] || { echo "FOM_E2E_CLEANUP_FAILED residue=$residue" >&2; exit 3; }
jq --argjson contracts "$contracts" --arg sourceCommit "$SOURCE_COMMIT" '.cleanup=true|.contracts=$contracts|.sourceCommit=$sourceCommit|.validationCommit=$sourceCommit' "$EVIDENCE" >"$EVIDENCE.tmp"
mv "$EVIDENCE.tmp" "$EVIDENCE"

required="api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup"
for step in FOM_PLAN FOM_OPERATE FOM_HANDOVER; do
  contract="$(jq -c --arg step "$step" '.contracts[]|select(.stepCode==$step)' "$EVIDENCE")"
  jq -c --argjson contract "$contract" '.contract=$contract' "$EVIDENCE" | \
    E2E_DEPLOYED_COMMIT="$SOURCE_COMMIT" E2E_VALIDATION_COMMIT="$SOURCE_COMMIT" \
    bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" FACILITY_OPERATION_MONITORING "$step" "$required" USER >/dev/null
done
printf '{"status":"PROMOTED","processCode":"FACILITY_OPERATION_MONITORING","steps":3,"cleanup":true,"sourceCommit":"%s"}\n' "$SOURCE_COMMIT"
