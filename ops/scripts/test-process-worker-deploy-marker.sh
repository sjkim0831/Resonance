#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKER="$ROOT_DIR/ops/scripts/run-process-development-worker.sh"
AUTO_DEPLOY="$ROOT_DIR/ops/scripts/auto-deploy-main.sh"
UNIT="$ROOT_DIR/ops/systemd/resonance-process-development-worker.service"
ORCHESTRATOR="$ROOT_DIR/ops/scripts/run-project-auto-completion-orchestrator.sh"
ORCHESTRATOR_UNIT="$ROOT_DIR/ops/systemd/resonance-project-auto-completion.service"
ORCHESTRATOR_TIMER="$ROOT_DIR/ops/systemd/resonance-project-auto-completion.timer"
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
grep -Fq 'RESONANCE_HEAVY_DB_LOCK_FILE' "$ORCHESTRATOR" \
  || fail "orchestrator does not participate in the shared heavy DB automation lock"
grep -Fq 'flock -n 7' "$ORCHESTRATOR" \
  || fail "orchestrator does not fail-safe when the shared DB automation lock is busy"
grep -Fq 'PROJECT_AUTO_COMPLETION_PGOPTIONS:--c work_mem=16MB -c maintenance_work_mem=128MB -c statement_timeout=180000 -c lock_timeout=10000' "$ORCHESTRATOR" \
  || fail "orchestrator does not bound PostgreSQL session memory, runtime and lock waits"
grep -Fq 'env PGOPTIONS="$AUTOMATION_PGOPTIONS"' "$ORCHESTRATOR" \
  || fail "orchestrator does not apply the bounded PostgreSQL session contract"
grep -Fq "ORCHESTRATOR_TERMINATED_STALE_RECOVERY" "$ORCHESTRATOR" \
  || fail "orchestrator does not reconcile stale project completion runs"
grep -Fq "PROJECT_COMPLETION_STALE_MINUTES:-10" "$ORCHESTRATOR" \
  || fail "orchestrator stale-run recovery is not bounded by age"
grep -Fq "where run_id='\$run_id' and run_status='RUNNING'" "$ORCHESTRATOR" \
  || fail "signal recovery must be scoped to the active run"
for signal in INT TERM HUP; do
  grep -Fq "trap 'mark_interrupted $signal" "$ORCHESTRATOR" \
    || fail "orchestrator does not finalize the active run on $signal"
done
grep -Fq 'OnUnitInactiveSec=2min' "$ORCHESTRATOR_TIMER" \
  || fail "orchestrator timer must leave a two-minute database cooldown after completion"
! grep -Fq 'OnUnitActiveSec=' "$ORCHESTRATOR_TIMER" \
  || fail "orchestrator timer must not immediately rerun after a long execution"
grep -Fq '/opt/resonance-data/control-plane/bin/run-project-auto-completion-orchestrator.sh' "$AUTO_DEPLOY" \
  || fail "auto-deploy does not install the orchestrator script"
frontend_branch="$(sed -n '/FRONTEND_USER|FRONTEND_ADMIN)/,/API|API_QUALITY|BACKEND|BACKEND_QUALITY)/p' "$DETERMINISTIC_RUNNER")"
grep -Fq 'generate-full-stack-design-packages.sh' <<<"$frontend_branch" \
  || fail "generated frontend cannot materialize its missing step package deterministically"
grep -Fq 'exact frontend step package missing after generation' <<<"$frontend_branch" \
  || fail "generated frontend does not fail closed after package generation"
grep -Fq "FRONTEND_PACKAGE_V1_RETRY" "$ORCHESTRATOR" \
  || fail "orchestrator cannot release a previously exhausted frontend after deterministic package generation is installed"
frontend_retry_code="$(grep -o "FRONTEND_PACKAGE_V1_RETRY" "$ORCHESTRATOR" | head -1)"
[[ "${#frontend_retry_code}" -le 30 ]] \
  || fail "frontend package recovery event exceeds the database event_type contract"
grep -Fq 'frontendPackageRetried=$frontend_package_retried' "$ORCHESTRATOR" \
  || fail "frontend package recovery is missing from orchestrator reporting"

echo "[process-worker-deploy-marker-test] PASS"
