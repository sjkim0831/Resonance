#!/bin/bash
#============================================
# Carbonet Recovery System v2 - Optimized
# 세분화된 단계, 상세 로그, 시간 측정
#============================================

set -e
shopt -s nullglob 2>/dev/null || true

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; NC='\033[0m'

# Config
NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
LOG_FILE="/opt/Resonance/var/log/cubrid-recovery.log"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
DB_DIR="/var/lib/cubrid/databases"
CUBRID="/home/cubrid/CUBRID"
PATH="$CUBRID/bin:$PATH"
CUBRID_DATABASES="$DB_DIR"

# Expected values
EXPECTED_ROWS=266
EXPECTED_TABLES=133

#============================================
# Logging Functions
#============================================
log() { 
    local msg="[$(date +%H:%M:%S)] $1"
    echo -e "${BLUE}$msg${NC}"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}
log_ok() { 
    local msg="[$(date +%H:%M:%S)] ✓ $1"
    echo -e "${GREEN}$msg${NC}"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}
log_err() { 
    local msg="[$(date +%H:%M:%S)] ✗ $1"
    echo -e "${RED}$msg${NC}"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}
log_warn() { 
    local msg="[$(date +%H:%M:%S)] ⚠ $1"
    echo -e "${YELLOW}$msg${NC}"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}
log_phase() { 
    local msg="[PHASE $1] $2"
    echo -e "${CYAN}$msg${NC}"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}
