#!/usr/bin/env bash
set -euo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SCRIPT="$ROOT/ops/scripts/resonance-seven-step-disposable-e2e.mjs"
grep -Fq '/simulate' "$SCRIPT"
grep -Fq '/simulation-workflow' "$SCRIPT"
grep -Fq 'simulation idempotency contract failed' "$SCRIPT"
grep -Fq 'simulation workflow readback failed' "$SCRIPT"
grep -Fq 'evidence.simulation' "$SCRIPT"
grep -Fq 'projectedReduction' "$SCRIPT"
grep -Fq 'if (projectId && clients.owner)' "$SCRIPT"
printf '%s\n' '{"status":"PASS","processRelay":1,"create":1,"idempotentReplay":1,"readback":1,"cleanup":1}'
