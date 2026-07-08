#!/bin/bash
# DEPRECATED: CUBRID 제거됨 — 사용 금지
# PostgreSQL 환경: postgres-patroni-0/1/2 (Patroni HA)
echo "[DEPRECATED] cubrid-recover-v3: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

# Carbonet Recovery v3 - 12 phases with timing
# Usage: $0 {quick|full}

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; NC='\033[0m'

NAMESPACE="carbonet-prod"; DB_NAME="carbonet"; POD="cubrid-carbonet-0"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
LOG_FILE="/opt/Resonance/var/log/cubrid-recovery.log"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
DB_DIR="/var/lib/cubrid/databases"
CUBRID="/home/cubrid/CUBRID"
CUBRID_BIN="$CUBRID/bin"

EXPECTED_ROWS=266; EXPECTED_TABLES=133

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }
log_warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; }
log_phase() { echo -e "${CYAN}[PHASE $1]${NC} $2"; }
log_step() { echo -e "${MAGENTA}  └─${NC} $1"; }

declare -A PT; T0=$(date +%s)
log_time() { echo -e "${MAGENTA}  └─ Time: $(($(date +%s) - T0))s${NC}"; }

mkdir -p /opt/Resonance/var/log 2>/dev/null

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

# Fixed row count extraction
get_rows() {
    run "export CUBRID=$CUBRID; export PATH=\$CUBRID_BIN:\$PATH; export CUBRID_DATABASES=$DB_DIR
         csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | 
         grep -v NOTIFICATION | grep -v CODE | grep -v Time | grep -v Program | grep -v connected | 
         grep -v selected | grep -v Committed | awk 'NF==1 && /^ *[0-9]+$/ {print \$1}'" | head -1
}

srv_ok() { run "$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -q 'Server '"; } 

# QUICK CHECK
quick_check() {
    log_phase "00" "QUICK CHECK"
    local rows=$(get_rows)
    local srv=0
    srv_ok && srv=1 || srv=0
    log_step "Server: $srv, Rows: $rows"
    [ "$srv" = "1" ] && [ "$rows" = "$EXPECTED_ROWS" ] && log_ok "HEALTHY" || log_warn "NEEDS ATTENTION"
}

# PHASE 01: Force stop
p01() {
    log_phase "01" "Force Stop"
    run "export CUBRID=$CUBRID; cubrid server stop $DB_NAME 2>&1 | tail -1 || true; rm -f /tmp/.cubrid_*" 
    log_ok "Done"
}

# PHASE 02: Clean
p02() {
    log_phase "02" "Clean Files"
    run "cd $DB_DIR; rm -f ${DB_NAME}* *_vinf *_lgat *_lgar* *.log 2>/dev/null; echo 'Cleaned'"
    log_ok "Done"
}

# PHASE 03: Fix config
p03() {
    log_phase "03" "Fix Config"
    run "export CUBRID=$CUBRID; > $DB_DIR/databases.txt; > \$CUBRID/databases/databases.txt"
    log_ok "Done"
}

# PHASE 04: Create DB
p04() {
    log_phase "04" "Create DB"
    run "export CUBRID=$CUBRID; export PATH=\$CUBRID_BIN:\$PATH; cd $DB_DIR; cubrid createdb --db-volume-size=500M --log-volume-size=200M $DB_NAME en_US.iso88591 2>&1 | tail -3"
    [ -f /var/lib/cubrid/databases/${DB_NAME} ] && log_ok "Created" || log_err "Failed"
}

# PHASE 05: Configure
p05() {
    log_phase "05" "Configure"
    run "export CUBRID=$CUBRID; cat > $DB_DIR/databases.txt << 'EOF'
#db-name\tvol-path\tdb-host\tlog-path\tlob-base-path
${DB_NAME}\t${DB_DIR}\tlocalhost\t${DB_DIR}\tfile:${DB_DIR}/lob
EOF
cp $DB_DIR/databases.txt \$CUBRID/databases/databases.txt"
    log_ok "Done"
}

# PHASE 06: Start server
p06() {
    log_phase "06" "Start Server"
    run "export CUBRID=$CUBRID; export PATH=\$CUBRID_BIN:\$PATH; export CUBRID_DATABASES=$DB_DIR; cubrid server start $DB_NAME 2>&1 | tail -2"
    sleep 5
    srv_ok && log_ok "Started" || log_err "Failed"
}

# PHASE 07: Prepare backup
p07() {
    log_phase "07" "Prepare Backup"
    local latest=$(find $BACKUP_DIR -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    [ -z "$latest" ] && { log_err "No backup"; return 1; }
    log_step "Using: $latest"
    run "rm -rf /tmp/backup; mkdir -p /tmp/backup"
    kubectl cp "$latest/unloaddb/." "$NAMESPACE/$POD:/tmp/backup/" 2>&1 | tail -2
    [ -f /tmp/backup/${DB_NAME}_schema ] && log_ok "Ready" || log_err "Incomplete"
}

# PHASE 08: Load schema
p08() {
    log_phase "08" "Load Schema"
    run "export CUBRID=$CUBRID; export PATH=\$CUBRID_BIN:\$PATH; export CUBRID_DATABASES=$DB_DIR; cd /tmp/backup; timeout 120 cubrid loaddb -u dba -S -s ${DB_NAME}_schema $DB_NAME 2>&1 | tail -3"
    log_ok "Done"
}

# PHASE 09: Load data
p09() {
    log_phase "09" "Load Data"
    run "export CUBRID=$CUBRID; export PATH=\$CUBRID_BIN:\$PATH; export CUBRID_DATABASES=$DB_DIR; cd /tmp/backup; timeout 300 cubrid loaddb -u dba -S -d ${DB_NAME}_objects $DB_NAME 2>&1 | tail -3"
    log_ok "Done"
}

# PHASE 10: Load indexes
p10() {
    log_phase "10" "Load Indexes"
    run "export CUBRID=$CUBRID; export PATH=\$CUBRID_BIN:\$PATH; export CUBRID_DATABASES=$DB_DIR; cd /tmp/backup; timeout 60 cubrid loaddb -u dba -S -i ${DB_NAME}_indexes $DB_NAME 2>&1 | tail -3"
    log_ok "Done"
}

# PHASE 11: Verify
p11() {
    log_phase "11" "Verify"
    sleep 3
    local rows=$(get_rows)
    log_step "Rows: $rows (expected: $EXPECTED_ROWS)"
    [ "$rows" = "$EXPECTED_ROWS" ] && log_ok "VERIFIED" || log_err "FAILED"
    [ "$rows" = "$EXPECTED_ROWS" ]
}

# PHASE 12: Cleanup
p12() {
    log_phase "12" "Cleanup"
    run "rm -f /tmp/backup/*_loaddb.log; rm -rf /tmp/backup/unloaddb 2>/dev/null; echo 'Cleaned'"
    log_ok "Done"
}

# Full recovery
run_recovery() {
    log "═══════════════════════════════════════════════════════════════"
    log "   FULL RECOVERY - $(date)"
    log "═══════════════════════════════════════════════════════════════"
    local start=$(date +%s)
    
    p01; p02; p03
    p04 || exit 1
    p05; p06 || exit 1
    p07 || exit 1
    p08; p09; p10
    p11; p12
    
    local total=$(( $(date +%s) - start ))
    log ""
    log_ok "COMPLETE in ${total}s"
}

case "${1:-help}" in
    quick|check) quick_check ;;
    full|recover) run_recovery ;;
    *) echo "Usage: $0 {quick|full}" ;;
esac
