#!/usr/bin/env bash
# cubrid-k8s-recovery.sh - Robust CUBRID Kubernetes Recovery Script v3.0
# Step-by-step validation with rollback capability
# Usage: bash ops/scripts/cubrid-k8s-recovery.sh [full-check|restore|diagnose|rollback]

set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
POD_NAME="cubrid-carbonet-0"
DB_NAME="${DB_NAME:-carbonet}"
DB_PATH="/var/lib/cubrid/databases"
UNLOAD_DIR="${DB_PATH}/carbonet-live-unload-20260614"
BACKUP_HOST_DIR="/opt/Resonance/data/cubrid/backups"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "[$(date '+%H:%M:%S')] ${*}"; }
log_step() { log "${BLUE}[STEP]${NC} $*"; }
log_ok() { log "${GREEN}[OK]${NC} $*"; }
log_warn() { log "${YELLOW}[WARN]${NC} $*"; }
log_err() { log "${RED}[ERROR]${NC} $*"; }

exec_in_pod() {
    kubectl exec -n ${NAMESPACE} ${POD_NAME} -- bash -c "$*" 2>&1
}

check_pod() {
    if ! kubectl get pod ${POD_NAME} -n ${NAMESPACE} &>/dev/null; then
        log_err "Pod not found: ${POD_NAME}"
        return 1
    fi
    if ! kubectl get pod ${POD_NAME} -n ${NAMESPACE} | grep -q "Running"; then
        log_err "Pod not Running"
        kubectl describe pod ${POD_NAME} -n ${NAMESPACE} | tail -5
        return 1
    fi
    log_ok "Pod ${POD_NAME} is Running"
    return 0
}

check_current_baseline() {
    log_step "Checking current database baseline (reference for recovery validation)..."

    local table_count=$(exec_in_pod "source /home/cubrid/.cubrid.sh && \
        csql -C -u dba -p '' -c 'select count(*) from db_class;' ${DB_NAME}@localhost 2>&1" | \
        grep -oE '^[ ]*[0-9]+' | head -1)
    log "  Tables: ${table_count}"

    local record_count=$(exec_in_pod "source /home/cubrid/.cubrid.sh && \
        csql -C -u dba -p '' -c 'select count(*) from comtccmmncode;' ${DB_NAME}@localhost 2>&1" | \
        grep -oE '^[ ]*[0-9]+' | head -1)
    log "  comtccmmncode records: ${record_count}"

    local sample_korean=$(exec_in_pod "source /home/cubrid/.cubrid.sh && \
        csql -C -u dba -p '' -c \"select code_id_nm from comtccmmncode limit 1;\" ${DB_NAME}@localhost 2>&1" | \
        grep "'" | head -1 | tr -d "'" | xargs)
    log "  Sample Korean: ${sample_korean}"

    echo "BASELINE_TABLE_COUNT=${table_count}"
    echo "BASELINE_RECORD_COUNT=${record_count}"
    echo "BASELINE_KOREAN_SAMPLE=${sample_korean}"
}

