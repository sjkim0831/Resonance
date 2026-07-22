#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${POSTGRES_DB:-carbonet}"
USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
LOGIN_USER="${CARBONET_RUNTIME_TEST_USER:-webmaster}"
LOGIN_PASSWORD="${CARBONET_RUNTIME_TEST_PASSWORD:-rhdxhd12}"
SOURCE_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
COOKIE_JAR="$(mktemp)"
TIMINGS="$(mktemp)"
API_BODY="$(mktemp)"
PAGE_BODY="$(mktemp)"
EVIDENCE_DIR="${CARBONET_RUNTIME_SMOKE_EVIDENCE_DIR:-$ROOT/var/test-evidence/process-runtime-smoke}"
PROMOTE_JOBS="${CARBONET_ORG_BOUNDARY_PROMOTE_JOBS:-true}"
trap 'rm -f "$COOKIE_JAR" "$TIMINGS" "$API_BODY" "$PAGE_BODY"' EXIT

leader=""
while IFS= read -r pod; do
  recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c "$CONTAINER" -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
  [[ "$recovery" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo '[organizational-boundary-runtime] FAIL PostgreSQL leader missing' >&2; exit 1; }
psqlq(){ kubectl -n "$NAMESPACE" exec "$leader" -c "$CONTAINER" -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -Atqc "$1"; }

project_id="$(psqlq "select p.project_id from emission_project_registry p where p.project_status<>'DELETED' and exists(select 1 from framework_project_actor_assignment a where a.project_id=p.project_id and a.active_yn='Y') order by p.updated_at desc limit 1")"
[[ -n "$project_id" ]] || { echo '[organizational-boundary-runtime] FAIL no testable emission project' >&2; exit 1; }

login_body="$(curl -fsS -c "$COOKIE_JAR" -H 'Content-Type: application/json' -X POST "$BASE_URL/admin/login/actionLogin" --data "{\"userId\":\"$LOGIN_USER\",\"userPw\":\"$LOGIN_PASSWORD\",\"userSe\":\"USR\"}")"
jq -e --arg user "$LOGIN_USER" '.status == "loginSuccess" and (.userId | ascii_downcase) == ($user | ascii_downcase)' >/dev/null <<<"$login_body" \
  || { echo '[organizational-boundary-runtime] FAIL login rejected' >&2; exit 1; }

api_path="/home/api/emission-projects/$project_id/organizational-boundary"
code="$(curl -sS -b "$COOKIE_JAR" -o "$API_BODY" -w '%{http_code}' "$BASE_URL$api_path")"
[[ "$code" == 200 ]] && jq -e --arg project "$project_id" '.project.projectId == $project or .project.id == $project' >/dev/null "$API_BODY" \
  || { echo "[organizational-boundary-runtime] FAIL authenticated API status=$code" >&2; exit 1; }
code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL$api_path")"
[[ "$code" == 401 || "$code" == 403 ]] || { echo "[organizational-boundary-runtime] FAIL unauthenticated API status=$code" >&2; exit 1; }

pages=("/emission/organizational-boundary?projectId=$project_id" "/admin/emission/organizational-boundary?projectId=$project_id")
for path in "${pages[@]}"; do
  code="$(curl -sS -L -b "$COOKIE_JAR" -o "$PAGE_BODY" -w '%{http_code}' "$BASE_URL$path")"
  [[ "$code" == 200 ]] && grep -qi '<!doctype html' "$PAGE_BODY" \
    || { echo "[organizational-boundary-runtime] FAIL page=$path status=$code" >&2; exit 1; }
done

CARBONET_RUNTIME_SMOKE_USER="$LOGIN_USER" CARBONET_RUNTIME_SMOKE_PASSWORD="$LOGIN_PASSWORD" \
CARBONET_RUNTIME_SMOKE_PROCESS=ORGANIZATIONAL_BOUNDARY CARBONET_RUNTIME_SMOKE_PROMOTE=false \
CARBONET_RUNTIME_SMOKE_EVIDENCE_DIR="$EVIDENCE_DIR" CARBONET_RUNTIME_BASE_URL="$BASE_URL" \
  bash "$ROOT/ops/scripts/run-process-runtime-smoke.sh" >/dev/null
runtime_evidence="$(readlink -f "$EVIDENCE_DIR/latest.json")"
[[ -s "$runtime_evidence" ]] || { echo '[organizational-boundary-runtime] FAIL runtime evidence missing' >&2; exit 1; }

for step in ORGANIZATIONAL_BOUNDARY_S1 ORGANIZATIONAL_BOUNDARY_S2 ORGANIZATIONAL_BOUNDARY_S3 ORGANIZATIONAL_BOUNDARY_S4; do
  bash "$ROOT/ops/scripts/validate-existing-emission-project-api.sh" "$ROOT" ORGANIZATIONAL_BOUNDARY "$step" >/dev/null
  bash "$ROOT/ops/scripts/validate-existing-emission-project-database.sh" "$ROOT" ORGANIZATIONAL_BOUNDARY "$step" DATABASE_QUALITY >/dev/null
  bash "$ROOT/ops/scripts/validate-existing-emission-project-search.sh" "$ROOT" ORGANIZATIONAL_BOUNDARY "$step" >/dev/null
done

for _ in $(seq 1 20); do curl -sS -b "$COOKIE_JAR" -o /dev/null -w '%{time_total}\n' "$BASE_URL$api_path" >>"$TIMINGS"; done
p95_ms="$(sort -n "$TIMINGS" | awk 'NR==19 {printf "%d",$1*1000}')"
[[ -n "$p95_ms" && "$p95_ms" -le 2500 ]] || { echo "[organizational-boundary-runtime] FAIL p95=${p95_ms:-unknown}ms" >&2; exit 1; }
read -r desired ready available <<<"$(kubectl -n "$NAMESPACE" get deploy carbonet-runtime -o jsonpath='{.spec.replicas} {.status.readyReplicas} {.status.availableReplicas}')"
[[ -n "$desired" && "$desired" -gt 0 && "$ready" -ge "$desired" && "$available" -ge "$desired" ]] \
  || { echo "[organizational-boundary-runtime] FAIL replicas desired=$desired ready=$ready available=$available" >&2; exit 1; }

db_gate="$(psqlq "select
 (select count(*) from framework_process_step where process_code='ORGANIZATIONAL_BOUNDARY' and nullif(api_contract,'') is not null)=4
 and (select count(*) from framework_professional_design_graph_quality where process_code='ORGANIZATIONAL_BOUNDARY' and design_status='READY')=4
 and (select count(*) from framework_professional_screen_readiness where process_code='ORGANIZATIONAL_BOUNDARY' and readiness_score=100)=8
 and (select count(distinct case when case_type in('EXCEPTION','VALIDATION') then 'EXCEPTION' else case_type end) from framework_simulation_case where process_code='ORGANIZATIONAL_BOUNDARY' and case_type in('HAPPY_PATH','AUTHORITY','ISOLATION','RECOVERY','EXCEPTION','VALIDATION'))=5
 and (select count(distinct case when c.case_type in('EXCEPTION','VALIDATION') then 'EXCEPTION' else c.case_type end) from framework_simulation_case c where c.process_code='ORGANIZATIONAL_BOUNDARY' and c.case_type in('HAPPY_PATH','AUTHORITY','ISOLATION','RECOVERY','EXCEPTION','VALIDATION') and exists(select 1 from framework_simulation_run r where r.case_code=c.case_code and r.result='PASSED'))=5
 and to_regclass('emission_organizational_boundary') is not null
 and to_regclass('emission_organizational_boundary_member') is not null
 and to_regclass('emission_organizational_boundary_elimination') is not null
 and to_regclass('emission_organizational_boundary_consolidation') is not null
 and to_regclass('emission_workflow_notification') is not null")"
[[ "$db_gate" == t ]] || { echo '[organizational-boundary-runtime] FAIL design/data/test gate' >&2; exit 1; }

evidence="runtime:organizational-boundary-api+actor+isolation+rollback+notification+integration+performance+deployment:$SOURCE_COMMIT"
sql="begin;
insert into framework_organizational_boundary_runtime_validation_run(validation_status,project_id,authenticated_api_count,protected_api_count,page_count,p95_millis,ready_replicas,runtime_evidence_ref,source_commit,executed_by)
values('PASSED','$project_id',1,1,${#pages[@]},$p95_ms,$ready,'$runtime_evidence','$SOURCE_COMMIT',case when '$PROMOTE_JOBS'='true' then 'AUTO_DEPLOY' else 'DEVELOPMENT_GATE' end);"
if [[ "$PROMOTE_JOBS" == true ]]; then
sql+="
with candidate as (
 select job_id,job_status from framework_development_job where process_code='ORGANIZATIONAL_BOUNDARY' and required
), updated as (
 update framework_development_job j set job_status='COMPLETED',approval_status='APPROVED',quality_status='PASSED',evidence_ref='$evidence',last_error=null,completed_at=current_timestamp,worker_id=null,lease_token=null,lease_until=null,updated_at=current_timestamp
 from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status
)
insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
select job_id,'RUNTIME_ASSURANCE_VERIFIED',job_status,'COMPLETED','organizational-boundary-runtime',jsonb_build_object('commit','$SOURCE_COMMIT','evidence','$runtime_evidence','p95Millis',$p95_ms,'readyReplicas',$ready) from updated where job_status<>'COMPLETED';
update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='$evidence',updated_at=current_timestamp where process_code='ORGANIZATIONAL_BOUNDARY';
update framework_process_definition set definition_locked=true,process_status='ACTIVE',updated_at=current_timestamp where process_code='ORGANIZATIONAL_BOUNDARY';
"
fi
sql+="commit;"
psqlq "$sql" >/dev/null

status="$(psqlq "select assurance_status||'|'||design_accuracy_score||'|'||verified_job_count||'/'||required_job_count from framework_process_design_assurance_matrix where process_code='ORGANIZATIONAL_BOUNDARY'")"
if [[ "$PROMOTE_JOBS" == true ]]; then
  [[ "$status" == IMPLEMENTATION_VERIFIED\|100\|* ]] || { echo "[organizational-boundary-runtime] FAIL assurance=$status" >&2; exit 1; }
fi
echo "[organizational-boundary-runtime] PASS project=$project_id pages=${#pages[@]} p95=${p95_ms}ms replicas=$ready/$desired assurance=$status evidence=$runtime_evidence"
