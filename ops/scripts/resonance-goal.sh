# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] resonance-goal.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
CUBRID_POD="${CUBRID_POD:-cubrid-carbonet-0}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"
GOAL_DIR="${GOAL_DIR:-$ROOT_DIR/var/ai-runtime/goals}"
GOAL_FILE="${GOAL_FILE:-$GOAL_DIR/current-goal.json}"
SQL_DIR="${SQL_DIR:-$GOAL_DIR/sql}"
mkdir -p "$SQL_DIR"

usage() {
  cat >&2 <<'EOF'
usage:
  resonance-goal.sh on "goal text"
  resonance-goal.sh set "goal text"
  resonance-goal.sh off
  resonance-goal.sh status
EOF
}

ACTION="${1:-status}"
shift || true
GOAL_TEXT="${*:-}"

DEFAULT_GOAL="Codex 5.5급 실행지능에 가깝게, 요청 의도/시스템 상태/이전 실행기록/검증 증거/다음 작업 추천을 결합해 Carbonet/Resonance 작업을 정확한 순서로 분해하고 실행 가능하게 만든다."

case "$ACTION" in
  on|set)
    if [ -z "${GOAL_TEXT// }" ]; then
      GOAL_TEXT="$DEFAULT_GOAL"
    fi
    ;;
  off|status|list)
    ;;
  *)
    usage
    exit 2
    ;;
esac

SQL_PATH="$SQL_DIR/resonance-goal-$ACTION.sql"

if [ "$ACTION" = "status" ] || [ "$ACTION" = "list" ]; then
  if [ -f "$GOAL_FILE" ]; then
    cat "$GOAL_FILE"
    printf '\n'
  else
    echo '{"active":false,"goal":"","message":"No active goal file yet."}'
  fi
  if kubectl -n "$NAMESPACE" get pod "$CUBRID_POD" >/dev/null 2>&1; then
    kubectl -n "$NAMESPACE" exec "$CUBRID_POD" -- bash -lc "csql -u '$DB_USER' -C '$DB_NAME' -c \"select hermes_task_id, task_type, status, substr(cast(user_request as varchar(1000)),1,200) as request_text from hermes_task where hermes_task_id='goal-codex55-active'; select pattern_key, pattern_type, active_yn, reuse_score from hermes_capability_pattern where pattern_key='codex55-grade-active-goal';\"" || true
  fi
  exit 0
fi

python3 - "$ACTION" "$GOAL_TEXT" "$GOAL_FILE" "$SQL_PATH" <<'PY'
import datetime
import json
import pathlib
import sys

action, goal_text, goal_file, sql_path = sys.argv[1:5]
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
active = action in {"on", "set"}
goal_path = pathlib.Path(goal_file)
goal_path.parent.mkdir(parents=True, exist_ok=True)

payload = {
    "active": active,
    "goal": goal_text if active else "",
    "mode": "codex55-grade",
    "ownerModel": "qwen3.6-40b-deck-opus-q4",
    "executor": "Codex + deterministic scripts",
    "updatedAt": now,
    "qualityBar": [
        "사용자 요청을 바로 실행하지 않고 의도, 대상, 위험, 검증을 먼저 분해한다.",
        "이전 Hermes 작업 기록과 장애 패턴을 컨텍스트에 포함한다.",
        "Kubernetes/DB/웹서비스 변경은 실행 증거를 DB와 로그에 남긴다.",
        "모델 판단은 계획과 검토에 쓰고, 실제 수정/배포는 결정론 스크립트와 Codex가 수행한다.",
        "작업 완료 후 다음 실행 가능한 추천 작업을 남긴다."
    ],
    "architecture": {
        "orchestrator": "Resonance Codex55-grade planner, future LangGraph-compatible state machine",
        "memory": "CUBRID hermes_* tables, file evidence, future Qdrant semantic memory",
        "tools": "Kubernetes scripts, deploy button endpoint, DB scripts, Playwright-ready browser checks",
        "observability": "Hermes workflow DB, runtime snapshots, future OpenTelemetry/Langfuse bridge"
    }
}
goal_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

