#!/usr/bin/env bash
set -Eeuo pipefail

# One-way retirement of legacy schedulers that can mutate the production
# Deployment without a durable release attempt. A failure never restores a
# removed cron entry or re-enables a stopped unit; the next invocation resumes
# from the already-safer state.
CRON_USER="${CARBONET_LEGACY_AUTOMATION_CRON_USER:-sjkim}"
CRON_SPOOL_FILE="${CARBONET_LEGACY_AUTOMATION_CRON_SPOOL_FILE:-/var/spool/cron/crontabs/$CRON_USER}"
RECEIPT_FILE="${CARBONET_LEGACY_AUTOMATION_RECEIPT_FILE:-/opt/resonance-data/deploy/legacy-runtime-automation-retirement.json}"
PENDING_FILE="${CARBONET_LEGACY_AUTOMATION_PENDING_FILE:-$RECEIPT_FILE.pending}"
WATCHDOG_EVENT_LOG="${CARBONET_LEGACY_AUTOMATION_WATCHDOG_EVENT_LOG:-/opt/Resonance/var/ai-runtime/startup-watchdog-events.jsonl}"
INSTALLED_ROOT="${CARBONET_LEGACY_AUTOMATION_INSTALLED_ROOT:-/opt/Resonance}"
PROCESS_WAIT_SECONDS="${CARBONET_LEGACY_AUTOMATION_PROCESS_WAIT_SECONDS:-30}"
SUDO_BIN="${CARBONET_LEGACY_AUTOMATION_SUDO_BIN:-sudo}"
CRONTAB_BIN="${CARBONET_LEGACY_AUTOMATION_CRONTAB_BIN:-crontab}"
SYSTEMCTL_BIN="${CARBONET_LEGACY_AUTOMATION_SYSTEMCTL_BIN:-systemctl}"
PS_BIN="${CARBONET_LEGACY_AUTOMATION_PS_BIN:-ps}"
PYTHON_BIN="${CARBONET_LEGACY_AUTOMATION_PYTHON_BIN:-python3}"
TEST_FAIL_AFTER="${CARBONET_LEGACY_AUTOMATION_TEST_FAIL_AFTER:-}"
ALLOW_TEST_HOOKS="${CARBONET_LEGACY_AUTOMATION_ALLOW_TEST_HOOKS:-false}"
LEGACY_UNITS=(
  resonance-startup-watchdog.timer
  resonance-startup-watchdog.service
  resonance-recovery.service
  resonance-p006-route-guard.timer
  resonance-p006-route-guard.service
  resonance-frontend-auto-build.timer
  resonance-frontend-auto-build.service
  resonance-react-route-self-heal.timer
  resonance-react-route-self-heal.service
)

