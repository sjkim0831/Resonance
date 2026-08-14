#!/usr/bin/env bash
set -euo pipefail
umask 077

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
OIDC_CONNECT_TIMEOUT_SECONDS="${OIDC_TOKEN_CONNECT_TIMEOUT_SECONDS:-5}"
OIDC_HTTP_TIMEOUT_SECONDS="${OIDC_TOKEN_HTTP_TIMEOUT_SECONDS:-15}"
[[ "$OIDC_CONNECT_TIMEOUT_SECONDS" =~ ^[1-5]$ \
   && "$OIDC_HTTP_TIMEOUT_SECONDS" =~ ^([1-9]|1[0-5])$ ]] \
  && ((OIDC_CONNECT_TIMEOUT_SECONDS <= OIDC_HTTP_TIMEOUT_SECONDS)) || {
  echo '[oidc-token] invalid HTTP timeout bound' >&2
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
  unset password BACKSTAGE_E2E_PASSWORD
  if [[ "${OIDC_TOKEN_KEEP_WORK:-false}" == "true" ]]; then
    echo "[oidc-token] diagnostic directory: $run_dir" >&2
  else
    rm -rf "$run_dir"
  fi
}
trap cleanup EXIT
password="${BACKSTAGE_E2E_PASSWORD:-}"
if [[ -z "$password" && -n "${BACKSTAGE_E2E_PASSWORD_FILE:-}" ]]; then
  [[ -f "$BACKSTAGE_E2E_PASSWORD_FILE" && ! -L "$BACKSTAGE_E2E_PASSWORD_FILE" ]] || {
    echo "[oidc-token] password file must be a regular non-symlink file" >&2
    exit 2
  }
  mode="$(stat -c '%a' "$BACKSTAGE_E2E_PASSWORD_FILE")"
  [[ "$mode" == 600 || "$mode" == 400 ]] || {
    echo "[oidc-token] password file must have mode 0600 or 0400" >&2
    exit 2
  }
  password="$(<"$BACKSTAGE_E2E_PASSWORD_FILE")"
fi
if [[ -z "$password" ]]; then
  password="$(kubectl -n "$NAMESPACE" get secret resonance-keycloak-e2e-users \
    -o jsonpath='{.data.PASSWORD}' | base64 -d)"
fi
[[ -n "$password" ]] || {
  echo "[oidc-token] identity credential is missing" >&2
  exit 2
}
form_path="$run_dir/login.form"
printf '%s' "$password" | USERNAME="$USERNAME" FORM_PATH="$form_path" node -e '
  const fs = require("fs");
  let password = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => { password += chunk; });
  process.stdin.on("end", () => {
    const encode = encodeURIComponent;
    fs.writeFileSync(process.env.FORM_PATH,
      `username=${encode(process.env.USERNAME)}&password=${encode(password)}&credentialId=`,
      { mode: 0o600 });
    password = "";
  });
'
chmod 0600 "$form_path"
unset password BACKSTAGE_E2E_PASSWORD

start_status="$(curl --cacert "$CA_CERT" --connect-timeout "$OIDC_CONNECT_TIMEOUT_SECONDS" \
  --max-time "$OIDC_HTTP_TIMEOUT_SECONDS" -fsS \
  -D "$run_dir/start.headers" -o /dev/null -c "$run_dir/cookies" \
  -w '%{http_code}' \
  "$BACKSTAGE_URL/api/auth/oidc/start?env=production&origin=https%3A%2F%2Fbackstage.172.16.1.232.nip.io")" || {
  start_status="${start_status:-000}"
  echo "[oidc-token] Backstage OIDC start failed: HTTP $start_status" >&2
  exit 3
}
[[ "$start_status" =~ ^30[2378]$ ]] || {
  echo "[oidc-token] Backstage OIDC start returned unexpected HTTP $start_status" >&2
  exit 3
}
auth_url="$(awk 'BEGIN{IGNORECASE=1}/^location:/{sub(/^location:[[:space:]]*/,"");gsub(/\r/,"");print}' \
  "$run_dir/start.headers")"
[[ "$auth_url" == "$KEYCLOAK_URL/"* ]] || {
  echo "[oidc-token] Backstage did not redirect to Keycloak" >&2
  exit 3
}
login_page_status="$(curl --cacert "$CA_CERT" --connect-timeout "$OIDC_CONNECT_TIMEOUT_SECONDS" \
  --max-time "$OIDC_HTTP_TIMEOUT_SECONDS" -fsS \
  -b "$run_dir/cookies" -c "$run_dir/cookies" \
  "$auth_url" -o "$run_dir/login.html" -w '%{http_code}')" || {
  login_page_status="${login_page_status:-000}"
  echo "[oidc-token] Keycloak login page failed: HTTP $login_page_status" >&2
  exit 3
}
[[ "$login_page_status" == 200 ]] || {
  echo "[oidc-token] Keycloak login page returned unexpected HTTP $login_page_status" >&2
  exit 3
}
action="$(LOGIN_HTML="$run_dir/login.html" node -e '
  const fs = require("fs");
  const html = fs.readFileSync(process.env.LOGIN_HTML, "utf8");
  const match = html.match(/<form[^>]+action="([^"]+)"[^>]*>/i);
  if (!match) process.exit(1);
  process.stdout.write(match[1].replaceAll("&amp;", "&"));
')"
callback_status="$(curl --cacert "$CA_CERT" --connect-timeout "$OIDC_CONNECT_TIMEOUT_SECONDS" \
  --max-time "$OIDC_HTTP_TIMEOUT_SECONDS" -fsS -L \
  -b "$run_dir/cookies" -c "$run_dir/cookies" \
  -o "$run_dir/result.html" \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data-binary @"$form_path" "$action" -w '%{http_code}')" || {
  callback_status="${callback_status:-000}"
  echo "[oidc-token] OIDC callback failed: HTTP $callback_status" >&2
  exit 3
}
[[ "$callback_status" == 200 ]] || {
  echo "[oidc-token] OIDC callback returned unexpected HTTP $callback_status" >&2
  exit 3
}

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
