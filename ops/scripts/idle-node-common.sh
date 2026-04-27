#!/usr/bin/env bash

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "idle-node-common.sh is a helper and should be sourced" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_ROOT="${STATE_ROOT:-$ROOT_DIR/ops/state/idle-node}"
NOMAD_ADDR="${NOMAD_ADDR:-http://127.0.0.1:4646}"
IDLE_JOB_NAME="${IDLE_JOB_NAME:-carbonet-idle}"
SSH_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)
SCP_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)
SSH_PASS="${SSH_PASS:-${IDLE_SSH_PASSWORD:-}}"

log() {
  printf '[%s] %s\n' "${SCRIPT_NAME:-idle-node}" "$*"
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

ensure_requirements() {
  require_command curl
  require_command jq
  require_command ssh
  require_command scp
}

ensure_state_root() {
  mkdir -p "$STATE_ROOT"
}

nomad_api() {
  local path="$1"
  curl -fsS "${NOMAD_ADDR}${path}"
}

run_remote() {
  local target="$1"
  shift
  if [[ -n "$SSH_PASS" ]]; then
    require_command sshpass
    sshpass -p "$SSH_PASS" ssh "${SSH_OPTS[@]}" "$target" "$@"
    return 0
  fi
  ssh "${SSH_OPTS[@]}" "$target" "$@"
}

copy_remote() {
  if [[ -n "$SSH_PASS" ]]; then
    require_command sshpass
    sshpass -p "$SSH_PASS" scp "${SCP_OPTS[@]}" "$@"
    return 0
  fi
  scp "${SCP_OPTS[@]}" "$@"
}

find_node_json() {
  local target_ip="$1"
  nomad_api "/v1/nodes" | jq -c --arg target_ip "$target_ip" '
    map(select(.Address == $target_ip or .Name == $target_ip)) | .[0]
  '
}

find_node_id() {
  local target_ip="$1"
  local node_json
  node_json="$(find_node_json "$target_ip")"
  if [[ -z "$node_json" || "$node_json" == "null" ]]; then
    echo "Nomad node not found for target: $target_ip" >&2
    exit 1
  fi
  printf '%s\n' "$node_json" | jq -r '.ID'
}

node_allocations_json() {
  local node_id="$1"
  nomad_api "/v1/node/${node_id}/allocations"
}

node_job_ids() {
  local node_id="$1"
  node_allocations_json "$node_id" | jq -r --arg idle_job "$IDLE_JOB_NAME" '
    map(select(.ClientStatus != "complete"))
    | map(.JobID)
    | map(select(. != $idle_job))
    | unique
    | .[]
  '
}

job_json() {
  local job_id="$1"
  nomad_api "/v1/job/${job_id}"
}

latest_state_dir() {
  local target_ip="$1"
  local node_root="$STATE_ROOT/${target_ip}"
  if [[ ! -d "$node_root" ]]; then
    return 1
  fi
  find "$node_root" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1
}
