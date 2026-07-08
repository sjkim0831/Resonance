# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] hermes-launcher.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
DEFAULT_REAL_HERMES="/opt/Resonance/hermes/venv/bin/hermes"
if [ ! -x "$DEFAULT_REAL_HERMES" ]; then
  DEFAULT_REAL_HERMES="/opt/Resonance/hermes/hermes"
fi
REAL_HERMES="${REAL_HERMES:-$DEFAULT_REAL_HERMES}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
CUBRID_POD="${CUBRID_POD:-cubrid-carbonet-0}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"
HERMES_DB_RECORD_ENABLE="${HERMES_DB_RECORD_ENABLE:-1}"
HERMES_DB_RECORD_TIMEOUT_SECONDS="${HERMES_DB_RECORD_TIMEOUT_SECONDS:-3}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-runtime/hermes-cli}"
RECORD_SCRIPT="${RECORD_SCRIPT:-$ROOT_DIR/ops/scripts/hermes-record-request.sh}"
LIVE_WATCHDOG_SCRIPT="${LIVE_WATCHDOG_SCRIPT:-$ROOT_DIR/ops/scripts/hermes-live-watchdog.sh}"
SELF_HEAL_SCRIPT="${SELF_HEAL_SCRIPT:-$ROOT_DIR/ops/scripts/hermes-agent-self-heal.sh}"
HERMES_LIVE_WATCHDOG_ENABLE="${HERMES_LIVE_WATCHDOG_ENABLE:-1}"
HERMES_AGENT_SELF_HEAL_ENABLE="${HERMES_AGENT_SELF_HEAL_ENABLE:-1}"
HERMES_LIVE_WATCHDOG_INTERVAL_SECONDS="${HERMES_LIVE_WATCHDOG_INTERVAL_SECONDS:-30}"
HERMES_LIVE_WATCHDOG_STALL_SECONDS="${HERMES_LIVE_WATCHDOG_STALL_SECONDS:-90}"
HERMES_QUERY_CONTEXT_PACK_ENABLE="${HERMES_QUERY_CONTEXT_PACK_ENABLE:-1}"
HERMES_QUERY_CONTEXT_PACK_MAX_CHARS="${HERMES_QUERY_CONTEXT_PACK_MAX_CHARS:-4200}"
HERMES_INTERACTIVE_DEEP_PREFLIGHT="${HERMES_INTERACTIVE_DEEP_PREFLIGHT:-0}"
HERMES_SKIP_PREFLIGHT_FOR_TRIVIAL="${HERMES_SKIP_PREFLIGHT_FOR_TRIVIAL:-1}"
HERMES_INTERRUPTION_HANDOFF_DIR="${HERMES_INTERRUPTION_HANDOFF_DIR:-$OUT_DIR/interrupted}"
mkdir -p "$OUT_DIR/sql"

if [ ! -x "$REAL_HERMES" ]; then
  echo "Hermes executable not found: $REAL_HERMES" >&2
  exit 127
fi

if [ "${HERMES_RECORD_WRAPPER_ENABLE:-1}" != "1" ]; then
  exec "$REAL_HERMES" "$@"
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
SESSION_ID="hermes-cli-$STAMP-$$"
WORKSPACE_PATH="$(pwd)"

now_ms() {
  python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
}

START_MS="$(now_ms)"

sql_lit() {
  python3 - "$1" <<'PY'
import sys
text = sys.argv[1]
text = text.replace("\r", " ").replace("\n", " ").strip()
print("'" + text[:3900].replace("'", "''") + "'")
PY
}

db_exec() {
  local sql="$1"
  if [ "$HERMES_DB_RECORD_ENABLE" != "1" ]; then
    return 0
  fi
  local sql_path="$OUT_DIR/sql/$SESSION_ID-$(date +%s%N).sql"
  printf '%s\nCOMMIT;\n' "$sql" > "$sql_path"
  timeout "${HERMES_DB_RECORD_TIMEOUT_SECONDS}s" bash -c '
    set -euo pipefail
    sql_path="$1"
    namespace="$2"
    pod="$3"
    db_user="$4"
    db_name="$5"
    remote_sql="/tmp/$(basename "$sql_path")"
    kubectl -n "$namespace" cp "$sql_path" "$pod:$remote_sql" >/dev/null
    kubectl -n "$namespace" exec "$pod" -- bash -lc "csql -u '\''$db_user'\'' '\''$db_name'\'' -i '\''$remote_sql'\''" >/dev/null
  ' _ "$sql_path" "$NAMESPACE" "$CUBRID_POD" "$DB_USER" "$DB_NAME" || {
    printf '[hermes-launcher] DB record skipped after %ss: %s\n' "$HERMES_DB_RECORD_TIMEOUT_SECONDS" "$sql_path" >&2
    return 0
  }
}

