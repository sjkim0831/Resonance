#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
guard="$root/ops/scripts/postgres-storage-guard.sh"
service="$root/ops/systemd/postgres-storage-guard.service"
deploy="$root/ops/scripts/auto-deploy-main.sh"

bash -n "$guard"
grep -q '/opt/resonance-data/control-plane/bin/postgres-storage-guard.sh' "$service"
grep -q 'refresh_role_backup' "$guard"
grep -q 'systemctl start "$DEPLOY_TIMER"' "$guard"
grep -q 'PostgreSQL storage guard runtime synchronized' "$deploy"
grep -q 'systemctl restart postgres-storage-guard.service' "$deploy"

echo "POSTGRES_STORAGE_GUARD_INSTALL_PASS"
