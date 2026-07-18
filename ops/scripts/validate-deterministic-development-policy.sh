#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
POLICY="$ROOT/ops/runtime-metadata/deterministic-development-policy.json"
WORKER="$ROOT/ops/scripts/run-process-development-worker.sh"
RUNNER="$ROOT/ops/scripts/run-deterministic-development-job.sh"

jq -e '
  .policyId == "resonance-deterministic-first-development" and
  .evidenceRequired == true and
  .allowUnverifiedCompletion == false and
  .defaultExecutionOrder[0] == "EXACT_EXISTING_IMPLEMENTATION" and
  .defaultExecutionOrder[-1] == "AI_ESCALATION" and
  (.deterministicJobTypes | sort == ["API","API_QUALITY","DATABASE","DATABASE_QUALITY","DEPLOYMENT","DESIGN","DESIGN_PREFLIGHT","REFERENCE_ANALYSIS"])
' "$POLICY" >/dev/null
bash -n "$WORKER"
bash -n "$RUNNER"
bash -n "$ROOT/ops/scripts/validate-existing-emission-project-database.sh"
bash -n "$ROOT/ops/scripts/validate-existing-emission-project-api.sh"
grep -Fq 'DETERMINISTIC_FIRST' "$WORKER"
grep -Fq 'AI_ESCALATED' "$WORKER"
grep -Fq 'single automatic AI escalation was already consumed' "$WORKER"

deterministic_line="$(grep -n 'DETERMINISTIC_RUNNER=' "$WORKER" | head -1 | cut -d: -f1)"
ai_line="$(grep -n 'bash "$PROJECT_WORK_RUNNER"' "$WORKER" | head -1 | cut -d: -f1)"
[[ -n "$deterministic_line" && -n "$ai_line" && "$deterministic_line" -lt "$ai_line" ]]

echo "PASS deterministic-first development policy and fail-closed AI escalation"
