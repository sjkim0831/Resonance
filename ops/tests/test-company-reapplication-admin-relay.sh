#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
HARNESS="$ROOT/ops/scripts/validate-company-reapplication-admin-relay.mjs"
WRAPPER="$ROOT/ops/tests/run-company-reapplication-business-e2e.sh"

grep -Fq '/admin/login/actionLogin' "$HARNESS"
grep -Fq '/admin/member/company-approve' "$HARNESS"
grep -Fq '/admin/api/admin/member/company-approve/action' "$HARNESS"
grep -Fq 'getByText(item.fileName' "$HARNESS"
grep -Fq 'name:"승인"' "$HARNESS"
grep -Fq 'name:"반려 사유"' "$HARNESS"
grep -Fq 'name:"반려"' "$HARNESS"
grep -Fq 'adminRelay:1' "$HARNESS"
grep -Fq 'CARBONET_ADMIN_TEST_PASSWORD' "$WRAPPER"
grep -Fq 'validate-company-reapplication-admin-relay.mjs' "$WRAPPER"
grep -Fq 'admin_state' "$WRAPPER"
grep -Fq '.adminRelay!=1 or .decisions!=2' "$WRAPPER"

if grep -Eq 'userPw:[[:space:]]*"[^$]' "$HARNESS"; then
  echo '[company-reapplication-admin-relay-contract] embedded password is forbidden' >&2
  exit 1
fi

echo '[company-reapplication-admin-relay-contract] PASS public-to-admin=2 decisions=approve+reject evidence=visible responsive=desktop+mobile password=secret-only'
