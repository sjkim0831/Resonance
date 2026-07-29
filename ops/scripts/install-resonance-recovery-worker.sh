#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SOURCE="$ROOT/ops/scripts/resonance-recovery-worker.sh"
RETENTION_SOURCE="$ROOT/ops/scripts/prune-on-demand-backups.sh"
DRILL_SOURCE="$ROOT/ops/scripts/run-isolated-restore-drill.sh"
INSTALL_DIR="${RESONANCE_RECOVERY_INSTALL_DIR:-$HOME/.local/lib/resonance}"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
[[ -f "$SOURCE" ]] || {
  echo "[recovery-worker] source script missing" >&2
  exit 2
}
[[ -f "$RETENTION_SOURCE" ]] || {
  echo "[recovery-worker] retention script missing" >&2
  exit 2
}
[[ -f "$DRILL_SOURCE" ]] || {
  echo "[recovery-worker] restore drill script missing" >&2
  exit 2
}
mkdir -p "$INSTALL_DIR" "$UNIT_DIR"
install -m 0750 "$SOURCE" "$INSTALL_DIR/resonance-recovery-worker.sh"
install -m 0750 "$RETENTION_SOURCE" "$INSTALL_DIR/prune-on-demand-backups.sh"
install -m 0750 "$DRILL_SOURCE" "$INSTALL_DIR/run-isolated-restore-drill.sh"

cat >"$UNIT_DIR/resonance-recovery-worker.service" <<EOF
[Unit]
Description=Resonance non-destructive recovery command worker
After=network-online.target

[Service]
Type=oneshot
ExecStart=$INSTALL_DIR/resonance-recovery-worker.sh
Environment=KUBECONFIG=/home/sjkim/.kube/config
TimeoutStartSec=90min
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=6
EOF

cat >"$UNIT_DIR/resonance-recovery-worker.timer" <<'EOF'
[Unit]
Description=Poll Resonance recovery commands

[Timer]
OnBootSec=2min
OnUnitInactiveSec=1min
RandomizedDelaySec=10s
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now resonance-recovery-worker.timer
systemctl --user start resonance-recovery-worker.service
systemctl --user is-active resonance-recovery-worker.timer
