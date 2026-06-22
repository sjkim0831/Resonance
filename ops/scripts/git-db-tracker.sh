#!/bin/bash
#============================================
# Git DB Tracker v2 - Schema & Data Versioning
# - Track schema changes in Git
# - Save SQL dumps as versioned files
# - Enable rollback to any previous state
# - Full audit trail
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
GIT_REPO="/opt/Resonance/data/db-schema"
SCHEMA_DIR="$GIT_REPO/schema"
DATA_DIR="$GIT_REPO/data"
MIGRATIONS_DIR="$GIT_REPO/migrations"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
CUBRID_BIN="/home/cubrid/CUBRID/bin"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

#============================================
# INIT GIT REPO
#============================================
init_repo() {
    mkdir -p "$SCHEMA_DIR" "$DATA_DIR" "$MIGRATIONS_DIR"
    
    if [ ! -d "$GIT_REPO/.git" ]; then
        git init "$GIT_REPO" 2>/dev/null
        git -C "$GIT_REPO" config user.name "CUBRID DB Tracker"
        git -C "$GIT_REPO" config user.email "db-tracker@carbonet"
        
        cat > "$GIT_REPO/README.md" << 'EOF'
# CUBRID Database Schema & Data Tracker

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
    
    # Export all schema
    run "mkdir -p /tmp/schema_export && cd /tmp/schema_export && \
        $CUBRID_BIN/cubrid unloaddb -u dba -S --schema-only $DB_NAME 2>&1 | tail -5"
    
    # Copy to repo
    kubectl cp "$NAMESPACE/$POD:/tmp/schema_export" "$SCHEMA_DIR/latest" 2>/dev/null
    
    # Save with timestamp
    cat > "$schema_file" << 'EOFSCHEMA'
-- Schema Export: $(date)
-- Database: carbonet

-- TABLES
EOFSCHEMA
    
    run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c \"SELECT cmd FROM db_stored_procedure WHERE sp_type='TABLE' LIMIT 100;\" 2>&1 | grep -v NOTIFICATION | head -50" >> "$schema_file" 2>/dev/null || true
    
    # Get table create statements
    for table in $(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SHOW TABLES;' 2>&1 | grep -v NOTIFICATION | tail -n +4 | head -50"); do
        run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SHOW CREATE TABLE $table;' 2>&1" 2>/dev/null | grep -v NOTIFICATION >> "$schema_file"
        echo "" >> "$schema_file"
    done
    
    # Save metadata
    cat > "$SCHEMA_DIR/${timestamp}.meta.json" << EOF
{
    "timestamp": "$timestamp",
    "date": "$(date -Iseconds)",
    "description": "$desc",
    "tables": $(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SHOW TABLES;' 2>&1 | grep -v NOTIFICATION | tail -n +4 | wc -l"),
    "row_count": $(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' ')
}
EOF
    
    log_ok "Schema exported: $schema_file"
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
    
    # Export key reference tables
    for table in admin_emission_gwp_value; do
        run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT * FROM $table LIMIT 10000;' -o /tmp/${table}.csv 2>&1 | tail -2"
    done
    
    kubectl cp "$NAMESPACE/$POD:/tmp/admin_emission_gwp_value.csv" "$data_file" 2>/dev/null
    
    # Save metadata
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
    
    # Get schema diff
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
    
    # Copy current state
    export_schema "Before commit" >/dev/null 2>&1
    
    # Add all changes
    git -C "$GIT_REPO" add -A
    
    # Commit
    git -C "$GIT_REPO" commit -m "$(date +%Y-%m-%d_%H:%M): $message" 2>/dev/null
    
    local duration=$(($(date +%s) - start))
    
    if [ $? -eq 0 ]; then
        log_ok "Committed: $message (${duration}s)"
        
        # Log to SQLite
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
    
    # Get schema at that commit
    local schema_at_commit=$(git -C "$GIT_REPO" show "$target_commit:schema/" 2>/dev/null | head -20)
    
    if [ -z "$schema_at_commit" ]; then
        log_err "Cannot find schema at commit: $target_commit"
        return 1
    fi
    
    # Restore schema file
    git -C "$GIT_REPO" show "$target_commit:schema/latest" > "$SCHEMA_DIR/restore.sql" 2>/dev/null
    
    # Execute on DB
    log "Applying rollback SQL..."
    run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost -f /tmp/restore.sql --no-auto-commit 2>&1 | tail -5"
    
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
        schema_file="$SCHEMA_DIR/latest/*.sql"
    fi
    
    log "Applying schema from: $schema_file"
    
    # Backup first
    run "mkdir -p /tmp/schema_backup && cp /var/lib/cubrid/databases/${DB_NAME}_schema * /tmp/schema_backup/ 2>/dev/null || true"
    
    # Apply
    run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost -f $schema_file 2>&1 | tail -10"
    
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
