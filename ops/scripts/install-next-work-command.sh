#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${1:-/opt/Resonance}"
UNIT_SOURCE="$ROOT_DIR/ops/systemd/resonance-next-work.service"
UNIT_TARGET="/etc/systemd/system/resonance-next-work.service"

[[ -s "$UNIT_SOURCE" ]] || {
  echo "[next-work-install] missing unit: $UNIT_SOURCE" >&2
  exit 2
}
[[ -s "$ROOT_DIR/ops/scripts/run-next-project-work.sh" ]] || {
  echo "[next-work-install] missing runner" >&2
  exit 2
}

sudo install -m 0644 "$UNIT_SOURCE" "$UNIT_TARGET"
sudo systemctl daemon-reload
sudo systemctl reset-failed resonance-next-work.service || true
echo "[next-work-install] installed resonance-next-work.service"
echo "[next-work-install] run: sudo systemctl start resonance-next-work.service"
echo "[next-work-install] report: $ROOT_DIR/var/reports/next-work/latest.json"

