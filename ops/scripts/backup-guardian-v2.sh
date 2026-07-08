# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] backup-guardian-v2.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
#============================================
# Backup Guardian v2 - Improved
# 백업 검증 + 재백업
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
LOG_FILE="/opt/Resonance/var/log/backup-guardian.log"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
RETENTION_DAYS=7
CUBRID_BIN="/home/cubrid/CUBRID/bin"

EXPECTED_SCHEMA=140000
EXPECTED_OBJECTS=64000000
EXPECTED_INDEXES=13000

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; echo "[$(date +%H:%M:%S)] $1" >> "$LOG_FILE"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)} ✗${NC} $1"; }
log_warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; }

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }
mkdir -p "$BACKUP_DIR" /opt/Resonance/var/log 2>/dev/null

# Verify single backup
verify_backup() {
    local path="$1"
    local issues=0
    
    log "검증: $path"
    
    # Schema
    if [ -f "$path/unloaddb/${DB_NAME}_schema" ]; then
        local size=$(stat -c%s "$path/unloaddb/${DB_NAME}_schema" 2>/dev/null || echo 0)
        if [ $size -gt $EXPECTED_SCHEMA ]; then
            log_ok "Schema: OK"
        else
            log_warn "Schema: 작음 ($size)"
            issues=$((issues + 1))
        fi
    else
        log_err "Schema: 없음"
        issues=$((issues + 1))
    fi
    
    # Objects
    if [ -f "$path/unloaddb/${DB_NAME}_objects" ]; then
        local size=$(stat -c%s "$path/unloaddb/${DB_NAME}_objects" 2>/dev/null || echo 0)
        if [ $size -gt $EXPECTED_OBJECTS ]; then
            log_ok "Objects: OK"
        else
            log_warn "Objects: 작음 ($size)"
            issues=$((issues + 1))
        fi
    else
        log_err "Objects: 없음"
        issues=$((issues + 1))
    fi
    
    # Indexes
    if [ -f "$path/unloaddb/${DB_NAME}_indexes" ]; then
        local size=$(stat -c%s "$path/unloaddb/${DB_NAME}_indexes" 2>/dev/null || echo 0)
        if [ $size -gt $EXPECTED_INDEXES ]; then
            log_ok "Indexes: OK"
        else
            log_warn "Indexes: 작음 ($size)"
            issues=$((issues + 1))
        fi
    else
        log_err "Indexes: 없음"
        issues=$((issues + 1))
    fi
    
    return $issues
}

# Create new backup
create_backup() {
    log "새 백업 생성..."
    local timestamp=$(date +%Y%m%d)
    local backup_path="$BACKUP_DIR/${DB_NAME}-live-unload-$timestamp"
    
    mkdir -p "$backup_path/unloaddb"
    
    # Stop server
    run "$CUBRID_BIN/cubrid server stop $DB_NAME 2>&1 | tail -1 || true"
    sleep 2
    
    # Unload
    run "mkdir -p /tmp/backup && cd /tmp/backup && $CUBRID_BIN/cubrid unloaddb -u dba -S ${DB_NAME} 2>&1 | tail -5"
    
    # Copy to host
    kubectl cp "$NAMESPACE/$POD:/tmp/backup/unloaddb" "$backup_path/unloaddb" 2>&1 | tail -2
    
    # Restart
    run "$CUBRID_BIN/cubrid server start $DB_NAME 2>&1 | tail -2"
    
    if [ -f "$backup_path/unloaddb/${DB_NAME}_schema" ]; then
        log_ok "백업 완료: $backup_path"
        return 0
    else
        log_err "백업 실패"
        return 1
    fi
}

# Main
main() {
    log "═══════════════════════════════════════════════════════════════"
    log "   Backup Guardian v2 - $(date)"
    log "═══════════════════════════════════════════════════════════════"
    
    local latest=$(find $BACKUP_DIR -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
    
    if [ -z "$latest" ]; then
        log_warn "백업 없음 - 새로 생성"
        create_backup
    else
        log "최신: $latest"
        if verify_backup "$latest"; then
            log_ok "백업 정상"
        else
            log_warn "재백업 필요"
            create_backup
        fi
    fi
    
    # Cleanup old
    find "$BACKUP_DIR" -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null
    
    log_ok "완료"
}

case "${1:-check}" in
    check|verify) 
        latest=$(find $BACKUP_DIR -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
        [ -n "$latest" ] && verify_backup "$latest" || log_err "No backup"
        ;;
    create|backup) create_backup ;;
    *) main ;;
esac
