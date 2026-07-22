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
  (.deterministicJobTypes | sort == ["ACTOR_TEST","API","API_QUALITY","BACKEND","BACKEND_QUALITY","DATABASE","DATABASE_QUALITY","DEPLOYMENT","DESIGN","DESIGN_PREFLIGHT","FULL_STACK","FULL_STACK_GENERATION","INTEGRATION","NOTIFICATION","PERFORMANCE","REFERENCE_ANALYSIS","SEARCH","TEST"])
' "$POLICY" >/dev/null
bash -n "$WORKER"
bash -n "$RUNNER"
bash -n "$ROOT/ops/scripts/generate-full-stack-design-packages.sh"
bash -n "$ROOT/ops/scripts/validate-full-stack-design-generation.sh"
python3 -m py_compile "$ROOT/ops/scripts/generate-full-stack-design-packages.py"
python3 - "$ROOT" <<'PY'
import importlib.util
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
path = root / "ops/scripts/generate-full-stack-design-packages.py"
spec = importlib.util.spec_from_file_location("full_stack_generator", path)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)

flat = [
    {"fieldCode": "title", "label": "Title", "controlType": "TEXT"},
    {"fieldCode": "decision", "label": "Decision", "controlType": "SELECT"},
]
assert module.group_fields_by_audience(flat) == {"*": flat}

legacy = [
    {"audience": "USER", "fields": [{"fieldCode": "title"}]},
    {"audience": "ADMIN", "fields": [{"fieldCode": "decision"}]},
]
assert module.group_fields_by_audience(legacy) == {
    "USER": [{"fieldCode": "title"}],
    "ADMIN": [{"fieldCode": "decision"}],
}
PY
bash -n "$ROOT/ops/scripts/validate-existing-emission-project-database.sh"
bash -n "$ROOT/ops/scripts/validate-existing-emission-project-api.sh"
bash -n "$ROOT/ops/scripts/validate-existing-emission-project-notification.sh"
bash -n "$ROOT/ops/scripts/validate-existing-emission-project-search.sh"
bash -n "$ROOT/ops/scripts/validate-existing-emission-project-performance.sh"
bash -n "$ROOT/ops/scripts/validate-existing-emission-project-journey.sh"
grep -Fq 'DETERMINISTIC_FIRST' "$WORKER"
grep -Fq 'AI_ESCALATED' "$WORKER"
grep -Fq 'single automatic AI escalation was already consumed' "$WORKER"

deterministic_line="$(grep -n 'DETERMINISTIC_RUNNER=' "$WORKER" | head -1 | cut -d: -f1)"
ai_line="$(grep -n 'bash "$PROJECT_WORK_RUNNER"' "$WORKER" | head -1 | cut -d: -f1)"
[[ -n "$deterministic_line" && -n "$ai_line" && "$deterministic_line" -lt "$ai_line" ]]

echo "PASS deterministic-first development policy and fail-closed AI escalation"
