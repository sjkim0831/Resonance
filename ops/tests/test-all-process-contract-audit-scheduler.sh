#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNNER="$ROOT/ops/scripts/run-all-process-contract-audit-hourly.sh"
INSTALLER="$ROOT/ops/scripts/install-all-process-contract-audit.sh"
SERVICE="$ROOT/ops/systemd/resonance-all-process-contract-audit.service"
TIMER="$ROOT/ops/systemd/resonance-all-process-contract-audit.timer"
DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"

fail() {
  echo "[test-all-process-contract-audit-scheduler] FAIL: $*" >&2
  exit 1
}

for file in "$RUNNER" "$INSTALLER" "$SERVICE" "$TIMER" "$DEPLOY"; do
  [[ -f "$file" ]] || fail "missing ${file#$ROOT/}"
done

bash -n "$RUNNER"
bash -n "$INSTALLER"
grep -Fq 'Type=oneshot' "$SERVICE" || fail 'service must be oneshot'
grep -Fq 'SuccessExitStatus=3' "$SERVICE" || fail 'BLOCKED exit 3 must be successful to systemd'
service_timeout="$(sed -n 's/^TimeoutStartSec=\([0-9][0-9]*\)s$/\1/p' "$SERVICE")"
[[ "$service_timeout" =~ ^[0-9]+$ && "$service_timeout" -ge 105 ]] || fail 'service must leave at least 20 seconds after the 85-second inner timeout'
grep -Fq 'KillMode=control-group' "$SERVICE" || fail 'systemd fallback must terminate the complete audit cgroup'
grep -Fq 'SendSIGKILL=yes' "$SERVICE" || fail 'systemd fallback must escalate descendants that ignore TERM'
grep -Fq '/opt/resonance-data/control-plane/bin/run-all-process-contract-audit-hourly.sh' "$SERVICE" || fail 'service must use installed control-plane runner'
grep -Fq 'OnCalendar=hourly' "$TIMER" || fail 'timer must use a wall-clock hourly schedule'
grep -Fq 'Persistent=true' "$TIMER" || fail 'timer must recover missed runs'
! grep -Eq '^On(?:Active|UnitActive|Boot)Sec=' "$TIMER" || fail 'timer must not fall back to monotonic scheduling'
! grep -Fq 'project-auto-completion' "$SERVICE" "$TIMER" "$RUNNER" || fail 'audit must not be coupled to the two-minute auto-completion loop'
if command -v systemd-analyze >/dev/null 2>&1; then
  systemd-analyze calendar hourly >/dev/null || fail 'systemd rejected the hourly calendar expression'
fi

grep -Fq 'flock -n 9' "$RUNNER" || fail 'runner must prevent duplicate execution with flock'
grep -Fq 'RESONANCE_HEAVY_DB_LOCK_FILE' "$RUNNER" || fail 'runner must participate in the shared heavy DB automation lock'
grep -Fq 'flock -n 7' "$RUNNER" || fail 'runner must defer while another heavy DB automation holds the shared lock'
grep -Fq 'RESONANCE_AUDIT_TIMEOUT_SECONDS:-85' "$RUNNER" || fail 'runner must retain the bounded 85-second audit cap'
grep -Fq 'timeout --signal=TERM --kill-after=5s' "$RUNNER" || fail 'timeout must terminate the audit process group and escalate orphaned children'
! grep -Fq 'timeout --foreground' "$RUNNER" || fail 'foreground mode would leave descendant processes outside timeout group cleanup'
grep -Fq 'mktemp "$REPORT_DIR/.latest.XXXXXX.json"' "$RUNNER" || fail 'temporary report must share the destination filesystem'
grep -Fq 'chmod 0640 "$temp_report"' "$RUNNER" || fail 'report permissions must be restricted'
grep -Fq 'mv -f "$temp_report" "$LATEST_REPORT"' "$RUNNER" || fail 'latest report must be replaced atomically'
grep -Fq '/opt/resonance-data/control-plane/reports/process-contract-audit' "$RUNNER" || fail 'runner must use the protected data volume'

for source in \
  resonance-all-process-contract-audit.sh \
  resonance-all-process-contract-audit.mjs \
  run-all-process-contract-audit-hourly.sh \
  install-all-process-contract-audit.sh; do
  grep -Fq "$source" "$INSTALLER" || fail "installer does not copy $source"
