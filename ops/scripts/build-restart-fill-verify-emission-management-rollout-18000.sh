#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/build-restart-fill-verify-emission-management-rollout-18000.sh
  bash ops/scripts/show-emission-management-rollout-status.sh [base-url]
  bash ops/scripts/verify-emission-management-rollout-scope.sh list-scopes

Purpose:
  Verify rollout metadata fixtures first, then run the standard :18000 build
  and restart flow, verify runtime freshness, populate rollout comparison
  snapshots for the supported emission scopes, and then verify the emission
  management route/API flow including rollout board reflection. When the
  environment allows it, also print the final rollout board summary.

Environment overrides:
  VERIFY_WAIT_SECONDS
  EMISSION_SCOPES
  EMISSION_SCOPE_DELAY_SECONDS
  EXPECT_ALL_SCOPES_READY
  EXPECTED_CATEGORY_SUBCODE
  EXPECTED_TIER
  EXPECTED_CO2_TOTAL
  EXPECTED_FORMULA_SUMMARY
  EXPECTED_PROMOTION_STATUS
  EXPECTED_DRAFT_ID_PREFIX
  EMISSION_EXPECT_READY_SCOPES
  SHOW_ROLLOUT_BOARD_AT_END
  IGNORE_ROLLOUT_BOARD_SHOW_FAILURE
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EMISSION_SCRIPT_NAME="build-restart-fill-verify-emission-management-rollout-18000"
source "$ROOT_DIR/ops/scripts/emission-management-auth-common.sh"
SCOPE_METADATA_FILE="$(emission_rollout_scope_metadata_file)"
DEFAULT_EMISSION_SCOPES="$(emission_rollout_default_scopes "$SCOPE_METADATA_FILE")"
EMISSION_SCOPES="${EMISSION_SCOPES:-$DEFAULT_EMISSION_SCOPES}"
EMISSION_EXPECT_READY_SCOPES="${EMISSION_EXPECT_READY_SCOPES:-$EMISSION_SCOPES}"
SHOW_ROLLOUT_BOARD_AT_END="${SHOW_ROLLOUT_BOARD_AT_END:-true}"
IGNORE_ROLLOUT_BOARD_SHOW_FAILURE="${IGNORE_ROLLOUT_BOARD_SHOW_FAILURE:-true}"
emission_require_allowed_value "SHOW_ROLLOUT_BOARD_AT_END" "$SHOW_ROLLOUT_BOARD_AT_END" true false
emission_require_allowed_value "IGNORE_ROLLOUT_BOARD_SHOW_FAILURE" "$IGNORE_ROLLOUT_BOARD_SHOW_FAILURE" true false

echo "[build-restart-fill-verify-emission-management-rollout-18000] rollout fixture verification started"
bash "$ROOT_DIR/ops/scripts/verify-emission-management-rollout-fixtures.sh"

echo "[build-restart-fill-verify-emission-management-rollout-18000] build + restart started"
bash "$ROOT_DIR/ops/scripts/build-restart-18000.sh"

echo "[build-restart-fill-verify-emission-management-rollout-18000] app closure verification started"
bash "$ROOT_DIR/ops/scripts/verify-large-move-app-closure.sh"

echo "[build-restart-fill-verify-emission-management-rollout-18000] runtime freshness verification started"
VERIFY_WAIT_SECONDS="${VERIFY_WAIT_SECONDS:-20}" bash "$ROOT_DIR/ops/scripts/codex-verify-18000-freshness.sh"

echo "[build-restart-fill-verify-emission-management-rollout-18000] rollout snapshot fill started"
bash "$ROOT_DIR/ops/scripts/fill-emission-management-rollout-snapshots.sh"

echo "[build-restart-fill-verify-emission-management-rollout-18000] emission management flow verification started"
bash "$ROOT_DIR/ops/scripts/verify-emission-management-flow.sh"

if [[ "$SHOW_ROLLOUT_BOARD_AT_END" == "true" ]]; then
  echo "[build-restart-fill-verify-emission-management-rollout-18000] rollout board summary started"
  if ! EMISSION_EXPECT_READY_SCOPES="$EMISSION_EXPECT_READY_SCOPES" \
    EMISSION_ROLLOUT_FILTER_SCOPES="$EMISSION_EXPECT_READY_SCOPES" \
    bash "$ROOT_DIR/ops/scripts/show-emission-management-rollout-board.sh"; then
    if [[ "$IGNORE_ROLLOUT_BOARD_SHOW_FAILURE" == "true" ]]; then
      echo "[build-restart-fill-verify-emission-management-rollout-18000] rollout board summary failed, but continuing because IGNORE_ROLLOUT_BOARD_SHOW_FAILURE=true"
    else
      exit 1
    fi
  fi
fi

echo "[build-restart-fill-verify-emission-management-rollout-18000] completed"
