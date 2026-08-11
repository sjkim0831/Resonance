#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RELAY_PROCESS="REGULATORY_SUBMISSION"
export RELAY_STEPS="REGULATORY_SUBMISSION_S1,REGULATORY_SUBMISSION_S2,REGULATORY_SUBMISSION_S3,REGULATORY_SUBMISSION_S4"
export RELAY_STEP_ACTORS="COMPANY_MANAGER,COMPANY_MANAGER,VERIFIER,APPROVER"
export RELAY_ACCOUNTS_JSON='{"COMPANY_MANAGER":"qaowner26","VERIFIER":"qaverify26","APPROVER":"qaapprove26"}'
export RELAY_ROUTE="/emission/report-submission"
export RELAY_PREFIX="RS"
exec bash "$ROOT/ops/tests/run-declared-process-relay-e2e.sh"
