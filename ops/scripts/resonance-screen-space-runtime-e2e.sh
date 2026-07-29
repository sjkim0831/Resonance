#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-resonance-ops}"
SECRET_NAME="${BACKSTAGE_E2E_SECRET_NAME:-resonance-keycloak-integrated-admin}"
USERNAME="${BACKSTAGE_E2E_USERNAME:-sjkim}"
BASE_URL="${BACKSTAGE_BASE_URL:-https://backstage.172.16.1.232.nip.io}"
CA_CERT="${RESONANCE_INTERNAL_CA:-/opt/resonance-data/pki/resonance-internal-ca/ca.crt}"
API="$BASE_URL/api/resonance-projects"
CARBONET_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1:18000}"

password="$(
  kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" \
    -o jsonpath='{.data.PASSWORD}' | base64 -d
)"
token="$(
  BACKSTAGE_E2E_PASSWORD="$password" \
  RESONANCE_INTERNAL_CA="$CA_CERT" \
    bash "$ROOT/ops/scripts/resonance-backstage-oidc-token.sh" "$USERNAME"
)"
bridge_token="$(
  kubectl -n carbonet-prod get secret resonance-ops-bridge \
    -o jsonpath='{.data.RESONANCE_OPS_TOKEN}' | base64 -d
)"

work_pack="$(
  curl --silent --show-error --fail \
    --cacert "$CA_CERT" \
    -H "authorization: Bearer $token" \
    "$API/screen-space/work-pack/emission"
)"

jq -e '
  . as $root
  | .workPackCode == "EMISSION_PROJECT_END_TO_END"
    and (.stages | length) == 7
    and ([.stages[].sequence] == [1,2,3,4,5,6,7])
    and (.stages[3].routePath == "/emission/validate")
    and (.stages[4].routePath == "/emission/validate?tab=approval")
    and (.stages[5].routePath == "/emission/report_submit")
    and all(
      range(1; .stages | length);
      . as $index
      | ($root.stages[$index].inputContract[0]
        == ($root.stages[$index - 1].step + ".output"))
    )
' <<<"$work_pack" >/dev/null

stage="$(
  jq -c '.stages[] | select(.step == "PROJECT_SETUP")' <<<"$work_pack"
)"
payload="$(
  jq -cn --argjson stage "$stage" '{
    projectId: "CCUS-PLATFORM",
    domainObject: "EMISSION_PROJECT",
    actor: $stage.actor,
    process: $stage.process,
    step: $stage.step,
    state: "DRAFT",
    action: "CREATE",
    permission: "CREATE",
    archetype: $stage.archetype,
    device: "DESKTOP",
    language: "ko",
    dataContext: "PROJECT",
    seedScreenId: "emission-project-create",
    routePath: $stage.routePath,
    sections: ["project-context", "organization-boundary", "reporting-period"],
    dataContracts: ($stage.inputContract + $stage.outputContract)
  }'
)"

materialized="$(
  curl --silent --show-error --fail \
    --cacert "$CA_CERT" \
    -H "authorization: Bearer $token" \
    -H 'content-type: application/json' \
    -X POST \
    --data "$payload" \
    "$API/screen-space/materialize"
)"
coordinate="$(jq -er '.coordinate' <<<"$materialized")"
jq -e '
  .success == true
  and .status == "VERIFIED"
  and .runtimePublication.success == true
  and .runtimePublication.status == "PUBLISHED"
  and ([.validation.checks[].status] | all(. == "PASS"))
  and (.screenSpec.materialization.strategy == "LAZY_METADATA_RUNTIME")
  and (.screenSpec.composition.responsive == ["DESKTOP","TABLET","MOBILE"])
' <<<"$materialized" >/dev/null

curl --silent --show-error --fail \
  -H "X-Resonance-Token: $bridge_token" \
  "$CARBONET_URL/admin/api/internal/screen-space/specs?routePath=%2Femission%2Fproject%2Fcreate" \
  | jq -e --arg coordinate "$coordinate" '
      .success == true
      and .coordinate == $coordinate
      and .status == "VERIFIED"
      and (.specSha256 | length) == 64
    ' >/dev/null

curl --silent --show-error --fail \
  --cacert "$CA_CERT" \
  -H "authorization: Bearer $token" \
  "$API/screen-space/specs?projectId=CCUS-PLATFORM" \
  | jq -e --arg coordinate "$coordinate" '
      .specs
      | any(
          .coordinate == $coordinate
          and .status == "VERIFIED"
          and (.specSha256 | length) == 64
        )
    ' >/dev/null

echo "[screen-space-runtime-e2e] PASS stages=7 coordinate=$coordinate status=VERIFIED"
