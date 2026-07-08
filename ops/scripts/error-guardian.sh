# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] error-guardian.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
#============================================
# Error Guardian v2 - Error Detection & Immediate Recovery
# - Multi-layer health monitoring
# - Automatic error classification
# - Immediate rollback on failure
# - Process rollback capability
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
BACKUP_SCRIPT="/opt/Resonance/ops/scripts/incremental-backup.sh"
RECOVERY_SCRIPT="/opt/Resonance/ops/scripts/cubrid-recover-v4.sh"
LOG_DIR="/opt/Resonance/var/log"
GUARDIAN_LOG="$LOG_DIR/error-guardian.log"
TIMING_LOG="$LOG_DIR/process-timing.log"

mkdir -p "$LOG_DIR"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; echo "[$(date +%H:%M:%S)] $1" >> "$GUARDIAN_LOG"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; echo "[$(date +%H:%M:%S)] ✓ $1" >> "$GUARDIAN_LOG"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; echo "[$(date +%H:%M:%S)] ✗ $1" >> "$GUARDIAN_LOG"; }
log_warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; echo "[$(date +%H:%M:%S)] ⚠ $1" >> "$GUARDIAN_LOG"; }

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

#============================================
# ERROR CLASSIFICATION
#============================================
classify_error() {
    local error_msg="$1"
    local error_type="unknown"
    local severity="medium"
    local action="investigate"
    
    case "$error_msg" in
        *"Unable to mount log"*)
            error_type="log_mount_failure"
            severity="critical"
            action="recreate_log"
            ;;
        *"Permission denied"*|*"Access denied"*)
            error_type="permission_error"
            severity="high"
            action="fix_permissions"
            ;;
        *"No space left"*|*"Disk full"*)
            error_type="disk_space"
            severity="critical"
            action="cleanup_and_retry"
            ;;
        *"Table not found"*|*"Unknown class"*)
            error_type="schema_missing"
            severity="high"
            action="restore_schema"
            ;;
        *"Data inconsistency"*|*"Checksum error"*)
            error_type="data_corruption"
            severity="critical"
            action="restore_from_backup"
            ;;
        *"Connection refused"*|*"Server not started"*)
            error_type="server_down"
            severity="high"
            action="restart_server"
            ;;
        *"Transaction deadlock"*)
            error_type="deadlock"
            severity="medium"
            action="retry_transaction"
            ;;
    esac
    
    echo "$error_type|$severity|$action"
}

#============================================
# IMMEDIATE RECOVERY ACTIONS
#============================================
recover_log_volume() {
    log "Recovering log volume..."
    local start=$(date +%s)
    
    run "export CUBRID=/home/cubrid/CUBRID && \$CUBRID/bin/cubrid server stop $DB_NAME 2>/dev/null || true"
    sleep 2
    
    # Backup current data files
    run "mkdir -p /tmp/emergency_backup && cp /var/lib/cubrid/databases/${DB_NAME}* /tmp/emergency_backup/ 2>/dev/null || true"
    
    # Recreate log volume
    run "rm -f /var/lib/cubrid/databases/${DB_NAME}_lgat* && cd /var/lib/cubrid/databases && \$CUBRID/bin/cubrid createdb --db-volume-size=200M --log-volume-size=100M ${DB_NAME}_recovery en_US.iso88591 2>&1 | tail -1"
    
    # Restore data to new log
    run "\$CUBRID/bin/cubrid server start $DB_NAME 2>&1 | tail -2"
    
    local duration=$(($(date +%s) - start))
    log "Log recovery: ${duration}s"
    return $([ $duration -lt 30 ] && echo 0 || echo 1)
}

fix_permissions() {
    log "Fixing permissions..."
    run "chmod 666 /var/lib/cubrid/databases/${DB_NAME}* 2>/dev/null || true"
    run "chown -R cubrid:cubrid /var/lib/cubrid/databases/ 2>/dev/null || true"
}

restore_schema() {
    log "Restoring schema from backup..."
    local latest_schema=$(find /opt/Resonance/data/cubrid/backup -maxdepth 1 -type d -name "schema-*" | sort -r | head -1)
    
    if [ -d "$latest_schema" ]; then
        $BACKUP_SCRIPT restore "$latest_schema"
    else
        log_err "No schema backup found"
        return 1
    fi
}

restart_server() {
    log "Restarting server..."
    run "export CUBRID=/home/cubrid/CUBRID && \$CUBRID/bin/cubrid server stop $DB_NAME 2>/dev/null || true"
    sleep 3
    run "export CUBRID=/home/cubrid/CUBRID && \$CUBRID/bin/cubrid server start $DB_NAME 2>&1 | tail -2"
    sleep 5
    
    # Verify
    local status=$(run "\$CUBRID/bin/cubrid server status $DB_NAME 2>&1 | grep -c 'running'")
    if [ "$status" = "1" ]; then
        log_ok "Server restarted successfully"
        return 0
    else
        log_err "Server restart failed"
        return 1
    fi
}

