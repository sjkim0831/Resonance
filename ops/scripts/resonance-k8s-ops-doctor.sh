#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
SERVICE_URL="${SERVICE_URL:-http://172.16.1.232/actuator/health}"
BROKER_POD="${BROKER_POD:-cubrid-carbonet-0}"
BROKER_CLOSE_WAIT_THRESHOLD="${BROKER_CLOSE_WAIT_THRESHOLD:-4}"
EVENT_LOG="$ROOT_DIR/var/ai-runtime/k8s-ops-doctor-events.jsonl"
LOCK_FILE="$ROOT_DIR/var/run/resonance-k8s-ops-doctor.lock"
METRICS_FILE="${METRICS_FILE:-/var/lib/prometheus/node-exporter/resonance_k8s.prom}"
if [[ -z "${KUBECONFIG:-}" && -r /etc/kubernetes/admin.conf ]]; then
  export KUBECONFIG=/etc/kubernetes/admin.conf
fi

mkdir -p "$(dirname "$EVENT_LOG")" "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

log_event() {
  local status="$1"
  local code="$2"
  local message="$3"
  printf '{"ts":"%s","script":"resonance-k8s-ops-doctor","status":"%s","code":"%s","message":"%s"}\n' \
    "$(date -Iseconds)" "$(json_escape "$status")" "$(json_escape "$code")" "$(json_escape "$message")" >>"$EVENT_LOG"
}

kubectl_ok() {
  kubectl get nodes >/dev/null 2>&1
}

broker_status() {
  kubectl -n "$NAMESPACE" exec "$BROKER_POD" -- sh -lc "su cubrid -c 'CUBRID=/home/cubrid/CUBRID; PATH=/home/cubrid/CUBRID/bin:\$PATH; LD_LIBRARY_PATH=/home/cubrid/CUBRID/lib:\$LD_LIBRARY_PATH; export CUBRID PATH LD_LIBRARY_PATH; cubrid broker status' 2>/dev/null || true"
}

repair_cubrid_ownership() {
  kubectl -n "$NAMESPACE" exec "$BROKER_POD" -- sh -lc 'chown -R cubrid:cubrid /var/lib/cubrid /home/cubrid/CUBRID/log 2>/dev/null || true' >/tmp/resonance-cubrid-ownership.log 2>&1 || true
}

restart_cubrid_service() {
  repair_cubrid_ownership
  kubectl -n "$NAMESPACE" exec "$BROKER_POD" -- sh -lc "su cubrid -c 'CUBRID=/home/cubrid/CUBRID; PATH=/home/cubrid/CUBRID/bin:\$PATH; LD_LIBRARY_PATH=/home/cubrid/CUBRID/lib:\$LD_LIBRARY_PATH; export CUBRID PATH LD_LIBRARY_PATH; cubrid service restart; cubrid broker status'" >/tmp/resonance-cubrid-service-restart.log 2>&1 || {
    log_event FAIL CUBRID_SERVICE_RESTART_FAILED "$(tr '
' ' ' </tmp/resonance-cubrid-service-restart.log | tail -c 600)"
    return 1
  }
  log_event OK CUBRID_SERVICE_RESTARTED "$(tr '
' ' ' </tmp/resonance-cubrid-service-restart.log | tail -c 600)"
}

restart_broker() {
  kubectl -n "$NAMESPACE" exec "$BROKER_POD" -- sh -lc "su cubrid -c 'CUBRID=/home/cubrid/CUBRID; PATH=/home/cubrid/CUBRID/bin:\$PATH; LD_LIBRARY_PATH=/home/cubrid/CUBRID/lib:\$LD_LIBRARY_PATH; export CUBRID PATH LD_LIBRARY_PATH; cubrid broker restart; cubrid broker status'" >/tmp/resonance-broker-restart.log 2>&1 || {
    log_event FAIL BROKER_RESTART_FAILED "$(tr '\n' ' ' </tmp/resonance-broker-restart.log | tail -c 600)"
    return 1
  }
  log_event OK BROKER_RESTARTED "$(tr '\n' ' ' </tmp/resonance-broker-restart.log | tail -c 600)"
}

check_broker() {
  local status close_wait busy idle total
  status="$(broker_status || true)"
  close_wait="$(printf '%s\n' "$status" | awk '/^[[:space:]]+[0-9]+/ && $6 == "CLOSE_WAIT" {c++} END {print c+0}')"
  busy="$(printf '%s\n' "$status" | awk '/^[[:space:]]+[0-9]+/ && $6 == "BUSY" {c++} END {print c+0}')"
  idle="$(printf '%s\n' "$status" | awk '/^[[:space:]]+[0-9]+/ && $6 == "IDLE" {c++} END {print c+0}')"
  total="$(printf '%s\n' "$status" | awk '/^[[:space:]]+[0-9]+/ {c++} END {print c+0}')"
  if [[ "$total" -eq 0 ]]; then
    log_event WARN BROKER_STATUS_EMPTY "broker status returned no CAS rows; repairing ownership and restarting CUBRID service"
    restart_cubrid_service || true
    status="$(broker_status || true)"
    close_wait="$(printf '%s
' "$status" | awk '/^[[:space:]]+[0-9]+/ && $6 == "CLOSE_WAIT" {c++} END {print c+0}')"
    busy="$(printf '%s
' "$status" | awk '/^[[:space:]]+[0-9]+/ && $6 == "BUSY" {c++} END {print c+0}')"
    idle="$(printf '%s
' "$status" | awk '/^[[:space:]]+[0-9]+/ && $6 == "IDLE" {c++} END {print c+0}')"
    total="$(printf '%s
' "$status" | awk '/^[[:space:]]+[0-9]+/ {c++} END {print c+0}')"
    if [[ "$total" -eq 0 ]]; then
      return 0
    fi
  fi
  if [[ "$close_wait" -ge "$BROKER_CLOSE_WAIT_THRESHOLD" ]]; then
    log_event WARN BROKER_CLOSE_WAIT_HIGH "close_wait=$close_wait busy=$busy idle=$idle total=$total"
    restart_broker || true
  else
    log_event OK BROKER_OK "close_wait=$close_wait busy=$busy idle=$idle total=$total"
  fi
  BROKER_CLOSE_WAIT="$close_wait"
  BROKER_BUSY="$busy"
  BROKER_IDLE="$idle"
  BROKER_TOTAL="$total"
}

