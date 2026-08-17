#!/usr/bin/env bash
set -Eeuo pipefail

root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
helper="$root/ops/scripts/retire-legacy-runtime-mutation-automation.sh"
auto="$root/ops/scripts/auto-deploy-main.sh"
launcher="$root/ops/scripts/auto-deploy-main-launcher.sh"
installer="$root/ops/scripts/resonance-k8s-ops-automation-install.sh"
selector="$root/ops/scripts/select-catalog-contract-tests.sh"
autorecovery="$root/ops/scripts/autorecovery/check-and-recover.sh"
autorecovery_watchdog="$root/ops/scripts/autorecovery/watchdog-daemon.sh"
react_route_self_heal="$root/ops/scripts/resonance-react-route-self-heal.sh"

for file in "$helper" "$auto" "$launcher" "$installer" "$selector" "$autorecovery" "$autorecovery_watchdog" "$react_route_self_heal"; do
  [[ -s "$file" && ! -L "$file" ]] || { echo "missing/unsafe: $file" >&2; exit 1; }
  bash -n "$file"
done

python3 - "$helper" "$auto" "$launcher" "$installer" "$selector" "$autorecovery" "$autorecovery_watchdog" "$react_route_self_heal" <<'PY'
from pathlib import Path
import sys

helper, auto, launcher, installer, selector, recovery, watchdog, route_heal = (
    Path(path).read_text(encoding="utf-8") for path in sys.argv[1:]
)
targets = (
    "*/5 * * * * cd /opt/Resonance && bash ops/scripts/autorecovery/check-and-recover.sh carbonet-prod carbonet-runtime deployment /var/log/resonance-autorecovery.log >> /var/log/resonance-autorecovery.log 2>&1",
    "@reboot /opt/Resonance/ops/scripts/resonance-up.sh >> /opt/Resonance/var/log/resonance-up-reboot.log 2>&1",
    "* * * * * /opt/Resonance/ops/scripts/resonance-watchdog.sh >> /opt/Resonance/var/ai-runtime/watchdog.log 2>&1",
)
for target in targets:
    assert helper.count(target) == 1
assert 'runtimeRecoveryRemoved' in helper and 'missingWatchdogRemoved' in helper
assert 'spoolBeforeSha256' in helper and 'spoolAfterMode": "600"' in helper
assert '"schemaVersion": 2' in helper and 'firstRemediationSha256' in helper
assert 'completed receipt watchdog binding is stale' in helper
assert 'parsed.netloc' not in helper and 'parsed.hostname' in helper
assert 'kubectl' not in helper
assert 'trap cleanup EXIT' in helper and "trap 'exit 130' INT" in helper and "trap 'exit 143' TERM" in helper
assert helper.count('fsync_regular_file "$') >= 4
assert helper.count('"resonanceReactRouteSelfHealTimer": "disabled-inactive"') == 2
assert helper.count('"resonanceReactRouteSelfHealService": "disabled-inactive"') == 2
assert 'r"^(?:(?:\\S*/)?(?:bash|sh)\\s+)?(?:\\S*/)?ops/scripts/autorecovery/check-and-recover\\.sh' in helper
assert 'r"(?:^|\\\\s)' not in helper

bootstrap = auto.index('bootstrap_target_legacy_automation_retirement_helper_if_required || exit $?')
retire = auto.index('if ! bash "$LEGACY_AUTOMATION_RETIRE_HELPER"', bootstrap)
execution_start = auto.index('mkdir -p "$(dirname "$LOCK_FILE")"')
execution_prefix = auto[execution_start:retire]
for forbidden in (
    'kubectl ', 'pg_dump', 'run_runtime_candidate_checkpoint', 'timestamp="$(date',
    'git merge --ff-only', 'resonance-k8s-build-deploy-80-v2.sh',
    'promote-runtime-startup-profile.sh', 'recover_flyway_cleanup_hold_if_present || exit $?',
):
    assert forbidden not in execution_prefix
failure_block = auto[retire:auto.index('record_deploy_phase "legacy_automation_retirement"', retire)]
assert "exit 79" in failure_block
for later in (
    'recover_flyway_cleanup_hold_if_present || exit $?',
    'run_runtime_candidate_checkpoint prepare',
    'timestamp="$(date',
    'git merge --ff-only "$target_commit"',
    'run_runtime_template_identity_migration_contract_if_required',
    'bash ops/scripts/promote-runtime-startup-profile.sh',
    'bash ops/scripts/resonance-k8s-build-deploy-80-v2.sh',
):
    assert retire < auto.index(later, retire)
for token in (
    'snapshot_legacy_automation_retirement_helper=',
    'CARBONET_LEGACY_AUTOMATION_RETIRE_HELPER="$snapshot_legacy_automation_retirement_helper"',
    'CARBONET_LEGACY_AUTOMATION_RETIRE_HELPER_SHA256="$snapshot_legacy_automation_retirement_helper_sha256"',
):
    assert token in launcher
assert 'target legacy-automation retirement helper bootstrapped from authenticated commit' in auto
assert 'install_unit resonance-startup-watchdog' not in installer
assert 'enable --now resonance-startup-watchdog' not in installer
assert 'install_unit resonance-frontend-auto-build' not in installer
assert 'enable --now resonance-frontend-auto-build' not in installer
assert 'resonance-frontend-auto-build.timer' in installer
assert 'resonance-react-route-self-heal.timer' in installer
assert installer.count('disable --now') >= 2
for source in (recovery, watchdog):
    guard = source.index('production runtime mutation entrypoint retired')
    first_kubectl = source.index('kubectl')
    assert guard < first_kubectl and 'exit 78' in source[:first_kubectl]
assert route_heal.count('exit 78') == 1
assert 'official durable auto-deploy pipeline (mutation=0)' in route_heal
for token in ('node ', 'flock ', 'source ', 'screen-overlay-apply', 'kubectl ', 'rsync ', 'cp ', 'mv '):
    assert token not in route_heal
for path in (
    'retire-legacy-runtime-mutation-automation.sh',
    'test-retire-legacy-runtime-mutation-automation.sh',
    'autorecovery/check-and-recover.sh',
    'autorecovery/watchdog-daemon.sh',
    'resonance-k8s-ops-automation-install.sh',
    'resonance-react-route-self-heal.sh',
):
    assert path in selector
PY

tmp="$(mktemp -d)"
bridge_snapshot_dir=""
trap '[[ "${KEEP_RETIRE_TEST_TMP:-false}" == true ]] || rm -rf -- "$tmp" "${bridge_snapshot_dir:-}"' EXIT
mkdir -p "$tmp/bin" "$tmp/state" "$tmp/receipt" "$tmp/log" "$tmp/installed/ops/scripts"
cron_user="$(id -un)"
uid="$(id -u)"

