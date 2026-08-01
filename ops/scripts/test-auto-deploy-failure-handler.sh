#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
handler="$root/ops/scripts/carbonet-auto-deploy-failure-handler.sh"
service="$root/ops/systemd/carbonet-auto-deploy.service"
failure_service="$root/ops/systemd/carbonet-auto-deploy-failure-handler.service"
deploy="$root/ops/scripts/auto-deploy-main.sh"
notifier="$root/ops/scripts/carbonet-deploy-notify.sh"

bash -n "$handler"
bash -n "$notifier"
grep -q 'OnFailure=carbonet-auto-deploy-failure-handler.service' "$service"
grep -q '/opt/resonance-data/control-plane/bin/carbonet-auto-deploy-failure-handler.sh' "$failure_service"
grep -q 'category=NETWORK_TRANSIENT' "$handler"
grep -q '_SYSTEMD_INVOCATION_ID=' "$handler"
grep -q 'retry_allowed=true' "$handler"
grep -q 'category=DATABASE' "$handler"
grep -q 'category=E2E' "$handler"
grep -q 'systemd-run.*--quiet' "$handler"
grep -q 'retryAttempted' "$handler"
grep -q 'arg status RUNNING' "$deploy"
grep -q 'carbonet-deploy-notify.sh' "$handler"
grep -q 'notification-dedupe' "$notifier"
grep -q 'application/vnd.microsoft.card.adaptive' "$notifier"
grep -q 'capacity-gate.*(FAIL|BLOCK|refus)' "$handler"
grep -q 'readiness returned 50\[234\]' "$handler"

if command -v jq >/dev/null 2>&1; then
  fixture="$(mktemp -d)"
  trap 'rm -rf "$fixture"' EXIT
  cat >"$fixture/deploy-status.json" <<'JSON'
{"checkedAt":"2026-07-31T00:00:00+09:00","status":"FAILED","category":"E2E","targetCommit":"fixture","evidence":"fixture.log"}
JSON
  CARBONET_DEPLOY_STATE_DIR="$fixture" \
  CARBONET_DEPLOY_STATUS_FILE="$fixture/deploy-status.json" \
  CARBONET_TEAMS_WEBHOOK_FILE="$fixture/missing.url" \
    bash "$notifier" >/dev/null
  jq -e '.alert.teamsDelivery == "NOT_CONFIGURED"' "$fixture/deploy-status.json" >/dev/null
  CARBONET_DEPLOY_STATE_DIR="$fixture" \
  CARBONET_DEPLOY_STATUS_FILE="$fixture/deploy-status.json" \
  CARBONET_TEAMS_WEBHOOK_FILE="$fixture/missing.url" \
    bash "$notifier" >/dev/null
  [[ "$(wc -l <"$fixture/deploy-alerts.jsonl")" -eq 1 ]]
fi

e2e_line="$(grep -n "category=E2E" "$handler" | head -1 | cut -d: -f1)"
database_line="$(grep -n "category=DATABASE" "$handler" | head -1 | cut -d: -f1)"
network_line="$(grep -n "category=NETWORK_TRANSIENT" "$handler" | head -1 | cut -d: -f1)"
[[ "$network_line" -lt "$e2e_line" ]]
[[ "$e2e_line" -lt "$database_line" ]]

echo "AUTO_DEPLOY_FAILURE_HANDLER_PASS"