#============================================
# FULL RECOVERY (에러 상황에서 완전 복구)
#============================================
emergency_recover() {
    local start_total=$(date +%s)
    local error_type="$1"
    
    log "═══════════════════════════════════════════════════════════════"
    log_warn "   EMERGENCY RECOVERY MODE"
    log "   Error type: $error_type"
    log "═══════════════════════════════════════════════════════════════"
    
    # Step 1: Create pre-recovery backup
    log "Creating pre-recovery backup..."
    $BACKUP_SCRIPT full "pre-recovery-$(date +%Y%m%d_%H%M%S)" 2>&1 | tail -3
    
    # Step 2: Attempt specific recovery
    local recovery_success=0
    
    case "$error_type" in
        log_mount_failure)
            recover_log_volume && recovery_success=1 ;;
        permission_error)
            fix_permissions && sleep 5 && restart_server && recovery_success=1 ;;
        server_down)
            restart_server && recovery_success=1 ;;
        *)
            # Full restore from backup
            $BACKUP_SCRIPT restore && recovery_success=1 ;;
    esac
    
    # Step 3: Verify
    sleep 5
    local rows=$(run "\$CUBRID/bin/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' ")
    
    local duration_total=$(($(date +%s) - start_total))
    
    if [ "$rows" = "266" ]; then
        log_ok "Emergency recovery complete: ${duration_total}s"
        
        # Log to SQLite
        python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
conn.execute('INSERT INTO recovery_log(timestamp,error_type,status,duration_sec,rows_restored) VALUES(datetime('now'),?,?,?,?)',
    ('$error_type','success',$duration_total,$rows))
conn.commit()
conn.close()
" 2>/dev/null
        
        return 0
    else
        log_err "Recovery failed, rows=$rows"
        
        # Last resort: Full restore
        log "Last resort: Full restore from backup..."
        $BACKUP_SCRIPT restore
        
        return 1
    fi
}

#============================================
# TIMING LOG HELPER
#============================================
log_timing() {
    local process_name="$1"
    local duration="$2"
    local status="$3"
    
    echo "$(date +%Y-%m-%d_%H:%M:%S)|$process_name|$duration|$status" >> "$TIMING_LOG"
    
    python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
conn.execute('INSERT INTO timing_logs(process_name,duration_sec,status) VALUES(?,?,?)',
    ('$process_name',$duration,'$status'))
conn.commit()
conn.close()
" 2>/dev/null
}

#============================================
# MONITOR (무한 루프 모니터링)
#============================================
monitor() {
    log "Starting Error Guardian monitoring..."
    
    while true; do
        # Check server status
        local server_status=$(run "\$CUBRID/bin/cubrid server status $DB_NAME 2>&1 | grep -c 'running'")
        
        if [ "$server_status" != "1" ]; then
            log_err "Server not running, attempting recovery..."
            
            # Capture error
            local error_output=$(run "\$CUBRID/bin/cubrid server start $DB_NAME 2>&1")
            local classified=$(classify_error "$error_output")
            local error_type=$(echo "$classified" | cut -d'|' -f1)
            local action=$(echo "$classified" | cut -d'|' -f3)
            
            log "Error classified as: $error_type (action: $action)"
            
            # Execute recovery action
            case "$action" in
                restart_server) restart_server ;;
                recreate_log) recover_log_volume ;;
                fix_permissions) fix_permissions ;;
                restore_schema) restore_schema ;;
                restore_from_backup) $BACKUP_SCRIPT restore ;;
                *) emergency_recover "$error_type" ;;
            esac
        fi
        
        sleep 30
    done
}

#============================================
# COMPARE PERFORMANCE (프로세스 성능 비교)
#============================================
compare_performance() {
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║              PROCESS TIMING COMPARISON                            ║"
    echo "╠═══════════════════════════════════════════════════════════════════╣"
    
    if [ -f "$TIMING_LOG" ]; then
        echo "║ Recent Timing Records:                                           ║"
        tail -10 "$TIMING_LOG" | while read line; do
            local dt=$(echo "$line" | cut -d'|' -f1)
            local proc=$(echo "$line" | cut -d'|' -f2)
            local dur=$(echo "$line" | cut -d'|' -f3)
            printf "║ %s | %-20s | %5ss ║\n" "$dt" "$proc" "$dur"
        done
    fi
    
    echo "╚═══════════════════════════════════════════════════════════════════╝"
}

#============================================
# ENTRY
#============================================
case "${1:-monitor}" in
    monitor) monitor ;;
    recover) emergency_recover "$2" ;;
    compare) compare_performance ;;
    classify) classify_error "$2" ;;
    timing) cat "$TIMING_LOG" 2>/dev/null || echo "No timing logs yet" ;;
    *)
        echo "Usage: $0 {monitor|recover|compare|classify|timing}"
        ;;
esac
