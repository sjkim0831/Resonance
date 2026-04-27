#!/usr/bin/env bash
set -euo pipefail

HOST="${VLLM_HOST:-127.0.0.1}"
PORT="${VLLM_HOST_PORT:-8000}"
CONTAINER_NAME="${VLLM_CONTAINER_NAME:-resonance-vllm}"

echo "== container =="
docker ps --filter "name=$CONTAINER_NAME" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true

echo
echo "== nvidia =="
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu --format=csv,noheader || true
else
  docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi || true
fi

echo
echo "== models =="
curl -fsS "http://$HOST:$PORT/v1/models"
echo
