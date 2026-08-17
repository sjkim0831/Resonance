#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
DEPLOY="$ROOT/ops/scripts/resonance-backstage-deploy.sh"

bash -n "$DEPLOY"
python3 - "$DEPLOY" <<'PY'
import pathlib
import sys

source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
if 'BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR:-/opt/resonance-data/control-plane/deploy-state/backstage' not in source:
    raise SystemExit("official and direct deploys do not share the canonical default state directory")
recover_mode = source.index('mode="${1:-deploy}"')
recover_branch = source.index('if [[ "$mode" == "recover-pending" ]]', recover_mode)
full_prerequisites = source.index("for command in git node corepack docker", recover_branch)
docker_probe = source.index("docker buildx version", full_prerequisites)
if not recover_mode < recover_branch < full_prerequisites < docker_probe:
    raise SystemExit("recover-pending does not precede full deployment prerequisites")
recover_end = source.index("\nfi\n\nphase_started_at", recover_branch)
recover_source = source[recover_branch:recover_end]
for token in (
    "for command in dirname id mkdir readlink stat flock",
    "acquire_backstage_deployment_lock || exit 79",
    "if backstage_pending_state_exists",
    "for command in kubectl jq sha256sum awk date sleep rm sync",
    "resume_pending_backstage_deployment_rollback || exit 79",
    "BACKSTAGE_PENDING_RECOVERY_PASS pending=0 recovered=0 mutation=0",
):
    if token not in recover_source:
        raise SystemExit(f"recover-pending minimal contract missing: {token}")
for forbidden in (
    "initialize_backstage_build_workspace",
    "ensure_auth_secret",
    "ensure_runtime_purge_recovery_secret",
    "docker build",
    "corepack yarn",
    "kubectl apply",
    "kubectl create",
):
    if forbidden in recover_source:
        raise SystemExit(f"recover-pending contains forbidden mutation path: {forbidden}")
deploy_branch = source.index("  deploy)")
acquire = source.index("acquire_backstage_deployment_lock || exit 79", deploy_branch)
resume = source.index("resume_pending_backstage_deployment_rollback || exit 79", acquire)
build_workspace = source.index("initialize_backstage_build_workspace", resume)
preflight = source.index("start_phase preflight", resume)
capture = source.index("capture_backstage_deployment_baseline || exit 79")
first_deployment_mutation = source.index('kubectl apply -f "$MANIFEST"', capture)
finalize = source.index("finalize_successful_backstage_deployment || exit 79")
deployment_pass = source.index('echo "[backstage] PASS deployed', finalize)
if not deploy_branch < acquire < resume < build_workspace < preflight < capture < first_deployment_mutation < finalize < deployment_pass:
    raise SystemExit("Backstage rollback ordering is not fail-closed")
prefix = source[deploy_branch:acquire]
for forbidden in ("resume_pending_", "initialize_backstage_", "kubectl ", "docker "):
    if forbidden in prefix:
        raise SystemExit(f"deploy performs work before state-directory lock: {forbidden}")

lock_start = source.index("acquire_backstage_deployment_lock() {")
lock_end = source.index("\nbackstage_pending_state_exists() {", lock_start)
lock_source = source[lock_start:lock_end]
for token in (
    'prepare_backstage_rollback_state_directory || return 79',
    'exec {lock_fd}<"$state_dir"',
    'stat -Lc',
    'shell_pid="$BASHPID"',
    '"/proc/$shell_pid/fd/$lock_fd"',
    'flock -n "$lock_fd"',
    'BACKSTAGE_DEPLOYMENT_LOCK_HELD=true',
):
    if token not in lock_source:
        raise SystemExit(f"directory FD lock contract missing: {token}")
if "mktemp" in lock_source or ".lock" in lock_source:
    raise SystemExit("deployment serialization must not create a separate lock file")

required = (
    "BackstageDeploymentRollbackPending",
    "integritySha256",
    "stat -c '%a:%u:%h'",
    '[[ -f "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" &&',
    '! -L "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE"',
    "pending state schema is invalid",
    "pending state integrity check failed",
    '{op:"test", path:"/metadata/uid", value:$uid}',
    '{op:"test", path:"/metadata/resourceVersion", value:$resourceVersion}',
    '{op:"test", path:"/spec", value:$currentSpec}',
    '{op:"replace", path:"/spec", value:$baselineSpec}',
    ".status.updatedReplicas // 0",
    ".status.readyReplicas // 0",
    ".status.availableReplicas // 0",
    ".status.unavailableReplicas // 0",
    "final_status=79",
)
for token in required:
    if token not in source:
        raise SystemExit(f"Backstage rollback contract missing: {token}")
