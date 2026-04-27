#!/usr/bin/env bash
set -euo pipefail

# Build script for Thin JARs with shared common libraries
# Usage: bash ops/scripts/build-thin-runtimes.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMMON_LIB_DIR="$ROOT_DIR/var/lib/common"

mkdir -p "$COMMON_LIB_DIR"

echo "[build-thin-runtimes] building project-runtime..."
mvn -q -pl apps/project-runtime -am -DskipTests clean package

echo "[build-thin-runtimes] building operations-console..."
mvn -q -pl apps/operations-console -am -DskipTests clean package

# Strategy: Extract BOOT-INF/lib from one of the fat jars to common lib dir
# This assumes they share most dependencies through the parent pom.
FAT_JAR="$ROOT_DIR/apps/project-runtime/target/project-runtime.jar"

echo "[build-thin-runtimes] extracting common libraries to $COMMON_LIB_DIR..."
# Temporary dir for extraction
TMP_EXTRACT=$(mktemp -d)
unzip -q "$FAT_JAR" "BOOT-INF/lib/*" -d "$TMP_EXTRACT"
cp -rn "$TMP_EXTRACT/BOOT-INF/lib/"* "$COMMON_LIB_DIR/"
rm -rf "$TMP_EXTRACT"

echo "[build-thin-runtimes] build complete."
echo "  Shared Libs: $COMMON_LIB_DIR"
echo "  Thin project-runtime: apps/project-runtime/target/project-runtime.jar"
echo "  Thin operations-console: apps/operations-console/target/operations-console.jar"
echo ""
echo "Note: To run these as thin jars, use: java -Dloader.path=\"$COMMON_LIB_DIR\" -jar ..."
