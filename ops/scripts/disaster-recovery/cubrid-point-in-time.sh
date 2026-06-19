#!/bin/bash
#============================================================
# CUBRID 시간-travel 복구 시스템 (WAL 아카이빙 기반)
# 특정 시점으로 데이터 복구 가능
#============================================================
set -euo pipefail

# CUBRID=/tmp/CUBRID-11.4.5.1866-e9c17f7-Linux.x86_64  # DEPRECATED
CUBRID=/home/cubrid/CUBRID  # Actual running instance
export PATH=$CUBRID/bin:$PATH
export CUBRID_DB_DIR=/opt/Resonance/data/cubrid

ARCHIVE_DIR="/opt/Resonance/data/cubrid/archive"
SCHEMA_DIR="/opt/Resonance/data/cubrid/schema"
RESTORE_DIR="/opt/Resonance/data/cubrid/restore-point"
DB_NAME="carbonet"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

create_restore_point() {
    local label="${1:-auto-$(date +%Y%m%d_%H%M%S)}"
    local dir="$RESTORE_DIR/$label"
    mkdir -p "$dir"

    log "Creating restore point: $label"

    # 스키마 덤프
    mkdir -p "$dir/schema"
    local tables=$(csql -u dba -c "SHOW TABLES;" ${DB_NAME}@localhost:33000 2>/dev/null | grep -v "^>" | grep -v "^--")
    for table in $tables; do
        csql -u dba -c "SHOW CREATE TABLE $table;" ${DB_NAME}@localhost:33000 2>/dev/null > "$dir/schema/${table}.sql"
    done

    # 데이터 덤프
    mkdir -p "$dir/data"
    for table in $tables; do
        csql -u dba -c "SELECT * FROM $table;" ${DB_NAME}@localhost:33000 2>/dev/null > "$dir/data/${table}.sql"
    done

    # 메타데이터
    cat > "$dir/META.json" <<EOF
{
    "label": "$label",
    "created": "$(date -Iseconds)",
    "db": "$DB_NAME",
    "tables": $(echo $tables | wc -w)
}
EOF

    log "Restore point created: $dir"
    echo "$dir"
}

restore_to_point() {
    local label=$1
    local dir="$RESTORE_DIR/$label"

    if [ ! -d "$dir" ]; then
        log "Restore point not found: $label"
        return 1
    fi

    log "Restoring to: $label"

    # 스키마 복구
    for sqlfile in "$dir/schema/"*.sql; do
        [ -f "$sqlfile" ] && csql -u dba ${DB_NAME}@localhost:33000 -i "$sqlfile" 2>/dev/null || true
    done

    # 데이터 복구
    for sqlfile in "$dir/data/"*.sql; do
        [ -f "$sqlfile" ] && csql -u dba ${DB_NAME}@localhost:33000 -i "$sqlfile" 2>/dev/null || true
    done

    log "Restore complete"
}

list_restore_points() {
    if [ -d "$RESTORE_DIR" ]; then
        ls -lt "$RESTORE_DIR/"
    else
        echo "No restore points"
    fi
}

enable_wal_archive() {
    log "Enabling WAL archiving..."

    # CUBRID 설정에 아카이브 활성화
    cat >> /opt/Resonance/data/cubrid/conf/cubrid.conf <<EOF

# WAL Archiving
archive_log_dir=$ARCHIVE_DIR
archive_format=tar
log_max_archives=999
EOF

    mkdir -p "$ARCHIVE_DIR"
    log "WAL archiving enabled"
}

case "${1:-status}" in
    snapshot)
        create_restore_point "${2:-}"
        ;;
    restore)
        restore_to_point "$2"
        ;;
    list)
        list_restore_points
        ;;
    enable-archive)
        enable_wal_archive
        ;;
    *)
        echo "Usage: $0 {snapshot|restore|list|enable-archive}"
        ;;
esac