PY

fixture="$(mktemp -d)"
cleanup_fixture() {
  local status="$?" pid_file
  trap - EXIT
  if [[ -n "${holder_pid:-}" ]]; then
    kill "$holder_pid" >/dev/null 2>&1 || true
  fi
  for pid_file in "$fixture/holder-child.pid" "$fixture/recover-holder-child.pid"; do
    if [[ -f "$pid_file" ]]; then
      kill "$(cat "$pid_file")" >/dev/null 2>&1 || true
    fi
  done
  rm -rf -- "$fixture" || true
  exit "$status"
}
trap cleanup_fixture EXIT
mkdir -m 0700 "$fixture/state" "$fixture/bin"
functions="$fixture/rollback-functions.sh"
handler="$fixture/exit-handler.sh"
sed -n '/^BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR=/,/^deployment_exit_handler() {/p' "$DEPLOY" |
  sed '$d' >"$functions"
sed -n '/^deployment_exit_handler() {/,/^}$/p' "$DEPLOY" >"$handler"
[[ -s "$functions" && -s "$handler" ]]

baseline="$fixture/baseline.json"
candidate="$fixture/candidate.json"
current="$fixture/current.json"
pending="$fixture/state/deployment-rollback.pending.json"
calls="$fixture/kubectl.calls"
mutations="$fixture/patch-mutations"
secret_value='fixture-secret-value-must-never-appear'

cat >"$baseline" <<'JSON'
{"apiVersion":"apps/v1","kind":"Deployment","metadata":{"namespace":"resonance-ops","name":"resonance-backstage","uid":"11111111-1111-4111-8111-111111111111","resourceVersion":"10","generation":4},"spec":{"replicas":1,"selector":{"matchLabels":{"app.kubernetes.io/name":"resonance-backstage"}},"template":{"metadata":{"labels":{"app.kubernetes.io/name":"resonance-backstage","release":"baseline"}},"spec":{"containers":[{"name":"backstage","image":"registry.local/resonance-backstage:baseline","env":[{"name":"POSTGRES_PASSWORD","valueFrom":{"secretKeyRef":{"name":"resonance-backstage-database","key":"POSTGRES_PASSWORD"}}}]}]}}},"status":{"observedGeneration":4,"updatedReplicas":1,"readyReplicas":1,"availableReplicas":1,"unavailableReplicas":0}}
JSON
cat >"$candidate" <<'JSON'
{"apiVersion":"apps/v1","kind":"Deployment","metadata":{"namespace":"resonance-ops","name":"resonance-backstage","uid":"11111111-1111-4111-8111-111111111111","resourceVersion":"11","generation":5},"spec":{"replicas":1,"selector":{"matchLabels":{"app.kubernetes.io/name":"resonance-backstage"}},"template":{"metadata":{"labels":{"app.kubernetes.io/name":"resonance-backstage","release":"candidate"}},"spec":{"containers":[{"name":"backstage","image":"registry.local/resonance-backstage:candidate","env":[{"name":"POSTGRES_PASSWORD","valueFrom":{"secretKeyRef":{"name":"resonance-backstage-database","key":"POSTGRES_PASSWORD"}}}]}]}}},"status":{"observedGeneration":5,"updatedReplicas":1,"readyReplicas":1,"availableReplicas":1,"unavailableReplicas":0}}
JSON

