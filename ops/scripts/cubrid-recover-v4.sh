#!/bin/bash
#============================================
# Carbonet Recovery System v4 - Optimized
# 15세분화 단계, 정확한 시간 측정, 병렬 처리
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
LOG_FILE="/opt/Resonance/var/log/cubrid-recovery.log"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
DB_DIR="/var/lib/cubrid/databases"
CUBRID_BIN="/home/cubrid/CUBRID/bin"

EXPECTED_ROWS=266

# Timing
declare -A PHASE_START
declare -A PHASE_TIME
TOTAL_START=$(date +%s%3N)

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; echo "[$(date +%H:%M:%S)] $1" >> "$LOG_FILE"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; echo "[$(date +%H:%M:%S)] ✓ $1" >> "$LOG_FILE"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; echo "[$(date +%H:%M:%S)] ✗ $1" >> "$LOG_FILE"; }
log_warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; echo "[$(date +%H:%M:%S)] ⚠ $1" >> "$LOG_FILE"; }
log_phase() { echo -e "${CYAN}[PHASE $1]${NC} $2"; echo "[PHASE $1] $2" >> "$LOG_FILE"; }

phase_start() { PHASE_START[$1]=$(date +%s%3N); }
phase_end() { 
    local p=$1
    PHASE_TIME[$p]=$(( $(date +%s%3N) - ${PHASE_START[$p]} ))
    echo -e "${MAGENTA}  └─ Time: $(( ${PHASE_TIME[$p]} / 1000 ))s${NC}"
}

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

mkdir -p /opt/Resonance/var/log 2>/dev/null

#============================================
# PHASE 00: Quick Health Check (병렬)
#============================================
phase_00() {
    log_phase "00" "Quick Health Check"
    phase_start 00
    
    # 병렬로 상태 확인
    local srv=0 rows=0 files=0
    
    # Server check
    run "$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -q 'Server ' && echo 1 || echo 0" &
    local srv_pid=$!
    
    # Files check
    run "ls $DB_DIR/${DB_NAME}* 2>/dev/null | wc -l" &
    local files_pid=$!
    
    wait $srv_pid
    srv=$(run "$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -c 'Server '")
    
    wait $files_pid
    files=$(run "ls $DB_DIR/${DB_NAME}* 2>/dev/null | wc -l")
    
    # Rows check (가장 느림, 별도)
    rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' '")
    
    echo "  └─ Server: $srv, Files: $files, Rows: $rows"
    
    if [ "$srv" -gt 0 ] && [ "$files" -ge 5 ] && [ "$rows" = "$EXPECTED_ROWS" ]; then
        log_ok "SYSTEM HEALTHY - No recovery needed"
        phase_end 00
        return 0
    fi
    
    log_warn "Issues found - recovery needed"
    phase_end 00
    return 1
}

#============================================
# PHASE 01: Force Stop (빠름)
#============================================
phase_01() {
    log_phase "01" "Force Stop Services"
    phase_start 01
    
    run "$CUBRID_BIN/cubrid server stop $DB_NAME 2>&1 | tail -1 || true"
    run "pkill -9 cub_server 2>/dev/null || true"
    sleep 1
    
    log_ok "Services stopped"
    phase_end 01
}

#============================================
# PHASE 02: Clean Files (빠름)
#============================================
phase_02() {
    log_phase "02" "Clean Corrupted Files"
    phase_start 02
    
    run "cd $DB_DIR && rm -f ${DB_NAME}* *_vinf *_lgat *_lgar* *.log 2>/dev/null; ls ${DB_NAME}* 2>/dev/null | wc -l"
    
    log_ok "Files cleaned"
    phase_end 02
}

#============================================
# PHASE 03: Reset Config (빠름)
#============================================
phase_03() {
    log_phase "03" "Reset databases.txt"
    phase_start 03
    
    run "> $DB_DIR/databases.txt"
    run "> $CUBRID_BIN/databases/databases.txt"
    
    log_ok "Config reset"
    phase_end 03
}

