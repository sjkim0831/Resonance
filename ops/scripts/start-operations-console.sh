#!/usr/bin/env bash
set -euo pipefail

# Start script for Operations Console (Platform Lane)
# Usage: bash ops/scripts/start-operations-console.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
JAR_PATH="$ROOT_DIR/apps/operations-console/target/operations-console.jar"
RUN_DIR="$ROOT_DIR/var/run/operations-console"
LOG_DIR="$ROOT_DIR/var/logs/operations-console"

mkdir -p "$RUN_DIR" "$LOG_DIR"

echo "[start-operations-console] starting from $JAR_PATH"
echo "[start-operations-console] run dir: $RUN_DIR"

# Copy JAR to run directory
cp "$JAR_PATH" "$RUN_DIR/operations-console.jar"

cd "$RUN_DIR"

# Execute through stable gate only rule
# Using PropertiesLauncher (-Dloader.path) to optionally load shared common libraries from var/lib/common
COMMON_LIB_DIR="$ROOT_DIR/var/lib/common"
LOADER_PATH="lib/"
if [[ -d "$COMMON_LIB_DIR" ]]; then
  LOADER_PATH="lib/,$COMMON_LIB_DIR/"
fi

exec java -Dloader.path="$LOADER_PATH" -jar operations-console.jar \
  --spring.profiles.active=prod \
  --app.role=ops \
  --logging.file.path="$LOG_DIR" \
  --server.port=18001 \
  >> "$LOG_DIR/stdout.log" 2>&1
