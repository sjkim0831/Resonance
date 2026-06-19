# CUBRID Kubernetes StatefulSet Fast Start/Stop Harness

## Problem Statement
- CUBRID 1.3GB database in Kubernetes StatefulSet
- Port 33000 conflict prevents pod scheduling (kubelet stale cache)
- Need reliable start/stop in <30 seconds when broker is healthy
- Auto-restart on broker failure required

## Current State
- **Data**: `/opt/Resonance/data/cubrid` (1.3GB carbonet DB)
- **CUBRID image**: `cubrid/cubrid:11.2`
- **Namespace**: `carbonet-prod`
- **Broker port**: 33000 (hostPort)
- **Server port**: 1523 (internal)
- **DBA password**: `qwer1234`
- **Service**: `cubrid-carbonet` (ClusterIP:33000)
- **Pod**: `cubrid-carbonet-0` (Pending - port conflict)

## Root Causes of Current Failure
1. **Stale kubelet port cache**: Previous CUBRID process killed but kubelet still thinks port 33000 is in use
2. **Multiple old processes**: cub_master, cub_server, cub_broker from previous runs not properly cleaned up
3. **No CUBRID binaries on host**: External `/home/cubrid/` was deleted

## Solution: `cubrid-k8s-quick.sh` Harness

### Design Goals
- Start/restart CUBRID StatefulSet in **<30 seconds** (no recovery needed)
- Clear kubelet stale port cache
- Auto-restart broker on failure
- Verify connectivity before reporting success

### Implementation

```bash
#!/usr/bin/env bash
# cubrid-k8s-quick.sh - Fast CUBRID K8s StatefulSet management
set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
STATEFULSET="cubrid-carbonet"
POD_NAME="cubrid-carbonet-0"
BROKER_PORT="33000"
EXPECTED_PORT="33000"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# Force clear all CUBRID processes and port state on HOST
clear_host_state() {
    log "Clearing host CUBRID processes and port state..."
    
    # Kill ALL cubrid processes
    pkill -9 -f "cubrid" 2>/dev/null || true
    pkill -9 -f "cub_broker" 2>/dev/null || true
    pkill -9 -f "cub_server" 2>/dev/null || true
    pkill -9 -f "cub_master" 2>/dev/null || true
    
    # Force clear port
    fuser -k ${BROKER_PORT}/tcp 2>/dev/null || true
    fuser -k 1523/tcp 2>/dev/null || true
    
    sleep 2
    log "Host state cleared"
}

# Refresh kubelet's view of ports
refresh_kubelet() {
    log "Refreshing kubelet port cache..."
    
    # Trigger node sync
    kubectl patch node ccus --type=merge -p \
        "{\"metadata\":{\"annotations\":{\"force-sync\":\"$(date +%s)\"}}}"
    
    # Restart kubelet if fuser shows port still held
    if fuser ${BROKER_PORT}/tcp 2>/dev/null | grep -q .; then
        log "Port still held, restarting kubelet..."
        systemctl restart kubelet
        sleep 3
    fi
}

# Start CUBRID StatefulSet
start_cubrid() {
    clear_host_state
    
    log "Starting CUBRID StatefulSet..."
    
    # Delete existing pod to force fresh schedule
    kubectl delete pod ${POD_NAME} -n ${NAMESPACE} --grace-period=0 2>/dev/null || true
    sleep 2
    
    # Wait for pod to schedule and start
    log "Waiting for pod to start (timeout 60s)..."
    if kubectl wait --for=condition=Ready pod/${POD_NAME} -n ${NAMESPACE} --timeout=60s 2>/dev/null; then
        log "Pod is Running"
        
        # Wait for broker to be ready
        sleep 5
        
        # Check broker connectivity
        if kubectl exec -n ${NAMESPACE} ${POD_NAME} -- \
            sh -c "cubrid broker status" >/dev/null 2>&1; then
            log "SUCCESS: CUBRID broker is ready"
            return 0
        else
            log "Broker not ready, checking logs..."
            kubectl logs -n ${NAMESPACE} ${POD_NAME} --tail=20
            return 1
        fi
    else
        log "Pod failed to start"
        kubectl describe pod -n ${NAMESPACE} ${POD_NAME}
        return 1
    fi
}

# Stop CUBRID (graceful)
stop_cubrid() {
    log "Stopping CUBRID..."
    kubectl exec -n ${NAMESPACE} ${POD_NAME} -- \
        sh -c "cubrid broker stop && cubrid server stop carbonet && cubrid service stop" \
        2>/dev/null || true
    
    kubectl delete pod ${POD_NAME} -n ${NAMESPACE} --grace-period=30 2>/dev/null || true
    clear_host_state
    log "CUBRID stopped"
}

# Restart broker only (fast, <10 seconds)
restart_broker() {
    log "Restarting broker only..."
    kubectl exec -n ${NAMESPACE} ${POD_NAME} -- \
        sh -c "cubrid broker stop && sleep 1 && cubrid broker start" 2>/dev/null
    
    sleep 3
    
    if nc -z 127.0.0.1 ${BROKER_PORT} 2>/dev/null; then
        log "Broker restarted successfully"
        return 0
    else
        log "Broker restart failed"
        return 1
    fi
}

# Health check + auto-restart loop
monitor_and_restart() {
    log "Starting broker monitor (Ctrl+C to stop)..."
    
    while true; do
        if ! nc -z 127.0.0.1 ${BROKER_PORT} 2>/dev/null; then
            log "Broker not responding, restarting..."
            restart_broker
        fi
        sleep 10
    done
}

# Quick status
status() {
    echo "=== CUBRID K8s Status ==="
    kubectl get pod ${POD_NAME} -n ${NAMESPACE} -o wide 2>/dev/null || echo "Pod not found"
    echo "--- Port 33000 on host ---"
    ss -tlnp | grep ${BROKER_PORT} || echo "Not listening"
    echo "--- CUBRID processes ---"
    ps aux | grep -E "cubrid|cub_server|cub_broker" | grep -v grep || echo "No host processes"
}
```

### Expected Timing (1.3GB, clean shutdown)
| Operation | Time |
|-----------|------|
| Stop (graceful) | 5-10 sec |
| Force clear host state | 3-5 sec |
| Pod schedule + start | 15-25 sec |
| Broker ready after pod start | 5-8 sec |
| **Total restart (clean)** | **25-40 sec** |
| Broker restart only (fast) | **8-12 sec** |

## Files to Create

| File | Purpose |
|------|---------|
| `/opt/Resonance/ops/scripts/cubrid-k8s-quick.sh` | Main harness script |
| Update `AGENTS.md` | Add `broker` command alias |

## Commands
```bash
# Start CUBRID
bash ops/scripts/cubrid-k8s-quick.sh start

# Stop CUBRID  
bash ops/scripts/cubrid-k8s-quick.sh stop

# Restart broker only (fast)
bash ops/scripts/cubrid-k8s-quick.sh restart-broker

# Monitor + auto-restart
bash ops/scripts/cubrid-k8s-quick.sh monitor

# Status check
bash ops/scripts/cubrid-k8s-quick.sh status
```

## Current Blocker Fix
Before running the harness, need to fix the port conflict:
```bash
# The stale kubelet port cache must be cleared
# Run: sudo systemctl restart kubelet
# Or wait for kubelet to refresh its port state
```