[[ "$CRON_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || {
  echo '[legacy-runtime-automation-retirement] invalid cron owner' >&2
  exit 79
}
[[ "$CRON_SPOOL_FILE" == /* && "$RECEIPT_FILE" == /* && "$PENDING_FILE" == /* \
   && "$WATCHDOG_EVENT_LOG" == /* && "$INSTALLED_ROOT" == /* ]] || {
  echo '[legacy-runtime-automation-retirement] state paths must be absolute' >&2
  exit 79
}
[[ "$PROCESS_WAIT_SECONDS" =~ ^[0-9]+$ && "$PROCESS_WAIT_SECONDS" -le 60 ]] || {
  echo '[legacy-runtime-automation-retirement] process wait must be bounded to 0..60 seconds' >&2
  exit 79
}
if [[ -n "$TEST_FAIL_AFTER" ]]; then
  [[ "$ALLOW_TEST_HOOKS" == true && "$RECEIPT_FILE" == /tmp/* && "$INSTALLED_ROOT" == /tmp/* ]] || {
    echo '[legacy-runtime-automation-retirement] test failure hook is forbidden outside a disposable fixture' >&2
    exit 79
  }
  case "$TEST_FAIL_AFTER" in pending|installed|cron|units|log|receipt) ;; *) exit 79 ;; esac
fi
fail_after_stage_if_requested() {
  [[ "$TEST_FAIL_AFTER" != "$1" ]] || {
    echo "[legacy-runtime-automation-retirement] TEST_ONLY staged interruption after $1" >&2
    exit 94
  }
}

for required in "$CRONTAB_BIN" "$SYSTEMCTL_BIN" "$PS_BIN" "$PYTHON_BIN" sha256sum stat mktemp cmp id flock; do
  command -v "$required" >/dev/null 2>&1 || {
    echo '[legacy-runtime-automation-retirement] required command is unavailable' >&2
    exit 79
  }
done

expected_uid="$(id -u "$CRON_USER" 2>/dev/null || true)"
expected_gid="$(id -g "$CRON_USER" 2>/dev/null || true)"
[[ "$expected_uid" =~ ^[0-9]+$ && "$expected_gid" =~ ^[0-9]+$ ]] || {
  echo '[legacy-runtime-automation-retirement] cron owner identity is unavailable' >&2
  exit 79
}

privilege_prefix=()
if [[ "$(id -u)" != 0 ]]; then
  command -v "$SUDO_BIN" >/dev/null 2>&1 || {
    echo '[legacy-runtime-automation-retirement] noninteractive privilege helper is unavailable' >&2
    exit 79
  }
  privilege_prefix=("$SUDO_BIN" -n)
fi
run_privileged() {
  "${privilege_prefix[@]}" "$@"
}
fsync_regular_file() {
  "$PYTHON_BIN" - "$1" <<'PY'
import os, sys
descriptor = os.open(sys.argv[1], os.O_RDONLY)
try:
    os.fsync(descriptor)
finally:
    os.close(descriptor)
PY
}
ensure_expected_owner() {
  [[ "$(stat -c '%u:%g' "$1")" == "$expected_uid:$expected_gid" ]] ||
    run_privileged chown "$expected_uid:$expected_gid" "$1"
}

receipt_parent="$(dirname "$RECEIPT_FILE")"
[[ "$(dirname "$PENDING_FILE")" == "$receipt_parent" \
   && -d "$receipt_parent" && ! -L "$receipt_parent" ]] || {
  echo '[legacy-runtime-automation-retirement] receipt/pending parent is missing or unsafe' >&2
  exit 79
}
umask 077
retirement_lock="$receipt_parent/.legacy-runtime-automation-retirement.lock"
"$PYTHON_BIN" - "$retirement_lock" "$expected_uid" "$expected_gid" <<'PY'
import os, stat, sys
path, uid, gid = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0)
descriptor = os.open(path, flags, 0o600)
try:
    value = os.fstat(descriptor)
    if not stat.S_ISREG(value.st_mode) or value.st_nlink != 1:
        raise SystemExit("retirement lock is not a private regular file")
    if value.st_uid != uid or value.st_gid != gid:
        raise SystemExit("retirement lock owner is invalid")
    os.fchmod(descriptor, 0o600)
    os.fsync(descriptor)
finally:
    os.close(descriptor)
PY
exec 9<>"$retirement_lock"
flock -n 9 || {
  echo '[legacy-runtime-automation-retirement] another retirement invocation is active' >&2
  exit 79
}
[[ -f "$retirement_lock" && ! -L "$retirement_lock" \
   && "$(stat -c '%h:%u:%g:%a' "$retirement_lock")" == "1:$expected_uid:$expected_gid:600" ]] || exit 79

tmp_dir="$(mktemp -d /tmp/carbonet-legacy-runtime-retirement.XXXXXX)"
chmod 0700 "$tmp_dir"
log_publish_tmp=""
receipt_publish_tmp=""
pending_publish_tmp=""
cleanup() {
  rm -rf -- "$tmp_dir"
  [[ -z "$log_publish_tmp" ]] || rm -f -- "$log_publish_tmp"
  [[ -z "$receipt_publish_tmp" ]] || rm -f -- "$receipt_publish_tmp"
  [[ -z "$pending_publish_tmp" ]] || rm -f -- "$pending_publish_tmp"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cron_before="$tmp_dir/crontab.before"
cron_expected="$tmp_dir/crontab.expected"
cron_current="$tmp_dir/crontab.current"
cron_after="$tmp_dir/crontab.after"
cron_meta="$tmp_dir/crontab.meta.json"
cron_error="$tmp_dir/crontab.error"
: >"$cron_before"
: >"$cron_expected"
: >"$cron_current"
: >"$cron_after"
: >"$cron_meta"
: >"$cron_error"
chmod 0600 "$cron_before" "$cron_expected" "$cron_current" "$cron_after" "$cron_meta" "$cron_error"

if ! run_privileged "$CRONTAB_BIN" -u "$CRON_USER" -l >"$cron_before" 2>"$cron_error"; then
  echo '[legacy-runtime-automation-retirement] unable to read exact owner crontab' >&2
  exit 79
fi
cron_spool_before_metadata="$(run_privileged stat -c '%F:%h:%u:%a' "$CRON_SPOOL_FILE" 2>/dev/null || true)"
[[ "$cron_spool_before_metadata" == "regular file:1:$expected_uid:600" ]] || {
  echo '[legacy-runtime-automation-retirement] owner crontab spool metadata is unsafe' >&2
  exit 79
}
cron_spool_before_sha="$(run_privileged sha256sum "$CRON_SPOOL_FILE" | awk '{print $1}')"
[[ "$cron_spool_before_sha" =~ ^[0-9a-f]{64}$ ]] || exit 79

# Validate the complete source before the first write. Exact target entries are
# removed once; duplicates and near-matches fail closed so unrelated schedules
# (including the Redis recovery line) remain byte-for-byte untouched.
"$PYTHON_BIN" - "$cron_before" "$cron_expected" "$cron_meta" <<'PY'
import json
import hashlib
import pathlib
import sys

source_path, output_path, meta_path = map(pathlib.Path, sys.argv[1:])
targets = (
    "*/5 * * * * cd /opt/Resonance && bash ops/scripts/autorecovery/check-and-recover.sh carbonet-prod carbonet-runtime deployment /var/log/resonance-autorecovery.log >> /var/log/resonance-autorecovery.log 2>&1",
    "@reboot /opt/Resonance/ops/scripts/resonance-up.sh >> /opt/Resonance/var/log/resonance-up-reboot.log 2>&1",
    "* * * * * /opt/Resonance/ops/scripts/resonance-watchdog.sh >> /opt/Resonance/var/ai-runtime/watchdog.log 2>&1",
)
raw = source_path.read_bytes()
lines = raw.splitlines(keepends=True)
counts = [0, 0, 0]
kept = []
for line in lines:
    body = line.rstrip(b"\r\n").decode("utf-8", "strict")
    if body in targets:
        index = targets.index(body)
        counts[index] += 1
        if counts[index] > 1:
            raise SystemExit("duplicate exact legacy runtime scheduler entry")
        continue
    runtime_recovery_near_match = (
        "ops/scripts/autorecovery/check-and-recover.sh" in body
        and "carbonet-prod" in body
        and "carbonet-runtime" in body
    )
    reboot_near_match = "/opt/Resonance/ops/scripts/resonance-up.sh" in body
    watchdog_near_match = "/opt/Resonance/ops/scripts/resonance-watchdog.sh" in body
    if runtime_recovery_near_match or reboot_near_match or watchdog_near_match:
        raise SystemExit("ambiguous legacy runtime scheduler entry")
    kept.append(line)
output_path.write_bytes(b"".join(kept))
meta_path.write_text(json.dumps({
    "runtimeRecoveryRemoved": counts[0],
    "rebootRecoveryRemoved": counts[1],
    "missingWatchdogRemoved": counts[2],
    "unrelatedBytes": sum(len(line) for line in kept),
}, separators=(",", ":")) + "\n", encoding="utf-8")
PY

cron_before_sha="$(sha256sum "$cron_before" | awk '{print $1}')"
cron_expected_sha="$(sha256sum "$cron_expected" | awk '{print $1}')"

# Dry-run every irreversible transform before the STAGED journal is published.
# Nothing below this point may touch cron, systemd, the installed legacy
# entrypoints, or the historical event log until the journal is fsynced.
planned_log="$tmp_dir/watchdog-event-log.expected"
log_plan="$tmp_dir/watchdog-event-log.plan.json"
log_current_status=ABSENT
log_current_sha=ABSENT
log_current_bytes=0
log_current_mode=ABSENT
log_expected_sha=ABSENT
log_expected_bytes=0
log_expected_lines=0
log_expected_nul_recovered_lines=0
log_expected_nul_recovered_bytes=0
: >"$planned_log"
: >"$log_plan"
chmod 0600 "$planned_log" "$log_plan"
if [[ -e "$WATCHDOG_EVENT_LOG" || -L "$WATCHDOG_EVENT_LOG" ]]; then
  "$PYTHON_BIN" - "$WATCHDOG_EVENT_LOG" "$expected_uid" "$planned_log" "$log_plan" <<'PY'
import hashlib
import json
import os
import pathlib
import re
import stat
import sys
from urllib.parse import urlsplit, urlunsplit

source = pathlib.Path(sys.argv[1])
expected_uid = int(sys.argv[2])
target = pathlib.Path(sys.argv[3])
meta = pathlib.Path(sys.argv[4])
if not source.is_absolute():
    raise SystemExit("event log path is not absolute")
current = pathlib.Path(source.anchor)
for part in source.parts[1:]:
    current /= part
    value = os.lstat(current)
    if stat.S_ISLNK(value.st_mode):
        raise SystemExit("event log path contains a symlink")
value = os.lstat(source)
if not stat.S_ISREG(value.st_mode) or value.st_nlink != 1 or value.st_uid != expected_uid:
    raise SystemExit("event log ownership/type/link invariant failed")

line_count = 0
nul_recovered_lines = 0
nul_recovered_bytes = 0
input_sha256 = hashlib.sha256()
input_bytes = 0
descriptor = os.open(source, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
opened = os.fstat(descriptor)
with os.fdopen(descriptor, "rb") as reader, target.open("w", encoding="utf-8", newline="\n") as writer:
    for raw_bytes in reader:
        input_sha256.update(raw_bytes)
        input_bytes += len(raw_bytes)
        leading_nuls = len(raw_bytes) - len(raw_bytes.lstrip(b"\x00"))
        recovered_bytes = raw_bytes[leading_nuls:]
        if b"\x00" in recovered_bytes:
            raise SystemExit("event-log row contains a non-leading NUL")
        try:
            raw = recovered_bytes.decode("utf-8", "strict")
            record = json.loads(raw)
        except (json.JSONDecodeError, UnicodeError) as error:
            raise SystemExit("event-log row is not strict UTF-8 JSON") from error
        if not isinstance(record, dict):
            raise SystemExit("event-log row is not an object")
        if leading_nuls:
            nul_recovered_lines += 1
            nul_recovered_bytes += leading_nuls
        target_url = record.get("targetUrl")
        if isinstance(target_url, str):
            parsed = urlsplit(target_url)
            if parsed.scheme not in ("http", "https") or not parsed.hostname:
                raise SystemExit("event-log targetUrl is not HTTP(S)")
            hostname = parsed.hostname
            if ":" in hostname:
                hostname = f"[{hostname}]"
            try:
                port = parsed.port
            except ValueError as error:
                raise SystemExit("event-log targetUrl has an invalid port") from error
            netloc = hostname if port is None else f"{hostname}:{port}"
            record["targetUrl"] = urlunsplit((parsed.scheme, netloc, parsed.path or "/", "", ""))
        encoded = json.dumps(record, ensure_ascii=False, separators=(",", ":"))
        if re.search(r"(?i)[?&]token=", encoded):
            raise SystemExit("credential-bearing query remains after redaction")
        writer.write(encoded + "\n")
        line_count += 1
    writer.flush()
    os.fsync(writer.fileno())
post_read = os.lstat(source)
if (post_read.st_dev != opened.st_dev or post_read.st_ino != opened.st_ino
        or post_read.st_size != input_bytes):
    raise SystemExit("event log changed while the redaction plan was read")
meta.write_text(json.dumps({
    "inputSha256": input_sha256.hexdigest(),
    "inputBytes": input_bytes,
    "inputDevice": opened.st_dev,
    "inputInode": opened.st_ino,
    "lines": line_count,
    "nulRecoveredLines": nul_recovered_lines,
    "nulRecoveredBytes": nul_recovered_bytes,
}, separators=(",", ":")) + "\n", encoding="utf-8")
PY
  log_current_status=PRESENT
  log_current_sha="$("$PYTHON_BIN" -c 'import json,sys; print(json.load(open(sys.argv[1]))["inputSha256"])' "$log_plan")"
  log_current_bytes="$("$PYTHON_BIN" -c 'import json,sys; print(json.load(open(sys.argv[1]))["inputBytes"])' "$log_plan")"
  log_current_mode="$(stat -c %a "$WATCHDOG_EVENT_LOG")"
  log_expected_sha="$(sha256sum "$planned_log" | awk '{print $1}')"
  log_expected_bytes="$(stat -c %s "$planned_log")"
  log_expected_lines="$("$PYTHON_BIN" -c 'import json,sys; print(json.load(open(sys.argv[1]))["lines"])' "$log_plan")"
  log_expected_nul_recovered_lines="$("$PYTHON_BIN" -c 'import json,sys; print(json.load(open(sys.argv[1]))["nulRecoveredLines"])' "$log_plan")"
  log_expected_nul_recovered_bytes="$("$PYTHON_BIN" -c 'import json,sys; print(json.load(open(sys.argv[1]))["nulRecoveredBytes"])' "$log_plan")"
  [[ "$(sha256sum "$WATCHDOG_EVENT_LOG" | awk '{print $1}')" == "$log_current_sha" \
     && "$(stat -c %s "$WATCHDOG_EVENT_LOG")" == "$log_current_bytes" ]] || {
    echo '[legacy-runtime-automation-retirement] watchdog event log changed before staging' >&2
    exit 79
  }
fi

v3_original_sha="${CARBONET_LEGACY_V3_ORIGINAL_SHA256:-2597444b348601081affcf0c444e323eed98d46cd846c4276ece61b850a1c9e8}"
up_original_sha="${CARBONET_LEGACY_UP_ORIGINAL_SHA256:-b5293d08259e4824f803102f65f459cb7c90cce115b5894d94910d32573e77c1}"
build_v2_original_sha="${CARBONET_LEGACY_BUILD_V2_ORIGINAL_SHA256:-a6d6c9588e27890fc3cc451ca16943c4b6f0c23a0c834f9554c1e297b7e0203a}"
for original_sha in "$v3_original_sha" "$up_original_sha" "$build_v2_original_sha"; do
  [[ "$original_sha" =~ ^[0-9a-f]{64}$ ]] || {
    echo '[legacy-runtime-automation-retirement] installed legacy source hash is invalid' >&2
    exit 79
  }
done
v3_stub="$tmp_dir/resonance-v3-deploy.sh.expected"
up_stub="$tmp_dir/resonance-up.sh.expected"
build_v2_stub="$tmp_dir/resonance-k8s-build-deploy-80-v2.sh.expected"
printf '%s\n' '#!/usr/bin/env bash' 'set -Eeuo pipefail' '' \
  'echo "[v3-deploy] RETIRED: use the official durable auto-deploy pipeline" >&2' \
  'exit 78' >"$v3_stub"
printf '%s\n' '#!/usr/bin/env bash' 'set -Eeuo pipefail' '' \
  "echo '[resonance-up] retired; use carbonet-post-reboot-recovery.service (mutation=0)' >&2" \
  'exit 78' >"$up_stub"
printf '%s\n' '#!/usr/bin/env bash' 'set -Eeuo pipefail' '' \
  "echo '[build-deploy-v2] RETIRED: direct execution requires the official durable auto-deploy pipeline' >&2" \
  'exit 78' >"$build_v2_stub"
chmod 0700 "$v3_stub" "$up_stub" "$build_v2_stub"

installed_plan="$tmp_dir/installed-entrypoints.plan.json"
"$PYTHON_BIN" - "$INSTALLED_ROOT" "$expected_uid" "$expected_gid" "$installed_plan" \
  "resonanceV3Deploy|ops/scripts/resonance-v3-deploy.sh|$v3_original_sha|755|$v3_stub" \
  "resonanceUp|ops/scripts/resonance-up.sh|$up_original_sha|664|$up_stub" \
  "resonanceBuildDeployV2|ops/scripts/resonance-k8s-build-deploy-80-v2.sh|$build_v2_original_sha|644|$build_v2_stub" <<'PY'
import hashlib
import json
import os
import pathlib
import stat
import sys

root = pathlib.Path(sys.argv[1])
expected_uid, expected_gid = int(sys.argv[2]), int(sys.argv[3])
output = pathlib.Path(sys.argv[4])
if not root.is_absolute() or not root.is_dir() or root.is_symlink():
    raise SystemExit("installed legacy root is missing or unsafe")
plans = {}
for encoded in sys.argv[5:]:
    name, relative, original_sha, original_mode, stub_path = encoded.split("|", 4)
    path = root / relative
    parent = path.parent
    if not parent.is_dir() or parent.is_symlink():
        raise SystemExit(f"installed legacy parent is missing or unsafe: {name}")
    current = pathlib.Path(path.anchor)
    for part in path.parts[1:-1]:
        current /= part
        value = os.lstat(current)
        if stat.S_ISLNK(value.st_mode):
            raise SystemExit(f"installed legacy path contains a symlink: {name}")
    stub = pathlib.Path(stub_path).read_bytes()
    expected_sha = hashlib.sha256(stub).hexdigest()
    if not path.exists() and not path.is_symlink():
        observed = "ABSENT"
        current_sha = "ABSENT"
        current_mode = "ABSENT"
    else:
        value = os.lstat(path)
        if (not stat.S_ISREG(value.st_mode) or value.st_nlink != 1
                or value.st_uid != expected_uid or value.st_gid != expected_gid):
            raise SystemExit(f"installed legacy file metadata is unsafe: {name}")
        current_sha = hashlib.sha256(path.read_bytes()).hexdigest()
        current_mode = format(stat.S_IMODE(value.st_mode), "o")
        if current_sha == original_sha and current_mode == original_mode:
            observed = "ORIGINAL"
        elif current_sha == expected_sha and current_mode == "755":
            observed = "RETIRED"
        else:
            raise SystemExit(f"installed legacy file is not an audited original or retired stub: {name}")
    plans[name] = {
        "path": str(path),
        "observed": observed,
        "currentSha256": current_sha,
        "currentMode": current_mode,
        "originalSha256": original_sha,
        "originalMode": original_mode,
        "expectedAfterSha256": expected_sha,
        "expectedAfterMode": "755",
        "uid": expected_uid,
        "gid": expected_gid,
    }
output.write_text(json.dumps(plans, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
PY

systemctl_value() {
  local value status=0
  value="$(run_privileged "$SYSTEMCTL_BIN" "$@" 2>/dev/null)" || status=$?
  printf '%s' "$(tr -d '\r\n' <<<"$value")"
  return "$status"
}

safe_load_state="$(systemctl_value show carbonet-post-reboot-recovery.service -p LoadState --value)" || {
  echo '[legacy-runtime-automation-retirement] safe post-reboot recovery unit is unreadable' >&2
  exit 79
}
safe_enabled_state="$(systemctl_value is-enabled carbonet-post-reboot-recovery.service)" || {
  echo '[legacy-runtime-automation-retirement] safe post-reboot recovery unit is not enabled' >&2
  exit 79
}
[[ "$safe_load_state" == loaded && "$safe_enabled_state" == enabled ]] || {
  echo '[legacy-runtime-automation-retirement] safe post-reboot recovery ownership is not active' >&2
  exit 79
}

unit_plan="$tmp_dir/legacy-units.plan.json"
unit_plan_args=()
unit_mutation_needed=false
for legacy_unit in "${LEGACY_UNITS[@]}"; do
  load_state="$(systemctl_value show "$legacy_unit" -p LoadState --value)" || {
    echo "[legacy-runtime-automation-retirement] unable to inspect legacy unit: $legacy_unit" >&2
    exit 79
  }
  case "$load_state" in loaded|not-found) ;; *)
    echo "[legacy-runtime-automation-retirement] unknown legacy unit load state: $legacy_unit" >&2
    exit 79
  esac
  enabled_state="$(systemctl_value is-enabled "$legacy_unit" || true)"
  active_state="$(systemctl_value is-active "$legacy_unit" || true)"
  if [[ "$load_state" == loaded ]]; then
    case "$enabled_state" in disabled|masked|static|indirect|not-found) ;; *) unit_mutation_needed=true ;; esac
    case "$active_state" in inactive|unknown|not-found) ;; *) unit_mutation_needed=true ;; esac
  fi
  unit_plan_args+=("$legacy_unit|$load_state|$enabled_state|$active_state")
