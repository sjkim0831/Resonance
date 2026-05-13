#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
WEB_URL="${WEB_URL:-http://127.0.0.1:18080}"
LOG_FILE="${LOG_FILE:-/var/log/resonance-k8s-self-heal.log}"
LOCK_FILE="${LOCK_FILE:-/var/lock/resonance-k8s-self-heal.lock}"
REBUILD_ON_FAILURE="${REBUILD_ON_FAILURE:-true}"

mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$LOCK_FILE")"
exec >>"$LOG_FILE" 2>&1
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "$(date -Is) another self-heal run is active"; exit 0; }

log() {
  printf '[resonance-self-heal] %s %s\n' "$(date -Is)" "$*"
}

kubectl_ok() {
  kubectl get nodes >/dev/null 2>&1
}

restart_node_services() {
  log 'restarting node services containerd/kubelet'
  systemctl restart containerd || true
  systemctl restart kubelet || true
  sleep 10
}

cleanup_cni_leftovers() {
  ip route del 10.244.0.0/24 via 10.244.0.74 dev cilium_host 2>/dev/null || true
  ip link del cilium_host 2>/dev/null || true
  ip link del cilium_net 2>/dev/null || true
  ip link del cilium_vxlan 2>/dev/null || true
  if ip link show flannel.1 >/dev/null 2>&1 && kubectl -n kube-flannel get cm kube-flannel-cfg -o jsonpath='{.data.net-conf\.json}' 2>/dev/null | grep -q 'host-gw'; then
    ip link del flannel.1 2>/dev/null || true
  fi
}

ensure_system_services() {
  systemctl is-active --quiet containerd || systemctl restart containerd || true
  systemctl is-active --quiet kubelet || systemctl restart kubelet || true
  if ! kubectl_ok; then
    restart_node_services
  fi
}

rollout_if_not_ready() {
  local namespace="$1" kind="$2" name="$3" timeout="${4:-180s}"
  if ! kubectl -n "$namespace" rollout status "$kind/$name" --timeout=5s >/dev/null 2>&1; then
    log "rollout repair $namespace $kind/$name"
    kubectl -n "$namespace" rollout restart "$kind/$name" || true
    kubectl -n "$namespace" rollout status "$kind/$name" --timeout="$timeout" || true
  fi
}

ensure_cluster_addons() {
  cleanup_cni_leftovers
  rollout_if_not_ready kube-system deployment coredns 180s
  rollout_if_not_ready kube-flannel daemonset kube-flannel-ds 180s
}

ensure_cubrid() {
  if ! kubectl -n "$NAMESPACE" wait --for=condition=Ready pod/cubrid-carbonet-0 --timeout=20s >/dev/null 2>&1; then
    log 'cubrid pod not ready, deleting for statefulset recreation'
    kubectl -n "$NAMESPACE" delete pod cubrid-carbonet-0 --grace-period=30 --ignore-not-found=true || true
    kubectl -n "$NAMESPACE" wait --for=condition=Ready pod/cubrid-carbonet-0 --timeout=300s || true
  fi
  if ! kubectl -n "$NAMESPACE" exec cubrid-carbonet-0 -- bash -lc 'cubrid server status carbonet >/dev/null && cubrid broker status >/dev/null' >/dev/null 2>&1; then
    log 'cubrid service unhealthy, restarting inside pod'
    kubectl -n "$NAMESPACE" exec cubrid-carbonet-0 -- bash -lc 'cubrid service restart || true; cubrid server start carbonet || true; cubrid broker restart || true' || true
  fi
}

ensure_db_compatibility() {
  if ! kubectl -n "$NAMESPACE" exec cubrid-carbonet-0 -- bash -lc 'csql -u dba carbonet -c "SHOW COLUMNS FROM ACCESS_EVENT;" | grep -qi "project_id"' >/dev/null 2>&1; then
    log 'patching ACCESS_EVENT.PROJECT_ID compatibility column'
    kubectl -n "$NAMESPACE" exec cubrid-carbonet-0 -- bash -lc 'cat >/tmp/access_event_project_id.sql <<SQL
ALTER TABLE ACCESS_EVENT ADD COLUMN PROJECT_ID VARCHAR(40) DEFAULT '\''carbonet'\'';
CREATE INDEX IDX_ACCESS_EVENT_PROJECT ON ACCESS_EVENT(PROJECT_ID);
SQL
csql -u dba carbonet -i /tmp/access_event_project_id.sql' || true
  fi
}

ensure_runtime() {
  if ! kubectl -n "$NAMESPACE" rollout status deployment/carbonet-runtime --timeout=10s >/dev/null 2>&1; then
    log 'runtime deployment not rolled out, restarting'
    kubectl -n "$NAMESPACE" rollout restart deployment/carbonet-runtime || true
    kubectl -n "$NAMESPACE" rollout status deployment/carbonet-runtime --timeout=300s || true
  fi
  if curl -fsS --max-time 10 "$WEB_URL/actuator/health" >/dev/null 2>&1; then
    log 'runtime health ok'
    return 0
  fi
  log 'runtime health failed, restarting deployment'
  kubectl -n "$NAMESPACE" rollout restart deployment/carbonet-runtime || true
  kubectl -n "$NAMESPACE" rollout status deployment/carbonet-runtime --timeout=300s || true
  if curl -fsS --max-time 10 "$WEB_URL/actuator/health" >/dev/null 2>&1; then
    log 'runtime recovered after restart'
    return 0
  fi
  if [[ "$REBUILD_ON_FAILURE" == "true" && -x "$ROOT_DIR/ops/scripts/deploy-carbonet-kubeadm-k8s.sh" ]]; then
    log 'runtime still unhealthy, rebuilding and redeploying'
    (cd "$ROOT_DIR" && SKIP_FRONTEND="${SELF_HEAL_SKIP_FRONTEND:-false}" SKIP_MAVEN_CLEAN=true RESONANCE_AUTO_GIT_COMMIT="${RESONANCE_AUTO_GIT_COMMIT:-false}" RESONANCE_AUTO_GIT_PUSH="${RESONANCE_AUTO_GIT_PUSH:-false}" bash ops/scripts/deploy-carbonet-kubeadm-k8s.sh) || true
  fi
}

prune_images() {
  if [[ "${PRUNE_IMAGES:-false}" == "true" ]]; then
    crictl rmi --prune >/dev/null 2>&1 || true
    docker image prune -f >/dev/null 2>&1 || true
  fi
}

main() {
  log 'start'
  ensure_system_services
  ensure_cluster_addons
  ensure_cubrid
  ensure_db_compatibility
  ensure_runtime
  prune_images
  kubectl -n "$NAMESPACE" get pods -o wide || true
  log 'done'
}

main
