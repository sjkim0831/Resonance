#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"; TARGET="$ROOT/ops/scripts/complete-customer-work-coordination-assurance.sh"; bash -n "$TARGET"
for token in CUSTOMER_WORK_DISCOVER CUSTOMER_WORK_PUBLIC_VERIFY validate-customer-work-journey.sh 'actors=6 tasks=7/7' 'certificate=valid regulatory=accepted formula=reconciled' 'merge-base --is-ancestor' framework_current_business_e2e_evidence 'actual<>7'; do grep -Fq "$token" "$TARGET" || { echo "[customer-work-coordination-contract] FAIL missing=$token" >&2; exit 1; }; done
printf '[customer-work-coordination-contract] PASS steps=7 actors=6 relay=complete evidence=atomic\n'