start_transcript_watcher() {
  local task_id="$1"
  local transcript="$2"
  (
    local last_size=0
    local current_size=""
    local last_watchdog_at=0
    local last_stall_watchdog_at=0
    while true; do
      sleep 5
      [ -f "$transcript" ] || continue
      current_size="$(wc -c < "$transcript" 2>/dev/null || echo 0)"
      if [ "$current_size" = "$last_size" ]; then
        if [ "$HERMES_LIVE_WATCHDOG_ENABLE" = "1" ] && [ -x "$LIVE_WATCHDOG_SCRIPT" ]; then
          local now mtime idle
          now="$(date +%s)"
          mtime="$(stat -c %Y "$transcript" 2>/dev/null || echo "$now")"
          idle="$((now - mtime))"
          if [ "$idle" -ge "$HERMES_LIVE_WATCHDOG_STALL_SECONDS" ] && [ "$((now - last_stall_watchdog_at))" -ge "$HERMES_LIVE_WATCHDOG_INTERVAL_SECONDS" ]; then
            last_stall_watchdog_at="$now"
            timeout "${HERMES_WATCHDOG_TIMEOUT_SECONDS:-45}s" "$LIVE_WATCHDOG_SCRIPT" "$task_id" "$transcript" "NO_OUTPUT_STALL" "No transcript growth for ${idle}s while Hermes session is running." >/dev/null 2>&1 || true
          fi
        fi
        continue
      fi
      last_size="$current_size"
      local snapshot_id tail_text
      snapshot_id="snap-$SESSION_ID-$(date +%s)"
      tail_text="$(tail -c 3000 "$transcript" 2>/dev/null || true)"
      db_exec "INSERT INTO hermes_runtime_snapshot (hermes_snapshot_id, hermes_task_id, snapshot_type, source_ref, summary, raw_payload, collected_by) VALUES ($(sql_lit "$snapshot_id"), $(sql_lit "$task_id"), 'HERMES_TRANSCRIPT_TAIL', $(sql_lit "$transcript"), $(sql_lit "Hermes interactive transcript updated while the session is running."), $(sql_lit "$tail_text"), 'hermes-launcher'); UPDATE hermes_task SET status = 'RUNNING', result_summary = $(sql_lit "대화형 Hermes 세션 실행 중. 최신 transcript tail이 runtime snapshot에 저장되었습니다."), last_updt_pnttm = CURRENT_DATETIME WHERE hermes_task_id = $(sql_lit "$task_id");"
      if [ "$HERMES_LIVE_WATCHDOG_ENABLE" = "1" ] && [ -x "$LIVE_WATCHDOG_SCRIPT" ]; then
        local now
        now="$(date +%s)"
        if [ "$((now - last_watchdog_at))" -ge "$HERMES_LIVE_WATCHDOG_INTERVAL_SECONDS" ]; then
          last_watchdog_at="$now"
          timeout "${HERMES_WATCHDOG_TIMEOUT_SECONDS:-45}s" "$LIVE_WATCHDOG_SCRIPT" "$task_id" "$transcript" "TRANSCRIPT_UPDATED" "Hermes transcript changed; inspect for repeated errors, loops, or missing evidence." >/dev/null 2>&1 || true
        fi
      fi
    done
  ) >/dev/null 2>&1 &
  printf '%s' "$!"
}

