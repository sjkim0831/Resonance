#!/bin/bash
# Setup Cron Jobs v2

# AI Guardian - 1분마다 (auto-recover 포함)
(crontab -l 2>/dev/null | grep -v "ai-guardian"; echo "*/1 * * * * /opt/Resonance/ops/scripts/ai-guardian-v2.sh check >> /opt/Resonance/var/log/ai-guardian.log 2>&1") | crontab -

# Backup Guardian - 6시간마다 검증
(crontab -l 2>/dev/null | grep -v "backup-guardian-v2"; echo "0 */6 * * * /opt/Resonance/ops/scripts/backup-guardian-v2.sh >> /opt/Resonance/var/log/backup-guardian.log 2>&1") | crontab -

# Daily backup - 매일 새벽 3시
(crontab -l 2>/dev/null | grep -v "backup-guardian.*create"; echo "0 3 * * * /opt/Resonance/ops/scripts/backup-guardian-v2.sh create >> /opt/Resonance/var/log/backup-daily.log 2>&1") | crontab -

# Recovery check - 매일 오전 9시
(crontab -l 2>/dev/null | grep -v "cubrid-framework"; echo "0 9 * * * /opt/Resonance/ops/scripts/cubrid-framework.sh health >> /opt/Resonance/var/log/recovery-check.log 2>&1") | crontab -

echo "Cron Jobs v2 installed:"
crontab -l 2>/dev/null | grep -E "(guardian|framework)" | head -10
