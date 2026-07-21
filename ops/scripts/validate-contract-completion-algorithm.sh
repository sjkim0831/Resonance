#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260721130000__orchestrate_contract_driven_process_completion.sql"
LOCK_GUARD="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260721131000__respect_locked_processes_in_contract_completion.sql"
RETRY_GUARD="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260721132000__reuse_failed_contract_completion_jobs.sql"
BOUNDED_RETRY="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260721133000__bound_contract_completion_retries.sql"
ORCHESTRATOR="$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"

test -s "$MIGRATION"
grep -Fq 'framework_contract_completion_queue' "$MIGRATION"
grep -Fq 'framework_run_contract_completion' "$MIGRATION"
grep -Fq "completion_status='VERIFIED'" "$MIGRATION"
grep -Fq "quality_status='VERIFIED'" "$MIGRATION"
grep -Fq "nullif(j.evidence_ref,'') IS NOT NULL" "$MIGRATION"
grep -Fq 'CONTRACT_DRIVEN_VERTICAL_COMPLETION_V1' "$MIGRATION"
grep -Fq 'framework_run_contract_completion' "$ORCHESTRATOR"
grep -Fq 'NOT p.definition_locked' "$LOCK_GUARD"
grep -Fq 'ON CONFLICT(process_code,step_code,job_type,target_path)' "$RETRY_GUARD"
grep -Fq "job_status='RETRY'" "$RETRY_GUARD"
grep -Fq 'attempt_count<framework_development_job.max_attempts' "$BOUNDED_RETRY"
if grep -Fq 'greatest(0,framework_development_job.max_attempts-1)' "$BOUNDED_RETRY"; then
  echo '[contract-completion] bounded retry migration lowers attempt_count' >&2
  exit 1
fi

echo '[contract-completion] PASS deterministic queue, fail-closed verification, orchestrator integration'
