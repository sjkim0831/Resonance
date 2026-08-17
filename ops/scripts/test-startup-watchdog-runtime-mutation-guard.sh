#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
WATCHDOG="$ROOT/ops/scripts/resonance-startup-watchdog.sh"
START="$ROOT/ops/scripts/resonance-start-best-effort.sh"
RESTART="$ROOT/ops/scripts/restart-local-carbonet-k8s.sh"
AUTO="$ROOT/ops/scripts/auto-deploy-main.sh"
SELECTOR="$ROOT/ops/scripts/select-catalog-contract-tests.sh"

for file in "$WATCHDOG" "$START" "$RESTART" "$AUTO" "$SELECTOR"; do
  [[ -s "$file" && ! -L "$file" ]] || { echo "missing/unsafe: $file" >&2; exit 1; }
  bash -n "$file"
done

python3 - "$WATCHDOG" "$START" "$RESTART" "$AUTO" "$SELECTOR" <<'PY'
from pathlib import Path
import sys

watchdog,start,restart,auto,selector=(Path(path).read_text(encoding="utf-8") for path in sys.argv[1:])

def assert_restart_guard(source: str) -> None:
    guard=source.index('requested_namespace="${NAMESPACE:-carbonet-prod}"')
    retired=source.index('exit 78',guard)
    first_external=min(source.index(token) for token in (
        'source "$ROOT_DIR/ops/scripts/build.sh"', 'init_build_tool',
        'npm run build', 'mvn -q', 'docker build', 'kubectl -n "$NAMESPACE" set image'))
    assert guard < retired < first_external
    block=source[guard:retired]
    assert '"$requested_namespace" == carbonet-prod' in block
    assert '"$requested_deployment" == carbonet-runtime' in block

def assert_start_guard(source: str) -> None:
    guard=source.index('startup_namespace="${NAMESPACE:-carbonet-prod}"')
    doctor=source.index('resonance-docker-k8s-doctor.sh')
    restart_call=source.index('restart-local-carbonet-k8s.sh',doctor)
    assert guard < doctor < restart_call
    block=source[guard:doctor]
    assert 'exit 78' in block and 'MODE=https-jvm' in block and 'REQUIRE_K8S=false' in block

def assert_watchdog_safe(source: str) -> None:
    assert 'bash "$START_SCRIPT"' not in source
    assert 'resonance-start-best-effort.sh' not in source
    assert 'TARGET_URL="${TARGET_URL:-http://127.0.0.1:17890/}"' in source
    assert '?token=' not in source
    assert 'value.hostname' in source and 'value.netloc' not in source
    assert source.count('systemctl restart resonance-ops-web.service') == 1
    assert '"O_NOFOLLOW"' in source and source.count('value.st_nlink != 1') == 2
    assert 'stat.S_IMODE(value.st_mode) != 0o600' in source
    assert 'event_path.parent.parts[1:]' in source and 'path contains a symlink' in source

assert_restart_guard(restart)
assert_start_guard(start)
assert_watchdog_safe(watchdog)

for mutant,checker in (
    (restart.replace('   && "$requested_deployment" == carbonet-runtime','',1),assert_restart_guard),
    (restart.replace('  exit 78\n','',1),assert_restart_guard),
    (start.replace('  MODE=https-jvm\n  REQUIRE_K8S=false\n','',1),assert_start_guard),
    (watchdog.replace('systemctl restart resonance-ops-web.service',
                      'systemctl restart carbonet-runtime.service',1),assert_watchdog_safe),
    (watchdog.replace('hostname = value.hostname', 'hostname = value.netloc',1),assert_watchdog_safe),
    (watchdog.replace('value.st_nlink != 1', 'False',1),assert_watchdog_safe),
):
    try:
        checker(mutant)
    except (AssertionError,ValueError):
        continue
    raise AssertionError('startup runtime mutation guard mutant survived')

gate=auto[
    auto.index('run_runtime_template_identity_migration_contract_if_required() {'):
    auto.index('run_operational_usage_ledger_live_e2e_if_required() {')]
selector_end=gate.index('; then')
for path in (
    'ops/scripts/resonance-startup-watchdog.sh',
    'ops/scripts/resonance-start-best-effort.sh',
    'ops/scripts/restart-local-carbonet-k8s.sh',
    'ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh',
):
    assert gate.index(path) < selector_end
parallel=gate.index('run_parallel_contract_tests',selector_end)
assert gate.index('ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh',parallel) > parallel
for path in (
    'ops/scripts/resonance-startup-watchdog.sh',
    'ops/scripts/resonance-start-best-effort.sh',
    'ops/scripts/restart-local-carbonet-k8s.sh',
):
    assert path in selector
