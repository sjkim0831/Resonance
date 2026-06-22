#!/usr/bin/env bash
set -euo pipefail

# GitOps Database Migration Script
# Applies versioned SQL migrations from db/migrations/ or ops/db/carbonet/
# Works with CUBRID using kubectl exec

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DB_NAMESPACE="carbonet-prod"
DB_POD="cubrid-carbonet-0"
DB_NAME="carbonet"
HISTORY_TABLE="db_migration_history"

CSQL_CMD="kubectl exec $DB_POD -n $DB_NAMESPACE -- csql -u dba $DB_NAME"

log_info() { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] [INFO] $*"; }
log_error() { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] [ERROR] $*" >&2; }

run_csql() {
    kubectl exec "$DB_POD" -n "$DB_NAMESPACE" -- csql -u dba "$DB_NAME" -c "$1" 2>/dev/null
}

ensure_history_table() {
    run_csql "
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
);" >/dev/null 2>&1 || true
    log_info "History table ensured"
}

get_current_version() {
    local version
    version=$(run_csql "SELECT COALESCE(MAX(version), '0') FROM db_migration_history WHERE success = 1;" 2>/dev/null | grep -v "^==" | grep -v "^$" | head -1 | tr -d ' ')
    echo "${version:-0}"
}

is_applied() {
    local version="$1"
    local count
    count=$(run_csql "SELECT COUNT(*) FROM db_migration_history WHERE version = '$version' AND success = 1;" 2>/dev/null | grep -v "^==" | grep -v "^$" | head -1 | tr -d ' ')
    echo "${count:-0}"
}

record_start() {
    local version="$1"
    local script="$2"
    local checksum="$3"
    run_csql "INSERT INTO db_migration_history (version, script, checksum, executed_by, executed_at, success)
VALUES ('$version', '$script', '$checksum', '${USER:-unknown}', CURRENT_DATETIME, 0);" >/dev/null 2>&1 || true
}

record_success() {
    local version="$1"
    run_csql "UPDATE db_migration_history SET success = 1 WHERE version = '$version';" >/dev/null 2>&1 || true
}

record_failure() {
    local version="$1"
    local error="$2"
    run_csql "UPDATE db_migration_history SET success = 0, error_message = '$(echo "$error" | head -c 2000 | sed "s/'/''/g")' WHERE version = '$version';" >/dev/null 2>&1 || true
}

apply_migration() {
    local file="$1"
    local version="$2"

    log_info "Applying migration: $file (version: $version)"

    local checksum
    checksum=$(sha256sum "$file" | awk '{print $1}')

    if [[ "$(is_applied "$version")" -gt 0 ]]; then
        log_info "Version $version already applied, skipping"
        return 0
    fi

    record_start "$version" "$file" "$checksum"

    local sql_content
    sql_content=$(cat "$file")

    local output
    local error
    if output=$(run_csql "$sql_content" 2>&1); then
        if echo "$output" | grep -qiE "error|syntax|unable|cannot"; then
            error=$(echo "$output" | tail -10 | tr '\n' ' ')
            log_error "Migration failed: ${error:0:500}"
            record_failure "$version" "$error"
            return 1
        fi
        record_success "$version"
        log_info "Migration successful: $version"
    else
        error=$(echo "$output" | tail -10 | tr '\n' ' ')
        log_error "Migration failed: ${error:0:500}"
        record_failure "$version" "$error"
        return 1
    fi
}

version_sort() {
    printf '%s\n' "$@" | sort -V
}

get_migration_files() {
    local dirs=("$ROOT_DIR/db/migrations" "$ROOT_DIR/ops/db/carbonet")
    local files=()

    for dir in "${dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            while IFS= read -r -d '' file; do
                files+=("$file")
            done < <(find "$dir" -maxdepth 1 -name "*.sql" -type f -print0 2>/dev/null)
        fi
    done

    printf '%s\n' "${files[@]}" | sort
}

parse_version() {
    local file="$1"
    local basename
    basename=$(basename "$file" .sql)

    if [[ "$basename" =~ ^V[0-9]+_[0-9]+__ ]]; then
        echo "$basename" | sed -E 's/^V([0-9]+)[_.-]([0-9]+)([0-9._-]*).*/v\1.\2\3/' | sed 's/_/-/g' | sed 's/\.\././g'
    elif [[ "$basename" =~ ^[0-9]{8}_[0-9]+_ ]]; then
        echo "$basename" | sed 's/_/./g'
    else
        echo "$basename"
    fi
}

main() {
    log_info "Starting database migration"

    if ! kubectl get pod "$DB_POD" -n "$DB_NAMESPACE" >/dev/null 2>&1; then
        log_error "CUBRID pod not found: $DB_POD"
        exit 1
    fi

    ensure_history_table

    local current_version
    current_version=$(get_current_version)
    log_info "Current database version: $current_version"

    local files
    mapfile -t files < <(get_migration_files)

    if [[ ${#files[@]} -eq 0 ]]; then
        log_info "No migration files found"
        exit 0
    fi

    local applied=0
    local failed=0
    local skipped=0

    for file in "${files[@]}"; do
        [[ -z "$file" ]] && continue

        local version
        version=$(parse_version "$file")

        if [[ "$version" == "$current_version" ]]; then
            log_info "Version $version already applied, skipping"
            ((skipped++))
            continue
        fi

        if ! apply_migration "$file" "$version"; then
            ((failed++))
            break
        fi
        ((applied++))
    done

    log_info "Migration complete. Applied: $applied, Skipped: $skipped, Failed: $failed"

    if [[ $failed -gt 0 ]]; then
        exit 1
    fi

    if [[ $applied -gt 0 ]]; then
        log_info "마이그레이션 성공 - Baseline 업데이트..."
        /opt/Resonance/ops/scripts/cubrid-verify.sh update-baseline >/dev/null 2>&1 || true
    fi
}

main "$@"