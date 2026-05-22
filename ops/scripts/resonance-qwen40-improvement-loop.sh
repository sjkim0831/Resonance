#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-runtime}"
RUN_DIR="${RUN_DIR:-$ROOT_DIR/var/run}"
EVENT_LOG="$OUT_DIR/qwen40-improvement-suggestions.jsonl"
LATEST_MD="$OUT_DIR/qwen40-improvement-suggestions-latest.md"
RAW_DIR="$OUT_DIR/qwen40-improvement-raw"
LOCK_FILE="$RUN_DIR/resonance-qwen40-improvement-loop.lock"
DISABLE_FILE="$RUN_DIR/resonance-qwen40-improvement-loop.disabled"
MODEL_CMD="${MODEL_CMD:-/usr/local/bin/qwen40-ask}"
MAX_TOKENS="${QWEN40_IMPROVEMENT_MAX_TOKENS:-900}"
TIMEOUT_SECONDS="${QWEN40_IMPROVEMENT_TIMEOUT_SECONDS:-420}"

mkdir -p "$OUT_DIR" "$RUN_DIR" "$RAW_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

json_string() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read(), ensure_ascii=False))'
}

append_event() {
  local status="$1" code="$2" message="$3" answer_file="${4:-}"
  local answer=""
  [[ -n "$answer_file" && -f "$answer_file" ]] && answer="$(cat "$answer_file")"
  python3 - "$EVENT_LOG" "$status" "$code" "$message" "$answer" <<'PY'
import datetime, json, pathlib, sys
path=pathlib.Path(sys.argv[1])
status, code, message, answer = sys.argv[2:]
event={
  "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "script":"resonance-qwen40-improvement-loop",
  "status":status,
  "code":code,
  "message":message,
  "answer":answer,
}
with path.open("a", encoding="utf-8") as f:
    f.write(json.dumps(event, ensure_ascii=False)+"\n")
PY
}

if [[ -f "$DISABLE_FILE" ]]; then
  append_event "SKIP" "DISABLED" "disabled by $DISABLE_FILE"
  exit 0
fi

if [[ ! -x "$MODEL_CMD" ]]; then
  append_event "FAIL" "MODEL_COMMAND_MISSING" "$MODEL_CMD is not executable"
  exit 0
fi

if ! timeout 15s "$MODEL_CMD" health >/dev/null 2>&1; then
  append_event "FAIL" "QWEN40_UNAVAILABLE" "qwen40 local API health check failed"
  exit 0
fi

TS="$(date -Iseconds)"
EVIDENCE_FILE="$RAW_DIR/evidence-${TS//[:+]/-}.txt"
ANSWER_FILE="$RAW_DIR/answer-${TS//[:+]/-}.txt"

{
  echo "# Resonance Improvement Evidence"
  echo "timestamp=$TS"
  echo
  echo "## System"
  hostname || true
  uptime || true
  free -h || true
  df -h / /opt 2>/dev/null || true
  nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader 2>/dev/null || true
  echo
  echo "## Systemd Failed"
  systemctl --failed --no-pager 2>/dev/null || true
  echo
  echo "## Resonance Timers"
  systemctl list-timers --all --no-pager 2>/dev/null | grep -E 'resonance|NEXT' || true
  echo
  echo "## Core Services"
  for s in containerd kubelet resonance-ops-web resonance-up resonance-k8s-self-heal.timer resonance-k8s-ops-doctor.timer resonance-incident-learner.timer resonance-startup-watchdog.timer codex-qwen36 codex-hermes; do
    printf '%s=' "$s"; systemctl is-active "$s" 2>/dev/null || true
  done
  echo
  echo "## Kubernetes"
  kubectl get nodes -o wide 2>&1 || true
  kubectl -n carbonet-prod get deploy,statefulset,svc,pod -o wide 2>&1 || true
  echo
  echo "## Health"
  curl -fsS --max-time 8 http://127.0.0.1/actuator/health 2>&1 || true
  echo
  curl -fsS --max-time 8 http://127.0.0.1:32947/actuator/health 2>&1 || true
  echo
  echo "## Incident Summary"
  tail -80 "$OUT_DIR/incident-patterns-summary.md" 2>/dev/null || true
  echo
  echo "## Skills And Docs Purpose Context"
  for doc in \
    "$ROOT_DIR/AGENTS.md" \
    "$ROOT_DIR/docs/ai/00-governance/project-overview.md" \
    "$ROOT_DIR/docs/ai/00-governance/ai-skill-doc-routing-matrix.md" \
    "$ROOT_DIR/docs/ai/00-governance/coding-rules.md" \
    "$ROOT_DIR/docs/ai/00-governance/review-checklist.md" \
    "$ROOT_DIR/docs/ai/10-architecture/resonance-ai-framework.md" \
    "$ROOT_DIR/docs/ai/10-architecture/system-map.md" \
    "$ROOT_DIR/docs/ai/60-operations/incident-patterns.md" \
    "$ROOT_DIR/docs/ai/60-operations/known-risk-areas.md" \
    "$ROOT_DIR/docs/ai/60-operations/release-checklist.md" \
    "$ROOT_DIR/docs/ai/80-skills/skill-index.md" \
    "$ROOT_DIR/docs/ai/80-skills/when-to-use-each-skill.md" \
    "$ROOT_DIR/docs/ai/80-skills/skill-boundaries.md" \
    "$ROOT_DIR/docs/operations/resonance-doc-index.md" \
    "$ROOT_DIR/docs/k8s-ops-automation-max.md" \
    "$ROOT_DIR/docs/k8s-runtime-80-ha-remote.md"; do
    if [[ -r "$doc" ]]; then
      echo
      echo "### ${doc#$ROOT_DIR/}"
      sed -n '1,120p' "$doc"
    fi
  done
  echo
  echo "## Available Skill/Doc Inventory"
  find "$ROOT_DIR/docs/ai/80-skills" -maxdepth 1 -type f -name '*.md' -printf '%f\n' 2>/dev/null | sort || true
  find "$ROOT_DIR" -path '*/.codex/skills/*/SKILL.md' -printf '%p\n' 2>/dev/null | sed "s#^$ROOT_DIR/##" | sort || true
  echo
  echo "## Recent Ops Doctor Events"
  tail -40 "$OUT_DIR/k8s-ops-doctor-events.jsonl" 2>/dev/null || true
  echo
  echo "## Recent Startup Watchdog Events"
  tail -30 "$OUT_DIR/startup-watchdog-events.jsonl" 2>/dev/null || true
  echo
  echo "## Recent Deploy Logs"
  latest_deploy="$(ls -t /opt/util/k9s/web/logs/deploy-80-*.log 2>/dev/null | head -1 || true)"
  [[ -n "$latest_deploy" ]] && tail -120 "$latest_deploy" || true
} > "$EVIDENCE_FILE"

