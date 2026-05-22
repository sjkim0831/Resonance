#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
BASE_DIR="${QWEN40_EXL2_BASE_DIR:-/opt/util/ai/exl2}"
VENV_DIR="${QWEN40_EXL2_VENV:-$BASE_DIR/venv}"
TABBY_DIR="${QWEN40_EXL2_TABBY_DIR:-$BASE_DIR/tabbyAPI}"
MODEL_DIR="${QWEN40_EXL2_MODEL_DIR:-/opt/util/ai/vLLM/models/qwen3.6-40b-exl2}"
CONFIG_DIR="${QWEN40_EXL2_CONFIG_DIR:-$BASE_DIR/config}"
MODEL_ID="${QWEN40_EXL2_MODEL_ID:-}"
PORT="${QWEN40_EXL2_PORT:-24046}"
API_KEY="${QWEN40_EXL2_API_KEY:-qwer1234}"
SERVICE_FILE="/etc/systemd/system/codex-qwen36-exl2-candidate.service"

usage() {
  cat <<'EOF'
usage:
  qwen40-exl2-setup.sh prepare
  QWEN40_EXL2_MODEL_ID=<hf/repo> qwen40-exl2-setup.sh download
  qwen40-exl2-setup.sh service
  qwen40-exl2-setup.sh show

This prepares a candidate EXL2/TabbyAPI lane on port 24046.
It does not replace the stable GGUF Qwen40 service.
EOF
}

cmd="${1:-show}"
case "$cmd" in
  -h|--help)
    usage
    exit 0
    ;;
esac

prepare() {
  mkdir -p "$BASE_DIR" "$MODEL_DIR" "$CONFIG_DIR"
  if [ ! -d "$TABBY_DIR/.git" ]; then
    git clone --depth 1 https://github.com/theroyallab/tabbyAPI "$TABBY_DIR" >/dev/null
  else
    git -C "$TABBY_DIR" pull --ff-only >/dev/null || true
  fi
  if [ ! -x "$VENV_DIR/bin/python" ]; then
    python3 -m venv "$VENV_DIR"
  fi
  "$VENV_DIR/bin/python" -m pip install --upgrade pip wheel setuptools >/dev/null
  "$VENV_DIR/bin/python" -m pip install --upgrade huggingface_hub >/dev/null
  cat >"$CONFIG_DIR/qwen36-exl2-candidate.env" <<EOF
QWEN40_EXL2_MODEL_DIR=$MODEL_DIR
QWEN40_EXL2_TABBY_DIR=$TABBY_DIR
QWEN40_EXL2_PORT=$PORT
QWEN40_EXL2_API_KEY=$API_KEY
EOF
  echo "[qwen40-exl2-setup] prepared venv=$VENV_DIR tabbyAPI=$TABBY_DIR modelDir=$MODEL_DIR"
}

download() {
  if [ -z "$MODEL_ID" ]; then
    echo "QWEN40_EXL2_MODEL_ID is required for download." >&2
    exit 2
  fi
  prepare
  "$VENV_DIR/bin/python" - "$MODEL_ID" "$MODEL_DIR" <<'PY'
import sys
from huggingface_hub import snapshot_download
model_id, model_dir = sys.argv[1:3]
snapshot_download(
    repo_id=model_id,
    local_dir=model_dir,
    local_dir_use_symlinks=False,
    resume_download=True,
)
print(model_dir)
PY
}

service() {
  prepare
  if [ "$(id -u)" -ne 0 ]; then
    exec sudo env QWEN40_EXL2_BASE_DIR="$BASE_DIR" QWEN40_EXL2_VENV="$VENV_DIR" QWEN40_EXL2_MODEL_DIR="$MODEL_DIR" QWEN40_EXL2_PORT="$PORT" QWEN40_EXL2_API_KEY="$API_KEY" "$0" service
  fi
  cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=Qwen3.6 40B EXL2 candidate OpenAI-compatible API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$BASE_DIR
EnvironmentFile=-$CONFIG_DIR/qwen36-exl2-candidate.env
ExecStart=/bin/bash -lc 'echo "EXL2 candidate service placeholder. Install TabbyAPI/ExLlamaV2 and set ExecStart after a verified EXL2 repo is downloaded."; sleep infinity'
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  echo "[qwen40-exl2-setup] service placeholder installed: $SERVICE_FILE"
}

show() {
  echo "baseDir=$BASE_DIR"
  echo "venv=$VENV_DIR"
  echo "tabbyAPI=$TABBY_DIR"
  echo "modelDir=$MODEL_DIR"
  echo "port=$PORT"
  [ -x "$VENV_DIR/bin/python" ] && "$VENV_DIR/bin/python" - <<'PY' || true
try:
    import huggingface_hub
    print("huggingface_hub=" + huggingface_hub.__version__)
except Exception as exc:
    print("huggingface_hub=missing", exc)
PY
  [ -d "$MODEL_DIR" ] && du -sh "$MODEL_DIR" || true
  [ -d "$TABBY_DIR/.git" ] && git -C "$TABBY_DIR" log -1 --oneline || true
  systemctl is-enabled codex-qwen36-exl2-candidate.service 2>/dev/null || true
  systemctl is-active codex-qwen36-exl2-candidate.service 2>/dev/null || true
}

case "$cmd" in
  prepare) prepare ;;
  download) download ;;
  service) service ;;
  show) show ;;
  *) usage >&2; exit 2 ;;
esac
