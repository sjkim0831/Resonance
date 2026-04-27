#!/usr/bin/env bash
set -euo pipefail

# This script simulates the "Thin Project Package" bootstrap.
# It takes a Project ID, loads its manifest, and sets up its independent run directory.

PROJECT_ID="${1:-P003}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "=========================================================="
echo " Bootstrapping Thin Project Package for: $PROJECT_ID"
echo "=========================================================="

RUN_DIR="$ROOT_DIR/var/run/project-runtime/$PROJECT_ID"
ADAPTER_DIR="$RUN_DIR/lib"
CONFIG_DIR="$RUN_DIR/config"

echo "[1/4] Creating separate boot paths..."
mkdir -p "$RUN_DIR" "$ADAPTER_DIR" "$CONFIG_DIR"

echo "[2/4] Linking source of truth (manifest)..."
# In a real pipeline, the manifest is generated or downloaded.
# Here we link the centralized JSON for test purposes.
ln -sf "$ROOT_DIR/data/version-control/project-runtime-manifest.json" "$CONFIG_DIR/manifest.json"

echo "[3/4] Copying common-core project-runtime..."
# Relies on the shared project-runtime package output.
cp "$ROOT_DIR/apps/project-runtime/target/project-runtime.jar" "$RUN_DIR/project-runtime.jar"

echo "[4/4] Copying project-specific adapter binding..."
# Simulates dropping the "Thin Project Adapter" jar.
# If P003 had its own module `projects/p003-adapter`, we would copy it here.
# For now, we will copy the sample carbonet-adapter to demonstrate the binding mechanism.
if [ -f "$ROOT_DIR/projects/carbonet-adapter/target/carbonet-adapter-1.0.0.jar" ]; then
    cp "$ROOT_DIR/projects/carbonet-adapter/target/carbonet-adapter-1.0.0.jar" "$ADAPTER_DIR/"
    echo "      -> Attached project-adapter to $ADAPTER_DIR"
else
    echo "      -> Note: No project adapter jar found. Will use default fallback bindings."
fi

echo ""
echo "Bootstrap complete. The project is ready to boot independently."
echo "Run it via:"
echo "  bash ops/scripts/start-project-runtime.sh $PROJECT_ID"
echo "=========================================================="