cat >"$fixture/bin/kubectl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$FAKE_KUBECTL_CALLS"
case "$*" in
  "-n resonance-ops get deployment resonance-backstage -o json")
    cat "$FAKE_DEPLOYMENT_STATE"
    ;;
  "-n resonance-ops patch deployment resonance-backstage --type=json --patch-file=/dev/stdin")
    patch_json="$(cat)"
    current_json="$(cat "$FAKE_DEPLOYMENT_STATE")"
    if [[ "${FAKE_CAS_DRIFT_ON_PATCH:-false}" == true ]]; then
      drift_tmp="$FAKE_DEPLOYMENT_STATE.drift.$$"
      jq -c '
        .metadata.resourceVersion = "99" |
        .metadata.generation = (.metadata.generation + 1) |
        .spec.template.metadata.annotations.externalDrift = "true"
      ' <<<"$current_json" >"$drift_tmp"
      mv -f -- "$drift_tmp" "$FAKE_DEPLOYMENT_STATE"
      current_json="$(cat "$FAKE_DEPLOYMENT_STATE")"
    fi
    if ! jq -e --argjson patch "$patch_json" '
        ($patch | length) == 4 and
        $patch[0].op == "test" and $patch[0].path == "/metadata/uid" and
        $patch[1].op == "test" and $patch[1].path == "/metadata/resourceVersion" and
        $patch[2].op == "test" and $patch[2].path == "/spec" and
        $patch[3].op == "replace" and $patch[3].path == "/spec" and
        .metadata.uid == $patch[0].value and
        .metadata.resourceVersion == $patch[1].value and
        .spec == $patch[2].value
      ' <<<"$current_json" >/dev/null; then
      echo 'fixture JSON-Patch test conflict' >&2
      exit 1
    fi
    replacement_spec="$(jq -c '.[3].value' <<<"$patch_json")"
    patched_tmp="$FAKE_DEPLOYMENT_STATE.patched.$$"
    jq -c --argjson replacement "$replacement_spec" '
      .spec = $replacement |
      .metadata.resourceVersion = ((.metadata.resourceVersion | tonumber) + 1 | tostring) |
      .metadata.generation = (.metadata.generation + 1) |
      (.spec.replicas // 1) as $desired |
      .status = {
        observedGeneration: .metadata.generation,
        updatedReplicas: $desired,
        readyReplicas: $desired,
        availableReplicas: $desired,
        unavailableReplicas: 0
      }
    ' <<<"$current_json" >"$patched_tmp"
    mv -f -- "$patched_tmp" "$FAKE_DEPLOYMENT_STATE"
    count="$(cat "$FAKE_PATCH_MUTATIONS")"
    printf '%s\n' "$((count + 1))" >"$FAKE_PATCH_MUTATIONS"
    ;;
  "-n resonance-ops rollout status deployment/resonance-backstage --timeout=2s")
    ;;
  *)
    printf 'unexpected fake kubectl call: %s\n' "$*" >&2
    exit 91
    ;;
esac
SH
chmod 0755 "$fixture/bin/kubectl"

cat >"$fixture/bin/forbidden-full-prerequisite" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$(basename "$0")" >>"$FAKE_FORBIDDEN_COMMANDS"
exit 98
SH
chmod 0755 "$fixture/bin/forbidden-full-prerequisite"
for command in node docker corepack git openssl curl; do
  ln -s forbidden-full-prerequisite "$fixture/bin/$command"
done

export PATH="$fixture/bin:$PATH"
export FAKE_DEPLOYMENT_STATE="$current"
export FAKE_KUBECTL_CALLS="$calls"
export FAKE_PATCH_MUTATIONS="$mutations"
export FAKE_FORBIDDEN_COMMANDS="$fixture/forbidden-commands"
export BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$fixture/state"
export BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$pending"
export BACKSTAGE_DEPLOYMENT_ROLLBACK_TIMEOUT_SECONDS=2
export BACKSTAGE_DEPLOYMENT_ROLLBACK_POLL_SECONDS=0.05
export FIXTURE_SECRET_VALUE="$secret_value"

reset_fixture() {
  rm -rf -- "$fixture/state"
  mkdir -m 0700 "$fixture/state"
  cp -- "$baseline" "$current"
  : >"$calls"
  printf '0\n' >"$mutations"
  unset FAKE_CAS_DRIFT_ON_PATCH
}

