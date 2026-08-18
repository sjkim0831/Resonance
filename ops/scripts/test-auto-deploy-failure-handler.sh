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

export CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER="$root/ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh"
EXPECTED_ORPHAN_RECOVERY_HELPER_SHA256="$(sha256sum "$CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER" | awk '{print $1}')"
unset CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER_SHA256

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
grep -Fxq 'ExecStartPre=/usr/bin/systemctl reset-failed carbonet-auto-deploy-failure-handler.service' "$watchdog_service"
grep -Fq 'OnBootSec=75s' "$watchdog_timer"
python3 - "$watchdog_service" <<'PY'
from pathlib import Path
import sys
lines=Path(sys.argv[1]).read_text().splitlines()
assert lines.index("ExecStartPre=/usr/bin/systemctl reset-failed carbonet-auto-deploy-failure-handler.service") < lines.index("ExecStart=/usr/bin/systemctl start carbonet-auto-deploy-failure-handler.service")
PY
grep -Fq 'OnUnitActiveSec=75s' "$watchdog_timer"
grep -Fq 'Persistent=true' "$watchdog_timer"
grep -Fq 'enable --now carbonet-postdeploy-recovery-watchdog.timer' "$deploy"
grep -q 'category=NETWORK_TRANSIENT' "$handler"
grep -q '_SYSTEMD_INVOCATION_ID=' "$handler"
grep -q 'retry_allowed=true' "$handler"
grep -q 'category=DATABASE' "$handler"
grep -q 'category=DATABASE_DETERMINISTIC' "$handler"
grep -q 'category=POSTDEPLOY_VALIDATION_DETERMINISTIC' "$handler"
grep -q 'category=BACKSTAGE_CONFIGURATION_DETERMINISTIC' "$handler"
grep -q 'category=RUNTIME_IDENTITY_DETERMINISTIC' "$handler"
grep -q 'category=DEPLOY_TERMINATED' "$handler"
grep -q 'category=FLYWAY_CLEANUP_HOLD' "$handler"
grep -Fq 'ExecMainStatus' "$handler"
grep -Fq 'ActiveState=inactive' "$handler"
grep -Fq 'SubState=dead' "$handler"
grep -Fq 'Result=success' "$handler"
grep -Fq 'FLYWAY_JOB_FAILED' "$handler"
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
authority_explicit_flag = '[[ -v CARBONET_POSTDEPLOY_AUTHORITY_SCRIPT ]] && POSTDEPLOY_AUTHORITY_SCRIPT_EXPLICIT=true || POSTDEPLOY_AUTHORITY_SCRIPT_EXPLICIT=false'
authority_default = 'POSTDEPLOY_AUTHORITY_SCRIPT="${CARBONET_POSTDEPLOY_AUTHORITY_SCRIPT:-$ROOT_DIR/ops/scripts/check-postdeploy-authoritative-promotion.sh}"'
authority_rebind = '[[ "$POSTDEPLOY_AUTHORITY_SCRIPT_EXPLICIT" == true ]] || POSTDEPLOY_AUTHORITY_SCRIPT="$ROOT_DIR/ops/scripts/check-postdeploy-authoritative-promotion.sh"'
clean_rebind_call = '\n  rebind_default_postdeploy_helpers\n  cd "$ROOT_DIR"'
def contract(d, h, a):
    try:
        function_start = d.index("sync_auto_deploy_failure_runtime_if_required() {")
        function_end = d.index("sync_postgres_backup_cronjobs_if_required() {", function_start)
        function_body = d[function_start:function_end]
        rebind_start = d.index("rebind_default_postdeploy_helpers() {")
        rebind_end = d.index("# The applied-source marker", rebind_start)
        rebind_body = d[rebind_start:rebind_end]
        fast_start = d.index("# Documentation, design metadata")
        fast_end = d.index("# A failed post-deploy gate", fast_start)
        fast_body = d[fast_start:fast_end]
        runtime_merge = d.rindex('git merge --ff-only "$target_commit"')
        runtime_sync = d.index("sync_auto_deploy_failure_runtime_if_required", runtime_merge)
        runtime_restore = d.index("restore_live_frontend_overlay", runtime_merge)
        clean_root_switch = d.index('ROOT_DIR="$clean_worktree"')
        clean_rebind = d.index(clean_rebind_call, clean_root_switch)
        clean_cd = d.index('cd "$ROOT_DIR"', clean_rebind)
        return (d.count(tokens[0]) == 6 and d.count(tokens[1]) == 1
                and 'mv -fT -- "$authority_helper_install_tmp"' in d
                and authority_explicit_flag in d and authority_default in d
                and authority_rebind in rebind_body
                and fast_body.index('git merge --ff-only "$target_commit"') < fast_body.index("sync_auto_deploy_failure_runtime_if_required")
                and runtime_merge < runtime_sync < runtime_restore
                and clean_root_switch < clean_rebind < clean_cd
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
assert not contract(deploy.replace(authority_rebind, "AUTHORITY_REBIND_REMOVED", 1), handler, authority)
assert not contract(deploy.replace(clean_rebind_call, '\n  cd "$ROOT_DIR"', 1), handler, authority)
PY

watchdog_fixture="$(mktemp -d)"
mkdir -p "$watchdog_fixture/bin"
cat >"$watchdog_fixture/bin/systemctl" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"${WATCHDOG_SYSTEMCTL_RECORD:?}"
if [[ "$1" == reset-failed ]]; then
  rm -f -- "${WATCHDOG_START_LIMIT:?}"
elif [[ "$1" == start && -e "${WATCHDOG_START_LIMIT:?}" ]]; then
  exit 42
fi
SH
chmod 0755 "$watchdog_fixture/bin/systemctl"
: >"$watchdog_fixture/start-limit"
watchdog_blocked=0
WATCHDOG_SYSTEMCTL_RECORD="$watchdog_fixture/systemctl.record" \
WATCHDOG_START_LIMIT="$watchdog_fixture/start-limit" \
PATH="$watchdog_fixture/bin:$PATH" systemctl start carbonet-auto-deploy-failure-handler.service \
  || watchdog_blocked=$?
[[ "$watchdog_blocked" == 42 ]]
while IFS='=' read -r directive command; do
  [[ "$directive" == ExecStartPre || "$directive" == ExecStart ]] || continue
  command="${command#/usr/bin/}"
  WATCHDOG_SYSTEMCTL_RECORD="$watchdog_fixture/systemctl.record" \
  WATCHDOG_START_LIMIT="$watchdog_fixture/start-limit" \
  PATH="$watchdog_fixture/bin:$PATH" bash -c "$command"
done <"$watchdog_service"
mapfile -t watchdog_calls <"$watchdog_fixture/systemctl.record"
[[ "${watchdog_calls[*]}" == "start carbonet-auto-deploy-failure-handler.service reset-failed carbonet-auto-deploy-failure-handler.service start carbonet-auto-deploy-failure-handler.service" ]]
[[ ! -e "$watchdog_fixture/start-limit" ]]
rm -rf -- "$watchdog_fixture"
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
  classifier_fixture="$(mktemp -d)"
  mkdir -p "$classifier_fixture/bin"
  cat >"$classifier_fixture/bin/systemctl" <<'SH'
#!/usr/bin/env bash
if [[ "$*" == *ActiveState* && "$*" == *SubState* && "$*" == *Result* && "$*" == *ExecMainStatus* ]]; then
  if [[ -n "${FAKE_MAIN_SERVICE_SNAPSHOT:-}" ]]; then
    printf '%s\n' "$FAKE_MAIN_SERVICE_SNAPSHOT"
  else
    printf 'ActiveState=failed\nSubState=failed\nResult=exit-code\nExecMainStatus=%s\n' "${FAKE_EXEC_MAIN_STATUS:?}"
  fi
  exit 0
fi
case "$*" in
  *ExecMainStartTimestampMonotonic*) printf 'classifier-run\n' ;;
  *InvocationID*) printf 'classifier-invocation\n' ;;
  *ExecMainStatus*) printf '%s\n' "${FAKE_EXEC_MAIN_STATUS:?}" ;;
  *) exit 0 ;;
