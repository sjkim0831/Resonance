#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/show-emission-management-rollout-status.sh [base-url]
  bash ops/scripts/help-emission-management-rollout.sh
  bash ops/scripts/verify-emission-management-rollout-readonly.sh [base-url]
  bash ops/scripts/verify-emission-management-rollout-board-ready.sh [base-url]

Purpose:
  Print one read-only status summary for the emission rollout toolchain:
  supported scopes, fixture consistency, and optionally the current rollout
  board from `/admin/emission/management/page-data`.

Environment overrides:
  EMISSION_STATUS_OUTPUT
    - text (default)
    - json
      returns a machine-readable status payload
  EMISSION_STATUS_INCLUDE_BOARD
    - true (default)
    - false
  EMISSION_EXPECT_READY_SCOPES
    - defaults to the metadata-derived scope set from
      `ops/fixtures/emission-management-rollout/scopes.tsv`
  EMISSION_ROLLOUT_FILTER_SCOPES

Examples:
  EMISSION_STATUS_INCLUDE_BOARD=false bash ops/scripts/show-emission-management-rollout-status.sh
  EMISSION_STATUS_OUTPUT=json EMISSION_STATUS_INCLUDE_BOARD=false bash ops/scripts/show-emission-management-rollout-status.sh
  EMISSION_EXPECT_READY_SCOPES="CEMENT:1 LIME:2" EMISSION_STATUS_INCLUDE_BOARD=false bash ops/scripts/show-emission-management-rollout-status.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EMISSION_SCRIPT_NAME="show-emission-management-rollout-status"
source "$ROOT_DIR/ops/scripts/emission-management-auth-common.sh"
PORT="${PORT:-18000}"
CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/ops/config}"
ENV_FILE="${ENV_FILE:-$CONFIG_DIR/carbonet-${PORT}.env}"
emission_load_optional_env "$ENV_FILE"
BASE_URL="${1:-$(carbonet_runtime_base_url)}"
EMISSION_STATUS_OUTPUT="${EMISSION_STATUS_OUTPUT:-text}"
EMISSION_STATUS_INCLUDE_BOARD="${EMISSION_STATUS_INCLUDE_BOARD:-true}"
SCOPE_METADATA_FILE="$(emission_rollout_scope_metadata_file)"
DEFAULT_EMISSION_SCOPES="$(emission_rollout_default_scopes "$SCOPE_METADATA_FILE")"
EMISSION_EXPECT_READY_SCOPES="${EMISSION_EXPECT_READY_SCOPES:-$DEFAULT_EMISSION_SCOPES}"
EMISSION_ROLLOUT_FILTER_SCOPES="${EMISSION_ROLLOUT_FILTER_SCOPES:-}"
emission_require_allowed_value "EMISSION_STATUS_OUTPUT" "$EMISSION_STATUS_OUTPUT" text json
emission_require_allowed_value "EMISSION_STATUS_INCLUDE_BOARD" "$EMISSION_STATUS_INCLUDE_BOARD" true false

TMP_DIR="$(mktemp -d /tmp/emission-rollout-status.XXXXXX)"
SCOPE_JSON="$TMP_DIR/scopes.json"
FIXTURE_JSON="$TMP_DIR/fixtures.json"
BOARD_JSON="$TMP_DIR/board.json"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

[[ -f "$SCOPE_METADATA_FILE" ]] || emission_fail "scope metadata file is missing: $SCOPE_METADATA_FILE"

EMISSION_SCOPE_LIST_OUTPUT=json \
  bash "$ROOT_DIR/ops/scripts/list-emission-management-rollout-scopes.sh" > "$SCOPE_JSON"

EMISSION_FIXTURE_VERIFY_OUTPUT=json \
  bash "$ROOT_DIR/ops/scripts/verify-emission-management-rollout-fixtures.sh" > "$FIXTURE_JSON"

if [[ "$EMISSION_STATUS_INCLUDE_BOARD" == "true" ]]; then
  EMISSION_ROLLOUT_OUTPUT=json \
  EMISSION_EXPECT_READY_SCOPES="$EMISSION_EXPECT_READY_SCOPES" \
  EMISSION_ROLLOUT_FILTER_SCOPES="$EMISSION_ROLLOUT_FILTER_SCOPES" \
    bash "$ROOT_DIR/ops/scripts/show-emission-management-rollout-board.sh" "$BASE_URL" > "$BOARD_JSON"
fi

python3 - <<'PY' "$ROOT_DIR" "$SCOPE_JSON" "$FIXTURE_JSON" "$BOARD_JSON" "$EMISSION_STATUS_OUTPUT" "$EMISSION_STATUS_INCLUDE_BOARD" "$BASE_URL" "$EMISSION_EXPECT_READY_SCOPES"
import json
import sys
from pathlib import Path

root_dir = Path(sys.argv[1])
sys.path.insert(0, str(root_dir / "ops/scripts"))

from emission_rollout_json_common import render_board_summary_lines, render_scope_lines, schema_payload, split_scopes

scope_path, fixture_path, board_path, output_mode, include_board_raw, base_url, expected_ready_raw = sys.argv[2:9]
include_board = include_board_raw.lower() == "true"
expected_ready_scopes = split_scopes(expected_ready_raw)

scope_catalog = json.load(open(scope_path, encoding="utf-8"))
fixture_status = json.load(open(fixture_path, encoding="utf-8"))
board = None
if include_board:
    board = json.load(open(board_path, encoding="utf-8"))
scopes = scope_catalog.get("scopes") or []

payload = schema_payload(
    baseUrl=base_url,
    mode="summary",
    status="ok",
    supportedScopeCount=len(scopes),
    supportedScopes=scopes,
    expectedReadyScopes=expected_ready_scopes,
    fixtureVerification=fixture_status,
    boardIncluded=include_board,
)
if board is not None:
    payload["board"] = board

if output_mode == "json":
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    raise SystemExit(0)

print("[show-emission-management-rollout-status] summary")
print(f"[show-emission-management-rollout-status]   supported scopes: {len(scopes)}")
print(f"[show-emission-management-rollout-status]   fixture verification: {fixture_status.get('status')}")
print(f"[show-emission-management-rollout-status]   board included: {str(include_board).lower()}")
for line in render_scope_lines("show-emission-management-rollout-status", scopes):
    print(line)

if board is not None:
    for line in render_board_summary_lines(
        "show-emission-management-rollout-status",
        board.get("rolloutSummaryCards") or [],
        board.get("rolloutStatusRows") or [],
    ):
        print(line)
PY
