#!/usr/bin/env bash
set -euo pipefail

if [[ "${CARBONET_DEPLOY_SNAPSHOT_ACTIVE:-false}" != "true" ]]; then
  original_script="$(readlink -f "${BASH_SOURCE[0]}")"
  original_root="$(cd "$(dirname "$original_script")/../.." && pwd)"
  snapshot_script="$(mktemp /tmp/carbonet-auto-deploy-main.XXXXXX.sh)"
  cp "$original_script" "$snapshot_script"
  chmod 700 "$snapshot_script"
  export CARBONET_DEPLOY_SNAPSHOT_ACTIVE=true
  export CARBONET_DEPLOY_ORIGINAL_ROOT="$original_root"
  export CARBONET_DEPLOY_SNAPSHOT_PATH="$snapshot_script"
  exec bash "$snapshot_script" "$@"
fi

POLICY_ROOT="${CARBONET_DEPLOY_ORIGINAL_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
monotonic_milliseconds() {
  awk '{printf "%.0f\n", $1 * 1000}' /proc/uptime
}

DEPLOY_STARTED_EPOCH_MILLISECONDS="$(monotonic_milliseconds)"
DEPLOY_PHASE_LAST_MILLISECONDS="$DEPLOY_STARTED_EPOCH_MILLISECONDS"
DEPLOY_PHASE_FILE="$(mktemp /tmp/carbonet-deploy-phases.XXXXXX.jsonl)"

record_deploy_phase() {
  local phase="$1"
  local now_ms duration_ms
  now_ms="$(monotonic_milliseconds)"
  duration_ms=$((now_ms - DEPLOY_PHASE_LAST_MILLISECONDS))
  jq -cn \
    --arg phase "$phase" \
    --argjson durationMs "$duration_ms" \
    --argjson finishedAtMs "$now_ms" \
    '{phase:$phase,durationMs:$durationMs,finishedAtMs:$finishedAtMs}' \
    >>"$DEPLOY_PHASE_FILE"
  DEPLOY_PHASE_LAST_MILLISECONDS="$now_ms"
}

# Agent and fast-deploy policies are deterministic file contracts. Reuse a
# successful result only while every input byte remains identical; a changed
# design, worker, deployment, E2E, or policy file invalidates the fingerprint
# immediately and runs the complete gate before any mutation.
if [[ "${CARBONET_RECOVERY_ONLY:-false}" != true ]]; then
policy_cache="${CARBONET_DEPLOY_POLICY_CACHE:-/opt/resonance-data/deploy/deploy-policy.cache}"
policy_contract_files=(
  data/ai-runtime/kilo-m3-process-policy.json
  data/ai-runtime/hermes-nvidia-two-tier-policy.json
  data/ai-runtime/hermes-project-work-policy.json
  ops/prompts/kilo-m3-process-worker.md
  ops/scripts/verify-kilo-m3-policy.sh
  ops/scripts/verify-hermes-nvidia-two-tier.sh
  ops/scripts/verify-hermes-project-work-policy.sh
  ops/scripts/run-process-development-worker.sh
  ops/scripts/run-project-auto-completion-orchestrator.sh
  ops/scripts/run-hermes-project-work.sh
  modules/hermes-core/cli.py
  ops/scripts/test-backstage-fast-deploy-policy.sh
  ops/scripts/test-backstage-runtime-fingerprint.sh
  ops/scripts/test-backstage-runtime-purge-recovery-secret.sh
  ops/scripts/resonance-backstage-deploy.sh
  ops/scripts/auto-deploy-main.sh
  ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh
  ops/scripts/resonance-backstage-visual-e2e.sh
  ops/scripts/resonance-backstage-full-e2e.sh
  ops/scripts/resonance-actor-process-role-e2e.sh
  ops/systemd/resonance-backstage-full-e2e.service
  ops/systemd/resonance-backstage-full-e2e.timer
  platform/control-plane/backstage/packages/app/e2e-tests/resonance-control-plane.test.ts
  platform/control-plane/backstage/playwright.config.ts
  deploy/k8s/control-plane/backstage.yaml
)
policy_existing_files=()
policy_missing_files=()
for policy_path in "${policy_contract_files[@]}"; do
  if [[ -f "$POLICY_ROOT/$policy_path" ]]; then
    policy_existing_files+=("$POLICY_ROOT/$policy_path")
  else
    # Candidate-introduced optional contracts may not exist in the installed
    # bootstrap root yet. Their explicit missing marker changes as soon as
    # the file is installed, invalidating the cache without blocking rollout.
    policy_missing_files+=("$policy_path")
  fi
done
policy_digest="$({
  ((${#policy_existing_files[@]} == 0)) || sha256sum "${policy_existing_files[@]}"
  for policy_path in "${policy_missing_files[@]}"; do
    printf 'MISSING  %s\n' "$policy_path"
  done
} | sha256sum | awk '{print $1}')"
cached_policy_digest="$(tr -d '[:space:]' <"$policy_cache" 2>/dev/null || true)"
if [[ "$cached_policy_digest" == "$policy_digest" ]]; then
  echo "[auto-deploy] deterministic policy gates reused: unchanged fingerprint"
else
  bash "$POLICY_ROOT/ops/scripts/verify-kilo-m3-policy.sh"
  bash "$POLICY_ROOT/ops/scripts/verify-hermes-nvidia-two-tier.sh"
  bash "$POLICY_ROOT/ops/scripts/verify-hermes-project-work-policy.sh"
  if [[ -f "$POLICY_ROOT/ops/scripts/test-backstage-fast-deploy-policy.sh" ]]; then
    bash "$POLICY_ROOT/ops/scripts/test-backstage-fast-deploy-policy.sh"
  else
    echo "[auto-deploy] fast-deploy policy is introduced by the pending commit; validating after bootstrap"
  fi
  mkdir -p "$(dirname "$policy_cache")"
  printf '%s\n' "$policy_digest" >"${policy_cache}.tmp"
  chmod 0644 "${policy_cache}.tmp"
  mv "${policy_cache}.tmp" "$policy_cache"
fi
else
  # Durable recovery must not depend on the mutable operator checkout's policy
  # cache or verifier scripts. The installed recovery bundle is immutable.
  echo "[auto-deploy] recovery-only deterministic policy gates bypassed"
fi
record_deploy_phase "policy"

ROOT_DIR="${CARBONET_DEPLOY_ROOT:-${CARBONET_DEPLOY_ORIGINAL_ROOT:-/opt/Resonance}}"
PLAN_SCRIPT="${CARBONET_DEPLOY_PLAN_SCRIPT:-ops/scripts/plan-incremental-work.sh}"
BRANCH="${CARBONET_DEPLOY_BRANCH:-main}"
REMOTE="${CARBONET_DEPLOY_REMOTE:-origin}"
LOCK_FILE="${CARBONET_DEPLOY_LOCK_FILE:-/tmp/carbonet-auto-deploy.lock}"
DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
RUNTIME_DEPLOY_STATE_FILE="${CARBONET_RUNTIME_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-runtime-identity-success.commit}"
DESIRED_REVISION_FILE="${CARBONET_DESIRED_REVISION_FILE:-/opt/resonance-data/deploy/github-webhook/desired-revision}"
BACKSTAGE_DEPLOY_STATE_FILE="${BACKSTAGE_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/backstage-runtime-success.commit}"
RUNTIME_CANDIDATE_CHECKPOINT_FILE="${CARBONET_RUNTIME_CANDIDATE_CHECKPOINT_FILE:-/opt/resonance-data/deploy/carbonet-runtime-candidate.json}"
POSTDEPLOY_ATTEMPT_JOURNAL_FILE="${CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE:-/opt/resonance-data/deploy/carbonet-postdeploy-attempt.json}"
FLYWAY_CLEANUP_HOLD_ROOT="${CARBONET_DEPLOY_STATE_DIR:-/opt/resonance-data/deploy}"
FLYWAY_CLEANUP_HOLD_FILE="${CARBONET_FLYWAY_CLEANUP_HOLD_FILE:-$FLYWAY_CLEANUP_HOLD_ROOT/flyway-cleanup-hold.json}"
POSTDEPLOY_LEGACY_RETIRE_DIR="${CARBONET_POSTDEPLOY_LEGACY_RETIRE_DIR:-/opt/resonance-data/deploy/retired-attempts}"
FULL_SCREEN_GATE_STATE_DIR="${CARBONET_FULL_SCREEN_GATE_STATE_DIR:-${FULL_SCREEN_GATE_STATE_DIR:-/opt/resonance-data/deploy/full-screen-deploy-gate}}"
LEGACY_FULL_SCREEN_GATE_STATE_DIR="${CARBONET_LEGACY_FULL_SCREEN_GATE_STATE_DIR:-$ROOT_DIR/var/run/full-screen-deploy-gate}"
export FULL_SCREEN_GATE_STATE_DIR
BACKUP_DIR="${CARBONET_DB_BACKUP_DIR:-/opt/resonance-backups/postgresql/pre-deploy}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
POSTGRES_POD="${CARBONET_POSTGRES_POD:-}"
POSTGRES_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
POSTGRES_DB="${POSTGRES_DB:-carbonet}"
POSTGRES_USER="${POSTGRES_ADMIN_USER:-postgres}"
RUNTIME_LEDGER_QUARANTINE_FILE="${CARBONET_RUNTIME_LEDGER_QUARANTINE_FILE:-${CARBONET_DEPLOY_STATE_DIR:-/opt/resonance-data/deploy}/runtime-ledger-invalidation.quarantine}"
LEGACY_RUNTIME_LEDGER_QUARANTINE_FILE="${CARBONET_LEGACY_RUNTIME_LEDGER_QUARANTINE_FILE:-$ROOT_DIR/var/run/runtime-ledger-invalidation.quarantine}"
POSTDEPLOY_MARKER_PENDING_FILE="${CARBONET_POSTDEPLOY_MARKER_PENDING_FILE:-${CARBONET_DEPLOY_STATE_DIR:-/opt/resonance-data/deploy}/postdeploy-marker-pending.state}"
MIN_BACKUP_BYTES="${CARBONET_MIN_BACKUP_BYTES:-1048576}"
# Full logical backups of the production database can exceed twenty minutes as
# the data set grows. Keep the operator override, while giving the safety copy
# enough time to finish instead of repeatedly discarding a healthy pg_dump.
BACKUP_TIMEOUT_SECONDS="${CARBONET_BACKUP_TIMEOUT_SECONDS:-3600}"
KUBECONFIG="${CARBONET_KUBECONFIG:-${KUBECONFIG:-/home/sjkim/.kube/config}}"
export KUBECONFIG
ORPHAN_RECOVERY_HELPER_EXPLICIT=false
[[ -v CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER ]] && ORPHAN_RECOVERY_HELPER_EXPLICIT=true
ORPHAN_RECOVERY_HELPER="${CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER:-$ROOT_DIR/ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh}"
ORPHAN_RECOVERY_HELPER_SHA256="${CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER_SHA256:-}"
LEGACY_AUTOMATION_RETIRE_HELPER_EXPLICIT=false
[[ -v CARBONET_LEGACY_AUTOMATION_RETIRE_HELPER ]] && LEGACY_AUTOMATION_RETIRE_HELPER_EXPLICIT=true
LEGACY_AUTOMATION_RETIRE_HELPER="${CARBONET_LEGACY_AUTOMATION_RETIRE_HELPER:-$ROOT_DIR/ops/scripts/retire-legacy-runtime-mutation-automation.sh}"
LEGACY_AUTOMATION_RETIRE_HELPER_SHA256="${CARBONET_LEGACY_AUTOMATION_RETIRE_HELPER_SHA256:-}"
[[ -v CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER ]] && POSTDEPLOY_JOURNAL_HELPER_EXPLICIT=true || POSTDEPLOY_JOURNAL_HELPER_EXPLICIT=false
[[ -v CARBONET_POSTDEPLOY_GATE_SCRIPT ]] && POSTDEPLOY_GATE_SCRIPT_EXPLICIT=true || POSTDEPLOY_GATE_SCRIPT_EXPLICIT=false
[[ -v CARBONET_POSTDEPLOY_RECORD_RUNTIME_SCRIPT ]] && POSTDEPLOY_RECORD_RUNTIME_SCRIPT_EXPLICIT=true || POSTDEPLOY_RECORD_RUNTIME_SCRIPT_EXPLICIT=false
[[ -v CARBONET_POSTDEPLOY_CHECKPOINT_SCRIPT ]] && POSTDEPLOY_CHECKPOINT_SCRIPT_EXPLICIT=true || POSTDEPLOY_CHECKPOINT_SCRIPT_EXPLICIT=false
[[ -v CARBONET_POSTDEPLOY_STAGE_SCRIPT ]] && POSTDEPLOY_STAGE_SCRIPT_EXPLICIT=true || POSTDEPLOY_STAGE_SCRIPT_EXPLICIT=false
[[ -v CARBONET_POSTDEPLOY_ABORT_SCRIPT ]] && POSTDEPLOY_ABORT_SCRIPT_EXPLICIT=true || POSTDEPLOY_ABORT_SCRIPT_EXPLICIT=false
[[ -v CARBONET_POSTDEPLOY_AUTHORITY_SCRIPT ]] && POSTDEPLOY_AUTHORITY_SCRIPT_EXPLICIT=true || POSTDEPLOY_AUTHORITY_SCRIPT_EXPLICIT=false
[[ -v CARBONET_POSTDEPLOY_LEADER_RESOLVER ]] && POSTDEPLOY_LEADER_RESOLVER_EXPLICIT=true || POSTDEPLOY_LEADER_RESOLVER_EXPLICIT=false
POSTDEPLOY_JOURNAL_HELPER="${CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER:-/opt/resonance-data/control-plane/bin/postdeploy-attempt-journal.py}"
POSTDEPLOY_GATE_SCRIPT="${CARBONET_POSTDEPLOY_GATE_SCRIPT:-$ROOT_DIR/ops/scripts/resonance-full-screen-deploy-gate.sh}"
POSTDEPLOY_RECORD_RUNTIME_SCRIPT="${CARBONET_POSTDEPLOY_RECORD_RUNTIME_SCRIPT:-$ROOT_DIR/ops/scripts/record-runtime-release-state.sh}"
POSTDEPLOY_CHECKPOINT_SCRIPT="${CARBONET_POSTDEPLOY_CHECKPOINT_SCRIPT:-$ROOT_DIR/ops/scripts/runtime-candidate-checkpoint.sh}"
POSTDEPLOY_STAGE_SCRIPT="${CARBONET_POSTDEPLOY_STAGE_SCRIPT:-$ROOT_DIR/ops/scripts/stage-postdeploy-release-attempt.sh}"
POSTDEPLOY_ABORT_SCRIPT="${CARBONET_POSTDEPLOY_ABORT_SCRIPT:-$ROOT_DIR/ops/scripts/abort-postdeploy-release-attempt.sh}"
POSTDEPLOY_AUTHORITY_SCRIPT="${CARBONET_POSTDEPLOY_AUTHORITY_SCRIPT:-$ROOT_DIR/ops/scripts/check-postdeploy-authoritative-promotion.sh}"
POSTDEPLOY_LEADER_RESOLVER="${CARBONET_POSTDEPLOY_LEADER_RESOLVER:-$ROOT_DIR/ops/scripts/resolve-patroni-primary-pod.sh}"
FLYWAY_JOB_RUNNER="${CARBONET_FLYWAY_JOB_RUNNER:-$ROOT_DIR/ops/scripts/run-flyway-migration-job.sh}"
composite_autocompletion_gate_prepared=false
flyway_cleanup_recovery_hold=false

rebind_default_postdeploy_helpers() {
  [[ "$POSTDEPLOY_JOURNAL_HELPER_EXPLICIT" == true ]] || POSTDEPLOY_JOURNAL_HELPER="/opt/resonance-data/control-plane/bin/postdeploy-attempt-journal.py"
  [[ "$POSTDEPLOY_GATE_SCRIPT_EXPLICIT" == true ]] || POSTDEPLOY_GATE_SCRIPT="$ROOT_DIR/ops/scripts/resonance-full-screen-deploy-gate.sh"
  [[ "$POSTDEPLOY_RECORD_RUNTIME_SCRIPT_EXPLICIT" == true ]] || POSTDEPLOY_RECORD_RUNTIME_SCRIPT="$ROOT_DIR/ops/scripts/record-runtime-release-state.sh"
  [[ "$POSTDEPLOY_CHECKPOINT_SCRIPT_EXPLICIT" == true ]] || POSTDEPLOY_CHECKPOINT_SCRIPT="$ROOT_DIR/ops/scripts/runtime-candidate-checkpoint.sh"
  [[ "$POSTDEPLOY_STAGE_SCRIPT_EXPLICIT" == true ]] || POSTDEPLOY_STAGE_SCRIPT="$ROOT_DIR/ops/scripts/stage-postdeploy-release-attempt.sh"
  [[ "$POSTDEPLOY_ABORT_SCRIPT_EXPLICIT" == true ]] || POSTDEPLOY_ABORT_SCRIPT="$ROOT_DIR/ops/scripts/abort-postdeploy-release-attempt.sh"
  [[ "$POSTDEPLOY_AUTHORITY_SCRIPT_EXPLICIT" == true ]] || POSTDEPLOY_AUTHORITY_SCRIPT="$ROOT_DIR/ops/scripts/check-postdeploy-authoritative-promotion.sh"
  [[ "$POSTDEPLOY_LEADER_RESOLVER_EXPLICIT" == true ]] || POSTDEPLOY_LEADER_RESOLVER="$ROOT_DIR/ops/scripts/resolve-patroni-primary-pod.sh"
}

resolve_postdeploy_postgres_pod() {
  local resolved=""
  [[ -z "$POSTGRES_POD" ]] || return 0
  resolved="$(K8S_NAMESPACE="$NAMESPACE" bash "$POSTDEPLOY_LEADER_RESOLVER" 2>/dev/null)" \
    || return 1
  [[ "$resolved" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]] || return 1
  POSTGRES_POD="$resolved"
  return 0
}

recover_flyway_cleanup_hold_if_present() {
  local recovery_status=0 expected_hold_path actual_hold_path
  [[ -e "$FLYWAY_CLEANUP_HOLD_FILE" || -L "$FLYWAY_CLEANUP_HOLD_FILE" ]] || return 0
  expected_hold_path="$(realpath -m "$FLYWAY_CLEANUP_HOLD_ROOT/flyway-cleanup-hold.json")" || return 79
  actual_hold_path="$(realpath -m "$FLYWAY_CLEANUP_HOLD_FILE")" || return 79
  if [[ "$actual_hold_path" != "$expected_hold_path" ]]; then
    flyway_cleanup_recovery_hold=true
    echo "[auto-deploy] BLOCKED invalid Flyway cleanup-hold path: $FLYWAY_CLEANUP_HOLD_FILE" >&2
    return 79
  fi
  if [[ ! -s "$FLYWAY_JOB_RUNNER" || -L "$FLYWAY_JOB_RUNNER" ]]; then
    flyway_cleanup_recovery_hold=true
    echo "[auto-deploy] BLOCKED invalid target-bound Flyway cleanup runner: $FLYWAY_JOB_RUNNER" >&2
    return 79
  fi
  echo "[auto-deploy] reconciling Flyway cleanup hold before any attempt/checkpoint recovery: $FLYWAY_CLEANUP_HOLD_FILE"
  CARBONET_FLYWAY_CLEANUP_HOLD_FILE="$FLYWAY_CLEANUP_HOLD_FILE" \
  CARBONET_FLYWAY_CLEANUP_HOLD_TIMEOUT_SECONDS="${CARBONET_FLYWAY_CLEANUP_HOLD_TIMEOUT_SECONDS:-120}" \
  CARBONET_K8S_NAMESPACE="$NAMESPACE" \
  CARBONET_POSTDEPLOY_LEADER_RESOLVER="$POSTDEPLOY_LEADER_RESOLVER" \
  CARBONET_POSTGRES_CONTAINER="$POSTGRES_CONTAINER" \
  POSTGRES_DB="$POSTGRES_DB" POSTGRES_ADMIN_USER="$POSTGRES_USER" \
    bash "$FLYWAY_JOB_RUNNER" \
      --recover-cleanup-hold "$FLYWAY_CLEANUP_HOLD_FILE" || recovery_status=$?
  if (( recovery_status != 0 )); then
    flyway_cleanup_recovery_hold=true
    echo "[auto-deploy] BLOCKED Flyway cleanup remains unproven; deploy/rollback recovery is held (status=$recovery_status)" >&2
    return 79
  fi
  [[ ! -e "$FLYWAY_CLEANUP_HOLD_FILE" && ! -L "$FLYWAY_CLEANUP_HOLD_FILE" ]] || return 79
  echo '[auto-deploy] Flyway cleanup hold cleared after Job/Pod/session zero proof'
}

fail_bootstrap_orphan_recovery_helper() {
  echo "[auto-deploy] BLOCKED invalid target orphan-recovery helper: $1" >&2
  return 79
}

verify_bootstrap_orphan_recovery_helper() {
  local target_commit="${CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT:-}"
  local helper_real binding_root_real snapshot_dir_real actual_sha target_sha helper_mode_owner
  local installed_binding_root="${CARBONET_DEPLOY_ORPHAN_RECOVERY_BINDING_ROOT:-}"
  if [[ ! -s "$ORPHAN_RECOVERY_HELPER" || -L "$ORPHAN_RECOVERY_HELPER" ]]; then
    fail_bootstrap_orphan_recovery_helper missing-or-symlink
    return $?
  fi
  actual_sha="$(sha256sum "$ORPHAN_RECOVERY_HELPER" | awk '{print $1}')"
  if [[ -n "$target_commit" ]]; then
    if [[ ! "$target_commit" =~ ^[0-9a-f]{40}$ \
       || "$ORPHAN_RECOVERY_HELPER_EXPLICIT" != true \
       || ! "$ORPHAN_RECOVERY_HELPER_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
      fail_bootstrap_orphan_recovery_helper incomplete-target-binding
      return $?
    fi
    helper_mode_owner="$(stat -c '%a:%u' "$ORPHAN_RECOVERY_HELPER" 2>/dev/null || true)"
    helper_real="$(readlink -f "$ORPHAN_RECOVERY_HELPER" 2>/dev/null || true)"
    if [[ -n "${CARBONET_DEPLOY_SNAPSHOT_PATH:-}" ]]; then
      snapshot_dir_real="$(dirname "$(readlink -f "$CARBONET_DEPLOY_SNAPSHOT_PATH" 2>/dev/null || true)")"
      if [[ "$helper_mode_owner" != "700:$(id -u)" \
         || -z "$helper_real" || "$(dirname "$helper_real")" != "$snapshot_dir_real" ]]; then
        fail_bootstrap_orphan_recovery_helper outside-private-target-snapshot
        return $?
      fi
    elif [[ "${CARBONET_RECOVERY_ONLY:-false}" == true && -n "$installed_binding_root" ]]; then
      binding_root_real="$(readlink -f "$installed_binding_root" 2>/dev/null || true)"
      if [[ "$helper_mode_owner" != 755:0 \
         || "$(stat -c '%a:%u:%g' "$binding_root_real" 2>/dev/null || true)" != 755:0:0 \
         || -z "$helper_real" || "$(dirname "$helper_real")" != "$binding_root_real" ]]; then
        fail_bootstrap_orphan_recovery_helper outside-installed-recovery-bundle
        return $?
      fi
    else
      fail_bootstrap_orphan_recovery_helper missing-helper-binding-root
      return $?
    fi
    if ! target_sha="$(git -C "$POLICY_ROOT" show --format= --no-textconv \
      "$target_commit:ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh" 2>/dev/null \
      | sha256sum | awk '{print $1}')"; then
      fail_bootstrap_orphan_recovery_helper target-blob-unavailable
      return $?
    fi
    if [[ "$target_sha" != "$ORPHAN_RECOVERY_HELPER_SHA256" ]]; then
      fail_bootstrap_orphan_recovery_helper target-hash-mismatch
      return $?
    fi
  elif [[ -n "$ORPHAN_RECOVERY_HELPER_SHA256" \
       && ! "$ORPHAN_RECOVERY_HELPER_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
    fail_bootstrap_orphan_recovery_helper invalid-hash
    return $?
  fi
  if [[ -n "$ORPHAN_RECOVERY_HELPER_SHA256" \
     && "$actual_sha" != "$ORPHAN_RECOVERY_HELPER_SHA256" ]]; then
    fail_bootstrap_orphan_recovery_helper snapshot-hash-mismatch
    return $?
  fi
}

fail_bootstrap_legacy_automation_retirement_helper() {
  echo "[auto-deploy] BLOCKED invalid target legacy-automation retirement helper: $1" >&2
  return 79
}

# The already-installed launcher may predate this helper while still loading
# the target auto-deploy script. Bridge exactly that first rollout by extracting
# the helper blob from the authenticated target commit into the launcher's
# existing private snapshot directory. Updated launchers pass an explicit,
# pre-hashed snapshot and bypass this one-time path.
bootstrap_target_legacy_automation_retirement_helper_if_required() {
  local target_commit="${CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT:-}"
  local snapshot_path="${CARBONET_DEPLOY_SNAPSHOT_PATH:-}"
  local snapshot_dir snapshot_tmp snapshot_metadata
  [[ -n "$target_commit" && "$LEGACY_AUTOMATION_RETIRE_HELPER_EXPLICIT" != true ]] || return 0
  if [[ ! "$target_commit" =~ ^[0-9a-f]{40}$ \
     || ! -f "$snapshot_path" || -L "$snapshot_path" \
     || "$(stat -c '%a:%u' "$snapshot_path" 2>/dev/null || true)" != "700:$(id -u)" ]]; then
    fail_bootstrap_legacy_automation_retirement_helper invalid-stale-launcher-snapshot
    return $?
  fi
  snapshot_dir="$(dirname "$(readlink -f "$snapshot_path" 2>/dev/null || true)")"
  snapshot_metadata="$(stat -c '%a:%u' "$snapshot_dir" 2>/dev/null || true)"
  if [[ "$snapshot_dir" != /tmp/carbonet-auto-deploy-main.* \
     || "$snapshot_metadata" != "700:$(id -u)" ]]; then
    fail_bootstrap_legacy_automation_retirement_helper unsafe-stale-launcher-directory
    return $?
  fi
  snapshot_tmp="$(mktemp "$snapshot_dir/.retire-legacy-runtime-mutation-automation.XXXXXX")" || return 79
  if ! git -C "$POLICY_ROOT" show --format= --no-textconv \
      "$target_commit:ops/scripts/retire-legacy-runtime-mutation-automation.sh" >"$snapshot_tmp" \
     || [[ ! -s "$snapshot_tmp" ]]; then
    rm -f -- "$snapshot_tmp"
    fail_bootstrap_legacy_automation_retirement_helper target-blob-unavailable
    return $?
  fi
  chmod 0700 "$snapshot_tmp"
  LEGACY_AUTOMATION_RETIRE_HELPER="$snapshot_tmp"
  LEGACY_AUTOMATION_RETIRE_HELPER_SHA256="$(sha256sum "$snapshot_tmp" | awk '{print $1}')"
  LEGACY_AUTOMATION_RETIRE_HELPER_EXPLICIT=true
  [[ "$LEGACY_AUTOMATION_RETIRE_HELPER_SHA256" =~ ^[0-9a-f]{64}$ ]] || return 79
  echo '[auto-deploy] target legacy-automation retirement helper bootstrapped from authenticated commit'
}

verify_bootstrap_legacy_automation_retirement_helper() {
  local target_commit="${CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT:-}"
  local helper_real snapshot_dir_real actual_sha target_sha helper_mode_owner
  if [[ ! -s "$LEGACY_AUTOMATION_RETIRE_HELPER" || -L "$LEGACY_AUTOMATION_RETIRE_HELPER" ]]; then
    fail_bootstrap_legacy_automation_retirement_helper missing-or-symlink
    return $?
  fi
  actual_sha="$(sha256sum "$LEGACY_AUTOMATION_RETIRE_HELPER" | awk '{print $1}')"
  if [[ -n "$target_commit" ]]; then
    if [[ ! "$target_commit" =~ ^[0-9a-f]{40}$ \
       || "$LEGACY_AUTOMATION_RETIRE_HELPER_EXPLICIT" != true \
       || ! "$LEGACY_AUTOMATION_RETIRE_HELPER_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
      fail_bootstrap_legacy_automation_retirement_helper incomplete-target-binding
      return $?
    fi
    helper_mode_owner="$(stat -c '%a:%u' "$LEGACY_AUTOMATION_RETIRE_HELPER" 2>/dev/null || true)"
    helper_real="$(readlink -f "$LEGACY_AUTOMATION_RETIRE_HELPER" 2>/dev/null || true)"
    snapshot_dir_real="$(dirname "$(readlink -f "${CARBONET_DEPLOY_SNAPSHOT_PATH:-}" 2>/dev/null || true)")"
    if [[ "$helper_mode_owner" != "700:$(id -u)" \
       || -z "$helper_real" || "$(dirname "$helper_real")" != "$snapshot_dir_real" ]]; then
      fail_bootstrap_legacy_automation_retirement_helper outside-private-target-snapshot
      return $?
    fi
    if ! target_sha="$(git -C "$POLICY_ROOT" show --format= --no-textconv \
      "$target_commit:ops/scripts/retire-legacy-runtime-mutation-automation.sh" 2>/dev/null \
      | sha256sum | awk '{print $1}')"; then
      fail_bootstrap_legacy_automation_retirement_helper target-blob-unavailable
      return $?
    fi
    if [[ "$target_sha" != "$LEGACY_AUTOMATION_RETIRE_HELPER_SHA256" ]]; then
      fail_bootstrap_legacy_automation_retirement_helper target-hash-mismatch
      return $?
    fi
  elif [[ -n "$LEGACY_AUTOMATION_RETIRE_HELPER_SHA256" \
       && ! "$LEGACY_AUTOMATION_RETIRE_HELPER_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
    fail_bootstrap_legacy_automation_retirement_helper invalid-hash
    return $?
  fi
  if [[ -n "$LEGACY_AUTOMATION_RETIRE_HELPER_SHA256" \
     && "$actual_sha" != "$LEGACY_AUTOMATION_RETIRE_HELPER_SHA256" ]]; then
    fail_bootstrap_legacy_automation_retirement_helper snapshot-hash-mismatch
    return $?
  fi
}

# The applied-source marker drives incremental planning and is advanced for
# catalog/automation-only commits.  The runtime marker is a separate serving
# identity and advances only after a DB-authoritative runtime promotion.  All
# marker writes are same-directory, exact-target renames so a directory or
# symlink cannot silently consume the prepared file.
write_commit_marker_exact() {
  local destination="$1" commit="$2" label="$3"
  local marker_dir marker_name marker_tmp="" ok=true
  [[ "$commit" =~ ^[0-9a-f]{40}$ ]] || return 1
  marker_dir="$(dirname "$destination")"
  marker_name="$(basename "$destination")"
  [[ "$marker_name" != . && "$marker_name" != .. ]] || return 1
  mkdir -p "$marker_dir" || return 1
  marker_dir="$(realpath "$marker_dir")" || return 1
  destination="$marker_dir/$marker_name"
  if [[ -e "$destination" || -L "$destination" ]]; then
    [[ -f "$destination" && ! -L "$destination" ]] || return 1
  fi
  marker_tmp="$(mktemp "$marker_dir/.${marker_name}.${label}.XXXXXX")" || return 1
  printf '%s\n' "$commit" >"$marker_tmp" || ok=false
  [[ "$ok" == true ]] && chmod 0644 "$marker_tmp" || ok=false
  [[ "$ok" == true ]] && mv -fT -- "$marker_tmp" "$destination" || ok=false
  if [[ "$ok" != true || ! -f "$destination" || -L "$destination" \
     || "$(tr -d '[:space:]' <"$destination" 2>/dev/null || true)" != "$commit" ]]; then
    rm -f -- "$marker_tmp"
    return 1
  fi
}

write_applied_deploy_state() {
  write_commit_marker_exact "$DEPLOY_STATE_FILE" "$1" applied
}

write_runtime_deploy_state() {
  write_commit_marker_exact "$RUNTIME_DEPLOY_STATE_FILE" "$1" runtime
}

# Publish the serving release identity before the filesystem success marker.
# The helper invalidates the old DB singleton first, verifies Kubernetes
# rollout/readiness and in-pod health, stamps the exact commit annotation, and
# rereads the committed ledger.  A failure leaves evidence fail-closed and the
# success marker untouched.
record_runtime_release_state() {
  local commit="$1" mode="${2:-mutate}" externally_verified_template_sha256="${3:-}"
  local observe_only=false expected_template_sha256=""
  [[ "$mode" != observe-only ]] || observe_only=true
  if [[ -n "$externally_verified_template_sha256" ]]; then
    [[ "$mode" == recovery-promoted \
       && "$externally_verified_template_sha256" =~ ^[0-9a-f]{64}$ ]] || return 1
    expected_template_sha256="$externally_verified_template_sha256"
  elif [[ "$observe_only" == true ]]; then
    [[ -f "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" && ! -L "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]] || return 1
    expected_template_sha256="$(python3 "$POSTDEPLOY_JOURNAL_HELPER" \
      --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read | jq -r \
      --arg commit "$commit" 'select(.baseCommit==$commit)|.rollback.podTemplateSha256 // empty')" || return 1
  else
    [[ -f "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" && ! -L "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" ]] || return 1
    expected_template_sha256="$(jq -r --arg commit "$commit" \
      'select(.schemaVersion==1 and .stage=="RUNTIME_CANDIDATE_READY" and .targetCommit==$commit) | .podTemplateSha256 // empty' \
      "$RUNTIME_CANDIDATE_CHECKPOINT_FILE")" || return 1
  fi
  [[ "$expected_template_sha256" =~ ^[0-9a-f]{64}$ ]] || return 1
  CARBONET_DEPLOY_ROOT="$ROOT_DIR" \
  CARBONET_K8S_NAMESPACE="$NAMESPACE" \
  CARBONET_K8S_DEPLOYMENT="$DEPLOYMENT" \
  CARBONET_K8S_CONTAINER="${CARBONET_K8S_CONTAINER:-carbonet-runtime}" \
  POSTGRES_DB="$POSTGRES_DB" \
  POSTGRES_ADMIN_USER="$POSTGRES_USER" \
  CARBONET_RUNTIME_LEDGER_OBSERVE_ONLY="$observe_only" \
  CARBONET_RUNTIME_EXPECTED_TEMPLATE_SHA256="$expected_template_sha256" \
    bash "$POSTDEPLOY_RECORD_RUNTIME_SCRIPT" "$commit"
}

invalidate_runtime_release_state_once() {
  CARBONET_DEPLOY_ROOT="$ROOT_DIR" \
  CARBONET_K8S_NAMESPACE="$NAMESPACE" \
  POSTGRES_DB="$POSTGRES_DB" \
  POSTGRES_ADMIN_USER="$POSTGRES_USER" \
    bash "$POSTDEPLOY_RECORD_RUNTIME_SCRIPT" --invalidate
}

invalidate_runtime_release_state() {
  local attempts="${CARBONET_RUNTIME_LEDGER_INVALIDATE_ATTEMPTS:-3}"
  local attempt ledger_pod ledger_count invalidate_status
  [[ "$attempts" =~ ^[1-9][0-9]*$ ]] || return 1
  for ((attempt=1; attempt<=attempts; attempt++)); do
    invalidate_status=0
    invalidate_runtime_release_state_once || invalidate_status=$?
    ledger_pod="$(K8S_NAMESPACE="$NAMESPACE" bash "$POSTDEPLOY_LEADER_RESOLVER" 2>/dev/null || true)"
    if [[ -n "$ledger_pod" ]]; then
      ledger_count="$(kubectl -n "$NAMESPACE" exec "$ledger_pod" -c "$POSTGRES_CONTAINER" -- \
        psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt -v ON_ERROR_STOP=1 \
          -c "select count(*) from framework_runtime_release_state where release_key='CARBONET_RUNTIME'" 2>/dev/null || true)"
      if [[ "$ledger_count" == 0 ]]; then
        echo "[auto-deploy] runtime ledger invalidation verified attempt=$attempt/$attempts helperStatus=$invalidate_status"
        return 0
      fi
    fi
    (( attempt == attempts )) || sleep 0.2
  done
  echo "[auto-deploy] FAIL runtime ledger remains present or unreadable after attempts=$attempts" >&2
  return 1
}

# Promotion is authoritative only when the immutable promotion row is bound to
# the exact current runtime-ledger identity for the same source commit.  The
# filesystem marker is deliberately absent from this decision: it is a derived
# cache which may lag a committed DB transaction after a signal or failed mv.
postdeploy_authoritative_promotion_status() {
  local source_commit="$1"
  local candidate_id="${2:-}"
  local outcome="" authority_status=0
  [[ "$source_commit" =~ ^[0-9a-f]{40}$ ]] || return 2
  [[ -z "$candidate_id" || "$candidate_id" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] || return 2
  outcome="$(CARBONET_K8S_NAMESPACE="$NAMESPACE" \
  CARBONET_POSTGRES_CONTAINER="$POSTGRES_CONTAINER" \
  POSTGRES_DB="$POSTGRES_DB" POSTGRES_ADMIN_USER="$POSTGRES_USER" \
  RESONANCE_POSTGRES_LEADER_POD="${POSTGRES_POD:-}" \
    bash "$POSTDEPLOY_AUTHORITY_SCRIPT" \
      "$ROOT_DIR" "$source_commit" "$candidate_id")" || authority_status=$?
  POSTDEPLOY_AUTHORITY_OUTCOME="$(printf '%s' "$outcome" | tr -d '[:space:]')"
  return "$authority_status"
}

write_postdeploy_recovery_state() {
  local destination="$1" reason="$2" state_dir state_name state_tmp=""
  local applied_marker="" runtime_marker="" ok=true
  state_dir="$(dirname "$destination")"
  state_name="$(basename "$destination")"
  mkdir -p "$state_dir" || return 1
  state_tmp="$(mktemp "$state_dir/.${state_name}.XXXXXX")" || return 1
  applied_marker="$(tr -d '[:space:]' 2>/dev/null <"$DEPLOY_STATE_FILE" || true)"
  runtime_marker="$(tr -d '[:space:]' 2>/dev/null <"$RUNTIME_DEPLOY_STATE_FILE" || true)"
  printf 'schemaVersion=1\ntargetCommit=%s\ncandidateId=%s\nreason=%s\nobservedAppliedMarker=%s\nobservedRuntimeMarker=%s\n' \
    "$target_commit" "$postdeploy_candidate_id" "$reason" "$applied_marker" "$runtime_marker" >"$state_tmp" || ok=false
  [[ "$ok" == true ]] && chmod 0600 "$state_tmp" || ok=false
  if [[ -e "$destination" || -L "$destination" ]]; then
    [[ -f "$destination" && ! -L "$destination" ]] || ok=false
  fi
  [[ "$ok" == true ]] && mv -fT -- "$state_tmp" "$destination" || ok=false
  if [[ "$ok" != true || ! -f "$destination" || -L "$destination" \
     || "$(stat -c '%a' "$destination" 2>/dev/null)" != 600 \
     || "$(sed -n '2p' "$destination" 2>/dev/null)" != "targetCommit=$target_commit" \
     || "$(sed -n '4p' "$destination" 2>/dev/null)" != "reason=$reason" ]]; then
    rm -f -- "$state_tmp"
    return 1
  fi
}

write_postdeploy_promotion_quarantine() {
  if [[ "${attempt_recovery_quarantine_deferred:-false}" == true ]]; then
    [[ -f "$RUNTIME_LEDGER_QUARANTINE_FILE" && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" \
       && "$(sha256sum "$RUNTIME_LEDGER_QUARANTINE_FILE" | awk '{print $1}')" == "$attempt_recovery_quarantine_hash" ]] || return 1
    echo "[auto-deploy] retained pinned durable-attempt quarantine; additionalReason=$1" >&2
    return 1
  fi
  if [[ "${legacy_false_discovery_quarantine_deferred:-false}" == true ]]; then
    [[ -f "$RUNTIME_LEDGER_QUARANTINE_FILE" && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" \
       && "$(sha256sum "$RUNTIME_LEDGER_QUARANTINE_FILE" | awk '{print $1}')" == "$legacy_false_discovery_quarantine_hash" ]] || return 1
    echo "[auto-deploy] retained pinned legacy false-discovery quarantine; additionalReason=$1" >&2
    return 1
  fi
  write_postdeploy_recovery_state "$RUNTIME_LEDGER_QUARANTINE_FILE" "$1"
}

write_postdeploy_marker_pending() {
  write_postdeploy_recovery_state "$POSTDEPLOY_MARKER_PENDING_FILE" "${1:-DB_PROMOTED_MARKER_PENDING}"
}

clear_postdeploy_marker_pending() {
  local expected_commit="${1:-$target_commit}"
  [[ -f "$POSTDEPLOY_MARKER_PENDING_FILE" && ! -L "$POSTDEPLOY_MARKER_PENDING_FILE" ]] || return 0
  grep -Fx "targetCommit=$expected_commit" "$POSTDEPLOY_MARKER_PENDING_FILE" >/dev/null 2>&1 || return 0
  rm -f -- "$POSTDEPLOY_MARKER_PENDING_FILE"
}

retire_matching_runtime_quarantine() {
  local expected_candidate="${1:-$postdeploy_candidate_id}" expected_source="${2:-$target_commit}"
  local observed_candidate observed_source destination observed_hash
  [[ -e "$RUNTIME_LEDGER_QUARANTINE_FILE" || -L "$RUNTIME_LEDGER_QUARANTINE_FILE" ]] || return 0
  if [[ "${attempt_recovery_quarantine_deferred:-false}" == true ]]; then
    [[ -f "$RUNTIME_LEDGER_QUARANTINE_FILE" && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" \
       && "$(stat -c '%a:%u' "$RUNTIME_LEDGER_QUARANTINE_FILE" 2>/dev/null)" == "600:$(id -u)" ]] \
      || return 1
    observed_hash="$(sha256sum "$RUNTIME_LEDGER_QUARANTINE_FILE" 2>/dev/null | awk '{print $1}')" || return 1
    [[ "$expected_candidate" == "$attempt_recovery_quarantine_candidate" \
       && "$expected_source" == "$attempt_recovery_quarantine_target" \
       && "$observed_hash" == "$attempt_recovery_quarantine_hash" ]] || return 1
  fi
  [[ -f "$RUNTIME_LEDGER_QUARANTINE_FILE" && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" \
     && "$(stat -c '%a' "$RUNTIME_LEDGER_QUARANTINE_FILE" 2>/dev/null)" == 600 ]] || return 1
  observed_source="$(sed -n 's/^targetCommit=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE" 2>/dev/null || true)"
  observed_candidate="$(sed -n 's/^candidateId=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE" 2>/dev/null || true)"
  [[ "$observed_source" == "$expected_source" && "$observed_candidate" == "$expected_candidate" ]] || return 1
  mkdir -p "$POSTDEPLOY_LEGACY_RETIRE_DIR"
  destination="$POSTDEPLOY_LEGACY_RETIRE_DIR/${expected_candidate}.recovery-quarantine.state"
  if [[ -e "$destination" || -L "$destination" ]]; then
    [[ -f "$destination" && ! -L "$destination" \
       && "$(stat -c '%a' "$destination" 2>/dev/null)" == 600 \
       && "$(sha256sum "$destination" | awk '{print $1}')" == "$(sha256sum "$RUNTIME_LEDGER_QUARANTINE_FILE" | awk '{print $1}')" ]] || return 1
    rm -f -- "$RUNTIME_LEDGER_QUARANTINE_FILE"
  else
    mv -T -- "$RUNTIME_LEDGER_QUARANTINE_FILE" "$destination" || return 1
    chmod 0600 "$destination" || return 1
  fi
  sync -f "$(dirname "$RUNTIME_LEDGER_QUARANTINE_FILE")" 2>/dev/null || true
}

reconcile_postdeploy_candidate_after_failure() {
  local authority_status=2 applied_marker="" runtime_marker=""
  if [[ "$postdeploy_candidate_authority_unknown" == true ]]; then
    if [[ ! -f "$RUNTIME_LEDGER_QUARANTINE_FILE" || -L "$RUNTIME_LEDGER_QUARANTINE_FILE" \
       || "$(stat -c '%a' "$RUNTIME_LEDGER_QUARANTINE_FILE" 2>/dev/null)" != 600 ]]; then
      write_postdeploy_promotion_quarantine 'PROMOTION_DB_CHECK_UNAVAILABLE' \
        || echo '[auto-deploy] FAIL unable to persist promotion DB-check quarantine' >&2
    fi
    return 79
  fi

  if postdeploy_authoritative_promotion_status "$target_commit" "$postdeploy_candidate_id"; then authority_status=0; else authority_status=$?; fi
  case "$authority_status" in
    0)
      # COMMIT may precede a signal or either marker rename. Preserve current
      # evidence/ledger and leave a durable, mode-0600 retry obligation.
      postdeploy_candidate_promoted=true
      applied_marker="$(tr -d '[:space:]' 2>/dev/null <"$DEPLOY_STATE_FILE" || true)"
      runtime_marker="$(tr -d '[:space:]' 2>/dev/null <"$RUNTIME_DEPLOY_STATE_FILE" || true)"
      if [[ "$applied_marker" == "$target_commit" && "$runtime_marker" == "$target_commit" ]]; then
        clear_postdeploy_marker_pending || true
      elif ! write_postdeploy_marker_pending 'DB_PROMOTED_MARKER_PENDING'; then
        write_postdeploy_promotion_quarantine 'MARKER_PENDING_STATE_WRITE_FAILED' || true
        return 79
      fi
      echo '[auto-deploy] DB-authoritative promotion confirmed during cleanup; ledger preserved' >&2
      return 0
      ;;
    1)
      # Only a successful DB check proving no current promotion may clear the
      # runtime ledger. Marker equality is never promotion authority.
      if ! invalidate_runtime_release_state; then
        write_postdeploy_promotion_quarantine 'LEDGER_INVALIDATION_UNVERIFIED' \
          || echo '[auto-deploy] FAIL unable to persist runtime-ledger quarantine evidence' >&2
        echo '[auto-deploy] FAIL candidate ledger invalidation unverified; deployment quarantined' >&2
        return 79
      fi
      return 0
      ;;
    *)
      postdeploy_candidate_authority_unknown=true
      write_postdeploy_promotion_quarantine 'PROMOTION_DB_CHECK_UNAVAILABLE' \
        || echo '[auto-deploy] FAIL unable to persist promotion DB-check quarantine' >&2
      echo '[auto-deploy] FAIL promotion DB check unavailable; marker ignored and ledger preserved under quarantine' >&2
      return 79
      ;;
  esac
}

record_deploy_performance() {
  local mode="$1"
  local elapsed_ms=$(( $(monotonic_milliseconds) - DEPLOY_STARTED_EPOCH_MILLISECONDS ))
  CARBONET_DEPLOY_ROOT="$ROOT_DIR" \
  CARBONET_DEPLOY_PHASE_FILE="$DEPLOY_PHASE_FILE" \
    bash "$ROOT_DIR/ops/scripts/record-deploy-performance.sh" \
      "$mode" "$target_commit" "$elapsed_ms"
}

legacy_false_discovery_quarantine_deferred=false
legacy_false_discovery_quarantine_hash=""
legacy_false_discovery_quarantine_target=""
legacy_false_discovery_quarantine_candidate=""
legacy_false_discovery_quarantine_baseline=""

defer_exact_legacy_false_discovery_quarantine() {
  local keys expected_keys reason applied runtime candidate target
  [[ -f "$RUNTIME_LEDGER_QUARANTINE_FILE" && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" \
     && "$(stat -c '%a' "$RUNTIME_LEDGER_QUARANTINE_FILE" 2>/dev/null)" == 600 \
     && "$(stat -c '%u' "$RUNTIME_LEDGER_QUARANTINE_FILE" 2>/dev/null)" == "$(id -u)" ]] || return 1
  expected_keys=$'candidateId\nobservedAppliedMarker\nobservedRuntimeMarker\nreason\nschemaVersion\ntargetCommit'
  keys="$(sed -n 's/^\([A-Za-z][A-Za-z0-9]*\)=.*/\1/p' "$RUNTIME_LEDGER_QUARANTINE_FILE" | LC_ALL=C sort)"
  [[ "$keys" == "$expected_keys" && "$(awk 'END{print NR}' "$RUNTIME_LEDGER_QUARANTINE_FILE")" == 6 ]] || return 1
  [[ "$(sed -n 's/^schemaVersion=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")" == 1 ]] || return 1
  target="$(sed -n 's/^targetCommit=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")"
  candidate="$(sed -n 's/^candidateId=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")"
  reason="$(sed -n 's/^reason=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")"
  applied="$(sed -n 's/^observedAppliedMarker=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")"
  runtime="$(sed -n 's/^observedRuntimeMarker=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")"
  [[ "$target" =~ ^[0-9a-f]{40}$ && "$candidate" =~ ^postdeploy:${target:0:12}:[A-Za-z0-9._:-]{12,140}$ \
     && "$reason" == LEGACY_PARTIAL_STATE_CONTRACT_INVALID \
     && "$applied" =~ ^[0-9a-f]{40}$ && "$runtime" == "$applied" ]] || return 1
  [[ ! -e "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" && ! -L "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]] || return 1
  legacy_false_discovery_quarantine_deferred=true
  legacy_false_discovery_quarantine_hash="$(sha256sum "$RUNTIME_LEDGER_QUARANTINE_FILE" | awk '{print $1}')"
  legacy_false_discovery_quarantine_target="$target"
  legacy_false_discovery_quarantine_candidate="$candidate"
  legacy_false_discovery_quarantine_baseline="$applied"
  [[ "$legacy_false_discovery_quarantine_hash" =~ ^[0-9a-f]{64}$ ]]
}

attempt_recovery_quarantine_deferred=false
attempt_recovery_quarantine_hash=""
attempt_recovery_quarantine_target=""
attempt_recovery_quarantine_candidate=""

defer_exact_durable_attempt_recovery_quarantine() {
  local keys expected_keys reason applied runtime candidate target journal
  [[ -f "$RUNTIME_LEDGER_QUARANTINE_FILE" && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" \
     && "$(stat -c '%a' "$RUNTIME_LEDGER_QUARANTINE_FILE" 2>/dev/null)" == 600 \
     && "$(stat -c '%u' "$RUNTIME_LEDGER_QUARANTINE_FILE" 2>/dev/null)" == "$(id -u)" ]] || return 1
  expected_keys=$'candidateId\nobservedAppliedMarker\nobservedRuntimeMarker\nreason\nschemaVersion\ntargetCommit'
  keys="$(sed -n 's/^\([A-Za-z][A-Za-z0-9]*\)=.*/\1/p' "$RUNTIME_LEDGER_QUARANTINE_FILE" | LC_ALL=C sort)"
  [[ "$keys" == "$expected_keys" && "$(awk 'END{print NR}' "$RUNTIME_LEDGER_QUARANTINE_FILE")" == 6 ]] || return 1
  [[ "$(sed -n 's/^schemaVersion=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")" == 1 ]] || return 1
  target="$(sed -n 's/^targetCommit=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")"
  candidate="$(sed -n 's/^candidateId=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")"
  reason="$(sed -n 's/^reason=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")"
  applied="$(sed -n 's/^observedAppliedMarker=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")"
  runtime="$(sed -n 's/^observedRuntimeMarker=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")"
  [[ "$target" =~ ^[0-9a-f]{40}$ && "$candidate" =~ ^[A-Za-z0-9._:-]{12,160}$ \
     && "$applied" =~ ^[0-9a-f]{40}$ && "$runtime" =~ ^[0-9a-f]{40}$ ]] || return 1
  case "$reason" in
    ATTEMPT_DB_STAGE_UNAVAILABLE|ATTEMPT_ABORT_PROMOTION_RACE_UNKNOWN|PROMOTION_DB_CHECK_UNAVAILABLE|RECONCILED_ATTEMPT_DB_RECONFIRM_FAILED|ABORTED_ATTEMPT_DB_RECONFIRM_FAILED|PERSISTENT_PROMOTED_ATTEMPT_DIVERGED) ;;
    *) return 1 ;;
  esac
  journal="$(CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_OWNER_UID="$(id -u)" \
    python3 "$POSTDEPLOY_JOURNAL_HELPER" --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read 2>/dev/null)" \
    || return 1
  jq -e --arg candidate "$candidate" --arg source "$target" \
    --arg applied "$applied" --arg runtime "$runtime" '
      .schemaVersion==2 and .candidateId==$candidate and .attemptId==$candidate
      and .sourceCommit==$source
      and (.lifecycleStatus=="STAGED" or .lifecycleStatus=="PROMOTED" or .lifecycleStatus=="ABORTED")
      and (($applied==.baseCommit or $applied==.sourceCommit)
           and ($runtime==.baseCommit or $runtime==.sourceCommit))
    ' <<<"$journal" >/dev/null || return 1
  attempt_recovery_quarantine_deferred=true
  attempt_recovery_quarantine_hash="$(sha256sum "$RUNTIME_LEDGER_QUARANTINE_FILE" | awk '{print $1}')"
  attempt_recovery_quarantine_target="$target"
  attempt_recovery_quarantine_candidate="$candidate"
  [[ "$attempt_recovery_quarantine_hash" =~ ^[0-9a-f]{64}$ ]]
}
mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if [[ "${CARBONET_RECOVERY_ONLY:-false}" == true ]]; then
  flock -w "${CARBONET_RECOVERY_LOCK_WAIT_SECONDS:-60}" 9 \
    || { echo '[auto-deploy] recovery lock wait expired' >&2; exit 75; }
else
  flock -n 9 || { echo "[auto-deploy] another deployment is running"; exit 0; }
fi
# Retire historical cron/systemd mutation paths from the exact target snapshot
# before any cleanup recovery, checkpoint, backup, Flyway, build, or Kubernetes
# access. Retirement is intentionally one-way: a later deploy failure must
# never restore an unsafe scheduler or re-enable a duplicate recovery unit.
bootstrap_target_legacy_automation_retirement_helper_if_required || exit $?
verify_bootstrap_legacy_automation_retirement_helper || exit $?
if ! bash "$LEGACY_AUTOMATION_RETIRE_HELPER"; then
  echo '[auto-deploy] BLOCKED legacy runtime mutation automation retirement failed before platform work' >&2
  exit 79
fi
record_deploy_phase "legacy_automation_retirement"
# A cleanup-unproven Flyway backend is mutually exclusive with every durable
# attempt/checkpoint recovery writer. The same deploy flock that serializes Job
# creation must be held before reconciling its exact Job/application; otherwise
# a second invocation could terminate the active migration owned by the first.
recover_flyway_cleanup_hold_if_present || exit $?
mkdir -p \
  "$(dirname "$LOCK_FILE")" \
  "$(dirname "$DEPLOY_STATE_FILE")" \
  "$(dirname "$RUNTIME_DEPLOY_STATE_FILE")" \
  "$(dirname "$BACKSTAGE_DEPLOY_STATE_FILE")" \
  "$(dirname "$RUNTIME_CANDIDATE_CHECKPOINT_FILE")" \
  "$(dirname "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE")" \
  "$POSTDEPLOY_LEGACY_RETIRE_DIR" \
  "$(dirname "$RUNTIME_LEDGER_QUARANTINE_FILE")"
chmod 0700 "$POSTDEPLOY_LEGACY_RETIRE_DIR"
verify_bootstrap_orphan_recovery_helper || exit $?
orphan_recovery_target_commit="${CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT:-${CARBONET_RECOVERY_TARGET_COMMIT:-}}"
if [[ -n "$orphan_recovery_target_commit" ]]; then
  CARBONET_ORPHAN_RECOVERY_TARGET_COMMIT="$orphan_recovery_target_commit" \
    bash "$ORPHAN_RECOVERY_HELPER" "$ROOT_DIR"
else
  bash "$ORPHAN_RECOVERY_HELPER" "$ROOT_DIR"
fi
if [[ -s "$RUNTIME_LEDGER_QUARANTINE_FILE" \
   && ( "${CARBONET_RECOVERY_ONLY:-false}" != true \
        || ! -s "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ) ]]; then
  if defer_exact_durable_attempt_recovery_quarantine; then
    echo "[auto-deploy] exact durable-attempt quarantine deferred until journal recovery hash=$attempt_recovery_quarantine_hash"
  elif defer_exact_legacy_false_discovery_quarantine; then
    echo "[auto-deploy] exact legacy false-discovery quarantine deferred until pair retirement hash=$legacy_false_discovery_quarantine_hash"
  else
    echo "[auto-deploy] BLOCKED unresolved runtime-ledger invalidation quarantine: $RUNTIME_LEDGER_QUARANTINE_FILE" >&2
    exit 79
  fi
fi
cd "$ROOT_DIR"

# Recovery deliberately bypasses every ordinary deploy-preparation writer:
# worktree repair/rebuild, remote selection, plan generation, status publish,
# capacity/Kyverno checks, backup pruning, and platform preflight.  Its target
# identity comes only from the strict durable journal supplied by the handler.
if [[ "${CARBONET_RECOVERY_ONLY:-false}" != true ]]; then
# The persistent incremental-build worktree is reused even when the platform
# preflight cache is warm. Repair its ownership before the no-change exit and
# before any cache branch so one root-owned artifact cannot poison all later
# incremental builds.
deploy_worktree_root="$(realpath -m "${CARBONET_CLEAN_WORKTREE_BASE:-${CARBONET_DEPLOY_ORIGINAL_ROOT:-$ROOT_DIR}/var/deploy-worktrees}")"
persistent_build_worktree="$deploy_worktree_root/runtime-build"
repair_persistent_build_worktree_ownership() {
  local persistent_real
  persistent_real="$(realpath -m "$persistent_build_worktree")"
  case "$persistent_real" in
    "$deploy_worktree_root"/*) ;;
    *)
      echo "[auto-deploy] refusing unsafe persistent worktree path: $persistent_real" >&2
      exit 23
      ;;
  esac
  [[ -d "$persistent_real" ]] || return 0
  if find "$persistent_real" ! -user "$(id -u)" -print -quit 2>/dev/null | grep -q .; then
    echo "[auto-deploy] repairing persistent deployment worktree ownership: $persistent_real"
    sudo -n chown -R "$(id -u):$(id -g)" "$persistent_real" || {
      echo "[auto-deploy] persistent worktree ownership repair failed ($persistent_real)" >&2
      exit 24
    }
  fi
}
repair_persistent_build_worktree_ownership

# A killed `git worktree remove` can delete the repository-side metadata while
# leaving the 3-4 GB build directory and its `.git` pointer behind. Merely
# checking for that pointer then sends every later deployment into
# `fatal: not a git repository`. Try Git's non-destructive repair first; if the
# directory is still not a registered worktree, remove only the exact,
# disposable runtime-build path so the normal creation branch can reconstruct
# it. Generated caches are sacrificed only for this corrupt state.
recover_invalid_persistent_build_worktree() {
  local repository_root persistent_real registered_root
  repository_root="${CARBONET_DEPLOY_ORIGINAL_ROOT:-$ROOT_DIR}"
  persistent_real="$(realpath -m "$persistent_build_worktree")"
  case "$persistent_real" in
    "$deploy_worktree_root"/runtime-build) ;;
    *)
      echo "[auto-deploy] refusing unsafe persistent worktree recovery path: $persistent_real" >&2
      exit 23
      ;;
  esac
  [[ -e "$persistent_real" ]] || return 0

  registered_root="$(git -C "$persistent_real" rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "$registered_root" && "$(realpath -m "$registered_root")" == "$persistent_real" ]]; then
    return 0
  fi

  echo "[auto-deploy] stale persistent worktree metadata detected; attempting repair: $persistent_real"
  git -C "$repository_root" worktree repair "$persistent_real" >/dev/null 2>&1 || true
  registered_root="$(git -C "$persistent_real" rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "$registered_root" && "$(realpath -m "$registered_root")" == "$persistent_real" ]]; then
    echo "[auto-deploy] persistent worktree metadata repaired without cache removal"
    return 0
  fi

  echo "[auto-deploy] rebuilding invalid persistent worktree; generated build cache will be cold once"
  git -C "$repository_root" worktree remove --force "$persistent_real" >/dev/null 2>&1 || true
  rm -rf -- "$persistent_real"
  git -C "$repository_root" worktree prune
}
recover_invalid_persistent_build_worktree

current_commit="$(git rev-parse HEAD)"
deployed_commit="$(cat "$DEPLOY_STATE_FILE" 2>/dev/null || true)"
if ! git cat-file -e "${deployed_commit}^{commit}" 2>/dev/null; then
  deployed_commit="$current_commit"
fi
runtime_deployed_commit="$(tr -d '[:space:]' 2>/dev/null <"$RUNTIME_DEPLOY_STATE_FILE" || true)"
runtime_marker_bootstrap_allowed=false
if [[ ! -e "$RUNTIME_DEPLOY_STATE_FILE" && ! -L "$RUNTIME_DEPLOY_STATE_FILE" ]]; then
  runtime_deployed_commit=""
  runtime_marker_bootstrap_allowed=true
elif [[ ! -f "$RUNTIME_DEPLOY_STATE_FILE" || -L "$RUNTIME_DEPLOY_STATE_FILE" \
     || ! "$runtime_deployed_commit" =~ ^[0-9a-f]{40}$ ]]; then
  runtime_deployed_commit="__INVALID_RUNTIME_MARKER__"
fi
desired_commit="$(tr -d '[:space:]' <"$DESIRED_REVISION_FILE" 2>/dev/null || true)"
recovery_target_commit="${CARBONET_RECOVERY_TARGET_COMMIT:-}"
if [[ "${CARBONET_RECOVERY_ONLY:-false}" == true ]]; then
  [[ "$recovery_target_commit" =~ ^[0-9a-f]{40}$ \
     && "$(git cat-file -t "$recovery_target_commit" 2>/dev/null || true)" == commit ]] || {
    echo '[auto-deploy] recovery-only target is absent from the local object store' >&2
    exit 79
  }
  target_commit="$recovery_target_commit"
  echo "[auto-deploy] recovery-only target reused from durable journal; remote fetch bypassed"
elif [[ "$desired_commit" =~ ^[0-9a-f]{40}$ \
   && "$desired_commit" != "$deployed_commit" ]] &&
  git cat-file -e "${desired_commit}^{commit}" 2>/dev/null &&
  [[ "$(git rev-parse "$REMOTE/$BRANCH" 2>/dev/null || true)" == "$desired_commit" ]]; then
  target_commit="$desired_commit"
  echo "[auto-deploy] target revision reused from authenticated webhook cache"
else
  # The ten-minute timer is the recovery net for a missed webhook. It always
  # reaches the remote when no new authenticated local target is available.
  git fetch --quiet --no-tags "$REMOTE" \
    "+refs/heads/$BRANCH:refs/remotes/$REMOTE/$BRANCH"
  target_commit="$(git rev-parse "$REMOTE/$BRANCH")"
fi
record_deploy_phase "remote_change_detection"
no_change_candidate=false
no_change_recovery_hint=false
if [[ "$deployed_commit" == "$target_commit" ]]; then
  no_change_candidate=true
  early_runtime_marker=""
  if [[ -f "$RUNTIME_DEPLOY_STATE_FILE" && ! -L "$RUNTIME_DEPLOY_STATE_FILE" ]]; then
    early_runtime_marker="$(tr -d '[:space:]' <"$RUNTIME_DEPLOY_STATE_FILE" 2>/dev/null || true)"
  fi
  early_persistent_gate_active="$FULL_SCREEN_GATE_STATE_DIR/active.env"
  if [[ -e "$POSTDEPLOY_MARKER_PENDING_FILE" || -L "$POSTDEPLOY_MARKER_PENDING_FILE" \
     || -s "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" \
     || -s "$early_persistent_gate_active" ]]; then
    no_change_recovery_hint=true
  fi
  # A power loss after finalizer promotion but before ACTIVATE can leave the
  # DB gate safely PREPARED with no attempt journal. Read the authoritative
  # state before taking the no-change exit; a PREPARED or unreadable installed
  # gate forces the normal recovery path, while ACTIVE adds no recurring work.
  early_composite_gate_table="UNKNOWN"
  early_composite_gate_status="UNKNOWN"
  early_composite_gate_candidate=""
  if resolve_postdeploy_postgres_pod; then
    early_composite_gate_table="$(printf '%s\n' \
      "select coalesce(to_regclass('public.integrated_design_autocompletion_gate')::text,'ABSENT');" | \
      timeout 4s kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt \
          -v ON_ERROR_STOP=1 2>/dev/null || true)"
    early_composite_gate_table="$(tr -d '[:space:]' <<<"$early_composite_gate_table")"
    if [[ "$early_composite_gate_table" == *integrated_design_autocompletion_gate ]]; then
      early_composite_gate_record="$(printf '%s\n' \
        "select approval_status||E'\\t'||coalesce(postdeploy_candidate_id,'') from integrated_design_autocompletion_gate where gate_key='GLOBAL';" | \
        timeout 4s kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
          psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt \
            -v ON_ERROR_STOP=1 2>/dev/null || true)"
      early_composite_gate_record="$(tr -d '\r\n' <<<"$early_composite_gate_record")"
      IFS=$'\t' read -r early_composite_gate_status early_composite_gate_candidate \
        <<<"$early_composite_gate_record"
    elif [[ "$early_composite_gate_table" == ABSENT ]]; then
      early_composite_gate_status="ABSENT"
    fi
  fi
  if [[ "$early_composite_gate_status" == PREPARED \
     || "$early_composite_gate_status" == UNKNOWN || -z "$early_composite_gate_status" ]]; then
    no_change_recovery_hint=true
  fi
  early_deployment_json=""
  early_kubectl_status=0
  early_deployment_json="$(timeout 4s kubectl --request-timeout=3s -n "$NAMESPACE" \
    get "deployment/$DEPLOYMENT" -o json 2>/dev/null)" || early_kubectl_status=$?
  early_runtime_annotation="$(jq -r '.metadata.annotations["resonance.ai/target-commit"] // empty' \
    <<<"$early_deployment_json" 2>/dev/null || true)"
  if [[ "$early_kubectl_status" == 0 && "$early_runtime_annotation" =~ ^[0-9a-f]{40}$ \
     && ( ! "$early_runtime_marker" =~ ^[0-9a-f]{40}$ \
          || "$early_runtime_annotation" != "$early_runtime_marker" ) ]]; then
    no_change_recovery_hint=true
  fi
  if [[ "$no_change_recovery_hint" != true \
     && "$early_kubectl_status" == 0 \
     && "$early_runtime_marker" =~ ^[0-9a-f]{40}$ \
     && "$early_runtime_annotation" == "$early_runtime_marker" ]]; then
    no_change_elapsed_ms=$(( $(monotonic_milliseconds) - DEPLOY_STARTED_EPOCH_MILLISECONDS ))
    echo "[auto-deploy] already deployed with coherent runtime identity: $deployed_commit (${no_change_elapsed_ms}ms)"
    if [[ -s "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" \
       && -f "$POSTDEPLOY_CHECKPOINT_SCRIPT" ]]; then
      CARBONET_RUNTIME_CANDIDATE_CHECKPOINT_FILE="$RUNTIME_CANDIDATE_CHECKPOINT_FILE" \
      CARBONET_CHECKPOINT_TARGET_COMMIT="$target_commit" \
        bash "$POSTDEPLOY_CHECKPOINT_SCRIPT" clear-success ||
        echo "[auto-deploy] WARN stale runtime checkpoint was retained for operator review" >&2
    fi
    rm -f -- "$DEPLOY_PHASE_FILE" "${CARBONET_DEPLOY_SNAPSHOT_PATH:-}"
    exit 0
  fi
  if [[ "$no_change_recovery_hint" != true ]]; then
    echo '[auto-deploy] RETRY no-change runtime identity read is temporarily unavailable; durable state unchanged' >&2
    exit 75
  fi
  echo "[auto-deploy] no-change fast path deferred for DB-authoritative runtime recovery"
fi

# Publish the in-flight state before any mutable platform work. Authenticated
# E2E verifies RUNNING, and record-deploy-performance atomically promotes it to
# SUCCESS only after every fail-closed gate completes.
deploy_status_file="${CARBONET_DEPLOY_STATUS_FILE:-/opt/resonance-data/deploy/deploy-status.json}"
jq -n \
  --arg checkedAt "$(date -Iseconds)" \
  --arg status RUNNING \
  --arg category NONE \
  --arg targetCommit "$target_commit" \
  '{checkedAt:$checkedAt,status:$status,category:$category,targetCommit:$targetCommit,retryAllowed:false,retryAttempted:false,evidence:""}' \
  >"${deploy_status_file}.tmp"
chmod 0644 "${deploy_status_file}.tmp"
mv "${deploy_status_file}.tmp" "$deploy_status_file"

eval "$(bash "$PLAN_SCRIPT" "$deployed_commit" "$target_commit" --format env)"
PLAN_BACKSTAGE_REQUIRED="${PLAN_BACKSTAGE_REQUIRED:-false}"
record_deploy_phase "incremental_plan"
echo "[auto-deploy] incremental plan: runtime=$PLAN_RUNTIME_REQUIRED frontend=$PLAN_FRONTEND_REQUIRED backend=$PLAN_BACKEND_REQUIRED database=$PLAN_DATABASE_REQUIRED backstage=$PLAN_BACKSTAGE_REQUIRED"
echo "[auto-deploy] selected checks: $PLAN_TESTS ($PLAN_REASONS)"
platform_preflight_cache="${CARBONET_PLATFORM_PREFLIGHT_CACHE:-/opt/resonance-data/deploy/platform-preflight.cache}"
platform_preflight_cache_reused=false
printf -v platform_preflight_now '%(%s)T' -1
platform_preflight_cached_at=0
platform_preflight_cached_pod=""
if [[ "$PLAN_RUNTIME_REQUIRED" != "true" && -r "$platform_preflight_cache" ]]; then
  IFS='|' read -r platform_preflight_cached_at platform_preflight_cached_pod \
    <"$platform_preflight_cache" || true
  if [[ "$platform_preflight_cached_at" =~ ^[0-9]+$ ]] &&
    [[ "$platform_preflight_cached_pod" =~ ^postgres-patroni-[0-9]+$ ]] &&
    (( platform_preflight_now - platform_preflight_cached_at < 300 )); then
    platform_preflight_cache_reused=true
    POSTGRES_POD="$platform_preflight_cached_pod"
  fi
fi

if [[ "$platform_preflight_cache_reused" == "true" ]]; then
  echo "[auto-deploy] platform preflight reused: verified within 5 minutes leader=$POSTGRES_POD"
else
if [[ ! -r "$KUBECONFIG" ]]; then
  echo "[auto-deploy] refusing deployment: kubeconfig is not readable ($KUBECONFIG)" >&2
  exit 8
fi
# Detached deployment worktrees are disposable build inputs. Remove leftovers
# from completed or interrupted runs before Kubernetes evaluates DiskPressure;
# otherwise the single node can taint itself before Patroni/etcd health checks.
while IFS= read -r stale_worktree; do
  [[ -n "$stale_worktree" ]] || continue
  stale_real="$(realpath -m "$stale_worktree")"
  root_real="$(realpath -m "$ROOT_DIR")"
  case "$stale_real" in
    "$deploy_worktree_root"/*)
      # Keep one operator-owned worktree so Gradle task outputs survive between
      # commits. Per-commit worktrees made every Java deployment a cold build.
      if [[ "$stale_real" != "$root_real" ]]; then
        if [[ -d "$stale_real" ]] && find "$stale_real" ! -user "$(id -u)" -print -quit 2>/dev/null | grep -q .; then
          echo "[auto-deploy] repairing stale deployment worktree ownership: $stale_real"
          sudo -n chown -R "$(id -u):$(id -g)" "$stale_real" || {
            echo "[auto-deploy] refusing stale worktree removal: ownership repair failed ($stale_real)" >&2
            exit 24
          }
        fi
        if [[ "$stale_real" != "$(realpath -m "$persistent_build_worktree")" ]]; then
          git -C "${CARBONET_DEPLOY_ORIGINAL_ROOT:-$ROOT_DIR}" worktree remove --force "$stale_real"
        fi
      fi
      ;;
    *) echo "[auto-deploy] refusing unsafe stale worktree path: $stale_real" >&2; exit 23 ;;
  esac
done < <(git -C "${CARBONET_DEPLOY_ORIGINAL_ROOT:-$ROOT_DIR}" worktree list --porcelain |
  awk -v prefix="$deploy_worktree_root/" '$1=="worktree" && index($2,prefix)==1 {print $2}')
git -C "${CARBONET_DEPLOY_ORIGINAL_ROOT:-$ROOT_DIR}" worktree prune

# Reserve both the post-deploy safety floor and worst-case build/backup work
# space after reclaiming disposable worktrees, but before database backup or
# build. A blocked run leaves the timer active for a later retry.
bash "$POLICY_ROOT/ops/scripts/deploy-capacity-gate.sh"

# A runaway reports controller previously consumed more than 24 CPU cores and
# made otherwise incremental builds and three-pod rollouts appear slow. Keep
# Kyverno's configured exclusions enabled and cap the auxiliary reporting
# workload before spending resources on a build.
if [[ -f "$POLICY_ROOT/ops/scripts/ensure-kyverno-resource-guard.sh" ]]; then
  bash "$POLICY_ROOT/ops/scripts/ensure-kyverno-resource-guard.sh"
else
  echo "[auto-deploy] Kyverno resource guard is introduced by the pending commit; validating after bootstrap"
fi

# Image/Gradle packaging can leave generated frontend trees owned by root.
# Normalize only when a foreign-owned entry is detected so the next Git
# fast-forward/restore cannot fail before the deployment plan is evaluated.
for generated_tree in \
  apps/carbonet-api/src/main/resources/static/react-app \
  projects/carbonet-assets/static/react-app \
  projects/carbonet-frontend/src/main/resources/static/react-app; do
  [[ -e "$generated_tree" ]] || continue
  if find "$generated_tree" ! -user "$(id -u)" -print -quit 2>/dev/null | grep -q .; then
    echo "[auto-deploy] repairing generated asset ownership: $generated_tree"
    sudo -n chown -R "$(id -u):$(id -g)" "$generated_tree"
  fi
done

mapfile -t postgres_paths < <(kubectl -n "$NAMESPACE" get statefulset postgres-patroni \
  -o jsonpath='{.spec.template.spec.volumes[?(@.name=="patroni-data-root")].hostPath.path}{"\n"}{.spec.template.spec.volumes[?(@.name=="wal-archive")].hostPath.path}{"\n"}' \
  2>/dev/null || true)
postgres_data_path="${postgres_paths[0]:-}"
postgres_wal_path="${postgres_paths[1]:-}"
for protected_path in "$postgres_data_path" "$postgres_wal_path"; do
  if [[ -z "$protected_path" || "$protected_path" == "$ROOT_DIR"/* || "$protected_path" != /opt/resonance-data/postgresql/* ]]; then
    echo "[auto-deploy] refusing deployment: PostgreSQL storage is not isolated ($protected_path)" >&2
    exit 9
  fi
done

# A deployment must never continue while the HA database has no elected,
# writable leader. Without this gate pg_dump can emit only an empty gzip
# header and the rollout then replaces healthy application pods with pods
# that cannot connect to PostgreSQL.
mapfile -t patroni_rows < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni \
  -o jsonpath='{range .items[*]}{.metadata.name}{"|"}{.status.containerStatuses[0].ready}{"\n"}{end}' \
  2>/dev/null || true)
patroni_pods=()
ready_patroni=0
for patroni_row in "${patroni_rows[@]}"; do
  patroni_pods+=("${patroni_row%%|*}")
  [[ "${patroni_row##*|}" == "true" ]] && ready_patroni=$((ready_patroni + 1))
done
if [[ "$ready_patroni" -lt 2 ]]; then
  echo "[auto-deploy] refusing deployment: Patroni quorum is not ready ($ready_patroni/3)" >&2
  exit 10
fi

# Readiness alone is insufficient: a running Patroni process can report a
# recoverable state after its hostPath was unlinked. Require the PostgreSQL
# control marker on every member before any backup or rollout is attempted.
patroni_data_check_dir="$(mktemp -d /tmp/carbonet-patroni-data-check.XXXXXX)"
declare -a patroni_data_pids=()
for candidate in "${patroni_pods[@]}"; do
  (
    kubectl -n "$NAMESPACE" exec "$candidate" -c "$POSTGRES_CONTAINER" -- \
      test -s "/home/postgres/pgdata/${candidate}/pgroot/data/PG_VERSION"
  ) >"$patroni_data_check_dir/$candidate.log" 2>&1 &
  patroni_data_pids+=("$!")
done
for candidate_index in "${!patroni_pods[@]}"; do
  candidate="${patroni_pods[$candidate_index]}"
  if ! wait "${patroni_data_pids[$candidate_index]}"; then
    cat "$patroni_data_check_dir/$candidate.log" >&2
    rm -rf "$patroni_data_check_dir"
    echo "[auto-deploy] refusing deployment: PostgreSQL data directory is missing on $candidate" >&2
    exit 15
  fi
done
rm -rf "$patroni_data_check_dir"

# Patroni can promote any ordinal. Never assume postgres-patroni-0 is the
# writable leader: pg_dump on a recovering replica can be cancelled by WAL
# replay and would unnecessarily block every deployment.
if [[ -z "$POSTGRES_POD" ]]; then
  patroni_role_dir="$(mktemp -d /tmp/carbonet-patroni-role-check.XXXXXX)"
  declare -a patroni_role_pids=()
  for candidate in "${patroni_pods[@]}"; do
    (
      kubectl -n "$NAMESPACE" exec "$candidate" -c "$POSTGRES_CONTAINER" -- \
        psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
          -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true
    ) >"$patroni_role_dir/$candidate" &
    patroni_role_pids+=("$!")
  done
  for candidate_index in "${!patroni_pods[@]}"; do
    wait "${patroni_role_pids[$candidate_index]}" || true
  done
  for candidate in "${patroni_pods[@]}"; do
    if [[ "$(tr -d '[:space:]' <"$patroni_role_dir/$candidate")" == "f" ]]; then
      POSTGRES_POD="$candidate"
      break
    fi
  done
  rm -rf "$patroni_role_dir"
fi
if [[ -z "$POSTGRES_POD" ]]; then
  echo "[auto-deploy] refusing deployment: writable PostgreSQL leader was not found" >&2
  exit 12
fi
echo "[auto-deploy] PostgreSQL backup leader: $POSTGRES_POD"
mkdir -p "$(dirname "$platform_preflight_cache")"
printf '%s|%s\n' "$platform_preflight_now" "$POSTGRES_POD" >"${platform_preflight_cache}.tmp"
chmod 0644 "${platform_preflight_cache}.tmp"
  mv "${platform_preflight_cache}.tmp" "$platform_preflight_cache"
fi
mkdir -p -m 0700 -- "$BACKUP_DIR"
[[ -d "$BACKUP_DIR" && ! -L "$BACKUP_DIR" ]] || {
  echo "[auto-deploy] refusing unsafe pre-deploy backup directory: $BACKUP_DIR" >&2
  exit 8
}
if find "$BACKUP_DIR" -maxdepth 1 \
    \( -type l -o \! -user "$(id -u)" \) -print -quit | grep -q .; then
  echo "[auto-deploy] refusing pre-deploy backup storage with links or foreign ownership" >&2
  exit 8
fi
chmod 0700 "$BACKUP_DIR"
find "$BACKUP_DIR" -maxdepth 1 -type f -exec chmod 0600 {} +
[[ "$(stat -c '%a:%u' "$BACKUP_DIR")" == "700:$(id -u)" ]] || {
  echo "[auto-deploy] refusing pre-deploy backup storage without private ownership" >&2
  exit 8
}
record_deploy_phase "platform_preflight"
else
  recovery_target_commit="${CARBONET_RECOVERY_TARGET_COMMIT:-}"
  [[ "$recovery_target_commit" =~ ^[0-9a-f]{40}$ ]] || {
    echo '[auto-deploy] recovery-only target identity is invalid' >&2
    exit 79
  }
  current_commit="$recovery_target_commit"
  target_commit="$recovery_target_commit"
  deployed_commit="$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE" 2>/dev/null || true)"
  runtime_deployed_commit="$(tr -d '[:space:]' <"$RUNTIME_DEPLOY_STATE_FILE" 2>/dev/null || true)"
  [[ "$deployed_commit" =~ ^[0-9a-f]{40}$ ]] || deployed_commit="$target_commit"
  [[ "$runtime_deployed_commit" =~ ^[0-9a-f]{40}$ ]] || runtime_deployed_commit="$deployed_commit"
  no_change_candidate=false
  no_change_recovery_hint=true
  platform_preflight_cache_reused=false
  deploy_worktree_root="/nonexistent/carbonet-recovery"
  persistent_build_worktree="$deploy_worktree_root/runtime-build"
  PLAN_RUNTIME_REQUIRED=false
  PLAN_FRONTEND_REQUIRED=false
  PLAN_BACKEND_REQUIRED=false
  PLAN_DATABASE_REQUIRED=false
  PLAN_BACKSTAGE_REQUIRED=false
  PLAN_INFRASTRUCTURE_REQUIRED=false
  PLAN_TESTS=""
  PLAN_REASONS="durable-recovery-only"
  resolve_postdeploy_postgres_pod || {
    echo '[auto-deploy] recovery-only writable PostgreSQL leader is unavailable' >&2
    exit 79
  }
  echo "[auto-deploy] recovery-only deploy preparation bypassed target=$target_commit"
  record_deploy_phase "recovery_identity"
fi
live_frontend_overlay="${CARBONET_LIVE_FRONTEND_OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}"
backup_application_name="carbonet-auto-deploy-$$"
backup_cleanup_required=false
backup_partial_file=""
roles_backup_partial_file=""
schema_backup_dir=""
schema_restore_database=""
schema_restore_container=""
schema_restore_container_id=""
schema_restore_image_ref=""
schema_restore_image_id=""
schema_restore_postgres_version=""
schema_restore_verifier=""
restored_history_count=""
restored_schema_object_count=""
runtime_asset_sync_pid=""
runtime_asset_sync_log=""
runtime_screen_gate_pid=""
runtime_screen_gate_pgid=""
runtime_screen_gate_log=""
runtime_screen_gate_cache_dir=""
catalog_identity_sync_pid=""
catalog_identity_sync_log=""
backstage_visual_e2e_pid=""
backstage_visual_e2e_log=""
backstage_e2e_effective_routes=""
postdeploy_candidate_initialized=false
postdeploy_candidate_promoted=false
postdeploy_candidate_authority_unknown=false
postdeploy_attempt_journal_initialized=false
postdeploy_db_attempt_staged=false
postdeploy_rollback_restored=false

# BEGIN isolated-local-schema-restore
schema_restore_docker() {
  sudo -n docker "$@"
}

cleanup_local_schema_restore_container() {
  local container="${schema_restore_container:-}"
  local container_id="${schema_restore_container_id:-}"
  local inspect_json=""
  [[ -n "$container" || -n "$container_id" ]] || return 0
  [[ "$container" =~ ^carbonet-schema-restore-[0-9a-f]{12}-[0-9]+-[0-9]+$ \
     && "$container_id" =~ ^[0-9a-f]{64}$ ]] || return 79
  schema_restore_docker info >/dev/null 2>&1 || return 1
  if ! inspect_json="$(schema_restore_docker container inspect "$container_id" 2>/dev/null)"; then
    # The owned ID is gone. A container now occupying the old name is foreign;
    # never delete it and make the ownership race a hard failure.
    schema_restore_docker info >/dev/null 2>&1 || return 1
    if schema_restore_docker container inspect "$container" >/dev/null 2>&1; then
      return 79
    fi
    schema_restore_container=""
    schema_restore_container_id=""
    return 0
  fi
  jq -e --arg id "$container_id" --arg name "/$container" --arg source "$target_commit" '
    length == 1
    and .[0].Id == $id
    and .[0].Name == $name
    and .[0].Config.Labels["resonance.ai/purpose"] == "predeploy-schema-restore"
    and .[0].Config.Labels["resonance.ai/source-commit"] == $source
  ' <<<"$inspect_json" >/dev/null || return 79
  schema_restore_docker rm -f -- "$container_id" >/dev/null 2>&1 || return 1
  # Failed inspect is absence proof only while the daemon itself is healthy.
  schema_restore_docker info >/dev/null 2>&1 || return 1
  if schema_restore_docker container inspect "$container_id" >/dev/null 2>&1 \
     || schema_restore_docker container inspect "$container" >/dev/null 2>&1; then
    return 1
  fi
  schema_restore_container=""
  schema_restore_container_id=""
}

reset_schema_restore_evidence_for_fallback() {
  schema_restore_image_ref=""
  schema_restore_image_id=""
  schema_restore_postgres_version=""
  schema_restore_verifier=""
  restored_history_count=""
  restored_schema_object_count=""
}

local_schema_restore_fail() {
  local requested_status="${1:-1}"
  local cleanup_status=0
  cleanup_local_schema_restore_container || cleanup_status=$?
  reset_schema_restore_evidence_for_fallback
  (( cleanup_status == 0 )) || return 79
  return "$requested_status"
}

# Restore the complete schema and Flyway history into a disposable PostgreSQL
# 16 instance on node-local tmpfs. The container has no network, no host bind,
# and is started by immutable image ID. Any unavailable/invalid local runtime
# falls back to the existing Patroni scratch proof; an unremovable container is
# a hard failure so retries cannot accumulate privileged residue.
verify_schema_backup_restore_locally() {
  local schema_dump="$1" flyway_history_dump="$2"
  local expected_history_count="$3" expected_schema_object_count="$4"
  local image_ref="${CARBONET_LOCAL_SCHEMA_RESTORE_IMAGE:-postgres@sha256:11a9d238fbb48bab14599c57e41123254452b1a2d93c6c8595bce96f346bd082}"
  local ready_timeout="${CARBONET_LOCAL_SCHEMA_RESTORE_READY_TIMEOUT_SECONDS:-30}"
  local image_id container_id container_name inspect_json marker deadline server_version_num
  local postgres_version pg_restore_version schema_toc_count flyway_toc_count
  local restored_database="carbonet_schema_verify"

  [[ -s "$schema_dump" && -s "$flyway_history_dump" \
     && "$expected_history_count" =~ ^[1-9][0-9]*$ \
     && "$expected_schema_object_count" =~ ^[1-9][0-9]*$ \
     && "$ready_timeout" =~ ^[0-9]+$ \
     && "$ready_timeout" -ge 5 && "$ready_timeout" -le 120 ]] || return 2
  [[ -z "${schema_restore_container:-}" ]] || return 79
  [[ -z "${schema_restore_container_id:-}" ]] || return 79
  reset_schema_restore_evidence_for_fallback
  # The verifier is an optional fast path. Only an immutable digest/ID may run;
  # a mutable tag or an unavailable pinned image falls back to Patroni.
  [[ "$image_ref" =~ @sha256:[0-9a-f]{64}$ \
     || "$image_ref" =~ ^sha256:[0-9a-f]{64}$ ]] || return 2
  schema_restore_docker info >/dev/null 2>&1 || return 2
  image_id="$(schema_restore_docker image inspect --format '{{.Id}}' "$image_ref" 2>/dev/null)" \
    || return 2
  [[ "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]] || return 2
  schema_restore_image_ref="$image_ref"
  schema_restore_image_id="$image_id"
  container_name="carbonet-schema-restore-${target_commit:0:12}-$$-${RANDOM}"
  [[ "$container_name" =~ ^carbonet-schema-restore-[0-9a-f]{12}-[0-9]+-[0-9]+$ ]] \
    || return 2

  container_id="$(schema_restore_docker run -d --pull never \
    --name "$container_name" \
    --label resonance.ai/purpose=predeploy-schema-restore \
    --label "resonance.ai/source-commit=$target_commit" \
    --network none \
    --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=768m \
    -e POSTGRES_HOST_AUTH_METHOD=trust \
    "$image_id" 2>/dev/null)" || {
      # docker run did not establish ownership. In particular, a foreign
      # same-name container must remain untouched.
      reset_schema_restore_evidence_for_fallback
      return 2
    }
  if [[ ! "$container_id" =~ ^[0-9a-f]{64}$ ]]; then
    # A successful run without an immutable ID cannot be cleaned by name.
    schema_restore_container="$container_name"
    return 79
  fi
  schema_restore_container="$container_name"
  schema_restore_container_id="$container_id"
  inspect_json="$(schema_restore_docker container inspect "$schema_restore_container_id" 2>/dev/null)" || {
    local_schema_restore_fail 1
    return $?
  }
  jq -e --arg id "$schema_restore_container_id" --arg name "/$schema_restore_container" \
    --arg image "$image_id" --arg source "$target_commit" '
    length == 1
    and .[0].Id == $id
    and .[0].Name == $name
    and .[0].Image == $image
    and .[0].HostConfig.NetworkMode == "none"
    and ((. [0].HostConfig.Binds // []) | length) == 0
    and .[0].Config.Labels["resonance.ai/purpose"] == "predeploy-schema-restore"
    and .[0].Config.Labels["resonance.ai/source-commit"] == $source
    and (. [0].HostConfig.Tmpfs["/var/lib/postgresql/data"] | type == "string")
    and (. [0].HostConfig.Tmpfs["/var/lib/postgresql/data"] | test("(^|,)rw(,|$)"))
    and (. [0].HostConfig.Tmpfs["/var/lib/postgresql/data"] | test("(^|,)noexec(,|$)"))
    and (. [0].HostConfig.Tmpfs["/var/lib/postgresql/data"] | test("(^|,)nosuid(,|$)"))
    and (. [0].HostConfig.Tmpfs["/var/lib/postgresql/data"] | test("(^|,)size=(768m|805306368)(,|$)"))
  ' <<<"$inspect_json" >/dev/null || {
    local_schema_restore_fail 1
    return $?
  }

  # pg_isready can briefly succeed against the entrypoint's temporary server.
  # Never accept it until the final-entrypoint marker has been observed.
  marker='PostgreSQL init process complete; ready for start up.'
  deadline=$((SECONDS + ready_timeout))
  while ! schema_restore_docker logs "$schema_restore_container_id" 2>&1 | grep -Fq "$marker"; do
    [[ "$(schema_restore_docker container inspect --format '{{.State.Running}}' \
      "$schema_restore_container_id" 2>/dev/null || true)" == true ]] || {
      local_schema_restore_fail 1
      return $?
    }
    (( SECONDS < deadline )) || {
      local_schema_restore_fail 1
      return $?
    }
    sleep 0.1
  done
  while ! schema_restore_docker exec "$schema_restore_container_id" \
      pg_isready -U postgres -d postgres -q >/dev/null 2>&1; do
    (( SECONDS < deadline )) || {
      local_schema_restore_fail 1
      return $?
    }
    sleep 0.1
  done

  postgres_version="$(schema_restore_docker exec "$schema_restore_container_id" postgres --version 2>/dev/null)" \
    || {
      local_schema_restore_fail 1
      return $?
    }
  pg_restore_version="$(schema_restore_docker exec "$schema_restore_container_id" pg_restore --version 2>/dev/null)" \
    || {
      local_schema_restore_fail 1
      return $?
    }
  server_version_num="$(schema_restore_docker exec "$schema_restore_container_id" \
    psql -U postgres -d postgres -X -q -At -v ON_ERROR_STOP=1 \
      -c "select current_setting('server_version_num')" 2>/dev/null)" || {
    local_schema_restore_fail 1
    return $?
  }
  [[ "$postgres_version" =~ PostgreSQL\)[[:space:]]16\. \
     && "$pg_restore_version" =~ PostgreSQL\)[[:space:]]16\. \
     && "$server_version_num" =~ ^16[0-9]{4}$ ]] || {
    local_schema_restore_fail 2
    return $?
  }
  schema_restore_postgres_version="$postgres_version; $pg_restore_version"

  schema_toc_count="$(schema_restore_docker exec -i "$schema_restore_container_id" \
    pg_restore --list <"$schema_dump" | awk '!/^;/ && NF {n++} END {print n+0}')" || {
    local_schema_restore_fail 1
    return $?
  }
  flyway_toc_count="$(schema_restore_docker exec -i "$schema_restore_container_id" \
    pg_restore --list <"$flyway_history_dump" | awk '!/^;/ && NF {n++} END {print n+0}')" || {
    local_schema_restore_fail 1
    return $?
  }
  [[ "$schema_toc_count" =~ ^[1-9][0-9]*$ && "$flyway_toc_count" =~ ^[1-9][0-9]*$ ]] || {
    local_schema_restore_fail 1
    return $?
  }

  schema_restore_docker exec "$schema_restore_container_id" \
    psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 \
      -c "create database $restored_database" >/dev/null || {
    local_schema_restore_fail 1
    return $?
  }
  schema_restore_docker exec -i "$schema_restore_container_id" \
    pg_restore -U postgres -d "$restored_database" --exit-on-error \
      --schema-only --no-owner --no-privileges <"$schema_dump" >/dev/null || {
    local_schema_restore_fail 1
    return $?
  }
  schema_restore_docker exec -i "$schema_restore_container_id" \
    pg_restore -U postgres -d "$restored_database" --exit-on-error \
      --data-only --no-owner --no-privileges -t carbonet_flyway_schema_history \
      <"$flyway_history_dump" >/dev/null || {
    local_schema_restore_fail 1
    return $?
  }
  restored_history_count="$(schema_restore_docker exec "$schema_restore_container_id" \
    psql -U postgres -d "$restored_database" -X -q -At -v ON_ERROR_STOP=1 \
      -c 'select count(*) from carbonet_flyway_schema_history' 2>/dev/null)" || {
    local_schema_restore_fail 1
    return $?
  }
  restored_schema_object_count="$(schema_restore_docker exec "$schema_restore_container_id" \
    psql -U postgres -d "$restored_database" -X -q -At -v ON_ERROR_STOP=1 \
      -c "select count(*) from pg_class where relnamespace not in (select oid from pg_namespace where nspname like 'pg_%' or nspname='information_schema')" 2>/dev/null)" || {
    local_schema_restore_fail 1
    return $?
  }
  [[ "$restored_history_count" == "$expected_history_count" \
     && "$restored_schema_object_count" == "$expected_schema_object_count" ]] || {
    local_schema_restore_fail 1
    return $?
  }
  cleanup_local_schema_restore_container || return 79
  schema_restore_verifier="local-pg16-tmpfs"
  echo "[auto-deploy] local schema restore PASS imageId=$schema_restore_image_id rows=$restored_history_count objects=$restored_schema_object_count schemaToc=$schema_toc_count flywayToc=$flyway_toc_count"
}
# END isolated-local-schema-restore

verify_schema_backup_restore_in_scratch() {
  local schema_dump="$1" flyway_history_dump="$2" scratch_database="$3"
  local expected_history_count="$4" expected_schema_object_count="$5"
  [[ -s "$schema_dump" && -s "$flyway_history_dump" \
     && "$scratch_database" =~ ^carbonet_schema_verify_[a-zA-Z0-9_]+$ \
     && "$expected_history_count" =~ ^[1-9][0-9]*$ \
     && "$expected_schema_object_count" =~ ^[1-9][0-9]*$ ]] || return 1
  schema_restore_database="$scratch_database"
  kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    psql -U "$POSTGRES_USER" -h 127.0.0.1 -d postgres -v ON_ERROR_STOP=1 \
      -c "create database \"$schema_restore_database\"" >/dev/null || return 1
  # Archive catalog readability is not restore proof. Restore every schema
  # object into the isolated database before relying on this fast backup.
  kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    pg_restore -U "$POSTGRES_USER" -h 127.0.0.1 -d "$schema_restore_database" \
      --exit-on-error --schema-only --no-owner --no-privileges \
      < "$schema_dump" || return 1
  kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    pg_restore -U "$POSTGRES_USER" -h 127.0.0.1 -d "$schema_restore_database" \
      --exit-on-error --data-only --no-owner --no-privileges -t carbonet_flyway_schema_history \
      < "$flyway_history_dump" || return 1
  restored_history_count="$(kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    psql -U "$POSTGRES_USER" -h 127.0.0.1 -d "$schema_restore_database" -Atqc \
      'select count(*) from carbonet_flyway_schema_history')" || return 1
  restored_schema_object_count="$(kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    psql -U "$POSTGRES_USER" -h 127.0.0.1 -d "$schema_restore_database" -Atqc \
      "select count(*) from pg_class where relnamespace not in (select oid from pg_namespace where nspname like 'pg_%' or nspname='information_schema')")" || return 1
  [[ "$restored_history_count" == "$expected_history_count" \
     && "$restored_schema_object_count" == "$expected_schema_object_count" ]] || return 1
  kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    psql -U "$POSTGRES_USER" -h 127.0.0.1 -d postgres -v ON_ERROR_STOP=1 \
      -c "drop database \"$schema_restore_database\" with (force)" >/dev/null || return 1
  schema_restore_database=""
  schema_restore_postgres_version="$(kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    postgres --version 2>/dev/null || true)"
  schema_restore_verifier="patroni-scratch"
}

bounded_cleanup_kubectl() {
  local timeout_seconds="${CARBONET_DEPLOY_CLEANUP_KUBECTL_TIMEOUT_SECONDS:-8}"
  local request_timeout_seconds="${CARBONET_DEPLOY_CLEANUP_KUBECTL_REQUEST_TIMEOUT_SECONDS:-5}"
  if [[ ! "$timeout_seconds" =~ ^[1-9][0-9]*$ ]] \
     || (( timeout_seconds < 2 || timeout_seconds > 30 )); then
    timeout_seconds=8
  fi
  if [[ ! "$request_timeout_seconds" =~ ^[1-9][0-9]*$ ]] \
     || (( request_timeout_seconds >= timeout_seconds )); then
    if (( timeout_seconds > 5 )); then
      request_timeout_seconds=5
    else
      request_timeout_seconds=$((timeout_seconds - 1))
    fi
  fi
  timeout --signal=TERM --kill-after=1s "${timeout_seconds}s" \
    kubectl --request-timeout="${request_timeout_seconds}s" "$@"
}

arm_private_backup_partial() {
  local final="$1" partial backup_parent final_parent
  backup_parent="$(readlink -f "$BACKUP_DIR" 2>/dev/null)" || return 1
  final_parent="$(readlink -f "$(dirname -- "$final")" 2>/dev/null)" || return 1
  [[ "$final" == "$BACKUP_DIR"/* \
     && "$final_parent" == "$backup_parent" \
     && ! -e "$final" && ! -L "$final" ]] || return 1
  partial="${final}.partial.$$"
  [[ ! -e "$partial" && ! -L "$partial" ]] || return 1
  printf '%s\n' "$partial"
}

publish_private_backup_partial() {
  local partial="$1" final="$2" backup_parent final_parent partial_parent
  backup_parent="$(readlink -f "$BACKUP_DIR" 2>/dev/null)" || return 1
  final_parent="$(readlink -f "$(dirname -- "$final")" 2>/dev/null)" || return 1
  partial_parent="$(readlink -f "$(dirname -- "$partial")" 2>/dev/null)" || return 1
  [[ "$partial" == "${final}.partial.$$" \
     && "$final" == "$BACKUP_DIR"/* \
     && "$final_parent" == "$backup_parent" \
     && "$partial_parent" == "$backup_parent" \
     && -f "$partial" && ! -L "$partial" \
     && "$(stat -c '%a:%u' "$partial")" == "600:$(id -u)" \
     && ! -e "$final" && ! -L "$final" ]] || return 1
  mv -T -- "$partial" "$final" || return 1
  sync -f "$BACKUP_DIR" || return 1
}

cleanup_remote_backup() {
  [[ "$backup_cleanup_required" == "true" ]] || return 0
  # A terminated `kubectl exec` can leave pg_dump alive inside the pod. End
  # only sessions owned by this deploy invocation, preventing duplicate dumps
  # after a stop or retry without touching other backup jobs.
  printf '%s\n' \
    "select pg_terminate_backend(pid) from pg_stat_activity where application_name=:'app_name' and pid<>pg_backend_pid();" | \
  bounded_cleanup_kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -q -At \
    -v ON_ERROR_STOP=1 -v app_name="$backup_application_name" \
    >/dev/null 2>&1 || true
}
canonical_runtime_screen_gate_cache_root() {
  local physical_frontend_root expected_cache_root resolved_cache_root
  physical_frontend_root="$(realpath -e -- "$ROOT_DIR/projects/carbonet-frontend/source")" || return 1
  expected_cache_root="$physical_frontend_root/.cache/full-screen-smoke/runtime-screen-gate"
  if [[ -L "$physical_frontend_root/.cache" \
     || -L "$physical_frontend_root/.cache/full-screen-smoke" \
     || -L "$expected_cache_root" ]]; then
    return 1
  fi
  resolved_cache_root="$(realpath -m -- "$expected_cache_root")" || return 1
  [[ "$resolved_cache_root" == "$expected_cache_root" ]] || return 1
  printf '%s\n' "$expected_cache_root"
}
cleanup_runtime_screen_gate_cache() {
  [[ -n "$runtime_screen_gate_cache_dir" ]] || return 0
  local cache_root canonical_candidate
  cache_root="$(canonical_runtime_screen_gate_cache_root)" || {
    echo "[auto-deploy] refusing unsafe runtime screen cache root" >&2
    return 1
  }
  canonical_candidate="$(realpath -m -- "$runtime_screen_gate_cache_dir")" || return 1
  case "$canonical_candidate" in
    "$cache_root"/*)
      rm -rf -- "$canonical_candidate"
      ;;
    *)
      echo "[auto-deploy] refusing unsafe runtime screen cache cleanup path=$runtime_screen_gate_cache_dir resolved=$canonical_candidate" >&2
      return 1
      ;;
  esac
  runtime_screen_gate_cache_dir=""
}
terminate_runtime_screen_gate_group() {
  local pgid="${runtime_screen_gate_pgid:-}" pid="${runtime_screen_gate_pid:-}" attempt
  if [[ "$pgid" =~ ^[1-9][0-9]*$ ]]; then
    kill -TERM -- "-$pgid" 2>/dev/null || true
    for attempt in $(seq 1 50); do
      kill -0 -- "-$pgid" 2>/dev/null || break
      sleep 0.1
    done
    if kill -0 -- "-$pgid" 2>/dev/null; then
      kill -KILL -- "-$pgid" 2>/dev/null || true
    fi
  elif [[ "$pid" =~ ^[1-9][0-9]*$ ]] && kill -0 "$pid" 2>/dev/null; then
    # A missing/invalid PGID is fail-closed, but retain a bounded fallback for
    # the wrapper so cleanup cannot block deployment shutdown indefinitely.
    kill -TERM "$pid" 2>/dev/null || true
  fi
  if [[ "$pid" =~ ^[1-9][0-9]*$ ]]; then wait "$pid" 2>/dev/null || true; fi
  runtime_screen_gate_pid=""
  runtime_screen_gate_pgid=""
  cleanup_runtime_screen_gate_cache || true
}
run_runtime_release_validation_lanes() {
  local asset_sync_precompleted="${1:-false}"
  local validation_status=0 screen_save_status=0 browser_status=0
  local release_failure_status=0 completed_runtime_screen_gate_pid=""
  local release_overlay="${live_frontend_overlay:-${CARBONET_LIVE_FRONTEND_OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}}"

  if run_postdeploy_candidate_validation_groups "$asset_sync_precompleted"; then
    validation_status=0
  else
    validation_status=$?
  fi
  if (( validation_status == 0 )); then
    if run_screen_contract_runtime_save_gate_if_required; then
      screen_save_status=0
    else
      screen_save_status=$?
    fi
  else
    echo "[auto-deploy] screen contract runtime save skipped: validation groups failed status=$validation_status" >&2
  fi

  # Join the browser process before deciding or restoring. Its cleanup may
  # still own auth state and report files even when another validation lane has
  # already failed.
  if [[ "$PLAN_FRONTEND_REQUIRED" == "true" ]]; then
    if [[ "$runtime_screen_gate_pid" =~ ^[1-9][0-9]*$ ]]; then
      if wait "$runtime_screen_gate_pid"; then browser_status=0; else browser_status=$?; fi
      completed_runtime_screen_gate_pid="$runtime_screen_gate_pid"
      runtime_screen_gate_pid=""
      if [[ "$runtime_screen_gate_pgid" =~ ^[1-9][0-9]*$ ]] \
         && kill -0 -- "-$runtime_screen_gate_pgid" 2>/dev/null; then
        runtime_screen_gate_pid="$completed_runtime_screen_gate_pid"
        terminate_runtime_screen_gate_group
      else
        runtime_screen_gate_pgid=""
        cleanup_runtime_screen_gate_cache || browser_status=19
      fi
    else
      browser_status=19
      echo '[auto-deploy] concurrent browser gate pid is missing' >&2
    fi
    if (( browser_status == 0 )); then
      cat "$runtime_screen_gate_log" || true
    else
      echo "[auto-deploy] concurrent browser gate failed status=$browser_status" >&2
      cat "$runtime_screen_gate_log" >&2 || true
    fi
  else
    if OVERLAY_DIR="$release_overlay" FULL_SCREEN_GATE_DEFER_ACCEPT=true \
        bash ops/scripts/resonance-full-screen-deploy-gate.sh accept-fast; then
      browser_status=0
    else
      browser_status=$?
    fi
  fi

  if (( validation_status != 0 )); then
    release_failure_status="$validation_status"
  elif (( screen_save_status != 0 )); then
    release_failure_status="$screen_save_status"
  elif (( browser_status != 0 )); then
    release_failure_status="$browser_status"
  fi
  (( release_failure_status != 0 )) || return 0

  echo "[auto-deploy] release validation failed validation=$validation_status screenSave=$screen_save_status browser=$browser_status; durable reconciler owns rollback" >&2
  return "$release_failure_status"
}

archive_postdeploy_attempt_journal_terminal() {
  local status="$1" clear_current="${2:-true}" destination temporary document existing
  document="$(python3 "$POSTDEPLOY_JOURNAL_HELPER" \
    --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read)" || return 1
  jq -e --arg status "$status" --arg candidate "$postdeploy_candidate_id" --arg source "$target_commit" '
    .lifecycleStatus==$status and .candidateId==$candidate and .sourceCommit==$source
  ' <<<"$document" >/dev/null || return 1
  mkdir -p "$POSTDEPLOY_LEGACY_RETIRE_DIR"
  destination="$POSTDEPLOY_LEGACY_RETIRE_DIR/${postdeploy_candidate_id}.${status,,}.json"
  if [[ -e "$destination" || -L "$destination" ]]; then
    [[ -f "$destination" && ! -L "$destination" \
       && "$(stat -c '%a' "$destination" 2>/dev/null)" == 600 ]] || return 1
    existing="$(python3 "$POSTDEPLOY_JOURNAL_HELPER" --file "$destination" read)" || return 1
    [[ "$existing" == "$document" ]] || return 1
  else
    temporary="$(mktemp "$POSTDEPLOY_LEGACY_RETIRE_DIR/.attempt-terminal.XXXXXX")" || return 1
    printf '%s\n' "$document" >"$temporary" && chmod 0600 "$temporary" \
      && mv -fT -- "$temporary" "$destination" || { rm -f -- "$temporary"; return 1; }
  fi
  sync -f "$POSTDEPLOY_LEGACY_RETIRE_DIR" 2>/dev/null || true
  [[ "$clear_current" == true ]] || return 0
  python3 "$POSTDEPLOY_JOURNAL_HELPER" \
    --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" clear-terminal \
    "$status" "$postdeploy_candidate_id" "$target_commit" >/dev/null
}

recover_staged_postdeploy_attempt_after_failure() {
  local authority_status=2 journal baseline status rollback_stage db_staged snapshot_id snapshot_manifest
  local db_abort_status=0 db_stage_status=0 reason=DEPLOYMENT_FAILED runtime_hash="" applied_marker=""
  [[ -s "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]] || return 0
  journal="$(python3 "$POSTDEPLOY_JOURNAL_HELPER" \
    --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read)" || return 79
  jq -e --arg candidate "$postdeploy_candidate_id" --arg source "$target_commit" '
    (.lifecycleStatus=="STAGED" or .lifecycleStatus=="ABORTED")
    and .candidateId==$candidate and .sourceCommit==$source
  ' <<<"$journal" >/dev/null || return 79
  baseline="$(jq -r '.baseCommit' <<<"$journal")"
  status="$(jq -r '.lifecycleStatus' <<<"$journal")"
  rollback_stage="$(jq -r '.rollbackStage' <<<"$journal")"
  db_staged="$(jq -r '.dbAttemptStaged' <<<"$journal")"
  snapshot_id="$(jq -r '.rollback.snapshotId' <<<"$journal")"
  snapshot_manifest="$(jq -r '.rollback.snapshotManifestSha256' <<<"$journal")"
  [[ "$baseline" =~ ^[0-9a-f]{40}$ && "$snapshot_id" =~ ^[A-Za-z0-9._-]+$ \
     && "$snapshot_manifest" =~ ^[0-9a-f]{64}$ ]] || return 79

  if [[ "$status" == STAGED && "$db_staged" != true ]]; then
    # First-upgrade bridge: the candidate image may be the artifact that
    # installs the lifecycle migration.  Re-attempt the exact DB stage first.
    # If the function is still absent, only an observe-only proof that every
    # captured baseline surface is unchanged may retire this pre-runtime try.
    stage_postdeploy_release_attempt_db || db_stage_status=$?
    if (( db_stage_status == 0 )); then
      postdeploy_db_attempt_staged=true
      journal="$(python3 "$POSTDEPLOY_JOURNAL_HELPER" \
        --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read)" || return 79
      rollback_stage="$(jq -r '.rollbackStage' <<<"$journal")"
      db_staged="$(jq -r '.dbAttemptStaged' <<<"$journal")"
    elif (( db_stage_status == 3 )); then
      OVERLAY_DIR="$live_frontend_overlay" \
      FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
      FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
      FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
        bash "$POSTDEPLOY_GATE_SCRIPT" verify-restored-physical || return 79
      OVERLAY_DIR="$live_frontend_overlay" \
      FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
      FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
      FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
        bash "$POSTDEPLOY_GATE_SCRIPT" verify-markers || return 79
      verify_operational_usage_ledger_current_runtime_identity "$baseline" proof-only || return 79
      cancel_pre_runtime_postdeploy_attempt_journal || return 79
      status=ABORTED
      rollback_stage=RESTORED_VERIFIED
      reason=PRE_RUNTIME_FAILURE
    else
      write_postdeploy_promotion_quarantine 'ATTEMPT_DB_STAGE_UNAVAILABLE' || true
      return 79
    fi
  fi

  if [[ "$status" == STAGED ]]; then
    [[ "$db_staged" == true && "$rollback_stage" == ARMED ]] || return 79
    if postdeploy_authoritative_promotion_status "$target_commit" "$postdeploy_candidate_id"; then authority_status=0; else authority_status=$?; fi
    case "$authority_status" in
      0)
        runtime_hash="$(current_runtime_identity_hash "$target_commit" | tr -d '[:space:]')"
        [[ "$runtime_hash" =~ ^[0-9a-f]{64}$ ]] || return 79
        if [[ "$POSTDEPLOY_AUTHORITY_OUTCOME" == PROMOTED_RECONCILED ]]; then
          transition_postdeploy_attempt_journal ABORTED "$runtime_hash" \
            RECONCILED_TO_EXISTING_SOURCE_PROMOTION || return 79
          postdeploy_candidate_promoted=true
          verify_operational_usage_ledger_current_runtime_identity "$target_commit" proof-only || return 79
          OVERLAY_DIR="$live_frontend_overlay" FULL_SCREEN_GATE_DEFER_ACCEPT=true \
          FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
          FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
          FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
            bash "$POSTDEPLOY_GATE_SCRIPT" finalize-success || return 79
          write_runtime_deploy_state "$target_commit" || return 79
          applied_marker="$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE" 2>/dev/null || true)"
          if [[ "$applied_marker" != "$target_commit" ]]; then
            if [[ ! "$applied_marker" =~ ^[0-9a-f]{40}$ ]] \
               || git -C "$ROOT_DIR" merge-base --is-ancestor "$applied_marker" "$target_commit"; then
              write_applied_deploy_state "$target_commit" || return 79
            elif ! git -C "$ROOT_DIR" merge-base --is-ancestor "$target_commit" "$applied_marker"; then
              return 79
            fi
          fi
          retire_matching_runtime_quarantine "$postdeploy_candidate_id" "$target_commit" || return 79
          if [[ -s "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" ]]; then
            run_runtime_candidate_checkpoint clear-success || return 79
          fi
          archive_postdeploy_attempt_journal_terminal ABORTED || return 79
          runtime_deployed_commit="$target_commit"
          echo "[auto-deploy] reconciled retry preserved canonical promotion source=$target_commit requested=$postdeploy_candidate_id rollback=0"
          return 0
        fi
        transition_postdeploy_attempt_journal PROMOTED "$runtime_hash" PROMOTION_COMMITTED || return 79
        postdeploy_candidate_promoted=true
        return 0
        ;;
      1)
        abort_postdeploy_release_attempt_db - "$reason" || db_abort_status=$?
        if (( db_abort_status != 0 )); then
          # Promotion may have won while abort waited on the shared advisory
          # lock. Re-read the exact attempt before authorizing any restore.
          if postdeploy_authoritative_promotion_status "$target_commit" "$postdeploy_candidate_id"; then
            runtime_hash="$(current_runtime_identity_hash "$target_commit" | tr -d '[:space:]')"
            [[ "$runtime_hash" =~ ^[0-9a-f]{64}$ ]] || return 79
            transition_postdeploy_attempt_journal PROMOTED "$runtime_hash" PROMOTION_COMMITTED || return 79
            postdeploy_candidate_promoted=true
            return 0
          fi
          write_postdeploy_promotion_quarantine 'ATTEMPT_ABORT_PROMOTION_RACE_UNKNOWN' || true
          return 79
        fi
        transition_postdeploy_attempt_journal ABORTED - "$reason" || return 79
        status=ABORTED
        rollback_stage=ABORT_AUTHORIZED
        ;;
      *)
        # Crash window: DB abort can commit before the local journal rename.
        # Replaying the same abort is an exact, advisory-locked DB read/CAS. It
        # succeeds only for the same terminal reason/hash and no source
        # promotion; every other UNKNOWN remains mutation-free.
        db_abort_status=0
        abort_postdeploy_release_attempt_db - "$reason" || db_abort_status=$?
        if (( db_abort_status == 0 )); then
          transition_postdeploy_attempt_journal ABORTED - "$reason" || return 79
          status=ABORTED
          rollback_stage=ABORT_AUTHORIZED
        else
          write_postdeploy_promotion_quarantine 'PROMOTION_DB_CHECK_UNAVAILABLE' || true
          return 79
        fi
        ;;
    esac
  fi

  [[ "$status" == ABORTED ]] || return 79
  journal="$(python3 "$POSTDEPLOY_JOURNAL_HELPER" \
    --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read)" || return 79
  db_staged="$(jq -r '.dbAttemptStaged' <<<"$journal")"
  rollback_stage="$(jq -r '.rollbackStage' <<<"$journal")"
  reason="$(jq -r '.terminalReason' <<<"$journal")"
  runtime_hash="$(jq -r '.runtimeIdentityHash // "-"' <<<"$journal")"
  if [[ "$reason" == RECONCILED_TO_EXISTING_SOURCE_PROMOTION \
     && "$rollback_stage" == DISARMED ]]; then
    if ! postdeploy_authoritative_promotion_status "$target_commit" "$postdeploy_candidate_id" \
       || [[ "$POSTDEPLOY_AUTHORITY_OUTCOME" != PROMOTED_RECONCILED ]]; then
      write_postdeploy_promotion_quarantine 'RECONCILED_ATTEMPT_DB_RECONFIRM_FAILED' || true
      return 79
    fi
    verify_operational_usage_ledger_current_runtime_identity "$target_commit" proof-only || return 79
    OVERLAY_DIR="$live_frontend_overlay" FULL_SCREEN_GATE_DEFER_ACCEPT=true \
    FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
    FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
    FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
      bash "$POSTDEPLOY_GATE_SCRIPT" finalize-success || return 79
    write_runtime_deploy_state "$target_commit" || return 79
    applied_marker="$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE" 2>/dev/null || true)"
    if [[ "$applied_marker" != "$target_commit" ]]; then
      if [[ ! "$applied_marker" =~ ^[0-9a-f]{40}$ ]] \
         || git -C "$ROOT_DIR" merge-base --is-ancestor "$applied_marker" "$target_commit"; then
        write_applied_deploy_state "$target_commit" || return 79
      elif ! git -C "$ROOT_DIR" merge-base --is-ancestor "$target_commit" "$applied_marker"; then
        return 79
      fi
    fi
    retire_matching_runtime_quarantine "$postdeploy_candidate_id" "$target_commit" || return 79
    if [[ -s "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" ]]; then
      run_runtime_candidate_checkpoint clear-success || return 79
    fi
    archive_postdeploy_attempt_journal_terminal ABORTED || return 79
    runtime_deployed_commit="$target_commit"
    postdeploy_candidate_promoted=true
    echo "[auto-deploy] reconciled terminal attempt recovery PASS source=$target_commit requested=$postdeploy_candidate_id rollback=0"
    return 0
  fi
  if [[ "$db_staged" == true ]]; then
    # A filesystem ABORTED record never authorizes restore by itself. Re-run
    # the DB exact-CAS read under the source advisory lock. Any source
    # promotion (including another candidate winning after a crash) makes the
    # helper fail and keeps physical state untouched.
    db_abort_status=0
    abort_postdeploy_release_attempt_db "$runtime_hash" "$reason" || db_abort_status=$?
    if (( db_abort_status != 0 )); then
      write_postdeploy_promotion_quarantine 'ABORTED_ATTEMPT_DB_RECONFIRM_FAILED' || true
      return 79
    fi
  elif [[ "$reason" != PRE_RUNTIME_FAILURE || "$rollback_stage" != RESTORED_VERIFIED ]]; then
    return 79
  fi
  if [[ "$rollback_stage" == ABORT_AUTHORIZED ]]; then
    OVERLAY_DIR="$live_frontend_overlay" \
    FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
    FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
    FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
      bash "$POSTDEPLOY_GATE_SCRIPT" restore-physical || return 79
    advance_postdeploy_rollback_stage ABORT_AUTHORIZED PHYSICAL_RESTORED || return 79
    rollback_stage=PHYSICAL_RESTORED
    postdeploy_rollback_restored=true
  fi
  if [[ "$rollback_stage" == PHYSICAL_RESTORED ]]; then
    OVERLAY_DIR="$live_frontend_overlay" \
    FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
    FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
    FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
      bash "$POSTDEPLOY_GATE_SCRIPT" verify-restored-physical || return 79
    record_runtime_release_state "$baseline" observe-only || return 79
    OVERLAY_DIR="$live_frontend_overlay" \
    FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
    FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
    FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
      bash "$POSTDEPLOY_GATE_SCRIPT" restore-markers || return 79
    verify_operational_usage_ledger_current_runtime_identity "$baseline" proof-only || return 79
    OVERLAY_DIR="$live_frontend_overlay" \
    FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
    FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
    FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
      bash "$POSTDEPLOY_GATE_SCRIPT" verify-markers || return 79
    advance_postdeploy_rollback_stage PHYSICAL_RESTORED RESTORED_VERIFIED || return 79
    rollback_stage=RESTORED_VERIFIED
  fi
  [[ "$rollback_stage" == RESTORED_VERIFIED ]] || return 79
  OVERLAY_DIR="$live_frontend_overlay" \
  FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
  FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
  FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
    bash "$POSTDEPLOY_GATE_SCRIPT" verify-restored-physical || return 79
  verify_operational_usage_ledger_current_runtime_identity "$baseline" proof-only || return 79
  OVERLAY_DIR="$live_frontend_overlay" \
  FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
  FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
  FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
    bash "$POSTDEPLOY_GATE_SCRIPT" verify-markers || return 79
  if [[ -s "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" ]]; then
    run_runtime_candidate_checkpoint clear-failed || return 79
  fi
  # Persist terminal evidence before retiring the active rollback anchor.  The
  # exact retired pointer remains as immutable evidence; clearing the redundant
  # current journal is safe only after both durable artifacts exist.
  archive_postdeploy_attempt_journal_terminal ABORTED false || return 79
  OVERLAY_DIR="$live_frontend_overlay" FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
  FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
  FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
    bash "$POSTDEPLOY_GATE_SCRIPT" finalize-failed || return 79
  # Retire candidate-bound quarantine before dropping the final attempt anchor.
  # A crash can therefore only leave both journal and retired evidence, which
  # is an idempotent recovery state, never an orphan quarantine blocker.
  retire_matching_runtime_quarantine "$postdeploy_candidate_id" "$target_commit" || return 79
  python3 "$POSTDEPLOY_JOURNAL_HELPER" \
    --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" clear-terminal \
    ABORTED "$postdeploy_candidate_id" "$target_commit" >/dev/null || return 79
  runtime_deployed_commit="$baseline"
  echo "[auto-deploy] failed attempt rollback durable PASS candidate=$postdeploy_candidate_id baseline=$baseline rollbackStage=$rollback_stage"
}

cleanup_deploy() {
  local original_status=$? recovery_status=0 flyway_hold_active=false
  local cleanup_backup_dir="${BACKUP_DIR:-}" partial_backup
  trap - EXIT INT TERM
  set +e
  if [[ "$flyway_cleanup_recovery_hold" == true \
     || -e "$FLYWAY_CLEANUP_HOLD_FILE" || -L "$FLYWAY_CLEANUP_HOLD_FILE" ]]; then
    # Fix the handoff status before any best-effort cleanup can contact the API.
    # In particular, a half-open kubectl exec must never delay the status-79
    # OnFailure recovery path or let a later cleanup overwrite its contract.
    flyway_hold_active=true
    original_status=79
  fi
  if [[ "${composite_autocompletion_gate_prepared:-false}" == true ]]; then
    CARBONET_POSTDEPLOY_CANDIDATE_ID="$postdeploy_candidate_id" RESONANCE_ROOT="$ROOT_DIR" \
      bash "$ROOT_DIR/ops/scripts/prepare-composite-autocompletion-postdeploy.sh" \
        revoke-prepared >/dev/null 2>&1 || true
    sudo -n systemctl disable --now resonance-composite-live-smoke.timer \
      >/dev/null 2>&1 || true
  fi
  if [[ -n "$runtime_asset_sync_pid" ]] && kill -0 "$runtime_asset_sync_pid" 2>/dev/null; then
    kill "$runtime_asset_sync_pid" 2>/dev/null || true
    wait "$runtime_asset_sync_pid" 2>/dev/null || true
  fi
  terminate_runtime_screen_gate_group
  if [[ -n "$catalog_identity_sync_pid" ]] && kill -0 "$catalog_identity_sync_pid" 2>/dev/null; then
    kill "$catalog_identity_sync_pid" 2>/dev/null || true
    wait "$catalog_identity_sync_pid" 2>/dev/null || true
  fi
  if [[ -n "$backstage_visual_e2e_pid" ]] && kill -0 "$backstage_visual_e2e_pid" 2>/dev/null; then
    kill "$backstage_visual_e2e_pid" 2>/dev/null || true
    wait "$backstage_visual_e2e_pid" 2>/dev/null || true
  fi
  cleanup_remote_backup
  cleanup_local_schema_restore_container || original_status=79
  if [[ -n "$schema_restore_database" ]]; then
    bounded_cleanup_kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      psql -U "$POSTGRES_USER" -h 127.0.0.1 -d postgres \
        -c "drop database if exists \"$schema_restore_database\" with (force)" \
      >/dev/null 2>&1 || true
  fi
  if [[ -n "$schema_backup_dir" ]]; then
    rm -rf -- "$schema_backup_dir"
  fi
  for partial_backup in "${backup_partial_file:-}" "${roles_backup_partial_file:-}"; do
    [[ -z "$partial_backup" ]] && continue
    if [[ -z "$cleanup_backup_dir" ]]; then
      original_status=79
      continue
    fi
    case "$partial_backup" in
      "$cleanup_backup_dir"/*.partial."$$") rm -f -- "$partial_backup" ;;
      *) original_status=79 ;;
    esac
  done
  current_root="$(realpath -m "${ROOT_DIR:-/}")"
  persistent_root="$(realpath -m "${persistent_build_worktree:-/nonexistent}")"
  if [[ "$current_root" == "$persistent_root" &&
        -x "$current_root/ops/scripts/normalize-deploy-generated-assets.sh" ]]; then
    bash "$current_root/ops/scripts/normalize-deploy-generated-assets.sh" "$current_root" ||
      echo "[auto-deploy] WARN generated worktree normalization failed" >&2
  fi
  if [[ -n "${CARBONET_DEPLOY_SNAPSHOT_PATH:-}" ]]; then
    rm -f -- "$CARBONET_DEPLOY_SNAPSHOT_PATH"
  fi
  if [[ "$flyway_hold_active" == true \
     || "$flyway_cleanup_recovery_hold" == true \
     || -e "$FLYWAY_CLEANUP_HOLD_FILE" || -L "$FLYWAY_CLEANUP_HOLD_FILE" ]]; then
    # Never race an unknown Flyway backend with the durable rollback helpers.
    # The next invocation must run recover_flyway_cleanup_hold_if_present first.
    original_status=79
    echo '[auto-deploy] RECOVERY_HOLD preserved attempt/checkpoint state until Flyway Job/Pod/session zero is proven' >&2
  elif [[ -s "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" && "$postdeploy_candidate_promoted" != true ]]; then
    recover_staged_postdeploy_attempt_after_failure || recovery_status=$?
  elif [[ "$postdeploy_candidate_initialized" == true && "$postdeploy_candidate_promoted" != true ]]; then
    reconcile_postdeploy_candidate_after_failure || recovery_status=$?
  fi
  (( recovery_status == 0 )) || original_status="$recovery_status"
  rm -f -- "${DEPLOY_PHASE_FILE:-}"
  exit "$original_status"
}
handle_deploy_signal() {
  local status="$1"
  trap - INT TERM
  exit "$status"
}
trap cleanup_deploy EXIT
trap 'handle_deploy_signal 130' INT
trap 'handle_deploy_signal 143' TERM

# Prepare an attempt-unique identity now, but enable candidate writes only in a
# path that actually changes the served runtime identity. Catalog/backstage and
# automation-only paths keep validating the already deployed runtime.
postdeploy_candidate_id="postdeploy:${target_commit:0:12}:$(date -u +%Y%m%dT%H%M%S%N):$$:${RANDOM}${RANDOM}"
[[ "$postdeploy_candidate_id" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] || {
  echo '[auto-deploy] generated postdeploy candidate id is invalid' >&2
  exit 18
}
unset CARBONET_POSTDEPLOY_EVIDENCE_MODE CARBONET_POSTDEPLOY_CANDIDATE_ID CARBONET_POSTDEPLOY_SOURCE_COMMIT
echo "[auto-deploy] postdeploy candidate identity prepared id=$postdeploy_candidate_id sourceCommit=$target_commit"

run_runtime_candidate_checkpoint() {
  local action="$1"
  local failure_recovery_verified=false
  [[ "$action" != clear-failed ]] || failure_recovery_verified=true
  CARBONET_RUNTIME_CANDIDATE_CHECKPOINT_FILE="$RUNTIME_CANDIDATE_CHECKPOINT_FILE" \
  CARBONET_DEPLOY_ROOT="$ROOT_DIR" \
  CARBONET_CHECKPOINT_BASE_COMMIT="$deployed_commit" \
  CARBONET_CHECKPOINT_TARGET_COMMIT="$target_commit" \
  CARBONET_CHECKPOINT_PLAN_RUNTIME="${PLAN_RUNTIME_REQUIRED:-false}" \
  CARBONET_CHECKPOINT_PLAN_FRONTEND="${PLAN_FRONTEND_REQUIRED:-false}" \
  CARBONET_CHECKPOINT_PLAN_BACKEND="${PLAN_BACKEND_REQUIRED:-false}" \
  CARBONET_CHECKPOINT_PLAN_DATABASE="${PLAN_DATABASE_REQUIRED:-false}" \
  CARBONET_CHECKPOINT_PLAN_BACKSTAGE="${PLAN_BACKSTAGE_REQUIRED:-false}" \
  CARBONET_CHECKPOINT_PLAN_INFRASTRUCTURE="${PLAN_INFRASTRUCTURE_REQUIRED:-false}" \
  CARBONET_CHECKPOINT_PLAN_TESTS="${PLAN_TESTS:-}" \
  CARBONET_K8S_NAMESPACE="$NAMESPACE" \
  CARBONET_K8S_DEPLOYMENT="$DEPLOYMENT" \
  CARBONET_K8S_CONTAINER="${CARBONET_K8S_CONTAINER:-carbonet-runtime}" \
  CARBONET_RUNTIME_BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}" \
  CARBONET_RUNTIME_ASSET_DIR="${CARBONET_RUNTIME_ASSET_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}" \
  CARBONET_ROLLBACK_ACTIVE_FILE="$FULL_SCREEN_GATE_STATE_DIR/active.env" \
  CARBONET_CHECKPOINT_FAILURE_RECOVERY_VERIFIED="$failure_recovery_verified" \
  POSTGRES_POD="${POSTGRES_POD:-}" \
  POSTGRES_CONTAINER="$POSTGRES_CONTAINER" \
  POSTGRES_DB="$POSTGRES_DB" \
  POSTGRES_USER="$POSTGRES_USER" \
  KUBECONFIG="$KUBECONFIG" \
    bash "$POSTDEPLOY_CHECKPOINT_SCRIPT" "$action"
}

initialize_postdeploy_attempt_journal() {
  [[ "$postdeploy_attempt_journal_initialized" != true ]] || return 0
  local snapshot payload
  snapshot="$(OVERLAY_DIR="$live_frontend_overlay" \
    bash "$POSTDEPLOY_GATE_SCRIPT" describe)" \
    || { echo '[auto-deploy] rollback snapshot describe failed' >&2; return 1; }
  payload="$(jq -cn --arg candidate "$postdeploy_candidate_id" \
    --arg source "$target_commit" --arg base "$runtime_deployed_commit" \
    --arg stagedAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" --argjson snapshot "$snapshot" '
    {
      schemaVersion:2,lifecycleStatus:"STAGED",rollbackStage:"SNAPSHOT_CAPTURED",dbAttemptStaged:false,
      attemptId:$candidate,candidateId:$candidate,
      sourceCommit:$source,baseCommit:$base,runtimeIdentityHash:null,terminalReason:null,
      stagedAt:$stagedAt,terminalAt:null,
      rollback:{
        snapshotId:$snapshot.snapshotId,snapshotDir:$snapshot.snapshotDir,
        snapshotManifestSha256:$snapshot.snapshotManifestSha256,
        runtimeImageRef:$snapshot.runtimeImageRef,runtimeImageId:$snapshot.runtimeImageId,
        deploymentUid:$snapshot.deploymentUid,deploymentGeneration:$snapshot.deploymentGeneration,
        deploymentAnnotationsSha256:$snapshot.deploymentAnnotationsSha256,
        podTemplateSha256:$snapshot.podTemplateSha256,
        appliedMarkerCommit:$snapshot.appliedMarkerCommit,
        appliedMarkerSha256:$snapshot.appliedMarkerSha256,
        runtimeMarkerCommit:$snapshot.runtimeMarkerCommit,
        runtimeMarkerSha256:$snapshot.runtimeMarkerSha256
      }
    }
  ')" || return 1
  printf '%s\n' "$payload" | python3 "$POSTDEPLOY_JOURNAL_HELPER" \
    --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" stage >/dev/null
  postdeploy_attempt_journal_initialized=true
  local stage_status=0
  stage_postdeploy_release_attempt_db || stage_status=$?
  if (( stage_status == 0 )); then
    postdeploy_db_attempt_staged=true
    echo "[auto-deploy] durable attempt ARMED candidate=$postdeploy_candidate_id source=$target_commit baseline=$runtime_deployed_commit"
  elif (( stage_status == 3 )) && [[ "${PLAN_DATABASE_REQUIRED:-false}" == true ]]; then
    echo "[auto-deploy] attempt snapshot captured; DB arm deferred until candidate Flyway installs lifecycle migration"
  else
    echo "[auto-deploy] durable DB attempt arm failed before live mutation status=$stage_status" >&2
    return "$stage_status"
  fi
}

stage_postdeploy_release_attempt_db() {
  CARBONET_DEPLOY_ROOT="$ROOT_DIR" \
  CARBONET_POSTDEPLOY_CANDIDATE_ID="$postdeploy_candidate_id" \
  CARBONET_POSTDEPLOY_SOURCE_COMMIT="$target_commit" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$POSTDEPLOY_JOURNAL_HELPER" \
  CARBONET_POSTDEPLOY_LEADER_RESOLVER="$POSTDEPLOY_LEADER_RESOLVER" \
  CARBONET_K8S_NAMESPACE="$NAMESPACE" CARBONET_POSTGRES_CONTAINER="$POSTGRES_CONTAINER" \
  POSTGRES_DB="$POSTGRES_DB" POSTGRES_ADMIN_USER="$POSTGRES_USER" \
  RESONANCE_POSTGRES_LEADER_POD="${POSTGRES_POD:-}" \
    bash "$POSTDEPLOY_STAGE_SCRIPT" \
      "$ROOT_DIR" "$postdeploy_candidate_id" "$target_commit"
}

verify_postdeploy_release_attempt_db_staged() {
  local result
  result="$(printf '%s\n' "select jsonb_build_object('status',attempt_status,'candidateId',candidate_id,'sourceCommit',source_commit)::text from framework_postdeploy_release_attempt where candidate_id=:'candidate_id' and source_commit=:'source_commit';" | \
    kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt -v ON_ERROR_STOP=1 \
        -v candidate_id="$postdeploy_candidate_id" -v source_commit="$target_commit")" || return 1
  jq -e --arg candidate "$postdeploy_candidate_id" --arg source "$target_commit" '
    .status=="STAGED" and .candidateId==$candidate and .sourceCommit==$source
  ' <<<"$result" >/dev/null || return 1
  python3 "$POSTDEPLOY_JOURNAL_HELPER" \
    --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read | jq -e \
      --arg candidate "$postdeploy_candidate_id" --arg source "$target_commit" '
      .lifecycleStatus=="STAGED" and .rollbackStage=="ARMED" and .dbAttemptStaged==true
      and .candidateId==$candidate and .sourceCommit==$source
    ' >/dev/null
}

current_runtime_identity_hash() {
  cat <<'SQL' | kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt -v ON_ERROR_STOP=1 \
      -v source_commit="$1"
SELECT CASE
  WHEN NOT (to_jsonb(runtime) ? 'pod_template_sha256') THEN
    encode(sha256(convert_to(concat_ws('|',
      source_commit,deployment_namespace,deployment_name,deployment_uid,
      deployment_generation,observed_generation,desired_replicas,
      image_ref,image_id,health_status
    ),'UTF8')),'hex')
  WHEN release_key='CARBONET_RUNTIME'
   AND source_commit='76a08e672ab7054914ec3b5aecb57bc8e7a298fa'
   AND deployment_namespace='carbonet-prod' AND deployment_name='carbonet-runtime'
   AND deployment_uid='5a9323d6-446c-49d2-ad3e-c300c18f5803'
   AND image_ref='localhost:5000/carbonet-runtime:2026.08.14-202346-gradle'
   AND image_id='sha256:48311ffbb0396684021efc84811c73432263850ce18c4d4412eb81151749e160'
   AND health_status='UP'
   AND to_jsonb(runtime)->>'pod_template_sha256'='3714b172fe60eed5d07658103aa5f51d6f9ef765f2cee2bd0ba304e71bfd9c1a' THEN
    encode(sha256(convert_to(concat_ws('|',
      source_commit,deployment_namespace,deployment_name,deployment_uid,
      deployment_generation,observed_generation,desired_replicas,
      image_ref,image_id,health_status
    ),'UTF8')),'hex')
  WHEN to_jsonb(runtime)->>'pod_template_sha256' ~ '^[0-9a-f]{64}$' THEN
    encode(sha256(convert_to(jsonb_build_array(
      'CARBONET_RUNTIME_IDENTITY_V2',source_commit,deployment_namespace,deployment_name,deployment_uid,
      deployment_generation,observed_generation,desired_replicas,
      image_ref,image_id,health_status,to_jsonb(runtime)->>'pod_template_sha256'
    )::text,'UTF8')),'hex')
  ELSE NULL
END
FROM framework_runtime_release_state runtime
WHERE release_key='CARBONET_RUNTIME' AND source_commit=:'source_commit' AND health_status='UP';
SQL
}

transition_postdeploy_attempt_journal() {
  local status="$1" runtime_hash="$2" reason="$3"
  python3 "$POSTDEPLOY_JOURNAL_HELPER" \
    --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" transition \
    "$status" "$postdeploy_candidate_id" "$target_commit" "$runtime_hash" "$reason" >/dev/null
}

advance_postdeploy_rollback_stage() {
  local expected="$1" next="$2"
  python3 "$POSTDEPLOY_JOURNAL_HELPER" \
    --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" advance-rollback \
    "$postdeploy_candidate_id" "$target_commit" "$expected" "$next" >/dev/null
}

cancel_pre_runtime_postdeploy_attempt_journal() {
  python3 "$POSTDEPLOY_JOURNAL_HELPER" \
    --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" cancel-pre-runtime \
    "$postdeploy_candidate_id" "$target_commit" >/dev/null
}

abort_postdeploy_release_attempt_db() {
  local runtime_hash="${1:--}" reason="${2:-DEPLOYMENT_FAILED}" status=0
  CARBONET_K8S_NAMESPACE="$NAMESPACE" CARBONET_POSTGRES_CONTAINER="$POSTGRES_CONTAINER" \
  POSTGRES_DB="$POSTGRES_DB" POSTGRES_ADMIN_USER="$POSTGRES_USER" \
  RESONANCE_POSTGRES_LEADER_POD="${POSTGRES_POD:-}" \
    bash "$POSTDEPLOY_ABORT_SCRIPT" \
      "$ROOT_DIR" "$postdeploy_candidate_id" "$target_commit" "$runtime_hash" "$reason" \
      >/dev/null || status=$?
  (( status == 0 || status == 3 )) || return "$status"
  return "$status"
}

run_screen_contract_runtime_save_gate_if_required() {
  local gate_status=0
  [[ "${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == candidate \
     || "${CARBONET_SCREEN_CONTRACT_PREVIEW_ONLY:-}" == 1 \
     || ",${PLAN_TESTS:-}," == *",runtime-contract:screen-save,"* ]] || return 0
  echo "[auto-deploy] screen contract runtime save gate started"
  if run_serialized_carbonet_auth_lifecycle screen-contract-runtime-save \
      env CARBONET_DEPLOY_ROOT="$ROOT_DIR" \
      CARBONET_RUNTIME_BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}" \
      CARBONET_SCREEN_CONTRACT_RENDER_PROBE="${CARBONET_SCREEN_CONTRACT_RENDER_PROBE:-1}" \
      CARBONET_SCREEN_CONTRACT_PREVIEW_ONLY="${CARBONET_SCREEN_CONTRACT_PREVIEW_ONLY:-0}" \
      bash ops/scripts/validate-screen-contract-runtime-save.sh; then
    gate_status=0
  else
    gate_status=$?
  fi
  if (( gate_status != 0 )); then
    echo "[auto-deploy] screen contract runtime save gate failed status=$gate_status" >&2
    return "$gate_status"
  fi
  echo "[auto-deploy] screen contract runtime save gate passed"
}

# Recovery-only already holds an exact durable journal and must not execute any
# ordinary deploy preparation while merely loading the remaining function
# definitions below.
if [[ "${CARBONET_RECOVERY_ONLY:-false}" != true ]]; then
# Database availability is a hard prerequisite for Flyway and every runtime
# health gate. Keep the Patroni image independently recoverable even when
# Docker/containerd or registry retention removes unused application layers.
if [[ "$PLAN_BACKEND_REQUIRED" == "true" || "$PLAN_DATABASE_REQUIRED" == "true" ]]; then
  bash ops/scripts/ensure-protected-runtime-images.sh
else
  echo "[auto-deploy] protected runtime image check skipped for non-image deployment"
fi

# Keep pre-deploy restore points bounded before build and backup I/O begins.
# Containerd and PostgreSQL backups share /opt; allowing unlimited dump history
# can taint the only Kubernetes node with DiskPressure and stall every rollout.
if [[ "$PLAN_DATABASE_REQUIRED" == "true" ]]; then
  bash ops/scripts/prune-predeploy-backups.sh
  bash ops/scripts/deduplicate-verified-postgres-backups.sh
else
  echo "[auto-deploy] PostgreSQL backup maintenance deferred for non-database deployment"
fi

# Recheck after backup pruning because concurrent workloads can consume the
# reservation while the deployment plan is being prepared.
if [[ "$PLAN_BACKEND_REQUIRED" == "true" || "$PLAN_DATABASE_REQUIRED" == "true" ]]; then
  bash "$POLICY_ROOT/ops/scripts/deploy-capacity-gate.sh"
else
  echo "[auto-deploy] second capacity check skipped; initial reservation remains valid"
fi

root_usage="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
if [[ "$root_usage" -ge 88 ]]; then
  echo "[auto-deploy] root usage ${root_usage}%: pruning unused Docker build cache and images before build"
  # BuildKit cache is separate from the image store and can grow by tens of
  # gigabytes even when image pruning reports nothing reclaimable.
  sudo docker builder prune -a -f >/dev/null
  sudo docker image prune -a -f >/dev/null
  sudo apt-get clean
  root_usage="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
fi
if [[ "$root_usage" -ge 88 ]]; then
  echo "[auto-deploy] refusing deployment: root disk usage remains ${root_usage}%" >&2
  exit 16
fi

tracked_source_changes="$(git diff --name-only -- \
  . \
  ':(exclude).gradle/**' \
  ':(exclude)apps/carbonet-api/src/main/resources/static/react-app/**' \
  ':(exclude)projects/carbonet-assets/static/react-app/**' \
  ':(exclude)projects/carbonet-backend-metadata/builder/platform-builder-store.json' \
  ':(exclude)projects/carbonet-backend-metadata/customer-trace/customer-approval-ledger.json' \
  ':(exclude)projects/carbonet-backend-metadata/git-build-monitoring-status.json' \
  ':(exclude)projects/carbonet-frontend/src/main/resources/static/react-app/**' \
  ':(exclude)projects/carbonet-frontend/source/.cache/full-screen-smoke/**' \
  ':(exclude)projects/carbonet-frontend/source/src/generated/screen-generation/generatedScreenFamily.ts' \
  ':(exclude)projects/carbonet-frontend/source/src/features/builder-studio/pageCompletenessInventory.ts' \
  ':(exclude)projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts' \
  ':(exclude)projects/carbonet-frontend/source/tsconfig.app.tsbuildinfo' \
  ':(exclude)projects/carbonet-frontend/target/**')"
if [[ -n "$tracked_source_changes" ]]; then
  if [[ "${CARBONET_CLEAN_WORKTREE_ACTIVE:-false}" == "true" ]]; then
    echo "[auto-deploy] refusing deployment: dedicated deployment worktree is modified" >&2
    printf '%s\n' "$tracked_source_changes" >&2
    exit 2
  fi

  # Server-authored or operator-owned changes in /opt/Resonance must never be
  # overwritten, but they also must not block unrelated commits forever. Build
  # the exact remote commit in a dedicated clean worktree. Reusing this one
  # worktree retains untracked Gradle outputs and turns unchanged modules into
  # sub-second UP-TO-DATE checks without touching operator-owned source.
  source_root="$ROOT_DIR"
  clean_worktree_base="${CARBONET_CLEAN_WORKTREE_BASE:-$source_root/var/deploy-worktrees}"
  clean_worktree="$clean_worktree_base/runtime-build"
  worktree_advanced=false
  restore_dirty_tracked_build_artifacts() {
    local repository="$1" manifest
    shift
    manifest="$(mktemp /tmp/carbonet-tracked-build-artifacts.XXXXXX)"
    git -C "$repository" diff --name-only -z -- "$@" >"$manifest"
    if [[ -s "$manifest" ]]; then
      xargs -0 -r git -C "$repository" restore --worktree -- <"$manifest"
    fi
    rm -f "$manifest"
  }
  mkdir -p "$clean_worktree_base"
  if [[ ! -e "$clean_worktree/.git" ]]; then
    echo "[auto-deploy] tracked operator changes detected; creating persistent isolated build worktree"
    git worktree add --detach "$clean_worktree" "$target_commit"
    worktree_advanced=true
  elif [[ "$(git -C "$clean_worktree" rev-parse HEAD)" != "$target_commit" ]]; then
    # Only generated assets may be dirty in this operator-owned worktree.
    # Restore those tracked files, retain untracked build/ directories, then
    # advance strictly by fast-forward so a rewritten branch fails closed.
    persistent_build_artifacts=(
      .gradle
      apps/carbonet-api/src/main/resources/static/react-app
      projects/carbonet-assets/static/react-app
      projects/carbonet-backend-metadata/builder/platform-builder-store.json
      projects/carbonet-backend-metadata/customer-trace/customer-approval-ledger.json
      projects/carbonet-backend-metadata/git-build-monitoring-status.json
      projects/carbonet-frontend/src/main/resources/static/react-app
      projects/carbonet-frontend/source/.cache/full-screen-smoke
      projects/carbonet-frontend/source/src/generated/screen-generation/generatedScreenFamily.ts
      projects/carbonet-frontend/source/src/features/builder-studio/pageCompletenessInventory.ts
      projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts
      projects/carbonet-frontend/source/tsconfig.app.tsbuildinfo
      projects/carbonet-frontend/target
    )
    restore_dirty_tracked_build_artifacts "$clean_worktree" "${persistent_build_artifacts[@]}"
    unexpected_build_changes="$(git -C "$clean_worktree" diff --name-only)"
    if [[ -n "$unexpected_build_changes" ]]; then
      echo "[auto-deploy] refusing deployment: persistent build worktree contains source changes" >&2
      printf '%s\n' "$unexpected_build_changes" >&2
      exit 24
    fi
    git -C "$clean_worktree" merge --ff-only "$target_commit"
    worktree_advanced=true
  fi
  if [[ "$(git -C "$clean_worktree" rev-parse HEAD)" != "$target_commit" ]]; then
    echo "[auto-deploy] refusing deployment: isolated worktree commit mismatch" >&2
    exit 21
  fi
  source_overlay="$source_root/projects/carbonet-frontend/src/main/resources/static/react-app"
  clean_overlay="$clean_worktree/projects/carbonet-frontend/src/main/resources/static/react-app"
  mkdir -p "$clean_worktree/var/run" "$clean_worktree/var/logs"
  if [[ -f "$source_overlay/index.html" && "$PLAN_RUNTIME_REQUIRED" == "true" ]]; then
    # Both worktrees live on /opt. A read-only hard-link snapshot preserves the
    # verified frontend closure without copying its full hashed asset graph.
    rm -rf -- "$clean_overlay"
    mkdir -p "$clean_overlay"
    cp -al "$source_overlay/." "$clean_overlay/"
    node "$clean_worktree/ops/scripts/verify-react-asset-closure.mjs" "$clean_overlay"
  elif [[ "$PLAN_RUNTIME_REQUIRED" != "true" ]]; then
    # Catalog/automation commits never mutate or serve this isolated overlay.
    # The checked-out closure is sufficient; copying and checking the live 313
    # file graph here would be pure repeated work.
    echo "[auto-deploy] isolated frontend overlay copy skipped for catalog-only work"
  fi
  ROOT_DIR="$clean_worktree"
  export ROOT_DIR CARBONET_DEPLOY_ROOT="$clean_worktree" CARBONET_CLEAN_WORKTREE_ACTIVE=true
  rebind_default_postdeploy_helpers
  cd "$ROOT_DIR"
  current_commit="$target_commit"
  # A failed build may leave generated tracked outputs when HEAD already equals
  # the retry target. A worktree created or fast-forwarded in this invocation
  # is already clean, so avoid repeating the same restore after advancement.
  if [[ "$worktree_advanced" != "true" ]]; then
    restore_dirty_tracked_build_artifacts "$clean_worktree" \
      apps/carbonet-api/src/main/resources/static/react-app \
      projects/carbonet-assets/static/react-app \
      projects/carbonet-frontend/source/.cache/full-screen-smoke \
      projects/carbonet-frontend/source/src/generated/screen-generation/generatedScreenFamily.ts \
      projects/carbonet-frontend/source/src/features/builder-studio/pageCompletenessInventory.ts \
      projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts \
      projects/carbonet-frontend/source/tsconfig.app.tsbuildinfo
  fi
  tracked_source_changes="$(git diff --name-only -- \
    . \
    ':(exclude)projects/carbonet-frontend/src/main/resources/static/react-app/**')"
  if [[ -n "$tracked_source_changes" ]]; then
    echo "[auto-deploy] refusing deployment: isolated worktree is unexpectedly modified" >&2
    printf '%s\n' "$tracked_source_changes" >&2
    exit 22
  fi
  echo "[auto-deploy] isolated deployment worktree ready: $ROOT_DIR"
fi
record_deploy_phase "worktree_prepare"

# The bootstrap check above already validates the same guard when its contract
# did not change. Re-run from the target tree only when the guard itself or its
# deployment policy changed; this preserves exact-revision validation without
# paying for the same Kubernetes lookup twice on every catalog-only commit.
if [[ "$platform_preflight_cache_reused" == "true" ]]; then
  echo "[auto-deploy] target Kyverno resource guard check reused from recent platform preflight"
elif git diff --quiet "$deployed_commit" "$target_commit" -- \
    ops/scripts/ensure-kyverno-resource-guard.sh; then
  echo "[auto-deploy] target Kyverno resource guard check reused from bootstrap"
else
  bash "$ROOT_DIR/ops/scripts/ensure-kyverno-resource-guard.sh"
fi

if ! git merge-base --is-ancestor "$current_commit" "$target_commit"; then
  echo "[auto-deploy] refusing non-fast-forward update: $current_commit -> $target_commit" >&2
  exit 3
fi

# Validate the exact pending commit after selecting its clean worktree. The
# bootstrap check above may legitimately run against the previously deployed
# tree when a new policy file is introduced by the pending commit.
if [[ "$PLAN_BACKSTAGE_REQUIRED" == "true" ]]; then
  bash "$ROOT_DIR/ops/scripts/test-backstage-fast-deploy-policy.sh"
fi

# The React hostPath is the live runtime closure, while index.html and the Vite
# manifest are still tracked for repository compatibility. Preserve the live
# closure before restoring generated worktree files: otherwise a catalog-only
# fast-forward can replace a freshly verified bundle graph with the stale
# repository copy after the screen gate has already passed.
live_frontend_overlay="${CARBONET_LIVE_FRONTEND_OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}"
merge_overlay_backup="$(mktemp -d "$ROOT_DIR/var/run/pre-merge-overlay.XXXXXX")"
merge_overlay_backup_valid=false
if [[ -f "$live_frontend_overlay/index.html" \
   && ! ("${CARBONET_CLEAN_WORKTREE_ACTIVE:-false}" == "true" \
     && "$PLAN_RUNTIME_REQUIRED" != "true") ]]; then
  cp -al "$live_frontend_overlay/." "$merge_overlay_backup/"
  if node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$merge_overlay_backup" >/dev/null 2>&1; then
    merge_overlay_backup_valid=true
  elif [[ "$PLAN_FRONTEND_REQUIRED" == "true" ]]; then
    echo "[auto-deploy] stale frontend overlay detected; the new isolated frontend build will replace it"
  else
    echo "[auto-deploy] refusing deployment: the existing frontend closure is incomplete and no frontend rebuild is planned" >&2
    rm -rf "$merge_overlay_backup"
    exit 20
  fi
elif [[ "${CARBONET_CLEAN_WORKTREE_ACTIVE:-false}" == "true" \
     && "$PLAN_RUNTIME_REQUIRED" != "true" ]]; then
  # This worktree is not the mounted production overlay and catalog-only work
  # cannot alter runtime assets. Preserve the real live closure by doing
  # nothing instead of snapshotting and restoring an unused checkout.
  echo "[auto-deploy] isolated overlay snapshot skipped for catalog-only work"
fi
else
  merge_overlay_backup=""
  merge_overlay_backup_valid=false
fi

restore_live_frontend_overlay() {
  if [[ "$merge_overlay_backup_valid" == "true" && -f "$merge_overlay_backup/index.html" ]]; then
    rsync -a --delete "$merge_overlay_backup/" "$live_frontend_overlay/"
    node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$live_frontend_overlay"
  elif [[ "$PLAN_FRONTEND_REQUIRED" == "true" ]]; then
    echo "[auto-deploy] skipped restoration of stale frontend overlay"
  fi
  rm -rf "$merge_overlay_backup"
  merge_overlay_backup=""
}

deploy_backstage_if_required() {
  [[ "${PLAN_BACKSTAGE_REQUIRED:-false}" == "true" ]] || return 0
  local checkpoint status
  checkpoint="$(cat "$BACKSTAGE_DEPLOY_STATE_FILE" 2>/dev/null || true)"
  if [[ "$checkpoint" == "$target_commit" ]]; then
    status="$(curl -k -sS -o /dev/null -w '%{http_code}' --max-time 10 \
      https://backstage.172.16.1.232.nip.io/.backstage/health/v1/readiness || true)"
    if [[ "$status" == "200" ]]; then
      echo "[auto-deploy] Backstage runtime checkpoint verified; resuming at E2E gates"
      return 0
    fi
    echo "[auto-deploy] stale Backstage checkpoint ignored: readiness returned $status" >&2
  fi
  echo "[auto-deploy] Backstage-only image build and rollout started"
  bash ops/scripts/resonance-backstage-deploy.sh
  # The ingress endpoint can briefly return 502 while its upstream switches
  # from the terminating pod to the newly ready pod. Require a stable 200, but
  # absorb only that bounded post-rollout propagation window.
  status=""
  for attempt in 1 2 3 4 5; do
    status="$(curl -k -sS -o /dev/null -w '%{http_code}' --max-time 10 \
      https://backstage.172.16.1.232.nip.io/.backstage/health/v1/readiness || true)"
    [[ "$status" == "200" ]] && break
    echo "[auto-deploy] Backstage ingress readiness attempt $attempt/5 returned $status" >&2
    sleep 2
  done
  if [[ "$status" != "200" ]]; then
    echo "[auto-deploy] refusing success marker: Backstage readiness returned $status" >&2
    exit 24
  fi
  printf '%s\n' "$target_commit" > "${BACKSTAGE_DEPLOY_STATE_FILE}.tmp"
  mv "${BACKSTAGE_DEPLOY_STATE_FILE}.tmp" "$BACKSTAGE_DEPLOY_STATE_FILE"
  echo "[auto-deploy] Backstage runtime verified"
}

derive_backstage_e2e_routes() {
  local file routes="" full=false
  add_route() {
    [[ ",$routes," == *",$1,"* ]] || routes="${routes:+$routes,}$1"
  }
  add_core_routes() {
    add_route /actor-process-control
    add_route /identity-administration
    add_route /system-operations
  }
  while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    case "$file" in
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/ScreenDesignCatalogPage.tsx)
        add_route /ccus-screen-designs ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/ScreenSpaceRuntimePage.tsx|\
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/ScreenSpaceEnginePage.tsx|\
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/screenSpaceEngine.ts)
        add_route /ccus-screen-space ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/ResonanceProjectControlPage.tsx|\
      platform/control-plane/backstage/packages/backend/src/plugins/resonanceProjects.ts)
        add_route /resonance-projects ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/ResonanceControlAssetsPage.tsx)
        add_route /resonance-control-assets ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/ActorProcessControlPage.tsx|\
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/actorProcessWorkspaces.ts)
        add_route /actor-process-control
        add_route /actor-process-design
        add_route /actor-process-development
        add_route /actor-process-operations ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/DesignAssetControlPage.tsx)
        add_route /design-assets ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/IdentityAdministrationPage.tsx|\
      platform/control-plane/backstage/packages/backend/src/plugins/resonanceIdentityAdmin.ts)
        add_route /identity-administration ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/SystemOperationsControlPage.tsx)
        add_route /system-operations ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/SystemDevelopmentControlPage.tsx)
        add_route /system-development ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/SystemSecurityControlPage.tsx)
        add_route /system-security ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/MigrationCutoverPage.tsx|\
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/migrationCutoverRegistry.ts)
        add_route /migration-cutover ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/SystemRecoveryControlPage.tsx|\
      platform/control-plane/backstage/packages/backend/src/plugins/resonanceRecovery.ts)
        add_route /system-recovery ;;
      deploy/k8s/control-plane/backstage.yaml|\
      ops/scripts/auto-deploy-main.sh|\
      ops/scripts/resonance-backstage-deploy.sh|\
      ops/scripts/resonance-backstage-runtime-fingerprint.sh|\
      ops/scripts/resonance-backstage-full-e2e.sh|\
      ops/scripts/test-backstage-runtime-fingerprint.sh|\
      ops/scripts/test-backstage-runtime-purge-recovery-secret.sh|\
      ops/scripts/test-backstage-fast-deploy-policy.sh|\
      ops/scripts/test-catalog-identity-parallel-deploy.sh|\
      ops/systemd/resonance-backstage-full-e2e.service|\
      ops/systemd/resonance-backstage-full-e2e.timer|\
      platform/control-plane/backstage/app-config*.yaml|\
      platform/control-plane/backstage/packages/backend/Dockerfile)
        add_core_routes ;;
      *) full=true ;;
    esac
  done < <(git diff --name-only "$deployed_commit" "$target_commit")
  [[ "$full" == true ]] && return 0
  printf '%s\n' "$routes"
}

run_backstage_visual_e2e_if_required() {
  if [[ "$PLAN_BACKSTAGE_REQUIRED" != "true" \
     && ",$PLAN_TESTS," != *",backstage:visual-e2e,"* \
     && ",$PLAN_TESTS," != *",backstage:catalog-sync,"* ]]; then
    return
  fi
  local e2e_scope="${RESONANCE_BACKSTAGE_E2E_SCOPE:-full}" display_scope
  local e2e_routes="${RESONANCE_BACKSTAGE_E2E_ROUTES:-${backstage_e2e_effective_routes:-}}"
  [[ -n "$e2e_routes" ]] || e2e_routes="$(derive_backstage_e2e_routes)"
  display_scope="$e2e_scope"
  [[ -n "$e2e_routes" ]] && display_scope=impact
  echo "[auto-deploy] Backstage visual E2E scope: $display_scope routes=${e2e_routes:-all}"
  BACKSTAGE_E2E_USERNAME="${BACKSTAGE_E2E_USERNAME:-sjkim}" \
  BACKSTAGE_E2E_SECRET_NAME="${BACKSTAGE_E2E_SECRET_NAME:-resonance-keycloak-integrated-admin}" \
  RESONANCE_BACKSTAGE_E2E_SCOPE="$e2e_scope" \
  RESONANCE_BACKSTAGE_E2E_ROUTES="$e2e_routes" \
  RESONANCE_E2E_SKIP_IDENTITY_PREFLIGHT=true \
  RESONANCE_ROOT="$ROOT_DIR" \
    bash ops/scripts/resonance-backstage-visual-e2e.sh
}

start_backstage_visual_e2e() {
  backstage_e2e_effective_routes="${RESONANCE_BACKSTAGE_E2E_ROUTES:-}"
  [[ -n "$backstage_e2e_effective_routes" ]] ||
    backstage_e2e_effective_routes="$(derive_backstage_e2e_routes)"
  backstage_visual_e2e_log="$ROOT_DIR/var/logs/backstage-visual-e2e-${target_commit:0:10}.log"
  (
    run_backstage_visual_e2e_if_required
  ) >"$backstage_visual_e2e_log" 2>&1 &
  backstage_visual_e2e_pid="$!"
  echo "[auto-deploy] Backstage visual E2E running concurrently pid=$backstage_visual_e2e_pid"
}

wait_backstage_visual_e2e() {
  if wait "$backstage_visual_e2e_pid"; then
    cat "$backstage_visual_e2e_log"
    backstage_visual_e2e_pid=""
  else
    echo "[auto-deploy] refusing success marker: concurrent Backstage visual E2E failed" >&2
    cat "$backstage_visual_e2e_log" >&2
    exit 26
  fi
}

run_backstage_identity_e2e_if_required() {
  if [[ "${PLAN_BACKSTAGE_REQUIRED:-false}" != "true" \
     && ",${PLAN_TESTS:-}," != *",backstage:build-deploy,"* ]]; then
    return 0
  fi
  RESONANCE_ROOT="$ROOT_DIR" \
    bash ops/scripts/resonance-identity-admin-e2e.sh
}

backstage_actor_process_readiness_status() {
  local backstage_url="${BACKSTAGE_URL:-https://backstage.172.16.1.232.nip.io}"
  local ca_cert="${RESONANCE_INTERNAL_CA:-$HOME/.config/resonance/backstage-tls/ca.crt}"
  local http_timeout_seconds="${RESONANCE_BACKSTAGE_SELF_HEAL_HTTP_TIMEOUT_SECONDS:-2}"
  local status
  status="$(curl --cacert "$ca_cert" --connect-timeout 2 --max-time "$http_timeout_seconds" \
    -sS -o /dev/null -w '%{http_code}' \
    "$backstage_url/.backstage/health/v1/readiness")" || status=000
  printf '%s\n' "$status"
}

ensure_backstage_actor_process_e2e_ready() {
  local namespace="${RESONANCE_BACKSTAGE_NAMESPACE:-resonance-ops}"
  local deployment="${RESONANCE_BACKSTAGE_DEPLOYMENT:-resonance-backstage}"
  local rollout_timeout_seconds="${RESONANCE_BACKSTAGE_SELF_HEAL_TIMEOUT_SECONDS:-30}"
  local precheck_attempts="${RESONANCE_BACKSTAGE_SELF_HEAL_PRECHECK_ATTEMPTS:-3}"
  local readiness_attempts="${RESONANCE_BACKSTAGE_SELF_HEAL_READINESS_ATTEMPTS:-5}"
  local retry_delay_seconds="${RESONANCE_BACKSTAGE_SELF_HEAL_RETRY_DELAY_SECONDS:-1}"
  local http_timeout_seconds="${RESONANCE_BACKSTAGE_SELF_HEAL_HTTP_TIMEOUT_SECONDS:-2}"
  local final_status attempt observed_deployment self_heal_budget_seconds
  [[ "$namespace" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ \
     && "$deployment" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]] || {
    echo '[auto-deploy] invalid Backstage self-heal target' >&2
    return 2
  }
  [[ "$rollout_timeout_seconds" =~ ^[1-9][0-9]?$ \
     && "$precheck_attempts" =~ ^[1-9]$ \
     && "$readiness_attempts" =~ ^[1-9]$ \
     && "$http_timeout_seconds" =~ ^[1-5]$ \
     && "$retry_delay_seconds" =~ ^[0-5]$ ]] || {
    echo '[auto-deploy] invalid Backstage self-heal bound' >&2
    return 2
  }
  self_heal_budget_seconds=$((
    rollout_timeout_seconds
    + (precheck_attempts + readiness_attempts) * http_timeout_seconds
    + (precheck_attempts + readiness_attempts - 2) * retry_delay_seconds
  ))
  ((self_heal_budget_seconds < 60)) || {
    echo "[auto-deploy] Backstage self-heal budget exceeds 59s: ${self_heal_budget_seconds}s" >&2
    return 2
  }

  for attempt in $(seq 1 "$precheck_attempts"); do
    final_status="$(backstage_actor_process_readiness_status)"
    if [[ "$final_status" == 200 ]]; then
      echo "[auto-deploy] Backstage actor/process readiness PASS selfHealRestarts=0 precheckAttempts=$attempt"
      return 0
    fi
    ((attempt == precheck_attempts)) || sleep "$retry_delay_seconds"
  done

  echo "[auto-deploy] Backstage actor/process readiness remained HTTP $final_status after $precheck_attempts checks; starting one bounded self-heal restart" >&2
  observed_deployment="$(kubectl -n "$namespace" get "deployment/$deployment" -o name)" || {
    echo '[auto-deploy] Backstage self-heal target lookup failed' >&2
    return 1
  }
  [[ "$observed_deployment" == "deployment.apps/$deployment" ]] || {
    echo "[auto-deploy] Backstage self-heal target mismatch: $observed_deployment" >&2
    return 1
  }
  kubectl -n "$namespace" rollout restart "deployment/$deployment" >/dev/null || {
    echo '[auto-deploy] Backstage self-heal restart failed' >&2
    return 1
  }
  kubectl -n "$namespace" rollout status "deployment/$deployment" \
    --timeout="${rollout_timeout_seconds}s" >/dev/null || {
    echo "[auto-deploy] Backstage self-heal rollout failed timeout=${rollout_timeout_seconds}s" >&2
    return 1
  }
  for attempt in $(seq 1 "$readiness_attempts"); do
    final_status="$(backstage_actor_process_readiness_status)"
    if [[ "$final_status" == 200 ]]; then
      echo "[auto-deploy] Backstage actor/process readiness PASS selfHealRestarts=1 attempts=$attempt"
      return 0
    fi
    ((attempt == readiness_attempts)) || sleep "$retry_delay_seconds"
  done
  echo "[auto-deploy] Backstage self-heal failed HTTP $final_status restarts=1 attempts=$readiness_attempts" >&2
  return 1
}

run_serialized_carbonet_actor_process_e2e_job() {
  local job_name="$1"
  shift
  (
    # The Carbonet browser E2Es use the same single-session QA principals. Hold
    # the canonical authentication lock for the complete child lifecycle so
    # another login cannot revoke a token between login and the final check.
    # The helper records the owning BASHPID: children borrow the inherited file
    # descriptor without reacquiring it, and their release is a no-op so only
    # this owner can unlock the complete lifecycle.
    export CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS="${CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-300}"
    # shellcheck source=ops/scripts/runtime-qa-auth-common.sh
    source "$ROOT_DIR/ops/scripts/runtime-qa-auth-common.sh"
    if ! carbonet_qa_auth_acquire_lock; then
      echo "[auto-deploy] actor/process E2E auth lock failed job=$job_name" >&2
      return 1
    fi
    local job_status=0
    trap carbonet_qa_auth_release_lock EXIT
    echo "[auto-deploy] actor/process E2E auth lock acquired job=$job_name"
    "$@" || job_status=$?
    carbonet_qa_auth_release_lock
    trap - EXIT
    if ((job_status != 0)); then
      echo "[auto-deploy] actor/process E2E job failed job=$job_name status=$job_status" >&2
    fi
    return "$job_status"
  )
}

# All verifiers that currently resolve to the shared single-session Carbonet
# principal join the same lifecycle lock. The actor/process name remains as a
# compatibility entrypoint for its existing callers and contract tests.
run_serialized_carbonet_auth_lifecycle() {
  run_serialized_carbonet_actor_process_e2e_job "$@"
}

run_actor_process_role_e2e_if_required() {
  if [[ -n "${backstage_e2e_effective_routes:-}" ]] &&
    [[ ",${backstage_e2e_effective_routes}," != *",/actor-process-"* ]] &&
    [[ ",${backstage_e2e_effective_routes}," != *",/identity-administration,"* ]] &&
    [[ ",${backstage_e2e_effective_routes}," != *",/resonance-projects,"* ]]; then
    echo "[auto-deploy] actor-process role E2E skipped for unrelated routes: $backstage_e2e_effective_routes"
    return 0
  fi
  if [[ "${PLAN_BACKSTAGE_REQUIRED:-false}" != "true" \
     && ",${PLAN_TESTS:-}," != *",backstage:build-deploy,"* \
     && ",${PLAN_TESTS:-}," != *",backstage:visual-e2e,"* ]]; then
    if ! git diff --name-only "$deployed_commit" "$target_commit" -- \
        modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance \
        ops/scripts/resonance-actor-process-role-e2e.sh \
        ops/scripts/resonance-project-task-browser-e2e.mjs \
        ops/scripts/resonance-project-task-browser-e2e.sh \
        ops/scripts/resonance-seven-step-disposable-e2e.mjs \
        ops/scripts/resonance-seven-step-disposable-e2e.sh \
        ops/scripts/resonance-keycloak-deploy.sh \
        ops/scripts/resonance-keycloak-carbonet-identity-sync.sh \
        | grep -q .; then
      return 0
    fi
  fi
  local parallel_log_dir="$ROOT_DIR/var/logs/actor-process-parallel-${target_commit:0:10}"
  local actor_pid delivery_pid browser_pid lifecycle_pid
  local actor_status delivery_status browser_status lifecycle_status

  # The OIDC-dependent jobs require a Ready Backstage backend. One bounded
  # rollout restart repairs the observed stuck-but-live state; a persistent
  # failure stops before any actor/process E2E is launched.
  ensure_backstage_actor_process_e2e_ready || return $?
  rm -rf "$parallel_log_dir"
  mkdir -p "$parallel_log_dir"

  (RESONANCE_ROOT="$ROOT_DIR" bash ops/scripts/resonance-actor-process-role-e2e.sh) \
    >"$parallel_log_dir/actor-role.log" 2>&1 & actor_pid=$!
  (RESONANCE_ROOT="$ROOT_DIR" bash ops/scripts/resonance-project-delivery-e2e.sh) \
    >"$parallel_log_dir/project-delivery.log" 2>&1 & delivery_pid=$!
  run_serialized_carbonet_actor_process_e2e_job project-task-browser \
    env RESONANCE_ROOT="$ROOT_DIR" bash ops/scripts/resonance-project-task-browser-e2e.sh \
    >"$parallel_log_dir/browser.log" 2>&1 & browser_pid=$!
  run_serialized_carbonet_actor_process_e2e_job seven-step \
    env RESONANCE_ROOT="$ROOT_DIR" bash ops/scripts/resonance-seven-step-disposable-e2e.sh \
    >"$parallel_log_dir/seven-step.log" 2>&1 & lifecycle_pid=$!

  set +e
  wait "$actor_pid"; actor_status=$?
  wait "$delivery_pid"; delivery_status=$?
  wait "$browser_pid"; browser_status=$?
  wait "$lifecycle_pid"; lifecycle_status=$?
  set -e
  cat "$parallel_log_dir/actor-role.log"
  cat "$parallel_log_dir/project-delivery.log"
  cat "$parallel_log_dir/browser.log"
  cat "$parallel_log_dir/seven-step.log"
  if ((actor_status != 0 || delivery_status != 0 || browser_status != 0 || lifecycle_status != 0)); then
    echo "[auto-deploy] parallel actor/process E2E failed actor=$actor_status delivery=$delivery_status browser=$browser_status lifecycle=$lifecycle_status logs=$parallel_log_dir" >&2
    return 1
  fi
  echo "[auto-deploy] parallel actor/process E2E PASS jobs=4 carbonetAuthLifecycles=2 serialized=true logs=$parallel_log_dir"
}

sync_keycloak_actor_assignments_if_required() {
  if ! git diff --name-only "$deployed_commit" "$target_commit" -- \
      ops/scripts/resonance-keycloak-deploy.sh \
      ops/scripts/resonance-keycloak-carbonet-identity-sync.sh \
      ops/scripts/resonance-keycloak-carbonet-identity-sync-install.sh \
      ops/scripts/validate-keycloak-carbonet-identity-sync.sh \
      ops/scripts/resonance-keycloak-e2e-scope-sync.sh \
      ops/scripts/resonance-actor-process-role-e2e.sh \
      | grep -q .; then
    echo "[auto-deploy] identity reconciliation skipped: no identity contract change"
    return 0
  fi
  [[ ",${PLAN_TESTS:-}," != *",runtime:identity-staged-reconcile-required,"* ]] || {
    echo '[auto-deploy] BLOCKED identity reconciliation before any current-state write' >&2
    return 78
  }
  # Deployment validation never reconciles mutable Keycloak/Carbonet identity
  # state. Credential/harness-only changes prove that the already-provisioned
  # mapping is exact; a real identity-design change is blocked by the planner
  # above until a staged reconcile+rollback contract exists.
  bash ops/scripts/validate-keycloak-carbonet-identity-sync.sh
  echo '[auto-deploy] identity reconciliation verify-only PASS currentWrites=0'
}

run_backstage_screen_space_e2e_if_required() {
  if [[ "${PLAN_BACKSTAGE_REQUIRED:-false}" != "true" \
     && ",${PLAN_TESTS:-}," != *",backstage:build-deploy,"* ]]; then
    return 0
  fi
  RESONANCE_ROOT="$ROOT_DIR" \
  SCREEN_SPACE_VERIFY_ONLY=1 \
    bash ops/scripts/resonance-screen-space-runtime-e2e.sh
}

sync_backstage_catalog_if_required() {
  if [[ ",$PLAN_TESTS," != *",backstage:catalog-sync,"* \
     || "$PLAN_BACKSTAGE_REQUIRED" == "true" ]]; then
    return
  fi
  kubectl -n resonance-ops create configmap resonance-backstage-catalog \
    --from-file="$ROOT_DIR/platform/control-plane/catalog/organization.yaml" \
    --from-file="$ROOT_DIR/platform/control-plane/catalog/systems.yaml" \
    --from-file="$ROOT_DIR/platform/control-plane/catalog/components.yaml" \
    --from-file="$ROOT_DIR/platform/control-plane/catalog/apis.yaml" \
    --from-file="$ROOT_DIR/platform/control-plane/catalog/resources.yaml" \
    --from-file="$ROOT_DIR/platform/control-plane/catalog/environments.yaml" \
    --dry-run=client -o yaml | kubectl apply -f -
  kubectl -n resonance-ops rollout restart deployment/resonance-backstage
  kubectl -n resonance-ops rollout status deployment/resonance-backstage \
    --timeout=180s
}

# The standard build updates tracked generated bundles and Gradle state. They are
# deployment artifacts, not server-authored source changes, so restore only these
# known paths before the fast-forward merge.
if [[ "${CARBONET_RECOVERY_ONLY:-false}" != true ]]; then
generated_paths=(
  .gradle
  apps/carbonet-api/src/main/resources/static/react-app
  projects/carbonet-assets/static/react-app
  projects/carbonet-backend-metadata/builder/platform-builder-store.json
  projects/carbonet-backend-metadata/customer-trace/customer-approval-ledger.json
  projects/carbonet-backend-metadata/git-build-monitoring-status.json
  projects/carbonet-frontend/src/main/resources/static/react-app
  projects/carbonet-frontend/source/.cache/full-screen-smoke
  projects/carbonet-frontend/source/src/generated/screen-generation/generatedScreenFamily.ts
  projects/carbonet-frontend/source/src/features/builder-studio/pageCompletenessInventory.ts
  projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts
  projects/carbonet-frontend/source/tsconfig.app.tsbuildinfo
  projects/carbonet-frontend/target
)
if [[ "${worktree_advanced:-false}" != "true" ]]; then
  for generated_path in "${generated_paths[@]}"; do
    # A missing/ignored path must not cancel restoration of every later path.
    # Capture the complete result instead of piping into `grep -q`: with
    # pipefail enabled, grep's early exit can SIGPIPE git and falsely report that
    # a large tracked directory has no files.
    tracked_generated_files="$(git ls-files -- "$generated_path")"
    if [[ -n "$tracked_generated_files" ]]; then
      git restore --worktree -- "$generated_path"
    fi
  done

  remaining_generated_changes="$(git diff --name-only -- "${generated_paths[@]}")"
  if [[ -n "$remaining_generated_changes" ]]; then
    echo "[auto-deploy] refusing deployment: generated files could not be restored" >&2
    printf '%s\n' "$remaining_generated_changes" >&2
    exit 13
  fi
else
  echo "[auto-deploy] generated artifact restore skipped: worktree advanced cleanly"
fi
fi

declare -a deploy_changed_paths=()
control_plane_drift_check_due=true
patroni_memory_check_completed=false
patroni_memory_check_deferred=false

deploy_path_changed() {
  local changed_path candidate
  for changed_path in "${deploy_changed_paths[@]:-}"; do
    for candidate in "$@"; do
      [[ "$changed_path" == "$candidate" ]] && return 0
    done
  done
  return 1
}

sync_auto_deploy_failure_runtime_if_required() {
  local authority_helper_install_tmp launcher_install_tmp recovery_main_install_tmp orphan_recovery_helper_install_tmp
  local orphan_recovery_helper_source_sha256 orphan_recovery_helper_staged_sha256
  local recovery_main_source_sha256 recovery_main_staged_sha256
  local -a failure_runtime_contract_files=(
    ops/scripts/auto-deploy-main.sh
    ops/scripts/auto-deploy-main-launcher.sh
    ops/scripts/run-flyway-migration-job.sh
    ops/scripts/carbonet-auto-deploy-failure-handler.sh
    ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh
    ops/scripts/check-postdeploy-authoritative-promotion.sh
    ops/scripts/abort-postdeploy-release-attempt.sh
    ops/scripts/stage-postdeploy-release-attempt.sh
    ops/scripts/postdeploy-attempt-journal.py
    ops/scripts/postdeploy-attempt-recovery-runner.sh
    ops/scripts/record-runtime-release-state.sh
    ops/scripts/resonance-full-screen-deploy-gate.sh
    ops/scripts/runtime-candidate-checkpoint.sh
    ops/scripts/resolve-patroni-primary-pod.sh
    ops/scripts/verify-react-asset-closure.mjs
    ops/scripts/carbonet-deploy-notify.sh
    ops/scripts/test-auto-deploy-failure-handler.sh
    ops/tests/test-auto-deploy-bootstrap-helper-snapshot.sh
    ops/scripts/record-deploy-performance.sh
    ops/systemd/carbonet-auto-deploy.service
    ops/systemd/carbonet-auto-deploy-failure-handler.service
    ops/systemd/carbonet-postdeploy-recovery-watchdog.service
    ops/systemd/carbonet-postdeploy-recovery-watchdog.timer
  )
  if ! deploy_path_changed "${failure_runtime_contract_files[@]}" \
     && git diff --quiet "$deployed_commit" "$target_commit" -- \
          "${failure_runtime_contract_files[@]}"; then
    return 0
  fi
  bash ops/scripts/test-auto-deploy-failure-handler.sh
  bash ops/tests/test-auto-deploy-bootstrap-helper-snapshot.sh "$ROOT_DIR"
  sudo -n install -d -m 0755 -o root -g root \
    /opt/resonance-data/control-plane/bin
  sudo -n install -m 0750 -o root -g root \
    ops/scripts/carbonet-auto-deploy-failure-handler.sh \
    /opt/resonance-data/control-plane/bin/carbonet-auto-deploy-failure-handler.sh
  authority_helper_install_tmp="/opt/resonance-data/control-plane/bin/.check-postdeploy-authoritative-promotion.sh.$$"
  sudo -n install -m 0750 -o root -g root \
    ops/scripts/check-postdeploy-authoritative-promotion.sh \
    "$authority_helper_install_tmp"
  sudo -n mv -fT -- "$authority_helper_install_tmp" \
    /opt/resonance-data/control-plane/bin/check-postdeploy-authoritative-promotion.sh
  sudo -n install -m 0755 -o root -g root \
    ops/scripts/postdeploy-attempt-journal.py \
    /opt/resonance-data/control-plane/bin/postdeploy-attempt-journal.py
  sudo -n install -m 0755 -o root -g root \
    ops/scripts/postdeploy-attempt-recovery-runner.sh \
    /opt/resonance-data/control-plane/bin/postdeploy-attempt-recovery-runner.sh
  orphan_recovery_helper_install_tmp="/opt/resonance-data/control-plane/bin/.reconcile-exact-legacy-orphan-runtime-quarantine.$$"
  orphan_recovery_helper_source_sha256="$(sha256sum ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh | awk '{print $1}')"
  if ! sudo -n install -m 0755 -o root -g root \
      ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh \
      "$orphan_recovery_helper_install_tmp" \
     || ! sudo -n bash -n "$orphan_recovery_helper_install_tmp"; then
    sudo -n rm -f -- "$orphan_recovery_helper_install_tmp" || true
    return 79
  fi
  orphan_recovery_helper_staged_sha256="$(sudo -n sha256sum "$orphan_recovery_helper_install_tmp" | awk '{print $1}')"
  if [[ "$orphan_recovery_helper_source_sha256" != "$orphan_recovery_helper_staged_sha256" \
     || "$(sudo -n stat -c '%a:%u:%g' "$orphan_recovery_helper_install_tmp")" != 755:0:0 ]]; then
    sudo -n rm -f -- "$orphan_recovery_helper_install_tmp" || true
    return 79
  fi
  sudo -n mv -fT -- "$orphan_recovery_helper_install_tmp" \
    /opt/resonance-data/control-plane/bin/reconcile-exact-legacy-orphan-runtime-quarantine.sh
  sudo -n sync -f /opt/resonance-data/control-plane/bin/reconcile-exact-legacy-orphan-runtime-quarantine.sh
  sudo -n sync -f /opt/resonance-data/control-plane/bin
  [[ "$(stat -c '%a:%u:%g' /opt/resonance-data/control-plane/bin/reconcile-exact-legacy-orphan-runtime-quarantine.sh)" == 755:0:0 \
     && "$(sha256sum /opt/resonance-data/control-plane/bin/reconcile-exact-legacy-orphan-runtime-quarantine.sh | awk '{print $1}')" == "$orphan_recovery_helper_source_sha256" ]] || return 79
  # Main is the activation point after the exact helper is durable.
  recovery_main_install_tmp="/opt/resonance-data/control-plane/bin/.auto-deploy-main-recovery.$$"
  recovery_main_source_sha256="$(sha256sum ops/scripts/auto-deploy-main.sh | awk '{print $1}')"
  if ! sudo -n install -m 0755 -o root -g root \
      ops/scripts/auto-deploy-main.sh "$recovery_main_install_tmp" \
     || ! sudo -n bash -n "$recovery_main_install_tmp"; then
    sudo -n rm -f -- "$recovery_main_install_tmp" || true
    return 79
  fi
  recovery_main_staged_sha256="$(sudo -n sha256sum "$recovery_main_install_tmp" | awk '{print $1}')"
  if [[ "$recovery_main_source_sha256" != "$recovery_main_staged_sha256" \
     || "$(sudo -n stat -c '%a:%u:%g' "$recovery_main_install_tmp")" != 755:0:0 ]]; then
    sudo -n rm -f -- "$recovery_main_install_tmp" || true
    return 79
  fi
  sudo -n mv -fT -- "$recovery_main_install_tmp" \
    /opt/resonance-data/control-plane/bin/auto-deploy-main-recovery.sh
  sudo -n sync -f /opt/resonance-data/control-plane/bin/auto-deploy-main-recovery.sh
  sudo -n sync -f /opt/resonance-data/control-plane/bin
  [[ "$(stat -c '%a:%u:%g' /opt/resonance-data/control-plane/bin/auto-deploy-main-recovery.sh)" == 755:0:0 \
     && "$(sha256sum /opt/resonance-data/control-plane/bin/auto-deploy-main-recovery.sh | awk '{print $1}')" == "$recovery_main_source_sha256" ]] || return 79
  sudo -n install -m 0755 -o root -g root \
    ops/scripts/abort-postdeploy-release-attempt.sh \
    /opt/resonance-data/control-plane/bin/abort-postdeploy-release-attempt.sh
  sudo -n install -m 0755 -o root -g root \
    ops/scripts/stage-postdeploy-release-attempt.sh \
    /opt/resonance-data/control-plane/bin/stage-postdeploy-release-attempt.sh
  sudo -n install -m 0755 -o root -g root \
    ops/scripts/record-runtime-release-state.sh \
    /opt/resonance-data/control-plane/bin/record-runtime-release-state.sh
  sudo -n install -m 0755 -o root -g root \
    ops/scripts/resonance-full-screen-deploy-gate.sh \
    /opt/resonance-data/control-plane/bin/resonance-full-screen-deploy-gate.sh
  sudo -n install -m 0755 -o root -g root \
    ops/scripts/runtime-candidate-checkpoint.sh \
    /opt/resonance-data/control-plane/bin/runtime-candidate-checkpoint.sh
  sudo -n install -m 0755 -o root -g root \
    ops/scripts/resolve-patroni-primary-pod.sh \
    /opt/resonance-data/control-plane/bin/resolve-patroni-primary-pod.sh
  sudo -n install -m 0644 -o root -g root \
    ops/scripts/verify-react-asset-closure.mjs \
    /opt/resonance-data/control-plane/bin/verify-react-asset-closure.mjs
  launcher_install_tmp="/opt/resonance-data/deploy/.auto-deploy-main-launcher.$$"
  sudo -n install -m 0755 -o root -g root \
    ops/scripts/auto-deploy-main-launcher.sh "$launcher_install_tmp"
  sudo -n mv -fT -- "$launcher_install_tmp" \
    /opt/resonance-data/deploy/auto-deploy-main-launcher.sh
  sudo -n install -m 0750 -o root -g root \
    ops/scripts/carbonet-deploy-notify.sh \
    /opt/resonance-data/control-plane/bin/carbonet-deploy-notify.sh
  sudo -n install -m 0644 ops/systemd/carbonet-auto-deploy.service \
    /etc/systemd/system/carbonet-auto-deploy.service
  sudo -n install -m 0644 \
    ops/systemd/carbonet-auto-deploy-failure-handler.service \
    /etc/systemd/system/carbonet-auto-deploy-failure-handler.service
  sudo -n install -m 0644 \
    ops/systemd/carbonet-postdeploy-recovery-watchdog.service \
    /etc/systemd/system/carbonet-postdeploy-recovery-watchdog.service
  sudo -n install -m 0644 \
    ops/systemd/carbonet-postdeploy-recovery-watchdog.timer \
    /etc/systemd/system/carbonet-postdeploy-recovery-watchdog.timer
  sudo -n systemctl daemon-reload
  sudo -n systemctl enable --now carbonet-postdeploy-recovery-watchdog.timer >/dev/null
  echo "[auto-deploy] failure classification and one-shot recovery synchronized"
}

sync_postgres_backup_cronjobs_if_required() {
  local backup_contract_changed=false backup_contract_drift=false
  local memory_contract_changed=false memory_check_rc=0
  local -a backup_contract_files=(
    ops/scripts/apply-backup-cronjobs.sh
    ops/tests/test-backup-cronjobs-replica.sh
    ops/tests/test-backup-cronjobs-suspend-preservation.sh
  )
  if deploy_path_changed "${backup_contract_files[@]}" ||
    ! git diff --quiet "$deployed_commit" "$target_commit" -- "${backup_contract_files[@]}"; then
    backup_contract_changed=true
  fi
  if [[ "$backup_contract_changed" != "true" &&
        "${PLAN_RUNTIME_REQUIRED:-false}" != "true" &&
        "$control_plane_drift_check_due" != "true" ]] &&
    ! deploy_path_changed ops/scripts/configure-patroni-memory-safety.sh ops/tests/test-patroni-memory-safety.sh; then
    return 0
  fi

  # Runtime deployments do not populate deploy_changed_paths. Always compare
  # the live CronJob command contract on that path, so a manual/legacy pg_dump
  # command using HAProxy 5432 is repaired even when the hostPath is correct.
  if [[ "$backup_contract_changed" == "true" ||
        "${PLAN_RUNTIME_REQUIRED:-false}" == "true" ||
        "$control_plane_drift_check_due" == "true" ]]; then
    if ! bash ops/scripts/apply-backup-cronjobs.sh --check; then
      backup_contract_drift=true
    fi
  fi
  if [[ "$backup_contract_changed" == "true" || "$backup_contract_drift" == "true" ]]; then
    bash ops/tests/test-backup-cronjobs-replica.sh
    bash ops/tests/test-backup-cronjobs-suspend-preservation.sh
    bash ops/scripts/apply-backup-cronjobs.sh
    bash ops/scripts/apply-backup-cronjobs.sh --check
    echo "[auto-deploy] PostgreSQL backup CronJobs synchronized"
  fi
  if [[ "$patroni_memory_check_completed" != "true" ]] && {
    deploy_path_changed ops/scripts/configure-patroni-memory-safety.sh ops/tests/test-patroni-memory-safety.sh ||
      [[ "$control_plane_drift_check_due" == "true" ]];
  }; then
    deploy_path_changed ops/scripts/configure-patroni-memory-safety.sh ops/tests/test-patroni-memory-safety.sh &&
      memory_contract_changed=true
    if [[ "$memory_contract_changed" == "true" ]]; then
      bash ops/tests/test-patroni-memory-safety.sh
    fi
    bash ops/scripts/configure-patroni-memory-safety.sh || memory_check_rc=$?
    if (( memory_check_rc != 0 )); then
      if [[ "$memory_contract_changed" == "true" ]]; then
        return "$memory_check_rc"
      fi
      echo "[auto-deploy] warning: Patroni memory drift check deferred in an N-1 or transient state (rc=$memory_check_rc)" >&2
      patroni_memory_check_deferred=true
    fi
    patroni_memory_check_completed=true
  fi
}

sync_post_reboot_recovery_if_required() {
  if ! deploy_path_changed \
      ops/kubernetes/postgres-haproxy-config.yaml \
      ops/scripts/reconcile-post-reboot-runtime.sh \
      ops/systemd/carbonet-post-reboot-recovery.service &&
    [[ "$control_plane_drift_check_due" != "true" ]]; then
    return 0
  fi
  if deploy_path_changed \
      ops/kubernetes/postgres-haproxy-config.yaml \
      ops/scripts/reconcile-post-reboot-runtime.sh \
      ops/systemd/carbonet-post-reboot-recovery.service ||
    ! systemctl is-enabled --quiet carbonet-post-reboot-recovery.service; then
    sudo -n install -d -m 0755 /opt/resonance-data/control-plane/manifests
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/reconcile-post-reboot-runtime.sh \
      /opt/resonance-data/control-plane/bin/reconcile-post-reboot-runtime.sh
    sudo -n install -m 0644 \
      ops/kubernetes/postgres-haproxy-config.yaml \
      /opt/resonance-data/control-plane/manifests/postgres-haproxy-config.yaml
    sudo -n install -m 0644 \
      ops/systemd/carbonet-post-reboot-recovery.service \
      /etc/systemd/system/carbonet-post-reboot-recovery.service
    sudo -n systemctl daemon-reload
    sudo -n systemctl enable carbonet-post-reboot-recovery.service >/dev/null
    bash /opt/resonance-data/control-plane/bin/reconcile-post-reboot-runtime.sh
    echo "[auto-deploy] post-reboot runtime recovery synchronized"
  fi
}

sync_patroni_auto_heal_if_required() {
  if ! deploy_path_changed \
      ops/scripts/patroni-auto-heal.sh \
      ops/scripts/test-patroni-auto-heal-safety.sh \
      ops/systemd/carbonet-patroni-auto-heal.service \
      ops/systemd/carbonet-patroni-auto-heal.timer &&
    [[ "$control_plane_drift_check_due" != "true" ]]; then
    return 0
  fi
  if deploy_path_changed \
      ops/scripts/patroni-auto-heal.sh \
      ops/scripts/test-patroni-auto-heal-safety.sh \
      ops/systemd/carbonet-patroni-auto-heal.service \
      ops/systemd/carbonet-patroni-auto-heal.timer ||
    ! systemctl is-enabled --quiet carbonet-patroni-auto-heal.timer; then
    bash ops/scripts/test-patroni-auto-heal-safety.sh
    sudo -n install -d -m 0755 /opt/resonance-data/control-plane/bin
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/patroni-auto-heal.sh \
      /opt/resonance-data/control-plane/bin/patroni-auto-heal.sh
    sudo -n install -m 0644 \
      ops/systemd/carbonet-patroni-auto-heal.service \
      /etc/systemd/system/carbonet-patroni-auto-heal.service
    sudo -n install -m 0644 \
      ops/systemd/carbonet-patroni-auto-heal.timer \
      /etc/systemd/system/carbonet-patroni-auto-heal.timer
    sudo -n systemctl daemon-reload
    sudo -n systemctl enable --now carbonet-patroni-auto-heal.timer >/dev/null
    PATRONI_AUTO_HEAL_DRY_RUN=true \
      bash /opt/resonance-data/control-plane/bin/patroni-auto-heal.sh
    echo "[auto-deploy] guarded Patroni auto-heal synchronized"
  fi
}

sync_postgres_restore_drill_if_required() {
  if ! deploy_path_changed \
      ops/scripts/postgres-isolated-restore-drill.sh \
      ops/scripts/report-latest-postgres-restore-drill.sh \
      ops/scripts/test-postgres-isolated-restore-drill.sh \
      ops/systemd/carbonet-postgres-restore-drill.service \
      ops/systemd/carbonet-postgres-restore-drill.timer &&
    [[ "$control_plane_drift_check_due" != "true" ]]; then
    return 0
  fi
  if deploy_path_changed \
      ops/scripts/postgres-isolated-restore-drill.sh \
      ops/scripts/report-latest-postgres-restore-drill.sh \
      ops/scripts/test-postgres-isolated-restore-drill.sh \
      ops/systemd/carbonet-postgres-restore-drill.service \
      ops/systemd/carbonet-postgres-restore-drill.timer ||
    ! systemctl is-enabled --quiet carbonet-postgres-restore-drill.timer; then
    bash ops/scripts/test-postgres-isolated-restore-drill.sh
    sudo -n install -d -m 2770 -o sjkim -g sjkim \
      /opt/resonance-data/restore-drills \
      /opt/resonance-data/restore-drills/work \
      /opt/resonance-data/restore-drills/reports
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/postgres-isolated-restore-drill.sh \
      /opt/resonance-data/control-plane/bin/postgres-isolated-restore-drill.sh
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/report-latest-postgres-restore-drill.sh \
      /opt/resonance-data/control-plane/bin/report-latest-postgres-restore-drill.sh
    sudo -n install -m 0644 \
      ops/systemd/carbonet-postgres-restore-drill.service \
      /etc/systemd/system/carbonet-postgres-restore-drill.service
    sudo -n install -m 0644 \
      ops/systemd/carbonet-postgres-restore-drill.timer \
      /etc/systemd/system/carbonet-postgres-restore-drill.timer
    sudo -n systemctl daemon-reload
    sudo -n systemctl enable --now carbonet-postgres-restore-drill.timer >/dev/null
    echo "[auto-deploy] isolated PostgreSQL restore drill synchronized"
  fi
}

process_development_control_plane_in_sync() {
  cmp -s ops/scripts/run-process-development-dispatcher.sh \
      /opt/resonance-data/control-plane/bin/run-process-development-dispatcher.sh &&
    cmp -s ops/scripts/run-process-development-worker.sh \
      /opt/resonance-data/control-plane/bin/run-process-development-worker.sh &&
    cmp -s ops/scripts/run-project-auto-completion-orchestrator.sh \
      /opt/resonance-data/control-plane/bin/run-project-auto-completion-orchestrator.sh &&
    cmp -s ops/scripts/run-next-current-business-e2e.sh \
      /opt/resonance-data/control-plane/bin/run-next-current-business-e2e.sh &&
    cmp -s ops/scripts/run-composite-live-smoke.sh \
      /opt/resonance-data/control-plane/bin/run-composite-live-smoke.sh &&
    cmp -s ops/scripts/run-composite-live-smoke-slots.sh \
      /opt/resonance-data/control-plane/bin/run-composite-live-smoke-slots.sh &&
    cmp -s ops/scripts/generate-composite-relay-account-map.py \
      /opt/resonance-data/control-plane/bin/generate-composite-relay-account-map.py &&
    cmp -s ops/scripts/resonance-composite-live-smoke-e2e.mjs \
      /opt/resonance-data/control-plane/bin/resonance-composite-live-smoke-e2e.mjs &&
    cmp -s ops/scripts/composite-live-smoke-db-probe.sh \
      /opt/resonance-data/control-plane/bin/composite-live-smoke-db-probe.sh &&
    cmp -s ops/scripts/prepare-composite-autocompletion-postdeploy.sh \
      /opt/resonance-data/control-plane/bin/prepare-composite-autocompletion-postdeploy.sh &&
    cmp -s ops/scripts/lib/declared-process-relay-runtime.mjs \
      /opt/resonance-data/control-plane/bin/lib/declared-process-relay-runtime.mjs &&
    cmp -s ops/runtime-metadata/business-e2e-runner-registry.json \
      /opt/resonance-data/control-plane/runtime-metadata/business-e2e-runner-registry.json &&
    cmp -s ops/runtime-metadata/composite-live-smoke-runner.json \
      /opt/resonance-data/control-plane/runtime-metadata/composite-live-smoke-runner.json &&
    cmp -s ops/runtime-metadata/composite-relay-account-map.json \
      /opt/resonance-data/control-plane/runtime-metadata/composite-relay-account-map.json &&
    cmp -s ops/systemd/resonance-process-development-worker.service \
      /etc/systemd/system/resonance-process-development-worker.service &&
    cmp -s ops/systemd/resonance-process-development-worker.timer \
      /etc/systemd/system/resonance-process-development-worker.timer &&
    cmp -s ops/systemd/resonance-project-auto-completion.service \
      /etc/systemd/system/resonance-project-auto-completion.service &&
    cmp -s ops/systemd/resonance-project-auto-completion.timer \
      /etc/systemd/system/resonance-project-auto-completion.timer &&
    cmp -s ops/systemd/resonance-composite-live-smoke.service \
      /etc/systemd/system/resonance-composite-live-smoke.service &&
    cmp -s ops/systemd/resonance-composite-live-smoke.timer \
      /etc/systemd/system/resonance-composite-live-smoke.timer &&
    cmp -s ops/systemd/resonance-incremental-screen-generation.service \
      /etc/systemd/system/resonance-incremental-screen-generation.service &&
    cmp -s ops/systemd/resonance-incremental-screen-generation.timer \
      /etc/systemd/system/resonance-incremental-screen-generation.timer
}

sync_process_development_worker_if_required() {
  if ! deploy_path_changed \
      ops/scripts/run-process-development-dispatcher.sh \
      ops/scripts/run-process-development-worker.sh \
      ops/scripts/test-process-worker-deploy-marker.sh \
      ops/scripts/run-project-auto-completion-orchestrator.sh \
      ops/scripts/run-next-current-business-e2e.sh \
      ops/scripts/run-composite-live-smoke.sh \
      ops/scripts/run-composite-live-smoke-slots.sh \
      ops/scripts/generate-composite-relay-account-map.py \
      ops/scripts/resonance-composite-live-smoke-e2e.mjs \
      ops/scripts/composite-live-smoke-db-probe.sh \
      ops/scripts/prepare-composite-autocompletion-postdeploy.sh \
      ops/scripts/lib/declared-process-relay-runtime.mjs \
      ops/runtime-metadata/business-e2e-runner-registry.json \
      ops/runtime-metadata/composite-live-smoke-runner.json \
      ops/runtime-metadata/composite-relay-account-map.json \
      ops/tests/test-generate-composite-relay-account-map.py \
      ops/tests/test-prepare-composite-autocompletion-postdeploy.sh \
      ops/systemd/resonance-process-development-worker.service \
      ops/systemd/resonance-process-development-worker.timer \
      ops/systemd/resonance-project-auto-completion.service \
      ops/systemd/resonance-project-auto-completion.timer \
      ops/systemd/resonance-composite-live-smoke.service \
      ops/systemd/resonance-composite-live-smoke.timer \
      ops/systemd/resonance-incremental-screen-generation.service \
      ops/systemd/resonance-incremental-screen-generation.timer &&
    [[ "$control_plane_drift_check_due" != "true" ]] &&
    process_development_control_plane_in_sync; then
    return 0
  fi
  if deploy_path_changed \
      ops/scripts/run-process-development-dispatcher.sh \
      ops/scripts/run-process-development-worker.sh \
      ops/scripts/test-process-worker-deploy-marker.sh \
      ops/scripts/run-project-auto-completion-orchestrator.sh \
      ops/scripts/run-next-current-business-e2e.sh \
      ops/scripts/run-composite-live-smoke.sh \
      ops/scripts/run-composite-live-smoke-slots.sh \
      ops/scripts/generate-composite-relay-account-map.py \
      ops/scripts/resonance-composite-live-smoke-e2e.mjs \
      ops/scripts/composite-live-smoke-db-probe.sh \
      ops/scripts/prepare-composite-autocompletion-postdeploy.sh \
      ops/scripts/lib/declared-process-relay-runtime.mjs \
      ops/runtime-metadata/business-e2e-runner-registry.json \
      ops/runtime-metadata/composite-live-smoke-runner.json \
      ops/runtime-metadata/composite-relay-account-map.json \
      ops/tests/test-generate-composite-relay-account-map.py \
      ops/tests/test-prepare-composite-autocompletion-postdeploy.sh \
      ops/systemd/resonance-process-development-worker.service \
      ops/systemd/resonance-process-development-worker.timer \
      ops/systemd/resonance-project-auto-completion.service \
      ops/systemd/resonance-project-auto-completion.timer \
      ops/systemd/resonance-composite-live-smoke.service \
      ops/systemd/resonance-composite-live-smoke.timer \
      ops/systemd/resonance-incremental-screen-generation.service \
      ops/systemd/resonance-incremental-screen-generation.timer || \
    ! process_development_control_plane_in_sync || \
    ! systemctl cat resonance-process-development-worker.service 2>/dev/null | \
      grep -Fq '/opt/resonance-data/control-plane/bin/run-process-development-dispatcher.sh'; then
    bash ops/scripts/test-process-worker-deploy-marker.sh
    python3 ops/tests/test-generate-composite-relay-account-map.py
    bash ops/tests/test-prepare-composite-autocompletion-postdeploy.sh
    sudo -n install -d -m 0755 -o root -g root \
      /opt/resonance-data/control-plane/bin \
      /opt/resonance-data/control-plane/bin/lib \
      /opt/resonance-data/control-plane/runtime-metadata
    sudo -n install -d -m 0700 -o sjkim -g sjkim \
      /opt/resonance-data/control-plane/run
    sudo -n install -d -m 0750 -o 1000 -g 1000 \
      /opt/resonance-data/control-plane/var/test-evidence/composite-live-smoke
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/run-process-development-dispatcher.sh \
      /opt/resonance-data/control-plane/bin/run-process-development-dispatcher.sh
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/run-process-development-worker.sh \
      /opt/resonance-data/control-plane/bin/run-process-development-worker.sh
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/run-project-auto-completion-orchestrator.sh \
      /opt/resonance-data/control-plane/bin/run-project-auto-completion-orchestrator.sh
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/run-next-current-business-e2e.sh \
      /opt/resonance-data/control-plane/bin/run-next-current-business-e2e.sh
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/run-composite-live-smoke.sh \
      /opt/resonance-data/control-plane/bin/run-composite-live-smoke.sh
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/run-composite-live-smoke-slots.sh \
      /opt/resonance-data/control-plane/bin/run-composite-live-smoke-slots.sh
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/generate-composite-relay-account-map.py \
      /opt/resonance-data/control-plane/bin/generate-composite-relay-account-map.py
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/composite-live-smoke-db-probe.sh \
      /opt/resonance-data/control-plane/bin/composite-live-smoke-db-probe.sh
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/prepare-composite-autocompletion-postdeploy.sh \
      /opt/resonance-data/control-plane/bin/prepare-composite-autocompletion-postdeploy.sh
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/resonance-composite-live-smoke-e2e.mjs \
      /opt/resonance-data/control-plane/bin/resonance-composite-live-smoke-e2e.mjs
    sudo -n install -m 0640 -o sjkim -g sjkim \
      ops/scripts/lib/declared-process-relay-runtime.mjs \
      /opt/resonance-data/control-plane/bin/lib/declared-process-relay-runtime.mjs
    sudo -n install -m 0644 -o sjkim -g sjkim \
      ops/runtime-metadata/business-e2e-runner-registry.json \
      /opt/resonance-data/control-plane/runtime-metadata/business-e2e-runner-registry.json
    sudo -n install -m 0644 -o sjkim -g sjkim \
      ops/runtime-metadata/composite-live-smoke-runner.json \
      /opt/resonance-data/control-plane/runtime-metadata/composite-live-smoke-runner.json
    sudo -n install -m 0644 -o sjkim -g sjkim \
      ops/runtime-metadata/composite-relay-account-map.json \
      /opt/resonance-data/control-plane/runtime-metadata/composite-relay-account-map.json
    sudo -n install -m 0644 \
      ops/systemd/resonance-process-development-worker.service \
      /etc/systemd/system/resonance-process-development-worker.service
    sudo -n install -m 0644 \
      ops/systemd/resonance-process-development-worker.timer \
      /etc/systemd/system/resonance-process-development-worker.timer
    sudo -n install -m 0644 \
      ops/systemd/resonance-project-auto-completion.service \
      /etc/systemd/system/resonance-project-auto-completion.service
    sudo -n install -m 0644 \
      ops/systemd/resonance-project-auto-completion.timer \
      /etc/systemd/system/resonance-project-auto-completion.timer
    sudo -n install -m 0644 \
      ops/systemd/resonance-composite-live-smoke.service \
      /etc/systemd/system/resonance-composite-live-smoke.service
    sudo -n install -m 0644 \
      ops/systemd/resonance-composite-live-smoke.timer \
      /etc/systemd/system/resonance-composite-live-smoke.timer
    sudo -n install -m 0644 \
      ops/systemd/resonance-incremental-screen-generation.service \
      /etc/systemd/system/resonance-incremental-screen-generation.service
    sudo -n install -m 0644 \
      ops/systemd/resonance-incremental-screen-generation.timer \
      /etc/systemd/system/resonance-incremental-screen-generation.timer
    sudo -n systemctl daemon-reload
    sudo -n systemctl enable --now \
      resonance-process-development-worker.timer \
      resonance-project-auto-completion.timer \
      resonance-incremental-screen-generation.timer >/dev/null
    echo "[auto-deploy] process development worker control plane synchronized"
  fi
}

reconcile_composite_autocompletion_postdeploy(){
  # Call only after Flyway, runtime readiness, authenticated validation lanes,
  # and every other failure-capable pre-finalize task. This creates only a
  # PREPARED database CAS; workers require ACTIVE and therefore remain write-zero.
  # The guarded finalizer activates the exact revision only after all finalization passes.
  local reconcile_output
  if reconcile_output="$(CARBONET_POSTDEPLOY_CANDIDATE_ID="$postdeploy_candidate_id" \
      RESONANCE_ROOT="$ROOT_DIR" \
      bash ops/scripts/prepare-composite-autocompletion-postdeploy.sh reconcile)"; then
    printf '%s\n' "$reconcile_output"
    composite_autocompletion_gate_prepared=false
    if [[ "$reconcile_output" == *' gate=PREPARED prepared=true '* ]]; then
      if ! sudo -n systemctl enable --now resonance-composite-live-smoke.timer >/dev/null; then
        CARBONET_POSTDEPLOY_CANDIDATE_ID="$postdeploy_candidate_id" RESONANCE_ROOT="$ROOT_DIR" \
          bash ops/scripts/prepare-composite-autocompletion-postdeploy.sh revoke-prepared \
            >/dev/null 2>&1 || true
        sudo -n systemctl disable --now resonance-composite-live-smoke.timer >/dev/null 2>&1 || true
        composite_autocompletion_gate_prepared=false
        echo '[auto-deploy] WARN composite autocompletion gate disabled: smoke timer enable failed' >&2
        return 0
      fi
      composite_autocompletion_gate_prepared=true
      echo '[auto-deploy] composite autocompletion PREPARED gate confirmed'
    elif [[ "$reconcile_output" == *' gate=ACTIVE prepared=false '* \
         && "$reconcile_output" == *' scheduler=true '* ]]; then
      if ! sudo -n systemctl enable --now resonance-composite-live-smoke.timer >/dev/null; then
        CARBONET_POSTDEPLOY_CANDIDATE_ID="$postdeploy_candidate_id" RESONANCE_ROOT="$ROOT_DIR" \
          bash ops/scripts/prepare-composite-autocompletion-postdeploy.sh revoke-candidate \
            >/dev/null 2>&1 || true
        sudo -n systemctl disable --now resonance-composite-live-smoke.timer \
          >/dev/null 2>&1 || true
        echo '[auto-deploy] WARN composite autocompletion ACTIVE gate revoke attempted: smoke timer enable failed' >&2
        return 0
      fi
      echo '[auto-deploy] composite autocompletion ACTIVE gate remains current'
    else
      # Missing measurement is a safe, normal state for a fresh runtime. The
      # release finalizer must not wait for a potentially ten-minute campaign.
      sudo -n systemctl disable --now resonance-composite-live-smoke.timer >/dev/null 2>&1 || true
      echo '[auto-deploy] composite autocompletion remains gate-disabled; asynchronous canary will follow finalization'
    fi
    echo '[auto-deploy] composite autocompletion postdeploy state reconciled'
  else
    composite_autocompletion_gate_prepared=false
    CARBONET_POSTDEPLOY_CANDIDATE_ID="$postdeploy_candidate_id" RESONANCE_ROOT="$ROOT_DIR" \
      bash ops/scripts/prepare-composite-autocompletion-postdeploy.sh revoke-candidate \
        >/dev/null 2>&1 || true
    sudo -n systemctl disable --now resonance-composite-live-smoke.timer \
      >/dev/null 2>&1 || true
    echo '[auto-deploy] WARN composite autocompletion reconcile failed; revoke attempted and timer disabled; release continues gate-disabled' >&2
    return 0
  fi
}

sync_process_contract_audit_if_required() {
  # This check deliberately does not depend on deploy_changed_paths. Runtime
  # and mixed deployments build from a persistent worktree and may not
  # populate that no-runtime list; byte-for-byte source/install comparison
  # still repairs a stale or manually altered control-plane installation.
  if ! bash ops/scripts/install-all-process-contract-audit.sh --check ||
    ! systemctl is-enabled --quiet resonance-all-process-contract-audit.timer; then
    bash ops/tests/test-all-process-contract-audit.sh
    bash ops/tests/test-all-process-contract-audit-scheduler.sh
    bash ops/scripts/install-all-process-contract-audit.sh
    echo '[auto-deploy] isolated hourly all-process contract audit checksum drift repaired'
  fi

  # A Java/Mockito test cannot parse PostgreSQL SQL.  Exercise the authenticated
  # live report API after rollout, without route crawling or business commands,
  # so a broken report can never receive a successful deployment marker again.
  local preflight_report preflight_rc preflight_status
  local audit_lock_file audit_lock_wait_seconds audit_lock_fd
  local preflight_started_at refreshed_report_mtime lock_wait_rc
  preflight_report="$(mktemp)"
  audit_lock_file="${RESONANCE_AUDIT_LOCK_FILE:-/opt/resonance-data/control-plane/run/all-process-contract-audit.lock}"
  audit_lock_wait_seconds="${RESONANCE_AUDIT_LOCK_WAIT_SECONDS:-930}"
  preflight_started_at="$(date +%s)"
  mkdir -p "$(dirname "$audit_lock_file")"
  exec {audit_lock_fd}>"$audit_lock_file"
  set +e
  if flock -n "$audit_lock_fd"; then
    SYSTEM_TEST_REPORT_SKIP_HTTP_SMOKE=1 \
      SYSTEM_TEST_REPORT_DEPLOYMENT_PREFLIGHT=1 \
      RESONANCE_ROOT="$ROOT_DIR" \
      bash /opt/resonance-data/control-plane/bin/resonance-all-process-contract-audit.sh \
      >"$preflight_report"
    preflight_rc=$?
  else
    echo '[auto-deploy] all-process audit already running; waiting for its atomic report instead of starting a duplicate'
    flock -w "$audit_lock_wait_seconds" "$audit_lock_fd"
    lock_wait_rc=$?
    refreshed_report_mtime="$(stat -c %Y /opt/resonance-data/control-plane/reports/process-contract-audit/latest.json 2>/dev/null || printf '0')"
    if [[ "$lock_wait_rc" -eq 0 && -s /opt/resonance-data/control-plane/reports/process-contract-audit/latest.json &&
          "$refreshed_report_mtime" =~ ^[0-9]+$ && "$refreshed_report_mtime" -ge "$preflight_started_at" ]]; then
      cp /opt/resonance-data/control-plane/reports/process-contract-audit/latest.json "$preflight_report"
      preflight_rc=0
    else
      echo '[auto-deploy] concurrent all-process audit did not publish a fresh atomic report' >&2
      preflight_rc=2
    fi
  fi
  flock -u "$audit_lock_fd" 2>/dev/null || true
  exec {audit_lock_fd}>&-
  set -e
  if [[ "$preflight_rc" -ne 0 && "$preflight_rc" -ne 3 ]]; then
    rm -f "$preflight_report"
    echo "[auto-deploy] all-process report API preflight failed exit=$preflight_rc" >&2
    return 1
  fi
  preflight_status="$(node -e '
    const value=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));
    if(!["PASS","BLOCKED"].includes(value.status)) process.exit(2);
    if(value.authenticated!==true) process.exit(3);
    const compactPreflight=value.deploymentPreflight===true &&
      value.auditMode==="AUTHENTICATED_COMPACT_REPORT_DEPLOYMENT_PREFLIGHT" &&
      value.contractAuditPagination?.skipped===true &&
      value.contractAuditPagination?.reason==="DEPLOYMENT_PREFLIGHT_COMPACT_REPORT_VALIDATION";
    const completedIncumbentAudit=value.deploymentPreflight===false &&
      value.auditMode==="CONTRACT_EVIDENCE_REFRESH_AND_READ_ONLY_INVENTORY" &&
      value.contractAuditPagination?.skipped===false &&
      value.contractAuditPagination?.complete===true;
    if(!compactPreflight && !completedIncumbentAudit) process.exit(4);
    process.stdout.write(value.status);
  ' "$preflight_report")"
  rm -f "$preflight_report"
  echo "[auto-deploy] all-process report API preflight PASS status=$preflight_status"
}

sync_react_asset_prune_worker_if_required() {
  if ! deploy_path_changed \
      ops/scripts/resonance-react-asset-prune.sh \
      ops/scripts/prune-react-assets-if-needed.sh \
      ops/scripts/test-resonance-react-asset-prune.sh \
      ops/systemd/resonance-react-asset-prune.service \
      ops/systemd/resonance-react-asset-prune.timer &&
    [[ "$control_plane_drift_check_due" != "true" ]]; then
    return 0
  fi
  if deploy_path_changed \
      ops/scripts/resonance-react-asset-prune.sh \
      ops/scripts/prune-react-assets-if-needed.sh \
      ops/scripts/test-resonance-react-asset-prune.sh \
      ops/systemd/resonance-react-asset-prune.service \
      ops/systemd/resonance-react-asset-prune.timer || \
    ! systemctl is-enabled --quiet resonance-react-asset-prune.timer; then
    bash ops/scripts/test-resonance-react-asset-prune.sh
    sudo -n install -m 0644 \
      ops/systemd/resonance-react-asset-prune.service \
      /etc/systemd/system/resonance-react-asset-prune.service
    sudo -n install -m 0644 \
      ops/systemd/resonance-react-asset-prune.timer \
      /etc/systemd/system/resonance-react-asset-prune.timer
    sudo -n systemctl daemon-reload
    sudo -n systemctl enable --now resonance-react-asset-prune.timer >/dev/null
    echo "[auto-deploy] deferred React asset prune worker synchronized"
  fi
}

run_parallel_contract_tests() {
  local log_dir test_path test_name index status failed
  local -a pids=() tests=("$@")
  log_dir="$ROOT_DIR/var/logs/catalog-contract-tests-${target_commit:0:10}"
  rm -rf "$log_dir"
  mkdir -p "$log_dir"
  index=0
  for test_path in "${tests[@]}"; do
    test_name="$(basename "$test_path" .sh)"
    (bash "$test_path") >"$log_dir/$index-$test_name.log" 2>&1 &
    pids+=("$!")
    index=$((index + 1))
  done
  failed=0
  for index in "${!pids[@]}"; do
    status=0
    wait "${pids[$index]}" || status=$?
    cat "$log_dir/$index-$(basename "${tests[$index]}" .sh).log"
    (( status == 0 )) || failed=$((failed + 1))
  done
  if (( failed > 0 )); then
    echo "[auto-deploy] parallel catalog contract tests failed=$failed total=${#tests[@]} logs=$log_dir" >&2
    return 1
  fi
  echo "[auto-deploy] parallel catalog contract tests PASS jobs=${#tests[@]} logs=$log_dir"
}

run_operational_usage_ledger_static_contract_if_required() {
  [[ ",${PLAN_TESTS:-}," == *",runtime:operational-usage-ledger-e2e,"* ]] || return 0
  bash ops/scripts/test-operational-usage-ledger-e2e-contract.sh "$ROOT_DIR"
  echo "[auto-deploy] operational usage ledger static contract PASS"
}

run_flyway_job_timeout_contract_if_required() {
  if ! git diff --quiet "$deployed_commit" "$target_commit" -- \
      ops/scripts/auto-deploy-main.sh \
      ops/scripts/auto-deploy-main-launcher.sh \
      ops/tests/test-auto-deploy-bootstrap-helper-snapshot.sh \
      ops/scripts/resonance-k8s-build-deploy-80-v2.sh \
      ops/scripts/carbonet-auto-deploy-failure-handler.sh \
      ops/scripts/run-flyway-migration-job.sh \
      ops/tests/test-flyway-job-timeout-contract.sh \
      apps/carbonet-api/src/main/java/egovframework/com/migration/FlywayMigrationApplication.java; then
    bash ops/tests/test-flyway-job-timeout-contract.sh
    echo "[auto-deploy] Flyway Job timeout/cleanup contract PASS"
  fi
}

run_composite_axis_migration_performance_if_required() {
  local timeout_seconds="${COMPOSITE_AXIS_AUTO_DEPLOY_TEST_TIMEOUT_SECONDS:-180}"
  local -a contract_files=(
    apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260816154000__compile_composite_executable_design_authority.sql
    ops/tests/fixtures/composite-axis-migration-performance-prerequisites.sql
    ops/tests/test-composite-axis-migration-performance-postgres.sh
    ops/tests/test-composite-executable-design-authority-postgres.sql
    ops/tests/test-project-runtime-purge-composite-migrations-postgres.sh
  )
  [[ "$timeout_seconds" =~ ^[1-9][0-9]*$ \
     && "$timeout_seconds" -ge 60 && "$timeout_seconds" -le 600 ]] || {
    echo '[auto-deploy] invalid composite-axis migration performance timeout (expected 60..600 seconds)' >&2
    return 2
  }
  if ! git diff --quiet "$deployed_commit" "$target_commit" -- "${contract_files[@]}"; then
    echo "[auto-deploy] running operational-scale composite-axis migration regression (hard cap=${timeout_seconds}s)"
    timeout --signal=TERM --kill-after=10s "${timeout_seconds}s" \
      bash ops/tests/test-composite-axis-migration-performance-postgres.sh "$ROOT_DIR"
    echo '[auto-deploy] operational-scale composite-axis migration regression PASS'
  fi
}

run_runtime_template_identity_migration_contract_if_required() {
  local timeout_seconds="${RUNTIME_TEMPLATE_IDENTITY_AUTO_DEPLOY_TEST_TIMEOUT_SECONDS:-180}"
  [[ "$timeout_seconds" =~ ^[1-9][0-9]*$ \
     && "$timeout_seconds" -ge 60 && "$timeout_seconds" -le 600 ]] || {
    echo '[auto-deploy] invalid runtime template identity PostgreSQL timeout (expected 60..600 seconds)' >&2
    return 2
  }
  if deploy_path_changed \
      apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817235000__bind_runtime_identity_to_pod_template.sql \
      ops/scripts/record-runtime-release-state.sh \
      ops/scripts/stage-postdeploy-evidence-candidate.sh \
      ops/scripts/promote-postdeploy-candidate-evidence.sh \
      ops/scripts/check-postdeploy-authoritative-promotion.sh \
      ops/scripts/runtime-candidate-checkpoint.sh \
      ops/scripts/resonance-k8s-build-deploy-80-v2.sh \
      ops/scripts/resonance-v3-deploy.sh \
      ops/scripts/resonance-command-index.sh \
      ops/scripts/resonance-file-watch.sh \
      ops/scripts/resonance-project-core-deploy.sh \
      ops/scripts/resonance-ai-fast-dev.sh \
      ops/scripts/resonance-startup-watchdog.sh \
      ops/scripts/resonance-start-best-effort.sh \
      ops/scripts/restart-local-carbonet-k8s.sh \
      ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh \
      ops/scripts/retire-legacy-runtime-mutation-automation.sh \
      ops/scripts/test-retire-legacy-runtime-mutation-automation.sh \
      ops/scripts/autorecovery/check-and-recover.sh \
      ops/scripts/autorecovery/watchdog-daemon.sh \
      ops/scripts/resonance-k8s-ops-automation-install.sh \
      ops/scripts/resonance-react-route-self-heal.sh \
      ops/systemd/resonance-react-route-self-heal.service \
      ops/systemd/resonance-react-route-self-heal.timer \
      ops/scripts/auto-deploy-main-launcher.sh \
      ops/tests/test-auto-deploy-bootstrap-helper-snapshot.sh \
      ops/scripts/resonance-up.sh \
      ops/systemd/resonance-recovery.service \
      ops/scripts/test-runtime-systemd-contracts.sh \
      ops/scripts/audit-account-lock-recovery-assurance.sh \
      ops/scripts/complete-account-lock-recovery-assurance.sh \
      ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh \
      ops/scripts/capture-business-e2e-contract.sh \
      ops/scripts/validate-operational-usage-ledger-e2e.sh \
      ops/scripts/test-operational-usage-ledger-e2e-contract.sh \
      ops/scripts/reconcile-deployed-retry-jobs.sh \
      ops/scripts/promote-company-manager-delegation-after-e2e.sh \
      ops/tests/run-company-manager-delegation-business-e2e.sh \
      ops/tests/test-promote-company-manager-delegation-after-e2e.sh \
      ops/scripts/promote-runtime-startup-profile.sh \
      ops/scripts/test-runtime-startup-profile.sh \
      ops/scripts/complete-regulatory-submission-assurance.sh \
      ops/tests/test-regulatory-submission-assurance-contract.sh \
      ops/runtime-metadata/business-e2e-runner-registry.json \
      modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositeAutocompletionReadinessService.java \
      modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositeDesignOperationalWorker.java \
      modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositeLiveSmokeEvidenceService.java \
      modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositePhysicalEvidenceService.java \
      modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/service/ActorProcessGovernanceMutationPropagationPostgresTest.java \
      modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java \
      modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/service/ActorProcessGovernanceServiceSecurityTest.java \
      ops/scripts/test-runtime-candidate-checkpoint.sh \
      ops/tests/test-runtime-release-state.sh \
      ops/tests/test-postdeploy-candidate-evidence-contract.sh \
      ops/tests/test-postdeploy-candidate-evidence-postgres.sh \
      ops/tests/test-durable-postdeploy-rollback-reconciler.sh \
      ops/tests/test-postdeploy-promotion-recovery.sh \
      ops/tests/test-account-lock-recovery-assurance-contract.sh \
      ops/tests/test-auto-deploy-legacy-orphan-quarantine-recovery.sh \
      ops/tests/test-current-business-e2e-evidence.sh \
      ops/tests/test-reconcile-deployed-retry-jobs-contract.sh \
      ops/tests/test-runtime-identity-authority-consumers-contract.sh; then
    run_parallel_contract_tests \
      ops/scripts/test-runtime-candidate-checkpoint.sh \
      ops/tests/test-runtime-release-state.sh \
      ops/tests/test-postdeploy-candidate-evidence-contract.sh \
      ops/tests/test-durable-postdeploy-rollback-reconciler.sh \
      ops/tests/test-postdeploy-promotion-recovery.sh \
      ops/tests/test-account-lock-recovery-assurance-contract.sh \
      ops/tests/test-auto-deploy-legacy-orphan-quarantine-recovery.sh \
      ops/tests/test-current-business-e2e-evidence.sh \
      ops/tests/test-reconcile-deployed-retry-jobs-contract.sh \
      ops/tests/test-runtime-identity-authority-consumers-contract.sh \
      ops/scripts/test-operational-usage-ledger-e2e-contract.sh \
      ops/scripts/test-runtime-startup-profile.sh \
      ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh \
      ops/scripts/test-runtime-systemd-contracts.sh \
      ops/scripts/test-retire-legacy-runtime-mutation-automation.sh
    timeout --signal=TERM --kill-after=10s "${timeout_seconds}s" \
      bash ops/tests/test-postdeploy-candidate-evidence-postgres.sh "$ROOT_DIR"
    echo '[auto-deploy] runtime PodTemplate identity PostgreSQL contract PASS'
  fi
}

run_operational_usage_ledger_live_e2e_if_required() {
  local expected_commit="${1:-$target_commit}"
  local timeout_seconds="${CARBONET_USAGE_LEDGER_E2E_TIMEOUT_SECONDS:-120}"
  [[ "${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == candidate \
     || ",${PLAN_TESTS:-}," == *",runtime:operational-usage-ledger-e2e,"* ]] || return 0
  [[ "$timeout_seconds" =~ ^[1-9][0-9]*$ ]] || {
    echo "[auto-deploy] invalid operational usage ledger E2E timeout" >&2
    invalidate_runtime_release_state
    return 1
  }
  if ! timeout --signal=TERM --kill-after=10s "$timeout_seconds" \
      bash ops/scripts/validate-operational-usage-ledger-e2e.sh \
        "$ROOT_DIR" "$expected_commit" "${CARBONET_PUBLIC_BASE_URL:-http://127.0.0.1}"; then
    echo "[auto-deploy] operational usage ledger authenticated E2E failed or exceeded ${timeout_seconds}s" >&2
    invalidate_runtime_release_state
    return 1
  fi
  echo "[auto-deploy] operational usage ledger authenticated E2E PASS budget=${timeout_seconds}s"
}

verify_operational_usage_ledger_current_runtime_identity() {
  local expected_commit="${1:-}"
  local marker_recovery_mode="${2:-strict}"
  local template_bootstrap_attempted="${3:-false}"
  local legacy_template_bootstrap_commit='76a08e672ab7054914ec3b5aecb57bc8e7a298fa'
  local legacy_template_bootstrap_hash='3714b172fe60eed5d07658103aa5f51d6f9ef765f2cee2bd0ba304e71bfd9c1a'
  local marker_commit annotation_commit ledger_commit deployment_json ledger_json
  local marker_matches=false annotation_matches=false ledger_matches=false image_matches=false
  local immutable_deployment_matches=false template_matches=false readiness_exact=false
  local ledger_coordinates_valid=false
  local image_ref ledger_image_ref ledger_image_id selector pods_json pod_image_ids
  local ledger_namespace ledger_deployment ledger_uid ledger_generation ledger_observed ledger_desired ledger_template_hash
  local deployment_uid generation observed desired ready_count pod pod_health
  local template_annotation_hash live_template_hash annotated_json annotated_live_template_hash
  local deployment_identity_token final_deployment_json final_deployment_identity_token
  local bootstrap_deadline bootstrap_attempt=0 bootstrap_ready=false bootstrap_deployment_json
  local bootstrap_uid bootstrap_template_hash bootstrap_commit bootstrap_attestation
  local bootstrap_image_ref bootstrap_desired
  local -a ready_pods=()

  resolve_postdeploy_postgres_pod || {
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=DATA_UNAVAILABLE source=postgres-leader' >&2
    return 1
  }
  if [[ -f "$RUNTIME_DEPLOY_STATE_FILE" && ! -L "$RUNTIME_DEPLOY_STATE_FILE" ]]; then
    marker_commit="$(tr -d '[:space:]' <"$RUNTIME_DEPLOY_STATE_FILE" 2>/dev/null || true)"
  else
    marker_commit=""
  fi
  if ! deployment_json="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json 2>/dev/null)" \
     || ! jq -e '.metadata.uid and .spec.template and .status' <<<"$deployment_json" >/dev/null 2>&1; then
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=DATA_UNAVAILABLE source=deployment' >&2
    return 1
  fi
  annotation_commit="$(jq -r '.metadata.annotations["resonance.ai/target-commit"] // empty' <<<"$deployment_json" 2>/dev/null || true)"
  template_annotation_hash="$(jq -r '.metadata.annotations["resonance.ai/runtime-template-sha256"] // empty' <<<"$deployment_json" 2>/dev/null || true)"
  live_template_hash="$(jq -cS '.spec.template' <<<"$deployment_json" | sha256sum | awk '{print $1}')"
  if ! ledger_json="$(
    printf '%s\n' "select jsonb_build_object('sourceCommit',runtime.source_commit,'deploymentNamespace',runtime.deployment_namespace,'deploymentName',runtime.deployment_name,'deploymentUid',runtime.deployment_uid,'deploymentGeneration',runtime.deployment_generation,'observedGeneration',runtime.observed_generation,'desiredReplicas',runtime.desired_replicas,'imageRef',runtime.image_ref,'imageId',runtime.image_id,'podTemplateSha256',to_jsonb(runtime)->>'pod_template_sha256','healthStatus',runtime.health_status)::text from framework_runtime_release_state runtime where runtime.release_key='CARBONET_RUNTIME' and runtime.health_status='UP';" |
      kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -q -At -v ON_ERROR_STOP=1 \
        2>/dev/null
  )" || ! jq -e '
      (.sourceCommit|test("^[0-9a-f]{40}$"))
      and (.deploymentNamespace|type=="string" and length>0)
      and (.deploymentName|type=="string" and length>0)
      and (.deploymentUid|type=="string" and length>0)
      and (.deploymentGeneration|type=="number")
      and (.observedGeneration|type=="number")
      and (.desiredReplicas|type=="number")
      and (.imageRef|type=="string" and length>0)
      and (.imageId|test("sha256:[0-9a-f]{64}$"))
      and (.podTemplateSha256==null or (.podTemplateSha256|test("^[0-9a-f]{64}$")))
    ' <<<"$ledger_json" >/dev/null 2>&1; then
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=DATA_UNAVAILABLE source=runtime-ledger' >&2
    return 1
  fi
  ledger_commit="$(jq -r '.sourceCommit // empty' <<<"$ledger_json" 2>/dev/null || true)"
  ledger_image_ref="$(jq -r '.imageRef // empty' <<<"$ledger_json" 2>/dev/null || true)"
  ledger_image_id="$(jq -r '.imageId // empty' <<<"$ledger_json" 2>/dev/null || true)"
  ledger_namespace="$(jq -r '.deploymentNamespace // empty' <<<"$ledger_json" 2>/dev/null || true)"
  ledger_deployment="$(jq -r '.deploymentName // empty' <<<"$ledger_json" 2>/dev/null || true)"
  ledger_uid="$(jq -r '.deploymentUid // empty' <<<"$ledger_json" 2>/dev/null || true)"
  ledger_generation="$(jq -r '.deploymentGeneration // empty' <<<"$ledger_json" 2>/dev/null || true)"
  ledger_observed="$(jq -r '.observedGeneration // empty' <<<"$ledger_json" 2>/dev/null || true)"
  ledger_desired="$(jq -r '.desiredReplicas // empty' <<<"$ledger_json" 2>/dev/null || true)"
  ledger_template_hash="$(jq -r '.podTemplateSha256 // empty' <<<"$ledger_json" 2>/dev/null || true)"
  image_ref="$(jq -r --arg container "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" '.spec.template.spec.containers[]|select(.name==$container)|.image' <<<"$deployment_json" 2>/dev/null || true)"
  selector="$(jq -r '.spec.selector.matchLabels//{}|to_entries|map("\(.key)=\(.value)")|join(",")' <<<"$deployment_json" 2>/dev/null || true)"
  if [[ -z "$selector" ]] \
     || ! pods_json="$(kubectl -n "$NAMESPACE" get pods -l "$selector" -o json 2>/dev/null)" \
     || ! jq -e '.items|type=="array"' <<<"$pods_json" >/dev/null 2>&1; then
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=DATA_UNAVAILABLE source=runtime-pods' >&2
    return 1
  fi
  pod_image_ids="$(jq -c --arg container "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" '[.items[]|select(any(.status.conditions[]?;.type=="Ready" and .status=="True"))|.status.containerStatuses[]?|select(.name==$container and .ready==true)|.imageID]|unique' <<<"$pods_json" 2>/dev/null || true)"
  desired="$(jq -r '.spec.replicas // 0' <<<"$deployment_json" 2>/dev/null || true)"
  deployment_uid="$(jq -r '.metadata.uid // empty' <<<"$deployment_json" 2>/dev/null || true)"
  generation="$(jq -r '.metadata.generation // empty' <<<"$deployment_json" 2>/dev/null || true)"
  observed="$(jq -r '.status.observedGeneration // empty' <<<"$deployment_json" 2>/dev/null || true)"
  ready_count="$(jq -r --arg container "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" --arg image "$image_ref" '
    [.items[]
      | select(.metadata.deletionTimestamp==null and .status.phase=="Running")
      | select(any(.status.conditions[]?;.type=="Ready" and .status=="True"))
      | select(any(.spec.containers[]?;.name==$container and .image==$image))
      | select(any(.status.containerStatuses[]?;.name==$container and .ready==true))]
    | length
  ' <<<"$pods_json" 2>/dev/null || true)"
  if [[ "$desired" =~ ^[1-9][0-9]*$ && "$ready_count" == "$desired" ]] \
     && jq -e --argjson desired "$desired" '
       (.status.observedGeneration // -1) >= (.metadata.generation // 0)
       and (.status.updatedReplicas // 0)==$desired
       and (.status.readyReplicas // 0)==$desired
       and (.status.availableReplicas // 0)==$desired
       and (.status.unavailableReplicas // 0)==0
     ' <<<"$deployment_json" >/dev/null 2>&1; then
    readiness_exact=true
    mapfile -t ready_pods < <(jq -r --arg container "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" --arg image "$image_ref" '
      .items[]
      | select(.metadata.deletionTimestamp==null and .status.phase=="Running")
      | select(any(.status.conditions[]?;.type=="Ready" and .status=="True"))
      | select(any(.spec.containers[]?;.name==$container and .image==$image))
      | select(any(.status.containerStatuses[]?;.name==$container and .ready==true))
      | .metadata.name
    ' <<<"$pods_json")
    for pod in "${ready_pods[@]}"; do
      pod_health="$(kubectl -n "$NAMESPACE" exec "$pod" -c "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" -- \
        curl -fsS --max-time 15 http://127.0.0.1:8080/actuator/health 2>/dev/null || true)"
      if ! jq -e '.status=="UP"' <<<"$pod_health" >/dev/null 2>&1; then
        readiness_exact=false
        break
      fi
    done
  fi
  marker_commit="$(printf '%s' "$marker_commit" | tr -d '[:space:]')"
  annotation_commit="$(printf '%s' "$annotation_commit" | tr -d '[:space:]')"
  ledger_commit="$(printf '%s' "$ledger_commit" | tr -d '[:space:]')"
  [[ -n "$expected_commit" ]] || expected_commit="$marker_commit"
  [[ "$marker_commit" == "$expected_commit" ]] && marker_matches=true
  [[ "$annotation_commit" == "$expected_commit" ]] && annotation_matches=true
  [[ "$ledger_commit" == "$expected_commit" ]] && ledger_matches=true
  # Generation and desired replicas are point-in-time rollout coordinates.
  # HPA may advance them, but a recorded row may never describe a future
  # generation. Pod-template identity is protected separately by its digest.
  if [[ "$ledger_generation" =~ ^[0-9]+$ && "$ledger_observed" =~ ^[0-9]+$ \
     && "$ledger_desired" =~ ^[1-9][0-9]*$ && "$generation" =~ ^[0-9]+$ \
     && "$observed" =~ ^[0-9]+$ ]] \
     && (( ledger_generation <= ledger_observed \
           && ledger_generation <= generation \
           && ledger_observed <= observed )); then
    ledger_coordinates_valid=true
  fi
  if [[ "$image_ref" == "$ledger_image_ref" \
     && "$ledger_namespace" == "$NAMESPACE" && "$ledger_deployment" == "$DEPLOYMENT" \
     && -n "$deployment_uid" && "$ledger_uid" == "$deployment_uid" ]]; then
    immutable_deployment_matches=true
  fi
  if [[ "$immutable_deployment_matches" != true ]]; then
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=IMMUTABLE_MISMATCH source=deployment-ledger' >&2
    return 1
  fi
  if [[ "$ledger_coordinates_valid" != true ]]; then
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=COORDINATE_CONTRADICTION' >&2
    return 1
  fi
  if [[ "$readiness_exact" != true ]]; then
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=READINESS_TRANSIENT' >&2
    return 1
  fi
  if [[ "$(jq -r 'length' <<<"$pod_image_ids" 2>/dev/null || true)" == 1 \
     && "$(jq -r '.[0] // empty' <<<"$pod_image_ids" 2>/dev/null || true)" == "$ledger_image_id" ]]; then
    image_matches=true
  fi
  if [[ "$image_matches" != true ]]; then
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=IMMUTABLE_MISMATCH source=pod-image-digest' >&2
    return 1
  fi
  # The only pre-migration compatibility exception is the independently
  # audited 76a template. A present annotation or DB value for that release
  # must still equal the pin; coupled template+annotation drift cannot self-sign.
  if [[ "$ledger_commit" == "$legacy_template_bootstrap_commit" ]] \
     && { [[ "$live_template_hash" != "$legacy_template_bootstrap_hash" ]] \
       || [[ -n "$template_annotation_hash" && "$template_annotation_hash" != "$legacy_template_bootstrap_hash" ]] \
       || [[ -n "$ledger_template_hash" && "$ledger_template_hash" != "$legacy_template_bootstrap_hash" ]]; }; then
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=TEMPLATE_MISMATCH source=legacy-audited-pin' >&2
    return 1
  fi
  if [[ -z "$ledger_template_hash" \
     && "$ledger_commit" != "$legacy_template_bootstrap_commit" ]]; then
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=TEMPLATE_MISMATCH source=runtime-ledger-template-unbound' >&2
    return 1
  fi
  # Existing installations predate the template annotation. Bootstrap it once
  # only on the ordinary strict preflight after commit, UID, immutable image,
  # Ready replica health and monotonic ledger coordinates all agree. Recovery
  # proof modes remain read-only and require an already-bound annotation.
  if [[ -z "$template_annotation_hash" && "$marker_recovery_mode" == strict \
     && "$template_bootstrap_attempted" != true \
     && "$annotation_commit" == "$legacy_template_bootstrap_commit" \
     && "$live_template_hash" == "$legacy_template_bootstrap_hash" \
     && ( -z "$ledger_template_hash" || "$ledger_template_hash" == "$legacy_template_bootstrap_hash" ) \
     && "$ledger_commit" == "$annotation_commit" \
     && ( -z "$expected_commit" || "$annotation_commit" == "$expected_commit" ) ]]; then
    if ! annotated_json="$(kubectl -n "$NAMESPACE" annotate "deployment/$DEPLOYMENT" \
        "resonance.ai/runtime-template-sha256=$live_template_hash" --overwrite -o json 2>/dev/null)"; then
      echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=DATA_UNAVAILABLE source=template-bootstrap' >&2
      return 1
    fi
    template_annotation_hash="$(jq -r '.metadata.annotations["resonance.ai/runtime-template-sha256"] // empty' <<<"$annotated_json" 2>/dev/null || true)"
    annotated_live_template_hash="$(jq -cS '.spec.template' <<<"$annotated_json" 2>/dev/null | sha256sum | awk '{print $1}')"
    if [[ "$template_annotation_hash" != "$live_template_hash" \
       || "$annotated_live_template_hash" != "$live_template_hash" ]]; then
      echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=TEMPLATE_MISMATCH source=bootstrap-race' >&2
      return 1
    fi
    bootstrap_deadline=$((SECONDS + 45))
    while (( SECONDS < bootstrap_deadline )); do
      bootstrap_attempt=$((bootstrap_attempt + 1))
      if bootstrap_deployment_json="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json 2>/dev/null)"; then
        bootstrap_uid="$(jq -r '.metadata.uid // empty' <<<"$bootstrap_deployment_json" 2>/dev/null || true)"
        bootstrap_template_hash="$(jq -cS '.spec.template' <<<"$bootstrap_deployment_json" 2>/dev/null | sha256sum | awk '{print $1}')"
        bootstrap_commit="$(jq -r '.metadata.annotations["resonance.ai/target-commit"] // empty' <<<"$bootstrap_deployment_json" 2>/dev/null || true)"
        bootstrap_attestation="$(jq -r '.metadata.annotations["resonance.ai/runtime-template-sha256"] // empty' <<<"$bootstrap_deployment_json" 2>/dev/null || true)"
        bootstrap_image_ref="$(jq -r --arg container "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" '.spec.template.spec.containers[]|select(.name==$container)|.image' <<<"$bootstrap_deployment_json" 2>/dev/null || true)"
        if [[ "$bootstrap_uid" != "$deployment_uid" || "$bootstrap_image_ref" != "$ledger_image_ref" ]]; then
          echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=IMMUTABLE_MISMATCH source=template-bootstrap-race' >&2
          return 1
        fi
        if [[ "$bootstrap_template_hash" != "$legacy_template_bootstrap_hash" \
           || "$bootstrap_attestation" != "$legacy_template_bootstrap_hash" ]]; then
          echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=TEMPLATE_MISMATCH source=template-bootstrap-race' >&2
          return 1
        fi
        if [[ "$bootstrap_commit" != "$legacy_template_bootstrap_commit" ]]; then
          echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=AUTHORITY_MISMATCH source=template-bootstrap-race' >&2
          return 1
        fi
        bootstrap_desired="$(jq -r '.spec.replicas // 0' <<<"$bootstrap_deployment_json" 2>/dev/null || true)"
        if [[ "$bootstrap_desired" =~ ^[1-9][0-9]*$ ]] \
           && jq -e --argjson desired "$bootstrap_desired" '
             (.status.observedGeneration // -1) >= (.metadata.generation // 0)
             and (.status.updatedReplicas // 0)==$desired
             and (.status.readyReplicas // 0)==$desired
             and (.status.availableReplicas // 0)==$desired
             and (.status.unavailableReplicas // 0)==0
           ' <<<"$bootstrap_deployment_json" >/dev/null 2>&1; then
          bootstrap_ready=true
          break
        fi
      fi
      echo "[auto-deploy] WAIT runtime template bootstrap convergence attempt=$bootstrap_attempt remaining=$((bootstrap_deadline - SECONDS))s"
      sleep 1
    done
    if [[ "$bootstrap_ready" != true ]]; then
      echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=READINESS_TRANSIENT source=template-bootstrap-timeout' >&2
      return 1
    fi
    echo "[auto-deploy] runtime template identity bootstrapped sha256=$live_template_hash"
    # Re-enter exactly once to prove post-write pod digest, per-pod health and
    # the final resourceVersion/template reread against the converged rollout.
    verify_operational_usage_ledger_current_runtime_identity \
      "$expected_commit" "$marker_recovery_mode" true
    return
  fi
  if [[ "$template_annotation_hash" =~ ^[0-9a-f]{64}$ \
     && "$template_annotation_hash" == "$live_template_hash" ]] \
     && { [[ "$ledger_template_hash" == "$live_template_hash" ]] \
       || [[ -z "$ledger_template_hash" \
          && "$ledger_commit" == "$legacy_template_bootstrap_commit" \
          && "$live_template_hash" == "$legacy_template_bootstrap_hash" ]]; }; then
    template_matches=true
  fi
  if [[ "$template_matches" != true ]]; then
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=TEMPLATE_MISMATCH' >&2
    return 1
  fi
  deployment_identity_token="$(jq -cS --arg container "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" '
    {resourceVersion:.metadata.resourceVersion,uid:.metadata.uid,generation:.metadata.generation,
     observedGeneration:.status.observedGeneration,replicas:.spec.replicas,
     targetCommit:(.metadata.annotations["resonance.ai/target-commit"]//""),
     runtimeTemplateSha256:(.metadata.annotations["resonance.ai/runtime-template-sha256"]//""),
     image:(.spec.template.spec.containers[]|select(.name==$container)|.image),
     template:.spec.template}
  ' <<<"$deployment_json")"
  if ! final_deployment_json="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json 2>/dev/null)"; then
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=DATA_UNAVAILABLE source=deployment-final-reread' >&2
    return 1
  fi
  final_deployment_identity_token="$(jq -cS --arg container "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" '
    {resourceVersion:.metadata.resourceVersion,uid:.metadata.uid,generation:.metadata.generation,
     observedGeneration:.status.observedGeneration,replicas:.spec.replicas,
     targetCommit:(.metadata.annotations["resonance.ai/target-commit"]//""),
     runtimeTemplateSha256:(.metadata.annotations["resonance.ai/runtime-template-sha256"]//""),
     image:(.spec.template.spec.containers[]|select(.name==$container)|.image),
     template:.spec.template}
  ' <<<"$final_deployment_json" 2>/dev/null || true)"
  if [[ -z "$deployment_identity_token" \
     || "$final_deployment_identity_token" != "$deployment_identity_token" ]]; then
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=READINESS_TRANSIENT source=deployment-final-race' >&2
    return 1
  fi
  # One-time legacy bootstrap is permitted only when the dedicated runtime
  # marker is absent and the live K8s annotation, DB ledger and immutable pod
  # image already agree. The overall applied marker is intentionally ignored.
  if [[ "$marker_recovery_mode" == proof-only ]]; then
    if [[ "$expected_commit" =~ ^[0-9a-f]{40}$ \
       && "$annotation_commit" == "$expected_commit" \
       && "$ledger_commit" == "$expected_commit" \
       && "$image_matches" == true ]]; then
      echo "[auto-deploy] current runtime authority proof PASS annotation=ledger=immutable-image commit=$expected_commit"
      return 0
    fi
    echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=AUTHORITY_MISMATCH mode=proof-only' >&2
    return 1
  fi
  if [[ "$runtime_marker_bootstrap_allowed" == true \
     && ! -e "$RUNTIME_DEPLOY_STATE_FILE" && ! -L "$RUNTIME_DEPLOY_STATE_FILE" ]]; then
    if [[ "$annotation_commit" =~ ^[0-9a-f]{40}$ \
       && "$ledger_commit" == "$annotation_commit" && "$image_matches" == true ]] \
       && write_runtime_deploy_state "$annotation_commit"; then
      marker_commit="$annotation_commit"
      expected_commit="$annotation_commit"
      runtime_deployed_commit="$annotation_commit"
      runtime_marker_bootstrap_allowed=false
      echo "[auto-deploy] runtime identity marker bootstrapped from DB+K8s commit=$annotation_commit"
    else
      echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=AUTHORITY_MISMATCH mode=marker-bootstrap' >&2
      return 1
    fi
  fi
  [[ -n "$expected_commit" ]] || expected_commit="$marker_commit"
  [[ "$expected_commit" =~ ^[0-9a-f]{40}$ ]] || {
    echo "[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=AUTHORITY_MISMATCH source=expected-commit" >&2
    return 1
  }
  if [[ "$marker_recovery_mode" == reconcile && "$marker_commit" != "$expected_commit" ]]; then
    if [[ "$annotation_commit" == "$expected_commit" && "$ledger_commit" == "$expected_commit" \
       && "$image_matches" == true ]] && write_runtime_deploy_state "$expected_commit"; then
      marker_commit="$expected_commit"
      runtime_deployed_commit="$expected_commit"
    else
      echo '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=AUTHORITY_MISMATCH mode=reconcile' >&2
      return 1
    fi
  fi
  [[ "$marker_commit" == "$expected_commit" ]] && marker_matches=true || marker_matches=false
  [[ "$annotation_commit" == "$expected_commit" ]] && annotation_matches=true || annotation_matches=false
  [[ "$ledger_commit" == "$expected_commit" ]] && ledger_matches=true || ledger_matches=false
  if [[ "$marker_matches" != "true" || "$annotation_matches" != "true" || "$ledger_matches" != "true" || "$image_matches" != true ]]; then
    echo "[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=AUTHORITY_MISMATCH markerMatch=$marker_matches annotationMatch=$annotation_matches ledgerMatch=$ledger_matches imageMatch=$image_matches" >&2
    return 1
  fi
  echo "[auto-deploy] current runtime identity PASS marker=annotation=ledger=immutable-image"
}

promoted_candidate_identity_with_ledger_absent() {
  local source="$1" candidate="$2" result
  resolve_postdeploy_postgres_pod || return 2
  result="$(cat <<'SQL' | kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt -v ON_ERROR_STOP=1 \
      -v source_commit="$source" -v candidate_id="$candidate"
WITH promotion AS (
  SELECT * FROM framework_postdeploy_evidence_promotion
   WHERE source_commit=:'source_commit' AND candidate_id=:'candidate_id'
), attempt AS (
  SELECT * FROM framework_postdeploy_release_attempt
   WHERE source_commit=:'source_commit' AND candidate_id=:'candidate_id'
), exact AS (
  SELECT promotion.runtime_identity_hash
    FROM promotion JOIN attempt USING(candidate_id,source_commit)
   WHERE attempt.attempt_status='PROMOTED'
     AND attempt.runtime_identity_hash=promotion.runtime_identity_hash
     AND attempt.candidate_runtime_identity_hash=promotion.runtime_identity_hash
     AND attempt.promotion_id=promotion.promotion_id
     AND attempt.terminal_reason='PROMOTION_COMMITTED'
     AND promotion.process_count=6 AND promotion.unit_count=12
     AND promotion.promoted_definition_count=2
     AND promotion.appended_validation_count=3
     AND promotion.appended_simulation_count=0
     AND promotion.marker_contract='DB_AUTHORITATIVE_FILESYSTEM_DERIVED'
     AND (SELECT count(*) FROM framework_runtime_release_state
           WHERE release_key='CARBONET_RUNTIME')=0
     AND (SELECT count(*) FROM framework_postdeploy_evidence_candidate evidence
           WHERE evidence.candidate_id=:'candidate_id')=12
     AND NOT EXISTS (
       SELECT 1 FROM framework_postdeploy_evidence_candidate evidence
        WHERE evidence.candidate_id=:'candidate_id' AND (
          evidence.source_commit<>:'source_commit'
          OR evidence.candidate_runtime_identity_hash IS DISTINCT FROM promotion.runtime_identity_hash
          OR evidence.evidence_json->>'runtimeIdentityHash' IS DISTINCT FROM promotion.runtime_identity_hash
          OR evidence.evidence_hash!~'^[0-9a-f]{64}$'
        )
     )
)
SELECT runtime_identity_hash FROM exact;
SQL
  )" || return 2
  result="$(printf '%s' "$result" | tr -d '[:space:]')"
  [[ "$result" =~ ^[0-9a-f]{64}$ ]] || return 1
  printf '%s\n' "$result"
}

POSTDEPLOY_RECOVERY_VERIFIED_TEMPLATE_SHA256=""
verify_promoted_live_identity_without_runtime_ledger() {
  local source="$1" expected_hash="$2"
  local deployment_json final_deployment_json deployment_token final_deployment_token
  local deployment_uid generation observed desired image_ref template_hash template_annotation selector
  local pods_json ready_pods image_id runtime_pod health calculated_hash
  [[ "$source" =~ ^[0-9a-f]{40}$ && "$expected_hash" =~ ^[0-9a-f]{64}$ ]] || return 1
  POSTDEPLOY_RECOVERY_VERIFIED_TEMPLATE_SHA256=""
  deployment_json="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json)" || return 2
  jq -e --arg namespace "$NAMESPACE" --arg deployment "$DEPLOYMENT" \
    --arg container "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" --arg source "$source" '
    .metadata.namespace==$namespace and .metadata.name==$deployment
    and .metadata.annotations["resonance.ai/target-commit"]==$source
    and (.metadata.annotations["resonance.ai/runtime-template-sha256"]|test("^[0-9a-f]{64}$"))
    and (.metadata.resourceVersion|type=="string" and length>0)
    and (.metadata.uid|type=="string" and length>0)
    and ((.metadata.generation//0)>0)
    and ((.status.observedGeneration//-1)>=(.metadata.generation//0))
    and ((.spec.replicas//0)>0)
    and ((.status.updatedReplicas//0)==(.spec.replicas//0))
    and ((.status.readyReplicas//0)==(.spec.replicas//0))
    and ((.status.availableReplicas//0)==(.spec.replicas//0))
    and ((.status.unavailableReplicas//0)==0)
    and ([.spec.template.spec.containers[]|select(.name==$container)]|length)==1
  ' <<<"$deployment_json" >/dev/null || return 1
  deployment_uid="$(jq -r '.metadata.uid' <<<"$deployment_json")"
  generation="$(jq -r '.metadata.generation' <<<"$deployment_json")"
  observed="$(jq -r '.status.observedGeneration' <<<"$deployment_json")"
  desired="$(jq -r '.spec.replicas' <<<"$deployment_json")"
  image_ref="$(jq -r --arg container "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" \
    '.spec.template.spec.containers[]|select(.name==$container)|.image' <<<"$deployment_json")"
  template_hash="$(jq -cS '.spec.template' <<<"$deployment_json" | sha256sum | awk '{print $1}')"
  template_annotation="$(jq -r '.metadata.annotations["resonance.ai/runtime-template-sha256"]' <<<"$deployment_json")"
  [[ "$template_hash" =~ ^[0-9a-f]{64}$ && "$template_annotation" == "$template_hash" ]] || return 1
  selector="$(jq -r '.spec.selector.matchLabels//{}|to_entries|map("\(.key)=\(.value)")|join(",")' \
    <<<"$deployment_json")"
  [[ -n "$selector" ]] || return 1
  pods_json="$(kubectl -n "$NAMESPACE" get pods -l "$selector" -o json)" || return 2
  ready_pods="$(jq -c --arg container "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" --arg image "$image_ref" '
    [.items[]|select(.status.phase=="Running")
     |select(any(.spec.containers[]?;.name==$container and .image==$image))
     |select(any(.status.conditions[]?;.type=="Ready" and .status=="True"))
     |select(any(.status.containerStatuses[]?;.name==$container and .ready==true))
     |{name:.metadata.name,imageId:([.status.containerStatuses[]?
       |select(.name==$container)|.imageID][0]//"")}]
  ' <<<"$pods_json")" || return 2
  [[ "$(jq -r 'length' <<<"$ready_pods")" == "$desired" ]] || return 1
  image_id="$(jq -r '[.[].imageId|select(test("sha256:[0-9a-f]{64}$"))]|unique
    |if length==1 then .[0] else empty end' <<<"$ready_pods")"
  [[ "$image_id" =~ sha256:[0-9a-f]{64}$ ]] || return 1
  while IFS= read -r runtime_pod; do
    health="$(kubectl -n "$NAMESPACE" exec "$runtime_pod" \
      -c "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" -- \
      curl -fsS --max-time 15 http://127.0.0.1:8080/actuator/health)" || return 2
    jq -e '.status=="UP"' <<<"$health" >/dev/null || return 1
  done < <(jq -r '.[].name' <<<"$ready_pods")
  resolve_postdeploy_postgres_pod || return 2
  calculated_hash="$(printf '%s\n' "select framework_candidate_runtime_identity_hash_v2(:'source_commit',:'deployment_namespace',:'deployment_name',:'deployment_uid',:'deployment_generation'::bigint,:'observed_generation'::bigint,:'desired_replicas'::integer,:'image_ref',:'image_id',:'pod_template_sha256');" | \
    kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt -v ON_ERROR_STOP=1 \
        -v source_commit="$source" -v deployment_namespace="$NAMESPACE" \
        -v deployment_name="$DEPLOYMENT" -v deployment_uid="$deployment_uid" \
        -v deployment_generation="$generation" -v observed_generation="$observed" \
        -v desired_replicas="$desired" -v image_ref="$image_ref" -v image_id="$image_id" \
        -v pod_template_sha256="$template_hash")" || return 2
  calculated_hash="$(printf '%s' "$calculated_hash" | tr -d '[:space:]')"
  [[ "$calculated_hash" == "$expected_hash" ]] || return 1
  deployment_token="$(jq -cS --arg container "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" '
    {resourceVersion:.metadata.resourceVersion,uid:.metadata.uid,generation:.metadata.generation,
     observedGeneration:.status.observedGeneration,replicas:.spec.replicas,status:.status,
     targetCommit:(.metadata.annotations["resonance.ai/target-commit"]//""),
     runtimeTemplateSha256:(.metadata.annotations["resonance.ai/runtime-template-sha256"]//""),
     image:(.spec.template.spec.containers[]|select(.name==$container)|.image),template:.spec.template}
  ' <<<"$deployment_json")"
  final_deployment_json="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json)" || return 2
  final_deployment_token="$(jq -cS --arg container "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" '
    {resourceVersion:.metadata.resourceVersion,uid:.metadata.uid,generation:.metadata.generation,
     observedGeneration:.status.observedGeneration,replicas:.spec.replicas,status:.status,
     targetCommit:(.metadata.annotations["resonance.ai/target-commit"]//""),
     runtimeTemplateSha256:(.metadata.annotations["resonance.ai/runtime-template-sha256"]//""),
     image:(.spec.template.spec.containers[]|select(.name==$container)|.image),template:.spec.template}
  ' <<<"$final_deployment_json")"
  [[ -n "$deployment_token" && "$final_deployment_token" == "$deployment_token" ]] || return 1
  POSTDEPLOY_RECOVERY_VERIFIED_TEMPLATE_SHA256="$template_hash"
}

recover_promoted_final_live_verify_pending() {
  local journal="$1" source="$2" candidate="$3" expected_hash db_hash verify_status=0
  local pending_present=false quarantine_present=false
  local pending_reason="" quarantine_reason=""
  [[ "$(jq -r '.lifecycleStatus' <<<"$journal")" == PROMOTED \
     && "$(jq -r '.terminalReason' <<<"$journal")" == PROMOTION_COMMITTED \
     && "$(jq -r '.sourceCommit' <<<"$journal")" == "$source" \
     && "$(jq -r '.candidateId' <<<"$journal")" == "$candidate" ]] || return 1
  expected_hash="$(jq -r '.runtimeIdentityHash//empty' <<<"$journal")"
  [[ "$expected_hash" =~ ^[0-9a-f]{64}$ ]] || return 79

  # The immutable PROMOTED journal and promotion/attempt/candidate rows are
  # the crash-consistent recovery anchor.  The ledger DELETE and the two
  # derived recovery-state renames cannot be one filesystem/DB transaction,
  # so SIGKILL can legitimately leave either file absent.  Validate any file
  # that exists before trusting it; missing files are recreated only after the
  # exact DB promotion plus ledger-count-zero proof below.
  if [[ -e "$POSTDEPLOY_MARKER_PENDING_FILE" || -L "$POSTDEPLOY_MARKER_PENDING_FILE" ]]; then
    pending_present=true
    [[ -f "$POSTDEPLOY_MARKER_PENDING_FILE" && ! -L "$POSTDEPLOY_MARKER_PENDING_FILE" \
       && "$(stat -c '%a:%u' "$POSTDEPLOY_MARKER_PENDING_FILE" 2>/dev/null)" == "600:$(id -u)" \
       && "$(sed -n '1p' "$POSTDEPLOY_MARKER_PENDING_FILE")" == schemaVersion=1 \
       && "$(sed -n 's/^targetCommit=//p' "$POSTDEPLOY_MARKER_PENDING_FILE")" == "$source" \
       && "$(sed -n 's/^candidateId=//p' "$POSTDEPLOY_MARKER_PENDING_FILE")" == "$candidate" ]] \
      || return 79
    pending_reason="$(sed -n 's/^reason=//p' "$POSTDEPLOY_MARKER_PENDING_FILE")"
  fi
  if [[ -e "$RUNTIME_LEDGER_QUARANTINE_FILE" || -L "$RUNTIME_LEDGER_QUARANTINE_FILE" ]]; then
    quarantine_present=true
    [[ -f "$RUNTIME_LEDGER_QUARANTINE_FILE" && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" \
       && "$(stat -c '%a:%u' "$RUNTIME_LEDGER_QUARANTINE_FILE" 2>/dev/null)" == "600:$(id -u)" \
       && "$(sed -n '1p' "$RUNTIME_LEDGER_QUARANTINE_FILE")" == schemaVersion=1 \
       && "$(sed -n 's/^targetCommit=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")" == "$source" \
       && "$(sed -n 's/^candidateId=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")" == "$candidate" ]] \
      || return 79
    quarantine_reason="$(sed -n 's/^reason=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")"
  fi
  if [[ "$pending_reason" == DB_PROMOTED_FINAL_LIVE_VERIFY_PENDING \
     || "$quarantine_reason" == PROMOTED_FINAL_LIVE_IDENTITY_DRIFT ]]; then
    # Once either half identifies this compensation path, any existing peer
    # must be the exact matching half. Mixed ordinary/special state is unsafe.
    [[ "$pending_present" != true \
       || "$pending_reason" == DB_PROMOTED_FINAL_LIVE_VERIFY_PENDING ]] || return 79
    [[ "$quarantine_present" != true \
       || "$quarantine_reason" == PROMOTED_FINAL_LIVE_IDENTITY_DRIFT ]] || return 79
  elif [[ "$pending_present" == true || "$quarantine_present" == true ]]; then
    # Ordinary runtime/applied-marker recovery is owned by the existing
    # authoritative reconciler and must never be captured by this special path.
    return 1
  fi
  db_hash="$(promoted_candidate_identity_with_ledger_absent "$source" "$candidate")" || verify_status=$?
  if (( verify_status == 1 )) \
     && [[ "$pending_present" != true && "$quarantine_present" != true ]]; then
    # Normal COMMIT->SIGKILL and marker-rename faults retain the exact current
    # ledger and have no final-live-drift files. Hand those states back to the
    # established authoritative promotion/marker reconciler below.
    return 1
  fi
  if (( verify_status != 0 )) || [[ "$db_hash" != "$expected_hash" ]]; then
    echo '[auto-deploy] RECOVERY_PENDING promoted candidate DB identity/ledger-zero proof is unavailable' >&2
    return 75
  fi
  if [[ "$pending_present" != true ]] \
     && ! write_postdeploy_marker_pending 'DB_PROMOTED_FINAL_LIVE_VERIFY_PENDING'; then
    echo '[auto-deploy] RECOVERY_PENDING promoted final-live pending state could not be reconstructed' >&2
    return 75
  fi
  if [[ "$quarantine_present" != true ]] \
     && ! write_postdeploy_promotion_quarantine 'PROMOTED_FINAL_LIVE_IDENTITY_DRIFT'; then
    echo '[auto-deploy] RECOVERY_PENDING promoted final-live quarantine could not be reconstructed' >&2
    return 75
  fi
  verify_status=0
  verify_promoted_live_identity_without_runtime_ledger "$source" "$expected_hash" || verify_status=$?
  if (( verify_status != 0 )); then
    echo "[auto-deploy] RECOVERY_PENDING promoted live identity remains divergent status=$verify_status mutation=0" >&2
    return 75
  fi
  if ! record_runtime_release_state "$source" recovery-promoted \
      "$POSTDEPLOY_RECOVERY_VERIFIED_TEMPLATE_SHA256"; then
    invalidate_runtime_release_state || true
    echo '[auto-deploy] RECOVERY_PENDING exact promoted ledger republish failed' >&2
    return 75
  fi
  if ! postdeploy_authoritative_promotion_status "$source" "$candidate" \
     || ! verify_operational_usage_ledger_current_runtime_identity "$source" proof-only; then
    invalidate_runtime_release_state || true
    echo '[auto-deploy] RECOVERY_PENDING republished ledger did not restore exact authority' >&2
    return 75
  fi
  echo "[auto-deploy] promoted final-live identity self-heal PASS source=$source candidate=$candidate"
  return 0
}

# A DB COMMIT can outlive the promoter process or its marker rename. Recover
# that exact release before the ordinary runtime preflight, otherwise a stale
# derived runtime marker would deadlock the idempotent ALREADY_PROMOTED retry.
discover_postdeploy_current_runtime_source() {
  local deployment_json annotation_commit leader ledger_commit
  deployment_json="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json 2>/dev/null)" || return 2
  annotation_commit="$(jq -r '.metadata.annotations["resonance.ai/target-commit"] // empty' <<<"$deployment_json" 2>/dev/null || true)"
  leader="${POSTGRES_POD:-}"
  if [[ -z "$leader" ]]; then
    leader="$(K8S_NAMESPACE="$NAMESPACE" bash "$POSTDEPLOY_LEADER_RESOLVER" 2>/dev/null)" || return 2
  fi
  [[ -n "$leader" ]] || return 2
  ledger_commit="$(printf '%s\n' '/* POSTDEPLOY_RECOVERY_SOURCE */ select source_commit from framework_runtime_release_state where release_key='"'"'CARBONET_RUNTIME'"'"' and health_status='"'"'UP'"'"';' | \
    kubectl -n "$NAMESPACE" exec -i "$leader" -c "$POSTGRES_CONTAINER" -- \
      psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt -v ON_ERROR_STOP=1 \
      2>/dev/null)" || return 2
  annotation_commit="$(printf '%s' "$annotation_commit" | tr -d '[:space:]')"
  ledger_commit="$(printf '%s' "$ledger_commit" | tr -d '[:space:]')"
  [[ "$annotation_commit" =~ ^[0-9a-f]{40}$ && "$ledger_commit" == "$annotation_commit" ]] || return 2
  printf '%s\n' "$ledger_commit"
}

recover_authoritative_postdeploy_marker_pending() {
  local pending_target="" pending_candidate="" pending_reason="" authority_status=2
  local pending_present=false live_target="" applied_marker="" reconciled_applied=""
  local gate_active="$FULL_SCREEN_GATE_STATE_DIR/active.env"
  local gate_overlay="${live_frontend_overlay:-${CARBONET_LIVE_FRONTEND_OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}}"
  if [[ -e "$POSTDEPLOY_MARKER_PENDING_FILE" || -L "$POSTDEPLOY_MARKER_PENDING_FILE" ]]; then
    pending_present=true
    if [[ ! -f "$POSTDEPLOY_MARKER_PENDING_FILE" || -L "$POSTDEPLOY_MARKER_PENDING_FILE" \
       || "$(stat -c '%a' "$POSTDEPLOY_MARKER_PENDING_FILE" 2>/dev/null)" != 600 ]]; then
      write_postdeploy_promotion_quarantine 'MARKER_PENDING_CONTRACT_INVALID' || true
      return 79
    fi
    pending_target="$(sed -n 's/^targetCommit=//p' "$POSTDEPLOY_MARKER_PENDING_FILE")"
    pending_candidate="$(sed -n 's/^candidateId=//p' "$POSTDEPLOY_MARKER_PENDING_FILE")"
    pending_reason="$(sed -n 's/^reason=//p' "$POSTDEPLOY_MARKER_PENDING_FILE")"
    if [[ "$(sed -n '1p' "$POSTDEPLOY_MARKER_PENDING_FILE")" != schemaVersion=1 \
       || ! "$pending_target" =~ ^[0-9a-f]{40}$ \
       || ! "$pending_candidate" =~ ^[A-Za-z0-9._:-]{12,160}$ \
       || "$pending_reason" != DB_PROMOTED_* ]]; then
      write_postdeploy_promotion_quarantine 'MARKER_PENDING_CONTRACT_INVALID' || true
      return 79
    fi
  fi

  # Pending state and an armed rollback snapshot are hints only.  The serving
  # source is derived afresh from the live K8s annotation and current DB runtime
  # ledger so COMMIT -> SIGKILL is recoverable even when neither hint exists and
  # even when a newer remote target arrived meanwhile.
  live_target="$(discover_postdeploy_current_runtime_source)" || {
    if [[ "$pending_present" == true ]]; then
      write_postdeploy_promotion_quarantine 'ORPHAN_PROMOTION_SOURCE_UNAVAILABLE' || true
      return 79
    fi
    return 1
  }
  if [[ "$pending_present" == true && "$pending_target" != "$live_target" ]]; then
    write_postdeploy_promotion_quarantine 'MARKER_PENDING_LIVE_SOURCE_MISMATCH' || true
    return 79
  fi
  pending_target="$live_target"
  if [[ "$pending_present" != true ]]; then
    pending_candidate="orphan:${pending_target:0:12}:crash-recovery"
    pending_reason='DB_PROMOTED_ORPHAN_COMMIT'
  fi
  if ! git -C "$ROOT_DIR" cat-file -e "${pending_target}^{commit}" 2>/dev/null \
     || ! git -C "$ROOT_DIR" merge-base --is-ancestor "$pending_target" "$target_commit"; then
    write_postdeploy_promotion_quarantine 'PROMOTED_SOURCE_NOT_TARGET_ANCESTOR' || true
    return 79
  fi
  if postdeploy_authoritative_promotion_status "$pending_target"; then authority_status=0; else authority_status=$?; fi
  if (( authority_status != 0 )); then
    [[ "$pending_present" == true ]] || return 1
    if (( authority_status == 1 )); then
      write_postdeploy_promotion_quarantine 'MARKER_PENDING_DB_NOT_PROMOTED' || true
    else
      write_postdeploy_promotion_quarantine 'PROMOTION_DB_CHECK_UNAVAILABLE' || true
    fi
    return 79
  fi
  # Prove the complete live identity before disarming anything.  Once DB
  # authority is confirmed, disarm the rollback snapshot before either derived
  # marker write; a crash at every later cut point must preserve promoted A.
  if ! verify_operational_usage_ledger_current_runtime_identity "$pending_target" proof-only; then
    write_postdeploy_promotion_quarantine 'MARKER_PENDING_RUNTIME_PROOF_FAILED' || true
    return 79
  fi
  if [[ -s "$gate_active" ]]; then
    OVERLAY_DIR="$gate_overlay" FULL_SCREEN_GATE_DEFER_ACCEPT=true \
      bash ops/scripts/resonance-full-screen-deploy-gate.sh finalize-success \
      || { write_postdeploy_promotion_quarantine 'MARKER_PENDING_SNAPSHOT_DISARM_FAILED' || true; return 79; }
  fi
  if ! verify_operational_usage_ledger_current_runtime_identity "$pending_target" reconcile; then
    write_postdeploy_promotion_quarantine 'MARKER_PENDING_RUNTIME_RECONCILE_FAILED' || true
    return 79
  fi

  # The applied marker may legitimately be a helper-only descendant of the
  # serving runtime commit.  Advance an ancestor, preserve a descendant, and
  # quarantine divergence.  Missing is bootstrapped from the DB-authoritative
  # live commit; an existing malformed marker is never inferred through.
  if [[ ! -e "$DEPLOY_STATE_FILE" && ! -L "$DEPLOY_STATE_FILE" ]]; then
    write_applied_deploy_state "$pending_target" || {
      write_postdeploy_promotion_quarantine 'MARKER_PENDING_APPLIED_RECONCILE_FAILED' || true
      return 79
    }
    reconciled_applied="$pending_target"
  elif [[ -f "$DEPLOY_STATE_FILE" && ! -L "$DEPLOY_STATE_FILE" ]]; then
    applied_marker="$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE" 2>/dev/null || true)"
    if [[ ! "$applied_marker" =~ ^[0-9a-f]{40}$ ]] \
       || ! git -C "$ROOT_DIR" cat-file -e "${applied_marker}^{commit}" 2>/dev/null; then
      write_postdeploy_promotion_quarantine 'APPLIED_MARKER_CONTRACT_INVALID' || true
      return 79
    elif [[ "$applied_marker" == "$pending_target" ]]; then
      reconciled_applied="$applied_marker"
    elif git -C "$ROOT_DIR" merge-base --is-ancestor "$applied_marker" "$pending_target"; then
      write_applied_deploy_state "$pending_target" || {
        write_postdeploy_promotion_quarantine 'MARKER_PENDING_APPLIED_RECONCILE_FAILED' || true
        return 79
      }
      reconciled_applied="$pending_target"
    elif git -C "$ROOT_DIR" merge-base --is-ancestor "$pending_target" "$applied_marker" \
       && git -C "$ROOT_DIR" merge-base --is-ancestor "$applied_marker" "$target_commit"; then
      reconciled_applied="$applied_marker"
    else
      write_postdeploy_promotion_quarantine 'APPLIED_MARKER_DIVERGED_FROM_PROMOTED_RUNTIME' || true
      return 79
    fi
  else
    write_postdeploy_promotion_quarantine 'APPLIED_MARKER_CONTRACT_INVALID' || true
    return 79
  fi
  runtime_deployed_commit="$pending_target"
  deployed_commit="$reconciled_applied"
  postdeploy_recovered_commit="$reconciled_applied"
  [[ "$pending_present" != true ]] || clear_postdeploy_marker_pending "$pending_target"
  echo "[auto-deploy] DB-authoritative marker recovery PASS runtime=$pending_target applied=$reconciled_applied reason=$pending_reason snapshot=disarmed"
  return 0
}

retire_orphan_versioned_snapshot() {
  local gate_active="$FULL_SCREEN_GATE_STATE_DIR/active.env" snapshot="" snapshot_id=""
  local snapshot_manifest="" baseline="" gate_overlay="${live_frontend_overlay:-${CARBONET_LIVE_FRONTEND_OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}}"
  [[ ! -e "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" && ! -L "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]] || return 1
  [[ -e "$gate_active" || -L "$gate_active" ]] || return 1
  # A checkpoint means runtime mutation was armed; absence of the DB/local
  # attempt journal can no longer prove this is the capture->journal crash
  # window, so retain every artifact and fail closed.
  if [[ -e "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" || -L "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" ]]; then
    write_postdeploy_promotion_quarantine 'ORPHAN_VERSIONED_SNAPSHOT_WITH_CHECKPOINT' || true
    return 79
  fi
  snapshot="$(OVERLAY_DIR="$gate_overlay" \
    bash "$POSTDEPLOY_GATE_SCRIPT" describe)" || {
    write_postdeploy_promotion_quarantine 'ORPHAN_VERSIONED_SNAPSHOT_INVALID' || true
    return 79
  }
  snapshot_id="$(jq -r '.snapshotId // empty' <<<"$snapshot")"
  snapshot_manifest="$(jq -r '.snapshotManifestSha256 // empty' <<<"$snapshot")"
  baseline="$(jq -r '.sourceCommit // empty' <<<"$snapshot")"
  [[ "$snapshot_id" =~ ^[A-Za-z0-9._-]+$ && "$snapshot_manifest" =~ ^[0-9a-f]{64}$ \
     && "$baseline" =~ ^[0-9a-f]{40}$ ]] || return 79
  OVERLAY_DIR="$gate_overlay" FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
  FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
  FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
    bash "$POSTDEPLOY_GATE_SCRIPT" verify-restored-physical || return 79
  OVERLAY_DIR="$gate_overlay" FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
  FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
  FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
    bash "$POSTDEPLOY_GATE_SCRIPT" verify-markers || return 79
  verify_operational_usage_ledger_current_runtime_identity "$baseline" proof-only || return 79
  # All live surfaces still equal the captured baseline, proving mutation0.
  # Retire the orphan pointer without invoking any restore writer.
  OVERLAY_DIR="$gate_overlay" FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
  FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
  FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
    bash "$POSTDEPLOY_GATE_SCRIPT" finalize-failed || return 79
  echo "[auto-deploy] orphan pre-runtime snapshot RETIRED mutation=0 baseline=$baseline snapshot=$snapshot_id"
  return 0
}

legacy_owned_runtime_projection_hash() {
  kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json | jq -cS \
    --arg container "${CARBONET_K8S_CONTAINER:-carbonet-runtime}" '
      {uid:.metadata.uid,generation:.metadata.generation,
       deployOwnedAnnotations:((.metadata.annotations//{})|with_entries(select(.key|startswith("resonance.ai/")))),
       replicas:.spec.replicas,minReadySeconds:.spec.minReadySeconds,
       progressDeadlineSeconds:.spec.progressDeadlineSeconds,strategy:.spec.strategy,
       selector:.spec.selector,templateMetadata:.spec.template.metadata,
       container:(.spec.template.spec.containers[]|select(.name==$container)|{name,image})}
    ' | sha256sum | awk '{print $1}'
}

legacy_overlay_tree_hash() {
  local directory="$1"
  [[ -d "$directory" && ! -L "$directory" ]] || return 1
  ! find "$directory" -type l -print -quit | grep -q . || return 1
  ! find "$directory" ! -user "$(id -u)" -print -quit | grep -q . || return 1
  (cd "$directory" && find . -type f ! -path './current-nginx.conf' -print0 | \
    LC_ALL=C sort -z | xargs -0 -r sha256sum) | sha256sum | awk '{print $1}'
}

legacy_live_nginx_hash() {
  local current_nginx result
  current_nginx="$(mktemp /tmp/carbonet-legacy-nginx.XXXXXX)" || return 1
  if kubectl -n "$NAMESPACE" get configmap carbonet-web-nginx \
      -o jsonpath='{.data.nginx\.conf}' >"$current_nginx"; then
    result="$(sha256sum "$current_nginx" | awk '{print $1}')"
  else
    rm -f -- "$current_nginx"
    return 1
  fi
  rm -f -- "$current_nginx"
  printf '%s\n' "$result"
}

postdeploy_source_has_no_attempt_or_promotion_rows() {
  local source="$1" lifecycle result
  [[ "$source" =~ ^[0-9a-f]{40}$ && -n "$POSTGRES_POD" ]] || return 2
  lifecycle="$(printf '%s\n' "SELECT CASE WHEN to_regclass('public.framework_postdeploy_release_attempt') IS NULL THEN 'ABSENT' ELSE 'AVAILABLE' END;" | \
    kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt -v ON_ERROR_STOP=1 \
        2>/dev/null)" || return 2
  lifecycle="$(printf '%s' "$lifecycle" | tr -d '[:space:]')"
  [[ "$lifecycle" == AVAILABLE || "$lifecycle" == ABSENT ]] || return 2
  [[ "$lifecycle" != ABSENT ]] || return 0
  result="$(printf '%s\n' "SELECT CASE WHEN (SELECT count(*) FROM framework_postdeploy_release_attempt WHERE source_commit=:'source_commit')=0 AND (SELECT count(*) FROM framework_postdeploy_evidence_promotion WHERE source_commit=:'source_commit')=0 THEN 'EMPTY' ELSE 'PRESENT' END;" | \
    kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt -v ON_ERROR_STOP=1 \
        -v source_commit="$source" 2>/dev/null)" || return 2
  result="$(printf '%s' "$result" | tr -d '[:space:]')"
  [[ "$result" == EMPTY ]]
}

resolve_legacy_full_screen_gate_state_dir() {
  local evidence_path="" snapshot_dir="" gate_dir="" configured_root persistent_root current_root
  local candidate match_count=0
  configured_root="$(realpath -m "$LEGACY_FULL_SCREEN_GATE_STATE_DIR")"
  persistent_root="$(realpath -m "${CARBONET_CLEAN_WORKTREE_BASE:-${CARBONET_DEPLOY_ORIGINAL_ROOT:-$ROOT_DIR}/var/deploy-worktrees}/runtime-build/var/run/full-screen-deploy-gate")"
  current_root="$(realpath -m "$FULL_SCREEN_GATE_STATE_DIR")"
  if [[ -f "$POSTDEPLOY_LEGACY_RETIRE_DIR/legacy-retire.intent.json" \
     && ! -L "$POSTDEPLOY_LEGACY_RETIRE_DIR/legacy-retire.intent.json" ]]; then
    evidence_path="$(jq -r '.sourceActive // empty' "$POSTDEPLOY_LEGACY_RETIRE_DIR/legacy-retire.intent.json" 2>/dev/null || true)"
    [[ "$evidence_path" == */active.env ]] || return 79
    gate_dir="$(realpath -m "$(dirname "$evidence_path")")"
  elif [[ -f "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" && ! -L "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" ]]; then
    snapshot_dir="$(jq -r '.snapshotDir // empty' "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" 2>/dev/null || true)"
    if [[ "$snapshot_dir" != */snapshots/* ]]; then
      # `prepare` is written before backup, build, Flyway and snapshot capture.
      # An exact non-live PREPARED checkpoint is therefore a retry hint, not a
      # legacy runtime attempt. Everything else remains fail-closed.
      [[ "$(stat -c '%a' "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" 2>/dev/null)" == 644 \
         && "$(stat -c '%u' "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" 2>/dev/null)" == "$(id -u)" ]] || return 79
      jq -e '
        keys==["baseCommit","migrationFingerprint","migrationRequired","planFingerprint",
               "preparedAt","schemaVersion","stage","targetCommit"]
        and .schemaVersion==1 and .stage=="PREPARED"
        and (.baseCommit|type=="string" and test("^[0-9a-f]{40}$"))
        and (.targetCommit|type=="string" and test("^[0-9a-f]{40}$"))
        and (.planFingerprint|type=="string" and test("^[0-9a-f]{64}$"))
        and (.migrationFingerprint|type=="string" and test("^[0-9a-f]{64}$"))
        and (.migrationRequired|type=="boolean")
        and (.preparedAt|type=="string" and length>0)
      ' "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" >/dev/null 2>&1 || return 79
      for candidate in "$configured_root/active.env" "$persistent_root/active.env" "$current_root/active.env"; do
        [[ ! -e "$candidate" && ! -L "$candidate" ]] || return 79
      done
      [[ ! -e "$POSTDEPLOY_LEGACY_RETIRE_DIR/legacy-retire.intent.json" \
         && ! -L "$POSTDEPLOY_LEGACY_RETIRE_DIR/legacy-retire.intent.json" \
         && ! -e "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" && ! -L "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" \
         && ! -e "$RUNTIME_LEDGER_QUARANTINE_FILE" && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" ]] || return 79
      return 1
    fi
    gate_dir="$(realpath -m "$(dirname "$(dirname "$snapshot_dir")")")"
  else
    [[ ! -e "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" && ! -L "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" ]] || return 79
    return 1
  fi
  for candidate in "$configured_root" "$persistent_root"; do
    [[ "$candidate" == "$gate_dir" ]] || continue
    if (( match_count == 0 )) || [[ "$candidate" != "$configured_root" ]]; then
      match_count=$((match_count + 1))
    fi
  done
  [[ "$match_count" == 1 ]] || return 79
  [[ -d "$gate_dir" && ! -L "$gate_dir" && "$(stat -c '%u' "$gate_dir" 2>/dev/null)" == "$(id -u)" ]] || return 79
  LEGACY_FULL_SCREEN_GATE_STATE_DIR="$gate_dir"
}

retire_legacy_partial_runtime_attempt() {
  local gate_active="$LEGACY_FULL_SCREEN_GATE_STATE_DIR/active.env"
  local checkpoint="$RUNTIME_CANDIDATE_CHECKPOINT_FILE" active_hash checkpoint_hash
  local expected_gate_active="$gate_active" expected_checkpoint="$checkpoint"
  local snapshot_id snapshot_dir baseline candidate authority_status=2 applied_marker
  local retired_active retired_checkpoint summary summary_tmp deployment_hash
  local snapshot_overlay_hash live_overlay_hash snapshot_nginx_hash live_nginx_hash
  local quarantine_hash="" quarantine_target="" quarantine_candidate="" quarantine_destination=""
  local intent="$POSTDEPLOY_LEGACY_RETIRE_DIR/legacy-retire.intent.json" intent_tmp completed_intent
  [[ ! -e "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" && ! -L "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]] || return 1
  if [[ -e "$intent" || -L "$intent" ]]; then
    [[ -f "$intent" && ! -L "$intent" \
       && "$(stat -c '%a' "$intent" 2>/dev/null)" == 600 \
       && "$(stat -c '%u' "$intent" 2>/dev/null)" == "$(id -u)" ]] || return 79
    jq -e '
      keys==["activeSha256","baselineCommit","candidateCommit","checkpointSha256","createdAt",
             "deploymentSha256","liveNginxSha256","liveOverlaySha256","quarantineCandidateId",
             "quarantineRetired","quarantineSha256","quarantineTargetCommit","retiredActive",
             "retiredCheckpoint","schemaVersion","snapshotId","sourceActive","sourceCheckpoint","status"]
      and .schemaVersion==1 and .status=="PENDING"
    ' "$intent" >/dev/null || return 79
    candidate="$(jq -r '.candidateCommit' "$intent")"; baseline="$(jq -r '.baselineCommit' "$intent")"
    snapshot_id="$(jq -r '.snapshotId' "$intent")"; active_hash="$(jq -r '.activeSha256' "$intent")"
    checkpoint_hash="$(jq -r '.checkpointSha256' "$intent")"; deployment_hash="$(jq -r '.deploymentSha256' "$intent")"
    live_overlay_hash="$(jq -r '.liveOverlaySha256' "$intent")"; live_nginx_hash="$(jq -r '.liveNginxSha256' "$intent")"
    quarantine_hash="$(jq -r '.quarantineSha256' "$intent")"; quarantine_target="$(jq -r '.quarantineTargetCommit' "$intent")"
    quarantine_candidate="$(jq -r '.quarantineCandidateId' "$intent")"; quarantine_destination="$(jq -r '.quarantineRetired' "$intent")"
    gate_active="$(jq -r '.sourceActive' "$intent")"; checkpoint="$(jq -r '.sourceCheckpoint' "$intent")"
    retired_active="$(jq -r '.retiredActive' "$intent")"; retired_checkpoint="$(jq -r '.retiredCheckpoint' "$intent")"
    [[ "$gate_active" == "$expected_gate_active" \
       && "$checkpoint" == "$expected_checkpoint" \
       && "$retired_active" == "$(dirname "$expected_gate_active")/retired/${snapshot_id}.legacy.env" \
       && "$retired_checkpoint" == "$(dirname "$expected_checkpoint")/retired/${candidate}.legacy-checkpoint.json" ]] \
      || return 79
    if [[ -n "$quarantine_hash" ]]; then
      [[ "$quarantine_hash" =~ ^[0-9a-f]{64}$ && "$quarantine_target" =~ ^[0-9a-f]{40}$ \
         && "$quarantine_candidate" =~ ^postdeploy:${quarantine_target:0:12}:[A-Za-z0-9._:-]{12,140}$ \
         && "$quarantine_destination" == "$POSTDEPLOY_LEGACY_RETIRE_DIR/${quarantine_candidate}.legacy-false-discovery-quarantine.state" ]] || return 79
    else
      [[ -z "$quarantine_target$quarantine_candidate$quarantine_destination" ]] || return 79
    fi
    snapshot_dir="$(sed -n "s/^SNAPSHOT_DIR='\([^']*\)'$/\1/p" "${gate_active:-/nonexistent}" 2>/dev/null || true)"
  else
    if [[ ! -e "$gate_active" && ! -e "$checkpoint" ]]; then return 1; fi
  [[ -f "$gate_active" && ! -L "$gate_active" && "$(stat -c '%a' "$gate_active" 2>/dev/null)" == 600 \
     && "$(stat -c '%u' "$gate_active" 2>/dev/null)" == "$(id -u)" \
     && -f "$checkpoint" && ! -L "$checkpoint" \
     && "$(stat -c '%a' "$checkpoint" 2>/dev/null)" == 644 \
     && "$(stat -c '%u' "$checkpoint" 2>/dev/null)" == "$(id -u)" ]] || {
    write_postdeploy_promotion_quarantine 'LEGACY_PARTIAL_STATE_CONTRACT_INVALID' || true
    return 79
  }
  # A versioned manifest without its durable journal is not legacy and must be
  # quarantined for operator recovery rather than silently retired.
  ! grep -q '^SNAPSHOT_MANIFEST_SHA256=' "$gate_active" || {
    write_postdeploy_promotion_quarantine 'VERSIONED_SNAPSHOT_JOURNAL_MISSING' || true
    return 79
  }
  if grep -Ev "^[A-Z_]+='[A-Za-z0-9._:/@+-]*'$" "$gate_active" | grep -q .; then
    write_postdeploy_promotion_quarantine 'LEGACY_ACTIVE_POINTER_INVALID' || true
    return 79
  fi
  [[ "$(sed -n "s/^\([A-Z_]*\)='.*'$/\1/p" "$gate_active" | LC_ALL=C sort)" == $'BASELINE_SOURCE_COMMIT\nGIT_SHA\nRUNTIME_IMAGE\nSNAPSHOT_DIR\nSNAPSHOT_FORMAT\nSNAPSHOT_ID\nWEB_IMAGE' \
     && "$(awk 'END{print NR}' "$gate_active")" == 7 ]] || {
    write_postdeploy_promotion_quarantine 'LEGACY_ACTIVE_POINTER_INVALID' || true
    return 79
  }
  jq -e '
    (keys==["activeFileSha256","assetManifestSha256","baseCommit","deploymentGeneration",
            "deploymentUid","desiredReplicas","imageIdDigest","imageRef","migrationEvidenceSha256",
            "migrationFingerprint","migrationRequired","planFingerprint","preparedAt","releaseId",
            "schemaVersion","snapshotDir","snapshotId","stage","targetCommit","verifiedAt"]
     or
     keys==["activeFileSha256","assetManifestSha256","baseCommit","deploymentGeneration",
            "deploymentUid","desiredReplicas","imageIdDigest","imageRef","migrationEvidenceSha256",
            "migrationFingerprint","migrationRequired","planFingerprint","podTemplateSha256","preparedAt","releaseId",
            "schemaVersion","snapshotDir","snapshotId","stage","targetCommit","verifiedAt"])
    and .schemaVersion==1 and .stage=="RUNTIME_CANDIDATE_READY"
    and (.migrationRequired|type)=="boolean" and (.deploymentGeneration|type)=="number"
    and (.desiredReplicas|type)=="number" and .desiredReplicas>0
    and ((has("podTemplateSha256")|not)
         or (.podTemplateSha256|type=="string" and test("^[0-9a-f]{64}$")))
  ' "$checkpoint" >/dev/null || {
    write_postdeploy_promotion_quarantine 'LEGACY_CHECKPOINT_CONTRACT_INVALID' || true
    return 79
  }
  snapshot_id="$(sed -n "s/^SNAPSHOT_ID='\([^']*\)'$/\1/p" "$gate_active")"
  snapshot_dir="$(sed -n "s/^SNAPSHOT_DIR='\([^']*\)'$/\1/p" "$gate_active")"
  baseline="$(sed -n "s/^BASELINE_SOURCE_COMMIT='\([^']*\)'$/\1/p" "$gate_active")"
  [[ -n "$baseline" ]] || baseline="$(sed -n "s/^GIT_SHA='\([^']*\)'$/\1/p" "$gate_active")"
  active_hash="$(sha256sum "$gate_active" | awk '{print $1}')"
  checkpoint_hash="$(sha256sum "$checkpoint" | awk '{print $1}')"
  candidate="$(jq -r '.targetCommit // empty' "$checkpoint" 2>/dev/null || true)"
  if [[ ! "$snapshot_id" =~ ^[A-Za-z0-9._-]+$ || ! "$baseline" =~ ^[0-9a-f]{40}$ \
     || ! "$candidate" =~ ^[0-9a-f]{40}$ || "$candidate" == "$baseline" \
     || "$(jq -r '.stage // empty' "$checkpoint")" != RUNTIME_CANDIDATE_READY \
     || "$(jq -r '.snapshotId // empty' "$checkpoint")" != "$snapshot_id" \
     || "$(jq -r '.snapshotDir // empty' "$checkpoint")" != "$snapshot_dir" \
     || "$(jq -r '.activeFileSha256 // empty' "$checkpoint")" != "$active_hash" ]]; then
    write_postdeploy_promotion_quarantine 'LEGACY_PARTIAL_IDENTITY_MISMATCH' || true
    return 79
  fi
  case "$(realpath -m "$snapshot_dir")" in
    "$(realpath -m "$(dirname "$gate_active")")"/snapshots/*) ;;
    *) write_postdeploy_promotion_quarantine 'LEGACY_SNAPSHOT_PATH_UNSAFE' || true; return 79 ;;
  esac
  [[ -d "$snapshot_dir" && -s "$snapshot_dir/nginx.conf" \
     && ( -s "$snapshot_dir/frontend-overlay/index.html" || -s "$snapshot_dir/frontend-overlay.tar" || -s "$snapshot_dir/frontend-overlay.tar.gz" ) ]] || {
    write_postdeploy_promotion_quarantine 'LEGACY_SNAPSHOT_CLOSURE_INCOMPLETE' || true
    return 79
  }
  [[ "$(stat -c '%u' "$snapshot_dir" 2>/dev/null)" == "$(id -u)" \
     && ! -L "$snapshot_dir" && "$(sed -n "s/^SNAPSHOT_FORMAT='\([^']*\)'$/\1/p" "$gate_active")" == hardlink-tree \
     && -d "$snapshot_dir/frontend-overlay" && ! -L "$snapshot_dir/frontend-overlay" ]] || {
    write_postdeploy_promotion_quarantine 'LEGACY_SNAPSHOT_OWNERSHIP_INVALID' || true
    return 79
  }
  snapshot_overlay_hash="$(legacy_overlay_tree_hash "$snapshot_dir/frontend-overlay")" || return 79
  live_overlay_hash="$(legacy_overlay_tree_hash "$live_frontend_overlay")" || return 79
  snapshot_nginx_hash="$(sha256sum "$snapshot_dir/nginx.conf" | awk '{print $1}')"
  live_nginx_hash="$(legacy_live_nginx_hash)" || return 79
  [[ "$snapshot_overlay_hash" =~ ^[0-9a-f]{64}$ && "$snapshot_overlay_hash" == "$live_overlay_hash" \
     && "$snapshot_nginx_hash" =~ ^[0-9a-f]{64}$ && "$snapshot_nginx_hash" == "$live_nginx_hash" ]] || {
    write_postdeploy_promotion_quarantine 'LEGACY_BASELINE_OVERLAY_OR_NGINX_MISMATCH' || true
    return 79
  }
  if postdeploy_authoritative_promotion_status "$candidate"; then authority_status=0; else authority_status=$?; fi
  [[ "$authority_status" == 1 ]] || {
    write_postdeploy_promotion_quarantine 'LEGACY_CANDIDATE_PROMOTION_NOT_DEFINITIVELY_ABSENT' || true
    return 79
  }
  postdeploy_source_has_no_attempt_or_promotion_rows "$candidate" || {
    write_postdeploy_promotion_quarantine 'LEGACY_CANDIDATE_ATTEMPT_ABSENCE_UNPROVEN' || true
    return 79
  }
  verify_operational_usage_ledger_current_runtime_identity "$baseline" proof-only || {
    write_postdeploy_promotion_quarantine 'LEGACY_BASELINE_LIVE_PROOF_FAILED' || true
    return 79
  }
  applied_marker="$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE" 2>/dev/null || true)"
  [[ "$applied_marker" == "$baseline" && "$runtime_deployed_commit" == "$baseline" ]] || {
    write_postdeploy_promotion_quarantine 'LEGACY_BASELINE_MARKERS_MISMATCH' || true
    return 79
  }
  deployment_hash="$(legacy_owned_runtime_projection_hash)" || return 79
  if [[ "$legacy_false_discovery_quarantine_deferred" == true ]]; then
    [[ "$legacy_false_discovery_quarantine_baseline" == "$baseline" ]] || return 79
    if [[ "$legacy_false_discovery_quarantine_target" != "$target_commit" ]]; then
      git -C "$ROOT_DIR" merge-base --is-ancestor \
        "$legacy_false_discovery_quarantine_target" "$target_commit" || return 79
    fi
    if postdeploy_authoritative_promotion_status "$legacy_false_discovery_quarantine_target"; then authority_status=0; else authority_status=$?; fi
    [[ "$authority_status" == 1 ]] || return 79
    postdeploy_source_has_no_attempt_or_promotion_rows "$legacy_false_discovery_quarantine_target" || return 79
    quarantine_hash="$legacy_false_discovery_quarantine_hash"
    quarantine_target="$legacy_false_discovery_quarantine_target"
    quarantine_candidate="$legacy_false_discovery_quarantine_candidate"
    quarantine_destination="$POSTDEPLOY_LEGACY_RETIRE_DIR/${quarantine_candidate}.legacy-false-discovery-quarantine.state"
  fi
  mkdir -p "$(dirname "$gate_active")/retired" "$(dirname "$checkpoint")/retired" "$POSTDEPLOY_LEGACY_RETIRE_DIR"
  retired_active="$(dirname "$gate_active")/retired/${snapshot_id}.legacy.env"
  retired_checkpoint="$(dirname "$checkpoint")/retired/${candidate}.legacy-checkpoint.json"
  summary="$POSTDEPLOY_LEGACY_RETIRE_DIR/${candidate}.legacy-retired.json"
  [[ ! -e "$retired_active" && ! -e "$retired_checkpoint" && ! -e "$summary" ]] || return 79
  intent_tmp="$(mktemp "$POSTDEPLOY_LEGACY_RETIRE_DIR/.legacy-retire.intent.XXXXXX")" || return 79
  jq -n --arg createdAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" --arg candidate "$candidate" \
    --arg baseline "$baseline" --arg snapshotId "$snapshot_id" --arg activeHash "$active_hash" \
    --arg checkpointHash "$checkpoint_hash" --arg deploymentHash "$deployment_hash" \
    --arg liveOverlayHash "$live_overlay_hash" --arg liveNginxHash "$live_nginx_hash" \
    --arg quarantineHash "$quarantine_hash" --arg quarantineTarget "$quarantine_target" \
    --arg quarantineCandidate "$quarantine_candidate" --arg quarantineRetired "$quarantine_destination" \
    --arg sourceActive "$gate_active" --arg sourceCheckpoint "$checkpoint" \
    --arg retiredActive "$retired_active" --arg retiredCheckpoint "$retired_checkpoint" '
    {schemaVersion:1,status:"PENDING",createdAt:$createdAt,candidateCommit:$candidate,
     baselineCommit:$baseline,snapshotId:$snapshotId,activeSha256:$activeHash,
     checkpointSha256:$checkpointHash,deploymentSha256:$deploymentHash,
     liveOverlaySha256:$liveOverlayHash,liveNginxSha256:$liveNginxHash,
     quarantineSha256:$quarantineHash,quarantineTargetCommit:$quarantineTarget,
     quarantineCandidateId:$quarantineCandidate,quarantineRetired:$quarantineRetired,
     sourceActive:$sourceActive,sourceCheckpoint:$sourceCheckpoint,
     retiredActive:$retiredActive,retiredCheckpoint:$retiredCheckpoint}
  ' >"$intent_tmp" && chmod 0600 "$intent_tmp" && mv -fT -- "$intent_tmp" "$intent" || return 79
  sync -f "$POSTDEPLOY_LEGACY_RETIRE_DIR" 2>/dev/null || true
  fi

  [[ "$candidate" =~ ^[0-9a-f]{40}$ && "$baseline" =~ ^[0-9a-f]{40}$ \
     && "$snapshot_id" =~ ^[A-Za-z0-9._-]+$ && "$active_hash" =~ ^[0-9a-f]{64}$ \
     && "$checkpoint_hash" =~ ^[0-9a-f]{64}$ && "$deployment_hash" =~ ^[0-9a-f]{64}$ \
     && "$live_overlay_hash" =~ ^[0-9a-f]{64}$ && "$live_nginx_hash" =~ ^[0-9a-f]{64}$ ]] || return 79
  if postdeploy_authoritative_promotion_status "$candidate"; then authority_status=0; else authority_status=$?; fi
  [[ "$authority_status" == 1 ]] || return 79
  verify_operational_usage_ledger_current_runtime_identity "$baseline" proof-only || return 79
  applied_marker="$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE" 2>/dev/null || true)"
  [[ "$applied_marker" == "$baseline" && "$runtime_deployed_commit" == "$baseline" ]] || return 79
  [[ "$(legacy_owned_runtime_projection_hash)" == "$deployment_hash" \
     && "$(legacy_overlay_tree_hash "$live_frontend_overlay")" == "$live_overlay_hash" \
     && "$(legacy_live_nginx_hash)" == "$live_nginx_hash" ]] || return 79
  postdeploy_source_has_no_attempt_or_promotion_rows "$candidate" || return 79
  if [[ -n "$quarantine_hash" ]]; then
    if postdeploy_authoritative_promotion_status "$quarantine_target"; then authority_status=0; else authority_status=$?; fi
    [[ "$authority_status" == 1 ]] || return 79
    postdeploy_source_has_no_attempt_or_promotion_rows "$quarantine_target" || return 79
    if [[ -e "$RUNTIME_LEDGER_QUARANTINE_FILE" || -L "$RUNTIME_LEDGER_QUARANTINE_FILE" ]]; then
      [[ -f "$RUNTIME_LEDGER_QUARANTINE_FILE" && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" \
         && "$(stat -c '%a' "$RUNTIME_LEDGER_QUARANTINE_FILE")" == 600 \
         && "$(stat -c '%u' "$RUNTIME_LEDGER_QUARANTINE_FILE")" == "$(id -u)" \
         && "$(sha256sum "$RUNTIME_LEDGER_QUARANTINE_FILE" | awk '{print $1}')" == "$quarantine_hash" ]] || return 79
    else
      [[ -f "$quarantine_destination" && ! -L "$quarantine_destination" \
         && "$(sha256sum "$quarantine_destination" | awk '{print $1}')" == "$quarantine_hash" ]] || return 79
    fi
  fi
  mkdir -p "$(dirname "$retired_active")" "$(dirname "$retired_checkpoint")" "$POSTDEPLOY_LEGACY_RETIRE_DIR"
  if [[ -e "$gate_active" || -L "$gate_active" ]]; then
    [[ -f "$gate_active" && ! -L "$gate_active" \
       && "$(sha256sum "$gate_active" | awk '{print $1}')" == "$active_hash" \
       && ! -e "$retired_active" && ! -L "$retired_active" ]] || return 79
    mv -T -- "$gate_active" "$retired_active"
  fi
  [[ -f "$retired_active" && ! -L "$retired_active" \
     && "$(sha256sum "$retired_active" | awk '{print $1}')" == "$active_hash" ]] || return 79
  if [[ -e "$checkpoint" || -L "$checkpoint" ]]; then
    [[ -f "$checkpoint" && ! -L "$checkpoint" \
       && "$(sha256sum "$checkpoint" | awk '{print $1}')" == "$checkpoint_hash" \
       && ! -e "$retired_checkpoint" && ! -L "$retired_checkpoint" ]] || return 79
    mv -T -- "$checkpoint" "$retired_checkpoint"
  fi
  [[ -f "$retired_checkpoint" && ! -L "$retired_checkpoint" \
     && "$(sha256sum "$retired_checkpoint" | awk '{print $1}')" == "$checkpoint_hash" ]] || return 79
  chmod 0600 "$retired_active" "$retired_checkpoint"
  summary="$POSTDEPLOY_LEGACY_RETIRE_DIR/${candidate}.legacy-retired.json"
  if [[ ! -e "$summary" && ! -L "$summary" ]]; then
  summary_tmp="$(mktemp "$POSTDEPLOY_LEGACY_RETIRE_DIR/.legacy-retired.XXXXXX")"
  jq -n --arg retiredAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" --arg candidate "$candidate" \
    --arg baseline "$baseline" --arg snapshotId "$snapshot_id" --arg activeHash "$active_hash" \
    --arg checkpointHash "$checkpoint_hash" --arg deploymentHash "$deployment_hash" \
    --arg liveOverlayHash "$live_overlay_hash" --arg liveNginxHash "$live_nginx_hash" \
    --arg quarantineHash "$quarantine_hash" --arg quarantineTarget "$quarantine_target" \
    --arg quarantineCandidate "$quarantine_candidate" --arg quarantineEvidence "$quarantine_destination" \
    --arg activeEvidence "$retired_active" --arg checkpointEvidence "$retired_checkpoint" '
    {schemaVersion:1,status:"RETIRED",reason:"LEGACY_ROLLED_BACK_CANDIDATE",
     retiredAt:$retiredAt,candidateCommit:$candidate,baselineCommit:$baseline,snapshotId:$snapshotId,
     activeFileSha256:$activeHash,checkpointSha256:$checkpointHash,liveDeploymentSha256:$deploymentHash,
     liveOverlaySha256:$liveOverlayHash,liveNginxSha256:$liveNginxHash,
     quarantineSha256:$quarantineHash,quarantineTargetCommit:$quarantineTarget,
     quarantineCandidateId:$quarantineCandidate,quarantineEvidence:$quarantineEvidence,
     activeEvidence:$activeEvidence,checkpointEvidence:$checkpointEvidence}
  ' >"$summary_tmp"
  chmod 0600 "$summary_tmp" && mv -fT -- "$summary_tmp" "$summary"
  else
    jq -e --arg candidate "$candidate" --arg activeHash "$active_hash" --arg checkpointHash "$checkpoint_hash" \
      --arg quarantineHash "$quarantine_hash" '
      .status=="RETIRED" and .candidateCommit==$candidate and .activeFileSha256==$activeHash
      and .checkpointSha256==$checkpointHash and .quarantineSha256==$quarantineHash
    ' "$summary" >/dev/null || return 79
  fi
  # Retire the pinned false-discovery artifact last, only after both legacy
  # evidence files and their immutable RETIRED summary are durable.
  if [[ -n "$quarantine_hash" ]]; then
    if [[ -e "$RUNTIME_LEDGER_QUARANTINE_FILE" || -L "$RUNTIME_LEDGER_QUARANTINE_FILE" ]]; then
      [[ -f "$RUNTIME_LEDGER_QUARANTINE_FILE" && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" \
         && "$(sha256sum "$RUNTIME_LEDGER_QUARANTINE_FILE" | awk '{print $1}')" == "$quarantine_hash" \
         && ! -e "$quarantine_destination" && ! -L "$quarantine_destination" ]] || return 79
      mv -T -- "$RUNTIME_LEDGER_QUARANTINE_FILE" "$quarantine_destination" || return 79
      chmod 0600 "$quarantine_destination" || return 79
    fi
    [[ -f "$quarantine_destination" && ! -L "$quarantine_destination" \
       && "$(sha256sum "$quarantine_destination" | awk '{print $1}')" == "$quarantine_hash" ]] || return 79
  fi
  completed_intent="$POSTDEPLOY_LEGACY_RETIRE_DIR/${candidate}.legacy-retire.completed.json"
  if [[ -e "$intent" || -L "$intent" ]]; then
    [[ ! -e "$completed_intent" && ! -L "$completed_intent" ]] || return 79
    mv -T -- "$intent" "$completed_intent" && chmod 0600 "$completed_intent" || return 79
  fi
  echo "[auto-deploy] legacy partial attempt RETIRED candidate=$candidate baseline=$baseline snapshot=$snapshot_id"
  return 0
}

recover_persistent_postdeploy_attempt() {
  [[ -e "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" || -L "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]] || return 1
  local journal status candidate source baseline recovered_status snapshot_id snapshot_manifest
  local final_live_recovery_status=1
  local saved_candidate="$postdeploy_candidate_id" saved_target="$target_commit" saved_deployed="$deployed_commit"
  journal="$(python3 "$POSTDEPLOY_JOURNAL_HELPER" \
    --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read)" || return 79
  status="$(jq -r '.lifecycleStatus' <<<"$journal")"
  candidate="$(jq -r '.candidateId' <<<"$journal")"
  source="$(jq -r '.sourceCommit' <<<"$journal")"
  baseline="$(jq -r '.baseCommit' <<<"$journal")"
  postdeploy_candidate_id="$candidate"; target_commit="$source"; deployed_commit="$baseline"
  postdeploy_attempt_journal_initialized=true
  postdeploy_db_attempt_staged="$(jq -r '.dbAttemptStaged' <<<"$journal")"
  if [[ "$status" == STAGED || "$status" == ABORTED ]]; then
    recover_staged_postdeploy_attempt_after_failure || return $?
    if [[ -s "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]]; then
      recovered_status="$(python3 "$POSTDEPLOY_JOURNAL_HELPER" \
        --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read | jq -r '.lifecycleStatus')" || return 79
    else
      recovered_status=CLEARED
    fi
    if [[ "$recovered_status" == PROMOTED ]]; then
      # The immutable DB promotion may commit while the filesystem journal is
      # still STAGED.  The failure reconciler transitions it to PROMOTED, but
      # must also bind and disarm this exact rollback snapshot before handing
      # marker recovery to the generic promoted-runtime reconciler.
      journal="$(python3 "$POSTDEPLOY_JOURNAL_HELPER" \
        --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read)" || return 79
      snapshot_id="$(jq -r '.rollback.snapshotId' <<<"$journal")"
      snapshot_manifest="$(jq -r '.rollback.snapshotManifestSha256' <<<"$journal")"
      baseline="$(jq -r '.baseCommit' <<<"$journal")"
      [[ "$snapshot_id" =~ ^[A-Za-z0-9._-]+$ \
         && "$snapshot_manifest" =~ ^[0-9a-f]{64}$ \
         && "$baseline" =~ ^[0-9a-f]{40}$ ]] || return 79
      if ! postdeploy_authoritative_promotion_status "$source" "$candidate" \
         || ! verify_operational_usage_ledger_current_runtime_identity "$source" proof-only; then
        write_postdeploy_promotion_quarantine 'PERSISTENT_PROMOTED_ATTEMPT_DIVERGED' || true
        return 79
      fi
      OVERLAY_DIR="$live_frontend_overlay" FULL_SCREEN_GATE_DEFER_ACCEPT=true \
      FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
      FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
      FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
        bash "$POSTDEPLOY_GATE_SCRIPT" finalize-success || return 79
      postdeploy_candidate_id="$saved_candidate"; target_commit="$saved_target"; deployed_commit="$saved_deployed"
      postdeploy_attempt_journal_initialized=false
      postdeploy_db_attempt_staged=false
      return 2
    fi
    postdeploy_candidate_id="$saved_candidate"; target_commit="$saved_target"; deployed_commit="$saved_deployed"
    postdeploy_attempt_journal_initialized=false
    postdeploy_db_attempt_staged=false
    [[ "$recovered_status" == CLEARED ]] && return 0
    return 79
  fi
  if [[ "$status" == PROMOTED ]]; then
    if recover_promoted_final_live_verify_pending "$journal" "$source" "$candidate"; then
      final_live_recovery_status=0
    else
      final_live_recovery_status=$?
    fi
    case "$final_live_recovery_status" in
      0) ;;
      1) ;;
      *) return "$final_live_recovery_status" ;;
    esac
    if ! postdeploy_authoritative_promotion_status "$source" "$candidate" \
       || ! verify_operational_usage_ledger_current_runtime_identity "$source" proof-only; then
      write_postdeploy_promotion_quarantine 'PERSISTENT_PROMOTED_ATTEMPT_DIVERGED' || true
      return 79
    fi
    snapshot_id="$(jq -r '.rollback.snapshotId' <<<"$journal")"
    snapshot_manifest="$(jq -r '.rollback.snapshotManifestSha256' <<<"$journal")"
    [[ "$snapshot_id" =~ ^[A-Za-z0-9._-]+$ && "$snapshot_manifest" =~ ^[0-9a-f]{64}$ ]] || return 79
    # Always bind the active-or-retired success pointer to this exact journal;
    # both COMMIT->SIGKILL and finalize-success->SIGKILL are idempotent.
    OVERLAY_DIR="$live_frontend_overlay" FULL_SCREEN_GATE_DEFER_ACCEPT=true \
    FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
    FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
    FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
      bash "$POSTDEPLOY_GATE_SCRIPT" finalize-success || return 79
    # Existing DB-authoritative marker recovery reconciles derived markers.
    # Keep the journal until markers/checkpoint/quarantine all succeed.
    postdeploy_candidate_id="$saved_candidate"; target_commit="$saved_target"; deployed_commit="$saved_deployed"
    return 2
  fi
  return 79
}

archive_recovered_promoted_attempt_journal() {
  [[ -s "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]] || return 0
  local journal saved_candidate="$postdeploy_candidate_id" saved_target="$target_commit"
  journal="$(python3 "$POSTDEPLOY_JOURNAL_HELPER" \
    --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read)" || return 1
  [[ "$(jq -r '.lifecycleStatus' <<<"$journal")" == PROMOTED ]] || return 1
  postdeploy_candidate_id="$(jq -r '.candidateId' <<<"$journal")"
  target_commit="$(jq -r '.sourceCommit' <<<"$journal")"
  archive_postdeploy_attempt_journal_terminal PROMOTED || return 1
  postdeploy_candidate_id="$saved_candidate"; target_commit="$saved_target"
}

run_operational_usage_ledger_current_runtime_e2e_if_required() {
  local expected_commit="$1"
  [[ ",${PLAN_TESTS:-}," == *",runtime:operational-usage-ledger-e2e,"* ]] || return 0
  verify_operational_usage_ledger_current_runtime_identity "$expected_commit"
  run_operational_usage_ledger_live_e2e_if_required "$expected_commit"
}

run_postdeploy_candidate_static_contract_if_required() {
  [[ ",${PLAN_TESTS:-}," == *",runtime:postdeploy-candidate-evidence,"* ]] || return 0
  bash ops/tests/test-postdeploy-candidate-evidence-contract.sh "$ROOT_DIR"
  bash ops/tests/test-durable-postdeploy-rollback-reconciler.sh "$ROOT_DIR"
  echo "[auto-deploy] postdeploy candidate static contract PASS"
}

bind_postdeploy_candidate_live_source() {
  local before after final resource_version before_immutable after_immutable
  before="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json)" || return 1
  jq -e --arg namespace "$NAMESPACE" --arg deployment "$DEPLOYMENT" '
    .metadata.namespace==$namespace and .metadata.name==$deployment
    and (.metadata.resourceVersion|type=="string" and length>0)
    and (.metadata.uid|type=="string" and length>0) and .spec.template
  ' <<<"$before" >/dev/null || return 1
  before_immutable="$(jq -cS '{uid:.metadata.uid,generation:.metadata.generation,
    replicas:.spec.replicas,selector:.spec.selector,template:.spec.template}' <<<"$before")" || return 1
  if [[ "$(jq -r '.metadata.annotations["resonance.ai/target-commit"]//empty' <<<"$before")" != "$target_commit" ]]; then
    resource_version="$(jq -r '.metadata.resourceVersion' <<<"$before")"
    after="$(kubectl -n "$NAMESPACE" annotate "deployment/$DEPLOYMENT" \
      --resource-version="$resource_version" \
      "resonance.ai/target-commit=$target_commit" --overwrite -o json)" || return 1
  else
    after="$before"
  fi
  after_immutable="$(jq -cS '{uid:.metadata.uid,generation:.metadata.generation,
    replicas:.spec.replicas,selector:.spec.selector,template:.spec.template}' <<<"$after")" || return 1
  [[ "$after_immutable" == "$before_immutable" ]] || return 1
  final="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json)" || return 1
  jq -e --arg source "$target_commit" \
    --argjson expected "$(jq -cS '{uid:.metadata.uid,generation:.metadata.generation,
      replicas:.spec.replicas,selector:.spec.selector,template:.spec.template}' <<<"$after")" '
    .metadata.annotations["resonance.ai/target-commit"]==$source
    and {uid:.metadata.uid,generation:.metadata.generation,replicas:.spec.replicas,
         selector:.spec.selector,template:.spec.template}==$expected
  ' <<<"$final" >/dev/null
}

enable_postdeploy_candidate_mode() {
  [[ "$postdeploy_candidate_initialized" != true ]] || return 0
  [[ "$postdeploy_attempt_journal_initialized" == true ]] \
    || { echo '[auto-deploy] candidate mode requires a durable pre-mutation attempt journal' >&2; return 1; }
  python3 "$POSTDEPLOY_JOURNAL_HELPER" \
    --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read | jq -e \
      --arg candidate "$postdeploy_candidate_id" --arg source "$target_commit" '
      .lifecycleStatus=="STAGED" and .rollbackStage=="ARMED" and .dbAttemptStaged==true
      and .candidateId==$candidate and .sourceCommit==$source
    ' >/dev/null || { echo '[auto-deploy] candidate journal identity is not STAGED' >&2; return 1; }
  verify_postdeploy_release_attempt_db_staged \
    || { echo '[auto-deploy] candidate DB attempt identity is not exact STAGED' >&2; return 1; }
  postdeploy_db_attempt_staged=true
  # Hide the old singleton first, then bind the rollback-protected Deployment
  # annotation to this attempt with a resourceVersion CAS. Candidate unit
  # stagers refuse a wrong source annotation and independently reread it.
  invalidate_runtime_release_state \
    || { echo '[auto-deploy] candidate runtime ledger invalidation failed' >&2; return 1; }
  bind_postdeploy_candidate_live_source \
    || { echo '[auto-deploy] candidate live source annotation CAS failed' >&2; return 1; }
  export CARBONET_POSTDEPLOY_EVIDENCE_MODE=candidate
  export CARBONET_POSTDEPLOY_CANDIDATE_ID="$postdeploy_candidate_id"
  export CARBONET_POSTDEPLOY_SOURCE_COMMIT="$target_commit"
  export CARBONET_RUNTIME_CANDIDATE_CHECKPOINT_FILE="$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
  export CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$POSTDEPLOY_ATTEMPT_JOURNAL_FILE"
  postdeploy_candidate_initialized=true
  echo "[auto-deploy] postdeploy candidate enabled id=$postdeploy_candidate_id sourceCommit=$target_commit"
}

run_postdeploy_candidate_validation_groups() {
  local asset_sync_precompleted="${1:-false}"
  [[ "$postdeploy_candidate_initialized" == true \
     && "${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == candidate ]] \
    || { echo '[auto-deploy] candidate validation requested outside a runtime release path' >&2; return 1; }
  if [[ ",${PLAN_TESTS:-}," == *",runtime:identity-staged-reconcile-required,"* ]]; then
    echo '[auto-deploy] BLOCKED identity design changed without a staged reconcile and rollback contract' >&2
    return 78
  fi
  UNIFIED_ASSET_SYNC_PRECOMPLETED="$asset_sync_precompleted" \
    bash ops/scripts/run-post-deploy-validation-groups.sh "$ROOT_DIR" "$target_commit" "$deployed_commit"
}

verify_postdeploy_candidate_staged() {
  local staged
  staged="$({
    cat <<'SQL'
WITH expected(unit_code,process_code,evidence_kind) AS (VALUES
  ('ACTIVITY_DATA_RUNTIME','ACTIVITY_DATA','RUNTIME'),
  ('ACTIVITY_DATA_STATIC','ACTIVITY_DATA','STATIC'),
  ('ACTOR_ACCOUNT_CUSTOMER_JOURNEY','CUSTOMER_WORK_COORDINATION','RUNTIME'),
  ('CUSTOMER_WORK_COORDINATION_RUNTIME','CUSTOMER_WORK_COORDINATION','RUNTIME'),
  ('EMISSION_CALCULATION_RUNTIME','EMISSION_CALCULATION','RUNTIME'),
  ('EMISSION_CALCULATION_STATIC','EMISSION_CALCULATION','STATIC'),
  ('GOVERNANCE_CHANGE_RUNTIME','GOVERNANCE_CHANGE','RUNTIME'),
  ('OPERATIONAL_USAGE_LEDGER_GATE','__RELEASE__','RELEASE_GATE'),
  ('ORGANIZATIONAL_BOUNDARY_RUNTIME','ORGANIZATIONAL_BOUNDARY','RUNTIME'),
  ('REPORT_CERTIFICATION_RUNTIME','REPORT_CERTIFICATION','RUNTIME'),
  ('REPORT_CERTIFICATION_STATIC','REPORT_CERTIFICATION','STATIC'),
  ('SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW','__RELEASE__','RELEASE_GATE')
), actual AS (
  SELECT unit_code,process_code,evidence_kind,source_commit,evidence_status,evidence_json,evidence_hash,
         candidate_runtime_identity_hash
  FROM framework_postdeploy_evidence_candidate WHERE candidate_id=:'candidate_id'
), matching AS (
  SELECT a.unit_code FROM actual a JOIN expected e USING(unit_code,process_code,evidence_kind)
), attempt AS (
  SELECT source_commit,attempt_status,candidate_runtime_identity_hash
    FROM framework_postdeploy_release_attempt WHERE candidate_id=:'candidate_id'
), runtime AS (
  SELECT source_commit,framework_runtime_release_identity_hash(runtime) runtime_identity_hash
    FROM framework_runtime_release_state runtime WHERE release_key='CARBONET_RUNTIME'
)
SELECT jsonb_build_object(
  'unitCount',(SELECT count(*) FROM actual),
  'tupleCount',(SELECT count(*) FROM matching),
  'processCount',(SELECT count(DISTINCT process_code) FROM actual WHERE process_code<>'__RELEASE__'),
  'bound',coalesce((SELECT bool_and(source_commit=:'source_commit' AND evidence_status='CANDIDATE_VERIFIED'
    AND evidence_hash ~ '^[0-9a-f]{64}$' AND evidence_json->>'status'='PASS'
    AND evidence_json->>'sourceCommit'=:'source_commit'
    AND candidate_runtime_identity_hash=(SELECT attempt.candidate_runtime_identity_hash FROM attempt)
    AND evidence_json->>'runtimeIdentityHash'=(SELECT attempt.candidate_runtime_identity_hash FROM attempt))
      FROM actual),false)
    AND coalesce((SELECT attempt_status='STAGED' AND source_commit=:'source_commit'
      AND candidate_runtime_identity_hash~'^[0-9a-f]{64}$'
      AND candidate_runtime_identity_hash=(SELECT runtime_identity_hash FROM runtime)
      AND source_commit=(SELECT runtime.source_commit FROM runtime) FROM attempt),false)
)::text;
SQL
  } | kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt -v ON_ERROR_STOP=1 \
        -v candidate_id="$postdeploy_candidate_id" -v source_commit="$target_commit")"
  jq -e '.unitCount==12 and .tupleCount==12 and .processCount==6 and .bound==true' <<<"$staged" >/dev/null \
    || { echo "[auto-deploy] candidate staged precheck failed candidate=$postdeploy_candidate_id" >&2; return 1; }
  echo "[auto-deploy] candidate staged precheck PASS units=12/12 processes=6 candidate=$postdeploy_candidate_id"
}

finalize_postdeploy_candidate_release() {
  local promoter_status=0 authority_status=2 applied_marker="" runtime_marker="" runtime_hash=""
  local attempt_terminal_status=PROMOTED transition_status=PROMOTED transition_reason=PROMOTION_COMMITTED
  local journal="" snapshot_id="" snapshot_manifest="" baseline=""
  local gate_overlay="${live_frontend_overlay:-${CARBONET_LIVE_FRONTEND_OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}}"
  record_runtime_release_state "$target_commit"
  run_operational_usage_ledger_live_e2e_if_required "$target_commit"
  verify_postdeploy_candidate_staged
  if CARBONET_DEPLOY_ROOT="$ROOT_DIR" \
     CARBONET_K8S_NAMESPACE="$NAMESPACE" \
     CARBONET_K8S_DEPLOYMENT="$DEPLOYMENT" \
     CARBONET_POSTGRES_CONTAINER="$POSTGRES_CONTAINER" \
     POSTGRES_DB="$POSTGRES_DB" POSTGRES_ADMIN_USER="$POSTGRES_USER" \
     CARBONET_POSTDEPLOY_DEFER_MARKER_UNTIL_FINAL_VERIFY=true \
       bash ops/scripts/promote-postdeploy-candidate-evidence.sh \
         "$ROOT_DIR" "$postdeploy_candidate_id" "$target_commit" "$RUNTIME_DEPLOY_STATE_FILE"; then
    promoter_status=0
  else
    promoter_status=$?
  fi

  if postdeploy_authoritative_promotion_status "$target_commit" "$postdeploy_candidate_id"; then authority_status=0; else authority_status=$?; fi
  case "$authority_status" in
    0)
      postdeploy_candidate_promoted=true
      runtime_hash="$(current_runtime_identity_hash "$target_commit" | tr -d '[:space:]')"
      if [[ "$POSTDEPLOY_AUTHORITY_OUTCOME" == PROMOTED_RECONCILED ]]; then
        attempt_terminal_status=ABORTED
        transition_status=ABORTED
        transition_reason=RECONCILED_TO_EXISTING_SOURCE_PROMOTION
      else
        transition_status=PROMOTED
        transition_reason=PROMOTION_COMMITTED
      fi
      if [[ ! "$runtime_hash" =~ ^[0-9a-f]{64}$ ]] \
         || ! transition_postdeploy_attempt_journal "$transition_status" "$runtime_hash" "$transition_reason"; then
        write_postdeploy_promotion_quarantine 'PROMOTED_ATTEMPT_JOURNAL_TRANSITION_FAILED' || true
        echo '[auto-deploy] FAIL DB promotion committed but durable journal transition failed' >&2
        return 79
      fi
      # Promotion commits current evidence, but it cannot disarm rollback or
      # publish either derived marker until one complete live proof remains
      # stable across its final resourceVersion/PodTemplate reread.
      if ! verify_operational_usage_ledger_current_runtime_identity "$target_commit" proof-only; then
        if ! invalidate_runtime_release_state; then
          write_postdeploy_promotion_quarantine 'PROMOTED_FINAL_LIVE_IDENTITY_INVALIDATION_UNVERIFIED' || true
          echo '[auto-deploy] FAIL promoted final-live drift and runtime-ledger count=0 compensation is unverified' >&2
          return 79
        fi
        if ! write_postdeploy_marker_pending 'DB_PROMOTED_FINAL_LIVE_VERIFY_PENDING'; then
          write_postdeploy_promotion_quarantine 'PROMOTED_FINAL_LIVE_PENDING_WRITE_FAILED' || true
          return 79
        fi
        if ! write_postdeploy_promotion_quarantine 'PROMOTED_FINAL_LIVE_IDENTITY_DRIFT'; then
          echo '[auto-deploy] FAIL promoted final-live drift quarantine could not be persisted' >&2
          return 79
        fi
        echo '[auto-deploy] RECOVERY_PENDING DB promotion committed but final live identity drifted; ledger invalidated, rollback snapshot and markers retained' >&2
        # Exit 75 follows the existing DB-promoted marker-recovery contract.
        # Exit 79 is reserved here for unverified compensation/persistence so
        # the failure handler does not suppress the durable recovery schedule.
        return 75
      fi
      journal="$(python3 "$POSTDEPLOY_JOURNAL_HELPER" \
        --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read)" || return 79
      snapshot_id="$(jq -r '.rollback.snapshotId' <<<"$journal")"
      snapshot_manifest="$(jq -r '.rollback.snapshotManifestSha256' <<<"$journal")"
      baseline="$(jq -r '.baseCommit' <<<"$journal")"
      # DB promotion is the immutable acceptance point. Disarm the rollback
      # snapshot immediately so a later derived-marker fault cannot restore an
      # already promoted runtime and split it from current evidence.
      if [[ -s "$FULL_SCREEN_GATE_STATE_DIR/active.env" ]]; then
        OVERLAY_DIR="$gate_overlay" FULL_SCREEN_GATE_DEFER_ACCEPT=true \
        FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
        FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
        FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
          bash ops/scripts/resonance-full-screen-deploy-gate.sh finalize-success \
          || {
            write_postdeploy_promotion_quarantine 'PROMOTED_SNAPSHOT_DISARM_FAILED' || true
            echo '[auto-deploy] FAIL promoted runtime snapshot could not be disarmed' >&2
            return 79
          }
      fi
      runtime_marker="$(tr -d '[:space:]' 2>/dev/null <"$RUNTIME_DEPLOY_STATE_FILE" || true)"
      if [[ "$runtime_marker" != "$target_commit" ]]; then
        # The promoter's mv can fail after COMMIT. Retry the derived marker
        # with the shared exact-target writer in the same process first.
        if write_runtime_deploy_state "$target_commit"; then
          runtime_marker="$target_commit"
          echo "[auto-deploy] reconciled runtime marker after committed promoter fault status=$promoter_status"
        else
          if ! write_postdeploy_marker_pending 'DB_PROMOTED_RUNTIME_MARKER_PENDING'; then
            write_postdeploy_promotion_quarantine 'MARKER_PENDING_STATE_WRITE_FAILED' || true
            echo '[auto-deploy] FAIL DB promotion committed but marker-pending state could not be persisted' >&2
            return 79
          fi
          echo "[auto-deploy] MARKER_PENDING DB promotion committed; next preflight will reconcile runtime marker promoterStatus=$promoter_status" >&2
          return 75
        fi
      fi
      if ! write_applied_deploy_state "$target_commit"; then
        write_postdeploy_marker_pending 'DB_PROMOTED_APPLIED_MARKER_PENDING' \
          || write_postdeploy_promotion_quarantine 'MARKER_PENDING_STATE_WRITE_FAILED' || true
        echo '[auto-deploy] MARKER_PENDING runtime promotion is current; retry will reconcile applied marker' >&2
        return 75
      fi
      applied_marker="$(tr -d '[:space:]' 2>/dev/null <"$DEPLOY_STATE_FILE" || true)"
      [[ "$applied_marker" == "$target_commit" ]] || {
        write_postdeploy_marker_pending 'DB_PROMOTED_APPLIED_MARKER_PENDING' || true
        return 75
      }
      runtime_deployed_commit="$target_commit"
      clear_postdeploy_marker_pending || true
      ;;
    1)
      postdeploy_candidate_promoted=false
      if (( promoter_status != 0 )); then return "$promoter_status"; fi
      echo '[auto-deploy] FAIL promoter returned success without an authoritative DB promotion' >&2
      return 1
      ;;
    *)
      postdeploy_candidate_authority_unknown=true
      write_postdeploy_promotion_quarantine 'PROMOTION_DB_CHECK_UNAVAILABLE' \
        || echo '[auto-deploy] FAIL unable to persist promotion DB-check quarantine' >&2
      echo '[auto-deploy] FAIL promotion DB check unavailable; marker ignored and release quarantined' >&2
      return 79
      ;;
  esac
  if [[ -s "$FULL_SCREEN_GATE_STATE_DIR/active.env" ]]; then
    OVERLAY_DIR="$gate_overlay" FULL_SCREEN_GATE_DEFER_ACCEPT=true \
    FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID="$snapshot_id" \
    FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256="$snapshot_manifest" \
    FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT="$baseline" \
      bash ops/scripts/resonance-full-screen-deploy-gate.sh finalize-success \
      || echo '[auto-deploy] WARN promoted release retained its rollback snapshot for later cleanup' >&2
  fi
  if [[ "${runtime_candidate_checkpoint_eligible:-false}" == "true" \
     && -s "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" ]]; then
    run_runtime_candidate_checkpoint clear-success || {
      write_postdeploy_promotion_quarantine 'PROMOTED_CHECKPOINT_CLEAR_FAILED' || true
      return 79
    }
  fi
  archive_postdeploy_attempt_journal_terminal "$attempt_terminal_status" || {
    write_postdeploy_promotion_quarantine 'PROMOTED_ATTEMPT_JOURNAL_ARCHIVE_FAILED' || true
    return 79
  }
}

launch_composite_autocompletion_postdeploy_campaign() {
  local candidate_hash unit_name
  [[ "$target_commit" =~ ^[0-9a-f]{40}$ \
     && "$postdeploy_candidate_id" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] || {
    echo '[auto-deploy] WARN asynchronous composite campaign identity is invalid' >&2
    return 0
  }
  candidate_hash="$(printf '%s' "$postdeploy_candidate_id" | sha256sum | awk '{print $1}')" || {
    echo '[auto-deploy] WARN asynchronous composite campaign hash unavailable' >&2
    return 0
  }
  unit_name="resonance-composite-autocompletion-${target_commit:0:12}-${candidate_hash:0:12}"
  if systemctl is-active --quiet "$unit_name.service"; then
    echo "[auto-deploy] asynchronous composite campaign already active: $unit_name"
    return 0
  fi
  if ! sudo -n systemd-run --quiet --collect --unit "$unit_name" \
      --uid=sjkim --gid=sjkim --property=Type=oneshot --property=TimeoutStartSec=930 \
      --property=Restart=on-failure --property=RestartSec=15s \
      --property=StartLimitIntervalSec=1800 --property=StartLimitBurst=120 \
      /usr/bin/env RESONANCE_ROOT="$ROOT_DIR" \
        CARBONET_POSTDEPLOY_CANDIDATE_ID="$postdeploy_candidate_id" \
        CARBONET_COMPOSITE_EXPECTED_RUNTIME_COMMIT="$target_commit" \
        CARBONET_COMPOSITE_CAMPAIGN_TIMEOUT_SECONDS=720 \
        CARBONET_COMPOSITE_CAMPAIGN_POLL_SECONDS=5 \
        /usr/bin/bash "$ROOT_DIR/ops/scripts/prepare-composite-autocompletion-postdeploy.sh" \
          campaign; then
    # The release is already authoritative and the database gate remains
    # disabled. Surface delivery failure without turning an optional campaign
    # into a second deployment critical path.
    echo "[auto-deploy] WARN asynchronous composite campaign launch failed: $unit_name" >&2
    return 0
  fi
  echo "[auto-deploy] asynchronous composite campaign queued: $unit_name timeout=720s"
}

finalize_postdeploy_candidate_release_with_composite_gate_cleanup() {
  local finalize_status=0
  if finalize_postdeploy_candidate_release; then
    if [[ "${composite_autocompletion_gate_prepared:-false}" != true ]]; then
      launch_composite_autocompletion_postdeploy_campaign
      return 0
    elif CARBONET_POSTDEPLOY_CANDIDATE_ID="$postdeploy_candidate_id" RESONANCE_ROOT="$ROOT_DIR" \
        bash ops/scripts/prepare-composite-autocompletion-postdeploy.sh activate; then
      composite_autocompletion_gate_prepared=false
      return 0
    fi
    finalize_status=79
  else
    finalize_status=$?
  fi
  # PREPARED is never executable. Any finalizer or activation failure revokes
  # the independent DB gate, so the failed release starts zero bulk work.
  CARBONET_POSTDEPLOY_CANDIDATE_ID="$postdeploy_candidate_id" RESONANCE_ROOT="$ROOT_DIR" \
    bash ops/scripts/prepare-composite-autocompletion-postdeploy.sh revoke-prepared \
      >/dev/null 2>&1 || true
  sudo -n systemctl disable --now resonance-composite-live-smoke.timer >/dev/null 2>&1 || true
  return "$finalize_status"
}

# Recovery executes immediately after the required functions and DB leader are
# available, before catalog branching, pg_dump, checkpoint work or builds.
persistent_attempt_recovery_status=1
if recover_persistent_postdeploy_attempt; then
  persistent_attempt_recovery_status=0
else
  persistent_attempt_recovery_status=$?
fi
case "$persistent_attempt_recovery_status" in
  0) record_deploy_phase "persistent_attempt_rollback_recovery" ;;
  1)
    orphan_retire_status=1
    if retire_orphan_versioned_snapshot; then orphan_retire_status=0; else orphan_retire_status=$?; fi
    case "$orphan_retire_status" in
      0) record_deploy_phase "orphan_versioned_snapshot_retired" ;;
      1) ;;
      *) exit "$orphan_retire_status" ;;
    esac
    legacy_retire_status=1
    if [[ "$orphan_retire_status" != 0 ]]; then
      legacy_resolve_status=1
      if resolve_legacy_full_screen_gate_state_dir; then legacy_resolve_status=0; else legacy_resolve_status=$?; fi
      case "$legacy_resolve_status" in
        0) if retire_legacy_partial_runtime_attempt; then legacy_retire_status=0; else legacy_retire_status=$?; fi ;;
        1) ;;
        *) legacy_retire_status="$legacy_resolve_status" ;;
      esac
    fi
    case "$legacy_retire_status" in
      0) record_deploy_phase "legacy_partial_attempt_retired" ;;
      1) ;;
      *) exit "$legacy_retire_status" ;;
    esac
    if [[ "$legacy_false_discovery_quarantine_deferred" == true ]]; then
      legacy_quarantine_retired="$POSTDEPLOY_LEGACY_RETIRE_DIR/${legacy_false_discovery_quarantine_candidate}.legacy-false-discovery-quarantine.state"
      [[ "$legacy_retire_status" == 0 \
         && ! -e "$RUNTIME_LEDGER_QUARANTINE_FILE" && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" \
         && -f "$legacy_quarantine_retired" && ! -L "$legacy_quarantine_retired" \
         && "$(stat -c '%a' "$legacy_quarantine_retired" 2>/dev/null)" == 600 \
         && "$(stat -c '%u' "$legacy_quarantine_retired" 2>/dev/null)" == "$(id -u)" \
         && "$(sha256sum "$legacy_quarantine_retired" | awk '{print $1}')" == "$legacy_false_discovery_quarantine_hash" ]] || {
        echo '[auto-deploy] BLOCKED deferred legacy false-discovery quarantine was not retired with its exact evidence pair' >&2
        exit 79
      }
    fi
    ;;
  2) ;;
  *) exit "$persistent_attempt_recovery_status" ;;
esac

postdeploy_pending_recovery_status=1
postdeploy_recovered_commit=""
if recover_authoritative_postdeploy_marker_pending; then
  postdeploy_pending_recovery_status=0
else
  postdeploy_pending_recovery_status=$?
fi
case "$postdeploy_pending_recovery_status" in
  0)
    record_deploy_phase "postdeploy_marker_reconcile"
    recovered_attempt_json=""
    recovered_attempt_candidate=""
    recovered_attempt_source="$postdeploy_recovered_commit"
    if [[ -s "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]]; then
      recovered_attempt_json="$(python3 "$POSTDEPLOY_JOURNAL_HELPER" \
        --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read)" || exit 79
      recovered_attempt_candidate="$(jq -r '.candidateId' <<<"$recovered_attempt_json")"
      recovered_attempt_source="$(jq -r '.sourceCommit' <<<"$recovered_attempt_json")"
    fi
    # The checkpoint belongs to promoted A, regardless of a newer desired B.
    # Clear it while A's exact journal is still the recovery anchor.
    if [[ -s "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" && -f "$POSTDEPLOY_CHECKPOINT_SCRIPT" ]]; then
      CARBONET_RUNTIME_CANDIDATE_CHECKPOINT_FILE="$RUNTIME_CANDIDATE_CHECKPOINT_FILE" \
      CARBONET_CHECKPOINT_TARGET_COMMIT="$recovered_attempt_source" \
        bash "$POSTDEPLOY_CHECKPOINT_SCRIPT" clear-success || {
          write_postdeploy_promotion_quarantine 'RECOVERED_CHECKPOINT_DISARM_FAILED' || true
          exit 79
        }
    fi
    [[ -z "$recovered_attempt_candidate" ]] \
      || retire_matching_runtime_quarantine "$recovered_attempt_candidate" "$recovered_attempt_source" || exit 79
    archive_recovered_promoted_attempt_journal || {
      write_postdeploy_promotion_quarantine 'RECOVERED_PROMOTED_JOURNAL_ARCHIVE_FAILED' || true
      exit 79
    }
    if [[ "$postdeploy_recovered_commit" == "$target_commit" ]]; then
      record_deploy_performance recovery || echo '[auto-deploy] WARN recovery performance telemetry failed' >&2
      rm -f -- "$DEPLOY_PHASE_FILE" "${CARBONET_DEPLOY_SNAPSHOT_PATH:-}" || true
      if [[ "$early_composite_gate_status" == PREPARED ]]; then
        [[ "$early_composite_gate_candidate" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] || {
          echo '[auto-deploy] BLOCKED recovered runtime has an invalid PREPARED composite candidate' >&2
          exit 79
        }
        echo "[auto-deploy] recovered promoted runtime; activating exact PREPARED composite gate: $target_commit" || true
        CARBONET_POSTDEPLOY_CANDIDATE_ID="$early_composite_gate_candidate" \
          RESONANCE_ROOT="$ROOT_DIR" \
          bash "$ROOT_DIR/ops/scripts/prepare-composite-autocompletion-postdeploy.sh" activate
        exit 0
      fi
      echo "[auto-deploy] recovered already promoted runtime without rebuild: $target_commit" || true
      exit 0
    fi
    # Remote B may arrive after promoted A committed but before its derived
    # markers. Reconcile A, then re-plan A..B so a helper-only B remains build0.
    eval "$(bash "$PLAN_SCRIPT" "$postdeploy_recovered_commit" "$target_commit" --format env)"
    PLAN_BACKSTAGE_REQUIRED="${PLAN_BACKSTAGE_REQUIRED:-false}"
    record_deploy_phase "incremental_replan_after_marker_reconcile"
    echo "[auto-deploy] recovered promoted ancestor=$postdeploy_recovered_commit; re-planned target=$target_commit runtime=$PLAN_RUNTIME_REQUIRED frontend=$PLAN_FRONTEND_REQUIRED backend=$PLAN_BACKEND_REQUIRED database=$PLAN_DATABASE_REQUIRED"
    ;;
  1)
    if [[ "$no_change_candidate" == true ]]; then
      if [[ "$early_composite_gate_status" == PREPARED \
         && "$early_composite_gate_candidate" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] \
         && CARBONET_POSTDEPLOY_CANDIDATE_ID="$early_composite_gate_candidate" \
              RESONANCE_ROOT="$ROOT_DIR" \
              bash "$ROOT_DIR/ops/scripts/prepare-composite-autocompletion-postdeploy.sh" \
                activate; then
        record_deploy_performance recovery || true
        rm -f -- "$DEPLOY_PHASE_FILE" "${CARBONET_DEPLOY_SNAPSHOT_PATH:-}" || true
        echo "[auto-deploy] recovered exact PREPARED composite gate without rollout: $target_commit" || true
        exit 0
      fi
      write_postdeploy_promotion_quarantine 'NO_CHANGE_RUNTIME_AUTHORITY_UNPROVEN' || true
      echo '[auto-deploy] BLOCKED no-change runtime identity could not be proven or recovered' >&2
      exit 79
    fi
    ;;
  *) exit "$postdeploy_pending_recovery_status" ;;
esac

if [[ "${CARBONET_RECOVERY_ONLY:-false}" == true ]]; then
  [[ ! -e "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" && ! -L "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" \
     && ! -e "$POSTDEPLOY_MARKER_PENDING_FILE" && ! -L "$POSTDEPLOY_MARKER_PENDING_FILE" \
     && ! -e "$RUNTIME_LEDGER_QUARANTINE_FILE" && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" ]] || {
    write_postdeploy_promotion_quarantine 'RECOVERY_ONLY_OBLIGATION_REMAINS' || true
    exit 79
  }
  record_deploy_performance recovery || true
  rm -f -- "$DEPLOY_PHASE_FILE" "${CARBONET_DEPLOY_SNAPSHOT_PATH:-}"
  echo '[auto-deploy] recovery-only obligations completed; maintenance hold did not authorize a new deployment'
  exit 0
fi

# Identity-design changes are evaluated only after a previously committed live
# release has been recovered and A..B re-planned.  This prevents a newer remote
# B from trapping promoted A behind a pre-recovery exit while retaining the
# mutation-before-state-write block for the actual plan being executed.
if [[ ",${PLAN_TESTS:-}," == *",runtime:identity-staged-reconcile-required,"* ]]; then
  echo '[auto-deploy] BLOCKED before mutation: identity design changed without staged reconcile and rollback' >&2
  exit 78
fi

# Documentation, design metadata, catalog and automation-only changes do not
# alter the running application. Fast-forward and refresh the searchable source
# catalog without an unnecessary DB dump, JVM build, image build or rollout.
if [[ "$PLAN_RUNTIME_REQUIRED" != "true" ]]; then
  git merge --ff-only "$target_commit"
  run_postdeploy_candidate_static_contract_if_required
  run_operational_usage_ledger_static_contract_if_required
  mapfile -t deploy_changed_paths < <(
    git diff --name-only --diff-filter=ACMRD "$deployed_commit" "$target_commit"
  )
  sync_auto_deploy_failure_runtime_if_required
  control_plane_drift_marker="$ROOT_DIR/var/run/control-plane-drift-last"
  printf -v control_plane_drift_now '%(%s)T' -1
  control_plane_drift_last=0
  if [[ -f "$control_plane_drift_marker" ]]; then
    read -r control_plane_drift_last <"$control_plane_drift_marker" || true
  fi
  if [[ "$control_plane_drift_last" =~ ^[0-9]+$ ]] &&
    (( control_plane_drift_now - control_plane_drift_last < 300 )); then
    control_plane_drift_check_due=false
  fi
  restore_live_frontend_overlay
  sync_react_asset_prune_worker_if_required
  sync_process_contract_audit_if_required
  while IFS= read -r changed_script; do
    [[ "$changed_script" == *.sh && -f "$changed_script" ]] && bash -n "$changed_script"
  done < <(printf '%s\n' "${deploy_changed_paths[@]}")
  if deploy_path_changed \
      ops/scripts/select-catalog-contract-tests.sh \
      ops/scripts/test-select-catalog-contract-tests.sh; then
    bash ops/scripts/test-select-catalog-contract-tests.sh
  else
    echo "[auto-deploy] catalog contract selector self-test skipped: selector unchanged"
  fi
  # Selection is intentionally unconditional and cheap. Keeping it outside the
  # control-plane synchronization allowlist prevents a newly mapped identity
  # producer or test from silently selecting zero contracts on a static-only
  # plan; only a nonempty selection launches parallel work.
  mapfile -t catalog_contract_tests < <(
    printf '%s\n' "${deploy_changed_paths[@]}" |
      bash ops/scripts/select-catalog-contract-tests.sh --paths-stdin
  )
  if (( ${#catalog_contract_tests[@]} > 0 )); then
    run_parallel_contract_tests "${catalog_contract_tests[@]}"
  else
    echo "[auto-deploy] catalog contract tests skipped: no mapped contract impact"
  fi
  if deploy_path_changed \
      ops/scripts/auto-deploy-main.sh \
      ops/scripts/auto-deploy-main-launcher.sh \
      ops/tests/test-auto-deploy-bootstrap-helper-snapshot.sh \
      ops/scripts/select-catalog-contract-tests.sh \
      ops/scripts/test-select-catalog-contract-tests.sh \
      ops/scripts/sync-unified-asset-catalog.sh \
      ops/scripts/test-atomic-asset-e4b-validation.sh \
      ops/scripts/test-catalog-identity-parallel-deploy.sh \
      ops/scripts/test-catalog-overlay-fast-path.sh \
      ops/scripts/test-no-change-preflight-fast-path.sh \
      ops/scripts/resonance-k8s-build-deploy-80-v2.sh \
      ops/scripts/runtime-candidate-checkpoint.sh \
      ops/scripts/test-runtime-candidate-checkpoint.sh \
      ops/scripts/test-candidate-release-rollout-gate.sh \
      ops/scripts/test-database-plan-flyway-gate.sh \
      ops/scripts/run-flyway-migration-job.sh \
      ops/tests/test-flyway-job-timeout-contract.sh \
      apps/carbonet-api/src/main/java/egovframework/com/migration/FlywayMigrationApplication.java \
      ops/scripts/run-process-development-worker.sh \
      ops/scripts/run-process-development-dispatcher.sh \
      ops/scripts/test-process-worker-deploy-marker.sh \
      ops/scripts/run-project-auto-completion-orchestrator.sh \
      ops/scripts/run-next-current-business-e2e.sh \
      ops/runtime-metadata/business-e2e-runner-registry.json \
      ops/scripts/configure-patroni-memory-safety.sh \
      ops/tests/test-patroni-memory-safety.sh \
      ops/scripts/resonance-all-process-contract-audit.sh \
      ops/scripts/resonance-all-process-contract-audit.mjs \
      ops/scripts/run-all-process-contract-audit-hourly.sh \
      ops/scripts/install-all-process-contract-audit.sh \
      ops/tests/test-all-process-contract-audit.sh \
      ops/tests/test-all-process-contract-audit-scheduler.sh \
      ops/scripts/test-frontend-parallel-build-pipeline.sh \
      ops/scripts/install-resonance-github-runner.sh \
      ops/scripts/install-resonance-github-deploy-webhook.sh \
      ops/scripts/apply-backup-cronjobs.sh \
      ops/scripts/reconcile-post-reboot-runtime.sh \
      ops/scripts/test-post-reboot-runtime-recovery.sh \
      ops/scripts/postgres-storage-guard.sh \
      ops/scripts/test-postgres-storage-guard-install.sh \
      ops/scripts/carbonet-auto-deploy-failure-handler.sh \
      ops/scripts/check-postdeploy-authoritative-promotion.sh \
      ops/scripts/carbonet-deploy-notify.sh \
      ops/scripts/test-auto-deploy-failure-handler.sh \
      ops/scripts/patroni-auto-heal.sh \
      ops/scripts/test-patroni-auto-heal-safety.sh \
      ops/scripts/postgres-isolated-restore-drill.sh \
      ops/scripts/report-latest-postgres-restore-drill.sh \
      ops/scripts/test-postgres-isolated-restore-drill.sh \
      ops/scripts/resonance-github-deploy-webhook.py \
      ops/scripts/sync-github-deploy-webhook-url.py \
      ops/scripts/test-github-deploy-webhook.sh \
      ops/scripts/test-push-deploy-dispatch.sh \
      ops/systemd/carbonet-auto-deploy.timer \
      ops/systemd/carbonet-auto-deploy.service \
      ops/systemd/carbonet-auto-deploy-failure-handler.service \
      ops/systemd/carbonet-github-deploy-webhook.service \
      ops/systemd/carbonet-github-webhook-reconcile.service \
      ops/systemd/carbonet-github-webhook-reconcile.timer \
      ops/systemd/carbonet-post-reboot-recovery.service \
      ops/systemd/postgres-storage-guard.service \
      ops/systemd/postgres-storage-guard.timer \
      ops/systemd/carbonet-patroni-auto-heal.service \
      ops/systemd/carbonet-patroni-auto-heal.timer \
      ops/systemd/carbonet-postgres-restore-drill.service \
      ops/systemd/carbonet-postgres-restore-drill.timer \
      ops/systemd/resonance-process-development-worker.service \
      ops/systemd/resonance-process-development-worker.timer \
      ops/systemd/resonance-project-auto-completion.service \
      ops/systemd/resonance-project-auto-completion.timer \
      ops/systemd/resonance-all-process-contract-audit.service \
      ops/systemd/resonance-all-process-contract-audit.timer \
      ops/scripts/resonance-backstage-full-e2e.sh \
      ops/systemd/resonance-backstage-full-e2e.service \
      ops/systemd/resonance-backstage-full-e2e.timer \
      ops/kubernetes/postgres-haproxy-config.yaml \
      .github/workflows/carbonet-push-deploy.yml; then
    if deploy_path_changed \
        ops/scripts/resonance-github-deploy-webhook.py \
        ops/scripts/sync-github-deploy-webhook-url.py \
        ops/systemd/carbonet-github-deploy-webhook.service \
        ops/systemd/carbonet-github-webhook-reconcile.service \
        ops/systemd/carbonet-github-webhook-reconcile.timer; then
      sudo -n install -m 0750 -o root -g root \
        ops/scripts/resonance-github-deploy-webhook.py \
        /opt/resonance-data/control-plane/bin/resonance-github-deploy-webhook.py
      sudo -n install -m 0644 \
        ops/systemd/carbonet-github-deploy-webhook.service \
        /etc/systemd/system/carbonet-github-deploy-webhook.service
      sudo -n install -m 0750 -o sjkim -g sjkim \
        ops/scripts/sync-github-deploy-webhook-url.py \
        /opt/resonance-data/control-plane/bin/sync-github-deploy-webhook-url.py
      sudo -n install -m 0644 \
        ops/systemd/carbonet-github-webhook-reconcile.service \
        /etc/systemd/system/carbonet-github-webhook-reconcile.service
      sudo -n install -m 0644 \
        ops/systemd/carbonet-github-webhook-reconcile.timer \
        /etc/systemd/system/carbonet-github-webhook-reconcile.timer
      sudo -n systemctl daemon-reload
      sudo -n systemctl restart carbonet-github-deploy-webhook.service
      sudo -n systemctl enable --now \
        carbonet-github-webhook-reconcile.timer >/dev/null
      if ! python3 \
          /opt/resonance-data/control-plane/bin/sync-github-deploy-webhook-url.py; then
        echo "[auto-deploy] warning: webhook URL reconciliation deferred to timer" >&2
      fi
      echo "[auto-deploy] GitHub webhook runtime synchronized"
    fi
    sync_postgres_backup_cronjobs_if_required
    sync_post_reboot_recovery_if_required
    sync_patroni_auto_heal_if_required
    sync_postgres_restore_drill_if_required
    sync_process_development_worker_if_required
    if [[ "$control_plane_drift_check_due" == "true" && "$patroni_memory_check_deferred" != "true" ]]; then
      mkdir -p "$(dirname "$control_plane_drift_marker")"
      printf '%s\n' "$control_plane_drift_now" >"$control_plane_drift_marker"
      echo "[auto-deploy] periodic control-plane drift check completed"
    elif [[ "$patroni_memory_check_deferred" == "true" ]]; then
      echo "[auto-deploy] periodic control-plane drift marker withheld; Patroni check will retry" >&2
    else
      echo "[auto-deploy] control-plane drift check skipped: verified within 5 minutes"
    fi
    if deploy_path_changed \
        ops/scripts/postgres-storage-guard.sh \
        ops/scripts/test-postgres-storage-guard-install.sh \
        ops/systemd/postgres-storage-guard.service \
        ops/systemd/postgres-storage-guard.timer; then
      bash ops/scripts/test-postgres-storage-guard-install.sh
      sudo -n install -d -m 0755 -o root -g root \
        /opt/resonance-data/control-plane/bin
      sudo -n install -m 0750 -o root -g root \
        ops/scripts/postgres-storage-guard.sh \
        /opt/resonance-data/control-plane/bin/postgres-storage-guard.sh
      sudo -n install -m 0644 ops/systemd/postgres-storage-guard.service \
        /etc/systemd/system/postgres-storage-guard.service
      sudo -n install -m 0644 ops/systemd/postgres-storage-guard.timer \
        /etc/systemd/system/postgres-storage-guard.timer
      sudo -n systemctl daemon-reload
      sudo -n systemctl enable --now postgres-storage-guard.timer >/dev/null
      sudo -n systemctl restart postgres-storage-guard.service
      echo "[auto-deploy] PostgreSQL storage guard runtime synchronized"
    fi
    if deploy_path_changed \
        ops/scripts/resonance-backstage-full-e2e.sh \
        ops/systemd/resonance-backstage-full-e2e.service \
        ops/systemd/resonance-backstage-full-e2e.timer; then
      sudo -n install -m 0750 -o sjkim -g sjkim \
        ops/scripts/resonance-backstage-full-e2e.sh \
        /opt/resonance-data/control-plane/bin/resonance-backstage-full-e2e.sh
      sudo -n install -m 0644 ops/systemd/resonance-backstage-full-e2e.service \
        /etc/systemd/system/resonance-backstage-full-e2e.service
      sudo -n install -m 0644 ops/systemd/resonance-backstage-full-e2e.timer \
        /etc/systemd/system/resonance-backstage-full-e2e.timer
      sudo -n systemctl daemon-reload
      sudo -n systemctl enable --now resonance-backstage-full-e2e.timer >/dev/null
      echo "[auto-deploy] nightly full Backstage E2E synchronized"
    fi
  fi
  backstage_only_change=false
  if [[ "$PLAN_BACKSTAGE_REQUIRED" == "true" ]] &&
    ! git diff --name-only "$deployed_commit" "$target_commit" |
      grep -Ev '^(platform/control-plane/backstage/|deploy/k8s/control-plane/backstage\.yaml$|ops/scripts/(resonance-backstage-deploy|test-backstage-fast-deploy-policy)\.sh$)' |
      grep -q .; then
    backstage_only_change=true
  fi
  if [[ "$backstage_only_change" == "true" ]]; then
    echo "[auto-deploy] Backstage-only change: synchronizing source assets without an application rollout"
  fi
  record_deploy_phase "catalog_validation"
  # Identity reconciliation and source-catalog indexing read independent
  # systems. Run them concurrently, then join fail-closed before role E2E and
  # the success marker. This removes the longest sequential tail without
  # weakening either contract.
  catalog_identity_sync_log="$ROOT_DIR/var/logs/catalog-identity-sync-${target_commit:0:10}.log"
  (
    sync_keycloak_actor_assignments_if_required
  ) >"$catalog_identity_sync_log" 2>&1 &
  catalog_identity_sync_pid="$!"
  echo "[auto-deploy] identity reconciliation running concurrently pid=$catalog_identity_sync_pid"
  # A visual-E2E-only change cannot alter the running Backstage image. Start
  # its full browser regression beside catalog/identity synchronization and
  # join all gates before advancing the deploy marker. Runtime/image changes
  # intentionally keep the later post-rollout start so E2E sees the candidate.
  if [[ "$PLAN_BACKSTAGE_REQUIRED" != "true" \
     && ",$PLAN_TESTS," == *",backstage:visual-e2e,"* ]]; then
    start_backstage_visual_e2e
    echo "[auto-deploy] test-only visual E2E started concurrently with catalog synchronization"
  fi
  bash ops/scripts/sync-unified-asset-catalog.sh "$deployed_commit" "$target_commit"
  sync_backstage_catalog_if_required
  record_deploy_phase "catalog_sync"
  deploy_backstage_if_required
  record_deploy_phase "backstage_build_rollout"
  CARBONET_SCREEN_CONTRACT_PREVIEW_ONLY=1 run_screen_contract_runtime_save_gate_if_required
  if [[ -z "$backstage_visual_e2e_pid" ]]; then
    start_backstage_visual_e2e
  fi
  if wait "$catalog_identity_sync_pid"; then
    cat "$catalog_identity_sync_log"
    catalog_identity_sync_pid=""
  else
    echo "[auto-deploy] refusing success marker: concurrent identity reconciliation failed" >&2
    cat "$catalog_identity_sync_log" >&2
    exit 25
  fi
  record_deploy_phase "identity_reconcile"
  run_actor_process_role_e2e_if_required
  record_deploy_phase "actor_role_e2e"
  wait_backstage_visual_e2e
  record_deploy_phase "backstage_visual_e2e"
  run_operational_usage_ledger_current_runtime_e2e_if_required "$runtime_deployed_commit"
  write_applied_deploy_state "$target_commit"
  if [[ "$PLAN_BACKSTAGE_REQUIRED" == "true" ]]; then
    record_deploy_performance backstage || echo '[auto-deploy] WARN backstage performance telemetry failed' >&2
  else
    record_deploy_performance catalog || echo '[auto-deploy] WARN catalog performance telemetry failed' >&2
  fi
  echo "[auto-deploy] catalog-only update completed without application rollout: $target_commit"
  exit 0
fi

# A failed post-deploy gate must not rebuild or roll out the exact candidate a
# second time. Resume only when the durable checkpoint and every live identity,
# readiness, asset, rollback and migration proof still match. Any mismatch is
# fail-closed: replace the checkpoint with PREPARED and execute the normal path.
runtime_candidate_checkpoint_eligible=true
if [[ "$PLAN_FRONTEND_REQUIRED" == "true" \
   && "$PLAN_BACKEND_REQUIRED" != "true" \
   && "$PLAN_DATABASE_REQUIRED" != "true" ]]; then
  runtime_candidate_checkpoint_eligible=false
elif [[ "$PLAN_RUNTIME_REQUIRED" == "true" \
     && "$PLAN_FRONTEND_REQUIRED" != "true" \
     && "$PLAN_BACKEND_REQUIRED" != "true" \
     && "$PLAN_DATABASE_REQUIRED" != "true" \
     && ",$PLAN_TESTS," == *",runtime:startup-profile,"* ]]; then
  runtime_candidate_checkpoint_eligible=false
elif [[ "$PLAN_FRONTEND_REQUIRED" != "true" \
     && "$PLAN_BACKEND_REQUIRED" != "true" \
     && "$PLAN_DATABASE_REQUIRED" != "true" \
     && "$PLAN_INFRASTRUCTURE_REQUIRED" == "true" ]]; then
  runtime_candidate_checkpoint_eligible=false
fi

runtime_candidate_resume=false
if [[ "$runtime_candidate_checkpoint_eligible" == "true" ]]; then
  if run_runtime_candidate_checkpoint verify; then
    runtime_candidate_resume=true
    echo "[auto-deploy] exact runtime candidate verified; resuming at post-deploy gates"
  else
    echo "[auto-deploy] no reusable runtime candidate; executing guarded build and rollout"
    run_runtime_candidate_checkpoint prepare
  fi
fi

if [[ "$runtime_candidate_resume" != "true" ]]; then
timestamp="$(date '+%Y%m%d-%H%M%S')"
backup_file="$BACKUP_DIR/carbonet-$timestamp-$current_commit.sql.gz"
roles_backup_file="$BACKUP_DIR/postgres-roles-$timestamp-$current_commit.sql.gz"
backup_required="$PLAN_DATABASE_REQUIRED"
[[ "${CARBONET_FORCE_PREDEPLOY_BACKUP:-false}" == "true" ]] && backup_required=true
menu_backup_only=false
governance_backup_only=false
activity_backup_only=false
identity_backup_only=false
schema_backup_only=false
if [[ "$PLAN_DATABASE_REQUIRED" == "true" && "${CARBONET_FORCE_PREDEPLOY_BACKUP:-false}" != "true" ]]; then
  database_change_files="$(git diff --name-only "$deployed_commit" "$target_commit" -- \
    apps/carbonet-api/src/main/resources/db/migration/postgresql)"
  backup_scope="$(printf '%s\n' "$database_change_files" | bash ops/scripts/classify-db-backup-scope.sh)"
  [[ "$backup_scope" == "menu" ]] && menu_backup_only=true
  [[ "$backup_scope" == "governance" ]] && governance_backup_only=true
  [[ "$backup_scope" == "activity" ]] && activity_backup_only=true
  [[ "$backup_scope" == "identity" ]] && identity_backup_only=true
  database_change_statuses="$(git diff --name-status "$deployed_commit" "$target_commit" -- \
    apps/carbonet-api/src/main/resources/db/migration/postgresql)"
  if [[ -n "$database_change_files" ]] \
    && ! grep -Ev '^A[[:space:]]' <<<"$database_change_statuses" | grep -q . \
    && python3 ops/scripts/classify-safe-additive-ddl.py --schema-reversible $database_change_files; then
    schema_backup_only=true
    menu_backup_only=false
    governance_backup_only=false
    activity_backup_only=false
    identity_backup_only=false
    backup_scope="safe-additive-schema"
  fi
  echo "[auto-deploy] database backup scope: $backup_scope"
fi
if [[ "$backup_required" == "true" ]]; then
  backup_previous_umask="$(umask)"
  umask 077
  backup_cleanup_required=true
  # A disconnected kubectl/pg_dump pipeline can survive the systemd process
  # and retain ACCESS SHARE locks indefinitely. Reap only deploy-owned
  # sessions immediately before a backup-capable deployment; catalog and
  # frontend-only work must not pay two unnecessary PostgreSQL round trips.
  kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -q -At \
    -c "select pg_terminate_backend(pid) from pg_stat_activity where application_name like 'carbonet-auto-deploy-%' and application_name<>'$backup_application_name' and coalesce(xact_start,query_start,backend_start) < current_timestamp - interval '5 minutes' and pid<>pg_backend_pid()" \
    >/dev/null 2>&1 || true
  if [[ "$schema_backup_only" == "true" ]]; then
    backup_file="$BACKUP_DIR/carbonet-schema-$timestamp-$current_commit.tar"
    backup_partial_file="$(arm_private_backup_partial "$backup_file")" || {
      echo "[auto-deploy] refusing unsafe schema backup partial path" >&2; exit 11; }
    schema_backup_dir="$(mktemp -d "$BACKUP_DIR/.schema-backup.XXXXXX")"
    source_restore_counts="$(kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      psql -U "$POSTGRES_USER" -h 127.0.0.1 -d "$POSTGRES_DB" -X -q -At -F $'\t' \
        -v ON_ERROR_STOP=1 -c "select \
          (select count(*) from carbonet_flyway_schema_history), \
          (select count(*) from pg_class where relnamespace not in \
            (select oid from pg_namespace where nspname like 'pg_%' or nspname='information_schema'))" \
      2>/dev/null)" || {
      echo "[auto-deploy] refusing deployment: source restore counts unavailable" >&2
      exit 18
    }
    IFS=$'\t' read -r expected_history_count expected_schema_object_count <<<"$source_restore_counts"
    [[ "$expected_history_count" =~ ^[1-9][0-9]*$ && "$expected_schema_object_count" =~ ^[1-9][0-9]*$ ]] || {
      echo "[auto-deploy] refusing deployment: source restore counts invalid" >&2; exit 18; }
    echo "[auto-deploy] safe additive DDL detected; creating schema and Flyway-history backup"
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
        kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
          env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
          pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
            --schema-only --no-owner --no-privileges -h 127.0.0.1 \
        > "$schema_backup_dir/schema.dump"; then
      echo "[auto-deploy] refusing deployment: schema backup failed" >&2
      exit 14
    fi
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
      kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
          --data-only --no-owner --no-privileges -h 127.0.0.1 \
          -t carbonet_flyway_schema_history > "$schema_backup_dir/flyway-history.dump"; then
      echo "[auto-deploy] refusing deployment: Flyway-history backup failed" >&2
      exit 14
    fi
    git diff --name-status "$deployed_commit" "$target_commit" -- \
      apps/carbonet-api/src/main/resources/db/migration/postgresql \
      > "$schema_backup_dir/migrations.manifest"
    git diff "$deployed_commit" "$target_commit" -- \
      apps/carbonet-api/src/main/resources/db/migration/postgresql \
      > "$schema_backup_dir/migrations.patch"
    for archive in schema.dump flyway-history.dump; do
      if [[ "$(stat -c %s "$schema_backup_dir/$archive")" -lt 512 ]] \
        || ! kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
          pg_restore --list < "$schema_backup_dir/$archive" >/dev/null; then
        echo "[auto-deploy] refusing deployment: $archive restore catalog is invalid" >&2
        exit 18
      fi
    done
    schema_restore_database_name="carbonet_schema_verify_${timestamp//-/_}_$$"
    local_restore_rc=0
    verify_schema_backup_restore_locally \
      "$schema_backup_dir/schema.dump" "$schema_backup_dir/flyway-history.dump" \
      "$expected_history_count" "$expected_schema_object_count" || local_restore_rc=$?
    if (( local_restore_rc == 79 )); then
      echo "[auto-deploy] refusing deployment: local schema restore container cleanup failed" >&2
      exit 19
    elif (( local_restore_rc != 0 )); then
      echo "[auto-deploy] local schema restore unavailable or invalid rc=$local_restore_rc; using Patroni scratch fallback" >&2
      reset_schema_restore_evidence_for_fallback
      if ! verify_schema_backup_restore_in_scratch \
        "$schema_backup_dir/schema.dump" "$schema_backup_dir/flyway-history.dump" \
        "$schema_restore_database_name" "$expected_history_count" "$expected_schema_object_count"; then
        echo "[auto-deploy] refusing deployment: full schema and Flyway-history restore verification failed" >&2
        exit 19
      fi
    fi
    jq -n --arg verifier "$schema_restore_verifier" \
      --arg imageRef "$schema_restore_image_ref" \
      --arg imageId "$schema_restore_image_id" \
      --arg postgresVersion "$schema_restore_postgres_version" \
      --arg schemaSha256 "$(sha256sum "$schema_backup_dir/schema.dump" | awk '{print $1}')" \
      --arg flywaySha256 "$(sha256sum "$schema_backup_dir/flyway-history.dump" | awk '{print $1}')" \
      --argjson flywayRows "$restored_history_count" \
      --argjson schemaObjects "$restored_schema_object_count" \
      '{verifier:$verifier,imageRef:$imageRef,imageId:$imageId,postgresVersion:$postgresVersion,schemaSha256:$schemaSha256,flywaySha256:$flywaySha256,flywayRows:$flywayRows,schemaObjects:$schemaObjects}' \
      >"$schema_backup_dir/restore-evidence.json" || {
      echo "[auto-deploy] refusing deployment: full schema and Flyway-history restore verification failed" >&2
      exit 19
    }
    tar -C "$schema_backup_dir" -cf "$backup_partial_file" \
      schema.dump flyway-history.dump migrations.manifest migrations.patch restore-evidence.json
    backup_bytes="$(stat -c %s "$backup_partial_file")"
    if [[ "$backup_bytes" -lt 2048 ]] || ! tar -tf "$backup_partial_file" | grep -q '^schema.dump$'; then
      rm -f "$backup_partial_file"
      echo "[auto-deploy] refusing deployment: schema backup package is invalid (${backup_bytes} bytes)" >&2
      exit 11
    fi
    publish_private_backup_partial "$backup_partial_file" "$backup_file" || {
      echo "[auto-deploy] refusing deployment: schema backup atomic publish failed" >&2; exit 11; }
    backup_partial_file=""
    rm -rf "$schema_backup_dir"
    schema_backup_dir=""
    echo "[auto-deploy] schema backup verified: $backup_file (${backup_bytes} bytes, verifier=${schema_restore_verifier}, restoredFlywayRows=${restored_history_count}, restoredSchemaObjects=${restored_schema_object_count})"
  elif [[ "$menu_backup_only" == "true" ]]; then
    backup_file="$BACKUP_DIR/carbonet-menu-$timestamp-$current_commit.sql.gz"
    backup_partial_file="$(arm_private_backup_partial "$backup_file")" || {
      echo "[auto-deploy] refusing unsafe menu backup partial path" >&2; exit 11; }
    echo "[auto-deploy] menu-only migration detected; creating targeted transactional backup"
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
      kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges \
          -h 127.0.0.1 -t comtnmenuinfo -t comtccmmndetailcode \
      | gzip -1 > "$backup_partial_file"; then
      rm -f "$backup_partial_file"
      echo "[auto-deploy] refusing deployment: targeted menu backup failed" >&2
      exit 14
    fi
    backup_bytes="$(stat -c %s "$backup_partial_file")"
    if [[ "$backup_bytes" -lt 1024 ]] || ! gzip -t "$backup_partial_file"; then
      rm -f "$backup_partial_file"
      echo "[auto-deploy] refusing deployment: targeted menu backup is invalid (${backup_bytes} bytes)" >&2
      exit 11
    fi
    publish_private_backup_partial "$backup_partial_file" "$backup_file" || {
      echo "[auto-deploy] refusing deployment: targeted menu backup atomic publish failed" >&2; exit 11; }
    backup_partial_file=""
    echo "[auto-deploy] targeted menu backup verified: $backup_file (${backup_bytes} bytes)"
  elif [[ "$governance_backup_only" == "true" ]]; then
    backup_file="$BACKUP_DIR/carbonet-governance-$timestamp-$current_commit.sql.gz"
    backup_partial_file="$(arm_private_backup_partial "$backup_file")" || {
      echo "[auto-deploy] refusing unsafe governance backup partial path" >&2; exit 11; }
    echo "[auto-deploy] governance-only migration detected; creating targeted transactional backup"
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
      kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges -h 127.0.0.1 \
          -t framework_actor_definition -t framework_account_actor_assignment \
          -t framework_process_definition -t framework_process_step \
          -t framework_business_process_sequence \
          -t framework_process_execution_topology \
          -t framework_process_navigation_binding \
          -t framework_simulation_case -t framework_simulation_run \
          -t framework_development_job -t framework_process_artifact \
          -t framework_project_actor_assignment \
          -t emission_project_registry -t emission_project_task \
          -t emission_project_history -t emission_workflow_notification \
          -t ui_component_registry -t ui_section_registry \
          -t framework_design_asset_registry \
          -t ui_page_manifest -t ui_page_component_map \
          -t framework_screen_resource \
          -t framework_screen_workflow_policy \
          -t framework_process_step_screen_binding \
          -t framework_professional_screen_contract \
          -t framework_process_work_draft \
          -t framework_screen_data_binding \
          -t framework_screen_blueprint \
          -t framework_page_design -t framework_page_field_definition \
          -t framework_company_reapplication_audit \
          -t comtninsttinfo -t comtninsttfile \
          -t comtncomponentinfo \
      | gzip -1 > "$backup_partial_file"; then
      rm -f "$backup_partial_file"
      echo "[auto-deploy] refusing deployment: targeted governance backup failed" >&2
      exit 14
    fi
    backup_bytes="$(stat -c %s "$backup_partial_file")"
    if [[ "$backup_bytes" -lt 1024 ]] || ! gzip -t "$backup_partial_file"; then
      rm -f "$backup_partial_file"
      echo "[auto-deploy] refusing deployment: targeted governance backup is invalid (${backup_bytes} bytes)" >&2
      exit 11
    fi
    publish_private_backup_partial "$backup_partial_file" "$backup_file" || {
      echo "[auto-deploy] refusing deployment: targeted governance backup atomic publish failed" >&2; exit 11; }
    backup_partial_file=""
    echo "[auto-deploy] targeted governance backup verified: $backup_file (${backup_bytes} bytes)"
  elif [[ "$activity_backup_only" == "true" ]]; then
    backup_file="$BACKUP_DIR/carbonet-activity-$timestamp-$current_commit.sql.gz"
    backup_partial_file="$(arm_private_backup_partial "$backup_file")" || {
      echo "[auto-deploy] refusing unsafe activity backup partial path" >&2; exit 11; }
    echo "[auto-deploy] activity-workflow migration detected; creating targeted transactional backup"
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
      kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges -h 127.0.0.1 \
          -t emission_activity_request -t emission_activity_request_event \
          -t emission_activity_data -t emission_activity_quality_run -t emission_activity_quality_issue \
          -t emission_activity_submission -t emission_activity_submission_item \
          -t emission_activity_submission_evidence -t emission_activity_submission_event \
          -t emission_factor_reference -t emission_factor_mapping_decision \
          -t emission_calculation_run -t emission_calculation_item \
          -t emission_project_task -t emission_project_history -t emission_workflow_notification \
      | gzip -1 > "$backup_partial_file"; then
      rm -f "$backup_partial_file"
      echo "[auto-deploy] refusing deployment: targeted activity-workflow backup failed" >&2
      exit 14
    fi
    backup_bytes="$(stat -c %s "$backup_partial_file")"
    if [[ "$backup_bytes" -lt 1024 ]] || ! gzip -t "$backup_partial_file"; then
      rm -f "$backup_partial_file"
      echo "[auto-deploy] refusing deployment: targeted activity-workflow backup is invalid (${backup_bytes} bytes)" >&2
      exit 11
    fi
    publish_private_backup_partial "$backup_partial_file" "$backup_file" || {
      echo "[auto-deploy] refusing deployment: targeted activity backup atomic publish failed" >&2; exit 11; }
    backup_partial_file=""
    echo "[auto-deploy] targeted activity-workflow backup verified: $backup_file (${backup_bytes} bytes)"
  elif [[ "$identity_backup_only" == "true" ]]; then
    backup_file="$BACKUP_DIR/carbonet-identity-$timestamp-$current_commit.sql.gz"
    backup_partial_file="$(arm_private_backup_partial "$backup_file")" || {
      echo "[auto-deploy] refusing unsafe identity backup partial path" >&2; exit 11; }
    echo "[auto-deploy] identity-only migration detected; creating targeted transactional backup"
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
      kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges -h 127.0.0.1 \
          -t comtngnrlmber -t comtnentrprsmber -t comtnemplyrinfo \
          -t comtnpasswordresethist -t comtnauthtokenstore \
          -t spring_session -t spring_session_attributes \
          -t account_recovery_request -t account_recovery_audit \
      | gzip -1 > "$backup_partial_file"; then
      rm -f "$backup_partial_file"
      echo "[auto-deploy] refusing deployment: targeted identity backup failed" >&2
      exit 14
    fi
    backup_bytes="$(stat -c %s "$backup_partial_file")"
    if [[ "$backup_bytes" -lt 1024 ]] || ! gzip -t "$backup_partial_file"; then
      rm -f "$backup_partial_file"
      echo "[auto-deploy] refusing deployment: targeted identity backup is invalid (${backup_bytes} bytes)" >&2
      exit 11
    fi
    publish_private_backup_partial "$backup_partial_file" "$backup_file" || {
      echo "[auto-deploy] refusing deployment: targeted identity backup atomic publish failed" >&2; exit 11; }
    backup_partial_file=""
    echo "[auto-deploy] targeted identity backup verified: $backup_file (${backup_bytes} bytes)"
  else
  echo "[auto-deploy] database migration detected; creating full pre-deploy backup"
  roles_backup_partial_file="$(arm_private_backup_partial "$roles_backup_file")" || {
    echo "[auto-deploy] refusing unsafe roles backup partial path" >&2; exit 17; }
  echo "[auto-deploy] backing up PostgreSQL roles to $roles_backup_file"
  if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
    kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
      pg_dumpall -U "$POSTGRES_USER" --roles-only -h 127.0.0.1 \
    | gzip -1 > "$roles_backup_partial_file"; then
    rm -f "$roles_backup_partial_file"
    echo "[auto-deploy] refusing deployment: PostgreSQL role backup failed" >&2
    exit 16
  fi
  if [[ "$(stat -c %s "$roles_backup_partial_file")" -lt 100 ]] || ! gzip -t "$roles_backup_partial_file"; then
    rm -f "$roles_backup_partial_file"
    echo "[auto-deploy] refusing deployment: PostgreSQL role backup is invalid" >&2
    exit 17
  fi
  publish_private_backup_partial "$roles_backup_partial_file" "$roles_backup_file" || {
    echo "[auto-deploy] refusing deployment: roles backup atomic publish failed" >&2; exit 17; }
  roles_backup_partial_file=""
  backup_partial_file="$(arm_private_backup_partial "$backup_file")" || {
    echo "[auto-deploy] refusing unsafe database backup partial path" >&2; exit 11; }
  echo "[auto-deploy] backing up database to $backup_file"
  if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
    kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
      pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges \
        -h 127.0.0.1 \
    | gzip -1 > "$backup_partial_file"; then
    rm -f "$backup_partial_file"
    echo "[auto-deploy] refusing deployment: database backup failed or exceeded ${BACKUP_TIMEOUT_SECONDS}s" >&2
    exit 14
  fi
  test -s "$backup_partial_file"
  backup_bytes="$(stat -c %s "$backup_partial_file")"
  if [[ "$backup_bytes" -lt "$MIN_BACKUP_BYTES" ]] || ! gzip -t "$backup_partial_file"; then
    rm -f "$backup_partial_file"
    echo "[auto-deploy] refusing deployment: database backup is invalid or too small (${backup_bytes} bytes)" >&2
    exit 11
  fi
  publish_private_backup_partial "$backup_partial_file" "$backup_file" || {
    echo "[auto-deploy] refusing deployment: database backup atomic publish failed" >&2; exit 11; }
  backup_partial_file=""
  fi
  umask "$backup_previous_umask"
else
  echo "[auto-deploy] database backup skipped: no schema migration in selected work"
fi

# Apply the same policy after a successful dump so retries cannot accumulate
# duplicate full backups faster than the hourly cleanup cadence.
bash ops/scripts/prune-predeploy-backups.sh

# Backend-only and migration-only commits reuse the last verified immutable
# frontend closure. Rebuilding TypeScript for such commits creates avoidable
# I/O pressure and can starve the running Kubernetes workloads.
skip_frontend=true
[[ "$PLAN_FRONTEND_REQUIRED" == "true" ]] && skip_frontend=false
echo "[auto-deploy] frontend build required: $([[ "$skip_frontend" == "true" ]] && echo no || echo yes)"

# Preserve the last verified runtime closure across the merge. The isolated
# frontend build will replace it only after closure validation.
git merge --ff-only "$target_commit"
run_flyway_job_timeout_contract_if_required
run_composite_axis_migration_performance_if_required
run_runtime_template_identity_migration_contract_if_required
sync_auto_deploy_failure_runtime_if_required
restore_live_frontend_overlay
run_postdeploy_candidate_static_contract_if_required
run_operational_usage_ledger_static_contract_if_required
if [[ "$PLAN_BACKEND_REQUIRED" == "true" ]]; then
  # Run guards introduced by the pending commit only after that exact revision
  # is present in the selected deployment worktree.
  bash ops/scripts/validate-jpa-entity-package-closure.sh "$ROOT_DIR"
fi
bash ops/scripts/validate-deterministic-development-policy.sh
# Applied Flyway files are immutable. Detect a checksum drift before spending
# time on Java/image builds and before Kubernetes starts a doomed rollout.
POSTGRES_POD="$POSTGRES_POD" \
  bash ops/scripts/verify-flyway-migration-immutability.sh "$ROOT_DIR"

# Capture the last known-good runtime, web proxy and frontend overlay before
# any deployable artifact changes. The post-deploy screen gate restores this
# snapshot automatically if a governed route becomes blank or unavailable.
verify_operational_usage_ledger_current_runtime_identity "$runtime_deployed_commit"
OVERLAY_DIR="$live_frontend_overlay" FULL_SCREEN_GATE_BASE_COMMIT="$runtime_deployed_commit" \
  bash ops/scripts/resonance-full-screen-deploy-gate.sh capture
if [[ "$PLAN_RUNTIME_REQUIRED" == "true" || "$PLAN_FRONTEND_REQUIRED" == "true" \
   || "$PLAN_BACKEND_REQUIRED" == "true" || "$PLAN_DATABASE_REQUIRED" == "true" ]]; then
  initialize_postdeploy_attempt_journal
fi
if [[ "$postdeploy_attempt_journal_initialized" == true \
   && "$postdeploy_db_attempt_staged" != true \
   && "$PLAN_DATABASE_REQUIRED" != true ]]; then
  echo '[auto-deploy] refusing live mutation: durable DB attempt is not ARMED' >&2
  exit 79
fi

# A frontend-only commit is compiled directly into the already mounted,
# guarded React overlay. The overlay script verifies the complete hashed asset
# closure and the HTTP response before the deployment marker advances. This
# avoids Java compilation, image creation and a rolling restart while keeping
# rollback material and stale-chunk protection.
if [[ "$PLAN_FRONTEND_REQUIRED" == "true" \
   && "$PLAN_BACKEND_REQUIRED" != "true" \
   && "$PLAN_DATABASE_REQUIRED" != "true" ]]; then
  frontend_smoke_pattern="$(node \
    projects/carbonet-frontend/source/scripts/derive-frontend-smoke-route-pattern.mjs \
    "$deployed_commit" "$target_commit")"
  echo "[auto-deploy] frontend smoke impact pattern=$frontend_smoke_pattern"
  BASE_URL="${CARBONET_PUBLIC_BASE_URL:-http://127.0.0.1}" \
  OVERLAY_DIR="${CARBONET_LIVE_FRONTEND_OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}" \
  STATUS_DIR="${CARBONET_LIVE_STATUS_DIR:-/opt/Resonance/var/run}" \
  SKIP_OVERLAY_BACKUP=true \
  DEFER_REACT_MOUNT_VERIFY=true \
    bash ops/scripts/resonance-screen-overlay-apply.sh
  health_status="$(curl -fsS --max-time 10 http://127.0.0.1/actuator/health || true)"
  if [[ "$health_status" != *'"status":"UP"'* ]]; then
    echo "[auto-deploy] refusing frontend success marker: health check is not UP" >&2
    exit 17
  fi
  bash ops/scripts/validate-common-design-assets.sh
  # Frontend source/CSS changes do not necessarily update DB contract
  # fingerprints. Always exercise a bounded cross-domain canary set here so a
  # common bundle regression can never result in a zero-screen deploy gate.
  # The scheduled nightly sweep remains the global 1,000-screen safety net.
  run_serialized_carbonet_auth_lifecycle runtime-screen-gate \
    env FULL_SCREEN_SMOKE_CHANGED_ONLY=false \
    FULL_SCREEN_SMOKE_ROUTE_PATTERN="$frontend_smoke_pattern" \
    FULL_SCREEN_SMOKE_REQUIRE_PREAUTH=true \
    FULL_SCREEN_GATE_DEFER_ACCEPT=true \
    FULL_SCREEN_GATE_AUTO_ROLLBACK=false \
    OVERLAY_DIR="$live_frontend_overlay" \
    bash ops/scripts/resonance-full-screen-deploy-gate.sh verify
  # Successful prebuilds may also refresh tracked generated inventories. Keep
  # the persistent deployment worktree clean for the next incremental run.
  bash ops/scripts/cleanup-failed-frontend-generated-changes.sh "$ROOT_DIR"
  bash ops/scripts/sync-unified-asset-catalog.sh "$deployed_commit" "$target_commit"
  enable_postdeploy_candidate_mode
  run_postdeploy_candidate_validation_groups true
  run_screen_contract_runtime_save_gate_if_required
  record_deploy_phase "frontend_build_and_verify"
  finalize_postdeploy_candidate_release
  record_deploy_performance frontend || echo '[auto-deploy] WARN frontend performance telemetry failed' >&2
  echo "[auto-deploy] frontend overlay deployed without Java/image build or rollout: $target_commit"
  exit 0
fi

# A measured JVM profile changes only the Deployment environment. Promote it
# through a guarded rolling restart and the complete runtime validation suite;
# the promoter restores the previous profile automatically on any failure.
if [[ "$PLAN_RUNTIME_REQUIRED" == "true" \
   && "$PLAN_FRONTEND_REQUIRED" != "true" \
   && "$PLAN_BACKEND_REQUIRED" != "true" \
   && "$PLAN_DATABASE_REQUIRED" != "true" \
   && ",$PLAN_TESTS," == *",runtime:startup-profile,"* ]]; then
  # JAVA_OPTS is a Deployment PodTemplate mutation. Arm the durable candidate,
  # remove the old runtime singleton with count=0 proof, and bind the candidate
  # source before the promoter changes the live template. Cleanup then owns an
  # exact baseline restore if the guarded rollout or validation fails.
  enable_postdeploy_candidate_mode
  CARBONET_DEPLOY_ROOT="$ROOT_DIR" DEFER_ROLLBACK_TO_ATTEMPT_RECONCILER=true \
    bash ops/scripts/promote-runtime-startup-profile.sh
  bash ops/scripts/sync-unified-asset-catalog.sh "$deployed_commit" "$target_commit"
  run_postdeploy_candidate_validation_groups true
  run_screen_contract_runtime_save_gate_if_required
  run_actor_process_role_e2e_if_required
  record_deploy_phase "runtime_profile_and_verify"
  reconcile_composite_autocompletion_postdeploy
  finalize_postdeploy_candidate_release_with_composite_gate_cleanup
  record_deploy_performance runtime || echo '[auto-deploy] WARN runtime-profile performance telemetry failed' >&2
  echo "[auto-deploy] JVM profile promoted without Java/frontend rebuild: $target_commit"
  exit 0
fi

# Test/deployment automation changes do not alter the running application.
# Validate their syntax and planning contract, then advance the marker without
# rebuilding React, Java, or an immutable image.
if [[ "$PLAN_FRONTEND_REQUIRED" != "true" \
   && "$PLAN_BACKEND_REQUIRED" != "true" \
   && "$PLAN_DATABASE_REQUIRED" != "true" \
   && "$PLAN_INFRASTRUCTURE_REQUIRED" == "true" ]]; then
  bash -n ops/scripts/auto-deploy-main.sh
  bash -n ops/scripts/auto-deploy-main-launcher.sh
  bash -n ops/scripts/plan-incremental-work.sh
  bash -n ops/scripts/runtime-candidate-checkpoint.sh
  bash ops/scripts/test-plan-incremental-work.sh
  bash ops/scripts/test-runtime-candidate-checkpoint.sh
  bash -n ops/scripts/resonance-full-screen-deploy-gate.sh
  bash -n projects/carbonet-frontend/source/scripts/run-full-screen-smoke.sh
  bash ops/scripts/test-fast-browser-deploy-gate.sh
  bash ops/scripts/test-postdeploy-parallel-browser-gate.sh
  bash ops/scripts/test-candidate-release-rollout-gate.sh
  bash ops/tests/test-postdeploy-candidate-evidence-contract.sh "$ROOT_DIR"
  bash ops/scripts/test-process-worker-deploy-marker.sh
  bash ops/scripts/test-database-plan-flyway-gate.sh
  bash ops/scripts/test-frontend-parallel-build-pipeline.sh
  bash ops/scripts/test-fast-overlay-snapshot.sh
  bash ops/scripts/test-shared-smoke-auth-state.sh
  bash ops/scripts/test-deploy-phase-telemetry.sh
  bash ops/scripts/test-frontend-deploy-performance-budget.sh
  if [[ ",$PLAN_TESTS," == *",control-plane:validate,"* ]]; then
    bash ops/scripts/resonance-control-plane.sh validate
  fi
  health_status="$(curl -fsS --max-time 10 http://127.0.0.1/actuator/health || true)"
  if [[ "$health_status" != *'"status":"UP"'* ]]; then
    echo "[auto-deploy] refusing automation-only success marker: health check is not UP" >&2
    exit 17
  fi
  node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$live_frontend_overlay"
  bash ops/scripts/sync-unified-asset-catalog.sh "$deployed_commit" "$target_commit"
  CARBONET_SCREEN_CONTRACT_PREVIEW_ONLY=1 run_screen_contract_runtime_save_gate_if_required
  run_actor_process_role_e2e_if_required
  record_deploy_phase "automation_validation"
  if [[ -s "$FULL_SCREEN_GATE_STATE_DIR/active.env" ]]; then
    OVERLAY_DIR="$live_frontend_overlay" FULL_SCREEN_GATE_DEFER_ACCEPT=true \
      bash ops/scripts/resonance-full-screen-deploy-gate.sh finalize-success
  fi
  run_operational_usage_ledger_current_runtime_e2e_if_required "$runtime_deployed_commit"
  write_applied_deploy_state "$target_commit"
  record_deploy_performance automation || echo '[auto-deploy] WARN automation performance telemetry failed' >&2
  echo "[auto-deploy] automation-only change validated without frontend/backend build: $target_commit"
  exit 0
fi

# Source catalog closure is independent of a backend-only image build and
# rollout. Overlap its complete 41k+ file audit with those CPU/network waits,
# then join fail-closed before runtime validation. Schema-changing releases
# retain sequential ordering because Flyway may alter catalog contracts.
if [[ "$PLAN_DATABASE_REQUIRED" != "true" ]]; then
  runtime_asset_sync_log="$ROOT_DIR/var/logs/runtime-asset-sync-${target_commit:0:10}.log"
  (
    bash ops/scripts/sync-unified-asset-catalog.sh "$deployed_commit" "$target_commit"
  ) >"$runtime_asset_sync_log" 2>&1 &
  runtime_asset_sync_pid="$!"
  echo "[auto-deploy] source asset closure running concurrently with runtime build pid=$runtime_asset_sync_pid"
fi

# The candidate-image migration Job is the only schema migration owner.
# Runtime pods keep both engines disabled so replicas never contend for DDL.
RUNTIME_JVM_PROFILE="$ROOT_DIR/ops/config/runtime-jvm-profile.env"
[[ -r "$RUNTIME_JVM_PROFILE" ]] || {
  echo "[auto-deploy] refusing deployment: runtime JVM profile is missing" >&2
  exit 8
}
# shellcheck source=ops/config/runtime-jvm-profile.env
source "$RUNTIME_JVM_PROFILE"
: "${CARBONET_RUNTIME_JAVA_OPTS:?runtime JAVA_OPTS profile is required}"
# Every database plan stages the frontend build but withholds all live overlay,
# Service, environment and workload mutations until the candidate Flyway job
# succeeds. A pre-existing lifecycle row is rollback authority, not permission
# to serve a new UI against the old schema.
build_deploy_status=0
IMMUTABLE_FRONTEND_IMAGE=true \
SKIP_FRONTEND="$skip_frontend" \
SKIP_NOTIFY="${SKIP_NOTIFY:-true}" \
RUN_FLYWAY_MIGRATION_JOB="$PLAN_DATABASE_REQUIRED" \
CARBONET_TARGET_COMMIT="$target_commit" \
CARBONET_BASELINE_COMMIT="$runtime_deployed_commit" \
CARBONET_FRONTEND_OVERLAY_LOCK_FILE="/opt/resonance-data/deploy/carbonet-frontend-overlay.lock" \
DEFER_ROLLBACK_TO_ATTEMPT_RECONCILER=true \
CARBONET_DURABLE_ATTEMPT_REQUIRED=true \
CARBONET_DEFER_LIVE_MUTATIONS_UNTIL_POST_FLYWAY="$([[ "$PLAN_DATABASE_REQUIRED" == true || "$postdeploy_db_attempt_staged" != true ]] && echo true || echo false)" \
POSTDEPLOY_DB_ATTEMPT_STAGED="$postdeploy_db_attempt_staged" \
CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" \
CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$POSTDEPLOY_JOURNAL_HELPER" \
CARBONET_POSTDEPLOY_CANDIDATE_ID="$postdeploy_candidate_id" \
CARBONET_POSTDEPLOY_SOURCE_COMMIT="$target_commit" \
CARBONET_POSTDEPLOY_LEADER_RESOLVER="$POSTDEPLOY_LEADER_RESOLVER" \
CARBONET_FLYWAY_CLEANUP_HOLD_FILE="$FLYWAY_CLEANUP_HOLD_FILE" \
RESONANCE_POSTGRES_LEADER_POD="${POSTGRES_POD:-}" \
CARBONET_POSTGRES_CONTAINER="$POSTGRES_CONTAINER" POSTGRES_DB="$POSTGRES_DB" POSTGRES_ADMIN_USER="$POSTGRES_USER" \
NAMESPACE="$NAMESPACE" DEPLOYMENT="$DEPLOYMENT" CONTAINER="${CARBONET_K8S_CONTAINER:-carbonet-runtime}" \
CARBONET_RUNTIME_JAVA_OPTS="$CARBONET_RUNTIME_JAVA_OPTS" \
  bash ops/scripts/resonance-k8s-build-deploy-80-v2.sh || build_deploy_status=$?
if (( build_deploy_status == 79 )); then
  flyway_cleanup_recovery_hold=true
  echo "[auto-deploy] RECOVERY_HOLD child returned 79; preserving durable attempt/checkpoint state evidence=$FLYWAY_CLEANUP_HOLD_FILE" >&2
  exit 79
elif (( build_deploy_status != 0 )); then
  exit "$build_deploy_status"
fi
verify_postdeploy_release_attempt_db_staged || {
  echo '[auto-deploy] build child returned without exact durable DB attempt stage' >&2
  exit 79
}
postdeploy_db_attempt_staged=true

# The build/deploy script already gates the exact candidate release pods and
# verifies the runtime. Do not wait a second time for old pods to finish their
# protected connection drain.
health_status="$(curl -fsS --max-time 10 http://127.0.0.1/actuator/health || true)"
if [[ "$health_status" != *'"status":"UP"'* ]]; then
  echo "[auto-deploy] refusing success marker: health check is not UP" >&2
  exit 17
fi
if [[ "$runtime_candidate_checkpoint_eligible" == "true" ]]; then
  run_runtime_candidate_checkpoint mark-ready
fi
record_deploy_phase "build_rollout_health"
else
  # The merge-overlay snapshot is temporary even when build/rollout are
  # skipped. Restore/validate it to keep the persistent worktree clean, while
  # retaining the full-screen rollback snapshot referenced by the checkpoint.
  restore_live_frontend_overlay
  record_deploy_phase "runtime_candidate_resume"
fi
# The target runtime is already serving after either a fresh healthy rollout
# or a checkpoint-verified resume, but the full-screen gate can still roll it
# back. Hide all previous PASS evidence during this validation window. The
# exact target identity is published only after every rollback-capable gate has
# passed; any failure deliberately leaves the view fail-closed as unavailable.
invalidate_runtime_release_state
asset_sync_precompleted=false
if [[ -n "$runtime_asset_sync_pid" ]]; then
  if wait "$runtime_asset_sync_pid"; then
    cat "$runtime_asset_sync_log"
    asset_sync_precompleted=true
    runtime_asset_sync_pid=""
  else
    echo "[auto-deploy] refusing success marker: concurrent source asset closure failed" >&2
    cat "$runtime_asset_sync_log" >&2
    exit 18
  fi
fi
# Browser rendering and the domain validators are independent read/validation
# lanes after rollout health is UP. Start the bounded browser canary alongside
# the three validation groups and join both fail-closed. This removes a
# sequential five-second tail without reducing test coverage.
if [[ "$PLAN_FRONTEND_REQUIRED" == "true" ]]; then
  runtime_screen_gate_log="$ROOT_DIR/var/logs/runtime-screen-gate-${target_commit:0:10}.log"
  runtime_screen_gate_cache_root="$(canonical_runtime_screen_gate_cache_root)" || {
    echo '[auto-deploy] refusing symlinked runtime screen cache root' >&2
    exit 19
  }
  mkdir -p "$runtime_screen_gate_cache_root"
  verified_runtime_screen_gate_cache_root="$(canonical_runtime_screen_gate_cache_root)" || {
    echo '[auto-deploy] runtime screen cache root changed during initialization' >&2
    exit 19
  }
  [[ "$verified_runtime_screen_gate_cache_root" == "$runtime_screen_gate_cache_root" ]] || {
    echo '[auto-deploy] runtime screen cache root identity mismatch' >&2
    exit 19
  }
  runtime_screen_gate_cache_dir="$runtime_screen_gate_cache_root/${target_commit:0:10}-$$"
  mkdir -p "$runtime_screen_gate_cache_dir"
  chmod 700 "$runtime_screen_gate_cache_dir"
  command -v setsid >/dev/null 2>&1 || { echo '[auto-deploy] setsid is required for bounded browser process-group cleanup' >&2; exit 19; }
  setsid env RESONANCE_ROOT="$ROOT_DIR" \
    OVERLAY_DIR="$live_frontend_overlay" \
    FULL_SCREEN_SMOKE_CHANGED_ONLY=false \
    FULL_SCREEN_GATE_DEFER_ACCEPT=true \
    FULL_SCREEN_GATE_AUTO_ROLLBACK=false \
    FULL_SCREEN_SMOKE_REQUIRE_PREAUTH=true \
    FULL_SCREEN_SMOKE_CACHE_DIR="$runtime_screen_gate_cache_dir" \
    FULL_SCREEN_SMOKE_ROUTE_PATTERN='^/(home|emission/project_list|emission/project/create|emission/my-tasks|home/certificate-verify|admin|admin/system/menu|admin/system/actor-process|admin/emission/survey-admin|admin/emission/survey-admin-data|admin/emission/survey-report|admin/emission/survey-report-print)([?#]|$)' \
    bash ops/scripts/run-runtime-screen-gate-serialized.sh \
    >"$runtime_screen_gate_log" 2>&1 &
  runtime_screen_gate_pid="$!"
  runtime_screen_gate_pgid="$runtime_screen_gate_pid"
  echo "[auto-deploy] bounded browser gate running concurrently pid=$runtime_screen_gate_pid pgid=$runtime_screen_gate_pgid"
fi

# These groups use independent tables and contracts. Ordering remains strict
# inside a group; the reusable harness provides bounded parallelism, isolated
# logs, and one fail-closed result for both deployment and operator testing.
enable_postdeploy_candidate_mode
run_runtime_release_validation_lanes "$asset_sync_precompleted" || exit $?
sync_backstage_catalog_if_required
deploy_backstage_if_required
run_backstage_identity_e2e_if_required
start_backstage_visual_e2e
# The identity-contracts post-deploy group above already performs one atomic
# Keycloak-to-Carbonet synchronization and verification. Do not repeat the
# same account writes on the runtime path; catalog/frontend-only paths still
# call sync_keycloak_actor_assignments_if_required before their success marker.
run_actor_process_role_e2e_if_required
wait_backstage_visual_e2e
run_backstage_screen_space_e2e_if_required
sync_postgres_backup_cronjobs_if_required
sync_post_reboot_recovery_if_required
# A mixed runtime + control-plane commit must not leave systemd executing the
# previous automation script after the new application is healthy. Reuse the
# same idempotent synchronizer on the runtime path before publishing success.
sync_process_development_worker_if_required
sync_process_contract_audit_if_required
sync_react_asset_prune_worker_if_required
# Runtime validation generates deterministic previews and compiled frontend
# artifacts inside the isolated deployment worktree. Normalize only the
# explicit generated allowlist before advancing the marker so the next
# incremental deployment never inherits stale or duplicate build output.
bash ops/scripts/normalize-deploy-generated-assets.sh "$ROOT_DIR"
record_deploy_phase "postdeploy_validation"
sudo docker image prune -a -f >/dev/null || true
reconcile_composite_autocompletion_postdeploy
finalize_postdeploy_candidate_release_with_composite_gate_cleanup
record_deploy_performance runtime || echo '[auto-deploy] WARN runtime performance telemetry failed' >&2
echo "[auto-deploy] deployed $target_commit after one-shot Flyway verification; runtime migration disabled"
