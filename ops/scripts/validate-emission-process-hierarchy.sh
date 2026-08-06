#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
HIERARCHY="$ROOT/projects/carbonet-frontend/source/src/lib/workflow/emissionProcessHierarchy.ts"
QUEST="$ROOT/projects/carbonet-frontend/source/src/features/task-quest/TaskQuestPanel.tsx"
ASSIGNMENT="$ROOT/projects/carbonet-frontend/source/src/features/work-assignment/WorkAssignmentPage.tsx"

require() { grep -Fq "$2" "$1" || { echo "missing hierarchy contract: $2" >&2; exit 1; }; }
require "$HIERARCHY" 'EMISSION_END_TO_END_PROCESS_CODE = "EMISSION_PROJECT"'
require "$HIERARCHY" 'EMISSION_PROJECT_SETUP: ["착수"'
require "$HIERARCHY" 'EMISSION_PROJECT_COLLECT: ["활동자료 수집"'
require "$HIERARCHY" 'EMISSION_PROJECT_CALCULATE: ["산정·검증"'
require "$HIERARCHY" 'EMISSION_PROJECT_APPROVE: ["승인"'
require "$HIERARCHY" 'EMISSION_PROJECT_REPORT: ["보고·인증"'
require "$QUEST" 'step.processCode === EMISSION_END_TO_END_PROCESS_CODE'
require "$QUEST" '5개 업무 구간 · 7개 절차'
require "$QUEST" 'const focusedContractSteps = focusedProcessCode'
require "$QUEST" 'const displayedStepOrder = focusedContractStep?.stepOrder'
require "$QUEST" 'const displayedStepName = focusedContractStep?.stepName'
require "$QUEST" 'const displayedNextStep ='
require "$QUEST" 'const focusedProjectId ='
require "$QUEST" 'const completed = focusedContractSteps.length'
require "$ASSIGNMENT" 'isCustomerVisibleEmissionProcess(process.processCode)'
require "$ASSIGNMENT" 'emissionPhaseLabel(step.stepCode,en)'

if [[ "${SKIP_DATABASE_VALIDATION:-0}" != "1" && -f "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh" ]]; then
  source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
  carbonet_postgres_query_init
  step_count="$(carbonet_postgres_query "select count(*) from framework_process_step where process_code='EMISSION_PROJECT'" | tr -d '[:space:]')"
  [[ "$step_count" == "7" ]] || { echo "expected 7 parent steps, found $step_count" >&2; exit 1; }
fi

echo "EMISSION_PROCESS_HIERARCHY_PASS visible=portfolio,parent phases=5 procedures=7 internal=5"
