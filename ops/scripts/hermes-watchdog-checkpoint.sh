#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PLAN_JSON="${1:-}"
CHECKPOINT_STAGE="${2:-MANUAL_CHECKPOINT}"
CHECKPOINT_NOTE="${3:-}"
WATCHDOG_DIR="${HERMES_WATCHDOG_DIR:-$ROOT_DIR/var/ai-runtime/hermes-watchdog}"
WATCHDOG_EVENTS="${HERMES_WATCHDOG_EVENTS:-$WATCHDOG_DIR/hermes-watchdog-events.jsonl}"
MODEL_ASK="${HERMES_WATCHDOG_MODEL_ASK:-/usr/local/bin/resonance-model-ask}"
TIMEOUT_SECONDS="${HERMES_WATCHDOG_TIMEOUT_SECONDS:-45}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
CUBRID_POD="${CUBRID_POD:-cubrid-carbonet-0}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"
HERMES_WATCHDOG_DB_ENABLE="${HERMES_WATCHDOG_DB_ENABLE:-1}"
WATCHDOG_SQL_DIR="$WATCHDOG_DIR/sql"
WATCHDOG_EVENT_TMP="$WATCHDOG_DIR/.watchdog-event.tmp.json"

mkdir -p "$WATCHDOG_DIR" "$WATCHDOG_SQL_DIR"

if [ -z "$PLAN_JSON" ]; then
  PLAN_JSON="$(ls -t "$ROOT_DIR"/var/ai-runtime/hermes-workflow/hermes-*.interpretation.json 2>/dev/null | head -n 1 || true)"
fi

if [ -z "$PLAN_JSON" ] || [ ! -f "$PLAN_JSON" ]; then
  echo "usage: $0 <plan-json> [checkpoint-stage] [note]" >&2
  exit 2
fi

python3 - "$PLAN_JSON" "$CHECKPOINT_STAGE" "$CHECKPOINT_NOTE" <<'PY' >"$WATCHDOG_DIR/.watchdog-prompt.tmp"
import json
import pathlib
import sys

plan_path, stage, note = sys.argv[1:4]
plan = json.loads(pathlib.Path(plan_path).read_text(encoding="utf-8"))
decision = plan.get("modelDecision") or {}
payload = {
    "checkpointStage": stage,
    "checkpointNote": note,
    "planPath": plan_path,
    "taskType": plan.get("taskType"),
    "riskLevel": plan.get("riskLevel"),
    "activeWorkKind": decision.get("activeWorkKind"),
    "selectedModel": decision.get("selectedModel"),
    "selectedLane": decision.get("selectedLane"),
    "preferredBaseUrl": decision.get("preferredBaseUrl"),
    "qwen40JudgeSkipped": decision.get("qwen40JudgeSkipped"),
    "stageCount": len(plan.get("stages") or []),
    "stages": [
        {
            "stageCode": item.get("stageCode"),
            "title": item.get("title"),
            "executor": item.get("executor"),
            "expectedEvidence": item.get("expectedEvidence"),
        }
        for item in (plan.get("stages") or [])[:8]
    ],
}
print(json.dumps(payload, ensure_ascii=False, indent=2))
PY

feedback="$(
  timeout "${TIMEOUT_SECONDS}s" env RESONANCE_MODEL_ASK_ROLE=sub RESONANCE_MODEL_ASK_MAX_TOKENS="${HERMES_WATCHDOG_MAX_TOKENS:-320}" \
    "$MODEL_ASK" watchdog <"$WATCHDOG_DIR/.watchdog-prompt.tmp" 2>/dev/null || true
)"

python3 - "$PLAN_JSON" "$CHECKPOINT_STAGE" "$CHECKPOINT_NOTE" "$feedback" "$WATCHDOG_EVENTS" "$WATCHDOG_SQL_DIR" "$WATCHDOG_EVENT_TMP" <<'PY'
import datetime
import json
import pathlib
import re
import sys

