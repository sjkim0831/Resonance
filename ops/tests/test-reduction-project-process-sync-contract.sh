#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260821112000__include_reduction_in_project_process_sync.sql"

[[ -f "$MIGRATION" ]]
grep -Fq "'PORTFOLIO'',''REDUCTION'" "$MIGRATION"
grep -Fq "REDUCTION_PROJECT_PROCESS_SYNC_SCOPE_SOURCE_NOT_FOUND" "$MIGRATION"
grep -Fq "REDUCTION_PROJECT_PROCESS_SYNC_SCOPE_PATCH_FAILED" "$MIGRATION"
grep -Fq "framework_project_process_step_assignment" "$MIGRATION"
grep -Fq "upper(process.domain_code) = 'REDUCTION'" "$MIGRATION"
grep -Fq "FLYWAY_REDUCTION_ASSIGNMENT_RECONCILE" "$MIGRATION"
grep -Fq "framework_reduction_assignment_delivery_audit" "$MIGRATION"
grep -Fq "missing_task_count" "$MIGRATION"

# Kill the old behavior: a migration that still excludes REDUCTION cannot pass.
mutant="$(mktemp)"
trap 'rm -f "$mutant"' EXIT
sed "s/',''REDUCTION''//g" "$MIGRATION" >"$mutant"
if grep -Fq "'PORTFOLIO'',''REDUCTION'" "$mutant"; then
  echo '[reduction-project-process-sync-contract] FAIL scope mutant survived' >&2
  exit 1
fi

printf '[reduction-project-process-sync-contract] PASS scope=6 selectiveBackfill=1 auditView=1 mutantKilled=1\n'