done
grep -Fq 'systemctl daemon-reload' "$INSTALLER" || fail 'installer must reload systemd'
grep -Fq 'enable --now resonance-all-process-contract-audit.timer' "$INSTALLER" || fail 'installer must enable the timer'
! grep -Eq 'systemctl (start|restart).*resonance-all-process-contract-audit\.service' "$INSTALLER" || fail 'installer must not block deployment by running the audit inline'
grep -Fq 'sync_process_contract_audit_if_required()' "$DEPLOY" || fail 'auto-deploy synchronizer is missing'
[[ "$(grep -Fc 'sync_process_contract_audit_if_required' "$DEPLOY")" -ge 3 ]] || fail 'auto-deploy must synchronize both no-runtime and runtime paths'
audit_sync_body="$(awk '/^sync_process_contract_audit_if_required\(\)/{capture=1} capture{print} capture && /^}/{exit}' "$DEPLOY")"
grep -Fq 'install-all-process-contract-audit.sh --check' <<<"$audit_sync_body" || fail 'audit sync must use installation checksum verification'
! grep -Fq 'deploy_path_changed' <<<"$audit_sync_body" || fail 'runtime audit sync must not depend on no-runtime deploy_changed_paths'
grep -Fq 'cmp -s' "$INSTALLER" || fail 'installation check must compare source and installed bytes'
grep -Fq 'install -d -m 0750 -o root -g sjkim "$REPORT_PARENT"' "$INSTALLER" || fail 'audit service must be able to traverse the protected report parent'
grep -Fq 'SYSTEM_TEST_REPORT_SKIP_HTTP_SMOKE=1' <<<"$audit_sync_body" || fail 'deploy must parse the authenticated live report API before success'
grep -Fq '"$preflight_rc" -ne 0 && "$preflight_rc" -ne 3' <<<"$audit_sync_body" || fail 'truthful BLOCKED audit status must remain deploy-safe'

repair_call_line="$(grep -n '^repair_persistent_build_worktree_ownership$' "$DEPLOY" | head -n1 | cut -d: -f1)"
no_change_line="$(grep -n 'if \[\[ "$deployed_commit" == "$target_commit" \]\]' "$DEPLOY" | head -n1 | cut -d: -f1)"
preflight_branch_line="$(grep -n 'if \[\[ "$platform_preflight_cache_reused" == "true" \]\]' "$DEPLOY" | head -n1 | cut -d: -f1)"
[[ "$repair_call_line" =~ ^[0-9]+$ && "$repair_call_line" -lt "$no_change_line" && "$repair_call_line" -lt "$preflight_branch_line" ]] || fail 'persistent worktree ownership repair must run before no-change and cached-preflight exits'
for deployed_file in \
  ops/scripts/run-all-process-contract-audit-hourly.sh \
  ops/scripts/install-all-process-contract-audit.sh \
  ops/systemd/resonance-all-process-contract-audit.service \
  ops/systemd/resonance-all-process-contract-audit.timer; do
  grep -Fq "$deployed_file" "$DEPLOY" || fail "auto-deploy does not watch $deployed_file"
done

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/reports" "$tmp/run"

mkdir -p "$tmp/installed/bin" "$tmp/installed/systemd"
cp "$ROOT/ops/scripts/resonance-all-process-contract-audit.sh" "$tmp/installed/bin/resonance-all-process-contract-audit.sh"
cp "$ROOT/ops/scripts/resonance-all-process-contract-audit.mjs" "$tmp/installed/bin/resonance-all-process-contract-audit.mjs"
cp "$ROOT/ops/scripts/run-all-process-contract-audit-hourly.sh" "$tmp/installed/bin/run-all-process-contract-audit-hourly.sh"
cp "$ROOT/ops/scripts/install-all-process-contract-audit.sh" "$tmp/installed/bin/install-all-process-contract-audit.sh"
cp "$SERVICE" "$tmp/installed/systemd/resonance-all-process-contract-audit.service"
cp "$TIMER" "$tmp/installed/systemd/resonance-all-process-contract-audit.timer"
RESONANCE_ROOT="$ROOT" \
RESONANCE_CONTROL_PLANE_BIN="$tmp/installed/bin" \
RESONANCE_SYSTEMD_DIR="$tmp/installed/systemd" \
  bash "$INSTALLER" --check || fail 'matching installed audit files reported checksum drift'
printf '\n# drift fixture\n' >>"$tmp/installed/bin/run-all-process-contract-audit-hourly.sh"
set +e
RESONANCE_ROOT="$ROOT" \
RESONANCE_CONTROL_PLANE_BIN="$tmp/installed/bin" \
RESONANCE_SYSTEMD_DIR="$tmp/installed/systemd" \
  bash "$INSTALLER" --check
checksum_rc=$?
set -e
[[ "$checksum_rc" -ne 0 ]] || fail 'installed script checksum drift was not detected'
cp "$ROOT/ops/scripts/run-all-process-contract-audit-hourly.sh" "$tmp/installed/bin/run-all-process-contract-audit-hourly.sh"
printf '\n# unit drift fixture\n' >>"$tmp/installed/systemd/resonance-all-process-contract-audit.service"
set +e
RESONANCE_ROOT="$ROOT" \
RESONANCE_CONTROL_PLANE_BIN="$tmp/installed/bin" \
RESONANCE_SYSTEMD_DIR="$tmp/installed/systemd" \
  bash "$INSTALLER" --check
checksum_rc=$?
set -e
[[ "$checksum_rc" -ne 0 ]] || fail 'installed systemd checksum drift was not detected'

