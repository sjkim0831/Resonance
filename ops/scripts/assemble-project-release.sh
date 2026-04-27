#!/usr/bin/env bash
set -euo pipefail

# Assemble project-specific release package
# Usage: bash ops/scripts/assemble-project-release.sh [PROJECT_ID]
# Example: bash ops/scripts/assemble-project-release.sh p003

PROJECT_ID="${1:-}"
if [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 [PROJECT_ID]"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE_BASE="$ROOT_DIR/var/releases/$PROJECT_ID"
LIB_DIR="$RELEASE_BASE/lib"

echo "[assemble] starting assembly for $PROJECT_ID"
mkdir -p "$LIB_DIR"

# 1. Build and extract common runtime
echo "[assemble] building common project-runtime..."
mvn -q -pl apps/project-runtime -am -DskipTests clean package

FAT_JAR="$ROOT_DIR/apps/project-runtime/target/project-runtime.jar"
echo "[assemble] extracting common libraries from project-runtime..."
TMP_EXTRACT=$(mktemp -d)
unzip -q "$FAT_JAR" "BOOT-INF/lib/*" -d "$TMP_EXTRACT"
cp -rn "$TMP_EXTRACT/BOOT-INF/lib/"* "$LIB_DIR/"
rm -rf "$TMP_EXTRACT"

# Copy the "thin" target JAR (it is still technically fat but will use loader.path)
cp "$FAT_JAR" "$RELEASE_BASE/project-runtime.jar"

# 2. Build and copy project-specific modules
echo "[assemble] building project modules ($PROJECT_ID-adapter, $PROJECT_ID-runtime)..."
mvn -q -pl "projects/$PROJECT_ID-adapter,projects/$PROJECT_ID-runtime" -am -DskipTests clean package

# Find and copy project JARs to lib/
find "$ROOT_DIR/projects/$PROJECT_ID-adapter/target" -name "$PROJECT_ID-adapter-*.jar" -not -name "*sources.jar" -exec cp {} "$LIB_DIR/" \;
find "$ROOT_DIR/projects/$PROJECT_ID-runtime/target" -name "$PROJECT_ID-runtime-*.jar" -not -name "*sources.jar" -exec cp {} "$LIB_DIR/" \;

# 3. Copy project configuration and DB files
echo "[assemble] copying configuration and DB files..."
mkdir -p "$RELEASE_BASE/config" "$RELEASE_BASE/db" "$RELEASE_BASE/static"
if [ -d "$ROOT_DIR/projects/$PROJECT_ID-runtime/config" ]; then
    cp -r "$ROOT_DIR/projects/$PROJECT_ID-runtime/config/"* "$RELEASE_BASE/config/"
fi
if [ -d "$ROOT_DIR/projects/$PROJECT_ID-runtime/db" ]; then
    cp -r "$ROOT_DIR/projects/$PROJECT_ID-runtime/db/"* "$RELEASE_BASE/db/"
fi
if [ -f "$ROOT_DIR/projects/$PROJECT_ID-runtime/src/main/resources/application.yml" ]; then
    cp "$ROOT_DIR/projects/$PROJECT_ID-runtime/src/main/resources/application.yml" "$RELEASE_BASE/config/"
fi

# 4. Copy Frontend static resources (React App)
echo "[assemble] copying frontend static resources..."
if [ -d "$ROOT_DIR/src/main/resources/static" ]; then
    cp -r "$ROOT_DIR/src/main/resources/static/"* "$RELEASE_BASE/static/" 2>/dev/null || true
fi

# 5. Create run script for this release
cat > "$RELEASE_BASE/run.sh" <<EOF
#!/usr/bin/env bash
# Independent run script for $PROJECT_ID
cd "\$(dirname "\$0")"

# Allow overriding SERVER_PORT and JAVA_OPTS via environment variables or .env
PORT="\${SERVER_PORT:-18000}"
OPTS="\${JAVA_OPTS:--Xms256m -Xmx512m}"

echo "Starting $PROJECT_ID on port \$PORT with options \$OPTS"

exec java \$OPTS -Dloader.path=lib/ -jar project-runtime.jar \\
  --spring.profiles.active=prod \\
  --app.project-id="$PROJECT_ID" \\
  --server.port="\$PORT" \\
  --spring.web.resources.static-locations=classpath:/META-INF/resources/,classpath:/resources/,classpath:/static/,classpath:/public/,file:./static/ \\
  --spring.config.additional-location=optional:file:./config/ \\
  "\$@"
EOF
chmod +x "$RELEASE_BASE/run.sh"

echo "[assemble] assembly complete: $RELEASE_BASE"
echo "  - Common Engine: project-runtime.jar"
echo "  - Project Libs: \$(ls \$LIB_DIR)"
echo "  - Execution: bash $RELEASE_BASE/run.sh"
