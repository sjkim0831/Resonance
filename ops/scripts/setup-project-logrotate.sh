#!/usr/bin/env bash
set -euo pipefail

# Setup logrotate for a specific project on the remote server
# Usage: bash ops/scripts/setup-project-logrotate.sh [PROJECT_ID] [REMOTE_TARGET] [REMOTE_ROOT]

PROJECT_ID="${1:-}"
REMOTE_TARGET="${2:-carbonet2026@136.117.100.221}"
REMOTE_ROOT="${3:-/opt/Resonance}"

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 [PROJECT_ID] [REMOTE_TARGET] [REMOTE_ROOT]"
    exit 1
fi

echo "[logrotate] preparing logrotate config for $PROJECT_ID..."

# 1. Create the logrotate config locally
# Rotates daily, keeps 7 days, compresses old logs
cat > /tmp/carbonet-logrotate-${PROJECT_ID} <<EOF
$REMOTE_ROOT/var/logs/project-runtime/$PROJECT_ID/*.log {
    daily
    missingok
    rotate 7
    compress
    notifempty
    copytruncate
}
EOF

# 2. Upload to remote server
echo "[logrotate] uploading config to $REMOTE_TARGET..."
scp -o StrictHostKeyChecking=no /tmp/carbonet-logrotate-${PROJECT_ID} "$REMOTE_TARGET:/tmp/"

# 3. Move to /etc/logrotate.d/
echo "[logrotate] installing config to /etc/logrotate.d/..."
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "sudo mv /tmp/carbonet-logrotate-${PROJECT_ID} /etc/logrotate.d/carbonet-${PROJECT_ID}"

echo "[logrotate] setup complete for $PROJECT_ID."
