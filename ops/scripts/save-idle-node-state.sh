#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="save-idle-node-state"
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/idle-node-common.sh"

TARGET_IP="${1:-${TARGET_IP:-34.82.132.175}}"
STATE_NAME="${STATE_NAME:-$(date '+%Y%m%d-%H%M%S')}"

main() {
  ensure_requirements
  ensure_state_root

  local node_id
  node_id="$(find_node_id "$TARGET_IP")"

  local state_dir="$STATE_ROOT/${TARGET_IP}/${STATE_NAME}"
  local jobs_dir="$state_dir/jobs"
  mkdir -p "$jobs_dir"

  find_node_json "$TARGET_IP" >"$state_dir/node.json"
  node_allocations_json "$node_id" >"$state_dir/allocations.json"

  local jobs_file="$state_dir/job_ids.txt"
  : >"$jobs_file"

  local job_id=""
  while IFS= read -r job_id; do
    [[ -z "$job_id" ]] && continue
    printf '%s\n' "$job_id" >>"$jobs_file"
    job_json "$job_id" >"$jobs_dir/${job_id}.json"
  done < <(node_job_ids "$node_id")

  jq -n \
    --arg target_ip "$TARGET_IP" \
    --arg node_id "$node_id" \
    --arg state_dir "$state_dir" \
    --arg idle_job "$IDLE_JOB_NAME" \
    --arg saved_at "$(date '+%Y-%m-%d %H:%M:%S %Z')" \
    --slurpfile node "$state_dir/node.json" \
    --slurpfile allocs "$state_dir/allocations.json" \
    '{
      targetIp: $target_ip,
      nodeId: $node_id,
      savedAt: $saved_at,
      stateDir: $state_dir,
      idleJobName: $idle_job,
      node: $node[0],
      allocations: $allocs[0],
      savedJobCount: ($allocs[0] | map(select(.ClientStatus != "complete" and .JobID != $idle_job)) | map(.JobID) | unique | length)
    }' >"$state_dir/manifest.json"

  log "saved state: $state_dir"
  cat "$state_dir/manifest.json"
}

main "$@"
