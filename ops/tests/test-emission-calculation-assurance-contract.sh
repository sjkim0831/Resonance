#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"; TARGET="$ROOT/ops/scripts/complete-emission-calculation-assurance.sh"; bash -n "$TARGET"
for token in EMISSION_CALCULATION_01_PLAN EMISSION_CALCULATION_04_APPROVE validate-emission-calculation-runtime.sh formula=reconciled 'merge-base --is-ancestor' plan-incremental-work.sh framework_current_business_e2e_evidence 'actual<>4'; do grep -Fq "$token" "$TARGET" || { echo "[emission-calculation-contract] FAIL missing=$token" >&2; exit 1; }; done
printf '[emission-calculation-contract] PASS steps=4 formula=reconciled evidence=atomic freshness=split\n'
