#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
DEPLOY="$ROOT/ops/scripts/resonance-backstage-deploy.sh"
MANIFEST="$ROOT/deploy/k8s/control-plane/backstage.yaml"

grep -Fq 'DEPENDENCY_CACHE_ROOT=' "$DEPLOY"
grep -Fq 'cp -al -- "$cache_modules" "$APP/node_modules"' "$DEPLOY"
grep -Fq 'flock -w 300 8' "$DEPLOY"
grep -Fq 'resonance.io/catalog-digest' "$DEPLOY"
if grep -Fq 'rollout restart deployment/resonance-backstage' "$DEPLOY"; then
  echo "Backstage deploy must not force a duplicate rollout" >&2
  exit 1
fi
grep -A8 'path: /.backstage/health/v1/readiness' "$MANIFEST" |
  grep -Fq 'periodSeconds: 2'

echo "PASS Backstage deploy reuses dependencies and performs one fast rollout"
