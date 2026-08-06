#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NS="${K8S_NAMESPACE:-carbonet-prod}"
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
CARBONET_PG_NAMESPACE="$NS"
POSTGRES_DB="${POSTGRES_DB:-carbonet}"
POSTGRES_ADMIN_USER="${POSTGRES_ADMIN_USER:-postgres}"
carbonet_postgres_query_init
q(){ carbonet_postgres_query "$1"; }

summary="$(q "with target(process_code,ordinal) as (values
 ('EMISSION_PROJECT_PORTFOLIO',1),('ORGANIZATIONAL_BOUNDARY',2),('ACTIVITY_DATA',3),
 ('EMISSION_CALCULATION',4),('REPORT_CERTIFICATION',5),('REGULATORY_SUBMISSION',6)),
 steps as (select s.* from framework_process_step s join target t using(process_code)),
 pages as (select d.process_code,d.step_code,count(*) page_count,count(f.*) field_count
   from framework_page_design d left join framework_page_field_definition f using(page_design_id)
   join target t using(process_code) group by d.process_code,d.step_code)
 select count(*),count(distinct actor_code),count(*) filter(where length(completion_rule)>=30),
 count(*) filter(where coalesce(p.page_count,0)>0 and coalesce(p.field_count,0)>=20),
 count(*) filter(where user_path like '/home/%'),
 count(*) filter(where step_name in ('계획·범위 확정','자료 입력·업무 수행','검증·보완','승인·확정')),
 count(*) filter(where e.design_status='DESIGN_COMPLETE' and e.generation_status in('READY','GENERATED')),
 count(*) filter(where e.handoff_contract not in ('[]'::jsonb,'{}'::jsonb,'null'::jsonb))
 from steps s left join pages p using(process_code,step_code)
 left join framework_step_execution_spec e using(process_code,step_code)")"
IFS='|' read -r steps actors detailed_rules professional_pages public_routes generic_names ready_specs handoffs <<<"$summary"

[[ "$steps" == 21 ]] || { echo "[customer-emission-relay-design] FAIL steps=$steps expected=21" >&2; exit 1; }
[[ "$actors" == 5 ]] || { echo "[customer-emission-relay-design] FAIL actors=$actors expected=5" >&2; exit 1; }
[[ "$detailed_rules" == 21 ]] || { echo "[customer-emission-relay-design] FAIL detailed-rules=$detailed_rules/21" >&2; exit 1; }
[[ "$professional_pages" == 21 ]] || { echo "[customer-emission-relay-design] FAIL professional-pages=$professional_pages/21" >&2; exit 1; }
[[ "$public_routes" == 0 ]] || { echo "[customer-emission-relay-design] FAIL authenticated-public-routes=$public_routes" >&2; exit 1; }
[[ "$generic_names" == 0 ]] || { echo "[customer-emission-relay-design] FAIL generic-step-names=$generic_names" >&2; exit 1; }
[[ "$ready_specs" == 21 ]] || { echo "[customer-emission-relay-design] FAIL ready-specs=$ready_specs/21" >&2; exit 1; }
[[ "$handoffs" -ge 20 ]] || { echo "[customer-emission-relay-design] FAIL handoffs=$handoffs expected>=20" >&2; exit 1; }

echo "[customer-emission-relay-design] PASS processes=6 steps=$steps actors=$actors detailedRules=$detailed_rules professionalPages=$professional_pages readySpecs=$ready_specs handoffs=$handoffs publicRoutes=0 genericNames=0"
