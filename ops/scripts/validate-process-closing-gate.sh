#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${PGDATABASE:-carbonet}"
leader=""

for pod in $(kubectl -n "$NAMESPACE" get pods -l application=spilo -o name 2>/dev/null | sed 's#pod/##'); do
  recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
  if [[ "$recovery" == "f" ]]; then leader="$pod"; break; fi
done

if [[ -z "$leader" ]]; then
  for pod in postgres-patroni-0 postgres-patroni-1 postgres-patroni-2; do
    recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
    if [[ "$recovery" == "f" ]]; then leader="$pod"; break; fi
  done
fi

[[ -n "$leader" ]] || { echo "PROCESS_CLOSING_FAIL reason=postgres-leader-not-found"; exit 2; }

read -r total steps closed review blocked structural routes implementation < <(
  kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d "$DATABASE" -AtF ' ' -c "
    select count(*),coalesce(sum(step_count),0),
           count(*) filter(where design_blocker_count=0 and approved_safety_test_type_count=5),
           count(*) filter(where design_blocker_count=0 and approved_safety_test_type_count<5),
           count(*) filter(where design_blocker_count>0),
           coalesce(sum(design_blocker_count),0),
           coalesce(sum(missing_user_route_count+missing_admin_route_count),0),
           count(*) filter(where assurance_status='IMPLEMENTATION_VERIFIED')
      from framework_process_design_assurance_matrix" | tr -d '\r'
)

echo "PROCESS_CLOSING total=$total steps=$steps design_closed=$closed review=$review blocked=$blocked structural_blockers=$structural missing_routes=$routes implementation_closed=$implementation"

if [[ "$total" -eq 0 || "$closed" -ne "$total" || "$review" -ne 0 || "$blocked" -ne 0 || "$structural" -ne 0 || "$routes" -ne 0 ]]; then
  echo "PROCESS_CLOSING_FAIL reason=design-contract-open"
  exit 1
fi

echo "PROCESS_CLOSING_PASS next_gate=SCREEN_DESIGN_CLOSING"
