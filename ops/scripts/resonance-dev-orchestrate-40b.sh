#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MODEL_BASE_URL="${MODEL_BASE_URL:-http://127.0.0.1:24036/v1}"
MODEL_API_KEY="${MODEL_API_KEY:-qwer1234}"
MODEL_NAME="${MODEL_NAME:-qwen3.6-40b-deck-opus-q4}"
MODEL_ROUTING_POLICY_FILE="${MODEL_ROUTING_POLICY_FILE:-$ROOT_DIR/ops/hermes/model-routing-policy.seed.json}"
FAST_DRAFT_ENABLE="${FAST_DRAFT_ENABLE:-1}"
FAST_DRAFT_HELPER="${FAST_DRAFT_HELPER:-/usr/local/bin/qwen7-coder-ask}"
FAST_DRAFT_TIMEOUT_SECONDS="${FAST_DRAFT_TIMEOUT_SECONDS:-60}"
QWEN40_JUDGE_MODE="${QWEN40_JUDGE_MODE:-auto}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-runtime/dev-orchestration}"
mkdir -p "$OUT_DIR"

REQUEST_TEXT="${*:-}"
if [ -z "$REQUEST_TEXT" ]; then
  REQUEST_TEXT="$(cat)"
fi
if [ -z "${REQUEST_TEXT// }" ]; then
  echo "usage: $0 \"development request\"" >&2
  exit 2
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_MD="$OUT_DIR/qwen40-dev-plan-$STAMP.md"
OUT_JSONL="$OUT_DIR/qwen40-dev-plan-events.jsonl"

PROJECT_HINT="$(
  cd "$ROOT_DIR"
  {
    printf 'root=%s\n' "$ROOT_DIR"
    printf 'git_branch=%s\n' "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    printf 'top_level_dirs=%s\n' "$(find . -maxdepth 1 -mindepth 1 -type d | sed 's#^\./##' | sort | tr '\n' ' ')"
    printf 'key_scripts=%s\n' "$(find ops/scripts -maxdepth 1 -type f 2>/dev/null | sed 's#^#/#' | sort | grep -E 'resonance|build|deploy|verify|codex' | head -40 | tr '\n' ' ')"
    printf 'model_routing_policy=%s\n' "$(test -f "$MODEL_ROUTING_POLICY_FILE" && tr '\n' ' ' < "$MODEL_ROUTING_POLICY_FILE" | cut -c1-6000 || true)"
    printf 'local_ollama_models=%s\n' "$(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}' | tr '\n' ' ' || true)"
  }
)"

FAST_DRAFT_CLASSIFICATION=""
FAST_DRAFT_CONTEXT=""
FAST_DRAFT_DRAFT=""
if [ "$FAST_DRAFT_ENABLE" = "1" ] && [ -x "$FAST_DRAFT_HELPER" ]; then
  FAST_DRAFT_INPUT="$(printf '요청:\\n%s\\n\\n프로젝트 힌트:\\n%s\\n\\n규칙:\\n- 실제 제공되지 않은 docs, URL, file path는 만들지 말고 [] 또는 TODO로 둔다.\\n- candidatePaths는 힌트일 뿐이며 Codex가 실제 파일 존재를 확인하기 전까지 확정하지 않는다.\\n- 등록된 스크립트명을 모르면 verificationCommands는 TODO로 둔다.\\n' "$REQUEST_TEXT" "$PROJECT_HINT")"
  FAST_DRAFT_CLASSIFICATION="$(timeout "${FAST_DRAFT_TIMEOUT_SECONDS}s" "$FAST_DRAFT_HELPER" classify "$FAST_DRAFT_INPUT" 2>/dev/null || true)"
  FAST_DRAFT_CONTEXT="$(timeout "${FAST_DRAFT_TIMEOUT_SECONDS}s" "$FAST_DRAFT_HELPER" context "$FAST_DRAFT_INPUT" 2>/dev/null || true)"
  FAST_DRAFT_DRAFT="$(timeout "${FAST_DRAFT_TIMEOUT_SECONDS}s" "$FAST_DRAFT_HELPER" draft "$FAST_DRAFT_INPUT" 2>/dev/null || true)"
