#!/bin/bash
#============================================
# AI Guardian v2 - AI 작업 중 자동 감시 + 즉시 복구
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
LOG_FILE="/opt/Resonance/var/log/ai-guardian.log"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
INTERVAL=10

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; echo "[$(date +%H:%M:%S)] $1" >> "$LOG_FILE" 2>/dev/null; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; echo "[$(date +%H:%M:%S)] ✓ $1" >> "$LOG_FILE" 2>/dev/null; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; echo "[$(date +%H:%M:%S)] ✗ $1" >> "$LOG_FILE" 2>/dev/null; }
log_warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; echo "[$(date +%H:%M:%S)] ⚠ $1" >> "$LOG_FILE" 2>/dev/null; }

mkdir -p /opt/Resonance/var/log 2>/dev/null

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

# Check functions (use direct CUBRID path)
check_server() {
    run "/home/cubrid/CUBRID/bin/cubrid server status $DB_NAME 2>&1 | grep -q 'Server ' && echo 1 || echo 0"
}

check_db_files() {
    run "ls /var/lib/cubrid/databases/${DB_NAME}* 2>/dev/null | wc -l"
}

check_rows() {
    run "/home/cubrid/CUBRID/bin/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' '"
}

# Immediate recovery (fast mode)
quick_recover() {
    log_err "문제 감지! 즉시 복구 시작..."
    local start=$(date +%s)
    
    # 1. Stop server
    run "/home/cubrid/CUBRID/bin/cubrid server stop $DB_NAME 2>&1 | tail -1 || true" 2>/dev/null
    sleep 2
    
    # 2. Clean
    run "cd /var/lib/cubrid/databases; rm -f ${DB_NAME}* *_vinf *_lgat *_lgar* 2>/dev/null" 2>/dev/null
    
    # 3. Create DB
    run "/home/cubrid/CUBRID/bin/cubrid createdb --db-volume-size=500M --log-volume-size=200M $DB_NAME en_US.iso88591 2>&1 | tail -3" 2>&1 | tail -3
    
    # 4. Setup config
    run "/home/cubrid/CUBRID/bin/cubrid server start $DB_NAME 2>&1 | tail -2" 2>&1 | tail -2
    sleep 5
    
    # 5. Find and use latest backup
    local latest=$(find $BACKUP_DIR -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    
    if [ -n "$latest" ]; then
        log "Using backup: $latest"
        run "rm -rf /tmp/backup; mkdir -p /tmp/backup" 2>/dev/null
        kubectl cp "$latest/unloaddb/." "$NAMESPACE/$POD:/tmp/backup/" 2>&1 | tail -2
        
        # 6. Load data
        run "/home/cubrid/CUBRID/bin/cubrid loaddb -u dba -s /tmp/backup/${DB_NAME}_schema $DB_NAME 2>&1 | tail -2" 2>&1 | tail -2
        run "/home/cubrid/CUBRID/bin/cubrid loaddb -u dba -d /tmp/backup/${DB_NAME}_objects $DB_NAME 2>&1 | tail -2" 2>&1 | tail -2
        run "/home/cubrid/CUBRID/bin/cubrid loaddb -u dba -i /tmp/backup/${DB_NAME}_indexes $DB_NAME 2>&1 | tail -2" 2>&1 | tail -2
        
        sleep 3
        local rows=$(check_rows)
        local elapsed=$(($(date +%s) - start))
        
        if [ "$rows" = "266" ]; then
            log_ok "복구 완료! (${elapsed}s) Rows: $rows"
            return 0
        else
            log_err "복구 완료 but rows=$rows"
            return 1
        fi
    else
        log_err "백업 없음"
        return 1
    fi
}

# Single check
check_once() {
    log "=== AI Guardian Check ==="
    local server=$(check_server)
    local db_files=$(check_db_files)
    local rows=$(check_rows)
    
    log "Server: $server, Files: $db_files, Rows: $rows"
    
    if [ "$server" = "1" ] && [ "$db_files" -ge 5 ] && [ "$rows" = "266" ]; then
        log_ok "HEALTHY"
        return 0
    else
        log_warn "NEEDS ATTENTION"
        quick_recover
        return $?
    fi
}

case "${1:-help}" in
    check|once) check_once ;;
    *) echo "Usage: $0 {check}" ;;
esac
