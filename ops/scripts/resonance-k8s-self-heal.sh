#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
WEB_URL="${WEB_URL:-http://127.0.0.1:8080}"
LOG_FILE="${LOG_FILE:-/var/log/resonance-k8s-self-heal.log}"
LOCK_FILE="${LOCK_FILE:-/var/lock/resonance-k8s-self-heal.lock}"
REBUILD_ON_FAILURE="${REBUILD_ON_FAILURE:-true}"
LATENCY_URL="${LATENCY_URL:-${WEB_URL}/admin/system/menu}"
LATENCY_LIMIT_SECONDS="${LATENCY_LIMIT_SECONDS:-2.0}"
LATENCY_FAILURE_FILE="${LATENCY_FAILURE_FILE:-/run/resonance-runtime-latency.failures}"
RUNTIME_RESTART_STAMP="${RUNTIME_RESTART_STAMP:-/run/resonance-runtime-last-restart}"
RUNTIME_RESTART_COOLDOWN="${RUNTIME_RESTART_COOLDOWN:-600}"

mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$LOCK_FILE")"
exec >>"$LOG_FILE" 2>&1
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "$(date -Is) another self-heal run is active"; exit 0; }

log() {
  printf '[resonance-self-heal] %s %s\n' "$(date -Is)" "$*"
}

runtime_restart_allowed() {
  local now last=0
  now=$(date +%s)
  [[ -f "$RUNTIME_RESTART_STAMP" ]] && read -r last <"$RUNTIME_RESTART_STAMP" || true
  (( now - last >= RUNTIME_RESTART_COOLDOWN ))
}

restart_runtime_for_latency() {
  if ! runtime_restart_allowed; then
    log 'runtime latency recovery suppressed by cooldown'
    return 0
  fi
  date +%s >"$RUNTIME_RESTART_STAMP"
  log 'runtime latency threshold exceeded twice; restarting deployment'
  kubectl -n "$NAMESPACE" rollout restart deployment/carbonet-runtime
  kubectl -n "$NAMESPACE" rollout status deployment/carbonet-runtime --timeout=300s
}

ensure_runtime_latency() {
  local result code seconds failures=0
  result=$(curl -sS -o /dev/null --max-time 8 -w '%{http_code} %{time_starttransfer}' "$LATENCY_URL" 2>/dev/null || printf '000 8.0')
  read -r code seconds <<<"$result"
  [[ -f "$LATENCY_FAILURE_FILE" ]] && read -r failures <"$LATENCY_FAILURE_FILE" || true

  if [[ "$code" =~ ^(200|301|302|303|307|308)$ ]] && awk -v value="$seconds" -v limit="$LATENCY_LIMIT_SECONDS" 'BEGIN { exit !(value <= limit) }'; then
    printf '0\n' >"$LATENCY_FAILURE_FILE"
    log "runtime latency ok code=$code ttfb=${seconds}s"
    return 0
  fi

  failures=$((failures + 1))
  printf '%s\n' "$failures" >"$LATENCY_FAILURE_FILE"
  log "runtime latency warning code=$code ttfb=${seconds}s consecutive=$failures"
  if (( failures >= 2 )); then
    restart_runtime_for_latency || true
    printf '0\n' >"$LATENCY_FAILURE_FILE"
  fi
}

ensure_redis() {
  local unavailable
  unavailable=$(kubectl -n "$NAMESPACE" get statefulset carbonet-redis -o jsonpath='{.status.currentReplicas} {.status.readyReplicas}' 2>/dev/null || true)
  [[ "$unavailable" == "3 3" ]] && return 0

  log "redis not ready current/ready=${unavailable:-unknown}"
  if kubectl -n "$NAMESPACE" describe pods -l app=redis 2>/dev/null | grep -q 'current working directory is outside of container mount namespace root'; then
    log 'redis OCI namespace failure detected; recreating stateless Redis pods'
    kubectl -n "$NAMESPACE" delete pod -l app=redis --wait=false || true
    kubectl -n "$NAMESPACE" rollout status statefulset/carbonet-redis --timeout=180s || true
  fi
}