seed_installed_originals() {
  local destination="$1"
  mkdir -p "$destination/ops/scripts"
  printf '%s\n' '#!/usr/bin/env bash' 'printf "unsafe-v3\\n" >>"$INSTALLED_UNSAFE_CALLS"' \
    'exit 97' >"$destination/ops/scripts/resonance-v3-deploy.sh"
  printf '%s\n' '#!/usr/bin/env bash' 'printf "unsafe-up\\n" >>"$INSTALLED_UNSAFE_CALLS"' \
    'exit 97' >"$destination/ops/scripts/resonance-up.sh"
  printf '%s\n' '#!/usr/bin/env bash' 'printf "unsafe-build-v2\\n" >>"$INSTALLED_UNSAFE_CALLS"' \
    'exit 97' >"$destination/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
  chmod 0755 "$destination/ops/scripts/resonance-v3-deploy.sh"
  chmod 0664 "$destination/ops/scripts/resonance-up.sh"
  chmod 0644 "$destination/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
}
RETIRE_INSTALLED_ROOT="$tmp/installed"
INSTALLED_UNSAFE_CALLS="$tmp/state/installed-unsafe-calls"
: >"$INSTALLED_UNSAFE_CALLS"
seed_installed_originals "$RETIRE_INSTALLED_ROOT"
RETIRE_V3_ORIGINAL_SHA="$(sha256sum "$RETIRE_INSTALLED_ROOT/ops/scripts/resonance-v3-deploy.sh" | awk '{print $1}')"
RETIRE_UP_ORIGINAL_SHA="$(sha256sum "$RETIRE_INSTALLED_ROOT/ops/scripts/resonance-up.sh" | awk '{print $1}')"
RETIRE_BUILD_V2_ORIGINAL_SHA="$(sha256sum "$RETIRE_INSTALLED_ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh" | awk '{print $1}')"

# A launcher installed before this helper existed still loads the target auto
# snapshot. Execute the production bridge function against a disposable Git
# target and prove it creates a private, target-exact helper in that already
# trusted snapshot directory. An unsafe snapshot mode is rejected.
bridge_repo="$tmp/bridge-repo"
mkdir -p "$bridge_repo/ops/scripts"
cp -- "$helper" "$bridge_repo/ops/scripts/retire-legacy-runtime-mutation-automation.sh"
git -C "$bridge_repo" init -q
git -C "$bridge_repo" config user.name fixture
git -C "$bridge_repo" config user.email fixture@example.invalid
git -C "$bridge_repo" add ops/scripts/retire-legacy-runtime-mutation-automation.sh
git -C "$bridge_repo" commit -qm target
bridge_target="$(git -C "$bridge_repo" rev-parse HEAD)"
python3 - "$auto" "$tmp/bootstrap-functions.sh" <<'PY'
from pathlib import Path
import sys
source = Path(sys.argv[1]).read_text(encoding="utf-8")
start = source.index("fail_bootstrap_legacy_automation_retirement_helper() {")
end = source.index("\nverify_bootstrap_legacy_automation_retirement_helper() {", start)
Path(sys.argv[2]).write_text(source[start:end] + "\n", encoding="utf-8")
PY
bridge_snapshot_dir="$(mktemp -d /tmp/carbonet-auto-deploy-main.XXXXXX)"
printf '#!/usr/bin/env bash\n' >"$bridge_snapshot_dir/auto-deploy-main.sh"
chmod 0700 "$bridge_snapshot_dir" "$bridge_snapshot_dir/auto-deploy-main.sh"
POLICY_ROOT="$bridge_repo" \
CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT="$bridge_target" \
CARBONET_DEPLOY_SNAPSHOT_PATH="$bridge_snapshot_dir/auto-deploy-main.sh" \
LEGACY_AUTOMATION_RETIRE_HELPER_EXPLICIT=false \
LEGACY_AUTOMATION_RETIRE_HELPER='' \
LEGACY_AUTOMATION_RETIRE_HELPER_SHA256='' \
  bash -c 'set -Eeuo pipefail; source "$1"; bootstrap_target_legacy_automation_retirement_helper_if_required; \
    [[ "$LEGACY_AUTOMATION_RETIRE_HELPER_EXPLICIT" == true ]]; \
    [[ "$(stat -c %a "$LEGACY_AUTOMATION_RETIRE_HELPER")" == 700 ]]; \
    cmp -s "$LEGACY_AUTOMATION_RETIRE_HELPER" "$2"' \
    _ "$tmp/bootstrap-functions.sh" "$helper"
rm -rf -- "$bridge_snapshot_dir"
bridge_snapshot_dir="$(mktemp -d /tmp/carbonet-auto-deploy-main.XXXXXX)"
printf '#!/usr/bin/env bash\n' >"$bridge_snapshot_dir/auto-deploy-main.sh"
chmod 0755 "$bridge_snapshot_dir/auto-deploy-main.sh"
status=0
POLICY_ROOT="$bridge_repo" \
CARBONET_DEPLOY_SNAPSHOT_TARGET_COMMIT="$bridge_target" \
CARBONET_DEPLOY_SNAPSHOT_PATH="$bridge_snapshot_dir/auto-deploy-main.sh" \
LEGACY_AUTOMATION_RETIRE_HELPER_EXPLICIT=false \
LEGACY_AUTOMATION_RETIRE_HELPER='' \
LEGACY_AUTOMATION_RETIRE_HELPER_SHA256='' \
  bash -c 'set -Eeuo pipefail; source "$1"; bootstrap_target_legacy_automation_retirement_helper_if_required' \
    _ "$tmp/bootstrap-functions.sh" >/dev/null 2>&1 || status=$?
[[ "$status" == 79 && -z "$(find "$bridge_snapshot_dir" -name '.retire-*' -print -quit)" ]]
rm -rf -- "$bridge_snapshot_dir"
bridge_snapshot_dir=""

runtime_line='*/5 * * * * cd /opt/Resonance && bash ops/scripts/autorecovery/check-and-recover.sh carbonet-prod carbonet-runtime deployment /var/log/resonance-autorecovery.log >> /var/log/resonance-autorecovery.log 2>&1'
reboot_line='@reboot /opt/Resonance/ops/scripts/resonance-up.sh >> /opt/Resonance/var/log/resonance-up-reboot.log 2>&1'
missing_watchdog_line='* * * * * /opt/Resonance/ops/scripts/resonance-watchdog.sh >> /opt/Resonance/var/ai-runtime/watchdog.log 2>&1'
redis_line='*/5 * * * * cd /opt/Resonance && bash ops/scripts/autorecovery/check-and-recover.sh carbonet-prod carbonet-redis statefulset /var/log/resonance-redis-autorecovery.log >> /var/log/resonance-redis-autorecovery.log 2>&1'

cat >"$tmp/bin/sudo" <<'SH'
#!/usr/bin/env bash
[[ "${1:-}" != -n ]] || shift
exec "$@"
SH
cat >"$tmp/bin/crontab" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$1" == -u && "$2" == "$RETIRE_CRON_USER" ]]
shift 2
if [[ "$1" == -l ]]; then
  cat "$RETIRE_CRON_STATE"
  exit 0