done
"$PYTHON_BIN" - "$unit_plan" "${unit_plan_args[@]}" <<'PY'
import json, pathlib, sys
value = {}
for encoded in sys.argv[2:]:
    unit, load, enabled, active = encoded.split("|", 3)
    value[unit] = {"loadState": load, "enabledState": enabled, "activeState": active}
pathlib.Path(sys.argv[1]).write_text(
    json.dumps(value, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
PY

for durable_state_file in "$PENDING_FILE" "$RECEIPT_FILE"; do
  if [[ -e "$durable_state_file" || -L "$durable_state_file" ]]; then
    [[ -f "$durable_state_file" && ! -L "$durable_state_file" \
       && "$(stat -c '%h:%u:%a' "$durable_state_file")" == "1:$expected_uid:600" ]] || {
      echo '[legacy-runtime-automation-retirement] durable state file is unsafe' >&2
      exit 79
    }
  fi
done

pending_candidate="$tmp_dir/pending.candidate.json"
retirement_state="$tmp_dir/retirement.state"
"$PYTHON_BIN" - "$PENDING_FILE" "$RECEIPT_FILE" "$pending_candidate" "$retirement_state" \
  "$cron_meta" "$installed_plan" "$cron_before_sha" "$cron_expected_sha" \
  "$cron_spool_before_sha" "$log_current_status" "$WATCHDOG_EVENT_LOG" \
  "$log_current_sha" "$log_current_bytes" "$log_current_mode" "$log_expected_sha" \
  "$log_expected_bytes" "$log_expected_lines" "$log_expected_nul_recovered_lines" \
  "$log_expected_nul_recovered_bytes" "$unit_mutation_needed" <<'PY'
import datetime
import hashlib
import json
import pathlib
import re
import sys

(pending_path, receipt_path, candidate_path, state_path, cron_meta_path, installed_plan_path,
 cron_current, cron_expected, spool_current, log_status, log_path, log_current,
 log_current_bytes, log_current_mode, log_expected, log_expected_bytes, log_lines,
 nul_lines, nul_bytes, unit_mutation_needed) = sys.argv[1:]
sha = re.compile(r"^[0-9a-f]{64}$")

def require(value, message):
    if not value:
        raise SystemExit(message)

def digest(value):
    raw = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()

cron_meta = json.loads(pathlib.Path(cron_meta_path).read_text(encoding="utf-8"))
installed = json.loads(pathlib.Path(installed_plan_path).read_text(encoding="utf-8"))
log_original = {
    "status": log_status,
    "path": log_path,
    "sha256": log_current,
    "bytes": int(log_current_bytes),
    "mode": log_current_mode,
    "initiallyAbsent": log_status == "ABSENT",
}
log_after = {
    "status": "ABSENT" if log_status == "ABSENT" else "REDACTED",
    "sha256": log_expected,
    "bytes": int(log_expected_bytes),
    "mode": "ABSENT" if log_status == "ABSENT" else "600",
    "lines": int(log_lines),
    "nulRecoveredLines": int(nul_lines),
    "nulRecoveredBytes": int(nul_bytes),
    "credentialQueryMatches": 0,
}
stage_payload = {
    "stagedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "original": {
        "cron": {
            "sha256": cron_current,
            "spoolSha256": spool_current,
            "spoolMode": "600",
            **cron_meta,
        },
        "watchdogEventLog": log_original,
        "installedEntrypoints": {
            key: {
                "path": value["path"],
                "observed": value["observed"],
                "sha256": value["currentSha256"],
                "mode": value["currentMode"],
                "uid": value["uid"],
                "gid": value["gid"],
            } for key, value in installed.items()
        },
    },
    "expected": {
        "cronSha256": cron_expected,
        "watchdogEventLog": log_after,
        "installedEntrypoints": {
            key: {
                "path": value["path"],
                "sha256": "ABSENT" if value["observed"] == "ABSENT" else value["expectedAfterSha256"],
                "mode": "ABSENT" if value["observed"] == "ABSENT" else value["expectedAfterMode"],
                "uid": value["uid"],
                "gid": value["gid"],
            } for key, value in installed.items()
        },
    },
}

def validate_stage(value):
    require(isinstance(value, dict) and set(value) == {"schemaVersion", "state", "stageSha256", "payload"},
            "pending journal shape is invalid")
    require(value["schemaVersion"] == 1 and value["state"] == "STAGED",
            "pending journal state is invalid")
    require(isinstance(value["stageSha256"], str) and sha.fullmatch(value["stageSha256"]),
            "pending journal digest is invalid")
    require(value["stageSha256"] == digest(value["payload"]), "pending journal was tampered")
    payload = value["payload"]
    require(isinstance(payload, dict) and set(payload) == {"stagedAt", "original", "expected"},
            "pending journal payload is invalid")
    original, expected = payload["original"], payload["expected"]
    require(set(original) == {"cron", "watchdogEventLog", "installedEntrypoints"}
            and set(expected) == {"cronSha256", "watchdogEventLog", "installedEntrypoints"},
            "pending journal authority shape is invalid")
    cron = original["cron"]
    for key in ("sha256", "spoolSha256"):
        require(isinstance(cron.get(key), str) and sha.fullmatch(cron[key]),
                "pending original cron hash is invalid")
    require(cron.get("spoolMode") == "600", "pending original spool mode is unsafe")
    for key in ("runtimeRecoveryRemoved", "rebootRecoveryRemoved", "missingWatchdogRemoved"):
        require(type(cron.get(key)) is int and cron[key] in (0, 1),
                "pending cron removal count is invalid")
    require(type(cron.get("unrelatedBytes")) is int and cron["unrelatedBytes"] >= 0,
            "pending unrelated cron bytes are invalid")
    require(isinstance(expected["cronSha256"], str) and sha.fullmatch(expected["cronSha256"]),
            "pending expected cron hash is invalid")
    original_log, expected_log = original["watchdogEventLog"], expected["watchdogEventLog"]
    require(original_log.get("status") in ("ABSENT", "PRESENT"), "pending log status is invalid")
    require(isinstance(original_log.get("initiallyAbsent"), bool), "pending initial log status is invalid")
    require(expected_log.get("status") in ("ABSENT", "REDACTED"), "pending expected log status is invalid")
    require(original_log.get("path") == log_path, "pending log path is stale")
    if original_log["status"] == "ABSENT":
        require(original_log.get("sha256") == "ABSENT" and expected_log.get("sha256") == "ABSENT",
                "pending absent log proof is invalid")
    else:
        require(sha.fullmatch(original_log.get("sha256", "")) and sha.fullmatch(expected_log.get("sha256", "")),
                "pending log hash is invalid")
        require(expected_log.get("mode") == "600" and expected_log.get("credentialQueryMatches") == 0,
                "pending expected log proof is unsafe")
    require(set(original["installedEntrypoints"]) == set(installed)
            and set(expected["installedEntrypoints"]) == set(installed),
            "pending installed-entrypoint inventory is invalid")
    for key, current in installed.items():
        old = original["installedEntrypoints"][key]
        after = expected["installedEntrypoints"][key]
        require(old.get("path") == current["path"] == after.get("path"),
                "pending installed path is stale")
        require(old.get("uid") == current["uid"] == after.get("uid")
                and old.get("gid") == current["gid"] == after.get("gid"),
                "pending installed owner is stale")
        require(after.get("sha256") in ("ABSENT", current["expectedAfterSha256"]),
                "pending installed expected hash is invalid")
        require(after.get("mode") in ("ABSENT", "755"),
                "pending installed expected mode is invalid")
    return payload

units = {
    "resonanceStartupWatchdogTimer": "disabled-inactive",
    "resonanceStartupWatchdogService": "disabled-inactive",
    "resonanceRecoveryService": "disabled-inactive",
    "resonanceP006RouteGuardTimer": "disabled-inactive",
    "resonanceP006RouteGuardService": "disabled-inactive",
    "resonanceFrontendAutoBuildTimer": "disabled-inactive",
    "resonanceFrontendAutoBuildService": "disabled-inactive",
    "resonanceReactRouteSelfHealTimer": "disabled-inactive",
    "resonanceReactRouteSelfHealService": "disabled-inactive",
    "carbonetPostRebootRecoveryService": "enabled-preserved",
}
current_installed = {
    key: {
        "path": value["path"], "afterSha256": value["currentSha256"],
        "afterMode": value["currentMode"], "uid": value["uid"], "gid": value["gid"],
    } for key, value in installed.items()
}
current_log_verification = {
    "status": "ABSENT" if log_status == "ABSENT" else "REDACTED",
    "path": log_path, "afterSha256": log_current,
    "afterBytes": int(log_current_bytes),
    "afterMode": "ABSENT" if log_status == "ABSENT" else log_current_mode,
    "lines": int(log_lines), "credentialQueryMatches": 0,
}

def receipt_kind(receipt, expected_stage_sha=None):
    raw = receipt.read_text(encoding="utf-8")
    require(not re.search(r"(?i)[?&]token=", raw), "existing receipt contains a credential query")
    value = json.loads(raw)
    require(isinstance(value, dict), "existing receipt is not an object")
    if value.get("schemaVersion") == 1:
        require(value.get("inFlightLegacyProcesses") == 0,
                "legacy receipt process proof is invalid")
        require(value.get("cron", {}).get("afterSha256") == cron_current
                and value["cron"].get("spoolAfterSha256") == spool_current,
                "legacy receipt cron binding is stale")
        require(value.get("watchdogEventLog", {}).get("afterSha256") == log_current
                and value["watchdogEventLog"].get("afterMode") == current_log_verification["afterMode"],
                "legacy receipt watchdog binding is stale")
        return "LEGACY"
    require(value.get("schemaVersion") == 2 and value.get("state") == "COMPLETED",
            "existing completed receipt state is invalid")
    require(set(value) == {"schemaVersion", "state", "completionStageSha256",
                           "firstRemediationSha256", "firstRemediation", "lastVerification"},
            "existing completed receipt shape is invalid")
    require(value["firstRemediationSha256"] == digest(value["firstRemediation"]),
            "existing completed first-remediation digest is invalid")
    require(isinstance(value["completionStageSha256"], str)
            and sha.fullmatch(value["completionStageSha256"]),
            "existing completion-stage digest is invalid")
    if expected_stage_sha is not None:
        require(value["completionStageSha256"] == expected_stage_sha,
                "completed receipt is not bound to pending stage")
    verification = value.get("lastVerification", {})
    require(verification.get("cron") == {
        "afterSha256": cron_current, "spoolAfterSha256": spool_current, "spoolAfterMode": "600"
    }, "completed receipt cron binding is stale")
    require(verification.get("units") == units and verification.get("inFlightLegacyProcesses") == 0,
            "completed receipt unit/process binding is stale")
    require(verification.get("watchdogEventLog") == current_log_verification,
            "completed receipt watchdog binding is stale")
    require(verification.get("installedEntrypoints") == current_installed,
            "completed receipt installed-entrypoint binding is stale")
    return "COMPLETED"

pending = pathlib.Path(pending_path)
receipt = pathlib.Path(receipt_path)
if pending.exists():
    raw = pending.read_text(encoding="utf-8")
    require(not re.search(r"(?i)[?&]token=", raw), "pending journal contains a credential query")
    staged = json.loads(raw)
    payload = validate_stage(staged)
    original, expected = payload["original"], payload["expected"]
    require(cron_current in (original["cron"]["sha256"], expected["cronSha256"]),
            "current cron is neither staged original nor expected")
    if cron_current == original["cron"]["sha256"]:
        require(spool_current == original["cron"]["spoolSha256"], "current cron spool is not staged original")
    old_log, after_log = original["watchdogEventLog"], expected["watchdogEventLog"]
    restaged = False
    if old_log["status"] == "ABSENT" and log_current != "ABSENT":
        require(log_status == "PRESENT" and unit_mutation_needed == "false",
                "late watchdog log cannot be safely enrolled while a legacy unit is mutable")
        require(not receipt.exists() or json.loads(receipt.read_text(encoding="utf-8")).get("schemaVersion") == 1,
                "completed receipt cannot enroll a late watchdog log")
        payload["original"]["watchdogEventLog"] = dict(log_original, initiallyAbsent=True)
        payload["expected"]["watchdogEventLog"] = log_after
        staged = {"schemaVersion": 1, "state": "STAGED", "payload": payload}
        staged["stageSha256"] = digest(payload)
        pathlib.Path(candidate_path).write_text(
            json.dumps(staged, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n",
            encoding="utf-8",
        )
        original, expected = payload["original"], payload["expected"]
        old_log, after_log = original["watchdogEventLog"], expected["watchdogEventLog"]
        restaged = True
    require(log_current in (old_log["sha256"], after_log["sha256"]),
            "current log is neither staged original nor expected")
    if log_current == old_log["sha256"]:
        require(log_expected == after_log["sha256"]
                and int(log_expected_bytes) == after_log["bytes"]
                and int(log_lines) == after_log["lines"]
                and int(nul_lines) == after_log["nulRecoveredLines"]
                and int(nul_bytes) == after_log["nulRecoveredBytes"],
                "current log transform differs from staged plan")
    for key, current in installed.items():
        old = original["installedEntrypoints"][key]
        after = expected["installedEntrypoints"][key]
        require(current["currentSha256"] in (old["sha256"], after["sha256"]),
                "current installed file is neither staged original nor expected")
    if restaged:
        state = "RESTAGE"
    elif receipt.exists():
        kind = receipt_kind(receipt, staged["stageSha256"] if json.loads(receipt.read_text(encoding="utf-8")).get("schemaVersion") == 2 else None)
        state = "COMPLETE_PENDING" if kind == "COMPLETED" else "RESUME"
    else:
        state = "RESUME"
else:
    staged = {"schemaVersion": 1, "state": "STAGED", "payload": stage_payload}
    staged["stageSha256"] = digest(stage_payload)
    pathlib.Path(candidate_path).write_text(
        json.dumps(staged, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n",
        encoding="utf-8",
    )
    if receipt.exists() and receipt_kind(receipt) == "COMPLETED":
        require(unit_mutation_needed == "false", "completed receipt legacy-unit binding is stale")
        state = "COMPLETE"
    else:
        state = "NEW"
pathlib.Path(state_path).write_text(state + "\n", encoding="utf-8")
PY

retirement_mode="$(tr -d '\r\n' <"$retirement_state")"
case "$retirement_mode" in
  NEW|RESTAGE)
    pending_publish_tmp="$(mktemp "$receipt_parent/.legacy-runtime-automation-retirement.pending.XXXXXX")"
    cp -- "$pending_candidate" "$pending_publish_tmp"
    chmod 0600 "$pending_publish_tmp"
    ensure_expected_owner "$pending_publish_tmp"
    fsync_regular_file "$pending_publish_tmp"
    mv -f -- "$pending_publish_tmp" "$PENDING_FILE"
    pending_publish_tmp=""
    "$PYTHON_BIN" - "$PENDING_FILE" "$receipt_parent" <<'PY'
import os, pathlib, sys
with pathlib.Path(sys.argv[1]).open("rb") as reader:
    os.fsync(reader.fileno())
descriptor = os.open(sys.argv[2], os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
try:
    os.fsync(descriptor)
finally:
    os.close(descriptor)
PY
    ;;
  RESUME|COMPLETE|COMPLETE_PENDING) ;;
  *) echo '[legacy-runtime-automation-retirement] invalid retirement journal state' >&2; exit 79 ;;
esac
if [[ "$retirement_mode" != COMPLETE ]]; then
  [[ -f "$PENDING_FILE" && ! -L "$PENDING_FILE" \
     && "$(stat -c '%h:%u:%a' "$PENDING_FILE")" == "1:$expected_uid:600" ]] || {
    echo '[legacy-runtime-automation-retirement] pending journal is unsafe or missing' >&2
    exit 79
  }
fi
fail_after_stage_if_requested pending

# Retire installed stale entrypoints first. Old command-index/project-core
# wrappers can invoke these files independently of the target worktree, so an
# audited original is replaced by an exact exit-78 stub using same-directory
# CAS+rename. An already-retired or absent target is left untouched.
while IFS='|' read -r installed_name installed_path installed_observed installed_current_sha installed_expected_sha; do
  case "$installed_name" in
    resonanceV3Deploy) installed_stub="$v3_stub" ;;
    resonanceUp) installed_stub="$up_stub" ;;
    resonanceBuildDeployV2) installed_stub="$build_v2_stub" ;;
    *) echo '[legacy-runtime-automation-retirement] unknown installed entrypoint plan' >&2; exit 79 ;;
  esac
  case "$installed_observed" in
    ABSENT) ;;
    RETIRED)
      [[ "$(sha256sum "$installed_path" | awk '{print $1}')" == "$installed_expected_sha" \
         && "$(stat -c '%F:%h:%u:%g:%a' "$installed_path")" == "regular file:1:$expected_uid:$expected_gid:755" ]] || {
        echo "[legacy-runtime-automation-retirement] retired installed entrypoint drifted: $installed_name" >&2
        exit 79
      }
      ;;
    ORIGINAL)
      installed_parent="$(dirname "$installed_path")"
      installed_tmp="$(mktemp "$installed_parent/.legacy-runtime-retired.XXXXXX")"
      cp -- "$installed_stub" "$installed_tmp"
      chmod 0755 "$installed_tmp"
      ensure_expected_owner "$installed_tmp"
      fsync_regular_file "$installed_tmp"
      [[ "$(sha256sum "$installed_path" | awk '{print $1}')" == "$installed_current_sha" \
         && "$(stat -c '%F:%h:%u:%g' "$installed_path")" == "regular file:1:$expected_uid:$expected_gid" ]] || {
        rm -f -- "$installed_tmp"
        echo "[legacy-runtime-automation-retirement] installed entrypoint changed before retirement: $installed_name" >&2
        exit 79
      }
      mv -f -- "$installed_tmp" "$installed_path"
      "$PYTHON_BIN" - "$installed_path" "$installed_parent" <<'PY'
