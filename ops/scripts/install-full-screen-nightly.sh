#!/usr/bin/env bash
set -euo pipefail

root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
for unit in resonance-full-screen-nightly.service resonance-full-screen-nightly.timer; do
  sudo install -m 0644 "$root/ops/systemd/$unit" "/etc/systemd/system/$unit"
done
sudo systemctl daemon-reload
sudo systemctl enable --now resonance-full-screen-nightly.timer
systemctl is-active resonance-full-screen-nightly.timer
systemctl list-timers resonance-full-screen-nightly.timer --no-pager
