#!/usr/bin/env bash

source "$ROOT_DIR/ops/scripts/runtime-url-common.sh"
# shellcheck source=ops/scripts/runtime-qa-auth-common.sh
source "$ROOT_DIR/ops/scripts/runtime-qa-auth-common.sh"

emission_fail() {
  echo "[$EMISSION_SCRIPT_NAME] FAIL: $*" >&2
  exit 1
}

emission_info() {
  echo "[$EMISSION_SCRIPT_NAME] $*"
}

emission_load_optional_env() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

emission_require_cmd() {
  local name="$1"
  command -v "$name" >/dev/null 2>&1 || emission_fail "required command not found: $name"
}

emission_require_file() {
  local path="$1"
  [[ -f "$path" ]] || emission_fail "required file not found: $path"
}

emission_curl_to_file_with_retry() {
  local output_path="$1"
  shift
  local attempt=1
  carbonet_set_curl_args
  while true; do
    if curl "${CARBONET_CURL_ARGS[@]}" -fsS "$@" > "$output_path"; then
      return 0
    fi
    if [[ "$attempt" -ge "$EMISSION_HTTP_RETRIES" ]]; then
      return 1
    fi
    emission_info "retrying HTTP request ($attempt/$EMISSION_HTTP_RETRIES)"
    attempt=$((attempt + 1))
    sleep "$EMISSION_HTTP_RETRY_SECONDS"
  done
}

emission_curl_status_with_retry() {
  local output_path="$1"
  shift
  local attempt=1
  local status=""
  carbonet_set_curl_args
  while true; do
    status="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -o "$output_path" -w '%{http_code}' "$@")" && {
      printf '%s\n' "$status"
      return 0
    }
    if [[ "$attempt" -ge "$EMISSION_HTTP_RETRIES" ]]; then
      return 1
    fi
    emission_info "retrying HTTP status request ($attempt/$EMISSION_HTTP_RETRIES)"
    attempt=$((attempt + 1))
    sleep "$EMISSION_HTTP_RETRY_SECONDS"
  done
}

emission_prepare_cached_runtime_artifacts() {
  : # Kept as a compatibility no-op for callers; authentication no longer compiles Java helpers.
}

emission_create_cookie_jar() {
  local cookie_jar="$1"
  carbonet_qa_login "$cookie_jar" "$BASE_URL" || emission_fail "isolated QA login failed"
}

emission_destroy_cookie_jar() {
  local cookie_jar="$1"
  carbonet_qa_logout "$cookie_jar" "$BASE_URL"
}

emission_default_scopes_from_metadata() {
  local metadata_file="$1"
  awk -F '\t' 'NF > 0 && $1 !~ /^#/ { print $1 }' "$metadata_file" | paste -sd' ' -
}

emission_metadata_line_for_scope() {
  local metadata_file="$1"
  local scope="$2"
  awk -F '\t' -v requested_scope="$scope" 'NF > 0 && $1 !~ /^#/ && $1 == requested_scope { print $0 }' "$metadata_file"
}

emission_rollout_scope_metadata_file() {
  printf '%s\n' "$ROOT_DIR/ops/fixtures/emission-management-rollout/scopes.tsv"
}

emission_rollout_default_scopes() {
  local metadata_file="$1"
  emission_default_scopes_from_metadata "$metadata_file" 2>/dev/null
}

emission_rollout_fixture_path_for_scope() {
  local metadata_file="$1"
  local fixture_dir="$2"
  local scope="$3"
  local scope_line
  local fixture_name
  scope_line="$(emission_metadata_line_for_scope "$metadata_file" "$scope")"
  [[ -n "$scope_line" ]] || emission_fail "unsupported scope requested: $scope"
  IFS=$'\t' read -r _scope _sub_code _tier _expected_input_var fixture_name <<< "$scope_line"
  printf '%s/%s\n' "$fixture_dir" "$fixture_name"
}

emission_require_allowed_value() {
  local name="$1"
  local actual="$2"
  shift 2
  local allowed=("$@")
  local candidate
  for candidate in "${allowed[@]}"; do
    if [[ "$actual" == "$candidate" ]]; then
      return 0
    fi
  done
  emission_fail "unsupported $name: $actual (allowed: ${allowed[*]})"
}