check_runtime() {
  local ready restarts health_ok ready_num desired_num health_value restart_sum
  ready="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath='{.status.readyReplicas}/{.status.replicas}' 2>/dev/null || echo unknown)"
  restarts="$(kubectl -n "$NAMESPACE" get pods -l app=carbonet-runtime -o jsonpath='{range .items[*]}{.status.containerStatuses[0].restartCount}{" "}{end}' 2>/dev/null || true)"
  ready_num="${ready%%/*}"
  desired_num="${ready##*/}"
  [[ "$ready_num" =~ ^[0-9]+$ ]] || ready_num=0
  [[ "$desired_num" =~ ^[0-9]+$ ]] || desired_num=0
  health_ok=false
  health_value=0
  if [[ "$ready_num" -eq "$desired_num" && "$desired_num" -gt 0 ]]; then
    health_ok=true
    health_value=1
  fi
  restart_sum="$(awk '{s=0; for (i=1; i<=NF; i++) s+=$i; print s+0}' <<<"$restarts")"
  if [[ "$health_ok" != "true" ]]; then
    log_event WARN RUNTIME_HEALTH_FAILED "ready=$ready readiness=$health_ok restarts=$restarts"
  elif [[ "$ready" != "2/2" ]]; then
    log_event WARN RUNTIME_ROLLOUT_IN_PROGRESS "ready=$ready readiness=$health_ok restarts=$restarts"
  else
    log_event OK RUNTIME_OK "ready=$ready readiness=$health_ok restarts=$restarts"
  fi
  RUNTIME_READY="$ready_num"
  RUNTIME_DESIRED="$desired_num"
  RUNTIME_HEALTH="$health_value"
  RUNTIME_RESTARTS="$restart_sum"
}

write_metrics() {
  local close_wait="${1:-${BROKER_CLOSE_WAIT:-0}}"
  local busy="${2:-${BROKER_BUSY:-0}}"
  local idle="${3:-${BROKER_IDLE:-0}}"
  local total="${4:-${BROKER_TOTAL:-0}}"
  local ready="${5:-${RUNTIME_READY:-0}}"
  local health="${6:-${RUNTIME_HEALTH:-0}}"
  local tmp
  tmp="$(mktemp /tmp/resonance-k8s-metrics.XXXXXX)"
  cat >"$tmp" <<METRICS
# HELP resonance_cubrid_broker_close_wait CUBRID broker CAS processes in CLOSE_WAIT state.
# TYPE resonance_cubrid_broker_close_wait gauge
resonance_cubrid_broker_close_wait $close_wait
# HELP resonance_cubrid_broker_busy CUBRID broker CAS processes in BUSY state.
# TYPE resonance_cubrid_broker_busy gauge
resonance_cubrid_broker_busy $busy
# HELP resonance_cubrid_broker_idle CUBRID broker CAS processes in IDLE state.
# TYPE resonance_cubrid_broker_idle gauge
resonance_cubrid_broker_idle $idle
# HELP resonance_cubrid_broker_total CUBRID broker CAS process count.
# TYPE resonance_cubrid_broker_total gauge
resonance_cubrid_broker_total $total
# HELP resonance_runtime_ready_replicas Carbonet runtime ready replicas.
# TYPE resonance_runtime_ready_replicas gauge
resonance_runtime_ready_replicas $ready
# HELP resonance_runtime_desired_replicas Carbonet runtime desired replicas.
# TYPE resonance_runtime_desired_replicas gauge
resonance_runtime_desired_replicas ${RUNTIME_DESIRED:-0}
# HELP resonance_runtime_health_up Carbonet runtime readiness health from Kubernetes.
# TYPE resonance_runtime_health_up gauge
resonance_runtime_health_up $health
# HELP resonance_runtime_container_restarts Carbonet runtime total container restarts.
# TYPE resonance_runtime_container_restarts gauge
resonance_runtime_container_restarts ${RUNTIME_RESTARTS:-0}
METRICS
  install -m 0644 "$tmp" "$METRICS_FILE" 2>/dev/null || cp "$tmp" "$METRICS_FILE"
  rm -f "$tmp"
}

main() {
  if ! kubectl_ok; then
    log_event FAIL KUBECTL_UNAVAILABLE "kubectl cannot reach cluster"
    exit 0
  fi
  BROKER_CLOSE_WAIT=0 BROKER_BUSY=0 BROKER_IDLE=0 BROKER_TOTAL=0
  RUNTIME_READY=0 RUNTIME_DESIRED=0 RUNTIME_HEALTH=0 RUNTIME_RESTARTS=0
  check_broker
  check_runtime
  write_metrics
}

main "$@"
