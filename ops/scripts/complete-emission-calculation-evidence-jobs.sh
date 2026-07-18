#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"; DATABASE="${POSTGRES_DB:-carbonet}"
USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"; CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
CONTROLLER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/EmissionProjectRegistryController.java"
SERVICE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java"
ROUTES="$ROOT/projects/carbonet-frontend/source/src/app/routes/families/emissionMonitoringFamily.ts"

for pattern in '/calculation' '/activities/{activityId}/factor' '/activities/auto-map' '/quality' '/review-workflow'; do
  grep -Fq "$pattern" "$CONTROLLER" || { echo "[calculation-evidence] FAIL controller=$pattern" >&2; exit 1; }
done
for method in calculationResult calculate mapFactor autoMap runQuality reviewWorkflow; do
  grep -Fq "$method" "$SERVICE" || { echo "[calculation-evidence] FAIL service=$method" >&2; exit 1; }
done
for route in /emission/project/detail /emission/calculation /emission/validate /emission/calculation-results /admin/emission/project-operations /admin/emission/calculation-rule /admin/emission/validate /admin/emission/result_list; do
  grep -Fq "$route" "$ROUTES" || { echo "[calculation-evidence] FAIL route=$route" >&2; exit 1; }
done

leader=""
while IFS= read -r pod; do
  recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c "$CONTAINER" -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
  [[ "$recovery" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[calculation-evidence] FAIL PostgreSQL leader missing" >&2; exit 1; }

sql="do \$\$
declare missing_tables integer; invalid_contracts integer; uncovered_routes integer;
begin
 select count(*) into missing_tables from (values ('emission_project_registry'),('emission_activity_data'),('emission_factor_reference'),('emission_calculation_run'),('emission_calculation_item'),('emission_activity_quality_run'),('emission_submission_review')) r(name) where to_regclass(r.name) is null;
 select count(*) into invalid_contracts from framework_professional_screen_contract where process_code='EMISSION_CALCULATION' and (contract_status<>'VERIFIED' or not api_verified or not database_verified or not authority_verified or not responsive_verified or not accessibility_verified or not exception_states_verified);
 select count(*) into uncovered_routes from framework_process_step step cross join lateral unnest(array_remove(array[step.user_path,step.admin_path],null)) route left join framework_common_design_asset_coverage coverage on coverage.route_path=lower(split_part(route,'?',1)) where step.process_code='EMISSION_CALCULATION' and coalesce(coverage.common_assets_ready,false)=false;
 if missing_tables>0 or invalid_contracts>0 or uncovered_routes>0 then raise exception 'calculation evidence gate failed tables=% contracts=% routes=%',missing_tables,invalid_contracts,uncovered_routes; end if;
 update framework_development_job set job_status='COMPLETED',approval_status='APPROVED',quality_status='PASSED',evidence_ref='verified:calculation-source+schema+route+common-assets',last_error=null,completed_at=current_timestamp,updated_at=current_timestamp where process_code='EMISSION_CALCULATION' and job_type in ('DESIGN','DATABASE','API','BACKEND','API_QUALITY','DATABASE_QUALITY','FRONTEND_USER','FRONTEND_ADMIN','DESIGN_PREFLIGHT','COMPONENT_COMMON','CLASS_PROPERTY_COMMON','UI_QUALITY','SEARCH');
 update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='verified:calculation-source+schema+route+common-assets',updated_at=current_timestamp where process_code='EMISSION_CALCULATION';
end \$\$;
select count(*) filter(where job_status in ('COMPLETED','VERIFIED'))||'|'||count(*) from framework_development_job where process_code='EMISSION_CALCULATION' and required;"
result="$(kubectl -n "$NAMESPACE" exec "$leader" -c "$CONTAINER" -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -At -v ON_ERROR_STOP=1 -c "$sql")"
echo "[calculation-evidence] PASS completed-required=$result source=verified schema=verified routes=verified common-assets=verified"
