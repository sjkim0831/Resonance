#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/validate-kisa-live-readiness.sh"
bash -n "$TARGET"
for token in sdkReady jarMounted configuredKeys missingKeys configuredCount requiredCount liveReady \
  SECURITY_EXTERNAL_AUTH_KISA_CLIENT_ID SECURITY_EXTERNAL_AUTH_KISA_SERVICE_CODE \
  SECURITY_EXTERNAL_AUTH_KISA_CA_CODE SECURITY_EXTERNAL_AUTH_KISA_PREPARE_ENDPOINT \
  SECURITY_EXTERNAL_AUTH_KISA_RESULT_ENDPOINT SECURITY_EXTERNAL_AUTH_KISA_CALLBACK_SCHEME \
  '/app/lib/kr.or.kisa.dapc.core-1.0.0.jar' 'exit 75'; do
  grep -Fq "$token" "$TARGET" || { echo "[kisa-readiness-contract] missing=$token" >&2; exit 1; }
done
if grep -Eq 'printenv.*echo.*value|env$|set -x' "$TARGET"; then
  echo '[kisa-readiness-contract] possible secret value output' >&2
  exit 1
fi
echo '[kisa-readiness-contract] PASS checks=7 secrets=redacted strict=1 report=1'
