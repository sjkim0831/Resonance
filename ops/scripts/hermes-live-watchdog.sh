#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TASK_ID="${1:-}"
OBSERVED_FILE="${2:-}"
CHECKPOINT_STAGE="${3:-LIVE_WATCHDOG}"
CHECKPOINT_NOTE="${4:-}"
WATCHDOG_DIR="${HERMES_WATCHDOG_DIR:-$ROOT_DIR/var/ai-runtime/hermes-watchdog}"
WATCHDOG_EVENTS="${HERMES_LIVE_WATCHDOG_EVENTS:-$WATCHDOG_DIR/hermes-live-watchdog-events.jsonl}"
MODEL_ASK="${HERMES_WATCHDOG_MODEL_ASK:-/usr/local/bin/resonance-model-ask}"
TIMEOUT_SECONDS="${HERMES_WATCHDOG_TIMEOUT_SECONDS:-45}"
MAX_TOKENS="${HERMES_WATCHDOG_MAX_TOKENS:-260}"
TAIL_BYTES="${HERMES_LIVE_WATCHDOG_TAIL_BYTES:-5000}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
CUBRID_POD="${CUBRID_POD:-cubrid-carbonet-0}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"
HERMES_WATCHDOG_DB_ENABLE="${HERMES_WATCHDOG_DB_ENABLE:-1}"
SQL_DIR="$WATCHDOG_DIR/sql"
EVENT_TMP="$WATCHDOG_DIR/.live-watchdog-event.tmp.json"

mkdir -p "$WATCHDOG_DIR" "$SQL_DIR"

if [ -z "$TASK_ID" ] || [ -z "$OBSERVED_FILE" ]; then
  echo "usage: $0 <hermes-task-id> <observed-file> [stage] [note]" >&2
  exit 2
fi

if [ ! -f "$OBSERVED_FILE" ]; then
  echo "observed file not found: $OBSERVED_FILE" >&2
  exit 2
fi

python3 - "$TASK_ID" "$OBSERVED_FILE" "$CHECKPOINT_STAGE" "$CHECKPOINT_NOTE" "$TAIL_BYTES" <<'PY' >"$WATCHDOG_DIR/.live-watchdog-prompt.tmp"
import collections
import hashlib
import json
import os
import pathlib
import sys
import time

task_id, observed_file, stage, note, tail_bytes = sys.argv[1:6]
path = pathlib.Path(observed_file)
size = path.stat().st_size
mtime = path.stat().st_mtime
tail_bytes = int(tail_bytes)
with path.open("rb") as handle:
    if size > tail_bytes:
        handle.seek(size - tail_bytes)
    tail = handle.read().decode("utf-8", errors="replace")
lines = [line.strip() for line in tail.splitlines() if line.strip()]
last_lines = lines[-60:]
counter = collections.Counter(last_lines)
repeated_lines = [
    {"line": line[:220], "count": count}
    for line, count in counter.most_common(8)
    if count >= 3
]
error_lines = [
    line[:300]
    for line in last_lines
    if any(
        token in line.lower()
        for token in [
            "error",
            "failed",
            "exception",
            "traceback",
            "iteration budget",
            "preparing terminal",
            "compacting context",
            "session compressed",
            "pattern-resolution",
            "accuracy may degrade",
            "timeout",
            "oom",
            "cuda",
        ]
    )
][-12:]
payload = {
    "checkpointStage": stage,
    "checkpointNote": note,
    "taskId": task_id,
    "observedFile": observed_file,
    "fileSizeBytes": size,
    "fileMtimeEpoch": int(mtime),
    "secondsSinceLastOutput": max(0, int(time.time() - mtime)),
    "tailSha256": hashlib.sha256(tail.encode("utf-8", errors="ignore")).hexdigest(),
    "lastLineCount": len(last_lines),
    "repeatedLines": repeated_lines,
    "errorLines": error_lines,
    "tailPreview": tail[-3500:],
    "watchdogInstruction": "Only report risks directly visible in this payload. Treat repeated 'preparing terminal', repeated same error, no-output stall, repeated context compaction, repeated pattern-resolution file browsing, iteration budget, and claimed success without evidence as risks. If the task is deploy or UI freshness work, require source+manifest+served asset evidence before LOW severity.",
}
print(json.dumps(payload, ensure_ascii=False, indent=2))
PY

