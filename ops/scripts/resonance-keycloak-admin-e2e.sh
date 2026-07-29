#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${RESONANCE_NAMESPACE:-resonance-ops}"
KEYCLOAK_URL="${KEYCLOAK_URL:-https://identity.172.16.1.232.nip.io}"
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
  token_json=
}
trap cleanup EXIT

token_json="$(curl --cacert "$CA_CERT" --silent --show-error --fail \
  --data-urlencode client_id=admin-cli \
  --data-urlencode grant_type=password \
  --data-urlencode "username=$username" \
  --data-urlencode "password=$password" \
  "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token")"
token="$(TOKEN_JSON="$token_json" node -e '
  const value = JSON.parse(process.env.TOKEN_JSON);
  if (!value.access_token) process.exit(1);
  process.stdout.write(value.access_token);
')"
test -n "$token"

realm_count="$(curl --cacert "$CA_CERT" --silent --show-error --fail \
  --header "authorization: Bearer $token" \
  "$KEYCLOAK_URL/admin/realms" |
  node -e '
    let body = "";
    process.stdin.on("data", chunk => { body += chunk; });
    process.stdin.on("end", () => {
      const value = JSON.parse(body);
      if (!Array.isArray(value) || !value.some(item => item.realm === "resonance")) {
        process.exit(1);
      }
      process.stdout.write(String(value.length));
    });
  ')"

echo "[keycloak-admin-e2e] PASS username=$username realms=$realm_count"
