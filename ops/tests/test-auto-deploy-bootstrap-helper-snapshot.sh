#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}}"
LAUNCHER="$ROOT/ops/scripts/auto-deploy-main-launcher.sh"
AUTO="$ROOT/ops/scripts/auto-deploy-main.sh"
HANDLER="$ROOT/ops/scripts/carbonet-auto-deploy-failure-handler.sh"
RUNNER="$ROOT/ops/scripts/postdeploy-attempt-recovery-runner.sh"
FLYWAY_RUNNER="$ROOT/ops/scripts/run-flyway-migration-job.sh"
[[ -s "$LAUNCHER" && -s "$AUTO" && -s "$HANDLER" && -s "$RUNNER" && -s "$FLYWAY_RUNNER" ]] || {
  echo '[bootstrap-helper-snapshot-test] missing deploy scripts' >&2
  exit 1
}
bash -n "$LAUNCHER" "$AUTO" "$HANDLER" "$RUNNER" "$FLYWAY_RUNNER"
for token in \
  'snapshot_orphan_recovery_helper=' \
  'snapshot_legacy_automation_retirement_helper=' \
  'snapshot_legacy_automation_retirement_helper_sha256=' \
  'snapshot_postdeploy_leader_resolver=' \
  'snapshot_postdeploy_leader_resolver_sha256=' \
  'snapshot_flyway_job_runner=' \
  'snapshot_flyway_job_runner_sha256=' \
  'CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT="$target_commit"' \
  'CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER="$snapshot_orphan_recovery_helper"' \
  'CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER_SHA256="$snapshot_orphan_recovery_helper_sha256"' \
  'CARBONET_LEGACY_AUTOMATION_RETIRE_HELPER="$snapshot_legacy_automation_retirement_helper"' \
  'CARBONET_LEGACY_AUTOMATION_RETIRE_HELPER_SHA256="$snapshot_legacy_automation_retirement_helper_sha256"' \
  'CARBONET_POSTDEPLOY_LEADER_RESOLVER="$snapshot_postdeploy_leader_resolver"' \
  'CARBONET_FLYWAY_JOB_RUNNER="$snapshot_flyway_job_runner"'; do
  grep -Fq "$token" "$LAUNCHER"
done
grep -Fq 'verify_bootstrap_orphan_recovery_helper || exit $?' "$AUTO"
grep -Fq 'bash "$ORPHAN_RECOVERY_HELPER" "$ROOT_DIR"' "$AUTO"
if grep -Fq 'bash "$ROOT_DIR/ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh"' "$AUTO"; then
  echo '[bootstrap-helper-snapshot-test] stale-root helper execution remains' >&2
  exit 1
fi
if grep -Fq 'CARBONET_DEPLOY_SNAPSHOT_PATH="$recovery_launcher"' "$HANDLER" \
   || grep -Fq 'CARBONET_DEPLOY_SNAPSHOT_PATH="$launcher"' "$RUNNER"; then
  echo '[bootstrap-helper-snapshot-test] persistent recovery launcher is cleanup-owned' >&2
  exit 1
fi
for token in \
  'CARBONET_DEPLOY_SNAPSHOT_ACTIVE=true' \
  'CARBONET_DEPLOY_ORIGINAL_ROOT="$deploy_root"' \
  'CARBONET_DEPLOY_ORPHAN_RECOVERY_BINDING_ROOT="$orphan_recovery_binding_root"' \
  'CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT="$expected_source"' \
  'CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER="$orphan_recovery_helper"' \
  'CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER_SHA256="$orphan_recovery_helper_sha256"'; do
  grep -Fq "$token" "$RUNNER"
done
python3 - "$AUTO" <<'PY'
from pathlib import Path
import sys
source=Path(sys.argv[1]).read_text()
body=source[source.index('sync_auto_deploy_failure_runtime_if_required() {'):]
assert body.index('mv -fT -- "$orphan_recovery_helper_install_tmp"') < body.index('mv -fT -- "$recovery_main_install_tmp"')
assert body.count('sudo -n sync -f /opt/resonance-data/control-plane/bin') >= 4
assert 'sudo -n bash -n "$orphan_recovery_helper_install_tmp"' in body
assert 'sudo -n bash -n "$recovery_main_install_tmp"' in body
PY

TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
ORIGIN="$TMP/origin.git"
PUBLISHER="$TMP/publisher"
OPERATOR="$TMP/operator"
SNAPSHOT_PARENT="$TMP/snapshots"
FAKE_BIN="$TMP/bin"
mkdir -p "$SNAPSHOT_PARENT" "$FAKE_BIN"
git init --bare -q "$ORIGIN"
git clone -q "$ORIGIN" "$PUBLISHER"
git -C "$PUBLISHER" config user.name fixture
git -C "$PUBLISHER" config user.email fixture@example.invalid
mkdir -p "$PUBLISHER/ops/scripts"
cat >"$PUBLISHER/ops/scripts/auto-deploy-main.sh" <<'SH'
#!/usr/bin/env bash
echo STALE_AUTO_DEPLOY >&2
exit 98
SH
cat >"$PUBLISHER/ops/scripts/plan-incremental-work.sh" <<'SH'
#!/usr/bin/env bash
exit 0
SH
cat >"$PUBLISHER/ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh" <<'SH'
#!/usr/bin/env bash
printf 'STALE_ROOT_HELPER:%s\n' "$1"
SH
cat >"$PUBLISHER/ops/scripts/retire-legacy-runtime-mutation-automation.sh" <<'SH'
#!/usr/bin/env bash
printf 'STALE_RETIREMENT_HELPER\n'
SH
cat >"$PUBLISHER/ops/scripts/run-flyway-migration-job.sh" <<'SH'
#!/usr/bin/env bash
printf 'STALE_FLYWAY_RUNNER:%s\n' "$1"
SH
chmod 755 "$PUBLISHER/ops/scripts/"*.sh
git -C "$PUBLISHER" add ops/scripts
git -C "$PUBLISHER" commit -qm stale-root
git -C "$PUBLISHER" push -q origin HEAD:main
git clone -q -b main "$ORIGIN" "$OPERATOR"

cat >"$PUBLISHER/ops/scripts/auto-deploy-main.sh" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
fail() { echo "[fixture-auto-deploy] $1" >&2; exit 79; }
: "${CARBONET_TEST_OUTPUT:?}" "${CARBONET_TEST_EXPECTED_TARGET:?}"
[[ "${CARBONET_DEPLOY_SNAPSHOT_ACTIVE:-}" == true ]] || fail snapshot-inactive
[[ "${CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT:-}" == "$CARBONET_TEST_EXPECTED_TARGET" ]] \
  || fail wrong-target
[[ -s "${CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER:-}" \
   && ! -L "$CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER" ]] || fail missing-helper
[[ "$(dirname "$(readlink -f "$CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER")")" \
   == "$(dirname "$(readlink -f "$CARBONET_DEPLOY_SNAPSHOT_PATH")")" ]] \
  || fail outside-snapshot
[[ "$(stat -c '%a:%u' "$CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER")" == "700:$(id -u)" ]] \
  || fail non-private
actual_sha="$(sha256sum "$CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER" | awk '{print $1}')"
[[ "$actual_sha" == "${CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER_SHA256:-}" ]] \
  || fail snapshot-hash-mismatch
target_sha="$(git -C "$CARBONET_DEPLOY_ORIGINAL_ROOT" show --format= --no-textconv \
  "$CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT:ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh" \
  | sha256sum | awk '{print $1}')"
[[ "$target_sha" == "$actual_sha" ]] || fail target-hash-mismatch
[[ "$CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER" \
   != "$CARBONET_DEPLOY_ORIGINAL_ROOT/ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh" ]] \
  || fail stale-root-path
[[ -s "${CARBONET_LEGACY_AUTOMATION_RETIRE_HELPER:-}" \
   && ! -L "$CARBONET_LEGACY_AUTOMATION_RETIRE_HELPER" ]] || fail missing-retirement-helper
[[ "$(dirname "$(readlink -f "$CARBONET_LEGACY_AUTOMATION_RETIRE_HELPER")")" \
   == "$(dirname "$(readlink -f "$CARBONET_DEPLOY_SNAPSHOT_PATH")")" ]] \
  || fail retirement-helper-outside-snapshot
