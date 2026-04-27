# Resonance Wave 36 - vLLM, Qwen, Gemma, and Devstral Routing

Date: 2026-04-27 KST
Canonical root: `/opt/Resonance`

## Purpose

Extend the local AI runtime from Ollama-only routing to a two-runner model gateway:

- `ollama-local` for default small/medium deterministic work.
- `vllm-local` for optional OpenAI-compatible GPU inference when larger Qwen/Gemma/Devstral candidates are available.

The goal is not to let larger models scan more files. The goal is to keep deterministic file selection and use stronger local inference only after the context is already bounded.

## Model Policy

Use logical model families instead of assuming one permanent registry tag.

Primary local defaults:

- `qwen2.5-coder:3b`: classify, verify, tiny bounded edits.
- `gemma3:4b`: resolver/classifier fallback and Korean summaries.
- `qwen2.5-coder:14b`: bounded planner/implementer when 3B fails verification.

Candidate families:

- `devstral`: agentic coding planner and bounded patch candidate.
- `qwen3.5-coder`: bounded planner/implementer candidate after exact Ollama/vLLM tag verification.
- `gemma4`: large-context planner candidate after exact Ollama/vLLM tag verification.

Important: `qwen3.5-coder` and `gemma4` are treated as logical candidates until the runtime registry confirms the exact installed tag or Hugging Face model id.

## vLLM Gate

vLLM is allowed only after these gates pass:

1. Deterministic route/file map resolves the target files.
2. Context pack is capped to 12 files and 2500 total lines by default.
3. `GET http://127.0.0.1:8000/v1/models` returns the exact model id.
4. Requested operation is allowed by `ROLE_SYSTEM_MASTER` or equivalent `AI_AGENT_EXECUTE` feature when execution is involved.
5. Output is a bounded plan, unified diff, or `apply_patch` payload.

vLLM must not perform whole-repository exploration.

## Updated Runtime Files

```text
data/ai-runtime/ollama-control-plane.json
data/ai-runtime/agent-stage-model-matrix.json
modules/resonance-ops/ollama-control-plane/src/main/java/egovframework/com/platform/ollama/web/PlatformInstallPageDataController.java
modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/ollama/web/PlatformInstallPageDataController.java
```

## Router Profiles

`default-router`:

- Small: `qwen2.5-coder:3b`
- Medium: `qwen2.5-coder:14b`
- Large candidate: `devstral`

`vllm-coding-router`:

- Policy: deterministic context first, then vLLM.
- Small: `qwen2.5-coder:3b`
- Medium: `devstral`
- Large candidate: `qwen3.5-coder`

`runtime-router`:

- Small: `gemma3:4b`
- Medium: `qwen2.5-coder:14b`
- Large candidate: `gemma4`

## Operational Rule

AI models are never the source of truth for deployment, DB migration, rollback, backup, or k8s apply.

They can classify, draft, rank, explain, and propose a bounded patch. Deterministic workers apply, verify, deploy, and roll back.


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

