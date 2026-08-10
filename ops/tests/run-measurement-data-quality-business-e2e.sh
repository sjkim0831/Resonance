#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RELAY_PROCESS="MEASUREMENT_DATA_QUALITY"
export RELAY_STEPS="MEASUREMENT_DATA_QUALITY_S1,MEASUREMENT_DATA_QUALITY_S2,MEASUREMENT_DATA_QUALITY_S3,MEASUREMENT_DATA_QUALITY_S4"
export RELAY_STEP_ACTORS="SITE_DATA_OWNER,SITE_DATA_OWNER,VERIFIER,APPROVER"
export RELAY_ACCOUNTS_JSON='{"SITE_DATA_OWNER":"qadata26","VERIFIER":"qaverify26","APPROVER":"qaapprove26"}'
export RELAY_ROUTE="/generated/measurement-data-quality/{step}"
export RELAY_PREFIX="MDQ"
exec bash "$ROOT/ops/tests/run-declared-process-relay-e2e.sh"
