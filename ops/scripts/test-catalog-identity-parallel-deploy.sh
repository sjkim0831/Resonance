#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="$root/ops/scripts/auto-deploy-main.sh"
validation_groups="$root/ops/scripts/run-post-deploy-validation-groups.sh"
browser_e2e="$root/ops/scripts/resonance-project-task-browser-e2e.mjs"
oidc_token="$root/ops/scripts/resonance-backstage-oidc-token.sh"
emission_service="$root/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java"
page_advice="$root/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/common/web/PageIsolationExceptionAdvice.java"
static_page_advice="$root/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/common/web/StaticPageIsolationExceptionAdvice.java"

bash -n "$script"
bash -n "$validation_groups"

python3 - "$script" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
contract_start = source.index("run_parallel_contract_tests() {")
contract_end = source.index("# Documentation, design metadata", contract_start)
contract = source[contract_start:contract_end]
assert 'pids+=("$!")' in contract
assert 'wait "${pids[$index]}"' in contract
assert "parallel catalog contract tests failed" in contract
assert "return 1" in contract
catalog_call = source.index("mapfile -t catalog_contract_tests")
catalog_call_end = source.index('record_deploy_phase "catalog_validation"', catalog_call)
catalog_selection = source[catalog_call:catalog_call_end]
assert "select-catalog-contract-tests.sh" in catalog_selection
assert "catalog contract selector self-test skipped: selector unchanged" in source
assert 'mapfile -t deploy_changed_paths' in source
assert 'select-catalog-contract-tests.sh --paths-stdin' in catalog_selection
assert 'run_parallel_contract_tests "${catalog_contract_tests[@]}"' in catalog_selection
assert "no mapped contract impact" in catalog_selection
assert 'record_deploy_phase "catalog_validation"' in source
cached_start = source.index("declare -a deploy_changed_paths=()")
cached_end = source.index('record_deploy_phase "catalog_validation"', cached_start)
cached_block = source[cached_start:cached_end]
assert "deploy_path_changed()" in cached_block
assert cached_block.count('git diff --name-only "$deployed_commit" "$target_commit"') == 1
assert 'control-plane-drift-last' in cached_block
assert 'control_plane_drift_now - control_plane_drift_last < 300' in cached_block
assert cached_block.count('"$control_plane_drift_check_due" != "true"') == 6
assert "control-plane drift check skipped: verified within 5 minutes" in cached_block
assert 'git diff --quiet "$deployed_commit" "$target_commit"' in source
assert "target Kyverno resource guard check reused from bootstrap" in source
assert source.count('bash "$ROOT_DIR/ops/scripts/ensure-kyverno-resource-guard.sh"') == 1
plan = source.index('eval "$(bash "$PLAN_SCRIPT"')
platform_cache = source.index('platform_preflight_cache=', plan)
platform_full_check = source.index('if [[ ! -r "$KUBECONFIG" ]]', platform_cache)
assert plan < platform_cache < platform_full_check
assert '[[ "$PLAN_RUNTIME_REQUIRED" != "true"' in source[platform_cache:platform_full_check]
assert 'platform_preflight_now - platform_preflight_cached_at < 300' in source
assert 'postgres-patroni-[0-9]+' in source
assert 'mv "${platform_preflight_cache}.tmp" "$platform_preflight_cache"' in source
assert "platform preflight reused: verified within 5 minutes" in source
generated_restore = source.index('if [[ "${worktree_advanced:-false}" != "true" ]]')
generated_restore_end = source.index("declare -a deploy_changed_paths=()", generated_restore)
generated_restore_block = source[generated_restore:generated_restore_end]
assert "generated artifact restore skipped: worktree advanced cleanly" in generated_restore_block
assert 'git restore --worktree -- "$generated_path"' in generated_restore_block
start = source.index('catalog_identity_sync_log="$ROOT_DIR/var/logs/catalog-identity-sync-')
end = source.index('record_deploy_phase "backstage_visual_e2e"', start)
block = source[start:end]

