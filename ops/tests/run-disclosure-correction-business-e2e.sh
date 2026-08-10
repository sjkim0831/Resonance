#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RELAY_PROCESS="DISCLOSURE_CORRECTION"
export RELAY_STEPS="DISCLOSURE_CORRECTION_S1,DISCLOSURE_CORRECTION_S2,DISCLOSURE_CORRECTION_S3,DISCLOSURE_CORRECTION_S4"
export RELAY_STEP_ACTORS="CALCULATOR,CALCULATOR,VERIFIER,APPROVER"
export RELAY_ACCOUNTS_JSON='{"CALCULATOR":"qacalc26","VERIFIER":"qaverify26","APPROVER":"qaapprove26"}'
export RELAY_ROUTE="/generated/disclosure-correction/{step}"
export RELAY_PREFIX="DC"
exec bash "$ROOT/ops/tests/run-declared-process-relay-e2e.sh"
