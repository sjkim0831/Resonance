#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$ROOT_DIR/ops/scripts/validate-customer-work-journey.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
pass_count=0

validate_contract() {
  python3 - "$1" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
required = (
    'if len(member_codes)<17 or len(member_steps)<68:',
    'covered_member_codes={row.get("processCode") for row in member_steps}',
    'missing_member_codes=member_codes-covered_member_codes',
    'if missing_member_codes:',
    'member guide step coverage mismatch',
)
if 'len(member_codes)!=17' in source:
    raise SystemExit("fixed-size member catalog contract is forbidden")
missing = [contract for contract in required if contract not in source]
if missing:
    raise SystemExit(f"member catalog contract missing: {missing}")
PY
}

expect_pass() {
  local name="$1" source="$2"
  if validate_contract "$source"; then
    pass_count=$((pass_count + 1))
    printf 'PASS %s\n' "$name"
  else
    printf 'FAIL %s expected success\n' "$name" >&2
    exit 1
  fi
}

expect_fail() {
  local name="$1" source="$2"
  if validate_contract "$source" >/dev/null 2>&1; then
    printf 'FAIL %s expected rejection\n' "$name" >&2
    exit 1
  fi
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$name"
}

expect_pass baseline-script "$SOURCE"

sed 's/len(member_codes)<17/len(member_codes)!=17/' "$SOURCE" > "$TMP_DIR/fixed-size.sh"
expect_fail fixed-size-regression "$TMP_DIR/fixed-size.sh"

python3 - "$SOURCE" "$TMP_DIR/no-coverage.sh" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
start = source.index('covered_member_codes={row.get("processCode") for row in member_steps}')
end = source.index('if any(not row.get("userPath")', start)
Path(sys.argv[2]).write_text(source[:start] + source[end:], encoding="utf-8")
PY
expect_fail coverage-removal-regression "$TMP_DIR/no-coverage.sh"

printf '[customer-work-journey-member-catalog-contract] PASS checks=%d\n' "$pass_count"