fi
if [[ "${RETIRE_FAIL_CRONTAB_INSTALL:-false}" == true ]]; then
  if [[ "${RETIRE_CRONTAB_INSTALLS_THEN_FAIL:-false}" == true ]]; then
    cp -- "$1" "$RETIRE_CRON_STATE"
    chmod 0600 "$RETIRE_CRON_STATE"
    printf 'crontab-install\n' >>"$RETIRE_MUTATION_CALLS"
  fi
  exit 90
fi
cp -- "$1" "$RETIRE_CRON_STATE"
chmod 0600 "$RETIRE_CRON_STATE"
printf 'crontab-install\n' >>"$RETIRE_MUTATION_CALLS"
SH
cat >"$tmp/bin/systemctl" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
command="$1"; shift
case "$command" in
  show)
    unit="$1"; shift
    if [[ "$*" == *ActiveState* ]]; then
      if [[ -f "$RETIRE_STATE_DIR/$unit.active" ]]; then
        cat "$RETIRE_STATE_DIR/$unit.active"
      else
        printf 'active\n'
      fi
    else
      printf 'loaded\n'
    fi
    ;;
  is-enabled)
    if [[ "$1" == carbonet-post-reboot-recovery.service ]]; then
      printf 'enabled\n'
    elif [[ -f "$RETIRE_STATE_DIR/$1.enabled" ]]; then
      cat "$RETIRE_STATE_DIR/$1.enabled"
    else
      printf 'enabled\n'
    fi
    ;;
  is-active)
    if [[ -f "$RETIRE_STATE_DIR/$1.active" ]]; then
      cat "$RETIRE_STATE_DIR/$1.active"
    else
      printf 'active\n'
    fi
    ;;
  disable)
    [[ "$1" == --now ]]; shift
    unit="$1"
    [[ "${RETIRE_FAIL_DISABLE_UNIT:-}" != "$unit" ]] || exit 91
    printf 'disabled\n' >"$RETIRE_STATE_DIR/$unit.enabled"
    printf 'inactive\n' >"$RETIRE_STATE_DIR/$unit.active"
    printf 'systemctl-disable %s\n' "$unit" >>"$RETIRE_MUTATION_CALLS"
    ;;
  stop)
    unit="$1"
    if [[ "${RETIRE_STOP_LEAVES_FAILED_UNIT:-}" == "$unit" ]]; then
      printf 'failed\n' >"$RETIRE_STATE_DIR/$unit.active"
    else
      printf 'inactive\n' >"$RETIRE_STATE_DIR/$unit.active"
    fi
    if [[ "${RETIRE_CREATE_LOG_ON_STOP_UNIT:-}" == "$unit" ]]; then
      printf '%s\n' '{"eventType":"late","targetUrl":"http://late-user:late-password@127.0.0.1:17890/?token=late-query-sentinel"}' >"$RETIRE_LOG"
      chmod 0664 "$RETIRE_LOG"
    fi
    printf 'systemctl-stop %s\n' "$unit" >>"$RETIRE_MUTATION_CALLS"
    ;;
  reset-failed)
    unit="$1"
    printf 'inactive\n' >"$RETIRE_STATE_DIR/$unit.active"
    printf 'systemctl-reset-failed %s\n' "$unit" >>"$RETIRE_MUTATION_CALLS"
    ;;
  *) exit 92 ;;
esac
SH
cat >"$tmp/bin/ps" <<'SH'
#!/usr/bin/env bash
[[ -z "${RETIRE_PS_LINES:-}" || ! -f "$RETIRE_PS_LINES" ]] || cat "$RETIRE_PS_LINES"
SH
chmod +x "$tmp/bin/"*

run_helper() {
  PATH="$tmp/bin:$PATH" \
  RETIRE_CRON_USER="$cron_user" \
  RETIRE_CRON_STATE="$RETIRE_CRON_STATE" \
  RETIRE_STATE_DIR="$RETIRE_STATE_DIR" \
  RETIRE_MUTATION_CALLS="$RETIRE_MUTATION_CALLS" \
  RETIRE_LOG="$RETIRE_LOG" \
  RETIRE_PS_LINES="${RETIRE_PS_LINES:-}" \
  RETIRE_FAIL_DISABLE_UNIT="${RETIRE_FAIL_DISABLE_UNIT:-}" \
  RETIRE_FAIL_CRONTAB_INSTALL="${RETIRE_FAIL_CRONTAB_INSTALL:-false}" \
  RETIRE_CRONTAB_INSTALLS_THEN_FAIL="${RETIRE_CRONTAB_INSTALLS_THEN_FAIL:-false}" \
  RETIRE_STOP_LEAVES_FAILED_UNIT="${RETIRE_STOP_LEAVES_FAILED_UNIT:-}" \
  RETIRE_CREATE_LOG_ON_STOP_UNIT="${RETIRE_CREATE_LOG_ON_STOP_UNIT:-}" \
  CARBONET_LEGACY_AUTOMATION_CRON_USER="$cron_user" \
  CARBONET_LEGACY_AUTOMATION_CRON_SPOOL_FILE="$RETIRE_CRON_STATE" \
  CARBONET_LEGACY_AUTOMATION_RECEIPT_FILE="$RETIRE_RECEIPT" \
  CARBONET_LEGACY_AUTOMATION_WATCHDOG_EVENT_LOG="$RETIRE_LOG" \
  CARBONET_LEGACY_AUTOMATION_INSTALLED_ROOT="$RETIRE_INSTALLED_ROOT" \
  CARBONET_LEGACY_V3_ORIGINAL_SHA256="$RETIRE_V3_ORIGINAL_SHA" \
  CARBONET_LEGACY_UP_ORIGINAL_SHA256="$RETIRE_UP_ORIGINAL_SHA" \
  CARBONET_LEGACY_BUILD_V2_ORIGINAL_SHA256="$RETIRE_BUILD_V2_ORIGINAL_SHA" \
  CARBONET_LEGACY_AUTOMATION_PROCESS_WAIT_SECONDS=0 \
  CARBONET_LEGACY_AUTOMATION_ALLOW_TEST_HOOKS=true \
  CARBONET_LEGACY_AUTOMATION_TEST_FAIL_AFTER="${RETIRE_TEST_FAIL_AFTER:-}" \
  CARBONET_LEGACY_AUTOMATION_SUDO_BIN="$tmp/bin/sudo" \
  CARBONET_LEGACY_AUTOMATION_CRONTAB_BIN="$tmp/bin/crontab" \
  CARBONET_LEGACY_AUTOMATION_SYSTEMCTL_BIN="$tmp/bin/systemctl" \
  CARBONET_LEGACY_AUTOMATION_PS_BIN="$tmp/bin/ps" \
    bash ${TRACE_RETIRE_HELPER:+-x} "$helper"
}

