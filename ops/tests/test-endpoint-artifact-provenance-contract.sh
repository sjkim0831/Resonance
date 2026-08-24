#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
python3 - "$ROOT/ops/scripts/generate-spring-api-from-design.py" \
  "$ROOT/ops/scripts/validate-deterministic-fullstack-diff.sh" <<'PY'
import re
import sys
from pathlib import Path

generator = Path(sys.argv[1]).read_text(encoding="utf-8")
validator = Path(sys.argv[2]).read_text(encoding="utf-8")
emitted = {"Controller", "Request", "SuccessResponse", "RecoveryResponse", "ErrorResponse"}

for suffix in emitted - {"Controller"}:
    if f'"{suffix}"' not in generator:
        raise AssertionError(f"generator artifact missing: {suffix}")
match = re.search(r'for suffix in \(("Controller"[^\n]+)\)', validator)
if not match:
    raise AssertionError("validator operation artifact tuple is missing")
validated = set(re.findall(r'"([A-Za-z]+)"', match.group(1)))
if validated != emitted:
    raise AssertionError(f"generator/validator artifact mismatch: {sorted(validated)}")

mutant = validator.replace('"SuccessResponse"', '"Response"', 1)
match = re.search(r'for suffix in \(("Controller"[^\n]+)\)', mutant)
if set(re.findall(r'"([A-Za-z]+)"', match.group(1))) == emitted:
    raise AssertionError("legacy generic Response mutant survived")
if '"activationPolicy"' not in validator or 'SOURCE_IMMEDIATE_V1' not in validator:
    raise AssertionError("full-stack release activation policy is not validated")
print("ENDPOINT_ARTIFACT_PROVENANCE_PASS artifacts=5 activationPolicy=1 mutants=1")
PY
