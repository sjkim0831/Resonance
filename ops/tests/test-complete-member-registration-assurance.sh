#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/complete-member-registration-assurance.sh"

bash -n "$TARGET"
grep -Fq 'CARBONET_KUBE_NAMESPACE:-carbonet-prod' "$TARGET"
grep -Fq 'CARBONET_RUNTIME_DEPLOYMENT:-carbonet-runtime' "$TARGET"
grep -Fq 'CARBONET_REACT_OVERLAY_PATH:-/app/react-app-overlay' "$TARGET"
grep -Fq 'exec "deployment/$RUNTIME_DEPLOYMENT"' "$TARGET"
grep -Fq "grep -Rql 'joinVerificationSuccess' \"\$REACT_OVERLAY_PATH\"" "$TARGET"
grep -Fq 'complete_ratio "$tests" 15' "$TARGET"
grep -Fq 'complete_ratio "$tasks" 57' "$TARGET"
grep -Fq 'complete_ratio "$artifacts" 6' "$TARGET"
grep -Fq 'complete_ratio "$screens" 11' "$TARGET"

if grep -Fq 'apps/carbonet-api/src/main/resources/static/react-app/assets' "$TARGET"; then
  echo '[member-assurance-contract] FAIL legacy packaged asset lookup returned' >&2
  exit 1
fi

echo '[member-assurance-contract] PASS deployed overlay is the authoritative identity asset'
