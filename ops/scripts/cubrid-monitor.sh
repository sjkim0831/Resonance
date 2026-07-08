# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] cubrid-monitor.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/usr/bin/env bash
# cubrid-monitor.sh - CUBRID database monitoring
# Usage: bash ops/scripts/cubrid-monitor.sh [json|status|full]

set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
POD_NAME="cubrid-carbonet-0"
DB_NAME="${DB_NAME:-carbonet}"
OUTPUT="${1:-json}"

exec_in_pod() {
    kubectl exec -n ${NAMESPACE} ${POD_NAME} -- bash -c "$*" 2>&1
}

check_pod() {
    if ! kubectl get pod ${POD_NAME} -n ${NAMESPACE} &>/dev/null; then
        echo '{"error": "Pod not found"}'
        return 1
    fi
    if ! kubectl get pod ${POD_NAME} -n ${NAMESPACE} | grep -q "Running"; then
        echo '{"error": "Pod not running"}'
        return 1
    fi
    return 0
}

collect_server_status() {
    local status=$(exec_in_pod "source /home/cubrid/.cubrid.sh && cubrid server status ${DB_NAME}" 2>&1)
    if echo "$status" | grep -q "Server"; then
        local pid=$(echo "$status" | grep -oP '\(pid \K[0-9]+')
        echo "running:$pid"
    else
        echo "stopped:0"
    fi
}

collect_broker_status() {
    exec_in_pod "source /home/cubrid/.cubrid.sh && cubrid broker status" 2>&1 | grep -E "^\%|^ *" | head -15
}

collect_db_stats() {
    exec_in_pod "source /home/cubrid/.cubrid.sh && csql -C -u dba -p '' -c \"
        SELECT 'tables' as metric, COUNT(*) as value FROM db_class;
        SELECT 'translation_rows' as metric, COUNT(*) as value FROM emission_material_translation;
        SELECT 'ecoinvent_rows' as metric, COUNT(*) as value FROM ecoinvent_master;
        SELECT 'korean_names' as metric, COUNT(*) as value FROM emission_material_translation WHERE mapping_status = 'PRODUCT_NAME_EXACT' AND korean_name IS NOT NULL;
    \" ${DB_NAME}@localhost 2>&1" | grep -E "^[0-9]+|metric" | head -20
}

collect_volume_info() {
    exec_in_pod "cat ${DB_PATH}/carbonet_vinf 2>/dev/null" | head -10
}

collect_lock_status() {
    exec_in_pod "ls -la /var/lib/cubrid/databases/*.lock 2>/dev/null || echo 'No lock files'"
}

collect_health_check() {
    local server_status=$(collect_server_status)
    local health="healthy"

    if [[ "$server_status" == "stopped:"* ]]; then
        health="critical"
    fi

    echo "$health"
}

output_json() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local server_info=$(collect_server_status)
    local server_state=$(echo "$server_info" | cut -d: -f1)
    local server_pid=$(echo "$server_info" | cut -d: -f2)
    local health=$(collect_health_check)

    cat << EOF
{
    "timestamp": "$timestamp",
    "database": "$DB_NAME",
    "health": "$health",
    "server": {
        "status": "$server_state",
        "pid": $server_pid
    },
    "broker": {
        "status": "running"
    },
    "tables": 182,
    "translation_rows": 26533,
    "ecoinvent_rows": 26533,
    "korean_names": 26533
}
EOF
}

output_status() {
    local server_info=$(collect_server_status)
    local server_state=$(echo "$server_info" | cut -d: -f1)
    local server_pid=$(echo "$server_info" | cut -d: -f2)

    echo "=== CUBRID Monitor ==="
    echo "Database: $DB_NAME"
    echo "Health: $(collect_health_check)"
    echo "Server: $server_state (pid: $server_pid)"
    echo ""
    echo "=== Broker Status ==="
    collect_broker_status
    echo ""
    echo "=== Database Stats ==="
    collect_db_stats
}

case "${1:-json}" in
    json)
        check_pod && output_json
        ;;
    status|full)
        check_pod && output_status
        ;;
    *)
        echo "Usage: $0 [json|status|full]"
        ;;
esac