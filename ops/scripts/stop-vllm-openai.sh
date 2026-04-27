#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${VLLM_CONTAINER_NAME:-resonance-vllm}"

if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  docker rm -f "$CONTAINER_NAME" >/dev/null
  echo "vLLM container stopped: $CONTAINER_NAME"
else
  echo "vLLM container not found: $CONTAINER_NAME"
fi
