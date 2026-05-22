#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
ENV_FILE="${CARBONET_QWEN40_ENV_FILE:-/etc/default/carbonet-qwen40-api}"
if [[ -r "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

QWEN40_API_URL="${QWEN40_API_URL:-http://127.0.0.1:24036/v1}"
QWEN40_API_TOKEN="${QWEN40_API_TOKEN:-qwer1234}"
QWEN40_MODEL_ALIAS="${QWEN40_MODEL_ALIAS:-qwen3.6-40b-deck-opus-q4}"
HERMES_CLI="${HERMES_CLI:-hermes}"
EXECUTE_MODE="${SELF_EVOLVING_EXECUTE_MODE:-record}"

AI_TEAMS_CONFIG="$ROOT_DIR/var/ai-agent-teams/ai-agent-teams.json"
EVOLVING_DIR="$ROOT_DIR/var/self-evolving"
LOG_DIR="$EVOLVING_DIR/logs"
CHECKPOINT_DIR="$EVOLVING_DIR/checkpoints"
LEARNING_DIR="$EVOLVING_DIR/learning-data"
EVENT_LOG="$ROOT_DIR/var/ai-runtime/self-evolving-events.jsonl"

mkdir -p "$LOG_DIR" "$CHECKPOINT_DIR" "$LEARNING_DIR" "$(dirname "$EVENT_LOG")"

log() {
  printf '[self-evolving] %s %s\n' "$(date -Iseconds)" "$*"
}

json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1])'
}

log_event() {
  local status="$1"
  local code="$2"
  local message="$3"
  printf '{"ts":"%s","script":"carbonet-self-evolving-engine","status":"%s","code":"%s","cycle":"%s","message":"%s"}\n' \
    "$(date -Iseconds)" "$status" "$code" "${CURRENT_CYCLE_ID:-}" \
    "$(printf '%s' "$message" | json_escape)" >>"$EVENT_LOG"
}

system_prompt_for_mode() {
  case "$1" in
    judge) printf '%s' 'Carbonet 프레임워크 Main Judge. 증거 기반으로 위험, 누락, 검증 기준을 판정한다.' ;;
    plan) printf '%s' 'Carbonet Plan Agent. 요청을 파일, API, DB, 검증 범위로 나누고 실행 순서를 JSON 중심으로 정리한다.' ;;
    verify) printf '%s' 'Carbonet Verification Agent. 빌드, 런타임, 라우트, DB 증거를 기준으로 완료 여부를 판정한다.' ;;
    reflect) printf '%s' 'Carbonet Reflection Agent. 완료/실패 작업을 학습 데이터, 재발 방지 패턴, 다음 사이클 개선안으로 정리한다.' ;;
    *) printf '%s' 'Carbonet AI Team OS Agent. Resonance 프레임워크 운영과 개발을 보조한다.' ;;
  esac
}

qwen40_call() {
  local mode="$1"
  local prompt_file="$2"
  local max_tokens="${3:-2048}"
  local system_prompt
  system_prompt="$(system_prompt_for_mode "$mode")"
  python3 - "$QWEN40_API_URL" "$QWEN40_API_TOKEN" "$QWEN40_MODEL_ALIAS" "$system_prompt" "$prompt_file" "$max_tokens" <<'PY'
import json
import sys
import urllib.request

url, token, model, system_prompt, prompt_file, max_tokens = sys.argv[1:]
prompt = open(prompt_file, encoding="utf-8").read()
payload = {
    "model": model,
    "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt},
    ],
    "temperature": 0.1,
    "max_tokens": int(max_tokens),
}
req = urllib.request.Request(
    url.rstrip("/") + "/chat/completions",
    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(req, timeout=300) as res:
    data = json.loads(res.read().decode("utf-8", errors="replace"))
content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
print(content.strip())
PY
}

plan_phase() {
  local request="$1"
  local plan_file="$2"
  local prompt
  prompt="$(mktemp)"
  cat >"$prompt" <<EOF
요청:
$request

다음 JSON 형태를 우선하되, 모르는 값은 빈 배열로 둔다.
{
  "taskType": "page-development | architecture-change | feature-add | bug-fix | refactor | ops",
  "workKind": "frontend | backend | fullstack | database | ai-team | ops",
  "scope": {"files": [], "apis": [], "db": [], "scripts": [], "runtime": []},
  "teamSelection": {"required": [], "gate": [], "support": []},
  "plan": [],
  "risks": [],
  "verification": []
}
EOF
  qwen40_call plan "$prompt" 2048 >"$plan_file"
  rm -f "$prompt"
}

hermes_delegate() {
  local task_file="$1"
  case "$EXECUTE_MODE" in
    record)
      bash "$ROOT_DIR/ops/scripts/hermes-record-request.sh" "$(cat "$task_file")"
      ;;
    oneshot)
      "$HERMES_CLI" --oneshot "$(cat "$task_file")"
      ;;
    dry-run)
      printf '[dry-run] would delegate to Hermes:\n'
      cat "$task_file"
      ;;
    *)
      printf 'unknown SELF_EVOLVING_EXECUTE_MODE=%s\n' "$EXECUTE_MODE" >&2
      return 2
      ;;
  esac
}

