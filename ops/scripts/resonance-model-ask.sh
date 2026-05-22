#!/usr/bin/env bash
set -euo pipefail

REGISTRY_FILE="${RESONANCE_MODEL_RUNTIME_REGISTRY:-/opt/Resonance/var/ai-model-runtime/model-runtime-registry.json}"
RUNTIME_VIEW_FILE="${RESONANCE_HERMES_RUNTIME_VIEW:-/opt/Resonance/var/ai-model-runtime/hermes-runtime-view.json}"
API_KEY="${MODEL_API_KEY:-qwer1234}"
MAX_TOKENS="${RESONANCE_MODEL_ASK_MAX_TOKENS:-1024}"
TIMEOUT_SECONDS="${RESONANCE_MODEL_ASK_TIMEOUT_SECONDS:-180}"
MODE="${1:-ask}"
ROLE_OVERRIDE="${RESONANCE_MODEL_ASK_ROLE:-}"
ROLE="${ROLE_OVERRIDE:-sub}"

if [ -z "$ROLE_OVERRIDE" ]; then
  case "$MODE" in
    classify)
      ROLE="router"
      ;;
    watchdog)
      ROLE="sub"
      ;;
    agent-repair)
      ROLE="main"
      ;;
    context|review)
      ROLE="utility"
      ;;
    translate|glossary)
      ROLE="translation"
      ;;
    judge)
      ROLE="main"
      ;;
  esac
fi

if [ "$MODE" = "health" ]; then
  python3 - "$REGISTRY_FILE" "$RUNTIME_VIEW_FILE" "$ROLE" "$API_KEY" <<'PY'
import json
import pathlib
import sys
import urllib.request

registry_file, runtime_view_file, role, api_key = sys.argv[1:5]

def load_json(path):
    p = pathlib.Path(path)
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))

view = load_json(runtime_view_file)
profile = (view.get("activeRoles") or {}).get(role)
if not profile:
    registry = load_json(registry_file)
    active_id = ((registry.get("selectionPolicy") or {}).get("activeRoles") or {}).get(role)
    profile = next((item for item in registry.get("profiles", []) if item.get("id") == active_id), None)
if not profile:
    raise SystemExit(f"no active model role: {role}")
request = urllib.request.Request(
    profile["baseUrl"].rstrip("/") + "/models",
    headers={"Authorization": "Bearer " + api_key},
)
with urllib.request.urlopen(request, timeout=10) as response:
    data = json.loads(response.read().decode("utf-8"))
rows = []
rows.extend(data.get("data") or [])
rows.extend(data.get("models") or [])
models = {item.get("id") or item.get("model") or item.get("name") for item in rows}
if profile.get("modelAlias") not in models:
    raise SystemExit(f"model mismatch for {role}: expected {profile.get('modelAlias')} got {sorted(models)}")
print(f"{role} model OK {profile.get('modelAlias')} {profile.get('baseUrl')}")
PY
  exit 0
fi

