#!/usr/bin/env bash
set -euo pipefail

# Deploy a specific project release to the remote server
# Usage: bash ops/scripts/deploy-project-release.sh [PROJECT_ID] [PORT] [REMOTE_TARGET]

PROJECT_ID="${1:-}"
PORT="${2:-18000}"
REMOTE_TARGET="${3:-carbonet2026@136.117.100.221}"
REMOTE_ROOT="${4:-/opt/Resonance}"

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 [PROJECT_ID] [PORT] [REMOTE_TARGET] [REMOTE_ROOT]"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCAL_RELEASE_DIR="$ROOT_DIR/var/releases/$PROJECT_ID"
REMOTE_RELEASE_DIR="$REMOTE_ROOT/var/releases/$PROJECT_ID"

if [ ! -d "$LOCAL_RELEASE_DIR" ]; then
    echo "[deploy] Local release directory not found: $LOCAL_RELEASE_DIR"
    echo "[deploy] Please run: bash ops/scripts/assemble-project-release.sh $PROJECT_ID"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REMOTE_PROJECT_ROOT="$REMOTE_ROOT/var/releases/$PROJECT_ID"
REMOTE_VERSION_DIR="$REMOTE_PROJECT_ROOT/releases/$TIMESTAMP"
REMOTE_CURRENT_LINK="$REMOTE_PROJECT_ROOT/current"

echo "[deploy] starting deployment of $PROJECT_ID to $REMOTE_TARGET on PORT $PORT"

# 1. Ensure remote directories exist
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "mkdir -p $REMOTE_VERSION_DIR"

# 2. Sync files to the new version directory
echo "[deploy] syncing files to version: $TIMESTAMP..."
rsync -avz -e "ssh -o StrictHostKeyChecking=no" \
    "$LOCAL_RELEASE_DIR/" \
    "$REMOTE_TARGET:$REMOTE_VERSION_DIR/"

# Write PORT to .env file in the current release directory so systemd can read it
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "echo 'SERVER_PORT=$PORT' > $REMOTE_VERSION_DIR/.env"

# 3. Apply DB migrations
echo "[deploy] applying DB migrations..."
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "bash $REMOTE_ROOT/ops/scripts/apply-project-db-migration.sh $PROJECT_ID $REMOTE_VERSION_DIR"

# 4. Update symlink and restart service
# We assume the systemd service points to the 'current' directory and reads EnvironmentFile
echo "[deploy] updating 'current' symlink and restarting service..."
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "ln -sfn $REMOTE_VERSION_DIR $REMOTE_CURRENT_LINK && sudo systemctl restart carbonet@$PROJECT_ID"

# 5. Health Check
echo "[deploy] waiting for service to start and performing health check on port $PORT..."
HEALTH_CHECK_CMD="for i in {1..15}; do if curl -s http://localhost:$PORT/api/runtime/project-info | grep -q $PROJECT_ID; then echo 'SUCCESS'; exit 0; fi; sleep 2; done; echo 'FAILED'; exit 1"
if ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "$HEALTH_CHECK_CMD"; then
    echo "[deploy] Deployment SUCCESS: Project $PROJECT_ID is up and running on port $PORT!"
    # Update Nginx routing after success
    echo "[deploy] updating nginx routing..."
    bash "$ROOT_DIR/ops/scripts/update-nginx-project-routing.sh" "$PROJECT_ID" "$PORT" "$REMOTE_TARGET"
else
    echo "[deploy] Deployment FAILED: Project $PROJECT_ID failed to start or health check timed out."
    echo "[deploy] Initiating AUTO-ROLLBACK for $PROJECT_ID..."
    bash "$ROOT_DIR/ops/scripts/rollback-project-release.sh" "$PROJECT_ID" "$REMOTE_TARGET" "$REMOTE_ROOT"
    echo "[deploy] Auto-rollback completed. The system is back to the previous stable state."
    exit 1
fi

echo "[deploy] deployment process complete."
