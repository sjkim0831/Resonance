#!/bin/bash
#============================================
# CUBRID Automated Recovery Testing
# - Daily automatic recovery test
# - Data integrity validation
# - SLO monitoring
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
CUBRID_BIN="/home/cubrid/CUBRID/bin"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
TEST_LOG="/opt/Resonance/var/log/recovery-test.log"
ALERTER="/opt/Resonance/ops/scripts/cubrid-alerter.sh"

# SLO thresholds (seconds)
SLO_RECOVERY=120  # 2 minutes
SLO_BACKUP=60     # 1 minute

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; echo "[$(date +%H:%M:%S)] $1" >> "$TEST_LOG"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; echo "[$(date +%H:%M:%S)] ✓ $1" >> "$TEST_LOG"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; echo "[$(date +%H:%M:%S)] ✗ $1" >> "$TEST_LOG"; }
log_warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; echo "[$(date +%H:%M:%S)] ⚠ $1" >> "$TEST_LOG"; }

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

#============================================
# TEST RECOVERY
#============================================
test_recovery() {
    local start=$(date +%s)
    local test_name="recovery_test_$(date +%Y%m%d_%H%M%S)"
    local result="PASS"
    
    log "═══════════════════════════════════════════════════════════════"
    log "   AUTOMATED RECOVERY TEST"
    log "   Started: $(date)"
    log "═══════════════════════════════════════════════════════════════"
    
    # Record initial state
    local initial_rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' ')
    log "Initial rows: $initial_rows"
    
    # Step 1: Ensure we have a backup
    log "Step 1: Ensuring backup exists..."
    local latest_backup=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "${DB_NAME}-backup-*" | sort -r | head -1)
    
    if [ -z "$latest_backup" ] || [ ! -d "$latest_backup/unloaddb" ]; then
        log "No backup found, creating one..."
        /opt/Resonance/ops/scripts/cubrid-web-api.sh route /backup/create
        latest_backup=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "${DB_NAME}-backup-*" | sort -r | head -1)
    fi
    
    if [ -z "$latest_backup" ]; then
        log_err "Cannot proceed without backup"
        result="FAIL"
        return 1
    fi
    
    log "Using backup: $latest_backup"
    
    # Step 2: Simulate data corruption (delete some data)
    log "Step 2: Simulating data loss..."
    run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'DELETE FROM admin_emission_gwp_value LIMIT 10;' 2>&1 | tail -3"
    
    local rows_after_delete=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' ')
    log "Rows after deletion: $rows_after_delete"
    
    if [ "$rows_after_delete" -eq "$initial_rows" ]; then
        log_warn "Deletion didn't work, but proceeding with recovery test"
    fi
    
    # Step 3: Perform recovery
    log "Step 3: Performing recovery..."
    local recover_start=$(date +%s)
    
    # Stop server
    run "$CUBRID_BIN/cubrid server stop $DB_NAME 2>&1 | tail -1 || true"
    sleep 3
    
    # Clean
    run "cd /var/lib/cubrid/databases && rm -f ${DB_NAME}* *_vinf *_lgat *_lgar* 2>/dev/null"
    run "> /var/lib/cubrid/databases/databases.txt"
    
    # Create fresh DB
    run "cd /var/lib/cubrid/databases && $CUBRID_BIN/cubrid createdb --db-volume-size=200M --log-volume-size=100M $DB_NAME en_US.iso88591 2>&1 | tail -3"
    
    # Configure
    run "cat > /var/lib/cubrid/databases/databases.txt << 'DBEOF'
