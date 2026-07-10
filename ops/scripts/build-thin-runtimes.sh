#!/usr/bin/env bash
set -euo pipefail

# Build script for Thin JARs with shared common libraries
# Usage: bash ops/scripts/build-thin-runtimes.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/build.sh
source "$ROOT_DIR/ops/scripts/build.sh" 2>/dev/null || true
init_build_tool
COMMON_LIB_DIR="$ROOT_DIR/var/lib/common"

mkdir -p "$COMMON_LIB_DIR"

# Build tool detection
if [[ -x "$ROOT_DIR/gradlew" ]] && [[ -f "$ROOT_DIR/settings.gradle.kts" ]]; then
    BUILD_LOG_PREFIX="[gradle]"
    PRJ_BIN=("$ROOT_DIR/gradlew" "-p" "$ROOT_DIR")
    PRJ_BOOT() { "${PRJ_BIN[@]}" ":apps:$1:bootJar" -x test -q; }
    OUTPUT_DIR() { echo "$ROOT_DIR/apps/$1/build/libs"; }
else
    BUILD_LOG_PREFIX="[maven]"
    PRJ_BIN=(mvn)
    PRJ_BOOT() { mvn -q -pl "apps/$1" -am -DskipTests clean package; }
    OUTPUT_DIR() { echo "$ROOT_DIR/apps/$1/target"; }
fi

echo "$BUILD_LOG_PREFIX [build-thin-runtimes] building project-runtime..."
PRJ_BOOT project-runtime

echo "$BUILD_LOG_PREFIX [build-thin-runtimes] building operations-console..."
PRJ_BOOT operations-console

# Strategy: Extract BOOT-INF/lib from one of the fat jars to common lib dir
# This assumes they share most dependencies through the parent pom.
PROJECT_RUNTIME_DIR="$(OUTPUT_DIR project-runtime)"
FAT_JAR="$PROJECT_RUNTIME_DIR/carbonet-api.jar"

if [[ ! -f "$FAT_JAR" ]]; then
    # fallback: pick the largest jar in the output dir
    FAT_JAR="$(find "$PROJECT_RUNTIME_DIR" -maxdepth 2 -name "*.jar" -type f 2>/dev/null | grep -v original | head -1 || true)"
fi

if [[ -z "$FAT_JAR" || ! -f "$FAT_JAR" ]]; then
    echo "[build-thin-runtimes] FAT_JAR not detected; skipping BOOT-INF extraction." >&2
    exit 0
fi

echo "[build-thin-runtimes] extracting common libraries to $COMMON_LIB_DIR..."
# Temporary dir for extraction
TMP_EXTRACT=$(mktemp -d)
unzip -q "$FAT_JAR" "BOOT-INF/lib/*" -d "$TMP_EXTRACT"
cp -rn "$TMP_EXTRACT/BOOT-INF/lib/"* "$COMMON_LIB_DIR/"
rm -rf "$TMP_EXTRACT"

echo "[build-thin-runtimes] build complete."
echo "  Shared Libs: $COMMON_LIB_DIR"
echo "  Thin project-runtime: apps/carbonet-api/$( [ -f "$ROOT_DIR/apps/carbonet-api/build/libs/carbonet-api.jar" ] && echo "build/libs/carbonet-api.jar" || echo "target/carbonet-api.jar" )"
echo "  Thin operations-console: apps/operations-console/$( [ -f "$ROOT_DIR/apps/operations-console/build/libs/operations-console.jar" ] && echo "build/libs/operations-console.jar" || echo "target/operations-console.jar" )"
echo ""
echo "Note: To run these as thin jars, use: java -Dloader.path=\"$COMMON_LIB_DIR\" -jar ..."
