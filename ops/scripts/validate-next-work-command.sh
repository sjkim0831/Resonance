#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
RUNNER="$ROOT_DIR/ops/scripts/run-next-project-work.sh"
ORCHESTRATOR="$ROOT_DIR/ops/scripts/run-project-auto-completion-orchestrator.sh"
UNIT="$ROOT_DIR/ops/systemd/resonance-next-work.service"

bash -n "$RUNNER"
bash -n "$ORCHESTRATOR"
bash -n "$ROOT_DIR/ops/scripts/install-next-work-command.sh"

grep -Fq 'MAX_PARALLEL_WORKERS=1' "$RUNNER"
grep -Fq 'PROJECT_AUTO_COMPLETION_WAIT_FOR_LOCK=true' "$RUNNER"
grep -Fq 'framework_project_completion_run' "$RUNNER"
grep -Fq 'framework_development_job' "$RUNNER"
grep -Fq 'orchestratorExitCode' "$RUNNER"
grep -Fq 'EnvironmentFile=/etc/resonance/process-development-worker.env' "$UNIT"
grep -Fq 'run-next-project-work.sh' "$UNIT"

echo "[next-work-command] PASS single-worker lock-wait reporting contract"
