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
PURGE_BRIDGE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/web/ActorProcessControlPlaneBridgeController.java"
PURGE_BRIDGE_TEST="$ROOT/modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/web/ActorProcessControlPlaneBridgeProjectPurgeTest.java"

grep -Fq 'DEPENDENCY_CACHE_ROOT=' "$DEPLOY"
grep -Fq 'resonance-backstage-runtime-fingerprint.sh' "$DEPLOY"
grep -Fq 'promoted verified legacy image to runtime fingerprint' "$DEPLOY"
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
grep -A8 'path: /api/resonance-projects/health/project-runtime-purge-recovery' "$MANIFEST" |
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
bash "$ROOT/ops/scripts/test-backstage-runtime-fingerprint.sh"
bash "$ROOT/ops/scripts/test-backstage-runtime-purge-recovery-secret.sh" "$ROOT"
bash "$ROOT/ops/scripts/test-backstage-deployment-rollback.sh" "$ROOT"
grep -Fq 'Integer authorityProof=jdbc.queryForObject(' "$PURGE_BRIDGE"
grep -Fq '"select 1 from (select "' "$PURGE_BRIDGE"
grep -Fq '+"framework_project_runtime_purge_require_admin(?)) "' "$PURGE_BRIDGE"
if grep -Fq 'framework_project_runtime_purge_require_admin(?) is null' "$PURGE_BRIDGE"; then
  echo "Runtime purge authority proof must not test PostgreSQL void for NULL" >&2
  exit 1
fi
grep -Fq '&&sql.contains("select 1 from")' "$PURGE_BRIDGE_TEST"
grep -Fq '&&!sql.contains("is null")' "$PURGE_BRIDGE_TEST"
grep -Fq 'build_backstage_application' "$DEPLOY"
grep -Fq 'corepack yarn tsc >"$typecheck_log" 2>&1 &' "$DEPLOY"
grep -Fq 'corepack yarn build:backend >"$bundle_log" 2>&1 &' "$DEPLOY"
grep -Fq 'concurrent application build failed' "$DEPLOY"
grep -Fq 'policy_contract_files=(' "$AUTO_DEPLOY"
grep -Fq 'ops/scripts/test-backstage-deployment-rollback.sh' "$AUTO_DEPLOY"
grep -Fq 'deterministic policy gates reused: unchanged fingerprint' "$AUTO_DEPLOY"
grep -Fq 'sha256sum "${policy_existing_files[@]}"' "$AUTO_DEPLOY"
grep -Fq 'cached_policy_digest" == "$policy_digest"' "$AUTO_DEPLOY"
grep -Fq "printf 'MISSING  %s\\n'" "$AUTO_DEPLOY"
grep -Fq 'BACKUP_TIMEOUT_SECONDS="${CARBONET_BACKUP_TIMEOUT_SECONDS:-3600}"' "$AUTO_DEPLOY"
python3 - "$AUTO_DEPLOY" "$DEPLOY" <<'PY'
import pathlib
import re
import sys

auto = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
deploy = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
default_path = "/opt/resonance-data/control-plane/deploy-state/backstage"
if default_path not in auto or default_path not in deploy:
    raise SystemExit("Backstage writers do not share the durable state-directory lock")

def body(source: str, name: str, next_name: str) -> str:
    return source.split(f"{name}() {{", 1)[1].split(f"\n{next_name}() {{", 1)[0]

self_heal = body(auto, "ensure_backstage_actor_process_e2e_ready", "run_serialized_carbonet_actor_process_e2e_job")
catalog = auto.split("sync_backstage_catalog_if_required() {", 1)[1].split(
    "\n}\n\n# The standard build", 1
)[0]
for label, section in (("self-heal", self_heal), ("catalog-sync", catalog)):
    acquire = section.index("acquire_clean_backstage_deployment_mutation_lock")
    mutation = section.index("rollout restart")
    if acquire >= mutation or "release_backstage_deployment_mutation_lock" not in section[mutation:]:
        raise SystemExit(f"Backstage {label} mutation is outside the shared lock")