import os, pathlib, sys
with pathlib.Path(sys.argv[1]).open("rb") as reader:
    os.fsync(reader.fileno())
descriptor = os.open(sys.argv[2], os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
try:
    os.fsync(descriptor)
finally:
    os.close(descriptor)
PY
      [[ "$(sha256sum "$installed_path" | awk '{print $1}')" == "$installed_expected_sha" \
         && "$(stat -c '%F:%h:%u:%g:%a' "$installed_path")" == "regular file:1:$expected_uid:$expected_gid:755" ]] || {
        echo "[legacy-runtime-automation-retirement] installed entrypoint retirement postcondition failed: $installed_name" >&2
        exit 79
      }
      ;;
    *) echo '[legacy-runtime-automation-retirement] invalid installed entrypoint observation' >&2; exit 79 ;;
  esac
done < <("$PYTHON_BIN" - "$installed_plan" <<'PY'
import json, sys
value = json.load(open(sys.argv[1], encoding="utf-8"))
for key in sorted(value):
    item = value[key]
    print("|".join((key, item["path"], item["observed"], item["currentSha256"], item["expectedAfterSha256"])))
PY
)
fail_after_stage_if_requested installed

cron_changed=false
if ! cmp -s "$cron_before" "$cron_expected"; then
  # Best-effort compare-and-swap: abort if an operator changed the crontab after
  # validation. crontab(1) performs the actual spool replacement atomically.
  run_privileged "$CRONTAB_BIN" -u "$CRON_USER" -l >"$cron_current" 2>"$cron_error" || {
    echo '[legacy-runtime-automation-retirement] crontab re-read failed before atomic install' >&2
    exit 79
  }
  cmp -s "$cron_before" "$cron_current" || {
    echo '[legacy-runtime-automation-retirement] crontab changed during retirement; no cron write performed' >&2
    exit 79
  }
  if ! run_privileged "$CRONTAB_BIN" -u "$CRON_USER" "$cron_expected"; then
    # crontab(1) can report failure after replacing the spool. Re-read instead
    # of guessing: the original remains a staged retry, the exact safe result
    # resumes one-way, and every third state fails closed.
    run_privileged "$CRONTAB_BIN" -u "$CRON_USER" -l >"$cron_current" 2>"$cron_error" || {
      echo '[legacy-runtime-automation-retirement] crontab install failed and post-read is unavailable' >&2
      exit 79
    }
    if cmp -s "$cron_before" "$cron_current"; then
      echo '[legacy-runtime-automation-retirement] atomic crontab install failed before replacement; staged retry required' >&2
      exit 79
    fi
    cmp -s "$cron_expected" "$cron_current" || {
      echo '[legacy-runtime-automation-retirement] atomic crontab install returned an indeterminate state' >&2
      exit 79
    }
  fi
  cron_changed=true