assert_baseline_restored() {
  local expected_pending="${1:-$pending}"
  jq -e --slurpfile baseline "$baseline" '
    .metadata.uid == $baseline[0].metadata.uid and
    .spec == $baseline[0].spec and
    ((.spec.replicas // 1) as $desired |
      .status.updatedReplicas == $desired and
      .status.readyReplicas == $desired and
      .status.availableReplicas == $desired and
      .status.unavailableReplicas == 0)
  ' "$current" >/dev/null
  [[ ! -e "$expected_pending" && ! -L "$expected_pending" ]]
}

# 1. A normal nonzero exit restores the exact spec and preserves status 37.
reset_fixture
set +e
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  source "$2"
  cleanup_build_tmp() { :; }
  trap deployment_exit_handler EXIT
  capture_backstage_deployment_baseline
  cp -- "$3" "$FAKE_DEPLOYMENT_STATE"
  exit 37
' _ "$functions" "$handler" "$candidate" >"$fixture/failure.out" 2>"$fixture/failure.err"
status=$?
set -e
[[ "$status" == 37 ]]
assert_baseline_restored
[[ "$(cat "$mutations")" == 1 ]]
grep -Fq 'deployment rollback verified and pending state cleared' "$fixture/failure.out"

# 2. SIGKILL leaves an atomic mode-0600 pending snapshot; the next deploy
# resumes it before doing any other work and removes it only after proof.
reset_fixture
set +e
{
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    capture_backstage_deployment_baseline
    cp -- "$2" "$FAKE_DEPLOYMENT_STATE"
    kill -KILL $$
  ' _ "$functions" "$candidate" >"$fixture/sigkill.out" 2>"$fixture/sigkill.err"
  status=$?
} 2>>"$fixture/sigkill.err"
set -e
[[ "$status" == 137 ]]
[[ "$(stat -c '%a:%u:%h' "$pending")" == "600:$(id -u):1" ]]
jq -e --slurpfile baseline "$baseline" '
  .baseline.uid == $baseline[0].metadata.uid and
  .baseline.resourceVersion == $baseline[0].metadata.resourceVersion and
  .baseline.spec == $baseline[0].spec
' "$pending" >/dev/null
[[ "$(find "$fixture/state" -maxdepth 1 -name '.deployment-rollback.pending.*' | wc -l)" == 0 ]]
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  resume_pending_backstage_deployment_rollback
' _ "$functions" >"$fixture/resume.out" 2>"$fixture/resume.err"
assert_baseline_restored
[[ "$(cat "$mutations")" == 1 ]]
grep -Fq 'pending Deployment rollback recovery PASS' "$fixture/resume.out"

# 3. A resourceVersion drift between fresh GET and PATCH makes the JSON-Patch
# tests fail. The rollback performs zero Deployment mutations and returns 79.
reset_fixture
set +e
FAKE_CAS_DRIFT_ON_PATCH=true bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  source "$2"
  cleanup_build_tmp() { :; }
  trap deployment_exit_handler EXIT
  capture_backstage_deployment_baseline
  cp -- "$3" "$FAKE_DEPLOYMENT_STATE"
  exit 23
' _ "$functions" "$handler" "$candidate" >"$fixture/cas.out" 2>"$fixture/cas.err"
status=$?
set -e
[[ "$status" == 79 ]]
[[ "$(cat "$mutations")" == 0 ]]
[[ -f "$pending" ]]
jq -e '.metadata.resourceVersion == "99" and .spec.template.metadata.annotations.externalDrift == "true"' \
  "$current" >/dev/null
grep -Fq 'JSON-Patch CAS failed' "$fixture/cas.err"

# 4. A successful, fully ready candidate clears pending without rollback.
reset_fixture
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  capture_backstage_deployment_baseline
  cp -- "$2" "$FAKE_DEPLOYMENT_STATE"
  finalize_successful_backstage_deployment
' _ "$functions" "$candidate" >"$fixture/success.out" 2>"$fixture/success.err"
[[ ! -e "$pending" && ! -L "$pending" ]]
[[ "$(cat "$mutations")" == 0 ]]
jq -e '.spec.template.metadata.labels.release == "candidate"' "$current" >/dev/null
grep -Fq 'deployment rollback state finalized pending=0' "$fixture/success.out"

create_pending_state() {
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    capture_backstage_deployment_baseline >/dev/null
  ' _ "$functions"
}

expect_security_failure() {
  local label="$1" status
  set +e
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    resume_pending_backstage_deployment_rollback
  ' _ "$functions" >"$fixture/$label.out" 2>"$fixture/$label.err"
  status=$?
  set -e
  [[ "$status" == 79 ]]
  [[ "$(cat "$mutations")" == 0 ]]
}

# 5-8. Symlink, mode, schema and integrity tampering all fail closed before a
# kubectl patch. Owner and hard-link checks share the same numeric stat gate.
reset_fixture
create_pending_state
mv -- "$pending" "$pending.target"
ln -s "$(basename "$pending.target")" "$pending"
expect_security_failure symlink

reset_fixture
create_pending_state
chmod 0644 "$pending"
expect_security_failure mode

reset_fixture
create_pending_state
schema_payload="$(jq -cS 'del(.integritySha256) | .unexpected = true' "$pending")"
schema_integrity="$(printf '%s' "$schema_payload" | sha256sum | awk '{print $1}')"
jq -cS --arg integrity "$schema_integrity" '. + {integritySha256:$integrity}' \
  <<<"$schema_payload" >"$pending.rewrite"
chmod 0600 "$pending.rewrite"
mv -f -- "$pending.rewrite" "$pending"
expect_security_failure schema

reset_fixture
create_pending_state
jq -cS '.baseline.spec.replicas = 9' "$pending" >"$pending.rewrite"
chmod 0600 "$pending.rewrite"
mv -f -- "$pending.rewrite" "$pending"
expect_security_failure tamper

# 9. Official and direct invocations derive the same pending path from the one
# default state directory. The contender fails immediately with status 79,
# performs no kubectl mutation, and cannot alter the holder's pending bytes.
rm -rf -- "$fixture/state"
shared_state="$fixture/shared-default-state"
shared_pending="$shared_state/deployment-rollback.pending.json"
official_path="$fixture/official.path"
direct_path="$fixture/direct.path"
holder_ready="$fixture/holder.ready"
holder_release="$fixture/holder.release"
rm -rf -- "$shared_state"
mkdir -m 0700 "$shared_state"
cp -- "$baseline" "$current"
: >"$calls"
printf '0\n' >"$mutations"
env -u BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE \
  BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$shared_state" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    capture_backstage_deployment_baseline >/dev/null
  ' _ "$functions"
pending_hash_before="$(sha256sum "$shared_pending" | awk '{print $1}')"
calls_before="$(wc -l <"$calls")"
env -u BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE \
  BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$shared_state" \
  OFFICIAL_PATH="$official_path" HOLDER_READY="$holder_ready" HOLDER_RELEASE="$holder_release" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    printf "%s\n" "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" >"$OFFICIAL_PATH"
    acquire_backstage_deployment_lock
    : >"$HOLDER_READY"
    while [[ ! -e "$HOLDER_RELEASE" ]]; do sleep 0.05; done
  ' _ "$functions" >"$fixture/official-holder.out" 2>"$fixture/official-holder.err" &
holder_pid="$!"
for _ in $(seq 1 100); do
  [[ -e "$holder_ready" ]] && break
  sleep 0.02
done
[[ -e "$holder_ready" ]]
set +e
env -u BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE \
  BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$shared_state" DIRECT_PATH="$direct_path" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    printf "%s\n" "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" >"$DIRECT_PATH"
    acquire_backstage_deployment_lock
  ' _ "$functions" >"$fixture/direct-contender.out" 2>"$fixture/direct-contender.err"
status=$?
set -e
[[ "$status" == 79 ]]
[[ "$(cat "$official_path")" == "$shared_pending" ]]
[[ "$(cat "$direct_path")" == "$shared_pending" ]]
[[ "$(sha256sum "$shared_pending" | awk '{print $1}')" == "$pending_hash_before" ]]
[[ "$(wc -l <"$calls")" == "$calls_before" ]]
[[ "$(cat "$mutations")" == 0 ]]
[[ "$(find "$shared_state" -mindepth 1 -maxdepth 1 -type f -printf '%f\n')" == "deployment-rollback.pending.json" ]]
grep -Fq 'another Backstage deploy holds the state-directory lock' "$fixture/direct-contender.err"
: >"$holder_release"
wait "$holder_pid"
holder_pid=""

# 10. The production service uses control-group termination. SIGKILL both the
# holder and its recorded build child so every inherited directory FD closes;
# the next contender then acquires, resumes, and proves the exact baseline.
rm -f -- "$holder_ready" "$holder_release"
rm -rf -- "$shared_state"
mkdir -m 0700 "$shared_state"
cp -- "$baseline" "$current"
: >"$calls"
printf '0\n' >"$mutations"
env -u BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE \
  BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$shared_state" HOLDER_READY="$holder_ready" \
  HOLDER_CHILD_PID="$fixture/holder-child.pid" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    acquire_backstage_deployment_lock
    capture_backstage_deployment_baseline >/dev/null
    cp -- "$2" "$FAKE_DEPLOYMENT_STATE"
    sleep 300 &
    child_pid="$!"
    printf "%s\n" "$child_pid" >"$HOLDER_CHILD_PID"
    : >"$HOLDER_READY"
    wait "$child_pid"
  ' _ "$functions" "$candidate" >"$fixture/killed-holder.out" 2>"$fixture/killed-holder.err" &
holder_pid="$!"
for _ in $(seq 1 100); do
  [[ -e "$holder_ready" ]] && break
  sleep 0.02
done
[[ -e "$holder_ready" && -f "$shared_pending" ]]
holder_child_pid="$(cat "$fixture/holder-child.pid")"
kill -KILL "$holder_pid" "$holder_child_pid"
set +e
{
  wait "$holder_pid"
  status=$?
} 2>>"$fixture/killed-holder.err"
holder_pid=""
set -e
[[ "$status" == 137 ]]
for _ in $(seq 1 100); do
  ! kill -0 "$holder_child_pid" 2>/dev/null && break
  sleep 0.02
done
! kill -0 "$holder_child_pid" 2>/dev/null
rm -f -- "$fixture/holder-child.pid"
env -u BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE \
  BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$shared_state" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    acquire_backstage_deployment_lock
    resume_pending_backstage_deployment_rollback
  ' _ "$functions" >"$fixture/post-kill-contender.out" 2>"$fixture/post-kill-contender.err"
[[ ! -e "$shared_pending" && ! -L "$shared_pending" ]]
[[ "$(cat "$mutations")" == 1 ]]
assert_baseline_restored "$shared_pending"
grep -Fq 'exclusive state-directory deploy lock acquired' "$fixture/post-kill-contender.out"
grep -Fq 'pending Deployment rollback recovery PASS' "$fixture/post-kill-contender.out"

reset_recover_fixture() {
  rm -rf -- "$recover_state"
  mkdir -m 0700 "$recover_state"
  cp -- "$baseline" "$current"
  : >"$calls"
  : >"$FAKE_FORBIDDEN_COMMANDS"
  printf '0\n' >"$mutations"
  unset FAKE_CAS_DRIFT_ON_PATCH
}

recover_state="$fixture/recover-state"
recover_pending="$recover_state/deployment-rollback.pending.json"

# 11. The lightweight mode sees a durable pending candidate, acquires the same
# directory lock, restores and proves the baseline, then clears the state.
reset_recover_fixture
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  capture_backstage_deployment_baseline >/dev/null
' _ "$functions"
cp -- "$candidate" "$current"
: >"$calls"
printf '0\n' >"$mutations"
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
RESONANCE_ROOT="$ROOT" \
bash "$DEPLOY" recover-pending >"$fixture/recover-present.out" 2>"$fixture/recover-present.err"
assert_baseline_restored "$recover_pending"
[[ "$(cat "$mutations")" == 1 ]]
[[ ! -s "$FAKE_FORBIDDEN_COMMANDS" ]]
grep -Fq 'BACKSTAGE_PENDING_RECOVERY_PASS pending=1 recovered=1 mutation=rollback-only' \
  "$fixture/recover-present.out"

# 12. With no pending state the mode is idempotent: two executions perform no
# Kubernetes call, no full prerequisite probe, and no filesystem residue.
reset_recover_fixture
for attempt in 1 2; do
  BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
  BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
  RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" recover-pending >>"$fixture/recover-absent.out" \
    2>>"$fixture/recover-absent.err"
done
[[ ! -e "$recover_pending" && ! -L "$recover_pending" ]]
[[ ! -s "$calls" ]]
[[ "$(cat "$mutations")" == 0 ]]
[[ ! -s "$FAKE_FORBIDDEN_COMMANDS" ]]
[[ "$(grep -Fc 'BACKSTAGE_PENDING_RECOVERY_PASS pending=0 recovered=0 mutation=0' \
  "$fixture/recover-absent.out")" == 2 ]]

# 13. A holder prevents recover-pending from even reading Kubernetes. The
# contender exits 79 while the pending hash and mutation counters remain exact.
reset_recover_fixture
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  capture_backstage_deployment_baseline >/dev/null
' _ "$functions"
recover_hash_before="$(sha256sum "$recover_pending" | awk '{print $1}')"
: >"$calls"
printf '0\n' >"$mutations"
recover_holder_ready="$fixture/recover-holder.ready"
recover_holder_release="$fixture/recover-holder.release"
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
HOLDER_READY="$recover_holder_ready" HOLDER_RELEASE="$recover_holder_release" \
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  acquire_backstage_deployment_lock
  : >"$HOLDER_READY"
  while [[ ! -e "$HOLDER_RELEASE" ]]; do sleep 0.05; done
' _ "$functions" >"$fixture/recover-lock-holder.out" 2>"$fixture/recover-lock-holder.err" &
holder_pid="$!"
for _ in $(seq 1 100); do
  [[ -e "$recover_holder_ready" ]] && break
  sleep 0.02
done
[[ -e "$recover_holder_ready" ]]
set +e
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
RESONANCE_ROOT="$ROOT" \
bash "$DEPLOY" recover-pending >"$fixture/recover-lock-contender.out" \
  2>"$fixture/recover-lock-contender.err"
status="$?"
set -e
[[ "$status" == 79 ]]
[[ "$(sha256sum "$recover_pending" | awk '{print $1}')" == "$recover_hash_before" ]]
[[ ! -s "$calls" ]]
[[ "$(cat "$mutations")" == 0 ]]
[[ ! -s "$FAKE_FORBIDDEN_COMMANDS" ]]
: >"$recover_holder_release"
wait "$holder_pid"
holder_pid=""

# 14. A control-group SIGKILL leaves the authenticated pending bytes intact.
# After every inherited lock FD closes, recover-pending acquires and resumes it.
rm -f -- "$recover_holder_ready" "$recover_holder_release"
reset_recover_fixture
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
HOLDER_READY="$recover_holder_ready" HOLDER_CHILD_PID="$fixture/recover-holder-child.pid" \
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  acquire_backstage_deployment_lock
  capture_backstage_deployment_baseline >/dev/null
  cp -- "$2" "$FAKE_DEPLOYMENT_STATE"
  sleep 300 &
  child_pid="$!"
  printf "%s\n" "$child_pid" >"$HOLDER_CHILD_PID"
  : >"$HOLDER_READY"
  wait "$child_pid"
' _ "$functions" "$candidate" >"$fixture/recover-killed-holder.out" \
  2>"$fixture/recover-killed-holder.err" &
holder_pid="$!"
for _ in $(seq 1 100); do
  [[ -e "$recover_holder_ready" ]] && break
  sleep 0.02
done
[[ -e "$recover_holder_ready" && -f "$recover_pending" ]]
recover_hash_before="$(sha256sum "$recover_pending" | awk '{print $1}')"
: >"$calls"
printf '0\n' >"$mutations"
recover_child_pid="$(cat "$fixture/recover-holder-child.pid")"
kill -KILL "$holder_pid" "$recover_child_pid"
set +e
{
  wait "$holder_pid"
  status="$?"
} 2>>"$fixture/recover-killed-holder.err"
holder_pid=""
set -e
[[ "$status" == 137 ]]
for _ in $(seq 1 100); do
  ! kill -0 "$recover_child_pid" 2>/dev/null && break
  sleep 0.02
done
! kill -0 "$recover_child_pid" 2>/dev/null
rm -f -- "$fixture/recover-holder-child.pid"
[[ "$(sha256sum "$recover_pending" | awk '{print $1}')" == "$recover_hash_before" ]]
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
RESONANCE_ROOT="$ROOT" \
bash "$DEPLOY" recover-pending >"$fixture/recover-post-kill.out" \
  2>"$fixture/recover-post-kill.err"
assert_baseline_restored "$recover_pending"
[[ "$(cat "$mutations")" == 1 ]]
[[ ! -s "$FAKE_FORBIDDEN_COMMANDS" ]]
grep -Fq 'BACKSTAGE_PENDING_RECOVERY_PASS pending=1 recovered=1 mutation=rollback-only' \
  "$fixture/recover-post-kill.out"

if grep -R -Fq -- "$secret_value" \
    "$fixture"/*.out "$fixture"/*.err "$fixture/state" 2>/dev/null; then
  echo '[backstage-rollback-test] secret value leaked into state or logs' >&2
  exit 1
fi

echo 'BACKSTAGE_DEPLOYMENT_ROLLBACK_PASS cases=14 failureStatus=37 rollbackFailure=79 sigkillResume=3 casMutation=0 successPending=0 securityFailClosed=4 contentionStatus=79 contentionMutation=0 officialDirectShared=1 controlGroupKill=2 recoverPresent=1 recoverAbsent=2 recoverMutation0=2 secretValues=0'
