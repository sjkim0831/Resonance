#!/bin/bash
set -euo pipefail

NAMESPACE="carbonet-prod"
CLUSTER_NAME="postgres-patroni"
SLACK_WEBHOOK_FILE="/opt/Resonance/ops/scripts/patroni-slack-webhook.cfg"
LOG_FILE="/opt/Resonance/var/log/patroni-monitor.log"
STATE_FILE="/tmp/patroni-monitor-state.json"

mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$SLACK_WEBHOOK_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

send_slack() {
    local message="$1"
    local webhook_url

    if [[ -f "$SLACK_WEBHOOK_FILE" ]]; then
        webhook_url=$(grep -v "^#" "$SLACK_WEBHOOK_FILE" | grep -v "^$" | head -1 || echo "")
        if [[ -n "$webhook_url" ]]; then
            curl -s -X POST -H 'Content-type: application/json' \
                --data "{\"text\": \"$message\"}" \
                "$webhook_url" > /dev/null 2>&1 || true
        fi
    fi
}

check_etcd() {
    local etcd_pod=$1
    local result
    result=$(kubectl exec -n "$NAMESPACE" "$etcd_pod" -- \
        etcdctl --endpoints=http://localhost:2379 endpoint health 2>&1 | grep -c "healthy" || echo "0")
    echo "$result"
}

get_patroni_status() {
    local leader=""
    local members=0
    local running_members=0
    local stopped_members=0

    while IFS= read -r line; do
        if echo "$line" | grep -q "Leader"; then
            leader=$(echo "$line" | awk '{print $4}' | tr -d '|')
        fi
        if echo "$line" | grep -q "Replica"; then
            ((members++)) || true
            if echo "$line" | grep -q "running"; then
                ((running_members++)) || true
            else
                ((stopped_members++)) || true
            fi
        fi
    done < <(kubectl exec -n "$NAMESPACE" postgres-patroni-0 -- patronictl list 2>/dev/null || echo "")

    echo "LEADER=$leader MEMBERS=$members RUNNING=$running_members STOPPED=$stopped_members"
}

check_leader() {
    local status
    status=$(get_patroni_status)
    local leader=$(echo "$status" | grep -oP 'LEADER=\K[^ ]+' | tr -d '|')

    if [[ -z "$leader" || "$leader" == "None" ]]; then
        echo "NO_LEADER"
    else
        echo "$leader"
    fi
}

get_replication_lag() {
    local max_lag="0"
    local lag

    while IFS= read -r line; do
        if echo "$line" | grep -qE "streaming|async|sync"; then
            lag=$(echo "$line" | awk '{print $NF}' | tr -d 'MB')
            if [[ -n "$lag" && "$lag" != "Lag" ]]; then
                if (( $(echo "$lag > $max_lag" | bc -l 2>/dev/null || echo "0") )); then
                    max_lag="$lag"
                fi
            fi
        fi
    done < <(kubectl exec -n "$NAMESPACE" postgres-patroni-0 -- psql -U postgres -h 127.0.0.1 -c "SELECT client_addr, state, pg_wal_lsn_diff(sent_lsn, write_lsn) AS lag FROM pg_stat_replication;" 2>/dev/null || echo "")

    echo "$max_lag"
}

main() {
    log "=== Patroni Monitor Check ==="

    local etcd_healthy=0
    etcd_healthy=$(( $(check_etcd etcd-patroni-0) + $(check_etcd etcd-patroni-1) + $(check_etcd etcd-patroni-2) ))
    log "etcd healthy nodes: $etcd_healthy/3"

    if (( etcd_healthy < 2 )); then
        log "ERROR: etcd quorum issue (healthy=$etcd_healthy)"
        send_slack ":alert: *Patroni Alert* - etcd quorum issue (healthy nodes: $etcd_healthy/3)"
        echo "CRITICAL"
        return 1
    fi

    local leader
    leader=$(check_leader)
    log "Current leader: $leader"

    if [[ "$leader" == "NO_LEADER" ]]; then
        log "ERROR: No leader in Patroni cluster!"
        send_slack ":alert: *Patroni Alert* - No leader elected! Cluster is unavailable."
        echo "CRITICAL"
        return 1
    fi

    local status
    status=$(get_patroni_status)
    local stopped=$(echo "$status" | grep -oP 'STOPPED=\K[^ ]+')

    if [[ -n "$stopped" && "$stopped" != "0" ]]; then
        log "WARNING: $stopped stopped members detected"
        send_slack ":warning: *Patroni Warning* - $stopped member(s) stopped"
    fi

    local replication_lag
    replication_lag=$(get_replication_lag 2>/dev/null || echo "0")
    log "Max replication lag: ${replication_lag}MB"

    if (( $(echo "$replication_lag > 100" | bc -l 2>/dev/null || echo "0") )); then
        log "WARNING: Replication lag exceeds 100MB"
        send_slack ":warning: *Patroni Warning* - Replication lag: ${replication_lag}MB"
    fi

    local app_health
    app_health=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:32947/actuator/health 2>/dev/null || echo "000")
    log "App health: $app_health"

    if [[ "$app_health" != "200" ]]; then
        log "WARNING: App health check failed (status: $app_health)"
    fi

    log "=== Monitor check completed: OK ==="
    echo "OK"
    return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi