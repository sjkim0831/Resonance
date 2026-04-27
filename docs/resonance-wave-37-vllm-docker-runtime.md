# Resonance Wave 37 - vLLM Docker Runtime

Date: 2026-04-27 KST
Canonical root: `/opt/Resonance`

## Result

The remote WSL host now exposes `nvidia-smi` through:

```text
/usr/local/bin/nvidia-smi -> /usr/lib/wsl/lib/nvidia-smi
```

Verified GPU:

```text
NVIDIA GeForce RTX 5090
VRAM: 32607 MiB
Driver: 596.21
CUDA: 13.2
```

Docker GPU runtime is available and `docker run --gpus all ... nvidia-smi` works.

## Runtime Strategy

Use vLLM through Docker, not host pip, because:

- The GPU is exposed correctly through Docker.
- Docker keeps CUDA/PyTorch/vLLM dependencies isolated from the Java/Node/WSL host.
- The same runtime can be packaged later as an air-gapped model server image.

## Scripts

```text
ops/scripts/start-vllm-openai.sh
ops/scripts/stop-vllm-openai.sh
ops/scripts/health-vllm-openai.sh
```

Default start command:

```bash
bash ops/scripts/start-vllm-openai.sh
```

Default model:

```text
Qwen/Qwen2.5-Coder-7B-Instruct
```

Default OpenAI-compatible endpoint:

```text
http://127.0.0.1:8000/v1
```

## Model Overrides

Run another model by setting environment variables:

```bash
VLLM_MODEL_ID=Qwen/Qwen2.5-Coder-14B-Instruct \
VLLM_SERVED_MODEL_NAME=qwen2.5-coder-14b-instruct \
bash ops/scripts/start-vllm-openai.sh
```

Devstral candidate:

```bash
VLLM_MODEL_ID=mistralai/Devstral-Small-2505 \
VLLM_SERVED_MODEL_NAME=devstral \
VLLM_GPU_MEMORY_UTILIZATION=0.88 \
bash ops/scripts/start-vllm-openai.sh
```

Qwen 3.5 / Gemma 4 are kept as logical candidates until exact registry IDs are verified.

## Safety Rule

vLLM must not expand the file read budget.

The correct flow remains:

1. Deterministic route/file resolution.
2. Context cap.
3. vLLM plan or patch over selected files only.
4. Deterministic build/test.
5. Deterministic deploy/rollback.


## Verification Status

Verified on 2026-04-27 KST:

- WSL `nvidia-smi` works through `/usr/local/bin/nvidia-smi`.
- Docker GPU runtime works with RTX 5090 32GB.
- `vllm/vllm-openai:latest` pulled successfully.
- vLLM container `resonance-vllm` started successfully.
- Served model: `qwen2.5-coder-7b-instruct` from `Qwen/Qwen2.5-Coder-7B-Instruct`.
- Host endpoint: `http://127.0.0.1:8000/v1`.
- k8s project-runtime reachable endpoint: `http://172.18.0.1:8000/v1`.
- `/v1/models` passed.
- `/v1/chat/completions` passed.

