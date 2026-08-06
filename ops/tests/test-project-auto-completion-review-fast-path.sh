#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ORCHESTRATOR="$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"

fail() {
  echo "[project-auto-completion-review-fast-path] FAIL: $*" >&2
  exit 1
}

grep -Fq 'review_ready_candidate_exists="$(psqlq -c "' "$ORCHESTRATOR" \
  || fail 'bounded REVIEW_REQUIRED precheck is missing'
[[ "$(grep -Fc 'if [[ "$review_ready_candidate_exists" == "1" ]]' "$ORCHESTRATOR")" -eq 2 ]] \
  || fail 'approval SQL and static gate must share exactly two candidate guards'
[[ "$(grep -Fc 'skipped: no REVIEW_REQUIRED candidates' "$ORCHESTRATOR")" -eq 2 ]] \
  || fail 'both fast-path skip decisions must be observable'

precheck_line="$(grep -n 'review_ready_candidate_exists="$(psqlq -c "' "$ORCHESTRATOR" | head -1 | cut -d: -f1)"
quality_view_line="$(grep -n 'framework_professional_design_graph_quality' "$ORCHESTRATOR" | head -1 | cut -d: -f1)"
[[ -n "$precheck_line" && -n "$quality_view_line" && "$precheck_line" -lt "$quality_view_line" ]] \
  || fail 'candidate precheck must execute before the graph-quality view'

grep -Fq 'deterministic_specs_approved=0' "$ORCHESTRATOR" \
  || fail 'zero-candidate result must remain deterministic'
grep -Fq 'static_contract_gate_result=' "$ORCHESTRATOR" \
  || fail 'static gate must keep its NOOP result contract'

echo '[project-auto-completion-review-fast-path] PASS guards=2 skipLogs=2 failClosed=psqlq'