if 'state_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"' not in auto:
    raise SystemExit("Backstage auto lock does not bind the pending-state directory")
clean_lock = body(
    auto,
    "acquire_clean_backstage_deployment_mutation_lock",
    "recover_pending_backstage_deployment_after_target_merge",
)
if "-e \"$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE\"" not in clean_lock or \
        "-L \"$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE\"" not in clean_lock:
    raise SystemExit("Backstage raw writers do not refuse a pending durable rollback")
if auto.count("recover_pending_backstage_deployment_after_target_merge || exit $?") != 2:
    raise SystemExit("both runtime and catalog-only target merges must run pending recovery")
for merge_section in auto.split('git merge --ff-only "$target_commit"')[1:]:
    static_gate = merge_section.find("run_postdeploy_candidate_static_contract_if_required")
    recover = merge_section.find("recover_pending_backstage_deployment_after_target_merge || exit $?")
    if static_gate < 0 or recover < static_gate:
        raise SystemExit("target Backstage recovery must follow its static contract")
PY

lock_fixture="$(mktemp -d)"
trap 'rm -rf -- "$lock_fixture"' EXIT
mkdir -m 0700 "$lock_fixture/state"
lock_functions="$lock_fixture/auto-lock-functions.sh"
sed -n \
  '/^acquire_backstage_deployment_mutation_lock() {/,/^}/p; /^release_backstage_deployment_mutation_lock() {/,/^}/p; /^acquire_clean_backstage_deployment_mutation_lock() {/,/^}/p' \
  "$AUTO_DEPLOY" >"$lock_functions"
(
  # shellcheck disable=SC1090
  source "$lock_functions"
  BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$lock_fixture/state/deployment-rollback.pending.json"
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_WAIT_SECONDS=1
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=""
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
  acquire_backstage_deployment_mutation_lock
  : >"$lock_fixture/holder.ready"
  # Keep the lock in the holder shell only; supported systemd execution kills
  # the whole cgroup, while this focused mutant terminates just that holder.
  sleep 30 {BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD}<&-
) &
lock_holder_pid="$!"
for _ in $(seq 1 100); do
  [[ -e "$lock_fixture/holder.ready" ]] && break
  sleep 0.01
done
[[ -e "$lock_fixture/holder.ready" ]]
set +e
(
  # shellcheck disable=SC1090
  source "$lock_functions"
  BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$lock_fixture/state/deployment-rollback.pending.json"
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_WAIT_SECONDS=1
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=""
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
  acquire_backstage_deployment_mutation_lock
) >"$lock_fixture/contender.out" 2>"$lock_fixture/contender.err"
lock_contender_status="$?"
set -e
[[ "$lock_contender_status" == 79 ]]
kill -KILL "$lock_holder_pid" 2>/dev/null || true
wait "$lock_holder_pid" 2>/dev/null || true
(
  # shellcheck disable=SC1090
  source "$lock_functions"
  BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$lock_fixture/state/deployment-rollback.pending.json"
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_WAIT_SECONDS=1
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=""
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
  acquire_backstage_deployment_mutation_lock
  release_backstage_deployment_mutation_lock
)

