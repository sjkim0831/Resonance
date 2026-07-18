#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
python3 -m py_compile "$ROOT/ops/scripts/verify-existing-server-job.py"
grep -Fq 'NO_SOURCE_MUTATION' "$ROOT/ops/scripts/verify-existing-server-job.py"
grep -Fq 'ALL_TYPE_GATES_REQUIRED' "$ROOT/ops/scripts/verify-existing-server-job.py"
grep -Fq "job_status in ('PLANNED','RETRY','FAILED')" "$ROOT/ops/scripts/adopt-existing-server-job.sh"
grep -Fq 'adopt-existing-server-job.sh" "$adoption_job_id" --apply' "$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
grep -Fq 'SERVER_ADOPTION_SCAN_LIMIT' "$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
if grep -Eq 'run-process-development-worker|run-project-auto-completion-orchestrator' "$ROOT/ops/scripts/adopt-existing-server-job.sh"; then
  echo "[server-adoption] FAIL adopter must remain independent" >&2; exit 1
fi
echo '[server-adoption] PASS deterministic evidence and independent apply lane verified'
