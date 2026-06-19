#!/usr/bin/env bash
#===============================================================================
# Notification System for Build-Deploy Events
# 
# Supports:
# - Slack Webhooks
# - Email (SMTP)
# - Console (always on)
# - Custom webhooks
#
# Usage:
#   ./resonance-notify.sh <event> <status> <message>
#
# Events:
#   build-start, build-complete, build-fail
#   deploy-start, deploy-complete, deploy-fail
#   health-ok, health-fail
#===============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
SLACK_CHANNEL="${SLACK_CHANNEL:-#ops-alerts}"
EMAIL_TO="${EMAIL_TO:-}"
EMAIL_FROM="${EMAIL_FROM:-noreply@carbonet.local}"
SMTP_HOST="${SMTP_HOST:-localhost}"
SMTP_PORT="${SMTP_PORT:-25}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

#===============================================================================
# Utility Functions
#===============================================================================
log_console() {
  local status="$1"
  local message="$2"
  case "$status" in
    START) echo -e "${BLUE}[START]${NC} $(date '+%H:%M:%S') $message" ;;
    SUCCESS) echo -e "${GREEN}[OK]${NC} $(date '+%H:%M:%S') $message" ;;
    FAIL) echo -e "${RED}[FAIL]${NC} $(date '+%H:%M:%S') $message" ;;
    WARN) echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $message" ;;
    INFO) echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $message" ;;
    *) echo "[$status] $(date '+%H:%M:%S') $message" ;;
  esac
}

#===============================================================================
# Slack Notification
#===============================================================================
notify_slack() {
  local event="$1"
  local status="$2"
  local message="$3"
  local extra="${4:-}"
  
  [[ -z "$SLACK_WEBHOOK_URL" ]] && return 0
  
  # Determine emoji and color based on status
  local emoji color
  case "$status" in
    START) emoji="🚀"; color="#36a64f" ;;
    SUCCESS) emoji="✅"; color="#36a64f" ;;
    FAIL) emoji="❌"; color="#ff0000" ;;
    WARN) emoji="⚠️"; color="#ffaa00" ;;
    INFO) emoji="ℹ️"; color="#36a64f" ;;
    *) emoji="📢"; color="#36a64f" ;;
  esac
  
  # Build JSON payload
  local hostname
  hostname="$(hostname)"
  
  local payload
  payload=$(cat <<EOF
{
  "channel": "$SLACK_CHANNEL",
  "username": "Carbonet Bot",
  "icon_emoji": "$emoji",
  "attachments": [
    {
      "color": "$color",
      "title": "$event - $status",
      "text": "$message",
      "fields": [
        {"title": "Host", "value": "$hostname", "short": true},
        {"title": "Time", "value": "$(date '+%Y-%m-%d %H:%M:%S')", "short": true}
      ],
      "footer": "Carbonet Build-Deploy",
      "ts": $(date +%s)
    }
  ]
}
EOF
)
  
  # Send to Slack
  curl -s -X POST \
    -H 'Content-Type: application/json' \
    -d "$payload" \
    "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
  
  log_console "$status" "Slack notification sent"
}

#===============================================================================
# Email Notification
#===============================================================================
notify_email() {
  local event="$1"
  local status="$2"
  local message="$3"
  
  [[ -z "$EMAIL_TO" ]] && return 0
  
  local subject="[Carbonet] $event - $status"
  local hostname
  hostname="$(hostname)"
  
  local body
  body=$(cat <<EOF
Carbonet Build-Deploy Notification
==================================

Event: $event
Status: $status
Message: $message
Host: $hostname
Time: $(date '+%Y-%m-%d %H:%M:%S')

---
This is an automated message from Carbonet Build-Deploy System.
EOF
)
  
  # Send email using sendmail or mail command
  if command -v sendmail >/dev/null 2>&1; then
    echo "$body" | sendmail -f "$EMAIL_FROM" -t "$EMAIL_TO"
  elif command -v mail >/dev/null 2>&1; then
    echo "$body" | mail -s "$subject" "$EMAIL_TO"
  fi
  
  log_console "$status" "Email notification sent to $EMAIL_TO"
}

#===============================================================================
# Webhook Notification
#===============================================================================
notify_webhook() {
  local event="$1"
  local status="$2"
  local message="$3"
  local webhook_url="${4:-}"
  
  [[ -z "$webhook_url" ]] && return 0
  
  local hostname
  hostname="$(hostname)"
  
  local payload
  payload=$(cat <<EOF
{
  "event": "$event",
  "status": "$status",
  "message": "$message",
  "host": "$hostname",
  "timestamp": "$(date -Iseconds)"
}
EOF
)
  
  curl -s -X POST \
    -H 'Content-Type: application/json' \
    -d "$payload" \
    "$webhook_url" >/dev/null 2>&1 || true
}

#===============================================================================
# Main
#===============================================================================
main() {
  local event="${1:-}"
  local status="${2:-}"
  local message="${3:-}"
  
  if [[ -z "$event" ]] || [[ -z "$status" ]] || [[ -z "$message" ]]; then
    echo "Usage: $0 <event> <status> <message>"
    echo "Example: $0 build-complete SUCCESS 'Frontend and backend built successfully'"
    exit 1
  fi
  
  # Always log to console
  log_console "$status" "[$event] $message"
  
  # Send to notification channels
  notify_slack "$event" "$status" "$message"
  notify_email "$event" "$status" "$message"
  
  # Log to file
  local log_dir="$ROOT_DIR/var/logs"
  mkdir -p "$log_dir"
  echo "[$(date -Iseconds)] [$status] [$event] $message" >> "$log_dir/notifications.log"
}

main "$@"
