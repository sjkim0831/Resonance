#!/bin/bash
# ============================================
# CUBRID Manager with SQLite Logging & Auto-recovery
# ============================================

set -e

NAMESPACE="carbonet-prod"
DATABASE_NAME="carbonet"
DATA_HOST_PATH="/opt/Resonance/data/cubrid/databases"
POD_NAME="cubrid-carbonet-0"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
LOG_SCRIPT="/opt/Resonance/ops/scripts/cubrid-log.py"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"
    python3 "$LOG_SCRIPT" log "$1" "info" "$2" 2>/dev/null || true
}

log_success() {
    echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"
    python3 "$LOG_SCRIPT" errors 2>/dev/null || true
}

log_warn() {
    echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"
}

exec_on_pod() {
    kubectl exec $POD_NAME -n $NAMESPACE -- bash -c "$1" 2>&1
}

exec_on_pod_stdin() {
    kubectl exec $POD_NAME -n $NAMESPACE -i -- bash -c "$1" 2>&1
}

init_oplog() {
    python3 "$LOG_SCRIPT" init 2>/dev/null || true
}

# ============================================
# Phase 1: Ensure databases.txt is synchronized
# ============================================
sync_databases_txt() {
    log "Syncing databases.txt..."

    exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH

        cat > /var/lib/cubrid/databases/databases.txt << 'EOF'
#db-name	vol-path		db-host		log-path		lob-base-path
${DATABASE_NAME}	/var/lib/cubrid/databases	localhost	/var/lib/cubrid/databases	file:/var/lib/cubrid/databases/lob
EOF

        cp /var/lib/cubrid/databases/databases.txt \$CUBRID/databases/databases.txt 2>/dev/null || true
        chmod 666 /var/lib/cubrid/databases/databases.txt 2>/dev/null || true
    " > /dev/null

    if verify_databases_txt; then
        log_success "databases.txt synchronized"
        return 0
    else
        log_error "databases.txt sync failed"
        return 1
    fi
}

verify_databases_txt() {
    local content=$(exec_on_pod "cat /var/lib/cubrid/databases/databases.txt")
    local cubrid_content=$(exec_on_pod "cat \$CUBRID/databases/databases.txt 2>/dev/null")

    if [[ "$content" == *"$DATABASE_NAME"* ]] && [[ "$cubrid_content" == *"$DATABASE_NAME"* ]]; then
        return 0
    fi
    return 1
}

