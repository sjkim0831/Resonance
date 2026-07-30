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

validate_menu_asset_design_group() {
  bash ops/scripts/validate-admin-menu-coverage.sh
  bash ops/scripts/validate-home-menu-coverage.sh
  bash ops/scripts/sync-unified-asset-catalog.sh "$base_revision" "$revision"
  bash ops/scripts/validate-e4b-selectable-assets.sh
  bash ops/scripts/validate-design-direct-development.sh
  bash ops/scripts/validate-common-design-assets.sh
}

validate_emission_workflow_group() {
  bash ops/scripts/validate-emission-project-workflow.sh
  bash ops/scripts/validate-emission-activity-collection.sh

  # These five lanes own independent evidence tables and runtime contracts.
  # Execute each lane in order internally, but overlap the lanes so a cold
  # runtime does not multiply network and PostgreSQL round-trip latency.
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
      "$@"
      echo "[emission-lane] PASS name=$lane_name duration=$(( $(date +%s) - lane_started ))s"
    ) >"$lane_dir/$lane_name.log" 2>&1 &
    lane_pids+=("$!")
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
  start_emission_lane activity activity_lane
  start_emission_lane calculation calculation_lane
  start_emission_lane organizational-boundary organizational_boundary_lane
  start_emission_lane governance-change governance_change_lane
  start_emission_lane report report_lane
  # These journeys validate stable runtime/DB state and do not consume evidence
  # produced by the five lanes above. They share the same fail-closed barrier,
  # so starting them here removes an unnecessary second validation wave.
  start_emission_lane customer-journey \
    bash ops/scripts/validate-customer-work-journey.sh
  if [[ "${VALIDATE_ACTOR_ACCOUNT:-true}" == "true" ]]; then
    start_emission_lane actor-account-journey \
      bash ops/scripts/validate-actor-account-customer-journey.sh
  else
    echo "[actor-account-journey] skipped only for an explicit operator benchmark"
  fi
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
echo "[validation-groups] PASS groups=3 duration=$(( $(date +%s) - started ))s logDir=$log_dir"
