# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] cubrid-framework.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
#============================================
# Carbonet CUBRID Framework - Unified Manager
# 모든 작업의 단일 진입점
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
LOG_DIR="/opt/Resonance/var/log"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
CUBRID_BIN="/home/cubrid/CUBRID/bin"
EXPECTED_ROWS=266

# Colors
log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }
log_warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; }
log_section() { echo -e "${CYAN}═══[$1]═══${NC} $2"; }

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }
mkdir -p "$LOG_DIR" 2>/dev/null

#============================================
# HELP
#============================================
show_help() {
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║         Carbonet CUBRID Framework - Commands
╠══════════════════════════════════════════════════════════════╣
║  Health & Status                                              ║
║    health      - Quick health check                           ║
║    status      - Detailed status                             ║
║                                                              ║
║  Recovery                                                     ║
║    diagnose    - Full diagnosis                               ║
║    recover     - Full recovery (all phases)                  ║
║    quick       - Quick health check + auto-recover            ║
║                                                              ║
║  Backup                                                       ║
║    backup      - Create new backup                           ║
║    verify      - Verify latest backup                         ║
║                                                              ║
║  Guardian (Auto)                                             ║
║    guardian    - AI Guardian: monitor + auto-recover          ║
║    guardian-ai - AI Guardian only                            ║
║    guardian-bk - Backup Guardian only                         ║
║                                                              ║
║  Logs                                                         ║
║    logs        - Recent operations from SQLite                ║
║    logs-file   - Recovery log file                           ║
╚══════════════════════════════════════════════════════════════╝
EOF
}

#============================================
# HEALTH CHECK (Fast)
#============================================
cmd_health() {
    log_section "00" "Health Check"
    
    local srv=$(run "$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -c 'Server '")
    local files=$(run "ls /var/lib/cubrid/databases/${DB_NAME}* 2>/dev/null | wc -l")
    local rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' '")
    
    echo "  Server: $srv"
    echo "  Files: $files"
    echo "  Rows: $rows"
    
    if [ "$srv" -gt 0 ] && [ "$files" -ge 5 ] && [ "$rows" = "$EXPECTED_ROWS" ]; then
        log_ok "HEALTHY"
        return 0
    else
        log_warn "NEEDS ATTENTION"
        return 1
    fi
}

