#!/bin/bash
# Sync builder output to frontend project

set -e

BUILDER_OUTPUT="/tmp/builder_output"
FRONTEND_GEN="/opt/Resonance/projects/carbonet-frontend/source/src/generated"
FRONTEND_RUNTIME="/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app/runtime"

echo "=== Builder Output Sync ==="

# Sync templates (hooks, utils, types, etc.)
echo "1. Syncing templates to runtime..."
mkdir -p "$FRONTEND_RUNTIME/templates"
cp -f "$BUILDER_OUTPUT/04_template"/*.ts "$FRONTEND_RUNTIME/templates/" 2>/dev/null || true
cp -f "$BUILDER_OUTPUT/04_template"/*.tsx "$FRONTEND_RUNTIME/templates/" 2>/dev/null || true
echo "   Templates synced"

# Sync screens
echo "2. Syncing screens..."
# The builder generates Screen{ID}.tsx, but frontend uses C{ID}_{name}Screen.tsx
# We need to map them correctly
mkdir -p "$FRONTEND_GEN/screens"

# Copy with mapping - builder output Screen{ID}.tsx -> C{ID}_Screen.tsx
for screen in "$BUILDER_OUTPUT/06_generate/screens"/Screen*.tsx; do
    if [ -f "$screen" ]; then
        filename=$(basename "$screen")
        # Extract ID: Screen123.tsx -> 123
        id=$(echo "$filename" | sed 's/Screen\([0-9]*\)\.tsx/\1/')
        # Create new name: C123_Screen.tsx
        newname="C${id}_Screen.tsx"
        cp -f "$screen" "$FRONTEND_GEN/screens/$newname"
    fi
done
echo "   Screens synced"

# Sync export files (routes, catalog, navigation)
echo "3. Syncing export files..."
cp -f "$BUILDER_OUTPUT/07_export/catalog.json" "$FRONTEND_RUNTIME/" 2>/dev/null || true
cp -f "$BUILDER_OUTPUT/07_export/navigation.json" "$FRONTEND_RUNTIME/" 2>/dev/null || true
echo "   Export files synced"

# Count files
template_count=$(ls "$FRONTEND_RUNTIME/templates"/*.ts "$FRONTEND_RUNTIME/templates"/*.tsx 2>/dev/null | wc -l)
screen_count=$(ls "$FRONTEND_GEN/screens"/C*_Screen.tsx 2>/dev/null | wc -l)

echo ""
echo "=== Sync Complete ==="
echo "Templates: $template_count files"
echo "Screens: $screen_count files"
