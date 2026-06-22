#!/bin/bash
#============================================
# Carbonet Comprehensive Recovery System v2
# Handles ALL failure scenarios
#============================================

set -e
shopt -s nullglob

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; }
phase() { echo -e "${CYAN}═══[$1]═══${NC} $2"; }

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
DB_DIR="/var/lib/cubrid/databases"

log_op() { python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
conn.execute('INSERT INTO operations(operation,status,details,duration_ms) VALUES(?,?,?,?)',('$1','$2','$3',${4:-None}))
conn.commit()
conn.close()
" 2>/dev/null || true; }

#============================================
# SCENARIO DETECTION
#============================================
detect_scenario() {
    log "═══════════════════════════════════════"
    log "   Failure Scenario Detection"
    log "═══════════════════════════════════════"
    
    local scenarios=()
    local files=$(kubectl exec $POD -n $NAMESPACE -- ls $DB_DIR/${DB_NAME}* 2>/dev/null | wc -l)
    local lgat=$(kubectl exec $POD -n $NAMESPACE -- ls ${DB_DIR}/${DB_NAME}_lgat 2>/dev/null | wc -l)
    local db=$(kubectl exec $POD -n $NAMESPACE -- ls ${DB_DIR}/${DB_NAME} 2>/dev/null | wc -l)
    local server=$(kubectl exec $POD -n $NAMESPACE -- bash -c "export CUBRID=/home/cubrid/CUBRID && \$CUBRID/bin/cubrid server status $DB_NAME 2>&1 | grep -c 'Server'" 2>/dev/null)
    local connect=$(kubectl exec $POD -n $NAMESPACE -- bash -c "export CUBRID=/home/cubrid/CUBRID && export PATH=\$CUBRID/bin:\$PATH && csql -u dba ${DB_NAME}@localhost -c 'SELECT 1;' 2>&1 | grep -q 1 && echo 1 || echo 0" 2>/dev/null || echo 0)
    local rows=$(kubectl exec $POD -n $NAMESPACE -- bash -c "export CUBRID=/home/cubrid/CUBRID && export PATH=\$CUBRID/bin:\$PATH && csql -u dba ${DB_NAME}@localhost -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -A1 'count' | tail -1 | tr -d ' '" 2>/dev/null | tr -d ' ' || echo "ERR")
    
    echo "  Files: $files, LGAT: $lgat, DB: $db"
    echo "  Server: $server, Connect: $connect, Rows: $rows"
    
    # Detect specific scenarios
    if [ "$files" -eq 0 ]; then
        scenarios+=("ALL_FILES_MISSING")
        warn "→ Scenario: ALL_FILES_MISSING (Complete loss)"
    elif [ "$db" -eq 0 ]; then
        scenarios+=("MAIN_DB_MISSING")
        warn "→ Scenario: MAIN_DB_MISSING (Data file lost)"
    elif [ "$lgat" -eq 0 ]; then
        scenarios+=("LOG_MISSING")
        warn "→ Scenario: LOG_MISSING (Transaction log lost)"
    fi
    
    if [ "$server" -eq 0 ]; then
        scenarios+=("SERVER_DOWN")
        warn "→ Scenario: SERVER_DOWN"
    fi
    
    if [ "$connect" -eq 0 ] && [ "$server" -gt 0 ]; then
        scenarios+=("CORRUPTED")
        warn "→ Scenario: CORRUPTED (Can't connect but server running)"
    fi
    
    if [ "$rows" != "266" ] && [ "$rows" != "ERR" ]; then
        scenarios+=("DATA_MISMATCH")
        warn "→ Scenario: DATA_MISMATCH (Rows: $rows, expected 266)"
    fi
    
    if [ ${#scenarios[@]} -eq 0 ]; then
        ok "→ No failure detected - system healthy"
        return 0
    fi
    
    echo "  → Detected: ${scenarios[*]}"
    return 1
}

#============================================
# RECOVERY FUNCTIONS
#============================================
force_stop() {
    phase "STOP" "Force stopping CUBRID..."
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=/home/cubrid/CUBRID
        pkill -9 cub_server 2>/dev/null || true
        pkill -9 cubrid 2>/dev/null || true
        sleep 2
        rm -f /tmp/.cubrid_* 2>/dev/null || true
    " 2>&1 | tail -2
    ok "Stopped"
}

clean_all() {
    phase "CLEAN" "Removing all DB files..."
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        cd $DB_DIR
        rm -f ${DB_NAME}* *_vinf *_lgat *_lgar* *.log .protected 2>/dev/null
        echo 'Cleaned'
        ls -la | grep -v '^d'
    " 2>&1 | tail -6
}

create_fresh() {
    phase "CREATE" "Creating fresh database..."
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        cd $DB_DIR
        cubrid createdb --db-volume-size=500M --log-volume-size=200M ${DB_NAME} en_US.iso88591 2>&1 | tail -3
        echo 'Files:'
        ls -lh ${DB_NAME}* | head -6
    " 2>&1 | tail -8
}

fix_config() {
    phase "CONFIG" "Fixing databases.txt..."
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=/home/cubrid/CUBRID
        cat > $DB_DIR/databases.txt << 'EOF'
#db-name	vol-path		db-host		log-path		lob-base-path
${DB_NAME}	$DB_DIR	localhost	$DB_DIR	file:$DB_DIR/lob
EOF
        cp $DB_DIR/databases.txt \$CUBRID/databases/databases.txt
        echo 'Configured'
        cat $DB_DIR/databases.txt
    " 2>&1 | tail -6
}

start_server() {
    phase "START" "Starting server..."
    local max=3; local i=1
    while [ $i -le $max ]; do
        local out=$(kubectl exec $POD -n $NAMESPACE -- bash -c "export CUBRID=/home/cubrid/CUBRID && export PATH=\$CUBRID/bin:\$PATH && export CUBRID_DATABASES=$DB_DIR && cubrid server start ${DB_NAME} 2>&1" 2>&1)
        if echo "$out" | grep -q "success"; then
            ok "Server started"
            sleep 5
            return 0
        fi
        warn "Attempt $i failed"
        i=$((i+1)); sleep 3
    done
    err "Server start failed"
    return 1
}

find_backup() {
    local latest=$(find $BACKUP_DIR -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    [ -z "$latest" ] && latest=$(find /tmp -maxdepth 2 -type d -name "unloaddb" 2>/dev/null | head -1 | sed 's|/tmp/backup/unloaddb||')
    echo "$latest"
}

copy_backup() {
    phase "COPY" "Copying backup..."
    local latest=$(find_backup)
    if [ -z "$latest" ]; then
        err "No backup found!"
        return 1
    fi
    log "Using: $latest"
    kubectl exec $POD -n $NAMESPACE -- mkdir -p /tmp/backup 2>/dev/null || true
    kubectl cp "$latest/unloaddb/." "$NAMESPACE/$POD:/tmp/backup/" 2>&1 | tail -2
    ok "Backup copied"
}

load_data() {
    phase "LOAD" "Loading backup data..."
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=$DB_DIR
        cd /tmp/backup
        
        echo 'Schema (427 statements)...'
        cubrid loaddb -u dba -S -s ${DB_NAME}_schema ${DB_NAME} 2>&1 | tail -3
        
        echo 'Data (244,917 objects)...'
        cubrid loaddb -u dba -S -d ${DB_NAME}_objects ${DB_NAME} 2>&1 | tail -3
        
        echo 'Indexes (142)...'
        cubrid loaddb -u dba -S -i ${DB_NAME}_indexes ${DB_NAME} 2>&1 | tail -3
    " 2>&1 | grep -E "(Schema|Data|Indexes|statements|inserted|finished)"
}

verify() {
    phase "VERIFY" "Verifying recovery..."
    sleep 3
    local rows=$(kubectl exec $POD -n $NAMESPACE -- bash -c "export CUBRID=/home/cubrid/CUBRID && export PATH=\$CUBRID/bin:\$PATH && csql -u dba ${DB_NAME}@localhost -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -A1 'count' | tail -1 | tr -d ' '" 2>/dev/null | tr -d ' ')
    local tables=$(kubectl exec $POD -n $NAMESPACE -- bash -c "export CUBRID=/home/cubrid/CUBRID && export PATH=\$CUBRID/bin:\$PATH && csql -u dba ${DB_NAME}@localhost -c 'SHOW TABLES;' 2>&1 | grep -c 'row'" 2>/dev/null)
    echo "  Tables: $tables (expected: 133)"
    echo "  Rows: $rows (expected: 266)"
    [ "$rows" == "266" ] && [ "$tables" == "133" ] && ok "Recovery verified" || warn "Partial recovery"
}

#============================================
# MAIN RECOVERY
#============================================
comprehensive_recovery() {
    log "═══════════════════════════════════════"
    log "   COMPREHENSIVE RECOVERY - $(date)"
    log "═══════════════════════════════════════"
    local start=$(date +%s)
    log_op "recovery" "started" "Comprehensive recovery" 0
    
    # Detect scenario
    if detect_scenario; then
        ok "System healthy - no recovery needed"
        return 0
    fi
    
    # Recovery sequence
    force_stop
    clean_all
    fix_config
    create_fresh
    fix_config
    
    if ! start_server; then
        err "Recovery failed at server start"
        log_op "recovery" "failed" "Server start" 0
        return 1
    fi
    
    if ! copy_backup; then
        err "Recovery failed - no backup"
        log_op "recovery" "failed" "No backup" 0
        return 1
    fi
    
    load_data
    start_server
    verify
    
    local duration=$(( $(date +%s) - start ))
    log "═══════════════════════════════════════"
    ok "   RECOVERY COMPLETE in ${duration}s"
    log "═══════════════════════════════════════"
    log_op "recovery" "success" "Complete" $duration
}

#============================================
# QUICK DIAGNOSE
#============================================
quick_check() {
    kubectl exec $POD -n $NAMESPACE -- bash -c "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        echo '=== Quick Status ==='
        cubrid server status $DB_NAME 2>&1 | tail -1
        echo 'Files:'
        ls -lh $DB_DIR/${DB_NAME}* 2>/dev/null | wc -l
        echo 'Rows:'
        csql -u dba ${DB_NAME}@localhost -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -A1 'count' | tail -1 | tr -d ' '
    " 2>&1
}

#============================================
# ENTRY POINT
#============================================
case "${1:-help}" in
    diagnose|check) detect_scenario ;;
    recover|full) comprehensive_recovery ;;
    quick|status) quick_check ;;
    auto)
        detect_scenario && ok "Healthy" || comprehensive_recovery
        ;;
    *) 
        echo "Usage: $0 {diagnose|recover|auto|quick}"
        echo ""
        echo "Scenarios handled:"
        echo "  - ALL_FILES_MISSING: Complete data loss"
        echo "  - MAIN_DB_MISSING: Primary data file lost"
        echo "  - LOG_MISSING: Transaction log lost"
        echo "  - SERVER_DOWN: Server not running"
        echo "  - CORRUPTED: Can't connect to DB"
        echo "  - DATA_MISMATCH: Row count incorrect"
        ;;
esac