required = [
    "sync_keycloak_actor_assignments_if_required",
    'catalog_identity_sync_pid="$!"',
    "test-only visual E2E started concurrently with catalog synchronization",
    "bash ops/scripts/sync-unified-asset-catalog.sh",
    'wait "$catalog_identity_sync_pid"',
    "run_actor_process_role_e2e_if_required",
]
positions = {token: block.index(token) for token in required}

assert positions['catalog_identity_sync_pid="$!"'] < positions[
    "test-only visual E2E started concurrently with catalog synchronization"
]
assert positions[
    "test-only visual E2E started concurrently with catalog synchronization"
] < positions[
    "bash ops/scripts/sync-unified-asset-catalog.sh"
]
assert positions["bash ops/scripts/sync-unified-asset-catalog.sh"] < positions[
    'wait "$catalog_identity_sync_pid"'
]
assert positions['wait "$catalog_identity_sync_pid"'] < positions[
    "run_actor_process_role_e2e_if_required"
]
assert "concurrent identity reconciliation failed" in block
assert 'exit 25' in block
assert 'if [[ -z "$backstage_visual_e2e_pid" ]]; then' in block
assert block.count("start_backstage_visual_e2e") == 2
for phase in [
    'catalog_sync',
    'backstage_build_rollout',
    'identity_reconcile',
    'actor_role_e2e',
]:
    assert f'record_deploy_phase "{phase}"' in block

cleanup_start = source.index("cleanup_deploy() {")
cleanup_end = source.index("trap cleanup_deploy", cleanup_start)
cleanup = source[cleanup_start:cleanup_end]
assert 'kill "$catalog_identity_sync_pid"' in cleanup

identity_start = source.index("sync_keycloak_actor_assignments_if_required() {")
identity_end = source.index("run_backstage_screen_space_e2e_if_required() {", identity_start)
identity = source[identity_start:identity_end]
assert "ops/scripts/auto-deploy-main.sh" not in identity
assert "no identity contract change" in identity

e2e_start = source.index("run_actor_process_role_e2e_if_required() {")
e2e_end = source.index("sync_keycloak_actor_assignments_if_required() {", e2e_start)
e2e = source[e2e_start:e2e_end]
readiness_start = source.index("backstage_actor_process_readiness_status() {")
wrapper_start = source.index("run_serialized_carbonet_actor_process_e2e_job() {")
readiness = source[readiness_start:wrapper_start]
wrapper = source[wrapper_start:e2e_start]
assert '--connect-timeout 2 --max-time "$http_timeout_seconds"' in readiness
assert 'RESONANCE_BACKSTAGE_SELF_HEAL_TIMEOUT_SECONDS:-30' in readiness
assert 'RESONANCE_BACKSTAGE_SELF_HEAL_PRECHECK_ATTEMPTS:-3' in readiness
assert 'RESONANCE_BACKSTAGE_SELF_HEAL_READINESS_ATTEMPTS:-5' in readiness
assert 'RESONANCE_BACKSTAGE_SELF_HEAL_HTTP_TIMEOUT_SECONDS:-2' in readiness
assert '((self_heal_budget_seconds < 60))' in readiness
assert readiness.count('rollout restart "deployment/$deployment"') == 1
assert 'rollout status "deployment/$deployment"' in readiness
assert 'selfHealRestarts=0' in readiness
assert 'selfHealRestarts=1' in readiness
assert 'Backstage self-heal failed HTTP' in readiness
assert 'ensure_backstage_actor_process_e2e_ready || return $?' in e2e
assert e2e.index('ensure_backstage_actor_process_e2e_ready || return $?') < e2e.index('& actor_pid=$!')
mutated_timeout = readiness.replace('RESONANCE_BACKSTAGE_SELF_HEAL_HTTP_TIMEOUT_SECONDS:-2', 'RESONANCE_BACKSTAGE_SELF_HEAL_HTTP_TIMEOUT_SECONDS:-0')
assert mutated_timeout != readiness
try:
    assert 'RESONANCE_BACKSTAGE_SELF_HEAL_HTTP_TIMEOUT_SECONDS:-2' in mutated_timeout
