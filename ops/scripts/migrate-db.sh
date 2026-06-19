#!/usr/bin/env bash
set -euo pipefail

# GitOps Database Migration Script
# Applies versioned SQL migrations from db/migrations/
# Works with CUBRID using csql

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/db/migrations"
HISTORY_TABLE="db_migration_history"

CSQL_BIN="${CSQL_BIN:-csql}"
DB_NAME="${DB_NAME:-carbonet}"
DB_HOST="${CUBRID_HOST:-localhost}"
DB_PORT="${CUBRID_PORT:-33000}"

log_info() { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] [INFO] $*"; }
log_error() { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] [ERROR] $*" >&2; }

# Ensure history table exists
ensure_history_table() {
    $CSQL_BIN -u dba "$DB_NAME" 2>/dev/null << 'EOF'
CREATE TABLE IF NOT EXISTS db_migration_history (
    version VARCHAR(50) NOT NULL PRIMARY KEY,
    description VARCHAR(255),
    type VARCHAR(20) NOT NULL DEFAULT 'SQL',
    script VARCHAR(500) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    executed_by VARCHAR(100),
    executed_at DATETIME DEFAULT CURRENT_DATETIME,
    success INTEGER DEFAULT 0,
    error_message VARCHAR(2000)
);
EOF
    log_info "History table ensured"
}

# Get current version
get_current_version() {
    local version
    version=$($CSQL_BIN -u dba "$DB_NAME" 2>/dev/null << 'EOF'
SELECT COALESCE(MAX(version), '0') FROM db_migration_history WHERE success = 1;
EOF
    )
    echo "$version" | grep -v "^==" | grep -v "^$" | head -1 | tr -d ' '
}

# Check if migration already applied
is_applied() {
    local version="$1"
    local count
    count=$($CSQL_BIN -u dba "$DB_NAME" 2>/dev/null << EOF
SELECT COUNT(*) FROM db_migration_history WHERE version = '$version' AND success = 1;
EOF
    )
    echo "$count" | grep -v "^==" | grep -v "^$" | head -1 | tr -d ' '
}

# Record migration start
record_start() {
    local version="$1"
    local script="$2"
    local checksum="$3"
    $CSQL_BIN -u dba "$DB_NAME" 2>/dev/null << EOF
INSERT INTO db_migration_history (version, script, checksum, executed_by, executed_at, success)
VALUES ('$version', '$script', '$checksum', '${USER:-unknown}', CURRENT_DATETIME, 0);
EOF
}

# Record migration success
record_success() {
    local version="$1"
    $CSQL_BIN -u dba "$DB_NAME" 2>/dev/null << EOF
UPDATE db_migration_history SET success = 1 WHERE version = '$version';
EOF
}

# Record migration failure
record_failure() {
    local version="$1"
    local error="$2"
    $CSQL_BIN -u dba "$DB_NAME" 2>/dev/null << EOF
UPDATE db_migration_history SET success = 0, error_message = '$(echo "$error" | head -c 2000)' WHERE version = '$version';
EOF
}

# Apply migration
apply_migration() {
    local file="$1"
    local version
    version=$(basename "$file" .sql | sed 's/V[0-9]*_//' | sed 's/_/./g')

    log_info "Applying migration: $file"

    local checksum
    checksum=$(sha256sum "$file" | awk '{print $1}')

    if [[ -f "$MIGRATIONS_DIR/processed/$version" ]]; then
        log_info "Already processed version $version, skipping"
        return 0
    fi

    record_start "$version" "$file" "$checksum"

    local output
    local error
    if output=$($CSQL_BIN -u dba "$DB_NAME" -i "$file" 2>&1); then
        if echo "$output" | grep -qiE "error|syntax|unable|cannot"; then
            error=$(echo "$output" | tail -5 | tr '\n' ' ')
            log_error "Migration failed: $error"
            record_failure "$version" "$error"
            return 1
        fi
        record_success "$version"
        touch "$MIGRATIONS_DIR/processed/$version"
        log_info "Migration successful: $version"
    else
        error=$(echo "$output" | tail -5 | tr '\n' ' ')
        log_error "Migration failed: $error"
        record_failure "$version" "$error"
        return 1
    fi
}

# Parse version from filename
# Format: V<major>_<minor>__<description>.sql or V<major>_<minor>_<patch>__<description>.sql
parse_version() {
    local file="$1"
    local basename
    basename=$(basename "$file" .sql)
    echo "$basename" | sed -E 's/^V([0-9]+)[_.-]([0-9]+)([0-9._]*)/v\1.\2\3/' | sed 's/_/-/g' | sed 's/\.\././g'
}

# Main
main() {
    log_info "Starting database migration"
    log_info "Migrations directory: $MIGRATIONS_DIR"

    if [[ ! -d "$MIGRATIONS_DIR" ]]; then
        log_error "Migrations directory not found: $MIGRATIONS_DIR"
        exit 1
    fi

    mkdir -p "$MIGRATIONS_DIR/processed"

    ensure_history_table

    local current_version
    current_version=$(get_current_version)
    log_info "Current database version: $current_version"

    # Find all SQL files and sort them
    local files
    files=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name "V[0-9]*__*.sql" -type f 2>/dev/null | sort)

    if [[ -z "$files" ]]; then
        log_info "No migration files found"
        exit 0
    fi

    local applied=0
    local failed=0

    for file in $files; do
        local version
        version=$(parse_version "$file")

        if [[ -n "$current_version" ]] && [[ "$version" == "$current_version" ]]; then
            continue
        fi

        if [[ "$version" < "$current_version" ]]; then
            continue
        fi

        if apply_migration "$file"; then
            ((applied++))
        else
            ((failed++))
            break
        fi
    done

    log_info "Migration complete. Applied: $applied, Failed: $failed"

    if [[ $failed -gt 0 ]]; then
        exit 1
    fi
}

main "$@"