esac
SH
  cat >"$classifier_fixture/bin/journalctl" <<'SH'
#!/usr/bin/env bash
cat "${FAKE_JOURNAL_SOURCE:?}"
SH
  cat >"$classifier_fixture/bin/git" <<'SH'
#!/usr/bin/env bash
[[ "$1" == ls-remote ]] || exit 97
[[ -z "${FAKE_GIT_CALL_RECORD:-}" ]] || printf '%s\n' "$*" >>"$FAKE_GIT_CALL_RECORD"
if [[ "${FAKE_GIT_HANG:-false}" == true ]]; then
  /usr/bin/sleep 30
fi
printf '%s\trefs/heads/main\n' "${FAKE_TARGET_COMMIT:?}"
SH
  cat >"$classifier_fixture/bin/systemd-run" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"${FAKE_SYSTEMD_RUN_RECORD:?}"
SH
  cat >"$classifier_fixture/notify.sh" <<'SH'
#!/usr/bin/env bash
exit 0
SH
  chmod 0755 "$classifier_fixture/bin/"* "$classifier_fixture/notify.sh"
  classifier_target='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

  stale_case_dir="$classifier_fixture/stale_success"
  mkdir -p "$stale_case_dir/state"
  printf '%s\n' '{"checkedAt":"2026-08-14T00:00:00+09:00","status":"FAILED","category":"STALE_SENTINEL"}' \
    >"$stale_case_dir/state/deploy-status.json"
  cp "$stale_case_dir/state/deploy-status.json" "$stale_case_dir/deploy-status.before"
  stale_status_hash_before="$(sha256sum "$stale_case_dir/state/deploy-status.json" | awk '{print $1}')"
  stale_status_bytes_before="$(wc -c <"$stale_case_dir/state/deploy-status.json" | tr -d ' ')"
  stale_state_tree_before="$(find "$stale_case_dir/state" -printf '%P|%y|%s\n' | LC_ALL=C sort)"
  FAKE_MAIN_SERVICE_SNAPSHOT=$'SubState=dead\nResult=success\nExecMainStatus=0\nActiveState=inactive' \
  FAKE_SYSTEMD_RUN_RECORD="$stale_case_dir/systemd-run.record" \
  PATH="$classifier_fixture/bin:$PATH" \
  CARBONET_DEPLOY_OWNER="$(id -un)" \
  CARBONET_DEPLOY_ROOT="$root" \
  CARBONET_DEPLOY_STATE_DIR="$stale_case_dir/state" \
  CARBONET_DEPLOY_NOTIFY_SCRIPT="$classifier_fixture/notify.sh" \
    bash "$handler" >/dev/null
  cmp -s "$stale_case_dir/deploy-status.before" "$stale_case_dir/state/deploy-status.json"
  [[ "$(sha256sum "$stale_case_dir/state/deploy-status.json" | awk '{print $1}')" == "$stale_status_hash_before" ]]
  [[ "$(wc -c <"$stale_case_dir/state/deploy-status.json" | tr -d ' ')" == "$stale_status_bytes_before" ]]
  [[ "$(find "$stale_case_dir/state" -printf '%P|%y|%s\n' | LC_ALL=C sort)" == "$stale_state_tree_before" ]]
  [[ ! -e "$stale_case_dir/state/failure-evidence" ]]
  [[ "$(find "$stale_case_dir/state" -maxdepth 1 -name 'retry-*' | wc -l | tr -d ' ')" == 0 ]]
  [[ ! -e "$stale_case_dir/systemd-run.record" ]]

  run_classifier_mutant() {
    local name="$1"
    local exit_status="$2"
    local journal_text="$3"
    local expected_category="$4"
    local expected_status="$5"
    local expected_retry_allowed="$6"
    local expected_retry_attempted="$7"
    local expected_schedule_count="$8"
    local case_dir="$classifier_fixture/$name"
    local schedule_count
    local retry_marker_count
    mkdir -p "$case_dir/state"
    if [[ "$name" == emission_workflow_invalid ]]; then
      # Deterministic validation evidence must outrank even a durable attempt
      # marker; otherwise the handler would enter attempt recovery first.
      printf '%s\n' '{"fixture":"must-not-be-read"}' >"$case_dir/state/carbonet-postdeploy-attempt.json"
      chmod 0600 "$case_dir/state/carbonet-postdeploy-attempt.json"
    fi
    printf '%s\n' "$journal_text" >"$case_dir/journal.log"
    FAKE_EXEC_MAIN_STATUS="$exit_status" \
    FAKE_JOURNAL_SOURCE="$case_dir/journal.log" \
    FAKE_TARGET_COMMIT="$classifier_target" \
    FAKE_SYSTEMD_RUN_RECORD="$case_dir/systemd-run.record" \
    PATH="$classifier_fixture/bin:$PATH" \
    CARBONET_DEPLOY_OWNER="$(id -un)" \
    CARBONET_DEPLOY_ROOT="$root" \
    CARBONET_DEPLOY_STATE_DIR="$case_dir/state" \
    CARBONET_DEPLOY_NOTIFY_SCRIPT="$classifier_fixture/notify.sh" \
      bash "$handler" >/dev/null
    jq -e --arg category "$expected_category" --arg status "$expected_status" \
      --argjson allowed "$expected_retry_allowed" --argjson attempted "$expected_retry_attempted" \
      '.category==$category and .status==$status and .retryAllowed==$allowed and .retryAttempted==$attempted' \
      "$case_dir/state/deploy-status.json" >/dev/null
    [[ -s "$case_dir/state/failure-evidence/classifier-run.log" ]]
    if grep -Eqi 'fixture-(password|token|secret|quote|multiline)|postgres(ql)?://[^[:space:]@]+:[^[:space:]@]+@|sudo\[[0-9]+\].*COMMAND=' \
        "$case_dir/state/failure-evidence/classifier-run.log"; then
      echo "failure evidence leaked a secret-bearing value case=$name" >&2
      exit 1
    fi
    schedule_count=0
    [[ ! -e "$case_dir/systemd-run.record" ]] || schedule_count="$(wc -l <"$case_dir/systemd-run.record" | tr -d ' ')"
    [[ "$schedule_count" == "$expected_schedule_count" ]]
    retry_marker_count="$(find "$case_dir/state" -maxdepth 1 -type f -name 'retry-*.attempted' | wc -l | tr -d ' ')"
    [[ "$retry_marker_count" == "$expected_schedule_count" ]]
  }

  run_classifier_mutant network_503 1 \
    $'sudo[4242]: operator : COMMAND=/usr/bin/psql postgresql://deploy:fixture-password@db/app\nAuthorization: Bearer fixture-token\nCookie: session=fixture-secret\nDB_PASSWORD=fixture-password\nreadiness returned 503 while probing the candidate' \
    NETWORK_TRANSIENT RETRY_SCHEDULED true true 1
  run_classifier_mutant backstage_secret_lookup_transient 1 \
    $'[backstage] runtime purge recovery secret lookup failed\nUnable to connect to the server: i/o timeout' \
    NETWORK_TRANSIENT RETRY_SCHEDULED true true 1
  run_classifier_mutant backstage_frontend_config_lookup_503 1 \
    $'[backstage] frontend runtime config lookup failed\ncurl: (22) The requested URL returned error: 503' \
    NETWORK_TRANSIENT RETRY_SCHEDULED true true 1
  run_classifier_mutant backstage_frontend_config_lookup_dns 1 \
    $'[backstage] frontend runtime config lookup failed\ncurl: (6) Could not resolve host: backstage.invalid' \
    NETWORK_TRANSIENT RETRY_SCHEDULED true true 1
  run_classifier_mutant backstage_frontend_config_lookup_connect 1 \
    $'[backstage] frontend runtime config lookup failed\ncurl: (7) Failed to connect to backstage.invalid port 443: Could not connect to server' \
    NETWORK_TRANSIENT RETRY_SCHEDULED true true 1
  run_classifier_mutant emission_workflow_invalid 1 \
    $'[validation-groups] FAIL name=emission-workflow\n[emission-workflow] invalid projects: 35\ntimed out waiting for sibling validation group' \
    POSTDEPLOY_VALIDATION_DETERMINISTIC FAILED false false 0
  run_classifier_mutant backstage_recovery_account_missing 1 \
    $'[backstage] runtime purge recovery account secret is required\ntimed out waiting for sibling cleanup' \
    BACKSTAGE_CONFIGURATION_DETERMINISTIC FAILED false false 0
  run_classifier_mutant backstage_recovery_actor_invalid 1 \
    $'[backstage] runtime purge recovery actor ref is invalid\ntimeout while collecting unrelated diagnostics' \
    BACKSTAGE_CONFIGURATION_DETERMINISTIC FAILED false false 0
  run_classifier_mutant backstage_recovery_authority_unprovable 79 \
    $'RECOVERY_AUTHORITY_NOT_READY\nRuntime purge recovery authority preflight returned no proof.\ntimed out waiting for deployment rollout' \
    BACKSTAGE_CONFIGURATION_DETERMINISTIC FAILED false false 0
  run_classifier_mutant backstage_frontend_oidc_config_missing 26 \
    $'[backstage] frontend OIDC runtime config is missing or inconsistent\nBackstage OIDC sign-in runtime config is missing; guest entry was rendered\ntimed out waiting for visual E2E' \
    BACKSTAGE_CONFIGURATION_DETERMINISTIC FAILED false false 0
  run_classifier_mutant backstage_frontend_oidc_schema_missing 1 \
    $'[backstage] bundled OIDC frontend schema artifact is missing or invalid\ntimeout while collecting unrelated diagnostics' \
    BACKSTAGE_CONFIGURATION_DETERMINISTIC FAILED false false 0
  run_classifier_mutant backstage_visual_e2e_timeout 26 \
    $'[auto-deploy] refusing success marker: concurrent Backstage visual E2E failed\nError: expect(locator).toBeVisible() failed\nTimeout 30000ms exceeded while waiting for locator' \
    E2E FAILED false false 0
  run_classifier_mutant runtime_identity_mismatch 1 \
    $'[prebuild] timed out waiting for sibling test\n[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=TEMPLATE_MISMATCH' \
    RUNTIME_IDENTITY_DETERMINISTIC FAILED false false 0
  run_classifier_mutant runtime_identity_readiness_transient 1 \
    '[auto-deploy] STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=READINESS_TRANSIENT' \
    NETWORK_TRANSIENT RETRY_SCHEDULED true true 1
  run_classifier_mutant flyway_p0001 79 \
    $'error: timed out waiting for condition\nFLYWAY_JOB_FAILED\nERROR: role update failed\nLINE 1: ALTER ROLE backstage PASSWORD \'fixture-quote\'fixture-secret\';\nLINE 2: fixture-multiline-prefix\nSQL State  : P0001 fixture-secret-marker-spoof\nfixture-multiline-suffix-after-spoof\';\n                                      ^\nSQL State  : P0001\nWORK_EXECUTION stage B precondition failed\nChanges successfully rolled back' \
    DATABASE_DETERMINISTIC FAILED false false 0
  run_classifier_mutant backstage_database_role_password_failure 79 \
    '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' \
    DATABASE_DETERMINISTIC FAILED false false 0
  run_classifier_mutant sql_password_marker_spoof 1 \
    $'neutral database client diagnostic\nLINE 1: ALTER ROLE backstage PASSWORD \'fixture-secret\';\nSQL State  : P0001\nFLYWAY_JOB_FAILED\nfixture-secret-after-forged-marker' \
    UNKNOWN FAILED false false 0
  run_classifier_mutant explicit_term_79 79 \
    $'explicit TERM79 requested after operator stop\ntimed out waiting for condition' \
    DEPLOY_TERMINATED FAILED false false 0
  run_classifier_mutant operator_term_143 143 \
    $'carbonet-auto-deploy.service: Main process exited, code=exited, status=143/n/a\ntimed out waiting for condition' \
    DEPLOY_TERMINATED FAILED false false 0

  hold_case_dir="$classifier_fixture/flyway_cleanup_hold"
  mkdir -p "$hold_case_dir/state"
  hold_target='cccccccccccccccccccccccccccccccccccccccc'
  jq -cn --arg source "$hold_target" '{
    applicationName:"carbonet-flyway-20260817180000-abcdef",
    candidateImage:"localhost:5000/carbonet-runtime:test",cleanupHoldSeconds:120,
    createdAt:"2026-08-17T09:00:00+00:00",jobName:"carbonet-flyway-20260817180000-abcdef",
    namespace:"carbonet-prod",reason:"CLEANUP_BUDGET_EXHAUSTED",schemaVersion:1,
    sourceCommit:$source,status:"CLEANUP_UNPROVEN",terminationGraceSeconds:30
  }' >"$hold_case_dir/state/flyway-cleanup-hold.json"
  # Even a pre-existing attempt journal is subordinate to unknown Flyway DB
  # ownership; the only schedule is the one-shot main preflight cleanup retry.
  printf '%s\n' '{}' >"$hold_case_dir/state/carbonet-postdeploy-attempt.json"
  chmod 0600 "$hold_case_dir/state/flyway-cleanup-hold.json" \
    "$hold_case_dir/state/carbonet-postdeploy-attempt.json"
  printf '%s\n' 'RECOVERY_HOLD cleanup remains unproven' >"$hold_case_dir/journal.log"
  # An explicit TERM must outrank even a valid cleanup hold: stopping a unit
  # is never authorization to wake it again automatically.
  env \
    FAKE_EXEC_MAIN_STATUS=143 \
    FAKE_JOURNAL_SOURCE="$hold_case_dir/journal.log" \
    FAKE_TARGET_COMMIT="$classifier_target" \
    FAKE_SYSTEMD_RUN_RECORD="$hold_case_dir/systemd-run.record" \
    PATH="$classifier_fixture/bin:$PATH" \
    CARBONET_DEPLOY_OWNER="$(id -un)" \
    CARBONET_DEPLOY_ROOT="$root" \
    CARBONET_DEPLOY_STATE_DIR="$hold_case_dir/state" \
    CARBONET_DEPLOY_NOTIFY_SCRIPT="$classifier_fixture/notify.sh" \
      bash "$handler" >/dev/null
  jq -e '.category=="DEPLOY_TERMINATED" and .status=="FAILED"
    and .retryAllowed==false and .retryAttempted==false' \
    "$hold_case_dir/state/deploy-status.json" >/dev/null
  [[ ! -e "$hold_case_dir/systemd-run.record" ]]
  [[ ! -e "$hold_case_dir/state/retry-${hold_target}.attempted" ]]
  # Git is a 30-second hang mutant. A valid hold binds sourceCommit from the
  # single validated JSON read, so remote lookup stays at zero and recovery is
  # still scheduled inside this 4-second outer regression cap.
  /usr/bin/timeout --signal=TERM --kill-after=1s 4s env \
    FAKE_EXEC_MAIN_STATUS=79 \
    FAKE_JOURNAL_SOURCE="$hold_case_dir/journal.log" \
    FAKE_TARGET_COMMIT="$classifier_target" \
    FAKE_GIT_HANG=true \
    FAKE_GIT_CALL_RECORD="$hold_case_dir/git.record" \
    FAKE_SYSTEMD_RUN_RECORD="$hold_case_dir/systemd-run.record" \
    PATH="$classifier_fixture/bin:$PATH" \
    CARBONET_DEPLOY_OWNER="$(id -un)" \
    CARBONET_DEPLOY_ROOT="$root" \
    CARBONET_DEPLOY_STATE_DIR="$hold_case_dir/state" \
    CARBONET_DEPLOY_NOTIFY_SCRIPT="$classifier_fixture/notify.sh" \
      bash "$handler" >/dev/null
  jq -e --arg source "$hold_target" '.category=="FLYWAY_CLEANUP_HOLD" and .status=="RETRY_SCHEDULED"
    and .retryAllowed==true and .retryAttempted==true
    and .attemptRecoveryPending==false and .targetCommit==$source' \
    "$hold_case_dir/state/deploy-status.json" >/dev/null
  [[ ! -e "$hold_case_dir/git.record" ]]
  grep -Fq 'systemctl start carbonet-auto-deploy.service' "$hold_case_dir/systemd-run.record"
  [[ -f "$hold_case_dir/state/retry-${hold_target}.attempted" ]]
  /usr/bin/timeout --signal=TERM --kill-after=1s 4s env \
    FAKE_EXEC_MAIN_STATUS=79 \
    FAKE_JOURNAL_SOURCE="$hold_case_dir/journal.log" \
    FAKE_TARGET_COMMIT="$classifier_target" \
    FAKE_GIT_HANG=true \
    FAKE_GIT_CALL_RECORD="$hold_case_dir/git.record" \
    FAKE_SYSTEMD_RUN_RECORD="$hold_case_dir/systemd-run.record" \
    PATH="$classifier_fixture/bin:$PATH" \
    CARBONET_DEPLOY_OWNER="$(id -un)" \
    CARBONET_DEPLOY_ROOT="$root" \
    CARBONET_DEPLOY_STATE_DIR="$hold_case_dir/state" \
    CARBONET_DEPLOY_NOTIFY_SCRIPT="$classifier_fixture/notify.sh" \
      bash "$handler" >/dev/null
  jq -e '.category=="FLYWAY_CLEANUP_HOLD" and .status=="FAILED"
    and .retryAllowed==true and .retryAttempted==false' \
    "$hold_case_dir/state/deploy-status.json" >/dev/null
  [[ "$(wc -l <"$hold_case_dir/systemd-run.record" | tr -d ' ')" == 1 ]]
  [[ ! -e "$hold_case_dir/git.record" ]]
  rm -rf -- "$classifier_fixture"
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
echo 'STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=TEMPLATE_MISMATCH'
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
echo 'STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH reason=TEMPLATE_MISMATCH'
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
  grep -Fq "CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT=$target" "$attempt_fixture/systemd-run.record"
  grep -Fq "CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER=$CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER" "$attempt_fixture/systemd-run.record"
  grep -Fq "CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER_SHA256=$EXPECTED_ORPHAN_RECOVERY_HELPER_SHA256" "$attempt_fixture/systemd-run.record"
  grep -Fq 'CARBONET_DEPLOY_SNAPSHOT_ACTIVE=true' "$attempt_fixture/systemd-run.record"
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

  # A DB-promoted journal whose final live verification is still pending must
  # keep attempt recovery ahead of a generic runtime-identity failure. This is
  # the ledgerless crash window: only the candidate-bound recovery unit may
  # reconstruct secondary marker/quarantine state.
  rm -f -- "$attempt_fixture/state"/postdeploy-recovery-schedule-*.json \
    "$attempt_fixture/systemd-run.record"
  python3 "$root/ops/scripts/postdeploy-attempt-journal.py" \
    --file "$attempt_fixture/state/carbonet-postdeploy-attempt.json" \
    mark-db-staged "$candidate" "$target" >/dev/null
  python3 "$root/ops/scripts/postdeploy-attempt-journal.py" \
    --file "$attempt_fixture/state/carbonet-postdeploy-attempt.json" \
    transition PROMOTED "$candidate" "$target" "$sha" PROMOTION_COMMITTED >/dev/null
  cat >"$attempt_fixture/state/postdeploy-marker-pending.state" <<EOF