feedback="$(
  timeout "${TIMEOUT_SECONDS}s" env RESONANCE_MODEL_ASK_ROLE=sub RESONANCE_MODEL_ASK_MAX_TOKENS="$MAX_TOKENS" \
    "$MODEL_ASK" watchdog <"$WATCHDOG_DIR/.live-watchdog-prompt.tmp" 2>/dev/null || true
)"

python3 - "$TASK_ID" "$OBSERVED_FILE" "$CHECKPOINT_STAGE" "$CHECKPOINT_NOTE" "$feedback" "$WATCHDOG_EVENTS" "$SQL_DIR" "$EVENT_TMP" <<'PY'
import datetime
import hashlib
import json
import pathlib
import re
import sys

task_id, observed_file, stage, note, feedback, events_path, sql_dir, event_tmp = sys.argv[1:9]
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M%S%f")
safe_task_id = re.sub(r"[^0-9A-Za-z_.-]+", "-", task_id)[:58] or "unknown-task"
snapshot_id = f"livewd-{safe_task_id}-{stamp}"[:80]
path = pathlib.Path(observed_file)
tail = ""
if path.exists():
    with path.open("rb") as handle:
        size = path.stat().st_size
        if size > 3900:
            handle.seek(size - 3900)
        tail = handle.read().decode("utf-8", errors="replace")
event = {
    "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "script": "hermes-live-watchdog",
    "taskId": task_id,
    "snapshotId": snapshot_id,
    "observedFile": observed_file,
    "checkpointStage": stage,
    "checkpointNote": note,
    "supervisorRole": "sub",
    "supervisorModel": "qwen2.5-coder-7b-instruct-shadow",
    "tailSha256": hashlib.sha256(tail.encode("utf-8", errors="ignore")).hexdigest(),
    "feedback": feedback.strip(),
}
events = pathlib.Path(events_path)
events.parent.mkdir(parents=True, exist_ok=True)
with events.open("a", encoding="utf-8") as handle:
    handle.write(json.dumps(event, ensure_ascii=False) + "\n")

def sql_lit(value, limit=3900):
    text = "" if value is None else str(value)
    text = text.replace("\r", " ").replace("\n", " ").strip()
    return "'" + text[:limit].replace("'", "''") + "'"

summary = feedback.strip()[:1800] or "live watchdog returned no feedback"
raw_payload = json.dumps({"event": event, "tailPreview": tail[-1800:]}, ensure_ascii=False)
sql_path = pathlib.Path(sql_dir) / f"{snapshot_id}.sql"
sql_path.write_text(
    "INSERT INTO hermes_runtime_snapshot "
    "(hermes_snapshot_id, hermes_task_id, snapshot_type, source_ref, summary, raw_payload, collected_by) "
    "SELECT "
    + ", ".join([
        sql_lit(snapshot_id, 80),
        sql_lit(task_id, 80),
        "'HERMES_LIVE_WATCHDOG'",
        sql_lit(observed_file, 1000),
        sql_lit(summary, 3900),
        sql_lit(raw_payload, 3900),
        "'qwen7-live-watchdog'",
    ])
    + " FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_runtime_snapshot WHERE hermes_snapshot_id = "
    + sql_lit(snapshot_id, 80)
    + ");\nCOMMIT;\n",
    encoding="utf-8",
)
event["dbSqlPath"] = str(sql_path)
tmp = pathlib.Path(event_tmp)
tmp.parent.mkdir(parents=True, exist_ok=True)
tmp.write_text(json.dumps(event, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(event, ensure_ascii=False))
PY

if [ "$HERMES_WATCHDOG_DB_ENABLE" = "1" ]; then
  SQL_PATH="$(python3 - "$EVENT_TMP" <<'PY'
import json
import pathlib
import sys
path = pathlib.Path(sys.argv[1])
if path.exists():
    print((json.loads(path.read_text(encoding="utf-8")) or {}).get("dbSqlPath", ""))
PY
)"
  if [ -n "$SQL_PATH" ] && [ -f "$SQL_PATH" ] && command -v kubectl >/dev/null 2>&1; then
    remote_sql="/tmp/$(basename "$SQL_PATH")"
    kubectl -n "$NAMESPACE" cp "$SQL_PATH" "$CUBRID_POD:$remote_sql" >/dev/null 2>&1 || true
    kubectl -n "$NAMESPACE" exec "$CUBRID_POD" -- bash -lc "csql -u '$DB_USER' -i '$remote_sql' '$DB_NAME'" >/dev/null 2>&1 || true
  fi
fi
