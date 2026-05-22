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

cat >"$tmp_dir/resonance-startup-watchdog.service" <<EOF
[Unit]
Description=Resonance startup watchdog for 17890 and fallback runtime recovery
After=network-online.target docker.service containerd.service kubelet.service

[Service]
Type=oneshot
User=sjkim
WorkingDirectory=$ROOT_DIR
ExecStart=$ROOT_DIR/ops/scripts/resonance-startup-watchdog.sh
EOF

cat >"$tmp_dir/resonance-startup-watchdog.timer" <<'EOF'
[Unit]
Description=Run Resonance startup watchdog every 2 minutes

[Timer]
OnBootSec=90s
OnUnitActiveSec=2min
AccuracySec=20s
Persistent=true
Unit=resonance-startup-watchdog.service

[Install]
WantedBy=timers.target
EOF

cat >"$tmp_dir/resonance-ownership-normalize.service" <<EOF
[Unit]
Description=Normalize Resonance generated file ownership
After=network-online.target

[Service]
Type=oneshot
User=root
WorkingDirectory=$ROOT_DIR
ExecStart=$ROOT_DIR/ops/scripts/resonance-ownership-normalize.sh
EOF

cat >"$tmp_dir/resonance-ownership-normalize.timer" <<'EOF'
[Unit]
Description=Run Resonance generated file ownership normalization

[Timer]
OnBootSec=45s
OnUnitActiveSec=5min
AccuracySec=30s
Persistent=true
Unit=resonance-ownership-normalize.service

[Install]
WantedBy=timers.target
EOF

cat >"$tmp_dir/resonance-k8s-boot-stabilize.service" <<EOF
[Unit]
Description=Stabilize Resonance Kubernetes workloads after boot
After=network-online.target containerd.service kubelet.service

[Service]
Type=oneshot
User=root
WorkingDirectory=$ROOT_DIR
Environment=KUBECONFIG=/home/sjkim/.kube/config
ExecStart=$ROOT_DIR/ops/scripts/resonance-k8s-boot-stabilize.sh
EOF

cat >"$tmp_dir/resonance-k8s-boot-stabilize.timer" <<'EOF'
[Unit]
Description=Run Resonance Kubernetes boot stabilizer

[Timer]
OnBootSec=75s
OnUnitActiveSec=3min
AccuracySec=20s
Persistent=true
Unit=resonance-k8s-boot-stabilize.service

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
install_unit resonance-startup-watchdog.service "$tmp_dir/resonance-startup-watchdog.service"
install_unit resonance-startup-watchdog.timer "$tmp_dir/resonance-startup-watchdog.timer"
install_unit resonance-ownership-normalize.service "$tmp_dir/resonance-ownership-normalize.service"
install_unit resonance-ownership-normalize.timer "$tmp_dir/resonance-ownership-normalize.timer"
install_unit resonance-k8s-boot-stabilize.service "$tmp_dir/resonance-k8s-boot-stabilize.service"
install_unit resonance-k8s-boot-stabilize.timer "$tmp_dir/resonance-k8s-boot-stabilize.timer"

systemctl daemon-reload
systemctl enable --now resonance-frontend-auto-build.timer
systemctl enable --now resonance-backend-auto-redeploy.timer
systemctl enable --now resonance-k8s-ops-doctor.timer
systemctl enable --now resonance-k8s-housekeeper.timer
systemctl enable --now resonance-startup-watchdog.timer
systemctl enable --now resonance-ownership-normalize.timer
systemctl enable --now resonance-k8s-boot-stabilize.timer
systemctl list-timers --all | grep -E 'resonance-(frontend|backend|k8s-ops|k8s-housekeeper)' || true