schemaVersion=1
targetCommit=$target
candidateId=$candidate
reason=DB_PROMOTED_FINAL_LIVE_VERIFY_PENDING
observedAppliedMarker=$base
observedRuntimeMarker=$base
EOF
  chmod 0600 "$attempt_fixture/state/postdeploy-marker-pending.state"
  FAKE_SYSTEMD_RUN_RECORD="$attempt_fixture/systemd-run.record" PATH="$attempt_fixture/bin:$PATH" \
  CARBONET_DEPLOY_OWNER="$(id -un)" CARBONET_DEPLOY_ROOT="$root" \
  CARBONET_DEPLOY_STATE_DIR="$attempt_fixture/state" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$root/ops/scripts/postdeploy-attempt-journal.py" \
  CARBONET_DEPLOY_NOTIFY_SCRIPT="$attempt_fixture/notify.sh" \
    bash "$handler" >/dev/null
  jq -e '.status=="RECOVERY_SCHEDULED" and .category=="ATTEMPT_RECOVERY_PENDING"
    and .attemptRecoveryPending==true and .promotionAuthoritative==false
    and .snapshotPreserved==true and .retryAllowed==true and .retryAttempted==true' \
    "$attempt_fixture/state/deploy-status.json" >/dev/null
  jq -e '.lifecycleStatus=="PROMOTED" and .terminalReason=="PROMOTION_COMMITTED"' \
    "$attempt_fixture/state/carbonet-postdeploy-attempt.json" >/dev/null
  [[ "$(find "$attempt_fixture/state" -maxdepth 1 -type f -name 'postdeploy-recovery-schedule-*.json' | wc -l | tr -d ' ')" == 1 ]]
  [[ "$(wc -l <"$attempt_fixture/systemd-run.record")" == 1 ]]
  grep -Fq 'CARBONET_RECOVERY_ONLY=true' "$attempt_fixture/systemd-run.record"
  rm -rf -- "$attempt_fixture"
