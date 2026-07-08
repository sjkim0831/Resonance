#!/bin/bash
#============================================
# Git DB Tracker v2 - Schema & Data Versioning
# - Track schema changes in Git
# - Save SQL dumps as versioned files
# - Enable rollback to any previous state
# - Full audit trail
# - DEPRECATED: CUBRID removed, use PostgreSQL (postgres-patroni-0)
#============================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
DB_USER="postgres"
DB_PASSWORD="${POSTGRES_PASSWORD:-postgres123}"
DB_PORT="5432"
DB_HOST="localhost"
POD="postgres-patroni-0"
GIT_REPO="/opt/Resonance/data/db-schema"
SCHEMA_DIR="$GIT_REPO/schema"
DATA_DIR="$GIT_REPO/data"
MIGRATIONS_DIR="$GIT_REPO/migrations"
LOG_DB="/opt/Resonance/var/lib/pg_db_operations.db"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }

run() { kubectl exec "$POD" -n "$NAMESPACE" -- \
    PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -c "$1" 2>/dev/null; }

run_file() { kubectl exec "$POD" -n "$NAMESPACE" -- \
    PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -f "$1" 2>/dev/null; }

pg_dump_schema() { kubectl exec "$POD" -n "$NAMESPACE" -- \
    PGPASSWORD="$DB_PASSWORD" pg_dump -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -s 2>/dev/null; }

pg_dump_table() { kubectl exec "$POD" -n "$NAMESPACE" -- \
    PGPASSWORD="$DB_PASSWORD" pg_dump -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -t "$1" --data-only --column-inserts 2>/dev/null; }

#============================================
# INIT GIT REPO
#============================================
init_repo() {
    mkdir -p "$SCHEMA_DIR" "$DATA_DIR" "$MIGRATIONS_DIR"

    if [ ! -d "$GIT_REPO/.git" ]; then
        git init "$GIT_REPO" 2>/dev/null
        git -C "$GIT_REPO" config user.name "PostgreSQL DB Tracker"
        git -C "$GIT_REPO" config user.email "db-tracker@carbonet"

        cat > "$GIT_REPO/README.md" << 'EOF'
# PostgreSQL Database Schema & Data Tracker

## Structure
- `schema/` - Database schema (CREATE TABLE, INDEX, etc.)
- `data/` - Reference data snapshots
- `migrations/` - Migration scripts between versions
- `backups/` - Full backup references

## Usage
```bash
# Save current schema
./git-db-tracker.sh save-schema "Added new emission table"

# Save reference data
./git-db-tracker.sh save-data "Q1 2026 reference data"

# List versions
./git-db-tracker.sh list

# Rollback to version
./git-db-tracker.sh rollback <commit-hash>
```
EOF
    fi
}

#============================================
# EXPORT SCHEMA
#============================================
export_schema() {
    local desc="${1:-schema update}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local schema_file="$SCHEMA_DIR/${timestamp}.sql"

    log "Exporting schema..."

    local tmp_schema="/tmp/schema_export_${timestamp}.sql"

    pg_dump_schema > "$tmp_schema"

    cp "$tmp_schema" "$SCHEMA_DIR/latest.sql"
    cp "$tmp_schema" "$schema_file"

    local table_count
    table_count=$(run "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" 2>/dev/null | grep -v "^==" | grep -v "^$" | grep -v "count" | head -1 | tr -d ' ')

    local row_count
    row_count=$(run "SELECT COALESCE(SUM(n_live_tup),0) FROM pg_stat_user_tables;" 2>/dev/null | grep -v "^==" | grep -v "^$" | grep -v "COALESCE" | head -1 | tr -d ' ')

    cat > "$SCHEMA_DIR/${timestamp}.meta.json" << EOF
{
    "timestamp": "$timestamp",
    "date": "$(date -Iseconds)",
    "description": "$desc",
    "tables": ${table_count:-0},
    "row_count": ${row_count:-0}
}
EOF

    log_ok "Schema exported: $schema_file (tables: ${table_count:-0})"
    echo "$timestamp"
}

#============================================
# EXPORT REFERENCE DATA
#============================================
export_data() {
    local desc="${1:-data snapshot}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local data_file="$DATA_DIR/${timestamp}.csv"

    log "Exporting reference data..."

    local tmp_data="/tmp/data_export_${timestamp}.csv"

    run "\copy (SELECT * FROM admin_emission_gwp_value LIMIT 10000) TO '$tmp_data' WITH (FORMAT CSV, HEADER)" 2>/dev/null || true

    kubectl cp "$NAMESPACE/$POD:$tmp_data" "$data_file" 2>/dev/null || true

    local rows=$(wc -l < "$data_file" 2>/dev/null || echo 0)
    cat > "$DATA_DIR/${timestamp}.meta.json" << EOF
{
    "timestamp": "$timestamp",
    "description": "$desc",
    "file": "$data_file",
    "lines": $rows,
    "date": "$(date -Iseconds)"
}
EOF

    log_ok "Data exported: $data_file ($rows lines)"
}

