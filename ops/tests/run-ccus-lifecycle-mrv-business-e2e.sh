#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RELAY_PROCESS="CCUS_LIFECYCLE_MRV"
export RELAY_STEPS="CCUS_LIFECYCLE_MRV_S1,CCUS_LIFECYCLE_MRV_S2,CCUS_LIFECYCLE_MRV_S3,CCUS_LIFECYCLE_MRV_S4"
export RELAY_STEP_ACTORS="CALCULATOR,CALCULATOR,VERIFIER,APPROVER"
export RELAY_ACCOUNTS_JSON='{"CALCULATOR":"qacalc26","VERIFIER":"qaverify26","APPROVER":"qaapprove26"}'
export RELAY_ROUTE="/generated/ccus-lifecycle-mrv/{step}"
export RELAY_PREFIX="CLMRV"
exec bash "$ROOT/ops/tests/run-declared-process-relay-e2e.sh"
