#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-resonance-control-plane}"
SECRET_NAME="${BACKSTAGE_E2E_SECRET_NAME:-resonance-keycloak-integrated-admin}"
USERNAME="${BACKSTAGE_E2E_USERNAME:-sjkim}"
BASE_URL="${BACKSTAGE_BASE_URL:-https://backstage.172.16.1.232.nip.io}"

password="$(
  kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" \
    -o jsonpath='{.data.PASSWORD}' | base64 -d
)"
token="$(
  BACKSTAGE_E2E_PASSWORD="$password" \
    bash "$ROOT/ops/scripts/resonance-backstage-oidc-token.sh" "$USERNAME"
)"

identities="$(
  curl --silent --show-error --fail \
    --cacert "$ROOT/ops/security/internal-ca/ca.crt" \
    -H "authorization: Bearer $token" \
    "$BASE_URL/api/resonance-identity-admin/identities"
)"

user_id="$(
  jq -er --arg username "$USERNAME" '
    .identities[]
    | select(.username == $username and .enabled == true)
    | select(
        (.groups | index("platform-engineering")) != null
        and (.groups | index("carbon-operations")) != null
        and (.groups | index("verification-governance")) != null
      )
    | .id
  ' <<<"$identities"
)"

curl --silent --show-error --fail \
  --cacert "$ROOT/ops/security/internal-ca/ca.crt" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -X PUT \
  --data "$(
    jq -cn --arg username "$USERNAME" '{
      username: $username,
      enabled: true,
      groups: [
        "platform-engineering",
        "carbon-operations",
        "verification-governance"
      ]
    }'
  )" \
  "$BASE_URL/api/resonance-identity-admin/identities/$user_id" \
  | jq -e '.status == "UPDATED"' >/dev/null

curl --silent --show-error --fail \
  --cacert "$ROOT/ops/security/internal-ca/ca.crt" \
  -H "authorization: Bearer $token" \
  "$BASE_URL/api/resonance-identity-admin/audit" \
  | jq -e --arg username "$USERNAME" '
      .audit
      | any(.targetUsername == $username and .actionCode == "IDENTITY_UPDATED")
    ' >/dev/null

echo "[identity-admin-e2e] PASS username=$USERNAME groups=3 audit=verified"
