#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
for unit in \
  resonance-design-asset-snapshot.service \
  resonance-design-asset-snapshot.timer; do
  sudo install -m 0644 "$ROOT/ops/systemd/$unit" "/etc/systemd/system/$unit"
done
sudo systemctl daemon-reload
sudo systemctl enable --now resonance-design-asset-snapshot.timer
sudo systemctl start resonance-design-asset-snapshot.service
systemctl is-active resonance-design-asset-snapshot.timer
systemctl show resonance-design-asset-snapshot.service \
  -p ActiveState -p Result -p ExecMainStatus --no-pager