PY

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/state"
: >"$tmp/calls"
for command in kubectl docker mvn npm; do
  cat >"$tmp/bin/$command" <<'SH'
#!/usr/bin/env bash
printf '%s %s\n' "$(basename "$0")" "$*" >>"$MUTATION_CALLS"
exit 91
SH
  chmod +x "$tmp/bin/$command"
done
cat >"$tmp/bin/sudo" <<'SH'
#!/usr/bin/env bash
[[ "${1:-}" != -n ]] || shift
exec "$@"
SH
cat >"$tmp/bin/systemctl" <<'SH'
#!/usr/bin/env bash
printf 'systemctl %s\n' "$*" >>"$MUTATION_CALLS"
exit "${WATCHDOG_SYSTEMCTL_STATUS:-0}"
SH
chmod +x "$tmp/bin/sudo" "$tmp/bin/systemctl"

# The legacy production helper is retired before loading build.sh or touching
# Docker/build/Kubernetes. Help remains read-only and available.
status=0
PATH="$tmp/bin:$PATH" MUTATION_CALLS="$tmp/calls" \
  NAMESPACE=carbonet-prod DEPLOYMENT=carbonet-runtime \
  bash "$RESTART" >"$tmp/restart.out" 2>&1 || status=$?
[[ "$status" == 78 && ! -s "$tmp/calls" ]]
grep -Fq 'retired for carbonet-prod/carbonet-runtime' "$tmp/restart.out"
PATH="$tmp/bin:$PATH" MUTATION_CALLS="$tmp/calls" bash "$RESTART" --help >/dev/null
[[ ! -s "$tmp/calls" ]]

# An explicit production K8s-only best-effort request propagates the retired
# status before preflight, Docker doctor, build, or Kubernetes.
status=0
PATH="$tmp/bin:$PATH" MUTATION_CALLS="$tmp/calls" \
  LOG_DIR="$tmp/state" EVENT_LOG="$tmp/state/start.jsonl" \
  MODE=k8s REQUIRE_K8S=false REQUIRE_BROKER=false REQUIRE_PERMISSIONS=false \
  NAMESPACE=carbonet-prod DEPLOYMENT=carbonet-runtime \
  bash "$START" >"$tmp/start-k8s.out" 2>&1 || status=$?
[[ "$status" == 78 && ! -s "$tmp/calls" ]]

# Auto mode on production is coerced to the local HTTPS path. A healthy local
# JVM therefore succeeds with only the expected curl and no mutation command.
cat >"$tmp/bin/curl" <<'SH'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >>"$MUTATION_CALLS"
exit 0
SH
chmod +x "$tmp/bin/curl"
PATH="$tmp/bin:$PATH" MUTATION_CALLS="$tmp/calls" \
  LOG_DIR="$tmp/state" EVENT_LOG="$tmp/state/start-auto.jsonl" \
  MODE=auto REQUIRE_K8S=true REQUIRE_BROKER=false REQUIRE_PERMISSIONS=false \
  NAMESPACE=carbonet-prod DEPLOYMENT=carbonet-runtime \
  bash "$START" >"$tmp/start-auto.out" 2>&1
grep -Fq '[start-best-effort] mode=https-jvm' "$tmp/start-auto.out"
! grep -Eq '^(kubectl|docker|mvn|npm|systemctl) ' "$tmp/calls"

# A healthy watchdog performs no recovery. A failed first probe may restart
# only the exact ops-web unit, then must re-probe without any Carbonet command.
: >"$tmp/calls"
cat >"$tmp/bin/curl" <<'SH'
#!/usr/bin/env bash
count=0
[[ ! -f "$WATCHDOG_CURL_COUNT" ]] || read -r count <"$WATCHDOG_CURL_COUNT"
count=$((count+1)); printf '%s\n' "$count" >"$WATCHDOG_CURL_COUNT"
if [[ "${WATCHDOG_SUCCESS_AT:-1}" == 0 || "$count" -lt "${WATCHDOG_SUCCESS_AT:-1}" ]]; then exit 22; fi
exit 0
SH
chmod +x "$tmp/bin/curl"
PATH="$tmp/bin:$PATH" MUTATION_CALLS="$tmp/calls" \
  WATCHDOG_CURL_COUNT="$tmp/state/healthy.count" \
  EVENT_LOG="$tmp/state/watchdog-healthy.jsonl" \
  TARGET_URL='http://query-sentinel:userinfo-sentinel@watchdog.invalid/path?token=query-sentinel' \
  bash "$WATCHDOG"
