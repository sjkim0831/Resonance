#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
handler="$root/ops/scripts/carbonet-auto-deploy-failure-handler.sh"
service="$root/ops/systemd/carbonet-auto-deploy.service"
failure_service="$root/ops/systemd/carbonet-auto-deploy-failure-handler.service"

bash -n "$handler"
grep -q 'OnFailure=carbonet-auto-deploy-failure-handler.service' "$service"
grep -q '/opt/resonance-data/control-plane/bin/carbonet-auto-deploy-failure-handler.sh' "$failure_service"
grep -q 'category=NETWORK_TRANSIENT' "$handler"
grep -q '_SYSTEMD_INVOCATION_ID=' "$handler"
grep -q 'retry_allowed=true' "$handler"
grep -q 'category=DATABASE' "$handler"
grep -q 'category=E2E' "$handler"
grep -q 'systemd-run.*--quiet' "$handler"
grep -q 'retryAttempted' "$handler"

e2e_line="$(grep -n "category=E2E" "$handler" | head -1 | cut -d: -f1)"
database_line="$(grep -n "category=DATABASE" "$handler" | head -1 | cut -d: -f1)"
[[ "$e2e_line" -lt "$database_line" ]]

echo "AUTO_DEPLOY_FAILURE_HANDLER_PASS"
