#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
RUNNER="$ROOT/ops/scripts/run-professional-screen-design-update.sh"

bash -n "$RUNNER"
grep -Fq 'framework_prepare_mass_professional_screens' "$RUNNER"
grep -Fq 'VERIFIED_SCREEN_CONTRACT_MUTATION_BLOCKED' "$RUNNER"
grep -Fq 'compile-cross-screen-contracts.sh' "$RUNNER"
grep -Fq 'framework_audit_executable_screen_designs' "$RUNNER"
grep -Fq 'generate-incremental-screen-runtime.sh' "$RUNNER"
grep -Fq 'framework_executable_screen_design_gate' "$RUNNER"
grep -Fq 'framework_professional_screen_design_update_gate' "$RUNNER"
grep -Fq 'framework_vertical_screen_design_map' "$RUNNER"
grep -Fq 'IMMUTABLE_FAIL_CLOSED' "$RUNNER"
grep -Fq 'professional-screen-design-update' "$RUNNER"
grep -Fq 'resonance-design-metadata.lock' "$RUNNER"
grep -Fq 'resonance-design-metadata.lock' "$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
grep -Fq 'resonance-design-metadata.lock' "$ROOT/ops/scripts/generate-incremental-screen-runtime.sh"
grep -Fq 'resonance-design-metadata.lock' "$ROOT/ops/scripts/generate-ai-contract-designs.sh"

echo '[professional-screen-design-update] PASS governed mass design contract'