RETIRE_CRON_STATE="$tmp/state/crontab"
RETIRE_STATE_DIR="$tmp/state/systemd"
RETIRE_MUTATION_CALLS="$tmp/state/calls"
RETIRE_RECEIPT="$tmp/receipt/retirement.json"
RETIRE_LOG="$tmp/log/watchdog.jsonl"
mkdir -p "$RETIRE_STATE_DIR"
: >"$RETIRE_MUTATION_CALLS"
{
  printf '# preserved-first\n%s\n' "$redis_line"
  printf '%s\n' "$runtime_line"
  printf '17 3 * * * /opt/Resonance/ops/scripts/unrelated.sh\n'
  printf '%s\n%s\n' "$reboot_line" "$missing_watchdog_line"
  printf '# preserved-last\n'
} >"$RETIRE_CRON_STATE"
chmod 0600 "$RETIRE_CRON_STATE"
cat >"$tmp/state/expected-crontab" <<EOF
# preserved-first
$redis_line
17 3 * * * /opt/Resonance/ops/scripts/unrelated.sh
# preserved-last
EOF
cat >"$RETIRE_LOG" <<'EOF'
{"schemaVersion":"1.0","eventType":"startup-watchdog","targetUrl":"http://userinfo-sentinel:password-sentinel@127.0.0.1:17890/path?token=query-sentinel","unrelated":{"keep":"exact"}}
{"schemaVersion":"1.0","eventType":"startup-watchdog","targetUrl":"http://127.0.0.1:17890/?other=query-sentinel-2","sequence":2}
EOF
head -c 26 /dev/zero >>"$RETIRE_LOG"
printf '%s\n' '{"schemaVersion":"1.0","eventType":"startup-watchdog","targetUrl":"http://127.0.0.1:17890/recovered?token=query-sentinel-3","recovered":"leading-nul"}' >>"$RETIRE_LOG"
chmod 0664 "$RETIRE_LOG"

RETIRE_STOP_LEAVES_FAILED_UNIT=resonance-recovery.service
run_helper >"$tmp/state/run1.out" 2>&1 || { cat "$tmp/state/run1.out" >&2; exit 1; }
RETIRE_STOP_LEAVES_FAILED_UNIT=''
cmp -s "$RETIRE_CRON_STATE" "$tmp/state/expected-crontab"
[[ "$(grep -c '^crontab-install$' "$RETIRE_MUTATION_CALLS")" == 1 ]]
! grep -Fq 'enable' "$RETIRE_MUTATION_CALLS"
grep -Fxq 'systemctl-reset-failed resonance-recovery.service' "$RETIRE_MUTATION_CALLS"
[[ "$(stat -c %a "$RETIRE_LOG")" == 600 && "$(stat -c %a "$RETIRE_RECEIPT")" == 600 ]]
[[ "$(wc -l <"$RETIRE_LOG" | tr -d '[:space:]')" == 3 ]]
! grep -Eqi 'userinfo-sentinel|password-sentinel|query-sentinel|[?&]token=' \
  "$RETIRE_LOG" "$RETIRE_RECEIPT" "$tmp/state/run1.out"
jq -e '.[0].targetUrl=="http://127.0.0.1:17890/path"
  and .[0].unrelated.keep=="exact"
  and .[1].targetUrl=="http://127.0.0.1:17890/"
  and .[1].sequence==2
  and .[2].targetUrl=="http://127.0.0.1:17890/recovered"
  and .[2].recovered=="leading-nul"' <(jq -s . "$RETIRE_LOG") >/dev/null
jq -e '.schemaVersion==2
  and .firstRemediation.cron.runtimeRecoveryRemoved==1
  and .firstRemediation.cron.rebootRecoveryRemoved==1
  and .firstRemediation.cron.missingWatchdogRemoved==1
  and .firstRemediation.cron.spoolBeforeMode=="600"
  and .firstRemediation.cron.spoolAfterMode=="600"
  and .firstRemediation.inFlightLegacyProcesses==0
  and .firstRemediation.watchdogEventLog.beforeMode=="664"
  and .firstRemediation.watchdogEventLog.afterMode=="600"
  and .firstRemediation.watchdogEventLog.lines==3
  and .firstRemediation.watchdogEventLog.nulRecoveredLines==1
  and .firstRemediation.watchdogEventLog.nulRecoveredBytes==26
  and .firstRemediation.watchdogEventLog.credentialQueryMatches==0
  and .firstRemediation.installedEntrypoints.resonanceV3Deploy.observedAtStage=="ORIGINAL"
  and .firstRemediation.installedEntrypoints.resonanceUp.beforeMode=="664"
  and .firstRemediation.installedEntrypoints.resonanceBuildDeployV2.beforeMode=="644"
  and .lastVerification.installedEntrypoints.resonanceBuildDeployV2.afterMode=="755"
  and .lastVerification.units.resonanceReactRouteSelfHealTimer=="disabled-inactive"
  and .lastVerification.units.resonanceReactRouteSelfHealService=="disabled-inactive"
  and .lastVerification.watchdogEventLog.afterMode=="600"
  and .lastVerification.watchdogEventLog.credentialQueryMatches==0' "$RETIRE_RECEIPT" >/dev/null
first_remediation_json="$(jq -cS '.firstRemediation' "$RETIRE_RECEIPT")"
first_remediation_sha="$(jq -r '.firstRemediationSha256' "$RETIRE_RECEIPT")"
[[ "$(printf '%s' "$first_remediation_json" | sha256sum | awk '{print $1}')" == "$first_remediation_sha" ]]
for retired in resonance-v3-deploy.sh resonance-up.sh resonance-k8s-build-deploy-80-v2.sh; do
  status=0
  INSTALLED_UNSAFE_CALLS="$INSTALLED_UNSAFE_CALLS" \
    bash "$RETIRE_INSTALLED_ROOT/ops/scripts/$retired" >/dev/null 2>&1 || status=$?
  [[ "$status" == 78 ]]
done

