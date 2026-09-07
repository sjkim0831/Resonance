#!/usr/bin/env bash
set -euo pipefail

DISK_PATH="${CARBONET_DEPLOY_DISK_PATH:-/opt}"
MIN_FREE_AFTER_BYTES="${CARBONET_DEPLOY_MIN_FREE_AFTER_BYTES:-128849018880}"
RESERVED_WORK_BYTES="${CARBONET_DEPLOY_RESERVED_WORK_BYTES:-42949672960}"
STATUS_FILE="${CARBONET_DEPLOY_CAPACITY_STATUS_FILE:-/opt/resonance-data/deploy/capacity-status.json}"
KUBECONFIG="${CARBONET_KUBECONFIG:-${KUBECONFIG:-/home/sjkim/.kube/config}}"

is_uint() {
  [[ "$1" =~ ^[0-9]+$ ]]
}

for value in "$MIN_FREE_AFTER_BYTES" "$RESERVED_WORK_BYTES"; do
  if ! is_uint "$value"; then
    echo "[capacity-gate] invalid byte threshold: $value" >&2
    exit 2
  fi
done

available_bytes="$(df -PB1 "$DISK_PATH" | awk 'NR==2 {print $4}')"
if ! is_uint "$available_bytes"; then
  echo "[capacity-gate] unable to measure available capacity for $DISK_PATH" >&2
  exit 2
fi

required_bytes="$((MIN_FREE_AFTER_BYTES + RESERVED_WORK_BYTES))"
disk_pressure="Unknown"
if [[ "${CARBONET_DEPLOY_SKIP_NODE_PRESSURE_CHECK:-false}" == "true" ]]; then
  disk_pressure="Skipped"
elif command -v kubectl >/dev/null 2>&1 && [[ -r "$KUBECONFIG" ]]; then
  disk_pressure="$(KUBECONFIG="$KUBECONFIG" kubectl get nodes \
    -o jsonpath='{range .items[*]}{range .status.conditions[?(@.type=="DiskPressure")]}{.status}{"\n"}{end}{end}' \
    2>/dev/null | grep -E '^(True|False)$' | sort -u | paste -sd, - || true)"
  [[ -n "$disk_pressure" ]] || disk_pressure="Unknown"
fi

decision="PASS"
reason="capacity-reserved"
exit_code=0
if [[ "$disk_pressure" == *True* ]]; then
  decision="BLOCK"
  reason="kubernetes-disk-pressure"
  exit_code=18
elif (( available_bytes < required_bytes )); then
  decision="BLOCK"
  reason="insufficient-reserved-capacity"
  exit_code=18
fi

mkdir -p "$(dirname "$STATUS_FILE")"
status_tmp="${STATUS_FILE}.tmp.$$"
checked_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if command -v jq >/dev/null 2>&1; then
  jq -n \
    --arg checkedAt "$checked_at" \
    --arg path "$DISK_PATH" \
    --arg diskPressure "$disk_pressure" \
    --arg decision "$decision" \
    --arg reason "$reason" \
    --argjson availableBytes "$available_bytes" \
    --argjson requiredBytes "$required_bytes" \
    --argjson minimumFreeAfterBytes "$MIN_FREE_AFTER_BYTES" \
    --argjson reservedWorkBytes "$RESERVED_WORK_BYTES" \
    '{checkedAt:$checkedAt,path:$path,availableBytes:$availableBytes,
      requiredBytes:$requiredBytes,minimumFreeAfterBytes:$minimumFreeAfterBytes,
      reservedWorkBytes:$reservedWorkBytes,diskPressure:$diskPressure,
      decision:$decision,reason:$reason}' >"$status_tmp"
else
  printf '%s\n' \
    "checkedAt=$checked_at" "path=$DISK_PATH" "availableBytes=$available_bytes" \
    "requiredBytes=$required_bytes" "diskPressure=$disk_pressure" \
    "decision=$decision" "reason=$reason" >"$status_tmp"
fi
mv -f "$status_tmp" "$STATUS_FILE"

if (( exit_code != 0 )); then
  echo "[capacity-gate] BLOCK reason=$reason path=$DISK_PATH available=$available_bytes required=$required_bytes diskPressure=$disk_pressure" >&2
  exit "$exit_code"
fi

echo "[capacity-gate] PASS path=$DISK_PATH available=$available_bytes required=$required_bytes diskPressure=$disk_pressure"
