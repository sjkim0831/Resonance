#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${QWEN40_ENV_FILE:-/etc/default/codex-qwen36}"
SERVICE="${QWEN40_SERVICE:-codex-qwen36.service}"
REGISTRY_FILE="${RESONANCE_MODEL_RUNTIME_REGISTRY:-/opt/Resonance/var/ai-model-runtime/model-runtime-registry.json}"
VIEW_FILE="${RESONANCE_HERMES_RUNTIME_VIEW:-/opt/Resonance/var/ai-model-runtime/hermes-runtime-view.json}"
PROFILE="${1:-show}"
RESTART="${QWEN40_PROFILE_RESTART:-0}"

usage() {
  cat <<'EOF'
usage: qwen40-speed-profile.sh <show|stable-128k|fast-64k> [--restart]

Profiles:
  stable-128k  QWEN36_CONTEXT=131072, Q4 KV cache, one parallel slot.
  fast-64k     QWEN36_CONTEXT=65536, Q4 KV cache, one parallel slot.

The script updates /etc/default/codex-qwen36 and the Hermes runtime view.
It does not restart the 40B service unless --restart is supplied.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --restart)
      RESTART=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
  esac
done

set_env_value() {
  local key="$1"
  local value="$2"
  if [ ! -f "$ENV_FILE" ]; then
    touch "$ENV_FILE"
  fi
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
}

update_runtime_json() {
  local context="$1"
  python3 - "$REGISTRY_FILE" "$VIEW_FILE" "$context" <<'PY'
import datetime
import json
import pathlib
import sys

registry_file, view_file, context = sys.argv[1:4]
context = int(context)

def load(path):
    p = pathlib.Path(path)
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))

def dump(path, data):
    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

registry = load(registry_file)
for profile in registry.get("profiles", []):
    if profile.get("id") == "main-qwen36-40b-gpu":
        profile["contextLength"] = context
        env = profile.setdefault("env", {})
        env["QWEN36_CONTEXT"] = str(context)
registry.setdefault("selectionPolicy", {}).setdefault("speedProfiles", {})
registry["selectionPolicy"]["speedProfiles"]["active"] = "fast-64k" if context <= 65536 else "stable-128k"
registry["selectionPolicy"]["speedProfiles"]["profiles"] = {
    "stable-128k": {"contextLength": 131072, "useCase": "Hermes default, long Carbonet tasks"},
    "fast-64k": {"contextLength": 65536, "useCase": "short bounded edits, faster prefill"},
}
dump(registry_file, registry)

view = load(view_file)
view["updatedAt"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S%z")
view.setdefault("activeRoles", {}).setdefault("main", {})["contextLength"] = context
view.setdefault("speedProfiles", {})["active"] = "fast-64k" if context <= 65536 else "stable-128k"
view["speedProfiles"]["profiles"] = registry["selectionPolicy"]["speedProfiles"]["profiles"]
dump(view_file, view)
PY
}

show() {
  echo "[qwen40-speed-profile] service=$SERVICE"
  echo "[qwen40-speed-profile] env=$ENV_FILE"
  if [ -f "$ENV_FILE" ]; then
    grep -E '^(QWEN36_CONTEXT|QWEN36_CACHE_K|QWEN36_CACHE_V|QWEN36_PARALLEL|QWEN36_PORT|QWEN36_MODEL_ALIAS)=' "$ENV_FILE" || true
  fi
  systemctl is-active "$SERVICE" 2>/dev/null || true
}

case "$PROFILE" in
  show)
    show
    exit 0
    ;;
  stable-128k)
    CONTEXT=131072
    ;;
  fast-64k)
    CONTEXT=65536
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

if [ "$(id -u)" -ne 0 ] && [ ! -w "$ENV_FILE" ]; then
  exec sudo env QWEN40_PROFILE_RESTART="$RESTART" QWEN40_ENV_FILE="$ENV_FILE" QWEN40_SERVICE="$SERVICE" \
    RESONANCE_MODEL_RUNTIME_REGISTRY="$REGISTRY_FILE" RESONANCE_HERMES_RUNTIME_VIEW="$VIEW_FILE" \
    "$0" "$PROFILE" ${RESTART:+--restart}
fi

set_env_value QWEN36_CONTEXT "$CONTEXT"
set_env_value QWEN36_CACHE_K q4_0
set_env_value QWEN36_CACHE_V q4_0
set_env_value QWEN36_PARALLEL 1
update_runtime_json "$CONTEXT"
systemctl daemon-reload 2>/dev/null || true

if [ "$RESTART" = "1" ]; then
  systemctl restart "$SERVICE"
fi

show
