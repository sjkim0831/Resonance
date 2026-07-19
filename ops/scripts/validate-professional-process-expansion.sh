#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
DATABASE="${DATABASE:-carbonet}"
DB_USER="${DB_USER:-postgres}"

leader=""
while read -r pod; do
  if [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then
    leader="$pod"
    break
  fi
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')

[[ -n "$leader" ]] || { echo "PostgreSQL leader not found" >&2; exit 1; }
q() { kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -Atqc "$1"; }

range="development_order between 100 and 114"
processes="$(q "select count(*) from framework_process_definition where $range")"
steps="$(q "select count(*) from framework_process_step where process_code in (select process_code from framework_process_definition where $range)")"
cases="$(q "select count(*) from framework_simulation_case where process_code in (select process_code from framework_process_definition where $range)")"
jobs="$(q "select count(*) from framework_development_job where process_code in (select process_code from framework_process_definition where $range)")"
missing_types="$(q "select count(*) from (select p.process_code,t.case_type from framework_process_definition p cross join (values ('HAPPY_PATH'),('EXCEPTION'),('AUTHORITY'),('ISOLATION'),('RECOVERY')) t(case_type) where $range except select process_code,case_type from framework_simulation_case) x")"
false_verified="$(q "select count(*) from framework_development_job where process_code in (select process_code from framework_process_definition where $range) and job_status in ('VERIFIED','COMPLETED') and coalesce(evidence_ref,'')='' ")"
invalid_status="$(q "select count(*) from framework_process_definition where $range and (process_status<>'DRAFT' or lifecycle_status<>'DESIGN')")"

printf 'professional process expansion: processes=%s steps=%s cases=%s jobs=%s missingScenarioTypes=%s falseVerified=%s invalidStatus=%s\n' \
  "$processes" "$steps" "$cases" "$jobs" "$missing_types" "$false_verified" "$invalid_status"

[[ "$processes" == "15" ]]
[[ "$steps" == "60" ]]
[[ "$cases" == "75" ]]
[[ "$jobs" == "540" ]]
[[ "$missing_types" == "0" ]]
[[ "$false_verified" == "0" ]]
[[ "$invalid_status" == "0" ]]
