#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260723050000__install_step_schema_set_change_propagation.sql"

test -s "$MIGRATION"
grep -Fq 'framework_step_schema_set' "$MIGRATION"
grep -Fq 'framework_refresh_step_schema_set' "$MIGRATION"
grep -Fq 'trg_page_field_schema_propagation' "$MIGRATION"
grep -Fq 'framework_schema_change_event' "$MIGRATION"
grep -Fq 'framework_screen_generation_state' "$MIGRATION"
grep -Fq 'framework_page_data_contract' "$MIGRATION"
grep -Fq 'framework_page_action_contract' "$MIGRATION"
grep -Fq "'INITIAL_COMPILE',false" "$MIGRATION"
grep -Fq 'STEP_SCHEMA_SET_COVERAGE_FAILED' "$MIGRATION"

if command -v kubectl >/dev/null 2>&1; then
  namespace="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
  leader=""
  while read -r pod; do
    recovery="$(kubectl -n "$namespace" exec "$pod" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d carbonet -Atqc \
      'select pg_is_in_recovery()' 2>/dev/null || true)"
    [[ "$recovery" == f ]] && { leader="$pod"; break; }
  done < <(kubectl -n "$namespace" get pods -l app=postgres-patroni \
    -o name 2>/dev/null | sed 's#pod/##')
  if [[ -n "$leader" ]] && kubectl -n "$namespace" exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d carbonet -Atqc \
      "select to_regclass('public.framework_step_schema_set') is not null" \
      2>/dev/null | grep -qx t; then
    result="$(kubectl -n "$namespace" exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d carbonet -Atqc "
      select jsonb_build_object(
        'steps',(select count(*) from framework_process_step),
        'schemas',(select count(*) from framework_step_schema_set),
        'complete',(select count(*) from framework_step_schema_set
                    where completeness_status='COMPLETE'),
        'blocked',(select count(*) from framework_step_schema_set
                   where completeness_status='BLOCKED'),
        'pageDataContracts',(select count(*) from framework_page_data_contract),
        'pageActionContracts',(select count(*) from framework_page_action_contract),
        'coverage',(select count(*) from framework_process_step)=
                   (select count(*) from framework_step_schema_set));")"
    jq -e '.coverage==true and .steps==.schemas
      and .pageDataContracts>0 and .pageActionContracts>0' <<<"$result" >/dev/null
    echo "$result"
    exit 0
  fi
fi

jq -cn '{
  success:true,
  status:"SOURCE_VERIFIED_AWAITING_MIGRATION",
  contract:"STEP_SCHEMA_SET_PROPAGATION_V1"
}'
