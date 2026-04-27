#!/usr/bin/env bash
set -euo pipefail

# Cleanup old release directories, keeping only the latest N versions
# Usage: bash ops/scripts/cleanup-old-releases.sh [PROJECT_ID] [KEEP_COUNT]

PROJECT_ID="${1:-}"
KEEP_COUNT="${2:-5}"
REMOTE_TARGET="${3:-carbonet2026@136.117.100.221}"
REMOTE_ROOT="${4:-/opt/Resonance}"

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 [PROJECT_ID] [KEEP_COUNT]"
    exit 1
fi

echo "[cleanup] cleaning up old releases for $PROJECT_ID (keeping last $KEEP_COUNT)..."

ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "
    PROJECT_ROOT=\"$REMOTE_ROOT/var/releases/$PROJECT_ID\"
    RELEASES_DIR=\"\$PROJECT_ROOT/releases\"

    if [ ! -d \"\$RELEASES_DIR\" ]; then
        echo \"[cleanup] No releases directory found for $PROJECT_ID.\"
        exit 0
    fi

    # List releases by name (timestamp) in reverse order, skip the first KEEP_COUNT
    OLD_RELEASES=\$(ls -r \"\$RELEASES_DIR\" | tail -n +\$(($KEEP_COUNT + 1)))

    if [ -z \"\$OLD_RELEASES\" ]; then
        echo \"[cleanup] No old releases to clean up.\"
        exit 0
    fi

    for release in \$OLD_RELEASES; do
        echo \"[cleanup] Removing old release: \$release\"
        rm -rf \"\$RELEASES_DIR/\$release\"
    done

    echo \"[cleanup] Cleanup complete for $PROJECT_ID.\"
"