plan_path, stage, note, feedback, events_path, sql_dir, event_tmp = sys.argv[1:8]
plan_file = pathlib.Path(plan_path)
plan = {}
try:
    plan = json.loads(plan_file.read_text(encoding="utf-8"))
except Exception:
    plan = {}
task_id = plan_file.name.replace(".interpretation.json", "")
if not task_id:
    task_id = f"watchdog-{int(datetime.datetime.now().timestamp())}"
safe_task_id = re.sub(r"[^0-9A-Za-z_.-]+", "-", task_id)[:60]
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M%S%f")
snapshot_id = f"watchdog-{safe_task_id}-{stamp}"[:80]
event = {
    "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "script": "hermes-watchdog-checkpoint",
    "taskId": task_id,
    "snapshotId": snapshot_id,
    "planPath": plan_path,
    "checkpointStage": stage,
    "checkpointNote": note,
    "supervisorRole": "sub",
    "supervisorModel": "qwen2.5-coder-7b-instruct-shadow",
    "feedback": feedback.strip(),
}
path = pathlib.Path(events_path)
path.parent.mkdir(parents=True, exist_ok=True)
with path.open("a", encoding="utf-8") as handle:
    handle.write(json.dumps(event, ensure_ascii=False) + "\n")
event_path = pathlib.Path(event_tmp)
event_path.parent.mkdir(parents=True, exist_ok=True)
event_path.write_text(json.dumps(event, ensure_ascii=False, indent=2), encoding="utf-8")

def sql_lit(value, limit=3900):
    text = "" if value is None else str(value)
    text = text.replace("\r", " ").replace("\n", " ").strip()
    return "'" + text[:limit].replace("'", "''") + "'"

summary = feedback.strip()[:1800] or "watchdog returned no feedback"
raw_payload = json.dumps({
    "event": event,
    "planTaskType": plan.get("taskType"),
    "planRiskLevel": plan.get("riskLevel"),
    "modelDecision": plan.get("modelDecision") or {},
}, ensure_ascii=False)
sql_path = pathlib.Path(sql_dir) / f"{snapshot_id}.sql"
sql_path.write_text(
    "INSERT INTO hermes_runtime_snapshot "
    "(hermes_snapshot_id, hermes_task_id, snapshot_type, source_ref, summary, raw_payload, collected_by) "
    "SELECT "
    + ", ".join([
        sql_lit(snapshot_id, 80),
        sql_lit(task_id, 80),
        "'WATCHDOG_FEEDBACK'",
        sql_lit(plan_path, 1000),
        sql_lit(summary, 3900),
        sql_lit(raw_payload, 3900),
        "'qwen7-watchdog'",
    ])
    + " FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_runtime_snapshot WHERE hermes_snapshot_id = "
    + sql_lit(snapshot_id, 80)
    + ");\nCOMMIT;\n",
    encoding="utf-8",
)
event["dbSqlPath"] = str(sql_path)
event_path.write_text(json.dumps(event, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(event, ensure_ascii=False))
PY

if [ "$HERMES_WATCHDOG_DB_ENABLE" = "1" ]; then
  WATCHDOG_SQL_PATH="$(python3 - "$WATCHDOG_EVENT_TMP" <<'PY'
import json
import pathlib
import sys
path = pathlib.Path(sys.argv[1])
if path.exists():
    print((json.loads(path.read_text(encoding="utf-8")) or {}).get("dbSqlPath", ""))
PY
)"
  if [ -n "$WATCHDOG_SQL_PATH" ] && [ -f "$WATCHDOG_SQL_PATH" ] && command -v kubectl >/dev/null 2>&1; then
    remote_sql="/tmp/$(basename "$WATCHDOG_SQL_PATH")"
    kubectl -n "$NAMESPACE" cp "$WATCHDOG_SQL_PATH" "$CUBRID_POD:$remote_sql" >/dev/null 2>&1 || true
    kubectl -n "$NAMESPACE" exec "$CUBRID_POD" -- bash -lc "csql -u '$DB_USER' -i '$remote_sql' '$DB_NAME'" >/dev/null 2>&1 || true
  fi
fi
