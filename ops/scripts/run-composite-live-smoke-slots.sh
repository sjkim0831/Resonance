#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MANIFEST="$ROOT/ops/runtime-metadata/composite-live-smoke-runner.json"
RUNNER="$ROOT/ops/scripts/run-composite-live-smoke.sh"
[[ -r "$MANIFEST" && -r "$RUNNER" ]] || {
  echo '[composite-live-smoke-slots] runner files missing' >&2
  exit 2
}

parallelism="${CARBONET_COMPOSITE_LIVE_SMOKE_PARALLELISM:-$(jq -er '.parallelism|numbers' "$MANIFEST")}"
[[ "$parallelism" =~ ^[1-8]$ ]] || {
  echo '[composite-live-smoke-slots] parallelism must be 1..8' >&2
  exit 2
}
max_claims="${CARBONET_COMPOSITE_LIVE_SMOKE_MAX_CLAIMS_PER_SLOT:-$(jq -er '.maxClaimsPerSlot|numbers' "$MANIFEST")}"
[[ "$max_claims" =~ ^([1-9]|1[0-9]|2[0-5])$ ]] || {
  echo '[composite-live-smoke-slots] max claims per slot must be 1..25' >&2
  exit 2
}
map_generator="${CARBONET_COMPOSITE_RELAY_MAP_GENERATOR:-/opt/resonance-data/control-plane/bin/generate-composite-relay-account-map.py}"
map_policy="${CARBONET_COMPOSITE_RELAY_MAP_POLICY:-/opt/resonance-data/control-plane/runtime-metadata/composite-relay-account-map.json}"
map_env="${CARBONET_COMPOSITE_RELAY_MAP_ENV:-/opt/resonance-data/control-plane/run/composite-relay-accounts.env}"
map_state="${CARBONET_COMPOSITE_RELAY_MAP_STATE:-/opt/resonance-data/control-plane/run/composite-relay-accounts.state.json}"
launcher_lock="/opt/resonance-data/control-plane/run/composite-live-smoke-slots.lock"
[[ -d "$(dirname "$launcher_lock")" && ! -L "$(dirname "$launcher_lock")" ]] || {
  echo '[composite-live-smoke-slots] controlled run directory unavailable' >&2
  exit 2
}
exec 9>"$launcher_lock"
flock -n 9 || { echo '[composite-live-smoke-slots] already-running' >&2; exit 3; }
set +e
/usr/bin/python3 "$map_generator" --manifest "$map_policy" --output-env "$map_env" --state "$map_state"
map_status=$?
set -e
if ((map_status==10)); then echo '[composite-live-smoke-slots] due=0'; exit 0; fi
((map_status==0)) || exit "$map_status"
set -a
source "$map_env"
set +a

pids=()
cleanup(){
  for pid in "${pids[@]:-}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup INT TERM
run_slot(){
  local slot="$1" output status claim
  for ((claim=0;claim<max_claims;claim++)); do
    set +e
    output="$(CARBONET_COMPOSITE_LIVE_SMOKE_SLOT="$slot" /usr/bin/bash "$RUNNER" 2>&1)"
    status=$?
    set -e
    [[ -z "$output" ]] || printf '%s\n' "$output"
    if (( status != 0 && status != 3 )); then return "$status"; fi
    [[ "$output" == *'[composite-live-smoke] due=0'* ]] && return 0
  done
}
for ((slot=0;slot<parallelism;slot++)); do
  run_slot "$slot" &
  pids+=("$!")
done

failed=0
for pid in "${pids[@]}"; do
  set +e
  wait "$pid"
  status=$?
  set -e
  # Exit 3 means the bounded third attempt was durably dead-lettered.  It is a
  # handled terminal dispatch, not a scheduler failure.
  if (( status != 0 && status != 3 )); then failed=1; fi
done
exit "$failed"