fi

python3 - "$MODEL_BASE_URL" "$MODEL_API_KEY" "$MODEL_NAME" "$REQUEST_TEXT" "$PROJECT_HINT" "$FAST_DRAFT_CLASSIFICATION" "$FAST_DRAFT_CONTEXT" "$FAST_DRAFT_DRAFT" "$QWEN40_JUDGE_MODE" > "$OUT_MD" <<'PY'
import json
import pathlib
import re
import sys
import urllib.request

base_url, api_key, model, request_text, project_hint, fast_draft_classification, fast_draft_context, fast_draft_draft, judge_mode = sys.argv[1:10]

root_dir = pathlib.Path(".")
for line in project_hint.splitlines():
    if line.startswith("root="):
        root_dir = pathlib.Path(line.split("=", 1)[1].strip())
        break

def extract_json(text):
    if not text:
        return {}
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    raw = fenced.group(1) if fenced else text
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end < start:
        return {}
    try:
        return json.loads(raw[start:end + 1])
    except Exception:
        return {}

classifier = extract_json(fast_draft_classification)
context_pack = extract_json(fast_draft_context)

def normalize_risk(value):
    text = str(value or "LOW").upper()
    if "CRIT" in text or "치명" in text:
        return "CRITICAL"
    if "HIGH" in text or "높" in text:
        return "HIGH"
    if "MED" in text or "중" in text:
        return "MEDIUM"
    return "LOW"

def as_bool(value):
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "yes", "y", "1", "높음"}

def should_call_judge():
    mode = judge_mode.lower()
    if mode == "always":
        return True
    if mode == "never":
        return False
    if not fast_draft_classification and not fast_draft_draft:
        return True
    if as_bool(classifier.get("escalateTo40B")):
        return True
    if normalize_risk(classifier.get("risk")) in {"HIGH", "CRITICAL"}:
        return True
    confidence = classifier.get("confidence")
    try:
        if confidence is not None and float(confidence) < 0.75:
            return True
    except Exception:
        pass
    risky_terms = ["보안", "권한", "인증", "결제", "마이그레이션", "공유 api", "shared api", "dto", "mapper", "아키텍처", "장애 해석"]
    request_lower = request_text.lower()
    return any(term in request_lower for term in risky_terms)

def list_value(source, key):
    value = source.get(key)
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []

def existing_relative_values(values):
    existing = []
    hints = []
    for value in values:
        text = str(value or "").strip()
        if not text or text.upper() == "TODO" or "example.com" in text or text.startswith(("http://", "https://")):
            if text and text.upper() != "TODO":
                hints.append(text)
            continue
        path = pathlib.Path(text)
        candidate = path if path.is_absolute() else root_dir / text
        if candidate.exists():
            existing.append(text)
        else:
            hints.append(text)
    return existing, hints

def safe_command_section():
    request_lower = request_text.lower()
    commands = []
    if any(token in request_text for token in ("80", "배포", "재배포")):
        deploy80 = root_dir / "ops/scripts/resonance-k8s-build-deploy-80.sh"
        if deploy80.exists():
            commands.append(("80-port Kubernetes build/redeploy/runtime health", "bash ops/scripts/resonance-k8s-build-deploy-80.sh"))
    if any(token in request_text for token in ("18000", ":18000")):
        build18000 = root_dir / "ops/scripts/build-restart-18000.sh"
        verify18000 = root_dir / "ops/scripts/codex-verify-18000-freshness.sh"
        if build18000.exists():
            commands.append(("18000 local build/restart", "bash ops/scripts/build-restart-18000.sh"))
        if verify18000.exists():
            commands.append(("18000 freshness verification", "bash ops/scripts/codex-verify-18000-freshness.sh"))
    if "health" in request_lower or "확인" in request_text:
        doctor = root_dir / "ops/scripts/resonance-k8s-doctor.sh"
        if doctor.exists():
            commands.append(("Kubernetes runtime doctor", "bash ops/scripts/resonance-k8s-doctor.sh"))
    if not commands:
        commands.append(("No exact registered script selected", "TODO"))
    lines = ["## Deterministic Commands", "", "Only exact registered scripts selected by the wrapper are listed here.", "", "```bash"]
    for label, command in commands:
        lines.append(f"# {label}")
        lines.append(command)
    lines.extend(["```", ""])
    return "\n".join(lines)