[[ "$(stat -c '%a:%u' "$CARBONET_LEGACY_AUTOMATION_RETIRE_HELPER")" == "700:$(id -u)" ]] \
  || fail retirement-helper-non-private
retirement_helper_sha="$(sha256sum "$CARBONET_LEGACY_AUTOMATION_RETIRE_HELPER" | awk '{print $1}')"
[[ "$retirement_helper_sha" == "${CARBONET_LEGACY_AUTOMATION_RETIRE_HELPER_SHA256:-}" ]] \
  || fail retirement-helper-snapshot-hash-mismatch
target_retirement_helper_sha="$(git -C "$CARBONET_DEPLOY_ORIGINAL_ROOT" show --format= --no-textconv \
  "$CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT:ops/scripts/retire-legacy-runtime-mutation-automation.sh" \
  | sha256sum | awk '{print $1}')"
[[ "$retirement_helper_sha" == "$target_retirement_helper_sha" ]] \
  || fail retirement-helper-target-hash-mismatch
[[ -s "${CARBONET_POSTDEPLOY_LEADER_RESOLVER:-}" \
   && ! -L "$CARBONET_POSTDEPLOY_LEADER_RESOLVER" ]] || fail missing-leader-resolver
[[ "$(dirname "$(readlink -f "$CARBONET_POSTDEPLOY_LEADER_RESOLVER")")" \
   == "$(dirname "$(readlink -f "$CARBONET_DEPLOY_SNAPSHOT_PATH")")" ]] \
  || fail leader-resolver-outside-snapshot
[[ "$(stat -c '%a:%u' "$CARBONET_POSTDEPLOY_LEADER_RESOLVER")" == "700:$(id -u)" ]] \
  || fail leader-resolver-non-private
leader_resolver_sha="$(sha256sum "$CARBONET_POSTDEPLOY_LEADER_RESOLVER" | awk '{print $1}')"
target_leader_resolver_sha="$(git -C "$CARBONET_DEPLOY_ORIGINAL_ROOT" show --format= --no-textconv \
  "$CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT:ops/scripts/resolve-patroni-primary-pod.sh" \
  | sha256sum | awk '{print $1}')"
[[ "$leader_resolver_sha" == "$target_leader_resolver_sha" ]] \
  || fail leader-resolver-target-hash-mismatch
[[ "$CARBONET_POSTDEPLOY_LEADER_RESOLVER" \
   != "$CARBONET_DEPLOY_ORIGINAL_ROOT/ops/scripts/resolve-patroni-primary-pod.sh" ]] \
  || fail stale-root-leader-resolver-path
[[ -s "${CARBONET_FLYWAY_JOB_RUNNER:-}" \
   && ! -L "$CARBONET_FLYWAY_JOB_RUNNER" ]] || fail missing-flyway-runner
[[ "$(dirname "$(readlink -f "$CARBONET_FLYWAY_JOB_RUNNER")")" \
   == "$(dirname "$(readlink -f "$CARBONET_DEPLOY_SNAPSHOT_PATH")")" ]] \
  || fail flyway-runner-outside-snapshot
[[ "$(stat -c '%a:%u' "$CARBONET_FLYWAY_JOB_RUNNER")" == "700:$(id -u)" ]] \
  || fail flyway-runner-non-private
flyway_runner_sha="$(sha256sum "$CARBONET_FLYWAY_JOB_RUNNER" | awk '{print $1}')"
target_flyway_runner_sha="$(git -C "$CARBONET_DEPLOY_ORIGINAL_ROOT" show --format= --no-textconv \
  "$CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT:ops/scripts/run-flyway-migration-job.sh" \
  | sha256sum | awk '{print $1}')"
[[ "$flyway_runner_sha" == "$target_flyway_runner_sha" ]] \
  || fail flyway-runner-target-hash-mismatch
[[ "$CARBONET_FLYWAY_JOB_RUNNER" \
   != "$CARBONET_DEPLOY_ORIGINAL_ROOT/ops/scripts/run-flyway-migration-job.sh" ]] \
  || fail stale-root-flyway-runner-path
