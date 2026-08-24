#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
python3 - "$ROOT/ops/scripts/run-process-development-worker.sh" <<'PY'
import sys
from pathlib import Path

source = Path(sys.argv[1]).read_text(encoding="utf-8")
start = source.index('if [[ -n "$AI_STAGED_PUBLICATION_BRANCH" ]]; then',
                     source.index('git -C "$WT" -c user.name='))
end = source.index('# Parallel workers develop', start)
staged = source[start:end]
required = (
    'fetch origin "$AI_STAGED_PUBLICATION_BRANCH"',
    'rebase "origin/$AI_STAGED_PUBLICATION_BRANCH"',
    'revalidate_canonical_commit_after_rebase HEAD',
    'push origin "HEAD:$AI_STAGED_PUBLICATION_BRANCH"',
    "job_status='BLOCKED'",
    "last_error='STAGED_AWAITING_PROMOTION'",
    "delivery_status='GENERATED'",
    'lease_token=null',
    'deployment=0',
    'exit 0',
)
for token in required:
    if token not in staged:
        raise AssertionError(f"staged publication token missing: {token}")
for forbidden in ('HEAD:main', 'deployment_is_ready', 'runtime_is_healthy',
                  'finalize_canonical_generation', 'job_status=\'VERIFIED\''):
    if forbidden in staged:
        raise AssertionError(f"staged publication crosses deployment boundary: {forbidden}")
if source.index('BASE_COMMIT="$(git -C "$ROOT_DIR" rev-parse "origin/$SOURCE_BRANCH")"') \
        > source.index('worktree add -B "$BRANCH"'):
    raise AssertionError("staged source branch is selected after worktree creation")
mutant = staged.replace("job_status='BLOCKED'", "job_status='VERIFIED'", 1)
if "job_status='VERIFIED'" not in mutant:
    raise AssertionError("terminal-status mutant was not constructed")
print("PROCESS_WORKER_STAGED_PUBLICATION_PASS deployment=0 terminalVerified=0 mutants=1")
PY
