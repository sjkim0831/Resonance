#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
WEB_DEPLOYMENT="${WEB_DEPLOYMENT:-carbonet-runtime}"
WEB_SERVICE="${WEB_SERVICE:-carbonet-runtime}"
DB_STATEFULSET="${DB_STATEFULSET:-cubrid-carbonet}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1/actuator/health}"

STEP="${1:-}"
[[ -z "$STEP" ]] && {
  echo "Usage: $0 <step>"
  echo ""
  echo "Steps:"
  echo "  1  - ensure-kubeconfig"
  echo "  2  - ensure-services"
  echo "  3  - wait-for-kube-api"
  echo "  4  - check-namespace"
  echo "  5  - recover-db"
  echo "  6  - recover-web"
  echo "  7  - ensure-port-80"
  echo "  8  - ensure-endpoints"
  echo "  9  - health-check"
  echo "  10 - snapshot"
  echo "  all - run all steps"
  exit 0
}

log() { echo "[resonance-up:$STEP] $*"; }

sudo_cmd() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then "$@"; else sudo "$@"; fi
}

ensure_one_service() {
  local name="$1"
  if systemctl is-active --quiet "$name"; then
    log "$name already active"; return 0
  fi
  log "start $name"
  sudo_cmd systemctl enable --now "$name" >/dev/null 2>&1 || true
}

# Step 1
step_1() {
  log "checking kubeconfig"
  if [[ -n "${KUBECONFIG:-}" && -r "${KUBECONFIG:-}" ]]; then
    log "KUBECONFIG=$KUBECONFIG OK"; return 0
  fi
  if [[ -r "$HOME/.kube/config" ]]; then
    export KUBECONFIG="$HOME/.kube/config"
    log "using $HOME/.kube/config"; return 0
  fi
  if [[ -r /etc/kubernetes/admin.conf ]]; then
    export KUBECONFIG=/etc/kubernetes/admin.conf
    log "using /etc/kubernetes/admin.conf"; return 0
  fi
  log "ERROR: no kubeconfig found"; return 1
}

# Step 2
step_2() {
  log "ensure containerd and kubelet"
  ensure_one_service containerd
  ensure_one_service kubelet
}

# Step 3
step_3() {
  log "wait for kubernetes API (max 120s)"
  for i in $(seq 1 60); do
    if kubectl get nodes >/dev/null 2>&1; then
      log "API OK after ${i}s"; return 0
    fi
    echo -n "."
    sleep 2
  done
  echo ""
  log "ERROR: kubernetes API not reachable"; return 1
}

# Step 4
step_4() {
  log "check namespace $NAMESPACE"
  if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    log "namespace $NAMESPACE OK"
    kubectl -n "$NAMESPACE" get pods -o wide | head -20
    return 0
  fi
  log "ERROR: namespace $NAMESPACE not found"; return 1
}

# Step 5
step_5() {
  log "ensure DB statefulset $DB_STATEFULSET"
  if kubectl -n "$NAMESPACE" rollout status "statefulset/$DB_STATEFULSET" --timeout=30s >/dev/null 2>&1; then
    log "DB OK"; return 0
  fi
  log "restart DB statefulset..."
  kubectl -n "$NAMESPACE" rollout restart "statefulset/$DB_STATEFULSET" || true
  kubectl -n "$NAMESPACE" rollout status "statefulset/$DB_STATEFULSET" --timeout=300s
  log "DB recovered"
}

# Step 6
step_6() {
  log "ensure web deployment $WEB_DEPLOYMENT"
  kubectl -n "$NAMESPACE" get deploy,pod -l app="$WEB_DEPLOYMENT" -o wide 2>&1 | head -10

  log "scale to 2 replicas"
  kubectl -n "$NAMESPACE" scale "deployment/$WEB_DEPLOYMENT" --replicas=2 || true

  if kubectl -n "$NAMESPACE" rollout status "deployment/$WEB_DEPLOYMENT" --timeout=60s >/dev/null 2>&1; then
    log "rollout OK"
  else
    log "rollout timeout - checking pod status..."
    kubectl -n "$NAMESPACE" get pods -l app="$WEB_DEPLOYMENT"
    kubectl -n "$NAMESPACE" describe deploy "$WEB_DEPLOYMENT" | tail -20
  fi
}

