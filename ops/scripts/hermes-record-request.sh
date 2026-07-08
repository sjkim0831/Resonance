#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
CUBRID_POD="${CUBRID_POD:-postgres-patroni-0}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-postgres}"
MODEL_BASE_URL="${MODEL_BASE_URL:-http://127.0.0.1:24036/v1}"
MODEL_API_KEY="${MODEL_API_KEY:-qwer1234}"
MODEL_NAME="${MODEL_NAME:-qwen3.6-40b-deck-opus-q4}"
MODEL_ROUTING_POLICY_FILE="${MODEL_ROUTING_POLICY_FILE:-$ROOT_DIR/ops/hermes/model-routing-policy.seed.json}"
MODEL_RUNTIME_FILE="${MODEL_RUNTIME_FILE:-/opt/Resonance/var/ai-model-runtime/model-runtime-registry.json}"
HERMES_RUNTIME_VIEW_FILE="${HERMES_RUNTIME_VIEW_FILE:-/opt/Resonance/var/ai-model-runtime/hermes-runtime-view.json}"
FAST_DRAFT_ENABLE="${FAST_DRAFT_ENABLE:-1}"
FAST_DRAFT_HELPER="${FAST_DRAFT_HELPER:-/usr/local/bin/resonance-model-ask}"
FAST_DRAFT_TIMEOUT_SECONDS="${FAST_DRAFT_TIMEOUT_SECONDS:-60}"
QWEN40_JUDGE_MODE="${QWEN40_JUDGE_MODE:-auto}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-runtime/hermes-workflow}"
DEFAULT_TEAM_FILE="/opt/Resonance/var/ai-agent-teams/ai-agent-teams.json"
if [ ! -f "$DEFAULT_TEAM_FILE" ]; then
  DEFAULT_TEAM_FILE="$ROOT_DIR/var/ai-agent-teams/ai-agent-teams.json"
fi
TEAM_FILE="${TEAM_FILE:-$DEFAULT_TEAM_FILE}"
mkdir -p "$OUT_DIR"

REQUEST_TEXT="${*:-}"
if [ -z "$REQUEST_TEXT" ]; then
  REQUEST_TEXT="$(cat)"
fi
if [ -z "${REQUEST_TEXT// }" ]; then
  echo "usage: $0 \"request text\"" >&2
  exit 2
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
TASK_ID="hermes-$STAMP-$$"
TRACE_ID="trace-$STAMP-$$"
PLAN_JSON="$OUT_DIR/$TASK_ID.interpretation.json"
FAST_DRAFT_PACKET_JSON="$OUT_DIR/$TASK_ID.fast-draft-packet.json"
RESOLUTION_JSON="$OUT_DIR/$TASK_ID.pattern-resolution.json"
EVENT_JSONL="$OUT_DIR/hermes-request-events.jsonl"
HERMES_WATCHDOG_ENABLE="${HERMES_WATCHDOG_ENABLE:-1}"
HERMES_WATCHDOG_HELPER="${HERMES_WATCHDOG_HELPER:-$ROOT_DIR/ops/scripts/hermes-watchdog-checkpoint.sh}"
HERMES_WATCHDOG_EVENTS="${HERMES_WATCHDOG_EVENTS:-$ROOT_DIR/var/ai-runtime/hermes-watchdog/hermes-watchdog-events.jsonl}"

FAST_DRAFT_CLASSIFICATION=""
FAST_DRAFT_CONTEXT=""
FAST_DRAFT_DRAFT=""
if [ "$FAST_DRAFT_ENABLE" = "1" ] && [ -x "$FAST_DRAFT_HELPER" ]; then
  FAST_DRAFT_INPUT="$(printf '요청:\\n%s\\n\\n규칙:\\n- 실제 제공되지 않은 docs, URL, file path는 만들지 말고 [] 또는 TODO로 둔다.\\n- candidatePaths는 힌트일 뿐이며 Codex가 실제 파일 존재를 확인하기 전까지 확정하지 않는다.\\n- 등록된 스크립트명을 모르면 verificationCommands는 TODO로 둔다.\\n' "$REQUEST_TEXT")"
  FAST_DRAFT_CLASSIFICATION="$(timeout "${FAST_DRAFT_TIMEOUT_SECONDS}s" "$FAST_DRAFT_HELPER" classify "$FAST_DRAFT_INPUT" 2>/dev/null || true)"
  FAST_DRAFT_CONTEXT="$(timeout "${FAST_DRAFT_TIMEOUT_SECONDS}s" "$FAST_DRAFT_HELPER" context "$FAST_DRAFT_INPUT" 2>/dev/null || true)"
  FAST_DRAFT_DRAFT="$(timeout "${FAST_DRAFT_TIMEOUT_SECONDS}s" "$FAST_DRAFT_HELPER" draft "$FAST_DRAFT_INPUT" 2>/dev/null || true)"
fi

python3 - "$FAST_DRAFT_PACKET_JSON" "$FAST_DRAFT_CLASSIFICATION" "$FAST_DRAFT_CONTEXT" "$FAST_DRAFT_DRAFT" <<'PY'
import json
import pathlib
import sys

packet_path, classification, context, draft = sys.argv[1:5]
packet = {
    "classifier": classification.strip(),
    "context": context.strip(),
    "draft": draft.strip(),
}
pathlib.Path(packet_path).write_text(json.dumps(packet, ensure_ascii=False, indent=2), encoding="utf-8")
PY

python3 - "$MODEL_BASE_URL" "$MODEL_API_KEY" "$MODEL_NAME" "$REQUEST_TEXT" "$MODEL_ROUTING_POLICY_FILE" "$FAST_DRAFT_PACKET_JSON" "$QWEN40_JUDGE_MODE" "$MODEL_RUNTIME_FILE" "$HERMES_RUNTIME_VIEW_FILE" "$HERMES_WATCHDOG_EVENTS" > "$PLAN_JSON" <<'PY'
import json
import collections
import pathlib
import re
import sys
import urllib.request

base_url, api_key, model, request_text, routing_policy_path, fast_draft_packet_path, judge_mode, model_runtime_path, hermes_runtime_view_path, watchdog_events_path = sys.argv[1:11]
model_routing_policy = ""
policy_path = pathlib.Path(routing_policy_path)
if policy_path.exists():
    model_routing_policy = policy_path.read_text(encoding="utf-8")[:9000]
root_dir = policy_path.parents[2] if len(policy_path.parents) >= 3 else pathlib.Path(".")
fast_draft_packet = {"classifier": "", "context": "", "draft": ""}
packet_path = pathlib.Path(fast_draft_packet_path)
if packet_path.exists():
    fast_draft_packet.update(json.loads(packet_path.read_text(encoding="utf-8")))

def load_json_file(path_text):
    path = pathlib.Path(path_text)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}

model_runtime = load_json_file(model_runtime_path)
hermes_runtime_view = load_json_file(hermes_runtime_view_path)

