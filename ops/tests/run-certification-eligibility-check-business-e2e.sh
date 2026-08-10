#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RELAY_PROCESS="CERTIFICATION_ELIGIBILITY_CHECK"
export RELAY_STEPS="CEC_VALIDATE_COMPANY,CEC_VERIFY_EXTERNAL,CEC_DECIDE"
export RELAY_STEP_ACTORS="CERTIFICATE_OFFICER,SYSTEM_INTEGRATOR,CERTIFICATE_OFFICER"
export RELAY_ACCOUNTS_JSON='{"CERTIFICATE_OFFICER":"qaverify26","SYSTEM_INTEGRATOR":"qacalc26"}'
export RELAY_ROUTE="/work/certification-eligibility-check"
export RELAY_PREFIX="CEC"
exec bash "$ROOT/ops/tests/run-declared-process-relay-e2e.sh"
