#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
TARGET_HOST="${1:-}"
if [[ -z "$TARGET_HOST" ]]; then
  echo "Usage: $0 <user@host:/opt or user@host>" >&2
  exit 2
fi
if [[ "${CONFIRM_REPLICATE:-}" != "YES" ]]; then
  echo "Refusing replication without CONFIRM_REPLICATE=YES" >&2
  exit 3
fi

PACKAGE="/tmp/carbonet-framework-$(date +%Y%m%d-%H%M%S).tar.gz"
EVENT_LOG="$ROOT_DIR/var/ai-runtime/self-evolving-events.jsonl"
mkdir -p "$(dirname "$EVENT_LOG")"

tar --warning=no-file-changed -czf "$PACKAGE" \
  --exclude='*/target/*' \
  --exclude='*/node_modules/*' \
  --exclude='*/.git/*' \
  --exclude='*/logs/*' \
  --exclude='*/.kube/*' \
  --exclude='*/secrets/*' \
  -C /opt Resonance/modules Resonance/apps Resonance/ops Resonance/projects/carbonet-frontend Resonance/var/ai-agent-teams Resonance/var/ai-model-runtime || true

scp "$PACKAGE" "$TARGET_HOST:/tmp/"
printf '{"ts":"%s","script":"hermes-agent-self-replicate","status":"OK","package":"%s","target":"%s"}\n' \
  "$(date -Iseconds)" "$PACKAGE" "$TARGET_HOST" >>"$EVENT_LOG"
echo "Package transferred. Remote install remains operator-approved: $PACKAGE"
