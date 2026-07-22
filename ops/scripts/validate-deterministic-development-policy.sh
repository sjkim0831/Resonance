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
  (.deterministicJobTypes | sort == ["ACTOR_TEST","API","API_QUALITY","BACKEND","BACKEND_QUALITY","DATABASE","DATABASE_QUALITY","DEPLOYMENT","DESIGN","DESIGN_PREFLIGHT","FRONTEND_ADMIN","FRONTEND_USER","FULL_STACK","FULL_STACK_GENERATION","INTEGRATION","NOTIFICATION","PERFORMANCE","REFERENCE_ANALYSIS","SEARCH","TEST"])
' "$POLICY" >/dev/null
bash -n "$WORKER"
bash -n "$RUNNER"
bash -n "$ROOT/ops/scripts/generate-full-stack-design-packages.sh"
bash -n "$ROOT/ops/scripts/validate-full-stack-design-generation.sh"
python3 -m py_compile "$ROOT/ops/scripts/generate-full-stack-design-packages.py"
bash "$ROOT/ops/scripts/validate-incremental-screen-generation.sh" "$ROOT" >/dev/null
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
assert module.group_fields_by_audience(flat) == {"*": [
    {**flat[0], "code": "title"},
    {**flat[1], "code": "decision"},
]}

legacy = [
    {"audience": "USER", "fields": [{"fieldCode": "title"}]},
    {"audience": "ADMIN", "fields": [{"fieldCode": "decision"}]},
]
assert module.group_fields_by_audience(legacy) == {
    "USER": [{"fieldCode": "title"}],
    "ADMIN": [{"fieldCode": "decision"}],
}

prototype = {
    "audience": "ADMIN", "pageCode": "SHARED", "title": "Shared",
    "purpose": "Shared workspace", "plannedRoute": "/admin/shared",
    "actualRoute": "/admin/shared", "routeStatus": "IMPLEMENTED",
}
step = {
    "step_code": "REVIEW", "screen_contract": [],
    "field_contract": [{"fieldCode": "title"}],
    "guide_contract": {"adminPath": "/admin/work?step=REVIEW"},
    "business_contract": {"stepName": "Review", "requirement": "Review the change"},
}
projected = module.screens_for_step(step, [prototype])
assert projected[0]["actualRoute"] == "/admin/work?step=REVIEW"
assert projected[0]["pageCode"] == "REVIEW_ADMIN_WORKSPACE"

backend_only = {
    "screen_contract": [], "field_contract": [],
    "command_contract": [{"commandCode": "WORK"}],
    "api_contract": [{"declaredContract": None}],
    "persistence_contract": {
        "primaryEntities": [], "fieldMappings": [], "migrationRequired": True,
        "transactional": True, "historyRequired": True,
    },
}
persistence = module.persistence_for_step(backend_only)
assert persistence["contractSource"] == "COMMON_PROCESS_COMMAND_RUNTIME"
assert persistence["primaryEntities"] == [
    "framework_process_execution",
    "framework_process_execution_event",
    "framework_process_work_draft",
]
assert len(persistence["fieldMappings"]) == 6
apis = module.apis_for_step(backend_only)
assert apis[0]["declaredContract"] == "COMMON_PROCESS_EXECUTION_RUNTIME_V1"
assert apis[0]["method"] == "CONTRACT"
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
grep -Fq 'FLAT_FIELD_CONTRACT_RETRY' "$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
grep -Fq 'READY_PACKAGE_RETRY' "$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
grep -Fq 'SPEC_APPROVAL_WAIT_V1' "$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
grep -Fq 'APPROVED_GENERATOR_V7_RETRY' "$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
grep -Fq 'exact step package missing' "$RUNNER"
grep -Fq 'fast-process-package-test.py" "$generated_step_package"' "$RUNNER"
grep -Fq 'main push rejected after 3 guarded attempts' "$WORKER"
grep -Fq 'GENERATED_DIMENSION_V4_RETRY' "$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
grep -Fq 'EXACT_GENERATED_DIMENSION_FALLBACK' "$WORKER"
grep -Fq "j.job_type='FRONTEND_ADMIN' and step.requires_admin_page=false" "$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
grep -Fq 'IDENTICAL_GOVERNED_DESIGN' "$WORKER"
grep -Fq 'APPROVED_GENERATED_PACKAGE_REPAIR_PENDING' "$WORKER"
grep -Fq 'COMMON_PROCESS_COMMAND_RUNTIME' "$ROOT/ops/scripts/generate-full-stack-design-packages.py"
grep -Fq 'incomplete_spec_demoted' "$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"

deterministic_line="$(grep -n 'DETERMINISTIC_RUNNER=' "$WORKER" | head -1 | cut -d: -f1)"
ai_line="$(grep -n 'bash "$PROJECT_WORK_RUNNER"' "$WORKER" | head -1 | cut -d: -f1)"
[[ -n "$deterministic_line" && -n "$ai_line" && "$deterministic_line" -lt "$ai_line" ]]

echo "PASS deterministic-first development policy and fail-closed AI escalation"
