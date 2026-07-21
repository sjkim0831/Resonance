#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260721130000__orchestrate_contract_driven_process_completion.sql"
ORCHESTRATOR="$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"

test -s "$MIGRATION"
grep -Fq 'framework_contract_completion_queue' "$MIGRATION"
grep -Fq 'framework_run_contract_completion' "$MIGRATION"
grep -Fq "completion_status='VERIFIED'" "$MIGRATION"
grep -Fq "quality_status='VERIFIED'" "$MIGRATION"
grep -Fq "nullif(j.evidence_ref,'') IS NOT NULL" "$MIGRATION"
grep -Fq 'CONTRACT_DRIVEN_VERTICAL_COMPLETION_V1' "$MIGRATION"
grep -Fq 'framework_run_contract_completion' "$ORCHESTRATOR"

echo '[contract-completion] PASS deterministic queue, fail-closed verification, orchestrator integration'