PROMPT=$(cat <<'PROMPT_EOF'
너는 Carbonet/Resonance 운영 개선 감시자다. 아래 운영 증거와 Skills/Docs 목적 문서를 함께 보고, 우리 시스템 목적에 맞는 개선사항을 남겨라.
목표:
1. 서비스 중단 예방
2. CUBRID 브로커 불안정 예방
3. 쿠버네티스 자동복구/배포 안정성 개선
4. 로그와 권한 문제 재발 방지
5. Skills/Docs 규칙과 실제 런타임 자동화의 간극 줄이기

출력은 한국어로 하고, 반드시 아래 형식을 지켜라.
- 요약: 2문장 이내
- 지금 정상인 것:
- 위험 신호:
- 개선 제안 TOP 5:
- Skills/Docs 기반 개선사항:
- 자동화 후보:
- DB에 남길 운영 메모:
- 다음 점검 명령:

실제 명령을 실행했다고 말하지 말고, 관찰과 제안만 적어라.
PROMPT_EOF
)

FULL_PROMPT="$PROMPT

--- 증거 시작 ---
$(tail -c 24000 "$EVIDENCE_FILE")
--- 증거 끝 ---"

if timeout "${TIMEOUT_SECONDS}s" env \
  QWEN40_MAX_TOKENS="$MAX_TOKENS" \
  QWEN40_TEMPERATURE=0.2 \
  QWEN40_TIMEOUT="$TIMEOUT_SECONDS" \
  QWEN40_SYSTEM_PROMPT="Carbonet 운영 개선사항을 간결하고 실행 가능하게 제안하는 로컬 AI다." \
  "$MODEL_CMD" "$FULL_PROMPT" > "$ANSWER_FILE" 2>"$ANSWER_FILE.err"; then
  {
    echo "# Qwen40 Improvement Suggestions"
    echo
    echo "- generatedAt: $TS"
    echo "- evidence: $EVIDENCE_FILE"
    echo
    cat "$ANSWER_FILE"
  } > "$LATEST_MD"
  append_event "OK" "SUGGESTIONS_WRITTEN" "wrote improvement suggestions from Qwen40" "$ANSWER_FILE"
  if [[ -x "$ROOT_DIR/ops/scripts/resonance-sync-qwen40-improvements-to-cubrid.sh" ]]; then
    "$ROOT_DIR/ops/scripts/resonance-sync-qwen40-improvements-to-cubrid.sh" || true
  fi
else
  err="$(tail -c 1000 "$ANSWER_FILE.err" 2>/dev/null || true)"
  append_event "FAIL" "QWEN40_CALL_FAILED" "${err:-Qwen40 call timed out or failed}"
  if [[ -x "$ROOT_DIR/ops/scripts/resonance-sync-qwen40-improvements-to-cubrid.sh" ]]; then
    "$ROOT_DIR/ops/scripts/resonance-sync-qwen40-improvements-to-cubrid.sh" || true
  fi
fi
