#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BACKSTAGE_URL="${BACKSTAGE_URL:-https://backstage.172.16.1.232.nip.io}"
PROJECT_ID="${RESONANCE_PROJECT_ID:-CCUS-PLATFORM}"
CA_CERT="${RESONANCE_INTERNAL_CA:-$HOME/.config/resonance/backstage-tls/ca.crt}"

for command in curl node; do
  command -v "$command" >/dev/null || {
    echo "[oidc-e2e] missing command: $command" >&2
    exit 1
  }
done
[[ -s "$CA_CERT" ]] || {
  echo "[oidc-e2e] internal CA is missing" >&2
  exit 2
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

requester_token="$("$ROOT/ops/scripts/resonance-backstage-oidc-token.sh" resonance-requester)"
reviewer_token="$("$ROOT/ops/scripts/resonance-backstage-oidc-token.sh" resonance-reviewer)"
approver_token="$("$ROOT/ops/scripts/resonance-backstage-oidc-token.sh" resonance-approver)"

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
