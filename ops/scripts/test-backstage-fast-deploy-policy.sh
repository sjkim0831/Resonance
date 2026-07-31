#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
DEPLOY="$ROOT/ops/scripts/resonance-backstage-deploy.sh"
AUTO_DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"
E2E_SPEC="$ROOT/platform/control-plane/backstage/packages/app/e2e-tests/resonance-control-plane.test.ts"
E2E_RUNNER="$ROOT/ops/scripts/resonance-backstage-visual-e2e.sh"
PLAYWRIGHT_CONFIG="$ROOT/platform/control-plane/backstage/playwright.config.ts"
MANIFEST="$ROOT/deploy/k8s/control-plane/backstage.yaml"
FULL_E2E_RUNNER="$ROOT/ops/scripts/resonance-backstage-full-e2e.sh"
FULL_E2E_SERVICE="$ROOT/ops/systemd/resonance-backstage-full-e2e.service"
FULL_E2E_TIMER="$ROOT/ops/systemd/resonance-backstage-full-e2e.timer"
ROLE_E2E="$ROOT/ops/scripts/resonance-actor-process-role-e2e.sh"

grep -Fq 'DEPENDENCY_CACHE_ROOT=' "$DEPLOY"
grep -Fq "sha256sum \"\$APP/yarn.lock\" \"\$APP/package.json\" | awk '{print \$1}'" "$DEPLOY"
grep -Fq 'cp -al -- "$cache_modules" "$APP/node_modules"' "$DEPLOY"
grep -Fq '.resonance-immutable-cache-key' "$DEPLOY"
grep -Fq '"$(cat "$state_marker")" == "$cache_key"' "$DEPLOY"
grep -Fq 'dependency state matches immutable cache' "$DEPLOY"
grep -Fq 'flock -w 300 8' "$DEPLOY"
grep -Fq 'resonance.io/catalog-digest' "$DEPLOY"
if grep -Fq 'rollout restart deployment/resonance-backstage' "$DEPLOY"; then
  echo "Backstage deploy must not force a duplicate rollout" >&2
  exit 1
fi
grep -A8 'path: /.backstage/health/v1/readiness' "$MANIFEST" |
  grep -Fq 'periodSeconds: 1'
grep -A8 'path: /components.yaml' "$MANIFEST" |
  grep -Fq 'periodSeconds: 1'
grep -Fq 'Backstage visual E2E scope:' "$AUTO_DEPLOY"
grep -Fq '[[ -n "$e2e_routes" ]] && display_scope=impact' "$AUTO_DEPLOY"
grep -Fq 'RESONANCE_BACKSTAGE_E2E_SCOPE="$e2e_scope"' "$AUTO_DEPLOY"
grep -Fq 'derive_backstage_e2e_routes' "$AUTO_DEPLOY"
grep -Fq 'RESONANCE_BACKSTAGE_E2E_ROUTES="$e2e_routes"' "$AUTO_DEPLOY"
grep -Fq "e2eScope === 'recovery'" "$E2E_SPEC"
grep -Fq 'requestedRoutes.length > 0' "$E2E_SPEC"
grep -Fq "route === '/system-recovery'" "$E2E_SPEC"
grep -Fq 'BACKSTAGE_E2E_STORAGE_STATE="$auth_state"' "$E2E_RUNNER"
grep -Fq 'RESONANCE_E2E_SKIP_IDENTITY_PREFLIGHT=true' "$AUTO_DEPLOY"
grep -Fq 'identity preflight covered by deployment authentication gates' "$E2E_RUNNER"
grep -Fq './node_modules/.bin/playwright test' "$E2E_RUNNER"
grep -Fq 'chmod 0600 "$auth_state"' "$E2E_RUNNER"
grep -Fq 'storageState: process.env.BACKSTAGE_E2E_STORAGE_STATE' "$PLAYWRIGHT_CONFIG"
grep -Fq 'Backstage visual E2E running concurrently' "$AUTO_DEPLOY"
grep -Fq 'wait_backstage_visual_e2e' "$AUTO_DEPLOY"
grep -Fq 'concurrent Backstage visual E2E failed' "$AUTO_DEPLOY"
grep -Fq 'actor-process role E2E skipped for unrelated routes' "$AUTO_DEPLOY"
grep -Fq 'build_backstage_application' "$DEPLOY"
grep -Fq 'corepack yarn tsc >"$typecheck_log" 2>&1 &' "$DEPLOY"
grep -Fq 'corepack yarn build:backend >"$bundle_log" 2>&1 &' "$DEPLOY"
grep -Fq 'concurrent application build failed' "$DEPLOY"
if grep -Fq "awk '/^Driver:/ {print \$2; exit}'" "$DEPLOY"; then
  echo "buildx capability detection must not trigger SIGPIPE under pipefail" >&2
  exit 1
fi

eval "$(sed -n '/^derive_backstage_e2e_routes() {/,/^run_backstage_visual_e2e_if_required() {/p' "$AUTO_DEPLOY" | sed '$d')"
deployed_commit=base
target_commit=target
git() {
  printf '%s\n' \
    platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/SystemOperationsControlPage.tsx
}
[[ "$(derive_backstage_e2e_routes)" == "/system-operations" ]]
git() {
  printf '%s\n' \
    platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/SystemRecoveryControlPage.tsx \
    platform/control-plane/backstage/packages/backend/src/plugins/resonanceRecovery.ts
}
[[ "$(derive_backstage_e2e_routes)" == "/system-recovery" ]]
git() {
  printf '%s\n' deploy/k8s/control-plane/backstage.yaml
}
[[ "$(derive_backstage_e2e_routes)" == "/actor-process-control,/identity-administration,/system-operations" ]]
git() {
  printf '%s\n' \
    platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/plugin.tsx
}
[[ -z "$(derive_backstage_e2e_routes)" ]]
unset -f git derive_backstage_e2e_routes add_route add_core_routes

grep -Fq 'resonance-backstage-full-e2e.timer' "$AUTO_DEPLOY"
grep -Fq 'RESONANCE_BACKSTAGE_E2E_SCOPE=full' "$FULL_E2E_RUNNER"
grep -Fq '[[ -f "$RUNNER" ]]' "$FULL_E2E_RUNNER"
grep -Fq 'resonance-backstage-full-e2e.sh' "$FULL_E2E_SERVICE"
grep -Fq 'BACKSTAGE_E2E_USERNAME=sjkim' "$FULL_E2E_SERVICE"
grep -Fq 'BACKSTAGE_E2E_SECRET_NAME=resonance-keycloak-integrated-admin' "$FULL_E2E_SERVICE"
grep -Fq 'OnCalendar=*-*-* 02:40:00 Asia/Seoul' "$FULL_E2E_TIMER"
grep -Fq 'token_pids+=("$!")' "$ROLE_E2E"
grep -Fq 'dataset_pids+=("$!")' "$ROLE_E2E"
grep -Fq 'concurrent dataset fetch failed' "$ROLE_E2E"

echo "PASS Backstage deploy reuses dependencies, performs one fast rollout, and scopes E2E by impact"