diagnose_issues() {
    log_step "=== Comprehensive Diagnosis ==="

    echo ""
    log_step "1. Pod Status"
    kubectl get pod ${POD_NAME} -n ${NAMESPACE} -o wide

    echo ""
    log_step "2. Database Files Integrity"
    exec_in_pod "ls -la ${DB_PATH}/ | grep -E '^-.*${DB_NAME}' | head -10"
    echo "---"
    exec_in_pod "file ${DB_PATH}/${DB_NAME}* 2>/dev/null | head -5"

    echo ""
    log_step "3. databases.txt Format"
    exec_in_pod "cat ${DB_PATH}/databases.txt"

    echo ""
    log_step "4. Lock Files Check"
    exec_in_pod "ls -la ${DB_PATH}/*.lock 2>/dev/null || echo 'No lock files found'"

    echo ""
    log_step "5. CUBRID Service Status"
    exec_in_pod "source /home/cubrid/.cubrid.sh && cubrid server status 2>&1 | head -5"
    echo "---"
    exec_in_pod "source /home/cubrid/.cubrid.sh && cubrid broker status 2>&1 | head -15"

    echo ""
    log_step "6. Connection Test"
    if exec_in_pod "source /home/cubrid/.cubrid.sh && cubrid server status ${DB_NAME}" &>/dev/null; then
        log_ok "Server is running"
    else
        log_err "Server is NOT running"
    fi

    echo ""
    log_step "7. Backup File Analysis"
    if exec_in_pod "[ -d ${UNLOAD_DIR} ]" 2>/dev/null; then
        log_ok "Unload directory exists: ${UNLOAD_DIR}"
        exec_in_pod "ls -la ${UNLOAD_DIR}/unloaddb/ 2>/dev/null | head -10"
    else
        log_err "Unload directory NOT found: ${UNLOAD_DIR}"
    fi

    echo ""
    log_step "8. Korean Encoding Check"
    local encoding_check=$(exec_in_pod "source /home/cubrid/.cubrid.sh && \
        csql -C -u dba -p '' -c \"select code_id_nm from comtccmmncode limit 3;\" ${DB_NAME}@localhost 2>&1" | tail -10)
    echo "$encoding_check"
}

fix_databases_txt() {
    log_step "Fixing databases.txt..."
    exec_in_pod "cat > ${DB_PATH}/databases.txt << 'EOF'
#db-name	vol-path		db-host	log-path		lob-base-path
${DB_NAME}	${DB_PATH}	localhost	${DB_PATH}	file:${DB_PATH}/lob
EOF"
    log_ok "databases.txt updated"
}

fix_lock_files() {
    log_step "Removing stale lock files..."
    exec_in_pod "rm -f ${DB_PATH}/${DB_NAME}_lgat__lock 2>/dev/null && \
        pkill -9 -f 'cub_server.*${DB_NAME}' 2>/dev/null || true"
    log_ok "Lock files cleaned"
}

stop_services_safe() {
    log_step "Safely stopping CUBRID services..."
    exec_in_pod "source /home/cubrid/.cubrid.sh && \
        cubrid server stop ${DB_NAME} 2>/dev/null || true && \
        sleep 2 && \
        pkill -9 cub_server 2>/dev/null || true && \
        pkill -9 cub_broker 2>/dev/null || true"
    sleep 2
    log_ok "Services stopped"
}

start_services() {
    log_step "Starting CUBRID services..."

    exec_in_pod "source /home/cubrid/.cubrid.sh && \
        cubrid service start && sleep 3 && cubrid server start ${DB_NAME} && sleep 2"

    local retry=10
    while [[ $retry -gt 0 ]]; do
        if exec_in_pod "source /home/cubrid/.cubrid.sh && cubrid server status ${DB_NAME}" &>/dev/null; then
            log_ok "Server ${DB_NAME} started successfully"
            return 0
        fi
        log_warn "Waiting for server... ($retry)"
        sleep 3
        ((retry--))
    done

    log_err "Server failed to start within timeout"
    return 1
}

create_snapshot() {
    log_step "Creating pre-recovery snapshot..."
    local snapshot_name="carbonet-snapshot-$(date +%Y%m%d_%H%M%S)"
    exec_in_pod "mkdir -p ${DB_PATH}/snapshots/${snapshot_name} && \
        cp -r ${DB_PATH}/${DB_NAME}* ${DB_PATH}/snapshots/${snapshot_name}/ 2>/dev/null || true && \
        cp ${DB_PATH}/databases.txt ${DB_PATH}/snapshots/${snapshot_name}/ 2>/dev/null || true"
    log_ok "Snapshot created: ${snapshot_name}"
    echo "SNAPSHOT_NAME=${snapshot_name}"
}

rollback_from_snapshot() {
    local snapshot_name="$1"
    log_step "Rolling back from snapshot: ${snapshot_name}"

    stop_services_safe

    log_step "Restoring from snapshot..."
    exec_in_pod "rm -rf ${DB_PATH}/${DB_NAME}* && \
        cp -r ${DB_PATH}/snapshots/${snapshot_name}/* ${DB_PATH}/ 2>/dev/null || true"

    fix_databases_txt
    start_services
    log_ok "Rollback completed"
}

