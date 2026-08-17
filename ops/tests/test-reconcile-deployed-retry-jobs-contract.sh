#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SCRIPT="$ROOT/ops/scripts/reconcile-deployed-retry-jobs.sh"
[[ -f "$SCRIPT" ]] || { echo "missing script: $SCRIPT" >&2; exit 1; }
bash -n "$SCRIPT"

set +e
output="$(env -u PGDATABASE -u PGUSER -u PGPASSWORD bash "$SCRIPT" --apply 2>&1)"
status=$?
set -e
[[ "$status" == 78 ]] || { echo "retired apply returned status=$status" >&2; exit 1; }
[[ "$output" == *'RECONCILE_DEPLOYED_RETRY_APPLY_RETIRED'* ]] || {
  echo 'retired apply did not emit the deterministic reason' >&2
  exit 1
}

grep -q 'if \[\[ "${1:-}" == "--apply" \]\]' "$SCRIPT"
grep -q 'exit 78' "$SCRIPT"
grep -q "'dry-run'" "$SCRIPT"
! grep -Eqi 'update[[:space:]]+framework_development_job|update[[:space:]]+framework_process_artifact|insert[[:space:]]+into[[:space:]]+framework_development_job_gate_result' "$SCRIPT"

python3 - "$SCRIPT" <<'PY'
import pathlib
import sys

source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
guard = source.index('if [[ "${1:-}" == "--apply" ]]')
retired = source.index('exit 78', guard)
credentials = source.index(': "${PGDATABASE:?PGDATABASE is required}"')
network = source.index('psqlq() {')
if not guard < retired < credentials < network:
    raise SystemExit("retired --apply must fail before credentials or network access")
for mutation in (
    "update framework_development_job",
    "update framework_process_artifact",
    "insert into framework_development_job_gate_result",
):
    if mutation in source.lower():
        raise SystemExit(f"retired reconciler still contains mutation: {mutation}")

mutant = source.replace('exit 78', 'exit 0', 1)
if 'exit 78' in mutant[guard:credentials]:
    raise SystemExit("retirement mutant was not effective")
PY

echo '[reconcile-deployed-retry-jobs-contract-test] PASS apply=retired status=78 preflight=network0 mutations=0 dry-run=preserved'