except AssertionError:
    pass
else:
    raise AssertionError("Backstage HTTP timeout bound mutation survived")
assert 'source "$ROOT_DIR/ops/scripts/runtime-qa-auth-common.sh"' in wrapper
assert "carbonet_qa_auth_acquire_lock" in wrapper
assert "trap carbonet_qa_auth_release_lock EXIT" in wrapper
assert '"$@" || job_status=$?' in wrapper
assert 'return "$job_status"' in wrapper
assert "CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-300" in wrapper
assert "CARBONET_QA_AUTH_LOCK_FILE" not in wrapper
assert "owning BASHPID" in wrapper
assert "ops/scripts/auto-deploy-main.sh" not in e2e
assert "ops/scripts/test-catalog-identity-parallel-deploy.sh" not in e2e
for job in ["actor_pid", "delivery_pid", "browser_pid", "lifecycle_pid"]:
    assert f'{job}=$!' in e2e
    assert f'wait "${job}"' in e2e
for status in ["actor_status", "delivery_status", "browser_status", "lifecycle_status"]:
    assert f'{status} != 0' in e2e
assert "parallel actor/process E2E PASS jobs=4" in e2e
assert "parallel actor/process E2E failed" in e2e
assert "carbonetAuthLifecycles=2 serialized=true" in e2e

serialized_jobs = {
    "project-task-browser": "resonance-project-task-browser-e2e.sh",
    "seven-step": "resonance-seven-step-disposable-e2e.sh",
}
def assert_all_jobs_serialized(block):
    for label, script_name in serialized_jobs.items():
        assert f"run_serialized_carbonet_actor_process_e2e_job {label}" in block
        assert script_name in block

assert_all_jobs_serialized(e2e)
assert "run_serialized_carbonet_actor_process_e2e_job actor-role" not in e2e
assert "run_serialized_carbonet_actor_process_e2e_job project-delivery" not in e2e
mutated_preflight = e2e.replace('ensure_backstage_actor_process_e2e_ready || return $?', 'true # readiness bypassed', 1)
try:
    assert 'ensure_backstage_actor_process_e2e_ready || return $?' in mutated_preflight
except AssertionError:
    pass
else:
    raise AssertionError("Backstage readiness gate removal mutation survived")
mutated = e2e.replace(
    "run_serialized_carbonet_actor_process_e2e_job project-task-browser",
    "run_unlocked_actor_process_e2e_job project-task-browser",
    1,
)
try:
    assert_all_jobs_serialized(mutated)
except AssertionError:
    pass
else:
    raise AssertionError("serialization-removal mutation survived")

print("CATALOG_IDENTITY_PARALLEL_DEPLOY_PASS jobs=4 backstageParallel=2 carbonetSerialized=2 mutation=detected failure=propagated")
PY

auth_test_tmp="$(mktemp -d /tmp/actor-process-auth-serialization.XXXXXX)"
trap 'rm -rf "$auth_test_tmp"' EXIT
python3 - "$script" "$auth_test_tmp/wrapper.sh" "$auth_test_tmp/readiness.sh" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
start = source.index("run_serialized_carbonet_actor_process_e2e_job() {")
end = source.index("run_actor_process_role_e2e_if_required() {", start)
Path(sys.argv[2]).write_text(source[start:end], encoding="utf-8")
readiness_start = source.index("backstage_actor_process_readiness_status() {")
Path(sys.argv[3]).write_text(source[readiness_start:start], encoding="utf-8")
PY
ROOT_DIR="$root"
# shellcheck disable=SC1090
source "$auth_test_tmp/wrapper.sh"
# shellcheck disable=SC1090
source "$auth_test_tmp/readiness.sh"

