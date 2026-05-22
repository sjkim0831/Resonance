#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SEED_JSON="${SEED_JSON:-$ROOT_DIR/ops/hermes/development-patterns.seed.json}"
DEFAULT_TEAM_FILE="/opt/Resonance/var/ai-agent-teams/ai-agent-teams.json"
if [ ! -f "$DEFAULT_TEAM_FILE" ]; then
  DEFAULT_TEAM_FILE="$ROOT_DIR/var/ai-agent-teams/ai-agent-teams.json"
fi
TEAM_FILE="${TEAM_FILE:-$DEFAULT_TEAM_FILE}"
OUT_JSON=""
PLAN_JSON=""
REQUEST_TEXT=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --request)
      REQUEST_TEXT="${2:-}"
      shift 2
      ;;
    --plan)
      PLAN_JSON="${2:-}"
      shift 2
      ;;
    --out)
      OUT_JSON="${2:-}"
      shift 2
      ;;
    --seed)
      SEED_JSON="${2:-}"
      shift 2
      ;;
    --team-file)
      TEAM_FILE="${2:-}"
      shift 2
      ;;
    *)
      REQUEST_TEXT="${REQUEST_TEXT} ${1}"
      shift
      ;;
  esac
done

if [ -z "${REQUEST_TEXT// }" ]; then
  REQUEST_TEXT="$(cat)"
fi
if [ -z "${REQUEST_TEXT// }" ]; then
  echo "usage: $0 --request \"요청 내용\" [--plan interpretation.json] [--out resolution.json]" >&2
  exit 2
fi

python3 - "$SEED_JSON" "$TEAM_FILE" "$PLAN_JSON" "$REQUEST_TEXT" "$OUT_JSON" <<'PY'
import json
import pathlib
import re
import sys

seed_path, team_file, plan_path, request_text, out_path = sys.argv[1:6]
seed = json.loads(pathlib.Path(seed_path).read_text(encoding="utf-8"))
team_registry = {}
team_source = ""
team_path = pathlib.Path(team_file)
if team_path.exists():
    team_source = str(team_path)
    raw_teams = json.loads(team_path.read_text(encoding="utf-8"))
    team_registry = {team.get("id"): team for team in raw_teams.get("teams", []) if team.get("id")}
plan = {}
if plan_path:
    candidate = pathlib.Path(plan_path)
    if candidate.exists():
        plan = json.loads(candidate.read_text(encoding="utf-8"))

def tokens(value):
    text = str(value or "").lower()
    return [item for item in re.split(r"[^0-9a-zA-Z가-힣_./:-]+", text) if item]

request_tokens = set(tokens(request_text))
plan_text = json.dumps(plan, ensure_ascii=False)
target_route = str(plan.get("targetRoute") or "")
target_module = str(plan.get("targetModule") or "")
task_type = str(plan.get("taskType") or "")
request_lower = request_text.lower()
plan_lower = plan_text.lower()
haystack = f"{request_text}\n{plan_text}".lower()

def score_pattern(pattern):
    score = 0.0
    reasons = []
    for keyword in pattern.get("triggerKeywords", []):
        lowered = str(keyword).lower()
        if lowered and lowered in request_lower:
            score += 3.0
            reasons.append(f"keyword:{keyword}")
        elif lowered in request_tokens:
            score += 2.0
            reasons.append(f"token:{keyword}")
        elif lowered and lowered in plan_lower:
            score += 0.5
            reasons.append(f"plan-keyword:{keyword}")
    for hint in pattern.get("routeHints", []):
        lowered = str(hint).lower()
        if lowered and (lowered in target_route.lower() or lowered in haystack):
            score += 2.5
            reasons.append(f"route:{hint}")
    for hint in pattern.get("moduleHints", []):
        lowered = str(hint).lower()
        if lowered and (lowered in target_module.lower() or lowered in haystack):
            score += 1.5
            reasons.append(f"module:{hint}")
    if task_type and str(pattern.get("categoryCode", "")).lower() in task_type.lower():
        score += 1.0
        reasons.append(f"category:{pattern.get('categoryCode')}")
    if pattern.get("categoryCode") == "FULLSTACK":
        has_front = any(item in haystack for item in ["화면", "프론트", "frontend", "/admin/"])
        has_back = any(item in haystack for item in ["api", "백엔드", "backend", "컨트롤러", "서비스"])
        has_db = any(item in haystack for item in ["db", "디비", "테이블", "컬럼", "sql", "스키마"])
        if has_front and has_back and has_db:
            score += 4.0
            reasons.append("compound:frontend+backend+db")
    return score, reasons

