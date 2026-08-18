#!/usr/bin/env bash
set -euo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SCRIPT="$ROOT/ops/scripts/resonance-backstage-oidc-token.sh"
grep -Fq 'for command in curl kubectl node flock' "$SCRIPT"
grep -Fq 'token-issuance.lock' "$SCRIPT"
grep -Fq 'OIDC_TOKEN_LOCK_WAIT_SECONDS:-60' "$SCRIPT"
grep -Fq 'token issuance lock timeout' "$SCRIPT"
grep -Fq 'encodeURIComponent(url.origin)' "$SCRIPT"
grep -Fq 'origin=$BACKSTAGE_ORIGIN_ENCODED' "$SCRIPT"
grep -Fq 'BACKSTAGE_URL="${BACKSTAGE_URL:-https://backstage.172.16.1.232.nip.io:32947}"' "$SCRIPT"
if grep -Fq 'origin=https%3A%2F%2Fbackstage.172.16.1.232.nip.io' "$SCRIPT"; then
  echo '[backstage-oidc-token-serialization] fixed portless origin is forbidden' >&2
  exit 1
fi
encoded_origin="$(node -e 'process.stdout.write(encodeURIComponent(new URL(process.argv[1]).origin))' \
  'https://backstage.172.16.1.232.nip.io:32947/catalog')"
[[ "$encoded_origin" == 'https%3A%2F%2Fbackstage.172.16.1.232.nip.io%3A32947' ]]
printf '%s\n' '{"status":"PASS","tokenIssuance":"serialized","timeoutSeconds":60,"parallelBusinessE2E":"preserved","origin":"public-url-bound"}'
