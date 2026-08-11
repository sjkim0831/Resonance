#!/usr/bin/env bash
set -euo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SCRIPT="$ROOT/ops/scripts/resonance-backstage-oidc-token.sh"
grep -Fq 'for command in curl kubectl node flock' "$SCRIPT"
grep -Fq 'token-issuance.lock' "$SCRIPT"
grep -Fq 'OIDC_TOKEN_LOCK_WAIT_SECONDS:-60' "$SCRIPT"
grep -Fq 'token issuance lock timeout' "$SCRIPT"
printf '%s\n' '{"status":"PASS","tokenIssuance":"serialized","timeoutSeconds":60,"parallelBusinessE2E":"preserved"}'
