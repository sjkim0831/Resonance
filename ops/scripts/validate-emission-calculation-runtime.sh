#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"; DATABASE="${POSTGRES_DB:-carbonet}"
USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"; CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"; SOURCE_COMMIT="${CARBONET_POSTDEPLOY_SOURCE_COMMIT:-$(git -C "$ROOT" rev-parse HEAD)}";EVIDENCE_MODE="${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-legacy}"
COOKIE_JAR="$(mktemp)"; TIMINGS="$(mktemp)"; API_BODY="$(mktemp)"; PAGE_BODY="$(mktemp)"; LOGIN_PAYLOAD="$(mktemp)"; LOGIN_RESPONSE="$(mktemp)"
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
psqlq(){ carbonet_postgres_query "$1"; }
# shellcheck source=ops/scripts/runtime-qa-auth-common.sh
source "$ROOT/ops/scripts/runtime-qa-auth-common.sh"
cleanup_calculation_runtime() {
  local original_status=$? cleanup_status=0
  trap - EXIT INT TERM
  set +e
  carbonet_qa_logout "$COOKIE_JAR" "$BASE_URL" || cleanup_status=1
  rm -f "$COOKIE_JAR" "$TIMINGS" "$API_BODY" "$PAGE_BODY" "$LOGIN_PAYLOAD" "$LOGIN_RESPONSE"
  if (( original_status == 0 && cleanup_status != 0 )); then original_status=1; fi
  exit "$original_status"
}
trap cleanup_calculation_runtime EXIT INT TERM
carbonet_qa_load_credentials LOGIN_USER LOGIN_PASSWORD \
  "${CARBONET_RUNTIME_TEST_USER:-}" "${CARBONET_RUNTIME_TEST_PASSWORD:-}" \
  "${CARBONET_RUNTIME_TEST_AUTH_SECRET:-carbonet-screen-smoke}" "$NAMESPACE"
project_id="$(psqlq "select project_id from emission_calculation_run group by project_id order by max(calculated_at) desc limit 1")"
[[ -n "$project_id" ]] || { echo '[calculation-runtime] FAIL no calculated project' >&2; exit 1; }
jq -n --arg id "$LOGIN_USER" --arg password "$LOGIN_PASSWORD" '{userId:$id,userPw:$password,userSe:"USR"}' >"$LOGIN_PAYLOAD"
LOGIN_PASSWORD=""; unset LOGIN_PASSWORD CARBONET_RUNTIME_TEST_PASSWORD
login_code="$(curl -sS -c "$COOKIE_JAR" -o "$LOGIN_RESPONSE" -w '%{http_code}' -H 'Content-Type: application/json' \
  -X POST "$BASE_URL/signin/actionLogin" --data-binary @"$LOGIN_PAYLOAD")" || login_code=000
[[ "$login_code" == 200 ]] && jq -e --arg user "$LOGIN_USER" '.status=="loginSuccess" and (.userId|ascii_downcase)==($user|ascii_downcase)' "$LOGIN_RESPONSE" >/dev/null \
  || { echo "[calculation-runtime] FAIL login status=$login_code" >&2; exit 1; }
CARBONET_QA_AUTH_SESSION_ACTIVE=1
export CARBONET_QA_AUTH_SESSION_ACTIVE
api_paths=("/home/api/emission-projects/$project_id" "/home/api/emission-projects/$project_id/activities" "/home/api/emission-projects/$project_id/calculation" "/home/api/emission-projects/$project_id/quality" "/home/api/emission-projects/$project_id/review-workflow")
for path in "${api_paths[@]}"; do code="$(curl -sS -b "$COOKIE_JAR" -o "$API_BODY" -w '%{http_code}' "$BASE_URL$path")"; [[ "$code" == 200 ]] || { echo "[calculation-runtime] FAIL api=$path status=$code" >&2; exit 1; }; grep -Eq '^\s*[\{\[]' "$API_BODY" || exit 1; done
for path in "/home/api/emission-projects/$project_id/calculation" "/home/api/emission-projects/$project_id/review-workflow"; do code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL$path")"; [[ "$code" == 401 || "$code" == 403 ]] || { echo "[calculation-runtime] FAIL protection=$path status=$code" >&2; exit 1; }; done
pages=("/emission/project/detail?projectId=$project_id" "/emission/calculation?projectId=$project_id" "/emission/validate?projectId=$project_id" "/emission/calculation-results?projectId=$project_id" "/admin/emission/project-operations" "/admin/emission/calculation-rule" "/admin/emission/validate" "/admin/emission/result_list")
for path in "${pages[@]}"; do code="$(curl -sS -L -b "$COOKIE_JAR" -o "$PAGE_BODY" -w '%{http_code}' "$BASE_URL$path")"; [[ "$code" == 200 ]] || { echo "[calculation-runtime] FAIL page=$path status=$code" >&2; exit 1; }; grep -qi '<!doctype html' "$PAGE_BODY" || exit 1; done
export BASE_URL COOKIE_JAR project_id
seq 1 20 | xargs -r -n1 -P4 bash -c '
  read -r sample_status sample_time <<<"$(curl -sS -b "$COOKIE_JAR" -o /dev/null -w "%{http_code} %{time_total}" "$BASE_URL/home/api/emission-projects/$project_id/calculation")"
  [[ "$sample_status" == 200 ]] || { echo "[calculation-runtime] FAIL p95 probe status=$sample_status" >&2; exit 1; }
  printf "%s\n" "$sample_time"
