#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PORT="${JAVA_FAST_DEV_PORT:-18000}"

set -a
for file in \
  "$ROOT_DIR/ops/config/carbonet-${PORT}.defaults.env" \
  "$ROOT_DIR/ops/config/carbonet-${PORT}.env" \
  "$ROOT_DIR/ops/config/carbonet-${PORT}.local.defaults.env"; do
  [[ -f "$file" ]] && source <(sed 's/\r$//' "$file")
done
set +a

: "${SPRING_DATASOURCE_URL:?SPRING_DATASOURCE_URL is required}"
: "${SPRING_DATASOURCE_USERNAME:?SPRING_DATASOURCE_USERNAME is required}"
: "${SPRING_DATASOURCE_PASSWORD:?SPRING_DATASOURCE_PASSWORD is required}"

export JAVA_FAST_DEV_PORT="$PORT"
export SERVER_SSL_ENABLED="${SERVER_SSL_ENABLED:-false}"
export CARBONET_FLYWAY_ENABLED="${CARBONET_FLYWAY_ENABLED:-false}"
export SPRING_LIQUIBASE_ENABLED="${SPRING_LIQUIBASE_ENABLED:-false}"
exec bash "$ROOT_DIR/ops/scripts/java-fast-dev.sh"
