#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
GENERATOR="$ROOT/ops/scripts/generate-incremental-screen-runtime.py"
RUNNER="$ROOT/ops/scripts/generate-incremental-screen-runtime.sh"
ORCHESTRATOR="$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260722234500__install_incremental_screen_generation_pipeline.sql"

bash -n "$RUNNER"
PYTHONPYCACHEPREFIX="${TMPDIR:-/tmp}/resonance-pycache" python3 -m py_compile "$GENERATOR"

grep -Fq "ownership_mode IN ('GENERATED','MANUAL','HYBRID')" "$MIGRATION"
grep -Fq 'framework_screen_design_hash' "$MIGRATION"
grep -Fq 'framework_incremental_screen_generation_snapshot' "$MIGRATION"
grep -Fq 'framework_complete_incremental_screen_generation' "$MIGRATION"
grep -Fq 'runtime artifact missing, corrupt, or stale' "$RUNNER"
grep -Fq 'verified_inventory' "$GENERATOR"
grep -Fq 'state.design_hash=artifact."designHash"' "$MIGRATION"
grep -Fq 'manualSourceProtected' "$GENERATOR"
grep -Fq 'os.replace(temporary, path)' "$GENERATOR"
grep -Fq 'activation point; always written last' "$GENERATOR"
grep -Fq 'framework_incremental_screen_generation_snapshot(integer,character varying)' "$ORCHESTRATOR"
grep -Fq 'SCREEN_RUNTIME_OUT=' "$ORCHESTRATOR"

benchmark="$(python3 "$GENERATOR" --benchmark 1000 --workers 16 --max-millis 180000)"
jq -e '.success==true and .benchmarkCount==1000 and .generated==1000
  and .unchanged==1000 and .incrementalReuseVerified==true
  and .failed==0 and .elapsedMillis<=180000' <<<"$benchmark" >/dev/null

jq -cn --argjson benchmark "$benchmark" '{
  success:true,contract:"DESIGN_TO_RUNTIME_INCREMENTAL_V1",
  ownershipModes:["GENERATED","MANUAL","HYBRID"],
  maxScreens:1000,slaMillis:180000,benchmark:$benchmark
}'
