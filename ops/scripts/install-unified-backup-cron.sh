#!/usr/bin/env bash
# install-unified-backup-cron.sh - Install unified backup cron jobs
# Usage: bash ops/scripts/install-unified-backup-cron.sh [uninstall]

set -euo pipefail

CRON_DIR="/etc/cron.d"
CRON_FILE="$CRON_DIR/resonance-backup"
LOG_DIR="/var/log/resonance"
BACKUP_USER="root"

mkdir -p "$LOG_DIR"

install_cron() {
    echo "Installing unified backup cron jobs..."

    cat > "$CRON_FILE" << 'EOF'
# Resonance Unified Backup Schedule
# Environment
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Daily full backup at 02:00 AM
0 2 * * * root /opt/Resonance/ops/scripts/unified-backup.sh full >> /var/log/resonance/backup-full.log 2>&1

# Quick backup every 6 hours (08:00, 14:00, 20:00, 02:00)
0 */6 * * * root /opt/Resonance/ops/scripts/unified-backup.sh quick >> /var/log/resonance/backup-quick.log 2>&1

# Weekly unload backup on Sunday at 03:00 AM
0 3 * * 0 root /opt/Resonance/ops/scripts/unified-backup.sh unload >> /var/log/resonance/backup-unload.log 2>&1
EOF

    chmod 644 "$CRON_FILE"
    echo "Cron installed: $CRON_FILE"
    echo ""
    echo "Schedule:"
    echo "  - Full backup:    Daily at 02:00 AM"
    echo "  - Quick backup:   Every 6 hours"
    echo "  - Unload backup:  Weekly Sunday at 03:00 AM"
    echo ""
    echo "Logs:"
    echo "  - /var/log/resonance/backup-full.log"
    echo "  - /var/log/resonance/backup-quick.log"
    echo "  - /var/log/resonance/backup-unload.log"
}

uninstall_cron() {
    echo "Removing unified backup cron jobs..."
    rm -f "$CRON_FILE"
    echo "Cron removed."
}

show_status() {
    if [[ -f "$CRON_FILE" ]]; then
        echo "Unified backup cron is INSTALLED"
        echo ""
        cat "$CRON_FILE"
    else
        echo "Unified backup cron is NOT installed"
    fi
}

case "${1:-install}" in
    install)
        install_cron
        ;;
    uninstall|remove)
        uninstall_cron
        ;;
    status)
        show_status
        ;;
    run|test)
        echo "Running test backup (quick, no git push)..."
        GIT_TOKEN="" bash /opt/Resonance/ops/scripts/unified-backup.sh quick --no-git
        ;;
    *)
        echo "Usage: $0 [install|uninstall|status|run]"
        ;;
esac