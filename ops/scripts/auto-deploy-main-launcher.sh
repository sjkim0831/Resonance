#!/usr/bin/env bash
set -euo pipefail

# The operator checkout is intentionally allowed to contain local diagnostics
# and generated evidence. Running the tracked script directly from that dirty
# checkout freezes deployment automation at its old commit forever. Load only
# the launcher script from the latest remote main commit, then let that script
# create its existing isolated deployment worktree.
ROOT_DIR="${CARBONET_DEPLOY_ORIGINAL_ROOT:-/opt/Resonance}"
REMOTE="${CARBONET_DEPLOY_REMOTE:-origin}"
BRANCH="${CARBONET_DEPLOY_BRANCH:-main}"

# Native build/test processes can leave thousands of extracted shared objects
# in tmpfs. When the per-user tmp quota is exhausted, `git show > file` exits
# with 255 before the deploy script can emit useful evidence. Reclaim only
# stale, launcher-owned patterns and fail with an explicit capacity signal.
tmp_probe="/tmp/.carbonet-deploy-write-probe.$$"
if ! (umask 077 && printf 'ok\n' >"$tmp_probe") 2>/dev/null; then
  find /tmp -xdev -maxdepth 1 -type f -user "$(id -un)" \
    -name '.5bf*.so' -mmin +30 -delete 2>/dev/null || true
  find /tmp -xdev -maxdepth 1 -type d -user "$(id -un)" \
    -name 'tomcat.18000.*' -mmin +60 -empty -delete 2>/dev/null || true
fi
if ! (umask 077 && printf 'ok\n' >"$tmp_probe") 2>/dev/null; then
  echo "[capacity-gate] FAIL: /tmp user quota prevents deployment writes" >&2
  exit 24
fi
rm -f -- "$tmp_probe"

if [[ "${CARBONET_RECOVERY_ONLY:-false}" == true ]]; then
  target_commit="${CARBONET_RECOVERY_TARGET_COMMIT:-}"
  [[ "$target_commit" =~ ^[0-9a-f]{40}$ \
     && "$(git -C "$ROOT_DIR" cat-file -t "$target_commit" 2>/dev/null || true)" == commit ]] || {
    echo '[auto-deploy-launcher] recovery target is absent from the local object store' >&2
    exit 79
  }
  echo "[auto-deploy-launcher] recovery-only local target=$target_commit (fetch bypassed)"
else
  git -C "$ROOT_DIR" fetch --quiet --prune "$REMOTE" "$BRANCH"
  target_commit="$(git -C "$ROOT_DIR" rev-parse "$REMOTE/$BRANCH")"
fi
snapshot_dir="$(mktemp -d /tmp/carbonet-auto-deploy-main.XXXXXX)"
snapshot_script="$snapshot_dir/auto-deploy-main.sh"
snapshot_plan="$snapshot_dir/plan-incremental-work.sh"
snapshot_orphan_recovery_helper="$snapshot_dir/reconcile-exact-legacy-orphan-runtime-quarantine.sh"
snapshot_postdeploy_leader_resolver="$snapshot_dir/resolve-patroni-primary-pod.sh"
snapshot_flyway_job_runner="$snapshot_dir/run-flyway-migration-job.sh"
trap 'rm -rf -- "$snapshot_dir"' EXIT INT TERM

git -C "$ROOT_DIR" show --format= --no-textconv \
  "$target_commit:ops/scripts/auto-deploy-main.sh" >"$snapshot_script"
git -C "$ROOT_DIR" show --format= --no-textconv \
  "$target_commit:ops/scripts/plan-incremental-work.sh" >"$snapshot_plan"
if ! git -C "$ROOT_DIR" show --format= --no-textconv \
  "$target_commit:ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh" \
  >"$snapshot_orphan_recovery_helper"; then
  echo '[auto-deploy-launcher] target orphan-recovery helper is missing' >&2
  exit 79
