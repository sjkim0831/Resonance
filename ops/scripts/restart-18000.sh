#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/restart-18000.sh

Purpose:
  Run the canonical fresh restart line for :18000, or runtime-only restart
  when RESTART_MODE=runtime-only.

Canonical app jar:
  apps/carbonet-app/target/carbonet.jar

Related checks:
  bash ops/scripts/run-large-move-app-closure.sh
  bash ops/scripts/codex-verify-18000-freshness.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESTART_MODE="${RESTART_MODE:-fresh}"
PORT="${PORT:-18000}"
CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/ops/config}"
CARBONET_RUNTIME_ENV="${CARBONET_RUNTIME_ENV:-${DEPLOY_TARGET:-local}}"

load_optional_env() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    # shellcheck disable=SC1090
    set -a
    source "$env_file"
    set +a
  fi
}

export_frontend_runtime_env() {
  export VITE_CARBONET_MENU_EMISSION_ECOINVENT_CODE="${VITE_CARBONET_MENU_EMISSION_ECOINVENT_CODE:-${CARBONET_MENU_EMISSION_ECOINVENT_CODE:-}}"
  export VITE_CARBONET_MENU_EMISSION_ECOINVENT_NAME_KO="${VITE_CARBONET_MENU_EMISSION_ECOINVENT_NAME_KO:-${CARBONET_MENU_EMISSION_ECOINVENT_NAME_KO:-}}"
  export VITE_CARBONET_MENU_EMISSION_ECOINVENT_NAME_EN="${VITE_CARBONET_MENU_EMISSION_ECOINVENT_NAME_EN:-${CARBONET_MENU_EMISSION_ECOINVENT_NAME_EN:-}}"
  export VITE_CARBONET_MENU_EMISSION_ECOINVENT_URL="${VITE_CARBONET_MENU_EMISSION_ECOINVENT_URL:-${CARBONET_MENU_EMISSION_ECOINVENT_URL:-}}"
  export VITE_CARBONET_MENU_EMISSION_ECOINVENT_ICON="${VITE_CARBONET_MENU_EMISSION_ECOINVENT_ICON:-${CARBONET_MENU_EMISSION_ECOINVENT_ICON:-}}"
}

load_optional_env "$CONFIG_DIR/carbonet-${PORT}.defaults.env"
load_optional_env "$CONFIG_DIR/carbonet-${PORT}.${CARBONET_RUNTIME_ENV}.defaults.env"
load_optional_env "$CONFIG_DIR/carbonet-${PORT}.env"
load_optional_env "$CONFIG_DIR/carbonet-${PORT}.${CARBONET_RUNTIME_ENV}.env"
export_frontend_runtime_env

if [[ "$RESTART_MODE" == "runtime-only" ]]; then
  bash "$ROOT_DIR/ops/scripts/restart-18000-runtime.sh"
  exit 0
fi

if [[ "$RESTART_MODE" != "fresh" ]]; then
  echo "[restart-18000] unsupported RESTART_MODE=$RESTART_MODE (supported: fresh, runtime-only)" >&2
  exit 1
fi

echo "[restart-18000] fresh restart started"
(cd "$ROOT_DIR/projects/carbonet-frontend/source" && npm run build)
rm -rf "$ROOT_DIR/apps/carbonet-app/target/classes/static/react-app"
(cd "$ROOT_DIR" && mvn -q -pl apps/carbonet-app -am -DskipTests package)
bash "$ROOT_DIR/ops/scripts/restart-18000-runtime.sh"
echo "[restart-18000] fresh restart completed"
