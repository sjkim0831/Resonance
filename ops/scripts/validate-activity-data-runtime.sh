#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${POSTGRES_DB:-carbonet}"
USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
LOGIN_USER=""
LOGIN_PASSWORD=""
SOURCE_COMMIT="${CARBONET_POSTDEPLOY_SOURCE_COMMIT:-$(git -C "$ROOT" rev-parse HEAD)}"
EVIDENCE_MODE="${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-legacy}"
COOKIE_JAR="$(mktemp)"
TIMINGS="$(mktemp)"
API_BODY="$(mktemp)"
PAGE_BODY="$(mktemp)"
LOGIN_PAYLOAD="$(mktemp)"
  LOGIN_RESPONSE="$(mktemp)"

# shellcheck source=ops/scripts/runtime-qa-auth-common.sh
source "$ROOT/ops/scripts/runtime-qa-auth-common.sh"
cleanup_activity_runtime() {
  local original_status=$? cleanup_status=0
  trap - EXIT INT TERM
  set +e
  carbonet_qa_logout "$COOKIE_JAR" "$BASE_URL" || cleanup_status=1
  rm -f "$COOKIE_JAR" "$TIMINGS" "$API_BODY" "$PAGE_BODY" "$LOGIN_PAYLOAD" "$LOGIN_RESPONSE"
  if (( original_status == 0 && cleanup_status != 0 )); then original_status=1; fi
  exit "$original_status"
}
trap cleanup_activity_runtime EXIT INT TERM
carbonet_qa_load_credentials LOGIN_USER LOGIN_PASSWORD \
  "${CARBONET_RUNTIME_TEST_USER:-}" "${CARBONET_RUNTIME_TEST_PASSWORD:-}" \
  "${CARBONET_RUNTIME_TEST_AUTH_SECRET:-carbonet-screen-smoke}" "$NAMESPACE"
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
psqlq(){ carbonet_postgres_query "$1"; }

project_id="$(psqlq "select project.project_id from emission_project_registry project join framework_project_actor_assignment actor on actor.project_id=project.project_id where project.project_status<>'DELETED' and exists(select 1 from framework_account_actor_assignment aa where aa.account_id='$LOGIN_USER' and aa.tenant_id=project.tenant_id and aa.assignment_status='ACTIVE' and (aa.project_id='*' or aa.project_id=project.project_id)) group by project.project_id,project.created_at having count(distinct actor.actor_code)>=5 order by project.created_at desc limit 1")"
[[ -n "$project_id" ]] || { echo "[activity-runtime] FAIL no testable emission project" >&2; exit 1; }
activity_id="$(psqlq "select activity_id from emission_activity_data where project_id='$project_id' order by activity_id limit 1")"

write_login_payload() {
  jq -n --arg id "$LOGIN_USER" --arg password "$LOGIN_PASSWORD" --arg userSe "$1" \
    '{userId:$id,userPw:$password,userSe:$userSe}' >"$LOGIN_PAYLOAD"
}
write_login_payload USR
login_code="$(curl -sS -c "$COOKIE_JAR" -o "$LOGIN_RESPONSE" -w '%{http_code}' -H 'Content-Type: application/json' \
  -X POST "$BASE_URL/signin/actionLogin" --data-binary @"$LOGIN_PAYLOAD")" || login_code=000
if [[ "$login_code" != 200 ]] || ! jq -e '.status == "loginSuccess" and (.userId | length > 0)' "$LOGIN_RESPONSE" >/dev/null; then
  write_login_payload ENT
  login_code="$(curl -sS -c "$COOKIE_JAR" -o "$LOGIN_RESPONSE" -w '%{http_code}' -H 'Content-Type: application/json' \
    -X POST "$BASE_URL/signin/actionLogin" --data-binary @"$LOGIN_PAYLOAD")" || login_code=000
fi
LOGIN_PASSWORD=""; unset LOGIN_PASSWORD CARBONET_RUNTIME_TEST_PASSWORD
[[ "$login_code" == 200 ]] && jq -e --arg user "$LOGIN_USER" '.status == "loginSuccess" and (.userId | ascii_downcase) == ($user | ascii_downcase)' "$LOGIN_RESPONSE" >/dev/null \
  || { echo "[activity-runtime] FAIL login rejected or malformed response" >&2; exit 1; }
CARBONET_QA_AUTH_SESSION_ACTIVE=1
export CARBONET_QA_AUTH_SESSION_ACTIVE

