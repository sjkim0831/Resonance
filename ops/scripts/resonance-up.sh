#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
WEB_DEPLOYMENT="${WEB_DEPLOYMENT:-carbonet-runtime}"
WEB_SERVICE="${WEB_SERVICE:-carbonet-runtime}"
DB_STATEFULSET="${DB_STATEFULSET:-cubrid-carbonet}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1/actuator/health}"
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
  if [[ -r "$HOME/.kube/config" ]]; then
    export KUBECONFIG="$HOME/.kube/config"
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
  kubectl -n "$NAMESPACE" scale "deployment/$WEB_DEPLOYMENT" --replicas="${WEB_REPLICAS:-2}" || true
  kubectl -n "$NAMESPACE" rollout status "deployment/$WEB_DEPLOYMENT" --timeout=240s || {
    log "restart web deployment $WEB_DEPLOYMENT"
    kubectl -n "$NAMESPACE" rollout restart "deployment/$WEB_DEPLOYMENT" || true
    kubectl -n "$NAMESPACE" rollout status "deployment/$WEB_DEPLOYMENT" --timeout=420s
  }
}

ensure_port_80() {
  log "ensure service $WEB_SERVICE port 80"
  kubectl -n "$NAMESPACE" patch "service/$WEB_SERVICE" --type merge -p '{"spec":{"type":"NodePort"}}' >/dev/null || true
  kubectl -n "$NAMESPACE" patch "service/$WEB_SERVICE" --type json -p='[{"op":"replace","path":"/spec/ports","value":[{"name":"http","port":80,"targetPort":"http","nodePort":80,"protocol":"TCP"}]}]' >/dev/null || true

 log "ensure java opts on $WEB_DEPLOYMENT (no resource limits)"
  kubectl -n "$NAMESPACE" patch "deployment/$WEB_DEPLOYMENT" --type json -p='[
    {"op":"remove","path":"/spec/template/spec/containers/0/resources"}
  ]' >/dev/null || true
  kubectl -n "$NAMESPACE" set env deployment/$WEB_DEPLOYMENT \
    JAVA_OPTS="-XX:+UseContainerSupport -XX:InitialRAMPercentage=30 -XX:MaxRAMPercentage=50 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8" \
    -n "$NAMESPACE" >/dev/null || true

  log "ensure HA policy"
  kubectl -n "$NAMESPACE" scale "deployment/$WEB_DEPLOYMENT" --replicas=2 >/dev/null || true
  kubectl -n "$NAMESPACE" patch "deployment/$WEB_DEPLOYMENT" --type strategic --patch-file /dev/stdin <<'PATCH' >/dev/null || true
spec:
  replicas: 2
  minReadySeconds: 20
  revisionHistoryLimit: 5
  progressDeadlineSeconds: 600
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  template:
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: carbonet-runtime
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 10"]
PATCH
}

health_check() {
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
  kubectl get namespace "$NAMESPACE" >/dev/null
  recover_db
  recover_web
  ensure_port_80
  health_check || {
    log 'health failed, try existing 80 repair deploy without rebuilding'
    if [[ -x "$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80.sh" ]]; then
      SKIP_FRONTEND="${REPAIR_SKIP_FRONTEND:-true}" SKIP_MAVEN="${REPAIR_SKIP_MAVEN:-true}" SKIP_IMAGE_BUILD="${REPAIR_SKIP_IMAGE_BUILD:-true}" \
        "$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80.sh"
      health_check
    else
      log_event FAIL HEALTH_FAILED 'health check failed and repair script missing'
      exit 1
    fi
  }
  snapshot
  log_event OK READY 'resonance is up'
  log "READY http://$(hostname -I | awk '{print $1}')/"
}

main "$@"
