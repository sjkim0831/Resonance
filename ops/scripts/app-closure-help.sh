#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/app-closure-help.sh

Purpose:
  Show the primary entrypoint and the canonical verifier sequence for
  app-closure ownership checks.
EOF
  exit 0
fi

cat <<'EOF'
Carbonet App Closure Help

Recommended daily check:
  bash ops/scripts/verify-app-closure-all.sh
  bash ops/scripts/codex-verify-18000-freshness.sh

Start here:
  bash ops/scripts/show-app-closure-sequence.sh

Top-level owner check:
  bash ops/scripts/verify-app-closure-all.sh

Structural closure:
  bash ops/scripts/run-large-move-app-closure.sh

Runtime freshness proof:
  bash ops/scripts/codex-verify-18000-freshness.sh

ops/scripts self-audit:
  bash ops/scripts/audit-app-closure-ops.sh

Canonical local refresh:
  bash ops/scripts/build-restart-18000.sh

See also:
  bash ops/scripts/show-app-closure-sequence.sh
EOF
