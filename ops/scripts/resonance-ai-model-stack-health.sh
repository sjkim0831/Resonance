#!/usr/bin/env bash
set -euo pipefail

DEFAULT_LOCK_DIR="${XDG_RUNTIME_DIR:-/tmp}"
LOCK_FILE="${LOCK_FILE:-$DEFAULT_LOCK_DIR/resonance-ai-model-stack-health.$(id -u).lock}"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

API_KEY="${MODEL_API_KEY:-qwer1234}"
WARMUP_SECONDS="${WARMUP_SECONDS:-2}"
MODEL_RUNTIME_FILE="${RESONANCE_MODEL_RUNTIME_REGISTRY:-/opt/Resonance/var/ai-model-runtime/model-runtime-registry.json}"
if [ "$(id -u)" -eq 0 ]; then
  SYSTEMCTL=(systemctl)
else
  SYSTEMCTL=(sudo -n systemctl)
fi

check_model() {
  local service="$1"
  local port="$2"
  local expected_model="$3"
  local status
  status="$(systemctl is-active "$service" 2>/dev/null || true)"
  if [ "$status" != "active" ]; then
    echo "restart: $service was $status"
    "${SYSTEMCTL[@]}" restart "$service"
    sleep "$WARMUP_SECONDS"
  fi

  if ! curl -fsS --max-time 10 -H "Authorization: Bearer $API_KEY" "http://127.0.0.1:$port/v1/models" \
    | python3 -c 'import json,sys; expected=sys.argv[1]; data=json.load(sys.stdin); rows=[]; rows.extend(data.get("data") or []); rows.extend(data.get("models") or []); models={item.get("id") or item.get("model") or item.get("name") for item in rows}; raise SystemExit(0 if expected in models else 1)' "$expected_model"
  then
    echo "restart: $service model endpoint unhealthy on :$port"
    "${SYSTEMCTL[@]}" restart "$service"
    sleep "$WARMUP_SECONDS"
  fi
}

if [ -f "$MODEL_RUNTIME_FILE" ]; then
  python3 - "$MODEL_RUNTIME_FILE" <<'PY' | while IFS=$'\t' read -r service port model; do
import json
import sys

data = json.load(open(sys.argv[1], encoding="utf-8"))
active_roles = (data.get("selectionPolicy") or {}).get("activeRoles") or {}
active_ids = set(active_roles.values())
for profile in data.get("profiles", []):
    if profile.get("desired") != "on":
        continue
    service = profile.get("serviceName")
    port = profile.get("port")
    model = profile.get("modelAlias")
    if service and port and model:
        print(f"{service}\t{port}\t{model}")
PY
    check_model "$service" "$port" "$model"
  done
else
  check_model codex-qwen36 24036 qwen3.6-40b-deck-opus-q4
  check_model resonance-shadow-qwen7 24751 qwen2.5-coder-7b-instruct-shadow
  check_model resonance-shadow-gemma4-e4b 24451 gemma4-e4b-gpu-shadow
fi

echo "resonance ai model stack OK"
