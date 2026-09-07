#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NS="${K8S_NAMESPACE:-carbonet-prod}"
exec 9>"${MEMBER_CORE_GATE_LOCK:-/tmp/member-core-process-no-build-gate.lock}"
flock -n 9 || { echo MEMBER_CORE_PROCESS_GATE_ALREADY_RUNNING >&2; exit 75; }
cd "$ROOT"
leader=''
for pod in $(kubectl -n "$NS" get pods -l app=postgres-patroni -o name | sed 's#^pod/##'); do
  [[ "$(kubectl -n "$NS" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done
[[ -n "$leader" ]] || { echo MEMBER_CORE_POSTGRES_LEADER_MISSING >&2; exit 1; }
topology="$(kubectl -n "$NS" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -qAt -F '|' -c "select process_code,count(*) from framework_process_step where process_code in ('MEMBER_REGISTRATION','MEMBER_APPROVAL','ACCOUNT_WITHDRAWAL') group by process_code order by process_code")"
grep -qx 'ACCOUNT_WITHDRAWAL|4' <<<"$topology"
grep -qx 'MEMBER_APPROVAL|4' <<<"$topology"
grep -qx 'MEMBER_REGISTRATION|5' <<<"$topology"
export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE="${PLAYWRIGHT_HOST_PLATFORM_OVERRIDE:-ubuntu24.04-x64}"
if [[ -z "${CARBONET_ADMIN_TEST_PASSWORD:-}" ]]; then CARBONET_ADMIN_TEST_PASSWORD="$(kubectl -n "$NS" get secret carbonet-runtime-smoke-admin -o jsonpath='{.data.password}' | base64 -d)"; fi
export CARBONET_ADMIN_TEST_PASSWORD
tmp="$(mktemp)"; trap 'rm -f -- "$tmp"' EXIT
node ops/scripts/member-core-process-no-build-e2e.mjs >"$tmp"
jq -e '.status=="PASS" and .processCount==3 and .pageCount==10 and .routeCount==20 and .renderedRouteCount==12 and .prerequisiteGuardCount==8 and .desktop==1 and .mobile==1 and .noOverflow==1 and .noPageErrors==1' "$tmp" >/dev/null
install -D -m 0644 "$tmp" var/test-evidence/member-core-process-no-build-latest.json
jq -cn --argjson ui "$(cat "$tmp")" --arg topology "$topology" '{status:"PASS",topology:$topology,ui:$ui}'
