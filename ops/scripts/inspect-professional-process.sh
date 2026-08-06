#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROCESS_CODE="${1:?process code is required}"
[[ "$PROCESS_CODE" =~ ^[A-Z0-9_]+$ ]] || { echo "invalid process code" >&2; exit 2; }

source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
q(){ carbonet_postgres_query "$1"; }

echo "[definition]"
q "select concat_ws('|',process_code,process_name,domain_code,owner_actor_code,process_status,definition_locked::text) from framework_process_definition where process_code='$PROCESS_CODE'"
echo "[steps]"
q "select concat_ws('|',step_order,step_code,step_name,actor_code,coalesce(user_path,''),coalesce(admin_path,''),coalesce(completion_rule,'')) from framework_process_step where process_code='$PROCESS_CODE' order by step_order,step_code"
echo "[tests]"
q "select concat_ws('|',case_code,case_type,case_status,automated::text,case when exists(select 1 from framework_simulation_run r where r.case_code=c.case_code and r.result='PASSED') then 'PASSED' else 'MISSING' end) from framework_simulation_case c where process_code='$PROCESS_CODE' order by case_type,case_code"
echo "[delivery]"
q "select concat_ws('|',completion_score,next_action,concat(passed_tests,'/',test_count),concat(completed_tasks,'/',required_tasks),concat(verified_artifacts,'/',required_artifacts),concat(ready_screens,'/',screen_contracts)) from framework_process_delivery_queue where process_code='$PROCESS_CODE'"
echo "[jobs]"
q "select concat_ws('|',job_type,job_status,quality_status,count(*)::text) from framework_development_job where process_code='$PROCESS_CODE' and required group by job_type,job_status,quality_status order by job_type,job_status"
echo "[artifacts]"
q "select concat_ws('|',artifact_type,delivery_status,count(*)::text) from framework_process_artifact where process_code='$PROCESS_CODE' and required group by artifact_type,delivery_status order by artifact_type,delivery_status"
echo "[screens]"
q "select concat_ws('|',audience,route_path,readiness_score,contract_status) from framework_professional_screen_readiness where process_code='$PROCESS_CODE' order by audience,route_path"