def active_runtime_role(role):
    view_roles = hermes_runtime_view.get("activeRoles") or {}
    if role in view_roles:
        return view_roles[role]
    active_id = ((model_runtime.get("selectionPolicy") or {}).get("activeRoles") or {}).get(role)
    for profile in model_runtime.get("profiles", []):
        if profile.get("id") == active_id:
            return profile
    return {}

runtime_sub = active_runtime_role("sub")
runtime_translation = active_runtime_role("translation")
runtime_main = active_runtime_role("main")

def runtime_model(role, fallback_model, fallback_base_url):
    profile = {"sub": runtime_sub, "translation": runtime_translation, "main": runtime_main}.get(role) or {}
    return profile.get("modelAlias") or fallback_model, profile.get("baseUrl") or fallback_base_url

fast_draft_model_name, fast_draft_base_url = runtime_model("sub", "qwen2.5-coder-7b-instruct-shadow", "http://127.0.0.1:24751/v1")
translation_model_name, translation_base_url = runtime_model("translation", "gemma4-e4b-gpu-shadow", "http://127.0.0.1:24451/v1")
judge_model_name, judge_base_url = runtime_model("main", model, base_url)
default_active_work_kind = hermes_runtime_view.get("activeWorkKind") or ((model_runtime.get("selectionPolicy") or {}).get("activeWorkKind") or "page-development")

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
        try:
            return json.loads(raw[start:end + 1], strict=False)
        except Exception:
            return {}

def load_watchdog_feedback(path_text, limit=5):
    path = pathlib.Path(path_text)
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8", errors="ignore") as handle:
            lines = list(collections.deque(handle, maxlen=limit))
    except Exception:
        return []
    feedback_items = []
    for line in lines:
        try:
            event = json.loads(line)
        except Exception:
            continue
        feedback = str(event.get("feedback") or "").strip()
        parsed = extract_json(feedback)
        feedback_items.append({
            "ts": event.get("ts"),
            "taskId": event.get("taskId"),
            "checkpointStage": event.get("checkpointStage"),
            "supervisorModel": event.get("supervisorModel"),
            "severity": parsed.get("severity") if parsed else "",
            "signals": parsed.get("signals") if isinstance(parsed.get("signals"), list) else [],
            "nextAction": parsed.get("nextAction") if parsed else "",
            "feedback": str(parsed.get("feedback") if parsed else feedback)[:900],
            "sourceRef": event.get("planPath"),
        })
    return feedback_items

def load_interruption_handoffs(root, limit=3):
    handoff_dir = pathlib.Path(root) / "var" / "ai-runtime" / "hermes-cli" / "interrupted"
    if not handoff_dir.exists():
        return []
    files = sorted(handoff_dir.glob("*.handoff.json"), key=lambda item: item.stat().st_mtime, reverse=True)[:limit]
    items = []
    for file in files:
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
        except Exception:
            continue
        items.append({
            "ts": data.get("ts"),
            "taskId": data.get("taskId"),
            "checkpointStage": "INTERRUPTED_NEEDS_CONTINUATION",
            "supervisorModel": "hermes-launcher",
            "severity": "HIGH",
            "signals": ["interrupted-session-handoff"],
            "nextAction": "Open handoff and finish the interrupted task before treating the next message as a replacement.",
            "feedback": "Hermes had an interrupted session. Preserve unfinished patch/verification context and continue from the handoff before accepting success.",
            "sourceRef": str(file),
            "resumeCommand": data.get("resumeCommand") or "",
            "stdoutRef": data.get("stdoutRef") or "",
            "stderrRef": data.get("stderrRef") or "",
        })
    return items