start_live_file_watcher() {
  local task_id="$1"
  local observed_file="$2"
  local label="${3:-LIVE_OUTPUT}"
  (
    local last_size=0
    local current_size=""
    local last_watchdog_at=0
    local last_stall_watchdog_at=0
    while true; do
      sleep 5
      [ -f "$observed_file" ] || continue
      current_size="$(wc -c < "$observed_file" 2>/dev/null || echo 0)"
      local now
      now="$(date +%s)"
      if [ "$current_size" = "$last_size" ]; then
        if [ "$HERMES_LIVE_WATCHDOG_ENABLE" = "1" ] && [ -x "$LIVE_WATCHDOG_SCRIPT" ]; then
          local mtime idle
          mtime="$(stat -c %Y "$observed_file" 2>/dev/null || echo "$now")"
          idle="$((now - mtime))"
          if [ "$idle" -ge "$HERMES_LIVE_WATCHDOG_STALL_SECONDS" ] && [ "$((now - last_stall_watchdog_at))" -ge "$HERMES_LIVE_WATCHDOG_INTERVAL_SECONDS" ]; then
            last_stall_watchdog_at="$now"
            timeout "${HERMES_WATCHDOG_TIMEOUT_SECONDS:-45}s" "$LIVE_WATCHDOG_SCRIPT" "$task_id" "$observed_file" "NO_OUTPUT_STALL" "No ${label} growth for ${idle}s while Hermes is running." >/dev/null 2>&1 || true
          fi
        fi
        continue
      fi
      last_size="$current_size"
      if [ "$HERMES_LIVE_WATCHDOG_ENABLE" = "1" ] && [ -x "$LIVE_WATCHDOG_SCRIPT" ] && [ "$((now - last_watchdog_at))" -ge "$HERMES_LIVE_WATCHDOG_INTERVAL_SECONDS" ]; then
        last_watchdog_at="$now"
        timeout "${HERMES_WATCHDOG_TIMEOUT_SECONDS:-45}s" "$LIVE_WATCHDOG_SCRIPT" "$task_id" "$observed_file" "${label}_UPDATED" "Hermes ${label} changed; inspect for interrupt, repeated errors, loops, or missing evidence." >/dev/null 2>&1 || true
      fi
    done
  ) >/dev/null 2>&1 &
  printf '%s' "$!"
}

stop_live_watcher() {
  local watcher_pid="${1:-}"
  if [ -n "$watcher_pid" ] && kill -0 "$watcher_pid" >/dev/null 2>&1; then
    kill "$watcher_pid" >/dev/null 2>&1 || true
    wait "$watcher_pid" >/dev/null 2>&1 || true
  fi
}

command_line() {
  printf 'hermes'
  for arg in "$@"; do
    printf ' %q' "$arg"
  done
}

real_command_line() {
  printf '%q' "$REAL_HERMES"
  for arg in "$@"; do
    printf ' %q' "$arg"
  done
}

find_query() {
  local previous=""
  for arg in "$@"; do
    if [ "$previous" = "-q" ] || [ "$previous" = "--query" ] || [ "$previous" = "-z" ] || [ "$previous" = "--oneshot" ]; then
      printf '%s' "$arg"
      return 0
    fi
    previous="$arg"
  done
  return 1
}

is_trivial_query() {
  python3 - "$1" <<'PY'
import re
import sys
text = sys.argv[1].strip().lower()
dev_terms = [
    "수정", "고쳐", "개발", "빌드", "배포", "재배포", "db", "디비", "sql",
    "에르메스", "hermes", "watchdog", "모델", "페이지", "화면", "frontend",
    "backend", "spring", "react", "cubrid", "k8s", "pod", "파드", "로그",
]
if len(text) <= 40 and not any(term in text for term in dev_terms):
    print("1")
else:
    print("0")
PY
}