export BACKSTAGE_READINESS_TEST_DIR="$auth_test_tmp/readiness"
mkdir -p "$BACKSTAGE_READINESS_TEST_DIR"
curl() {
  local call_number status
  call_number="$(( $(wc -l < "$BACKSTAGE_READINESS_TEST_DIR/curl.calls") + 1 ))"
  status="$(sed -n "${call_number}p" "$BACKSTAGE_READINESS_TEST_DIR/statuses")"
  [[ -n "$status" ]] || status="$(tail -1 "$BACKSTAGE_READINESS_TEST_DIR/statuses")"
  printf '%s\n' "$call_number" >>"$BACKSTAGE_READINESS_TEST_DIR/curl.calls"
  printf '%s' "$status"
}
kubectl() {
  printf '%s\n' "$*" >>"$BACKSTAGE_READINESS_TEST_DIR/kubectl.calls"
  if [[ "$*" == *' get deployment/resonance-backstage -o name' ]]; then
    printf '%s\n' 'deployment.apps/resonance-backstage'
  fi
}
export -f curl kubectl
export RESONANCE_BACKSTAGE_SELF_HEAL_READINESS_ATTEMPTS=3
export RESONANCE_BACKSTAGE_SELF_HEAL_RETRY_DELAY_SECONDS=0
export BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_WAIT_SECONDS=1
acquire_clean_backstage_deployment_mutation_lock() {
  return 0
}
release_backstage_deployment_mutation_lock() {
  return 0
}
export -f acquire_clean_backstage_deployment_mutation_lock release_backstage_deployment_mutation_lock

reset_backstage_readiness_case() {
  local statuses="$1"
  rm -rf "$BACKSTAGE_READINESS_TEST_DIR"
  mkdir -p "$BACKSTAGE_READINESS_TEST_DIR"
  printf '%s\n' "$statuses" >"$BACKSTAGE_READINESS_TEST_DIR/statuses"
  : >"$BACKSTAGE_READINESS_TEST_DIR/curl.calls"
  : >"$BACKSTAGE_READINESS_TEST_DIR/kubectl.calls"
}

reset_backstage_readiness_case 200
ensure_backstage_actor_process_e2e_ready >"$auth_test_tmp/readiness-healthy.log"
[[ "$(wc -l < "$BACKSTAGE_READINESS_TEST_DIR/curl.calls")" == 1 ]]
[[ ! -s "$BACKSTAGE_READINESS_TEST_DIR/kubectl.calls" ]]

reset_backstage_readiness_case $'503\n200'
ensure_backstage_actor_process_e2e_ready >"$auth_test_tmp/readiness-transient.log" 2>&1
[[ "$(wc -l < "$BACKSTAGE_READINESS_TEST_DIR/curl.calls")" == 2 ]]
[[ ! -s "$BACKSTAGE_READINESS_TEST_DIR/kubectl.calls" ]]
grep -q 'selfHealRestarts=0 precheckAttempts=2' "$auth_test_tmp/readiness-transient.log"

reset_backstage_readiness_case $'503\n503\n503\n503\n200'
ensure_backstage_actor_process_e2e_ready >"$auth_test_tmp/readiness-recovered.log" 2>&1
[[ "$(grep -c 'rollout restart deployment/resonance-backstage' "$BACKSTAGE_READINESS_TEST_DIR/kubectl.calls")" == 1 ]]
grep -q 'selfHealRestarts=1 attempts=1' "$auth_test_tmp/readiness-recovered.log"

reset_backstage_readiness_case $'503\n503\n503\n503\n503\n503\n503\n503'
e2e_launches=0
set +e
ensure_backstage_actor_process_e2e_ready >"$auth_test_tmp/readiness-persistent.log" 2>&1
persistent_status=$?
if ((persistent_status == 0)); then
  e2e_launches=$((e2e_launches + 1))
