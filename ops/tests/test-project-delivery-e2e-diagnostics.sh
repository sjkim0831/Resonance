#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/ops/scripts/resonance-project-delivery-e2e.sh"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT

mkdir -p "$TMP/root/ops/scripts" "$TMP/bin"
cp "$SCRIPT" "$TMP/root/ops/scripts/resonance-project-delivery-e2e.sh"
printf 'test-ca\n' >"$TMP/ca.crt"

cat >"$TMP/root/ops/scripts/resonance-backstage-oidc-token.sh" <<'TOKEN'
#!/usr/bin/env bash
printf '%s' 'fixture-token-never-log'
TOKEN
chmod +x "$TMP/root/ops/scripts/resonance-backstage-oidc-token.sh"

cat >"$TMP/bin/curl" <<'CURL'
#!/usr/bin/env bash
set -Eeuo pipefail
output=''
while (($#)); do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    -w) shift 2 ;;
    *) shift ;;
  esac
done
[[ -n "$output" ]]
cat >"$output" <<'JSON'
{"message":"PROJECT_DELIVERY_ROLLED_BACK: token=top-secret Bearer abc.def.ghi password=hunter2\nvalidation failed","secret":"raw-body-secret-must-not-log","details":{"cookie":"private-cookie"}}
JSON
printf '%s' 400
CURL
chmod +x "$TMP/bin/curl"

set +e
output="$(PATH="$TMP/bin:$PATH" RESONANCE_ROOT="$TMP/root" \
  RESONANCE_INTERNAL_CA="$TMP/ca.crt" BACKSTAGE_URL='https://fixture.invalid' \
  bash "$TMP/root/ops/scripts/resonance-project-delivery-e2e.sh" 2>&1)"
status=$?
set -e

[[ "$status" == 3 ]] || { echo "expected exit 3, got $status" >&2; exit 1; }
[[ "$output" == *'command failed: HTTP 400 message=PROJECT_DELIVERY_ROLLED_BACK:'* ]] || {
  echo 'safe backend message was not emitted' >&2
  exit 1
}
[[ "$output" == *'token=[REDACTED]'* && "$output" == *'Bearer [REDACTED]'* \
  && "$output" == *'password=[REDACTED]'* ]] || {
  echo 'credential-like values were not redacted' >&2
  exit 1
}
for forbidden in top-secret abc.def.ghi hunter2 raw-body-secret-must-not-log private-cookie fixture-token-never-log; do
  [[ "$output" != *"$forbidden"* ]] || {
    echo "diagnostic leaked forbidden fixture: $forbidden" >&2
    exit 1
  }
done
[[ "$output" != *$'\nvalidation failed'* && "$output" == *' validation failed'* ]] || {
  echo 'diagnostic message was not compacted to one line' >&2
  exit 1
}

echo '[project-delivery-e2e-diagnostics-test] PASS status=400 messageOnly=true redactions=3 rawBody=false token=false'
