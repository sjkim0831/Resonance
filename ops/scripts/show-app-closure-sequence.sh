#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/show-app-closure-sequence.sh

Purpose:
  Print the canonical app-closure execution sequence.

Related entrypoint:
  bash ops/scripts/app-closure-help.sh
EOF
  exit 0
fi

cat <<'EOF'
Carbonet App Closure Sequence

Recommended daily check:
  bash ops/scripts/verify-app-closure-all.sh
  bash ops/scripts/codex-verify-18000-freshness.sh

Canonical app assembly:
  apps/carbonet-app/pom.xml

Canonical packaged jar:
  apps/carbonet-app/target/carbonet.jar

Canonical local refresh:
  bash ops/scripts/build-restart-18000.sh

Structural closure:
  bash ops/scripts/run-large-move-app-closure.sh

Runtime freshness proof:
  bash ops/scripts/codex-verify-18000-freshness.sh

Combined operator sequence:
  bash ops/scripts/build-restart-18000.sh
  bash ops/scripts/run-large-move-app-closure.sh
  bash ops/scripts/codex-verify-18000-freshness.sh

Notes:
  - moved version-control resources resolve from modules/platform-version-control
  - app assembly excludes moved root resource families
  - deploy/apply/jenkins/blue-green scripts are aligned to the same app jar line

See also:
  bash ops/scripts/app-closure-help.sh
EOF
