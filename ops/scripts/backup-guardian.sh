#!/bin/bash
# Backup Guardian v3 - ë°±ì—… ê²€ì¦?+ ?¬ë°±??#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="postgres-patroni-0"
LOG_DB="/opt/Resonance/var/lib/pg_operations.db"
BACKUP_DIR="/opt/resonance-data/backups/postgres/primary"
RETENTION_DAYS=7

EXPECTED_SCHEMA=140000
EXPECTED_OBJECTS=64000000
EXPECTED_INDEXES=13000

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; echo "[$(date +%H:%M:%S)] $1" >> "$LOG_FILE"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ??{NC} $1"; echo "[$(date +%H:%M:%S)] ??$1" >> "$LOG_FILE"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ??{NC} $1"; echo "[$(date +%H:%M:%S)] ??$1" >> "$LOG_FILE"; }
log_warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ??{NC} $1"; echo "[$(date +%H:%M:%S)] ??$1" >> "$LOG_FILE"; }

mkdir -p "$BACKUP_DIR" /opt/Resonance/var/log 2>/dev/null

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

do_verify() {
    local backup_path="$1"
    local issues=0
    
    log "ê²€ì¦? $backup_path"
    
    if [ -f "$backup_path/unloaddb/${DB_NAME}_schema" ]; then
        local size=$(stat -c%s "$backup_path/unloaddb/${DB_NAME}_schema" 2>/dev/null || echo 0)
        if [ $size -gt $EXPECTED_SCHEMA ]; then
            log_ok "Schema: OK"
        else
            log_warn "Schema: ?‘ìŒ"
            issues=$((issues + 1))
        fi
    else
        log_err "Schema: ?†ìŒ"
        issues=$((issues + 1))
    fi
    
    if [ -f "$backup_path/unloaddb/${DB_NAME}_objects" ]; then
        local size=$(stat -c%s "$backup_path/unloaddb/${DB_NAME}_objects" 2>/dev/null || echo 0)
        if [ $size -gt $EXPECTED_OBJECTS ]; then
            log_ok "Objects: OK"
        else
            log_warn "Objects: ?‘ìŒ"
            issues=$((issues + 1))
        fi
    else
        log_err "Objects: ?†ìŒ"
        issues=$((issues + 1))
    fi
    
    if [ -f "$backup_path/unloaddb/${DB_NAME}_indexes" ]; then
        local size=$(stat -c%s "$backup_path/unloaddb/${DB_NAME}_indexes" 2>/dev/null || echo 0)
        if [ $size -gt $EXPECTED_INDEXES ]; then
            log_ok "Indexes: OK"
        else
            log_warn "Indexes: ?‘ìŒ"
            issues=$((issues + 1))
        fi
    else
        log_err "Indexes: ?†ìŒ"
        issues=$((issues + 1))
    fi
    
    return $issues
}

do_create() {
    log "??ë°±ì—… ?ì„±..."
    local timestamp=$(date +%Y%m%d)
    local backup_path="$BACKUP_DIR/${DB_NAME}-live-unload-$timestamp"
    
    mkdir -p "$backup_path"

    local backup_file="/tmp/carbonet_backup_$(date +%Y%m%d_%H%M%S).dump"
    run "pg_dump -U postgres -d ${DB_NAME} -Fc -f $backup_file" 2>&1 | tail -5

    kubectl cp "$NAMESPACE/$POD:$backup_file" "$backup_path/carbonet_backup.dump" 2>&1 | tail -2

    if [ -f "$backup_path/carbonet_backup.dump" ]; then
        log_ok "ë°±ì—… ?„ë£Œ: $backup_path"
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
        log_err "ë°±ì—… ?¤íŒ¨"
        return 1
    fi
}

main() {
    log "Backup Guardian - $(date)"
    
    local latest=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    
    if [ -z "$latest" ]; then
        log_warn "ë°±ì—… ?†ìŒ - ?ˆë¡œ ?ì„±"
        do_create
    else
        log "ìµœì‹ : $latest"
        if do_verify "$latest"; then
            log_ok "ë°±ì—… ?•ìƒ"
        else
            log_warn "?¬ë°±???„ìš”"
            do_create
        fi
    fi
    
    find "$BACKUP_DIR" -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null
    log_ok "?„ë£Œ"
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
