#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:?repository root is required}"
PROCESS="${2:?process code is required}"
STEP="${3:?step code is required}"
DIMENSION="${4:?job dimension is required}"

PACKAGE_DIR="$ROOT/projects/carbonet-backend-metadata/process-runtime/generated/$PROCESS"
INDEX="$PACKAGE_DIR/index.json"
PACKAGE="$PACKAGE_DIR/${PROCESS}__${STEP}.json"
TESTER="$ROOT/ops/scripts/fast-process-package-test.py"
EVIDENCE_DIR="$ROOT/var/test-evidence/process-package-tests"

[[ -s "$INDEX" && -s "$PACKAGE" && -x "$TESTER" ]] || exit 3
mkdir -p "$EVIDENCE_DIR"
python3 "$TESTER" "$PACKAGE" \
  --cache-dir "$ROOT/var/verification/process-package-tests" \
  --evidence "$EVIDENCE_DIR/${PROCESS}__${STEP}.json" >/dev/null

jq -e --arg process "$PROCESS" --arg step "$STEP" '
  .schemaVersion == "2.0.0"
  and .approvalStatus == "APPROVED"
  and .process.code == $process
  and .step.code == $step
  and .frontend.renderer == "COMMON_SDUI_RUNTIME"
  and .backend.runtime == "COMMON_PROCESS_COMMAND_RUNTIME"
  and ((.frontend.required == false and (.frontend.pages | length) == 0)
    or (.frontend.required == true and (.frontend.pages | length) > 0
      and all(.frontend.pages[]; (.fields | length) >= 8)))
  and (.backend.commands | length) > 0
' "$PACKAGE" >/dev/null

case "$DIMENSION" in
  FRONTEND_USER|FRONTEND_ADMIN)
    expected_audience="USER"
    [[ "$DIMENSION" == "FRONTEND_ADMIN" ]] && expected_audience="ADMIN"
    jq -e --arg audience "$expected_audience" '
      any(.frontend.pages[];
        .audience == $audience
        and (.route | type == "string" and startswith("/"))
        and (.fields | length) >= 8
        and .layout == "COMMON_KRDS_TASK_LAYOUT"
        and .theme == "COMMON_KRDS_GOV")
    ' "$PACKAGE" >/dev/null
    ;;
  API|API_QUALITY|BACKEND|BACKEND_QUALITY)
    jq -e '
      (.backend.apis | length) > 0
      and all(.backend.apis[];
        ((.path // .declaredContract // "") | type == "string" and length > 0)
        and ((.method // "CONTRACT") | type == "string" and length > 0))
      and all(.backend.commands[];
        .serverAuthorization == true
        and (.entryState | type == "string" and length > 0)
        and (.resultState | type == "string" and length > 0))
    ' "$PACKAGE" >/dev/null
    ;;
  DATABASE|DATABASE_QUALITY)
    jq -e '
      .database.transactional == true
      and .database.historyRequired == true
      and .database.indexesRequired == true
      and .database.foreignKeysRequired == true
      and (.database.primaryEntities | length) > 0
    ' "$PACKAGE" >/dev/null
    ;;
  TEST|ACTOR_TEST)
    jq -e '
      ([.tests[] | select(.status == "APPROVED" or .status == "VERIFIED") | .type] | unique) as $types
      | all(["HAPPY_PATH","EXCEPTION","AUTHORITY","ISOLATION","RECOVERY"][]; . as $required | $types | index($required) != null)
    ' "$PACKAGE" >/dev/null
    ;;
  INTEGRATION)
    jq -e '
      .database.transactional == true
      and .database.historyRequired == true
      and (.backend.apis | length) > 0
      and (.frontend.pages | length) > 0
      and (.tests | length) >= 5
      and .testExecution.liveSmokeRequiredForVerified == true
      and .nonfunctional.security.serverAuthorization == true
      and .nonfunctional.security.tenantIsolation == true
      and .nonfunctional.security.projectIsolation == true
      and .nonfunctional.recovery.resumeFromLastVerifiedState == true
    ' "$PACKAGE" >/dev/null
    ;;
  *)
    exit 3
    ;;
esac

jq -cn \
  --arg process "$PROCESS" --arg step "$STEP" --arg dimension "$DIMENSION" \
  --arg package "$PACKAGE" --arg evidence "$EVIDENCE_DIR/${PROCESS}__${STEP}.json" \
  '{strategy:"APPROVED_FULL_STACK_PACKAGE",processCode:$process,stepCode:$step,dimension:$dimension,package:$package,evidence:$evidence,status:"PASSED"}'
