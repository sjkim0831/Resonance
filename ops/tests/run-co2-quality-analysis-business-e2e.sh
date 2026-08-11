#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RELAY_PROCESS="CO2_QUALITY_ANALYSIS"
export RELAY_STEPS="CQA_PLAN,CQA_TEST,CQA_DECIDE"
export RELAY_STEP_ACTORS="LAB_ANALYST,LAB_ANALYST,CERTIFICATE_OFFICER"
export RELAY_ACCOUNTS_JSON='{"LAB_ANALYST":"qacalc26","CERTIFICATE_OFFICER":"qaapprove26"}'
export RELAY_ROUTE="/work/co2-quality-analysis"
export RELAY_PREFIX="CQA"
exec bash "$ROOT/ops/tests/run-declared-process-relay-e2e.sh"
