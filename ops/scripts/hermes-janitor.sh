#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
CUBRID_POD="${CUBRID_POD:-cubrid-carbonet-0}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-runtime/hermes-janitor}"
MAX_AGE_MINUTES="${HERMES_JANITOR_MAX_AGE_MINUTES:-60}"
LOG_FILE="$OUT_DIR/hermes-janitor-events.jsonl"
APPLY=0

mkdir -p "$OUT_DIR"

for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --dry-run) APPLY=0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

json_event() {
  local status="$1" code="$2" message="$3" details="${4:-}"
  python3 - "$LOG_FILE" "$status" "$code" "$message" "$details" <<'PY'
import datetime, json, pathlib, sys
path = pathlib.Path(sys.argv[1])
event = {
    "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "script": "hermes-janitor",
    "status": sys.argv[2],
    "code": sys.argv[3],
    "message": sys.argv[4],
}
if sys.argv[5]:
    event["details"] = sys.argv[5]
with path.open("a", encoding="utf-8") as handle:
    handle.write(json.dumps(event, ensure_ascii=False) + "\n")
print(json.dumps(event, ensure_ascii=False))
PY
}

run_sql() {
  local sql="$1"
  local sql_path="$OUT_DIR/hermes-janitor-$(date +%s%N).sql"
  printf '%s\nCOMMIT;\n' "$sql" > "$sql_path"
  kubectl -n "$NAMESPACE" cp "$sql_path" "$CUBRID_POD:/tmp/$(basename "$sql_path")" >/dev/null
  kubectl -n "$NAMESPACE" exec "$CUBRID_POD" -- bash -lc "csql -u '$DB_USER' '$DB_NAME' -i '/tmp/$(basename "$sql_path")'"
}

now_epoch="$(date +%s)"
stale_pids=()
active_interactive_count=0
while read -r pid ppid etimes stat args; do
  [[ -n "${pid:-}" ]] || continue
  active_interactive_count="$((active_interactive_count + 1))"
  age_minutes="$((etimes / 60))"
  if (( age_minutes >= MAX_AGE_MINUTES )); then
    stale_pids+=("$pid:$age_minutes:$stat:$args")
  fi
done < <(
  ps -eo pid=,ppid=,etimes=,stat=,args= \
    | awk '/\/opt\/util\/ai\/hermes-agent-v20260516\/venv\/bin\/hermes/ && $4 ~ /\+/ {print}'
)

if ((${#stale_pids[@]} == 0)); then
  json_event "OK" "NO_STALE_PROCESS" "no stale interactive Hermes process older than ${MAX_AGE_MINUTES} minutes"
else
  json_event "WARN" "STALE_PROCESS_FOUND" "stale interactive Hermes processes found" "$(printf '%s;' "${stale_pids[@]}")"
  if (( APPLY == 1 )); then
    for item in "${stale_pids[@]}"; do
      pid="${item%%:*}"
      kill -TERM "$pid" 2>/dev/null || true
    done
    sleep 3
    for item in "${stale_pids[@]}"; do
      pid="${item%%:*}"
      if kill -0 "$pid" 2>/dev/null; then
        kill -KILL "$pid" 2>/dev/null || true
      fi
    done
    json_event "OK" "STALE_PROCESS_CLOSED" "closed stale interactive Hermes processes" "$(printf '%s;' "${stale_pids[@]}")"
  fi
fi

sql_select="
SELECT hermes_session_id, hermes_task_id, status, started_at, frst_regist_pnttm
  FROM hermes_cli_session
 WHERE status = 'STARTED';
"

if (( APPLY == 1 && active_interactive_count == ${#stale_pids[@]} )); then
  sql_apply="
UPDATE hermes_cli_session
   SET status = 'FAILED',
       exit_code = 124,
       summary = 'Hermes janitor closed stale STARTED session with no active owner.',
       finished_at = CURRENT_DATETIME,
       last_updt_pnttm = CURRENT_DATETIME
 WHERE status = 'STARTED';

UPDATE hermes_task
   SET status = 'FAILED',
       result_summary = 'Hermes janitor closed task because the CLI session was stale or detached.',
       completed_at = CURRENT_DATETIME,
       last_updt_pnttm = CURRENT_DATETIME
 WHERE status IN ('INTERPRETED', 'STARTED', 'RUNNING')
   AND hermes_task_id IN (
     SELECT hermes_task_id
       FROM hermes_cli_session
      WHERE status = 'FAILED'
        AND summary = 'Hermes janitor closed stale STARTED session with no active owner.'
   );
"
  run_sql "$sql_apply"
  json_event "OK" "DB_STALE_SESSIONS_CLOSED" "closed DB STARTED Hermes CLI sessions"
elif (( APPLY == 1 )); then
  json_event "SKIP" "DB_CLOSE_DEFERRED" "active interactive Hermes process exists; DB STARTED rows left untouched" "active=${active_interactive_count};stale=${#stale_pids[@]}"
else
  run_sql "$sql_select" || true
  json_event "OK" "DRY_RUN" "dry run only; pass --apply to close stale processes and DB sessions"
fi
