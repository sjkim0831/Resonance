#!/usr/bin/env bash
set -euo pipefail

# Build script for independent runtimes
# Usage: bash ops/scripts/build-independent-runtimes.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[build-independent-runtimes] building project-runtime..."
mvn -q -pl apps/project-runtime -am -Dmaven.test.skip=true clean package

echo "[build-independent-runtimes] building operations-console..."
mvn -q -pl apps/operations-console -am -Dmaven.test.skip=true clean package

echo "[build-independent-runtimes] build complete."
echo "  project-runtime: apps/project-runtime/target/project-runtime.jar"
echo "  operations-console: apps/operations-console/target/operations-console.jar"
