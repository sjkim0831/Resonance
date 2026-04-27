#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/verify-emission-management-rollout-board-ready.sh [base-url]
  bash ops/scripts/show-emission-management-rollout-status.sh [base-url]
  bash ops/scripts/verify-emission-management-rollout-readonly.sh [base-url]
  bash ops/scripts/show-emission-management-rollout-board.sh [base-url]
  bash ops/scripts/verify-emission-management-rollout-scope.sh list-scopes

Purpose:
  Read `/admin/emission/management/page-data` and fail unless the expected
  rollout scope set is currently `READY` with `definitionFormulaAdopted=true`.
  This is a read-only assertion and does not execute save or calculate.

Environment overrides:
  EMISSION_EXPECT_READY_SCOPES
  EMISSION_ROLLOUT_OUTPUT
  EMISSION_HTTP_RETRIES
  EMISSION_HTTP_RETRY_SECONDS
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EMISSION_SCRIPT_NAME="verify-emission-management-rollout-board-ready"
source "$ROOT_DIR/ops/scripts/emission-management-auth-common.sh"
PORT="${PORT:-18000}"
CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/ops/config}"
ENV_FILE="${ENV_FILE:-$CONFIG_DIR/carbonet-${PORT}.env}"
emission_load_optional_env "$ENV_FILE"
BASE_URL="${1:-$(carbonet_runtime_base_url)}"
SCOPE_METADATA_FILE="$(emission_rollout_scope_metadata_file)"
DEFAULT_EMISSION_SCOPES="$(emission_rollout_default_scopes "$SCOPE_METADATA_FILE")"
EMISSION_EXPECT_READY_SCOPES="${EMISSION_EXPECT_READY_SCOPES:-$DEFAULT_EMISSION_SCOPES}"
EMISSION_ROLLOUT_OUTPUT="${EMISSION_ROLLOUT_OUTPUT:-text}"
EMISSION_HTTP_RETRIES="${EMISSION_HTTP_RETRIES:-3}"
EMISSION_HTTP_RETRY_SECONDS="${EMISSION_HTTP_RETRY_SECONDS:-1}"
emission_require_allowed_value "EMISSION_ROLLOUT_OUTPUT" "$EMISSION_ROLLOUT_OUTPUT" text json

[[ -f "$SCOPE_METADATA_FILE" ]] || emission_fail "scope metadata file is missing: $SCOPE_METADATA_FILE"
[[ -n "$EMISSION_EXPECT_READY_SCOPES" ]] || emission_fail "EMISSION_EXPECT_READY_SCOPES is empty"

EMISSION_EXPECT_READY_SCOPES="$EMISSION_EXPECT_READY_SCOPES" \
EMISSION_ROLLOUT_FILTER_SCOPES="$EMISSION_EXPECT_READY_SCOPES" \
EMISSION_ROLLOUT_OUTPUT="$EMISSION_ROLLOUT_OUTPUT" \
EMISSION_HTTP_RETRIES="$EMISSION_HTTP_RETRIES" \
EMISSION_HTTP_RETRY_SECONDS="$EMISSION_HTTP_RETRY_SECONDS" \
bash "$ROOT_DIR/ops/scripts/show-emission-management-rollout-board.sh" "$BASE_URL"
