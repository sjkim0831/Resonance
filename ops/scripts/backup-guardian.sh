#!/bin/bash
# Backup Guardian v3 - 백업 검증 + 재백업
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
LOG_FILE="/opt/Resonance/var/log/backup-guardian.log"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
RETENTION_DAYS=7

EXPECTED_SCHEMA=140000
EXPECTED_OBJECTS=64000000
EXPECTED_INDEXES=13000

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; echo "[$(date +%H:%M:%S)] $1" >> "$LOG_FILE"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; echo "[$(date +%H:%M:%S)] ✓ $1" >> "$LOG_FILE"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; echo "[$(date +%H:%M:%S)] ✗ $1" >> "$LOG_FILE"; }
log_warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; echo "[$(date +%H:%M:%S)] ⚠ $1" >> "$LOG_FILE"; }

mkdir -p "$BACKUP_DIR" /opt/Resonance/var/log 2>/dev/null

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

do_verify() {
    local backup_path="$1"
    local issues=0
    
    log "검증: $backup_path"
    
    if [ -f "$backup_path/unloaddb/${DB_NAME}_schema" ]; then
        local size=$(stat -c%s "$backup_path/unloaddb/${DB_NAME}_schema" 2>/dev/null || echo 0)
        if [ $size -gt $EXPECTED_SCHEMA ]; then
            log_ok "Schema: OK"
        else
            log_warn "Schema: 작음"
            issues=$((issues + 1))
        fi
    else
        log_err "Schema: 없음"
        issues=$((issues + 1))
    fi
    
    if [ -f "$backup_path/unloaddb/${DB_NAME}_objects" ]; then
        local size=$(stat -c%s "$backup_path/unloaddb/${DB_NAME}_objects" 2>/dev/null || echo 0)
        if [ $size -gt $EXPECTED_OBJECTS ]; then
            log_ok "Objects: OK"
        else
            log_warn "Objects: 작음"
            issues=$((issues + 1))
        fi
    else
        log_err "Objects: 없음"
        issues=$((issues + 1))
    fi
    
    if [ -f "$backup_path/unloaddb/${DB_NAME}_indexes" ]; then
        local size=$(stat -c%s "$backup_path/unloaddb/${DB_NAME}_indexes" 2>/dev/null || echo 0)
        if [ $size -gt $EXPECTED_INDEXES ]; then
            log_ok "Indexes: OK"
        else
            log_warn "Indexes: 작음"
            issues=$((issues + 1))
        fi
    else
        log_err "Indexes: 없음"
        issues=$((issues + 1))
    fi
    
    return $issues
}

do_create() {
    log "새 백업 생성..."
    local timestamp=$(date +%Y%m%d)
    local backup_path="$BACKUP_DIR/${DB_NAME}-live-unload-$timestamp"
    
    mkdir -p "$backup_path/unloaddb"
    
    run "/home/cubrid/CUBRID/bin/cubrid server stop $DB_NAME 2>&1 | tail -1 || true"
    sleep 2
    
    run "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; export CUBRID_DATABASES=/var/lib/cubrid/databases; mkdir -p /tmp/backup; cd /tmp/backup; cubrid unloaddb -u dba -S ${DB_NAME} 2>&1 | tail -5"
    
    kubectl cp "$NAMESPACE/$POD:/tmp/backup/unloaddb" "$backup_path/unloaddb" 2>&1 | tail -2
    
    run "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; export CUBRID_DATABASES=/var/lib/cubrid/databases; cubrid server start $DB_NAME 2>&1 | tail -2"
    
    if [ -f "$backup_path/unloaddb/${DB_NAME}_schema" ]; then
        log_ok "백업 완료: $backup_path"
        local size=$(du -sm "$backup_path" 2>/dev/null | cut -f1)
        python3 << PYEOF
import sqlite3
conn=sqlite3.connect('$LOG_DB')
conn.execute("INSERT INTO backups(timestamp,backup_path,size_mb,row_count,status,retention_days) VALUES(datetime('now'),?,?,0,'completed',?)",('$backup_path',$size,$RETENTION_DAYS))
conn.commit()
conn.close()
PYEOF
        return 0
    else
        log_err "백업 실패"
        return 1
    fi
}

main() {
    log "Backup Guardian - $(date)"
    
    local latest=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    
    if [ -z "$latest" ]; then
        log_warn "백업 없음 - 새로 생성"
        do_create
    else
        log "최신: $latest"
        if do_verify "$latest"; then
            log_ok "백업 정상"
        else
            log_warn "재백업 필요"
            do_create
        fi
    fi
    
    find "$BACKUP_DIR" -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null
    log_ok "완료"
}

CMD="$1"

if [ "$CMD" = "check" ] || [ "$CMD" = "verify" ]; then
    LATEST=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    if [ -n "$LATEST" ]; then
        do_verify "$LATEST"
    else
        log_err "No backup"
    fi
elif [ "$CMD" = "create" ] || [ "$CMD" = "backup" ]; then
    do_create
else
    main
fi