' _ >"$TIMINGS"
p95_ms="$(sort -n "$TIMINGS" | awk 'NR==19 {printf "%d",$1*1000}')"; [[ "$p95_ms" -le 2500 ]] || exit 1
read -r desired ready available <<<"$(kubectl -n "$NAMESPACE" get deploy carbonet-runtime -o jsonpath='{.spec.replicas} {.status.readyReplicas} {.status.availableReplicas}')"; [[ -n "$desired" && "$desired" -gt 0 && "$ready" -ge "$desired" && "$available" -ge "$desired" ]] || { echo "[calculation-runtime] FAIL replicas desired=$desired ready=$ready available=$available" >&2; exit 1; }
db_gate="$(psqlq "select (select count(*) from framework_process_step where process_code='EMISSION_CALCULATION' and nullif(api_contract,'') is not null)=4 and (select count(*) from framework_professional_screen_readiness where process_code='EMISSION_CALCULATION' and readiness_score=100)=8 and (select count(distinct case_type) from framework_simulation_case where process_code='EMISSION_CALCULATION')>=5 and exists(select 1 from emission_calculation_run r join emission_calculation_item i on i.calculation_id=r.calculation_id where r.project_id='$project_id' and length(r.input_snapshot_hash)=64 and nullif(r.accepted_submission_ids,'') is not null and r.calculated_by is not null and i.factor_id is not null and i.factor_source is not null and i.formula_text is not null group by r.calculation_id,r.total_emission having abs(r.total_emission-sum(i.emission_value))<0.000001) and exists(select 1 from emission_activity_request where project_id='$project_id' and request_status='ACCEPTED' and last_submission_id is not null) and exists(select 1 from emission_factor_mapping_decision where project_id='$project_id' and active_yn='Y')")"; [[ "$db_gate" == t ]] || { echo '[calculation-runtime] FAIL accepted-snapshot/factor/formula/design gate' >&2; exit 1; }
if [[ "$EVIDENCE_MODE" == "candidate" ]];then
  jq -cn --arg projectId "$project_id" --argjson authenticatedApiCount "${#api_paths[@]}" --argjson protectedApiCount 2 --argjson pageCount "${#pages[@]}" --argjson p95Millis "$p95_ms" --argjson readyReplicas "$ready" '{projectId:$projectId,authenticatedApiCount:$authenticatedApiCount,protectedApiCount:$protectedApiCount,pageCount:$pageCount,p95Millis:$p95Millis,readyReplicas:$readyReplicas,formula:"reconciled"}'|bash "$ROOT/ops/scripts/stage-postdeploy-evidence-candidate.sh" EMISSION_CALCULATION_RUNTIME EMISSION_CALCULATION RUNTIME "$SOURCE_COMMIT"
else
  sql="begin; update framework_development_job set job_status='COMPLETED',approval_status='APPROVED',quality_status='PASSED',evidence_ref='runtime:calculation-api+formula+integration+performance+deployment',last_error=null,completed_at=current_timestamp,updated_at=current_timestamp where process_code='EMISSION_CALCULATION' and job_type in ('ACTOR_TEST','DEPLOYMENT','INTEGRATION','PERFORMANCE','TEST'); update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='runtime:calculation-api+formula+integration+performance+deployment',updated_at=current_timestamp where process_code='EMISSION_CALCULATION'; commit;"; psqlq "$sql" >/dev/null
fi
echo "[calculation-runtime] PASS project=$project_id api=${#api_paths[@]} protected=2 pages=${#pages[@]} formula=reconciled p95=${p95_ms}ms replicas=$ready/$desired commit=$SOURCE_COMMIT"
