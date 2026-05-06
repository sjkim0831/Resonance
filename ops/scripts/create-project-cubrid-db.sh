#!/usr/bin/env bash
set -euo pipefail

# Create a new CUBRID database for an independent project
# Usage: bash ops/scripts/create-project-docker exec -it cubrid-11.2 cubrid-db.sh [PROJECT_ID]

PROJECT_ID="${1:-}"
if [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 [PROJECT_ID]"
    echo "Example: $0 p004"
    exit 1
fi

# Convert PROJECT_ID to lowercase for standard DB naming
DB_NAME="carbonet_$(echo "$PROJECT_ID" | tr '[:upper:]' '[:lower:]')"
DB_LOCALE="ko_KR.utf8"

echo "[docker exec -it cubrid-11.2 cubrid-setup] Preparing to create new database: $DB_NAME"

# Check if docker exec -it cubrid-11.2 cubrid command is available
if ! command -v docker exec -it cubrid-11.2 cubrid &> /dev/null; then
    echo "[docker exec -it cubrid-11.2 cubrid-setup] Error: 'docker exec -it cubrid-11.2 cubrid' command not found. Ensure CUBRID is installed and running."
    exit 1
fi

# Check if DB already exists
if docker exec -it cubrid-11.2 cubrid server status "$DB_NAME" &> /dev/null; then
    echo "[docker exec -it cubrid-11.2 cubrid-setup] Database '$DB_NAME' already exists."
    exit 0
fi

echo "[docker exec -it cubrid-11.2 cubrid-setup] Creating database '$DB_NAME' with locale '$DB_LOCALE'..."
docker exec -it cubrid-11.2 cubrid createdb "$DB_NAME" "$DB_LOCALE"

echo "[docker exec -it cubrid-11.2 cubrid-setup] Starting database '$DB_NAME'..."
docker exec -it cubrid-11.2 cubrid server start "$DB_NAME"

echo "[docker exec -it cubrid-11.2 cubrid-setup] SUCCESS: Database '$DB_NAME' created and started."
echo " - JDBC URL: jdbc:docker exec -it cubrid-11.2 cubrid:localhost:33000:${DB_NAME}:::?charset=utf-8"
