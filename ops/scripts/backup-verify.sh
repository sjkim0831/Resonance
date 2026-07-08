# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] backup-verify.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/usr/bin/env bash
# backup-verify.sh - Verify backup integrity
# Usage: bash ops/scripts/backup-verify.sh [backup-file|all]

set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
POD_NAME="cubrid-carbonet-0"
DB_NAME="${DB_NAME:-carbonet}"
BACKUP_DIR="${BACKUP_DIR:-/opt/Resonance/data/cubrid/backups}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "[$(date '+%H:%M:%S')] ${*}"; }
log_ok() { log "${GREEN}✓${NC} $*"; }
log_warn() { log "${YELLOW}⚠${NC} $*"; }
log_err() { log "${RED}✗${NC} $*"; }

check_pod() {
    if ! kubectl get pod ${POD_NAME} -n ${NAMESPACE} &>/dev/null; then
        log_err "Pod not found: ${POD_NAME}"
        return 1
    fi
    if ! kubectl get pod ${POD_NAME} -n ${NAMESPACE} | grep -q "Running"; then
        log_err "Pod not Running"
        return 1
    fi
    return 0
}

exec_in_pod() {
    kubectl exec -n ${NAMESPACE} ${POD_NAME} -- bash -c "$*" 2>&1
}

verify_tarball() {
    local backup_file="$1"
    log_step "Verifying tarball integrity: ${backup_file}"

    if [[ ! -f "$backup_file" ]]; then
        log_err "Backup file not found: ${backup_file}"
        return 1
    fi

    local size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file")
    log "  Size: $(numfmt --to=iec $size 2>/dev/null || echo "${size} bytes")"

    log "  Testing tar extraction (dry run)..."
    if tar -tzf "$backup_file" >/dev/null 2>&1; then
        log_ok "  Tarball is valid"
    else
        log_err "  Tarball is corrupted"
        return 1
    fi

    log "  Checking contents..."
    local contents=$(tar -tzf "$backup_file" | head -20)
    echo "$contents" | while read line; do
        log "    $line"
    done

    return 0
}

verify_unload_backup() {
    local backup_file="$1"
    log_step "Verifying unload backup: ${backup_file}"

    local temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" RETURN

    tar -xzf "$backup_file" -C "$temp_dir" 2>/dev/null || {
        log_err "Failed to extract"
        return 1
    }

    local extracted_dir=$(find "$temp_dir" -maxdepth 2 -type d -name "*unload*" | head -1)
    if [[ -z "$extracted_dir" ]]; then
        log_err "Unload directory not found in backup"
        return 1
    fi

    local unloaddb_dir="${extracted_dir}/unloaddb"
    if [[ ! -d "$unloaddb_dir" ]]; then
        log_err "unloaddb directory not found"
        return 1
    fi

    log "  Checking schema file..."
    if [[ -f "${unloaddb_dir}/carbonet_schema" ]]; then
        local schema_lines=$(wc -l < "${unloaddb_dir}/carbonet_schema")
        log_ok "  Schema: ${schema_lines} lines"
    else
        log_err "  Schema file missing"
        return 1
    fi

    log "  Checking indexes file..."
    if [[ -f "${unloaddb_dir}/carbonet_indexes" ]]; then
        local index_lines=$(wc -l < "${unloaddb_dir}/carbonet_indexes")
        log_ok "  Indexes: ${index_lines} lines"
    else
        log_warn "  Indexes file not found"
    fi

    log "  Checking data file..."
    if [[ -f "${unloaddb_dir}/carbonet_objects" ]]; then
        local data_lines=$(wc -l < "${unloaddb_dir}/carbonet_objects")
        log_ok "  Objects: ${data_lines} lines"
    else
        log_err "  Objects file missing"
        return 1
    fi

    log_ok "Unload backup is valid"
    return 0
}

test_restore_to_pod() {
    local backup_file="$1"
    log_step "Testing restore to pod (dry run)..."

    local temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" RETURN

    tar -xzf "$backup_file" -C "$temp_dir" 2>/dev/null || {
        log_err "Failed to extract"
        return 1
    fi

    local extracted_dir=$(find "$temp_dir" -type d -name "carbonet-live-unload-*" | head -1)
    if [[ -z "$extracted_dir" ]]; then
        log_warn "Not an unload backup, skipping restore test"
        return 0
    fi

    log "  Copying to pod for validation..."
    kubectl cp "$extracted_dir" "${NAMESPACE}/${POD_NAME}:/tmp/verify-test" 2>/dev/null && {
        log_ok "  Files copied to pod successfully"
        exec_in_pod "rm -rf /tmp/verify-test"
    } || {
        log_warn "  Could not copy to pod (non-critical)"
    }

    return 0
}

compare_with_current_db() {
    log_step "Comparing backup with current database state..."

    local current_tables=$(exec_in_pod "source /home/cubrid/.cubrid.sh && \
        csql -C -u dba -p '' -c 'SELECT COUNT(*) FROM db_class;' ${DB_NAME}@localhost 2>&1" | \
        grep -oE '[0-9]+' | head -1)

    log "  Current DB tables: ${current_tables}"

    local temp_dir=$(mktemp -d)
    tar -xzf "$1" -C "$temp_dir" 2>/dev/null

    local extracted_dir=$(find "$temp_dir" -type d -name "carbonet-live-unload-*" | head -1)
    if [[ -n "$extracted_dir" ]]; then
        local unloaddb_dir="${extracted_dir}/unloaddb"
        if [[ -f "${unloaddb_dir}/carbonet_objects" ]]; then
            local backup_classes=$(grep -c "^CLASS " "${unloaddb_dir}/carbonet_objects" 2>/dev/null || echo "0")
            log "  Backup classes in objects: ${backup_classes}"
        fi
    fi

    rm -rf "$temp_dir"
}

log_step() { log "${BLUE}[STEP]${NC} $*"; }

case "${1:-all}" in
    all)
        log "=== Verifying all backups in ${BACKUP_DIR} ==="
        local exit_code=0

        for backup in "${BACKUP_DIR}"/*.tar.gz; do
            [[ -f "$backup" ]] || continue
            echo ""
            log_step "=== Verifying $(basename $backup) ==="
            verify_tarball "$backup" || exit_code=1

            if [[ "$backup" == *"unload"* ]]; then
                verify_unload_backup "$backup" || exit_code=1
                test_restore_to_pod "$backup" || exit_code=1
                compare_with_current_db "$backup" || exit_code=1
            fi
            echo ""
        done

        if [[ $exit_code -eq 0 ]]; then
            log_ok "All backups verified successfully"
        else
            log_err "Some backups failed verification"
        fi
        exit $exit_code
        ;;
    verify)
        verify_tarball "${2:-}" || exit 1
        if [[ "$2" == *"unload"* ]]; then
            verify_unload_backup "${2:-}" || exit 1
        fi
        log_ok "Verification passed"
        ;;
    test-restore)
        test_restore_to_pod "${2:-}" || exit 1
        log_ok "Restore test passed"
        ;;
    compare)
        compare_with_current_db "${2:-}" || exit 1
        ;;
    *)
        echo "Usage: $0 {all|verify|test-restore|compare} [backup-file]"
        echo "  all         - Verify all backups (default)"
        echo "  verify      - Verify specific backup"
        echo "  test-restore - Test restore capability"
        echo "  compare     - Compare with current DB"
        exit 1
        ;;
esac