write_query_context_pack() {
  local record_json="$1"
  local context_pack_ref="$2"
  local original_query="$3"
  python3 - "$record_json" "$context_pack_ref" "$original_query" "$HERMES_QUERY_CONTEXT_PACK_MAX_CHARS" <<'PY'
import json
import pathlib
import sys

record_json, context_pack_ref, original_query, max_chars = sys.argv[1:5]
max_chars = int(max_chars)
record_path = pathlib.Path(record_json)
if not record_path.exists():
    raise SystemExit(0)
lines = [line for line in record_path.read_text(encoding="utf-8", errors="ignore").splitlines() if line.strip()]
if not lines:
    raise SystemExit(0)
record = json.loads(lines[-1])
if record.get("code") in {"HERMES_TRIVIAL_PREFLIGHT_SKIPPED", "HERMES_INTERACTIVE_LIGHT_PREFLIGHT"}:
    raise SystemExit(0)
plan_path_text = record.get("planPath") or ""
resolution_path_text = record.get("resolutionPath") or ""
if not plan_path_text:
    raise SystemExit(0)
plan_path = pathlib.Path(plan_path_text)
resolution_path = pathlib.Path(resolution_path_text) if resolution_path_text else pathlib.Path("__missing_resolution__")
plan = {}
resolution = {}
if plan_path.exists() and plan_path.is_file():
    plan = json.loads(plan_path.read_text(encoding="utf-8", errors="ignore"))
if resolution_path.exists() and resolution_path.is_file():
    resolution = json.loads(resolution_path.read_text(encoding="utf-8", errors="ignore"))
decision = plan.get("modelDecision") or {}
context = decision.get("contextPack") or {}
teams = resolution.get("agentTeamSelection") or {}
selected_pattern = resolution.get("selectedPattern") or {}
stages = plan.get("stages") or []

def compact_list(values, limit=8):
    result = []
    for value in values or []:
        text = str(value).strip()
        if text and text not in result:
            result.append(text)
        if len(result) >= limit:
            break
    return result

def team_ids(values, limit=6):
    result = []
    for item in values or []:
        if isinstance(item, dict):
            text = str(item.get("teamId") or "").strip()
        else:
            text = str(item).strip()
        if text and text not in result:
            result.append(text)
        if len(result) >= limit:
            break
    return result

packet = {
    "taskId": record.get("taskId"),
    "taskType": record.get("taskType") or plan.get("taskType"),
    "riskLevel": record.get("riskLevel") or plan.get("riskLevel"),
    "selectedLane": decision.get("selectedLane"),
    "selectedModel": decision.get("selectedModel"),
    "patternId": selected_pattern.get("patternId") or record.get("patternId"),
    "patternName": selected_pattern.get("patternName") or record.get("patternName"),
    "primarySkill": context.get("primarySkill"),
    "secondarySkill": context.get("secondarySkill"),
    "candidatePaths": compact_list(context.get("candidatePaths")),
    "writableBoundaries": compact_list(context.get("writableBoundaries")),
    "verificationCommands": compact_list(context.get("verificationCommands"), 10),
    "requiredTeams": team_ids(teams.get("requiredTeams")),
    "gateTeams": team_ids(teams.get("gateTeams")),
    "stageCodes": compact_list([item.get("stageCode") for item in stages if isinstance(item, dict)], 10),
}
rules = [
    "Use the compact Resonance preflight below to avoid broad file reads.",
    "Open only candidate paths after verifying they exist; use rg before reading large files.",
    "For UI/deploy freshness, do not claim success without source, current manifest asset, served asset, rollout/health evidence.",
    "If Hermes output loops, repeats file reads, asks unnecessary clarify, or lacks evidence, stop and summarize the recovery point.",
    "7B is advisory; deterministic commands and runtime evidence override model confidence.",
]
prefix = "\n".join([
    "Resonance 7B preflight packet:",
    json.dumps(packet, ensure_ascii=False, indent=2),
    "Execution rules:",
    *[f"- {rule}" for rule in rules],
    "",
    "User request:",
])
augmented = prefix + original_query
pathlib.Path(context_pack_ref).write_text(augmented[:max_chars], encoding="utf-8")
PY
}

replace_query_arg() {
  local replacement="$1"
  shift
  local replace_next=0
  for arg in "$@"; do
    if [ "$replace_next" = "1" ]; then
      printf '%s\0' "$replacement"
      replace_next=0
      continue
    fi
    printf '%s\0' "$arg"
    case "$arg" in
      -q|--query|-z|--oneshot)
        replace_next=1
        ;;
    esac
  done
}

extract_resume_id_from_files() {
  python3 - "$@" <<'PY'
import pathlib
import re
import sys
text_parts = []
for item in sys.argv[1:]:
    path = pathlib.Path(item)
    if path.exists() and path.is_file():
        text_parts.append(path.read_text(encoding="utf-8", errors="ignore")[-9000:])
    else:
        text_parts.append(item)
text = "\n".join(text_parts)
patterns = [
    r"Resume this session with:\s*hermes\s+--resume\s+([0-9A-Za-z_.:-]+)",
    r"hermes\s+--resume\s+([0-9A-Za-z_.:-]+)",
    r"--resume\s+([0-9A-Za-z_.:-]+)",
]
for pattern in patterns:
    match = re.search(pattern, text)
    if match:
        print(match.group(1))
        raise SystemExit(0)
PY
}

detect_interruption_from_files() {
  python3 - "$@" <<'PY'
import pathlib
import sys
needles = [
    "Operation interrupted",
    "[Interrupted - processing new message]",
    "New message detected, interrupting",
    "Interrupted during API call",
    "msg=interrupt",
    "Iteration budget reached",
]
for item in sys.argv[1:]:
    path = pathlib.Path(item)
    if not path.exists() or not path.is_file():
        continue
    text = path.read_text(encoding="utf-8", errors="ignore")[-12000:]
    if any(needle in text for needle in needles):
        print("1")
        raise SystemExit(0)
print("0")
PY
}

