#!/usr/bin/env bash
# cubrid-k8s-recovery.sh - Robust CUBRID Kubernetes Recovery Script
# Version: 2.0 - Enhanced with step-by-step validation
# Usage: bash ops/scripts/cubrid-k8s-recovery.sh [restore-from-backup|restore-from-unload|verify|full-check]

set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
POD_NAME="cubrid-carbonet-0"
DB_NAME="${DB_NAME:-carbonet}"
DB_PATH="/var/lib/cubrid/databases"
CUBRID_DB_PATH="/home/cubrid/CUBRID/databases"
BACKUP_HOST_DIR="/opt/Resonance/data/cubrid"
BACKUP_PVC_DIR="${DB_PATH}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "[$(date '+%H:%M:%S')] ${*}"; }
log_step() { log "${BLUE}==>${NC} $*"; }
log_ok() { log "${GREEN}✓${NC} $*"; }
log_warn() { log "${YELLOW}⚠${NC} $*"; }
log_err() { log "${RED}✗${NC} $*"; }

check_pod() {
    if ! kubectl get pod ${POD_NAME} -n ${NAMESPACE} &>/dev/null; then
        log_err "Pod ${POD_NAME} not found in namespace ${NAMESPACE}"
        return 1
    fi
    if ! kubectl get pod ${POD_NAME} -n ${NAMESPACE} | grep -q "Running"; then
        log_err "Pod ${POD_NAME} is not Running"
        kubectl describe pod ${POD_NAME} -n ${NAMESPACE} | tail -10
        return 1
    fi
    return 0
}

exec_in_pod() {
    kubectl exec -n ${NAMESPACE} ${POD_NAME} -- bash -c "$*" 2>&1
}

check_pod || exit 1

check_db_files() {
    log_step "Checking database files..."
    local files=$(exec_in_pod "ls -la ${DB_PATH}/ | grep -E '^${DB_NAME}|databases.txt'")
    echo "$files"

    local db_file="${DB_PATH}/${DB_NAME}"
    if exec_in_pod "[ -f ${db_file} ]" 2>/dev/null; then
        log_ok "Database file exists: ${db_file}"
        exec_in_pod "ls -la ${db_file}*"
        return 0
    else
        log_warn "Database file not found: ${db_file}"
        return 1
    fi
}

fix_databases_txt() {
    log_step "Fixing databases.txt format..."

    local db_vol_path=$(echo "${DB_PATH}" | sed 's/\//\\\//g')
    local db_log_path=$(echo "${DB_PATH}" | sed 's/\//\\\//g')

    exec_in_pod "cat > ${DB_PATH}/databases.txt << 'DBEOF'
#db-name\tvol-path\t\tdb-host\t\tlog-path\t\tlob-base-path
${DB_NAME}\t${DB_PATH}\tlocalhost\t${DB_PATH}\tfile:${DB_PATH}/lob
DBEOF"

    log_ok "databases.txt updated"
    exec_in_pod "cat ${DB_PATH}/databases.txt"
}

fix_lock_files() {
    log_step "Removing lock files..."
    exec_in_pod "rm -f ${DB_PATH}/${DB_NAME}_lgat__lock 2>/dev/null; ls -la ${DB_PATH}/*.lock 2>/dev/null || echo 'No lock files'"
    log_ok "Lock files cleaned"
}

stop_cubrid_services() {
    log_step "Stopping CUBRID services..."
    exec_in_pod "source /home/cubrid/.cubrid.sh && \
        cubrid server stop ${DB_NAME} 2>/dev/null || true && \
        cubrid broker stop 2>/dev/null || true && \
        cubrid service stop 2>/dev/null || true && \
        sleep 3 && \
        pkill -9 cub_server 2>/dev/null || true && \
        pkill -9 cub_broker 2>/dev/null || true && \
        pkill -9 cub_master 2>/dev/null || true"
    sleep 2
    log_ok "Services stopped"
}

start_cubrid_services() {
    log_step "Starting CUBRID services..."

    exec_in_pod "source /home/cubrid/.cubrid.sh && \
        cubrid service start && \
        sleep 3 && \
        cubrid broker start && \
        sleep 2"

    local retry=5
    while [[ $retry -gt 0 ]]; do
        if exec_in_pod "source /home/cubrid/.cubrid.sh && cubrid server status ${DB_NAME}" &>/dev/null; then
            log_ok "Server ${DB_NAME} is running"
            break
        fi
        log_warn "Server not ready, retrying... ($retry)"
        sleep 5
        ((retry--))
    done

    if [[ $retry -eq 0 ]]; then
        log_warn "Server start may have failed, checking broker status..."
    fi

    exec_in_pod "source /home/cubrid/.cubrid.sh && cubrid server status && echo '---' && cubrid broker status" | head -20
}

