#!/usr/bin/env bash
# DEPRECATED: CUBRID 제거됨 — 사용 금지
# PostgreSQL 환경: postgres-patroni-0/1/2 (Patroni HA)
echo "[DEPRECATED] cubrid-k8s-quick: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

# cubrid-k8s-quick.sh - Fast CUBRID Kubernetes StatefulSet management
# Usage: bash ops/scripts/cubrid-k8s-quick.sh [start|stop|restart-broker|monitor|status]
set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
STATEFULSET="cubrid-carbonet"
POD_NAME="cubrid-carbonet-0"
BROKER_PORT="33000"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "[$(date '+%H:%M:%S')] $*"; }
log_ok() { log "${GREEN}✓ $*${NC}"; }
log_warn() { log "${YELLOW}⚠ $*${NC}"; }
log_err() { log "${RED}✗ $*${NC}"; }

clear_host_state() {
    log "Clearing host CUBRID processes and port state..."
    pkill -9 -f "cubrid" 2>/dev/null || true
    pkill -9 -f "cub_broker" 2>/dev/null || true
    pkill -9 -f "cub_server" 2>/dev/null || true
    pkill -9 -f "cub_master" 2>/dev/null || true
    fuser -k ${BROKER_PORT}/tcp 2>/dev/null || true
    fuser -k 1523/tcp 2>/dev/null || true
    sleep 2
    log_ok "Host state cleared"
}

refresh_kubelet() {
    log "Refreshing kubelet port cache..."
    kubectl patch node ccus --type=merge -p \
        "{\"metadata\":{\"annotations\":{\"force-sync\":\"$(date +%s)\"}}}" 2>/dev/null || true
}

start_cubrid() {
    clear_host_state
    refresh_kubelet
    
    log "Starting CUBRID StatefulSet..."
    
    kubectl delete pod ${POD_NAME} -n ${NAMESPACE} --grace-period=0 2>/dev/null || true
    sleep 3
    
    log "Waiting for pod to start (timeout 90s)..."
    if kubectl wait --for=condition=Ready pod/${POD_NAME} -n ${NAMESPACE} --timeout=90s 2>/dev/null; then
        log_ok "Pod is Running"
        sleep 5
        
        if kubectl exec -n ${NAMESPACE} ${POD_NAME} -- \
            sh -c "cubrid broker status" >/dev/null 2>&1; then
            log_ok "CUBRID broker is ready on port ${BROKER_PORT}"
            return 0
        else
            log_warn "Broker not fully ready, checking status..."
            kubectl exec -n ${NAMESPACE} ${POD_NAME} -- sh -c "cubrid broker status" 2>&1 | tail -5
            return 0
        fi
    else
        log_err "Pod failed to start"
        kubectl describe pod -n ${NAMESPACE} ${POD_NAME} | tail -20
        return 1
    fi
}

stop_cubrid() {
    log "Stopping CUBRID..."
    kubectl exec -n ${NAMESPACE} ${POD_NAME} -- \
        sh -c "cubrid broker stop && cubrid server stop carbonet && cubrid service stop" \
        2>/dev/null || true
    kubectl delete pod ${POD_NAME} -n ${NAMESPACE} --grace-period=30 2>/dev/null || true
    clear_host_state
    log_ok "CUBRID stopped"
}

restart_broker() {
    log "Restarting broker..."
    kubectl exec -n ${NAMESPACE} ${POD_NAME} -- \
        sh -c "pkill -HUP cub_broker || cubrid broker stop && sleep 1 && cubrid broker start" 2>/dev/null
    sleep 5
    
    local retry=3
    while [[ $retry -gt 0 ]]; do
        if kubectl exec -n ${NAMESPACE} ${POD_NAME} -- \
            sh -c "cubrid broker status" >/dev/null 2>&1; then
            log_ok "Broker restarted successfully"
            return 0
        fi
        ((retry--))
        sleep 2
    done
    log_err "Broker restart failed"
    return 1
}

monitor_and_restart() {
    log "Starting broker monitor (Ctrl+C to stop)..."
    local count=0
    
    while true; do
        if kubectl exec -n ${NAMESPACE} ${POD_NAME} -- \
            sh -c "cubrid broker status" >/dev/null 2>&1; then
            ((count++))
            echo -ne "\r[$(date '+%H:%M:%S')] Broker OK (check #$count)  "
        else
            echo
            log_warn "Broker not responding, restarting..."
            restart_broker
            count=0
        fi
        sleep 10
    done
}

status_cubrid() {
    echo ""
    echo "=== CUBRID K8s Status ==="
    kubectl get pod ${POD_NAME} -n ${NAMESPACE} -o wide 2>/dev/null || echo "Pod not found"
    echo ""
    echo "--- Port ${BROKER_PORT} on host ---"
    ss -tlnp 2>/dev/null | grep ${BROKER_PORT} || echo "Not listening"
    echo ""
    echo "--- CUBRID processes on host ---"
    ps aux | grep -E "cubrid|cub_server|cub_broker|cub_master" | grep -v grep || echo "No host processes"
    echo ""
    echo "--- Broker status in pod ---"
    kubectl exec -n ${NAMESPACE} ${POD_NAME} -- sh -c "cubrid broker status" 2>/dev/null | head -10 || echo "Cannot get broker status"
    echo ""
}

case "${1:-status}" in
    start)
        start_cubrid
        ;;
    stop)
        stop_cubrid
        ;;
    restart-broker)
        restart_broker
        ;;
    monitor)
        monitor_and_restart
        ;;
    status|*)
        status_cubrid
        ;;
esac