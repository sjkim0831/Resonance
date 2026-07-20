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
PRIMITIVE_SOURCE="$ROOT_DIR/projects/carbonet-frontend/source/src/components/common-design/CommonDesignPrimitives.tsx"
MANIFEST_SOURCE="$ROOT_DIR/projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts"
COMMON_FOOTER_SOURCE="$ROOT_DIR/projects/carbonet-frontend/source/src/components/user-shell/CommonUserFooter.tsx"
HOME_FOOTER_SOURCE="$ROOT_DIR/projects/carbonet-frontend/source/src/features/home-entry/HomeEntrySections.tsx"
PORTAL_CHROME_SOURCE="$ROOT_DIR/projects/carbonet-frontend/source/src/components/user-shell/UserPortalChrome.tsx"
STANDARD_FOOTER_SOURCE="$ROOT_DIR/projects/carbonet-frontend/source/src/components/user-shell/StandardUserFooter.tsx"

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
if grep -Eq 'InlineStyles|<header|<footer|gov-btn|status-pill|audit-table-row|timeline-dot' "$LCA_SOURCE"; then
  echo "[common-design-assets] FAIL Product LCA contains local shell or local design primitives" >&2
  exit 1
fi
for component_id in COMMON_DATA_TABLE COMMON_STATUS_BADGE COMMON_CONTENT_CARD COMMON_ACTION_BAR; do
  grep -q "$component_id" "$PRIMITIVE_SOURCE" || {
    echo "[common-design-assets] FAIL common primitive implementation missing $component_id" >&2; exit 1;
  }
  grep -q "componentId: \"$component_id\"" "$MANIFEST_SOURCE" || {
    echo "[common-design-assets] FAIL Product LCA manifest missing $component_id" >&2; exit 1;
  }
done
for component_name in CommonDataTable CommonStatusBadge CommonContentCard CommonActionBar CommonTimeline; do
  grep -q "$component_name" "$LCA_SOURCE" || {
    echo "[common-design-assets] FAIL Product LCA source missing $component_name" >&2; exit 1;
  }
done
grep -q 'data-common-component="COMMON_PAGE_FOOTER"' "$COMMON_FOOTER_SOURCE" || {
  echo "[common-design-assets] FAIL common user footer implementation missing" >&2; exit 1;
}
grep -q 'componentId: "COMMON_PAGE_FOOTER"' "$MANIFEST_SOURCE" || {
  echo "[common-design-assets] FAIL home manifest common footer mapping missing" >&2; exit 1;
}
grep -q 'CommonUserFooter' "$HOME_FOOTER_SOURCE" && grep -q 'CommonUserFooter' "$PORTAL_CHROME_SOURCE" || {
  echo "[common-design-assets] FAIL home footer wrappers are not unified" >&2; exit 1;
}
if grep -q '<footer' "$HOME_FOOTER_SOURCE" || grep -q '<footer' "$PORTAL_CHROME_SOURCE"; then
  echo "[common-design-assets] FAIL duplicate footer markup remains in home wrappers" >&2; exit 1;
fi
grep -q 'CommonUserFooter' "$STANDARD_FOOTER_SOURCE" || {
  echo "[common-design-assets] FAIL standard user footer is not connected to COMMON_PAGE_FOOTER" >&2; exit 1;
}
for source in \
  co2-analysis/Co2AnalysisMigrationPage.tsx \
  co2-credit/Co2CreditMigrationPage.tsx \
  co2-demand-list/Co2DemandListMigrationPage.tsx \
  co2-integrity/Co2IntegrityMigrationPage.tsx \
  co2-production-list/Co2ProductionListMigrationPage.tsx \
  co2-search/Co2SearchMigrationPage.tsx \
  edu-course-detail/EduCourseDetailMigrationPage.tsx \
  emission-lci/EmissionLciMigrationPage.tsx \
  emission-project-list/EmissionProjectListMigrationPage.tsx \
  emission-report-submit/EmissionReportSubmitMigrationPage.tsx \
  emission-simulate/EmissionSimulateMigrationPage.tsx \
  join-company-register/JoinCompanyRegisterCompleteMigrationPage.tsx \
  join-wizard/JoinAuthMigrationPage.tsx \
  join-wizard/JoinCompleteMigrationPage.tsx \
  join-wizard/JoinWizardMigrationPage.tsx \
  monitoring-track/MonitoringTrackMigrationPage.tsx \
  public-entry/PublicEntryPages.tsx \
  public-entry/publicEntryShared.tsx; do
  page="$ROOT_DIR/projects/carbonet-frontend/source/src/features/$source"
  grep -q 'StandardUserFooter' "$page" || {
    echo "[common-design-assets] FAIL common footer reference missing: $source" >&2; exit 1;
  }
  if grep -q '<footer' "$page"; then
    echo "[common-design-assets] FAIL duplicate page footer markup remains: $source" >&2; exit 1;
  fi
done
echo "[common-design-assets] PASS source reuse contract"
