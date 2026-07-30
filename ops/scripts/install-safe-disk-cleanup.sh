#!/usr/bin/env bash
set -euo pipefail

root="${RESONANCE_REPO:-/opt/Resonance/var/deploy-worktrees/runtime-build}"
for unit in resonance-safe-disk-cleanup.service resonance-safe-disk-cleanup.timer; do
  sudo install -m 0644 "$root/ops/systemd/$unit" "/etc/systemd/system/$unit"
done
sudo systemctl daemon-reload
sudo systemctl enable --now resonance-safe-disk-cleanup.timer
systemctl is-active resonance-safe-disk-cleanup.timer
systemctl list-timers resonance-safe-disk-cleanup.timer --no-pager
