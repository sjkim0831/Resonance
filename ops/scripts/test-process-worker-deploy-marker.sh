#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKER="$ROOT_DIR/ops/scripts/run-process-development-worker.sh"
AUTO_DEPLOY="$ROOT_DIR/ops/scripts/auto-deploy-main.sh"
UNIT="$ROOT_DIR/ops/systemd/resonance-process-development-worker.service"
ORCHESTRATOR="$ROOT_DIR/ops/scripts/run-project-auto-completion-orchestrator.sh"
ORCHESTRATOR_UNIT="$ROOT_DIR/ops/systemd/resonance-project-auto-completion.service"
DETERMINISTIC_RUNNER="$ROOT_DIR/ops/scripts/run-deterministic-development-job.sh"

fail() {
  echo "[process-worker-deploy-marker-test] FAIL: $*" >&2
  exit 1
}

grep -Fq 'DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"' "$WORKER" \
  || fail "canonical deployment marker is missing"
grep -Fq 'deployed_commit()' "$WORKER" || fail "deployment marker resolver is missing"
grep -Fq 'git -C "$WT" merge-base --is-ancestor "$RESULT_COMMIT" "$DEPLOYED"' "$WORKER" \
  || fail "worker does not verify the result against the deployed commit"

if sed -n '/for _ in $(seq 1 90)/,/deployment_is_ready ||/p' "$WORKER" \
  | grep -Fq 'git -C "$ROOT_DIR" rev-parse HEAD'; then
  fail "worker still treats the mutable root checkout as deployment evidence"
fi

grep -Fq 'ExecStart=/usr/bin/bash /opt/resonance-data/control-plane/bin/run-process-development-dispatcher.sh' "$UNIT" \
  || fail "systemd worker does not use the persistent control-plane copy"
grep -Fq 'sync_process_development_worker_if_required()' "$AUTO_DEPLOY" \
  || fail "auto-deploy does not synchronize the worker control plane"
[[ "$(grep -Fc 'sync_process_development_worker_if_required' "$AUTO_DEPLOY")" -ge 3 ]] \
  || fail "runtime and metadata deployment paths do not both synchronize the worker control plane"
grep -Fq '/opt/resonance-data/control-plane/bin/run-process-development-worker.sh' "$AUTO_DEPLOY" \
  || fail "auto-deploy does not install the worker script"
grep -Fq 'bash "$PROCESS_DEVELOPMENT_DISPATCHER"' "$ORCHESTRATOR" \
  || fail "orchestrator does not use the colocated control-plane dispatcher"
grep -Fq 'ExecStart=/usr/bin/bash /opt/resonance-data/control-plane/bin/run-project-auto-completion-orchestrator.sh' "$ORCHESTRATOR_UNIT" \
  || fail "systemd orchestrator does not use the persistent control-plane copy"
grep -Fq '/opt/resonance-data/control-plane/bin/run-project-auto-completion-orchestrator.sh' "$AUTO_DEPLOY" \
  || fail "auto-deploy does not install the orchestrator script"
frontend_branch="$(sed -n '/FRONTEND_USER|FRONTEND_ADMIN)/,/API|API_QUALITY|BACKEND|BACKEND_QUALITY)/p' "$DETERMINISTIC_RUNNER")"
grep -Fq 'generate-full-stack-design-packages.sh' <<<"$frontend_branch" \
  || fail "generated frontend cannot materialize its missing step package deterministically"
grep -Fq 'exact frontend step package missing after generation' <<<"$frontend_branch" \
  || fail "generated frontend does not fail closed after package generation"

echo "[process-worker-deploy-marker-test] PASS"