fi
run_privileged "$CRONTAB_BIN" -u "$CRON_USER" -l >"$cron_after" 2>"$cron_error" || {
  echo '[legacy-runtime-automation-retirement] crontab post-read failed' >&2
  exit 79
}
cmp -s "$cron_expected" "$cron_after" || {
  echo '[legacy-runtime-automation-retirement] crontab postcondition mismatch' >&2
  exit 79
}
cron_after_sha="$(sha256sum "$cron_after" | awk '{print $1}')"
[[ "$cron_after_sha" == "$cron_expected_sha" ]] || exit 79
cron_spool_after_metadata="$(run_privileged stat -c '%F:%h:%u:%a' "$CRON_SPOOL_FILE" 2>/dev/null || true)"
[[ "$cron_spool_after_metadata" == "regular file:1:$expected_uid:600" ]] || {
  echo '[legacy-runtime-automation-retirement] owner crontab spool postcondition is unsafe' >&2
  exit 79
}
cron_spool_after_sha="$(run_privileged sha256sum "$CRON_SPOOL_FILE" | awk '{print $1}')"
[[ "$cron_spool_after_sha" =~ ^[0-9a-f]{64}$ ]] || exit 79
fail_after_stage_if_requested cron

for legacy_unit in "${LEGACY_UNITS[@]}"; do
  load_state="$(systemctl_value show "$legacy_unit" -p LoadState --value)" || {
    echo "[legacy-runtime-automation-retirement] unable to inspect legacy unit: $legacy_unit" >&2
    exit 79
  }
  case "$load_state" in
    loaded)
      enabled_before="$(systemctl_value is-enabled "$legacy_unit" || true)"
      active_before="$(systemctl_value is-active "$legacy_unit" || true)"
      case "$enabled_before" in disabled|masked|static|indirect|not-found) ;; *)
        run_privileged "$SYSTEMCTL_BIN" disable --now "$legacy_unit" >/dev/null 2>&1 || {
          echo "[legacy-runtime-automation-retirement] unable to disable legacy unit: $legacy_unit" >&2
          exit 79
        }
        ;;
      esac
      case "$active_before" in inactive|unknown|not-found) ;; *)
        run_privileged "$SYSTEMCTL_BIN" stop "$legacy_unit" >/dev/null 2>&1 || {
          echo "[legacy-runtime-automation-retirement] unable to stop legacy unit: $legacy_unit" >&2
          exit 79
        }
        ;;
      esac
      post_stop_state="$(systemctl_value show "$legacy_unit" -p ActiveState --value)" || {
        echo "[legacy-runtime-automation-retirement] unable to inspect stopped legacy unit: $legacy_unit" >&2
        exit 79
      }
      case "$post_stop_state" in
        inactive) ;;
        failed)
          run_privileged "$SYSTEMCTL_BIN" reset-failed "$legacy_unit" >/dev/null 2>&1 || {
            echo "[legacy-runtime-automation-retirement] unable to clear legacy unit failure state: $legacy_unit" >&2
            exit 79
          }
          ;;
        *)
          echo "[legacy-runtime-automation-retirement] stopped legacy unit has unexpected state: $legacy_unit" >&2
          exit 79
          ;;
      esac
      ;;
    not-found) ;;
    *)
      echo "[legacy-runtime-automation-retirement] unknown legacy unit load state: $legacy_unit" >&2
      exit 79
      ;;
  esac
  enabled_state="$(systemctl_value is-enabled "$legacy_unit" || true)"
  active_state="$(systemctl_value is-active "$legacy_unit" || true)"
  case "$enabled_state" in disabled|masked|static|indirect|not-found) ;; *)
    echo "[legacy-runtime-automation-retirement] legacy unit remains enabled: $legacy_unit" >&2
    exit 79
  esac
  case "$active_state" in inactive|unknown|not-found) ;; *)
    echo "[legacy-runtime-automation-retirement] legacy unit remains active: $legacy_unit" >&2
    exit 79
  esac
