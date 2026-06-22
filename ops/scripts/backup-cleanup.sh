#!/bin/bash
#============================================
# CUBRID Backup Cleanup & Rotation
# - Keeps last N backups
# - Deletes old backups
# - Reports disk usage
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
RETENTION_DAYS=7
MIN_BACKUPS=2
LOG_FILE="/opt/Resonance/var/log/backup-cleanup.log"
ALERTER="/opt/Resonance/ops/scripts/send-email-alert.sh"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; echo "[$(date +%H:%M:%S)] $1" >> "$LOG_FILE"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }

#============================================
# CLEANUP OLD BACKUPS
#============================================
cleanup() {
    log "═".repeat(60)
    log "BACKUP CLEANUP STARTED"
    log "═".repeat(60)
    
    local deleted=0
    local freed_space=0
    
    # Find old backups
    for backup in $(find $BACKUP_DIR -maxdepth 1 -type d -name "carbonet-*" 2>/dev/null | sort); do
        local name=$(basename $backup)
        local age_days=$(find $backup -maxdepth 0 -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)
        
        # Keep minimum backups regardless of age
        local backup_count=$(find $BACKUP_DIR -maxdepth 1 -type d -name "carbonet-*" 2>/dev/null | wc -l)
        
        if [ "$age_days" -gt 0 ] && [ "$backup_count" -gt "$MIN_BACKUPS" ]; then
            local size=$(du -sm "$backup" 2>/dev/null | cut -f1)
            rm -rf "$backup"
            log "Deleted: $name (${size}MB, ${age_days} days old)"
            ((deleted++))
            ((freed_space+=size))
        fi
    done
    
    log_ok "Cleaned $deleted backup(s), freed ${freed_space}MB"
    
    # Report disk usage
    local total_size=$(du -sh $BACKUP_DIR 2>/dev/null | cut -f1)
    local backup_count=$(find $BACKUP_DIR -maxdepth 1 -type d 2>/dev/null | wc -l)
    ((backup_count--))
    
    log "Total backups: $backup_count"
    log "Total size: $total_size"
    log "Disk usage by backup:"
    du -sh $BACKUP_DIR/*/ 2>/dev/null | sort -rh | head -5
    
    # Alert if disk usage high
    local disk_usage=$(df $BACKUP_DIR | tail -1 | awk '{print $5}' | tr -d '%')
    if [ "$disk_usage" -gt 80 ]; then
        log_err "Disk usage high: ${disk_usage}%"
        $ALERTER backup-failed "Disk space critical: ${disk_usage}%"
    fi
    
    return 0
}

#============================================
# SHOW STATUS
#============================================
status() {
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                    BACKUP STATUS                               ║"
    echo "╠═══════════════════════════════════════════════════════════════╣"
    
    local total=$(du -sh $BACKUP_DIR 2>/dev/null | cut -f1)
    echo "║  Total size: $total"
    echo "║                                                              ║"
    
    echo "║  Backups:                                                    ║"
    for backup in $(find $BACKUP_DIR -maxdepth 1 -type d -name "carbonet-*" | sort -r | head -5); do
        local name=$(basename $backup)
        local size=$(du -sh "$backup" 2>/dev/null | cut -f1)
        local date=$(ls -l --time-style=long-iso "$backup" 2>/dev/null | awk '{print $6, $7}')
        printf "║    %-30s %8s %s ║\n" "$name" "$size" "$date"
    done
    
    echo "╚═══════════════════════════════════════════════════════════════╝"
}

#============================================
# ENTRY
#============================================
case "${1:-status}" in
    cleanup|clean) cleanup ;;
    status) status ;;
    *)
        echo "Usage: $0 {cleanup|status}"
        ;;
esac
