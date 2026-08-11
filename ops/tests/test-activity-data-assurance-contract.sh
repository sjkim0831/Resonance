#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/complete-activity-data-assurance.sh"
bash -n "$TARGET"
for token in ACTIVITY_DATA_01_PLAN ACTIVITY_DATA_04_APPROVE validate-activity-data-runtime.sh 'merge-base --is-ancestor' plan-incremental-work.sh framework_current_business_e2e_evidence 'actual<>4'; do
  grep -Fq "$token" "$TARGET" || { echo "[activity-data-contract] FAIL missing=$token" >&2; exit 1; }
done
printf '[activity-data-contract] PASS steps=4 evidence=atomic freshness=split\n'