cat >"$tmp/bin/flock" <<'EOF'
#!/usr/bin/env bash
[[ "${FAKE_FLOCK_BUSY:-0}" == '1' ]] && exit 1
exit 0
EOF
cat >"$tmp/bin/timeout" <<'EOF'
#!/usr/bin/env bash
[[ "${FAKE_TIMEOUT:-0}" == '1' ]] && exit 124
while [[ "$1" == --* ]]; do shift; done
shift
exec "$@"
EOF
cat >"$tmp/audit-engine.mjs" <<'EOF'
// scheduler fixture engine
EOF
cat >"$tmp/audit-wrapper.sh" <<'EOF'
#!/usr/bin/env bash
case "${FAKE_AUDIT_STATUS:-BLOCKED}" in
  PASS) rc=0 ;;
  BLOCKED) rc=3 ;;
  ERROR) rc=2 ;;
  *) printf 'not-json\n'; exit 2 ;;
esac
printf '{"auditMode":"READ_ONLY_INVENTORY","businessExecutionPerformed":false,"status":"%s"}\n' "$FAKE_AUDIT_STATUS"
exit "$rc"
EOF
chmod +x "$tmp/bin/flock" "$tmp/bin/timeout" "$tmp/audit-wrapper.sh"

run_fixture() {
  PATH="$tmp/bin:$PATH" \
  RESONANCE_ROOT="$ROOT" \
  RESONANCE_AUDIT_WRAPPER="$tmp/audit-wrapper.sh" \
  RESONANCE_AUDIT_ENGINE="$tmp/audit-engine.mjs" \
  RESONANCE_AUDIT_REPORT_DIR="$tmp/reports" \
  RESONANCE_AUDIT_LATEST_REPORT="$tmp/reports/latest.json" \
  RESONANCE_AUDIT_LOCK_FILE="$tmp/run/audit.lock" \
  RESONANCE_HEAVY_DB_LOCK_FILE="$tmp/run/heavy-db.lock" \
  bash "$RUNNER"
}

set +e
FAKE_AUDIT_STATUS=BLOCKED run_fixture >/dev/null 2>&1
rc=$?
set -e
[[ "$rc" -eq 3 ]] || fail "BLOCKED fixture returned $rc instead of 3"
[[ "$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).status)' "$tmp/reports/latest.json")" == 'BLOCKED' ]] || fail 'BLOCKED latest report was not saved'

FAKE_AUDIT_STATUS=PASS run_fixture >/dev/null 2>&1 || fail 'PASS fixture failed'
[[ "$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).status)' "$tmp/reports/latest.json")" == 'PASS' ]] || fail 'PASS did not atomically replace latest report'
before_hash="$(node -e 'const fs=require("node:fs");const c=require("node:crypto");process.stdout.write(c.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"))' "$tmp/reports/latest.json")"
FAKE_FLOCK_BUSY=1 run_fixture >/dev/null 2>&1 || fail 'duplicate execution should be a successful no-op'
after_hash="$(node -e 'const fs=require("node:fs");const c=require("node:crypto");process.stdout.write(c.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"))' "$tmp/reports/latest.json")"
[[ "$before_hash" == "$after_hash" ]] || fail 'duplicate execution changed latest report'

set +e
FAKE_TIMEOUT=1 FAKE_AUDIT_STATUS=PASS run_fixture >/dev/null 2>&1
rc=$?
set -e
[[ "$rc" -eq 2 ]] || fail "timeout without JSON must normalize to exit 2, got $rc"
[[ "$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).status)' "$tmp/reports/latest.json")" == 'ERROR' ]] || fail 'timeout must leave an ERROR report'

real_timeout="$(command -v timeout || true)"
if [[ -n "$real_timeout" ]] && "$real_timeout" --version 2>/dev/null | grep -Fq 'GNU coreutils'; then
  child_pid_file="$tmp/child.pid"
  set +e
  (
    "$real_timeout" --signal=TERM --kill-after=1s 1s \
      bash -c 'sleep 30 & echo $! >"$1"; wait' _ "$child_pid_file"
  ) >/dev/null 2>&1
  timeout_rc=$?
  set -e
  [[ "$timeout_rc" -eq 124 || "$timeout_rc" -eq 137 ]] || fail "GNU timeout process-group fixture returned $timeout_rc"
  child_pid="$(cat "$child_pid_file")"
  for _ in {1..20}; do
    kill -0 "$child_pid" 2>/dev/null || break
    sleep 0.1
  done
  if kill -0 "$child_pid" 2>/dev/null; then
    kill -KILL "$child_pid" 2>/dev/null || true
    fail 'GNU timeout left an audit descendant running'
  fi
fi

echo '[test-all-process-contract-audit-scheduler] PASS: process-group timeout, 20s write margin, boot catch-up calendar, unconditional worktree repair, checksum drift, lock, atomic report and BLOCKED semantics verified'
