#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RELAY_PROCESS="FACILITY_EMERGENCY_RESPONSE"
export RELAY_STEPS="FER_DECLARE,FER_CONTROL,FER_RECOVER"
export RELAY_STEP_ACTORS="FACILITY_OPERATOR,HSE_MANAGER,HSE_MANAGER"
export RELAY_ACCOUNTS_JSON='{"FACILITY_OPERATOR":"qacalc26","HSE_MANAGER":"qaverify26"}'
export RELAY_ROUTE="/ccus/facility/facility-emergency-response"
export RELAY_PREFIX="FER"
exec bash "$ROOT/ops/tests/run-declared-process-relay-e2e.sh"
