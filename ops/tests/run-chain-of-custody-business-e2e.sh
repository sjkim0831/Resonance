#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RELAY_PROCESS="CHAIN_OF_CUSTODY"
export RELAY_STEPS="CHAIN_OF_CUSTODY_S1,CHAIN_OF_CUSTODY_S2,CHAIN_OF_CUSTODY_S3,CHAIN_OF_CUSTODY_S4"
export RELAY_STEP_ACTORS="SYSTEM_INTEGRATOR,SYSTEM_INTEGRATOR,VERIFIER,APPROVER"
export RELAY_ACCOUNTS_JSON='{"SYSTEM_INTEGRATOR":"qacalc26","VERIFIER":"qaverify26","APPROVER":"qaapprove26"}'
export RELAY_ROUTE="/generated/chain-of-custody/{step}"
export RELAY_PREFIX="COC"
exec bash "$ROOT/ops/tests/run-declared-process-relay-e2e.sh"
