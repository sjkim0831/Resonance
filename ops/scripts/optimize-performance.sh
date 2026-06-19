#!/bin/bash
# Resonance Carbonet Performance Optimization Script
# Run as: sudo ./ops/scripts/optimize-performance.sh

set -e

echo "[+] Setting CPU performance governor..."
for cpu in /sys/devices/system/cpu/cpu*; do
    echo performance > $cpu/cpufreq/scaling_governor 2>/dev/null || true
done

echo "[+] Applying network tuning..."
cat > /etc/sysctl.d/99-carbonet-performance.conf << EOF
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.ipv4.tcp_congestion_control = bbr
net.core.default_qdisc = fq
EOF
sysctl -p /etc/sysctl.d/99-carbonet-performance.conf

echo "[+] Enabling NVIDIA persistence mode..."
nvidia-smi -pm 1 || echo "NVIDIA persistence mode: requires root or proper permissions"

echo "[+] Performance optimization complete!"
echo ""
echo "Current settings:"
echo "  CPU Governor: $(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor)"
echo "  TCP Congestion: $(sysctl -n net.ipv4.tcp_congestion_control)"
echo "  NVIDIA Persistence: $(nvidia-smi -q | grep 'Persistence Mode' | head -1 | awk '{print $4}')"