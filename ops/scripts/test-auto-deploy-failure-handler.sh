#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
handler="$root/ops/scripts/carbonet-auto-deploy-failure-handler.sh"
service="$root/ops/systemd/carbonet-auto-deploy.service"
failure_service="$root/ops/systemd/carbonet-auto-deploy-failure-handler.service"
watchdog_service="$root/ops/systemd/carbonet-postdeploy-recovery-watchdog.service"
watchdog_timer="$root/ops/systemd/carbonet-postdeploy-recovery-watchdog.timer"
deploy="$root/ops/scripts/auto-deploy-main.sh"
notifier="$root/ops/scripts/carbonet-deploy-notify.sh"
authority="$root/ops/scripts/check-postdeploy-authoritative-promotion.sh"
runner="$root/ops/scripts/postdeploy-attempt-recovery-runner.sh"
launcher="$root/ops/scripts/auto-deploy-main-launcher.sh"

bash -n "$handler"
bash -n "$notifier"
bash -n "$authority"
bash -n "$runner"
bash -n "$launcher"
grep -q 'OnFailure=carbonet-auto-deploy-failure-handler.service' "$service"
grep -q '/opt/resonance-data/control-plane/bin/carbonet-auto-deploy-failure-handler.sh' "$failure_service"
! grep -q '^ConditionPathExists' "$failure_service"
grep -Fq 'Restart=on-failure' "$failure_service"
grep -Fq 'ConditionPathExists=/opt/resonance-data/deploy/carbonet-postdeploy-attempt.json' "$watchdog_service"
grep -Fq 'carbonet-auto-deploy-failure-handler.service' "$watchdog_service"
grep -Fq 'OnBootSec=75s' "$watchdog_timer"
grep -Fq 'OnUnitActiveSec=75s' "$watchdog_timer"
grep -Fq 'Persistent=true' "$watchdog_timer"
grep -Fq 'enable --now carbonet-postdeploy-recovery-watchdog.timer' "$deploy"
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
grep -Fq '/opt/resonance-data/control-plane/bin/auto-deploy-main-recovery.sh' "$deploy"
grep -Fq '/opt/resonance-data/control-plane/bin/auto-deploy-main-recovery.sh' "$handler"
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
        return (d.count(tokens[0]) == 4 and d.count(tokens[1]) == 1
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
  CARBONET_DEPLOY_OWNER="$(id -un)" \
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
  grep -Fq 'CARBONET_RECOVERY_ONLY=true' "$handler_fixture/systemd-run.record"
  grep -Fq -- "--uid=$(id -un)" "$handler_fixture/systemd-run.record"
  grep -Fq -- "--gid=$(id -gn)" "$handler_fixture/systemd-run.record"
  if grep -Fq 'systemctl start carbonet-auto-deploy.service' "$handler_fixture/systemd-run.record"; then
    echo 'promotion recovery must bypass the maintenance-held deploy service' >&2
    exit 1
  fi
  rm -rf -- "$handler_fixture"
fi

if command -v jq >/dev/null 2>&1; then
  attempt_fixture="$(mktemp -d)"
  mkdir -p "$attempt_fixture/bin" "$attempt_fixture/state/full-screen-deploy-gate"
  chmod 0700 "$attempt_fixture/state"
  chmod 0700 "$attempt_fixture/state/full-screen-deploy-gate"
  target='2222222222222222222222222222222222222222'
  base='1111111111111111111111111111111111111111'
  candidate='postdeploy:test:failure-handler:123456'
  sha='3333333333333333333333333333333333333333333333333333333333333333'
  image_id='docker-pullable://registry.invalid/carbonet@sha256:4444444444444444444444444444444444444444444444444444444444444444'
  jq -cn --arg attempt "$candidate" --arg source "$target" --arg base "$base" --arg sha "$sha" --arg imageId "$image_id" '
    {schemaVersion:2,lifecycleStatus:"STAGED",rollbackStage:"SNAPSHOT_CAPTURED",dbAttemptStaged:false,
     attemptId:$attempt,candidateId:$attempt,sourceCommit:$source,baseCommit:$base,
     runtimeIdentityHash:null,terminalReason:null,stagedAt:"2026-08-12T09:00:00Z",terminalAt:null,
     rollback:{snapshotId:"handler-fixture",snapshotDir:"/opt/resonance-data/deploy/full-screen-deploy-gate/snapshots/handler-fixture",
       snapshotManifestSha256:$sha,runtimeImageRef:"registry.invalid/carbonet:baseline",runtimeImageId:$imageId,
       deploymentUid:"uid",deploymentGeneration:7,deploymentAnnotationsSha256:$sha,podTemplateSha256:$sha,
       appliedMarkerCommit:$base,appliedMarkerSha256:$sha,runtimeMarkerCommit:$base,runtimeMarkerSha256:$sha}}' |
    python3 "$root/ops/scripts/postdeploy-attempt-journal.py" \
      --file "$attempt_fixture/state/carbonet-postdeploy-attempt.json" stage >/dev/null
  printf 'ACTIVE_SCHEMA_VERSION=2\n' >"$attempt_fixture/state/full-screen-deploy-gate/active.env"
  cat >"$attempt_fixture/bin/systemctl" <<'SH'
#!/usr/bin/env bash
if [[ "$*" == *InvocationID* ]]; then echo attempt-invocation; else echo 54321; fi
SH
  cat >"$attempt_fixture/bin/journalctl" <<'SH'
#!/usr/bin/env bash
echo 'durable attempt recovery pending'
SH
  cat >"$attempt_fixture/bin/systemd-run" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$FAKE_SYSTEMD_RUN_RECORD"
[[ "${FAKE_SYSTEMD_RUN_FAIL:-false}" != true ]]
SH
  cat >"$attempt_fixture/notify.sh" <<'SH'
#!/usr/bin/env bash
exit 0
SH
  chmod +x "$attempt_fixture/bin/"* "$attempt_fixture/notify.sh"
  FAKE_SYSTEMD_RUN_RECORD="$attempt_fixture/systemd-run.record" PATH="$attempt_fixture/bin:$PATH" \
  CARBONET_DEPLOY_OWNER="$(id -un)" CARBONET_DEPLOY_ROOT="$root" \
  CARBONET_DEPLOY_STATE_DIR="$attempt_fixture/state" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$root/ops/scripts/postdeploy-attempt-journal.py" \
  CARBONET_DEPLOY_NOTIFY_SCRIPT="$attempt_fixture/notify.sh" \
    bash "$handler" >/dev/null
  jq -e '.status=="RECOVERY_SCHEDULED" and .category=="ATTEMPT_RECOVERY_PENDING"
    and .attemptRecoveryPending==true and .retryAttempted==true' \
    "$attempt_fixture/state/deploy-status.json" >/dev/null
  grep -Fq -- "--uid=$(id -un)" "$attempt_fixture/systemd-run.record"
  grep -Fq 'CARBONET_RECOVERY_ONLY=true' "$attempt_fixture/systemd-run.record"
  grep -Fq "CARBONET_DEPLOY_ROOT=$root" "$attempt_fixture/systemd-run.record"
  grep -Fq "CARBONET_RECOVERY_TARGET_COMMIT=$target" "$attempt_fixture/systemd-run.record"
  grep -Fq "CARBONET_RECOVERY_CANDIDATE_ID=$candidate" "$attempt_fixture/systemd-run.record"
  grep -Fq 'postdeploy-attempt-recovery-runner.sh' "$attempt_fixture/systemd-run.record"
  grep -Fq -- '--property=OnFailure=carbonet-auto-deploy-failure-handler.service' "$attempt_fixture/systemd-run.record"
  [[ "$(stat -c '%U' "$attempt_fixture/state/carbonet-postdeploy-attempt.json")" == "$(id -un)" ]]
  schedule_marker="$(find "$attempt_fixture/state" -maxdepth 1 -type f -name 'postdeploy-recovery-schedule-*.json' -print -quit)"
  [[ -n "$schedule_marker" && "$(stat -c '%U:%G:%a' "$schedule_marker")" == "$(id -un):$(id -gn):600" ]]
  # A fresh SCHEDULED lease is not duplicated.
  FAKE_SYSTEMD_RUN_RECORD="$attempt_fixture/systemd-run.record" PATH="$attempt_fixture/bin:$PATH" \
  CARBONET_DEPLOY_OWNER="$(id -un)" CARBONET_DEPLOY_ROOT="$root" \
  CARBONET_DEPLOY_STATE_DIR="$attempt_fixture/state" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$root/ops/scripts/postdeploy-attempt-journal.py" \
  CARBONET_DEPLOY_NOTIFY_SCRIPT="$attempt_fixture/notify.sh" \
    bash "$handler" >/dev/null
  [[ "$(wc -l <"$attempt_fixture/systemd-run.record")" == 1 ]]
  # The persistent watchdog re-enters this handler after lease expiry. A
  # scheduling failure retires the blocking marker, and the handler service's
  # Restart=on-failure can immediately publish and schedule it again.
  jq '.scheduledAt="2026-08-12T00:00:00Z"' "$schedule_marker" >"${schedule_marker}.tmp"
  chmod 0600 "${schedule_marker}.tmp" && mv -fT -- "${schedule_marker}.tmp" "$schedule_marker"
  set +e
  FAKE_SYSTEMD_RUN_FAIL=true FAKE_SYSTEMD_RUN_RECORD="$attempt_fixture/systemd-run.record" \
  PATH="$attempt_fixture/bin:$PATH" CARBONET_DEPLOY_OWNER="$(id -un)" CARBONET_DEPLOY_ROOT="$root" \
  CARBONET_DEPLOY_STATE_DIR="$attempt_fixture/state" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$root/ops/scripts/postdeploy-attempt-journal.py" \
  CARBONET_DEPLOY_NOTIFY_SCRIPT="$attempt_fixture/notify.sh" \
    bash "$handler" >/dev/null 2>&1
  schedule_failure_status=$?
  set -e
  [[ "$schedule_failure_status" == 79 && ! -e "$schedule_marker" ]]
  [[ "$(find "$attempt_fixture/state" -maxdepth 1 -type f -name '*.schedule-failed.*' | wc -l | tr -d ' ')" == 1 ]]
  FAKE_SYSTEMD_RUN_RECORD="$attempt_fixture/systemd-run.record" PATH="$attempt_fixture/bin:$PATH" \
  CARBONET_DEPLOY_OWNER="$(id -un)" CARBONET_DEPLOY_ROOT="$root" \
  CARBONET_DEPLOY_STATE_DIR="$attempt_fixture/state" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$root/ops/scripts/postdeploy-attempt-journal.py" \
  CARBONET_DEPLOY_NOTIFY_SCRIPT="$attempt_fixture/notify.sh" \
    bash "$handler" >/dev/null
  [[ "$(wc -l <"$attempt_fixture/systemd-run.record")" == 3 ]]
  mapfile -t scheduled_units < <(sed -n 's/.*--unit=\([^ ]*\).*/\1/p' "$attempt_fixture/systemd-run.record")
  [[ "${#scheduled_units[@]}" == 3 \
     && "${scheduled_units[0]}" != "${scheduled_units[1]}" \
     && "${scheduled_units[1]}" != "${scheduled_units[2]}" ]]
  rm -rf -- "$attempt_fixture"
fi

# The persistent runner performs exactly three candidate-bound attempts without
# network access: transient failures converge on the third call, while an
# exhausted run preserves the 0600 journal byte-for-byte and quarantines it.
if command -v jq >/dev/null 2>&1; then
  runner_fixture="$(mktemp -d)"
  mkdir -p "$runner_fixture/state" "$runner_fixture/bin"
  chmod 0700 "$runner_fixture/state"
  runner_target='4444444444444444444444444444444444444444'
  runner_base='1111111111111111111111111111111111111111'
  runner_candidate='postdeploy:test:runner:123456'
  runner_sha='5555555555555555555555555555555555555555555555555555555555555555'
  runner_image_id='docker-pullable://registry.invalid/carbonet@sha256:6666666666666666666666666666666666666666666666666666666666666666'
  runner_journal="$runner_fixture/state/carbonet-postdeploy-attempt.json"
  runner_schedule="$runner_fixture/state/schedule.json"
  stage_runner_journal() {
    rm -f -- "$runner_journal" "$runner_fixture/state/.carbonet-postdeploy-attempt.json.lock"
    jq -cn --arg attempt "$runner_candidate" --arg source "$runner_target" \
      --arg base "$runner_base" --arg sha "$runner_sha" --arg imageId "$runner_image_id" '
      {schemaVersion:2,lifecycleStatus:"STAGED",rollbackStage:"SNAPSHOT_CAPTURED",dbAttemptStaged:false,
       attemptId:$attempt,candidateId:$attempt,sourceCommit:$source,baseCommit:$base,
       runtimeIdentityHash:null,terminalReason:null,stagedAt:"2026-08-12T09:00:00Z",terminalAt:null,
       rollback:{snapshotId:"runner-fixture",snapshotDir:"/opt/resonance-data/deploy/full-screen-deploy-gate/snapshots/runner-fixture",
         snapshotManifestSha256:$sha,runtimeImageRef:"registry.invalid/carbonet:baseline",runtimeImageId:$imageId,
         deploymentUid:"uid",deploymentGeneration:7,deploymentAnnotationsSha256:$sha,podTemplateSha256:$sha,
         appliedMarkerCommit:$base,appliedMarkerSha256:$sha,runtimeMarkerCommit:$base,runtimeMarkerSha256:$sha}}' |
      python3 "$root/ops/scripts/postdeploy-attempt-journal.py" --file "$runner_journal" stage >/dev/null
    jq -n --arg candidateId "$runner_candidate" --arg sourceCommit "$runner_target" \
      '{schemaVersion:1,status:"SCHEDULED",candidateId:$candidateId,sourceCommit:$sourceCommit,scheduledAt:"2026-08-12T09:00:00Z",unitName:"carbonet-auto-deploy-recovery-1234567890abcdef1234-1"}' \
      >"$runner_schedule"
    chmod 0600 "$runner_schedule"
  }
  cat >"$runner_fixture/bin/launcher.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
count="$(( $(cat "$RUNNER_CALLS" 2>/dev/null || printf '0') + 1 ))"
printf '%s\n' "$count" >"$RUNNER_CALLS"
if [[ "${RUNNER_HANG:-false}" == true ]]; then
  sleep 30
fi
[[ "${RUNNER_ALWAYS_FAIL:-false}" != true && "$count" -ge 3 ]] || exit 75
rm -f -- "$CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE"
SH
  chmod 0755 "$runner_fixture/bin/launcher.sh"

  stage_runner_journal
  RUNNER_CALLS="$runner_fixture/calls" CARBONET_DEPLOY_STATE_DIR="$runner_fixture/state" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$runner_journal" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$root/ops/scripts/postdeploy-attempt-journal.py" \
  CARBONET_AUTO_DEPLOY_RECOVERY_LAUNCHER="$runner_fixture/bin/launcher.sh" \
  CARBONET_RECOVERY_SCHEDULE_MARKER="$runner_schedule" \
  CARBONET_RECOVERY_CANDIDATE_ID="$runner_candidate" CARBONET_RECOVERY_TARGET_COMMIT="$runner_target" \
  CARBONET_RECOVERY_ATTEMPTS=3 CARBONET_RECOVERY_DELAYS_SECONDS='0 0' \
    bash "$runner" >/dev/null
  [[ "$(cat "$runner_fixture/calls")" == 3 && ! -e "$runner_journal" ]]
  jq -e '.status=="SUCCEEDED" and .attempts==3 and .exitStatus==0' "$runner_schedule" >/dev/null
  [[ "$(stat -c '%a' "$runner_schedule")" == 600 ]]

  rm -f "$runner_fixture/calls"
  stage_runner_journal
  journal_hash_before="$(sha256sum "$runner_journal" | awk '{print $1}')"
  set +e
  RUNNER_ALWAYS_FAIL=true RUNNER_CALLS="$runner_fixture/calls" \
  CARBONET_DEPLOY_STATE_DIR="$runner_fixture/state" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$runner_journal" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$root/ops/scripts/postdeploy-attempt-journal.py" \
  CARBONET_AUTO_DEPLOY_RECOVERY_LAUNCHER="$runner_fixture/bin/launcher.sh" \
  CARBONET_RECOVERY_SCHEDULE_MARKER="$runner_schedule" \
  CARBONET_RECOVERY_CANDIDATE_ID="$runner_candidate" CARBONET_RECOVERY_TARGET_COMMIT="$runner_target" \
  CARBONET_RECOVERY_ATTEMPTS=3 CARBONET_RECOVERY_DELAYS_SECONDS='0 0' \
    bash "$runner" >/dev/null 2>&1
  runner_status=$?
  set -e
  [[ "$runner_status" == 79 && "$(cat "$runner_fixture/calls")" == 3 ]]
  [[ "$(sha256sum "$runner_journal" | awk '{print $1}')" == "$journal_hash_before" ]]
  [[ "$(stat -c '%a' "$runner_journal")" == 600 ]]
  jq -e '.status=="EXHAUSTED" and .attempts==3 and .exitStatus==75' "$runner_schedule" >/dev/null
  quarantine_count="$(find "$runner_fixture/state" -maxdepth 1 -type f -name 'recovery-quarantine-*.json' | wc -l | tr -d ' ')"
  [[ "$quarantine_count" == 1 ]]
  [[ "$(find "$runner_fixture/state" -maxdepth 1 -type f -name 'recovery-quarantine-*.json' -printf '%m\n')" == 600 ]]

  rm -f "$runner_fixture/calls"
  stage_runner_journal
  set +e
  RUNNER_HANG=true RUNNER_CALLS="$runner_fixture/calls" \
  CARBONET_DEPLOY_STATE_DIR="$runner_fixture/state" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$runner_journal" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$root/ops/scripts/postdeploy-attempt-journal.py" \
  CARBONET_AUTO_DEPLOY_RECOVERY_LAUNCHER="$runner_fixture/bin/launcher.sh" \
  CARBONET_RECOVERY_SCHEDULE_MARKER="$runner_schedule" \
  CARBONET_RECOVERY_CANDIDATE_ID="$runner_candidate" CARBONET_RECOVERY_TARGET_COMMIT="$runner_target" \
  CARBONET_RECOVERY_ATTEMPTS=3 CARBONET_RECOVERY_DELAYS_SECONDS='0 0' \
  CARBONET_RECOVERY_ATTEMPT_TIMEOUT_SECONDS=1 \
    bash "$runner" >/dev/null 2>&1
  hung_runner_status=$?
  set -e
  [[ "$hung_runner_status" == 79 && "$(cat "$runner_fixture/calls")" == 3 ]]
  jq -e '.status=="EXHAUSTED" and .attempts==3 and .exitStatus==124' "$runner_schedule" >/dev/null
  rm -rf -- "$runner_fixture"
fi

e2e_line="$(grep -n "category=E2E" "$handler" | head -1 | cut -d: -f1)"
database_line="$(grep -n "category=DATABASE" "$handler" | head -1 | cut -d: -f1)"
network_line="$(grep -n "category=NETWORK_TRANSIENT" "$handler" | head -1 | cut -d: -f1)"
[[ "$network_line" -lt "$e2e_line" ]]
[[ "$e2e_line" -lt "$database_line" ]]

echo "AUTO_DEPLOY_FAILURE_HANDLER_PASS promotionPending=DB-authoritative attemptRecovery=deploy-owner+hold-bypass+fetch0+candidateBound3x"
