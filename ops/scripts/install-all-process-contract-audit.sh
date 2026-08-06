#!/usr/bin/env bash
set -Eeuo pipefail
umask 027
{ set +x; } 2>/dev/null

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
CONTROL_PLANE_BIN="${RESONANCE_CONTROL_PLANE_BIN:-/opt/resonance-data/control-plane/bin}"
REPORT_DIR="${RESONANCE_AUDIT_REPORT_DIR:-/opt/resonance-data/control-plane/reports/process-contract-audit}"
RUN_DIR="${RESONANCE_AUDIT_RUN_DIR:-/opt/resonance-data/control-plane/run}"
SYSTEMD_DIR="${RESONANCE_SYSTEMD_DIR:-/etc/systemd/system}"
REPORT_PARENT="$(dirname "$REPORT_DIR")"

for file in \
  ops/scripts/resonance-all-process-contract-audit.sh \
  ops/scripts/resonance-all-process-contract-audit.mjs \
  ops/scripts/run-all-process-contract-audit-hourly.sh \
  ops/scripts/install-all-process-contract-audit.sh \
  ops/systemd/resonance-all-process-contract-audit.service \
  ops/systemd/resonance-all-process-contract-audit.timer; do
  [[ -f "$ROOT/$file" ]] || { echo "[install-process-contract-audit] missing $file" >&2; exit 2; }
done
command -v cmp >/dev/null 2>&1 || { echo '[install-process-contract-audit] cmp is required' >&2; exit 2; }

installation_matches() {
  local source destination
  while IFS='|' read -r source destination; do
    [[ -f "$destination" ]] && cmp -s "$ROOT/$source" "$destination" || return 1
  done <<EOF
ops/scripts/resonance-all-process-contract-audit.sh|$CONTROL_PLANE_BIN/resonance-all-process-contract-audit.sh
ops/scripts/resonance-all-process-contract-audit.mjs|$CONTROL_PLANE_BIN/resonance-all-process-contract-audit.mjs
ops/scripts/run-all-process-contract-audit-hourly.sh|$CONTROL_PLANE_BIN/run-all-process-contract-audit-hourly.sh
ops/scripts/install-all-process-contract-audit.sh|$CONTROL_PLANE_BIN/install-all-process-contract-audit.sh
ops/systemd/resonance-all-process-contract-audit.service|$SYSTEMD_DIR/resonance-all-process-contract-audit.service
ops/systemd/resonance-all-process-contract-audit.timer|$SYSTEMD_DIR/resonance-all-process-contract-audit.timer
EOF
}

if [[ "${1:-}" == '--check' ]]; then
  installation_matches
  exit $?
fi
[[ $# -eq 0 ]] || { echo '[install-process-contract-audit] unsupported argument' >&2; exit 2; }

bash -n "$ROOT/ops/scripts/resonance-all-process-contract-audit.sh"
bash -n "$ROOT/ops/scripts/run-all-process-contract-audit-hourly.sh"
node --check "$ROOT/ops/scripts/resonance-all-process-contract-audit.mjs"

sudo -n install -d -m 0755 -o root -g root "$CONTROL_PLANE_BIN"
# Keep report filenames private while granting the sjkim oneshot service the
# execute permission required to traverse the shared reports parent.
sudo -n install -d -m 0750 -o root -g sjkim "$REPORT_PARENT"
sudo -n install -d -m 0750 -o sjkim -g sjkim "$REPORT_DIR" "$RUN_DIR"
sudo -n install -m 0750 -o sjkim -g sjkim \
  "$ROOT/ops/scripts/resonance-all-process-contract-audit.sh" \
  "$CONTROL_PLANE_BIN/resonance-all-process-contract-audit.sh"
sudo -n install -m 0750 -o sjkim -g sjkim \
  "$ROOT/ops/scripts/resonance-all-process-contract-audit.mjs" \
  "$CONTROL_PLANE_BIN/resonance-all-process-contract-audit.mjs"
sudo -n install -m 0750 -o sjkim -g sjkim \
  "$ROOT/ops/scripts/run-all-process-contract-audit-hourly.sh" \
  "$CONTROL_PLANE_BIN/run-all-process-contract-audit-hourly.sh"
sudo -n install -m 0750 -o sjkim -g sjkim \
  "$ROOT/ops/scripts/install-all-process-contract-audit.sh" \
  "$CONTROL_PLANE_BIN/install-all-process-contract-audit.sh"
sudo -n install -m 0644 -o root -g root \
  "$ROOT/ops/systemd/resonance-all-process-contract-audit.service" \
  "$SYSTEMD_DIR/resonance-all-process-contract-audit.service"
sudo -n install -m 0644 -o root -g root \
  "$ROOT/ops/systemd/resonance-all-process-contract-audit.timer" \
  "$SYSTEMD_DIR/resonance-all-process-contract-audit.timer"
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now resonance-all-process-contract-audit.timer >/dev/null
echo '[install-process-contract-audit] hourly timer synchronized; audit service was not started inline'
