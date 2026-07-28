#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
for unit in \
  resonance-project-bootstrap-worker.service \
  resonance-project-bootstrap-worker.timer \
  resonance-design-release-worker.service \
  resonance-design-release-worker.timer; do
  sudo install -m 0644 "$ROOT/ops/systemd/$unit" "/etc/systemd/system/$unit"
done
sudo install -d -o sjkim -g sjkim -m 0750 /opt/resonance-data/project-workspaces
sudo systemctl daemon-reload
sudo systemctl enable --now resonance-project-bootstrap-worker.timer
sudo systemctl enable --now resonance-design-release-worker.timer
systemctl is-active resonance-project-bootstrap-worker.timer
systemctl is-active resonance-design-release-worker.timer
systemctl list-timers resonance-project-bootstrap-worker.timer --no-pager
systemctl list-timers resonance-design-release-worker.timer --no-pager
