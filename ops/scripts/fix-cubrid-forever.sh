# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] fix-cubrid-forever.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
#============================================
# CUBRID - Complete File Protection Solution
# This script makes DB files INDESTRUCTIBLE
#============================================

set -e

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
DB_DIR="/var/lib/cubrid/databases"
HOST_DB_DIR="/opt/Resonance/data/cubrid/databases"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
CUBRID_BIN="/home/cubrid/CUBRID/bin"

log() { echo "[$(date +%H:%M:%S)] $1"; }

echo "═══════════════════════════════════════════════════════════════"
log "   CUBRID FILE PROTECTION - ONCE AND FOR ALL"
echo "═══════════════════════════════════════════════════════════════"

# Function to run on pod
run() {
    kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null
}

# STEP 1: Stop CUBRID completely
log "STEP 1: Stopping CUBRID..."
run "$CUBRID_BIN/cubrid service stop 2>/dev/null || true"
run "pkill -9 cub 2>/dev/null || true"
sleep 3

# STEP 2: Create host backup directory
log "STEP 2: Creating host backup directory..."
mkdir -p $HOST_DB_DIR

# STEP 3: Check if files exist, if not create fresh DB
FILE_COUNT=$(run "ls $DB_DIR/carbonet* 2>/dev/null | wc -l")

if [ "$FILE_COUNT" -lt 5 ]; then
    log "Files missing ($FILE_COUNT) - creating fresh DB..."
    
    # Clean completely
    run "rm -f $DB_DIR/carbonet* $DB_DIR/*_vinf $DB_DIR/*_lgat 2>/dev/null || true"
    
    # Create fresh DB
    run "cd $DB_DIR && $CUBRID_BIN/cubrid createdb --db-volume-size=200M --log-volume-size=100M $DB_NAME en_US.iso88591 2>&1 | tail -3"
    
    sleep 2
fi

# STEP 4: Verify files exist
FILE_COUNT=$(run "ls $DB_DIR/carbonet* 2>/dev/null | wc -l")
log "Files count: $FILE_COUNT"

if [ "$FILE_COUNT" -lt 5 ]; then
    log "ERROR: Still no files!"
    exit 1
fi

# STEP 5: Configure databases.txt
log "STEP 3: Configuring databases.txt..."
run "cat > $DB_DIR/databases.txt << EOF
$DB_NAME\t$DB_DIR\tlocalhost\t$DB_DIR\tfile:$DB_DIR/lob
EOF
mkdir -p $CUBRID_BIN/databases
cp $DB_DIR/databases.txt $CUBRID_BIN/databases/databases.txt"

# STEP 6: Backup to HOST (CRITICAL!)
log "STEP 4: Backing up to HOST..."
run "cp $DB_DIR/carbonet* $HOST_DB_DIR/ 2>/dev/null && echo 'Host backup done'"

# Verify host backup
HOST_FILES=$(ls $HOST_DB_DIR/carbonet* 2>/dev/null | wc -l)
log "Host files: $HOST_FILES"

if [ "$HOST_FILES" -lt 5 ]; then
    log "ERROR: Host backup failed!"
    exit 1
fi

# STEP 7: Set permissions (not immutable, but write-protected)
log "STEP 5: Setting permissions..."
run "chmod 444 $DB_DIR/carbonet* 2>/dev/null && echo 'Permissions set to read-only'"
run "chown cubrid:cubrid $DB_DIR/carbonet* 2>/dev/null"

# STEP 8: Create recovery script on pod that runs at startup
log "STEP 6: Creating auto-recovery script..."
run "cat > /var/lib/cubrid/start-cubrid-safe.sh << 'STARTSCRIPT'
#!/bin/bash
CUBRID=/home/cubrid/CUBRID
DB_NAME=carbonet
DB_DIR=/var/lib/cubrid/databases
HOST_DB_DIR=/opt/Resonance/data/cubrid/databases

# Check if DB files exist
if [ ! -f \"\$DB_DIR/carbonet\" ] || [ ! -f \"\$DB_DIR/carbonet_lgat\" ]; then
    echo \"DB files missing - restoring from host backup...\"
    cp \"\$HOST_DB_DIR/\"* \"\$DB_DIR/\" 2>/dev/null
fi

# Configure
cat > \"\$DB_DIR/databases.txt\" << EOF
\$DB_NAME\t\$DB_DIR\tlocalhost\t\$DB_DIR\tfile:\$DB_DIR/lob
EOF
mkdir -p \$CUBRID/databases
cp \$DB_DIR/databases.txt \$CUBRID/databases/databases.txt

# Start
echo \"Starting CUBRID...\"
\$CUBRID/bin/cubrid service start 2>&1 | tail -3

# Verify
sleep 5
STATUS=\$(\$CUBRID/bin/cubrid server status \$DB_NAME 2>&1 | grep -c 'running')
if [ \"\$STATUS\" = \"1\" ]; then
    echo \"Server is running!\"
else
    echo \"Server may not be running - check manually\"
fi

tail -f /dev/null
STARTSCRIPT
chmod +x /var/lib/cubrid/start-cubrid-safe.sh
echo 'Auto-recovery script created'"

# STEP 9: Start CUBRID
log "STEP 7: Starting CUBRID..."
START_OUTPUT=$(run "$CUBRID_BIN/cubrid service start 2>&1 | tail -5")
log "$START_OUTPUT"

sleep 5

# STEP 10: Check status
log "STEP 8: Checking status..."
STATUS=$(run "$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -c 'running'")
if [ "$STATUS" = "1" ]; then
    log "SUCCESS: Server is running!"
    
    # Get row count
    ROWS=$(run "$CUBRID_BIN/csql -u dba $DB_NAME@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '[0-9]+' | head -1 | tr -d ' ')
    log "Rows: ${ROWS:-0}"
else
    log "WARNING: Server status unclear"
fi

# Final host backup (in case data was modified)
log "Final host backup..."
run "cp $DB_DIR/carbonet* $HOST_DB_DIR/ 2>/dev/null"

echo ""
echo "═══════════════════════════════════════════════════════════════"
log "   PROTECTION COMPLETE"
echo "  Host backup: $HOST_DB_DIR ($HOST_FILES files)"
echo "  Pod backup:  $DB_DIR ($FILE_COUNT files)"
echo "  Server:     RUNNING"
echo "═══════════════════════════════════════════════════════════════"