# A damaged STAGED journal never authorizes a partial retirement. Digest
# tampering is rejected before installed files, cron, units, or logs change.
MAIN_RETIRE_INSTALLED_ROOT="$RETIRE_INSTALLED_ROOT"
MAIN_RETIRE_CRON_STATE="$RETIRE_CRON_STATE"
MAIN_RETIRE_STATE_DIR="$RETIRE_STATE_DIR"
MAIN_RETIRE_MUTATION_CALLS="$RETIRE_MUTATION_CALLS"
MAIN_RETIRE_RECEIPT="$RETIRE_RECEIPT"
MAIN_RETIRE_LOG="$RETIRE_LOG"
fixture="$tmp/state/pending-tamper"
mkdir -p "$fixture/systemd" "$fixture/receipt" "$fixture/log"
RETIRE_INSTALLED_ROOT="$fixture/installed"
seed_installed_originals "$RETIRE_INSTALLED_ROOT"
RETIRE_CRON_STATE="$fixture/crontab"
RETIRE_STATE_DIR="$fixture/systemd"
RETIRE_MUTATION_CALLS="$fixture/calls"
RETIRE_RECEIPT="$fixture/receipt/result.json"
RETIRE_LOG="$fixture/log/events.jsonl"
printf '%s\n# pending-tamper\n' "$runtime_line" >"$RETIRE_CRON_STATE"; chmod 0600 "$RETIRE_CRON_STATE"
printf '%s\n' '{"targetUrl":"http://pending-user:pending-pass@127.0.0.1:17890/?token=pending-secret"}' >"$RETIRE_LOG"; chmod 0664 "$RETIRE_LOG"
: >"$RETIRE_MUTATION_CALLS"
RETIRE_TEST_FAIL_AFTER=pending
status=0
run_helper >"$fixture/stage.out" 2>&1 || status=$?
[[ "$status" == 94 && -f "$RETIRE_RECEIPT.pending" && ! -e "$RETIRE_RECEIPT" ]]
pending_cron_sha="$(sha256sum "$RETIRE_CRON_STATE" | awk '{print $1}')"
pending_log_sha="$(sha256sum "$RETIRE_LOG" | awk '{print $1}')"
jq '.payload.expected.cronSha256=("0" * 64)' "$RETIRE_RECEIPT.pending" >"$fixture/tampered"
mv -f -- "$fixture/tampered" "$RETIRE_RECEIPT.pending"; chmod 0600 "$RETIRE_RECEIPT.pending"
tampered_pending_sha="$(sha256sum "$RETIRE_RECEIPT.pending" | awk '{print $1}')"
RETIRE_TEST_FAIL_AFTER=''
status=0
run_helper >"$fixture/tampered.out" 2>&1 || status=$?
[[ "$status" != 0 && ! -e "$RETIRE_RECEIPT" && ! -s "$RETIRE_MUTATION_CALLS" ]]
[[ "$(sha256sum "$RETIRE_RECEIPT.pending" | awk '{print $1}')" == "$tampered_pending_sha" \
   && "$(sha256sum "$RETIRE_CRON_STATE" | awk '{print $1}')" == "$pending_cron_sha" \
   && "$(sha256sum "$RETIRE_LOG" | awk '{print $1}')" == "$pending_log_sha" ]]
RETIRE_INSTALLED_ROOT="$MAIN_RETIRE_INSTALLED_ROOT"
RETIRE_CRON_STATE="$MAIN_RETIRE_CRON_STATE"
RETIRE_STATE_DIR="$MAIN_RETIRE_STATE_DIR"
RETIRE_MUTATION_CALLS="$MAIN_RETIRE_MUTATION_CALLS"
RETIRE_RECEIPT="$MAIN_RETIRE_RECEIPT"
RETIRE_LOG="$MAIN_RETIRE_LOG"
[[ ! -s "$INSTALLED_UNSAFE_CALLS" ]]

# Re-running is idempotent: no second crontab install, no re-enable, same safe
# schedules and private log. The last verification may advance, while the
# complete first-remediation object and its digest remain immutable.
completed_receipt_before_rerun_sha="$(sha256sum "$RETIRE_RECEIPT" | awk '{print $1}')"
run_helper >"$tmp/state/run2.out" 2>&1
cmp -s "$RETIRE_CRON_STATE" "$tmp/state/expected-crontab"
[[ "$(grep -c '^crontab-install$' "$RETIRE_MUTATION_CALLS")" == 1 ]]
! grep -Fq 'enable' "$RETIRE_MUTATION_CALLS"
[[ "$(jq -cS '.firstRemediation' "$RETIRE_RECEIPT")" == "$first_remediation_json" ]]
[[ "$(jq -r '.firstRemediationSha256' "$RETIRE_RECEIPT")" == "$first_remediation_sha" ]]
[[ "$(sha256sum "$RETIRE_RECEIPT" | awk '{print $1}')" == "$completed_receipt_before_rerun_sha" ]]
jq -e '.firstRemediation.watchdogEventLog.beforeMode=="664"
  and .firstRemediation.watchdogEventLog.nulRecoveredLines==1
  and .firstRemediation.watchdogEventLog.nulRecoveredBytes==26' "$RETIRE_RECEIPT" >/dev/null

# A structurally valid but tampered first-remediation object cannot replace the
# immutable provenance anchor. The failed verification leaves its bytes intact.
cp -- "$RETIRE_RECEIPT" "$tmp/state/receipt.valid"
jq '.firstRemediation.cron.beforeSha256=("0" * 64)' "$RETIRE_RECEIPT" \
  >"$tmp/state/receipt.tampered"
mv -f -- "$tmp/state/receipt.tampered" "$RETIRE_RECEIPT"
chmod 0600 "$RETIRE_RECEIPT"
tampered_receipt_sha="$(sha256sum "$RETIRE_RECEIPT" | awk '{print $1}')"
status=0
run_helper >"$tmp/state/tampered-receipt.out" 2>&1 || status=$?
[[ "$status" != 0 ]]
[[ "$(sha256sum "$RETIRE_RECEIPT" | awk '{print $1}')" == "$tampered_receipt_sha" ]]
mv -f -- "$tmp/state/receipt.valid" "$RETIRE_RECEIPT"
chmod 0600 "$RETIRE_RECEIPT"

# A valid schema-v1 receipt produced by the immediately preceding helper is
# promoted without changing any historical remediation field.
jq '.firstRemediation | del(.installedEntrypoints) | . + {schemaVersion: 1}' "$RETIRE_RECEIPT" >"$tmp/state/receipt.v1"
mv -f -- "$tmp/state/receipt.v1" "$RETIRE_RECEIPT"
chmod 0600 "$RETIRE_RECEIPT"
run_helper >"$tmp/state/schema1-promote.out" 2>&1
[[ "$(jq -r '.schemaVersion' "$RETIRE_RECEIPT")" == 2 ]]
[[ "$(jq -cS '.firstRemediation | del(.installedEntrypoints)' "$RETIRE_RECEIPT")" \
   == "$(jq -cS 'del(.installedEntrypoints)' <<<"$first_remediation_json")" ]]
jq -e '.firstRemediation.installedEntrypoints.resonanceBuildDeployV2.observedAtStage=="RETIRED"' \
  "$RETIRE_RECEIPT" >/dev/null

# A watchdog record created after the staged ABSENT proof is never falsely
# certified absent. The first run stops every legacy unit and fails with the
# STAGED journal intact; retry enrolls the exact late bytes, redacts them, and
# completes against the revised stage digest.
fixture="$tmp/state/late-log"
mkdir -p "$fixture/systemd" "$fixture/receipt" "$fixture/log"
RETIRE_CRON_STATE="$fixture/crontab"
RETIRE_STATE_DIR="$fixture/systemd"
RETIRE_MUTATION_CALLS="$fixture/calls"
RETIRE_RECEIPT="$fixture/receipt/result.json"
RETIRE_LOG="$fixture/log/events.jsonl"
printf '%s\n# keep\n' "$runtime_line" >"$RETIRE_CRON_STATE"; chmod 0600 "$RETIRE_CRON_STATE"
: >"$RETIRE_MUTATION_CALLS"
rm -f -- "$RETIRE_LOG"
RETIRE_CREATE_LOG_ON_STOP_UNIT=resonance-startup-watchdog.service
status=0
run_helper >"$fixture/first.out" 2>&1 || status=$?
[[ "$status" == 79 && -f "$RETIRE_RECEIPT.pending" && ! -e "$RETIRE_RECEIPT" ]]
grep -Fq 'late-query-sentinel' "$RETIRE_LOG"
RETIRE_CREATE_LOG_ON_STOP_UNIT=''
run_helper >"$fixture/retry.out" 2>&1 || { cat "$fixture/retry.out" >&2; exit 1; }
[[ ! -e "$RETIRE_RECEIPT.pending" ]]
! grep -Eqi 'late-user|late-password|late-query-sentinel|[?&]token=' \
  "$RETIRE_LOG" "$RETIRE_RECEIPT" "$fixture/retry.out"