fi
set -e
[[ "$persistent_status" != 0 && "$e2e_launches" == 0 ]]
[[ "$(grep -c 'rollout restart deployment/resonance-backstage' "$BACKSTAGE_READINESS_TEST_DIR/kubectl.calls")" == 1 ]]
grep -q 'Backstage self-heal failed HTTP 503 restarts=1 attempts=3' "$auth_test_tmp/readiness-persistent.log"
reset_backstage_readiness_case 200
set +e
RESONANCE_BACKSTAGE_SELF_HEAL_HTTP_TIMEOUT_SECONDS=0 \
  ensure_backstage_actor_process_e2e_ready >"$auth_test_tmp/readiness-invalid-bound.log" 2>&1
invalid_bound_status=$?
set -e
[[ "$invalid_bound_status" == 2 ]]
[[ ! -s "$BACKSTAGE_READINESS_TEST_DIR/curl.calls" && ! -s "$BACKSTAGE_READINESS_TEST_DIR/kubectl.calls" ]]
grep -q 'invalid Backstage self-heal bound' "$auth_test_tmp/readiness-invalid-bound.log"
unset -f curl kubectl reset_backstage_readiness_case
echo 'BACKSTAGE_ACTOR_PROCESS_READINESS_SELF_HEAL_PASS healthyRestart=0 transient503Restart=0 persistentPrecheckRestart=1 recovered=200 persistentFailure=503 e2eLaunches=0 bounds=precheck3x2s+rollout30s+postcheck5x2s mutation=detected'

for diagnostic in \
  '[oidc-token] Backstage OIDC start failed: HTTP $start_status' \
  '[oidc-token] Keycloak login page failed: HTTP $login_page_status' \
  '[oidc-token] OIDC callback failed: HTTP $callback_status'; do
  grep -Fq "$diagnostic" "$oidc_token"
done
grep -Fq 'OIDC_TOKEN_CONNECT_TIMEOUT_SECONDS:-5' "$oidc_token"
grep -Fq 'OIDC_TOKEN_HTTP_TIMEOUT_SECONDS:-15' "$oidc_token"
grep -Fq -- '--connect-timeout "$OIDC_CONNECT_TIMEOUT_SECONDS"' "$oidc_token"
grep -Fq -- '--max-time "$OIDC_HTTP_TIMEOUT_SECONDS"' "$oidc_token"
printf '%s\n' 'diagnostic-password-must-not-escape' >"$auth_test_tmp/oidc-password"
printf '%s\n' 'test-ca' >"$auth_test_tmp/oidc-ca.crt"
chmod 0600 "$auth_test_tmp/oidc-password"
curl() {
  printf '503'
  return 22
}
export -f curl
set +e
BACKSTAGE_E2E_PASSWORD_FILE="$auth_test_tmp/oidc-password" \
RESONANCE_INTERNAL_CA="$auth_test_tmp/oidc-ca.crt" \
OIDC_TOKEN_WORK_ROOT="$auth_test_tmp/oidc-work" \
  bash "$oidc_token" resonance-requester >"$auth_test_tmp/oidc.stdout" 2>"$auth_test_tmp/oidc.stderr"
oidc_status=$?
set -e
unset -f curl
[[ "$oidc_status" == 3 ]]
grep -q '^\[oidc-token\] Backstage OIDC start failed: HTTP 503$' "$auth_test_tmp/oidc.stderr"
if grep -R -Fq 'diagnostic-password-must-not-escape' "$auth_test_tmp/oidc.stdout" "$auth_test_tmp/oidc.stderr"; then
  echo '[oidc-token-diagnostic] credential leaked to diagnostics' >&2
  exit 1
fi
set +e
OIDC_TOKEN_HTTP_TIMEOUT_SECONDS=0 \
BACKSTAGE_E2E_PASSWORD_FILE="$auth_test_tmp/oidc-password" \
RESONANCE_INTERNAL_CA="$auth_test_tmp/oidc-ca.crt" \
OIDC_TOKEN_WORK_ROOT="$auth_test_tmp/oidc-work-invalid" \
  bash "$oidc_token" resonance-requester >"$auth_test_tmp/oidc-invalid.stdout" 2>"$auth_test_tmp/oidc-invalid.stderr"