result="$(bash "$CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER" "$CARBONET_DEPLOY_ORIGINAL_ROOT")"
leader_result="$(bash "$CARBONET_POSTDEPLOY_LEADER_RESOLVER")"
flyway_result="$(bash "$CARBONET_FLYWAY_JOB_RUNNER" fixture)"
printf '%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n' \
  "$CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT" \
  "$CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER" \
  "$CARBONET_DEPLOY_SNAPSHOT_PATH" \
  "$result" \
  "${CARBONET_RECOVERY_ONLY:-false}" \
  "$CARBONET_POSTDEPLOY_LEADER_RESOLVER" \
  "$leader_result" \
  "$CARBONET_FLYWAY_JOB_RUNNER" \
  "$flyway_result" >"$CARBONET_TEST_OUTPUT"
SH
cat >"$PUBLISHER/ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh" <<'SH'
#!/usr/bin/env bash
printf 'TARGET_HELPER:%s\n' "$1"
SH
cat >"$PUBLISHER/ops/scripts/retire-legacy-runtime-mutation-automation.sh" <<'SH'
#!/usr/bin/env bash
printf 'TARGET_RETIREMENT_HELPER\n'
SH
cat >"$PUBLISHER/ops/scripts/resolve-patroni-primary-pod.sh" <<'SH'
#!/usr/bin/env bash
printf 'TARGET_LEADER_RESOLVER\n'
SH
cat >"$PUBLISHER/ops/scripts/run-flyway-migration-job.sh" <<'SH'
#!/usr/bin/env bash
printf 'TARGET_FLYWAY_RUNNER:%s\n' "$1"
SH
chmod 755 "$PUBLISHER/ops/scripts/"*.sh
git -C "$PUBLISHER" add ops/scripts
git -C "$PUBLISHER" commit -qm target-helper
git -C "$PUBLISHER" push -q origin HEAD:main
TARGET="$(git -C "$PUBLISHER" rev-parse HEAD)"

REAL_MKTEMP="$(command -v mktemp)"
REAL_CHMOD="$(command -v chmod)"
export REAL_MKTEMP REAL_CHMOD
cat >"$FAKE_BIN/mktemp" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$#" == 2 && "$1" == -d && "$2" == /tmp/carbonet-auto-deploy-main.XXXXXX ]]; then
  exec "$REAL_MKTEMP" -d "$CARBONET_TEST_SNAPSHOT_PARENT/carbonet-auto-deploy-main.XXXXXX"
fi
exec "$REAL_MKTEMP" "$@"
SH
cat >"$FAKE_BIN/chmod" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
"$REAL_CHMOD" "$@"
if [[ "${CARBONET_TEST_TAMPER_HELPER:-false}" == true ]]; then
  for candidate in "$@"; do
    if [[ "$(basename "$candidate")" == reconcile-exact-legacy-orphan-runtime-quarantine.sh ]]; then
      printf '# tampered after launcher hash\n' >>"$candidate"
    fi
  done
elif [[ "${CARBONET_TEST_MAKE_HELPER_NONEXEC:-false}" == true ]]; then
  for candidate in "$@"; do
    if [[ "$(basename "$candidate")" == reconcile-exact-legacy-orphan-runtime-quarantine.sh ]]; then
      "$REAL_CHMOD" 600 "$candidate"
    fi
  done
elif [[ "${CARBONET_TEST_TAMPER_RESOLVER:-false}" == true ]]; then
  for candidate in "$@"; do
    if [[ "$(basename "$candidate")" == resolve-patroni-primary-pod.sh ]]; then
      printf '# tampered after launcher hash\n' >>"$candidate"
    fi
  done
elif [[ "${CARBONET_TEST_MAKE_RESOLVER_NONEXEC:-false}" == true ]]; then
  for candidate in "$@"; do
    if [[ "$(basename "$candidate")" == resolve-patroni-primary-pod.sh ]]; then
      "$REAL_CHMOD" 600 "$candidate"
    fi
  done
elif [[ "${CARBONET_TEST_TAMPER_FLYWAY_RUNNER:-false}" == true ]]; then
  for candidate in "$@"; do
    if [[ "$(basename "$candidate")" == run-flyway-migration-job.sh ]]; then
      printf '# tampered after launcher hash\n' >>"$candidate"
    fi
  done
