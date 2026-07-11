#!/usr/bin/env bash
set -euo pipefail

# Start one project with the shared Gradle runtime and its isolated manifest.
# Usage: start-project-runtime.sh <project-id> [port]

PROJECT_ID="${1:-}"
PORT="${2:-18080}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
JAR_PATH="${PROJECT_RUNTIME_JAR:-$ROOT_DIR/apps/carbonet-api/build/libs/carbonet-api.jar}"
PROJECT_DIR="$ROOT_DIR/projects/$PROJECT_ID"
MANIFEST_PATH="$PROJECT_DIR/manifest.json"
RUN_DIR="$ROOT_DIR/var/run/project-runtime/$PROJECT_ID"
LOG_DIR="$ROOT_DIR/var/logs/project-runtime/$PROJECT_ID"
ADAPTER_DIR="$RUN_DIR/lib"
CONFIG_DIR="$RUN_DIR/config"

if [[ ! "$PROJECT_ID" =~ ^[A-Za-z][A-Za-z0-9_-]{1,31}$ ]]; then
  echo "A valid project-id is required." >&2
  exit 2
fi
if [[ ! -f "$JAR_PATH" ]]; then
  echo "Shared runtime JAR not found: $JAR_PATH" >&2
  echo "Build it with: ./gradlew :apps:carbonet-api:bootJar" >&2
  exit 1
fi
if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "Project manifest not found: $MANIFEST_PATH" >&2
  exit 1
fi
if [[ -z "${DB_USERNAME:-}" || -z "${DB_PASSWORD:-}" ]]; then
  echo "DB_USERNAME and DB_PASSWORD must be supplied by a secret provider." >&2
  exit 1
fi

mkdir -p "$RUN_DIR" "$LOG_DIR" "$ADAPTER_DIR" "$CONFIG_DIR"
cp "$JAR_PATH" "$RUN_DIR/carbonet-api.jar"
cp "$MANIFEST_PATH" "$CONFIG_DIR/manifest.json"

COMMON_LIB_DIR="$ROOT_DIR/var/lib/common"
LOADER_PATH="lib/"
if [[ -d "$COMMON_LIB_DIR" ]]; then
  LOADER_PATH="lib/,$COMMON_LIB_DIR/"
fi

cd "$RUN_DIR"
echo "Starting $PROJECT_ID on port $PORT with manifest $MANIFEST_PATH"
exec java ${JAVA_OPTS:-} -Dloader.path="$LOADER_PATH" -jar carbonet-api.jar \
  --spring.profiles.active=prod \
  --app.project-id="$PROJECT_ID" \
  --spring.config.additional-location=optional:file:./config/ \
  --logging.file.path="$LOG_DIR" \
  --server.port="$PORT"
