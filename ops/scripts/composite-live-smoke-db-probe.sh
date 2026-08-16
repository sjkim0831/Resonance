#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init

[[ "${1:-}" == --snapshot && $# -eq 2 ]] || {
  printf '{"success":false,"code":"DB_PROBE_ARGUMENT_INVALID"}\n' >&2; exit 2;
}
selector="$2"
jq -e 'type=="object" and
  (keys|sort)==["accountId","commandCode","executionId","processCode","projectId","stepCode","tenantId"] and
  (.executionId|type=="string" and test("^[0-9a-fA-F-]{36}$")) and
  all(.accountId,.tenantId,.projectId,.processCode,.stepCode,.commandCode;
    type=="string" and test("^[A-Za-z0-9_.:@-]{1,120}$"))' <<<"$selector" >/dev/null || {
  printf '{"success":false,"code":"DB_POSTCONDITION_MAPPING_REQUIRED"}\n' >&2; exit 3;
}
tenant="$(jq -r .tenantId <<<"$selector")"; project="$(jq -r .projectId <<<"$selector")"
process_code="$(jq -r .processCode <<<"$selector")"; step="$(jq -r .stepCode <<<"$selector")"
command_code="$(jq -r .commandCode <<<"$selector")"; execution="$(jq -r .executionId <<<"$selector")"
account="$(jq -r .accountId <<<"$selector")"

carbonet_postgres_query "begin isolation level repeatable read read only;
set local statement_timeout='8s';
select jsonb_build_object(
  'schema','carbonet.composite-db-reread/v1','readOnly',true,'transactionId',txid_current(),
  'execution',coalesce((select to_jsonb(execution_row) from (
    select execution_id,tenant_id,project_id,process_code,current_step_code,execution_status,current_state,updated_at
      from framework_process_execution where execution_id='$execution'::uuid
       and tenant_id='$tenant' and project_id='$project' and process_code='$process_code') execution_row),'null'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(event_row) order by event_id) from (
    select event_id,execution_id,step_code,actor_code,command_code,from_state,to_state,
           idempotency_key,request_json,result_json,executed_by,executed_at
      from framework_process_execution_event where execution_id='$execution'::uuid
       and step_code='$step' and command_code='$command_code') event_row),'[]'::jsonb),
  'draft',coalesce((select to_jsonb(draft_row) from (
    select draft_id,tenant_id,project_id,process_code,step_code,account_id,actor_code,
           draft_version,draft_status,payload_json,evidence_json,updated_at
      from framework_process_work_draft where tenant_id='$tenant' and project_id='$project'
       and process_code='$process_code' and step_code='$step'
       and lower(account_id)=lower('$account')) draft_row),'null'::jsonb));
rollback;"