elif [[ "${CARBONET_TEST_MAKE_FLYWAY_RUNNER_NONEXEC:-false}" == true ]]; then
  for candidate in "$@"; do
    if [[ "$(basename "$candidate")" == run-flyway-migration-job.sh ]]; then
      "$REAL_CHMOD" 600 "$candidate"
    fi
  done
fi
SH
chmod 755 "$FAKE_BIN/mktemp" "$FAKE_BIN/chmod"

assert_snapshot_parent_empty() {
  [[ -z "$(find "$SNAPSHOT_PARENT" -mindepth 1 -maxdepth 1 -print -quit)" ]] || {
    echo '[bootstrap-helper-snapshot-test] launcher snapshot residue remains' >&2
    exit 1
  }
}

COMMON_ENV=(
  "PATH=$FAKE_BIN:$PATH"
  "CARBONET_DEPLOY_ORIGINAL_ROOT=$OPERATOR"
  CARBONET_DEPLOY_REMOTE=origin
  CARBONET_DEPLOY_BRANCH=main
  "CARBONET_TEST_SNAPSHOT_PARENT=$SNAPSHOT_PARENT"
)
NORMAL_OUTPUT="$TMP/normal.out"
env "${COMMON_ENV[@]}" \
  "CARBONET_TEST_OUTPUT=$NORMAL_OUTPUT" \
  "CARBONET_TEST_EXPECTED_TARGET=$TARGET" \
  bash "$LAUNCHER"
mapfile -t normal <"$NORMAL_OUTPUT"
[[ "${normal[0]}" == "$TARGET" \
   && "${normal[3]}" == "TARGET_HELPER:$OPERATOR" \
   && "${normal[4]}" == false \
   && "${normal[6]}" == TARGET_LEADER_RESOLVER \
   && "${normal[8]}" == TARGET_FLYWAY_RUNNER:fixture ]]
[[ ! -e "${normal[1]}" && ! -e "${normal[2]}" && ! -e "${normal[5]}" && ! -e "${normal[7]}" ]]
assert_snapshot_parent_empty

RECOVERY_OUTPUT="$TMP/recovery.out"
env "${COMMON_ENV[@]}" \
  CARBONET_RECOVERY_ONLY=true \
  "CARBONET_RECOVERY_TARGET_COMMIT=$TARGET" \
  "CARBONET_TEST_OUTPUT=$RECOVERY_OUTPUT" \
  "CARBONET_TEST_EXPECTED_TARGET=$TARGET" \
  bash "$LAUNCHER"
mapfile -t recovery <"$RECOVERY_OUTPUT"
[[ "${recovery[0]}" == "$TARGET" \
   && "${recovery[3]}" == "TARGET_HELPER:$OPERATOR" \
   && "${recovery[4]}" == true \
   && "${recovery[6]}" == TARGET_LEADER_RESOLVER \
   && "${recovery[8]}" == TARGET_FLYWAY_RUNNER:fixture ]]
assert_snapshot_parent_empty

status=0
env "${COMMON_ENV[@]}" \
  CARBONET_TEST_TAMPER_HELPER=true \
  "CARBONET_TEST_OUTPUT=$TMP/tampered.out" \
  "CARBONET_TEST_EXPECTED_TARGET=$TARGET" \
  bash "$LAUNCHER" >"$TMP/tampered.log" 2>&1 || status=$?
[[ "$status" == 79 && ! -e "$TMP/tampered.out" ]]
assert_snapshot_parent_empty

status=0
env "${COMMON_ENV[@]}" \
  CARBONET_TEST_TAMPER_RESOLVER=true \
  "CARBONET_TEST_OUTPUT=$TMP/resolver-tampered.out" \
  "CARBONET_TEST_EXPECTED_TARGET=$TARGET" \
  bash "$LAUNCHER" >"$TMP/resolver-tampered.log" 2>&1 || status=$?
[[ "$status" == 79 && ! -e "$TMP/resolver-tampered.out" ]]
assert_snapshot_parent_empty

status=0
env "${COMMON_ENV[@]}" \
  CARBONET_TEST_MAKE_RESOLVER_NONEXEC=true \
  "CARBONET_TEST_OUTPUT=$TMP/resolver-nonexec.out" \
  "CARBONET_TEST_EXPECTED_TARGET=$TARGET" \
  CARBONET_RECOVERY_ONLY=true "CARBONET_RECOVERY_TARGET_COMMIT=$TARGET" \
  bash "$LAUNCHER" >"$TMP/resolver-nonexec.log" 2>&1 || status=$?
