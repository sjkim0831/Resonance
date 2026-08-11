#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SMOKE="$ROOT/ops/scripts/run-process-runtime-smoke.sh"
ORG="$ROOT/ops/scripts/validate-organizational-boundary-runtime.sh"
GOV="$ROOT/ops/scripts/validate-governance-change-runtime.sh"

python3 - "$SMOKE" "$ORG" "$GOV" <<'PY'
from pathlib import Path
import sys

smoke, org, gov = (Path(item).read_text(encoding="utf-8") for item in sys.argv[1:])

def contract(source, organizational, governance):
    assert '${process_name}-${run_identity}-${stamp}.json' in source
    assert 'CARBONET_POSTDEPLOY_CANDIDATE_ID' in source
    assert 'EVIDENCE evidencePath=$evidence_path evidenceHash=$evidence_hash' in source
    assert 'if [[ "$EVIDENCE_MODE" != candidate ]]' in source
    for consumer in (organizational, governance):
        assert "RUNTIME_SMOKE_OUTPUT" in consumer
        assert "evidencePath=" in consumer
        assert "latest.json" not in consumer

contract(smoke, org, gov)
mutations = (
    (smoke.replace('${process_name}-${run_identity}-${stamp}.json', '${stamp}.json', 1), org, gov),
    (smoke.replace('EVIDENCE evidencePath=$evidence_path evidenceHash=$evidence_hash', 'EVIDENCE evidence=$evidence_path evidenceHash=$evidence_hash', 1), org, gov),
    (smoke, org.replace('runtime_evidence="$(sed ', 'runtime_evidence="$(readlink -f "$EVIDENCE_DIR/latest.json")" # ', 1), gov),
    (smoke, org, gov.replace('runtime_evidence="$(sed ', 'runtime_evidence="$(readlink -f "$EVIDENCE_DIR/latest.json")" # ', 1)),
)
for index, args in enumerate(mutations, 1):
    try:
        contract(*args)
    except AssertionError:
        continue
    raise AssertionError(f"evidence-isolation mutation survived index={index}")
PY

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mock_run() {
  local process="$1" candidate="$2" delay="$3" log="$4" path
  sleep "$delay"
  path="$tmp/${process}-${candidate}-$(date -u +%Y%m%dT%H%M%S%N).json"
  printf '{"process":"%s","candidate":"%s"}\n' "$process" "$candidate" >"$path"
  chmod 0444 "$path"
  printf '[process-runtime-smoke] EVIDENCE evidencePath=%s evidenceHash=mock process=%s runIdentity=%s\n' \
    "$path" "$process" "$candidate" >"$log"
}
mock_run ORGANIZATIONAL_BOUNDARY postdeploy:aaaaaaaaaaaa:one 0.05 "$tmp/org.log" & p1=$!
mock_run GOVERNANCE_CHANGE postdeploy:bbbbbbbbbbbb:two 0.01 "$tmp/gov.log" & p2=$!
wait "$p1"; wait "$p2"
org_path="$(sed -n 's/.*evidencePath=\([^ ]*\).*/\1/p' "$tmp/org.log")"
gov_path="$(sed -n 's/.*evidencePath=\([^ ]*\).*/\1/p' "$tmp/gov.log")"
[[ "$org_path" != "$gov_path" && -f "$org_path" && -f "$gov_path" && ! -e "$tmp/latest.json" ]]
grep -q '"candidate":"postdeploy:aaaaaaaaaaaa:one"' "$org_path"
grep -q '"candidate":"postdeploy:bbbbbbbbbbbb:two"' "$gov_path"
printf 'PROCESS_RUNTIME_EVIDENCE_ISOLATION_PASS parallel=2 exactPaths=2 latestReads=0 mutations=4\n'