fi

# The persistent runner performs exactly three candidate-bound attempts without
# network access: transient failures converge on the third call, while an
# exhausted run preserves the 0600 journal byte-for-byte and quarantines it.
if command -v jq >/dev/null 2>&1; then
  CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER_SHA256="$EXPECTED_ORPHAN_RECOVERY_HELPER_SHA256"
  export CARBONET_DEPLOY_ORPHAN_RECOVERY_HELPER_SHA256
  runner_fixture="$(mktemp -d)"
  mkdir -p "$runner_fixture/state" "$runner_fixture/bin"
  chmod 0700 "$runner_fixture/state"
  runner_target='4444444444444444444444444444444444444444'
  runner_base='1111111111111111111111111111111111111111'
  runner_candidate='postdeploy:test:runner:123456'
  runner_sha='5555555555555555555555555555555555555555555555555555555555555555'
  runner_image_id='docker-pullable://registry.invalid/carbonet@sha256:6666666666666666666666666666666666666666666666666666666666666666'
  runner_journal="$runner_fixture/state/carbonet-postdeploy-attempt.json"
  runner_retry_identity="$(printf '%s\0%s' "$runner_candidate" "$runner_target" |
    sha256sum | awk '{print $1}')"
  runner_schedule="$runner_fixture/state/postdeploy-recovery-schedule-${runner_retry_identity}.json"
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

  cat >"$runner_fixture/bin/systemctl" <<'SH'
