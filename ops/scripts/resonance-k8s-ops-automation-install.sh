#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"

install_unit() {
  local name="$1"
  local src="$2"
  install -m 0644 "$src" "/etc/systemd/system/$name"
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

cat >"$tmp_dir/resonance-backend-auto-redeploy.service" <<EOF
[Unit]
Description=Resonance backend auto build and Kubernetes redeploy
After=network-online.target docker.service containerd.service kubelet.service

[Service]
Type=oneshot
User=root
WorkingDirectory=$ROOT_DIR
Environment=KUBECONFIG=/etc/kubernetes/admin.conf
ExecStart=$ROOT_DIR/ops/scripts/resonance-backend-auto-redeploy.sh
EOF

cat >"$tmp_dir/resonance-backend-auto-redeploy.timer" <<'EOF'
[Unit]
Description=Run Resonance backend auto redeploy every 45 seconds

[Timer]
OnBootSec=60s
OnUnitActiveSec=45s
AccuracySec=5s
Unit=resonance-backend-auto-redeploy.service

[Install]
WantedBy=timers.target
EOF

cat >"$tmp_dir/resonance-frontend-auto-build.service" <<EOF
[Unit]
Description=Resonance frontend auto build for Kubernetes overlay
After=network-online.target

[Service]
Type=oneshot
User=sjkim
WorkingDirectory=$ROOT_DIR
ExecStart=$ROOT_DIR/ops/scripts/resonance-frontend-auto-build.sh
EOF

cat >"$tmp_dir/resonance-frontend-auto-build.timer" <<'EOF'
[Unit]
Description=Run Resonance frontend auto build every 10 seconds

[Timer]
OnBootSec=30s
OnUnitActiveSec=10s
AccuracySec=2s
Unit=resonance-frontend-auto-build.service

[Install]
WantedBy=timers.target
EOF

cat >"$tmp_dir/resonance-k8s-ops-doctor.service" <<EOF
[Unit]
Description=Resonance Kubernetes runtime and CUBRID broker doctor
After=network-online.target containerd.service kubelet.service

[Service]
Type=oneshot
User=root
WorkingDirectory=$ROOT_DIR
Environment=KUBECONFIG=/etc/kubernetes/admin.conf
ExecStart=$ROOT_DIR/ops/scripts/resonance-k8s-ops-doctor.sh
EOF

cat >"$tmp_dir/resonance-k8s-ops-doctor.timer" <<'EOF'
[Unit]
Description=Run Resonance Kubernetes operations doctor every minute

[Timer]
OnBootSec=90s
OnUnitActiveSec=60s
AccuracySec=10s
Persistent=true
Unit=resonance-k8s-ops-doctor.service

[Install]
WantedBy=timers.target
EOF

cat >"$tmp_dir/resonance-k8s-housekeeper.service" <<EOF
[Unit]
Description=Resonance Kubernetes node image disk and log housekeeper
After=network-online.target containerd.service docker.service

[Service]
Type=oneshot
User=root
WorkingDirectory=$ROOT_DIR
Environment=KUBECONFIG=/etc/kubernetes/admin.conf
ExecStart=$ROOT_DIR/ops/scripts/resonance-k8s-housekeeper.sh
EOF

cat >"$tmp_dir/resonance-k8s-housekeeper.timer" <<'EOF'
[Unit]
Description=Run Resonance Kubernetes housekeeper hourly

[Timer]
OnBootSec=5min
OnUnitActiveSec=1h
AccuracySec=5min
Persistent=true
Unit=resonance-k8s-housekeeper.service

[Install]
WantedBy=timers.target
EOF

install_unit resonance-backend-auto-redeploy.service "$tmp_dir/resonance-backend-auto-redeploy.service"
install_unit resonance-backend-auto-redeploy.timer "$tmp_dir/resonance-backend-auto-redeploy.timer"
install_unit resonance-frontend-auto-build.service "$tmp_dir/resonance-frontend-auto-build.service"
install_unit resonance-frontend-auto-build.timer "$tmp_dir/resonance-frontend-auto-build.timer"
install_unit resonance-k8s-ops-doctor.service "$tmp_dir/resonance-k8s-ops-doctor.service"
install_unit resonance-k8s-ops-doctor.timer "$tmp_dir/resonance-k8s-ops-doctor.timer"
install_unit resonance-k8s-housekeeper.service "$tmp_dir/resonance-k8s-housekeeper.service"
install_unit resonance-k8s-housekeeper.timer "$tmp_dir/resonance-k8s-housekeeper.timer"

systemctl daemon-reload
systemctl enable --now resonance-frontend-auto-build.timer
systemctl enable --now resonance-backend-auto-redeploy.timer
systemctl enable --now resonance-k8s-ops-doctor.timer
systemctl enable --now resonance-k8s-housekeeper.timer
systemctl list-timers --all | grep -E 'resonance-(frontend|backend|k8s-ops|k8s-housekeeper)' || true
