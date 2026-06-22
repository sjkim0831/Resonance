#!/bin/bash
# Setup Cron Jobs for CUBRID Operations

# AI Guardian - 1분마다 체크
(crontab -l 2>/dev/null | grep -v "ai-guardian"; echo "*/1 * * * * /opt/Resonance/ops/scripts/ai-guardian.sh check >> /opt/Resonance/var/log/ai-guardian-cron.log 2>&1") | crontab -

# Backup Guardian - 6시간마다 검증
(crontab -l 2>/dev/null | grep -v "backup-guardian"; echo "0 */6 * * * /opt/Resonance/ops/scripts/backup-guardian.sh >> /opt/Resonance/var/log/backup-guardian.log 2>&1") | crontab -

# Daily backup - 매일 새벽 3시
(crontab -l 2>/dev/null | grep -v "backup-guardian.*create"; echo "0 3 * * * /opt/Resonance/ops/scripts/backup-guardian.sh create >> /opt/Resonance/var/log/backup-daily.log 2>&1") | crontab -

# Recovery Check - 매일 오전 9시
(crontab -l 2>/dev/null | grep -v "cubrid-recover"; echo "0 9 * * * /opt/Resonance/ops/scripts/cubrid-recover-v3.sh quick >> /opt/Resonance/var/log/recovery-check.log 2>&1") | crontab -

echo "Cron jobs installed:"
crontab -l 2>/dev/null | grep -E "(guardian|recover)" 