#============================================
# CREATE MIGRATION
#============================================
create_migration() {
    local from_ver="$1"
    local to_ver="$2"
    local migration_name="${3:-migration}"
    local timestamp=$(date +%Y%m%d_%H%M%S)

    log "Creating migration: $from_ver -> $to_ver"

    local old_schema="$SCHEMA_DIR/${from_ver}.sql"
    local new_schema="$SCHEMA_DIR/${to_ver}.sql"

    cat > "$MIGRATIONS_DIR/${timestamp}_${migration_name}.sql" << EOF
-- Migration: $from_ver -> $to_ver
-- Created: $(date)
-- Description: $migration_name

BEGIN;

-- Add new columns if needed
-- ALTER TABLE ... ADD COLUMN ...;

-- Update data if needed
-- UPDATE ... SET ...;

-- Create new tables
-- CREATE TABLE ...;

COMMIT;
EOF

    log_ok "Migration created: $MIGRATIONS_DIR/${timestamp}_${migration_name}.sql"
}

#============================================
# GIT COMMIT
#============================================
git_commit() {
    local message="$1"
    local start=$(date +%s)

    init_repo

    log "Committing to Git..."

    export_schema "Before commit" >/dev/null 2>&1

    git -C "$GIT_REPO" add -A

    git -C "$GIT_REPO" commit -m "$(date +%Y-%m-%d_%H:%M): $message" 2>/dev/null

    local duration=$(($(date +%s) - start))

    if [ $? -eq 0 ]; then
        log_ok "Committed: $message (${duration}s)"

        python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
conn.execute('INSERT INTO git_tracking(timestamp,commit_message,duration_sec) VALUES(datetime('now'),?,?)',
    ('$message',$duration))
conn.commit()
conn.close()
" 2>/dev/null

        return 0
    else
        log_err "Git commit failed"
        return 1
    fi
}

#============================================
# ROLLBACK
#============================================
rollback() {
    local target_commit="$1"

    if [ -z "$target_commit" ]; then
        echo "Available commits:"
        git -C "$GIT_REPO" log --oneline -10
        return 1
    fi

    log "Rolling back to: $target_commit"

    local schema_at_commit=$(git -C "$GIT_REPO" show "$target_commit:schema/" 2>/dev/null | head -20)

    if [ -z "$schema_at_commit" ]; then
        log_err "Cannot find schema at commit: $target_commit"
        return 1
    fi

    git -C "$GIT_REPO" show "$target_commit:schema/latest.sql" > "$SCHEMA_DIR/restore.sql" 2>/dev/null

    log "Applying rollback SQL..."
    local restore_file="/tmp/restore_$(date +%s).sql"
    kubectl cp "$SCHEMA_DIR/restore.sql" "$NAMESPACE/$POD:$restore_file" 2>/dev/null
    run_file "$restore_file" 2>&1 | tail -5

    log_ok "Rollback complete"
}

#============================================
# LIST VERSIONS
#============================================
list_versions() {
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                    SCHEMA VERSION HISTORY                        ║"
    echo "╠═══════════════════════════════════════════════════════════════════╣"

    for f in $(ls -t "$SCHEMA_DIR"/*.meta.json 2>/dev/null | head -10); do
        local ts=$(basename "$f" .meta.json)
        local desc=$(grep '"description"' "$f" 2>/dev/null | cut -d'"' -f4)
        local tables=$(grep '"tables"' "$f" 2>/dev/null | grep -o '[0-9]*')
        local rows=$(grep '"row_count"' "$f" 2>/dev/null | grep -o '[0-9]*')

        printf "║ %s │ tables:%-4s rows:%-5s │ %s ║\n" "$ts" "${tables:-0}" "${rows:-0}" "${desc:-no description}"
    done

    echo "╚═══════════════════════════════════════════════════════════════════╝"
}

#============================================
# APPLY SCHEMA FROM GIT
#============================================
apply_schema() {
    local schema_file="$1"

    if [ ! -f "$schema_file" ]; then
        schema_file="$SCHEMA_DIR/latest.sql"
    fi

    log "Applying schema from: $schema_file"

    local tmp_apply="/tmp/apply_$(date +%s).sql"
    cp "$schema_file" "$tmp_apply"

    kubectl cp "$tmp_apply" "$NAMESPACE/$POD:$tmp_apply" 2>/dev/null
    run_file "$tmp_apply" 2>&1 | tail -10

    log_ok "Schema applied"
}

#============================================
# ENTRY
#============================================
case "${1:-help}" in
    init) init_repo ;;
    save-schema|export-schema) export_schema "$2" ;;
    save-data|export-data) export_data "$2" ;;
    commit) git_commit "$2" ;;
    migration|create-migration) create_migration "$2" "$3" "$4" ;;
    rollback) rollback "$2" ;;
    list|versions) list_versions ;;
    apply) apply_schema "$2" ;;
    status)
        init_repo
        git -C "$GIT_REPO" status --short
        ;;
    *)
        echo "Usage: $0 {init|save-schema|save-data|commit|migration|rollback|list|apply|status}"
        ;;
esac