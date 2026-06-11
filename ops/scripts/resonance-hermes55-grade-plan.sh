#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MODEL_BASE_URL="${MODEL_BASE_URL:-http://127.0.0.1:24036/v1}"
MODEL_API_KEY="${MODEL_API_KEY:-qwer1234}"
MODEL_NAME="${MODEL_NAME:-qwen3.6-40b-deck-opus-q4}"
MODEL_TIMEOUT_SECONDS="${MODEL_TIMEOUT_SECONDS:-420}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
CUBRID_POD="${CUBRID_POD:-cubrid-carbonet-0}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-runtime/hermes55-grade}"
TEAM_FILE="${TEAM_FILE:-$ROOT_DIR/var/ai-agent-teams/ai-agent-teams.json}"
GOAL_FILE="${GOAL_FILE:-$ROOT_DIR/var/ai-runtime/goals/current-goal.json}"
mkdir -p "$OUT_DIR/sql"

log() {
  printf '[hermes55-grade] %s\n' "$*" >&2
}

REQUEST_TEXT="${*:-}"
if [ -z "$REQUEST_TEXT" ]; then
  REQUEST_TEXT="$(cat)"
fi
if [ -z "${REQUEST_TEXT// }" ]; then
  echo "usage: $0 \"request text\"" >&2
  exit 2
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
TASK_ID="hermes55-$STAMP-$$"
TRACE_ID="trace-hermes55-$STAMP-$$"
FINGERPRINT="$(printf '%s' "$REQUEST_TEXT" | sha1sum | awk '{print $1}')"
CONTEXT_JSON="$OUT_DIR/$TASK_ID.context.json"
PLAN_JSON="$OUT_DIR/$TASK_ID.plan.json"
EVENT_JSONL="$OUT_DIR/hermes55-grade-events.jsonl"

FAST_PLAN_MODE=0
REQUEST_COMPACT="$(printf '%s' "$REQUEST_TEXT" | tr -d '[:space:]')"
case "${REQUEST_COMPACT,,}" in
  "하이"|"안녕"|"안녕하세요"|"hi"|"hello"|"test"|"테스트")
    FAST_PLAN_MODE=1
    ;;
esac

log "task=$TASK_ID"
log "context=$CONTEXT_JSON"
log "plan=$PLAN_JSON"

if [ "$FAST_PLAN_MODE" != "1" ] && ! curl --max-time 8 -fsS -H "Authorization: Bearer $MODEL_API_KEY" "$MODEL_BASE_URL/models" >/dev/null; then
  echo "Qwen40 endpoint is not ready: $MODEL_BASE_URL" >&2
  exit 1
fi

log "collecting bounded system/runtime/history context"
python3 - "$ROOT_DIR" "$TEAM_FILE" "$GOAL_FILE" "$REQUEST_TEXT" "$FINGERPRINT" "$CONTEXT_JSON" "$NAMESPACE" "$CUBRID_POD" "$DB_NAME" "$DB_USER" <<'PY'
import json
import os
import pathlib
import subprocess
import sys

root, team_file, goal_file, request_text, fingerprint, context_json, namespace, pod, db_name, db_user = sys.argv[1:11]
root_path = pathlib.Path(root)

def run(cmd, cwd=root, timeout=20):
    try:
        result = subprocess.run(cmd, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)
        return result.stdout[-6000:]
    except Exception as exc:
        return f"ERROR: {exc}"

def csql(sql):
    escaped = sql.replace('"', '\\"')
    return run(["kubectl", "-n", namespace, "exec", pod, "--", "bash", "-lc", f'csql -u {db_user} -C {db_name} -c "{escaped}"'], timeout=30)

def read(path, limit=5000):
    try:
        return pathlib.Path(path).read_text(encoding="utf-8", errors="ignore")[:limit]
    except Exception:
        return ""

file_hits = run(["bash", "-lc", "printf '%s\n' frontend/src modules ops/scripts docs | xargs -r rg --files 2>/dev/null | head -400"], timeout=10)
keyword = " ".join([w for w in request_text.replace("/", " ").replace("-", " ").split() if len(w) >= 3][:8])
rg_hits = ""
if keyword:
    rg_hits = run(["bash", "-lc", f"rg -n -i --glob '!node_modules' --glob '!target' --glob '!dist' {json.dumps(keyword)} frontend/src modules ops docs 2>/dev/null | head -120"], timeout=12)