def replace_section(markdown, start_heading, next_heading, replacement):
    pattern = re.compile(
        rf"(^## {re.escape(start_heading)}\s*$)(.*?)(^## {re.escape(next_heading)}\s*$)",
        re.M | re.S,
    )
    match = pattern.search(markdown)
    if not match:
        return markdown.rstrip() + "\n\n" + replacement
    return markdown[:match.start()] + replacement + markdown[match.start(3):]

def qwen7_markdown_plan():
    risk = normalize_risk(classifier.get("risk"))
    lane = str(classifier.get("modelLane") or "fast-draft")
    if lane not in {"translation", "dev-classify", "fast-draft", "mid-draft", "math", "agent-candidate", "judge", "verify"}:
        lane = "fast-draft"
    docs, doc_hints = existing_relative_values(list_value(context_pack, "docs") or list_value(classifier, "docs"))
    paths, path_hints = existing_relative_values(list_value(context_pack, "candidatePaths") or list_value(classifier, "candidatePaths"))
    boundaries, boundary_hints = existing_relative_values(list_value(context_pack, "writableBoundaries"))
    verification = list_value(context_pack, "verificationCommands") or ["TODO"]
    draft = fast_draft_draft.strip() or str(classifier.get("reason") or "7B fast-draft draft unavailable")
    return f"""# Qwen7 Primary Development Plan

## Goal
{request_text}

## Stage Breakdown
1. 7B classify: taskType={classifier.get("taskType", "general")}, risk={risk}, lane={lane}
2. 7B context pack: skill/docs/path candidates are bounded and must be verified by Codex before edits.
3. Codex applies only verified changes.
4. Deterministic scripts verify runtime/build results.
5. Escalate to 40B only when the gates below trigger.

## Model Lane Selection
| Work | Lane | Model | Base URL |
| --- | --- | --- | --- |
| classify/context/draft | {lane} | qwen2.5-coder-7b-instruct-shadow | http://127.0.0.1:24751/v1 |
| judge fallback | judge | qwen3.6-40b-deck-opus-q4 | http://127.0.0.1:24036/v1 |
| verification | verify | codex-scripts | - |

## Context Pack
- primarySkill: {context_pack.get("primarySkill") or classifier.get("primarySkill") or "TODO"}
- docs: {", ".join(docs) if docs else "TODO"}
- docHintsUnverified: {", ".join(doc_hints) if doc_hints else "none"}
- candidatePaths: {", ".join(paths) if paths else "TODO"}
- candidatePathHintsUnverified: {", ".join(path_hints) if path_hints else "none"}
- writableBoundaries: {", ".join(boundaries) if boundaries else "TODO"}
- writableBoundaryHintsUnverified: {", ".join(boundary_hints) if boundary_hints else "none"}

## File/Stage Ownership
7B suggests candidate files and approach; Codex confirms paths and edits; scripts verify evidence.

{safe_command_section()}
## Verification Evidence
- qwen7 classifier/context/draft packets
- confirmed file existence before edits
- deterministic command output
- runtime or route proof when behavior changes

## Small Model Support Use
{draft[:2400]}

## Escalation Rules
- escalateTo40B={classifier.get("escalateTo40B", False)}
- reason={classifier.get("reason", "")}
- Escalate for DB migration, permission/security, shared API/DTO/mapper contract, architecture, failed verification, or confidence below 0.75.
"""

if not should_call_judge():
    print(qwen7_markdown_plan())
    raise SystemExit(0)