write_interruption_handoff() {
  local task_id="$1"
  local stdout_ref="${2:-}"
  local stderr_ref="${3:-}"
  local resume_id="${4:-}"
  shift 4 || true
  mkdir -p "$HERMES_INTERRUPTION_HANDOFF_DIR"
  local handoff="$HERMES_INTERRUPTION_HANDOFF_DIR/$SESSION_ID.handoff.md"
  local payload="$HERMES_INTERRUPTION_HANDOFF_DIR/$SESSION_ID.handoff.json"
  python3 - "$handoff" "$payload" "$SESSION_ID" "$task_id" "$stdout_ref" "$stderr_ref" "$resume_id" "$(command_line "$@")" <<'PY'
import datetime
import json
import pathlib
import sys
handoff, payload, session_id, task_id, stdout_ref, stderr_ref, resume_id, command_line = sys.argv[1:9]
def tail(path, limit=5000):
    p = pathlib.Path(path)
    if not path or not p.exists():
        return ""
    return p.read_text(encoding="utf-8", errors="ignore")[-limit:]
data = {
    "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "script": "hermes-launcher",
    "event": "INTERRUPTED_NEEDS_CONTINUATION",
    "sessionId": session_id,
    "taskId": task_id,
    "stdoutRef": stdout_ref,
    "stderrRef": stderr_ref,
    "resumeId": resume_id,
    "resumeCommand": f"hermes --resume {resume_id}" if resume_id else "",
    "originalCommand": command_line,
    "stdoutTail": tail(stdout_ref),
    "stderrTail": tail(stderr_ref),
}
pathlib.Path(payload).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
lines = [
    "# Hermes Interrupted Session Handoff",
    "",
    f"- sessionId: `{session_id}`",
    f"- taskId: `{task_id}`",
    "- status: `INTERRUPTED_NEEDS_CONTINUATION`",
    f"- stdout: `{stdout_ref}`",
    f"- stderr: `{stderr_ref}`",
    "",
    "## Resume",
    "",
    f"`hermes --resume {resume_id}`" if resume_id else "No native Hermes resume id was detected. Use the original command and the stdout/stderr tail as the continuation context.",
    "",
    "## Continuation Rule",
    "",
    "Before accepting a new user message as a replacement task, reopen the interrupted task checklist, finish unapplied patches, run deterministic verification, then process the newer request.",
]
pathlib.Path(handoff).write_text("\n".join(lines) + "\n", encoding="utf-8")
print(handoff)
PY
}

record_cli_session_start() {
  local mode="$1"
  local task_id="${2:-}"
  local transcript="${3:-}"
  shift 3 || true
  local cmdline
  cmdline="$(command_line "$@")"
  db_exec "INSERT INTO hermes_cli_session (hermes_session_id, hermes_task_id, project_id, workspace_path, command_line, mode, status, transcript_ref) VALUES ($(sql_lit "$SESSION_ID"), $(sql_lit "$task_id"), 'carbonet', $(sql_lit "$WORKSPACE_PATH"), $(sql_lit "$cmdline"), $(sql_lit "$mode"), 'STARTED', $(sql_lit "$transcript"));"
}

record_cli_session_finish() {
  local status="$1"
  local exit_code="$2"
  local task_id="${3:-}"
  local stdout_ref="${4:-}"
  local stderr_ref="${5:-}"
  local summary="${6:-}"
  shift 6 || true
  local end_ms elapsed
  end_ms="$(now_ms)"
  elapsed="$((end_ms - START_MS))"
  db_exec "UPDATE hermes_cli_session SET status = $(sql_lit "$status"), exit_code = $exit_code, stdout_ref = $(sql_lit "$stdout_ref"), stderr_ref = $(sql_lit "$stderr_ref"), summary = $(sql_lit "$summary"), finished_at = CURRENT_DATETIME, elapsed_ms = $elapsed, last_updt_pnttm = CURRENT_DATETIME WHERE hermes_session_id = $(sql_lit "$SESSION_ID");"
  if [ -n "$task_id" ]; then
    db_exec "UPDATE hermes_task SET status = $(sql_lit "$status"), result_summary = $(sql_lit "$summary"), completed_at = CURRENT_DATETIME, last_updt_pnttm = CURRENT_DATETIME WHERE hermes_task_id = $(sql_lit "$task_id");"
    db_exec "INSERT INTO hermes_execution_log (hermes_execution_id, hermes_task_id, execution_type, command_text, target_path, status, exit_code, stdout_ref, stderr_ref, output_summary, started_at, finished_at, elapsed_ms, executed_by) VALUES ($(sql_lit "exec-$SESSION_ID"), $(sql_lit "$task_id"), 'HERMES_CLI', $(sql_lit "$(command_line "$@")"), $(sql_lit "$WORKSPACE_PATH"), $(sql_lit "$status"), $exit_code, $(sql_lit "$stdout_ref"), $(sql_lit "$stderr_ref"), $(sql_lit "$summary"), CURRENT_DATETIME, CURRENT_DATETIME, $elapsed, 'hermes');"
  fi
}