def team_summary(team_id):
    team = team_registry.get(team_id) or {}
    return {
        "teamId": team_id,
        "name": team.get("name") or team_id,
        "scope": team.get("scope") or "",
        "serviceName": team.get("serviceName") or "",
        "defaultStartMode": team.get("defaultStartMode") or "",
        "agents": [
            {
                "agentId": agent.get("id"),
                "name": agent.get("name"),
                "role": agent.get("role"),
                "autonomy": agent.get("autonomy"),
            }
            for agent in team.get("agents", [])
        ],
    }

def infer_extra_teams(pattern):
    category = pattern.get("categoryCode")
    inferred = []
    if category in {"DEPLOY"}:
        inferred.extend(["build-release", "ops-control"])
    if category in {"FRONTEND", "FULLSTACK"}:
        inferred.extend(["frontend-dev", "design-layout"])
    if category in {"BACKEND", "FULLSTACK"}:
        inferred.extend(["backend-dev", "java-maven-egov"])
    if category in {"DB", "FULLSTACK"}:
        inferred.extend(["db-cubrid", "query-dev"])
    if category in {"AI"}:
        inferred.extend(["codex55-execution-intelligence", "development-rag-governor"])
    if any(item in haystack for item in ["관리자", "페이지", "화면", "프레임워크", "builder", "빌더", "fullstack", "풀스택"]):
        inferred.append("framework-builder")
    if any(item in haystack for item in ["디자인", "레이아웃", "krds", "theme", "테마", "퍼블리싱", "토큰"]):
        inferred.extend(["design-specialist", "krds-theme"])
    if any(item in haystack for item in ["rag", "패턴", "개발 패턴", "유사 작업", "품질 점수", "quality score"]):
        inferred.append("development-rag-governor")
    if any(item in haystack for item in ["supergemma", "26b", "26비", "main load", "메인 사용량", "벤치", "benchmark"]):
        inferred.append("model-benchmark")
    if any(item in haystack for item in ["권한", "결제", "배포", "db", "디비", "삭제", "rollback", "롤백"]):
        inferred.append("qa-audit")
    return inferred

def select_agent_teams(pattern):
    rules = pattern.get("teamRules") or {}
    required = list(rules.get("requiredTeams") or [])
    gates = list(rules.get("gateTeams") or [])
    support = list(rules.get("supportTeams") or [])
    for team_id in infer_extra_teams(pattern):
        if team_id not in required and team_id not in support and team_id not in gates:
            support.append(team_id)
    if "planning" not in required and pattern.get("categoryCode") not in {"DEPLOY"}:
        required.insert(0, "planning")
    known = set(team_registry)
    def clean(items):
        seen = set()
        result = []
        for item in items:
            if item and item not in seen:
                seen.add(item)
                result.append(item)
        return result
    required = clean(required)
    gates = clean(gates)
    support = clean(support)
    missing = [item for item in required + gates + support if known and item not in known]
    return {
        "teamSource": team_source or team_file,
        "requiredTeams": [team_summary(item) for item in required],
        "gateTeams": [team_summary(item) for item in gates],
        "supportTeams": [team_summary(item) for item in support],
        "missingTeamIds": clean(missing),
        "selectionReason": rules.get("selectionReason") or "패턴 category와 요청 키워드 기준으로 작업 팀을 선별했다.",
        "workSelectionPolicy": "Every Hermes request must check the agent-team registry first, select required/gate/support teams, and include the selected teams in task steps before execution.",
    }

