#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
CONTAINER_NAME="${VLLM_CONTAINER_NAME:-resonance-vllm}"
IMAGE="${VLLM_IMAGE:-vllm/vllm-openai:latest}"
HOST_PORT="${VLLM_HOST_PORT:-8000}"
MODEL_ID="${VLLM_MODEL_ID:-Qwen/Qwen2.5-Coder-7B-Instruct}"
SERVED_MODEL_NAME="${VLLM_SERVED_MODEL_NAME:-$(basename "$MODEL_ID")}"
GPU_MEMORY_UTILIZATION="${VLLM_GPU_MEMORY_UTILIZATION:-0.82}"
MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-8192}"
CACHE_DIR="${VLLM_CACHE_DIR:-$ROOT_DIR/var/model-cache/huggingface}"

mkdir -p "$CACHE_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker command is required for vLLM runtime" >&2
  exit 127
fi

if ! docker info 2>/dev/null | grep -qi 'nvidia'; then
  echo "Docker NVIDIA runtime is not visible. Check Docker Desktop GPU support first." >&2
  exit 1
fi

if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

docker pull "$IMAGE"

docker run -d \
  --name "$CONTAINER_NAME" \
  --gpus all \
  --ipc=host \
  -p "$HOST_PORT:8000" \
  -v "$CACHE_DIR:/root/.cache/huggingface" \
  -e HF_HOME=/root/.cache/huggingface \
  "$IMAGE" \
  --model "$MODEL_ID" \
  --served-model-name "$SERVED_MODEL_NAME" \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype auto \
  --gpu-memory-utilization "$GPU_MEMORY_UTILIZATION" \
  --max-model-len "$MAX_MODEL_LEN"

echo "vLLM container started: $CONTAINER_NAME"
echo "endpoint: http://127.0.0.1:$HOST_PORT/v1"
echo "model: $SERVED_MODEL_NAME ($MODEL_ID)"
