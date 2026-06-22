#!/bin/bash
#============================================
# CUBRID Complete System Start
# One script to rule them all:
# - Initializes DB if needed
# - Loads backup if needed
# - Protects files
# - Sends email notification
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
DB_DIR="/var/lib/cubrid/databases"
HOST_DB_DIR="/opt/Resonance/data/cubrid/databases"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
CUBRID="/home/cubrid/CUBRID/bin"
ALERTER="/opt/Resonance/ops/scripts/send-email-alert.sh"
LOG="/opt/Resonance/var/log/cubrid-complete-start.log"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; echo "[$(date +%H:%M:%S)] $1" >> "$LOG"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; echo "[$(date +%H:%M:%S)] OK $1" >> "$LOG"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; echo "[$(date +%H:%M:%S)] ERROR $1" >> "$LOG"; }

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

echo ""
echo "═══════════════════════════════════════════════════════════════"
log "   CUBRID COMPLETE SYSTEM START"
log "   $(date)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Step 1: Check if DB files exist
FILE_COUNT=$(run "ls $DB_DIR/carbonet* 2>/dev/null | wc -l")
log "DB file count: $FILE_COUNT"

if [ "$FILE_COUNT" -lt 5 ]; then
    log_err "DB files missing! Need to recover..."
    
    # Check host backup
    HOST_FILES=$(ls $HOST_DB_DIR/carbonet* 2>/dev/null | wc -l)
    
    if [ "$HOST_FILES" -ge 5 ]; then
        log "Found $HOST_FILES files on host - restoring..."
        run "cp $HOST_DB_DIR/carbonet* $DB_DIR/"
    else
        log "No host backup - creating fresh DB..."
        run "$CUBRID/cubrid service stop 2>/dev/null || true"
        sleep 2
        run "rm -f $DB_DIR/carbonet* $DB_DIR/*_vinf $DB_DIR/*_lgat 2>/dev/null || true"
        run "cd $DB_DIR && $CUBRID/cubrid createdb --db-volume-size=200M --log-volume-size=100M $DB_NAME en_US.iso88591 2>&1 | tail -3"
        
        # Backup to host
        sleep 2
        run "cp $DB_DIR/carbonet* $HOST_DB_DIR/"
    fi
else
    log_ok "DB files exist - proceeding..."
fi

# Step 2: Configure databases.txt
log "Configuring database..."
run "cat > $DB_DIR/databases.txt << EOF
$DB_NAME\t$DB_DIR\tlocalhost\t$DB_DIR\tfile:$DB_DIR/lob
EOF
cp $DB_DIR/databases.txt $CUBRID/databases/databases.txt"

# Step 3: Backup to host (just in case)
log "Backing up to host..."
run "cp $DB_DIR/carbonet* $HOST_DB_DIR/ 2>/dev/null"

# Step 4: Start services
log "Starting services..."
run "$CUBRID/cubrid service start 2>&1 | tail -3"
sleep 5

# Step 5: Verify
SRV_STATUS=$(run "$CUBRID/cubrid server status $DB_NAME 2>&1 | grep -c 'running'")

if [ "$SRV_STATUS" = "1" ]; then
    log_ok "Server is running!"
    
    ROWS=$(run "$CUBRID/csql -u dba $DB_NAME@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '[0-9]+' | head -1 | tr -d ' ')
    log_ok "Rows: ${ROWS:-0}"
    
    # Send success email
    $ALERTER recovery-success "CUBRID started" "Rows: ${ROWS:-0}"
else
    log_err "Server failed to start"
    $ALERTER recovery-failed "Server failed to start"
fi

# Step 6: Protect files
log "Setting file protection..."
run "chmod 600 $DB_DIR/carbonet* 2>/dev/null"
run "chown cubrid:cubrid $DB_DIR/carbonet* 2>/dev/null"
run "chattr +a $DB_DIR/carbonet 2>/dev/null || true"
run "chattr +a $DB_DIR/carbonet_lgat 2>/dev/null || true"

echo ""
echo "═══════════════════════════════════════════════════════════════"
log_ok "   SYSTEM START COMPLETE"
echo "═══════════════════════════════════════════════════════════════"
echo ""