ranked = []
for pattern in seed.get("patterns", []):
    score, reasons = score_pattern(pattern)
    ranked.append((score, pattern, reasons))
ranked.sort(key=lambda item: (-item[0], item[1].get("patternId", "")))

best_score, best, reasons = ranked[0] if ranked else (0.0, {}, [])
confidence = 0.0 if not ranked else min(0.98, round(best_score / 12.0, 3))
if best_score <= 0:
    best = {
        "patternId": "GENERAL_CODEX_GOVERNED_CHANGE",
        "categoryCode": "GENERAL",
        "patternName": "General governed Codex change",
        "riskLevel": plan.get("riskLevel") or "MEDIUM",
        "skillName": "",
        "defaultActionId": "",
        "steps": plan.get("stages") or [],
        "checks": [],
        "artifacts": [],
    }
    reasons = ["fallback:no_pattern_score"]

def normalize_step(index, step):
    if isinstance(step, list):
        stage_code = step[0] if len(step) > 0 else f"STEP_{index}"
        executor = "HERMES" if stage_code == "REQUEST_CAPTURE" else "CODEX_SCRIPT" if stage_code in {"PRECHECK", "VERIFY"} else "CODEX"
        return {
            "stageCode": stage_code,
            "title": stage_code,
            "instruction": step[1] if len(step) > 1 else "",
            "expectedEvidence": step[2] if len(step) > 2 else "",
            "executor": executor,
        }
    return {
        "stageCode": step.get("stageCode") or f"STEP_{index}",
        "title": step.get("title") or step.get("stageCode") or f"Step {index}",
        "instruction": step.get("instruction") or "",
        "expectedEvidence": step.get("expectedEvidence") or "",
        "executor": step.get("executor") or "CODEX_SCRIPT",
    }

resolution = {
    "projectId": seed.get("projectId") or "carbonet",
    "source": str(seed_path),
    "workGovernance": {
        "dbWorkOrderFirst": True,
        "requiresSimilarWorkRetrieval": True,
        "requiresWorkPacket": True,
        "requiresLocalModelLaneSelection": True,
        "forbidsRuntimeModelDownload": True,
        "requiresMidpointReport": True,
        "requiresExistingScriptParity": True,
        "requiresReworkOnFailedVerification": True,
        "requiresRestoreAnchor": True,
        "policySource": "hermes_work_execution_guard_policy",
    },
    "selectedPattern": {
        "patternId": best.get("patternId"),
        "categoryCode": best.get("categoryCode"),
        "patternName": best.get("patternName"),
        "riskLevel": best.get("riskLevel"),
        "skillName": best.get("skillName"),
        "defaultActionId": best.get("defaultActionId"),
    },
    "confidenceScore": confidence,
    "matchedReasons": reasons[:12],
    "agentTeamSelection": select_agent_teams(best),
    "steps": [normalize_step(index, step) for index, step in enumerate(best.get("steps", []), start=1)],
    "checks": [
        {"checkType": item[0], "commandTemplate": item[1], "passCriteria": item[2]}
        for item in best.get("checks", [])
    ],
    "artifacts": [
        {"artifactType": item[0], "pathGlob": item[1], "ownershipScope": item[2]}
        for item in best.get("artifacts", [])
    ],
    "candidates": [
        {
            "patternId": pattern.get("patternId"),
            "patternName": pattern.get("patternName"),
            "score": score,
            "reasons": item_reasons[:6],
        }
        for score, pattern, item_reasons in ranked[:5]
    ],
}

text = json.dumps(resolution, ensure_ascii=False, indent=2)
if out_path:
    pathlib.Path(out_path).write_text(text + "\n", encoding="utf-8")
else:
    print(text)
PY
