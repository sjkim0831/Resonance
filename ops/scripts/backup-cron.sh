#!/usr/bin/env bash
# backup-cron.sh - Setup automatic backup scheduling
# Usage: bash ops/scripts/backup-cron.sh [install|remove|status|test]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-guardian.sh"
ROTATION_SCRIPT="${SCRIPT_DIR}/backup-rotation.sh"
VERIFY_SCRIPT="${SCRIPT_DIR}/backup-verify.sh"

CRON_SCHEDULE="${CRON_SCHEDULE:-}"
CRON_USER="${CRON_USER:-$(whoami)}"
CRON_LOG="${CRON_LOG:-/opt/Resonance/logs/backup-cron.log}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "[$(date '+%H:%M:%S')] ${*}"; }
log_ok() { log "${GREEN}✓${NC} $*"; }
log_warn() { log "${YELLOW}⚠${NC} $*"; }
log_err() { log "${RED}✗${NC} $*"; }
log_step() { log "${BLUE}[STEP]${NC} $*"; }

BACKUP_SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"
ROTATION_SCHEDULE="${ROTATION_SCHEDULE:-0 3 * * 0}"
VERIFY_SCHEDULE="${VERIFY_SCHEDULE:-0 4 * * *}"

install_cron() {
    log_step "Installing backup cron jobs..."

    mkdir -p "$(dirname "$CRON_LOG")"
    touch "$CRON_LOG"

    local cron_entries="# PostgreSQL Backup Cron Jobs - Added $(date '+%Y-%m-%d %H:%M')
# Daily backup at 2 AM
${BACKUP_SCHEDULE} cd ${SCRIPT_DIR} && bash ${BACKUP_SCRIPT} >> ${CRON_LOG} 2>&1
# Weekly rotation on Sunday at 3 AM
${ROTATION_SCHEDULE} cd ${SCRIPT_DIR} && bash ${ROTATION_SCRIPT} >> ${CRON_LOG} 2>&1
# Daily verification at 4 AM
${VERIFY_SCHEDULE} cd ${SCRIPT_DIR} && bash ${VERIFY_SCRIPT} >> ${CRON_LOG} 2>&1
"

    if [[ -f /etc/cron.d/carbonet-backup ]]; then
        log_warn "Cron file already exists at /etc/cron.d/carbonet-backup"
        read -p "Overwrite? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "Aborted"
            return
        fi
    fi

    echo "$cron_entries" | sudo tee /etc/cron.d/carbonet-backup > /dev/null
    sudo chmod 644 /etc/cron.d/carbonet-backup

    log_ok "Cron jobs installed:"
    echo ""
    cat /etc/cron.d/carbonet-backup | grep -v "^#" | grep -v "^$"
    echo ""
    log_ok "Logs will be written to: ${CRON_LOG}"
}

remove_cron() {
    log_step "Removing backup cron jobs..."

    if [[ -f /etc/cron.d/carbonet-backup ]]; then
        sudo rm -f /etc/cron.d/carbonet-backup
        log_ok "Removed /etc/cron.d/carbonet-backup"
    else
        log_warn "Cron file not found"
    fi
}

show_status() {
    log_step "Backup Cron Status"
    echo ""

    if [[ -f /etc/cron.d/carbonet-backup ]]; then
        echo "Cron file: /etc/cron.d/carbonet-backup (ACTIVE)"
        echo ""
        cat /etc/cron.d/carbonet-backup
    else
        echo "Cron file: Not installed"
    fi

    echo ""
    echo "Schedules:"
    echo "  Backup:    ${BACKUP_SCHEDULE}"
    echo "  Rotation:  ${ROTATION_SCHEDULE}"
    echo "  Verify:    ${VERIFY_SCHEDULE}"
    echo ""
    echo "Scripts:"
    echo "  Backup:    ${BACKUP_SCRIPT}"
    echo "  Rotation:  ${ROTATION_SCRIPT}"
    echo "  Verify:    ${VERIFY_SCRIPT}"
    echo ""
    echo "Log file: ${CRON_LOG}"

    if [[ -f "$CRON_LOG" ]]; then
        echo ""
        echo "Recent log entries:"
        tail -10 "$CRON_LOG" | sed 's/^/  /'
    fi
}

test_run() {
    log_step "Running test backup..."

    echo ""
    echo "=== Testing Backup Script ==="
    if [[ -x "${BACKUP_SCRIPT}" ]]; then
        bash "${BACKUP_SCRIPT}" || log_err "Backup script failed"
    else
        log_warn "Backup script not found or not executable: ${BACKUP_SCRIPT}"
    fi

    echo ""
    echo "=== Testing Rotation Script ==="
    if [[ -x "${ROTATION_SCRIPT}" ]]; then
        bash "${ROTATION_SCRIPT}" dry-run || log_err "Rotation script failed"
    else
        log_warn "Rotation script not found: ${ROTATION_SCRIPT}"
    fi

    echo ""
    echo "=== Testing Verify Script ==="
    if [[ -x "${VERIFY_SCRIPT}" ]]; then
        bash "${VERIFY_SCRIPT}" all || log_err "Verify script failed"
    else
        log_warn "Verify script not found: ${VERIFY_SCRIPT}"
    fi

    log_ok "Test run completed"
}

case "${1:-status}" in
    install)
        install_cron
        ;;
    remove|uninstall)
        remove_cron
        ;;
    status)
        show_status
        ;;
    test)
        test_run
        ;;
    *)
        echo "Usage: $0 {install|remove|status|test}"
        echo ""
        echo "Commands:"
        echo "  install  - Install cron jobs for automated backup"
        echo "  remove   - Remove cron jobs"
        echo "  status   - Show cron job status"
        echo "  test     - Run test backup/rotation/verify"
        echo ""
        echo "Default schedules:"
        echo "  Backup:    ${BACKUP_SCHEDULE} (daily at 2 AM)"
        echo "  Rotation:  ${ROTATION_SCHEDULE} (weekly Sunday 3 AM)"
        echo "  Verify:    ${VERIFY_SCHEDULE} (daily at 4 AM)"
        echo ""
        echo "Custom schedule format (cron):"
        echo "  BACKUP_SCHEDULE='0 3 * * *' $0 install"
        exit 1
        ;;
esac