run_agent_self_heal() {
  local task_id="$1"
  local exit_code="$2"
  local stdout_ref="${3:-}"
  local stderr_ref="${4:-}"
  shift 4 || true
  if [ "$HERMES_AGENT_SELF_HEAL_ENABLE" != "1" ] || [ ! -x "$SELF_HEAL_SCRIPT" ] || [ -z "$task_id" ]; then
    return 0
  fi
  local self_heal_ref
  self_heal_ref="$OUT_DIR/$SESSION_ID.self-heal.json"
  timeout "${HERMES_AGENT_SELF_HEAL_TIMEOUT_SECONDS:-420}s" "$SELF_HEAL_SCRIPT" "$task_id" "$exit_code" "$stdout_ref" "$stderr_ref" "$@" >"$self_heal_ref" 2>"$self_heal_ref.stderr" || true
  python3 - "$self_heal_ref" <<'PY' || true
import json
import pathlib
import sys
path = pathlib.Path(sys.argv[1])
if not path.exists():
    raise SystemExit(0)
text = path.read_text(encoding="utf-8", errors="ignore").strip()
if not text:
    raise SystemExit(0)
try:
    data = json.loads(text.splitlines()[-1])
except Exception:
    raise SystemExit(0)
handoff = data.get("handoff") or ""
resume = data.get("resumeCommand") or ""
print("")
print("Hermes agent self-heal prepared a candidate repair.")
if handoff:
    print(f"Self-heal handoff: {handoff}")
if resume:
    print(f"Resume original session with: {resume}")
PY
}

passthrough_commands="model gateway setup whatsapp login logout auth status cron webhook doctor dump debug backup import config pairing skills plugins memory tools mcp sessions insights claw version update uninstall acp profile completion dashboard logs"
first_arg="${1:-chat}"
for arg in "$@"; do
  if [ "$arg" = "-h" ] || [ "$arg" = "--help" ] || [ "$arg" = "-V" ] || [ "$arg" = "--version" ]; then
    exec "$REAL_HERMES" "$@"
  fi
done
for cmd in $passthrough_commands; do
  if [ "$first_arg" = "$cmd" ]; then
    exec "$REAL_HERMES" "$@"
  fi
done

query_text=""
if [ "$first_arg" = "chat" ]; then
  query_text="$(find_query "$@" || true)"
elif [ "$#" -gt 0 ]; then
  query_text="$(find_query "$@" || true)"
fi

if [ -z "$query_text" ]; then
  query_text="Hermes interactive or resumed Carbonet session preflight: $(command_line "$@")"
  record_json="$OUT_DIR/$SESSION_ID.record.json"
  if [ "$HERMES_INTERACTIVE_DEEP_PREFLIGHT" = "1" ] && [ -x "$RECORD_SCRIPT" ]; then
    "$RECORD_SCRIPT" "$query_text" | tee "$record_json" >/dev/null || true
  else
    python3 - "$record_json" "$SESSION_ID" <<'PY'
import datetime
import json
import pathlib
import sys
path, session_id = sys.argv[1:3]
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
payload = {
    "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "script": "hermes-launcher",
    "status": "OK",
    "code": "HERMES_INTERACTIVE_LIGHT_PREFLIGHT",
    "taskId": f"hermes-interactive-{stamp}-{session_id.split('-')[-1]}",
    "traceId": f"trace-interactive-{stamp}-{session_id.split('-')[-1]}",
    "taskType": "interactive",
    "riskLevel": "LOW",
}
pathlib.Path(path).write_text(json.dumps(payload, ensure_ascii=False) + "\n", encoding="utf-8")
PY
  fi
  task_id="$(python3 - "$record_json" <<'PY' 2>/dev/null || true
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
if path.exists():
    lines = [line for line in path.read_text(encoding="utf-8").strip().splitlines() if line.strip()]
    if lines:
        print(json.loads(lines[-1]).get("taskId", ""))
