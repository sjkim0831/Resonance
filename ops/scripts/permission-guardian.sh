#!/bin/bash
#============================================
# CUBRID Permission Guardian v2
# - Protects DB files from deletion
# - Monitors and fixes permissions automatically
# - Prevents data loss
# - Alerts on permission issues
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
DB_DIR="/var/lib/cubrid/databases"
HOST_DB_DIR="/opt/Resonance/data/cubrid/databases"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
LOG_FILE="/opt/Resonance/var/log/permission-guardian.log"
ALERTER="/opt/Resonance/ops/scripts/send-email-alert.sh"

mkdir -p /opt/Resonance/var/log

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; echo "[$(date +%H:%M:%S)] $1" >> "$LOG_FILE"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; echo "[$(date +%H:%M:%S)] OK $1" >> "$LOG_FILE"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; echo "[$(date +%H:%M:%S)] ERROR $1" >> "$LOG_FILE"; }
log_warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; echo "[$(date +%H:%M:%S)] WARN $1" >> "$LOG_FILE"; }

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

#============================================
# CHECK AND FIX PERMISSIONS
#============================================
check_permissions() {
    local issues=0
    
    log "═══════════════════════════════════════════════════════════════"
    log "   PERMISSION CHECK $(date +%Y-%m-%d_%H:%M:%S)"
    log "═══════════════════════════════════════════════════════════════"
    
    # Check if files exist
    local file_count=$(run "ls -la $DB_DIR/carbonet* 2>/dev/null | wc -l")
    
    if [ "$file_count" -lt 5 ]; then
        log_err "Missing DB files! Found only $file_count (expected 6+)"
        ((issues++))
        
        # Check if files exist on host
        local host_files=$(ls -la $HOST_DB_DIR/carbonet* 2>/dev/null | wc -l)
        log "Host files: $host_files"
        
        if [ "$host_files" -ge 5 ]; then
            log_warn "Files exist on host but not in pod - restoring..."
            restore_from_host
        fi
    else
        log_ok "DB files OK: $file_count files"
    fi
    
    # Check directory permissions
    local dir_perms=$(run "stat -c %a $DB_DIR 2>/dev/null || echo 'unknown'")
    if [ "$dir_perms" != "777" ] && [ "$dir_perms" != "drwxrwxrwx" ]; then
        log_warn "Directory permissions: $dir_perms (expected 777)"
        run "chmod 777 $DB_DIR 2>/dev/null"
        ((issues++))
    fi
    
    # Check file ownership
    local owner=$(run "stat -c %U $DB_DIR/carbonet 2>/dev/null || echo 'unknown'")
    if [ "$owner" != "cubrid" ]; then
        log_warn "File owner: $owner (expected cubrid)"
        run "chown -R cubrid:cubrid $DB_DIR 2>/dev/null"
        ((issues++))
    fi
    
    # Check if server is running
    local srv_status=$(run "\$CUBRID/bin/cubrid server status $DB_NAME 2>&1 | grep -c 'running'")
    if [ "$srv_status" != "1" ]; then
        log_warn "Server not running - attempting start..."
        run "\$CUBRID/bin/cubrid server start $DB_NAME 2>&1 | tail -2"
    fi
    
    return $issues
}

#============================================
# RESTORE FROM HOST
#============================================
restore_from_host() {
    log "Restoring DB files from host..."
    
    # Ensure host dir exists
    mkdir -p $HOST_DB_DIR 2>/dev/null
    
    # Stop server
    run "\$CUBRID/bin/cubrid server stop $DB_NAME 2>/dev/null || true"
    sleep 2
    
    # Copy files from host to pod
    kubectl cp "$HOST_DB_DIR/." "$NAMESPACE/$POD:$DB_DIR/" 2>&1 | tail -3
    
    # Fix permissions
    run "chown -R cubrid:cubrid $DB_DIR 2>/dev/null"
    run "chmod 666 $DB_DIR/carbonet* 2>/dev/null"
    
    # Restart server
    run "\$CUBRID/bin/cubrid server start $DB_NAME 2>&1 | tail -2"
    
    log_ok "Restore complete"
}

#============================================
# PROTECT FILES (Prevent Deletion)
#============================================
protect_files() {
    log "Setting file protection..."
    
    # Set immutable flag on critical files
    run "chattr +i $DB_DIR/carbonet 2>/dev/null || true"  # DB volume
    run "chattr +i $DB_DIR/carbonet_lgat 2>/dev/null || true"  # Log
    run "chattr +i $DB_DIR/carbonet_vinf 2>/dev/null || true"  # Volume info
    
    # Alternatively, make files append-only
    run "chattr +a $DB_DIR/carbonet 2>/dev/null || true"
    run "chattr +a $DB_DIR/carbonet_lgat 2>/dev/null || true"
    
    log_ok "File protection enabled"
}

