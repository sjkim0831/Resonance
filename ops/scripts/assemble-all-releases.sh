#!/usr/bin/env bash
set -euo pipefail

# Assemble all project releases in the repository
# Usage: bash ops/scripts/assemble-all-releases.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ASSEMBLE_SCRIPT="$ROOT_DIR/ops/scripts/assemble-project-release.sh"

echo "[assemble-all] scanning for projects in $ROOT_DIR/projects/..."

# Find all directories in projects/ that end with -runtime
# Exclude the template itself if you don't want to build it every time
PROJECTS=$(find "$ROOT_DIR/projects" -maxdepth 1 -type d -name "*-runtime" | sed 's/.*\/projects\///' | sed 's/-runtime//')

for PROJECT_ID in $PROJECTS; do
    if [ "$PROJECT_ID" == "project-template" ]; then
        echo "[assemble-all] skipping template: $PROJECT_ID"
        continue
    fi
    
    echo "----------------------------------------------------------"
    echo "[assemble-all] processing project: $PROJECT_ID"
    bash "$ASSEMBLE_SCRIPT" "$PROJECT_ID"
done

echo "----------------------------------------------------------"
echo "[assemble-all] all projects processed."
echo "Summary of releases in $ROOT_DIR/var/releases/:"
ls -F "$ROOT_DIR/var/releases/"