PY
)"
  transcript_ref="$OUT_DIR/$SESSION_ID.transcript.log"
  record_cli_session_start "INTERACTIVE" "$task_id" "$transcript_ref" "$@"
  transcript_watcher_pid=""
  if [ "$HERMES_LIVE_WATCHDOG_ENABLE" = "1" ] && [ -x "$LIVE_WATCHDOG_SCRIPT" ] && [ -n "$task_id" ]; then
    : >"$transcript_ref"
    transcript_watcher_pid="$(start_transcript_watcher "$task_id" "$transcript_ref")"
  fi
  set +e
  if command -v script >/dev/null 2>&1; then
    script -q -f -c "$(real_command_line "$@")" "$transcript_ref"
    exit_code=$?
  else
    "$REAL_HERMES" "$@"
    exit_code=$?
  fi
  set -e
  stop_live_watcher "$transcript_watcher_pid"
  if [ "$exit_code" -eq 0 ]; then
    status="COMPLETED"
  else
    status="FAILED"
  fi
  interrupted="$(detect_interruption_from_files "$transcript_ref")"
  if [ "$interrupted" = "1" ]; then
    resume_id="$(extract_resume_id_from_files "$transcript_ref" "$@" || true)"
    handoff_ref="$(write_interruption_handoff "$task_id" "$transcript_ref" "" "$resume_id" "$@")"
    status="INTERRUPTED_NEEDS_CONTINUATION"
    summary="Hermes interactive/resume session was interrupted before verification closed. Continue from handoff=$handoff_ref resume=${resume_id:-none}"
    db_exec "INSERT INTO hermes_runtime_snapshot (hermes_snapshot_id, hermes_task_id, snapshot_type, source_ref, summary, raw_payload, collected_by) VALUES ($(sql_lit "interrupt-$SESSION_ID"), $(sql_lit "$task_id"), 'HERMES_INTERRUPTION_HANDOFF', $(sql_lit "$handoff_ref"), $(sql_lit "$summary"), $(sql_lit "$(cat "$handoff_ref" 2>/dev/null || true)"), 'hermes-launcher'); UPDATE hermes_task SET status = 'INTERRUPTED_NEEDS_CONTINUATION', result_summary = $(sql_lit "$summary"), last_updt_pnttm = CURRENT_DATETIME WHERE hermes_task_id = $(sql_lit "$task_id");" || true
    printf '\nHermes interrupted before verification closed.\n'
    printf 'Continuation handoff: %s\n' "$handoff_ref"
    if [ -n "$resume_id" ]; then
      printf 'Resume this session with: hermes --resume %s\n' "$resume_id"
    fi
  else
    summary="Hermes interactive/resume session finished with exit_code=$exit_code. transcript=$transcript_ref"
  fi
  if [ "$HERMES_LIVE_WATCHDOG_ENABLE" = "1" ] && [ -x "$LIVE_WATCHDOG_SCRIPT" ] && [ -n "$task_id" ] && [ -f "$transcript_ref" ]; then
    timeout "${HERMES_WATCHDOG_TIMEOUT_SECONDS:-45}s" "$LIVE_WATCHDOG_SCRIPT" "$task_id" "$transcript_ref" "PROCESS_FINISHED" "Hermes interactive/resume session finished; inspect transcript for loop, failure, or success-without-evidence risk." >/dev/null 2>&1 || true
  fi
  if [ "$exit_code" -ne 0 ]; then
    run_agent_self_heal "$task_id" "$exit_code" "$transcript_ref" "" "$@"
  fi
  record_cli_session_finish "$status" "$exit_code" "$task_id" "$transcript_ref" "" "$summary" "$@"
  exit "$exit_code"
fi

if [ -n "$query_text" ]; then
  record_json="$OUT_DIR/$SESSION_ID.record.json"
  if [ "$HERMES_SKIP_PREFLIGHT_FOR_TRIVIAL" = "1" ] && [ "$(is_trivial_query "$query_text")" = "1" ]; then
    python3 - "$record_json" "$SESSION_ID" "$query_text" <<'PY'
import datetime
import json
import pathlib
import sys
path, session_id, query = sys.argv[1:4]
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
payload = {
    "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "script": "hermes-launcher",
    "status": "OK",
    "code": "HERMES_TRIVIAL_PREFLIGHT_SKIPPED",
    "taskId": f"hermes-trivial-{stamp}-{session_id.split('-')[-1]}",
    "traceId": f"trace-trivial-{stamp}-{session_id.split('-')[-1]}",
    "taskType": "trivial",
    "riskLevel": "LOW",
    "requestPreview": query[:160],
}
pathlib.Path(path).write_text(json.dumps(payload, ensure_ascii=False) + "\n", encoding="utf-8")
PY
  elif [ -x "$RECORD_SCRIPT" ]; then
    "$RECORD_SCRIPT" "$query_text" | tee "$record_json" >/dev/null || true
  fi
  task_id="$(python3 - "$record_json" <<'PY' 2>/dev/null || true
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
if path.exists():
    text = path.read_text(encoding="utf-8").strip().splitlines()[-1]
    print(json.loads(text).get("taskId", ""))
