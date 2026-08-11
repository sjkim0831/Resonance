#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SCRIPT="$ROOT/ops/scripts/validate-organizational-boundary-runtime.sh"
[[ -f "$SCRIPT" ]] || { echo '[organizational-boundary-auth-contract] runtime script missing' >&2; exit 1; }
bash -n "$SCRIPT"

python3 - "$SCRIPT" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")

def assert_contract(value):
    child = 'bash "$ROOT/ops/scripts/run-process-runtime-smoke.sh"'
    login = 'login_code="$(curl'
    assert value.count(child) == 1
    assert value.index(child) < value.index(login)
    assert 'SESSION_ACTIVE=1' in value
    assert '"$BASE_URL/signin/actionLogout"' in value
    assert "(.status // \"\") == \"success\"" in value
    p95_start = value.index('for _ in $(seq 1 20); do')
    p95_end = value.index('p95_ms=', p95_start)
    p95 = value[p95_start:p95_end]
    assert "-w '%{http_code}|%{time_total}'" in p95
    assert '[[ "$sample_status" == 200 ]]' in p95
    assert 'jq -e --arg project "$project_id"' in p95
    assert 'printf \'%s\\n\' "$sample_time" >>"$TIMINGS"' in p95

assert_contract(source)
mutations = [
    source.replace('bash "$ROOT/ops/scripts/run-process-runtime-smoke.sh"', 'true # child smoke removed', 1),
    source.replace('[[ "$sample_status" == 200 ]]', '[[ "$sample_status" != 000 ]]', 1),
    source.replace('jq -e --arg project "$project_id"', 'jq -e'),
    source.replace('"$BASE_URL/signin/actionLogout"', '"$BASE_URL/logout-removed"', 1),
]
for index, mutated in enumerate(mutations, 1):
    try:
        assert_contract(mutated)
    except AssertionError:
        continue
    raise AssertionError(f"organizational-boundary auth mutation survived index={index}")
print("ORGANIZATIONAL_BOUNDARY_AUTH_STATIC_PASS mutations=4 childSmoke=before-outer-login p95Samples=20 status=200 json=project logout=canonical")
PY