session_body="$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/frontend/session")"
jq -e --arg user "$LOGIN_USER" '.authenticated == true and (.userId | ascii_downcase) == ($user | ascii_downcase)' >/dev/null <<<"$session_body" \
  || { echo "[activity-runtime] FAIL authenticated session identity mismatch" >&2; exit 1; }

api_paths=(
  "/home/api/emission-projects?size=100"
  "/home/api/emission-projects?page=&size=100"
  "/home/api/emission-projects/$project_id"
  "/home/api/emission-projects/$project_id/activities"
  "/home/api/emission-projects/$project_id/activity-requests"
  "/home/api/emission-projects/$project_id/submissions"
  "/home/api/emission-projects/$project_id/review-workflow"
  "/home/api/emission-projects/$project_id/quality"
)
[[ -z "$activity_id" ]] || api_paths+=("/home/api/emission-projects/$project_id/activities/$activity_id/evidence")
for path in "${api_paths[@]}"; do
  code="$(curl -sS -b "$COOKIE_JAR" -o "$API_BODY" -w '%{http_code}' "$BASE_URL$path")"
  [[ "$code" == "200" ]] || { echo "[activity-runtime] FAIL authenticated API $path status=$code" >&2; exit 1; }
  grep -Eq '^\s*[\{\[]' "$API_BODY" || { echo "[activity-runtime] FAIL non-JSON API $path" >&2; exit 1; }
done

protected_paths=(
  "/home/api/emission-projects/$project_id/submissions"
  "/home/api/emission-projects/$project_id/quality"
)
for path in "${protected_paths[@]}"; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL$path")"
  [[ "$code" == "401" || "$code" == "403" ]] || { echo "[activity-runtime] FAIL unauthenticated API not blocked $path status=$code" >&2; exit 1; }
done

page_paths=(
  "/emission/project/detail?projectId=$project_id"
  "/emission/data-request?projectId=$project_id"
  "/emission/activity-data?projectId=$project_id"
  "/emission/validate?projectId=$project_id"
  "/admin/emission/project-operations"
  "/admin/emission/survey-admin-data"
  "/admin/emission/validate"
  "/admin/emission/approval-workflow"
)
for path in "${page_paths[@]}"; do
  code="$(curl -sS -L -b "$COOKIE_JAR" -o "$PAGE_BODY" -w '%{http_code}' "$BASE_URL$path")"
  [[ "$code" == "200" ]] || { echo "[activity-runtime] FAIL page $path status=$code" >&2; exit 1; }
  grep -qi '<!doctype html' "$PAGE_BODY" || { echo "[activity-runtime] FAIL non-HTML page $path" >&2; exit 1; }
done

export BASE_URL COOKIE_JAR project_id
seq 1 20 | xargs -r -n1 -P4 bash -c '
  read -r sample_status sample_time <<<"$(curl -sS -b "$COOKIE_JAR" -o /dev/null -w "%{http_code} %{time_total}" "$BASE_URL/home/api/emission-projects/$project_id/activities")"
  [[ "$sample_status" == 200 ]] || { echo "[activity-runtime] FAIL p95 probe status=$sample_status" >&2; exit 1; }
  printf "%s\n" "$sample_time"
' _ >"$TIMINGS"
p95_ms="$(sort -n "$TIMINGS" | awk 'NR==19 {printf "%d",$1*1000}')"
[[ -n "$p95_ms" && "$p95_ms" -le 2500 ]] || { echo "[activity-runtime] FAIL p95=${p95_ms:-unknown}ms" >&2; exit 1; }

read -r desired ready available <<<"$(kubectl -n "$NAMESPACE" get deploy carbonet-runtime -o jsonpath='{.spec.replicas} {.status.readyReplicas} {.status.availableReplicas}')"
[[ -n "$desired" && "$desired" -gt 0 && "$ready" -ge "$desired" && "$available" -ge "$desired" ]] || { echo "[activity-runtime] FAIL replicas desired=$desired ready=$ready available=$available" >&2; exit 1; }

