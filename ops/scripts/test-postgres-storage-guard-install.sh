#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
guard="$root/ops/scripts/postgres-storage-guard.sh"
cache_test="$root/ops/scripts/test-postgres-storage-guard-cache.sh"
service="$root/ops/systemd/postgres-storage-guard.service"
deploy="$root/ops/scripts/auto-deploy-main.sh"

bash -n "$guard"
bash -n "$cache_test"
grep -q '/opt/resonance-data/control-plane/bin/postgres-storage-guard.sh' "$service"
grep -q '^User=root$' "$service"
grep -q 'refresh_role_backup' "$guard"
grep -q 'latest_valid_scheduled_backup' "$guard"
grep -q 'cached_gzip_test' "$guard"
grep -q 'cached_scheduled_backup_test' "$guard"
grep -Fq "'%d|%i|%s|%y|%z'" "$guard"
grep -q 'FULL_VALIDATION_TTL_SECONDS.*3600' "$guard"
grep -q 'FULL_VALIDATION_TTL_SECONDS.*21600' "$guard"
grep -q 'CACHE_REQUIRED_UID=0' "$guard"
grep -q "CACHE_REQUIRED_GID=0" "$guard"
grep -q 'chmod 0600' "$guard"
grep -q 'mv -fT' "$guard"
grep -Fq '[[ -e "$MAINTENANCE_HOLD" || -L "$MAINTENANCE_HOLD" ]]' "$guard"
grep -q 'systemctl start "$DEPLOY_TIMER"' "$guard"
grep -q 'PostgreSQL storage guard runtime synchronized' "$deploy"
grep -q 'systemctl restart postgres-storage-guard.service' "$deploy"

bash "$cache_test"

echo "POSTGRES_STORAGE_GUARD_INSTALL_PASS"
