#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${QWEN7_CODER_BASE_URL:-http://127.0.0.1:24751/v1}"
API_KEY="${QWEN7_CODER_API_KEY:-qwer1234}"
MODEL="${QWEN7_CODER_MODEL:-qwen2.5-coder-7b-instruct-shadow}"
MAX_TOKENS="${QWEN7_CODER_MAX_TOKENS:-1024}"
TIMEOUT_SECONDS="${QWEN7_CODER_TIMEOUT_SECONDS:-180}"
MODE="${1:-ask}"

if [ "$MODE" = "health" ]; then
  curl -fsS --max-time 10 -H "Authorization: Bearer $API_KEY" "$BASE_URL/models" >/dev/null
  echo "qwen7 coder shadow OK $BASE_URL"
  exit 0
fi

case "$MODE" in
  classify)
    shift
    SYSTEM_PROMPT="Carbonet 7B primary development classifier. Return JSON only with keys: taskType, modelLane, primarySkill, docs, candidatePaths, risk, confidence, escalateTo40B, reason. Prefer modelLane=fast-draft for normal bounded development. Set escalateTo40B=true only for security, permission, DB migration, shared API/DTO/mapper contract, multi-module architecture, deploy failure interpretation, or confidence below 0.75. Do not invent execution results, URLs, document names, or file paths. If exact docs or paths were not supplied in the prompt, use [] or TODO."
    ;;
  context)
    shift
    SYSTEM_PROMPT="Carbonet 7B context packer. Return JSON only with keys: primarySkill, secondarySkill, docs, candidatePaths, writableBoundaries, verificationCommands, assumptions. Keep the context pack small. Candidate paths are hints, not facts. Use TODO for commands unless an exact registered script is supplied in the prompt. Do not invent URLs, docs, files, directories, scripts, or confirmed existing files. If not supplied in the prompt, use [] or TODO."
    ;;
  draft)
    shift
    SYSTEM_PROMPT="Carbonet 7B fast-draft coder. Produce a concise Korean implementation draft for normal bounded work: likely files, small code approach, precheck, verification, and escalation gates. Do not claim to edit files, run DB changes, or deploy. Escalate risky source writes, DB, permission, shared contracts, and unclear confidence to 40B judge."
    ;;
  review)
    shift
    SYSTEM_PROMPT="Carbonet 7B lightweight reviewer. Review a small plan or diff for obvious omissions, risky assumptions, invented commands, and missing verification. Return Korean bullets and escalation notes. Command evidence wins over model output."
    ;;
  *)
    shift || true
    SYSTEM_PROMPT="Carbonet 7B fast-draft assistant. Keep answers short, practical, and bounded. If uncertain, say to escalate to Qwen40 judge."
    ;;
esac

if [ "$#" -gt 0 ]; then
  PROMPT="$*"
else
  PROMPT="$(cat)"
fi

QWEN7_CODER_BASE_URL="$BASE_URL" \
QWEN7_CODER_API_KEY="$API_KEY" \
QWEN7_CODER_MODEL="$MODEL" \
QWEN7_CODER_MAX_TOKENS="$MAX_TOKENS" \
QWEN7_CODER_TIMEOUT_SECONDS="$TIMEOUT_SECONDS" \
QWEN7_CODER_MODE="$MODE" \
QWEN7_CODER_SYSTEM_PROMPT="$SYSTEM_PROMPT" \
QWEN7_CODER_PROMPT="$PROMPT" \
python3 - <<'PY'
import json
import os
import re
import urllib.request

payload = {
    "model": os.environ["QWEN7_CODER_MODEL"],
    "temperature": 0,
    "max_tokens": int(os.environ["QWEN7_CODER_MAX_TOKENS"]),
    "stream": False,
    "messages": [
        {"role": "system", "content": os.environ["QWEN7_CODER_SYSTEM_PROMPT"]},
        {"role": "user", "content": os.environ["QWEN7_CODER_PROMPT"]},
    ],
}
request = urllib.request.Request(
    os.environ["QWEN7_CODER_BASE_URL"].rstrip("/") + "/chat/completions",
    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    headers={
        "Authorization": "Bearer " + os.environ["QWEN7_CODER_API_KEY"],
        "Content-Type": "application/json",
    },
    method="POST",
)
with urllib.request.urlopen(request, timeout=int(os.environ["QWEN7_CODER_TIMEOUT_SECONDS"])) as response:
    data = json.loads(response.read().decode("utf-8"))
content = data["choices"][0]["message"]["content"].strip()

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

mode = os.environ.get("QWEN7_CODER_MODE", "")
if mode in {"classify", "context"}:
    parsed = extract_json(content)
    if parsed is not None:
        prompt = os.environ.get("QWEN7_CODER_PROMPT", "")
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