#============================================
# STATUS (Detailed)
#============================================
cmd_status() {
    log "═══════════════════════════════════════════════════════════════"
    log "   Status - $(date)"
    log "═══════════════════════════════════════════════════════════════"
    
    cmd_health
    
    echo ""
    echo "Recent Operations:"
    python3 -c "
import sqlite3
conn = sqlite3.connect('$LOG_DB')
ops = conn.execute('SELECT operation,status,duration_ms,timestamp FROM operations ORDER BY id DESC LIMIT 5').fetchall()
for op,st,du,ts in ops:
    icon = {'success':'✓','failed':'✗','warning':'⚠'}.get(st,'?')
    du_str = f'{du}ms' if du else ''
    print(f'  {icon} {op} {du_str}')
if not ops: print('  No records')
conn.close()
" 2>/dev/null
    
    echo ""
    echo "Backup:"
    local latest=$(find $BACKUP_DIR -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    if [ -n "$latest" ]; then
        local size=$(du -sh "$latest" 2>/dev/null | cut -f1)
        echo "  ✓ $latest ($size)"
    else
        echo "  ✗ No backup"
    fi
    
    log "═══════════════════════════════════════════════════════════════"
}

#============================================
# DIAGNOSE
#============================================
cmd_diagnose() {
    log_section "00" "Diagnosis"
    
    local issues=0
    
    # Files
    log "Checking files..."
    local files=$(run "ls /var/lib/cubrid/databases/${DB_NAME}* 2>/dev/null | wc -l")
    [ "$files" -ge 5 ] && log_ok "Files: $files" || { log_err "Files: $files"; issues=$((issues+1)); }
    
    # Server
    log "Checking server..."
    local srv=$(run "$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -c 'Server '")
    [ "$srv" -gt 0 ] && log_ok "Server: running" || { log_err "Server: down"; issues=$((issues+1)); }
    
    # Connect
    log "Checking connectivity..."
    local conn=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost -c 'SELECT 1;' 2>&1 | grep -q 1 && echo 1 || echo 0")
    [ "$conn" -eq 1 ] && log_ok "Connect: OK" || { log_err "Connect: FAILED"; issues=$((issues+1)); }
    
    # Rows
    log "Checking data..."
    local rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' '")
    [ "$rows" = "$EXPECTED_ROWS" ] && log_ok "Rows: $rows" || { log_warn "Rows: $rows"; issues=$((issues+1)); }
    
    return $issues
}

#============================================
# RECOVER (Full)
#============================================
cmd_recover() {
    local start=$(date +%s)
    
    log "═══════════════════════════════════════════════════════════════"
    log "   FULL RECOVERY - $(date)"
    log "═══════════════════════════════════════════════════════════════"
    
    # 1. Stop
    log_section "01" "Stop"
    run "$CUBRID_BIN/cubrid server stop $DB_NAME 2>&1 | tail -1 || true"
    
    # 2. Clean
    log_section "02" "Clean"
    run "cd /var/lib/cubrid/databases && rm -f ${DB_NAME}* *_vinf *_lgat *_lgar*"
    
    # 3. Create
    log_section "03" "Create"
    run "cd /var/lib/cubrid/databases && $CUBRID_BIN/cubrid createdb --db-volume-size=200M --log-volume-size=100M $DB_NAME en_US.iso88591 2>&1 | tail -3"
    
    # 4. Configure
    log_section "04" "Configure"
    run "cat > /var/lib/cubrid/databases/databases.txt << 'EOF'
carbonet	/var/lib/cubrid/databases	localhost	/var/lib/cubrid/databases	file:/var/lib/cubrid/databases/lob
EOF
cp /var/lib/cubrid/databases/databases.txt $CUBRID_BIN/databases/databases.txt"
    
    # 5. Start
    log_section "05" "Start"
    run "$CUBRID_BIN/cubrid server start $DB_NAME 2>&1 | tail -2"
    sleep 5
    
    # 6. Prepare backup
    log_section "06" "Prepare Backup"
    local latest=$(find $BACKUP_DIR -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    if [ -n "$latest" ]; then
        log "Using: $latest"
        run "rm -rf /tmp/backup; mkdir -p /tmp/backup"
        kubectl cp "$latest/unloaddb/." "$NAMESPACE/$POD:/tmp/backup/" 2>&1 | tail -2
    fi
    
    # 7. Load
    log_section "07" "Load Schema"
    run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -s ${DB_NAME}_schema $DB_NAME 2>&1 | tail -2"
    
    log_section "08" "Load Data"
    run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -d ${DB_NAME}_objects $DB_NAME 2>&1 | tail -2"
    
    log_section "09" "Load Indexes"
    run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -i ${DB_NAME}_indexes $DB_NAME 2>&1 | tail -2"
    
    # 8. Verify
    log_section "10" "Verify"
    sleep 3
    local rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' '")
    
    local total=$(($(date +%s) - start))
    echo ""
    
    if [ "$rows" = "$EXPECTED_ROWS" ]; then
        log_ok "COMPLETE in ${total}s (Rows: $rows)"
    else
        log_err "COMPLETE but rows=$rows"
    fi
}

#============================================
# QUICK (check + recover if needed)
#============================================
cmd_quick() {
    log_section "00" "Quick Check"
    
    local srv=$(run "$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -c 'Server '")
    local rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' '")
    
    echo "  Server: $srv, Rows: $rows"
    
    if [ "$srv" -gt 0 ] && [ "$rows" = "$EXPECTED_ROWS" ]; then
        log_ok "HEALTHY"
    else
        log_warn "NEEDS RECOVERY"
        cmd_recover
    fi
}

#============================================
# GUARDIAN (AI + Backup)
#============================================
cmd_guardian() {
    cmd_guardian_ai
    echo ""
    cmd_guardian_bk
}

cmd_guardian_ai() {
    log_section "G" "AI Guardian"
    
    local srv=$(run "$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -c 'Server '")
    local rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' '")
    
    if [ "$srv" -gt 0 ] && [ "$rows" = "$EXPECTED_ROWS" ]; then
        log_ok "OK (Server: $srv, Rows: $rows)"
    else
        log_warn "Issue detected - Auto-recover starting..."
        cmd_recover
    fi
}

cmd_guardian_bk() {
    log_section "B" "Backup Guardian"
    
    local latest=$(find $BACKUP_DIR -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    
    if [ -z "$latest" ]; then
        log_warn "No backup - creating..."
        cmd_backup
        return
    fi
    
    # Verify backup
    local schema=$(test -f "$latest/unloaddb/${DB_NAME}_schema" && echo 1 || echo 0)
    local objects=$(test -f "$latest/unloaddb/${DB_NAME}_objects" && echo 1 || echo 0)
    
    if [ "$schema" -eq 1 ] && [ "$objects" -eq 1 ]; then
        log_ok "Backup OK: $latest"
    else
        log_warn "Backup incomplete - recreating..."
        cmd_backup
    fi
}

#============================================
# BACKUP
#============================================
cmd_backup() {
    log_section "B" "Create Backup"
    local start=$(date +%s)
    
    local timestamp=$(date +%Y%m%d)
    local backup_path="$BACKUP_DIR/${DB_NAME}-live-unload-$timestamp"
    
    mkdir -p "$backup_path/unloaddb"
    
    run "$CUBRID_BIN/cubrid server stop $DB_NAME 2>&1 | tail -1 || true"
    sleep 2
    run "mkdir -p /tmp/backup && cd /tmp/backup && $CUBRID_BIN/cubrid unloaddb -u dba -S ${DB_NAME} 2>&1 | tail -3"
    kubectl cp "$NAMESPACE/$POD:/tmp/backup/unloaddb" "$backup_path/unloaddb" 2>&1 | tail -2
    run "$CUBRID_BIN/cubrid server start $DB_NAME 2>&1 | tail -2"
    
    local size=$(du -sh "$backup_path" 2>/dev/null | cut -f1)
    local total=$(($(date +%s) - start))
    
    log_ok "Done: $backup_path ($size) in ${total}s"
}

#============================================
# VERIFY
#============================================
cmd_verify() {
    log_section "V" "Verify Backup"
    
    local latest=$(find $BACKUP_DIR -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    
    if [ -z "$latest" ]; then
        log_err "No backup"
        return 1
    fi
    
    log "Checking: $latest"
    
    local schema=$(test -f "$latest/unloaddb/${DB_NAME}_schema" && echo 1 || echo 0)
    local objects=$(test -f "$latest/unloaddb/${DB_NAME}_objects" && echo 1 || echo 0)
    local indexes=$(test -f "$latest/unloaddb/${DB_NAME}_indexes" && echo 1 || echo 0)
    
    [ "$schema" -eq 1 ] && log_ok "Schema: OK" || log_err "Schema: MISSING"
    [ "$objects" -eq 1 ] && log_ok "Objects: OK" || log_err "Objects: MISSING"
    [ "$indexes" -eq 1 ] && log_ok "Indexes: OK" || log_err "Indexes: MISSING"
}

#============================================
# LOGS
#============================================
cmd_logs() {
    python3 -c "
import sqlite3
conn = sqlite3.connect('$LOG_DB')
ops = conn.execute('SELECT operation,status,duration_ms,timestamp FROM operations ORDER BY id DESC LIMIT 10').fetchall()
for op,st,du,ts in ops:
    icon = {'success':'✓','failed':'✗','warning':'⚠'}.get(st,'?')
    du_str = f'{du}ms' if du else ''
    print(f'{icon} [{ts}] {op} {du_str}')
conn.close()
" 2>/dev/null
}

#============================================
# ENTRY
#============================================
case "${1:-help}" in
    health|check) cmd_health ;;
    status) cmd_status ;;
    diagnose|diag) cmd_diagnose ;;
    recover|recovery) cmd_recover ;;
    quick) cmd_quick ;;
    guardian) cmd_guardian ;;
    guardian-ai|ai) cmd_guardian_ai ;;
    guardian-bk|bk) cmd_guardian_bk ;;
    backup|create) cmd_backup ;;
    verify) cmd_verify ;;
    logs) cmd_logs ;;
    logs-file) cat "$LOG_DIR/cubrid-recovery.log" 2>/dev/null || echo "No log file" ;;
    help|--help|-h) show_help ;;
    *) show_help ;;
esac