execute_phase() {
  local plan_file="$1"
  local exec_log="$2"
  local prompt
  prompt="$(mktemp)"
  cat >"$prompt" <<EOF
Resonance Carbonet 프레임워크 자가개선 작업.

작업 계획:
$(cat "$plan_file")

실행 지침:
1. 기존 구현과 DB/패턴 기억을 먼저 확인한다.
2. 변경은 파일/스크립트/DB 패치 단위로 증거를 남긴다.
3. 완료 주장은 빌드, 라우트, 런타임 증거 뒤에만 한다.
4. 에러가 나면 반복하지 말고 원인, 로그, 다음 조치를 구조화한다.
EOF
  hermes_delegate "$prompt" >"$exec_log" 2>&1 || {
    local code=$?
    rm -f "$prompt"
    return "$code"
  }
  rm -f "$prompt"
}

verify_phase() {
  local exec_log="$1"
  local verify_file="$2"
  local prompt
  prompt="$(mktemp)"
  cat >"$prompt" <<EOF
실행 로그:
$(tail -c 50000 "$exec_log" 2>/dev/null || true)

다음 JSON 형식으로 검증 결과를 작성하라.
{
  "status": "pass | fail | partial",
  "evidence": {"build": "", "runtime": "", "route": "", "db": "", "logs": ""},
  "issues": [],
  "recommendations": [],
  "nextAction": ""
}
EOF
  qwen40_call verify "$prompt" 1536 >"$verify_file"
  rm -f "$prompt"
}

reflect_phase() {
  local plan_file="$1"
  local exec_log="$2"
  local verify_file="$3"
  local learning_file="$4"
  local prompt
  prompt="$(mktemp)"
  cat >"$prompt" <<EOF
Plan:
$(cat "$plan_file")

Execution log tail:
$(tail -c 40000 "$exec_log" 2>/dev/null || true)

Verification:
$(cat "$verify_file")

학습 데이터와 재발 방지 패턴을 JSON으로 정리하라.
{
  "summary": {"success": "", "efficiency": "", "lessons": []},
  "patterns": [],
  "regressionGuards": [],
  "nextCycle": []
}
EOF
  qwen40_call reflect "$prompt" 1536 >"$learning_file"
  rm -f "$prompt"
  log_event OK REFLECTED "reflection stored: $learning_file"
}

pdca_cycle() {
  local request="$1"
  CURRENT_CYCLE_ID="cycle-$(date +%Y%m%d-%H%M%S)"
  export CURRENT_CYCLE_ID
  local cycle_dir="$CHECKPOINT_DIR/$CURRENT_CYCLE_ID"
  mkdir -p "$cycle_dir"
  printf '%s\n' "$request" >"$cycle_dir/request.txt"
  log_event START CYCLE_STARTED "$request"

  log "Plan phase -> $cycle_dir/plan.json"
  plan_phase "$request" "$cycle_dir/plan.json"

  log "Execute phase -> $cycle_dir/execution.log mode=$EXECUTE_MODE"
  if execute_phase "$cycle_dir/plan.json" "$cycle_dir/execution.log"; then
    log_event OK EXECUTE_DONE "$cycle_dir/execution.log"
  else
    log_event FAIL EXECUTE_FAILED "$cycle_dir/execution.log"
  fi

  log "Verify phase -> $cycle_dir/verification.json"
  verify_phase "$cycle_dir/execution.log" "$cycle_dir/verification.json" || true

  log "Reflect phase -> $cycle_dir/learning.json"
  reflect_phase "$cycle_dir/plan.json" "$cycle_dir/execution.log" "$cycle_dir/verification.json" "$cycle_dir/learning.json" || true

  log "Cycle complete: $cycle_dir"
  printf '%s\n' "$cycle_dir"
}

status() {
  printf '=== Carbonet Self-Evolving Engine ===\n'
  printf 'root=%s\n' "$ROOT_DIR"
  printf 'qwen40=%s model=%s\n' "$QWEN40_API_URL" "$QWEN40_MODEL_ALIAS"
  printf 'executeMode=%s\n' "$EXECUTE_MODE"
  printf 'aiTeams=%s %s\n' "$AI_TEAMS_CONFIG" "$([[ -f "$AI_TEAMS_CONFIG" ]] && echo OK || echo MISSING)"
  printf 'cycles=%s\n' "$(find "$CHECKPOINT_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)"
  printf 'learning=%s\n' "$(find "$LEARNING_DIR" -type f 2>/dev/null | wc -l)"
  curl -fsS --max-time 10 -H "Authorization: Bearer $QWEN40_API_TOKEN" "$QWEN40_API_URL/models" >/dev/null && echo 'qwen40Status=connected' || echo 'qwen40Status=disconnected'
}

case "${1:-status}" in
  evolve)
    shift
    pdca_cycle "${*:?request required}"
    ;;
  plan)
    shift
    tmp="$CHECKPOINT_DIR/plan-$(date +%s).json"
    plan_phase "${*:?request required}" "$tmp"
    cat "$tmp"
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: $0 {status|plan|evolve} [request]" >&2
    exit 2
    ;;
esac
