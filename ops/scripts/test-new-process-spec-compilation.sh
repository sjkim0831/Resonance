#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260802113000__compile_new_process_execution_specs.sql"
SERVICE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"

grep -Fq 'framework_compile_process_execution_specs(requested_process varchar)' "$MIGRATION"
grep -Fq "framework_refresh_step_schema_set(requested_process,step_row.step_code" "$MIGRATION"
grep -Fq "ON CONFLICT(process_code,step_code) DO NOTHING" "$MIGRATION"
grep -Fq "select framework_generate_professional_design_graph(?,?)::text" "$SERVICE"
grep -Fq "select framework_compile_process_execution_specs(?)" "$SERVICE"
grep -Fq "'handoffType','TERMINAL'" "$SERVICE"
grep -Fq "and e.handoff_contract='[]'::jsonb" "$SERVICE"
echo '[new-process-spec-compilation] PASS'