case "$MODE" in
  classify)
    shift
    SYSTEM_KIND="classifier"
    SYSTEM_PROMPT="Carbonet development classifier. Return JSON only with keys: taskType, workKind, modelLane, primarySkill, docs, candidatePaths, risk, confidence, escalateTo40B, reason. workKind must be one of page-development, translation, risk-review, ops-triage, db-management, ai-team-os, web-pod-management, design-build. Prefer workKind=db-management for CUBRID/SQL/query/DB/broker/CAS/tuning, web-pod-management for pod/k8s/sidecar/rollout, ai-team-os for Hermes/watchdog/agent-loop/iteration-budget/model runtime/team orchestration, design-build for KRDS/layout/theme/CSS/UI work. Prefer modelLane=fast-draft for normal bounded development. Set escalateTo40B=true only for security, permission, DB migration, shared API/DTO/mapper contract, multi-module architecture, deploy failure interpretation, or confidence below 0.75. Do not invent execution results, URLs, document names, or file paths. If exact docs or paths were not supplied in the prompt, use [] or TODO."
    ;;
  context)
    shift
    SYSTEM_KIND="context"
    SYSTEM_PROMPT="Carbonet context packer. Return JSON only with keys: primarySkill, secondarySkill, docs, candidatePaths, writableBoundaries, verificationCommands, assumptions. Keep the context pack small. Candidate paths are hints, not facts. Use TODO for commands unless an exact registered script is supplied in the prompt. Do not invent URLs, docs, files, directories, scripts, or confirmed existing files. If not supplied in the prompt, use [] or TODO."
    ;;
  draft)
    shift
    SYSTEM_KIND="draft"
    SYSTEM_PROMPT="Carbonet fast-draft coder. Produce a concise Korean implementation draft for normal bounded work: likely files, small code approach, precheck, verification, and escalation gates. Do not claim to edit files, run DB changes, or deploy. Escalate risky source writes, DB, permission, shared contracts, and unclear confidence to judge."
    ;;
  review)
    shift
    SYSTEM_KIND="review"
    SYSTEM_PROMPT="Carbonet lightweight reviewer. Review a small plan or diff for obvious omissions, risky assumptions, invented commands, and missing verification. Return Korean bullets and escalation notes. Command evidence wins over model output."
    ;;
  watchdog)
    shift
    SYSTEM_KIND="watchdog"
    SYSTEM_PROMPT="Carbonet Hermes watchdog. Review the checkpoint payload for Hermes runtime risks: wrong task extraction, repeated command, repeated error, terminal preparation loop, repeated context compaction, repeated pattern-resolution/history file browsing, no-output timeout, model endpoint mismatch, iteration budget, stale deployment evidence, or success without evidence. For UI/deploy freshness tasks, source diff alone is not enough: require source, current manifest asset, served asset, and rollout/health evidence. Return compact Korean JSON with keys: severity, signals, feedback, nextAction. signals must contain only risks directly observed in the payload; if no risk is observed, return signals as [] and severity as LOW. Do not copy the full risk taxonomy into signals. Do not invent file changes, command results, or failures."
    ;;
  agent-repair)
    shift
    SYSTEM_KIND="agent-repair"
    SYSTEM_PROMPT="Carbonet Hermes agent repair judge. You are Qwen40 repairing the Hermes agent safely through blue/green release folders. Return strict JSON only with keys: severity, rootCause, repairSummary, patchUnifiedDiff, applyPatch, smokeTests, promoteRecommended, resumeCommand, operatorMessage, riskNotes. Do not invent test results. patchUnifiedDiff may be empty if no safe source patch is evident. applyPatch must be true only when the diff is complete, minimal, and safe to apply to the candidate next release. promoteRecommended must be true only if deterministic smoke tests should be enough after patching. The active runtime must not be edited directly."
    ;;
  translate)
    shift
    SYSTEM_KIND="translate"
    SYSTEM_PROMPT="Carbonet UI translation assistant. Translate the requested Korean/English UI sentence or short text. Return only the translation unless the user asks for alternatives. Do not add examples."
    ;;
  glossary)
    shift
    SYSTEM_KIND="glossary"
    SYSTEM_PROMPT="Carbonet glossary assistant. Normalize short UI labels and domain terms using concise Korean/English terminology. Return only the normalized term or a compact mapping."
    ;;
  *)
    shift || true
    SYSTEM_KIND="ask"
    SYSTEM_PROMPT="Carbonet bounded local model assistant. Keep answers short, practical, and escalate uncertain risky work to the main judge."
    ;;
esac

if [ "$#" -gt 0 ]; then
  PROMPT="$*"
else
  PROMPT="$(cat)"
fi

RESONANCE_MODEL_ASK_REGISTRY_FILE="$REGISTRY_FILE" \
RESONANCE_MODEL_ASK_RUNTIME_VIEW_FILE="$RUNTIME_VIEW_FILE" \
RESONANCE_MODEL_ASK_ROLE="$ROLE" \
RESONANCE_MODEL_ASK_API_KEY="$API_KEY" \
RESONANCE_MODEL_ASK_MAX_TOKENS="$MAX_TOKENS" \
RESONANCE_MODEL_ASK_TIMEOUT_SECONDS="$TIMEOUT_SECONDS" \
RESONANCE_MODEL_ASK_MODE="$MODE" \
RESONANCE_MODEL_ASK_SYSTEM_KIND="$SYSTEM_KIND" \
RESONANCE_MODEL_ASK_SYSTEM_PROMPT="$SYSTEM_PROMPT" \
RESONANCE_MODEL_ASK_PROMPT="$PROMPT" \
python3 - <<'PY'
import json
import os
import pathlib
import re
import urllib.request

