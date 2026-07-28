#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${KEYCLOAK_NAMESPACE:-resonance-ops}"
BACKSTAGE_URL="${BACKSTAGE_URL:-https://backstage.172.16.1.232.nip.io}"
KEYCLOAK_URL="${KEYCLOAK_URL:-https://identity.172.16.1.232.nip.io}"
PROJECT_ID="${RESONANCE_PROJECT_ID:-CCUS-PLATFORM}"
CA_CERT="${RESONANCE_INTERNAL_CA:-$HOME/.config/resonance/backstage-tls/ca.crt}"
WORK_ROOT="${OIDC_E2E_WORK_ROOT:-$HOME/.cache/resonance/oidc-four-eyes-e2e}"

for command in curl kubectl node; do
  command -v "$command" >/dev/null || {
    echo "[oidc-e2e] missing command: $command" >&2
    exit 1
  }
done
[[ -s "$CA_CERT" ]] || {
  echo "[oidc-e2e] internal CA is missing" >&2
  exit 2
}

mkdir -p "$WORK_ROOT"
chmod 700 "$WORK_ROOT"
run_dir="$(mktemp -d "$WORK_ROOT/run.XXXXXXXX")"
trap 'rm -rf "$run_dir"' EXIT

password="$(kubectl -n "$NAMESPACE" get secret resonance-keycloak-e2e-users \
  -o jsonpath='{.data.PASSWORD}' | base64 -d)"
[[ -n "$password" ]] || {
  echo "[oidc-e2e] test identity secret is missing" >&2
  exit 2
}

oidc_login() {
  local username="$1" dir auth_url action
  dir="$run_dir/$username"
  mkdir -p "$dir"
  curl --cacert "$CA_CERT" -fsS \
    -D "$dir/start.headers" -o /dev/null -c "$dir/cookies" \
    "$BACKSTAGE_URL/api/auth/oidc/start?env=production&origin=https%3A%2F%2Fbackstage.172.16.1.232.nip.io"
  auth_url="$(awk 'BEGIN{IGNORECASE=1}/^location:/{sub(/^location:[[:space:]]*/,"");gsub(/\r/,"");print}' \
    "$dir/start.headers")"
  [[ "$auth_url" == "$KEYCLOAK_URL/"* ]] || {
    echo "[oidc-e2e] Backstage did not redirect to Keycloak" >&2
    return 1
  }
  curl --cacert "$CA_CERT" -fsS -b "$dir/cookies" -c "$dir/cookies" \
    "$auth_url" -o "$dir/login.html"
  action="$(LOGIN_HTML="$dir/login.html" node -e '
    const fs = require("fs");
    const html = fs.readFileSync(process.env.LOGIN_HTML, "utf8");
    const match = html.match(/<form[^>]+action="([^"]+)"[^>]*>/i);
    if (!match) process.exit(1);
    process.stdout.write(match[1].replaceAll("&amp;", "&"));
  ')"
  curl --cacert "$CA_CERT" -fsS -L \
    -b "$dir/cookies" -c "$dir/cookies" -o "$dir/result.html" \
    --data-urlencode "username=$username" \
    --data-urlencode "password=$password" \
    --data-urlencode credentialId= "$action"
  RESULT_HTML="$dir/result.html" EXPECTED_USER="$username" node -e '
    const fs = require("fs");
    const html = fs.readFileSync(process.env.RESULT_HTML, "utf8");
    const encoded = (html.match(/decodeURIComponent\(\x27([^\x27]+)\x27\)/) || [])[1];
    const message = JSON.parse(decodeURIComponent(encoded || ""));
    if (message.error) throw new Error(message.error.message);
    const identity = message.response?.backstageIdentity;
    const expected = `user:default/${process.env.EXPECTED_USER}`;
    if (!identity?.token || identity.identity?.userEntityRef !== expected) {
      throw new Error("Backstage identity does not match the requested user");
    }
    process.stdout.write(identity.token);
  '
}