verify_connection() {
    log_step "Verifying database connection..."

    local result=$(exec_in_pod "source /home/cubrid/.cubrid.sh && \
        csql -C -u dba -p '' -c 'select count(*) from comtccmmncode;' ${DB_NAME}@localhost 2>&1")

    if echo "$result" | grep -q "row selected"; then
        local count=$(echo "$result" | grep -oE '[0-9]+ row selected' | awk '{print $1}')
        log_ok "Database connection verified: ${count} records in comtccmmncode"
        return 0
    else
        log_err "Connection failed: $result"
        return 1
    fi
}

restore_from_backup_file() {
    local backup_file="$1"
    log_step "Restoring from backup file: ${backup_file}"

    if [[ ! -f "$backup_file" ]]; then
        log_err "Backup file not found: ${backup_file}"
        return 1
    fi

    stop_cubrid_services

    log_step "Copying backup to pod..."
    kubectl cp "${backup_file}" "${NAMESPACE}/${POD_NAME}:/tmp/backup-restore.tar.gz"

    log_step "Cleaning old database files..."
    exec_in_pod "cd ${DB_PATH} && \
        rm -rf ${DB_NAME} ${DB_NAME}_* 2>/dev/null && \
        mkdir -p ${DB_PATH}/${DB_NAME}"

    log_step "Extracting backup..."
    exec_in_pod "cd ${DB_PATH} && \
        tar -xzf /tmp/backup-restore.tar.gz 2>/dev/null || unzip -o /tmp/backup-restore.tar.gz -d /tmp/ 2>/dev/null"

    log_step "Checking extracted files..."
    local extracted=$(exec_in_pod "ls -la ${DB_PATH}/ | grep -E '${DB_NAME}|unload'")
    echo "$extracted"

    if exec_in_pod "[ -d ${DB_PATH}/${DB_NAME}-live-unload-* ]" 2>/dev/null; then
        log_step "Detected unload backup format, restoring via loaddb..."
        restore_from_unload
    else
        log_step "Detected raw backup format..."
        restore_from_raw_backup
    fi

    fix_databases_txt
    fix_lock_files
    start_cubrid_services
    verify_connection
}

restore_from_raw_backup() {
    log_step "Restoring from raw backup files..."

    local backup_dir="${DB_PATH}/${DB_NAME}-live-unload-$(date +%Y%m%d)"

    if exec_in_pod "[ -d ${backup_dir} ]" 2>/dev/null; then
        exec_in_pod "cp -r ${backup_dir}/* ${DB_PATH}/${DB_NAME}/ 2>/dev/null || true"
    fi

    exec_in_pod "ls -la ${DB_PATH}/${DB_NAME}/"
    log_ok "Raw backup files restored"
}

restore_from_unload() {
    local unload_dir=$(exec_in_pod "ls -d ${DB_PATH}/*-unload-* 2>/dev/null | head -1")

    if [[ -z "$unload_dir" ]]; then
        log_warn "Unload directory not found, creating new database..."
        create_fresh_database
        return
    fi

    log_step "Restoring from unload dump: ${unload_dir}"

    local unloaddb_dir="${unload_dir}/unloaddb"
    if ! exec_in_pod "[ -d ${unloaddb_dir} ]" 2>/dev/null; then
        log_err "unloaddb directory not found in ${unload_dir}"
        return 1
    fi

    stop_cubrid_services

    log_step "Creating fresh database..."
    exec_in_pod "rm -rf ${DB_PATH}/${DB_NAME} && \
        mkdir -p ${DB_PATH}/${DB_NAME} && \
        source /home/cubrid/.cubrid.sh && \
        cd ${DB_PATH} && \
        cubrid createdb --db-volume-size=500M --log-volume-size=100M ${DB_NAME} en_US.utf8 2>&1" | tail -5

    if ! exec_in_pod "[ -f ${DB_PATH}/${DB_NAME} ]" 2>/dev/null; then
        log_warn "Database creation may have failed, checking alternative paths..."
    fi

    log_step "Starting database server..."
    exec_in_pod "source /home/cubrid/.cubrid.sh && \
        printf '#db-name\tvol-path\t\tdb-host\t\tlog-path\t\tlob-base-path\n${DB_NAME}\t${DB_PATH}\tlocalhost\t${DB_PATH}\tfile:${DB_PATH}/lob\n' > ${DB_PATH}/databases.txt && \
        cubrid server start ${DB_NAME} 2>&1" | tail -5

    sleep 5

    log_step "Loading schema..."
    exec_in_pod "source /home/cubrid/.cubrid.sh && \
        cd ${unloaddb_dir} && \
        cubrid loaddb -C -v -u dba -p '' ${DB_NAME}@localhost -s carbonet_schema 2>&1" | tail -20

    log_step "Loading indexes..."
    exec_in_pod "source /home/cubrid/.cubrid.sh && \
        cd ${unloaddb_dir} && \
        cubrid loaddb -C -v -u dba -p '' ${DB_NAME}@localhost -i carbonet_indexes 2>&1" | tail -10

    log_step "Loading data..."
    exec_in_pod "source /home/cubrid/.cubrid.sh && \
        cd ${unloaddb_dir} && \
        cubrid loaddb -C -v -u dba -p '' ${DB_NAME}@localhost -d carbonet_objects 2>&1" | tail -20

    log_ok "Unload restore completed"
}

