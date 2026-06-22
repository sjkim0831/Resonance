#!/bin/bash
#============================================
# AI Guardian v2 - Improved
# 자동 감시 + 즉시 복구
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
LOG_FILE="/opt/Resonance/var/log/ai-guardian.log"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
CUBRID_BIN="/home/cubrid/CUBRID/bin"
EXPECTED_ROWS=266

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; echo "[$(date +%H:%M:%S)] $1" >> "$LOG_FILE"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }
log_warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; }

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

mkdir -p /opt/Resonance/var/log 2>/dev/null

# Check health
check_health() {
    local srv=$(run "$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -c 'Server '")
    local files=$(run "ls /var/lib/cubrid/databases/${DB_NAME}* 2>/dev/null | wc -l")
    local rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' '")
    
    echo "Server: $srv, Files: $files, Rows: $rows"
    
    if [ "$srv" -gt 0 ] && [ "$files" -ge 5 ] && [ "$rows" = "$EXPECTED_ROWS" ]; then
        return 0
    fi
    return 1
}

# Fast recovery (for AI Guardian)
fast_recover() {
    log_err "문제 감지! 즉시 복구 시작..."
    local start=$(date +%s)
    
    # 1. Stop
    run "$CUBRID_BIN/cubrid server stop $DB_NAME 2>&1 | tail -1 || true"
    sleep 1
    
    # 2. Clean
    run "cd /var/lib/cubrid/databases && rm -f ${DB_NAME}* *_vinf *_lgat *_lgar* 2>/dev/null"
    
    # 3. Create DB
    run "cd /var/lib/cubrid/databases && $CUBRID_BIN/cubrid createdb --db-volume-size=200M --log-volume-size=100M $DB_NAME en_US.iso88591 2>&1 | tail -3"
    
    # 4. Configure
    run "cat > /var/lib/cubrid/databases/databases.txt << 'EOF'
carbonet	/var/lib/cubrid/databases	localhost	/var/lib/cubrid/databases	file:/var/lib/cubrid/databases/lob
EOF
cp /var/lib/cubrid/databases/databases.txt $CUBRID_BIN/databases/databases.txt"
    
    # 5. Start
    run "$CUBRID_BIN/cubrid server start $DB_NAME 2>&1 | tail -2"
    sleep 5
    
    # 6. Find and use backup
    local latest=$(find $BACKUP_DIR -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    
    if [ -n "$latest" ]; then
        run "rm -rf /tmp/backup; mkdir -p /tmp/backup"
        kubectl cp "$latest/unloaddb/." "$NAMESPACE/$POD:/tmp/backup/" 2>&1 | tail -2
        
        run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -s ${DB_NAME}_schema $DB_NAME 2>&1 | tail -2"
        run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -d ${DB_NAME}_objects $DB_NAME 2>&1 | tail -2"
        run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -i ${DB_NAME}_indexes $DB_NAME 2>&1 | tail -2"
    fi
    
    # 7. Verify
    sleep 3
    local rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' '")
    
    local elapsed=$(($(date +%s) - start))
    
    if [ "$rows" = "$EXPECTED_ROWS" ]; then
        log_ok "복구 완료! (${elapsed}s) Rows: $rows"
        return 0
    else
        log_err "복구 완료 but rows=$rows"
        return 1
    fi
}

# Main
main() {
    log "=== AI Guardian Check ==="
    
    if check_health; then
        log_ok "SYSTEM HEALTHY"
        return 0
    else
        log_warn "SYSTEM NEEDS ATTENTION"
        fast_recover
        return $?
    fi
}

case "${1:-check}" in
    check) main ;;
    *) main ;;
esac
