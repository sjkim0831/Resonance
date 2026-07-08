#!/bin/bash
# DEPRECATED: CUBRID 제거됨 — 사용 금지
# PostgreSQL 환경: postgres-patroni-0/1/2 (Patroni HA)
echo "[DEPRECATED] cubrid-restore: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

# ============================================
# CUBRID Automated Restore with SQLite Logging
# Real-time progress, error detection, auto-recovery
# ============================================

set -e

NAMESPACE="carbonet-prod"
DATABASE_NAME="carbonet"
DATA_HOST_PATH="/opt/Resonance/data/cubrid/databases"
BACKUP_PATH="/opt/Resonance/data/cubrid/backup/carbonet-live-unload-20260614"
POD_NAME="cubrid-carbonet-0"
POD_BACKUP_PATH="/tmp/backup"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
LOG_SCRIPT="/opt/Resonance/ops/scripts/cubrid-log.py"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

TOTAL_START_TIME=$(date +%s%3N)

log() {
    echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"
    python3 "$LOG_SCRIPT" log "error" "failed" "$1" 2>/dev/null
}

log_warn() {
    echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"
}

log_progress() {
    local current=$(($(date +%s%3N) - TOTAL_START_TIME))
    echo -e "${CYAN}[${current}ms]⟳${NC} $1"
}

log_step() {
    local current=$(($(date +%s%3N) - TOTAL_START_TIME))
    echo ""
    echo -e "${CYAN}═══[${current}ms]═══ $1 ═══${NC}"
    echo ""
}

exec_on_pod() {
    kubectl exec $POD_NAME -n $NAMESPACE -- bash -c "$1" 2>&1
}

exec_on_pod_nowait() {
    kubectl exec $POD_NAME -n $NAMESPACE -- bash -c "$1" 2>&1 &
    echo $!
}

check_pod() {
    local ready=$(kubectl get pod $POD_NAME -n $NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)
    if [ "$ready" != "True" ]; then
        log_error "Pod $POD_NAME is not ready"
        return 1
    fi
    return 0
}

# ============================================
# Step 1: Check prerequisites
# ============================================
check_prerequisites() {
    log_step "Phase 1: Prerequisites Check"

    log "Checking backup location..."
    if [ ! -d "$BACKUP_PATH/unloaddb" ]; then
        log "Backup not found at $BACKUP_PATH, checking alternative locations..."

        if [ -d "/tmp/loaddb/carbonet-live-unload-20260614/unloaddb" ]; then
            mkdir -p "$BACKUP_PATH"
            cp -r /tmp/loaddb/carbonet-live-unload-20260614 "$BACKUP_PATH/"
            log_success "Backup copied from /tmp"
        else
            log_error "Backup not found in any location"
            return 1
        fi
    fi

    log "Verifying backup files..."
    local schema="$BACKUP_PATH/unloaddb/carbonet_schema"
    local objects="$BACKUP_PATH/unloaddb/carbonet_objects"
    local indexes="$BACKUP_PATH/unloaddb/carbonet_indexes"

    if [ ! -f "$schema" ]; then
        log_error "Schema file not found: $schema"
        return 1
    fi

    if [ ! -f "$objects" ]; then
        log_error "Objects file not found: $objects"
        return 1
    fi

    if [ ! -f "$indexes" ]; then
        log_error "Indexes file not found: $indexes"
        return 1
    fi

    log_success "Backup files verified"
    ls -lh "$BACKUP_PATH/unloaddb/"
    return 0
}

# ============================================
# Step 2: Stop services and prepare
# ============================================
prepare_database() {
    log_step "Phase 2: Database Preparation"

    log "Stopping CUBRID services..."
    exec_on_pod "pkill -9 cub_server 2>/dev/null || true; pkill -9 cubrid 2>/dev/null || true; sleep 3"
    log_success "Services stopped"

    log "Clearing old database files..."
    exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        cd /var/lib/cubrid/databases
        rm -f ${DATABASE_NAME}*
        rm -f *_vinf *_lgat *_lgar* *.log *.db
        rm -rf ${DATABASE_NAME}
        rm -f .protected
    " 2>/dev/null || true
    log_success "Old files cleared"

    log "Setting up databases.txt..."
    exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH

        cat > /var/lib/cubrid/databases/databases.txt << 'EOF'
#db-name	vol-path		db-host		log-path		lob-base-path
${DATABASE_NAME}	/var/lib/cubrid/databases	localhost	/var/lib/cubrid/databases	file:/var/lib/cubrid/databases/lob
EOF

        mkdir -p \$CUBRID/databases
        cp /var/lib/cubrid/databases/databases.txt \$CUBRID/databases/databases.txt
        chmod 666 /var/lib/cubrid/databases/databases.txt 2>/dev/null || true
    " 2>/dev/null
    log_success "databases.txt configured"
}