def lit(value, limit=3900):
    text = "" if value is None else str(value)
    text = text.replace("\r", " ").replace("\n", " ").strip()
    return "'" + text[:limit].replace("'", "''") + "'"

summary = "Active /goal for Codex55-grade Resonance execution intelligence." if active else "Codex55-grade /goal paused."
task_status = "ACTIVE" if active else "PAUSED"
cap_active = "Y" if active else "N"
request_text = "/goal on " + goal_text if active else "/goal off"
snapshot_id = "snap-goal-codex55-" + datetime.datetime.now().strftime("%Y%m%d%H%M%S")
payload_json = json.dumps(payload, ensure_ascii=False)
sql = [
    "INSERT INTO hermes_task (hermes_task_id, project_id, trace_id, user_request, interpreted_intent, task_type, risk_level, status, owner_model, executor_type, target_route, target_module, target_db_name, plan_summary, result_summary, evidence_root, requested_by) "
    + "SELECT 'goal-codex55-active', 'carbonet', 'goal-codex55-active', "
    + f"{lit(request_text)}, {lit(goal_text)}, 'goal', 'MEDIUM', {lit(task_status)}, 'qwen3.6-40b-deck-opus-q4', 'GOAL_MEMORY', '', '/opt/Resonance', 'carbonet', {lit(summary)}, {lit(goal_text)}, {lit(str(goal_path))}, 'resonance-goal' "
    + "FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_task WHERE hermes_task_id='goal-codex55-active');",
    "UPDATE hermes_task SET user_request = "
    + f"{lit(request_text)}, interpreted_intent = {lit(goal_text)}, status = {lit(task_status)}, plan_summary = {lit(summary)}, result_summary = {lit(goal_text)}, evidence_root = {lit(str(goal_path))}, last_updt_pnttm = CURRENT_DATETIME "
    + "WHERE hermes_task_id='goal-codex55-active';",
    "INSERT INTO hermes_capability_pattern (hermes_pattern_id, project_id, pattern_key, pattern_type, trigger_summary, execution_order, verification_order, reuse_score, source_task_id, active_yn) "
    + "SELECT 'cap-codex55-active-goal', 'carbonet', 'codex55-grade-active-goal', 'ACTIVE_GOAL', "
    + f"{lit(goal_text)}, {lit(payload_json)}, {lit('resonance-codex55-grade-plan.sh must include current-goal.json and write verification evidence.')}, 1.0, 'goal-codex55-active', {lit(cap_active)} "
    + "FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_capability_pattern WHERE hermes_pattern_id='cap-codex55-active-goal');",
    "UPDATE hermes_capability_pattern SET trigger_summary = "
    + f"{lit(goal_text)}, execution_order = {lit(payload_json)}, active_yn = {lit(cap_active)}, reuse_score = 1.0, last_updt_pnttm = CURRENT_DATETIME "
    + "WHERE hermes_pattern_id='cap-codex55-active-goal';",
    "INSERT INTO hermes_runtime_snapshot (hermes_snapshot_id, hermes_task_id, snapshot_type, source_ref, summary, raw_payload, collected_by) VALUES ("
    + f"{lit(snapshot_id)}, 'goal-codex55-active', 'ACTIVE_GOAL', {lit(str(goal_path))}, {lit(summary)}, {lit(payload_json)}, 'resonance-goal');",
    "COMMIT;"
]
pathlib.Path(sql_path).write_text("\n".join(sql), encoding="utf-8")
print(goal_file)
print(sql_path)
PY

if kubectl -n "$NAMESPACE" get pod "$CUBRID_POD" >/dev/null 2>&1; then
  REMOTE_SQL="/tmp/$(basename "$SQL_PATH")"
  kubectl -n "$NAMESPACE" cp "$SQL_PATH" "$CUBRID_POD:$REMOTE_SQL" >/dev/null
  kubectl -n "$NAMESPACE" exec "$CUBRID_POD" -- bash -lc "csql -u '$DB_USER' -C '$DB_NAME' -i '$REMOTE_SQL'" >/dev/null
  echo "Goal state written to $GOAL_FILE and CUBRID hermes memory."
else
  echo "Goal state written to $GOAL_FILE. CUBRID pod is not reachable, DB reflection skipped." >&2
fi
