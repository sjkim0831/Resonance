#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/complete-organizational-boundary-assurance.sh"
bash -n "$TARGET"
for token in 'ORGANIZATIONAL_BOUNDARY_S1' 'ORGANIZATIONAL_BOUNDARY_S4' 'CARBONET_ORG_BOUNDARY_PROMOTE_JOBS=false' 'merge-base --is-ancestor' 'plan-incremental-work.sh' 'framework_current_business_e2e_evidence' 'actual<>4'; do
  grep -Fq "$token" "$TARGET" || { echo "[organizational-boundary-contract] FAIL missing=$token" >&2; exit 1; }
done
printf '[organizational-boundary-contract] PASS steps=4 evidence=atomic freshness=split\n'
