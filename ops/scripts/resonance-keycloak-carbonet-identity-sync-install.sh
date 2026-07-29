#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-/opt/Resonance}"
SERVICE_FILE=/etc/systemd/system/resonance-keycloak-carbonet-identity-sync.service
TIMER_FILE=/etc/systemd/system/resonance-keycloak-carbonet-identity-sync.timer

sudo tee "$SERVICE_FILE" >/dev/null <<UNIT
[Unit]
Description=Synchronize Keycloak identities to Carbonet authority and actor scopes
After=network-online.target

[Service]
Type=oneshot
User=sjkim
WorkingDirectory=$ROOT
Environment=RESONANCE_ROOT=$ROOT
ExecStart=/usr/bin/bash $ROOT/ops/scripts/resonance-keycloak-carbonet-identity-sync.sh
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
UNIT

sudo tee "$TIMER_FILE" >/dev/null <<'UNIT'
[Unit]
Description=Synchronize Keycloak identities to Carbonet every minute

[Timer]
OnBootSec=45s
OnUnitActiveSec=60s
AccuracySec=5s
Persistent=true
Unit=resonance-keycloak-carbonet-identity-sync.service

[Install]
WantedBy=timers.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now resonance-keycloak-carbonet-identity-sync.timer
echo "[identity-sync-install] PASS timer=resonance-keycloak-carbonet-identity-sync.timer"