assert_access() {
  local token="$1" expected_role="$2"
  curl --cacert "$CA_CERT" -fsS \
    -H "authorization: Bearer $token" \
    "$BACKSTAGE_URL/api/resonance-projects/design-assets/$PROJECT_ID/access" |
    EXPECTED_ROLE="$expected_role" node -e '
      let body = "";
      process.stdin.on("data", chunk => { body += chunk; });
      process.stdin.on("end", () => {
        const value = JSON.parse(body);
        if (!value.roles?.includes(process.env.EXPECTED_ROLE)) process.exit(1);
        process.stdout.write(`${value.actorRef}:${process.env.EXPECTED_ROLE}\n`);
      });
    '
}

requester_token="$(oidc_login resonance-requester)"
reviewer_token="$(oidc_login resonance-reviewer)"
approver_token="$(oidc_login resonance-approver)"

assert_access "$requester_token" DESIGN_REQUESTER
assert_access "$reviewer_token" DESIGN_REVIEWER
assert_access "$approver_token" DESIGN_APPROVER

asset_json="$(curl --cacert "$CA_CERT" -fsS \
  -H "authorization: Bearer $requester_token" \
  "$BACKSTAGE_URL/api/resonance-projects/design-assets/$PROJECT_ID?limit=1")"
draft_payload="$(ASSET_JSON="$asset_json" node -e '
  const value = JSON.parse(process.env.ASSET_JSON);
  const asset = value.assets?.[0];
  if (!asset) process.exit(1);
  process.stdout.write(JSON.stringify({
    assetType: asset.assetType,
    assetId: asset.assetId,
    baseFingerprint: asset.fingerprint,
    patch: { assetName: asset.assetName },
  }));
')"
draft_json="$(curl --cacert "$CA_CERT" -fsS \
  -H "authorization: Bearer $requester_token" \
  -H 'content-type: application/json' -d "$draft_payload" \
  "$BACKSTAGE_URL/api/resonance-projects/design-assets/$PROJECT_ID/drafts")"
draft_id="$(DRAFT_JSON="$draft_json" node -e '
  const value = JSON.parse(process.env.DRAFT_JSON);
  if (!value.draftId || value.status !== "DRAFT") process.exit(1);
  process.stdout.write(String(value.draftId));
')"

review_json="$(curl --cacert "$CA_CERT" -fsS -X POST \
  -H "authorization: Bearer $reviewer_token" \
  "$BACKSTAGE_URL/api/resonance-projects/design-assets/$PROJECT_ID/drafts/$draft_id/validate")"
REVIEW_JSON="$review_json" node -e '
  const value = JSON.parse(process.env.REVIEW_JSON);
  if (value.status !== "PASS") process.exit(1);
'

promote_json="$(curl --cacert "$CA_CERT" -fsS -X POST \
  -H "authorization: Bearer $approver_token" \
  "$BACKSTAGE_URL/api/resonance-projects/design-assets/$PROJECT_ID/drafts/$draft_id/promote")"
PROMOTE_JSON="$promote_json" node -e '
  const value = JSON.parse(process.env.PROMOTE_JSON);
  if (value.status !== "PROMOTED" || value.taskStatus !== "PLANNED") process.exit(1);
'

audit_json="$(curl --cacert "$CA_CERT" -fsS \
  -H "authorization: Bearer $approver_token" \
  "$BACKSTAGE_URL/api/resonance-projects/design-assets/$PROJECT_ID/audit")"
AUDIT_JSON="$audit_json" DRAFT_ID="$draft_id" node -e '
  const value = JSON.parse(process.env.AUDIT_JSON);
  const actions = value.audit
    ?.filter(item => item.draftId === process.env.DRAFT_ID)
    .map(item => item.actionCode) ?? [];
  for (const required of ["DRAFT_CREATED", "REVIEW_PASSED", "APPROVAL_QUEUED"]) {
    if (!actions.includes(required)) process.exit(1);
  }
'

echo "[oidc-e2e] PASS requester, reviewer, and approver completed the four-eyes workflow (draft $draft_id)"
