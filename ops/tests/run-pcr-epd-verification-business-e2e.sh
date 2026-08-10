#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RELAY_PROCESS="PCR_EPD_VERIFICATION"
export RELAY_STEPS="PCR_EPD_VERIFICATION_S1,PCR_EPD_VERIFICATION_S2,PCR_EPD_VERIFICATION_S3,PCR_EPD_VERIFICATION_S4"
export RELAY_STEP_ACTORS="LCA_PRACTITIONER,LCA_PRACTITIONER,VERIFIER,APPROVER"
export RELAY_ACCOUNTS_JSON='{"LCA_PRACTITIONER":"qacalc26","VERIFIER":"qaverify26","APPROVER":"qaapprove26"}'
export RELAY_ROUTE="/generated/pcr-epd-verification/{step}"
export RELAY_PREFIX="PEV"
exec bash "$ROOT/ops/tests/run-declared-process-relay-e2e.sh"
