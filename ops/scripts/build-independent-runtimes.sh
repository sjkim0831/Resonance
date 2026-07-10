#!/usr/bin/env bash
set -euo pipefail

# Build script for independent runtimes
# Usage: bash ops/scripts/build-independent-runtimes.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/build.sh
source "$ROOT_DIR/ops/scripts/build.sh" 2>/dev/null || true
init_build_tool

echo "[build-independent-runtimes] building project-runtime..."
mvn -q -pl apps/carbonet-api -am -Dmaven.test.skip=true clean package

echo "[build-independent-runtimes] building operations-console..."
mvn -q -pl apps/operations-console -am -Dmaven.test.skip=true clean package

echo "[build-independent-runtimes] build complete."
echo "  project-runtime: apps/carbonet-api/target/carbonet-api.jar"
echo "  operations-console: apps/operations-console/target/operations-console.jar"
