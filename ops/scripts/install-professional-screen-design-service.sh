#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-/opt/Resonance}"
UNIT_SOURCE="$ROOT/ops/systemd/resonance-professional-screen-design.service"
UNIT_TARGET="/etc/systemd/system/resonance-professional-screen-design.service"

[[ -s "$UNIT_SOURCE" ]] || {
  echo "[professional-screen-design] unit missing: $UNIT_SOURCE" >&2
  exit 1
}

sudo install -m 0644 "$UNIT_SOURCE" "$UNIT_TARGET"
sudo systemctl daemon-reload
echo '[professional-screen-design] installed resonance-professional-screen-design.service'
