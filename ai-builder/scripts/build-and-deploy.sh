#!/bin/bash
# Build and Deploy Pipeline
# Usage: ./build-and-deploy.sh [--force] [--from N]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILDER_DIR="$(dirname "$SCRIPT_DIR")"

# Parse arguments
FORCE=false
FROM_LAYER=0

while [[ $# -gt 0 ]]; do
    case $1 in
        --force) FORCE=true; shift ;;
        --from) FROM_LAYER="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "=============================================="
echo "  Builder Build and Deploy Pipeline"
echo "=============================================="
echo ""

# Step 1: Run the builder pipeline
echo "[1/3] Running builder pipeline..."
cd "$BUILDER_DIR"

if [ "$FORCE" = true ]; then
    python3 -m builder.master_orchestrator --force --from "$FROM_LAYER"
else
    python3 -m builder.master_orchestrator
fi

echo ""

# Step 2: Sync to frontend
echo "[2/3] Syncing to frontend..."
bash "$SCRIPT_DIR/sync-to-frontend.sh"

echo ""

# Step 3: Generate summary
echo "[3/3] Generating summary..."

OUTPUT_DIR="/tmp/builder_output"
echo ""
echo "=============================================="
echo "  Build Complete"
echo "=============================================="
echo ""
echo "Generated:"
echo "  - Templates: $(ls "$OUTPUT_DIR/04_template"/*.ts "$OUTPUT_DIR/04_template"/*.tsx 2>/dev/null | wc -l) files"
echo "  - Screens: $(ls "$OUTPUT_DIR/06_generate/screens"/Screen*.tsx 2>/dev/null | wc -l) files"
echo "  - Export: routes.tsx, catalog.json, navigation.json"
echo ""
echo "Deployed to:"
echo "  - Templates: react-app/runtime/templates/"
echo "  - Screens: src/generated/screens/"
echo ""
echo "Run 'cd /opt/Resonance && bash ops/scripts/resonance-up.sh' to deploy"
echo "=============================================="
