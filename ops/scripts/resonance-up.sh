#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
WEB_DEPLOYMENT="${WEB_DEPLOYMENT:-carbonet-runtime}"
WEB_SERVICE="${WEB_SERVICE:-carbonet-runtime}"
DB_STATEFULSET="${DB_STATEFULSET:-postgres-patroni}"
HEALTH_URL="${HEALTH_URL:-}"
RUN_DIR="$ROOT_DIR/var/run"
EVENT_LOG="$ROOT_DIR/var/ai-runtime/resonance-up-events.jsonl"
LOCK_FILE="$RUN_DIR/resonance-up.lock"

mkdir -p "$RUN_DIR" "$(dirname "$EVENT_LOG")"
cd "$ROOT_DIR"

exec 9>"$LOCK_FILE"
flock -n 9 || {
  echo "[resonance-up] another startup/repair run is already active"
  exit 0
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

log_event() {
  local status="$1" code="$2" message="$3"
  printf '{"ts":"%s","script":"resonance-up","status":"%s","code":"%s","message":"%s"}\n' \
    "$(date -Iseconds)" "$(json_escape "$status")" "$(json_escape "$code")" "$(json_escape "$message")" >>"$EVENT_LOG"
}

log() {
  printf '[resonance-up] %s\n' "$*"
}

sudo_cmd() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

ensure_kubeconfig() {
  if [[ -n "${KUBECONFIG:-}" && -r "${KUBECONFIG:-}" ]]; then
    return 0
  fi
  local home_dir="${HOME:-}"
  if [[ -n "$home_dir" && -r "$home_dir/.kube/config" ]]; then
    export KUBECONFIG="$home_dir/.kube/config"
    return 0
  fi
  if [[ -r /etc/kubernetes/admin.conf ]]; then
    export KUBECONFIG=/etc/kubernetes/admin.conf
    return 0
  fi
}

wait_for_kube_api() {
  for _ in $(seq 1 60); do
    kubectl get nodes >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

ensure_one_service() {
  local name="$1"
  if systemctl is-active --quiet "$name"; then
    log "$name already active"
    return 0
  fi
  log "start $name"
  if sudo -n true >/dev/null 2>&1; then
    sudo systemctl enable --now "$name" >/dev/null 2>&1 || true
  else
    log "sudo password required to start $name; continuing to Kubernetes API check"
  fi
}

ensure_services() {
  log 'ensure containerd and kubelet'
  ensure_one_service containerd
  ensure_one_service kubelet
}

recover_db() {
  log "ensure DB statefulset $DB_STATEFULSET"
  kubectl -n "$NAMESPACE" rollout status "statefulset/$DB_STATEFULSET" --timeout=180s || {
    log "restart DB statefulset $DB_STATEFULSET"
    kubectl -n "$NAMESPACE" rollout restart "statefulset/$DB_STATEFULSET" || true
    kubectl -n "$NAMESPACE" rollout status "statefulset/$DB_STATEFULSET" --timeout=300s
  }
}

recover_web() {
  log "ensure web deployment $WEB_DEPLOYMENT"
  kubectl -n "$NAMESPACE" rollout status "deployment/$WEB_DEPLOYMENT" --timeout=240s || {
    log "restart web deployment $WEB_DEPLOYMENT"
    kubectl -n "$NAMESPACE" rollout restart "deployment/$WEB_DEPLOYMENT" || true
    kubectl -n "$NAMESPACE" rollout status "deployment/$WEB_DEPLOYMENT" --timeout=420s
  }
}

ensure_endpoints() {
  log "ensure service $WEB_SERVICE has endpoints"
  local max_wait=30
  local waited=0

  while true; do
    local endpoints
    endpoints=$(kubectl -n "$NAMESPACE" get endpoints "$WEB_SERVICE" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || echo "")

    if [[ -n "$endpoints" ]]; then
      log "endpoints OK: $endpoints"
      return 0
    fi

    if (( waited >= max_wait )); then
      log "endpoints still empty after ${max_wait}s, attempting repair"
      break
    fi

    log "waiting for endpoints... (${waited}s/${max_wait}s)"
    sleep 3
    waited=$((waited + 3))
  done

  log "endpoints unavailable; restart deployment without rewriting Service or Endpoints"
  kubectl -n "$NAMESPACE" rollout restart "deployment/$WEB_DEPLOYMENT"
  kubectl -n "$NAMESPACE" rollout status "deployment/$WEB_DEPLOYMENT" --timeout=420s
  [[ -n "$(kubectl -n "$NAMESPACE" get endpoints "$WEB_SERVICE" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null)" ]]
}

ensure_port_80() {
  log "validate service $WEB_SERVICE without mutating deployment or service policy"
  kubectl -n "$NAMESPACE" get "service/$WEB_SERVICE" >/dev/null
}

health_check() {
  if [[ -z "$HEALTH_URL" ]]; then
    local node_port
    node_port="$(kubectl -n "$NAMESPACE" get "service/$WEB_SERVICE" -o jsonpath='{.spec.ports[0].nodePort}')"
    [[ "$node_port" =~ ^[0-9]+$ ]] || {
      log "NodePort unavailable for $WEB_SERVICE"
      return 1
    }
    HEALTH_URL="http://127.0.0.1:${node_port}/actuator/health"
  fi
  log "health check $HEALTH_URL"
  for _ in $(seq 1 60); do
    if curl -fsS --max-time 5 "$HEALTH_URL" >"$RUN_DIR/resonance-up-health.json"; then
      cat "$RUN_DIR/resonance-up-health.json"
      printf '\n'
      return 0
    fi
    sleep 2
  done
  return 1
}

snapshot() {
  log 'cluster snapshot'
  kubectl -n "$NAMESPACE" get deploy,statefulset,svc,pod -o wide || true
}

main() {
  log_event START STARTED 'startup requested'
  ensure_kubeconfig
  command -v kubectl >/dev/null 2>&1 || { log_event FAIL NO_KUBECTL 'kubectl not found'; exit 1; }
  ensure_services
  wait_for_kube_api || { log_event FAIL KUBE_API_DOWN 'kubernetes api not reachable'; exit 1; }
  kubectl get namespace "$NAMESPACE" >/dev/null 2>&1
  recover_db
  recover_web
  ensure_port_80
  ensure_endpoints
  health_check || {
    log_event FAIL HEALTH_FAILED 'health check failed after bounded recovery'
    exit 1
  }
  snapshot
  log_event OK READY 'resonance is up'
  log "READY http://$(hostname -I | awk '{print $1}')/"
}

main "$@"
