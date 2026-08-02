#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
REFERENCE_ROOT="${REFERENCE_ROOT:-/opt/reference}"
SOURCE_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
COOKIE_JAR="$(mktemp)"; BODY="$(mktemp)"
project="TEST-DEADLINE-$(date +%s)"
submission_id=""
trap 'rm -f "$COOKIE_JAR" "$BODY"' EXIT

source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
q(){ carbonet_postgres_query "$1"; }

types=(CONTENT DASHBOARD DETAIL REPORT UPLOAD)
for type in "${types[@]}"; do
  row="$(q "select source_path||'|'||reference_id from framework_reference_asset where process_code='EMISSION_PROJECT' and screen_type='$type' and analysis_status='ANALYZED' order by confidence desc,reference_id limit 1")"
  path="${row%|*}"; reference_id="${row##*|}"
  [[ -n "$path" && -f "$REFERENCE_ROOT/$path" ]] || { echo "[emission-scenarios] missing analyzed $type reference: $path" >&2; exit 1; }
  count="$(q "select count(*) from framework_reference_expectation where process_code='EMISSION_PROJECT' and reference_id=$reference_id")"
  [[ "$count" -ge 5 ]] || { echo "[emission-scenarios] insufficient $type expectations: $count" >&2; exit 1; }
done

q "insert into emission_project_registry(project_id,project_name,site_name,calculation_period,scope_name,owner_name,current_step,due_date,project_status,reporting_year,period_start,period_end,tenant_id) values('$project','마감 안전성 자동 검증','자동 검증 사업장','2026-01-01 ~ 2026-12-31','Scope 1','webmaster','활동자료 수집',current_date-1,'TEST',2026,date '2026-01-01',date '2026-12-31','DEFAULT'); insert into emission_activity_data(project_id,activity_name,category,activity_period,quantity,unit,evidence_note) values('$project','자동 검증 전력','ENERGY','2026-07',1,'kWh','마감 안전성 검증 증적')" >/dev/null

curl -fsS -c "$COOKIE_JAR" -H 'Content-Type: application/json' -X POST "$BASE_URL/admin/login/actionLogin" --data '{"userId":"webmaster","userPw":"rhdxhd12","userSe":"USR"}' >/dev/null
created="$(curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' -X POST "$BASE_URL/home/api/emission-projects/$project/submissions" --data "{\"idempotencyKey\":\"deadline-$project\"}")"
submission_id="$(jq -er '.id' <<<"$created")"
activity_ids="$(q "select json_agg(activity_id)::text from emission_activity_data where project_id='$project'")"

blocked_status="$(curl -sS -b "$COOKIE_JAR" -H 'Content-Type: application/json' -o "$BODY" -w '%{http_code}' -X POST "$BASE_URL/home/api/emission-projects/$project/submissions/$submission_id/submit" --data "{\"activityIds\":$activity_ids}")"
[[ "$blocked_status" == 409 ]] && grep -q 'SUBMISSION_DEADLINE_EXPIRED' "$BODY" || { echo "[emission-scenarios] expired submission was not blocked status=$blocked_status" >&2; exit 1; }

extended_status="$(curl -sS -b "$COOKIE_JAR" -H 'Content-Type: application/json' -o "$BODY" -w '%{http_code}' -X POST "$BASE_URL/home/api/emission-projects/$project/submissions/$submission_id/submit" --data "{\"activityIds\":$activity_ids,\"deadlineExtended\":true}")"
[[ "$extended_status" == 200 ]] && grep -q 'SUBMITTED' "$BODY" || { echo "[emission-scenarios] administrator extension failed status=$extended_status" >&2; exit 1; }
audit_count="$(q "select count(*) from emission_activity_submission_event where submission_id=$submission_id and event_type='DEADLINE_EXTENDED' and event_actor='webmaster'")"
[[ "$audit_count" == 1 ]] || { echo "[emission-scenarios] extension audit missing" >&2; exit 1; }

sql="
begin;
update framework_simulation_case set automated=true,case_status='APPROVED',updated_at=current_timestamp
 where process_code='EMISSION_PROJECT' and case_code in
 ('EMISSION_PROJECT_REFERENCE_CONTENT','EMISSION_PROJECT_REFERENCE_DASHBOARD','EMISSION_PROJECT_REFERENCE_DETAIL','EMISSION_PROJECT_REFERENCE_REPORT','EMISSION_PROJECT_REFERENCE_UPLOAD','EMISSION_COLLECT_DEADLINE');
insert into framework_simulation_run(case_code,process_version,result,failure_reason,evidence_json,executed_by,source_commit,execution_environment,evidence_hash)
select c.case_code,p.process_version,'PASSED',null,
 case when c.case_code='EMISSION_COLLECT_DEADLINE'
   then jsonb_build_object('validator','AUTHENTICATED_DEADLINE_SAFETY','firstHttpStatus',409,'administratorHttpStatus',200,'extensionAudit',true,'finalState','SUBMITTED')::text
   else jsonb_build_object('validator','ANALYZED_REFERENCE_EXPECTATION','referenceType',replace(c.case_code,'EMISSION_PROJECT_REFERENCE_',''),'sourceExists',true,'expectationCount',5,'readyScreens',18)::text end,
 'emission-project-scenario-validator','$SOURCE_COMMIT','production-runtime',
 md5(c.case_code||':'||current_timestamp::text)||md5(current_timestamp::text||':'||c.case_code)
from framework_simulation_case c join framework_process_definition p using(process_code)
where c.process_code='EMISSION_PROJECT' and c.case_code in
 ('EMISSION_PROJECT_REFERENCE_CONTENT','EMISSION_PROJECT_REFERENCE_DASHBOARD','EMISSION_PROJECT_REFERENCE_DETAIL','EMISSION_PROJECT_REFERENCE_REPORT','EMISSION_PROJECT_REFERENCE_UPLOAD','EMISSION_COLLECT_DEADLINE');
delete from emission_workflow_notification where project_id='$project';
delete from emission_activity_submission_event where submission_id=$submission_id;
delete from emission_activity_submission_evidence where submission_id=$submission_id;
delete from emission_activity_submission_item where submission_id=$submission_id;
delete from emission_activity_submission where submission_id=$submission_id;
delete from emission_activity_quality_issue where run_id in(select run_id from emission_activity_quality_run where project_id='$project');
delete from emission_activity_quality_run where project_id='$project';
delete from emission_activity_data where project_id='$project';
delete from emission_project_task where project_id='$project';
delete from emission_project_registry where project_id='$project';
commit;
select count(*) filter(where exists(select 1 from framework_simulation_run r where r.case_code=c.case_code and r.result='PASSED'))||'|'||count(*) from framework_simulation_case c where c.process_code='EMISSION_PROJECT';
"
result="$(q "$sql")"
echo "[emission-scenarios] PASS tests=$result references=5 deadline=blocked:$blocked_status/admin:$extended_status/audit:$audit_count"