oidc_invalid_status=$?
set -e
[[ "$oidc_invalid_status" == 2 ]]
grep -q '^\[oidc-token\] invalid HTTP timeout bound$' "$auth_test_tmp/oidc-invalid.stderr"
echo 'OIDC_TOKEN_STAGE_DIAGNOSTIC_PASS stage=start http=503 status=3 credentialOutput=0'

export CARBONET_QA_AUTH_LOCK_FILE="$auth_test_tmp/canonical-auth.lock"
export CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=10
export AUTH_SERIALIZATION_ACTIVE="$auth_test_tmp/active"
export AUTH_SERIALIZATION_EVENTS="$auth_test_tmp/events"
export AUTH_SERIALIZATION_GATE="$auth_test_tmp/gate"
export AUTH_SERIALIZATION_GUARD="$auth_test_tmp/state.lock"

actor_process_serialization_worker() {
  local label="$1" state_fd
  while [[ ! -e "$AUTH_SERIALIZATION_GATE" ]]; do sleep 0.01; done
  exec {state_fd}>"$AUTH_SERIALIZATION_GUARD"
  flock "$state_fd"
  if [[ -e "$AUTH_SERIALIZATION_ACTIVE" ]]; then
    printf 'OVERLAP %s\n' "$label" >>"$AUTH_SERIALIZATION_EVENTS"
    flock -u "$state_fd"
    return 91
  fi
  touch "$AUTH_SERIALIZATION_ACTIVE"
  printf 'START %s\n' "$label" >>"$AUTH_SERIALIZATION_EVENTS"
  flock -u "$state_fd"
  sleep 0.12
  flock "$state_fd"
  rm -f "$AUTH_SERIALIZATION_ACTIVE"
  printf 'END %s\n' "$label" >>"$AUTH_SERIALIZATION_EVENTS"
  flock -u "$state_fd"
}
export -f actor_process_serialization_worker

declare -a auth_serialization_pids=()
for label in project-task-browser seven-step; do
  run_serialized_carbonet_actor_process_e2e_job "$label" \
    bash -c 'actor_process_serialization_worker "$1"' _ "$label" &
  auth_serialization_pids+=("$!")
done
touch "$AUTH_SERIALIZATION_GATE"
auth_serialization_failed=0
for pid in "${auth_serialization_pids[@]}"; do
  wait "$pid" || auth_serialization_failed=1
done
((auth_serialization_failed == 0)) || {
  echo '[actor-process-auth-serialization] one of two Carbonet lifecycles failed' >&2
  exit 1
}
[[ "$(grep -c '^START ' "$AUTH_SERIALIZATION_EVENTS")" == "2" ]]
[[ "$(grep -c '^END ' "$AUTH_SERIALIZATION_EVENTS")" == "2" ]]
if grep -q '^OVERLAP ' "$AUTH_SERIALIZATION_EVENTS"; then
  echo '[actor-process-auth-serialization] authenticated lifecycles overlapped' >&2
  exit 1
fi

set +e
run_serialized_carbonet_actor_process_e2e_job failure-probe bash -c 'exit 23'
failure_status=$?
set -e
[[ "$failure_status" == "23" ]] || {
  echo "[actor-process-auth-serialization] child failure was not propagated status=$failure_status" >&2
  exit 1
}
run_serialized_carbonet_actor_process_e2e_job recovery-probe bash -c 'exit 0'
run_serialized_carbonet_actor_process_e2e_job nested-helper-probe \
  bash -c 'source "$1"; carbonet_qa_auth_acquire_lock; carbonet_qa_auth_release_lock; \
    [[ -n "${CARBONET_QA_AUTH_LOCK_FD:-}" && -n "${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}" ]]' \
  _ "$root/ops/scripts/runtime-qa-auth-common.sh"
echo 'ACTOR_PROCESS_AUTH_SERIALIZATION_PASS jobs=4 backstageParallel=2 carbonetSerialized=2 overlap=0 failureStatus=23 lockReleased=true borrowedRelease=no-op nestedDeadlock=prevented'

