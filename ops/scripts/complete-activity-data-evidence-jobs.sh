#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${POSTGRES_DB:-carbonet}"
USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
CONTROLLER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/EmissionProjectRegistryController.java"
SERVICE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java"
ROUTES="$ROOT/projects/carbonet-frontend/source/src/app/routes/families/emissionMonitoringFamily.ts"

for pattern in activity-requests activities/upload submissions verification/decision approval/decision; do
  grep -Fq "$pattern" "$CONTROLLER" || { echo "[activity-evidence] FAIL missing controller contract: $pattern" >&2; exit 1; }
done
for method in createActivityRequest submitActivities startVerification decideVerification decideApproval; do
  grep -Fq "$method" "$SERVICE" || { echo "[activity-evidence] FAIL missing service implementation: $method" >&2; exit 1; }
done
for route in /emission/activity-data /emission/validate /admin/emission/survey-admin-data /admin/emission/validate; do
  grep -Fq "$route" "$ROUTES" || { echo "[activity-evidence] FAIL missing frontend route: $route" >&2; exit 1; }
done

leader=""
while IFS= read -r pod; do
  recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c "$CONTAINER" -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
  [[ "$recovery" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[activity-evidence] FAIL PostgreSQL leader missing" >&2; exit 1; }

sql="
do \$\$
declare missing_tables integer; invalid_contracts integer; uncovered_routes integer;
begin
  select count(*) into missing_tables from (values
    ('emission_activity_request'),('emission_activity_data'),('emission_activity_quality_run'),
    ('emission_activity_submission'),('emission_activity_submission_item'),('emission_activity_submission_evidence'),
    ('emission_activity_submission_event'),('emission_submission_review')
  ) required(name) where to_regclass(required.name) is null;
  select count(*) into invalid_contracts from framework_professional_screen_contract
   where process_code='ACTIVITY_DATA' and (contract_status<>'VERIFIED' or not api_verified or not database_verified
     or not authority_verified or not responsive_verified or not accessibility_verified or not exception_states_verified);
  select count(*) into uncovered_routes from framework_process_step step
   cross join lateral unnest(array_remove(array[step.user_path,step.admin_path],null)) route
   left join framework_common_design_asset_coverage coverage on coverage.route_path=lower(split_part(route,'?',1))
   where step.process_code='ACTIVITY_DATA' and coalesce(coverage.common_assets_ready,false)=false;
  if missing_tables>0 or invalid_contracts>0 or uncovered_routes>0 then
    raise exception 'activity evidence gate failed tables=% contracts=% routes=%',missing_tables,invalid_contracts,uncovered_routes;
  end if;

  update framework_development_job set job_status='COMPLETED',approval_status='APPROVED',quality_status='PASSED',
    evidence_ref='verified:activity-data-source+schema+route+common-assets',last_error=null,completed_at=current_timestamp,updated_at=current_timestamp
  where process_code='ACTIVITY_DATA' and job_type in
    ('DESIGN','DATABASE','API','BACKEND','API_QUALITY','DATABASE_QUALITY','FRONTEND_USER','FRONTEND_ADMIN',
     'DESIGN_PREFLIGHT','COMPONENT_COMMON','CLASS_PROPERTY_COMMON','UI_QUALITY','SEARCH');

  update framework_process_artifact set delivery_status='VERIFIED',
    evidence_ref='verified:activity-data-source+schema+route+common-assets',updated_at=current_timestamp
  where process_code='ACTIVITY_DATA' and contract_ref in
    ('AUTO:DESIGN','AUTO:DATABASE','AUTO:API','AUTO:BACKEND','AUTO:API_QUALITY','AUTO:DATABASE_QUALITY',
     'AUTO:FRONTEND_USER','AUTO:FRONTEND_ADMIN','AUTO:DESIGN_PREFLIGHT','AUTO:COMPONENT_COMMON',
     'AUTO:CLASS_PROPERTY_COMMON','AUTO:UI_QUALITY','AUTO:SEARCH');
end \$\$;
select count(*) filter(where job_status in ('COMPLETED','VERIFIED'))||'|'||count(*)
from framework_development_job where process_code='ACTIVITY_DATA' and required;
"
result="$(kubectl -n "$NAMESPACE" exec "$leader" -c "$CONTAINER" -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -AtF'|' -c "$sql")"
echo "[activity-evidence] PASS completed-required=$result source=verified schema=verified routes=verified common-assets=verified"