def load_json(path):
    p = pathlib.Path(path)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}

def selected_profile():
    role = os.environ["RESONANCE_MODEL_ASK_ROLE"]
    view = load_json(os.environ["RESONANCE_MODEL_ASK_RUNTIME_VIEW_FILE"])
    profile = (view.get("activeRoles") or {}).get(role)
    if profile:
        return profile
    registry = load_json(os.environ["RESONANCE_MODEL_ASK_REGISTRY_FILE"])
    active_id = ((registry.get("selectionPolicy") or {}).get("activeRoles") or {}).get(role)
    for item in registry.get("profiles", []):
        if item.get("id") == active_id:
            return item
    fallback = {
        "id": "sub-qwen7-coder-cpu",
        "displayName": "Qwen2.5 Coder 7B CPU fallback",
        "modelAlias": "qwen2.5-coder-7b-instruct-shadow",
        "baseUrl": "http://127.0.0.1:24751/v1",
        "hardware": "cpu",
    }
    return fallback

def extract_json(text):
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    raw = fenced.group(1) if fenced else text
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end < start:
        return None
    try:
        return json.loads(raw[start:end + 1])
    except Exception:
        try:
            return json.loads(raw[start:end + 1], strict=False)
        except Exception:
            return None

def as_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip() and value.strip().upper() != "TODO":
        return [value.strip()]
    return []

def prompt_supplied_values(values, prompt):
    result = []
    for value in values:
        if value.startswith(("http://", "https://")) or "example.com" in value:
            continue
        if value and value in prompt:
            result.append(value)
    return result

profile = selected_profile()
system_prompt = os.environ["RESONANCE_MODEL_ASK_SYSTEM_PROMPT"]
system_prompt += f"\nActive local role: {os.environ['RESONANCE_MODEL_ASK_ROLE']}."
system_prompt += f"\nActive model: {profile.get('displayName') or profile.get('modelAlias')} ({profile.get('hardware')})."

payload = {
    "model": profile["modelAlias"],
    "temperature": 0,
    "max_tokens": int(os.environ["RESONANCE_MODEL_ASK_MAX_TOKENS"]),
    "stream": False,
    "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": os.environ["RESONANCE_MODEL_ASK_PROMPT"]},
    ],
}
if os.environ.get("RESONANCE_MODEL_ASK_SYSTEM_KIND") in {"classifier", "context", "agent-repair"}:
    payload["response_format"] = {"type": "json_object"}
request = urllib.request.Request(
    profile["baseUrl"].rstrip("/") + "/chat/completions",
    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    headers={
        "Authorization": "Bearer " + os.environ["RESONANCE_MODEL_ASK_API_KEY"],
        "Content-Type": "application/json",
    },
    method="POST",
)
with urllib.request.urlopen(request, timeout=int(os.environ["RESONANCE_MODEL_ASK_TIMEOUT_SECONDS"])) as response:
    data = json.loads(response.read().decode("utf-8"))
content = data["choices"][0]["message"]["content"].strip()

mode = os.environ.get("RESONANCE_MODEL_ASK_MODE", "")
if mode in {"classify", "context"}:
    parsed = extract_json(content)
    if parsed is not None:
        prompt = os.environ.get("RESONANCE_MODEL_ASK_PROMPT", "")
        parsed.setdefault("selectedLocalModel", profile.get("modelAlias"))
        parsed.setdefault("selectedLocalRole", os.environ.get("RESONANCE_MODEL_ASK_ROLE"))
        for key in ("docs", "candidatePaths", "writableBoundaries"):
            parsed[key] = prompt_supplied_values(as_list(parsed.get(key)), prompt)
        commands = []
        for command in as_list(parsed.get("verificationCommands")):
            if command == "TODO":
                commands.append(command)
            elif command in prompt or any(part in prompt for part in command.split() if part.startswith("ops/scripts/")):
                commands.append(command)
        if "verificationCommands" in parsed:
            parsed["verificationCommands"] = commands or ["TODO"]
        print(json.dumps(parsed, ensure_ascii=False, indent=2))
        raise SystemExit(0)

print(content)
PY
