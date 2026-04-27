#!/usr/bin/env bash
set -euo pipefail

# Rollback a specific project to the previous version
# Usage: bash ops/scripts/rollback-project-release.sh [PROJECT_ID] [REMOTE_TARGET]

PROJECT_ID="${1:-}"
REMOTE_TARGET="${2:-carbonet2026@136.117.100.221}"
REMOTE_ROOT="${3:-/opt/Resonance}"

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 [PROJECT_ID] [REMOTE_TARGET]"
    exit 1
fi

echo "[rollback] attempting to rollback $PROJECT_ID on $REMOTE_TARGET..."

# Remote execution to find the previous version and update symlink
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "
    PROJECT_ROOT=\"$REMOTE_ROOT/var/releases/$PROJECT_ID\"
    RELEASES_DIR=\"\$PROJECT_ROOT/releases\"
    CURRENT_LINK=\"\$PROJECT_ROOT/current\"

    if [ ! -d \"\$RELEASES_DIR\" ]; then
        echo \"[rollback] Error: No releases found for $PROJECT_ID.\"
        exit 1
    fi

    # Find the previous version (second to last in sorted list)
    PREVIOUS_VERSION=\$(ls -r \"\$RELEASES_DIR\" | sed -n '2p')

    if [ -z \"\$PREVIOUS_VERSION\" ]; then
        echo \"[rollback] Error: No previous version to rollback to.\"
        exit 1
    fi

    echo \"[rollback] Found previous version: \$PREVIOUS_VERSION\"
    
    # Update symlink
    ln -sfn \"\$RELEASES_DIR/\$PREVIOUS_VERSION\" \"\$CURRENT_LINK\"
    
    # Restart service
    echo \"[rollback] restarting service carbonet@$PROJECT_ID...\"
    sudo systemctl restart carbonet@$PROJECT_ID
    
    echo \"[rollback] SUCCESS: Rolled back to \$PREVIOUS_VERSION\"
"