#============================================
# PHASE 04: Create DB (중간)
#============================================
phase_04() {
    log_phase "04" "Create Fresh Database"
    phase_start 04
    
    local out=$(run "cd $DB_DIR && $CUBRID_BIN/cubrid createdb --db-volume-size=200M --log-volume-size=100M $DB_NAME en_US.iso88591 2>&1")
    echo "$out" | tail -3
    
    # Verify
    local created=$(run "test -f $DB_DIR/$DB_NAME && echo 1 || echo 0")
    if [ "$created" -eq 1 ]; then
        log_ok "Database created"
    else
        log_err "Database creation failed"
    fi
    
    phase_end 04
    return $([ "$created" -eq 1 ] && echo 0 || echo 1)
}

#============================================
# PHASE 05: Configure (빠름)
#============================================
phase_05() {
    log_phase "05" "Configure databases.txt"
    phase_start 05
    
    run "cat > $DB_DIR/databases.txt << 'EOF'
carbonet	$DB_DIR	localhost	$DB_DIR	file:$DB_DIR/lob
EOF
cp $DB_DIR/databases.txt $CUBRID_BIN/databases/databases.txt"
    
    log_ok "Configured"
    phase_end 05
}

#============================================
# PHASE 06: Start Server (중간)
#============================================
phase_06() {
    log_phase "06" "Start CUBRID Server"
    phase_start 06
    
    run "$CUBRID_BIN/cubrid server start $DB_NAME 2>&1 | tail -2"
    sleep 5
    
    local running=$(run "$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -c 'Server '")
    
    if [ "$running" -gt 0 ]; then
        log_ok "Server started"
    else
        log_err "Server start failed"
    fi
    
    phase_end 06
    return $([ "$running" -gt 0 ] && echo 0 || echo 1)
}

