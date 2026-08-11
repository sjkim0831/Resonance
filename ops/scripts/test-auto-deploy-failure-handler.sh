#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
handler="$root/ops/scripts/carbonet-auto-deploy-failure-handler.sh"
service="$root/ops/systemd/carbonet-auto-deploy.service"
failure_service="$root/ops/systemd/carbonet-auto-deploy-failure-handler.service"
deploy="$root/ops/scripts/auto-deploy-main.sh"
notifier="$root/ops/scripts/carbonet-deploy-notify.sh"
authority="$root/ops/scripts/check-postdeploy-authoritative-promotion.sh"

bash -n "$handler"
bash -n "$notifier"
bash -n "$authority"
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
grep -q 'category=PROMOTION_MARKER_PENDING' "$handler"
grep -q 'status=RECONCILE_SCHEDULED' "$handler"
grep -q 'promotionAuthoritative' "$handler"
grep -q 'snapshotPreserved' "$handler"
grep -q 'check-postdeploy-authoritative-promotion.sh' "$handler"
grep -Fq '/opt/resonance-data/control-plane/bin/check-postdeploy-authoritative-promotion.sh' "$handler"
grep -Fq 'CARBONET_KUBECONFIG' "$handler"
grep -Fq '[[ -r "$KUBECONFIG"' "$handler"
grep -Fq 'CARBONET_KUBECONFIG' "$authority"
grep -Fq '[[ -r "$KUBECONFIG" ]] || exit 2' "$authority"
grep -Fq 'ops/scripts/check-postdeploy-authoritative-promotion.sh' "$deploy"
grep -Fq '/opt/resonance-data/control-plane/bin/check-postdeploy-authoritative-promotion.sh' "$deploy"
grep -Fq 'authority_helper_install_tmp=' "$deploy"
grep -Fq 'sudo -n mv -fT -- "$authority_helper_install_tmp"' "$deploy"
grep -Fq 'install -m 0750 -o root -g root' "$deploy"
install_contract="$(sed -n '/failure classification and one-shot recovery synchronized/=' "$deploy")"
[[ "$install_contract" =~ ^[0-9]+$ ]]
python3 - "$deploy" "$handler" "$authority" <<'PY'
from pathlib import Path
import sys
deploy, handler, authority = (Path(p).read_text() for p in sys.argv[1:])
tokens = (
    "ops/scripts/check-postdeploy-authoritative-promotion.sh",
    "/opt/resonance-data/control-plane/bin/check-postdeploy-authoritative-promotion.sh",
)
def contract(d, h, a):
    try:
        function_start = d.index("sync_auto_deploy_failure_runtime_if_required() {")
        function_end = d.index("sync_postgres_backup_cronjobs_if_required() {", function_start)
        function_body = d[function_start:function_end]
        fast_start = d.index("# Documentation, design metadata")
        fast_end = d.index("# A failed post-deploy gate", fast_start)
        fast_body = d[fast_start:fast_end]
        runtime_merge = d.rindex('git merge --ff-only "$target_commit"')
        runtime_sync = d.index("sync_auto_deploy_failure_runtime_if_required", runtime_merge)
        runtime_restore = d.index("restore_live_frontend_overlay", runtime_merge)
        return (d.count(tokens[0]) == 3 and d.count(tokens[1]) == 1
                and 'mv -fT -- "$authority_helper_install_tmp"' in d
                and fast_body.index('git merge --ff-only "$target_commit"') < fast_body.index("sync_auto_deploy_failure_runtime_if_required")
                and runtime_merge < runtime_sync < runtime_restore
                and d.count("sync_auto_deploy_failure_runtime_if_required") == 3
                and tokens[1] in h and "[[ -r \"$KUBECONFIG\" ]] || exit 2" in a)
    except ValueError:
        return False
assert contract(deploy, handler, authority)
for token in tokens:
    assert not contract(deploy.replace(token, "REMOVED", 1), handler, authority)
