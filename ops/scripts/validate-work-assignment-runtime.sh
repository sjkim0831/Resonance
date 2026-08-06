#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://172.16.1.232}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
PROJECT_ID="${WORK_ASSIGNMENT_TEST_PROJECT:-PRJ-ACTOR-TEST}"
PROCESS_CODE="${WORK_ASSIGNMENT_TEST_PROCESS:-EMISSION_PROJECT}"
COOKIE_MANAGER="$(mktemp)"
COOKIE_DENIED="$(mktemp)"
WORK_DIR="$(mktemp -d)"
trap 'rm -f "$COOKIE_MANAGER" "$COOKIE_DENIED"; rm -rf "$WORK_DIR"' EXIT

fail() { printf '[work-assignment-runtime] FAIL %s\n' "$*" >&2; exit 1; }

if [[ -z "${CARBONET_ACTOR_TEST_PASSWORD:-}" ]]; then
  CARBONET_ACTOR_TEST_PASSWORD="$(kubectl -n "$NAMESPACE" get secret carbonet-test-account-switch -o jsonpath='{.data.password}' | base64 -d)"
fi
[[ -n "$CARBONET_ACTOR_TEST_PASSWORD" ]] || fail 'test credential unavailable'

login() {
  local account="$1" cookie="$2" body code
  body="$WORK_DIR/login-${account}.json"
  code="$(curl -sS -c "$cookie" -o "$body" -w '%{http_code}' -H 'Content-Type: application/json' \
    -X POST "$BASE_URL/signin/actionLogin" \
    --data "$(jq -nc --arg id "$account" --arg pw "$CARBONET_ACTOR_TEST_PASSWORD" '{userId:$id,userPw:$pw,userSe:"USR"}')")"
  [[ "$code" == 200 ]] || fail "login account=${account} http=${code}"
  jq -e '(.status // "") == "loginSuccess"' "$body" >/dev/null || fail "login account=${account} rejected"
}

get_workspace() {
  local cookie="$1" output="$2" code
  code="$(curl -sS -b "$cookie" -o "$output" -w '%{http_code}' -G \
    --data-urlencode "projectId=$PROJECT_ID" --data-urlencode "processCode=$PROCESS_CODE" \
    "$BASE_URL/home/api/work-assignments")"
  printf '%s' "$code"
}

post_assignments() {
  local cookie="$1" payload="$2" output="$3" expected="$4" code session csrf_name csrf_token
  session="$(curl -fsS -b "$cookie" "$BASE_URL/api/frontend/session")"
  csrf_name="$(jq -r '.csrfHeaderName // "X-CSRF-TOKEN"' <<<"$session")"
  csrf_token="$(jq -r '.csrfToken // ""' <<<"$session")"
  local -a headers=(-H 'Content-Type: application/json')
  [[ -z "$csrf_token" ]] || headers+=(-H "$csrf_name: $csrf_token")
  code="$(curl -sS -b "$cookie" -o "$output" -w '%{http_code}' "${headers[@]}" \
    -X POST "$BASE_URL/home/api/work-assignments" --data-binary "@$payload")"
  [[ "$code" == "$expected" ]] || fail "assignment POST expected=${expected} actual=${code} body=$(jq -c . "$output" 2>/dev/null || true)"
}

db_scalar() {
  local sql="$1" pod
  pod="$(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o jsonpath='{.items[0].metadata.name}')"
  kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -At -c "$sql"
}

login qaassign26 "$COOKIE_MANAGER"
[[ "$(get_workspace "$COOKIE_MANAGER" "$WORK_DIR/before.json")" == 200 ]] || fail 'manager workspace unavailable'
jq -e --arg project "$PROJECT_ID" --arg process "$PROCESS_CODE" '
  .canManage == true and
  any(.projects[]; .projectId == $project) and
  (([.steps[].stepCode] | length) == 7) and (([.steps[].stepCode] | unique | length) == 7) and
  ([.accounts[].accountId] | unique | contains(["qaowner26","qadata26","qacalc26","qaverify26","qaapprove26","qaassign26"]))
' "$WORK_DIR/before.json" >/dev/null || fail 'workspace contract mismatch'

# Preserve the exact current assignment so this validator is repeatable and non-destructive.
jq -e '{projectId:"'"$PROJECT_ID"'",processCode:"'"$PROCESS_CODE"'",processAccountId:(.processAssignment.accountId // "qaowner26"),assignments:[.steps[] | {stepCode,accountId}]} as $payload | select(all($payload.assignments[]; (.accountId // "") != "")) | $payload' \
  "$WORK_DIR/before.json" > "$WORK_DIR/restore.json" || fail 'baseline assignment is incomplete'

jq -n --arg project "$PROJECT_ID" --arg process "$PROCESS_CODE" '{
  projectId:$project,processCode:$process,processAccountId:"qaowner26",assignments:[
    {stepCode:"EMISSION_PROJECT_SETUP",accountId:"qaowner26"},
    {stepCode:"EMISSION_PROJECT_COLLECT",accountId:"qadata26"},
    {stepCode:"EMISSION_PROJECT_CALCULATE",accountId:"qacalc26"},
    {stepCode:"EMISSION_PROJECT_VALIDATE",accountId:"qaverify26"},
    {stepCode:"EMISSION_PROJECT_CORRECT",accountId:"qadata26"},
    {stepCode:"EMISSION_PROJECT_APPROVE",accountId:"qaapprove26"},
    {stepCode:"EMISSION_PROJECT_REPORT",accountId:"qaowner26"}
  ]}' > "$WORK_DIR/target.json"