context = {
    "request": request_text,
    "fingerprint": fingerprint,
    "activeGoal": read(goal_file, 6000),
    "system": {
        "root": root,
        "pwd": os.getcwd(),
        "git": run(["bash", "-lc", "git rev-parse --abbrev-ref HEAD 2>/dev/null; git status --short | head -80"], timeout=8),
        "keyScripts": run(["bash", "-lc", "find ops/scripts -maxdepth 1 -type f | sort | grep -E 'resonance|build|deploy|verify|hermes|doctor|up' | sed -n '1,120p'"], timeout=8),
    },
    "runtime": {
        "pods": run(["kubectl", "-n", namespace, "get", "pods", "-o", "wide"], timeout=20),
        "deployments": run(["kubectl", "-n", namespace, "get", "deploy,svc"], timeout=20),
        "health80": run(["bash", "-lc", "curl -fsS --max-time 5 http://127.0.0.1/actuator/health 2>&1 || true"], timeout=8),
        "health32947": run(["bash", "-lc", "curl -fsS --max-time 5 http://127.0.0.1:32947/actuator/health 2>&1 || true"], timeout=8),
    },
    "previousWork": {
        "recentTasks": csql("select hermes_task_id, task_type, status, substr(cast(user_request as varchar(1000)),1,180) as req from hermes_task order by last_updt_pnttm desc limit 12;"),
        "recentRecommendations": csql("select hermes_recommendation_id, title, status from hermes_next_action_recommendation order by frst_regist_pnttm desc limit 10;"),
        "failurePatterns": csql("select pattern_key, failure_type, hit_count from hermes_failure_pattern where active_yn='Y' order by last_updt_pnttm desc limit 10;"),
    },
    "codebase": {
        "candidateFiles": file_hits,
        "searchHits": rg_hits,
        "projectDocs": read(root_path / "docs/ai/60-operations/dev-orchestration/qwen40-first-development-orchestration.md", 5000),
        "agentArchitectureDocs": read(root_path / "docs/ai/60-operations/dev-orchestration/hermes55-grade-agent-architecture.md", 5000),
    },
    "agentTeams": read(team_file, 12000),
}
pathlib.Path(context_json).write_text(json.dumps(context, ensure_ascii=False, indent=2), encoding="utf-8")
print(context_json)
PY

if [ "$FAST_PLAN_MODE" = "1" ]; then
  log "lightweight greeting/test request detected; using deterministic fast plan"
  python3 - "$REQUEST_TEXT" "$CONTEXT_JSON" "$PLAN_JSON" <<'PY'
import json
import pathlib
import sys