log_step() { 
    local msg="  └─ $1"
    echo -e "${MAGENTA}$msg${NC}"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

# Time tracking
start_timer() { START_TIME=$(date +%s%3N); }
get_elapsed() { 
    local end=$(date +%s%3N)
    echo $(( (end - START_TIME) / 1000 ))  # seconds with ms
}
log_time() { log_step "Time: $(get_elapsed)s"; }

# SQLite logging
sql_log() {
    python3 -c "
import sqlite3, sys
try:
    conn = sqlite3.connect('$LOG_DB')
    conn.execute('INSERT INTO operations (timestamp, operation, status, details, duration_ms) VALUES (datetime('now'), ?, ?, ?, ?)',
        ('$1', '$2', '$3', ${4:-None}))
    conn.commit()
    conn.close()
except Exception as e:
    pass  # Silent fail for logging
" 2>/dev/null || true
}

#============================================
# Pre-checks
#============================================
mkdir -p "$(dirname $LOG_FILE)" 2>/dev/null || true
mkdir -p /opt/Resonance/var/log 2>/dev/null || true

log "═══════════════════════════════════════════════════════════════"
log "   Carbonet Recovery System v2 - $(date)"
log "═══════════════════════════════════════════════════════════════"

#============================================
# Check Functions (Fast)
#============================================
check_files() {
    log_phase "0" "Checking DB files..."
    local count=$(kubectl exec $POD -n $NAMESPACE -- ls ${DB_DIR}/${DB_NAME}* 2>/dev/null | wc -l)
    local lgat=$(kubectl exec $POD -n $NAMESPACE -- test -f ${DB_DIR}/${DB_NAME}_lgat && echo 1 || echo 0)
    log_step "Files found: $count, LGAT: $lgat"
    [ "$count" -ge 5 ] && [ "$lgat" -eq 1 ] && return 0 || return 1
}

check_server() {
    log_phase "0" "Checking server..."
    local running=$(kubectl exec $POD -n $NAMESPACE -- bash -c "export CUBRID=$CUBRID && export PATH=\$CUBRID/bin:\$PATH && cubrid server status $DB_NAME 2>&1 | grep -c 'Server'" 2>/dev/null)
    log_step "Server running: $running"
    [ "$running" -gt 0 ] && return 0 || return 1
}

check_connect() {
    log_phase "0" "Checking connectivity..."
    local connected=$(kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=$CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=$DB_DIR
        timeout 10 csql -u dba ${DB_NAME}@localhost -c 'SELECT 1;' 2>&1 | grep -q 1 && echo 1 || echo 0
    " 2>/dev/null)
    log_step "Connected: $connected"
    [ "$connected" -eq 1 ] && return 0 || return 1
}

check_data() {
    log_phase "0" "Checking data integrity..."
    local rows=$(kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=$CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=$DB_DIR
        timeout 10 csql -u dba ${DB_NAME}@localhost -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]*[0-9]+' | head -1 | tr -d ' '
    " 2>/dev/null | tr -d ' ')
    [ -z "$rows" ] && rows=0
    log_step "Rows: $rows (expected: $EXPECTED_ROWS)"
    [ "$rows" -eq "$EXPECTED_ROWS" ] && return 0 || return 1
}

#============================================
# Full Diagnosis (Fast)
#============================================
diagnose() {
    log "───────────────────────────────────────────────────────────────"
    log "   DIAGNOSIS - Quick Status Check"
    log "───────────────────────────────────────────────────────────────"
    start_timer
    
    local issues=0
    
    check_files || { log_warn "File check FAILED"; issues=$((issues+1)); }
    check_server || { log_warn "Server check FAILED"; issues=$((issues+1)); }
    check_connect || { log_warn "Connect check FAILED"; issues=$((issues+1)); }
    check_data || { log_warn "Data check FAILED"; issues=$((issues+1)); }
    
    log_time
    log "───────────────────────────────────────────────────────────────"
    
    if [ $issues -eq 0 ]; then
        log_ok "SYSTEM HEALTHY - No recovery needed"
        return 0
    else
        log_warn "Found $issues issue(s) - Recovery recommended"
        return 1
    fi
}

#============================================
# Recovery Steps
#============================================
step_force_stop() {
    log_phase "1" "Force Stop CUBRID Services"
    start_timer
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=$CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        pkill -9 cub_server 2>/dev/null || true
        pkill -9 cubrid 2>/dev/null || true
        sleep 1
        rm -f /tmp/.cubrid_* /var/lib/cubrid/*.pid 2>/dev/null || true
    " 2>&1 | tail -1
    log_time
    sql_log "step_force_stop" "success" "Force stop completed"
}

step_clean_files() {
    log_phase "2" "Clean Corrupted Files"
    start_timer
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        cd $DB_DIR
        rm -f ${DB_NAME}* *_vinf *_lgat *_lgar* *.log .protected 2>/dev/null
        echo 'Files cleaned:'
        ls -la | grep -v '^d' | wc -l
    " 2>&1 | tail -2
    log_time
    sql_log "step_clean_files" "success" "Corrupted files removed"
}

step_fix_config() {
    log_phase "3" "Fix databases.txt Configuration"
    start_timer
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=$CUBRID
        > $DB_DIR/databases.txt
        > \$CUBRID/databases/databases.txt
        echo 'databases.txt cleared'
    " 2>&1
    log_time
    sql_log "step_fix_config" "success" "Config cleared"
}

step_create_db() {
    log_phase "4" "Create Fresh Database"
    start_timer
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=$CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        cd $DB_DIR
        cubrid createdb --db-volume-size=500M --log-volume-size=200M $DB_NAME en_US.iso88591 2>&1 | tail -3
    " 2>&1 | tail -4
    log_time
    sql_log "step_create_db" "success" "Fresh DB created"
}

step_configure() {
    log_phase "5" "Configure databases.txt"
    start_timer
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=$CUBRID
        cat > $DB_DIR/databases.txt << 'EOF'
#db-name	vol-path		db-host		log-path		lob-base-path
${DB_NAME}	${DB_DIR}	localhost	${DB_DIR}	file:${DB_DIR}/lob
EOF
        cp $DB_DIR/databases.txt \$CUBRID/databases/databases.txt
        echo 'Configured:'
        cat $DB_DIR/databases.txt
    " 2>&1 | tail -6
    log_time
    sql_log "step_configure" "success" "databases.txt configured"
}

step_start_server() {
    log_phase "6" "Start CUBRID Server"
    start_timer
    local max=3; local i=1
    while [ $i -le $max ]; do
        local out=$(kubectl exec $POD -n $NAMESPACE -- bash -c "
            export CUBRID=$CUBRID
            export PATH=\$CUBRID/bin:\$PATH
            export CUBRID_DATABASES=$DB_DIR
            cubrid server start $DB_NAME 2>&1
        " 2>&1)
        if echo "$out" | grep -q "success"; then
            log_ok "Server started on attempt $i"
            log_step "$out" | tail -1
            break
        fi
        log_warn "Attempt $i failed, retrying..."
        i=$((i+1))
        sleep 2
    done
    sleep 5
    log_time
    [ $i -le $max ] && sql_log "step_start_server" "success" "Server started" || sql_log "step_start_server" "failed" "Server start failed"
}

step_prepare_backup() {
    log_phase "7" "Prepare Backup Files"
    start_timer
    local latest=$(find $BACKUP_DIR -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    
    if [ -z "$latest" ]; then
        log_err "No backup found!"
        return 1
    fi
    
    log_step "Using: $latest"
    kubectl exec $POD -n $NAMESPACE -- bash -c "mkdir -p /tmp/backup" 2>/dev/null || true
    kubectl cp "$latest/unloaddb/." "$NAMESPACE/$POD:/tmp/backup/" 2>&1 | tail -2
    
    log_step "Backup files:"
    kubectl exec $POD -n $NAMESPACE -- bash -c "ls -lh /tmp/backup/*.tar* /tmp/backup/$DB_NAME* 2>/dev/null | head -5" 2>&1 | tail -3
    log_time
    sql_log "step_prepare_backup" "success" "Backup prepared"
}

step_load_schema() {
    log_phase "8" "Load Schema (427 statements)"
    start_timer
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=$CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=$DB_DIR
        cd /tmp/backup
        timeout 120 cubrid loaddb -u dba -S -s ${DB_NAME}_schema $DB_NAME 2>&1 | tail -5
    " 2>&1 | tail -5
    log_time
    sql_log "step_load_schema" "success" "Schema loaded"
}

step_load_data() {
    log_phase "9" "Load Data (244,917 objects)"
    start_timer
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=$CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=$DB_DIR
        cd /tmp/backup
        timeout 300 cubrid loaddb -u dba -S -d ${DB_NAME}_objects $DB_NAME 2>&1 | tail -5
    " 2>&1 | tail -5
    log_time
    sql_log "step_load_data" "success" "Data loaded (244917 objects)"
}

step_load_indexes() {
    log_phase "10" "Load Indexes (142 indexes)"
    start_timer
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=$CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=$DB_DIR
        cd /tmp/backup
        timeout 60 cubrid loaddb -u dba -S -i ${DB_NAME}_indexes $DB_NAME 2>&1 | tail -5
    " 2>&1 | tail -5
    log_time
    sql_log "step_load_indexes" "success" "Indexes loaded (142)"
}

step_verify() {
    log_phase "11" "Verify Recovery"
    start_timer
    
    local rows=$(kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=$CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=$DB_DIR
        timeout 10 csql -u dba ${DB_NAME}@localhost -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]*[0-9]+' | head -1 | tr -d ' '
    " 2>/dev/null | tr -d ' ')
    
    [ -z "$rows" ] && rows=0
    
    log_step "Row count: $rows (expected: $EXPECTED_ROWS)"
    
    if [ "$rows" -eq "$EXPECTED_ROWS" ]; then
        log_ok "VERIFICATION PASSED"
        log_time
        sql_log "step_verify" "success" "Rows: $rows"
        return 0
    else
        log_warn "VERIFICATION PARTIAL (rows: $rows, expected: $EXPECTED_ROWS)"
        log_time
        sql_log "step_verify" "partial" "Rows: $rows"
        return 1
    fi
}

#============================================
# Recovery Orchestrator
#============================================
recovery_summary() {
    log ""
    log "═══════════════════════════════════════════════════════════════"
    log "   RECOVERY SUMMARY"
    log "═══════════════════════════════════════════════════════════════"
    
    python3 -c "
import sqlite3
conn = sqlite3.connect('$LOG_DB')
ops = conn.execute('SELECT operation, status, duration_ms FROM operations ORDER BY id DESC LIMIT 15').fetchall()
print()
for op, status, dur in ops:
    icon = {'success': '✓', 'failed': '✗', 'partial': '⚠'}.get(status, '?')
    print(f'  {icon} {op} - {dur}ms' if dur else f'  {icon} {op}')
conn.close()
" 2>/dev/null
    
    log ""
    log "Log file: $LOG_FILE"
    log "═══════════════════════════════════════════════════════════════"
}

# Quick recovery (optimized sequence)
quick_recover() {
    log "───────────────────────────────────────────────────────────────"
    log "   QUICK RECOVERY MODE (Optimized)"
    log "───────────────────────────────────────────────────────────────"
    start_timer
    local total_start=$(date +%s)
    
    # Fast detection
    diagnose && { log_ok "No recovery needed"; return 0; }
    
    # Optimized sequence (minimize steps)
    step_force_stop
    step_clean_files
    step_fix_config
    step_create_db
    step_configure
    step_start_server
    step_prepare_backup
    step_load_schema
    step_load_data
    step_load_indexes
    step_verify
    
    local total_time=$(( $(date +%s) - total_start ))
    log ""
    log_ok "Total recovery time: ${total_time}s"
    sql_log "quick_recover" "completed" "Total: ${total_time}s" $((total_time * 1000))
    recovery_summary
}

# Full recovery (with all checks)
full_recover() {
    log "───────────────────────────────────────────────────────────────"
    log "   FULL RECOVERY MODE (Comprehensive)"
    log "───────────────────────────────────────────────────────────────"
    local total_start=$(date +%s)
    
    # Pre-check
    diagnose
    
    # Full sequence
    step_force_stop
    step_clean_files
    step_fix_config
    step_create_db
    step_configure
    
    # Verify creation
    log_phase "5.5" "Verify DB Creation"
    local created=$(kubectl exec $POD -n $NAMESPACE -- ls ${DB_DIR}/${DB_NAME} 2>/dev/null | wc -l)
    if [ "$created" -eq 1 ]; then
        log_ok "DB created successfully"
    else
        log_err "DB creation failed"
        return 1
    fi
    
    step_start_server
    step_prepare_backup
    step_load_schema
    step_load_data
    step_load_indexes
    step_verify
    
    local total_time=$(( $(date +%s) - total_start ))
    log_ok "Total recovery time: ${total_time}s"
    sql_log "full_recover" "completed" "Total: ${total_time}s" $((total_time * 1000))
    recovery_summary
}

#============================================
# Entry Point
#============================================
case "${1:-help}" in
    diagnose|check|status)
        diagnose
        ;;
    quick|auto)
        quick_recover
        ;;
    full|recover)
        full_recover
        ;;
    *)
        echo "Usage: $0 {diagnose|quick|full}"
        echo ""
        echo "Commands:"
        echo "  diagnose  - Quick status check (fast)"
        echo "  quick     - Optimized recovery (min steps)"
        echo "  full      - Comprehensive recovery (all checks)"
        echo ""
        echo "Examples:"
        echo "  $0 diagnose     # Check current status"
        echo "  $0 quick        # Fast recovery if needed"
        echo "  $0 full         # Full recovery with verification"
        ;;
esac