system = """You are the Qwen40-first Resonance development orchestrator for Carbonet.
Use Korean.
Return a concise but complete staged development plan.
Do not pretend to edit files or deploy.
Separate frontend, backend, database, scripts, kubernetes, verification, and memory.
Qwen40 is the escalation judge, not the default worker for every subtask. Qwen2.5 Coder 7B is the primary bounded development classifier/context/draft model.
Deterministic scripts and Codex execute changes.
Do not load all Skills/Docs. Select one model lane and one bounded context pack.
Use these lanes:
- translation: Gemma4 CPU local first, default gemma4-e4b-cpu-shadow on http://127.0.0.1:24451/v1, for translation/glossary/product-name mapping.
- dev-classify: Qwen2.5 local ladder first (0.5B/1.5B/3B/7B), prefer registered local endpoints 24051/24151/24351/24751 for classification/log summary/candidate docs.
- fast-draft: Qwen2.5 Coder 7B local first, default qwen2.5-coder-7b-instruct-shadow on http://127.0.0.1:24751/v1. Normal development work must call this lane before 40B final review.
- mid-draft: Qwen2.5 Coder 14B fallback only when a registered local endpoint exists; otherwise escalate to judge.
- math: Qwen Math local first, default qwen-math:7b on http://127.0.0.1:24117/v1, for formulas, unit conversion, and numeric validation.
- agent-candidate: Qwen3.5 9B local candidate, default qwen3.5-9b-q4_k_m on http://127.0.0.1:24119/v1, for benchmarked general reasoning or agent planning before promotion.
- judge: Qwen3.6 40B for architecture, risky implementation, final review, failure interpretation.
- verify: deterministic Codex/scripts for evidence.
Do not select Qwen3 small models for local lanes.
Do not download HuggingFace models during a normal development request. If a model is missing, select an available fallback and record the missing setup as a separate task.
Include risk gates and exact evidence to collect.
Never invent command-line flags or script names.
Only suggest commands that are explicitly present in the project hint.
If no exact command is present, write TODO instead of a command.
Do not suggest git branch, git add, git commit, codex-build.sh, codex-frontend-verify.sh, npm, or mvn unless that exact command or script is present in the project hint and the user explicitly asked for it.
For Kubernetes 80-port redeploy, prefer an exact existing resonance or build/deploy script from project hint; otherwise write TODO.
Avoid generic timelines and team labels; this is a single-machine Codex/Resonance execution plan."""
user = f"""요청:
{request_text}

프로젝트 힌트:
{project_hint}

7B primary classifier:
{fast_draft_classification.strip() or "unavailable"}

7B primary context:
{fast_draft_context.strip() or "unavailable"}

7B primary draft:
{fast_draft_draft.strip() or "unavailable"}

아래 형식으로 작성:
# Qwen40 Development Plan
## Goal
## Stage Breakdown
## Model Lane Selection
## Context Pack
## File/Stage Ownership
## Deterministic Commands
Only list exact commands/scripts visible in the project hint. If none match, write TODO.
## Verification Evidence
## Small Model Support Use
## Escalation Rules
"""
payload = {
    "model": model,
    "temperature": 0,
    "max_tokens": 4096,
    "messages": [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ],
}
req = urllib.request.Request(
    base_url.rstrip("/") + "/chat/completions",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    },
    method="POST",
)
with urllib.request.urlopen(req, timeout=300) as res:
    data = json.loads(res.read().decode("utf-8"))
content = data["choices"][0]["message"]["content"]

content = replace_section(content, "Deterministic Commands", "Verification Evidence", safe_command_section())
print(content)
PY

python3 - "$OUT_JSONL" "$OUT_MD" "$REQUEST_TEXT" <<'PY'
import datetime
import json
import pathlib
import sys

event_path = pathlib.Path(sys.argv[1])
plan_path = pathlib.Path(sys.argv[2])
request_text = sys.argv[3]
event = {
    "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "script": "resonance-dev-orchestrate-40b",
    "status": "OK",
    "code": "QWEN40_DEV_PLAN_CREATED",
    "request": request_text,
    "planPath": str(plan_path),
    "fastDraftHelper": "enabled",
    "qwen40JudgeMode": "auto",
}
with event_path.open("a", encoding="utf-8") as handle:
    handle.write(json.dumps(event, ensure_ascii=False) + "\n")
PY

echo "$OUT_MD"