jq -e '.state=="COMPLETED" and .firstRemediation.watchdogEventLog.appearedAfterStage==true
  and .firstRemediation.watchdogEventLog.status=="REDACTED"' "$RETIRE_RECEIPT" >/dev/null

# Every irreversible boundary is resumable from the same immutable STAGED
# digest. Each retry consumes the original cron/log/installed evidence rather
# than reconstructing it from the already-safer current state.
for crash_stage in pending installed cron units log receipt; do
  fixture="$tmp/state/crash-$crash_stage"
  mkdir -p "$fixture/systemd" "$fixture/receipt" "$fixture/log"
  RETIRE_INSTALLED_ROOT="$fixture/installed"
  seed_installed_originals "$RETIRE_INSTALLED_ROOT"
  RETIRE_CRON_STATE="$fixture/crontab"
  RETIRE_STATE_DIR="$fixture/systemd"
  RETIRE_MUTATION_CALLS="$fixture/calls"
  RETIRE_RECEIPT="$fixture/receipt/result.json"
  RETIRE_LOG="$fixture/log/events.jsonl"
  printf '%s\n# crash-preserved\n' "$runtime_line" >"$RETIRE_CRON_STATE"; chmod 0600 "$RETIRE_CRON_STATE"
  printf '%s\n' '{"eventType":"crash","targetUrl":"http://crash-user:crash-pass@127.0.0.1:17890/path?token=crash-query"}' >"$RETIRE_LOG"
  chmod 0664 "$RETIRE_LOG"
  : >"$RETIRE_MUTATION_CALLS"
  original_cron_sha="$(sha256sum "$RETIRE_CRON_STATE" | awk '{print $1}')"
  original_log_sha="$(sha256sum "$RETIRE_LOG" | awk '{print $1}')"
  RETIRE_TEST_FAIL_AFTER="$crash_stage"
  status=0
  run_helper >"$fixture/interrupt.out" 2>&1 || status=$?
  [[ "$status" == 94 && -f "$RETIRE_RECEIPT.pending" ]]
  stage_sha="$(jq -r '.stageSha256' "$RETIRE_RECEIPT.pending")"
  [[ "$stage_sha" =~ ^[0-9a-f]{64}$ ]]
  jq -e --arg cron "$original_cron_sha" --arg log "$original_log_sha" \
    --arg v3 "$RETIRE_V3_ORIGINAL_SHA" --arg up "$RETIRE_UP_ORIGINAL_SHA" \
    --arg build "$RETIRE_BUILD_V2_ORIGINAL_SHA" \
    '.payload.original.cron.sha256==$cron
      and .payload.original.cron.spoolSha256==$cron
      and .payload.original.cron.runtimeRecoveryRemoved==1
      and .payload.original.watchdogEventLog.sha256==$log
      and .payload.original.installedEntrypoints.resonanceV3Deploy.sha256==$v3
      and .payload.original.installedEntrypoints.resonanceUp.sha256==$up
      and .payload.original.installedEntrypoints.resonanceBuildDeployV2.sha256==$build' \
    "$RETIRE_RECEIPT.pending" >/dev/null
  receipt_before_retry_sha=ABSENT
  [[ ! -f "$RETIRE_RECEIPT" ]] || receipt_before_retry_sha="$(sha256sum "$RETIRE_RECEIPT" | awk '{print $1}')"
  RETIRE_TEST_FAIL_AFTER=''
  run_helper >"$fixture/retry.out" 2>&1 || { cat "$fixture/retry.out" >&2; exit 1; }
  [[ ! -e "$RETIRE_RECEIPT.pending" ]]
  ! grep -Fq "$runtime_line" "$RETIRE_CRON_STATE"
  ! grep -Eqi 'crash-user|crash-pass|crash-query|[?&]token=' "$RETIRE_LOG" "$RETIRE_RECEIPT"
  jq -e --arg stage "$stage_sha" --arg cron "$original_cron_sha" --arg log "$original_log_sha" \
    --arg v3 "$RETIRE_V3_ORIGINAL_SHA" --arg up "$RETIRE_UP_ORIGINAL_SHA" \
    --arg build "$RETIRE_BUILD_V2_ORIGINAL_SHA" \
    '.state=="COMPLETED" and .completionStageSha256==$stage
      and .firstRemediation.cron.beforeSha256==$cron
      and .firstRemediation.cron.spoolBeforeSha256==$cron
      and .firstRemediation.cron.runtimeRecoveryRemoved==1
      and .firstRemediation.watchdogEventLog.beforeSha256==$log
      and .firstRemediation.installedEntrypoints.resonanceV3Deploy.beforeSha256==$v3
      and .firstRemediation.installedEntrypoints.resonanceUp.beforeSha256==$up
      and .firstRemediation.installedEntrypoints.resonanceBuildDeployV2.beforeSha256==$build' \
    "$RETIRE_RECEIPT" >/dev/null
  if [[ "$crash_stage" == receipt ]]; then
    [[ "$(sha256sum "$RETIRE_RECEIPT" | awk '{print $1}')" == "$receipt_before_retry_sha" ]]
  fi
done

# A completed v2 receipt plus a reactivated legacy unit is a fail-closed drift,
# never an unjournaled disable. The installer/source guards prevent recurrence;
# operator intervention is required before a new staged remediation.
printf 'enabled\n' >"$RETIRE_STATE_DIR/resonance-frontend-auto-build.timer.enabled"
printf 'active\n' >"$RETIRE_STATE_DIR/resonance-frontend-auto-build.timer.active"
completed_receipt_sha="$(sha256sum "$RETIRE_RECEIPT" | awk '{print $1}')"
completed_calls_sha="$(sha256sum "$RETIRE_MUTATION_CALLS" | awk '{print $1}')"
status=0
run_helper >"$fixture/schema2-unit-drift.out" 2>&1 || status=$?
[[ "$status" != 0 && ! -e "$RETIRE_RECEIPT.pending" ]]
[[ "$(sha256sum "$RETIRE_RECEIPT" | awk '{print $1}')" == "$completed_receipt_sha" ]]
[[ "$(sha256sum "$RETIRE_MUTATION_CALLS" | awk '{print $1}')" == "$completed_calls_sha" ]]
printf 'disabled\n' >"$RETIRE_STATE_DIR/resonance-frontend-auto-build.timer.enabled"
printf 'inactive\n' >"$RETIRE_STATE_DIR/resonance-frontend-auto-build.timer.active"

