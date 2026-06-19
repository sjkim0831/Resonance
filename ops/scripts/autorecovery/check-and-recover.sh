#!/bin/bash
set -euo pipefail

NAMESPACE="${1:-carbonet-prod}"
DEPLOYMENT="${2:-carbonet-runtime}"
LOGFILE="/var/log/resonance-autorecovery.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

check_registry_dns() {
    local registry="${REGISTRY_HOST:-registry.local}"
    if ! nslookup "$registry" >/dev/null 2>&1; then
        log "WARN: Registry DNS ($registry) not resolving"
        return 1
    fi
    log "OK: Registry DNS resolved"
    return 0
}

check_kubernetes_pods() {
    local failing=0
    local pods=$(kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" --no-headers 2>/dev/null)

    while IFS= read -r line; do
        local status=$(echo "$line" | awk '{print $3}')
        if [[ "$status" == *"ImagePullBackOff"* ]] || [[ "$status" == *"ErrImagePull"* ]]; then
            log "FAIL: Pod in $status state"
            ((failing++))
        elif [[ "$status" == *"CrashLoopBackOff"* ]]; then
            log "FAIL: Pod in CrashLoopBackOff"
            ((failing++))
        fi
    done <<< "$pods"

    return $failing
}

restart_deployment() {
    log "INFO: Restarting deployment $DEPLOYMENT in namespace $NAMESPACE"
    kubectl -n "$NAMESPACE" rollout restart deployment/"$DEPLOYMENT" 2>/dev/null
    kubectl -n "$NAMESPACE" rollout status deployment/"$DEPLOYMENT" --timeout=300s 2>/dev/null
}

repair_dns() {
    log "INFO: Attempting DNS repair..."
    if systemctl is-active --quiet systemd-resolved; then
        log "INFO: Restarting systemd-resolved"
        systemctl restart systemd-resolved 2>/dev/null || true
        sleep 5
    fi

    if ! check_registry_dns; then
        log "WARN: Adding registry.local to /etc/hosts as fallback"
        if ! grep -q "registry.local" /etc/hosts 2>/dev/null; then
            echo "10.0.0.100 registry.local" >> /etc/hosts 2>/dev/null || true
        fi
    fi
}

main() {
    log "INFO: === Auto-recovery check started ==="

    if ! check_registry_dns; then
        repair_dns
    fi

    if ! check_kubernetes_pods; then
        log "WARN: Failing pods detected, attempting restart"
        restart_deployment
    else
        log "OK: All pods healthy"
    fi

    log "INFO: === Auto-recovery check completed ==="
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi