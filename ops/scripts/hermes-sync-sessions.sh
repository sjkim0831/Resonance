# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] hermes-sync-sessions.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
HERMES_HOME="${HERMES_HOME:-/home/sjkim/.hermes}"
SESSION_DIR="${SESSION_DIR:-$HERMES_HOME/sessions}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-runtime/hermes-session-sync}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
CUBRID_POD="${CUBRID_POD:-cubrid-carbonet-0}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"
mkdir -p "$OUT_DIR/sql"

python3 - "$SESSION_DIR" "$OUT_DIR" "$ROOT_DIR" <<'PY'
import hashlib
import json
import pathlib
import sys
import datetime

session_dir = pathlib.Path(sys.argv[1])
out_dir = pathlib.Path(sys.argv[2])
root_dir = pathlib.Path(sys.argv[3])
sql_dir = out_dir / "sql"
sql_dir.mkdir(parents=True, exist_ok=True)
sql_path = sql_dir / "hermes-session-sync.sql"
goal_file = root_dir / "var" / "ai-runtime" / "goals" / "current-goal.json"

def lit(value, limit=3900):
    text = "" if value is None else str(value)
    text = text.replace("\r", " ").replace("\n", " ").strip()
    return "'" + text[:limit].replace("'", "''") + "'"

def role_text(message):
    role = message.get("role") or "unknown"
    content = message.get("content")
    if content:
        return f"{role}: {content}"
    tool_calls = message.get("tool_calls") or []
    if tool_calls:
        names = []
        for call in tool_calls:
            fn = (call.get("function") or {}).get("name") or call.get("name") or "tool"
            names.append(fn)
        return f"{role}: tool_calls=" + ",".join(names)
    return f"{role}:"

def first_user(messages):
    for message in messages:
        if message.get("role") == "user" and message.get("content"):
            return str(message.get("content"))
    return ""

def last_assistant(messages):
    for message in reversed(messages):
        if message.get("role") == "assistant" and message.get("content"):
            return str(message.get("content"))
    return ""

def extract_goal(messages):
    for message in reversed(messages):
        if message.get("role") != "user" or not message.get("content"):
            continue
        content = str(message.get("content")).strip()
        if not content.startswith("/goal"):
            continue
        goal = content[5:].strip()
        if goal.lower().startswith("on "):
            goal = goal[3:].strip()
        if goal.lower().startswith("set "):
            goal = goal[4:].strip()
        if not goal or goal.lower() in {"on", "켜", "켜줘"}:
            goal = "Codex 5.5급 실행지능에 가깝게, 요청 의도/시스템 상태/이전 실행기록/검증 증거/다음 작업 추천을 결합해 Carbonet/Resonance 작업을 정확한 순서로 분해하고 실행 가능하게 만든다."
        if goal.lower() in {"off", "끄기", "꺼", "꺼줘"}:
            return {"active": False, "goal": "", "source": content}
        return {"active": True, "goal": goal, "source": content}
    return None

statements = []
count = 0
latest_goal = None
for path in sorted(session_dir.glob("session_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:300]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        continue
    session_id = data.get("session_id") or path.stem.replace("session_", "")
    task_id = "hermes-native-" + session_id
    messages = data.get("messages") or []
    if latest_goal is None:
        latest_goal = extract_goal(messages)
    title = data.get("title") or first_user(messages)[:80] or "Hermes native session"
    request = first_user(messages) or title
    response = last_assistant(messages)
    model = data.get("model") or "hermes"
    last_updated = data.get("last_updated") or data.get("session_start") or ""
    message_count = len(messages)
    transcript_tail = "\n".join(role_text(m) for m in messages[-12:])
    digest = hashlib.sha1((str(path) + last_updated + str(message_count) + transcript_tail).encode("utf-8")).hexdigest()[:16]
    snapshot_id = f"snap-{session_id}-{digest}"

    statements.append(
        "INSERT INTO hermes_task (hermes_task_id, project_id, trace_id, user_request, interpreted_intent, task_type, risk_level, status, owner_model, executor_type, target_route, target_module, target_db_name, plan_summary, result_summary, evidence_root, requested_by) "
        f"SELECT {lit(task_id, 80)}, 'carbonet', {lit('native-' + session_id, 80)}, {lit(request)}, {lit(title)}, 'hermes-native', 'LOW', 'COMPLETED', {lit(model, 120)}, 'HERMES_NATIVE_SESSION', '', '', 'carbonet', {lit('Hermes native session imported from ~/.hermes/sessions. Use runtime snapshots for the conversation tail.')}, {lit(response)}, {lit(str(path), 1000)}, 'hermes' "
        f"FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_task WHERE hermes_task_id = {lit(task_id, 80)});"
    )
    statements.append(
        "UPDATE hermes_task SET user_request = "
        f"{lit(request)}, interpreted_intent = {lit(title)}, status = 'COMPLETED', owner_model = {lit(model, 120)}, "
        f"result_summary = {lit(response)}, evidence_root = {lit(str(path), 1000)}, last_updt_pnttm = CURRENT_DATETIME "
        f"WHERE hermes_task_id = {lit(task_id, 80)};"
    )
    statements.append(
        "INSERT INTO hermes_cli_session (hermes_session_id, hermes_task_id, project_id, workspace_path, command_line, mode, status, transcript_ref, stdout_ref, exit_code, summary) "
        f"SELECT {lit('native-' + session_id, 80)}, {lit(task_id, 80)}, 'carbonet', {lit('/opt/Resonance', 1000)}, {lit('hermes native interactive session')}, 'NATIVE_SESSION', 'COMPLETED', {lit(str(path), 1000)}, {lit(str(path), 1000)}, 0, {lit('Imported from Hermes built-in session persistence.')} "
        f"FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_cli_session WHERE hermes_session_id = {lit('native-' + session_id, 80)});"
    )
    statements.append(
        "UPDATE hermes_cli_session SET status = 'COMPLETED', stdout_ref = "
        f"{lit(str(path), 1000)}, transcript_ref = {lit(str(path), 1000)}, summary = {lit('Imported from Hermes built-in session persistence.')}, last_updt_pnttm = CURRENT_DATETIME "
        f"WHERE hermes_session_id = {lit('native-' + session_id, 80)};"
    )
    statements.append(
        "INSERT INTO hermes_runtime_snapshot (hermes_snapshot_id, hermes_task_id, snapshot_type, source_ref, summary, raw_payload, collected_by) "
        f"SELECT {lit(snapshot_id, 80)}, {lit(task_id, 80)}, 'HERMES_NATIVE_SESSION_TAIL', {lit(str(path), 1000)}, {lit(f'{message_count} messages, last_updated={last_updated}')}, {lit(transcript_tail)}, 'hermes-session-sync' "
        f"FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_runtime_snapshot WHERE hermes_snapshot_id = {lit(snapshot_id, 80)});"
    )
    count += 1

if latest_goal is not None:
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    active = bool(latest_goal.get("active"))
    goal_text = latest_goal.get("goal") or ""
    payload = {
        "active": active,
        "goal": goal_text,
        "mode": "codex55-grade",
        "ownerModel": "qwen3.6-40b-deck-opus-q4",
        "executor": "Codex + deterministic scripts",
        "updatedAt": now,
        "source": "Hermes native /goal command",
        "qualityBar": [
            "Hermes 요청은 세션 동기화로 DB에 남기고, 실행 계획은 resonance-codex55-grade-plan.sh가 분해한다.",
            "배포/DB/K8s 작업은 모델 응답이 아니라 결정론 스크립트와 검증 로그로 완료 판정한다.",
            "작업 뒤에는 다음 추천 작업과 재사용 가능한 장애 패턴을 남긴다."
        ],
    }
    goal_file.parent.mkdir(parents=True, exist_ok=True)
    goal_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    status = "ACTIVE" if active else "PAUSED"
    active_yn = "Y" if active else "N"
    request_text = latest_goal.get("source") or ("/goal on " + goal_text if active else "/goal off")
    payload_json = json.dumps(payload, ensure_ascii=False)
    snapshot_id = "snap-goal-hermes-" + hashlib.sha1((now + request_text).encode("utf-8")).hexdigest()[:16]
    statements.append(
        "INSERT INTO hermes_task (hermes_task_id, project_id, trace_id, user_request, interpreted_intent, task_type, risk_level, status, owner_model, executor_type, target_route, target_module, target_db_name, plan_summary, result_summary, evidence_root, requested_by) "
        f"SELECT 'goal-codex55-active', 'carbonet', 'goal-codex55-active', {lit(request_text)}, {lit(goal_text)}, 'goal', 'MEDIUM', {lit(status)}, 'qwen3.6-40b-deck-opus-q4', 'GOAL_MEMORY', '', '/opt/Resonance', 'carbonet', 'Hermes /goal command imported as active execution objective.', {lit(goal_text)}, {lit(str(goal_file), 1000)}, 'hermes-session-sync' "
        "FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_task WHERE hermes_task_id='goal-codex55-active');"
    )
    statements.append(
        "UPDATE hermes_task SET user_request = "
        f"{lit(request_text)}, interpreted_intent = {lit(goal_text)}, status = {lit(status)}, result_summary = {lit(goal_text)}, evidence_root = {lit(str(goal_file), 1000)}, last_updt_pnttm = CURRENT_DATETIME "
        "WHERE hermes_task_id='goal-codex55-active';"
    )
    statements.append(
        "INSERT INTO hermes_capability_pattern (hermes_pattern_id, project_id, pattern_key, pattern_type, trigger_summary, execution_order, verification_order, reuse_score, source_task_id, active_yn) "
        f"SELECT 'cap-codex55-active-goal', 'carbonet', 'codex55-grade-active-goal', 'ACTIVE_GOAL', {lit(goal_text)}, {lit(payload_json)}, 'codex55 planner includes current-goal.json in context.', 1.0, 'goal-codex55-active', {lit(active_yn)} "
        "FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_capability_pattern WHERE hermes_pattern_id='cap-codex55-active-goal');"
    )
    statements.append(
        "UPDATE hermes_capability_pattern SET trigger_summary = "
        f"{lit(goal_text)}, execution_order = {lit(payload_json)}, active_yn = {lit(active_yn)}, last_updt_pnttm = CURRENT_DATETIME "
        "WHERE hermes_pattern_id='cap-codex55-active-goal';"
    )
    statements.append(
        "INSERT INTO hermes_runtime_snapshot (hermes_snapshot_id, hermes_task_id, snapshot_type, source_ref, summary, raw_payload, collected_by) "
        f"SELECT {lit(snapshot_id, 80)}, 'goal-codex55-active', 'HERMES_GOAL_COMMAND', {lit(str(goal_file), 1000)}, 'Hermes /goal command synchronized into active goal memory.', {lit(payload_json)}, 'hermes-session-sync' "
        f"FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_runtime_snapshot WHERE hermes_snapshot_id = {lit(snapshot_id, 80)});"
    )

statements.append("COMMIT;")
sql_path.write_text("\n".join(statements), encoding="utf-8")
print(sql_path)
print(count)
PY

SQL_PATH="$(sed -n '1p' "$OUT_DIR/sql/hermes-session-sync.sql" 2>/dev/null || true)"
SQL_PATH="$OUT_DIR/sql/hermes-session-sync.sql"
REMOTE_SQL="/tmp/hermes-session-sync.sql"
kubectl -n "$NAMESPACE" cp "$SQL_PATH" "$CUBRID_POD:$REMOTE_SQL" >/dev/null
kubectl -n "$NAMESPACE" exec "$CUBRID_POD" -- bash -lc "csql -u '$DB_USER' '$DB_NAME' -i '$REMOTE_SQL'" >/dev/null
date -Is > "$OUT_DIR/last-sync.txt"
echo "Hermes native sessions synced from $SESSION_DIR"

LEARNING_EXPORTER="${LEARNING_EXPORTER:-$ROOT_DIR/ops/scripts/hermes-session-learning-export.sh}"
if [ -x "$LEARNING_EXPORTER" ]; then
  LEARNING_LOG_DIR="${LEARNING_LOG_DIR:-$ROOT_DIR/var/ai-runtime/hermes-learning}"
  mkdir -p "$LEARNING_LOG_DIR"
  "$LEARNING_EXPORTER" export >"$LEARNING_LOG_DIR/last-export.log" 2>&1 || {
    code=$?
    cat "$LEARNING_LOG_DIR/last-export.log" >&2 || true
    echo "WARN: Hermes learning export failed with exit code $code" >&2
  }
fi