db_gate="$(psqlq "select
  (select count(*) from framework_process_step where process_code='ACTIVITY_DATA' and nullif(api_contract,'') is not null)=4
  and (select count(*) from framework_professional_screen_readiness where process_code='ACTIVITY_DATA' and readiness_score=100)>=8
  and (select count(distinct case_type) from framework_simulation_case where process_code='ACTIVITY_DATA')>=5
  and (select count(*) from framework_simulation_case c where process_code='ACTIVITY_DATA' and exists(select 1 from framework_simulation_run r where r.case_code=c.case_code and r.result='PASSED'))=(select count(*) from framework_simulation_case where process_code='ACTIVITY_DATA')
  and exists(select 1 from information_schema.columns where table_name='emission_activity_request' and column_name='accepted_at')
  and exists(select 1 from information_schema.tables where table_name='emission_activity_request_event')
  and exists(select 1 from information_schema.tables where table_name='emission_activity_evidence')
  and exists(select 1 from information_schema.columns where table_name='emission_activity_submission_evidence' and column_name='evidence_sha256')
  and exists(select 1 from information_schema.table_constraints where table_name='emission_activity_submission' and constraint_name='emission_activity_submission_sealed_check')
  and not exists(
    select 1 from emission_activity_submission submission
    where submission.submission_state<>'DRAFT'
      and (submission.submitted_item_count<=0 or submission.snapshot_hash is null or submission.quality_run_id is null)
  )
  and not exists(
    select 1 from emission_activity_request request
    where request.request_status<>'REQUESTED'
      and not exists(
        select 1 from emission_activity_request_event event
        where event.request_id=request.request_id and event.new_status=request.request_status
      )
  )
  and not exists(
    select 1 from emission_activity_request request
    where request.request_status='CORRECTION_REQUIRED'
      and (nullif(request.correction_reason,'') is null or request.correction_due_date is null)
  )
  and not exists(
    select 1 from emission_activity_request request
    where request.request_status='ACCEPTED'
      and (request.last_submission_id is null or request.accepted_at is null)
  )
  and not exists(
    select 1 from emission_activity_evidence evidence
    where octet_length(evidence.file_content)=0 or length(evidence.sha256)<>64
  )
  and exists(select 1 from framework_project_actor_assignment where project_id='$project_id' group by project_id having count(distinct actor_code)>=5)")"
[[ "$db_gate" == "t" ]] || { echo "[activity-runtime] FAIL DB/actor/scenario gate" >&2; exit 1; }

evidence="{\"projectId\":\"$project_id\",\"authenticatedApis\":${#api_paths[@]},\"protectedApis\":${#protected_paths[@]},\"pages\":${#page_paths[@]},\"p95Millis\":$p95_ms,\"actorAssignments\":5,\"simulationTypes\":5}"
if [[ "$EVIDENCE_MODE" == "candidate" ]]; then
  jq -cn --arg projectId "$project_id" --argjson authenticatedApiCount "${#api_paths[@]}" \
    --argjson protectedApiCount "${#protected_paths[@]}" --argjson pageCount "${#page_paths[@]}" \
    --argjson p95Millis "$p95_ms" --argjson readyReplicas "$ready" \
    '{projectId:$projectId,authenticatedApiCount:$authenticatedApiCount,protectedApiCount:$protectedApiCount,pageCount:$pageCount,p95Millis:$p95Millis,readyReplicas:$readyReplicas,actorAssignments:5,simulationTypes:5}' |
    bash "$ROOT/ops/scripts/stage-postdeploy-evidence-candidate.sh" ACTIVITY_DATA_RUNTIME ACTIVITY_DATA RUNTIME "$SOURCE_COMMIT"
else
sql="begin;
insert into framework_activity_runtime_validation_run(validation_status,authenticated_api_count,protected_api_count,page_count,p95_millis,ready_replicas,evidence_json,source_commit,executed_by)
values('PASSED',${#api_paths[@]},${#protected_paths[@]},${#page_paths[@]},$p95_ms,$ready,'$evidence','$SOURCE_COMMIT','AUTO_DEPLOY');
update framework_development_job set job_status='COMPLETED',approval_status='APPROVED',quality_status='PASSED',
 evidence_ref='runtime:activity-data-api+actor+integration+performance+deployment',last_error=null,completed_at=current_timestamp,updated_at=current_timestamp
where process_code='ACTIVITY_DATA' and job_type in ('ACTOR_TEST','DEPLOYMENT','INTEGRATION','PERFORMANCE','TEST');
update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='runtime:activity-data-api+actor+integration+performance+deployment',updated_at=current_timestamp
where process_code='ACTIVITY_DATA';
commit;"
psqlq "$sql" >/dev/null
fi
echo "[activity-runtime] PASS project=$project_id api=${#api_paths[@]} protected=${#protected_paths[@]} pages=${#page_paths[@]} p95=${p95_ms}ms replicas=$ready/$desired"
