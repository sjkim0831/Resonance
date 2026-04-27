#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project-paths.sh"

LOG_DIR="${LOG_ROOT}/cron"

echo "[cron.service]"
if systemctl is-active cron >/dev/null 2>&1; then
    systemctl is-active cron
else
    echo "systemctl unavailable or access denied, falling back to process check"
    ps -ef | grep '[c]ron' || true
fi
echo

echo "[managed crontab block]"
if crontab -l >/tmp/carbonet_crontab_check.$$ 2>/dev/null; then
    sed -n '/# BEGIN CARBONET MANAGED CRON/,/# END CARBONET MANAGED CRON/p' /tmp/carbonet_crontab_check.$$
    rm -f /tmp/carbonet_crontab_check.$$
else
    echo "crontab 조회 권한이 없거나 접근이 제한된 환경입니다."
fi
echo

echo "[recent heartbeat log]"
if [[ -f "${LOG_DIR}/heartbeat.log" ]]; then
    tail -n 10 "${LOG_DIR}/heartbeat.log"
else
    echo "heartbeat.log not found"
fi
echo

echo "[recent scheduler logs]"
for name in external_token_refresh certificate_expiry_sync nightly_emission_aggregation; do
    file="${LOG_DIR}/${name}.log"
    echo "## ${name}"
    if [[ -f "${file}" ]]; then
        tail -n 5 "${file}"
    else
        echo "${file} not found"
    fi
    echo
done