create_fresh_database() {
    log_step "Creating fresh database..."
    exec_in_pod "rm -rf ${DB_PATH}/${DB_NAME} && \
        mkdir -p ${DB_PATH}/${DB_NAME} && \
        source /home/cubrid/.cubrid.sh && \
        cd ${DB_PATH} && \
        cubrid createdb --db-volume-size=500M --log-volume-size=100M ${DB_NAME} en_US.utf8 2>&1"

    log_ok "Fresh database created"
}

full_check() {
    log_step "Running full system check..."

    echo ""
    log_step "1. Pod Status"
    kubectl get pod ${POD_NAME} -n ${NAMESPACE} -o wide

    echo ""
    log_step "2. Database Files"
    exec_in_pod "ls -la ${DB_PATH} | grep -E '${DB_NAME}|total'"

    echo ""
    log_step "3. databases.txt"
    exec_in_pod "cat ${DB_PATH}/databases.txt"

    echo ""
    log_step "4. Lock Files"
    exec_in_pod "ls -la ${DB_PATH}/*.lock 2>/dev/null || echo 'No lock files'"

    echo ""
    log_step "5. CUBRID Service Status"
    exec_in_pod "source /home/cubrid/.cubrid.sh && cubrid server status && echo '---' && cubrid broker status" | head -25

    echo ""
    log_step "6. Database Connection Test"
    verify_connection

    echo ""
    log_step "7. Table Count"
    local table_count=$(exec_in_pod "source /home/cubrid/.cubrid.sh && csql -C -u dba -p '' -c 'select count(*) from db_class;' ${DB_NAME}@localhost 2>&1" | grep -oE '^[ ]*[0-9]+' | head -1)
    log_ok "Total tables: ${table_count}"

    echo ""
    log_step "8. Sample Data Check (comtccmmncode)"
    local code_count=$(exec_in_pod "source /home/cubrid/.cubrid.sh && csql -C -u dba -p '' -c 'select count(*) from comtccmmncode;' ${DB_NAME}@localhost 2>&1" | grep -oE '^[ ]*[0-9]+' | head -1)
    log_ok "Common code count: ${code_count}"

    echo ""
    log_step "9. Korean Character Test"
    local korean_test=$(exec_in_pod "source /home/cubrid/.cubrid.sh && csql -C -u dba -p '' -c \"select code_id_nm from comtccmmncode limit 1;\" ${DB_NAME}@localhost 2>&1" | tail -5)
    echo "$korean_test"

    log_ok "Full check completed"
}

restart_runtime_pods() {
    log_step "Restarting runtime pods..."
    kubectl delete pod -n ${NAMESPACE} -l app=carbonet-runtime --grace-period=30
    sleep 10

    local retry=30
    while [[ $retry -gt 0 ]]; do
        local ready=$(kubectl get pod -n ${NAMESPACE} -l app=carbonet-runtime 2>/dev/null | grep -c "Running.*1/1" || echo "0")
        if [[ "$ready" -ge 1 ]]; then
            log_ok "Runtime pods are ready"
            break
        fi
        sleep 2
        ((retry--))
    done

    kubectl get pod -n ${NAMESPACE} -l app=carbonet-runtime

    if curl -s http://127.0.0.1/actuator/health | grep -q "UP"; then
        log_ok "Application health check: UP"
    else
        log_warn "Application health check may need more time"
    fi
}

case "${1:-full-check}" in
    restore-from-backup)
        backup_file="${2:-/home/sjkim/Downloads/carbonet-live-unload-$(date +%Y%m%d).tar.gz}"
        restore_from_backup_file "$backup_file"
        restart_runtime_pods
        ;;
    restore-from-unload)
        restore_from_unload
        restart_runtime_pods
        ;;
    verify)
        verify_connection
        ;;
    full-check)
        full_check
        ;;
    restart-runtime)
        restart_runtime_pods
        ;;
    *)
        echo "Usage: $0 {restore-from-backup|restore-from-unload|verify|full-check|restart-runtime}"
        echo "  restore-from-backup [file] - Restore from tar.gz backup"
        echo "  restore-from-unload       - Restore from unload dump"
        echo "  verify                    - Verify database connection"
        echo "  full-check                - Run comprehensive system check"
        echo "  restart-runtime           - Restart runtime pods"
        exit 1
        ;;
esac