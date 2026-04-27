#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/list-emission-management-rollout-scopes.sh
  bash ops/scripts/show-emission-management-rollout-status.sh [base-url]
  bash ops/scripts/show-emission-management-rollout-board.sh [base-url]
  bash ops/scripts/verify-emission-management-rollout-readonly.sh [base-url]
  bash ops/scripts/verify-emission-management-rollout-board-ready.sh [base-url]

Purpose:
  Print the supported `/admin/emission/management` rollout scope matrix from
  `ops/fixtures/emission-management-rollout/scopes.tsv`.

Environment overrides:
  EMISSION_SCOPE_LIST_OUTPUT
    - text (default)
    - json
    - scopes

Examples:
  bash ops/scripts/list-emission-management-rollout-scopes.sh
  EMISSION_SCOPE_LIST_OUTPUT=json bash ops/scripts/list-emission-management-rollout-scopes.sh
  EMISSION_SCOPE_LIST_OUTPUT=scopes bash ops/scripts/list-emission-management-rollout-scopes.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EMISSION_SCRIPT_NAME="list-emission-management-rollout-scopes"
source "$ROOT_DIR/ops/scripts/emission-management-auth-common.sh"
SCOPE_METADATA_FILE="$(emission_rollout_scope_metadata_file)"
EMISSION_SCOPE_LIST_OUTPUT="${EMISSION_SCOPE_LIST_OUTPUT:-text}"
emission_require_allowed_value "EMISSION_SCOPE_LIST_OUTPUT" "$EMISSION_SCOPE_LIST_OUTPUT" text json scopes
[[ -f "$SCOPE_METADATA_FILE" ]] || emission_fail "scope metadata file is missing: $SCOPE_METADATA_FILE"

python3 - <<'PY' "$ROOT_DIR" "$SCOPE_METADATA_FILE" "$EMISSION_SCOPE_LIST_OUTPUT"
import sys
from pathlib import Path

root_dir = Path(sys.argv[1])
sys.path.insert(0, str(root_dir / "ops/scripts"))

from emission_rollout_json_common import emit_json, prefixed, render_scope_lines

path, output_mode = sys.argv[2:4]
rows = []
with open(path, encoding="utf-8") as handle:
    for raw in handle:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        scope, category_subcode, tier, expected_input_var, fixture_file = line.split("\t")
        rows.append({
            "scope": scope,
            "categorySubcode": category_subcode,
            "tier": int(tier),
            "expectedInputVar": expected_input_var,
            "fixtureFile": fixture_file,
        })

if output_mode == "json":
    emit_json(scopeCount=len(rows), scopes=rows)
    raise SystemExit(0)

if output_mode == "scopes":
    print(" ".join(row["scope"] for row in rows))
    raise SystemExit(0)

print(prefixed("list-emission-management-rollout-scopes", "supported scopes"))
for line in render_scope_lines("list-emission-management-rollout-scopes", rows, include_heading=False):
    print(line)
PY
