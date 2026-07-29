#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-/opt/Resonance}"
CONTROL_BIN="${RESONANCE_CONTROL_BIN:-/opt/resonance-data/control-plane/bin}"
SYNC_SOURCE="$ROOT/ops/scripts/resonance-keycloak-carbonet-identity-sync.sh"
SYNC_RUNTIME="$CONTROL_BIN/resonance-keycloak-carbonet-identity-sync.sh"
SERVICE_FILE=/etc/systemd/system/resonance-keycloak-carbonet-identity-sync.service
TIMER_FILE=/etc/systemd/system/resonance-keycloak-carbonet-identity-sync.timer

[[ -f "$SYNC_SOURCE" ]] || {
  echo "[identity-sync-install] source script not found: $SYNC_SOURCE" >&2
  exit 1
}
sudo install -d -m 0755 "$CONTROL_BIN"
sudo install -m 0750 -o sjkim -g sjkim "$SYNC_SOURCE" "$SYNC_RUNTIME"

sudo tee "$SERVICE_FILE" >/dev/null <<UNIT
[Unit]
Description=Synchronize Keycloak identities to Carbonet authority and actor scopes
After=network-online.target

[Service]
Type=oneshot
User=sjkim
WorkingDirectory=/opt/resonance-data
ExecStart=/usr/bin/bash $SYNC_RUNTIME
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
