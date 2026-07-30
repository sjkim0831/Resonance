#!/usr/bin/env bash
set -euo pipefail

current_gate="bootstrap"
trap 'rc=$?; if [[ $rc -ne 0 ]]; then echo "[screen-space-runtime-e2e] FAIL gate=$current_gate rc=$rc" >&2; fi' EXIT

ROOT="${RESONANCE_ROOT:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-resonance-ops}"
SECRET_NAME="${BACKSTAGE_E2E_SECRET_NAME:-resonance-keycloak-integrated-admin}"
USERNAME="${BACKSTAGE_E2E_USERNAME:-sjkim}"
BASE_URL="${BACKSTAGE_BASE_URL:-https://backstage.172.16.1.232.nip.io}"
CA_CERT="${RESONANCE_INTERNAL_CA:-/opt/resonance-data/pki/resonance-internal-ca/ca.crt}"
API="$BASE_URL/api/resonance-projects"
CARBONET_URL="${CARBONET_RUNTIME_BASE_URL:-http://172.16.1.232}"

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

current_gate="load-work-pack"
work_pack="$(
  curl --silent --show-error --fail \
    --cacert "$CA_CERT" \
    -H "authorization: Bearer $token" \
    "$API/screen-space/work-pack/emission"
)"

current_gate="validate-work-pack"
jq -e '
  . as $root
  | .workPackCode == "EMISSION_PROJECT_END_TO_END"
    and (.stages | length) == 7
    and ([.stages[].sequence] == [1,2,3,4,5,6,7])
    and (.stages[3].routePath == "/emission/validate")
    and (.stages[4].routePath == "/emission/data_input?mode=correction")
    and (.stages[5].routePath == "/emission/validate?tab=approval")
    and (.stages[6].routePath == "/emission/report_submit")
    and all(
      range(1; .stages | length);
      . as $index
      | ($root.stages[$index].inputContract[0]
        == ($root.stages[$index - 1].step + ".output"))
    )
' <<<"$work_pack" >/dev/null

stage="$(
  jq -c '.stages[] | select(.step == "EMISSION_PROJECT_SETUP")' <<<"$work_pack"
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

current_gate="materialize-registered-screen"
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
current_gate="validate-registered-screen"
jq -e '
  .success == true
  and .status == "VERIFIED"
  and .runtimePublication.success == true
  and .runtimePublication.status == "PUBLISHED"
  and ([.validation.checks[].status] | all(. == "PASS"))
  and (.screenSpec.materialization.strategy == "LAZY_METADATA_RUNTIME")
  and (.screenSpec.composition.responsive == ["DESKTOP","TABLET","MOBILE"])
' <<<"$materialized" >/dev/null

current_gate="verify-registered-runtime-publication"
curl --silent --show-error --fail \
  -H "X-Resonance-Token: $bridge_token" \
  "$CARBONET_URL/api/internal/screen-space/specs?routePath=%2Femission%2Fproject%2Fcreate" \
  | jq -e --arg coordinate "$coordinate" '
      .success == true
      and .coordinate == $coordinate
      and .status == "VERIFIED"
      and (.specSha256 | length) == 64
    ' >/dev/null

current_gate="verify-protected-existing-route"
curl --silent --show-error --fail \
  "$CARBONET_URL/home/api/process-executions/screen-contract?routePath=%2Femission%2Fproject%2Fcreate" \
  | jq -e '
      .enabled == false
      and .protectedExisting == true
      and .source == "REGISTERED_IMPLEMENTATION"
    ' >/dev/null

runtime_payload="$(
  jq -c '
    .state = "RUNTIME_E2E"
    | .action = "PREVIEW"
    | .permission = "PREVIEW"
    | .archetype = "DETAIL"
    | .seedScreenId = "screen-space-runtime-e2e"
    | .routePath = "/generated/screen-space-runtime-e2e"
  ' <<<"$payload"
)"
current_gate="materialize-runtime-screen"
runtime_materialized="$(
  curl --silent --show-error --fail \
    --cacert "$CA_CERT" \
    -H "authorization: Bearer $token" \
    -H 'content-type: application/json' \
    -X POST \
    --data "$runtime_payload" \
    "$API/screen-space/materialize"
)"
runtime_coordinate="$(jq -er '.coordinate' <<<"$runtime_materialized")"
current_gate="validate-runtime-screen"
jq -e '
  .success == true
  and .status == "VERIFIED"
  and .runtimePublication.success == true
  and .runtimePublication.status == "PUBLISHED"
' <<<"$runtime_materialized" >/dev/null

current_gate="verify-runtime-screen-contract"
curl --silent --show-error --fail \
  "$CARBONET_URL/home/api/process-executions/screen-contract?routePath=%2Fgenerated%2Fscreen-space-runtime-e2e" \
  | jq -e --arg coordinate "$runtime_coordinate" '
      .enabled == true
      and .source == "SCREEN_SPACE_RUNTIME"
      and .implementationStrategy == "SCREEN_SPACE_RUNTIME"
      and .validationStatus == "VERIFIED"
      and (.specificationJson | fromjson | .screenSpace.coordinate) == $coordinate
      and (.specificationJson | fromjson | .fields | length) >= 2
      and all(
        (.specificationJson | fromjson | .fields)[];
        has("code") and has("control") and has("required")
      )
      and (.specificationJson | fromjson | .apiContracts | map(.code) | sort) == ["EXECUTE_COMMAND","LOAD_DRAFT","LOAD_FIELD_OPTIONS","SAVE_DRAFT"]
      and (.specificationJson | fromjson | .permissions[0].scope) == "TENANT_PROJECT"
      and (.specificationJson | fromjson | .validations | length) == 2
      and (.traceabilityJson | fromjson | .requiredScenarioTypes | length) == 5
      and (.traceabilityJson | fromjson | .specSha256 | length) == 64
    ' >/dev/null

current_gate="verify-backstage-screen-index"
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

current_gate="complete"
echo "[screen-space-runtime-e2e] PASS stages=7 coordinate=$coordinate runtimeCoordinate=$runtime_coordinate protectedExisting=true status=VERIFIED"