ensure_zero_downtime() {
  local name replicas unavailable surge
  for name in carbonet-runtime carbonet-web; do
    replicas=$(kubectl -n "$NAMESPACE" get deployment "$name" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo 0)
    unavailable=$(kubectl -n "$NAMESPACE" get deployment "$name" -o jsonpath='{.spec.strategy.rollingUpdate.maxUnavailable}' 2>/dev/null || true)
    surge=$(kubectl -n "$NAMESPACE" get deployment "$name" -o jsonpath='{.spec.strategy.rollingUpdate.maxSurge}' 2>/dev/null || true)
    if [[ ! "$replicas" =~ ^[0-9]+$ || "$replicas" -lt 2 || ( "$unavailable" != "0" && "$unavailable" != "0%" ) || -z "$surge" || "$surge" == "0" || "$surge" == "0%" ]]; then
      log "repairing zero-downtime policy for deployment/$name"
      kubectl -n "$NAMESPACE" patch deployment "$name" --type=merge \
        -p '{"spec":{"replicas":2,"strategy":{"type":"RollingUpdate","rollingUpdate":{"maxUnavailable":0,"maxSurge":1}}}}' || true
    fi
  done
  kubectl -n "$NAMESPACE" patch hpa carbonet-runtime-hpa --type=merge \
    -p '{"spec":{"minReplicas":2,"maxReplicas":3}}' >/dev/null 2>&1 || true
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

REGISTRY_HOST="${REGISTRY_HOST:-registry.local}"
REGISTRY_IP="${REGISTRY_IP:-10.0.0.100}"

check_registry_dns() {
  if nslookup "$REGISTRY_HOST" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

repair_registry_dns() {
  log "registry DNS ($REGISTRY_HOST) not resolving, attempting repair"
  if systemctl is-active --quiet systemd-resolved; then
    log "restarting systemd-resolved"
    systemctl restart systemd-resolved 2>/dev/null || true
    sleep 3
  fi

  if ! check_registry_dns; then
    log "adding $REGISTRY_HOST to /etc/hosts as fallback"
    if ! grep -q "$REGISTRY_HOST" /etc/hosts 2>/dev/null; then
      echo "$REGISTRY_IP $REGISTRY_HOST" >> /etc/hosts 2>/dev/null || true
    fi
    sleep 2
  fi

  if check_registry_dns; then
    log "registry DNS restored"
    return 0
  fi
  log "registry DNS repair failed"
  return 1
}

ensure_system_services() {
  if ! check_registry_dns; then
    repair_registry_dns || true
  fi

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

ensure_postgres() {
  if ! kubectl -n "$NAMESPACE" wait --for=condition=Ready pod/postgres-patroni-0 --timeout=20s >/dev/null 2>&1; then
    log 'postgres-patroni-0 pod not ready, retrying...'
    sleep 10
    kubectl -n "$NAMESPACE" wait --for=condition=Ready pod/postgres-patroni-0 --timeout=120s || true
  fi
  if ! kubectl -n "$NAMESPACE" exec postgres-patroni-0 -- bash -lc 'pg_isready -h localhost -p 5432 -U postgres' >/dev/null 2>&1; then
    log 'PostgreSQL service unhealthy, checking patroni...'
    kubectl -n "$NAMESPACE" exec postgres-patroni-0 -- bash -lc 'patronictl list' 2>&1 | head -5 || true
  fi
}

ensure_db_compatibility() {
  if ! kubectl -n "$NAMESPACE" exec postgres-patroni-0 -- bash -lc 'psql -U postgres -d carbonet -c "SELECT column_name FROM information_schema.columns WHERE table_name = '\''access_event'\'' AND column_name = '\''project_id'\'';"' 2>/dev/null | grep -q "project_id"; then
    log 'patching ACCESS_EVENT.PROJECT_ID compatibility column'
    kubectl -n "$NAMESPACE" exec postgres-patroni-0 -- bash -lc 'psql -U postgres -d carbonet -c "ALTER TABLE access_event ADD COLUMN IF NOT EXISTS project_id VARCHAR(40) DEFAULT '\''carbonet'\''; CREATE INDEX IF NOT EXISTS idx_access_event_project ON access_event(project_id);"' >/dev/null 2>&1 || true
  fi
}

ensure_runtime() {
  if ! kubectl -n "$NAMESPACE" rollout status deployment/carbonet-runtime --timeout=10s >/dev/null 2>&1; then
    log 'runtime deployment not rolled out, restarting'
    kubectl -n "$NAMESPACE" rollout restart deployment/carbonet-runtime || true
    kubectl -n "$NAMESPACE" rollout status deployment/carbonet-runtime --timeout=300s || true
  fi

  ensure_endpoints || true

  if curl -fsS --max-time 10 "$WEB_URL/actuator/health" >/dev/null 2>&1; then
    log 'runtime health ok'
    return 0
  fi
  log 'runtime health failed, restarting deployment'
  kubectl -n "$NAMESPACE" rollout restart deployment/carbonet-runtime || true
  kubectl -n "$NAMESPACE" rollout status deployment/carbonet-runtime --timeout=300s || true

  ensure_endpoints || true

  if curl -fsS --max-time 10 "$WEB_URL/actuator/health" >/dev/null 2>&1; then
    log 'runtime recovered after restart'
    return 0
  fi
  log 'runtime still unhealthy, attempting service recreation'
  recover_service || true

  ensure_endpoints || true

  if curl -fsS --max-time 10 "$WEB_URL/actuator/health" >/dev/null 2>&1; then
    log 'runtime recovered after service recreation'
    return 0
  fi
  if [[ "$REBUILD_ON_FAILURE" == "true" && -x "$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80.sh" ]]; then
    log 'runtime still unhealthy, rebuilding and redeploying'
    (cd "$ROOT_DIR" && SKIP_FRONTEND="${SELF_HEAL_SKIP_FRONTEND:-false}" SKIP_MAVEN_CLEAN=true RESONANCE_AUTO_GIT_COMMIT="${RESONANCE_AUTO_GIT_COMMIT:-false}" RESONANCE_AUTO_GIT_PUSH="${RESONANCE_AUTO_GIT_PUSH:-false}" bash ops/scripts/resonance-k8s-build-deploy-80.sh) || true
  fi
}

ensure_endpoints() {
  local endpoints
  endpoints=$(kubectl -n "$NAMESPACE" get endpoints carbonet-runtime -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || echo "")

  if [[ -n "$endpoints" ]]; then
    log "endpoints OK: $endpoints"
    return 0
  fi

  log "endpoints empty, repairing"
  repair_endpoints
  return $?
}

repair_endpoints() {
  local pod_ips
  pod_ips=$(kubectl -n "$NAMESPACE" get pods -l app=carbonet-runtime \
    --field-selector=status.phase=Running \
    -o jsonpath='{range .items[*]}{.status.podIP}{"\n"}{end}' 2>/dev/null | grep -v '^$')

  local pod_count
  pod_count=$(echo "$pod_ips" | grep -c . || echo 0)

  if [[ "$pod_count" -eq 0 ]]; then
    log "no running pods found for endpoint repair"
    return 1
  fi

  log "repair endpoints with pods: $(echo "$pod_ips" | tr '\n' ' ')"

  kubectl -n "$NAMESPACE" delete endpoints carbonet-runtime --ignore-not-found=true >/dev/null 2>&1 || true

  cat <<EOF | kubectl apply -f - >/dev/null 2>&1
apiVersion: v1
kind: Endpoints
metadata:
  name: carbonet-runtime
  namespace: $NAMESPACE
  labels:
    app: carbonet-runtime
subsets:
- addresses:
$(echo "$pod_ips" | sed 's/^/  - ip: /')
  ports:
  - port: 8080
    protocol: TCP
EOF
  return $?
}

recover_service() {
  log "repairing split API and Web services"
  kubectl -n "$NAMESPACE" patch service carbonet-api --type=merge \
    -p '{"spec":{"selector":{"app":"carbonet-runtime"}}}' >/dev/null 2>&1 || true
  kubectl -n "$NAMESPACE" patch service carbonet-web --type=merge \
    -p '{"spec":{"selector":{"app":"carbonet-web"}}}' >/dev/null 2>&1 || true
  sleep 2
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
  ensure_postgres
  ensure_db_compatibility
  ensure_redis
  ensure_zero_downtime
  ensure_runtime
  ensure_runtime_latency
  prune_images
  kubectl -n "$NAMESPACE" get pods -o wide || true
  log 'done'
}

main
