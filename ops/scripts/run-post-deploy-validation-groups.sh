#!/usr/bin/env bash
set -euo pipefail

root="${1:-$(pwd)}"
revision="${2:-$(git -C "$root" rev-parse HEAD)}"
base_revision="${3:-}"
cd "$root"

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

  # These lanes own independent evidence tables, but their authenticated
  # validators share a single-token-per-user runtime account. Keep the lanes
  # concurrent as processes while serializing each authenticated lifetime on
  # the canonical QA lock; otherwise a later login revokes an earlier lane.
  local lane_dir lane_failed lane_name lane_pid
  lane_dir="$(mktemp -d "$log_dir/emission-lanes.XXXXXX")"
  lane_failed=0
  declare -a lane_names=()
  declare -a lane_pids=()
  start_emission_lane() {
    lane_name="$1"
    shift
    lane_names+=("$lane_name")
    (
      lane_started="$(date +%s)"
      exec 9>"${CARBONET_QA_AUTH_LOCK_FILE:-/tmp/carbonet-qa-auth-session.lock}"
      flock -w "${CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-120}" 9 \
        || { echo "[emission-lane] FAIL auth-lock name=$lane_name" >&2; exit 1; }
      "$@"
      echo "[emission-lane] PASS name=$lane_name duration=$(( $(date +%s) - lane_started ))s"
    ) >"$lane_dir/$lane_name.log" 2>&1 &
    lane_pids+=("$!")
  }
  wait_emission_lanes() {
    local lane_index
    for lane_index in "${!lane_pids[@]}"; do
      lane_name="${lane_names[$lane_index]}"
      lane_pid="${lane_pids[$lane_index]}"
      if wait "$lane_pid"; then
        cat "$lane_dir/$lane_name.log"
      else
        lane_failed=1
        echo "[emission-lane] FAIL name=$lane_name" >&2
        cat "$lane_dir/$lane_name.log" >&2
      fi
    done
    lane_names=()
    lane_pids=()
  }
  activity_lane() {
    bash ops/scripts/complete-activity-data-evidence-jobs.sh
    bash ops/scripts/validate-activity-workflow-links.sh
    bash ops/scripts/validate-activity-data-runtime.sh
  }
  calculation_lane() {
    bash ops/scripts/complete-emission-calculation-evidence-jobs.sh
    bash ops/scripts/validate-emission-calculation-runtime.sh
  }
  organizational_boundary_lane() {
    bash ops/scripts/validate-organizational-boundary-runtime.sh
  }
  governance_change_lane() {
    bash ops/scripts/validate-governance-change-runtime.sh
  }
  report_lane() {
    bash ops/scripts/complete-report-certification-evidence-jobs.sh
    bash ops/scripts/validate-report-certification-runtime.sh
  }
  # These journeys validate stable runtime/DB state and do not consume evidence
  # produced by the five lanes below. Keep one fail-closed barrier: splitting a
  # cold JVM into two waves increased total verification time without reducing
  # load or improving readiness.
  start_emission_lane customer-journey \
    bash ops/scripts/validate-customer-work-journey.sh
  if [[ "${VALIDATE_ACTOR_ACCOUNT:-true}" == "true" ]]; then
    start_emission_lane actor-account-journey \
      bash ops/scripts/validate-actor-account-customer-journey.sh
  else
    echo "[actor-account-journey] skipped only for an explicit operator benchmark"
  fi
  start_emission_lane activity activity_lane
  start_emission_lane calculation calculation_lane
  start_emission_lane organizational-boundary organizational_boundary_lane
  start_emission_lane governance-change governance_change_lane
  start_emission_lane report report_lane
  wait_emission_lanes
  rm -rf "$lane_dir"
  (( lane_failed == 0 )) || return 1
}

validate_identity_design_group() {
  RESONANCE_ROOT="$root" \
    bash ops/scripts/resonance-keycloak-carbonet-identity-sync-install.sh
  bash ops/scripts/resonance-keycloak-carbonet-identity-sync.sh
  bash ops/scripts/validate-keycloak-carbonet-identity-sync.sh
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
