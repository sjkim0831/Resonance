#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
export KUBECONFIG="${KUBECONFIG:-/home/sjkim/.kube/config}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
CUBRID_STATEFULSET="${CUBRID_STATEFULSET:-cubrid-carbonet}"
EVENT_LOG="${EVENT_LOG:-$ROOT_DIR/var/ai-runtime/k8s-boot-stabilize-events.jsonl}"
WAIT_SECONDS="${WAIT_SECONDS:-240}"

mkdir -p "$(dirname "$EVENT_LOG")"

json_escape() {
  printf '"%s"' "$(printf '%s' "${1-}" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g')"
}

log_event() {
  local status="$1"
  local action="$2"
  local detail="$3"
  printf '{"schemaVersion":"1.0","eventType":"k8s-boot-stabilize","timestamp":%s,"status":%s,"action":%s,"detail":%s}\n' \
    "$(json_escape "$(date -Iseconds)")" \
    "$(json_escape "$status")" \
    "$(json_escape "$action")" \
    "$(json_escape "$detail")" >>"$EVENT_LOG"
}

wait_until() {
  local label="$1"
  shift
  local deadline=$((SECONDS + WAIT_SECONDS))
  while (( SECONDS < deadline )); do
    if "$@" >/dev/null 2>&1; then
      log_event "PASS" "$label" "ready"
      return 0
    fi
    sleep 5
  done
  log_event "FAIL" "$label" "timeout after ${WAIT_SECONDS}s"
  return 1
}

flannel_ready() {
  test -s /run/flannel/subnet.env
}

k8s_node_ready() {
  kubectl get nodes --no-headers | awk '$2 == "Ready" { found=1 } END { exit found ? 0 : 1 }'
}

cubrid_ready() {
  kubectl -n "$NAMESPACE" rollout status "statefulset/$CUBRID_STATEFULSET" --timeout=5s
}

if ! command -v kubectl >/dev/null 2>&1; then
  log_event "FAIL" "kubectl" "kubectl missing"
  exit 1
fi

wait_until "flannel" flannel_ready || exit 1
wait_until "k8s-node" k8s_node_ready || exit 1
wait_until "cubrid" cubrid_ready || exit 1

if kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=60s >/dev/null 2>&1 \
  && curl -fsS --max-time 10 http://127.0.0.1/actuator/health >/dev/null 2>&1; then
  log_event "PASS" "runtime" "rollout and 80 health ready"
  exit 0
fi

log_event "WARN" "runtime-recover" "runtime not healthy after boot; restarting rollout"
kubectl -n "$NAMESPACE" rollout restart "deployment/$DEPLOYMENT"
kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=420s
curl -fsS --max-time 15 http://127.0.0.1/actuator/health >/dev/null
log_event "PASS" "runtime-recover" "runtime recovered after rollout restart"
