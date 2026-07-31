#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
DEPLOY="$ROOT/ops/scripts/resonance-backstage-deploy.sh"
AUTO_DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"
E2E_SPEC="$ROOT/platform/control-plane/backstage/packages/app/e2e-tests/resonance-control-plane.test.ts"
E2E_RUNNER="$ROOT/ops/scripts/resonance-backstage-visual-e2e.sh"
PLAYWRIGHT_CONFIG="$ROOT/platform/control-plane/backstage/playwright.config.ts"
MANIFEST="$ROOT/deploy/k8s/control-plane/backstage.yaml"

grep -Fq 'DEPENDENCY_CACHE_ROOT=' "$DEPLOY"
grep -Fq "sha256sum \"\$APP/yarn.lock\" \"\$APP/package.json\" | awk '{print \$1}'" "$DEPLOY"
grep -Fq 'cp -al -- "$cache_modules" "$APP/node_modules"' "$DEPLOY"
grep -Fq 'flock -w 300 8' "$DEPLOY"
grep -Fq 'resonance.io/catalog-digest' "$DEPLOY"
if grep -Fq 'rollout restart deployment/resonance-backstage' "$DEPLOY"; then
  echo "Backstage deploy must not force a duplicate rollout" >&2
  exit 1
fi
grep -A8 'path: /.backstage/health/v1/readiness' "$MANIFEST" |
  grep -Fq 'periodSeconds: 2'
grep -Fq 'Backstage visual E2E scope:' "$AUTO_DEPLOY"
grep -Fq 'RESONANCE_BACKSTAGE_E2E_SCOPE="$e2e_scope"' "$AUTO_DEPLOY"
grep -Fq 'derive_backstage_e2e_routes' "$AUTO_DEPLOY"
grep -Fq 'RESONANCE_BACKSTAGE_E2E_ROUTES="$e2e_routes"' "$AUTO_DEPLOY"
grep -Fq "e2eScope === 'recovery'" "$E2E_SPEC"
grep -Fq 'requestedRoutes.length > 0' "$E2E_SPEC"
grep -Fq "route === '/system-recovery'" "$E2E_SPEC"
grep -Fq 'BACKSTAGE_E2E_STORAGE_STATE="$auth_state"' "$E2E_RUNNER"
grep -Fq 'chmod 0600 "$auth_state"' "$E2E_RUNNER"
grep -Fq 'storageState: process.env.BACKSTAGE_E2E_STORAGE_STATE' "$PLAYWRIGHT_CONFIG"
grep -Fq 'Backstage visual E2E running concurrently' "$AUTO_DEPLOY"
grep -Fq 'wait_backstage_visual_e2e' "$AUTO_DEPLOY"
grep -Fq 'concurrent Backstage visual E2E failed' "$AUTO_DEPLOY"

echo "PASS Backstage deploy reuses dependencies, performs one fast rollout, and scopes E2E by impact"