[[ ! -s "$tmp/calls" ]]
[[ "$(stat -c %a "$tmp/state/watchdog-healthy.jsonl")" == 600 ]]
jq -e '.targetUrl=="http://watchdog.invalid/path"' "$tmp/state/watchdog-healthy.jsonl" >/dev/null
! grep -Eqi 'query-sentinel|userinfo-sentinel|[?&]token=' "$tmp/state/watchdog-healthy.jsonl"
status=0
PATH="$tmp/bin:$PATH" MUTATION_CALLS="$tmp/calls" WATCHDOG_SUCCESS_AT=2 \
  WATCHDOG_CURL_COUNT="$tmp/state/recovery.count" \
  CARBONET_STARTUP_WATCHDOG_RECOVERY_WAIT_SECONDS=0 \
  EVENT_LOG="$tmp/state/watchdog-recovery.jsonl" TARGET_URL=http://watchdog.invalid/path \
  bash "$WATCHDOG" >"$tmp/watchdog-failed.out" 2>&1 || status=$?
[[ "$status" == 0 ]]
[[ "$(cat "$tmp/calls")" == 'systemctl restart resonance-ops-web.service' ]]
jq -e '.status=="PASS" and .action=="ops-web-restarted"
  and (.detail|contains("carbonet mutation=0"))' \
  "$tmp/state/watchdog-recovery.jsonl" >/dev/null

: >"$tmp/calls"
status=0
PATH="$tmp/bin:$PATH" MUTATION_CALLS="$tmp/calls" WATCHDOG_SUCCESS_AT=0 \
  WATCHDOG_CURL_COUNT="$tmp/state/failed.count" \
  CARBONET_STARTUP_WATCHDOG_RECOVERY_WAIT_SECONDS=0 \
  EVENT_LOG="$tmp/state/watchdog-failed.jsonl" TARGET_URL=http://watchdog.invalid/path \
  bash "$WATCHDOG" >"$tmp/watchdog-failed.out" 2>&1 || status=$?
[[ "$status" == 1 ]]
[[ "$(cat "$tmp/calls")" == 'systemctl restart resonance-ops-web.service' ]]
jq -e '.status=="FAIL" and .action=="ops-web-recovery-failed"
  and (.detail|contains("carbonet mutation=0"))' "$tmp/state/watchdog-failed.jsonl" >/dev/null
! grep -Eq '^(kubectl|docker|mvn|npm) ' "$tmp/calls"

# Existing symlinks and multiply-linked files fail before a probe or append.
printf 'original\n' >"$tmp/state/watchdog-target.jsonl"
ln -s "$tmp/state/watchdog-target.jsonl" "$tmp/state/watchdog-link.jsonl"
status=0
PATH="$tmp/bin:$PATH" MUTATION_CALLS="$tmp/calls" WATCHDOG_SUCCESS_AT=1 \
  WATCHDOG_CURL_COUNT="$tmp/state/symlink.count" EVENT_LOG="$tmp/state/watchdog-link.jsonl" \
  bash "$WATCHDOG" >/dev/null 2>&1 || status=$?
[[ "$status" != 0 && ! -e "$tmp/state/symlink.count" ]]
ln "$tmp/state/watchdog-target.jsonl" "$tmp/state/watchdog-hardlink.jsonl"
status=0
PATH="$tmp/bin:$PATH" MUTATION_CALLS="$tmp/calls" WATCHDOG_SUCCESS_AT=1 \
  WATCHDOG_CURL_COUNT="$tmp/state/hardlink.count" EVENT_LOG="$tmp/state/watchdog-hardlink.jsonl" \
  bash "$WATCHDOG" >/dev/null 2>&1 || status=$?
[[ "$status" != 0 && ! -e "$tmp/state/hardlink.count" ]]
mkdir -p "$tmp/state/real-parent"
ln -s "$tmp/state/real-parent" "$tmp/state/link-parent"
status=0
PATH="$tmp/bin:$PATH" MUTATION_CALLS="$tmp/calls" WATCHDOG_SUCCESS_AT=1 \
  WATCHDOG_CURL_COUNT="$tmp/state/parent-link.count" EVENT_LOG="$tmp/state/link-parent/events.jsonl" \
  bash "$WATCHDOG" >/dev/null 2>&1 || status=$?
[[ "$status" != 0 && ! -e "$tmp/state/parent-link.count" \
   && ! -e "$tmp/state/real-parent/events.jsonl" ]]

echo '[startup-watchdog-runtime-mutation-guard-test] PASS prodRestart=78 preNetworkBuild=true bestEffort=k8s78+httpsOnly watchdog=healthy0+opsWebExact1+failureMutation0 secretPersist0 logMode600 unsafeFiles3 mutants=6'
