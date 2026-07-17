#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${POSTGRES_DB:-carbonet}"
USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"

leader=""
while IFS= read -r pod; do
  if [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c "$CONTAINER" -- \
    psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then
    leader="$pod"
    break
  fi
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')

[[ -n "$leader" ]] || { echo "[emission-design] FAIL writable PostgreSQL leader not found" >&2; exit 1; }

read -r steps contracts routes ready notes mockups scenarios <<<"$(
  kubectl -n "$NAMESPACE" exec "$leader" -c "$CONTAINER" -- \
    psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -AtF' ' -qc "
      select
        (select count(*) from framework_process_step where process_code='EMISSION_PROJECT'),
        (select count(*) from framework_professional_screen_design_readiness where process_code='EMISSION_PROJECT'),
        (select count(distinct lower(split_part(route_path,'?',1))) from framework_professional_screen_design_readiness where process_code='EMISSION_PROJECT'),
        (select count(*) from framework_professional_screen_design_readiness where process_code='EMISSION_PROJECT' and design_readiness_score=100),
        (select count(*) from framework_screen_development_note where route_key in (select lower(split_part(route_path,'?',1)) from framework_professional_screen_design_readiness where process_code='EMISSION_PROJECT') and development_status in ('READY','IN_DEVELOPMENT','VERIFIED')),
        (select count(*) from framework_screen_html_mockup where selected=true and route_key in (select lower(split_part(route_path,'?',1)) from framework_professional_screen_design_readiness where process_code='EMISSION_PROJECT')),
        (select count(distinct case_type) from framework_simulation_case where process_code='EMISSION_PROJECT' and case_type in ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'))
    "
)"

if [[ "$steps" != 7 || "$contracts" != 14 || "$routes" -lt 11 || "$ready" != "$contracts" || "$notes" -lt "$routes" || "$mockups" -lt "$routes" || "$scenarios" != 5 ]]; then
  echo "[emission-design] FAIL steps=$steps contracts=$contracts routes=$routes ready=$ready notes=$notes mockups=$mockups scenarios=$scenarios" >&2
  exit 1
fi

echo "[emission-design] PASS steps=$steps contracts=$contracts routes=$routes design-ready=$ready scenarios=$scenarios"
