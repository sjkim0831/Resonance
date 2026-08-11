#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"; TARGET="$ROOT/ops/scripts/report-process-closing-classification.sh"; bash -n "$TARGET"
for token in EXTERNAL_BLOCKED DESIGN_GAP IMPLEMENTATION_GAP TEST_GAP READY framework_current_business_e2e_evidence framework_professional_screen_readiness framework_process_design_assurance_matrix 'approvedTestTypes<5' 'currentPassedSteps<.stepCount' '--gate'; do grep -Fq -- "$token" "$TARGET" || { echo "[process-closing-classification] FAIL missing=$token" >&2; exit 1; }; done
mapfile -t order < <(grep -n 'then \"EXTERNAL_BLOCKED\"\|then \"DESIGN_GAP\"\|then \"IMPLEMENTATION_GAP\"\|then \"TEST_GAP\"' "$TARGET"|cut -d: -f1)
[[ "${#order[@]}" == 4 && "${order[0]}" -lt "${order[1]}" && "${order[1]}" -lt "${order[2]}" && "${order[2]}" -lt "${order[3]}" ]] || { echo "[process-closing-classification] FAIL priority-order=${order[*]:-missing}" >&2; exit 1; }
printf '[process-closing-classification] PASS states=5 priority=external>design>implementation>test>ready ai=false\n'
