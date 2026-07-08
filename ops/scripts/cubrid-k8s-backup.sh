# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] cubrid-k8s-backup.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/usr/bin/env bash
# cubrid-k8s-backup.sh - CUBRID Kubernetes Backup Script (UTF-8 Korean Safe)
# Version: 2.0 - Enhanced with Korean character encoding support
# Usage: bash ops/scripts/cubrid-k8s-backup.sh [unload|full|quick]

set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
POD_NAME="cubrid-carbonet-0"
DB_NAME="${DB_NAME:-carbonet}"
DB_PATH="/var/lib/cubrid/databases"
BACKUP_DIR="${BACKUP_DIR:-/opt/Resonance/data/cubrid/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "[$(date '+%H:%M:%S')] ${*}"; }
log_step() { log "==> $*"; }
log_ok() { log "${GREEN}✓${NC} $*"; }
log_warn() { log "${YELLOW}⚠${NC} $*"; }
log_err() { log "${RED}✗${NC} $*"; }

check_pod() {
    if ! kubectl get pod ${POD_NAME} -n ${NAMESPACE} &>/dev/null; then
        log_err "Pod ${POD_NAME} not found"
        return 1
    fi
    if ! kubectl get pod ${POD_NAME} -n ${NAMESPACE} | grep -q "Running"; then
        log_err "Pod ${POD_NAME} is not Running"
        return 1
    fi
    return 0
}

exec_in_pod() {
    kubectl exec -n ${NAMESPACE} ${POD_NAME} -- bash -c "$*" 2>&1
}

check_pod || exit 1

ensure_backup_dir() {
    mkdir -p "${BACKUP_DIR}"
    log_ok "Backup directory: ${BACKUP_DIR}"
}

backup_unload() {
    local backup_name="carbonet-unload-${TIMESTAMP}"
    local backup_path="${BACKUP_DIR}/${backup_name}"

    log_step "Creating unload backup: ${backup_name}"

    exec_in_pod "source /home/cubrid/.cubrid.sh && \
        cd ${DB_PATH} && \
        cubrid unloaddb -C -v -u dba -p '' ${DB_NAME} 2>&1" | tail -20

    local unload_dir="${DB_PATH}/${DB_NAME}-live-unload-$(date +%Y%m%d)"
    if exec_in_pod "[ -d ${unload_dir} ]" 2>/dev/null; then
        log_step "Packaging unload backup..."
        exec_in_pod "cd ${DB_PATH} && tar -czf /tmp/${backup_name}.tar.gz ${unload_dir##*/}/"
        kubectl cp "${NAMESPACE}/${POD_NAME}:/tmp/${backup_name}.tar.gz" "${backup_path}.tar.gz"
        log_ok "Unload backup saved: ${backup_path}.tar.gz"
    else
        log_err "Unload directory not found: ${unload_dir}"
        return 1
    fi

    log_step "Backup size:"
    ls -lh "${backup_path}.tar.gz"

    return 0
}

backup_full() {
    local backup_name="carbonet-fullbackup-${TIMESTAMP}"
    local backup_path="${BACKUP_DIR}/${backup_name}"

    log_step "Creating full backup: ${backup_name}"

    log_step "Stopping CUBRID services for consistent backup..."
    exec_in_pod "source /home/cubrid/.cubrid.sh && \
        cubrid server stop ${DB_NAME} && sleep 2"

    exec_in_pod "mkdir -p ${DB_PATH}/backup_temp && \
        cp -r ${DB_PATH}/${DB_NAME}* ${DB_PATH}/backup_temp/ 2>/dev/null && \
        cp ${DB_PATH}/databases.txt ${DB_PATH}/backup_temp/ 2>/dev/null || true"

    exec_in_pod "cd ${DB_PATH} && tar -czf /tmp/${backup_name}.tar.gz backup_temp/"
    kubectl cp "${NAMESPACE}/${POD_NAME}:/tmp/${backup_name}.tar.gz" "${backup_path}.tar.gz"

    exec_in_pod "rm -rf ${DB_PATH}/backup_temp"

    exec_in_pod "source /home/cubrid/.cubrid.sh && cubrid server start ${DB_NAME}"

    log_ok "Full backup saved: ${backup_path}.tar.gz"
    ls -lh "${backup_path}.tar.gz"
}

backup_quick() {
    local backup_name="carbonet-quickbackup-${TIMESTAMP}"
    local backup_path="${BACKUP_DIR}/${backup_name}"

    log_step "Creating quick backup (live, no lock): ${backup_name}"

    exec_in_pod "cd ${DB_PATH} && tar --exclude='*.lock' --exclude='*.lg*' -czf /tmp/${backup_name}.tar.gz ${DB_NAME}/ 2>/dev/null || \
        tar --exclude='*.lock' -czf /tmp/${backup_name}.tar.gz ${DB_NAME}/"

    kubectl cp "${NAMESPACE}/${POD_NAME}:/tmp/${backup_name}.tar.gz" "${backup_path}.tar.gz"

    log_ok "Quick backup saved: ${backup_path}.tar.gz"
    ls -lh "${backup_path}.tar.gz"
}

list_backups() {
    log_step "Available backups in ${BACKUP_DIR}:"
    ls -lh "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | tail -20 || log_warn "No backups found"
}

case "${1:-quick}" in
    unload)
        ensure_backup_dir
        backup_unload
        ;;
    full)
        ensure_backup_dir
        backup_full
        ;;
    quick)
        ensure_backup_dir
        backup_quick
        ;;
    list)
        list_backups
        ;;
    *)
        echo "Usage: $0 {unload|full|quick|list}"
        echo "  unload - Full schema+data unload (largest, but complete)"
        echo "  full   - Full database copy (consistent)"
        echo "  quick  - Quick backup (may miss recent transactions)"
        echo "  list   - List available backups"
        exit 1
        ;;
esac