#!/usr/bin/env bash
set -Eeuo pipefail

MAX_PARALLEL_WORKERS="${MAX_PARALLEL_WORKERS:-3}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_SCRIPT="${WORKER_SCRIPT:-$SCRIPT_DIR/run-process-development-worker.sh}"

if ! [[ "$MAX_PARALLEL_WORKERS" =~ ^[1-9][0-9]*$ ]] || [ "$MAX_PARALLEL_WORKERS" -gt 8 ]; then
  echo "MAX_PARALLEL_WORKERS must be between 1 and 8" >&2
  exit 2
fi

pids=()
for slot in $(seq 1 "$MAX_PARALLEL_WORKERS"); do
  WORKER_SLOT="$slot" LOCK_FILE="/tmp/resonance-process-development-worker-${slot}.lock" \
    bash "$WORKER_SCRIPT" &
  pids+=("$!")
done

result=0
for pid in "${pids[@]}"; do
  wait "$pid" || result=1
done
exit "$result"
