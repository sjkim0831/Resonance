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
EVIDENCE_DIR="${CARBONET_RUNTIME_SMOKE_EVIDENCE_DIR:-$ROOT/var/test-evidence/process-runtime-smoke}"
PROMOTE_JOBS="${CARBONET_GOVERNANCE_PROMOTE_JOBS:-true}"
COOKIE_JAR="$(mktemp)"; DASHBOARD="$(mktemp)"; PAGE="$(mktemp)"
trap 'rm -f "$COOKIE_JAR" "$DASHBOARD" "$PAGE"' EXIT

leader=""
while IFS= read -r pod; do
  recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c "$CONTAINER" -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
  [[ "$recovery" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo '[governance-change-runtime] FAIL PostgreSQL leader missing' >&2; exit 1; }
psqlq(){ kubectl -n "$NAMESPACE" exec "$leader" -c "$CONTAINER" -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -Atqc "$1"; }

grep -Fq 'stepExecutionSpecs' "$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"
grep -Fq '단계별 전문 입력 항목' "$ROOT/projects/carbonet-frontend/source/src/features/process-step-workspace/ProcessStepWorkspacePage.tsx"
if grep -Fq '�' "$ROOT/projects/carbonet-frontend/source/src/features/process-step-workspace/ProcessStepWorkspacePage.tsx" \
  || grep -Fq '?쒕' "$ROOT/projects/carbonet-frontend/source/src/features/process-step-workspace/ProcessStepWorkspacePage.tsx" \
  || grep -Fq '愿由ъ옄' "$ROOT/projects/carbonet-frontend/source/src/features/process-step-workspace/ProcessStepWorkspacePage.tsx"; then
  echo '[governance-change-runtime] FAIL mojibake remains in process workspace source' >&2; exit 1
fi

CARBONET_RUNTIME_SMOKE_USER="$LOGIN_USER" CARBONET_RUNTIME_SMOKE_PASSWORD="$LOGIN_PASSWORD" \
CARBONET_RUNTIME_SMOKE_PROCESS=GOVERNANCE_CHANGE CARBONET_RUNTIME_SMOKE_PROMOTE=true \
CARBONET_RUNTIME_SMOKE_EVIDENCE_DIR="$EVIDENCE_DIR" CARBONET_RUNTIME_BASE_URL="$BASE_URL" \
  bash "$ROOT/ops/scripts/run-process-runtime-smoke.sh" >/dev/null
runtime_evidence="$(readlink -f "$EVIDENCE_DIR/latest.json")"
[[ -s "$runtime_evidence" ]] || { echo '[governance-change-runtime] FAIL runtime evidence missing' >&2; exit 1; }

login_code="$(curl -sS -c "$COOKIE_JAR" -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE_URL/signin/actionLogin" --data "{\"userId\":\"$LOGIN_USER\",\"userPw\":\"$LOGIN_PASSWORD\",\"userSe\":\"USR\"}")"
[[ "$login_code" == 200 ]] || { echo "[governance-change-runtime] FAIL login status=$login_code" >&2; exit 1; }
api_code="$(curl -sS -b "$COOKIE_JAR" -o "$DASHBOARD" -w '%{http_code}' "$BASE_URL/admin/api/system/actor-process/process-design?processCode=GOVERNANCE_CHANGE")"
[[ "$api_code" == 200 ]] || { echo "[governance-change-runtime] FAIL process design status=$api_code" >&2; exit 1; }
jq -e '
  (.process.processCode=="GOVERNANCE_CHANGE") and
  ([.steps[]|select(.processCode=="GOVERNANCE_CHANGE" and (.requirementText|length)>20)]|length)==6 and
  ([.stepExecutionSpecs[]|(.fieldContract|fromjson|length)]|length)==6 and
  ([.stepExecutionSpecs[]|(.fieldContract|fromjson|length)]|all(.>=8)) and
  ([.professionalScreens[]|select(.designReadinessScore==100)]|length)>=12
' "$DASHBOARD" >/dev/null || { echo '[governance-change-runtime] FAIL process-scoped professional contracts' >&2; exit 1; }

page_code="$(curl -sS -L -b "$COOKIE_JAR" -o "$PAGE" -w '%{http_code}' "$BASE_URL/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_REQUEST")"
[[ "$page_code" == 200 ]] && grep -qi '<!doctype html' "$PAGE" || { echo "[governance-change-runtime] FAIL workspace status=$page_code" >&2; exit 1; }

