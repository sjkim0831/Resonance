#!/usr/bin/env bash
# backup-rotation.sh - Rotate and clean old backups
# Usage: bash ops/scripts/backup-rotation.sh [keep-full] [keep-incremental] [dry-run]

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/Resonance/var/postgres-backups-ha}"
KEEP_FULL="${KEEP_FULL:-3}"
KEEP_INCREMENTAL="${KEEP_INCREMENTAL:-7}"
KEEP_UNLOAD="${KEEP_UNLOAD:-2}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "[$(date '+%H:%M:%S')] ${*}"; }
log_ok() { log "${GREEN}✓${NC} $*"; }
log_warn() { log "${YELLOW}⚠${NC} $*"; }
log_err() { log "${RED}✗${NC} $*"; }

list_backups() {
    local type="$1"
    local count="${2:-10}"

    case "$type" in
        full)
            ls -1t "${BACKUP_DIR}"/carbonet-fullbackup-*.tar.gz 2>/dev/null | head -"$count"
            ;;
        quick|incremental)
            ls -1t "${BACKUP_DIR}"/carbonet-quickbackup-*.tar.gz 2>/dev/null | head -"$count"
            ;;
        unload)
            ls -1t "${BACKUP_DIR}"/carbonet-live-unload-*.tar.gz 2>/dev/null | head -"$count"
            ;;
        all)
            ls -1t "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | head -"$count"
            ;;
    esac
}

rotate_full_backups() {
    log_step "Rotating full backups (keeping ${KEEP_FULL})..."

    local backups=($(list_backups "full" 100))
    local count=${#backups[@]}

    if [[ $count -eq 0 ]]; then
        log_warn "No full backups found"
        return
    fi

    log "Found ${count} full backups"
    log "Keeping latest ${KEEP_FULL}"

    local deleted=0
    for ((i=KEEP_FULL; i<count; i++)); do
        local backup="${backups[$i]}"
        if [[ -f "$backup" ]]; then
            if [[ "${1:-}" == "dry-run" ]]; then
                log "Would delete: $(basename $backup)"
            else
                rm -f "$backup"
                log_ok "Deleted: $(basename $backup)"
                ((deleted++))
            fi
        fi
    done

    if [[ $deleted -gt 0 ]]; then
        log_ok "Deleted ${deleted} old full backups"
    else
        log_ok "No old full backups to delete"
    fi
}

rotate_quick_backups() {
    log_step "Rotating quick backups (keeping ${KEEP_INCREMENTAL})..."

    local backups=($(list_backups "quick" 100))
    local count=${#backups[@]}

    if [[ $count -eq 0 ]]; then
        log_warn "No quick backups found"
        return
    fi

    log "Found ${count} quick backups"
    log "Keeping latest ${KEEP_INCREMENTAL}"

    local deleted=0
    for ((i=KEEP_INCREMENTAL; i<count; i++)); do
        local backup="${backups[$i]}"
        if [[ -f "$backup" ]]; then
            if [[ "${1:-}" == "dry-run" ]]; then
                log "Would delete: $(basename $backup)"
            else
                rm -f "$backup"
                log_ok "Deleted: $(basename $backup)"
                ((deleted++))
            fi
        fi
    done

    if [[ $deleted -gt 0 ]]; then
        log_ok "Deleted ${deleted} old quick backups"
    else
        log_ok "No old quick backups to delete"
    fi
}

rotate_unload_backups() {
    log_step "Rotating unload backups (keeping ${KEEP_UNLOAD})..."

    local backups=($(list_backups "unload" 100))
    local count=${#backups[@]}

    if [[ $count -eq 0 ]]; then
        log_warn "No unload backups found"
        return
    fi

    log "Found ${count} unload backups"
    log "Keeping latest ${KEEP_UNLOAD}"

    local deleted=0
    for ((i=KEEP_UNLOAD; i<count; i++)); do
        local backup="${backups[$i]}"
        if [[ -f "$backup" ]]; then
            if [[ "${1:-}" == "dry-run" ]]; then
                log "Would delete: $(basename $backup)"
            else
                rm -f "$backup"
                log_ok "Deleted: $(basename $backup)"
                ((deleted++))
            fi
        fi
    done

    if [[ $deleted -gt 0 ]]; then
        log_ok "Deleted ${deleted} old unload backups"
    else
        log_ok "No old unload backups to delete"
    fi
}

cleanup_empty_dirs() {
    log_step "Cleaning up empty directories in backup folder..."
    find "${BACKUP_DIR}" -maxdepth 1 -type d -empty 2>/dev/null | while read dir; do
        if [[ "${1:-}" == "dry-run" ]]; then
            log "Would remove empty directory: $dir"
        else
            rmdir "$dir" 2>/dev/null && log_ok "Removed empty directory: $(basename $dir)"
        fi
    done
}

show_summary() {
    log_step "Backup summary for ${BACKUP_DIR}:"
    echo ""

    local full_count=$(ls -1 "${BACKUP_DIR}"/carbonet-fullbackup-*.tar.gz 2>/dev/null | wc -l)
    local quick_count=$(ls -1 "${BACKUP_DIR}"/carbonet-quickbackup-*.tar.gz 2>/dev/null | wc -l)
    local unload_count=$(ls -1 "${BACKUP_DIR}"/carbonet-live-unload-*.tar.gz 2>/dev/null | wc -l)
    local total_size=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)

    echo "  Full backups:   ${full_count} (keeping ${KEEP_FULL})"
    echo "  Quick backups:  ${quick_count} (keeping ${KEEP_INCREMENTAL})"
    echo "  Unload backups: ${unload_count} (keeping ${KEEP_UNLOAD})"
    echo "  Total size:     ${total_size}"
    echo ""

    echo "  Files:"
    ls -lh "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | awk '{print "    " $5 "  " $9}' | xargs -I{} echo "{}"
}

log_step() { log "${BLUE}[STEP]${NC} $*"; }

case "${1:-run}" in
    run)
        log "=== Backup Rotation Started ==="
        rotate_full_backups
        rotate_quick_backups
        rotate_unload_backups
        cleanup_empty_dirs
        show_summary
        log_ok "Backup rotation completed"
        ;;
    dry-run)
        log "=== DRY RUN - No changes will be made ==="
        rotate_full_backups dry-run
        rotate_quick_backups dry-run
        rotate_unload_backups dry-run
        cleanup_empty_dirs dry-run
        show_summary
        ;;
    show)
        show_summary
        ;;
    *)
        echo "Usage: $0 {run|dry-run|show} [keep-full] [keep-incremental] [keep-unload]"
        echo "  run     - Execute rotation (default)"
        echo "  dry-run - Show what would be deleted"
        echo "  show    - Show current backup status"
        echo ""
        echo "  Environment variables:"
        echo "    KEEP_FULL=${KEEP_FULL}"
        echo "    KEEP_INCREMENTAL=${KEEP_INCREMENTAL}"
        echo "    KEEP_UNLOAD=${KEEP_UNLOAD}"
        exit 1
        ;;
esac