def parse_model_json(content):
    start = content.find("{")
    end = content.rfind("}")
    if start < 0 or end < start:
        raise ValueError("model did not return JSON")
    raw = content[start:end + 1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return json.loads(raw, strict=False)

classifier = extract_json(fast_draft_packet.get("classifier", ""))
context_pack = extract_json(fast_draft_packet.get("context", ""))
watchdog_feedback_block = load_watchdog_feedback(watchdog_events_path)
watchdog_feedback_block = (load_interruption_handoffs(root_dir) + watchdog_feedback_block)[:8]

def infer_work_kind():
    work_kinds = hermes_runtime_view.get("workKinds") or model_runtime.get("workKinds") or []
    valid_ids = {str(item.get("id")) for item in work_kinds if item.get("id")}
    haystack = " ".join(
        str(part or "")
        for part in [
            request_text,
            classifier.get("taskType"),
            classifier.get("modelLane"),
            classifier.get("reason"),
            context_pack.get("primarySkill"),
        ]
    ).lower()
    explicit_rules = [
        ("ai-team-os", ["hermes", "에르메스", "watchdog", "무한 루프", "반복 루프", "iteration budget", "작업 추출", "모델 런타임", "runtime registry", "17890", "에이전트", "조직도", "팀 단위", "동적 기동"]),
    ]
    for work_kind, needles in explicit_rules:
        if work_kind in valid_ids and any(needle in haystack for needle in needles):
            return work_kind
    classifier_kind = str(classifier.get("workKind") or classifier.get("activeWorkKind") or "").strip()
    if classifier_kind in valid_ids:
        return classifier_kind
    rules = [
        ("db-management", ["cubrid", "broker", "cas", "sql", "query", "쿼리", "디비", "db ", "database", "데이터베이스", "튜닝", "인덱스", "index", "explain", "실행계획"]),
        ("web-pod-management", ["pod", "파드", "k8s", "kubernetes", "deployment", "rollout", "sidecar", "사이드카", "nginx"]),
        ("ai-team-os", ["ai team", "agent team", "team os", "모델 런타임", "runtime registry", "17890", "에이전트", "조직도", "팀 단위", "동적 기동"]),
        ("design-build", ["디자인", "layout", "레이아웃", "krds", "theme", "테마", "css", "figma", "ui/ux", "퍼블리싱"]),
        ("translation", ["번역", "glossary", "용어", "다국어", "언어변환"]),
        ("ops-triage", ["로그", "log", "장애", "incident", "monitor", "모니터링", "운영", "재시작"]),
        ("risk-review", ["권한", "permission", "security", "보안", "결제", "payment", "감사", "audit", "승인"]),
    ]
    for work_kind, needles in rules:
        if work_kind in valid_ids and any(needle in haystack for needle in needles):
            return work_kind
    return default_active_work_kind

active_work_kind = infer_work_kind()

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
    if not fast_draft_packet.get("classifier") and not fast_draft_packet.get("draft"):
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

def qwen7_plan():
    task_type = str(classifier.get("taskType") or "general")
    risk = normalize_risk(classifier.get("risk"))
    lane = str(classifier.get("modelLane") or "fast-draft")
    if lane not in {"translation", "dev-classify", "fast-draft", "mid-draft", "design-specialist", "math", "agent-candidate", "judge", "verify"}:
        lane = "fast-draft"
    if lane == "judge" and not should_call_judge():
        lane = "fast-draft"
    lane_defaults = {
        "translation": (translation_model_name, translation_base_url),
        "dev-classify": (fast_draft_model_name, fast_draft_base_url),
        "fast-draft": (fast_draft_model_name, fast_draft_base_url),
        "mid-draft": (fast_draft_model_name, fast_draft_base_url),
        "design-specialist": (translation_model_name, translation_base_url),
        "math": ("qwen-math:7b", "http://127.0.0.1:24117/v1"),
        "agent-candidate": ("qwen3.5-9b-q4_k_m", "http://127.0.0.1:24119/v1"),
        "verify": ("codex-scripts", ""),
        "judge": (judge_model_name, judge_base_url),
    }
    selected_model, selected_base_url = lane_defaults.get(lane, lane_defaults["fast-draft"])
    support_lanes = ["dev-classify", "fast-draft", "verify"]
    if any(term in request_text.lower() for term in ["디자인", "레이아웃", "krds", "theme", "테마", "퍼블리싱", "화면"]):
        support_lanes.append("design-specialist")
    if any(term in request_text.lower() for term in ["번역", "용어", "glossary", "다국어"]):
        support_lanes.append("translation")
    primary_skill = context_pack.get("primarySkill") or classifier.get("primarySkill") or ""
    draft = fast_draft_packet.get("draft", "").strip()
    summary = draft.splitlines()[0][:500] if draft else str(classifier.get("reason") or "14B fast-draft primary routing")
    docs, doc_hints = existing_relative_values(list_value(context_pack, "docs") or list_value(classifier, "docs"))
    candidate_paths, candidate_path_hints = existing_relative_values(list_value(context_pack, "candidatePaths") or list_value(classifier, "candidatePaths"))
    writable_boundaries, writable_boundary_hints = existing_relative_values(list_value(context_pack, "writableBoundaries"))
    verification = list_value(context_pack, "verificationCommands")
    if not verification:
        verification = ["TODO"]
    return {
        "taskType": task_type,
        "riskLevel": risk,
        "interpretedIntent": request_text[:1200],
        "targetRoute": "",
        "targetModule": "",
        "targetDbName": "carbonet",
        "planSummary": summary,
        "stages": [
            {"stageCode": "REQUEST_CAPTURE", "title": "Request captured", "instruction": "사용자 요청 원문과 목표를 기록한다.", "expectedEvidence": "request_text", "executor": "HERMES"},
            {"stageCode": "INTENT_PARSE", "title": "Runtime submodel intent classification", "instruction": f"선택된 서브 모델({fast_draft_model_name})이 작업 유형, 위험도, 모델 lane을 먼저 분류한다.", "expectedEvidence": "fast-draft classifier packet", "executor": "RUNTIME_FAST_DRAFT"},
            {"stageCode": "SCOPE_ROUTE", "title": "Runtime submodel context pack", "instruction": f"선택된 서브 모델({fast_draft_model_name})이 최소 skill/docs/path 후보와 검증 후보를 제안한다.", "expectedEvidence": "fast-draft context packet", "executor": "RUNTIME_FAST_DRAFT"},
            {"stageCode": "PRECHECK", "title": "Deterministic precheck", "instruction": "후보 파일과 등록 스크립트는 Codex가 실제 파일 시스템과 DB에서 확인한다.", "expectedEvidence": "file/db/script existence checks", "executor": "CODEX_SCRIPT"},
            {"stageCode": "IMPLEMENT", "title": "Bounded runtime draft support", "instruction": "일반 개발 초안은 선택된 서브 모델 draft를 참고하되 실제 수정은 Codex가 적용한다.", "expectedEvidence": "source diff or no-change note", "executor": "CODEX"},
            {"stageCode": "VERIFY", "title": "Deterministic verification", "instruction": "검증은 모델이 아니라 등록된 스크립트와 런타임 증거로 수행한다.", "expectedEvidence": ", ".join(verification), "executor": "CODEX_SCRIPT"},
            {"stageCode": "REFLECT", "title": "Reflect and improve", "instruction": "7B 판단, watchdog 피드백, 실제 결과, 승격 필요 여부를 다음 작업 패턴에 반영한다.", "expectedEvidence": "hermes task event and model decision", "executor": "HERMES"},
        ],
        "modelDecision": {
            "selectedModel": selected_model,
            "fallbackModel": "qwen3.6-40b-deck-opus-q4",
            "selectedLane": lane,
            "supportLanes": support_lanes,
            "preferredBaseUrl": selected_base_url,
            "downloadPolicy": "local-registered-only",
            "activeWorkKind": active_work_kind,
            "runtimeRegistry": model_runtime_path,
            "hermesRuntimeView": hermes_runtime_view_path,
            "watchdogFeedbackPath": watchdog_events_path,
            "watchdogFeedbackBlock": watchdog_feedback_block,
            "fastDraftAdvisoryUsed": bool(fast_draft_packet.get("classifier") or fast_draft_packet.get("draft")),
            "fastDraftClassifier": fast_draft_packet.get("classifier", "")[:2000],
            "fastDraftContext": fast_draft_packet.get("context", "")[:2000],
            "fastDraftAdvisory": draft[:2000],
            "qwen40JudgeMode": judge_mode,
            "qwen40JudgeSkipped": True,
            "contextPack": {
                "primarySkill": primary_skill,
                "secondarySkill": context_pack.get("secondarySkill") or "",
                "docs": docs,
                "docHintsUnverified": doc_hints,
                "candidatePaths": candidate_paths,
                "candidatePathHintsUnverified": candidate_path_hints,
                "writableBoundaries": writable_boundaries,
                "writableBoundaryHintsUnverified": writable_boundary_hints,
                "verificationCommands": verification,
            },
            "reason": str(classifier.get("reason") or f"{fast_draft_model_name} primary path selected; judge not required by policy."),
        },
    }

if not should_call_judge():
    print(json.dumps(qwen7_plan(), ensure_ascii=False, indent=2))
    raise SystemExit(0)

system = """You are Hermes command interpreter for Carbonet/Resonance.
Use Korean.
Return strict JSON only.
Do not invent execution results.
Classify the request into frontend, backend, database, scripts, kubernetes, ai, logs, deploy, or general.
Risk levels: LOW, MEDIUM, HIGH, CRITICAL.
Always produce ordered stages using only these stage codes:
REQUEST_CAPTURE, INTENT_PARSE, SCOPE_ROUTE, PRECHECK, IMPLEMENT, VERIFY, REFLECT.
The configured judge is escalation judge, not the default worker. Codex/scripts execute. The runtime-selected sub model is the primary bounded development classifier/context/draft model.
Do not route by loading all Skills/Docs. First choose a bounded model lane and context pack.
Model lanes:
- translation: Gemma4 GPU local first, default gemma4-e4b-gpu-shadow on http://127.0.0.1:24451/v1, for translation/glossary/product-name mapping.
- dev-classify: runtime-selected sub model local first for classification/log summary/candidate docs only. Smaller Qwen lanes remain fallback support.
- fast-draft: runtime-selected sub model local first. Normal development work must call this lane before judge review.
- mid-draft: runtime-selected stronger submodel lane; use this lane name only for explicit stronger-pattern fallback or benchmarking notes.
- design-specialist: Gemma4 CPU plus the design/theme/RAG DB first for KRDS, layout, copy, and visual consistency review. It may draft design checks but must not write production source alone.
- math: Qwen Math local first, default qwen-math:7b on http://127.0.0.1:24117/v1, for formulas, unit conversion, and numeric validation.
- agent-candidate: Qwen3.5 9B local candidate, default qwen3.5-9b-q4_k_m on http://127.0.0.1:24119/v1, for benchmarked general reasoning or agent planning before promotion.
- judge: Qwen3.6 40B for architecture, risky implementation, final review, failure interpretation.
- verify: deterministic Codex/scripts for build, tests, runtime and DB evidence.
SuperGemma 26B is retired and must not be selected. Qwen3.6 40B is the fixed main model; use 7B CPU for supervision/checkpoints and Gemma4 GPU for small translation only.
Before choosing the next stage, read recent watchdog feedback. Deterministic command, DB, and runtime evidence overrides model confidence.
Do not select Qwen3 small models for local lanes.
Never download HuggingFace models during a normal request. Use registered local endpoints first; if a model is missing, select a fallback and record setup as a separate task.
Let the runtime-selected submodel draft normal bounded source work first. Escalate DB migration, permission, security, shared API/DTO/mapper contracts, architecture, failure interpretation, and unclear confidence to judge.
Do not invent command-line flags or script names. In verificationCommands, use known project scripts from the policy/context only; if no exact command is known, write TODO."""
user = f"""요청 원문:
{request_text}

모델 라우팅 정책:
{model_routing_policy}

Runtime-selected submodel classifier packet:
{fast_draft_packet.get("classifier", "").strip() or "unavailable"}

Runtime-selected submodel context packet:
{fast_draft_packet.get("context", "").strip() or "unavailable"}

Runtime-selected submodel draft packet:
{fast_draft_packet.get("draft", "").strip() or "unavailable"}

Recent Hermes watchdog feedback:
{json.dumps(watchdog_feedback_block, ensure_ascii=False, indent=2) if watchdog_feedback_block else "[]"}

JSON schema:
{{
  "taskType": "...",
  "riskLevel": "...",
  "interpretedIntent": "...",
  "targetRoute": "",
  "targetModule": "",
  "targetDbName": "carbonet",
  "planSummary": "...",
  "stages": [
    {{"stageCode":"REQUEST_CAPTURE","title":"...","instruction":"...","expectedEvidence":"...","executor":"HERMES"}}
  ],
  "modelDecision": {{
    "selectedModel":"gemma4-e4b-gpu-shadow | qwen2.5-coder-7b-instruct-shadow | qwen-math:7b | qwen3.5-9b-q4_k_m | qwen3.6-40b-deck-opus-q4 | codex-scripts",
    "fallbackModel":"codex",
    "selectedLane":"translation | dev-classify | fast-draft | mid-draft | design-specialist | math | agent-candidate | judge | verify",
    "supportLanes":["translation","dev-classify","fast-draft","mid-draft","design-specialist","math","agent-candidate","verify"],
    "preferredBaseUrl":"",
    "downloadPolicy":"local-registered-only",
    "fastDraftAdvisoryUsed": false,
    "qwen40JudgeMode": "auto",
    "qwen40JudgeSkipped": false,
    "watchdogFeedbackPath": "",
    "watchdogFeedbackBlock": [],
    "fastDraftAdvisory": "",
    "contextPack": {{
      "primarySkill":"",
      "secondarySkill":"",
      "docs":[],
      "candidatePaths":[],
      "writableBoundaries":[],
      "verificationCommands":[]
    }},
    "reason":"..."
  }}
}}"""
payload = {
    "model": model,
    "temperature": 0,
    "max_tokens": 4096,
    "response_format": {"type": "json_object"},
    "messages": [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ],
}
request = urllib.request.Request(
    base_url.rstrip("/") + "/chat/completions",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(request, timeout=300) as response:
    data = json.loads(response.read().decode("utf-8"))
content = data["choices"][0]["message"]["content"]
try:
    plan = parse_model_json(content)
except Exception as exc:
    fallback = qwen7_plan()
    fallback["riskLevel"] = "MEDIUM"
    fallback["planSummary"] = "Judge model returned invalid JSON; Hermes fell back to the deterministic 14B-style plan and recorded the judge parse failure."
    fallback.setdefault("modelDecision", {})
    fallback["modelDecision"]["selectedModel"] = fast_draft_model_name
    fallback["modelDecision"]["fallbackModel"] = model
    fallback["modelDecision"]["selectedLane"] = "fast-draft"
    fallback["modelDecision"]["qwen40JudgeSkipped"] = False
    fallback["modelDecision"]["judgeParseFailed"] = True
    fallback["modelDecision"]["judgeParseError"] = str(exc)[:500]
    fallback["modelDecision"]["judgeRawPreview"] = content[:2000]
    plan = fallback
decision = plan.setdefault("modelDecision", {})
advisory = fast_draft_packet.get("draft", "").strip()
decision["fastDraftAdvisoryUsed"] = bool(advisory or fast_draft_packet.get("classifier"))
decision["fastDraftClassifier"] = fast_draft_packet.get("classifier", "")[:2000]
decision["fastDraftContext"] = fast_draft_packet.get("context", "")[:2000]
decision["qwen40JudgeMode"] = judge_mode
decision["qwen40JudgeSkipped"] = False
if advisory:
    decision["fastDraftAdvisory"] = advisory[:2000]
support_lanes = decision.get("supportLanes")
if not isinstance(support_lanes, list):
    support_lanes = []
if "fast-draft" not in support_lanes:
    support_lanes.append("fast-draft")
decision["supportLanes"] = support_lanes
decision.setdefault("activeWorkKind", active_work_kind)
decision.setdefault("runtimeRegistry", model_runtime_path)
decision.setdefault("hermesRuntimeView", hermes_runtime_view_path)
decision.setdefault("watchdogFeedbackPath", watchdog_events_path)
decision.setdefault("watchdogFeedbackBlock", watchdog_feedback_block)
print(json.dumps(plan, ensure_ascii=False, indent=2))
PY

bash "$ROOT_DIR/ops/scripts/hermes-resolve-pattern.sh" --request "$REQUEST_TEXT" --plan "$PLAN_JSON" --team-file "$TEAM_FILE" --out "$RESOLUTION_JSON"

python3 - "$ROOT_DIR" "$TASK_ID" "$TRACE_ID" "$REQUEST_TEXT" "$PLAN_JSON" "$RESOLUTION_JSON" "$EVENT_JSONL" "$NAMESPACE" "$CUBRID_POD" "$DB_NAME" "$DB_USER" <<'PY'
import datetime
import json
import pathlib
import re
import subprocess
import sys

root, task_id, trace_id, request_text, plan_json, resolution_json, event_jsonl, namespace, pod, db_name, db_user = sys.argv[1:12]
plan_path = pathlib.Path(plan_json)
plan = json.loads(plan_path.read_text(encoding="utf-8"))
resolution_path = pathlib.Path(resolution_json)
resolution = json.loads(resolution_path.read_text(encoding="utf-8")) if resolution_path.exists() else {}
work_dir = pathlib.Path(root) / "var" / "ai-runtime" / "hermes-workflow" / "sql"
work_dir.mkdir(parents=True, exist_ok=True)

def lit(value, limit=3900):
    text = "" if value is None else str(value)
    text = text.replace("\r", " ").replace("\n", " ").strip()
    return "'" + text[:limit].replace("'", "''") + "'"

def clob(value):
    return lit(value, 3900)

def run(cmd):
    result = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
    if result.returncode != 0:
        raise SystemExit(result.stdout)
    return result.stdout

def psql_read(sql):
    escaped = sql.replace('"', '\\"')
    result = subprocess.run(
        ["kubectl", "-n", namespace, "exec", pod, "--", "bash", "-lc", f'psql -U {db_user} -d {db_name} -c "{escaped}"'],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
        env={**os.environ, "PGPASSWORD": "postgres123"},
    )
    return result.stdout[-3900:]

def request_search_terms(value):
    defaults = [
        "screen-builder", "screenbuilder", "environment-management", "menu-management",
        "theme", "component", "builder", "asset", "admin", "hermes", "codex",
        "empty", "page", "design", "placeholder", "migrationpage", "빈", "화면", "설계",
    ]
    terms = []
    for token in re.findall(r"[0-9A-Za-z가-힣_-]{2,}", value.lower()):
        if token not in terms:
            terms.append(token)
    for token in defaults:
        if token not in terms:
            terms.append(token)
    return terms[:14]

def like_clause(columns, terms):
    clauses = []
    for term in terms:
        safe = term.replace("'", "''").replace("%", "").replace('"', "")
        if not safe:
            continue
        for column in columns:
            clauses.append(f"lower({column}) like '%{safe}%'")
    return " or ".join(clauses) or "1=1"

now = int(datetime.datetime.now().timestamp())
task_type = plan.get("taskType") or "GENERAL"
risk = plan.get("riskLevel") or "MEDIUM"
target_route = plan.get("targetRoute") or ""
target_module = plan.get("targetModule") or ""
target_db = plan.get("targetDbName") or "carbonet"
intent = plan.get("interpretedIntent") or ""
summary = plan.get("planSummary") or ""
stages = plan.get("stages") or []
pattern = resolution.get("selectedPattern") or {}
pattern_steps = resolution.get("steps") or []
selected_stages = pattern_steps or stages
pattern_id = pattern.get("patternId") or ""
pattern_name = pattern.get("patternName") or ""
pattern_category = pattern.get("categoryCode") or ""
confidence = resolution.get("confidenceScore") or 0
agent_team_selection = resolution.get("agentTeamSelection") or {}
decision = plan.get("modelDecision") or {}
selected_lane = str(decision.get("selectedLane") or "judge")
selected_support_model = str(decision.get("selectedModel") or decision.get("executionModel") or "qwen3.6-40b-deck-opus-q4")
asset_terms = request_search_terms(request_text)
asset_clause = like_clause(["source_path", "asset_name", "owner_scope", "owner_domain"], asset_terms)
tree_clause = like_clause(["node_path", "owner_domain", "language_hint"], asset_terms)
framework_clause = like_clause(["node_path", "node_name", "framework_role", "package_name"], asset_terms)
code_clause = like_clause(["source_path", "symbol_name", "pattern_code"], asset_terms)
binding_clause = like_clause(["asset_path", "pattern_id", "pattern_scope"], asset_terms)
gap_clause = like_clause(["source_path", "page_name", "target_route", "builder_role", "gap_type"], asset_terms)
empty_clause = like_clause(["page_name", "route_path", "component_path", "empty_type"], asset_terms)
design_clause = like_clause(["source_path", "title", "artifact_type", "target_page_hint", "target_route_hint"], asset_terms)
work_queue_clause = like_clause(["page_name", "route_path", "component_path", "request_type"], asset_terms)
design_ref_clause = like_clause(["source_path", "target_page_name", "target_route", "target_component_path", "reference_kind"], asset_terms)
theme_token_clause = like_clause(["theme_set_id", "token_group", "token_name", "token_role"], asset_terms)
ui_pattern_clause = like_clause(["pattern_family", "pattern_name", "owner_scope", "canonical_component_path", "allowed_use_context"], asset_terms)
css_selector_clause = like_clause(["source_path", "selector_text", "selector_kind"], asset_terms)
css_decl_clause = like_clause(["source_path", "selector_text", "property_name", "property_value", "token_name", "token_group"], asset_terms)
design_memory_clause = like_clause(["pattern_layer", "pattern_name", "pattern_role", "recommended_context"], asset_terms)
brand_memory_clause = like_clause(["memory_scope", "memory_name", "memory_type"], asset_terms)
ux_pattern_clause = like_clause(["interaction_family", "pattern_name", "trigger_event", "expected_feedback"], asset_terms)
platform_clause = like_clause(["layer_name", "layer_type", "source_of_truth"], asset_terms)
os_package_clause = like_clause(["package_name", "package_role", "install_policy", "service_name"], asset_terms)
container_service_clause = like_clause(["service_name", "compose_path", "dockerfile_path", "image_name"], asset_terms)
build_unit_clause = like_clause(["build_unit_name", "build_unit_type", "source_path", "build_command", "verification_command"], asset_terms)
page_design_clause = like_clause(["page_id", "page_name", "route_path", "component_path", "implementation_status", "page_archetype"], asset_terms)
quality_score_clause = like_clause(["page_id", "route_path", "component_path", "completion_level", "top_gap_summary", "next_action"], asset_terms)
dimension_score_clause = like_clause(["page_id", "dimension_code", "gap_summary"], asset_terms)
branch_decision_clause = like_clause(["page_id", "branch_code", "branch_name", "development_stage", "required_rag_query", "branch_reason"], asset_terms)
development_rag_clause = like_clause(["chunk_title", "chunk_text", "route_hint", "page_id_hint", "pattern_id_hint", "quality_dimension_hint"], asset_terms)

def model_role_for_stage(stage_code):
    if stage_code in {"VERIFY"}:
        return "CODEX_SCRIPT_VERIFY"
    if stage_code in {"REQUEST_CAPTURE", "INTENT_PARSE", "SCOPE_ROUTE", "PRECHECK"}:
        return f"HERMES_{selected_lane.upper()}_ROUTER"[:80]
    if stage_code in {"IMPLEMENT"} and selected_lane in {"translation", "dev-classify", "fast-draft", "mid-draft", "math", "agent-candidate"}:
        return f"{selected_lane}:{selected_support_model}"[:80]
    if selected_lane in {"verify"}:
        return "CODEX_SCRIPT"
    return "QWEN40_JUDGE"
safe_pattern_id = pattern_id.replace("'", "''")
registered_work_order = {
    "systemAssetSearchTerms": asset_terms,
    "systemAssets": psql_read(f"select asset_type, asset_name, source_path, owner_domain, owner_scope from system_asset_inventory where active_yn='Y' and ({asset_clause}) order by last_scan_at desc limit 40;"),
    "systemTree": psql_read(f"select node_type, node_depth, node_path, owner_domain, language_hint from system_asset_tree_snapshot where active_yn='Y' and ({tree_clause}) order by node_depth, node_path limit 40;"),
    "systemFramework": psql_read(f"select structure_type, node_name, node_path, framework_role, build_tool from system_asset_framework_structure where active_yn='Y' and ({framework_clause}) order by structure_type, node_path limit 30;"),
    "systemCodeStructures": psql_read(f"select symbol_type, symbol_name, source_path, pattern_code, line_no from system_asset_code_structure where active_yn='Y' and ({code_clause}) order by source_path, line_no limit 50;"),
    "developmentPatternBindings": psql_read(f"select asset_path, pattern_id, pattern_scope, confidence_score from system_asset_development_pattern_binding where active_yn='Y' and ({binding_clause}) order by confidence_score desc limit 40;"),
    "builderPageGaps": psql_read(f"select gap_type, page_name, source_path, target_route, builder_role, priority_score from system_builder_page_gap where active_yn='Y' and gap_status='OPEN' and ({gap_clause}) order by priority_score desc, page_name limit 50;"),
    "emptyPages": psql_read(f"select page_name, route_path, component_path, empty_type, severity_score from system_empty_page_inventory where active_yn='Y' and ({empty_clause}) order by severity_score desc, page_name limit 50;"),
    "designArtifacts": psql_read(f"select artifact_type, title, source_path, canonical_priority, target_route_hint from system_design_artifact_registry where active_yn='Y' and ({design_clause}) order by canonical_priority desc, title limit 50;"),
    "designReferences": psql_read(f"select reference_kind, target_page_name, target_route, target_component_path, match_confidence, usage_policy from system_design_reference_map where active_yn='Y' and ({design_ref_clause}) order by match_confidence desc, target_page_name limit 50;"),
    "themeTokens": psql_read(f"select theme_set_id, token_group, token_name, token_value, token_role, approval_state from system_theme_token_registry where active_yn='Y' and ({theme_token_clause}) order by approval_state, token_group, token_name limit 50;"),
    "uiComponentPatterns": psql_read(f"select pattern_family, pattern_name, owner_scope, canonical_component_path, theme_set_id from system_ui_component_pattern_registry where active_yn='Y' and ({ui_pattern_clause}) order by pattern_family, pattern_name limit 50;"),
    "cssSelectors": psql_read(f"select selector_kind, selector_text, source_path, declaration_count from system_css_selector_registry where active_yn='Y' and ({css_selector_clause}) order by selector_kind, selector_text limit 50;"),
    "cssDeclarations": psql_read(f"select token_group, token_name, property_name, property_value, selector_text from system_css_declaration_registry where active_yn='Y' and ({css_decl_clause}) order by token_group, property_name limit 50;"),
    "designPatterns": psql_read(f"select pattern_layer, pattern_name, pattern_role, approval_state from system_design_pattern_registry where active_yn='Y' and ({design_memory_clause}) order by approval_state, pattern_layer, pattern_name limit 50;"),
    "brandMemory": psql_read(f"select memory_scope, memory_name, memory_type, approval_state from system_brand_memory_registry where active_yn='Y' and ({brand_memory_clause}) order by approval_state, memory_scope, memory_name limit 50;"),
    "uxInteractionPatterns": psql_read(f"select interaction_family, pattern_name, trigger_event, expected_feedback from system_ux_interaction_pattern_registry where active_yn='Y' and ({ux_pattern_clause}) order by interaction_family, pattern_name limit 50;"),
    "accessibilityRules": psql_read("select rule_family, rule_name, severity_score, verification_hint from system_accessibility_rule_registry where active_yn='Y' order by severity_score desc, rule_family, rule_name limit 50;"),
    "aiDesignRules": psql_read("select rule_stage, rule_name, required_registry, verification_evidence from system_ai_design_generation_rule where active_yn='Y' order by rule_stage, rule_name limit 50;"),
    "platformLayers": psql_read(f"select layer_order, layer_name, layer_type, source_of_truth from system_platform_layer_registry where active_yn='Y' and ({platform_clause}) order by layer_order limit 50;"),
    "osPackages": psql_read(f"select os_family, package_name, package_role, service_name from system_os_package_registry where active_yn='Y' and ({os_package_clause}) order by os_family, package_name limit 50;"),
    "containerServices": psql_read(f"select service_name, compose_path, dockerfile_path, image_name, port_mapping, restart_policy from system_container_service_registry where active_yn='Y' and ({container_service_clause}) order by service_name limit 50;"),
    "buildUnits": psql_read(f"select build_unit_name, build_unit_type, source_path, build_command, verification_command from system_build_unit_registry where active_yn='Y' and ({build_unit_clause}) order by build_unit_type, build_unit_name limit 50;"),
    "modelLanePolicies": psql_read("select lane_id, lane_order, lane_name, preferred_model, preferred_base_url, download_policy, active_yn from hermes_model_lane_policy where project_id='carbonet' order by lane_order;"),
    "modelCandidates": psql_read("select candidate_model_id, model_name, candidate_role, status, allowed_use, forbidden_use, benchmark_gate from hermes_model_candidate_registry where project_id='carbonet' and active_yn='Y' order by candidate_order;"),
    "agentTeamRegistry": psql_read("select team_id, team_name, default_start_mode, primary_model, fallback_model, scope_summary from hermes_agent_team_registry where project_id='carbonet' and active_yn='Y' order by team_order;"),
    "workKindRoutes": psql_read("select work_kind_id, work_kind_name, primary_team_ids_json, gate_team_ids_json, support_lane_json, required_preflight_json from hermes_work_kind_model_route where project_id='carbonet' and active_yn='Y' order by route_order;"),
    "developmentPreflightRoutes": psql_read("select route_order, route_code, route_name, required_output from system_development_preflight_route where active_yn='Y' order by route_order;"),
    "pageDesignRegistry": psql_read(f"select page_id, page_name, route_path, menu_code, implementation_status, page_archetype, builder_ready_status, priority_score from system_page_design_registry where active_yn='Y' and ({page_design_clause}) order by priority_score desc, page_id limit 50;"),
    "pageQualityScores": psql_read(f"select page_id, route_path, implementation_status, quality_score, score_grade, completion_level, service_ready_yn, top_gap_summary from system_page_development_quality_score where active_yn='Y' and ({quality_score_clause}) order by service_ready_yn, quality_score, priority_score desc limit 50;"),
    "pageQualityDimensions": psql_read(f"select page_id, dimension_code, raw_score, pass_yn, gap_summary from system_page_quality_dimension_score where active_yn='Y' and ({dimension_score_clause}) order by raw_score, page_id limit 80;"),
    "developmentBranchDecisions": psql_read(f"select page_id, branch_code, development_stage, existing_page_skip_yn, selected_pattern_id, required_rag_query from system_page_development_branch_decision where active_yn='Y' and ({branch_decision_clause}) order by existing_page_skip_yn, development_stage, page_id limit 60;"),
    "developmentRagChunks": psql_read(f"select chunk_kind, chunk_title, route_hint, page_id_hint, pattern_id_hint, quality_dimension_hint, relevance_score from system_development_rag_chunk where active_yn='Y' and ({development_rag_clause}) order by relevance_score desc, chunk_kind, chunk_title limit 80;"),
    "builderWorkRequests": psql_read(f"select request_type, page_name, route_path, component_path, priority_score from system_builder_work_request_queue where active_yn='Y' and request_status='READY' and ({work_queue_clause}) order by priority_score desc, page_name limit 50;"),
    "guardPolicies": psql_read("select guard_order, guard_code, guard_stage, guard_name from hermes_work_execution_guard_policy where active_yn='Y' order by guard_order;"),
    "patternSteps": psql_read(f"select step_order, stage_code, step_title from hermes_development_pattern_step where pattern_id='{safe_pattern_id}' and active_yn='Y' order by step_order;") if pattern_id else "",
    "patternChecks": psql_read(f"select check_order, check_type, substr(cast(command_template as varchar(1000)),1,220) from hermes_development_pattern_check where pattern_id='{safe_pattern_id}' and active_yn='Y' order by check_order;") if pattern_id else "",
    "patternTeams": psql_read(f"select team_role, team_id from hermes_development_pattern_team_rule where pattern_id='{safe_pattern_id}' and active_yn='Y' order by team_role, team_id;") if pattern_id else "",
    "knowledgeAssets": psql_read(f"select asset_type, asset_path, primary_team_id from hermes_project_knowledge_asset where active_yn='Y' and (primary_pattern_id='{safe_pattern_id}' or asset_path like '%hermes%' or asset_path like '%codex%') order by frst_regist_pnttm desc limit 30;") if pattern_id else "",
}

statements = [
    "INSERT INTO hermes_task (hermes_task_id, project_id, trace_id, user_request, interpreted_intent, task_type, risk_level, status, owner_model, executor_type, target_route, target_module, target_db_name, plan_summary, evidence_root, requested_by) VALUES ("
    + ", ".join([
        lit(task_id, 80),
        "'carbonet'",
        lit(trace_id, 80),
        clob(request_text),
        clob(intent),
        lit(task_type, 80),
        lit(risk, 30),
        "'INTERPRETED'",
        lit(decision.get("selectedModel") or "qwen3.6-40b-deck-opus-q4", 120),
        "'CODEX_SCRIPT'",
        lit(target_route, 500),
        lit(target_module, 300),
        lit(target_db, 120),
        clob(summary),
        lit(str(resolution_path), 1000),
        "'hermes'",
    ])
    + ");",
    "INSERT INTO hermes_command_interpretation (interpretation_id, hermes_task_id, raw_command, normalized_command, intent_json, ordered_stage_json, target_hint_json, risk_gate_json, model_name, confidence_score, status) VALUES ("
    + ", ".join([
        lit(f"interp-{task_id}", 80),
        lit(task_id, 80),
        clob(request_text),
        clob(intent),
        clob(json.dumps(plan, ensure_ascii=False)),
        clob(json.dumps(selected_stages, ensure_ascii=False)),
        clob(json.dumps({"targetRoute": target_route, "targetModule": target_module, "targetDbName": target_db, "patternId": pattern_id, "agentTeamSelection": agent_team_selection}, ensure_ascii=False)),
        clob(json.dumps({"riskLevel": risk, "taskType": task_type, "patternCategory": pattern_category, "gateTeams": agent_team_selection.get("gateTeams", [])}, ensure_ascii=False)),
        lit(decision.get("selectedModel") or "qwen3.6-40b-deck-opus-q4", 120),
        str(max(float(confidence or 0), 0.8 if not pattern_id else 0.0)),
        "'READY'",
    ])
    + ");",
    "INSERT INTO hermes_model_decision (hermes_decision_id, hermes_task_id, decision_stage, selected_model, fallback_model, decision_reason, confidence_score, accepted_yn, evidence_ref) VALUES ("
    + ", ".join([
        lit(f"decision-{task_id}", 80),
        lit(task_id, 80),
        "'INTENT_PARSE'",
        lit(decision.get("selectedModel") or "qwen3.6-40b-deck-opus-q4", 120),
        lit(decision.get("fallbackModel") or "codex", 120),
        clob(decision.get("reason") or "Qwen40-first development orchestration"),
        "0.8",
        "'Y'",
        lit(str(plan_path), 1000),
    ])
    + ");",
]

statements.append(
    "INSERT INTO hermes_context_pack (hermes_context_pack_id, hermes_task_id, project_id, request_fingerprint, system_context, previous_work_context, codebase_context, runtime_context, agent_team_context, risk_context, evidence_ref) VALUES ("
    + ", ".join([
        lit(f"ctx-{task_id}", 80),
        lit(task_id, 80),
        "'carbonet'",
        lit(trace_id, 80),
        clob(json.dumps({"request": request_text, "patternId": pattern_id, "dbWorkOrderChecked": True, "systemAssetRegistryChecked": True, "developmentQualityScoreChecked": True, "developmentRagRouteChecked": True, "systemAssetSearchTerms": asset_terms, "watchdogFeedbackPath": decision.get("watchdogFeedbackPath"), "watchdogFeedbackBlock": decision.get("watchdogFeedbackBlock")}, ensure_ascii=False)),
        clob(json.dumps({"patternCandidates": resolution.get("candidates") or [], "registeredWorkOrder": registered_work_order}, ensure_ascii=False)),
        clob(json.dumps({
            "patternSource": resolution.get("source"),
            "emptyPages": registered_work_order.get("emptyPages"),
            "designArtifacts": registered_work_order.get("designArtifacts"),
            "designReferences": registered_work_order.get("designReferences"),
            "themeTokens": registered_work_order.get("themeTokens"),
            "uiComponentPatterns": registered_work_order.get("uiComponentPatterns"),
            "cssSelectors": registered_work_order.get("cssSelectors"),
            "cssDeclarations": registered_work_order.get("cssDeclarations"),
            "designPatterns": registered_work_order.get("designPatterns"),
            "brandMemory": registered_work_order.get("brandMemory"),
            "uxInteractionPatterns": registered_work_order.get("uxInteractionPatterns"),
            "accessibilityRules": registered_work_order.get("accessibilityRules"),
            "aiDesignRules": registered_work_order.get("aiDesignRules"),
            "platformLayers": registered_work_order.get("platformLayers"),
            "osPackages": registered_work_order.get("osPackages"),
            "containerServices": registered_work_order.get("containerServices"),
            "buildUnits": registered_work_order.get("buildUnits"),
            "developmentPreflightRoutes": registered_work_order.get("developmentPreflightRoutes"),
            "modelLanePolicies": registered_work_order.get("modelLanePolicies"),
            "modelCandidates": registered_work_order.get("modelCandidates"),
            "agentTeamRegistry": registered_work_order.get("agentTeamRegistry"),
            "workKindRoutes": registered_work_order.get("workKindRoutes"),
            "pageDesignRegistry": registered_work_order.get("pageDesignRegistry"),
            "pageQualityScores": registered_work_order.get("pageQualityScores"),
            "pageQualityDimensions": registered_work_order.get("pageQualityDimensions"),
            "developmentBranchDecisions": registered_work_order.get("developmentBranchDecisions"),
            "developmentRagChunks": registered_work_order.get("developmentRagChunks"),
            "builderWorkRequests": registered_work_order.get("builderWorkRequests"),
            "knowledgeAssets": registered_work_order.get("knowledgeAssets"),
            "systemAssets": registered_work_order.get("systemAssets"),
            "systemFramework": registered_work_order.get("systemFramework"),
            "systemCodeStructures": registered_work_order.get("systemCodeStructures"),
            "developmentPatternBindings": registered_work_order.get("developmentPatternBindings"),
        }, ensure_ascii=False)),
        clob(json.dumps({"targetRoute": target_route, "targetModule": target_module, "builderWorkRequests": registered_work_order.get("builderWorkRequests"), "builderPageGaps": registered_work_order.get("builderPageGaps"), "systemTree": registered_work_order.get("systemTree")}, ensure_ascii=False)),
        clob(json.dumps(agent_team_selection, ensure_ascii=False)),
        clob(json.dumps({"riskLevel": risk, "taskType": task_type, "gateTeams": agent_team_selection.get("gateTeams", []), "guardPolicies": registered_work_order.get("guardPolicies")}, ensure_ascii=False)),
        lit(str(resolution_path), 1000),
    ])
    + ");"
)

if pattern_id:
    statements.append(
        "INSERT INTO hermes_pattern_match (hermes_pattern_match_id, hermes_task_id, pattern_id, confidence_score, matched_reason, selected_by, accepted_yn, evidence_ref) VALUES ("
        + ", ".join([
            lit(f"match-{task_id}", 100),
            lit(task_id, 80),
            lit(pattern_id, 80),
            str(float(confidence or 0)),
            clob(json.dumps({
                "patternName": pattern_name,
                "categoryCode": pattern_category,
                "reasons": resolution.get("matchedReasons") or [],
                "candidates": resolution.get("candidates") or [],
                "agentTeamSelection": agent_team_selection,
            }, ensure_ascii=False)),
            "'HERMES_RESOLVER'",
            "'Y'",
            lit(str(resolution_path), 1000),
        ])
        + ");"
    )

for idx, stage in enumerate(selected_stages, start=1):
    stage_code = stage.get("stageCode") or f"STEP_{idx}"
    statements.append(
        "INSERT INTO hermes_task_step (hermes_step_id, hermes_task_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor, model_role, status) VALUES ("
        + ", ".join([
            lit(f"step-{task_id}-{idx:02d}", 80),
            lit(task_id, 80),
            str(idx * 10),
            lit(stage_code, 80),
            lit(stage.get("title") or stage_code, 200),
            clob(stage.get("instruction") or ""),
            clob(stage.get("expectedEvidence") or ""),
            lit(stage.get("executor") or "CODEX_SCRIPT", 80),
            lit(model_role_for_stage(stage_code), 80),
            "'PENDING'",
        ])
        + ");"
    )

checkpoint_templates = [
    ("CHK-010-DB-ORDER", 10, "DB_ORDER_CHECK", "PRECHECK", "Registered DB work order check", "선택된 패턴, 단계, 검증, 팀 규칙, 지식 자산을 DB에서 조회한다.", "pattern_id, step_count, check_count, team_rule_count, asset_hints", "Y"),
    ("CHK-020-SCOPE-REPORT", 20, "SCOPE_REPORT", "SCOPE_ROUTE", "Scope and option midpoint report", "분석 결과, 작업할 것/하지 않을 것, 선택지를 중간 보고로 남긴다.", "candidate_files, selected_files, rejected_files, uncertainty_list", "Y"),
    ("CHK-030-PARITY-VERIFY", 30, "PARITY_VERIFY", "VERIFY", "Existing script and harness parity verification", "기존 빌드/검증/감사 스크립트와 결과물을 대조한다.", "diff_check, build_result, maven_result, route_or_api_probe", "Y"),
    ("CHK-040-RESTORE-READY", 40, "RESTORE_READY", "REFLECT", "Restore readiness and rework summary", "완료 전 변경 파일, DB 변경, 원격 적용, 복원 방법, 남은 위험을 기록한다.", "changed_files, db_changes, remote_changes, restore_notes", "Y"),
]
for template_id, order, code, stage, name, instruction, evidence, restore_available in checkpoint_templates:
    statements.append(
        "INSERT INTO hermes_task_work_checkpoint (checkpoint_id, hermes_task_id, checkpoint_order, checkpoint_code, checkpoint_stage, checkpoint_name, instruction, expected_evidence, status, report_payload, evidence_ref, restore_available_yn) VALUES ("
        + ", ".join([
            lit(f"checkpoint-{task_id}-{order:03d}", 120),
            lit(task_id, 80),
            str(order),
            lit(code, 80),
            lit(stage, 80),
            lit(name, 200),
            clob(instruction),
            clob(evidence),
            "'PLANNED'",
            clob(json.dumps({"templateId": template_id, "patternId": pattern_id, "registeredWorkOrder": registered_work_order if order == 10 else {}}, ensure_ascii=False)),
            lit(str(resolution_path), 1000),
            lit(restore_available, 1),
        ])
        + ");"
    )

statements.append("COMMIT;")
sql_path = work_dir / f"{task_id}.sql"
sql_path.write_text("\n".join(statements), encoding="utf-8")
remote_sql = f"/tmp/{task_id}.sql"
run(["kubectl", "-n", namespace, "cp", str(sql_path), f"{pod}:{remote_sql}"])
run(["kubectl", "-n", namespace, "exec", pod, "--", "bash", "-lc", f"PGPASSWORD=postgres123 psql -U {db_user!r} -d {db_name!r} -f {remote_sql}"])

event = {
    "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "script": "hermes-record-request",
    "status": "OK",
    "code": "HERMES_REQUEST_RECORDED",
    "taskId": task_id,
    "traceId": trace_id,
    "taskType": task_type,
    "riskLevel": risk,
    "patternId": pattern_id,
    "patternName": pattern_name,
    "patternConfidence": confidence,
    "agentTeamSelection": agent_team_selection,
    "registeredWorkOrderChecked": True,
    "checkpointCount": len(checkpoint_templates),
    "stageCount": len(selected_stages),
    "planPath": str(plan_path),
    "resolutionPath": str(resolution_path),
}
event_path = pathlib.Path(event_jsonl)
with event_path.open("a", encoding="utf-8") as handle:
    handle.write(json.dumps(event, ensure_ascii=False) + "\n")
print(json.dumps(event, ensure_ascii=False))
PY

if [ "$HERMES_WATCHDOG_ENABLE" = "1" ] && [ -x "$HERMES_WATCHDOG_HELPER" ]; then
  timeout "${HERMES_WATCHDOG_TIMEOUT_SECONDS:-45}s" "$HERMES_WATCHDOG_HELPER" "$PLAN_JSON" "REQUEST_RECORDED" "Hermes request recorded; check task extraction, selected model lane, and evidence plan." >/dev/null 2>&1 || true
fi
