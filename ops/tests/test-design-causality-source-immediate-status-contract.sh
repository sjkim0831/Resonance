#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260815120000__extend_design_causality_codegen_input_v2.sql"
ORCHESTRATOR="$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"

fail() {
  printf '[design-causality-source-immediate-status] FAIL %s\n' "$1" >&2
  exit 1
}

[[ -f "$MIGRATION" ]] || fail 'migration missing'
[[ -f "$ORCHESTRATOR" ]] || fail 'post-commit orchestrator missing'
[[ "$(grep -Fc "'activationPolicy','SOURCE_IMMEDIATE_V1'" "$MIGRATION")" -eq 3 ]] ||
  fail 'normal readiness, exception readiness, and status must expose SOURCE_IMMEDIATE_V1'
[[ "$(grep -Fc "'generationEnforcement',true,'deploymentWiring',1" "$MIGRATION")" -eq 3 ]] ||
  fail 'SOURCE immediate enforcement and wiring must be enabled in all status shapes'
! grep -Fq "'generationEnforcement',false" "$MIGRATION" ||
  fail 'disabled generation claim remains'
! grep -Fq "'deploymentWiring',0" "$MIGRATION" ||
  fail 'zero deployment wiring claim remains'
! grep -Fq 'ACTIVE_RELEASE_BINDING_SOURCE_ONLY' "$MIGRATION" ||
  fail 'legacy ACTIVE binding still blocks SOURCE readiness'
! grep -Fq 'ACTIVE_RELEASE_BINDING_SOURCE_ONLY' "$ORCHESTRATOR" ||
  fail 'post-commit orchestrator still treats legacy ACTIVE as a SOURCE blocker'
! grep -Fq 'M3' "$MIGRATION" || fail 'staged M3 dependency remains'
grep -Fq "'databaseDirtySignal',1,'postCommitCompiler',1,'generator',1" "$MIGRATION" ||
  fail 'compiler or generator coverage is not reported'
grep -Fq "'deployment',1,'runtimeProbe',1,'relayE2e',1" "$MIGRATION" ||
  fail 'deployment or runtime verification coverage is not reported'
grep -Fq 'SOURCE save is authoritative for generation, endpoint closure, deployment evidence, and runtime verification' "$MIGRATION" ||
  fail 'readiness comment does not describe direct SOURCE authority'

printf '[design-causality-source-immediate-status] PASS policy=SOURCE_IMMEDIATE_V1 statusShapes=3 generationEnforcement=true deploymentWiring=1 legacyActiveBlocker=0 M3=0\n'