$DB_NAME\t/var/lib/cubrid/databases\tlocalhost\t/var/lib/cubrid/databases\tfile:/var/lib/cubrid/databases/lob
DBEOF
cp /var/lib/cubrid/databases/databases.txt $CUBRID_BIN/databases/databases.txt"
    
    # Start server
    run "$CUBRID_BIN/cubrid server start $DB_NAME 2>&1 | tail -2"
    sleep 5
    
    # Copy backup
    run "rm -rf /tmp/backup; mkdir -p /tmp/backup"
    kubectl cp "$latest_backup/unloaddb" "$NAMESPACE/$POD:/tmp/backup/" 2>&1 | tail -2
    
    # Load
    run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -s ${DB_NAME}_schema $DB_NAME 2>&1 | tail -2"
    run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -d ${DB_NAME}_objects $DB_NAME 2>&1 | tail -2"
    run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -i ${DB_NAME}_indexes $DB_NAME 2>&1 | tail -2"
    
    # Step 4: Verify
    sleep 5
    local recover_duration=$(($(date +%s) - recover_start))
    
    local final_rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' ')
    
    # Step 5: Integrity check
    log "Step 5: Verifying data integrity..."
    local tables=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SHOW TABLES;' 2>&1 | grep -v NOTIFICATION | tail -n +4 | wc -l")
    local indexes=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SHOW INDEXES;' 2>&1 | grep -v NOTIFICATION | tail -n +4 | wc -l")
    
    # Calculate total time
    local total_duration=$(($(date +%s) - start))
    
    # Results
    log ""
    log "═══════════════════════════════════════════════════════════════"
    log "   TEST RESULTS"
    log "═══════════════════════════════════════════════════════════════"
    log "Initial rows:      $initial_rows"
    log "Final rows:        $final_rows"
    log "Tables:            $tables"
    log "Indexes:           $indexes"
    log "Recovery time:     ${recover_duration}s"
    log "Total test time:   ${total_duration}s"
    log "SLO threshold:     ${SLO_RECOVERY}s"
    log ""
    
    # Check results
    if [ "$final_rows" != "$initial_rows" ]; then
        log_err "Row count mismatch! Expected $initial_rows, got $final_rows"
        result="FAIL"
    fi
    
    if [ "$recover_duration" -gt "$SLO_RECOVERY" ]; then
        log_warn "Recovery time exceeded SLO: ${recover_duration}s > ${SLO_RECOVERY}s"
        result="SLO_BREACH"
        $ALERTER slo-breach "recovery" "$recover_duration" "$SLO_RECOVERY"
    fi
    
    if [ "$tables" -lt 100 ]; then
        log_warn "Low table count: $tables"
        result="WARNING"
    fi
    
    if [ "$result" = "PASS" ]; then
        log_ok "TEST PASSED"
    else
        log_err "TEST $result"
    fi
    
    log "═══════════════════════════════════════════════════════════════"
    
    # Log to SQLite
    python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
conn.execute('INSERT INTO timing_logs(process_name,duration_sec,status,details) VALUES(?,?,?,?)',
    ('recovery_test',$total_duration,'$result','initial=$initial_rows final=$final_rows'))
conn.commit()
conn.close()
" 2>/dev/null
    
    # Send alerts
    if [ "$result" = "FAIL" ]; then
        $ALERTER recovery-failed "test_failure" "Row mismatch: expected $initial_rows, got $final_rows"
    elif [ "$result" = "PASS" ]; then
        $ALERTER recovery-success "$recover_duration" "$final_rows"
    fi
    
    return $([ "$result" = "PASS" ] && echo 0 || echo 1)
}

#============================================
# QUICK SMOKE TEST
#============================================
quick_test() {
    log "Running quick smoke test..."
    
    # Check server
    local server_status=$(run "$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -c 'running'")
    if [ "$server_status" != "1" ]; then
        log_err "Server not running"
        return 1
    fi
    
    # Check rows
    local rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' ')
    if [ -z "$rows" ] || [ "$rows" = "0" ]; then
        log_err "No rows in database"
        return 1
    fi
    
    # Check files
    local files=$(run "ls /var/lib/cubrid/databases/${DB_NAME}* 2>/dev/null | wc -l")
    if [ "$files" -lt 5 ]; then
        log_warn "Low file count: $files"
    fi
    
    log_ok "Smoke test passed (rows: $rows, files: $files)"
    return 0
}

#============================================
# ENTRY
#============================================
case "${1:-test}" in
    test|full) test_recovery ;;
    quick|smoke) quick_test ;;
    status)
        echo "Recent test results:"
        if [ -f "$TEST_LOG" ]; then
            grep -E "PASS|FAIL|BREACH" "$TEST_LOG" | tail -10
        fi
        ;;
    *)
        echo "Usage: $0 {test|quick|status}"
        ;;
esac
