#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
SCRIPT="$ROOT_DIR/ops/scripts/hermes-session-learning-export.py"

exec "$PYTHON_BIN" "$SCRIPT" "${@:-export}"
