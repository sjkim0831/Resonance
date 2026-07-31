#!/bin/bash
# Backup cleanup cron job - removes old backups to prevent disk pressure

BACKUP_ROOT="/opt/resonance-data/backups/postgres/primary"
HA_BACKUP_ROOT="/opt/resonance-data/backups/postgres/mirror"
LOG_FILE="/opt/Resonance/var/logs/cron/backup_cleanup.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup cleanup started" >> "$LOG_FILE"

# Check disk usage
DISK_USAGE=$(df /opt | awk 'NR==2 {print $5}' | sed 's/%//')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current disk usage: ${DISK_USAGE}%" >> "$LOG_FILE"

# If disk usage is above 75%, aggressively clean up
if [ "$DISK_USAGE" -gt 75 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Disk usage above 75%, aggressive cleanup" >> "$LOG_FILE"
    
    # Keep only last 6 hours of hourly backups
    find $BACKUP_ROOT/hourly -name "*.dump" -mmin +360 -delete 2>/dev/null
    find $BACKUP_ROOT/hourly -name "*.manifest" -mmin +360 -delete 2>/dev/null
    find $BACKUP_ROOT/hourly -name "*.sha256" -mmin +360 -delete 2>/dev/null
    
    # Keep only last 7 days of daily backups
    find $BACKUP_ROOT/daily -name "*.dump" -mtime +7 -delete 2>/dev/null
    
    # Same for HA backup
    find $HA_BACKUP_ROOT/hourly -name "*.dump" -mmin +360 -delete 2>/dev/null
    find $HA_BACKUP_ROOT/hourly -name "*.manifest" -mmin +360 -delete 2>/dev/null
    find $HA_BACKUP_ROOT/hourly -name "*.sha256" -mmin +360 -delete 2>/dev/null
    find $HA_BACKUP_ROOT/daily -name "*.dump" -mtime +7 -delete 2>/dev/null
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Aggressive cleanup completed" >> "$LOG_FILE"
else
    # Normal cleanup - keep last 24 hours of hourly, 30 days of daily
    find $BACKUP_ROOT/hourly -name "*.dump" -mmin +1440 -delete 2>/dev/null
    find $BACKUP_ROOT/hourly -name "*.manifest" -mmin +1440 -delete 2>/dev/null
    find $BACKUP_ROOT/hourly -name "*.sha256" -mmin +1440 -delete 2>/dev/null
    find $BACKUP_ROOT/daily -name "*.dump" -mtime +30 -delete 2>/dev/null
    
    find $HA_BACKUP_ROOT/hourly -name "*.dump" -mmin +1440 -delete 2>/dev/null
    find $HA_BACKUP_ROOT/hourly -name "*.manifest" -mmin +1440 -delete 2>/dev/null
    find $HA_BACKUP_ROOT/hourly -name "*.sha256" -mmin +1440 -delete 2>/dev/null
    find $HA_BACKUP_ROOT/daily -name "*.dump" -mtime +30 -delete 2>/dev/null
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Normal cleanup completed" >> "$LOG_FILE"
fi

# Check disk usage after cleanup
NEW_DISK_USAGE=$(df /opt | awk 'NR==2 {print $5}' | sed 's/%//')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Disk usage after cleanup: ${NEW_DISK_USAGE}%" >> "$LOG_FILE"

exit 0