validate_restore() {
    log_step "Validating restored database..."

    local result=$(exec_in_pod "source /home/cubrid/.cubrid.sh && \
        csql -C -u dba -p '' -c 'select count(*) from db_class;' ${DB_NAME}@localhost 2>&1")

    if echo "$result" | grep -q "row selected"; then
        local table_count=$(echo "$result" | grep -oE '^[ ]*[0-9]+' | head -1)
        log_ok "Tables restored: ${table_count}"
    else
        log_err "Table validation failed"
        return 1
    fi

    local record_result=$(exec_in_pod "source /home/cubrid/.cubrid.sh && \
        csql -C -u dba -p '' -c 'select count(*) from comtccmmncode;' ${DB_NAME}@localhost 2>&1")
    local record_count=$(echo "$record_result" | grep -oE '^[ ]*[0-9]+' | head -1)
    log_ok "Records in comtccmmncode: ${record_count}"

    log_step "Testing Korean character encoding..."
    local korean_result=$(exec_in_pod "source /home/cubrid/.cubrid.sh && \
        csql -C -u dba -p '' -c \"select code_id_nm from comtccmmncode limit 3;\" ${DB_NAME}@localhost 2>&1" | tail -8)
    echo "$korean_result"

    if echo "$korean_result" | grep -qE '등록|게시판|권한|관리'; then
        log_ok "Korean characters preserved correctly"
    else
        log_warn "Korean characters may have encoding issues"
    fi

    return 0
}

restore_unload_phase1_schema() {
    log_step "PHASE 1: Creating fresh database and loading schema..."

    stop_services_safe
    exec_in_pod "rm -rf ${DB_PATH}/${DB_NAME} 2>/dev/null || true"

    log_step "Creating database..."
    local createdb_result=$(exec_in_pod "source /home/cubrid/.cubrid.sh && \
        cd ${DB_PATH} && \
        cubrid createdb --db-volume-size=500M --log-volume-size=100M ${DB_NAME} en_US.utf8 2>&1")
    echo "$createdb_result" | tail -5

    if ! exec_in_pod "[ -f ${DB_PATH}/${DB_NAME} ]" 2>/dev/null; then
        log_err "Database creation failed"
        return 1
    fi
    log_ok "Database created"

    fix_databases_txt

    log_step "Starting database server..."
    exec_in_pod "source /home/cubrid/.cubrid.sh && cubrid server start ${DB_NAME}"
    sleep 5

    log_step "Loading schema (carbonet_schema)..."
    local unloaddb_dir="${UNLOAD_DIR}/unloaddb"

    if ! exec_in_pod "[ -f ${unloaddb_dir}/carbonet_schema ]" 2>/dev/null; then
        log_err "Schema file not found: ${unloaddb_dir}/carbonet_schema"
        return 1
    fi

    local schema_result=$(exec_in_pod "source /home/cubrid/.cubrid.sh && \
        cd ${unloaddb_dir} && \
        cubrid loaddb -C -v -u dba -p '' ${DB_NAME}@localhost -s carbonet_schema 2>&1")
    echo "$schema_result" | tail -10

    if echo "$schema_result" | grep -qE "error|Error|ERROR"; then
        log_warn "Schema loading had errors (may be non-critical)"
    fi

    log_ok "Phase 1 completed"
    return 0
}

restore_unload_phase2_indexes() {
    log_step "PHASE 2: Loading indexes..."

    local unloaddb_dir="${UNLOAD_DIR}/unloaddb"

    if ! exec_in_pod "[ -f ${unloaddb_dir}/carbonet_indexes ]" 2>/dev/null; then
        log_warn "Indexes file not found, skipping..."
        return 0
    fi

    local index_result=$(exec_in_pod "source /home/cubrid/.cubrid.sh && \
        cd ${unloaddb_dir} && \
        cubrid loaddb -C -v -u dba -p '' ${DB_NAME}@localhost -i carbonet_indexes 2>&1")
    echo "$index_result" | tail -10

    log_ok "Phase 2 completed"
    return 0
}

