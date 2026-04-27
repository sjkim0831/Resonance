#!/usr/bin/env bash
set -euo pipefail

# Start script for Project Runtime (Independent Lane)
# Usage: bash ops/scripts/start-project-runtime.sh [PROJECT_ID] [PORT]

PROJECT_ID="${1:-P001}"
PORT="${2:-18000}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
JAR_PATH="$ROOT_DIR/apps/project-runtime/target/project-runtime.jar"
RUN_DIR="$ROOT_DIR/var/run/project-runtime/$PROJECT_ID"
LOG_DIR="$ROOT_DIR/var/logs/project-runtime/$PROJECT_ID"
ADAPTER_DIR="$RUN_DIR/lib"

mkdir -p "$RUN_DIR" "$LOG_DIR" "$ADAPTER_DIR"

echo "[start-project-runtime] starting $PROJECT_ID from $JAR_PATH on port $PORT"
echo "[start-project-runtime] run dir: $RUN_DIR"
echo "[start-project-runtime] adapter dir: $ADAPTER_DIR"

# Copy common runtime JAR to run directory to allow independent versioning/upgrades
cp "$JAR_PATH" "$RUN_DIR/project-runtime.jar"

# Here you would typically copy the project's specific adapter JAR into $ADAPTER_DIR
# For example: cp projects/carbonet-adapter/target/carbonet-adapter-1.0.0.jar $ADAPTER_DIR/
# Currently relying on the adapter already being placed there by a build/deployment step.

cd "$RUN_DIR"

# Execute through stable gate only rule
# Using PropertiesLauncher (-Dloader.path) to dynamically load the project's adapter JARs
# and optionally shared common libraries from var/lib/common
COMMON_LIB_DIR="$ROOT_DIR/var/lib/common"
LOADER_PATH="lib/"
if [[ -d "$COMMON_LIB_DIR" ]]; then
  LOADER_PATH="lib/,$COMMON_LIB_DIR/"
fi
DB_URL="jdbc:cubrid:${CUBRID_HOST:-127.0.0.1}:${CUBRID_PORT:-33000}:${CUBRID_DB:-carbonet}:::?charset=UTF-8"

exec java -Dloader.path="$LOADER_PATH" -jar project-runtime.jar \
  --spring.profiles.active=prod \
  --app.project-id="$PROJECT_ID" \
  --spring.datasource.url="$DB_URL" \
  --spring.datasource.username="${CUBRID_USER:-dba}" \
  --spring.datasource.password="${CUBRID_PASSWORD:-}" \
  --logging.file.path="$LOG_DIR" \
  --server.port="$PORT" \
  >> "$LOG_DIR/stdout.log" 2>&1

