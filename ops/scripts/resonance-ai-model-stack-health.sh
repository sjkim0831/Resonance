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
PRIMARY_PROFILE="${RESONANCE_PRIMARY_AI_PROFILE:-krds-qwen40}"
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
  if [ "$status" = "activating" ]; then
    echo "warming: $service is activating"
    return 0
  fi
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

if [ "$PRIMARY_PROFILE" = "krds-qwen40" ]; then
  for service in codex-qwen36 resonance-shadow-qwen14 resonance-shadow-qwen3-exl2-gpu resonance-shadow-gemma4-e4b; do
    if systemctl is-active --quiet "$service"; then
      echo "stop GPU conflict: $service"
      "${SYSTEMCTL[@]}" stop "$service"
    fi
  done
  check_model resonance-hermes-framework-qwen40-exl3 24453 qwen3.6-40b-hermes-framework-qlora
  echo "resonance ai model stack OK: KRDS Qwen40 primary"
else
  for service in codex-qwen36 resonance-shadow-qwen14 resonance-shadow-qwen3-exl2-gpu resonance-hermes-framework-qwen40-exl3; do
    if systemctl is-active --quiet "$service"; then
      echo "stop GPU conflict: $service"
      "${SYSTEMCTL[@]}" stop "$service"
    fi
  done
  check_model resonance-shadow-gemma4-e4b 24451 gemma4-e4b-gpu-shadow
  echo "resonance ai model stack OK: Gemma E4B primary"
fi
