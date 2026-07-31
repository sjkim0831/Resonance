#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${RESONANCE_NAMESPACE:-resonance-ops}"
BACKSTAGE_URL="${RESONANCE_BACKSTAGE_URL:-https://backstage.172.16.1.232.nip.io}"
USERNAME="${BACKSTAGE_E2E_USERNAME:-resonance-requester}"
SECRET_NAME="${BACKSTAGE_E2E_SECRET_NAME:-resonance-keycloak-e2e-users}"
CA_DIR="${RESONANCE_CA_DIR:-/opt/resonance-data/pki/resonance-internal-ca}"
CA_CERT="${CA_DIR}/ca.crt"
EVIDENCE_ROOT="${RESONANCE_E2E_EVIDENCE_ROOT:-/opt/resonance-data/control-plane/evidence/backstage}"
DEPENDENCY_CACHE_ROOT="${RESONANCE_E2E_DEPENDENCY_CACHE_ROOT:-/opt/resonance-data/control-plane/cache/backstage-e2e}"
SKIP_IDENTITY_PREFLIGHT="${RESONANCE_E2E_SKIP_IDENTITY_PREFLIGHT:-false}"
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BACKSTAGE_ROOT="${ROOT}/platform/control-plane/backstage"
VERIFY_SCRIPT="${RESONANCE_CA_VERIFY_SCRIPT:-/opt/resonance-data/deploy/resonance-internal-ca-verify.sh}"

if [[ -x "$VERIFY_SCRIPT" ]]; then
  "$VERIFY_SCRIPT"
else
  test -s "$CA_CERT"
  curl --silent --show-error --fail --cacert "$CA_CERT" "${BACKSTAGE_URL}/"
fi

for command in kubectl base64 corepack flock sha256sum jq; do
  command -v "$command" >/dev/null || {
    echo "[backstage-e2e] missing command: $command" >&2
    exit 1
  }
done
test -f "${BACKSTAGE_ROOT}/package.json"

password="$(
  kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" \
    -o jsonpath='{.data.PASSWORD}' | base64 --decode
)"
test -n "$password"

token=""
if [[ "$SKIP_IDENTITY_PREFLIGHT" != "true" ]]; then
  token_error="$(mktemp)"
  for attempt in $(seq 1 6); do
    if token="$(
      BACKSTAGE_E2E_USERNAME="$USERNAME" \
      BACKSTAGE_E2E_PASSWORD="$password" \
        bash "$ROOT/ops/scripts/resonance-backstage-oidc-token.sh" "$USERNAME" \
        2>"$token_error"
    )" && [[ -n "$token" ]]; then
      break
    fi
    token=""
    sleep $((attempt * 2))
  done
  if [[ -z "$token" ]]; then
    echo "[backstage-e2e] OIDC login did not become ready after bounded retries" >&2
    sed -n '1,20p' "$token_error" >&2
    rm -f "$token_error"
    exit 1
  fi
  rm -f "$token_error"
  catalog_user_url="${BACKSTAGE_URL}/api/catalog/entities/by-name/user/default/${USERNAME}"
  catalog_ready=false
  for _ in $(seq 1 30); do
    if curl --silent --fail \
      --cacert "$CA_CERT" \
      --header "Authorization: Bearer ${token}" \
      "$catalog_user_url" >/dev/null; then
      catalog_ready=true
      break
    fi
    sleep 5
  done
  if [[ "$catalog_ready" != true ]]; then
    echo "[backstage-e2e] catalog identity did not converge: $USERNAME" >&2
    exit 1
  fi
else
  echo "[backstage-e2e] identity preflight covered by deployment authentication gates"
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
evidence_dir="${EVIDENCE_ROOT}/${timestamp}"
mkdir -p "$evidence_dir"

cleanup() {
  unset BACKSTAGE_E2E_PASSWORD
  password=
  token=
}
trap cleanup EXIT

export CI=true
export PLAYWRIGHT_URL="$BACKSTAGE_URL"
export PLAYWRIGHT_IGNORE_HTTPS_ERRORS=true
export PLAYWRIGHT_CHROMIUM_EXECUTABLE="$(
  find "${HOME}/.cache/ms-playwright" -path '*/chrome-linux64/chrome' \
    -type f -print -quit
)"
export NODE_EXTRA_CA_CERTS="$CA_CERT"
export BACKSTAGE_E2E_USERNAME="$USERNAME"
export BACKSTAGE_E2E_PASSWORD="$password"
export RESONANCE_E2E_EVIDENCE_DIR="$evidence_dir"
auth_state_dir="${DEPENDENCY_CACHE_ROOT}/auth"
auth_state_name="${USERNAME//[^a-zA-Z0-9_.-]/_}.json"
auth_state="${auth_state_dir}/${auth_state_name}"
mkdir -p -m 0700 "$auth_state_dir"
if [[ -f "$auth_state" ]] &&
  ! jq -e '.cookies and .origins' "$auth_state" >/dev/null 2>&1; then
  rm -f "$auth_state"
fi
touch "$auth_state"
chmod 0600 "$auth_state"
if [[ ! -s "$auth_state" ]]; then
  printf '{"cookies":[],"origins":[]}\n' >"$auth_state"
fi
export BACKSTAGE_E2E_STORAGE_STATE="$auth_state"
test -x "$PLAYWRIGHT_CHROMIUM_EXECUTABLE"

cd "$BACKSTAGE_ROOT"
lock_hash="$(sha256sum yarn.lock | awk '{print $1}')"
dependency_cache="${DEPENDENCY_CACHE_ROOT}/${lock_hash}"
mkdir -p "$DEPENDENCY_CACHE_ROOT"
if [[ ! -d node_modules ]]; then
  if [[ ! -d "${dependency_cache}/node_modules" ]]; then
    exec 9>"${DEPENDENCY_CACHE_ROOT}/install.lock"
    flock 9
    if [[ ! -d "${dependency_cache}/node_modules" ]]; then
      corepack yarn install --immutable --inline-builds >/dev/null
      mkdir -p "$dependency_cache"
      mv node_modules "${dependency_cache}/node_modules"
    fi
    flock -u 9
  fi
  ln -s "${dependency_cache}/node_modules" node_modules
fi
timeout --signal=TERM --kill-after=15s 180s ./node_modules/.bin/playwright test \
  packages/app/e2e-tests/resonance-control-plane.test.ts \
  --project=app \
  --workers=1 \
  --retries=0 \
  --reporter=line

find "$evidence_dir" -maxdepth 1 -type f -name '*.png' -printf '%f\n' | sort \
  >"${evidence_dir}/screenshots.txt"
printf '[backstage-e2e] PASS url=%s evidence=%s screenshots=%s\n' \
  "$BACKSTAGE_URL" \
  "$evidence_dir" \
  "$(wc -l <"${evidence_dir}/screenshots.txt")"
