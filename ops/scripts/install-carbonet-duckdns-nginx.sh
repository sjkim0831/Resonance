#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_PATH="${1:-$ROOT_DIR/ops/config/nginx/carbonet-duckdns.org.conf.example}"
TARGET_PATH="${2:-/etc/nginx/sites-enabled/carbonet}"
NGINX_BIN="${NGINX_BIN:-nginx}"
SYSTEMCTL_BIN="${SYSTEMCTL_BIN:-systemctl}"

usage() {
  cat <<'EOF'
Usage:
  install-carbonet-duckdns-nginx.sh [source-path] [target-path]

Default source:
  ops/config/nginx/carbonet-duckdns.org.conf.example

Default target:
  /etc/nginx/sites-enabled/carbonet
EOF
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "install-carbonet-duckdns-nginx.sh must run as root" >&2
    exit 1
  fi
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  require_root
  require_command install
  require_command "$NGINX_BIN"
  require_command "$SYSTEMCTL_BIN"

  if [[ ! -f "$SOURCE_PATH" ]]; then
    echo "Source config not found: $SOURCE_PATH" >&2
    exit 1
  fi

  install -D -m 0644 "$SOURCE_PATH" "$TARGET_PATH"
  "$NGINX_BIN" -t
  "$SYSTEMCTL_BIN" reload nginx
  echo "$TARGET_PATH"
}

main "$@"