[[ "$status" == 79 && ! -e "$TMP/resolver-nonexec.out" ]]
assert_snapshot_parent_empty

status=0
env "${COMMON_ENV[@]}" \
  CARBONET_TEST_TAMPER_FLYWAY_RUNNER=true \
  "CARBONET_TEST_OUTPUT=$TMP/flyway-runner-tampered.out" \
  "CARBONET_TEST_EXPECTED_TARGET=$TARGET" \
  bash "$LAUNCHER" >"$TMP/flyway-runner-tampered.log" 2>&1 || status=$?
[[ "$status" == 79 && ! -e "$TMP/flyway-runner-tampered.out" ]]
assert_snapshot_parent_empty

status=0
env "${COMMON_ENV[@]}" \
  CARBONET_TEST_MAKE_FLYWAY_RUNNER_NONEXEC=true \
  "CARBONET_TEST_OUTPUT=$TMP/flyway-runner-nonexec.out" \
  "CARBONET_TEST_EXPECTED_TARGET=$TARGET" \
  CARBONET_RECOVERY_ONLY=true "CARBONET_RECOVERY_TARGET_COMMIT=$TARGET" \
  bash "$LAUNCHER" >"$TMP/flyway-runner-nonexec.log" 2>&1 || status=$?
[[ "$status" == 79 && ! -e "$TMP/flyway-runner-nonexec.out" ]]
assert_snapshot_parent_empty

# Exercise the production verifier itself so a launcher fixture cannot mask a
# regression in the real pre-bootstrap call site.
eval "$(sed -n '/^fail_bootstrap_orphan_recovery_helper() {$/,/^}$/p' "$AUTO")"
eval "$(sed -n '/^verify_bootstrap_orphan_recovery_helper() {$/,/^}$/p' "$AUTO")"
UNIT_SNAPSHOT="$TMP/unit-snapshot"
mkdir -p "$UNIT_SNAPSHOT"
cp "$PUBLISHER/ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh" \
  "$UNIT_SNAPSHOT/reconcile-exact-legacy-orphan-runtime-quarantine.sh"
printf '#!/usr/bin/env bash\n' >"$UNIT_SNAPSHOT/auto-deploy-main.sh"
chmod 700 "$UNIT_SNAPSHOT/"*
POLICY_ROOT="$OPERATOR"
ORPHAN_RECOVERY_HELPER_EXPLICIT=true
ORPHAN_RECOVERY_HELPER="$UNIT_SNAPSHOT/reconcile-exact-legacy-orphan-runtime-quarantine.sh"
ORPHAN_RECOVERY_HELPER_SHA256="$(sha256sum "$ORPHAN_RECOVERY_HELPER" | awk '{print $1}')"
CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT="$TARGET"
CARBONET_DEPLOY_SNAPSHOT_PATH="$UNIT_SNAPSHOT/auto-deploy-main.sh"
verify_bootstrap_orphan_recovery_helper
printf '# unit tamper\n' >>"$ORPHAN_RECOVERY_HELPER"
status=0; verify_bootstrap_orphan_recovery_helper >/dev/null 2>&1 || status=$?
[[ "$status" == 79 ]]
rm -f "$ORPHAN_RECOVERY_HELPER"
status=0; verify_bootstrap_orphan_recovery_helper >/dev/null 2>&1 || status=$?
[[ "$status" == 79 ]]

expect_remote_target_failure() {
  local label="$1" expected_target="$2" status=0
  local output="$TMP/$label.out"
  env "${COMMON_ENV[@]}" \
    "CARBONET_TEST_OUTPUT=$output" \
    "CARBONET_TEST_EXPECTED_TARGET=$expected_target" \
    bash "$LAUNCHER" >"$TMP/$label.log" 2>&1 || status=$?
  [[ "$status" == 79 && ! -e "$output" ]]
  assert_snapshot_parent_empty
}

