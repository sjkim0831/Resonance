#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
source "${SCRIPT_DIR}/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init

query() { carbonet_postgres_query "$1"; }

if [[ "${1:-}" == "--migration-transaction" ]]; then
  migration="${2:-${REPO_ROOT}/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260805164000__add_process_cycle_handoff_runtime.sql}"
  [[ -f "${migration}" ]] || { echo "[cycle-handoff] migration not found: ${migration}" >&2; exit 2; }
  query "begin; $(cat "${migration}"); rollback;" >/dev/null
  echo '[cycle-handoff] SQL transaction validation PASS'
  exit 0
fi

policy_count="$(query "select count(*) from framework_step_completion_policy where use_at='Y' and process_code in ('EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT','ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION')")"
step_count="$(query "select count(*) from framework_process_step where process_code in ('EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT','ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION')")"
audit_blockers="$(query "select count(*) from framework_process_cycle_handoff_audit where cardinality(blocker_codes)>0")"
invalid_cycles="$(query "select count(*) from framework_process_execution where cycle_type<>'ONCE' and (period_start is null or period_end is null or period_start>period_end)")"
duplicate_running="$(query "select count(*) from (select tenant_id,project_id,process_code,cycle_type,period_start,period_end,boundary_version,methodology_version,execution_version from framework_process_execution where execution_status='RUNNING' group by 1,2,3,4,5,6,7,8,9 having count(*)>1) duplicates")"
missing_next_actor="$(query "select count(*) from framework_step_completion_policy p join framework_process_step s using(process_code,step_code) where p.use_at='Y' and exists(select 1 from framework_process_step n where n.process_code=s.process_code and n.step_order>s.step_order) and nullif(p.next_actor_code,'') is null")"

printf '[cycle-handoff] steps=%s policies=%s blockers=%s invalid-cycles=%s duplicate-running=%s missing-next-actor=%s\n' \
  "${step_count}" "${policy_count}" "${audit_blockers}" "${invalid_cycles}" "${duplicate_running}" "${missing_next_actor}"

[[ "${policy_count}" == "${step_count}" ]]
[[ "${audit_blockers}" == "0" ]]
[[ "${invalid_cycles}" == "0" ]]
[[ "${duplicate_running}" == "0" ]]
[[ "${missing_next_actor}" == "0" ]]

echo '[cycle-handoff] PASS'
