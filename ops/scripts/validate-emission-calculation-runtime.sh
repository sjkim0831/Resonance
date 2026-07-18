#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"; DATABASE="${POSTGRES_DB:-carbonet}"
USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"; CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"; SOURCE_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
COOKIE_JAR="$(mktemp)"; TIMINGS="$(mktemp)"; trap 'rm -f "$COOKIE_JAR" "$TIMINGS"' EXIT
leader=""
while IFS= read -r pod; do
  recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c "$CONTAINER" -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
  [[ "$recovery" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || exit 1
psqlq(){ kubectl -n "$NAMESPACE" exec "$leader" -c "$CONTAINER" -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -Atqc "$1"; }
project_id="$(psqlq "select project_id from emission_calculation_run group by project_id order by max(calculated_at) desc limit 1")"
[[ -n "$project_id" ]] || { echo '[calculation-runtime] FAIL no calculated project' >&2; exit 1; }
curl -fsS -c "$COOKIE_JAR" -H 'Content-Type: application/json' -X POST "$BASE_URL/admin/login/actionLogin" --data '{"userId":"webmaster","userPw":"rhdxhd12","userSe":"USR"}' >/dev/null
api_paths=("/home/api/emission-projects/$project_id" "/home/api/emission-projects/$project_id/activities" "/home/api/emission-projects/$project_id/calculation" "/home/api/emission-projects/$project_id/quality" "/home/api/emission-projects/$project_id/review-workflow")
for path in "${api_paths[@]}"; do code="$(curl -sS -b "$COOKIE_JAR" -o /tmp/calculation-runtime.json -w '%{http_code}' "$BASE_URL$path")"; [[ "$code" == 200 ]] || { echo "[calculation-runtime] FAIL api=$path status=$code" >&2; exit 1; }; grep -Eq '^\s*[\{\[]' /tmp/calculation-runtime.json || exit 1; done
for path in "/home/api/emission-projects/$project_id/calculation" "/home/api/emission-projects/$project_id/review-workflow"; do code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL$path")"; [[ "$code" == 401 || "$code" == 403 ]] || { echo "[calculation-runtime] FAIL protection=$path status=$code" >&2; exit 1; }; done
pages=("/emission/project/detail?projectId=$project_id" "/emission/calculation?projectId=$project_id" "/emission/validate?projectId=$project_id" "/emission/calculation-results?projectId=$project_id" "/admin/emission/project-operations" "/admin/emission/calculation-rule" "/admin/emission/validate" "/admin/emission/result_list")
for path in "${pages[@]}"; do code="$(curl -sS -L -b "$COOKIE_JAR" -o /tmp/calculation-runtime.html -w '%{http_code}' "$BASE_URL$path")"; [[ "$code" == 200 ]] || { echo "[calculation-runtime] FAIL page=$path status=$code" >&2; exit 1; }; grep -qi '<!doctype html' /tmp/calculation-runtime.html || exit 1; done
for _ in $(seq 1 20); do curl -sS -b "$COOKIE_JAR" -o /dev/null -w '%{time_total}\n' "$BASE_URL/home/api/emission-projects/$project_id/calculation" >>"$TIMINGS"; done
p95_ms="$(sort -n "$TIMINGS" | awk 'NR==19 {printf "%d",$1*1000}')"; [[ "$p95_ms" -le 2500 ]] || exit 1
read -r desired ready available <<<"$(kubectl -n "$NAMESPACE" get deploy carbonet-runtime -o jsonpath='{.spec.replicas} {.status.readyReplicas} {.status.availableReplicas}')"; [[ "$desired" == 2 && "$ready" == 2 && "$available" == 2 ]] || exit 1
db_gate="$(psqlq "select (select count(*) from framework_process_step where process_code='EMISSION_CALCULATION' and nullif(api_contract,'') is not null)=4 and (select count(*) from framework_professional_screen_readiness where process_code='EMISSION_CALCULATION' and readiness_score=100)=8 and (select count(distinct case_type) from framework_simulation_case where process_code='EMISSION_CALCULATION')>=5 and exists(select 1 from emission_calculation_run r join emission_calculation_item i on i.calculation_id=r.calculation_id where r.project_id='$project_id' group by r.calculation_id,r.total_emission having abs(r.total_emission-sum(i.emission_value))<0.000001)")"; [[ "$db_gate" == t ]] || { echo '[calculation-runtime] FAIL DB/formula/design gate' >&2; exit 1; }
sql="begin; update framework_development_job set job_status='COMPLETED',approval_status='APPROVED',quality_status='PASSED',evidence_ref='runtime:calculation-api+formula+integration+performance+deployment',last_error=null,completed_at=current_timestamp,updated_at=current_timestamp where process_code='EMISSION_CALCULATION' and job_type in ('ACTOR_TEST','DEPLOYMENT','INTEGRATION','PERFORMANCE','TEST'); update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='runtime:calculation-api+formula+integration+performance+deployment',updated_at=current_timestamp where process_code='EMISSION_CALCULATION'; commit;"; psqlq "$sql" >/dev/null
echo "[calculation-runtime] PASS project=$project_id api=${#api_paths[@]} protected=2 pages=${#pages[@]} formula=reconciled p95=${p95_ms}ms replicas=$ready/$desired commit=$SOURCE_COMMIT"
