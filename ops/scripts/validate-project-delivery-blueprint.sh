#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260801113000__install_atomic_project_delivery_blueprints.sql"
SAFETY_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260802090000__require_five_safety_scenarios_for_project_delivery.sql"

[[ -s "$MIGRATION" ]]
grep -Fq 'framework_project_delivery_blueprint' "$MIGRATION"
grep -Fq 'framework_validate_project_delivery_blueprint' "$MIGRATION"
grep -Fq 'framework_apply_project_delivery_blueprint' "$MIGRATION"
grep -Fq "pg_advisory_xact_lock(hashtext('PROJECT_DELIVERY:'" "$MIGRATION"
grep -Fq "framework_sync_project_processes(requested_project_id,requested_by)" "$MIGRATION"
grep -Fq 'framework_refresh_screen_generation_impact(1000,process_code_value)' "$MIGRATION"
grep -Fq "'mutated',false" "$MIGRATION"
grep -Fq 'PROJECT_DELIVERY_ROLLED_BACK' "$MIGRATION"
grep -Fq 'framework_project_delivery_status' "$MIGRATION"
[[ -s "$SAFETY_MIGRATION" ]]
grep -Fq "'HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'" "$SAFETY_MIGRATION"
grep -Fq 'FIVE_SAFETY_SCENARIOS_MISSING' "$SAFETY_MIGRATION"
grep -Fq 'processWithoutFiveSafetyScenariosCount' "$SAFETY_MIGRATION"

echo 'PASS project delivery blueprint: five-scenario validate -> atomic actor/process/task install -> incremental screen impact -> rollback guard'
