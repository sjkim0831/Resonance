#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
SCRIPTS_DIR="$ROOT_DIR/ops/scripts"
EVOLVING_DIR="$ROOT_DIR/var/self-evolving"

mkdir -p "$EVOLVING_DIR"/{logs,checkpoints,learning-data,training/hermes-carbonet}

if [[ "$(id -u)" -eq 0 || -n "${RESONANCE_SUDO_PASSWORD:-}" || -n "${SUDO_ASKPASS:-}" ]]; then
  "$SCRIPTS_DIR/qwen40-api-setup.sh"
else
  "$SCRIPTS_DIR/qwen40-api-setup.sh" || true
fi

"$SCRIPTS_DIR/carbonet-self-evolving-engine.sh" status
"$SCRIPTS_DIR/qwen40-learning-collector.sh" collect

printf 'Carbonet self-evolving system ready: %s\n' "$EVOLVING_DIR"
