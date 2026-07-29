#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${RESONANCE_NAMESPACE:-resonance-ops}"
BACKSTAGE_URL="${BACKSTAGE_URL:-https://backstage.172.16.1.232.nip.io}"
PROJECT_ID="${RESONANCE_PROJECT_ID:-CCUS-PLATFORM}"
CA_CERT="${RESONANCE_INTERNAL_CA:-/opt/resonance-data/pki/resonance-internal-ca/ca.crt}"
SECRET_NAME="${RESONANCE_INTEGRATED_ADMIN_SECRET:-resonance-keycloak-integrated-admin}"

username="$(kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" \
  -o jsonpath='{.data.USERNAME}' | base64 -d)"
password="$(kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" \
  -o jsonpath='{.data.PASSWORD}' | base64 -d)"
test -n "$username"
test -n "$password"

cleanup() {
  password=
  token=
}
trap cleanup EXIT

token="$(
  BACKSTAGE_E2E_USERNAME="$username" \
  BACKSTAGE_E2E_PASSWORD="$password" \
    bash "$ROOT/ops/scripts/resonance-backstage-oidc-token.sh" "$username"
)"

curl --cacert "$CA_CERT" --silent --show-error --fail \
  --header "authorization: Bearer $token" \
  "$BACKSTAGE_URL/api/resonance-projects/design-assets/$PROJECT_ID/access" |
  EXPECTED_ACTOR="user:default/$username" node -e '
    let body = "";
    process.stdin.on("data", chunk => { body += chunk; });
    process.stdin.on("end", () => {
      const value = JSON.parse(body);
      const required = [
        "DESIGN_REQUESTER",
        "DESIGN_REVIEWER",
        "DESIGN_APPROVER",
        "DESIGN_AUDITOR",
      ];
      if (value.actorRef !== process.env.EXPECTED_ACTOR) process.exit(1);
      if (required.some(role => !value.roles?.includes(role))) process.exit(2);
    });
  '

echo "[integrated-admin-e2e] PASS username=$username roles=4"