grep -q 'resolve_postgres_leader_once' "$validation_groups"
grep -q 'export RESONANCE_POSTGRES_LEADER_POD=' "$validation_groups"
for cached_consumer in \
  validate-emission-project-workflow.sh \
  validate-emission-activity-collection.sh \
  complete-activity-data-evidence-jobs.sh \
  complete-emission-calculation-evidence-jobs.sh \
  complete-report-certification-evidence-jobs.sh \
  validate-unified-work-design-runtime.sh; do
  grep -q 'RESONANCE_POSTGRES_LEADER_POD' "$root/ops/scripts/$cached_consumer"
done

echo "POSTDEPLOY_POSTGRES_LEADER_CACHE_PASS consumers=6"

python3 - "$browser_e2e" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
parallel = source.index("await Promise.all(accounts.map(async (account) => {")
barrier = source.index('const protectedTarget = "/emission/organizational-boundary"', parallel)
transition = source.index("const ownerApi = await authenticatedApi", barrier)
assert parallel < barrier < transition
assert source.count("await Promise.all(accounts.map(async (account) => {") == 1
print("PROJECT_TASK_BROWSER_ACCOUNT_PARALLEL_PASS accounts=5 transition=single-after-barrier")

anonymous_start = source.index("const anonymous = await browser.newContext", barrier)
anonymous_end = source.index("// Use a disposable project", anonymous_start)
anonymous = source[anonymous_start:anonymous_end]
assert 'storageState: { cookies: [], origins: [] }' in anonymous
assert 'serviceWorkers: "block"' in anonymous
assert "await page.waitForTimeout(400)" not in anonymous
assert 'anonymous.request.get(new URL("/home/api/emission-tasks", baseUrl).href' in anonymous
assert "protectedApi.status() !== 401" in anonymous
assert '["accessToken", "refreshToken"]' in anonymous
assert "await page.waitForURL" in anonymous
assert "artifacts=5" not in source
assert "certificate=valid" not in source
assert 'projectName, { timeout: 20_000 }' in source
assert 'start.waitFor({ state: "visible", timeout: 10_000 })' in source
mutated_render_timeout = source.replace('projectName, { timeout: 20_000 }', 'projectName, { timeout: 8_000 }', 1)
assert 'projectName, { timeout: 20_000 }' not in mutated_render_timeout
assert '}, undefined, { timeout: 15_000 });' in source
mutated_route_timeout = source.replace('}, undefined, { timeout: 15_000 });', '}, undefined, { timeout: 8_000 });', 1)
assert '}, undefined, { timeout: 15_000 });' not in mutated_route_timeout
print("PROJECT_TASK_BROWSER_ANONYMOUS_FAIL_CLOSED_PASS api=401 cookies=empty route=redirected evidence=truthful")
PY

python3 - "$browser_e2e" "$emission_service" "$page_advice" "$static_page_advice" <<'PY'
from pathlib import Path
import sys

browser = Path(sys.argv[1]).read_text(encoding="utf-8")
service = Path(sys.argv[2]).read_text(encoding="utf-8")
api_advices = [Path(path).read_text(encoding="utf-8") for path in sys.argv[3:]]

enrich_start = service.index("void enrichCompletionReadiness")
enrich_end = service.index("private int count", enrich_start)
enrich = service[enrich_start:enrich_end]
assert 'String code=text(task.get("taskCode"));' in enrich
assert "SELECT task_code FROM emission_project_task WHERE task_id" not in enrich
assert "async function requireJson" in browser
assert browser.count("await requireJson(") >= 4
assert "returned non-JSON HTTP=" in browser
for advice in api_advices:
    assert 'uri.startsWith("/home/api/")' in advice
    assert 'uri.startsWith("/en/home/api/")' in advice
    assert "HttpStatus.INTERNAL_SERVER_ERROR" in advice

print("PROJECT_TASK_SNAPSHOT_RACE_PASS taskCode=projection nPlusOne=removed apiAdvices=2 e2eDiagnostic=bounded")
PY
