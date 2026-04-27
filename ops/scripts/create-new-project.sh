#!/usr/bin/env bash
set -euo pipefail

# Create a new project from template
# Usage: bash ops/scripts/create-new-project.sh [PROJECT_ID]

PROJECT_ID="${1:-}"
if [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 [PROJECT_ID]"
    echo "Example: $0 p004"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE_DIR="$ROOT_DIR/projects/project-template"
TEMPLATE_ADAPTER_DIR="$ROOT_DIR/projects/project-template-adapter"
NEW_PROJECT_DIR="$ROOT_DIR/projects/$PROJECT_ID-runtime"
NEW_ADAPTER_DIR="$ROOT_DIR/projects/$PROJECT_ID-adapter"

if [ -d "$NEW_PROJECT_DIR" ] || [ -d "$NEW_ADAPTER_DIR" ]; then
    echo "Error: Project $PROJECT_ID already exists."
    exit 1
fi

echo "[bootstrap] creating new project: $PROJECT_ID..."

# 1. Copy templates
cp -r "$TEMPLATE_DIR" "$NEW_PROJECT_DIR"
cp -r "$TEMPLATE_ADAPTER_DIR" "$NEW_ADAPTER_DIR"

# 2. Rename artifacts in pom.xml
sed -i "s/project-template/$PROJECT_ID-runtime/g" "$NEW_PROJECT_DIR/pom.xml"
sed -i "s/project-template-adapter/$PROJECT_ID-adapter/g" "$NEW_ADAPTER_DIR/pom.xml"
sed -i "s/project-template-adapter/$PROJECT_ID-adapter/g" "$NEW_PROJECT_DIR/pom.xml"

# 3. Update manifest.json
if [ -f "$NEW_PROJECT_DIR/config/manifest.json" ]; then
    sed -i "s/project-template/$PROJECT_ID-runtime/g" "$NEW_PROJECT_DIR/config/manifest.json"
    sed -i "s/PROJECT_TEMPLATE/$(echo $PROJECT_ID | tr '[:lower:]' '[:upper:]')/g" "$NEW_PROJECT_DIR/config/manifest.json"
fi

# 4. Register in root pom.xml
echo "[bootstrap] registering in root pom.xml..."
sed -i "/<module>projects\/project-template<\/module>/a \		<module>projects/$PROJECT_ID-adapter</module>\n\		<module>projects/$PROJECT_ID-runtime</module>" "$ROOT_DIR/pom.xml"

echo "[bootstrap] DONE! Project $PROJECT_ID is ready."
echo "  - Runtime: projects/$PROJECT_ID-runtime"
echo "  - Adapter: projects/$PROJECT_ID-adapter"
echo "  - Run 'mvn clean install' to build the new project."
