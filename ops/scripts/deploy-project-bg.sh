#!/usr/bin/env bash
set -euo pipefail

# Blue/Green Zero-Downtime Deployment
# Usage: bash ops/scripts/deploy-project-bg.sh [PROJECT_ID] [BASE_PORT] [REMOTE_TARGET] [REMOTE_ROOT]

PROJECT_ID="${1:-}"
BASE_PORT="${2:-18000}"
REMOTE_TARGET="${3:-carbonet2026@136.117.100.221}"
REMOTE_ROOT="${4:-/opt/Resonance}"

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 [PROJECT_ID] [BASE_PORT]"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCAL_RELEASE_DIR="$ROOT_DIR/var/releases/$PROJECT_ID"
REMOTE_PROJECT_ROOT="$REMOTE_ROOT/var/releases/$PROJECT_ID"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REMOTE_VERSION_DIR="$REMOTE_PROJECT_ROOT/releases/$TIMESTAMP"

echo "=========================================================="
echo " 🟢 Initiating Blue/Green Deployment for $PROJECT_ID"
echo "=========================================================="

# 1. Determine active color on remote
ACTIVE_COLOR=$(ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "\
    if [ -f \"$REMOTE_PROJECT_ROOT/active_color\" ]; then \
        cat \"$REMOTE_PROJECT_ROOT/active_color\"; \
    else \
        echo 'none'; \
    fi")

TARGET_COLOR="blue"
TARGET_PORT="$BASE_PORT"
OLD_COLOR="none"

if [ "$ACTIVE_COLOR" == "blue" ]; then
    TARGET_COLOR="green"
    TARGET_PORT=$((BASE_PORT + 1))
    OLD_COLOR="blue"
elif [ "$ACTIVE_COLOR" == "green" ]; then
    TARGET_COLOR="blue"
    TARGET_PORT="$BASE_PORT"
    OLD_COLOR="green"
fi

echo "[bg-deploy] Current Active: $ACTIVE_COLOR | Deploying to: $TARGET_COLOR (Port: $TARGET_PORT)"

# 2. Sync files to new release
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "mkdir -p $REMOTE_VERSION_DIR"
rsync -avz -e "ssh -o StrictHostKeyChecking=no" "$LOCAL_RELEASE_DIR/" "$REMOTE_TARGET:$REMOTE_VERSION_DIR/"

# 3. Setup Target Color (Symlink & .env)
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "
    ln -sfn $REMOTE_VERSION_DIR $REMOTE_PROJECT_ROOT/$TARGET_COLOR
    echo 'SERVER_PORT=$TARGET_PORT' > $REMOTE_PROJECT_ROOT/$TARGET_COLOR/.env
"

# 4. DB Migrations
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "bash $REMOTE_ROOT/ops/scripts/apply-project-db-migration.sh $PROJECT_ID $REMOTE_VERSION_DIR"

# 5. Start Target Service
echo "[bg-deploy] Starting carbonet-${TARGET_COLOR}@${PROJECT_ID}..."
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "sudo systemctl daemon-reload && sudo systemctl start carbonet-${TARGET_COLOR}@${PROJECT_ID}"

# 6. Health Check (Wait for Target to be ready)
echo "[bg-deploy] Waiting for health check on port $TARGET_PORT..."
HEALTH_CHECK_CMD="for i in {1..20}; do if curl -s http://localhost:$TARGET_PORT/api/runtime/project-info | grep -q $PROJECT_ID; then echo 'SUCCESS'; exit 0; fi; sleep 3; done; echo 'FAILED'; exit 1"

if ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "$HEALTH_CHECK_CMD"; then
    echo "[bg-deploy] ✅ Target color $TARGET_COLOR is UP AND RUNNING!"
    
    # 7. Switch Nginx Traffic (Zero-Downtime routing switch)
    bash "$ROOT_DIR/ops/scripts/update-nginx-project-routing.sh" "$PROJECT_ID" "$TARGET_PORT" "$REMOTE_TARGET"
    
    # 8. Mark active color
    ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "echo '$TARGET_COLOR' > $REMOTE_PROJECT_ROOT/active_color"
    
    # 9. Stop Old Service
    if [ "$OLD_COLOR" != "none" ]; then
        echo "[bg-deploy] Traffic switched to $TARGET_COLOR. Stopping old service $OLD_COLOR..."
        ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "sudo systemctl stop carbonet-${OLD_COLOR}@${PROJECT_ID} || true"
    fi
    echo "[bg-deploy] 🎉 Blue/Green Deployment SUCCESSFUL."
else
    echo "[bg-deploy] ❌ Target color $TARGET_COLOR failed to start. Nginx traffic remains untouched."
    ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "sudo systemctl stop carbonet-${TARGET_COLOR}@${PROJECT_ID} || true"
    exit 1
fi
