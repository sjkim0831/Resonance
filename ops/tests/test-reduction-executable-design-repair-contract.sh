#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
M="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260821193500__repair_reduction_executable_design_contracts.sql"
[[ -f "$M" ]]
for token in framework_process_execution framework_process_step framework_process_work_draft framework_process_execution_event emission_project_registry; do
  grep -Fq "$token" "$M"
done
grep -Fq "step_order=4 THEN 'COMPLETED'" "$M"
grep -Fq "'{toState}'" "$M"
grep -Fq 'framework_validate_process_design' "$M"
grep -Fq 'REDUCTION_DESIGN_REPAIR_INCOMPLETE' "$M"
[[ "$(grep -o "'REDUCTION_[A-Z_]*'" "$M" | sort -u | wc -l)" -eq 7 ]]
printf '[reduction-executable-design-repair-contract] PASS processes=7 relations=5 stateRepairs=2 failClosed=1\n'
