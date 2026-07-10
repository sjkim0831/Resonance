#!/usr/bin/env bash
set -eu
mkdir -p /opt/Resonance/var/restore-drills/logs /opt/Resonance/var/release-snapshots/logs
tmp=$(mktemp)
crontab -l 2>/dev/null | grep -v '# carbonet-recovery-managed' > "$tmp" || true
cat >> "$tmp" <<'EOF'
15 * * * * flock -n /tmp/carbonet-release-snapshot.lock /opt/Resonance/ops/scripts/create-release-snapshot.sh >> /opt/Resonance/var/release-snapshots/logs/schedule.log 2>&1 # carbonet-recovery-managed
30 5 * * 0 flock -n /tmp/carbonet-pitr-drill.lock /opt/Resonance/ops/scripts/postgres-pitr-drill.sh >> /opt/Resonance/var/restore-drills/logs/schedule.log 2>&1 # carbonet-recovery-managed
EOF
crontab "$tmp"
rm -f "$tmp"
crontab -l | grep carbonet-recovery-managed
