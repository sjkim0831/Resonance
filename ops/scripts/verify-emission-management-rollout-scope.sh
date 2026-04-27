#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/verify-emission-management-rollout-scope.sh <scope> [base-url]
  bash ops/scripts/verify-emission-management-rollout-scope.sh list
  bash ops/scripts/verify-emission-management-rollout-scope.sh list-scopes

Purpose:
  Verify one `/admin/emission/management` rollout scope using the canonical
  fixture payload for that scope, then assert that the rollout row is `READY`.
  You can also use `list` to inspect supported scope records or `list-scopes`
  to emit the default space-separated scope set.

Supported scopes:
  CEMENT:1
  CEMENT:2
  CEMENT:3
  LIME:1
  LIME:2
  LIME:3

Environment overrides:
  EXPECTED_READY_SCOPES
  EMISSION_SCOPE_VERIFY_RETRIES
  EMISSION_SCOPE_VERIFY_DELAY_SECONDS
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EMISSION_SCRIPT_NAME="verify-emission-management-rollout-scope"
source "$ROOT_DIR/ops/scripts/emission-management-auth-common.sh"
SCOPE="${1:-}"
PORT="${PORT:-18000}"
CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/ops/config}"
ENV_FILE="${ENV_FILE:-$CONFIG_DIR/carbonet-${PORT}.env}"
emission_load_optional_env "$ENV_FILE"
BASE_URL="${2:-$(carbonet_runtime_base_url)}"
EXPECTED_READY_SCOPES="${EXPECTED_READY_SCOPES:-}"
EMISSION_SCOPE_VERIFY_RETRIES="${EMISSION_SCOPE_VERIFY_RETRIES:-3}"
EMISSION_SCOPE_VERIFY_DELAY_SECONDS="${EMISSION_SCOPE_VERIFY_DELAY_SECONDS:-1}"
FIXTURE_DIR="$ROOT_DIR/ops/fixtures/emission-management-rollout"
SCOPE_METADATA_FILE="$(emission_rollout_scope_metadata_file)"

if [[ "$SCOPE" == "list" ]]; then
  bash "$ROOT_DIR/ops/scripts/list-emission-management-rollout-scopes.sh"
  exit 0
fi

if [[ "$SCOPE" == "list-scopes" ]]; then
  EMISSION_SCOPE_LIST_OUTPUT=scopes bash "$ROOT_DIR/ops/scripts/list-emission-management-rollout-scopes.sh"
  exit 0
fi

[[ -n "$SCOPE" ]] || emission_fail "scope is required"
[[ -f "$SCOPE_METADATA_FILE" ]] || emission_fail "scope metadata file is missing: $SCOPE_METADATA_FILE"

scope_line="$(emission_metadata_line_for_scope "$SCOPE_METADATA_FILE" "$SCOPE")"
[[ -n "$scope_line" ]] || emission_fail "unsupported scope: $SCOPE"

IFS=$'\t' read -r _scope EXPECTED_CATEGORY_SUBCODE EXPECTED_TIER EXPECTED_INPUT_VAR_CODE fixture_name <<< "$scope_line"
SAVE_PAYLOAD_FILE="$(emission_rollout_fixture_path_for_scope "$SCOPE_METADATA_FILE" "$FIXTURE_DIR" "$SCOPE")"

[[ -f "$SAVE_PAYLOAD_FILE" ]] || emission_fail "payload fixture missing: $SAVE_PAYLOAD_FILE"

attempt=1
while true; do
  if EXPECTED_CATEGORY_SUBCODE="$EXPECTED_CATEGORY_SUBCODE" \
    EXPECTED_TIER="$EXPECTED_TIER" \
    EXPECTED_INPUT_VAR_CODE="$EXPECTED_INPUT_VAR_CODE" \
    EXPECTED_PROMOTION_STATUS="READY" \
    EXPECTED_DRAFT_ID_PREFIX="BUILTIN:${EXPECTED_CATEGORY_SUBCODE}:" \
    EXPECTED_READY_SCOPES="$EXPECTED_READY_SCOPES" \
    SAVE_PAYLOAD_FILE="$SAVE_PAYLOAD_FILE" \
    VERIFY_INVALID_VARIABLE_CODE="false" \
    VERIFY_SAVED_VALUE="false" \
    VERIFY_CO2_TOTAL="false" \
    VERIFY_FORMULA_SUMMARY="false" \
    VERIFY_ROLLOUT_STATUS="true" \
    bash "$ROOT_DIR/ops/scripts/verify-emission-management-flow.sh" "$BASE_URL"; then
    break
  fi
  if [[ "$attempt" -ge "$EMISSION_SCOPE_VERIFY_RETRIES" ]]; then
    emission_fail "verification failed after $EMISSION_SCOPE_VERIFY_RETRIES attempts for $SCOPE"
  fi
  emission_info "retrying $SCOPE ($attempt/$EMISSION_SCOPE_VERIFY_RETRIES)"
  attempt=$((attempt + 1))
  sleep "$EMISSION_SCOPE_VERIFY_DELAY_SECONDS"
done