# Step 7
step_7() {
  log "ensure port 80 on service"
  kubectl -n "$NAMESPACE" get svc "$WEB_SERVICE" -o yaml | grep -E "port:|nodePort:" || true

  kubectl -n "$NAMESPACE" patch "service/$WEB_SERVICE" --type merge -p '{"spec":{"type":"NodePort"}}' >/dev/null 2>&1 || true

  log "ensure JAVA_OPTS on deployment"
  kubectl -n "$NAMESPACE" set env deployment/$WEB_DEPLOYMENT \
    JAVA_OPTS="-XX:+UseContainerSupport -XX:InitialRAMPercentage=30 -XX:MaxRAMPercentage=50 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8" \
    -n "$NAMESPACE" 2>&1 || true

  log "check deployment env vars"
  kubectl -n "$NAMESPACE" get deploy "$WEB_DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].env}' 2>/dev/null | python3 -m json.tool 2>/dev/null | grep -E "TOKEN|JAVA" || true
}

# Step 8
step_8() {
  log "check endpoints for $WEB_SERVICE"
  local endpoints
  endpoints=$(kubectl -n "$NAMESPACE" get endpoints "$WEB_SERVICE" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || echo "")

  if [[ -n "$endpoints" ]]; then
    log "endpoints OK: $endpoints"; return 0
  fi

  log "no endpoints - check pod IPs"
  local pod_ips
  pod_ips=$(kubectl -n "$NAMESPACE" get pods -l app="$WEB_SERVICE" \
    --field-selector=status.phase=Running \
    -o jsonpath='{range .items[*]}{.status.podIP}{"\n"}{end}' 2>/dev/null | grep -v '^$')

  local pod_count
  pod_count=$(echo "$pod_ips" | grep -c . || echo 0)
  log "running pods: $pod_count"

  if [[ "$pod_count" -eq 0 ]]; then
    log "no running pods - cannot repair endpoints"
    return 1
  fi

  log "delete old endpoints"
  kubectl -n "$NAMESPACE" delete endpoints "$WEB_SERVICE" --ignore-not-found=true >/dev/null 2>&1 || true

  log "create endpoints manually"
  cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Endpoints
metadata:
  name: $WEB_SERVICE
  namespace: $NAMESPACE
  labels:
    app: $WEB_SERVICE
subsets:
- addresses:
$(echo "$pod_ips" | sed 's/^/  - ip: /')
  ports:
  - port: 8080
    protocol: TCP
EOF
}

# Step 9
step_9() {
  log "health check $HEALTH_URL"
  for i in $(seq 1 30); do
    if curl -fsS --max-time 5 "$HEALTH_URL" >/tmp/health.json 2>&1; then
      log "OK"
      cat /tmp/health.json
      return 0
    fi
    echo -n "."
    sleep 2
  done
  echo ""
  log "health check FAILED"
  kubectl -n "$NAMESPACE" logs deploy/"$WEB_DEPLOYMENT" --tail=50 2>&1 || true
  return 1
}

# Step 10
step_10() {
  log "cluster snapshot"
  echo "=== Deployments ==="
  kubectl -n "$NAMESPACE" get deploy -o wide
  echo ""
  echo "=== StatefulSets ==="
  kubectl -n "$NAMESPACE" get statefulset -o wide
  echo ""
  echo "=== Services ==="
  kubectl -n "$NAMESPACE" get svc -o wide
  echo ""
  echo "=== Pods ==="
  kubectl -n "$NAMESPACE" get pods -o wide
}

case "$STEP" in
  1) step_1 ;;
  2) step_2 ;;
  3) step_3 ;;
  4) step_4 ;;
  5) step_5 ;;
  6) step_6 ;;
  7) step_7 ;;
  8) step_8 ;;
  9) step_9 ;;
  10) step_10 ;;
  all)
    for i in 1 2 3 4 5 6 7 8 9 10; do
      echo ""
      echo "=== STEP $i ==="
      "step_$i" || { echo "STEP $i FAILED"; exit 1; }
    done
    ;;
esac