#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${POSTGRES_DB:-carbonet}"
USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"

leader=""
while IFS= read -r pod; do
  if [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c "$CONTAINER" -- \
    psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then
    leader="$pod"
    break
  fi
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')

[[ -n "$leader" ]] || { echo "[emission-design] FAIL writable PostgreSQL leader not found" >&2; exit 1; }

psqlq() {
  kubectl -n "$NAMESPACE" exec "$leader" -c "$CONTAINER" -- \
    psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -X -q -v ON_ERROR_STOP=1 -At "$@"
}

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

read -r gate_status blockers warnings <<<"$(
  psqlq -F' ' -c "select validation_status,blocker_count,warning_count from framework_validate_process_design('EMISSION_PROJECT','DEPLOYMENT_GATE')"
)"
if [[ "$gate_status" != "PASSED" || "$blockers" != 0 ]]; then
  echo "[emission-design] FAIL executable-contract status=$gate_status blockers=$blockers warnings=$warnings" >&2
  exit 1
fi

controller="$ROOT_DIR/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/EmissionProjectRegistryController.java"
[[ -f "$controller" ]] || { echo "[emission-design] FAIL controller source missing: $controller" >&2; exit 1; }

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
python3 - "$controller" >"$tmp_dir/source-endpoints" <<'PY'
import re
import sys
from pathlib import Path

source = Path(sys.argv[1]).read_text(encoding="utf-8")
for method, arguments in re.findall(r"@(Get|Post|Put|Patch|Delete)Mapping\s*\((.*?)\)\s*\n", source, re.S):
    paths = re.findall(r'"([^\"]+)"', arguments)
    for path in paths:
        if path.startswith("/home/api/"):
            print(f"{method.upper()} {path}")
PY
sort -u -o "$tmp_dir/source-endpoints" "$tmp_dir/source-endpoints"

psqlq -c "select upper(http_method)||' '||route_path from framework_api_endpoint_registry where active_yn='Y' and implementation_ref like 'EmissionProjectRegistryController#%' order by 1" \
  >"$tmp_dir/registry-endpoints"
if ! diff -u "$tmp_dir/source-endpoints" "$tmp_dir/registry-endpoints"; then
  echo "[emission-design] FAIL API registry differs from controller source" >&2
  exit 1
fi

echo "[emission-design] PASS steps=$steps contracts=$contracts routes=$routes design-ready=$ready scenarios=$scenarios executable-contract=$gate_status endpoints=$(wc -l <"$tmp_dir/source-endpoints")"
