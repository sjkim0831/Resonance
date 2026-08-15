#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
START_NS="$(date +%s%N)"
WT="$TMP/worktree"
PACKAGE_DIR="$WT/projects/carbonet-backend-metadata/process-runtime/generated/PROCESS_A"
PACKAGE="$PACKAGE_DIR/PROCESS_A__STEP_A.json"

mkdir -p "$WT/ops/scripts" "$WT/ops/runtime-metadata" "$PACKAGE_DIR"
cp "$ROOT/ops/scripts/fast-process-package-test.py" "$WT/ops/scripts/"
cp "$ROOT/ops/scripts/validate-generated-process-dimension.sh" "$WT/ops/scripts/"
cp "$ROOT/ops/scripts/run-deterministic-development-job.sh" "$WT/ops/scripts/"
cp "$ROOT/ops/runtime-metadata/deterministic-development-policy.json" \
  "$WT/ops/runtime-metadata/"
chmod +x "$WT/ops/scripts/"*
printf '{}\n' >"$PACKAGE_DIR/index.json"
printf '{"requirement":"validate snapshot design authority"}\n' >"$TMP/spec.json"
printf 'focused worker fixture\n' >"$TMP/search.txt"

write_package() {
  local layout="$1" theme="$2" source="$3" defaulted_json="$4"
  python3 - "$PACKAGE" "$layout" "$theme" "$source" "$defaulted_json" <<'PY'
import hashlib
import json
import sys

path, layout, theme, source, defaulted_json = sys.argv[1:]
scenario_types = ["HAPPY_PATH", "EXCEPTION", "AUTHORITY", "ISOLATION", "RECOVERY"]
body = {
    "schemaVersion": "2.0.0",
    "process": {"code": "PROCESS_A", "name": "Process A", "domain": "TEST"},
    "step": {
        "code": "STEP_A",
        "actor": {"actorCode": "PROCESS_ACTOR", "scope": "TENANT_PROJECT"},
        "transition": {"commandCode": "COMPLETE", "fromState": "READY", "toState": "DONE"},
        "input": {},
    },
    "frontend": {
        "renderer": "COMMON_SDUI_RUNTIME",
        "required": True,
        "pages": [{
            "audience": "USER",
            "route": "/process-a/step-a",
            "layout": layout,
            "theme": theme,
            "designAuthority": {
                "source": source,
                "layout": layout,
                "theme": theme,
                "defaulted": json.loads(defaulted_json),
            },
            "sections": ["CONTEXT", "ACTIONS", "CONTENT", "EVIDENCE", "HANDOFF"],
            "fields": [{"code": f"field{index}"} for index in range(1, 9)],
            "accessibility": {"keyboard": True},
            "responsive": {"mobile": "single-column", "desktop": "task-optimized"},
        }],
    },
    "backend": {
        "runtime": "COMMON_PROCESS_COMMAND_RUNTIME",
        "commands": [{
            "commandCode": "COMPLETE", "actorCode": "PROCESS_ACTOR",
            "serverAuthorization": True, "entryState": "READY", "resultState": "DONE",
        }],
        "apis": [{"method": "POST", "path": "/api/process-a/{executionId}/complete"}],
    },
    "database": {
        "transactional": True, "historyRequired": True, "indexesRequired": True,
        "foreignKeysRequired": True, "migrationRequired": False,
    },
    "tests": [{
        "caseCode": f"CASE_{scenario}", "type": scenario, "status": "APPROVED",
        "steps": [{"scenario": scenario}], "assertions": [f"{scenario} enforced"],
    } for scenario in scenario_types],
    "testExecution": {
        "runner": "FAST_PROCESS_CONTRACT_RUNNER", "parallelSafe": True,
        "liveSmokeRequiredForVerified": True,
    },
    "nonfunctional": {
        "security": {
            "serverAuthorization": True, "tenantIsolation": True, "projectIsolation": True,
        },
        "recovery": {"resumeFromLastVerifiedState": True},
    },
    "approvalStatus": "APPROVED",
}
stable = json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
body["packageHash"] = hashlib.sha256(stable.encode()).hexdigest()
with open(path, "w", encoding="utf-8") as handle:
    json.dump(body, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
PY
}

rehash_with_mismatched_layout_authority() {
  python3 - "$PACKAGE" <<'PY'
import hashlib
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    body = json.load(handle)
body["frontend"]["pages"][0]["designAuthority"]["layout"] = "RESPONSIVE_WORKSPACE"
body.pop("packageHash", None)
stable = json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
body["packageHash"] = hashlib.sha256(stable.encode()).hexdigest()
with open(path, "w", encoding="utf-8") as handle:
    json.dump(body, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
PY
}

write_package "REVIEW_DECISION" "KRDS_GOV_DEFAULT" \
  "STEP_EXECUTION_SPEC_SCREEN_CONTRACT" '[]'
python3 "$WT/ops/scripts/fast-process-package-test.py" "$PACKAGE" >/dev/null
bash "$WT/ops/scripts/validate-generated-process-dimension.sh" \
  "$WT" PROCESS_A STEP_A UI_QUALITY >/dev/null
bash "$WT/ops/scripts/run-deterministic-development-job.sh" \
  "$WT" PROCESS_A STEP_A 42 UI_QUALITY canonical://PROCESS_A \
  "$TMP/spec.json" "$TMP/search.txt" >/dev/null
WORKER_EVIDENCE="$WT/docs/ai/85-adopted-quality/process_a/step_a-UI_QUALITY-job-42.md"
grep -q 'REVIEW_DECISION' "$WORKER_EVIDENCE"
grep -q 'KRDS_GOV_DEFAULT' "$WORKER_EVIDENCE"
grep -q 'STEP_EXECUTION_SPEC_SCREEN_CONTRACT' "$WORKER_EVIDENCE"

rehash_with_mismatched_layout_authority
if python3 "$WT/ops/scripts/fast-process-package-test.py" "$PACKAGE" >/dev/null 2>&1; then
  echo 'hash-valid page/designAuthority mismatch escaped fast validator' >&2
  exit 1
fi
if bash "$WT/ops/scripts/validate-generated-process-dimension.sh" \
  "$WT" PROCESS_A STEP_A UI_QUALITY >/dev/null 2>&1; then
  echo 'hash-valid page/designAuthority mismatch escaped dimension validator' >&2
  exit 1
fi

write_package "RESPONSIVE_WORKSPACE" "KRDS_GOV_DEFAULT" \
  "LEGACY_REGISTERED_DEFAULT" '["layout","theme"]'
python3 "$WT/ops/scripts/fast-process-package-test.py" "$PACKAGE" >/dev/null
bash "$WT/ops/scripts/validate-generated-process-dimension.sh" \
  "$WT" PROCESS_A STEP_A UI_QUALITY >/dev/null

write_package "REVIEW_DECISION" "KRDS_GOV_DEFAULT" \
  "LEGACY_REGISTERED_DEFAULT" '["layout","theme"]'
if python3 "$WT/ops/scripts/fast-process-package-test.py" "$PACKAGE" >/dev/null 2>&1; then
  echo 'non-default layout escaped legacy fallback authority gate' >&2
  exit 1
fi

if grep -En 'COMMON_KRDS_TASK_LAYOUT|COMMON_KRDS_GOV' \
  "$ROOT/ops/scripts/fast-process-package-test.py" \
  "$ROOT/ops/scripts/validate-generated-process-dimension.sh" \
  "$ROOT/ops/scripts/run-deterministic-development-job.sh" >/dev/null; then
  echo 'retired unregistered COMMON design defaults remain in worker validators' >&2
  exit 1
fi

elapsed_ms="$((($(date +%s%N)-START_NS)/1000000))"
echo "GENERATED_DESIGN_AUTHORITY_WORKER_OK cases=4 elapsedMs=$elapsed_ms"