done
fail_after_stage_if_requested units

find_legacy_processes() {
  "$PS_BIN" -eo pid=,args= | "$PYTHON_BIN" -c '
import re, sys
patterns = (
    ("runtime-autorecovery", re.compile(r"^(?:(?:\S*/)?(?:bash|sh)\s+)?(?:\S*/)?ops/scripts/autorecovery/check-and-recover\.sh\s+carbonet-prod\s+carbonet-runtime(?:\s|$)")),
    ("runtime-autorecovery-shell", re.compile(r"^(?:\S*/)?(?:bash|sh)\s+-c\s+.*(?:&&|;)\s*(?:\S*/)?bash\s+(?:\S*/)?ops/scripts/autorecovery/check-and-recover\.sh\s+carbonet-prod\s+carbonet-runtime(?:\s|$)")),
    ("legacy-reboot", re.compile(r"^(?:(?:\S*/)?(?:bash|sh)\s+)?/opt/Resonance/ops/scripts/resonance-up\.sh(?:\s|$)")),
    ("startup-watchdog", re.compile(r"^(?:(?:\S*/)?(?:bash|sh)\s+)?\S*/ops/scripts/resonance-startup-watchdog\.sh(?:\s|$)")),
    ("best-effort", re.compile(r"^(?:(?:\S*/)?(?:bash|sh)\s+)?\S*/ops/scripts/resonance-start-best-effort\.sh(?:\s|$)")),
    ("local-k8s-restart", re.compile(r"^(?:(?:\S*/)?(?:bash|sh)\s+)?\S*/ops/scripts/restart-local-carbonet-k8s\.sh(?:\s|$)")),
    ("p006-route-guard", re.compile(r"^(?:(?:\S*/)?(?:bash|sh)\s+)?/home/sjkim/OmniverseProjects/p006-route-guard\.sh(?:\s|$)")),
    ("frontend-auto-build", re.compile(r"^(?:(?:\S*/)?(?:bash|sh)\s+)?(?:\S*/)?ops/scripts/resonance-frontend-auto-build\.sh(?:\s|$)")),
    ("react-route-self-heal", re.compile(r"^(?:(?:\S*/)?(?:bash|sh)\s+)?(?:\S*/)?ops/scripts/resonance-react-route-self-heal\.sh(?:\s|$)")),
    ("unsafe-screen-overlay", re.compile(r"^(?:(?:\S*/)?(?:bash|sh)\s+)?(?:\S*/)?ops/scripts/resonance-screen-overlay-apply\.sh(?:\s|$)")),
)
for line in sys.stdin:
    fields = line.strip().split(None, 1)
    if len(fields) != 2 or not fields[0].isdigit():
        continue
    for kind, pattern in patterns:
        if pattern.search(fields[1]):
            print(f"{fields[0]}:{kind}")
            break
'
}

legacy_processes=""
for ((elapsed=0; elapsed<=PROCESS_WAIT_SECONDS; elapsed++)); do
  legacy_processes="$(find_legacy_processes)" || {
    echo '[legacy-runtime-automation-retirement] process inventory failed' >&2
    exit 79
  }
  [[ -n "$legacy_processes" ]] || break
  (( elapsed == PROCESS_WAIT_SECONDS )) && break
  sleep 1
done
if [[ -n "$legacy_processes" ]]; then
  legacy_process_count="$(wc -l <<<"$legacy_processes" | tr -d '[:space:]')"
  echo "[legacy-runtime-automation-retirement] in-flight legacy runtime automation remains count=$legacy_process_count" >&2
  exit 79