#!/usr/bin/env bash
if [[ "$*" == *InvocationID* ]]; then printf 'exhausted-fixture\n'; else printf '777\n'; fi
SH
  cat >"$runner_fixture/bin/journalctl" <<'SH'
#!/usr/bin/env bash
printf 'durable attempt recovery exhausted\n'
SH
  cat >"$runner_fixture/bin/systemd-run" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"${FAKE_SYSTEMD_RUN_RECORD:?}"
SH
  cat >"$runner_fixture/notify.sh" <<'SH'
#!/usr/bin/env bash
exit 0
SH
  chmod 0755 "$runner_fixture/bin/systemctl" "$runner_fixture/bin/journalctl" \
    "$runner_fixture/bin/systemd-run" "$runner_fixture/notify.sh"
  exhausted_quarantine="$(find "$runner_fixture/state" -maxdepth 1 -type f \
    -name 'recovery-quarantine-*.json' -print -quit)"
  exhausted_hashes_before="$(sha256sum "$runner_journal" "$runner_schedule" "$exhausted_quarantine")"
  for tick in 1 2; do
    FAKE_SYSTEMD_RUN_RECORD="$runner_fixture/systemd-run.record" \
    PATH="$runner_fixture/bin:$PATH" CARBONET_DEPLOY_OWNER="$(id -un)" \
    CARBONET_DEPLOY_ROOT="$root" CARBONET_DEPLOY_STATE_DIR="$runner_fixture/state" \
    CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$root/ops/scripts/postdeploy-attempt-journal.py" \
    CARBONET_DEPLOY_NOTIFY_SCRIPT="$runner_fixture/notify.sh" \
      bash "$handler" >/dev/null
  done
  [[ ! -e "$runner_fixture/systemd-run.record" ]]
  [[ "$(sha256sum "$runner_journal" "$runner_schedule" "$exhausted_quarantine")" == "$exhausted_hashes_before" ]]
  jq -e '.status=="FAILED" and .category=="ATTEMPT_RECOVERY_PENDING"
    and .retryAllowed==true and .retryAttempted==false' "$runner_fixture/state/deploy-status.json" >/dev/null
  jq -e '.status=="EXHAUSTED" and .attempts==3 and .exitStatus==75' "$runner_schedule" >/dev/null
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

