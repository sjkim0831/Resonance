#!/usr/bin/env bash
# remote-backup.sh - Backup to remote storage
# Usage: bash ops/scripts/remote-backup.sh [sync|fetch|status|setup]

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/Resonance/data/cubrid/backups}"
REMOTE_USER="${REMOTE_USER:-sjkim}"
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_PATH="${REMOTE_PATH:-/backup/carbonet}"
SSH_KEY="${SSH_KEY:-~/.ssh/id_rsa}"

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

check_remote_config() {
    if [[ -z "$REMOTE_HOST" ]]; then
        if [[ -f "${BACKUP_DIR}/.remote_config" ]]; then
            source "${BACKUP_DIR}/.remote_config"
        fi
    fi

    if [[ -z "$REMOTE_HOST" ]]; then
        log_err "REMOTE_HOST not configured"
        log "Set REMOTE_HOST environment variable or create ${BACKUP_DIR}/.remote_config"
        return 1
    fi
    return 0
}

setup_remote() {
    local host="$1"
    local path="${2:-/backup/carbonet}"

    log_step "Setting up remote backup to ${host}:${path}"

    echo "REMOTE_HOST=${host}" > "${BACKUP_DIR}/.remote_config"
    echo "REMOTE_PATH=${path}" >> "${BACKUP_DIR}/.remote_config"
    echo "REMOTE_USER=${REMOTE_USER}" >> "${BACKUP_DIR}/.remote_config"

    mkdir -p "${BACKUP_DIR}"

    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${REMOTE_USER}@${host}" "mkdir -p ${path}" 2>/dev/null || {
        log_warn "Could not create remote directory (may already exist or no SSH access)"
    }

    log_ok "Remote backup configured"
    log "  Host: ${host}"
    log "  Path: ${path}"
    log ""
    log "Test with: $0 sync --dry-run"
}

sync_to_remote() {
    check_remote_config || exit 1

    log_step "Syncing backups to remote: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"

    local dry_run=""
    if [[ "${1:-}" == "--dry-run" ]]; then
        dry_run="--dry-run"
        log "(DRY RUN - no changes will be made)"
    fi

    mkdir -p "${BACKUP_DIR}"

    rsync -avz $dry_run \
        -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no" \
        --progress \
        --bwlimit=10000 \
        "${BACKUP_DIR}"/*.tar.gz \
        "${BACKUP_DIR}"/.remote_config \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/" 2>&1 | tail -20

    if [[ -z "$dry_run" ]]; then
        log_ok "Sync completed"
    else
        log_ok "Dry run completed (no changes)"
    fi
}

fetch_from_remote() {
    check_remote_config || exit 1

    log_step "Fetching backups from remote: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"

    mkdir -p "${BACKUP_DIR}"

    rsync -avz \
        -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no" \
        --progress \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"*.tar.gz \
        "${BACKUP_DIR}/" 2>&1 | tail -20

    log_ok "Fetch completed"
}

remote_status() {
    check_remote_config || exit 1

    log_step "Remote backup status"

    echo ""
    echo "Local backups:"
    ls -lh "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | awk '{print "  " $5 "  " $9}' || echo "  None"

    echo ""
    echo "Remote backups:"
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" \
        "ls -lh ${REMOTE_PATH}"*.tar.gz 2>/dev/null | awk '{print "  " $5 "  " $9}' || echo "  None or cannot connect"

    echo ""
    echo "Remote path: ${REMOTE_HOST}:${REMOTE_PATH}"
}

verify_remote_sync() {
    check_remote_config || exit 1

    log_step "Verifying remote sync integrity"

    local temp_local=$(mktemp)
    local temp_remote=$(mktemp)

    local latest_local=$(ls -t "${BACKUP_DIR}"/*fullbackup*.tar.gz 2>/dev/null | head -1)
    local latest_remote=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" \
        "ls -t ${REMOTE_PATH}"/*fullbackup*.tar.gz 2>/dev/null | head -1)

    if [[ -z "$latest_local" ]] || [[ -z "$latest_remote" ]]; then
        log_warn "No backup files to compare"
        return
    fi

    log "  Local:  $(basename $latest_local) ($(stat -c%s "$latest_local" 2>/dev/null || stat -f%z "$latest_local" | numfmt --to=iec))"
    log "  Remote: $(basename $latest_remote)"

    local local_md5=$(md5sum "$latest_local" 2>/dev/null | cut -d' ' -f1)
    local remote_md5=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" \
        "md5sum ${latest_remote}" 2>/dev/null | cut -d' ' -f1)

    if [[ "$local_md5" == "$remote_md5" ]]; then
        log_ok "Checksums match: $local_md5"
    else
        log_err "Checksums do not match!"
        log "  Local:  $local_md5"
        log "  Remote: $remote_md5"
    fi
}

case "${1:-status}" in
    sync)
        sync_to_remote "${2:-}"
        ;;
    fetch)
        fetch_from_remote
        ;;
    status)
        remote_status
        ;;
    verify)
        verify_remote_sync
        ;;
    setup)
        setup_remote "${2:-}" "${3:-}"
        ;;
    *)
        echo "Usage: $0 {sync|fetch|status|verify|setup} [options]"
        echo ""
        echo "Commands:"
        echo "  sync     - Sync local backups to remote"
        echo "  fetch    - Fetch backups from remote to local"
        echo "  status   - Show backup status (local + remote)"
        echo "  verify   - Verify remote sync integrity"
        echo "  setup    - Configure remote backup"
        echo ""
        echo "Options:"
        echo "  --dry-run (with sync) - Show what would be synced"
        echo ""
        echo "Configuration:"
        echo "  Set REMOTE_HOST env var or create ${BACKUP_DIR}/.remote_config"
        echo "  Format: REMOTE_HOST=host REMOTE_PATH=/path REMOTE_USER=user"
        exit 1
        ;;
esac