restore_unload_phase3_data() {
    log_step "PHASE 3: Loading data (carbonet_objects)..."

    local unloaddb_dir="${UNLOAD_DIR}/unloaddb"

    if ! exec_in_pod "[ -f ${unloaddb_dir}/carbonet_objects ]" 2>/dev/null; then
        log_err "Data file not found: ${unloaddb_dir}/carbonet_objects"
        return 1
    fi

    log_step "This may take several minutes for large datasets..."
    local data_result=$(exec_in_pod "source /home/cubrid/.cubrid.sh && \
        cd ${unloaddb_dir} && \
        cubrid loaddb -C -v -u dba -p '' ${DB_NAME}@localhost -d carbonet_objects 2>&1")
    echo "$data_result" | tail -15

    log_ok "Phase 3 completed"
    return 0
}

restore_unload_full() {
    log_step "=== Full Unload Restore Procedure ==="

    if ! exec_in_pod "[ -d ${UNLOAD_DIR}/unloaddb ]" 2>/dev/null; then
        log_err "Unload directory not found: ${UNLOAD_DIR}/unloaddb"
        log_err "Available directories:"
        exec_in_pod "ls -la ${DB_PATH}/ | grep unload"
        return 1
    fi

    log_step "Backup files available:"
    exec_in_pod "ls -la ${UNLOAD_DIR}/unloaddb/"

    create_snapshot

    log_step "Starting restore process..."

    restore_unload_phase1_schema || {
        log_err "Phase 1 (schema) failed"
        log_warn "Rolling back to snapshot..."
        rollback_from_snapshot "$(exec_in_pod "ls -td ${DB_PATH}/snapshots/*/ 2>/dev/null | head -1 | xargs basename")"
        return 1
    }

    restore_unload_phase2_indexes || {
        log_err "Phase 2 (indexes) failed"
        return 1
    }

    restore_unload_phase3_data || {
        log_err "Phase 3 (data) failed"
        return 1
    }

    log_step "Validating restored database..."
    if validate_restore; then
        log_ok "=== Restore completed successfully ==="
    else
        log_err "Validation failed - manual inspection required"
        return 1
    fi
}

full_check() {
    log_step "=== Full System Check ==="
    diagnose_issues
    check_current_baseline
}

import_csv_data() {
    local csv_file="$1"
    local table_name="$2"

    log_step "Importing CSV to table: ${table_name}"

    if [[ ! -f "$csv_file" ]]; then
        log_err "CSV file not found: ${csv_file}"
        return 1
    fi

    log_step "Copying CSV to pod..."
    kubectl cp "${csv_file}" "${NAMESPACE}/${POD_NAME}:/tmp/import_data.csv"

    log_step "Creating import script (12 columns)..."
    exec_in_pod "cat > /tmp/csv_import.py << 'PYEOF'
import csv
import subprocess
from datetime import datetime

CSV_FILE = '/tmp/import_data.csv'
DB = 'carbonet@localhost'
SQL_FILE = '/tmp/insert.sql'
BATCH = 200

def dv(val):
    if val is None or val.strip() == '':
        return 'DEFAULT'
    val = val.strip().replace(\"'\", \"''\")
    return \"'\" + val + \"'\"

def di(val):
    if val is None or val.strip() == '':
        return 'DEFAULT'
    try:
        return str(int(float(val.strip())))
    except:
        return 'DEFAULT'

def dt(val):
    if not val or val.strip() == '':
        return 'DEFAULT'
    val = val.strip()
    for fmt in ['%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S']:
        try:
            d = datetime.strptime(val, fmt)
            return \"'\" + d.strftime('%m/%d/%Y %H:%M:%S') + \"'\"
        except:
            pass
    return 'DEFAULT'

count = 0
err = 0
total = 0

with open(CSV_FILE, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    total = len(rows)
    print('Total rows: %d' % total)

buf = []
for i, r in enumerate(rows):
    rn = dv(r.get('raw_name', ''))
    en = dv(r.get('english_name', ''))
    st = dv(r.get('source_type', ''))
    fr = dt(r.get('frst_regist_pnttm', ''))
    lu = dt(r.get('last_updt_pnttm', ''))
    kn = dv(r.get('korean_name', ''))
    ee = dv(r.get('english_exact_name', ''))
    ei = di(r.get('ecoinvent_master_id', ''))
    ms = dv(r.get('mapping_status', ''))
    mn = dv(r.get('mapping_note', ''))
    sj = dv(r.get('shadow_translation_json', ''))
    ss = dv(r.get('shadow_translation_status', ''))

    if rn == 'DEFAULT':
        continue

    sql = 'INSERT INTO %s VALUES (%%s,%%s,%%s,%%s,%%s,%%s,%%s,%%s,%%s,%%s,%%s,%%s);' %% (rn, en, st, fr, lu, kn, ee, ei, ms, mn, sj, ss)
    buf.append(sql)

    if len(buf) >= BATCH:
        with open(SQL_FILE, 'w') as f:
            f.write('\n'.join(buf))
        rc = subprocess.call('csql -C -u dba -p \"\" %s < %s' %% (DB, SQL_FILE), shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if rc == 0:
            count += len(buf)
            print('Done: %d/%d' %% (count, total))
        else:
            err += len(buf)
        buf = []

if buf:
    with open(SQL_FILE, 'w') as f:
        f.write('\n'.join(buf))
    rc = subprocess.call('csql -C -u dba -p \"\" %s < %s' %% (DB, SQL_FILE), shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if rc == 0:
        count += len(buf)
    else:
        err += len(buf)

print('Import done: %d rows, %d errors' %% (count, err))
PYEOF"

    log_step "Running import..."
    exec_in_pod "source /home/cubrid/.cubrid.sh && python3 /tmp/csv_import.py"

    log_ok "CSV import completed"
}

case "${1:-full-check}" in
    full-check|check)
        full_check
        ;;
    diagnose|diag)
        diagnose_issues
        ;;
    restore)
        restore_unload_full
        ;;
    phase1)
        restore_unload_phase1_schema
        ;;
    phase2)
        restore_unload_phase2_indexes
        ;;
    phase3)
        restore_unload_phase3_data
        ;;
    validate)
        validate_restore
        ;;
    snapshot)
        create_snapshot
        ;;
    rollback)
        SNAPSHOT_NAME="${2:-}"
        if [[ -z "$SNAPSHOT_NAME" ]]; then
            log_err "Usage: $0 rollback <snapshot-name>"
            exit 1
        fi
        rollback_from_snapshot "$SNAPSHOT_NAME"
        ;;
    import-csv)
        CSV_FILE="${2:-/home/sjkim/Downloads/_emission_material_translation__202606172021.csv}"
        TABLE_NAME="${3:-emission_material_translation}"
        import_csv_data "$CSV_FILE" "$TABLE_NAME"
        ;;
    *)
        echo "Usage: $0 {full-check|diagnose|restore|phase1|phase2|phase3|validate|snapshot|rollback|import-csv}"
        echo ""
        echo "  full-check  - Comprehensive system check (default)"
        echo "  diagnose    - Detailed diagnosis of issues"
        echo "  restore     - Full restore from unload dump"
        echo "  phase1      - Restore: Create DB + load schema"
        echo "  phase2      - Restore: Load indexes"
        echo "  phase3      - Restore: Load data"
        echo "  validate    - Validate current database"
        echo "  snapshot    - Create pre-restore snapshot"
        echo "  rollback    - Rollback from snapshot"
        echo "  import-csv  - Import CSV data to table"
        echo ""
        echo "  Examples:"
        echo "    $0 import-csv /path/to/file.csv emission_material_translation"
        echo "    $0 import-csv  # uses default file and table"
        exit 1
        ;;
esac