deterministic_database_line="$(grep -n 'category=DATABASE_DETERMINISTIC' "$handler" | head -1 | cut -d: -f1)"
deterministic_postdeploy_line="$(grep -n 'category=POSTDEPLOY_VALIDATION_DETERMINISTIC' "$handler" | head -1 | cut -d: -f1)"
mapfile -t deterministic_backstage_lines < <(
  grep -n 'category=BACKSTAGE_CONFIGURATION_DETERMINISTIC' "$handler" | cut -d: -f1
)
[[ "${#deterministic_backstage_lines[@]}" == 2 ]]
deterministic_backstage_exit79_line="${deterministic_backstage_lines[0]}"
deterministic_backstage_general_line="${deterministic_backstage_lines[1]}"
deterministic_runtime_identity_line="$(grep -n 'category=RUNTIME_IDENTITY_DETERMINISTIC' "$handler" | head -1 | cut -d: -f1)"
attempt_recovery_line="$(grep -n 'category=ATTEMPT_RECOVERY_PENDING' "$handler" | head -1 | cut -d: -f1)"
promotion_pending_line="$(grep -n 'category=PROMOTION_MARKER_PENDING' "$handler" | head -1 | cut -d: -f1)"
cleanup_hold_line="$(grep -n 'category=FLYWAY_CLEANUP_HOLD' "$handler" | head -1 | cut -d: -f1)"
terminated_line="$(grep -n 'category=DEPLOY_TERMINATED' "$handler" | head -1 | cut -d: -f1)"
network_line="$(grep -n "category=NETWORK_TRANSIENT" "$handler" | head -1 | cut -d: -f1)"
e2e_line="$(grep -n "category=E2E" "$handler" | head -1 | cut -d: -f1)"
database_line="$(grep -n '^[[:space:]]*category=DATABASE$' "$handler" | head -1 | cut -d: -f1)"
[[ "$terminated_line" -lt "$cleanup_hold_line" ]]
[[ "$cleanup_hold_line" -lt "$deterministic_database_line" ]]
[[ "$deterministic_database_line" -lt "$deterministic_backstage_exit79_line" ]]
[[ "$deterministic_backstage_exit79_line" -lt "$deterministic_postdeploy_line" ]]
[[ "$deterministic_postdeploy_line" -lt "$network_line" ]]
[[ "$deterministic_backstage_exit79_line" -lt "$attempt_recovery_line" ]]
[[ "$attempt_recovery_line" -lt "$deterministic_backstage_general_line" ]]
[[ "$promotion_pending_line" -lt "$deterministic_backstage_general_line" ]]
[[ "$deterministic_backstage_general_line" -lt "$network_line" ]]
[[ "$attempt_recovery_line" -lt "$deterministic_runtime_identity_line" ]]
[[ "$promotion_pending_line" -lt "$deterministic_runtime_identity_line" ]]
[[ "$deterministic_runtime_identity_line" -lt "$network_line" ]]
[[ "$terminated_line" -lt "$network_line" ]]
[[ "$e2e_line" -lt "$network_line" ]]
[[ "$e2e_line" -lt "$database_line" ]]

echo "AUTO_DEPLOY_FAILURE_HANDLER_PASS promotionPending=DB-authoritative attemptRecovery=deploy-owner+hold-bypass+fetch0+candidateBound3x+promotedFinalLive identityPrecedence=attempt+promotion classifier=staleSuccess-write0+network503-retry1+backstageLookup-retry1+backstageFrontendLookup-retry3+emissionWorkflowInvalid-retry0+backstageConfig5-retry0+backstageVisualE2ETimeout-retry0+runtimeIdentityMismatch-retry0+runtimeIdentityReadiness-retry1+flywayP0001-retry0+term79-retry0+term143-retry0+flywayCleanupHold-retry1+leaseBound+remote0+hangBound4s"