# Ambiguous near-matches and duplicates fail before every cron/systemd write.
for mode in ambiguous duplicate; do
  fixture="$tmp/state/$mode"
  mkdir -p "$fixture/systemd" "$fixture/receipt" "$fixture/log"
  RETIRE_CRON_STATE="$fixture/crontab"
  RETIRE_STATE_DIR="$fixture/systemd"
  RETIRE_MUTATION_CALLS="$fixture/calls"
  RETIRE_RECEIPT="$fixture/receipt/result.json"
  RETIRE_LOG="$fixture/log/events.jsonl"
  : >"$RETIRE_MUTATION_CALLS"; : >"$RETIRE_LOG"
  chmod 0600 "$RETIRE_LOG"
  if [[ "$mode" == ambiguous ]]; then
    printf '%s # changed\n' "$runtime_line" >"$RETIRE_CRON_STATE"
  else
    printf '%s\n%s\n' "$runtime_line" "$runtime_line" >"$RETIRE_CRON_STATE"
  fi
  chmod 0600 "$RETIRE_CRON_STATE"
  status=0
  run_helper >"$fixture/out" 2>&1 || status=$?
  [[ "$status" != 0 && ! -s "$RETIRE_MUTATION_CALLS" && ! -e "$RETIRE_RECEIPT" ]]
done

# An atomic install error changes neither the crontab nor any unit. A retry
# removes the exact entry once; there is no unsafe rollback or enable call.
fixture="$tmp/state/install-fail"
mkdir -p "$fixture/systemd" "$fixture/receipt" "$fixture/log"
RETIRE_CRON_STATE="$fixture/crontab"
RETIRE_STATE_DIR="$fixture/systemd"
RETIRE_MUTATION_CALLS="$fixture/calls"
RETIRE_RECEIPT="$fixture/receipt/result.json"
RETIRE_LOG="$fixture/log/events.jsonl"
printf '%s\n# preserved\n' "$runtime_line" >"$RETIRE_CRON_STATE"; chmod 0600 "$RETIRE_CRON_STATE"
: >"$RETIRE_MUTATION_CALLS"; : >"$RETIRE_LOG"; chmod 0600 "$RETIRE_LOG"
install_fail_original_sha="$(sha256sum "$RETIRE_CRON_STATE" | awk '{print $1}')"
RETIRE_FAIL_CRONTAB_INSTALL=true
status=0
run_helper >"$fixture/fail.out" 2>&1 || status=$?
[[ "$status" == 79 && "$(head -n1 "$RETIRE_CRON_STATE")" == "$runtime_line" \
   && ! -s "$RETIRE_MUTATION_CALLS" && ! -e "$RETIRE_RECEIPT" && -f "$RETIRE_RECEIPT.pending" ]]
RETIRE_FAIL_CRONTAB_INSTALL=false
run_helper >"$fixture/retry.out" 2>&1 || { cat "$fixture/retry.out" >&2; exit 1; }
! grep -Fq "$runtime_line" "$RETIRE_CRON_STATE"
[[ "$(grep -c '^crontab-install$' "$RETIRE_MUTATION_CALLS")" == 1 ]]
! grep -Fq enable "$RETIRE_MUTATION_CALLS"
jq -e --arg before "$install_fail_original_sha" \
  '.firstRemediation.cron.beforeSha256==$before
    and .firstRemediation.cron.spoolBeforeSha256==$before
    and .firstRemediation.cron.runtimeRecoveryRemoved==1' "$RETIRE_RECEIPT" >/dev/null
[[ ! -e "$RETIRE_RECEIPT.pending" ]]

# A crontab implementation may replace the spool and still return non-zero.
# The helper re-reads the exact safe bytes and completes one-way; it never
# restores the staged unsafe input.
fixture="$tmp/state/install-then-fail"
mkdir -p "$fixture/systemd" "$fixture/receipt" "$fixture/log"
RETIRE_INSTALLED_ROOT="$tmp/installed"
RETIRE_CRON_STATE="$fixture/crontab"
RETIRE_STATE_DIR="$fixture/systemd"
RETIRE_MUTATION_CALLS="$fixture/calls"
RETIRE_RECEIPT="$fixture/receipt/result.json"
RETIRE_LOG="$fixture/log/events.jsonl"
printf '%s\n# preserved\n' "$runtime_line" >"$RETIRE_CRON_STATE"; chmod 0600 "$RETIRE_CRON_STATE"
: >"$RETIRE_MUTATION_CALLS"; : >"$RETIRE_LOG"; chmod 0600 "$RETIRE_LOG"
RETIRE_FAIL_CRONTAB_INSTALL=true
RETIRE_CRONTAB_INSTALLS_THEN_FAIL=true
run_helper >"$fixture/out" 2>&1 || { cat "$fixture/out" >&2; exit 1; }
RETIRE_FAIL_CRONTAB_INSTALL=false
RETIRE_CRONTAB_INSTALLS_THEN_FAIL=false
! grep -Fq "$runtime_line" "$RETIRE_CRON_STATE"
[[ "$(grep -c '^crontab-install$' "$RETIRE_MUTATION_CALLS")" == 1 \
   && -f "$RETIRE_RECEIPT" && ! -e "$RETIRE_RECEIPT.pending" ]]

# A unit-disable failure occurs only after the dangerous cron line is gone.
# That safer one-way state persists, and a retry does not perform a second cron
# install or re-enable anything.
fixture="$tmp/state/disable-fail"
mkdir -p "$fixture/systemd" "$fixture/receipt" "$fixture/log"
RETIRE_CRON_STATE="$fixture/crontab"
RETIRE_STATE_DIR="$fixture/systemd"
RETIRE_MUTATION_CALLS="$fixture/calls"
RETIRE_RECEIPT="$fixture/receipt/result.json"
RETIRE_LOG="$fixture/log/events.jsonl"
printf '%s\n# preserved\n' "$runtime_line" >"$RETIRE_CRON_STATE"; chmod 0600 "$RETIRE_CRON_STATE"
: >"$RETIRE_MUTATION_CALLS"; : >"$RETIRE_LOG"; chmod 0600 "$RETIRE_LOG"
disable_fail_original_sha="$(sha256sum "$RETIRE_CRON_STATE" | awk '{print $1}')"
RETIRE_FAIL_DISABLE_UNIT=resonance-startup-watchdog.timer
status=0
run_helper >"$fixture/fail.out" 2>&1 || status=$?
[[ "$status" == 79 && ! -e "$RETIRE_RECEIPT" && -f "$RETIRE_RECEIPT.pending" ]]
! grep -Fq "$runtime_line" "$RETIRE_CRON_STATE"
[[ "$(grep -c '^crontab-install$' "$RETIRE_MUTATION_CALLS")" == 1 ]]
! grep -Fq enable "$RETIRE_MUTATION_CALLS"
RETIRE_FAIL_DISABLE_UNIT=''
run_helper >"$fixture/retry.out" 2>&1 || { cat "$fixture/retry.out" >&2; exit 1; }
[[ "$(grep -c '^crontab-install$' "$RETIRE_MUTATION_CALLS")" == 1 ]]
! grep -Fq enable "$RETIRE_MUTATION_CALLS"
jq -e --arg before "$disable_fail_original_sha" \
  '.completionStageSha256|test("^[0-9a-f]{64}$")' "$RETIRE_RECEIPT" >/dev/null
