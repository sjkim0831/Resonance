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

if [[ "${1:-}" == "--cycle-smoke" ]]; then
  smoke_result="$(query "
    begin;
    with first_step as (
      select step_code,actor_code,from_state
        from framework_process_step
       where process_code='EMISSION_PROJECT_PORTFOLIO'
       order by step_order limit 1
    ), periods(period_start,period_end) as (
      values (date '2099-01-01',date '2099-01-31'),(date '2099-02-01',date '2099-02-28')
    ), inserted as (
      insert into framework_process_execution(
        execution_id,tenant_id,project_id,process_code,current_step_code,current_state,
        initiated_by_actor,initiated_by,cycle_type,period_start,period_end,execution_version
      )
      select gen_random_uuid(),'VALIDATION','CYCLE-SMOKE','EMISSION_PROJECT_PORTFOLIO',
             first_step.step_code,first_step.from_state,first_step.actor_code,'validator',
             'MONTHLY',periods.period_start,periods.period_end,1
        from first_step cross join periods
      on conflict do nothing returning 1
    ), duplicate_attempt as (
      insert into framework_process_execution(
        execution_id,tenant_id,project_id,process_code,current_step_code,current_state,
        initiated_by_actor,initiated_by,cycle_type,period_start,period_end,execution_version
      )
      select gen_random_uuid(),'VALIDATION','CYCLE-SMOKE','EMISSION_PROJECT_PORTFOLIO',
             first_step.step_code,first_step.from_state,first_step.actor_code,'validator',
             'MONTHLY',date '2099-01-01',date '2099-01-31',1
        from first_step
      on conflict do nothing returning 1
    )
    select (select count(*) from inserted)||'|'||(select count(*) from duplicate_attempt);
    rollback;")"
  [[ "${smoke_result}" == "2|0" ]] || { echo "[cycle-handoff] smoke failed expected=2|0 actual=${smoke_result}" >&2; exit 1; }
  echo '[cycle-handoff] cycle smoke PASS parallel-periods=2 duplicate-inserts=0 rollback=verified'
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
