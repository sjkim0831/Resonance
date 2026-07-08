# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] cubrid-email-alert.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
#============================================
# CUBRID Email Alert System
# - Send email alerts for backup/recovery events
#============================================

EMAIL_TO="imaneya@gmail.com"
EMAIL_FROM="${EMAIL_FROM:-noreply@carbonet.local}"
LOG_FILE="/opt/Resonance/var/log/email-alerts.log"

log() { echo "[$(date +%H:%M:%S)] $1" >> "$LOG_FILE"; }

send_alert() {
    local subject="$1"
    local body="$2"
    local priority="${3:-normal}"  # normal, high, critical
    
    # Format email
    local email_content="From: $EMAIL_FROM
To: $EMAIL_TO
Subject: [CUBRID Guardian] $subject
Priority: $priority
X-Priority: $([ "$priority" = "critical" ] && echo 1 || echo 3)

$body

---
Sent by CUBRID Guardian System
$(date +%Y-%m-%d_%H:%M:%S)
"
    
    # Try to send email
    if command -v sendmail &>/dev/null; then
        echo -e "$email_content" | sendmail -f "$EMAIL_FROM" "$EMAIL_TO" 2>/dev/null
        log "Email sent: $subject"
    elif command -v mail &>/dev/null; then
        echo "$body" | mail -s "[CUBRID Guardian] $subject" "$EMAIL_TO" 2>/dev/null
        log "Email sent via mail: $subject"
    elif command -v msmtp &>/dev/null; then
        echo -e "$email_content" | msmtp "$EMAIL_TO" 2>/dev/null
        log "Email sent via msmtp: $subject"
    else
        log "Email not sent (no mail tool): $subject"
        # Fallback: write to log
        echo "=== EMAIL ALERT (not sent - no mail tool) ===" >> "$LOG_FILE"
        echo "To: $EMAIL_TO" >> "$LOG_FILE"
        echo "Subject: $subject" >> "$LOG_FILE"
        echo "$body" >> "$LOG_FILE"
        echo "===" >> "$LOG_FILE"
        return 1
    fi
}

# Pre-defined alerts
alert_backup_success() {
    local backup_path="$1"
    local size="$2"
    local rows="$3"
    
    send_alert "Backup Completed Successfully" "Backup has been completed successfully.

Details:
  Path: $backup_path
  Size: $size
  Rows: $rows
  Time: $(date +%Y-%m-%d_%H:%M:%S)

No action required." "normal"
}

alert_backup_failed() {
    local reason="$1"
    
    send_alert "BACKUP FAILED - Action Required" "Automatic backup has failed.

Reason: $reason
Time: $(date +%Y-%m-%d_%H:%M:%S)

Please check the backup system immediately." "high"
}

alert_recovery_success() {
    local duration="$1"
    local rows="$2"
    
    send_alert "Recovery Completed Successfully" "Database recovery has been completed successfully.

Details:
  Duration: ${duration}s
  Rows Restored: $rows
  Time: $(date +%Y-%m-%d_%H:%M:%S)

The system is now operational." "normal"
}

alert_recovery_failed() {
    local error="$1"
    local details="${2:-N/A}"
    
    send_alert "CRITICAL: Recovery Failed" "Database recovery has FAILED.

Error Type: $error
Details: $details
Time: $(date +%Y-%m-%d_%H:%M:%S)

IMMEDIATE ACTION REQUIRED!" "critical"
}

alert_server_down() {
    local duration="${1:-unknown}"
    
    send_alert "CRITICAL: Database Server Down" "The CUBRID database server is not responding.

Downtime: $duration
Time: $(date +%Y-%m-%d_%H:%M:%S)

Auto-recovery has been initiated." "critical"
}

alert_disk_space() {
    local usage="$1"
    local threshold="${2:-80}"
    
    send_alert "WARNING: Disk Space Low" "Disk space usage is above threshold.

Usage: $usage%
Threshold: ${threshold}%
Time: $(date +%Y-%m-%d_%H:%M:%S)

Please clean up or expand disk space." "high"
}

alert_remote_backup_success() {
    local remote_host="$1"
    local size="$2"
    
    send_alert "Remote Backup Completed" "Backup to remote server completed successfully.

Remote: $remote_host
Size: $size
Time: $(date +%Y-%m-%d_%H:%M:%S)" "normal"
}

alert_remote_backup_failed() {
    local remote_host="$1"
    local reason="$2"
    
    send_alert "Remote Backup FAILED" "Remote backup to $remote_host has failed.

Reason: $reason
Time: $(date +%Y-%m-%d_%H:%M:%S)

Please check remote connectivity." "high"
}

# Test email
test_email() {
    send_alert "Test Alert" "This is a test message from CUBRID Guardian System.

If you receive this, the email alerting system is working correctly.

Time: $(date +%Y-%m-%d_%H:%M:%S)" "normal"
    echo "Test email sent to $EMAIL_TO"
}

# Entry
case "${1:-test}" in
    test) test_email ;;
    backup-success) alert_backup_success "$2" "$3" "$4" ;;
    backup-failed) alert_backup_failed "$2" ;;
    recovery-success) alert_recovery_success "$2" "$3" ;;
    recovery-failed) alert_recovery_failed "$2" "$3" ;;
    server-down) alert_server_down "$2" ;;
    disk-space) alert_disk_space "$2" "$3" ;;
    remote-success) alert_remote_backup_success "$2" "$3" ;;
    remote-failed) alert_remote_backup_failed "$2" "$3" ;;
    *)
        echo "Usage: $0 {test|backup-success|backup-failed|recovery-success|recovery-failed|server-down|disk-space|remote-success|remote-failed}"
        ;;
esac