read -r desired ready available <<<"$(kubectl -n "$NAMESPACE" get deploy carbonet-runtime -o jsonpath='{.spec.replicas} {.status.readyReplicas} {.status.availableReplicas}')"
[[ -n "$desired" && "$desired" -gt 0 && "$ready" -ge "$desired" && "$available" -ge "$desired" ]] || { echo "[governance-change-runtime] FAIL replicas desired=$desired ready=$ready available=$available" >&2; exit 1; }

IFS='|' read -r step_gate spec_gate screen_gate approved_case_gate passed_case_gate <<<"$(psqlq "select
 (select count(*) from framework_process_step where process_code='GOVERNANCE_CHANGE' and nullif(requirement_text,'') is not null and nullif(completion_rule,'') is not null and requires_admin_page and requires_api),
 (select count(*) from framework_step_execution_spec where process_code='GOVERNANCE_CHANGE' and design_status='DESIGN_COMPLETE' and approval_status='APPROVED' and jsonb_array_length(field_contract)>=8),
 (select count(distinct step_code) from framework_professional_screen_contract where process_code='GOVERNANCE_CHANGE' and lower(split_part(route_path,'?',1))='/admin/system/process-workspace' and contract_status='VERIFIED' and api_verified and database_verified and authority_verified and responsive_verified and accessibility_verified and exception_states_verified),
 (select count(distinct case when case_type in('EXCEPTION','VALIDATION') then 'EXCEPTION' else case_type end) from framework_simulation_case where process_code='GOVERNANCE_CHANGE' and case_status in('APPROVED','VERIFIED') and case_type in('HAPPY_PATH','AUTHORITY','ISOLATION','RECOVERY','EXCEPTION','VALIDATION')),
 (select count(distinct case when c.case_type in('EXCEPTION','VALIDATION') then 'EXCEPTION' else c.case_type end) from framework_simulation_case c where c.process_code='GOVERNANCE_CHANGE' and c.case_type in('HAPPY_PATH','AUTHORITY','ISOLATION','RECOVERY','EXCEPTION','VALIDATION') and exists(select 1 from framework_simulation_run r where r.case_code=c.case_code and r.result='PASSED'))")"
[[ "$step_gate" == 6 && "$spec_gate" == 6 && "$screen_gate" == 6 && "$approved_case_gate" == 5 && "$passed_case_gate" == 5 ]] || {
  echo "[governance-change-runtime] FAIL design/screen/test gate steps=$step_gate specs=$spec_gate screens=$screen_gate approvedCases=$approved_case_gate passedCases=$passed_case_gate" >&2
  exit 1
}

if [[ "$PROMOTE_JOBS" == true ]]; then
  evidence="runtime:governance-change+professional-fields+actor+isolation+rollback+deployment:$SOURCE_COMMIT"
  psqlq "begin;
  with candidate as (select job_id,job_status from framework_development_job where process_code='GOVERNANCE_CHANGE' and required), updated as (
    update framework_development_job j set job_status='COMPLETED',approval_status='APPROVED',quality_status='PASSED',evidence_ref='$evidence',last_error=null,completed_at=current_timestamp,worker_id=null,lease_token=null,lease_until=null,updated_at=current_timestamp from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status)
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'RUNTIME_ASSURANCE_VERIFIED',job_status,'COMPLETED','governance-change-runtime',jsonb_build_object('commit','$SOURCE_COMMIT','evidence','$runtime_evidence','readyReplicas',$ready) from updated where job_status<>'COMPLETED';
  update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='$evidence',updated_at=current_timestamp where process_code='GOVERNANCE_CHANGE';
  update framework_process_definition set definition_locked=true,process_status='ACTIVE',updated_at=current_timestamp where process_code='GOVERNANCE_CHANGE';
  commit;" >/dev/null
fi

status="$(psqlq "select assurance_status||'|'||design_accuracy_score||'|'||verified_job_count||'/'||required_job_count from framework_process_design_assurance_matrix where process_code='GOVERNANCE_CHANGE'")"
if [[ "$PROMOTE_JOBS" == true ]]; then [[ "$status" == IMPLEMENTATION_VERIFIED\|100\|* ]] || { echo "[governance-change-runtime] FAIL assurance=$status" >&2; exit 1; }; fi
echo "[governance-change-runtime] PASS steps=6 fields=48 replicas=$ready/$desired assurance=$status evidence=$runtime_evidence"
