#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NS="${K8S_NAMESPACE:-carbonet-prod}"
LOCK_FILE="${COMPANY_REGISTRATION_APPROVAL_E2E_LOCK_FILE:-/tmp/resonance-company-registration-approval-e2e.lock}"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo 'COMPANY_REGISTRATION_APPROVAL_E2E_ALREADY_RUNNING' >&2; exit 75; }

if [[ -z "${CARBONET_ADMIN_TEST_PASSWORD:-}" ]]; then
  CARBONET_ADMIN_TEST_PASSWORD="$(kubectl -n "$NS" get secret carbonet-runtime-smoke-admin -o jsonpath='{.data.password}' | base64 -d)"
fi
export CARBONET_ADMIN_TEST_PASSWORD RESONANCE_ROOT="$ROOT" K8S_NAMESPACE="$NS"

ONBOARDING_OUTPUT="$(timeout 420 bash "$ROOT/ops/tests/run-company-onboarding-business-e2e.sh")"
ONBOARDING="$(tail -n 1 <<<"$ONBOARDING_OUTPUT")"
jq -e '.status=="PASS" and .promotionEligible==true and .stepCount==5 and .caseCount==7 and .cleanup==1 and (.routes|length)==20' <<<"$ONBOARDING" >/dev/null

APPROVAL="$(timeout 180 bash "$ROOT/ops/tests/run-member-approval-business-e2e.sh")"
jq -e '.status=="PASS" and .happy==1 and .auth==1 and .exception==1 and .isolation==1 and .recovery==1 and .database==1 and .audit==1 and .cleanup==1' <<<"$APPROVAL" >/dev/null

ROUTES="$(node "$ROOT/ops/scripts/company-registration-approval-route-e2e.mjs")"
jq -e '.status=="PASS" and .routeCount==4 and ([.routes[].responsive]|all(.==1)) and ([.routes[].accessible]|all(.==1)) and ([.routes[].duplicateMount]|all(.==0))' <<<"$ROUTES" >/dev/null

POD="$(K8S_NAMESPACE="$NS" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")"
read -r ACTUAL PLANNED PLANNED_ACTIVE ACTUAL_ACTIVE <<<"$(kubectl -n "$NS" exec "$POD" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -AtF' ' -c "
select
 count(*) filter(where c.route_path not like '/planned/%' and c.route_path not like '/admin/planned/%'),
 count(*) filter(where c.route_path like '/planned/%' or c.route_path like '/admin/planned/%'),
 (select count(*) from framework_process_step_screen_binding b join framework_screen_resource r using(screen_resource_id) where b.process_code='COMPANY_REGISTRATION_APPROVAL' and b.binding_status='ACTIVE' and (r.route_key like '/planned/%' or r.route_key like '/admin/planned/%')),
 (select count(*) from framework_process_step_screen_binding b join framework_screen_resource r using(screen_resource_id) where b.process_code='COMPANY_REGISTRATION_APPROVAL' and b.binding_status='ACTIVE' and r.route_key not like '/planned/%' and r.route_key not like '/admin/planned/%')
from framework_professional_screen_contract c where c.process_code='COMPANY_REGISTRATION_APPROVAL';")"
[[ "$ACTUAL" == 8 && "$PLANNED" == 8 && "$PLANNED_ACTIVE" == 0 && "$ACTUAL_ACTIVE" == 8 ]] || {
  echo "company registration route graph mismatch actual=$ACTUAL planned=$PLANNED plannedActive=$PLANNED_ACTIVE actualActive=$ACTUAL_ACTIVE" >&2; exit 1;
}

SOURCE="$(kubectl -n "$NS" get deploy carbonet-runtime -o jsonpath='{.metadata.annotations.resonance\.ai/target-commit}')"
jq -cn --arg source "$SOURCE" --argjson onboarding "$ONBOARDING" --argjson approval "$APPROVAL" --argjson routeEvidence "$ROUTES" '{
  status:"PASS",promotionEligible:true,processCode:"COMPANY_REGISTRATION_APPROVAL",sourceCommit:$source,
  happy:1,auth:1,exception:1,isolation:1,recovery:1,database:1,audit:1,cleanup:1,responsive:1,accessibility:1,
  stepCount:4,caseCount:5,actualContractCount:8,plannedContractCount:8,plannedActiveCount:0,actualActiveCount:8,
  performanceSampleCount:$onboarding.performanceSampleCount,performanceP95Ms:$onboarding.performanceP95Ms,
  componentEvidence:{onboarding:{steps:$onboarding.stepCount,cases:$onboarding.caseCount,routes:($onboarding.routes|length)},approval:{outcomes:($approval.outcomes|length)}},
  routes:$routeEvidence.routes
}'
