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
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/build.sh
source "$ROOT_DIR/ops/scripts/build.sh" 2>/dev/null || true
init_build_tool
RELEASE_BASE="$ROOT_DIR/var/releases/$PROJECT_ID"
LIB_DIR="$RELEASE_BASE/lib"

echo "[assemble] starting assembly for $PROJECT_ID"
mkdir -p "$LIB_DIR"
if [ -f "$ROOT_DIR/third_party/kisa/kr.or.kisa.dapc.core-1.0.0.jar" ]; then
    cp "$ROOT_DIR/third_party/kisa/kr.or.kisa.dapc.core-1.0.0.jar" "$LIB_DIR/"
fi

# 1. Build and extract common runtime
echo "[assemble] building common project-runtime..."
jbuild -q -pl apps/project-runtime -am -DskipTests package

FAT_JAR="$(jbooted project-runtime)"
echo "[assemble] extracting common libraries from project-runtime..."
TMP_EXTRACT=$(mktemp -d)
unzip -q "$FAT_JAR" "BOOT-INF/lib/*" -d "$TMP_EXTRACT"
cp -rn "$TMP_EXTRACT/BOOT-INF/lib/"* "$LIB_DIR/"
rm -rf "$TMP_EXTRACT"

# Copy the "thin" target JAR (it is still technically fat but will use loader.path)
cp "$FAT_JAR" "$RELEASE_BASE/project-runtime.jar"

# 2. Copy project-specific runtime libraries.
# Project-specific Maven modules are optional in the current Gradle-first layout.
echo "[assemble] collecting project runtime libraries..."
for module_dir in "$ROOT_DIR/projects/$PROJECT_ID-adapter" "$ROOT_DIR/projects/$PROJECT_ID-runtime"; do
    if [ -f "$module_dir/pom.xml" ]; then
        echo "[assemble] legacy Maven module detected: $module_dir"
        (cd "$ROOT_DIR" && mvn -q -pl "${module_dir#$ROOT_DIR/}" -am -DskipTests package)
        find "$module_dir/target" -name "*.jar" -not -name "*sources.jar" -exec cp {} "$LIB_DIR/" \;
    else
        echo "[assemble] optional project module not present, skipping: ${module_dir#$ROOT_DIR/}"
    fi
done

if [ -d "$ROOT_DIR/projects/carbonet-backend-lib" ]; then
    find "$ROOT_DIR/projects/carbonet-backend-lib" -maxdepth 1 -name "*.jar" -exec cp {} "$LIB_DIR/" \;
fi

# 3. Copy project configuration and DB files
echo "[assemble] copying configuration and DB files..."
mkdir -p "$RELEASE_BASE/config" "$RELEASE_BASE/ops/config" "$RELEASE_BASE/db" "$RELEASE_BASE/static"
if [ -d "$ROOT_DIR/projects/$PROJECT_ID-runtime/config" ]; then
    cp -r "$ROOT_DIR/projects/$PROJECT_ID-runtime/config/"* "$RELEASE_BASE/config/"
    cp -r "$ROOT_DIR/projects/$PROJECT_ID-runtime/config/"* "$RELEASE_BASE/ops/config/"
fi
if [ -d "$ROOT_DIR/projects/$PROJECT_ID-runtime/db" ]; then
    cp -r "$ROOT_DIR/projects/$PROJECT_ID-runtime/db/"* "$RELEASE_BASE/db/"
fi
if [ -f "$ROOT_DIR/projects/$PROJECT_ID-runtime/src/main/resources/application.yml" ]; then
    cp "$ROOT_DIR/projects/$PROJECT_ID-runtime/src/main/resources/application.yml" "$RELEASE_BASE/config/"
    cp "$ROOT_DIR/projects/$PROJECT_ID-runtime/src/main/resources/application.yml" "$RELEASE_BASE/ops/config/"
fi

if [ -d "$ROOT_DIR/ops/config" ]; then
    cp -r "$ROOT_DIR/ops/config/"* "$RELEASE_BASE/ops/config/" 2>/dev/null || true
fi

# 4. Copy project overlays, metadata, and frontend static resources.
echo "[assemble] copying project overlays and metadata..."
mkdir -p "$RELEASE_BASE/static" "$RELEASE_BASE/backend-metadata"
if [ -d "$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static" ]; then
    cp -r "$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/"* "$RELEASE_BASE/static/" 2>/dev/null || true
fi
if [ -d "$ROOT_DIR/projects/carbonet-assets/static" ]; then
    cp -r "$ROOT_DIR/projects/carbonet-assets/static/"* "$RELEASE_BASE/static/" 2>/dev/null || true
fi
if [ -d "$ROOT_DIR/projects/carbonet-backend-metadata" ]; then
    cp -r "$ROOT_DIR/projects/carbonet-backend-metadata/"* "$RELEASE_BASE/backend-metadata/" 2>/dev/null || true
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
echo "  - Project Libs: $(find "$LIB_DIR" -maxdepth 1 -name "*.jar" | wc -l) jars"
echo "  - Execution: bash $RELEASE_BASE/run.sh"
