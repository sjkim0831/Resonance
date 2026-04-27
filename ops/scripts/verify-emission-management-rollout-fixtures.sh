#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/verify-emission-management-rollout-fixtures.sh

Purpose:
  Verify that the rollout scope metadata and canonical fixture payload files are
  internally consistent.

Environment overrides:
  EMISSION_FIXTURE_VERIFY_OUTPUT
    - text (default)
    - json

Examples:
  bash ops/scripts/verify-emission-management-rollout-fixtures.sh
  EMISSION_FIXTURE_VERIFY_OUTPUT=json bash ops/scripts/verify-emission-management-rollout-fixtures.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EMISSION_SCRIPT_NAME="verify-emission-management-rollout-fixtures"
source "$ROOT_DIR/ops/scripts/emission-management-auth-common.sh"
FIXTURE_DIR="$ROOT_DIR/ops/fixtures/emission-management-rollout"
SCOPE_METADATA_FILE="$FIXTURE_DIR/scopes.tsv"
EMISSION_FIXTURE_VERIFY_OUTPUT="${EMISSION_FIXTURE_VERIFY_OUTPUT:-text}"
emission_require_allowed_value "EMISSION_FIXTURE_VERIFY_OUTPUT" "$EMISSION_FIXTURE_VERIFY_OUTPUT" text json

[[ -d "$FIXTURE_DIR" ]] || emission_fail "fixture directory is missing: $FIXTURE_DIR"
[[ -f "$SCOPE_METADATA_FILE" ]] || emission_fail "scope metadata file is missing: $SCOPE_METADATA_FILE"

line_count=0
declare -A seen_scopes=()
declare -A referenced_files=()

while IFS=$'\t' read -r scope category tier expected_input_var fixture_name; do
  [[ -n "${scope:-}" ]] || continue
  [[ "${scope:0:1}" == "#" ]] && continue
  line_count=$((line_count + 1))

  [[ -n "${category:-}" ]] || emission_fail "missing category in $SCOPE_METADATA_FILE for scope $scope"
  [[ -n "${tier:-}" ]] || emission_fail "missing tier in $SCOPE_METADATA_FILE for scope $scope"
  [[ -n "${expected_input_var:-}" ]] || emission_fail "missing expected input var in $SCOPE_METADATA_FILE for scope $scope"
  [[ -n "${fixture_name:-}" ]] || emission_fail "missing fixture file in $SCOPE_METADATA_FILE for scope $scope"
  [[ -z "${seen_scopes[$scope]:-}" ]] || emission_fail "duplicate scope in $SCOPE_METADATA_FILE: $scope"

  expected_fixture_name="${scope/:/-}.json"
  [[ "$fixture_name" == "$expected_fixture_name" ]] || emission_fail "fixture file name mismatch for $scope: expected $expected_fixture_name but was $fixture_name"

  seen_scopes["$scope"]=1
  referenced_files["$fixture_name"]=1

  fixture_path="$FIXTURE_DIR/$fixture_name"
  [[ -f "$fixture_path" ]] || emission_fail "fixture file missing for $scope: $fixture_path"

  python3 - <<'PY' "$fixture_path" "$scope" "$category" "$tier" "$expected_input_var"
import json, sys
path, scope, expected_category, expected_tier, expected_input_var = sys.argv[1:6]
data = json.load(open(path, encoding="utf-8"))
actual_tier = str(data.get("tier"))
if actual_tier != str(expected_tier):
    raise SystemExit(f"tier mismatch for {scope}: expected={expected_tier}, actual={actual_tier}")
category_id = data.get("categoryId")
if category_id not in (1, 2):
    raise SystemExit(f"unexpected categoryId for {scope}: {category_id}")
if expected_category == "CEMENT" and category_id != 1:
    raise SystemExit(f"categoryId mismatch for {scope}: expected 1, actual {category_id}")
if expected_category == "LIME" and category_id != 2:
    raise SystemExit(f"categoryId mismatch for {scope}: expected 2, actual {category_id}")
values = data.get("values") or []
if not values:
    raise SystemExit(f"fixture values are empty for {scope}")
if str(data.get("createdBy") or "") != "codex-rollout-fill":
    raise SystemExit(f"createdBy mismatch for {scope}: expected codex-rollout-fill")
var_codes = {str(item.get("varCode") or "").upper() for item in values}
if str(expected_input_var).upper() not in var_codes:
    raise SystemExit(f"expected input var missing for {scope}: {expected_input_var}")
PY
done < "$SCOPE_METADATA_FILE"

[[ "$line_count" -gt 0 ]] || emission_fail "no scopes found in $SCOPE_METADATA_FILE"

while IFS= read -r fixture_path; do
  fixture_name="$(basename "$fixture_path")"
  if [[ "$fixture_name" == "scopes.tsv" ]]; then
    continue
  fi
  if [[ "$fixture_name" == *.md ]]; then
    continue
  fi
  [[ -n "${referenced_files[$fixture_name]:-}" ]] || emission_fail "unreferenced fixture file found: $fixture_name"
done < <(find "$FIXTURE_DIR" -maxdepth 1 -type f | sort)

if [[ "$EMISSION_FIXTURE_VERIFY_OUTPUT" == "json" ]]; then
  python3 - <<'PY' "$ROOT_DIR" "$line_count" "$FIXTURE_DIR" "$SCOPE_METADATA_FILE"
import sys
from pathlib import Path

root_dir = Path(sys.argv[1])
sys.path.insert(0, str(root_dir / "ops/scripts"))

from emission_rollout_json_common import emit_json

emit_json(
    verifiedScopeCount=int(sys.argv[2]),
    fixtureDirectory=sys.argv[3],
    scopeMetadataFile=sys.argv[4],
    status="ok",
)
PY
  exit 0
fi

emission_info "verified $line_count scope metadata rows"
emission_info "fixture directory OK: $FIXTURE_DIR"
