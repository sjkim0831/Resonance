#!/usr/bin/env bash
set -euo pipefail

USERNAME="${1:-resonance-requester}"
NAMESPACE="${KEYCLOAK_NAMESPACE:-resonance-ops}"
BACKSTAGE_URL="${BACKSTAGE_URL:-https://backstage.172.16.1.232.nip.io}"
KEYCLOAK_URL="${KEYCLOAK_URL:-https://identity.172.16.1.232.nip.io}"
CA_CERT="${RESONANCE_INTERNAL_CA:-$HOME/.config/resonance/backstage-tls/ca.crt}"
WORK_ROOT="${OIDC_TOKEN_WORK_ROOT:-$HOME/.cache/resonance/oidc-token}"

for command in curl kubectl node flock; do
  command -v "$command" >/dev/null || {
    echo "[oidc-token] missing command: $command" >&2
    exit 1
  }
done
[[ "$USERNAME" =~ ^[a-z0-9_.-]{3,63}$ && -s "$CA_CERT" ]] || {
  echo "[oidc-token] invalid identity or missing internal CA" >&2
  exit 2
}

mkdir -p "$WORK_ROOT"
chmod 700 "$WORK_ROOT"
token_lock_file="${OIDC_TOKEN_LOCK_FILE:-$WORK_ROOT/token-issuance.lock}"
exec {token_lock_fd}>"$token_lock_file"
flock -w "${OIDC_TOKEN_LOCK_WAIT_SECONDS:-60}" "$token_lock_fd" || {
  echo "[oidc-token] token issuance lock timeout" >&2
  exit 4
}
run_dir="$(mktemp -d "$WORK_ROOT/run.XXXXXXXX")"
cleanup() {
  if [[ "${OIDC_TOKEN_KEEP_WORK:-false}" == "true" ]]; then
    echo "[oidc-token] diagnostic directory: $run_dir" >&2
  else
    rm -rf "$run_dir"
  fi
}
trap cleanup EXIT
password="${BACKSTAGE_E2E_PASSWORD:-}"
if [[ -z "$password" ]]; then
  password="$(kubectl -n "$NAMESPACE" get secret resonance-keycloak-e2e-users \
    -o jsonpath='{.data.PASSWORD}' | base64 -d)"
fi
[[ -n "$password" ]] || {
  echo "[oidc-token] identity credential is missing" >&2
  exit 2
}

curl --cacert "$CA_CERT" -fsS \
  -D "$run_dir/start.headers" -o /dev/null -c "$run_dir/cookies" \
  "$BACKSTAGE_URL/api/auth/oidc/start?env=production&origin=https%3A%2F%2Fbackstage.172.16.1.232.nip.io"
auth_url="$(awk 'BEGIN{IGNORECASE=1}/^location:/{sub(/^location:[[:space:]]*/,"");gsub(/\r/,"");print}' \
  "$run_dir/start.headers")"
[[ "$auth_url" == "$KEYCLOAK_URL/"* ]] || {
  echo "[oidc-token] Backstage did not redirect to Keycloak" >&2
  exit 3
}
curl --cacert "$CA_CERT" -fsS \
  -b "$run_dir/cookies" -c "$run_dir/cookies" \
  "$auth_url" -o "$run_dir/login.html"
action="$(LOGIN_HTML="$run_dir/login.html" node -e '
  const fs = require("fs");
  const html = fs.readFileSync(process.env.LOGIN_HTML, "utf8");
  const match = html.match(/<form[^>]+action="([^"]+)"[^>]*>/i);
  if (!match) process.exit(1);
  process.stdout.write(match[1].replaceAll("&amp;", "&"));
')"
curl --cacert "$CA_CERT" -fsS -L \
  -b "$run_dir/cookies" -c "$run_dir/cookies" \
  -o "$run_dir/result.html" \
  --data-urlencode "username=$USERNAME" \
  --data-urlencode "password=$password" \
  --data-urlencode credentialId= "$action"

RESULT_HTML="$run_dir/result.html" EXPECTED_USER="$USERNAME" node -e '
  const fs = require("fs");
  const html = fs.readFileSync(process.env.RESULT_HTML, "utf8");
  const encoded = (html.match(/decodeURIComponent\(\x27([^\x27]+)\x27\)/) || [])[1];
  if (!encoded) {
    throw new Error("Backstage OIDC callback payload is missing");
  }
  const message = JSON.parse(decodeURIComponent(encoded));
  if (message.error) throw new Error(message.error.message);
  const identity = message.response?.backstageIdentity;
  const expected = `user:default/${process.env.EXPECTED_USER}`;
  if (!identity?.token || identity.identity?.userEntityRef !== expected) {
    throw new Error("Backstage identity does not match the requested user");
  }
  process.stdout.write(identity.token);
'