#============================================
# UNPROTECT (for maintenance)
#============================================
unprotect_files() {
    log "Removing file protection..."
    run "chattr -i $DB_DIR/carbonet* 2>/dev/null || true"
    run "chattr -a $DB_DIR/carbonet* 2>/dev/null || true"
    log_ok "File protection removed"
}

#============================================
# FULL RECOVERY (when files are gone)
#============================================
full_recovery() {
    log_warn "FULL RECOVERY MODE"
    
    local start=$(date +%s)
    
    # Stop everything
    run "\$CUBRID/bin/cubrid service stop 2>/dev/null || true"
    pkill -9 cub 2>/dev/null || true
    sleep 3
    
    # Clean registry
    run "> /var/lib/cubrid/databases/databases.txt"
    run "> \$CUBRID/databases/databases.txt"
    
    # Restore from backup
    restore_from_backup
    
    local duration=$(($(date +%s) - start))
    log_ok "Full recovery complete in ${duration}s"
}

#============================================
# RESTORE FROM BACKUP
#============================================
restore_from_backup() {
    log "Restoring from backup..."
    
    # Find latest backup
    local backup_dir=""
    for dir in /var/lib/cubrid/backup/carbonet-live-unload-*; do
        if [ -d "$dir/unloaddb" ]; then
            backup_dir="$dir"
        fi
    done
    
    if [ -z "$backup_dir" ] || [ ! -d "$backup_dir/unloaddb" ]; then
        backup_dir="/opt/Resonance/data/cubrid/backup/carbonet-live-unload-20260614"
    fi
    
    log "Using backup: $backup_dir"
    
    # Copy backup files
    rm -rf /tmp/backup-restore
    cp -r "$backup_dir/unloaddb" /tmp/backup-restore/
    
    # Create fresh DB
    run "cd /var/lib/cubrid/databases && \$CUBRID/bin/cubrid createdb --db-volume-size=200M --log-volume-size=100M $DB_NAME en_US.iso88591 2>&1 | tail -3"
    
    # Configure
    run "cat > $DB_DIR/databases.txt << 'EOF'
$DB_NAME\t$DB_DIR\tlocalhost\t$DB_DIR\tfile:$DB_DIR/lob
EOF
cp $DB_DIR/databases.txt \$CUBRID/databases/databases.txt"
    
    # Start server
    run "\$CUBRID/bin/cubrid server start $DB_NAME 2>&1 | tail -2"
    sleep 5
    
    # Load data
    cd /tmp/backup-restore
    run "cd /tmp/backup-restore && \$CUBRID/bin/cubrid loaddb -u dba -s carbonet_schema $DB_NAME 2>&1 | tail -3"
    run "cd /tmp/backup-restore && \$CUBRID/bin/cubrid loaddb -u dba -d carbonet_objects $DB_NAME 2>&1 | tail -3"
    run "cd /tmp/backup-restore && \$CUBRID/bin/cubrid loaddb -u dba -i carbonet_indexes $DB_NAME 2>&1 | tail -3"
    
    # Backup to host for next time
    run "cp $DB_DIR/carbonet* $HOST_DB_DIR/ 2>/dev/null || true"
    
    # Send alert
    $ALERTER recovery-success "Full recovery from backup" "Duration: ${duration}s"
}

#============================================
# AUTO HEAL (Continuous monitoring)
#============================================
auto_heal() {
    log "Starting auto-heal monitoring..."
    
    while true; do
        check_permissions
        
        if [ $? -gt 0 ]; then
            log_warn "Issues detected - auto-healing..."
            $ALERTER server-down "Permission Guardian detected issues"
            
            # Try to recover
            check_permissions
        fi
        
        sleep 30  # Check every 30 seconds
    done
}

#============================================
# ENTRY
#============================================
case "${1:-check}" in
    check) check_permissions ;;
    protect) protect_files ;;
    unprotect) unprotect_files ;;
    restore) restore_from_host ;;
    full-recovery|recover) full_recovery ;;
    heal|monitor) auto_heal ;;
    *)
        echo "Usage: $0 {check|protect|unprotect|restore|full-recovery|heal}"
        ;;
esac
