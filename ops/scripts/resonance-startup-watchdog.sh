#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_URL="${TARGET_URL:-http://127.0.0.1:17890/}"
EVENT_LOG="${EVENT_LOG:-$ROOT_DIR/var/ai-runtime/startup-watchdog-events.jsonl}"
RECOVERY_WAIT_SECONDS="${CARBONET_STARTUP_WATCHDOG_RECOVERY_WAIT_SECONDS:-3}"
[[ "$RECOVERY_WAIT_SECONDS" =~ ^[0-9]+$ && "$RECOVERY_WAIT_SECONDS" -le 30 ]] || {
  echo '[startup-watchdog] recovery wait must be an integer from 0 through 30 seconds' >&2
  exit 2
}

prepare_event_log() {
  python3 - "$EVENT_LOG" "$(id -u)" <<'PY'
import os
import stat
import sys

path = sys.argv[1]
expected_uid = int(sys.argv[2])
from pathlib import Path
event_path = Path(path)
if not event_path.is_absolute() or not event_path.parent.is_dir():
    raise SystemExit("startup watchdog event-log parent is missing")
current = Path(event_path.anchor)
for part in event_path.parent.parts[1:]:
    current /= part
    if stat.S_ISLNK(os.lstat(current).st_mode):
        raise SystemExit("startup watchdog event-log path contains a symlink")
try:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
except FileExistsError:
    pass
else:
    os.close(descriptor)
value = os.lstat(path)
if not stat.S_ISREG(value.st_mode) or value.st_nlink != 1 or value.st_uid != expected_uid:
    raise SystemExit("unsafe startup watchdog event log")
os.chmod(path, 0o600)
value = os.lstat(path)
if stat.S_IMODE(value.st_mode) != 0o600:
    raise SystemExit("startup watchdog event log is not private")
PY
}
prepare_event_log

json_escape() {
  printf '"%s"' "$(printf '%s' "${1-}" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g')"
}

redacted_target_url_json() {
  python3 - "$TARGET_URL" <<'PY'
import json
import sys
from urllib.parse import urlsplit, urlunsplit

value = urlsplit(sys.argv[1])
if value.scheme not in ("http", "https") or not value.hostname:
    raise SystemExit("startup watchdog target must be an HTTP(S) URL")
hostname = value.hostname
if ":" in hostname:
    hostname = f"[{hostname}]"
try:
    port = value.port
except ValueError as error:
    raise SystemExit("startup watchdog target has an invalid port") from error
netloc = hostname if port is None else f"{hostname}:{port}"
print(json.dumps(urlunsplit((value.scheme, netloc, value.path or "/", "", ""))))
PY
}

append_event() {
  python3 -c '
import os
import stat
import sys
path = sys.argv[1]
expected_uid = int(sys.argv[2])
payload = sys.stdin.buffer.read()
descriptor = os.open(path, os.O_WRONLY | os.O_APPEND | getattr(os, "O_NOFOLLOW", 0))
try:
    value = os.fstat(descriptor)
    if (not stat.S_ISREG(value.st_mode) or value.st_nlink != 1
            or value.st_uid != expected_uid or stat.S_IMODE(value.st_mode) != 0o600):
        raise SystemExit("unsafe startup watchdog event log at append")
    os.write(descriptor, payload)
    os.fsync(descriptor)
finally:
    os.close(descriptor)
' "$EVENT_LOG" "$(id -u)"
}

log_event() {
  local status="$1"
  local action="$2"
  local detail="$3"
  printf '{"schemaVersion":"1.0","eventType":"startup-watchdog","timestamp":%s,"status":%s,"action":%s,"detail":%s,"targetUrl":%s}\n' \
    "$(json_escape "$(date -Iseconds)")" \
    "$(json_escape "$status")" \
    "$(json_escape "$action")" \
    "$(json_escape "$detail")" \
    "$(redacted_target_url_json)" | append_event
}

if curl -fsS --max-time 10 "$TARGET_URL" >/dev/null 2>&1; then
  log_event "PASS" "probe" "target already reachable"
  exit 0
fi

# Port 17890 belongs to resonance-ops-web, not the Carbonet runtime. Recover
# only that exact unit, then re-probe. Never route an ops-web probe failure into
# a Carbonet build, image update, rollout restart, or PodTemplate mutation.
if sudo -n systemctl restart resonance-ops-web.service >/dev/null 2>&1; then
  (( RECOVERY_WAIT_SECONDS == 0 )) || sleep "$RECOVERY_WAIT_SECONDS"
  if curl -fsS --max-time 10 "$TARGET_URL" >/dev/null 2>&1; then
    log_event "PASS" "ops-web-restarted" \
      "exact resonance-ops-web service restart restored target; carbonet mutation=0"
    exit 0
  fi
fi
log_event "FAIL" "ops-web-recovery-failed" \
  "target remains unreachable; exact ops-web recovery failed; carbonet mutation=0"
exit 1
