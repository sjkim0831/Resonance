#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-model-gates}"
mkdir -p "$OUT_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="$OUT_DIR/model-registry-probe-$STAMP.md"

write() {
  printf '%s\n' "$*" | tee -a "$REPORT"
}

write "# AI Model Registry Probe"
write ""
write "- time: $(date -Is)"
write "- root: $ROOT_DIR"
write ""

write "## Ollama"
if command -v ollama >/dev/null 2>&1; then
  write ""
  write '```text'
  ollama list 2>&1 | tee -a "$REPORT"
  write '```'
else
  write ""
  write "ollama command not found"
fi

write ""
write "## vLLM Endpoint"
VLLM_ENDPOINT="${VLLM_ENDPOINT:-http://127.0.0.1:8000/v1}"
write ""
write "- endpoint: $VLLM_ENDPOINT"
write ""
if curl -fsS "$VLLM_ENDPOINT/models" >/tmp/resonance-vllm-models.json 2>/tmp/resonance-vllm-models.err; then
  write '```json'
  cat /tmp/resonance-vllm-models.json | tee -a "$REPORT"
  write '```'
else
  write '```text'
  cat /tmp/resonance-vllm-models.err | tee -a "$REPORT" || true
  write '```'
fi

write ""
write "## Hugging Face Candidate IDs"
write ""

candidate_urls=(
  "https://huggingface.co/api/models/Qwen/Qwen2.5-Coder-7B-Instruct"
  "https://huggingface.co/api/models/Qwen/Qwen2.5-Coder-14B-Instruct"
  "https://huggingface.co/api/models/mistralai/Devstral-Small-2505"
  "https://huggingface.co/api/models/mistralai/Devstral-Small-2-24B-Instruct-2512"
  "https://huggingface.co/api/models/google/gemma-3-4b-it"
)

for url in "${candidate_urls[@]}"; do
  model="${url#https://huggingface.co/api/models/}"
  code="$(curl -L -sS -o /tmp/resonance-hf-model.json -w '%{http_code}' "$url" || true)"
  if [ "$code" = "200" ]; then
    write "- PASS $model"
  else
    write "- FAIL $model http_status=$code"
  fi
done

write ""
write "## Logical Candidate Names"
write ""
write "- qwen3.5-coder: keep logical-only until exact public checkpoint is selected."
write "- gemma4: keep logical-only until exact public checkpoint is selected."
write ""
write "Report: $REPORT"

