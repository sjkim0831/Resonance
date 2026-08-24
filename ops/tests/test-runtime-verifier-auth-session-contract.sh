#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HELPER="$ROOT/ops/scripts/runtime-qa-auth-common.sh"
TARGETS=(
  "$ROOT/ops/scripts/verify-admin-route-bootstrap.sh"
  "$ROOT/ops/scripts/verify-external-monitoring-bootstrap.sh"
  "$ROOT/ops/scripts/emission-management-auth-common.sh"
)
ALL=("$HELPER" "${TARGETS[@]}")

for file in "${ALL[@]}"; do
  [[ -f "$file" ]] || { echo "[runtime-verifier-auth] missing file: $file" >&2; exit 1; }
  bash -n "$file"
done

if grep -Eq 'Forge[A-Za-z]*Token|createAccessToken|TOKEN_ACCESS_SECRET|TOKEN_REFRESH_SECRET|change-me-access-secret|Cookie: accessToken' "${ALL[@]}"; then
  echo '[runtime-verifier-auth] forged JWT path remains' >&2
  exit 1
fi

grep -Fq '/signin/actionLogin' "$HELPER"
grep -Fq '/signin/actionLogout' "$HELPER"
grep -Fq '[[ "$status" != "401" ]]' "$HELPER"
grep -Fq 'already unauthenticated' "$HELPER"
grep -Fq 'primary webmaster login is forbidden' "$HELPER"
grep -Fq 'carbonet-test-account-switch' "$HELPER"
grep -Fq 'carbonet_qa_login "$COOKIE_JAR"' "${TARGETS[0]}"
grep -Fq 'carbonet_qa_login "$COOKIE_JAR"' "${TARGETS[1]}"
grep -Fq 'carbonet_qa_login "$cookie_jar"' "${TARGETS[2]}"

printf '[runtime-verifier-auth] PASS scripts=%s forgedJwt=0 primaryMaster=forbidden login=canonical logout=canonical\n' "${#TARGETS[@]}"
