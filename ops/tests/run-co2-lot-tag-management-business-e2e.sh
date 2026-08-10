#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RELAY_PROCESS="CO2_LOT_TAG_MANAGEMENT"
export RELAY_STEPS="CLT_CREATE,CLT_RECONCILE,CLT_APPROVE"
export RELAY_STEP_ACTORS="TRADE_OPERATOR,TRADE_OPERATOR,AUDITOR"
export RELAY_ACCOUNTS_JSON='{"TRADE_OPERATOR":"qacalc26","AUDITOR":"qaverify26"}'
export RELAY_ROUTE="/work/co2-lot-tag-management"
export RELAY_PREFIX="CLT"
exec bash "$ROOT/ops/tests/run-declared-process-relay-e2e.sh"
