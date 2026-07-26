#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SERVICE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/aiadmin/service/E4bGeneratorSelectionService.java"
GOVERNANCE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"
CONTROLLER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/aiadmin/web/AiAdminController.java"
grep -F 'PRECOMPILED_BLUEPRINTS=' "$SERVICE" >/dev/null
grep -F 'E4B selected an unregistered blueprint' "$SERVICE" >/dev/null
grep -F 'queueSelectedBlueprint(blueprintId, actor)' "$SERVICE" >/dev/null
grep -F 'validation_status' "$GOVERNANCE" | grep -F "VALID" >/dev/null
grep -F '/e4b/development/precompile' "$CONTROLLER" >/dev/null
grep -F 'E4B_REGISTERED_CANDIDATES_ONLY' "$SERVICE" >/dev/null
echo 'PASS E4B can select and execute only precompiled, validated screen blueprints'