git -C "$PUBLISHER" rm -q ops/scripts/run-flyway-migration-job.sh
git -C "$PUBLISHER" commit -qm missing-flyway-runner
git -C "$PUBLISHER" push -q origin HEAD:main
MISSING_FLYWAY_RUNNER_TARGET="$(git -C "$PUBLISHER" rev-parse HEAD)"
expect_remote_target_failure missing-flyway-runner "$MISSING_FLYWAY_RUNNER_TARGET"

git -C "$PUBLISHER" checkout "$TARGET" -- ops/scripts/run-flyway-migration-job.sh
: >"$PUBLISHER/ops/scripts/run-flyway-migration-job.sh"
git -C "$PUBLISHER" add ops/scripts/run-flyway-migration-job.sh
git -C "$PUBLISHER" commit -qm empty-flyway-runner
git -C "$PUBLISHER" push -q origin HEAD:main
EMPTY_FLYWAY_RUNNER_TARGET="$(git -C "$PUBLISHER" rev-parse HEAD)"
expect_remote_target_failure empty-flyway-runner "$EMPTY_FLYWAY_RUNNER_TARGET"

git -C "$PUBLISHER" checkout "$TARGET" -- ops/scripts/run-flyway-migration-job.sh
git -C "$PUBLISHER" rm -q ops/scripts/resolve-patroni-primary-pod.sh
git -C "$PUBLISHER" commit -qm missing-leader-resolver
git -C "$PUBLISHER" push -q origin HEAD:main
MISSING_RESOLVER_TARGET="$(git -C "$PUBLISHER" rev-parse HEAD)"
expect_remote_target_failure missing-resolver "$MISSING_RESOLVER_TARGET"

git -C "$PUBLISHER" checkout "$TARGET" -- ops/scripts/resolve-patroni-primary-pod.sh
: >"$PUBLISHER/ops/scripts/resolve-patroni-primary-pod.sh"
git -C "$PUBLISHER" add ops/scripts/resolve-patroni-primary-pod.sh
git -C "$PUBLISHER" commit -qm empty-leader-resolver
git -C "$PUBLISHER" push -q origin HEAD:main
EMPTY_RESOLVER_TARGET="$(git -C "$PUBLISHER" rev-parse HEAD)"
expect_remote_target_failure empty-resolver "$EMPTY_RESOLVER_TARGET"

git -C "$PUBLISHER" checkout "$TARGET" -- ops/scripts/resolve-patroni-primary-pod.sh
git -C "$PUBLISHER" rm -q ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh
git -C "$PUBLISHER" commit -qm missing-helper
git -C "$PUBLISHER" push -q origin HEAD:main
MISSING_TARGET="$(git -C "$PUBLISHER" rev-parse HEAD)"
expect_remote_target_failure missing "$MISSING_TARGET"

: >"$PUBLISHER/ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh"
chmod 755 "$PUBLISHER/ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh"
git -C "$PUBLISHER" add ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh
git -C "$PUBLISHER" commit -qm empty-helper
git -C "$PUBLISHER" push -q origin HEAD:main
EMPTY_TARGET="$(git -C "$PUBLISHER" rev-parse HEAD)"
expect_remote_target_failure empty "$EMPTY_TARGET"

status=0
env "${COMMON_ENV[@]}" CARBONET_TEST_MAKE_HELPER_NONEXEC=true \
  "CARBONET_TEST_OUTPUT=$TMP/nonexec.out" "CARBONET_TEST_EXPECTED_TARGET=$TARGET" \
  CARBONET_RECOVERY_ONLY=true "CARBONET_RECOVERY_TARGET_COMMIT=$TARGET" \
  bash "$LAUNCHER" >"$TMP/nonexec.log" 2>&1 || status=$?
[[ "$status" == 79 && ! -e "$TMP/nonexec.out" ]]
assert_snapshot_parent_empty

printf '[bootstrap-helper-snapshot-test] PASS targetExact=3 staleRootExec=0 recovery=1 missingHelper=79 missingResolver=79 missingFlywayRunner=79 emptyHelper=79 emptyResolver=79 emptyFlywayRunner=79 helperNonPrivate=79 resolverNonPrivate=79 flywayRunnerNonPrivate=79 helperTampered=79 resolverTampered=79 flywayRunnerTampered=79 productionMutants=2 cleanupLaunches=14\n'
