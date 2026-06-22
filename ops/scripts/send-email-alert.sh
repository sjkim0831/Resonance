#!/bin/bash
#============================================
# CUBRID Guardian - Gmail Email Alerts
# Uses Gmail SMTP with App Password
#============================================

GMAIL_USER="imaneya@gmail.com"
GMAIL_APP_PASSWORD="iebnuecsgrrckyux"  # App Password without spaces
EMAIL_TO="imaneya@gmail.com"
LOG_FILE="/opt/Resonance/var/log/email-alerts.log"

log() { echo "[$(date +%H:%M:%S)] $1" | tee -a "$LOG_FILE"; }

send_email() {
    local subject="$1"
    local body="$2"
    local priority="${3:-normal}"
    
    python3 << EOFPY
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import sys

GMAIL_USER = "$GMAIL_USER"
GMAIL_APP_PASSWORD = "$GMAIL_APP_PASSWORD"
EMAIL_TO = "$EMAIL_TO"

msg = MIMEMultipart()
msg['From'] = GMAIL_USER
msg['To'] = EMAIL_TO
msg['Subject'] = f"[CUBRID Guardian] $subject"

if "$priority" == "critical":
    msg['X-Priority'] = '1'

msg.attach(MIMEText("""$body

---
Sent by CUBRID Guardian System
$(date +%Y-%m-%d_%H:%M:%S)
""", 'plain'))

try:
    with smtplib.SMTP('smtp.gmail.com', 587) as server:
        server.starttls()
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_USER, EMAIL_TO, msg.as_string())
    print("OK: Email sent")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
EOFPY
}

# Pre-defined alerts
case "${1:-test}" in
    test)
        send_email "Test Alert" "이것은 CUBRID Guardian 시스템 테스트 이메일입니다.\n\n이메일을 받으면 알림 시스템이 정상 작동합니다."
        ;;
    backup-success)
        send_email "Backup Completed" "백업이 성공적으로 완료되었습니다.\n\n${2:-Details}"
        ;;
    backup-failed)
        send_email "BACKUP FAILED" "백업이 실패했습니다!\n\n${2:-Please check the system}" "critical"
        ;;
    recovery-success)
        send_email "Recovery Completed" "데이터베이스 복구가 성공적으로 완료되었습니다.\n\n${2:-Details}"
        ;;
    recovery-failed)
        send_email "CRITICAL: Recovery Failed" "데이터베이스 복구가 실패했습니다!\n\n${2:-IMMEDIATE ACTION REQUIRED}" "critical"
        ;;
    server-down)
        send_email "CRITICAL: Server Down" "데이터베이스 서버가 응답하지 않습니다.\n\n${2:-Auto-recovery initiated}" "critical"
        ;;
    remote-backup-success)
        send_email "Remote Backup Success" "원격 백업이 완료되었습니다.\n\n${2:-Details}"
        ;;
    remote-backup-failed)
        send_email "Remote Backup Failed" "원격 백업이 실패했습니다.\n\n${2:-Check remote connection}" "high"
        ;;
    *)
        echo "Usage: $0 {test|backup-success|backup-failed|recovery-success|recovery-failed|server-down|remote-backup-success|remote-backup-failed}"
        ;;
esac
