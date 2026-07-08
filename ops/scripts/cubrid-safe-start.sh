#!/bin/bash
# DEPRECATED: CUBRID 제거됨 — 사용 금지
# PostgreSQL 환경: postgres-patroni-0/1/2 (Patroni HA)
echo "[DEPRECATED] cubrid-safe-start: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

# CUBRID Safe Start - Prevents Data Loss
NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
DB_DIR="/var/lib/cubrid/databases"
HOST_DB_DIR="/opt/Resonance/data/cubrid/databases"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
CUBRID_BIN="/home/cubrid/CUBRID/bin"
ALERTER="/opt/Resonance/ops/scripts/send-email-alert.sh"

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

log() { echo "[$(date +%H:%M:%S)] $1"; }

echo "=== CUBRID Safe Start ==="

# Check if DB exists
file_count=$(run "ls -la $DB_DIR/carbonet* 2>/dev/null | wc -l")

if [ "$file_count" -ge 5 ]; then
    log "DB files OK: $file_count files"
else
    log "DB files MISSING: $file_count - need to recover"
    
    # Check host backup
    host_files=$(ls $HOST_DB_DIR/carbonet* 2>/dev/null | wc -l)
    log "Host backup files: $host_files"
    
    if [ "$host_files" -ge 5 ]; then
        log "Restoring from host backup..."
        run "cp $HOST_DB_DIR/carbonet* $DB_DIR/ 2>/dev/null"
    else
        log "Need to create fresh DB..."
    fi
fi

# Configure databases.txt
run "cat > $DB_DIR/databases.txt << EOFDB
carbonet\t$DB_DIR\tlocalhost\t$DB_DIR\tfile:$DB_DIR/lob
EOFDB
cp $DB_DIR/databases.txt $CUBRID_BIN/databases/databases.txt"

# Check files
log "Files in DB_DIR:"
run "ls -la $DB_DIR/carbonet* 2>/dev/null | head -10"

echo "Done"
