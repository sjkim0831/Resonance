#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RELAY_PROCESS="PRIVACY_RETENTION_DESTRUCTION"
export RELAY_STEPS="PRD_ACCESS,PRD_CLASSIFY,PRD_DESTROY"
export RELAY_STEP_ACTORS="PRIVACY_OFFICER,PRIVACY_OFFICER,PRIVACY_OFFICER"
export RELAY_ACCOUNTS_JSON='{"PRIVACY_OFFICER":"qaverify26","HSE_MANAGER":"qacalc26"}'
export RELAY_ROUTE="/work/privacy-retention-destruction"
export RELAY_PREFIX="PRD"
exec bash "$ROOT/ops/tests/run-declared-process-relay-e2e.sh"