fi
[[ -s "$snapshot_orphan_recovery_helper" ]] || {
  echo '[auto-deploy-launcher] target orphan-recovery helper is empty' >&2
  exit 79
}
if ! git -C "$ROOT_DIR" show --format= --no-textconv \
  "$target_commit:ops/scripts/resolve-patroni-primary-pod.sh" \
  >"$snapshot_postdeploy_leader_resolver"; then
  echo '[auto-deploy-launcher] target postdeploy leader resolver is missing' >&2
  exit 79
fi
[[ -s "$snapshot_postdeploy_leader_resolver" ]] || {
  echo '[auto-deploy-launcher] target postdeploy leader resolver is empty' >&2
  exit 79
}
if ! git -C "$ROOT_DIR" show --format= --no-textconv \
  "$target_commit:ops/scripts/run-flyway-migration-job.sh" \
  >"$snapshot_flyway_job_runner"; then
  echo '[auto-deploy-launcher] target Flyway cleanup runner is missing' >&2
  exit 79
fi
[[ -s "$snapshot_flyway_job_runner" ]] || {
  echo '[auto-deploy-launcher] target Flyway cleanup runner is empty' >&2
  exit 79
}
snapshot_orphan_recovery_helper_sha256="$(sha256sum "$snapshot_orphan_recovery_helper" | awk '{print $1}')"
[[ "$snapshot_orphan_recovery_helper_sha256" =~ ^[0-9a-f]{64}$ ]] || exit 79
snapshot_postdeploy_leader_resolver_sha256="$(sha256sum "$snapshot_postdeploy_leader_resolver" | awk '{print $1}')"
[[ "$snapshot_postdeploy_leader_resolver_sha256" =~ ^[0-9a-f]{64}$ ]] || exit 79
snapshot_flyway_job_runner_sha256="$(sha256sum "$snapshot_flyway_job_runner" | awk '{print $1}')"
[[ "$snapshot_flyway_job_runner_sha256" =~ ^[0-9a-f]{64}$ ]] || exit 79
chmod 700 \
  "$snapshot_script" \
  "$snapshot_plan" \
  "$snapshot_orphan_recovery_helper" \
  "$snapshot_postdeploy_leader_resolver" \
  "$snapshot_flyway_job_runner"
[[ "$(stat -c '%a:%u' "$snapshot_orphan_recovery_helper" 2>/dev/null || true)" \
   == "700:$(id -u)" ]] || {
  echo '[auto-deploy-launcher] target orphan-recovery helper snapshot is not private' >&2
  exit 79
}
[[ "$(stat -c '%a:%u' "$snapshot_postdeploy_leader_resolver" 2>/dev/null || true)" \
   == "700:$(id -u)" ]] || {
  echo '[auto-deploy-launcher] target postdeploy leader resolver snapshot is not private' >&2
  exit 79
}
[[ "$(sha256sum "$snapshot_postdeploy_leader_resolver" | awk '{print $1}')" \
   == "$snapshot_postdeploy_leader_resolver_sha256" ]] || {
  echo '[auto-deploy-launcher] target postdeploy leader resolver snapshot changed' >&2
  exit 79
}
[[ "$(stat -c '%a:%u' "$snapshot_flyway_job_runner" 2>/dev/null || true)" \
   == "700:$(id -u)" \
   && "$(sha256sum "$snapshot_flyway_job_runner" | awk '{print $1}')" \
      == "$snapshot_flyway_job_runner_sha256" ]] || {
  echo '[auto-deploy-launcher] target Flyway cleanup runner snapshot changed or is not private' >&2
  exit 79
}

CARBONET_DEPLOY_SNAPSHOT_ACTIVE=true \
CARBONET_DEPLOY_ORIGINAL_ROOT="$ROOT_DIR" \
CARBONET_DEPLOY_SNAPSHOT_PATH="$snapshot_script" \
CARBONET_DEPLOY_PLAN_SCRIPT="$snapshot_plan" \
CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT="$target_commit" \
CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER="$snapshot_orphan_recovery_helper" \
CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER_SHA256="$snapshot_orphan_recovery_helper_sha256" \
CARBONET_POSTDEPLOY_LEADER_RESOLVER="$snapshot_postdeploy_leader_resolver" \
CARBONET_FLYWAY_JOB_RUNNER="$snapshot_flyway_job_runner" \
  bash "$snapshot_script" "$@"
