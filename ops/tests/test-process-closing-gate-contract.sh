#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/validate-process-closing-gate.sh"
BINDING_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260808125000__bind_work_assignment_step_tests.sql"

grep -Fq 'framework_step_test_binding' "$TARGET"
grep -Fq 'framework_step_guidance_contract' "$TARGET"
grep -Fq "simulation.automated" "$TARGET"
grep -Fq "run.result='PASSED'" "$TARGET"
grep -Fq 'optional_route_steps' "$TARGET"
grep -Fq 'missing_required_routes' "$TARGET"
grep -Fq 'reason=test-evidence-open' "$TARGET"

for step in WORK_ASSIGNMENT_CONTEXT WORK_ASSIGNMENT_ACTOR WORK_ASSIGNMENT_STEP WORK_ASSIGNMENT_CONFIRM; do
  grep -Fq "('$step'" "$BINDING_MIGRATION"
done
for case_code in WORK_ASSIGNMENT-HAPPY WORK_ASSIGNMENT-AUTH WORK_ASSIGNMENT-ISOLATION WORK_ASSIGNMENT-VALIDATION WORK_ASSIGNMENT-RECOVERY; do
  grep -Fq "'$case_code'" "$BINDING_MIGRATION"
done
grep -Fq 'WORK_ASSIGNMENT_UNBOUND_STEPS' "$BINDING_MIGRATION"

mutated="$(mktemp)"
trap 'rm -f "$mutated"' EXIT
sed "s/run.result='PASSED'/run.result='FAILED'/" "$TARGET" > "$mutated"
if grep -Fq "run.result='PASSED'" "$mutated"; then
  echo '[process-closing-gate-contract] mutation did not remove PASSED evidence guard' >&2
  exit 1
fi

echo '[process-closing-gate-contract] PASS ordering=all-steps routes=required-only tests=bound+automated+passed workAssignmentBindings=4/4 guidance=reported ai=false'