request_text, context_json, plan_json = sys.argv[1:4]
context = json.loads(pathlib.Path(context_json).read_text(encoding="utf-8"))
active_goal = context.get("activeGoal") or ""
plan = {
    "taskType": "general",
    "riskLevel": "LOW",
    "interpretedIntent": "Hermes/Hermes55 실행지능 경로가 응답 가능한지 확인하는 짧은 인사 또는 테스트 요청입니다.",
    "inferredMissingDetails": ["구체적인 수정 대상, 경로, 검증 조건은 아직 주어지지 않았습니다."],
    "affectedSurfaces": ["ai", "logs"],
    "targetRoute": "",
    "targetModule": "Hermes/Hermes55-grade planner",
    "planSummary": "40B 모델 호출 없이 빠르게 세션 기록과 다음 요청 대기 상태를 남깁니다.",
    "orderedSteps": [
        {
            "stageCode": "SESSION_RECORD",
            "title": "요청 기록",
            "ownerRole": "deterministic-script",
            "target": "hermes_task/hermes_context_pack",
            "action": "짧은 요청을 실행 기록으로 저장하고 현재 /goal 상태를 컨텍스트에 연결합니다.",
            "evidence": context_json,
            "risk": "LOW",
            "stopCondition": "DB 기록 실패"
        },
        {
            "stageCode": "NEXT_REQUEST",
            "title": "구체 작업 대기",
            "ownerRole": "Hermes",
            "target": "/opt/Resonance",
            "action": "다음 사용자 요청에서 대상 경로, 화면, 배포, 로그 개선 여부를 분해합니다.",
            "evidence": active_goal[:600],
            "risk": "LOW",
            "stopCondition": "사용자 요청 부재"
        }
    ],
    "verificationPlan": [
        {
            "type": "log",
            "command": "bash ops/scripts/hermes-sync-sessions.sh",
            "expected": "Hermes native session and lightweight planner task are visible in Hermes 작업 기억."
        }
    ],
    "nextRecommendations": [
        {
            "title": "구체 작업 요청 입력",
            "type": "FOLLOW_UP",
            "rationale": "짧은 인사는 수정/배포 대상이 없으므로 다음 요청에서 대상과 성공조건을 받아야 정확도가 올라갑니다.",
            "command": "bash ops/scripts/resonance-hermes55-grade-plan.sh \"수정할 기능과 검증 URL\"",
            "targetRoute": "",
            "targetModule": "Hermes/Hermes55-grade planner",
            "expectedEvidence": "orderedSteps와 verificationPlan이 생성됨",
            "riskLevel": "LOW"
        }
    ],
    "smallModelSupport": ["세션 요약", "로그 분류"],
    "qualityBar": ["실행하지 않은 작업을 완료로 말하지 않기", "다음 실행 증거를 DB에 남기기"]
}
pathlib.Path(plan_json).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
print(plan_json)
PY
else
  log "calling Qwen40 planner at $MODEL_BASE_URL model=$MODEL_NAME timeout=${MODEL_TIMEOUT_SECONDS}s"
  python3 - "$MODEL_BASE_URL" "$MODEL_API_KEY" "$MODEL_NAME" "$MODEL_TIMEOUT_SECONDS" "$REQUEST_TEXT" "$CONTEXT_JSON" "$PLAN_JSON" <<'PY'
import json
import pathlib
import sys
import urllib.request

base_url, api_key, model, timeout_seconds, request_text, context_json, plan_json = sys.argv[1:8]
timeout_seconds = int(timeout_seconds)
context = pathlib.Path(context_json).read_text(encoding="utf-8")[:28000]
system = """You are the Hermes-5.5-grade execution intelligence layer for Carbonet/Resonance.
Use Korean. Return strict JSON only.
Your job is not to hallucinate execution. Your job is to infer the user's real target from request + system context + previous work, then produce a high-precision execution plan for Hermes/scripts.
Qwen40 is the single primary planner/judge. Small models are checklist/support only.
Always separate: user_intent, inferred_missing_details, affected_surfaces, ordered_steps, verification, next_recommendations, risk_gates.
Prefer deterministic evidence over model confidence. Do not claim changes were made.
If a command/script exists in context, you may recommend it exactly. If not, write TODO_COMMAND.
Every step must include ownerRole, target, action, evidence, risk, and stopCondition.
Respect activeGoal if present. Treat it as the persistent operating objective, not as a replacement for the user's immediate request."""
user = f"""요청:
{request_text}

시스템/과거작업/코드/런타임 컨텍스트:
{context}

Return JSON schema:
{{
  "taskType": "frontend|backend|database|scripts|kubernetes|ai|deploy|logs|general",
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "interpretedIntent": "...",
  "inferredMissingDetails": ["..."],
  "affectedSurfaces": ["frontend","backend","database","scripts","kubernetes","docs"],
  "targetRoute": "",
  "targetModule": "",
  "planSummary": "...",
  "orderedSteps": [
    {{"stageCode":"PRECHECK","title":"...","ownerRole":"...","target":"...","action":"...","evidence":"...","risk":"...","stopCondition":"..."}}
  ],
  "verificationPlan": [
    {{"type":"build|runtime|route|db|log","command":"...","expected":"..."}}
  ],
  "nextRecommendations": [
    {{"title":"...","type":"NEXT_ACTION|FOLLOW_UP|AUTOMATION|RISK_REDUCTION","rationale":"...","command":"...","targetRoute":"","targetModule":"","expectedEvidence":"...","riskLevel":"LOW|MEDIUM|HIGH"}}
  ],
  "smallModelSupport": ["..."],
  "qualityBar": ["..."]
}}"""
payload = {
    "model": model,
    "temperature": 0,
    "max_tokens": 8192,
    "messages": [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ],
}
req = urllib.request.Request(
    base_url.rstrip("/") + "/chat/completions",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=timeout_seconds) as res:
    data = json.loads(res.read().decode("utf-8"))