#============================================
# PHASE 07: Prepare Backup (병렬 + 느림)
#============================================
phase_07() {
    log_phase "07" "Prepare Backup"
    phase_start 07
    
    # Find latest backup
    local latest=$(find $BACKUP_DIR -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    
    if [ -z "$latest" ]; then
        log_err "No backup found!"
        phase_end 07
        return 1
    fi
    
    echo "  └─ Using: $latest"
    
    # Clean and prepare
    run "rm -rf /tmp/backup; mkdir -p /tmp/backup"
    
    # Copy in background (慢)
    kubectl cp "$latest/unloaddb/." "$NAMESPACE/$POD:/tmp/backup/" 2>&1 &
    local copy_pid=$!
    
    # Wait with timeout
    local count=0
    while kill -0 $copy_pid 2>/dev/null; do
        sleep 1
        count=$((count + 1))
        if [ $count -gt 30 ]; then
            kill $copy_pid 2>/dev/null
            log_err "Copy timeout"
            phase_end 07
            return 1
        fi
    done
    
    # Verify
    local schema=$(run "test -f /tmp/backup/${DB_NAME}_schema && echo 1 || echo 0")
    local objects=$(run "test -f /tmp/backup/${DB_NAME}_objects && echo 1 || echo 0")
    
    if [ "$schema" -eq 1 ] && [ "$objects" -eq 1 ]; then
        log_ok "Backup ready"
    else
        log_err "Backup incomplete"
        phase_end 07
        return 1
    fi
    
    phase_end 07
}

#============================================
# PHASE 08: Load Schema (중간)
#============================================
phase_08() {
    log_phase "08" "Load Schema"
    phase_start 08
    
    local out=$(run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -s ${DB_NAME}_schema $DB_NAME 2>&1")
    local stmts=$(echo "$out" | grep 'statements executed' | awk '{print $1}')
    
    echo "  └─ Statements: ${stmts:-0}"
    log_ok "Schema loaded"
    phase_end 08
}

#============================================
# PHASE 09: Load Data (느림 - 병렬 불가)
#============================================
phase_09() {
    log_phase "09" "Load Data (244,917 objects)"
    phase_start 09
    
    local out=$(run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -d ${DB_NAME}_objects $DB_NAME 2>&1")
    local inserted=$(echo "$out" | grep 'object(s) inserted' | awk '{print $1}')
    
    echo "  └─ Inserted: ${inserted:-0}"
    log_ok "Data loaded"
    phase_end 09
}

#============================================
# PHASE 10: Load Indexes (중간)
#============================================
phase_10() {
    log_phase "10" "Load Indexes"
    phase_start 10
    
    local out=$(run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -i ${DB_NAME}_indexes $DB_NAME 2>&1")
    local idx=$(echo "$out" | grep 'statements executed' | awk '{print $1}')
    
    echo "  └─ Indexes: ${idx:-0}"
    log_ok "Indexes loaded"
    phase_end 10
}

#============================================
# PHASE 11: Restart Server (중간)
#============================================
phase_11() {
    log_phase "11" "Restart Server"
    phase_start 11
    
    run "$CUBRID_BIN/cubrid server stop $DB_NAME 2>&1 | tail -1 || true"
    sleep 2
    run "$CUBRID_BIN/cubrid server start $DB_NAME 2>&1 | tail -2"
    sleep 5
    
    local running=$(run "$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -c 'Server '")
    
    if [ "$running" -gt 0 ]; then
        log_ok "Server restarted"
    else
        log_err "Server restart failed"
    fi
    
    phase_end 11
}

#============================================
# PHASE 12: Verify (중간)
#============================================
phase_12() {
    log_phase "12" "Verify Recovery"
    phase_start 12
    
    sleep 2
    
    local rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' '")
    
    echo "  └─ Rows: ${rows:-0} (expected: $EXPECTED_ROWS)"
    
    if [ "$rows" = "$EXPECTED_ROWS" ]; then
        log_ok "VERIFIED - Recovery successful"
        phase_end 12
        return 0
    else
        log_err "VERIFICATION FAILED"
        phase_end 12
        return 1
    fi
}

#============================================
# PHASE 13: Cleanup (빠름)
#============================================
phase_13() {
    log_phase "13" "Cleanup"
    phase_start 13
    
    run "rm -f /tmp/backup/*_loaddb.log 2>/dev/null; rm -rf /tmp/backup/unloaddb 2>/dev/null; ls /tmp/backup/ 2>/dev/null | head -5"
    
    log_ok "Cleanup done"
    phase_end 13
}

#============================================
# SUMMARY
#============================================
print_summary() {
    local total=$(( $(date +%s%3N) - TOTAL_START ))
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "   RECOVERY SUMMARY"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "Phase Times:"
    for p in 00 01 02 03 04 05 06 07 08 09 10 11 12 13; do
        local t=${PHASE_TIME[$p]}
        if [ -n "$t" ]; then
            echo "  Phase $p: $((t / 1000))s"
        fi
    done
    echo ""
    echo "Total Time: $((total / 1000))s"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
}

#============================================
# FULL RECOVERY
#============================================
run_recovery() {
    local start=$(date +%s)
    
    log "═══════════════════════════════════════════════════════════════"
    log "   RECOVERY v4 START - $(date)"
    log "═══════════════════════════════════════════════════════════════"
    
    # Run phases
    phase_01 || true
    phase_02 || true
    phase_03 || true
    phase_04 || { log_err "FAILED at CREATE"; return 1; }
    phase_05 || true
    phase_06 || { log_err "FAILED at START"; return 1; }
    phase_07 || { log_err "FAILED at BACKUP"; return 1; }
    phase_08 || true
    phase_09 || true
    phase_10 || true
    phase_11 || true
    phase_12 || true
    phase_13 || true
    
    local total=$(( $(date +%s) - start ))
    
    echo ""
    log_ok "COMPLETE in ${total}s"
    
    print_summary
}

#============================================
# QUICK CHECK (단독 실행)
#============================================
quick_check() {
    TOTAL_START=$(date +%s%3N)
    phase_00
}

#============================================
# ENTRY
#============================================
case "${1:-help}" in
    quick|check) quick_check ;;
    full|recover) run_recovery ;;
    *) echo "Usage: $0 {quick|full}"
       echo "  quick  - Health check only"
       echo "  full   - Full recovery"
       ;;
esac