fi

log_status=ABSENT
log_before_sha=ABSENT
log_after_sha=ABSENT
log_before_bytes=0
log_after_bytes=0
log_before_mode=ABSENT
log_after_mode=ABSENT
log_lines=0
log_nul_recovered_lines=0
log_nul_recovered_bytes=0
if [[ "$log_current_status" == ABSENT ]]; then
  [[ ! -e "$WATCHDOG_EVENT_LOG" && ! -L "$WATCHDOG_EVENT_LOG" ]] || {
    echo '[legacy-runtime-automation-retirement] watchdog event log appeared after the staged absence proof' >&2
    exit 79
  }
else
  log_status=REDACTED
  log_before_sha="$log_current_sha"
  log_before_bytes="$log_current_bytes"
  log_before_mode="$log_current_mode"
  log_after_sha="$log_expected_sha"
  log_after_bytes="$log_expected_bytes"
  log_after_mode=600
  log_lines="$log_expected_lines"
  log_nul_recovered_lines="$log_expected_nul_recovered_lines"
  log_nul_recovered_bytes="$log_expected_nul_recovered_bytes"
  log_parent="$(dirname "$WATCHDOG_EVENT_LOG")"
  current_log_sha="$(sha256sum "$WATCHDOG_EVENT_LOG" | awk '{print $1}')"
  if [[ "$current_log_sha" != "$log_expected_sha" ]]; then
    [[ "$current_log_sha" == "$log_current_sha" ]] || {
      echo '[legacy-runtime-automation-retirement] watchdog event log changed after staged proof' >&2
      exit 79
    }
    log_publish_tmp="$(mktemp "$log_parent/.startup-watchdog-events.redacted.XXXXXX")"
    cp -- "$planned_log" "$log_publish_tmp"
    chmod 0600 "$log_publish_tmp"
    ensure_expected_owner "$log_publish_tmp"
    fsync_regular_file "$log_publish_tmp"
    [[ "$(sha256sum "$WATCHDOG_EVENT_LOG" | awk '{print $1}')" == "$log_current_sha" ]] || {
      echo '[legacy-runtime-automation-retirement] watchdog event log changed before atomic redaction' >&2
      exit 79
    }
    mv -f -- "$log_publish_tmp" "$WATCHDOG_EVENT_LOG"
    log_publish_tmp=""
  fi
  if [[ "$(stat -c %a "$WATCHDOG_EVENT_LOG")" != 600 ]]; then
    run_privileged chmod 0600 "$WATCHDOG_EVENT_LOG"
  fi
  "$PYTHON_BIN" - "$WATCHDOG_EVENT_LOG" "$log_parent" <<'PY'
import os, sys
with open(sys.argv[1], "rb") as reader:
    os.fsync(reader.fileno())