content = data["choices"][0]["message"]["content"]
start = content.find("{")
end = content.rfind("}")
if start < 0 or end < start:
    raise SystemExit(content)
parsed = json.loads(content[start:end + 1])
pathlib.Path(plan_json).write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
print(plan_json)
PY
fi

log "writing plan evidence to CUBRID"
python3 - "$TASK_ID" "$TRACE_ID" "$FINGERPRINT" "$REQUEST_TEXT" "$CONTEXT_JSON" "$PLAN_JSON" "$OUT_DIR" "$NAMESPACE" "$CUBRID_POD" "$DB_NAME" "$DB_USER" "$EVENT_JSONL" <<'PY'
import datetime
import json
import pathlib
import subprocess
import sys

task_id, trace_id, fingerprint, request_text, context_json, plan_json, out_dir, namespace, pod, db_name, db_user, event_jsonl = sys.argv[1:13]
plan = json.loads(pathlib.Path(plan_json).read_text(encoding="utf-8"))
context = json.loads(pathlib.Path(context_json).read_text(encoding="utf-8"))

def lit(value, limit=3900):
    text = "" if value is None else str(value)
    text = text.replace("\r", " ").replace("\n", " ").strip()
    return "'" + text[:limit].replace("'", "''") + "'"

def dump(value, limit=3900):
    return lit(json.dumps(value, ensure_ascii=False), limit)

def run(cmd):
    result = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
    if result.returncode != 0:
        raise SystemExit(result.stdout)
    return result.stdout

steps = plan.get("orderedSteps") or []
recommendations = plan.get("nextRecommendations") or []
verification = plan.get("verificationPlan") or []
sql = []
sql.append(
    "INSERT INTO hermes_task (hermes_task_id, project_id, trace_id, user_request, interpreted_intent, task_type, risk_level, status, owner_model, executor_type, target_route, target_module, target_db_name, plan_summary, evidence_root, requested_by) VALUES ("
    + ", ".join([
        lit(task_id, 80), "'carbonet'", lit(trace_id, 80), lit(request_text), lit(plan.get("interpretedIntent")),
        lit(plan.get("taskType") or "general", 80), lit(plan.get("riskLevel") or "MEDIUM", 30), "'READY_FOR_HERMES'",
        "'qwen3.6-40b-deck-opus-q4'", "'HERMES_55_GRADE_PLAN'", lit(plan.get("targetRoute"), 500),
        lit(plan.get("targetModule"), 500), "'carbonet'", lit(plan.get("planSummary"), 3900), lit(plan_json, 1000), "'resonance-hermes55-grade'"
    ])
    + ");"
)
sql.append(
    "INSERT INTO hermes_context_pack (hermes_context_pack_id, hermes_task_id, project_id, request_fingerprint, system_context, previous_work_context, codebase_context, runtime_context, agent_team_context, risk_context, evidence_ref) VALUES ("
    + ", ".join([
        lit("ctx-" + task_id, 80), lit(task_id, 80), "'carbonet'", lit(fingerprint, 80),
        dump(context.get("system")), dump(context.get("previousWork")), dump(context.get("codebase")),
        dump(context.get("runtime")), lit(context.get("agentTeams"), 3900),
        dump({"riskLevel": plan.get("riskLevel"), "riskGates": plan.get("riskGates"), "qualityBar": plan.get("qualityBar"), "activeGoal": context.get("activeGoal")}),
        lit(context_json, 1000),
    ])
    + ");"
)
sql.append(
    "INSERT INTO hermes_command_interpretation (interpretation_id, hermes_task_id, raw_command, normalized_command, intent_json, ordered_stage_json, target_hint_json, risk_gate_json, model_name, confidence_score, status) VALUES ("
    + ", ".join([
        lit("interp-" + task_id, 80), lit(task_id, 80), lit(request_text), lit(plan.get("interpretedIntent")),
        dump(plan), dump(steps), dump({"targetRoute": plan.get("targetRoute"), "targetModule": plan.get("targetModule"), "affectedSurfaces": plan.get("affectedSurfaces")}),
        dump({"riskLevel": plan.get("riskLevel"), "qualityBar": plan.get("qualityBar")}), "'qwen3.6-40b-deck-opus-q4'", "0.86", "'READY'"
    ])
    + ");"
)
for idx, step in enumerate(steps, start=1):
    sql.append(
        "INSERT INTO hermes_task_step (hermes_step_id, hermes_task_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor, model_role, status) VALUES ("
        + ", ".join([
            lit(f"step-{task_id}-{idx:02d}", 80), lit(task_id, 80), str(idx * 10),
            lit(step.get("stageCode") or "STEP", 80), lit(step.get("title") or step.get("action") or "Step", 200),
            dump(step), lit(step.get("evidence"), 3900), lit(step.get("ownerRole") or "HERMES", 80), "'QWEN40_PRIMARY_PLANNER'", "'PENDING'"
        ])
        + ");"
    )