audit_before="$(db_scalar "select count(*) from framework_work_assignment_audit where tenant_id='TEST_COMPANY_001' and project_id='$PROJECT_ID' and process_code='$PROCESS_CODE'")"
notification_before="$(db_scalar "select count(*) from emission_workflow_notification where tenant_id='TEST_COMPANY_001' and project_id='$PROJECT_ID' and event_type='ASSIGNED'")"
post_assignments "$COOKIE_MANAGER" "$WORK_DIR/target.json" "$WORK_DIR/saved.json" 200
jq -e '.success == true and .assignedStepCount == 7' "$WORK_DIR/saved.json" >/dev/null || fail 'save response contract mismatch'
[[ "$(get_workspace "$COOKIE_MANAGER" "$WORK_DIR/reread.json")" == 200 ]] || fail 'reread unavailable'
jq -e '([.steps[] | {(.stepCode):.accountId}] | add) as $a |
  $a.EMISSION_PROJECT_SETUP == "qaowner26" and $a.EMISSION_PROJECT_COLLECT == "qadata26" and
  $a.EMISSION_PROJECT_CALCULATE == "qacalc26" and $a.EMISSION_PROJECT_VALIDATE == "qaverify26" and
  $a.EMISSION_PROJECT_CORRECT == "qadata26" and $a.EMISSION_PROJECT_APPROVE == "qaapprove26" and
  $a.EMISSION_PROJECT_REPORT == "qaowner26" and .processAssignment.accountId == "qaowner26"' \
  "$WORK_DIR/reread.json" >/dev/null || fail 'saved assignments did not round-trip'

db_rows="$(db_scalar "select count(*) from framework_project_process_step_assignment where tenant_id='TEST_COMPANY_001' and project_id='$PROJECT_ID' and process_code='$PROCESS_CODE' and step_code in ('__PROCESS__','EMISSION_PROJECT_SETUP','EMISSION_PROJECT_COLLECT','EMISSION_PROJECT_CALCULATE','EMISSION_PROJECT_VALIDATE','EMISSION_PROJECT_CORRECT','EMISSION_PROJECT_APPROVE','EMISSION_PROJECT_REPORT')")"
[[ "$db_rows" == 8 ]] || fail "database assignment rows=${db_rows}, expected=8"
audit_after="$(db_scalar "select count(*) from framework_work_assignment_audit where tenant_id='TEST_COMPANY_001' and project_id='$PROJECT_ID' and process_code='$PROCESS_CODE'")"
(( audit_after - audit_before >= 7 )) || fail 'audit evidence was not appended'

# Fail-closed security, tenant isolation and validation checks.
login qadata26 "$COOKIE_DENIED"
[[ "$(get_workspace "$COOKIE_DENIED" "$WORK_DIR/denied.json")" == 403 ]] || fail 'non-manager was not denied'
jq -e '.message == "WORK_ASSIGNMENT_MANAGER_REQUIRED"' "$WORK_DIR/denied.json" >/dev/null || fail 'non-manager denial code mismatch'

jq -n '{projectId:"PRJ-2025-018",processCode:"EMISSION_PROJECT",processAccountId:"qaowner26",assignments:[{stepCode:"EMISSION_PROJECT_SETUP",accountId:"qaowner26"}]}' > "$WORK_DIR/cross-tenant.json"
post_assignments "$COOKIE_MANAGER" "$WORK_DIR/cross-tenant.json" "$WORK_DIR/cross-tenant-result.json" 403

process_before="$(jq -r '.processAssignment.accountId' "$WORK_DIR/reread.json")"
jq -n --arg project "$PROJECT_ID" --arg process "$PROCESS_CODE" '{projectId:$project,processCode:$process,processAccountId:"qadata26",assignments:[]}' > "$WORK_DIR/empty.json"
post_assignments "$COOKIE_MANAGER" "$WORK_DIR/empty.json" "$WORK_DIR/empty-result.json" 400
[[ "$(get_workspace "$COOKIE_MANAGER" "$WORK_DIR/after-invalid.json")" == 200 ]] || fail 'post-validation reread unavailable'
[[ "$(jq -r '.processAssignment.accountId' "$WORK_DIR/after-invalid.json")" == "$process_before" ]] || fail 'invalid request was not rolled back transactionally'

# Restore the exact baseline and prove recovery.
post_assignments "$COOKIE_MANAGER" "$WORK_DIR/restore.json" "$WORK_DIR/restored-save.json" 200
[[ "$(get_workspace "$COOKIE_MANAGER" "$WORK_DIR/restored.json")" == 200 ]] || fail 'restored workspace unavailable'
jq -e --slurpfile baseline "$WORK_DIR/before.json" '
  ([.steps[] | {stepCode,accountId}] | sort_by(.stepCode)) == ([$baseline[0].steps[] | {stepCode,accountId}] | sort_by(.stepCode)) and
  .processAssignment.accountId == $baseline[0].processAssignment.accountId
' "$WORK_DIR/restored.json" >/dev/null || fail 'baseline recovery mismatch'

notification_after="$(db_scalar "select count(*) from emission_workflow_notification where tenant_id='TEST_COMPANY_001' and project_id='$PROJECT_ID' and event_type='ASSIGNED'")"
task_updated="$(db_scalar "select count(*) from emission_project_task where project_id='$PROJECT_ID' and process_code='$PROCESS_CODE' and assignee_id is not null")"
printf '[work-assignment-runtime] PASS project=%s process=%s steps=7 dbRows=%s auditDelta=%s notificationDelta=%s assignedTasks=%s negatives=3 recovery=PASS\n' \
  "$PROJECT_ID" "$PROCESS_CODE" "$db_rows" "$((audit_after-audit_before))" "$((notification_after-notification_before))" "$task_updated"
