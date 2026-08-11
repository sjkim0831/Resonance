#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/promote-company-onboarding-screens-atomically.sh"
COMMON="$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh"
WRAPPER="$ROOT/ops/tests/run-company-onboarding-business-e2e.sh"

bash -n "$TARGET" "$COMMON" "$WRAPPER"
for token in \
  '--prepare-only' 'prepared.jsonl' "lines=['BEGIN;']" "lines.push('COMMIT;')" \
  "passed<>5" 'lock_timeout=10000' 'statement_timeout=60000' \
  'psql -v ON_ERROR_STOP=1' 'promote-company-onboarding-screens-atomically.sh'; do
  grep -Fq -- "$token" "$TARGET" "$COMMON" "$WRAPPER" || {
    echo "COMPANY_ONBOARDING_ATOMIC_PROMOTION_CONTRACT_MISSING token=$token" >&2
    exit 1
  }
done
[[ "$(grep -c 'bash "$COMMON_PROMOTER"' "$TARGET")" == 1 ]] || {
  echo COMPANY_ONBOARDING_ATOMIC_PROMOTION_COMMON_CALL_INVALID >&2; exit 1;
}
[[ "$(grep -c 'kubectl .* exec -i' "$TARGET")" == 1 ]] || {
  echo COMPANY_ONBOARDING_ATOMIC_PROMOTION_TRANSACTION_COUNT_INVALID >&2; exit 1;
}
if grep -Eq 'for step[[:space:]]+in[[:space:]]+.*promote-screen-contract-after-e2e' "$WRAPPER"; then
  echo COMPANY_ONBOARDING_PARTIAL_PROMOTION_LOOP_REMAINS >&2; exit 1
fi
echo COMPANY_ONBOARDING_ATOMIC_PROMOTION_CONTRACT_PASS
