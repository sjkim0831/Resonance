#!/bin/bash
#============================================
# CUBRID Alert System v2
# - Slack notifications
# - Email alerts
# - Webhook support
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
EMAIL_TO="${EMAIL_TO:-}"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
LOG_FILE="/opt/Resonance/var/log/alerter.log"

mkdir -p /opt/Resonance/var/log

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; echo "[$(date +%H:%M:%S)] $1" >> "$LOG_FILE"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }

#============================================
# SLACK ALERT
#============================================
send_slack() {
    local color="$1"  # good, warning, danger
    local title="$2"
    local message="$3"
    
    if [ -z "$SLACK_WEBHOOK" ]; then
        log "SLACK_WEBHOOK not set, skipping Slack alert"
        return 1
    fi
    
    local payload=$(cat << EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "$title",
            "text": "$message",
            "footer": "CUBRID Guardian | $(date +%Y-%m-%d %H:%M)",
            "ts": $(date +%s)
        }
    ]
}
EOF
)
    
    curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" \
        "$SLACK_WEBHOOK" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_ok "Slack alert sent: $title"
    else
        log_err "Slack alert failed"
    fi
}

#============================================
# EMAIL ALERT
#============================================
send_email() {
    local subject="$1"
    local body="$2"
    
    if [ -z "$EMAIL_TO" ]; then
        log "EMAIL_TO not set, skipping email alert"
        return 1
    fi
    
    echo "$body" | mail -s "[CUBRID] $subject" "$EMAIL_TO" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_ok "Email sent: $subject"
    else
        log_err "Email failed"
    fi
}

#============================================
# ALERT TYPES
#============================================
alert_recovery_failed() {
    local error_type="$1"
    local details="$2"
    
    log_err "ALERT: Recovery failed - $error_type"
    
    send_slack "danger" "🔴 CUBRID Recovery Failed" \
        "*Error Type:* $error_type\n*Details:* $details\n*Action:* Manual intervention required"
    
    send_email "CUBRID Recovery Failed" \
        "Recovery failed with error: $error_type\n\nDetails:\n$details\n\nPlease check the system immediately."
}

alert_recovery_success() {
    local duration="$1"
    local rows="$2"
    
    log_ok "ALERT: Recovery completed in ${duration}s"
    
    send_slack "good" "🟢 CUBRID Recovery Success" \
        "*Duration:* ${duration}s\n*Rows Restored:* $rows\n*Status:* Complete"
}

alert_backup_failed() {
    local reason="$1"
    
    log_err "ALERT: Backup failed - $reason"
    
    send_slack "warning" "🟡 CUBRID Backup Failed" \
        "*Reason:* $reason\n*Action:* Check backup system"
}

alert_backup_success() {
    local backup_path="$1"
    local size="$2"
    
    log_ok "ALERT: Backup created - $size"
    
    send_slack "good" "🟢 CUBRID Backup Created" \
        "*Path:* $backup_path\n*Size:* $size"
}

alert_server_down() {
    log_err "ALERT: Server is DOWN"
    
    send_slack "danger" "🔴 CUBRID Server DOWN" \
        "*Status:* Server not responding\n*Action:* Auto-recovery initiated"
}

alert_disk_space() {
    local usage="$1"
    
    log_err "ALERT: Disk space critical - $usage%"
    
    send_slack "warning" "🟡 Disk Space Critical" \
        "*Usage:* $usage%\n*Action:* Cleanup required"
}

alert_slo_breach() {
    local process="$1"
    local duration="$1"
    local threshold="$2"
    
    log_err "ALERT: SLO breach - $process took ${duration}s (threshold: ${threshold}s)"
    
    send_slack "warning" "🟡 SLO Breach" \
        "*Process:* $process\n*Duration:* ${duration}s\n*Threshold:* ${threshold}s"
}

#============================================
# CONFIGURE
#============================================
configure() {
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                    Alert Configuration                              ║"
    echo "╠═══════════════════════════════════════════════════════════════════╣"
    echo ""
    echo "Current configuration:"
    echo "  SLACK_WEBHOOK: ${SLACK_WEBHOOK:-not set}"
    echo "  EMAIL_TO: ${EMAIL_TO:-not set}"
    echo ""
    echo "To configure:"
    echo "  export SLACK_WEBHOOK='https://hooks.slack.com/...'"
    echo "  export EMAIL_TO='admin@example.com'"
    echo ""
    echo "Test alert:"
    echo "  $0 test-slack"
    echo "  $0 test-email"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
}

test_slack() {
    if [ -z "$SLACK_WEBHOOK" ]; then
        echo "SLACK_WEBHOOK not configured"
        return 1
    fi
    
    send_slack "good" "🧪 Test Alert" "This is a test message from CUBRID Guardian"
}

test_email() {
    if [ -z "$EMAIL_TO" ]; then
        echo "EMAIL_TO not configured"
        return 1
    fi
    
    send_email "Test Alert" "This is a test message from CUBRID Guardian"
}

#============================================
# AUTOMATIC MONITORING
#============================================
monitor() {
    log "Starting alert monitor..."
    
    while true; do
        # Check recent recovery failures
        if [ -f "$LOG_DB" ]; then
            local last_failure=$(python3 -c "
import sqlite3
from datetime import datetime, timedelta
conn=sqlite3.connect('$LOG_DB')
cur=conn.execute('SELECT error_type, timestamp FROM recovery_log WHERE status!=\"success\" ORDER BY timestamp DESC LIMIT 1')
row=cur.fetchone()
if row:
    # Check if within last hour
    from datetime import datetime, timedelta
    dt = datetime.strptime(row[1], '%Y-%m-%d %H:%M:%S')
    if datetime.now() - dt < timedelta(hours=1):
        print(row[0])
conn.close()
" 2>/dev/null)
            
            if [ -n "$last_failure" ]; then
                alert_recovery_failed "$last_failure" "See recovery log for details"
            fi
        fi
        
        # Check disk space
        local disk_usage=$(df /opt/Resonance | tail -1 | awk '{print $5}' | tr -d '%')
        if [ "$disk_usage" -gt 80 ]; then
            alert_disk_space "$disk_usage"
        fi
        
        sleep 300  # Check every 5 minutes
    done
}

#============================================
# ENTRY
#============================================
case "${1:-help}" in
    configure) configure ;;
    test-slack) test_slack ;;
    test-email) test_email ;;
    monitor) monitor ;;
    recovery-failed) alert_recovery_failed "$2" "$3" ;;
    recovery-success) alert_recovery_success "$2" "$3" ;;
    backup-failed) alert_backup_failed "$2" ;;
    backup-success) alert_backup_success "$2" "$3" ;;
    server-down) alert_server_down ;;
    disk-space) alert_disk_space "$2" ;;
    slo-breach) alert_slo_breach "$2" "$3" "$4" ;;
    *)
        echo "Usage: $0 {configure|test-slack|test-email|monitor}"
        echo "       $0 recovery-failed <error_type> <details>"
        echo "       $0 recovery-success <duration> <rows>"
        echo "       $0 backup-failed <reason>"
        echo "       $0 backup-success <path> <size>"
        echo "       $0 server-down"
        echo "       $0 disk-space <usage%>"
        ;;
esac
