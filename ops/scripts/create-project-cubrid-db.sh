#!/usr/bin/env bash
set -euo pipefail

# Create a new CUBRID database for an independent project
# Usage: bash ops/scripts/create-project-cubrid-db.sh [PROJECT_ID]

PROJECT_ID="${1:-}"
if [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 [PROJECT_ID]"
    echo "Example: $0 p004"
    exit 1
fi

# Convert PROJECT_ID to lowercase for standard DB naming
DB_NAME="carbonet_$(echo "$PROJECT_ID" | tr '[:upper:]' '[:lower:]')"
DB_LOCALE="ko_KR.utf8"

echo "[cubrid-setup] Preparing to create new database: $DB_NAME"

# Check if cubrid command is available
if ! command -v cubrid &> /dev/null; then
    echo "[cubrid-setup] Error: 'cubrid' command not found. Ensure CUBRID is installed and running."
    exit 1
fi

# Check if DB already exists
if cubrid server status "$DB_NAME" &> /dev/null; then
    echo "[cubrid-setup] Database '$DB_NAME' already exists."
    exit 0
fi

echo "[cubrid-setup] Creating database '$DB_NAME' with locale '$DB_LOCALE'..."
cubrid createdb "$DB_NAME" "$DB_LOCALE"

echo "[cubrid-setup] Starting database '$DB_NAME'..."
cubrid server start "$DB_NAME"

echo "[cubrid-setup] SUCCESS: Database '$DB_NAME' created and started."
echo " - JDBC URL: jdbc:cubrid:localhost:33000:${DB_NAME}:::?charset=utf-8"
