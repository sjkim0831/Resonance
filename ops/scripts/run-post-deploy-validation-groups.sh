#!/usr/bin/env bash
set -euo pipefail

root="${1:-$(pwd)}"
revision="${2:-$(git -C "$root" rev-parse HEAD)}"
base_revision="${3:-}"
cd "$root"

# shellcheck source=ops/scripts/runtime-qa-auth-common.sh
source "$root/ops/scripts/runtime-qa-auth-common.sh"
export CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS="${CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-300}"

log_dir="$root/var/logs/deploy-validation/$(date +%Y%m%d-%H%M%S)-${revision:0:10}"
mkdir -p "$log_dir"
declare -a names=()
declare -a pids=()

resolve_postgres_leader_once() {
  local namespace database user_name pod
  namespace="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
  database="${POSTGRES_DB:-carbonet}"
  user_name="${POSTGRES_ADMIN_USER:-postgres}"
  if [[ -n "${RESONANCE_POSTGRES_LEADER_POD:-}" ]]; then
    return
  fi
  while IFS= read -r pod; do
    if [[ "$(kubectl -n "$namespace" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$user_name" -d "$database" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then
      export RESONANCE_POSTGRES_LEADER_POD="$pod"
      echo "[validation-groups] PostgreSQL leader resolved once pod=$pod"
      return
    fi
  done < <(kubectl -n "$namespace" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
  echo "[validation-groups] PostgreSQL leader not found" >&2
  return 1
}

validate_menu_asset_design_group() {
  bash ops/scripts/validate-admin-menu-coverage.sh
  bash ops/scripts/validate-home-menu-coverage.sh
  if [[ "${UNIFIED_ASSET_SYNC_PRECOMPLETED:-false}" == "true" ]]; then
    echo "[asset-catalog] precompleted during build and rollout"
  else
    bash ops/scripts/sync-unified-asset-catalog.sh "$base_revision" "$revision"
    bash ops/scripts/validate-e4b-selectable-assets.sh
  fi
  bash ops/scripts/validate-design-direct-development.sh
  bash ops/scripts/validate-common-design-assets.sh
}

validate_emission_workflow_group() {
  bash ops/scripts/validate-emission-project-workflow.sh
  bash ops/scripts/validate-emission-activity-collection.sh

  # Evidence preparation has no authenticated session, and the actor journey
  # uses separate principals, so keep both parallel. Once preparation is done,
  # hold the canonical owner-aware lock once while the six shared-account
  # runtimes execute in their declared order. This prevents token revocation,
  # nested deadlock, and an unrelated screen gate interleaving mid-workflow.
  local lane_dir prep_failed lane_name lane_pid actor_pid actor_status shared_status
  lane_dir="$(mktemp -d "$log_dir/emission-lanes.XXXXXX")"
  prep_failed=0
  actor_pid=""
  actor_status=0
  shared_status=0
  declare -a lane_names=()
  declare -a lane_pids=()
  start_emission_prep() {
    lane_name="$1"
    shift
    lane_names+=("$lane_name")
    (
      lane_started="$(date +%s)"
      "$@"
      echo "[emission-prep] PASS name=$lane_name duration=$(( $(date +%s) - lane_started ))s"
    ) >"$lane_dir/$lane_name.log" 2>&1 &
    lane_pids+=("$!")
  }
  wait_emission_preps() {
    local lane_index lane_status
    for lane_index in "${!lane_pids[@]}"; do
      lane_name="${lane_names[$lane_index]}"
      lane_pid="${lane_pids[$lane_index]}"
      lane_status=0
      wait "$lane_pid" || lane_status=$?
      if (( lane_status == 0 )); then
        cat "$lane_dir/$lane_name.log"
      else
        prep_failed=1
        echo "[emission-prep] FAIL name=$lane_name status=$lane_status" >&2
        cat "$lane_dir/$lane_name.log" >&2
      fi
    done
    lane_names=()
    lane_pids=()
  }
  activity_prep() {
    bash ops/scripts/complete-activity-data-evidence-jobs.sh
    bash ops/scripts/validate-activity-workflow-links.sh
  }
  calculation_prep() {
    bash ops/scripts/complete-emission-calculation-evidence-jobs.sh
  }
  report_prep() {
    bash ops/scripts/complete-report-certification-evidence-jobs.sh
  }
  run_emission_runtime_step() {
    local step_name="$1" step_started step_status
    shift
    step_started="$(date +%s)"
    step_status=0
    "$@" || step_status=$?
    if (( step_status != 0 )); then
      echo "[emission-shared-runtime] FAIL name=$step_name status=$step_status" >&2
      return "$step_status"
    fi
    echo "[emission-shared-runtime] PASS name=$step_name duration=$(( $(date +%s) - step_started ))s"
  }
  run_emission_shared_runtime() {
    local aggregate_status=0 step_status=0
    run_emission_runtime_step customer bash ops/scripts/validate-customer-work-journey.sh \
      || { step_status=$?; aggregate_status=1; echo "[emission-shared-runtime] RECORDED name=customer status=$step_status" >&2; }
    run_emission_runtime_step activity bash ops/scripts/validate-activity-data-runtime.sh \
      || { step_status=$?; aggregate_status=1; echo "[emission-shared-runtime] RECORDED name=activity status=$step_status" >&2; }
    run_emission_runtime_step calculation bash ops/scripts/validate-emission-calculation-runtime.sh \
      || { step_status=$?; aggregate_status=1; echo "[emission-shared-runtime] RECORDED name=calculation status=$step_status" >&2; }
    run_emission_runtime_step organizational-boundary bash ops/scripts/validate-organizational-boundary-runtime.sh \
      || { step_status=$?; aggregate_status=1; echo "[emission-shared-runtime] RECORDED name=organizational-boundary status=$step_status" >&2; }
    run_emission_runtime_step governance-change bash ops/scripts/validate-governance-change-runtime.sh \
      || { step_status=$?; aggregate_status=1; echo "[emission-shared-runtime] RECORDED name=governance-change status=$step_status" >&2; }
    run_emission_runtime_step report bash ops/scripts/validate-report-certification-runtime.sh \
      || { step_status=$?; aggregate_status=1; echo "[emission-shared-runtime] RECORDED name=report status=$step_status" >&2; }
    return "$aggregate_status"
  }

  if [[ "${VALIDATE_ACTOR_ACCOUNT:-true}" == "true" ]]; then
    (
      actor_started="$(date +%s)"
      bash ops/scripts/validate-actor-account-customer-journey.sh
      echo "[emission-lane] PASS name=actor-account-journey duration=$(( $(date +%s) - actor_started ))s"
    ) >"$lane_dir/actor-account-journey.log" 2>&1 &
    actor_pid="$!"
  else
    echo "[actor-account-journey] skipped only for an explicit operator benchmark"
  fi

  start_emission_prep activity activity_prep
  start_emission_prep calculation calculation_prep
  start_emission_prep report report_prep
  wait_emission_preps

  if (( prep_failed == 0 )); then
    carbonet_qa_auth_run_serialized emission-shared-runtime \
      run_emission_shared_runtime \
      >"$lane_dir/emission-shared-runtime.log" 2>&1 || shared_status=$?
    if (( shared_status == 0 )); then
      cat "$lane_dir/emission-shared-runtime.log"
    else
      echo "[emission-shared-runtime] FAIL status=$shared_status" >&2
      cat "$lane_dir/emission-shared-runtime.log" >&2
    fi
  fi

  if [[ -n "$actor_pid" ]]; then
    wait "$actor_pid" || actor_status=$?
    if (( actor_status == 0 )); then
      cat "$lane_dir/actor-account-journey.log"
    else
      echo "[emission-lane] FAIL name=actor-account-journey status=$actor_status" >&2
      cat "$lane_dir/actor-account-journey.log" >&2
    fi
  fi
  rm -rf "$lane_dir"
  (( prep_failed == 0 && shared_status == 0 && actor_status == 0 )) || return 1
}

validate_identity_design_group() {
  identity_current_digest() {
    kubectl -n "${CARBONET_K8S_NAMESPACE:-carbonet-prod}" exec "${RESONANCE_POSTGRES_LEADER_POD}" -c patroni -- \
      psql -h 127.0.0.1 -U "${POSTGRES_ADMIN_USER:-postgres}" -d "${POSTGRES_DB:-carbonet}" -X -qAt -v ON_ERROR_STOP=1 -c "
        select encode(sha256(convert_to(concat_ws('|',
          coalesce((select jsonb_agg(to_jsonb(e) order by lower(e.emplyr_id))::text from comtnemplyrinfo e where trim(e.group_id)='GROUP_KEYCLOAK'),'[]'),
          coalesce((select jsonb_agg(to_jsonb(s) order by s.scrty_dtrmn_trget_id)::text from comtnemplyrscrtyestbs s join comtnemplyrinfo e on e.esntl_id=s.scrty_dtrmn_trget_id where trim(e.group_id)='GROUP_KEYCLOAK'),'[]'),
          coalesce((select jsonb_agg(to_jsonb(a) order by a.assignment_id)::text from framework_account_actor_assignment a where exists(select 1 from comtnemplyrinfo e where lower(e.emplyr_id)=lower(a.account_id) and trim(e.group_id)='GROUP_KEYCLOAK')),'[]'),
          coalesce((select jsonb_agg(to_jsonb(l) order by to_jsonb(l)::text)::text from framework_identity_actor_assignment_link l),'[]'),
          coalesce((select jsonb_agg(to_jsonb(a) order by a.sync_id)::text from framework_identity_sync_audit a),'[]')
        ),'UTF8')),'hex')"
  }
  if [[ "${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == candidate ]]; then
    local identity_before identity_after identity_validation_status
    local identity_sync_lock_file identity_sync_lock_wait_seconds identity_sync_lock_fd
    identity_sync_lock_file="${IDENTITY_SYNC_LOCK_FILE:-/tmp/resonance-keycloak-carbonet-identity-sync.lock}"
    identity_sync_lock_wait_seconds="${IDENTITY_SYNC_LOCK_WAIT_SECONDS:-60}"
    identity_candidate_lock_close() {
      local close_status=0
      flock -u "$identity_sync_lock_fd" || close_status=$?
      exec {identity_sync_lock_fd}>&- || close_status=$?
      return "$close_status"
    }
    if ! exec {identity_sync_lock_fd}>"$identity_sync_lock_file"; then
      echo '[identity-contracts] FAIL unable to open shared identity synchronization lock' >&2
      return 1
    fi
    if ! flock -w "$identity_sync_lock_wait_seconds" "$identity_sync_lock_fd"; then
      exec {identity_sync_lock_fd}>&- || true
      echo "[identity-contracts] FAIL shared identity synchronization lock timed out after ${identity_sync_lock_wait_seconds}s" >&2
      return 1
    fi
    if ! identity_before="$(
      exec {identity_sync_lock_fd}>&- || exit 1
      identity_current_digest
    )"; then
      identity_candidate_lock_close || true
      echo '[identity-contracts] FAIL current identity snapshot unavailable' >&2
      return 1
    fi
    if [[ ! "$identity_before" =~ ^[0-9a-f]{64}$ ]]; then
      identity_candidate_lock_close || true
      echo '[identity-contracts] FAIL current identity snapshot unavailable' >&2
      return 1
    fi
    identity_validation_status=0
    (
      exec {identity_sync_lock_fd}>&- || exit 1
      bash ops/scripts/validate-keycloak-carbonet-identity-sync.sh
    ) || identity_validation_status=$?
    if (( identity_validation_status != 0 )); then
      identity_candidate_lock_close || true
      return "$identity_validation_status"
    fi
    if ! identity_after="$(
      exec {identity_sync_lock_fd}>&- || exit 1
      identity_current_digest
    )"; then
      identity_candidate_lock_close || true
      echo '[identity-contracts] FAIL current identity snapshot unavailable after verify-only gate' >&2
      return 1
    fi
    if [[ "$identity_after" != "$identity_before" ]]; then
      identity_candidate_lock_close || true
      echo '[identity-contracts] FAIL verify-only gate changed current identity state' >&2
      return 1
    fi
    if ! identity_candidate_lock_close; then
      echo '[identity-contracts] FAIL unable to release shared identity synchronization lock' >&2
      return 1
    fi
    echo '[identity-contracts] PASS mode=verify-only currentWrites=0'
  else
    RESONANCE_ROOT="$root" \
      bash ops/scripts/resonance-keycloak-carbonet-identity-sync-install.sh
    bash ops/scripts/resonance-keycloak-carbonet-identity-sync.sh
    bash ops/scripts/validate-keycloak-carbonet-identity-sync.sh
  fi
  bash ops/scripts/validate-project-auto-completion.sh
  bash ops/scripts/validate-contract-completion-algorithm.sh
  bash ops/scripts/validate-unified-work-design-runtime.sh
}

start_group() {
  local name="$1"
  local function_name="$2"
  names+=("$name")
  (
    started="$(date +%s)"
    "$function_name"
    echo "[validation-group] PASS name=$name duration=$(( $(date +%s) - started ))s"
  ) >"$log_dir/$name.log" 2>&1 &
  pids+=("$!")
}

started="$(date +%s)"
resolve_postgres_leader_once
start_group "menu-assets-design" validate_menu_asset_design_group
start_group "emission-workflow" validate_emission_workflow_group
start_group "identity-contracts" validate_identity_design_group

failed=0
for index in "${!pids[@]}"; do
  name="${names[$index]}"
  if wait "${pids[$index]}"; then
    cat "$log_dir/$name.log"
  else
    failed=1
    echo "[validation-groups] FAIL name=$name log=$log_dir/$name.log" >&2
    cat "$log_dir/$name.log" >&2
  fi
done
if (( failed != 0 )); then
  echo "[validation-groups] refusing success: one or more groups failed" >&2
  exit 1
fi

# The application runtime must never depend on host-only interactive tools.
# Catch capability-gating regressions before a release is marked successful.
runtime_namespace="${CARBONET_NAMESPACE:-carbonet-prod}"
runtime_selector="${CARBONET_RUNTIME_SELECTOR:-app=carbonet-runtime}"
runtime_capability_log="$log_dir/runtime-capabilities.log"
if ! kubectl -n "$runtime_namespace" logs -l "$runtime_selector" \
    --since=5m --prefix=true >"$runtime_capability_log" 2>&1; then
  echo "[runtime-capability] FAIL unable to inspect candidate runtime logs" >&2
  cat "$runtime_capability_log" >&2
  exit 1
fi
if grep -Fq 'Cannot run program "tmux"' "$runtime_capability_log" \
    || grep -Fq 'Failed to ensure tmux lane session' "$runtime_capability_log"; then
  echo "[runtime-capability] FAIL runtime attempted to invoke unavailable tmux" >&2
  grep -F 'tmux' "$runtime_capability_log" | tail -20 >&2
  exit 1
fi
echo "[runtime-capability] PASS host-only tmux dependency is capability-gated"

echo "[validation-groups] PASS groups=3 duration=$(( $(date +%s) - started ))s logDir=$log_dir"
