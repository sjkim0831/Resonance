#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RELAY_PROCESS="LEAKAGE_INCIDENT_RESPONSE"
export RELAY_STEPS="LEAKAGE_INCIDENT_RESPONSE_S1,LEAKAGE_INCIDENT_RESPONSE_S2,LEAKAGE_INCIDENT_RESPONSE_S3,LEAKAGE_INCIDENT_RESPONSE_S4"
export RELAY_STEP_ACTORS="SITE_DATA_OWNER,SITE_DATA_OWNER,VERIFIER,COMPANY_MANAGER"
export RELAY_ACCOUNTS_JSON='{"SITE_DATA_OWNER":"qadata26","VERIFIER":"qaverify26","COMPANY_MANAGER":"qaowner26"}'
export RELAY_ROUTE="/generated/leakage-incident-response/{step}"
export RELAY_PREFIX="LIR"
exec bash "$ROOT/ops/tests/run-declared-process-relay-e2e.sh"