descriptor = os.open(sys.argv[2], os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
try:
    os.fsync(descriptor)
finally:
    os.close(descriptor)
PY
  [[ -f "$WATCHDOG_EVENT_LOG" && ! -L "$WATCHDOG_EVENT_LOG" \
     && "$(stat -c '%h:%u:%a' "$WATCHDOG_EVENT_LOG")" == "1:$expected_uid:600" ]] || {
    echo '[legacy-runtime-automation-retirement] redacted watchdog log metadata is unsafe' >&2
    exit 79
  }
  if LC_ALL=C grep -Eqi '[?&]token=' "$WATCHDOG_EVENT_LOG"; then
    echo '[legacy-runtime-automation-retirement] watchdog event log still contains a credential query' >&2
    exit 79
  fi
  [[ "$(sha256sum "$WATCHDOG_EVENT_LOG" | awk '{print $1}')" == "$log_expected_sha" \
     && "$(stat -c %s "$WATCHDOG_EVENT_LOG")" == "$log_expected_bytes" ]] || {
    echo '[legacy-runtime-automation-retirement] redacted watchdog log hash/size mismatch' >&2
    exit 79
  }
  [[ "$(wc -l <"$WATCHDOG_EVENT_LOG" | tr -d '[:space:]')" == "$log_lines" ]] || {
    echo '[legacy-runtime-automation-retirement] watchdog event log line count changed' >&2
    exit 79
  }
fi
fail_after_stage_if_requested log

installed_final="$tmp_dir/installed-entrypoints.final.json"
"$PYTHON_BIN" - "$installed_plan" "$installed_final" <<'PY'
import hashlib, json, os, pathlib, stat, sys
plan = json.load(open(sys.argv[1], encoding="utf-8"))
final = {}
for key, item in plan.items():
    path = pathlib.Path(item["path"])
    if item["observed"] == "ABSENT":
        if path.exists() or path.is_symlink():
            raise SystemExit(f"absent installed entrypoint appeared: {key}")
        final[key] = {"path": str(path), "afterSha256": "ABSENT", "afterMode": "ABSENT",
                      "uid": item["uid"], "gid": item["gid"]}
        continue
    value = os.lstat(path)
    actual_sha = hashlib.sha256(path.read_bytes()).hexdigest()
    actual_mode = format(stat.S_IMODE(value.st_mode), "o")
    if (not stat.S_ISREG(value.st_mode) or value.st_nlink != 1
            or value.st_uid != item["uid"] or value.st_gid != item["gid"]
            or actual_sha != item["expectedAfterSha256"] or actual_mode != "755"):
        raise SystemExit(f"installed entrypoint final proof failed: {key}")
    final[key] = {"path": str(path), "afterSha256": actual_sha, "afterMode": actual_mode,
                  "uid": value.st_uid, "gid": value.st_gid}
pathlib.Path(sys.argv[2]).write_text(
    json.dumps(final, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
PY

if [[ -e "$RECEIPT_FILE" || -L "$RECEIPT_FILE" ]]; then
  [[ -f "$RECEIPT_FILE" && ! -L "$RECEIPT_FILE" \
     && "$(stat -c '%h:%u:%a' "$RECEIPT_FILE")" == "1:$expected_uid:600" ]] || {
    echo '[legacy-runtime-automation-retirement] existing receipt is unsafe' >&2
    exit 79
  }
fi
receipt_publish_tmp="$(mktemp "$receipt_parent/.legacy-runtime-automation-retirement.XXXXXX")"
receipt_action="$tmp_dir/receipt.action"
"$PYTHON_BIN" - "$RECEIPT_FILE" "$PENDING_FILE" "$receipt_publish_tmp" "$receipt_action" \
  "$installed_plan" "$installed_final" "$cron_after_sha" "$cron_spool_after_sha" \
  "$log_status" "$WATCHDOG_EVENT_LOG" "$log_after_sha" "$log_after_bytes" "$log_after_mode" "$log_lines" <<'PY'
import datetime, hashlib, json, os, pathlib, re, sys
(receipt_path, pending_path, output_path, action_path, installed_plan_path, installed_final_path,
 cron_after, spool_after, log_status, log_path, log_after, log_bytes, log_mode, log_lines) = sys.argv[1:]
receipt_file, pending_file = pathlib.Path(receipt_path), pathlib.Path(pending_path)
sha = re.compile(r"^[0-9a-f]{64}$")
units = {
    "resonanceStartupWatchdogTimer": "disabled-inactive",
    "resonanceStartupWatchdogService": "disabled-inactive",
    "resonanceRecoveryService": "disabled-inactive",
    "resonanceP006RouteGuardTimer": "disabled-inactive",
    "resonanceP006RouteGuardService": "disabled-inactive",
    "resonanceFrontendAutoBuildTimer": "disabled-inactive",
    "resonanceFrontendAutoBuildService": "disabled-inactive",
    "resonanceReactRouteSelfHealTimer": "disabled-inactive",
    "resonanceReactRouteSelfHealService": "disabled-inactive",
    "carbonetPostRebootRecoveryService": "enabled-preserved",
}
installed_plan = json.load(open(installed_plan_path, encoding="utf-8"))
installed_final = json.load(open(installed_final_path, encoding="utf-8"))

def require(value, message):
    if not value:
        raise SystemExit(message)

def digest(value):
    raw = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()

now = datetime.datetime.now(datetime.timezone.utc).isoformat()
current_verification = {
    "verifiedAt": now,
    "cron": {"afterSha256": cron_after, "spoolAfterSha256": spool_after, "spoolAfterMode": "600"},
    "units": units,
    "inFlightLegacyProcesses": 0,
    "watchdogEventLog": {
        "status": log_status, "path": log_path, "afterSha256": log_after,
        "afterBytes": int(log_bytes), "afterMode": log_mode, "lines": int(log_lines),
        "credentialQueryMatches": 0,
    },
    "installedEntrypoints": installed_final,
}

def first_from_pending():
    raw = pending_file.read_text(encoding="utf-8")
    require(not re.search(r"(?i)[?&]token=", raw), "pending journal contains a credential query")
    staged = json.loads(raw)
    require(isinstance(staged, dict) and set(staged) == {"schemaVersion", "state", "stageSha256", "payload"}
            and staged["schemaVersion"] == 1 and staged["state"] == "STAGED",
            "pending journal shape/state is invalid")
    require(staged["stageSha256"] == digest(staged["payload"]), "pending journal digest is invalid")
    payload = staged["payload"]
    original, expected = payload["original"], payload["expected"]
    cron = original["cron"]
    require(expected["cronSha256"] == cron_after, "completed cron differs from staged expectation")
    original_log, expected_log = original["watchdogEventLog"], expected["watchdogEventLog"]
    require(expected_log["sha256"] == log_after and expected_log["bytes"] == int(log_bytes)
            and expected_log["mode"] == log_mode and expected_log["lines"] == int(log_lines),
            "completed watchdog log differs from staged expectation")
    first_installed = {}
    for key in sorted(installed_final):
        old, after, actual = (original["installedEntrypoints"][key],
                              expected["installedEntrypoints"][key], installed_final[key])
        require(after["sha256"] == actual["afterSha256"] and after["mode"] == actual["afterMode"],
                "completed installed entrypoint differs from staged expectation")
        first_installed[key] = {
            "path": old["path"], "observedAtStage": old["observed"],
            "beforeSha256": old["sha256"], "afterSha256": after["sha256"],
            "beforeMode": old["mode"], "afterMode": after["mode"],
            "uid": old["uid"], "gid": old["gid"],
        }
    first = {
        "retiredAt": payload["stagedAt"],
        "cron": {
            "beforeSha256": cron["sha256"], "afterSha256": expected["cronSha256"],
            "changed": cron["sha256"] != expected["cronSha256"],
            "spoolBeforeSha256": cron["spoolSha256"], "spoolAfterSha256": spool_after,
            "spoolBeforeMode": cron["spoolMode"], "spoolAfterMode": "600",
            "runtimeRecoveryRemoved": cron["runtimeRecoveryRemoved"],
            "rebootRecoveryRemoved": cron["rebootRecoveryRemoved"],
            "missingWatchdogRemoved": cron["missingWatchdogRemoved"],
            "unrelatedBytes": cron["unrelatedBytes"],
        },
        "units": units,
        "inFlightLegacyProcesses": 0,
        "watchdogEventLog": {
            "status": expected_log["status"], "path": original_log["path"],
            "beforeSha256": original_log["sha256"], "afterSha256": expected_log["sha256"],
            "beforeBytes": original_log["bytes"], "afterBytes": expected_log["bytes"],
            "beforeMode": original_log["mode"], "afterMode": expected_log["mode"],
            "lines": expected_log["lines"], "nulRecoveredLines": expected_log["nulRecoveredLines"],
            "nulRecoveredBytes": expected_log["nulRecoveredBytes"], "credentialQueryMatches": 0,
            "appearedAfterStage": bool(original_log.get("initiallyAbsent", False)
                                         and original_log["status"] == "PRESENT"),
        },
        "installedEntrypoints": first_installed,
    }
    return first, staged["stageSha256"]

first, completion_stage_sha = first_from_pending() if pending_file.exists() else (None, None)
preserve = False
if receipt_file.exists():
    raw = receipt_file.read_text(encoding="utf-8")
    require(not re.search(r"(?i)[?&]token=", raw), "existing receipt contains a credential query")
    prior = json.loads(raw)
    if prior.get("schemaVersion") == 2:
        require(set(prior) == {"schemaVersion", "state", "completionStageSha256",
                               "firstRemediationSha256", "firstRemediation", "lastVerification"}
                and prior["state"] == "COMPLETED", "existing completed receipt shape is invalid")
        require(prior["firstRemediationSha256"] == digest(prior["firstRemediation"]),
                "existing first-remediation digest is invalid")
        if first is not None:
            require(prior["completionStageSha256"] == completion_stage_sha
                    and prior["firstRemediationSha256"] == digest(first),
                    "completed receipt does not consume the staged journal")
        else:
            require(isinstance(prior["completionStageSha256"], str)
                    and re.fullmatch(r"[0-9a-f]{64}", prior["completionStageSha256"]),
                    "existing completion-stage digest is invalid")
        previous = prior["lastVerification"]
        # verifiedAt is historical; every authority-bearing postcondition must
        # still match the just-reverified current state exactly.
        for key in ("cron", "units", "inFlightLegacyProcesses", "watchdogEventLog", "installedEntrypoints"):
            require(previous.get(key) == current_verification[key],
                    f"existing completed receipt {key} binding is stale")
        preserve = True
    elif prior.get("schemaVersion") == 1:
        # Compatibility for the immediately preceding helper. Preserve every
        # historical field and add only the now-proven installed-stub axis.
        legacy = dict(prior)
        legacy.pop("schemaVersion")
        require(legacy["cron"]["afterSha256"] == cron_after
                and legacy["cron"]["spoolAfterSha256"] == spool_after
                and legacy["watchdogEventLog"]["afterSha256"] == log_after,
                "legacy receipt binding is stale")
        require(first is not None and completion_stage_sha is not None,
                "legacy receipt promotion requires a staged installed-entrypoint proof")
        legacy["installedEntrypoints"] = first["installedEntrypoints"]
        first = legacy
    else:
        raise SystemExit("existing receipt schema is unsupported")
else:
    require(first is not None, "completed remediation has no staged provenance")

if not preserve:
    receipt = {
        "schemaVersion": 2, "state": "COMPLETED",
        "completionStageSha256": completion_stage_sha,
        "firstRemediationSha256": digest(first), "firstRemediation": first,
        "lastVerification": current_verification,
    }
    serialized = json.dumps(receipt, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    require(not re.search(r"(?i)[?&]token=", serialized), "receipt contains a credential query")
    with open(output_path, "w", encoding="utf-8") as writer:
        writer.write(serialized + "\n")
        writer.flush()
        os.fsync(writer.fileno())
    pathlib.Path(action_path).write_text("WRITE\n", encoding="utf-8")
else:
    pathlib.Path(action_path).write_text("PRESERVE\n", encoding="utf-8")
PY

if [[ "$(tr -d '\r\n' <"$receipt_action")" == WRITE ]]; then
  chmod 0600 "$receipt_publish_tmp"
  ensure_expected_owner "$receipt_publish_tmp"
  fsync_regular_file "$receipt_publish_tmp"
  mv -f -- "$receipt_publish_tmp" "$RECEIPT_FILE"
else
  rm -f -- "$receipt_publish_tmp"
fi
receipt_publish_tmp=""
"$PYTHON_BIN" - "$RECEIPT_FILE" "$receipt_parent" <<'PY'
import os, pathlib, sys
with pathlib.Path(sys.argv[1]).open("rb") as reader:
    os.fsync(reader.fileno())
descriptor = os.open(sys.argv[2], os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
try:
    os.fsync(descriptor)
finally:
    os.close(descriptor)
PY
[[ "$(stat -c '%F:%h:%u:%a' "$RECEIPT_FILE")" == "regular file:1:$expected_uid:600" ]] || exit 79
"$PYTHON_BIN" - "$RECEIPT_FILE" "$cron_after_sha" "$cron_spool_after_sha" "$log_after_sha" <<'PY'
import hashlib, json, pathlib, re, sys
raw = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
value = json.loads(raw)
assert value["schemaVersion"] == 2 and value["state"] == "COMPLETED"
assert re.fullmatch(r"[0-9a-f]{64}", value["completionStageSha256"])
canonical = json.dumps(value["firstRemediation"], ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
assert value["firstRemediationSha256"] == hashlib.sha256(canonical).hexdigest()
assert value["lastVerification"]["cron"]["afterSha256"] == sys.argv[2]
assert value["lastVerification"]["cron"]["spoolAfterSha256"] == sys.argv[3]
assert value["lastVerification"]["watchdogEventLog"]["afterSha256"] == sys.argv[4]
assert value["lastVerification"]["inFlightLegacyProcesses"] == 0
assert not re.search(r"(?i)[?&]token=", raw)
PY
fail_after_stage_if_requested receipt

if [[ -e "$PENDING_FILE" || -L "$PENDING_FILE" ]]; then
  [[ -f "$PENDING_FILE" && ! -L "$PENDING_FILE" \
     && "$(stat -c '%h:%u:%a' "$PENDING_FILE")" == "1:$expected_uid:600" ]] || exit 79
  rm -f -- "$PENDING_FILE"
  "$PYTHON_BIN" - "$receipt_parent" <<'PY'
import os, sys
descriptor = os.open(sys.argv[1], os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
try:
    os.fsync(descriptor)
finally:
    os.close(descriptor)
PY
fi

echo "[legacy-runtime-automation-retirement] PASS state=COMPLETED cronChanged=$cron_changed legacyProcesses=0 watchdogLog=$log_status installedStubs=verified receiptMode=600"
