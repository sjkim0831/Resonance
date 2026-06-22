#!/bin/bash
#===============================================================
# CUBRID HEALTH MONITOR & AUTO-RECOVERY
#===============================================================

POD="cubrid-carbonet-0"
NS="carbonet-prod"
DB="carbonet"
BIN="/home/cubrid/CUBRID/bin"
LOG_FILE="/opt/Resonance/var/log/cubrid-health.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "[$(date '+%Y-%m-%dT%H:%M:%S')] $*"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null || echo ""; }

#---------------------------------------------------------------
# Check Kubelet/Containerd
#---------------------------------------------------------------
check_kubelet() {
    log "=== Kubelet/Containerd ==="

    if systemctl is-active --quiet kubelet; then
        ok "kubelet: active"
    else
        error "kubelet: inactive"
        sudo systemctl restart kubelet 2>/dev/null || true
        return 1
    fi

    if systemctl is-active --quiet containerd; then
        ok "containerd: active"
    else
        error "containerd: inactive"
        return 1
    fi

    return 0
}

#---------------------------------------------------------------
# Check CUBRID Server
#---------------------------------------------------------------
check_server() {
    log "=== CUBRID Server ==="

    local status=$(run "$BIN/cubrid server status $DB 2>&1" || echo "")
    if echo "$status" | grep -q "Server $DB"; then
        ok "Server: running"
        return 0
    else
        error "Server: not running"
        run "$BIN/cubrid server start $DB" 2>/dev/null
        return 1
    fi
}

#---------------------------------------------------------------
# Check CUBRID Broker
#---------------------------------------------------------------
check_broker() {
    log "=== CUBRID Broker ==="

    local status=$(run "$BIN/cubrid broker status 2>&1" || echo "")

    if echo "$status" | grep -q "broker1"; then
        ok "Broker: running"
    else
        error "Broker: not running"
        return 1
    fi

    local close_wait=$(echo "$status" | grep -c "CLOSE_WAIT" || echo 0)
    if [ "$close_wait" -gt 5 ]; then
        warn "CLOSE_WAIT: $close_wait (cleaning...)"
        run "$BIN/cubrid broker stop 2>/dev/null"
        sleep 2
        run "$BIN/cubrid broker start 2>/dev/null"
        ok "CLOSE_WAIT cleaned"
    else
        ok "CLOSE_WAIT: $close_wait (normal)"
    fi

    return 0
}

#---------------------------------------------------------------
# Check DB Integrity
#---------------------------------------------------------------
check_db() {
    log "=== DB Integrity ==="

    local table_count=$(run "$BIN/csql -u dba $DB -c 'SHOW TABLES;' 2>/dev/null" | grep -c "'" || echo 0)
    log "Tables: $table_count"

    if [ "$table_count" -lt 50 ]; then
        error "Table count too low - recovery needed"
        return 3
    fi

    ok "Tables: $table_count (OK)"

    local count=$(run "$BIN/csql -u dba $DB -c 'SELECT COUNT(*) FROM comtccmmndetailcode;' 2>/dev/null" | grep -E "^\s+[0-9]+" | awk '{print $1}' | tr -d ' ')
    log "comtccmmndetailcode: $count rows"

    count=$(run "$BIN/csql -u dba $DB -c 'SELECT COUNT(*) FROM ecoinvent_master;' 2>/dev/null" | grep -E "^\s+[0-9]+" | awk '{print $1}' | tr -d ' ')
    log "ecoinvent_master: $count rows"

    return 0
}

#---------------------------------------------------------------
# Full Health Check
#---------------------------------------------------------------
full_check() {
    log ""
    log "=============================================="
    log "       CUBRID HEALTH CHECK"
    log "=============================================="

    local errors=0

    check_kubelet || ((errors++))
    echo ""
    check_server || ((errors++))
    echo ""
    check_broker || ((errors++))
    echo ""
    check_db || ((errors++))

    echo ""
    log "=============================================="
    if [ $errors -eq 0 ]; then
        log "  STATUS: HEALTHY"
    else
        log "  STATUS: ERRORS=$errors"
    fi
    log "=============================================="

    return $errors
}

#---------------------------------------------------------------
# Auto Recovery
#---------------------------------------------------------------
auto_recover() {
    log "=== AUTO RECOVERY ==="

    log "Restarting kubelet..."
    sudo systemctl restart kubelet 2>/dev/null || true
    sleep 20

    log "Restarting CUBRID server..."
    run "$BIN/cubrid server stop $DB" 2>/dev/null || true
    sleep 3
    run "$BIN/cubrid server start $DB" 2>/dev/null
    sleep 10

    log "Restarting CUBRID broker..."
    run "$BIN/cubrid broker stop 2>/dev/null || true
    sleep 2
    run "$BIN/cubrid broker start 2>/dev/null

    log "Verifying..."
    sleep 5
    check_db
}

case "${1:-check}" in
    check|c) full_check ;;
    recover|r) auto_recover ;;
    server|s) check_server ;;
    broker|b) check_broker ;;
    db|d) check_db ;;
    kubelet|k) check_kubelet ;;
    *) full_check ;;
esac