assert not contract(deploy, handler.replace(tokens[1], "REMOVED", 1), authority)
assert not contract(deploy, handler, authority.replace("[[ -r \"$KUBECONFIG\" ]] || exit 2", "true", 1))
runtime_call = deploy.rindex('git merge --ff-only "$target_commit"')
mutated_mixed_runtime = deploy[:runtime_call] + deploy[runtime_call:].replace("sync_auto_deploy_failure_runtime_if_required", "MIXED_RUNTIME_INSTALL_REMOVED", 1)
assert not contract(mutated_mixed_runtime, handler, authority)
PY

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

if command -v jq >/dev/null 2>&1; then
  handler_fixture="$(mktemp -d)"
  mkdir -p "$handler_fixture/bin" "$handler_fixture/state" "$handler_fixture/full-screen"
  target='1111111111111111111111111111111111111111'
  cat >"$handler_fixture/state/postdeploy-marker-pending.state" <<EOF
schemaVersion=1
targetCommit=$target
candidateId=postdeploy:test:candidate:123456
reason=DB_PROMOTED_RUNTIME_MARKER_PENDING
observedAppliedMarker=0000000000000000000000000000000000000000
observedRuntimeMarker=0000000000000000000000000000000000000000
EOF
  chmod 0600 "$handler_fixture/state/postdeploy-marker-pending.state"
  printf 'SNAPSHOT_ID=fixture\n' >"$handler_fixture/full-screen/active.env"
  printf 'fixture\n' >"$handler_fixture/kubeconfig"
  cat >"$handler_fixture/bin/systemctl" <<'SH'
#!/usr/bin/env bash
if [[ "$*" == *InvocationID* ]]; then echo fixture-invocation; else echo 12345; fi
SH
  cat >"$handler_fixture/bin/journalctl" <<'SH'
#!/usr/bin/env bash
echo 'MARKER_PENDING DB promotion committed; next preflight will reconcile runtime marker'
SH
  cat >"$handler_fixture/bin/systemd-run" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >"$FAKE_SYSTEMD_RUN_RECORD"
SH
  cat >"$handler_fixture/authority.sh" <<'SH'
#!/usr/bin/env bash
[[ "$2" == "$FAKE_AUTHORITY_TARGET" ]] || exit 2
printf 'PROMOTED\n'
SH
  cat >"$handler_fixture/notify.sh" <<'SH'
#!/usr/bin/env bash
exit 0
SH
  chmod +x "$handler_fixture/bin/"* "$handler_fixture/authority.sh" "$handler_fixture/notify.sh"
  FAKE_AUTHORITY_TARGET="$target" FAKE_SYSTEMD_RUN_RECORD="$handler_fixture/systemd-run.record" \
  PATH="$handler_fixture/bin:$PATH" \
  CARBONET_DEPLOY_STATE_DIR="$handler_fixture/state" \
  CARBONET_KUBECONFIG="$handler_fixture/kubeconfig" \
  CARBONET_POSTDEPLOY_PROMOTION_AUTHORITY_SCRIPT="$handler_fixture/authority.sh" \
  CARBONET_FULL_SCREEN_ACTIVE_FILE="$handler_fixture/full-screen/active.env" \
  CARBONET_DEPLOY_NOTIFY_SCRIPT="$handler_fixture/notify.sh" \
    bash "$handler" >/dev/null
  jq -e '.status=="RECONCILE_SCHEDULED" and .category=="PROMOTION_MARKER_PENDING"
    and .promotionAuthoritative==true and .snapshotPreserved==true and .retryAttempted==true' \
    "$handler_fixture/state/deploy-status.json" >/dev/null
  [[ -s "$handler_fixture/full-screen/active.env" && -s "$handler_fixture/systemd-run.record" ]]
  rm -rf -- "$handler_fixture"
fi

e2e_line="$(grep -n "category=E2E" "$handler" | head -1 | cut -d: -f1)"
database_line="$(grep -n "category=DATABASE" "$handler" | head -1 | cut -d: -f1)"
network_line="$(grep -n "category=NETWORK_TRANSIENT" "$handler" | head -1 | cut -d: -f1)"
[[ "$network_line" -lt "$e2e_line" ]]
[[ "$e2e_line" -lt "$database_line" ]]

echo "AUTO_DEPLOY_FAILURE_HANDLER_PASS promotionPending=DB-authoritative+snapshot-preserved+reconcile-scheduled"
