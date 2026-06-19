#!/bin/bash
set -euo pipefail

NAMESPACE="${1:-carbonet-prod}"
DEPLOYMENT="${2:-carbonet-runtime}"
LOGFILE="/var/log/resonance-watchdog.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

check_registry_dns() {
    local registry="${REGISTRY_HOST:-registry.local}"
    if ! nslookup "$registry" >/dev/null 2>&1; then
        log "WARN: Registry DNS ($registry) not resolving"
        return 1
    fi
    return 0
}

repair_dns() {
    log "INFO: Repairing DNS..."
    systemctl restart systemd-resolved 2>/dev/null || true
    sleep 3
    if ! check_registry_dns; then
        if ! grep -q "registry.local" /etc/hosts 2>/dev/null; then
            log "WARN: Adding registry.local to /etc/hosts"
            echo "10.0.0.100 registry.local" >> /etc/hosts 2>/dev/null || true
        fi
    fi
}

watch_pods() {
    kubectl get pods -n "$NAMESPACE" -l app="$DEPLOYMENT" --watch --no-headers 2>/dev/null | \
    while IFS= read -r line; do
        local status=$(echo "$line" | awk '{print $3}')
        local name=$(echo "$line" | awk '{print $1}')

        if [[ "$status" == *"ImagePullBackOff"* ]]; then
            log "WARN: $name is in ImagePullBackOff - triggering recovery"
            repair_dns
            kubectl -n "$NAMESPACE" rollout restart deployment/"$DEPLOYMENT" 2>/dev/null
        elif [[ "$status" == *"CrashLoopBackOff"* ]]; then
            log "WARN: $name is in CrashLoopBackOff - check logs"
            kubectl -n "$NAMESPACE" logs "$name" --tail=20 2>/dev/null | tail -5 >> "$LOGFILE"
        elif [[ "$status" == *"OOMKilled"* ]]; then
            log "WARN: $name was OOMKilled - may need resource adjustment"
        fi
    done
}

log "INFO: === Resonance watchdog started ==="
log "INFO: Watching namespace=$NAMESPACE deployment=$DEPLOYMENT"

if ! check_registry_dns; then
    log "WARN: Initial DNS check failed - attempting repair"
    repair_dns
fi

watch_pods