# ============================================
# Phase 2: Start CUBRID service
# ============================================
start_service() {
    log "Starting CUBRID service..."

    local output
    output=$(exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=/var/lib/cubrid/databases

        cubrid service start 2>&1
        sleep 3
        cubrid server start ${DATABASE_NAME} 2>&1
    ")

    if echo "$output" | grep -qi "fail\|error"; then
        log_error "Service start failed"

        if echo "$output" | grep -qi "unknown\|cannot access"; then
            log_warn "databases.txt issue detected, attempting auto-fix..."
            sync_databases_txt
            start_service
            return $?
        fi

        return 1
    fi

    sleep 3

    if verify_server_running; then
        log_success "Service started successfully"
        return 0
    fi

    return 1
}

verify_server_running() {
    local status=$(exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        cubrid server status ${DATABASE_NAME} 2>&1 | grep -E 'Server ${DATABASE_NAME}'
    ")

    [[ "$status" == *"Server ${DATABASE_NAME}"* ]]
}

# ============================================
# Phase 3: Ensure database is accessible
# ============================================
ensure_database_access() {
    log "Verifying database access..."

    local max_attempts=3
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        local result
        result=$(exec_on_pod "
            export CUBRID=/home/cubrid/CUBRID
            export PATH=\$CUBRID/bin:\$PATH
            export CUBRID_DATABASES=/var/lib/cubrid/databases

            csql -u dba ${DATABASE_NAME}@localhost -c 'SELECT 1;' 2>&1 | grep -E '^[0-9]+$|1 row'
        ")

        if [ -n "$result" ]; then
            log_success "Database accessible"
            return 0
        fi

        log_warn "Attempt $attempt failed, retrying..."
        sync_databases_txt
        sleep 2
        attempt=$((attempt + 1))
    done

    log_error "Database access failed after $max_attempts attempts"
    return 1
}

# ============================================
# Full system startup with auto-recovery
# ============================================
full_startup() {
    log "=== CUBRID Full Startup with Auto-recovery ==="
    echo ""

    local start_time=$(date +%s%3N)
    local op_id=$(python3 "$LOG_SCRIPT" log "full_startup" "started" "" 2>/dev/null)

    local failed=0

    if ! sync_databases_txt; then
        log_error "Phase 1: databases.txt sync failed"
        failed=1
    fi

    if ! start_service; then
        log_error "Phase 2: Service start failed"
        failed=1
    fi

    if ! ensure_database_access; then
        log_error "Phase 3: Database access failed"
        failed=1
    fi

    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))

    if [ $failed -eq 0 ]; then
        log_success "=== Full Startup Complete (${duration}ms) ==="
        python3 "$LOG_SCRIPT" log "full_startup" "success" "Duration: ${duration}ms" 2>/dev/null
    else
        log_error "=== Startup Failed ==="
        python3 "$LOG_SCRIPT" log "full_startup" "failed" "Duration: ${duration}ms" 2>/dev/null
        python3 "$LOG_SCRIPT" log "full_startup_error" "failed" "Auto-recovery failed" 2>/dev/null
    fi

    return $failed
}

# ============================================
# Query execution with error handling
# ============================================
exec_sql() {
    local query="$1"
    local description="${2:-Query}"

    log "$description..."

    local result
    local exit_code=0

    result=$(exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=/var/lib/cubrid/databases

        csql -u dba ${DATABASE_NAME}@localhost -c \"$query\" 2>&1
    ") || exit_code=$?

    if [ $exit_code -ne 0 ]; then
        log_error "$description failed: $result"
        return 1
    fi

    echo "$result"
    return 0
}

# ============================================
# Status check with SQLite logging
# ============================================
check_status() {
    log "=== CUBRID Status Check ==="

    local status_output=$(exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=/var/lib/cubrid/databases

        echo '--- Service ---'
        cubrid service status 2>&1 | head -5

        echo '--- Server ---'
        cubrid server status ${DATABASE_NAME} 2>&1

        echo '--- databases.txt ---'
        head -2 /var/lib/cubrid/databases/databases.txt

        echo '--- Table Count ---'
        csql -u dba ${DATABASE_NAME}@localhost -c 'SHOW TABLES;' 2>&1 | grep -c 'row'

        echo '--- Key Table ---'
        csql -u dba ${DATABASE_NAME}@localhost -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E 'count|[0-9]+ row' | head -2
    " 2>&1)

    echo "$status_output"

    local is_healthy=1
    if echo "$status_output" | grep -qi "error\|fail\|unknown"; then
        is_healthy=0
    fi

    python3 "$LOG_SCRIPT" log "status_check" "$( [ $is_healthy -eq 1 ] && echo 'success' || echo 'warning' )" "Healthy: $is_healthy" 2>/dev/null
}

# ============================================
# Auto-recovery routine
# ============================================
auto_recover() {
    log "=== Running Auto-recovery ==="

    local failed=0

    log "Step 1: Check pod status..."
    local pod_ready=$(kubectl get pod $POD_NAME -n $NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)
    if [ "$pod_ready" != "True" ]; then
        log_error "Pod not ready, cannot recover"
        return 1
    fi

    log "Step 2: Sync databases.txt..."
    sync_databases_txt || failed=1

    log "Step 3: Stop existing services..."
    exec_on_pod "pkill -9 cub_server 2>/dev/null || true; pkill -9 cubrid 2>/dev/null || true; sleep 2" || true

    log "Step 4: Start service..."
    start_service || failed=1

    if [ $failed -eq 0 ]; then
        log_success "Auto-recovery complete"
        return 0
    else
        log_error "Auto-recovery failed"
        return 1
    fi
}

# ============================================
# Show recent errors
# ============================================
show_errors() {
    echo "=== Recent Errors ==="
    python3 "$LOG_SCRIPT" errors 2>/dev/null || echo "No error tracking available"
}

case "${1:-help}" in
    start)
        full_startup
        ;;
    status|check)
        check_status
        ;;
    recover|fix)
        auto_recover
        ;;
    sync)
        sync_databases_txt
        ;;
    query|sql)
        shift
        exec_sql "$*"
        ;;
    count)
        exec_sql "SELECT COUNT(*) FROM ${2:-admin_emission_gwp_value};" "Row count"
        ;;
    errors)
        show_errors
        ;;
    *)
        echo "Usage: cubrid-ops.sh {start|status|recover|sync|query|count|errors}"
        echo ""
        echo "Commands:"
        echo "  start   - Full startup with auto-recovery"
        echo "  status  - Check current status"
        echo "  recover - Auto-recover from errors"
        echo "  sync    - Sync databases.txt"
        echo "  query   - Execute SQL query"
        echo "  count   - Count rows in table"
        echo "  errors  - Show recent errors"
        exit 1
        ;;
esac