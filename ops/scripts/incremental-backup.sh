#!/usr/bin/env bash
# incremental-backup.sh - Incremental backup using changed tracking
# Usage: bash ops/scripts/incremental-backup.sh [create|list|restore]

set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
POD_NAME="postgres-patroni-0"
DB_NAME="${DB_NAME:-carbonet}"
DB_PATH="/var/lib/postgresql/data"
BACKUP_DIR="${BACKUP_DIR:-/opt/Resonance/var/postgres-backups-ha}"
TRACK_DIR="${BACKUP_DIR}/.tracking"
MARKER_FILE="${TRACK_DIR}/last_backup.mark"

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

exec_in_pod() {
    kubectl exec -n ${NAMESPACE} ${POD_NAME} -- bash -c "$*" 2>&1
}

init_tracking() {
    mkdir -p "${TRACK_DIR}"
    if [[ ! -f "$MARKER_FILE" ]]; then
        echo "1970-01-01 00:00:00" > "$MARKER_FILE"
    fi
}

get_last_backup_time() {
    cat "$MARKER_FILE"
}

update_marker() {
    date "+%Y-%m-%d %H:%M:%S" > "$MARKER_FILE"
}

find_changed_files() {
    local since="$1"
    log_step "Finding files changed since: ${since}"

    exec_in_pod "
        find ${DB_PATH} -type f -name 'carbonet*' -newer /tmp/marker 2>/dev/null | head -100
    "
}

create_incremental_backup() {
    init_tracking
    local last_time=$(get_last_backup_time)
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local inc_backup="${BACKUP_DIR}/carbonet-incremental-${timestamp}.tar.gz"

    log_step "Creating incremental backup..."

    log "  Last backup: ${last_time}"

    exec_in_pod "touch -d '${last_time}' /tmp/marker 2>/dev/null || true"

    log "  Finding changed files..."
    local changed_files=$(exec_in_pod "cd ${DB_PATH} && tar -czf /tmp/incremental.tar.gz --listed-incremental=/tmp/snapshot.nfile carbonet* 2>&1" || echo "")

    exec_in_pod "cd ${DB_PATH} && tar -czf /tmp/incremental.tar.gz --listed-incremental=/tmp/snapshot.nfile carbonet* 2>/dev/null"

    kubectl cp "${NAMESPACE}/${POD_NAME}:/tmp/incremental.tar.gz" "$inc_backup" 2>&1 | grep -v "tar:" || true

    if [[ -f "$inc_backup" ]]; then
        local size=$(stat -c%s "$inc_backup" 2>/dev/null || stat -f%z "$inc_backup" 2>/dev/null)
        log_ok "Incremental backup created: $(basename $inc_backup) ($(numfmt --to=iec $size 2>/dev/null || echo "${size} bytes"))"

        update_marker
        log "  Marker updated to: $(get_last_backup_time)"
    else
        log_err "Failed to create incremental backup"
        return 1
    fi

    echo "  $(ls -lh "$inc_backup" | awk '{print $5}')  $(basename $inc_backup)"
}

list_incremental_backups() {
    log_step "Incremental backups:"
    ls -lh "${BACKUP_DIR}"/carbonet-incremental-*.tar.gz 2>/dev/null || log_warn "No incremental backups found"
}

restore_incremental() {
    local backup_file="$1"
    if [[ ! -f "$backup_file" ]]; then
        log_err "Backup file not found: $backup_file"
        return 1
    fi

    log_step "Restoring incremental backup: $(basename $backup_file)"

    local temp_dir=$(mktemp -d)
    tar -xzf "$backup_file" -C "$temp_dir" 2>/dev/null

    log_warn "Incremental restore requires full backup as base"
    log "  1. Restore full backup first"
    log "  2. Then apply incremental: tar -xzf $backup_file -C ${DB_PATH}"

    rm -rf "$temp_dir"
}

show_tracking_info() {
    log_step "Tracking information:"
    echo "  Tracking directory: ${TRACK_DIR}"
    echo "  Last backup time:   $(get_last_backup_time)"
    echo ""
    echo "  To create incremental backup:"
    echo "    $0 create"
    echo ""
    echo "  To list incremental backups:"
    echo "    $0 list"
}

case "${1:-show}" in
    create)
        create_incremental_backup
        ;;
    list)
        list_incremental_backups
        ;;
    restore)
        restore_incremental "${2:-}"
        ;;
    show|info)
        show_tracking_info
        ;;
    *)
        echo "Usage: $0 {create|list|restore|show} [backup-file]"
        echo "  create  - Create new incremental backup"
        echo "  list    - List incremental backups"
        echo "  restore - Restore incremental backup (requires full backup base)"
        echo "  show    - Show tracking information"
        exit 1
        ;;
esac