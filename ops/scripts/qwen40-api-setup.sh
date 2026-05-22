#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
ENV_FILE="${CARBONET_QWEN40_ENV_FILE:-/etc/default/carbonet-qwen40-api}"
RUNTIME_DIR="$ROOT_DIR/var/self-evolving"
EVENT_LOG="$ROOT_DIR/var/ai-runtime/self-evolving-events.jsonl"

QWEN40_API_URL="${QWEN40_API_URL:-http://127.0.0.1:24036/v1}"
QWEN40_API_TOKEN="${QWEN40_API_TOKEN:-qwer1234}"
QWEN40_MODEL_ALIAS="${QWEN40_MODEL_ALIAS:-qwen3.6-40b-deck-opus-q4}"

mkdir -p "$RUNTIME_DIR" "$(dirname "$EVENT_LOG")"

json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1])'
}

log_event() {
  local status="$1"
  local code="$2"
  local message="$3"
  printf '{"ts":"%s","script":"qwen40-api-setup","status":"%s","code":"%s","url":"%s","model":"%s","message":"%s"}\n' \
    "$(date -Iseconds)" "$status" "$code" "$QWEN40_API_URL" "$QWEN40_MODEL_ALIAS" \
    "$(printf '%s' "$message" | json_escape)" >>"$EVENT_LOG"
}

write_env() {
  local body
  body="$(mktemp)"
  cat >"$body" <<EOF
QWEN40_API_URL="$QWEN40_API_URL"
QWEN40_API_TOKEN="$QWEN40_API_TOKEN"
QWEN40_MODEL_ALIAS="$QWEN40_MODEL_ALIAS"
EOF
  if [[ "$(id -u)" -eq 0 ]]; then
    install -m 600 "$body" "$ENV_FILE"
  elif command -v sudo >/dev/null 2>&1; then
    printf '%s\n' "${RESONANCE_SUDO_PASSWORD:-qwer1234}" | sudo -S install -m 600 "$body" "$ENV_FILE"
  else
    cp "$body" "$RUNTIME_DIR/carbonet-qwen40-api.env"
    ENV_FILE="$RUNTIME_DIR/carbonet-qwen40-api.env"
  fi
  rm -f "$body"
}

check_models() {
  python3 - "$QWEN40_API_URL" "$QWEN40_API_TOKEN" "$QWEN40_MODEL_ALIAS" <<'PY'
import json
import sys
import urllib.request

url, token, expected = sys.argv[1:]
req = urllib.request.Request(
    url.rstrip("/") + "/models",
    headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(req, timeout=15) as res:
    data = json.loads(res.read().decode("utf-8", errors="replace"))
rows = []
rows.extend(data.get("data") or [])
rows.extend(data.get("models") or [])
models = {
    item.get("id") or item.get("model") or item.get("name")
    for item in rows
    if isinstance(item, dict)
}
if expected not in models:
    raise SystemExit(f"expected model not found: {expected}; models={sorted(models)}")
print("models-ok", expected)
PY
}

check_chat() {
  python3 - "$QWEN40_API_URL" "$QWEN40_API_TOKEN" "$QWEN40_MODEL_ALIAS" <<'PY'
import json
import sys
import urllib.request

url, token, model = sys.argv[1:]
payload = {
    "model": model,
    "messages": [
        {"role": "system", "content": "Resonance Carbonet AI Team OS readiness probe."},
        {"role": "user", "content": "자가증식 시스템 가동 준비 상태를 한 문장으로 답하라."},
    ],
    "temperature": 0.1,
    "max_tokens": 96,
}
req = urllib.request.Request(
    url.rstrip("/") + "/chat/completions",
    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(req, timeout=60) as res:
    data = json.loads(res.read().decode("utf-8", errors="replace"))
content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
print(content.strip()[:500])
PY
}

main() {
  write_env
  check_models
  check_chat
  log_event OK QWEN40_API_READY "Qwen40 API env written and model/chat probes passed"
  printf 'Qwen40 API ready: %s model=%s env=%s\n' "$QWEN40_API_URL" "$QWEN40_MODEL_ALIAS" "$ENV_FILE"
}

main "$@"