PY
)"
  if [ "$HERMES_QUERY_CONTEXT_PACK_ENABLE" = "1" ] && [ -n "$query_text" ] && [ -s "$record_json" ]; then
    context_pack_ref="$OUT_DIR/$SESSION_ID.context-pack.md"
    write_query_context_pack "$record_json" "$context_pack_ref" "$query_text" || true
    if [ -s "$context_pack_ref" ]; then
      augmented_query="$(cat "$context_pack_ref")"
      augmented_args=()
      while IFS= read -r -d '' item; do
        augmented_args+=("$item")
      done < <(replace_query_arg "$augmented_query" "$@")
      set -- "${augmented_args[@]}"
      summary_context_note=" contextPack=$context_pack_ref"
    else
      summary_context_note=""
    fi
  else
    summary_context_note=""
  fi
  stdout_ref="$OUT_DIR/$SESSION_ID.stdout.log"
  stderr_ref="$OUT_DIR/$SESSION_ID.stderr.log"
  record_cli_session_start "SINGLE_QUERY" "$task_id" "" "$@"
  stdout_watcher_pid=""
  stderr_watcher_pid=""
  if [ "$HERMES_LIVE_WATCHDOG_ENABLE" = "1" ] && [ -x "$LIVE_WATCHDOG_SCRIPT" ] && [ -n "$task_id" ]; then
    : >"$stdout_ref"
    : >"$stderr_ref"
    stdout_watcher_pid="$(start_live_file_watcher "$task_id" "$stdout_ref" "STDOUT")"
    stderr_watcher_pid="$(start_live_file_watcher "$task_id" "$stderr_ref" "STDERR")"
  fi
  set +e
  "$REAL_HERMES" "$@" > >(tee "$stdout_ref") 2> >(tee "$stderr_ref" >&2)
  exit_code=$?
  set -e
  stop_live_watcher "$stdout_watcher_pid"
  stop_live_watcher "$stderr_watcher_pid"
  if [ "$exit_code" -eq 0 ]; then
    status="COMPLETED"
  else
    status="FAILED"
  fi
  summary="Hermes single-query finished with exit_code=$exit_code. stdout=$stdout_ref stderr=$stderr_ref${summary_context_note:-}"
  interrupted="$(detect_interruption_from_files "$stdout_ref" "$stderr_ref")"
  if [ "$interrupted" = "1" ]; then
    resume_id="$(extract_resume_id_from_files "$stdout_ref" "$stderr_ref" "$@" || true)"
    handoff_ref="$(write_interruption_handoff "$task_id" "$stdout_ref" "$stderr_ref" "$resume_id" "$@")"
    status="INTERRUPTED_NEEDS_CONTINUATION"
    summary="Hermes was interrupted before the task was closed. Continue from handoff=$handoff_ref resume=${resume_id:-none}"
    db_exec "INSERT INTO hermes_runtime_snapshot (hermes_snapshot_id, hermes_task_id, snapshot_type, source_ref, summary, raw_payload, collected_by) VALUES ($(sql_lit "interrupt-$SESSION_ID"), $(sql_lit "$task_id"), 'HERMES_INTERRUPTION_HANDOFF', $(sql_lit "$handoff_ref"), $(sql_lit "$summary"), $(sql_lit "$(cat "$handoff_ref" 2>/dev/null || true)"), 'hermes-launcher'); UPDATE hermes_task SET status = 'INTERRUPTED_NEEDS_CONTINUATION', result_summary = $(sql_lit "$summary"), last_updt_pnttm = CURRENT_DATETIME WHERE hermes_task_id = $(sql_lit "$task_id");" || true
    printf '\nHermes interrupted before verification closed.\n'
    printf 'Continuation handoff: %s\n' "$handoff_ref"
    if [ -n "$resume_id" ]; then
      printf 'Resume this session with: hermes --resume %s\n' "$resume_id"
    fi
  fi
  if [ "$HERMES_LIVE_WATCHDOG_ENABLE" = "1" ] && [ -x "$LIVE_WATCHDOG_SCRIPT" ] && [ -n "$task_id" ] && [ -f "$stdout_ref" ]; then
    timeout "${HERMES_WATCHDOG_TIMEOUT_SECONDS:-45}s" "$LIVE_WATCHDOG_SCRIPT" "$task_id" "$stdout_ref" "PROCESS_FINISHED" "Hermes single-query finished; inspect stdout for loop, failure, or success-without-evidence risk." >/dev/null 2>&1 || true
  fi
  if [ "$exit_code" -ne 0 ]; then
    run_agent_self_heal "$task_id" "$exit_code" "$stdout_ref" "$stderr_ref" "$@"
  fi
  record_cli_session_finish "$status" "$exit_code" "$task_id" "$stdout_ref" "$stderr_ref" "$summary" "$@"
  exit "$exit_code"
fi
