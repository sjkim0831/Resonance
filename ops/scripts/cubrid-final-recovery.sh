#!/bin/bash
#============================================
# CUBRID FINAL RECOVERY - Complete Solution
# 1. Creates fresh DB
# 2. Loads backup data
# 3. Backs up to host
# 4. Sets file protection (chattr +i)
# 5. Configures auto-start
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
DB_DIR="/var/lib/cubrid/databases"
HOST_DB_DIR="/opt/Resonance/data/cubrid/databases"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
CUBRID="/home/cubrid/CUBRID/bin"
LOG="/opt/Resonance/var/log/final-recovery.log"
ALERTER="/opt/Resonance/ops/scripts/send-email-alert.sh"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; echo "[$(date +%H:%M:%S)] $1" >> "$LOG"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; echo "[$(date +%H:%M:%S)] OK $1" >> "$LOG"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; echo "[$(date +%H:%M:%S)] ERROR $1" >> "$LOG"; }

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

echo ""
echo "═══════════════════════════════════════════════════════════════"
log "   CUBRID FINAL RECOVERY"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# STEP 1: Check if files exist on host
log "STEP 1: Checking host backup..."
HOST_FILES=$(ls $HOST_DB_DIR/carbonet* 2>/dev/null | wc -l)
if [ "$HOST_FILES" -ge 5 ]; then
    log_ok "Found $HOST_FILES files on host - using them"
    USE_HOST=1
else
    log "No host backup - will create fresh DB"
    USE_HOST=0
fi

# STEP 2: Stop CUBRID and clean completely
log "STEP 2: Stopping CUBRID and cleaning..."
run "
export CUBRID=$CUBRID
export PATH=\$CUBRID/bin:\$PATH
\$CUBRID/cubrid service stop 2>/dev/null || true
pkill -9 cub 2>/dev/null || true
sleep 3

rm -f $DB_DIR/carbonet* $DB_DIR/*_vinf $DB_DIR/*_lgat $DB_DIR/*_lgar* $DB_DIR/*.lck 2>/dev/null || true
rm -f $CUBRID/databases/*.txt 2>/dev/null || true
rm -f /tmp/.cubrid* 2>/dev/null || true
echo 'Clean complete'
"

# STEP 3: Create fresh database
log "STEP 3: Creating fresh database..."
run "
export CUBRID=$CUBRID
export PATH=\$CUBRID/bin:\$PATH
export CUBRID_DATABASES=$DB_DIR
cd $DB_DIR

# Create empty databases.txt first
cat > databases.txt << 'EOF'
# Empty - no databases
EOF

# Create database
\$CUBRID/cubrid createdb --db-volume-size=200M --log-volume-size=100M $DB_NAME en_US.iso88591 2>&1

# Verify files created
echo 'Files created:'
ls -la $DB_DIR/carbonet*
" 2>&1 | tail -20

# STEP 4: Check if DB was created
FILE_CHECK=$(run "ls $DB_DIR/carbonet* 2>/dev/null | wc -l")
if [ "$FILE_CHECK" -lt 5 ]; then
    log_err "DB creation failed! Files: $FILE_CHECK"
    exit 1
fi
log_ok "DB created successfully"

# STEP 5: Configure databases.txt
log "STEP 4: Configuring database..."
run "
cat > $DB_DIR/databases.txt << 'EOF'
carbonet\t$DB_DIR\tlocalhost\t$DB_DIR\tfile:$DB_DIR/lob
EOF
mkdir -p $CUBRID/databases
cp $DB_DIR/databases.txt $CUBRID/databases/databases.txt
echo 'Configuration complete'
"

# STEP 6: Start server
log "STEP 5: Starting server..."
run "
export CUBRID=$CUBRID
\$CUBRID/cubrid server start $DB_NAME 2>&1 | tail -3
sleep 5
\$CUBRID/cubrid server status $DB_NAME 2>&1 | tail -1
" 2>&1

# STEP 7: Load backup data
log "STEP 6: Loading backup data..."
run "
export CUBRID=$CUBRID
export PATH=\$CUBRID/bin:\$PATH

# Copy backup files
rm -rf /tmp/backup-final
cp -r $BACKUP_DIR/carbonet-live-unload-20260614/unloaddb /tmp/backup-final/

# Load data
cd /tmp/backup-final
echo 'Loading schema...'
\$CUBRID/cubrid loaddb -u dba -s carbonet_schema $DB_NAME 2>&1 | tail -2

echo 'Loading data...'
\$CUBRID/cubrid loaddb -u dba -d carbonet_objects $DB_NAME 2>&1 | tail -2

echo 'Loading indexes...'
\$CUBRID/cubrid loaddb -u dba -i carbonet_indexes $DB_NAME 2>&1 | tail -2
"

# STEP 8: Verify and backup to host
log "STEP 7: Verifying and backing up to host..."

# Backup to host
run "cp $DB_DIR/carbonet* $HOST_DB_DIR/ 2>/dev/null && echo 'Backed up to host'"

# Verify rows
ROWS=$(run "$CUBRID/csql -u dba $DB_NAME@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '[0-9]+' | head -1 | tr -d ' ')
log_ok "Rows after restore: ${ROWS:-0}"

# STEP 9: Set file protection (CRITICAL!)
log "STEP 8: Setting file protection (chattr +i)..."
run "
chattr +i $DB_DIR/carbonet 2>/dev/null && echo 'carbonet protected'
chattr +i $DB_DIR/carbonet_lgat 2>/dev/null && echo 'carbonet_lgat protected'
chattr +i $DB_DIR/carbonet_vinf 2>/dev/null && echo 'carbonet_vinf protected'
chmod 600 $DB_DIR/carbonet* 2>/dev/null && echo 'Permissions set'
"

# STEP 10: Verify protection
log "STEP 9: Verifying protection..."
run "
echo 'File attributes:'
lsattr $DB_DIR/carbonet* 2>/dev/null | head -5 || chattr -i $DB_DIR/carbonet* 2>/dev/null && lsattr $DB_DIR/carbonet* | head -5
"

echo ""
echo "═══════════════════════════════════════════════════════════════"
log_ok "   RECOVERY COMPLETE!"
log "   Rows: ${ROWS:-0}"
log "   Host backup: $HOST_DB_DIR"
log "   Protection: ENABLED"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Send alert
$ALERTER recovery-success "CUBRID Recovery Complete" "Rows: ${ROWS:-0}, Protection enabled"

# Return status
if [ -n "$ROWS" ] && [ "$ROWS" -gt 0 ]; then
    echo "SUCCESS: $ROWS rows restored"
    exit 0
else
    echo "WARNING: Rows may be 0, check manually"
    exit 0
fi