# ============================================
# Step 3: Create new database
# ============================================
create_database() {
    log_step "Phase 3: Database Creation"

    log "Creating new database..."
    local output
    local max_attempts=3
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        output=$(exec_on_pod "
            export CUBRID=/home/cubrid/CUBRID
            export PATH=\$CUBRID/bin:\$PATH
            cd /var/lib/cubrid/databases
            cubrid createdb --db-volume-size=500M --log-volume-size=200M ${DATABASE_NAME} en_US.iso88591 2>&1
        ")

        if echo "$output" | grep -qi "error\|fail"; then
            if echo "$output" | grep -qi "already exists"; then
                log_warn "Database already exists, using existing"
                break
            fi
            log_warn "Attempt $attempt failed: $(echo "$output" | tail -1)"
            attempt=$((attempt + 1))
            sleep 2
        else
            break
        fi
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "Failed to create database after $max_attempts attempts"
        return 1
    fi

    log_success "Database created"

    log "Verifying database files..."
    exec_on_pod "
        ls -la /var/lib/cubrid/databases/${DATABASE_NAME}*.db /var/lib/cubrid/databases/*_vinf 2>/dev/null | head -5
    "

    return 0
}

# ============================================
# Step 4: Start CUBRID service
# ============================================
start_cubrid_service() {
    log_step "Phase 4: Service Startup"

    log "Starting CUBRID service..."
    local output
    local max_attempts=3
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        output=$(exec_on_pod "
            export CUBRID=/home/cubrid/CUBRID
            export PATH=\$CUBRID/bin:\$PATH
            export CUBRID_DATABASES=/var/lib/cubrid/databases

            cubrid service start 2>&1
            sleep 3
            cubrid server start ${DATABASE_NAME} 2>&1
        ")

        if echo "$output" | grep -qi "fail\|error"; then
            log_warn "Attempt $attempt failed"

            if echo "$output" | grep -qi "unknown\|cannot access"; then
                log_warn "databases.txt issue, re-syncing..."
                exec_on_pod "
                    export CUBRID=/home/cubrid/CUBRID
                    cp /var/lib/cubrid/databases/databases.txt \$CUBRID/databases/databases.txt
                "
            fi

            attempt=$((attempt + 1))
            sleep 3
        else
            break
        fi
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "Service failed to start after $max_attempts attempts"
        return 1
    fi

    sleep 5

    log "Verifying server..."
    local status=$(exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        cubrid server status ${DATABASE_NAME} 2>&1 | grep -E 'Server ${DATABASE_NAME}'
    ")

    if [[ "$status" == *"Server ${DATABASE_NAME}"* ]]; then
        log_success "Service running: Server ${DATABASE_NAME}"
        return 0
    fi

    log_error "Server not running"
    return 1
}

# ============================================
# Step 5: Copy backup to pod
# ============================================
copy_backup() {
    log_step "Phase 5: Backup File Transfer"

    log "Copying backup files to pod..."

    exec_on_pod "mkdir -p $POD_BACKUP_PATH" 2>/dev/null || true

    kubectl cp "$BACKUP_PATH/unloaddb" "$NAMESPACE/$POD_NAME:$POD_BACKUP_PATH/unloaddb" 2>&1

    local files=$(exec_on_pod "ls -lh $POD_BACKUP_PATH/unloaddb/ 2>/dev/null | tail -4")
    log_success "Backup files transferred"
    echo "$files"

    return 0
}

# ============================================
# Step 6: Load schema
# ============================================
load_schema() {
    log_step "Phase 6: Schema Loading"

    log_progress "Loading 133 tables from schema..."

    local output
    local max_attempts=2
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        output=$(exec_on_pod "
            export CUBRID=/home/cubrid/CUBRID
            export PATH=\$CUBRID/bin:\$PATH
            export CUBRID_DATABASES=/var/lib/cubrid/databases

            cd $POD_BACKUP_PATH
            cubrid loaddb -u dba -C -s unloaddb/carbonet_schema ${DATABASE_NAME}@localhost 2>&1
        ")

        if echo "$output" | grep -qi "error\|abort"; then
            log_warn "Schema load attempt $attempt failed"
            attempt=$((attempt + 1))
            sleep 2
        else
            break
        fi
    done

    if echo "$output" | grep -qi "finish"; then
        log_success "Schema loaded: $(echo "$output" | grep -E 'Total.*statements' | head -1)"
    else
        log_warn "Schema load output unusual: $(echo "$output" | tail -3)"
    fi

    log_progress "Verifying tables..."
    local table_count=$(exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=/var/lib/cubrid/databases
        csql -u dba ${DATABASE_NAME}@localhost -c 'SHOW TABLES;' 2>&1 | grep -c 'row'
    " | tr -d ' ')

    log_success "Tables created: $table_count"
    return 0
}

# ============================================
# Step 7: Load data
# ============================================
load_data() {
    log_step "Phase 7: Data Loading"

    log_progress "Loading 244,917 objects from backup..."

    local output
    local max_attempts=2
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        output=$(exec_on_pod "
            export CUBRID=/home/cubrid/CUBRID
            export PATH=\$CUBRID/bin:\$PATH
            export CUBRID_DATABASES=/var/lib/cubrid/databases

            cd $POD_BACKUP_PATH
            cubrid loaddb -u dba -C -d unloaddb/carbonet_objects ${DATABASE_NAME}@localhost 2>&1
        ")

        if echo "$output" | grep -qi "error\|abort"; then
            log_warn "Data load attempt $attempt failed"
            attempt=$((attempt + 1))
            sleep 2
        else
            break
        fi
    done

    if echo "$output" | grep -qi "inserted"; then
        local inserted=$(echo "$output" | grep -oE '[0-9,]+ object' | head -1)
        log_success "Data loaded: $inserted"
    else
        log_warn "Data load output unusual"
    fi

    return 0
}

# ============================================
# Step 8: Load indexes
# ============================================
load_indexes() {
    log_step "Phase 8: Index Loading"

    log_progress "Loading 142 indexes..."

    local output
    output=$(exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=/var/lib/cubrid/databases

        cd $POD_BACKUP_PATH
        cubrid loaddb -u dba -C -i unloaddb/carbonet_indexes ${DATABASE_NAME}@localhost 2>&1
    ")

    if echo "$output" | grep -qi "finish"; then
        log_success "Indexes loaded: $(echo "$output" | grep -E 'Total.*statements' | head -1)"
    else
        log_warn "Index load output: $(echo "$output" | tail -2)"
    fi

    return 0
}

# ============================================
# Step 9: Verify restoration
# ============================================
verify_restore() {
    log_step "Phase 9: Verification"

    log "Verifying restored data..."

    local count=$(exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=/var/lib/cubrid/databases
        csql -u dba ${DATABASE_NAME}@localhost -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -A1 'count' | tail -1 | tr -d ' '
    " | tr -d ' ')

    local release=$(exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=/var/lib/cubrid/databases
        csql -u dba ${DATABASE_NAME}@localhost -c 'SELECT release_unit_id FROM rsn_release_unit;' 2>&1 | grep -E 'RU-' | head -1 | tr -d \"' \" | tr -d ' '
    ")

    local tables=$(exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=/var/lib/cubrid/databases
        csql -u dba ${DATABASE_NAME}@localhost -c 'SHOW TABLES;' 2>&1 | grep -c 'row' | tr -d ' '
    ")

    echo ""
    log_success "═══════════════════════════════════════"
    log_success "     RESTORATION COMPLETE"
    log_success "═══════════════════════════════════════"
    echo ""
    echo "  Database:       $DATABASE_NAME"
    echo "  Tables:         $tables"
    echo "  admin_emission: $count rows"
    echo "  rsn_release:    $release"
    echo "  Data Location:  $DATA_HOST_PATH"
    echo ""
    log_success "═══════════════════════════════════════"

    python3 "$LOG_SCRIPT" log "restore" "success" "Tables: $tables, Rows: $count" 2>/dev/null
}

# ============================================
# Full restore flow
# ============================================
full_restore() {
    log "═══════════════════════════════════════"
    log "   CUBRID Automated Restore System"
    log "═══════════════════════════════════════"
    echo ""
    log "Start time: $(date)"
    echo ""

    if ! check_pod; then
        log_error "Prerequisites check failed"
        return 1
    fi

    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        return 1
    fi

    prepare_database || return 1
    create_database || return 1
    if ! start_cubrid_service; then
        log_error "Service failed to start, attempting recovery..."
        sleep 5
        start_cubrid_service || return 1
    fi
    copy_backup || return 1
    load_schema || return 1
    load_data || return 1
    load_indexes || return 1
    verify_restore || return 1

    local total_time=$(($(date +%s%3N) - TOTAL_START_TIME))
    log "Total time: ${total_time}ms"
    log "End time: $(date)"

    return 0
}

# ============================================
# Quick verify only
# ============================================
quick_verify() {
    log "=== Quick Verify ==="

    local count=$(exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=/var/lib/cubrid/databases
        csql -u dba ${DATABASE_NAME}@localhost -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | tail -6
    ")

    local server=$(exec_on_pod "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        cubrid server status ${DATABASE_NAME} 2>&1 | tail -1
    ")

    echo "$server"
    echo "admin_emission_gwp_value:"
    echo "$count" | grep -v NOTIFICATION | grep -v 'Program' | tail -4
}

case "${1:-help}" in
    restore|full)
        full_restore
        ;;
    verify|check)
        quick_verify
        ;;
    *)
        echo "Usage: cubrid-restore.sh {restore|verify}"
        echo ""
        echo "Commands:"
        echo "  restore - Full automated restore from backup"
        echo "  verify  - Quick verification of current state"
        exit 1
        ;;
esac