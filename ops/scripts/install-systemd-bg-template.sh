#!/usr/bin/env bash
set -euo pipefail

# Install Blue/Green Systemd templates for zero-downtime deployments
# Usage: bash ops/scripts/install-systemd-bg-template.sh [REMOTE_TARGET] [REMOTE_ROOT]

REMOTE_TARGET="${1:-carbonet2026@136.117.100.221}"
REMOTE_ROOT="${2:-/opt/Resonance}"
USER=$(echo $REMOTE_TARGET | cut -d'@' -f1)

echo "[systemd-bg] preparing blue-green systemd templates for $REMOTE_TARGET"

# 1. Create Blue template
cat > /tmp/carbonet-blue@.service <<EOF
[Unit]
Description=Carbonet Independent Runtime (BLUE) - %i
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$REMOTE_ROOT/var/releases/%i/blue
EnvironmentFile=-$REMOTE_ROOT/var/releases/%i/blue/.env
ExecStart=/usr/bin/bash run.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 2. Create Green template
cat > /tmp/carbonet-green@.service <<EOF
[Unit]
Description=Carbonet Independent Runtime (GREEN) - %i
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$REMOTE_ROOT/var/releases/%i/green
EnvironmentFile=-$REMOTE_ROOT/var/releases/%i/green/.env
ExecStart=/usr/bin/bash run.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 3. Transfer and reload
echo "[systemd-bg] uploading and installing templates..."
scp -o StrictHostKeyChecking=no /tmp/carbonet-blue@.service /tmp/carbonet-green@.service "$REMOTE_TARGET:/tmp/"
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "
    sudo mv /tmp/carbonet-blue@.service /etc/systemd/system/
    sudo mv /tmp/carbonet-green@.service /etc/systemd/system/
    sudo systemctl daemon-reload
"
echo "[systemd-bg] Blue/Green templates installed successfully."
