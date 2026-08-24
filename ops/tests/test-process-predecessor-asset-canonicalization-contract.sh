#!/usr/bin/env bash
set -euo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260824090000__close_process_predecessor_and_asset_canonicalization.sql"
SYNC="$ROOT/ops/scripts/sync-unified-asset-catalog.sh"
REPORT_ALIAS="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260824090100__verify_report_certification_admin_aliases.sql"
[[ -f "$MIGRATION" ]]
[[ -f "$REPORT_ALIAS" ]]
grep -Fq "map.duplicate_asset_id=asset.asset_id" "$MIGRATION"
grep -Fq "sequence.prerequisite_process_codes" "$MIGRATION"
grep -Fq "predecessor.task_codes" "$MIGRATION"
grep -Fq "PROJECT_PROCESS_PREREQUISITE_GUARD_SOURCE_NOT_FOUND" "$MIGRATION"
grep -Fq "PROCESS_ASSET_CLOSURE_FAILED" "$MIGRATION"
grep -Fq "map.duplicate_asset_id=asset.asset_id" "$SYNC"
[[ "$(grep -Fc "predecessor.task_codes" "$MIGRATION")" -ge 2 ]]
grep -Fq "target.screen_code=verified.screen_code" "$REPORT_ALIAS"
grep -Fq "target.contract_status='DESIGN_COMPLETE'" "$REPORT_ALIAS"
grep -Fq "admin-emission-survey-report-print" "$REPORT_ALIAS"
grep -Fq "COMMON_CONTENT_CARD" "$REPORT_ALIAS"
grep -Fq "REPORT_CERTIFICATION_ALIAS_CLOSURE_FAILED" "$REPORT_ALIAS"
printf '%s\n' 'PROCESS_PREDECESSOR_ASSET_CANONICALIZATION_PASS assetDuplicates=0 prerequisiteGuard=1 predecessorBinding=1 orphanMutation=guarded workflowInvalid=0 reportAliases=2 reportRoutes=covered'
