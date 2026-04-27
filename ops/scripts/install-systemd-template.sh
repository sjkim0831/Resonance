#!/usr/bin/env bash
set -euo pipefail

# Install Systemd template for independent Carbonet projects on a remote server
# Usage: bash ops/scripts/install-systemd-template.sh [REMOTE_TARGET] [REMOTE_ROOT]

REMOTE_TARGET="${1:-carbonet2026@136.117.100.221}"
REMOTE_ROOT="${2:-/opt/Resonance}"

echo "[systemd] preparing systemd template installation for $REMOTE_TARGET"

# 1. Create the systemd template locally
cat > /tmp/carbonet@.service <<EOF
[Unit]
Description=Carbonet Independent Runtime - %i
After=network.target

[Service]
Type=simple
User=$(echo $REMOTE_TARGET | cut -d'@' -f1)
WorkingDirectory=$REMOTE_ROOT/var/releases/%i/current
# Load environment variables (like SERVER_PORT) from the .env file if it exists
EnvironmentFile=-$REMOTE_ROOT/var/releases/%i/current/.env
ExecStart=/usr/bin/bash run.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 2. Transfer to remote server
echo "[systemd] uploading template to remote server (/tmp)..."
scp -o StrictHostKeyChecking=no /tmp/carbonet@.service "$REMOTE_TARGET:/tmp/carbonet@.service"

# 3. Install and reload systemd on remote server
echo "[systemd] installing template to /etc/systemd/system/ and reloading daemon..."
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "sudo mv /tmp/carbonet@.service /etc/systemd/system/carbonet@.service && sudo systemctl daemon-reload"

echo "[systemd] installation complete."
echo "[systemd] You can now manage services like this:"
echo "  sudo systemctl start carbonet@p003"
echo "  sudo systemctl status carbonet@p003"
