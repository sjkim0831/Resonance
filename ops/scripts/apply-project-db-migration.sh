#!/usr/bin/env bash
set -euo pipefail

# Apply DB migrations for a specific project
# Usage: bash ops/scripts/apply-project-db-migration.sh [PROJECT_ID]

PROJECT_ID="${1:-}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE_DIR="$ROOT_DIR/var/releases/$PROJECT_ID"
DB_DIR="$RELEASE_DIR/db"
MANIFEST_FILE="$RELEASE_DIR/config/manifest.json"

if [ ! -d "$DB_DIR" ] || [ ! -f "$MANIFEST_FILE" ]; then
    echo "[db-migration] No DB directory or manifest found for $PROJECT_ID. Skipping."
    exit 0
fi

echo "[db-migration] Starting migration for $PROJECT_ID..."

# Extract DB URL from manifest (Assumes CUBRID and jq is available, or use simple grep/sed)
# Example URL: jdbc:cubrid:localhost:33000:carbonet_p003:::?charset=utf-8
DB_URL=$(grep -oP '"url":\s*"\K[^"]+' "$MANIFEST_FILE" | grep "projectDb" -A 1 | tail -n 1 || true)

if [ -z "$DB_URL" ]; then
    echo "[db-migration] Could not resolve project DB URL from manifest. Skipping."
    exit 0
fi

# Extract DB Name from URL
DB_NAME=$(echo "$DB_URL" | cut -d':' -f5)

echo "[db-migration] Target DB: $DB_NAME"

# Apply all .sql files in order
for sql_file in $(ls "$DB_DIR"/*.sql 2>/dev/null | sort); do
    echo "[db-migration] Applying $sql_file..."
    # Using csql (CUBRID command line tool)
    csql -u dba -p dba123 "$DB_NAME" -i "$sql_file"
done

echo "[db-migration] All migrations applied for $PROJECT_ID."
