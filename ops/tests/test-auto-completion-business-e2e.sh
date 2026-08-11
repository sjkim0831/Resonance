#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
bash -n "$TARGET"

for contract in \
  'timeout 900 bash "$BUSINESS_E2E_RUNNER"' \
  'BUSINESS_E2E_RUNNER_REGISTRY="$BUSINESS_E2E_REGISTRY"' \
  'BUSINESS_E2E_RUNTIME_ROOT' \
  'business_e2e_rc == 75' \
  'status:"DEFERRED"' \
  'dispatcher_failed=1' \
  'businessE2E='; do
  grep -Fq "$contract" "$TARGET" || {
    echo "[auto-completion-business-e2e] FAIL missing=$contract" >&2
    exit 1
  }
done

runner_line="$(grep -n 'run-next-current-business-e2e.sh' "$TARGET" | head -1 | cut -d: -f1)"
completion_line="$(grep -n '^completed=' "$TARGET" | head -1 | cut -d: -f1)"
(( runner_line < completion_line )) || {
  echo '[auto-completion-business-e2e] FAIL current evidence must be evaluated before completion status' >&2
  exit 1
}
echo '[auto-completion-business-e2e] PASS scheduled=project-timer max-one=registry deploy-lock=shared deferred=75 failure=propagated'
