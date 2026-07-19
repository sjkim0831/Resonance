#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${POSTGRES_DB:-carbonet}"
USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"

leader=""
while IFS= read -r pod; do
  recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c "$CONTAINER" -- \
    psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
  [[ "$recovery" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[common-design-assets] FAIL PostgreSQL leader missing" >&2; exit 1; }

read -r pages uncovered local_components <<<"$(
  kubectl -n "$NAMESPACE" exec "$leader" -c "$CONTAINER" -- \
    psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -AtF' ' -qc "
      select
        (select count(*) from framework_common_design_asset_coverage),
        (select count(*) from framework_common_design_asset_coverage where not common_assets_ready),
        (select count(*) from ui_page_component_map mapping
           join ui_component_registry component on component.component_id=mapping.component_id
          where component.active_yn='Y' and component.category<>'COMMON');
    "
)"

if [[ "$uncovered" != 0 || "$local_components" != 0 ]]; then
  echo "[common-design-assets] FAIL pages=$pages uncovered=$uncovered page-local-components=$local_components" >&2
  exit 1
fi
echo "[common-design-assets] PASS pages=$pages uncovered=0 page-local-components=0"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LCA_SOURCE="$ROOT_DIR/projects/carbonet-frontend/source/src/features/emission-lca/EmissionLcaMigrationPage.tsx"
WORKFLOW_SOURCE="$ROOT_DIR/projects/carbonet-frontend/source/src/components/workflow/CommonWorkflowWorkspace.tsx"
MANIFEST_SOURCE="$ROOT_DIR/projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts"

[[ -f "$WORKFLOW_SOURCE" ]] && grep -q 'data-common-component="COMMON_STEP_FLOW"' "$WORKFLOW_SOURCE" || {
  echo "[common-design-assets] FAIL COMMON_STEP_FLOW source implementation missing" >&2; exit 1;
}
! grep -q 'data-help-id="product-lca-workspace"' "$LCA_SOURCE" || {
  echo "[common-design-assets] FAIL Product LCA page-local workflow duplicate remains" >&2; exit 1;
}
grep -q 'CommonWorkflowWorkspace' "$LCA_SOURCE" || {
  echo "[common-design-assets] FAIL Product LCA common workflow reference missing" >&2; exit 1;
}
grep -q 'instanceKey: "emission-lca-workflow"' "$MANIFEST_SOURCE" || {
  echo "[common-design-assets] FAIL Product LCA manifest mapping missing" >&2; exit 1;
}
echo "[common-design-assets] PASS source reuse contract"
