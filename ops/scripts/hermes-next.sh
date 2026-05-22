#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
MANAGER="${HERMES_AGENT_RELEASE_MANAGER:-$ROOT_DIR/ops/scripts/hermes-agent-release-manager.sh}"
NEXT_BIN="$("$MANAGER" next-bin)"
exec "$NEXT_BIN" "$@"