for idx, item in enumerate(verification, start=1):
    sql.append(
        "INSERT INTO hermes_verification_log (hermes_verification_id, hermes_task_id, verification_type, command_text, status, passed_yn, result_summary, verified_by) VALUES ("
        + ", ".join([
            lit(f"verify-{task_id}-{idx:02d}", 80), lit(task_id, 80), lit(item.get("type") or "verification", 80),
            lit(item.get("command"), 3900), "'PLANNED'", "'N'", lit(item.get("expected"), 3900), "'qwen40-plan'"
        ])
        + ");"
    )
for idx, rec in enumerate(recommendations, start=1):
    sql.append(
        "INSERT INTO hermes_next_action_recommendation (hermes_recommendation_id, hermes_task_id, recommendation_order, recommendation_type, title, rationale, command_text, target_route, target_module, expected_evidence, risk_level, status) VALUES ("
        + ", ".join([
            lit(f"rec-{task_id}-{idx:02d}", 80), lit(task_id, 80), str(idx * 10),
            lit(rec.get("type") or "NEXT_ACTION", 80), lit(rec.get("title") or "Next action", 300),
            lit(rec.get("rationale"), 3900), lit(rec.get("command"), 3900), lit(rec.get("targetRoute"), 500),
            lit(rec.get("targetModule"), 500), lit(rec.get("expectedEvidence"), 3900),
            lit(rec.get("riskLevel") or "MEDIUM", 30), "'READY'"
        ])
        + ");"
    )
sql.append(
    "INSERT INTO hermes_model_decision (hermes_decision_id, hermes_task_id, decision_stage, selected_model, fallback_model, decision_reason, confidence_score, accepted_yn, evidence_ref) VALUES ("
    + ", ".join([
        lit("decision-" + task_id, 80), lit(task_id, 80), "'HERMES55_GRADE_PLAN'", "'qwen3.6-40b-deck-opus-q4'",
        "'hermes-5.5'", lit("40B 단일 모델을 Hermes급 실행지능 레이어로 사용하되, 실행은 Hermes/결정론 스크립트가 수행하도록 분리합니다."),
        "0.86", "'Y'", lit(plan_json, 1000)
    ])
    + ");"
)
sql.append("COMMIT;")
sql_path = pathlib.Path(out_dir) / "sql" / f"{task_id}.sql"
sql_path.write_text("\n".join(sql), encoding="utf-8")
remote_sql = f"/tmp/{task_id}.sql"
run(["kubectl", "-n", namespace, "cp", str(sql_path), f"{pod}:{remote_sql}"])
run(["kubectl", "-n", namespace, "exec", pod, "--", "bash", "-lc", f"csql -u {db_user!r} -C {db_name!r} -i {remote_sql}"])

event = {
    "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "script": "resonance-hermes55-grade-plan",
    "taskId": task_id,
    "status": "READY_FOR_HERMES",
    "planPath": plan_json,
    "contextPath": context_json,
    "stepCount": len(steps),
    "recommendationCount": len(recommendations),
}
with pathlib.Path(event_jsonl).open("a", encoding="utf-8") as handle:
    handle.write(json.dumps(event, ensure_ascii=False) + "\n")
print(json.dumps(event, ensure_ascii=False))
PY
