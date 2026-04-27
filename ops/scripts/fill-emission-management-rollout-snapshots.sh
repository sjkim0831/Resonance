#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/fill-emission-management-rollout-snapshots.sh [base-url]
  EMISSION_PRINT_COMMANDS=true bash ops/scripts/fill-emission-management-rollout-snapshots.sh [base-url]
  bash ops/scripts/verify-emission-management-rollout-scope.sh list-scopes

Purpose:
  Populate `/admin/emission/management` rollout comparison snapshots for the
  currently supported category/tier scopes by saving one known-good session and
  executing calculate once per scope.

Default scopes:
  CEMENT:1
  CEMENT:2
  CEMENT:3
  LIME:1
  LIME:2
  LIME:3

Environment overrides:
  EMISSION_SCOPES   Space-separated subset such as "CEMENT:1 LIME:2"
  EMISSION_SCOPE_DELAY_SECONDS
  EXPECT_ALL_SCOPES_READY
  EMISSION_PRECHECK_RETRIES
  EMISSION_PRECHECK_DELAY_SECONDS
  EMISSION_PRINT_COMMANDS
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EMISSION_SCRIPT_NAME="fill-emission-management-rollout-snapshots"
source "$ROOT_DIR/ops/scripts/emission-management-auth-common.sh"
FIXTURE_DIR="$ROOT_DIR/ops/fixtures/emission-management-rollout"
SCOPE_METADATA_FILE="$(emission_rollout_scope_metadata_file)"
PORT="${PORT:-18000}"
CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/ops/config}"
ENV_FILE="${ENV_FILE:-$CONFIG_DIR/carbonet-${PORT}.env}"
emission_load_optional_env "$ENV_FILE"
BASE_URL="${1:-$(carbonet_runtime_base_url)}"
DEFAULT_EMISSION_SCOPES="$(emission_rollout_default_scopes "$SCOPE_METADATA_FILE")"
EMISSION_SCOPES="${EMISSION_SCOPES:-$DEFAULT_EMISSION_SCOPES}"
EMISSION_SCOPE_DELAY_SECONDS="${EMISSION_SCOPE_DELAY_SECONDS:-1}"
EXPECT_ALL_SCOPES_READY="${EXPECT_ALL_SCOPES_READY:-true}"
EMISSION_PRECHECK_RETRIES="${EMISSION_PRECHECK_RETRIES:-10}"
EMISSION_PRECHECK_DELAY_SECONDS="${EMISSION_PRECHECK_DELAY_SECONDS:-1}"
EMISSION_PRINT_COMMANDS="${EMISSION_PRINT_COMMANDS:-false}"

wait_for_runtime() {
  local attempt=1
  carbonet_set_curl_args
  while true; do
    if curl "${CARBONET_CURL_ARGS[@]}" -fsS "$BASE_URL/actuator/health" >/dev/null; then
      return 0
    fi
    if [[ "$attempt" -ge "$EMISSION_PRECHECK_RETRIES" ]]; then
      emission_fail "runtime precheck failed for $BASE_URL/actuator/health"
    fi
    emission_info "waiting for runtime precheck ($attempt/$EMISSION_PRECHECK_RETRIES)"
    attempt=$((attempt + 1))
    sleep "$EMISSION_PRECHECK_DELAY_SECONDS"
  done
}

expected_input_var_for_scope() {
  local scope="$1"
  local scope_line
  scope_line="$(emission_metadata_line_for_scope "$SCOPE_METADATA_FILE" "$scope")"
  [[ -n "$scope_line" ]] || emission_fail "unsupported scope requested: $scope"
  IFS=$'\t' read -r _scope _sub_code _tier expected_input_var _fixture_name <<< "$scope_line"
  printf '%s\n' "$expected_input_var"
}

run_scope() {
  local scope="$1"
  local sub_code="${scope%%:*}"
  local tier="${scope##*:}"
  local payload_path
  local expected_ready_scopes=""
  local expected_input_var
  payload_path="$(emission_rollout_fixture_path_for_scope "$SCOPE_METADATA_FILE" "$FIXTURE_DIR" "$scope")"
  expected_input_var="$(expected_input_var_for_scope "$scope")"
  [[ -f "$payload_path" ]] || emission_fail "payload fixture missing for $scope: $payload_path"
  if [[ "$EXPECT_ALL_SCOPES_READY" == "true" && "$scope" == "${LAST_SCOPE}" ]]; then
    expected_ready_scopes="$EMISSION_SCOPES"
  fi

  if [[ "$EMISSION_PRINT_COMMANDS" == "true" ]]; then
    if [[ -n "$expected_ready_scopes" ]]; then
      printf 'EXPECTED_READY_SCOPES=%q bash %q %q %q\n' \
        "$expected_ready_scopes" \
        "$ROOT_DIR/ops/scripts/verify-emission-management-rollout-scope.sh" \
        "$scope" \
        "$BASE_URL"
    else
      printf 'bash %q %q %q\n' \
        "$ROOT_DIR/ops/scripts/verify-emission-management-rollout-scope.sh" \
        "$scope" \
        "$BASE_URL"
    fi
    return 0
  fi

  emission_info "processing $scope"
  wait_for_runtime
  EXPECTED_CATEGORY_SUBCODE="$sub_code" \
  EXPECTED_TIER="$tier" \
  EXPECTED_INPUT_VAR_CODE="$expected_input_var" \
  EXPECTED_PROMOTION_STATUS="READY" \
  EXPECTED_DRAFT_ID_PREFIX="BUILTIN:${sub_code}:" \
  EXPECTED_READY_SCOPES="$expected_ready_scopes" \
  SAVE_PAYLOAD_FILE="$payload_path" \
  VERIFY_INVALID_VARIABLE_CODE="false" \
  VERIFY_SAVED_VALUE="false" \
  VERIFY_CO2_TOTAL="false" \
  VERIFY_FORMULA_SUMMARY="false" \
  VERIFY_ROLLOUT_STATUS="true" \
  bash "$ROOT_DIR/ops/scripts/verify-emission-management-flow.sh" "$BASE_URL"
}

LAST_SCOPE=""
for scope in $EMISSION_SCOPES; do
  LAST_SCOPE="$scope"
done
[[ -n "$LAST_SCOPE" ]] || emission_fail "EMISSION_SCOPES is empty"
[[ -f "$SCOPE_METADATA_FILE" ]] || emission_fail "scope metadata file is missing: $SCOPE_METADATA_FILE"

if [[ "$EMISSION_PRINT_COMMANDS" == "true" ]]; then
  emission_info "printing per-scope verify commands"
fi

for scope in $EMISSION_SCOPES; do
  run_scope "$scope"
  if [[ "$EMISSION_SCOPE_DELAY_SECONDS" =~ ^[0-9]+$ ]] && [[ "$EMISSION_SCOPE_DELAY_SECONDS" -gt 0 ]] && [[ "$scope" != "$LAST_SCOPE" ]]; then
    sleep "$EMISSION_SCOPE_DELAY_SECONDS"
  fi
done

emission_info "completed"
