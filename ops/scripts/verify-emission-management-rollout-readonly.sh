#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/verify-emission-management-rollout-readonly.sh [base-url]
  bash ops/scripts/show-emission-management-rollout-status.sh [base-url]
  bash ops/scripts/verify-emission-management-rollout-board-ready.sh [base-url]

Purpose:
  Run the read-only rollout verification bundle:
  1. verify scope metadata and fixture consistency
  2. assert that the expected rollout scope set is currently READY on the board

Environment overrides:
  EMISSION_READONLY_VERIFY_OUTPUT
    - text (default)
    - json
  EMISSION_EXPECT_READY_SCOPES
    - defaults to the metadata-derived scope set from
      `ops/fixtures/emission-management-rollout/scopes.tsv`
  EMISSION_ROLLOUT_OUTPUT
  EMISSION_HTTP_RETRIES
  EMISSION_HTTP_RETRY_SECONDS

Examples:
  bash ops/scripts/verify-emission-management-rollout-readonly.sh
  EMISSION_READONLY_VERIFY_OUTPUT=json bash ops/scripts/verify-emission-management-rollout-readonly.sh
  EMISSION_EXPECT_READY_SCOPES="CEMENT:1 LIME:2" bash ops/scripts/verify-emission-management-rollout-readonly.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EMISSION_SCRIPT_NAME="verify-emission-management-rollout-readonly"
source "$ROOT_DIR/ops/scripts/emission-management-auth-common.sh"
PORT="${PORT:-18000}"
CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/ops/config}"
ENV_FILE="${ENV_FILE:-$CONFIG_DIR/carbonet-${PORT}.env}"
emission_load_optional_env "$ENV_FILE"
BASE_URL="${1:-$(carbonet_runtime_base_url)}"
SCOPE_METADATA_FILE="$(emission_rollout_scope_metadata_file)"
DEFAULT_EMISSION_SCOPES="$(emission_rollout_default_scopes "$SCOPE_METADATA_FILE")"
EMISSION_EXPECT_READY_SCOPES="${EMISSION_EXPECT_READY_SCOPES:-$DEFAULT_EMISSION_SCOPES}"
EMISSION_READONLY_VERIFY_OUTPUT="${EMISSION_READONLY_VERIFY_OUTPUT:-text}"
emission_require_allowed_value "EMISSION_READONLY_VERIFY_OUTPUT" "$EMISSION_READONLY_VERIFY_OUTPUT" text json

[[ -f "$SCOPE_METADATA_FILE" ]] || emission_fail "scope metadata file is missing: $SCOPE_METADATA_FILE"

if [[ "$EMISSION_READONLY_VERIFY_OUTPUT" == "json" ]]; then
  TMP_DIR="$(mktemp -d /tmp/emission-rollout-readonly.XXXXXX)"
  FIXTURE_JSON="$TMP_DIR/fixtures.json"
  BOARD_JSON="$TMP_DIR/board.json"

  cleanup() {
    rm -rf "$TMP_DIR"
  }
  trap cleanup EXIT

  EMISSION_FIXTURE_VERIFY_OUTPUT=json \
    bash "$ROOT_DIR/ops/scripts/verify-emission-management-rollout-fixtures.sh" > "$FIXTURE_JSON"

  EMISSION_ROLLOUT_OUTPUT=json \
  EMISSION_EXPECT_READY_SCOPES="$EMISSION_EXPECT_READY_SCOPES" \
  EMISSION_HTTP_RETRIES="${EMISSION_HTTP_RETRIES:-3}" \
  EMISSION_HTTP_RETRY_SECONDS="${EMISSION_HTTP_RETRY_SECONDS:-1}" \
    bash "$ROOT_DIR/ops/scripts/verify-emission-management-rollout-board-ready.sh" "$BASE_URL" > "$BOARD_JSON"

  python3 - <<'PY' "$ROOT_DIR" "$FIXTURE_JSON" "$BOARD_JSON" "$BASE_URL" "$EMISSION_EXPECT_READY_SCOPES"
import json
import sys
from pathlib import Path

root_dir = Path(sys.argv[1])
sys.path.insert(0, str(root_dir / "ops/scripts"))

from emission_rollout_json_common import emit_json, split_scopes

fixture_path, board_path, base_url, expected_ready_raw = sys.argv[2:6]
emit_json(
    baseUrl=base_url,
    mode="verify",
    expectedReadyScopes=split_scopes(expected_ready_raw),
    fixtureVerification=json.load(open(fixture_path, encoding="utf-8")),
    boardReadyAssertion=json.load(open(board_path, encoding="utf-8")),
    status="ok",
)
PY
  exit 0
fi

echo "[verify-emission-management-rollout-readonly] fixture verification started"
bash "$ROOT_DIR/ops/scripts/verify-emission-management-rollout-fixtures.sh"

echo "[verify-emission-management-rollout-readonly] rollout board READY assertion started"
EMISSION_EXPECT_READY_SCOPES="$EMISSION_EXPECT_READY_SCOPES" \
EMISSION_ROLLOUT_OUTPUT="${EMISSION_ROLLOUT_OUTPUT:-text}" \
EMISSION_HTTP_RETRIES="${EMISSION_HTTP_RETRIES:-3}" \
EMISSION_HTTP_RETRY_SECONDS="${EMISSION_HTTP_RETRY_SECONDS:-1}" \
  bash "$ROOT_DIR/ops/scripts/verify-emission-management-rollout-board-ready.sh" "$BASE_URL"

echo "[verify-emission-management-rollout-readonly] completed"