jq -e --arg before "$disable_fail_original_sha" \
  '.firstRemediation.cron.beforeSha256==$before
    and .firstRemediation.cron.spoolBeforeSha256==$before
    and .firstRemediation.cron.runtimeRecoveryRemoved==1' "$RETIRE_RECEIPT" >/dev/null
[[ ! -e "$RETIRE_RECEIPT.pending" ]]

# Only a contiguous leading-NUL prefix is recoverable. An interior NUL causes
# a fail-closed result and leaves the original log bytes atomically untouched.
fixture="$tmp/state/interior-nul"
mkdir -p "$fixture/systemd" "$fixture/receipt" "$fixture/log"
RETIRE_CRON_STATE="$fixture/crontab"
RETIRE_STATE_DIR="$fixture/systemd"
RETIRE_MUTATION_CALLS="$fixture/calls"
RETIRE_RECEIPT="$fixture/receipt/result.json"
RETIRE_LOG="$fixture/log/events.jsonl"
printf '%s\n# safe only\n' "$runtime_line" >"$RETIRE_CRON_STATE"; chmod 0600 "$RETIRE_CRON_STATE"
: >"$RETIRE_MUTATION_CALLS"
printf '%s' '{"targetUrl":"http://127.0.0.1:17890/interior' >"$RETIRE_LOG"
printf '\0' >>"$RETIRE_LOG"
printf '%s\n' '?token=interior-sentinel"}' >>"$RETIRE_LOG"
chmod 0600 "$RETIRE_LOG"
interior_before_sha="$(sha256sum "$RETIRE_LOG" | awk '{print $1}')"
interior_cron_before_sha="$(sha256sum "$RETIRE_CRON_STATE" | awk '{print $1}')"
status=0
run_helper >"$fixture/out" 2>&1 || status=$?
[[ "$status" != 0 && ! -e "$RETIRE_RECEIPT" ]]
[[ "$(sha256sum "$RETIRE_LOG" | awk '{print $1}')" == "$interior_before_sha" ]]
[[ "$(sha256sum "$RETIRE_CRON_STATE" | awk '{print $1}')" == "$interior_cron_before_sha" \
   && ! -s "$RETIRE_MUTATION_CALLS" && ! -e "$RETIRE_RECEIPT.pending" ]]

# The exact relative cron argv and absolute argv are detected. A Python audit
# string containing the path is not mistaken for an executable legacy writer.
fixture="$tmp/state/process"
mkdir -p "$fixture/systemd" "$fixture/receipt" "$fixture/log"
RETIRE_CRON_STATE="$fixture/crontab"
RETIRE_STATE_DIR="$fixture/systemd"
RETIRE_MUTATION_CALLS="$fixture/calls"
RETIRE_RECEIPT="$fixture/receipt/result.json"
RETIRE_LOG="$fixture/log/events.jsonl"
RETIRE_PS_LINES="$fixture/ps"
printf '# safe only\n' >"$RETIRE_CRON_STATE"; chmod 0600 "$RETIRE_CRON_STATE"
: >"$RETIRE_MUTATION_CALLS"; : >"$RETIRE_LOG"; chmod 0600 "$RETIRE_LOG"
cat >"$RETIRE_PS_LINES" <<'EOF'
101 bash ops/scripts/autorecovery/check-and-recover.sh carbonet-prod carbonet-runtime deployment /var/log/resonance-autorecovery.log
102 /usr/bin/bash /opt/Resonance/ops/scripts/autorecovery/check-and-recover.sh carbonet-prod carbonet-runtime deployment /var/log/resonance-autorecovery.log
103 python3 -c audit ops/scripts/autorecovery/check-and-recover.sh carbonet-prod carbonet-runtime
104 /usr/bin/bash /home/sjkim/OmniverseProjects/p006-route-guard.sh
105 /bin/sh -c cd /opt/Resonance && bash ops/scripts/autorecovery/check-and-recover.sh carbonet-prod carbonet-runtime deployment /var/log/resonance-autorecovery.log
106 /usr/bin/bash /opt/Resonance/ops/scripts/resonance-frontend-auto-build.sh
107 /bin/bash /opt/Resonance/ops/scripts/resonance-react-route-self-heal.sh
108 /usr/bin/bash /opt/Resonance/ops/scripts/resonance-screen-overlay-apply.sh
109 bash -c while pgrep -f 'resonance-screen-overlay-apply.sh'; do sleep 5; done
EOF
status=0
run_helper >"$fixture/out" 2>&1 || status=$?
[[ "$status" == 79 && ! -e "$RETIRE_RECEIPT" ]]
grep -Fq 'in-flight legacy runtime automation remains count=7' "$fixture/out"

# Both source-level legacy entrypoints reject the production runtime before
# DNS, systemd, logs, or Kubernetes.
: >"$tmp/state/guard-calls"
for command in kubectl nslookup systemctl tee; do
  cat >"$tmp/bin/$command" <<'SH'
#!/usr/bin/env bash
printf '%s %s\n' "$(basename "$0")" "$*" >>"$GUARD_CALLS"
exit 97
SH
  chmod +x "$tmp/bin/$command"
done
status=0
PATH="$tmp/bin:$PATH" bash "$react_route_self_heal" >"$tmp/state/route-self-heal.out" 2>&1 || status=$?
[[ "$status" == 78 && ! -s "$tmp/state/guard-calls" ]]
grep -Fq 'mutation=0' "$tmp/state/route-self-heal.out"
for guarded in "$autorecovery" "$autorecovery_watchdog"; do
  status=0
  PATH="$tmp/bin:$PATH" GUARD_CALLS="$tmp/state/guard-calls" \
    bash "$guarded" carbonet-prod carbonet-runtime >/dev/null 2>&1 || status=$?
  [[ "$status" == 78 && ! -s "$tmp/state/guard-calls" ]]
done

echo '[legacy-runtime-automation-retirement-test] PASS cronExact3 unrelatedByteOrder=true ambiguityPrewrite=2 installFailNoWrite=1 installThenFail=oneWaySafe disableFailOneWay=1 crashResume6=true idempotent=true receiptV2FirstImmutable=true schema1Promoted=true tamperedReceiptRejected=true tamperedPendingPrewrite=true installedOriginals3ToExit78=true unitsDisabled9 safeRecoveryEnabled=true processRuntime3+p0061+frontend1+route2 selfFalsePositive=0 logLines3+nulRecovery26 interiorNulAtomic=true lateLogRace=restaged secretPersist0 receipt0600 guards2'
