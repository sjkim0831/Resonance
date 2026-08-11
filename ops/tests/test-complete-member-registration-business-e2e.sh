#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/complete-member-registration-business-e2e.sh"
bash -n "$TARGET"

for value in MEMBER_REGISTRATION_S1 MEMBER_REGISTRATION_S2 MEMBER_REGISTRATION_S5 \
  MEMBER_REGISTRATION_S3 MEMBER_REGISTRATION_S4 EXTERNAL_IDENTITY_PROVIDER_UNAVAILABLE \
  SUCCESSFUL_IDENTITY_REQUIRED framework_current_business_e2e_evidence BUSINESS_E2E \
  capture-business-e2e-contract.sh run-member-registration-step5-business-e2e.sh; do
  grep -Fq "$value" "$TARGET" || { echo "missing contract: $value" >&2; exit 1; }
done
grep -Fq 'promoted<>3' "$TARGET"
grep -Fq 'blocked_promoted<>0' "$TARGET"
grep -Fq 'contract changed during E2E' "$TARGET"
if grep -Eq "S3'.*PASSED|S4'.*PASSED" "$TARGET"; then
  echo '[member-registration-business-contract] FAIL identity-dependent step is hard-coded PASSED' >&2
  exit 1
fi
echo '[member-registration-business-contract] PASS promoted=3 blocked=2 fail-closed=1'