# A durable pending baseline outlives the crashed holder.  Both raw supported
# writers must recheck it after acquiring the shared lock and return 79 before
# any kubectl mutation; the target recovery mode is the only writer allowed to
# consume it.
writer_functions="$lock_fixture/auto-writer-functions.sh"
{
  sed -n \
    '/^acquire_backstage_deployment_mutation_lock() {/,/^recover_pending_backstage_deployment_after_target_merge() {/p' \
    "$AUTO_DEPLOY" | sed '$d'
  sed -n \
    '/^backstage_actor_process_readiness_status() {/,/^run_serialized_carbonet_actor_process_e2e_job() {/p' \
    "$AUTO_DEPLOY" | sed '$d'
  sed -n \
    '/^sync_backstage_catalog_if_required() {/,/^# The standard build/p' \
    "$AUTO_DEPLOY" | sed '$d'
} >"$writer_functions"
mkdir -p "$lock_fixture/bin"
cat >"$lock_fixture/bin/kubectl" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$FAKE_BACKSTAGE_KUBECTL_CALLS"
exit 0
SH
cat >"$lock_fixture/bin/curl" <<'SH'
#!/usr/bin/env bash
printf '503'
SH
chmod +x "$lock_fixture/bin/kubectl" "$lock_fixture/bin/curl"
printf '{"kind":"BackstageDeploymentRollbackPending"}\n' >"$lock_fixture/state/deployment-rollback.pending.json"
chmod 0600 "$lock_fixture/state/deployment-rollback.pending.json"
: >"$lock_fixture/kubectl.calls"
set +e
PATH="$lock_fixture/bin:$PATH" \
FAKE_BACKSTAGE_KUBECTL_CALLS="$lock_fixture/kubectl.calls" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$lock_fixture/state/deployment-rollback.pending.json" \
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_WAIT_SECONDS=1 \
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD= BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false \
ROOT_DIR="$ROOT" PLAN_TESTS=backstage:catalog-sync PLAN_BACKSTAGE_REQUIRED=false \
bash -c 'set -euo pipefail; source "$1"; sync_backstage_catalog_if_required' \
  _ "$writer_functions" >"$lock_fixture/catalog-pending.out" 2>"$lock_fixture/catalog-pending.err"
catalog_pending_status="$?"
PATH="$lock_fixture/bin:$PATH" \
FAKE_BACKSTAGE_KUBECTL_CALLS="$lock_fixture/kubectl.calls" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$lock_fixture/state/deployment-rollback.pending.json" \
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_WAIT_SECONDS=1 \
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD= BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false \
RESONANCE_BACKSTAGE_SELF_HEAL_TIMEOUT_SECONDS=1 \
RESONANCE_BACKSTAGE_SELF_HEAL_PRECHECK_ATTEMPTS=1 \
RESONANCE_BACKSTAGE_SELF_HEAL_READINESS_ATTEMPTS=1 \
RESONANCE_BACKSTAGE_SELF_HEAL_HTTP_TIMEOUT_SECONDS=1 \
RESONANCE_BACKSTAGE_SELF_HEAL_RETRY_DELAY_SECONDS=0 \
bash -c 'set -euo pipefail; source "$1"; ensure_backstage_actor_process_e2e_ready' \
  _ "$writer_functions" >"$lock_fixture/selfheal-pending.out" 2>"$lock_fixture/selfheal-pending.err"
selfheal_pending_status="$?"
set -e
[[ "$catalog_pending_status" == 79 && "$selfheal_pending_status" == 79 ]]
[[ ! -s "$lock_fixture/kubectl.calls" ]]
[[ -f "$lock_fixture/state/deployment-rollback.pending.json" ]]
grep -Fq 'pending rollback must recover first' "$lock_fixture/catalog-pending.err"
grep -Fq 'pending rollback must recover first' "$lock_fixture/selfheal-pending.err"
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
grep -Fq 'MemoryHigh=2560M' "$FULL_E2E_SERVICE"
grep -Fq 'MemoryMax=3G' "$FULL_E2E_SERVICE"
grep -Fq 'targetedRouteMode ? 4 : 16' "$E2E_SPEC"
grep -Fq 'OnCalendar=*-*-* 02:40:00 Asia/Seoul' "$FULL_E2E_TIMER"
grep -Fq 'token_pids+=("$!")' "$ROLE_E2E"
grep -Fq 'dataset_pids+=("$!")' "$ROLE_E2E"
grep -Fq 'concurrent dataset fetch failed' "$ROLE_E2E"

echo "PASS Backstage deploy reuses dependencies, performs one fast rollout, scopes E2E by impact, and serializes all supported Deployment writers pendingRawWriters=2 pendingMutation=0"
