#!/usr/bin/env bash
set -euo pipefail

MAIN_HOST="${1:-127.0.0.1}"
MAIN_PORT="${2:-18000}"
INCLUDE_PATH="${NGINX_MAIN_INCLUDE_PATH:-/etc/nginx/carbonet/carbonet-main-upstream.inc}"
UPSTREAM_NAME="${NGINX_UPSTREAM_NAME:-carbonet_app}"

usage() {
  cat <<'EOF'
Usage:
  write-main-upstream.sh <host> <port>

Environment:
  NGINX_MAIN_INCLUDE_PATH  Managed include file path
  NGINX_UPSTREAM_NAME      Upstream name used by the main nginx config
EOF
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "write-main-upstream.sh must run as root" >&2
    exit 1
  fi
}

main() {
  if [[ -z "$MAIN_HOST" || -z "$MAIN_PORT" ]]; then
    usage
    exit 1
  fi

  require_root

  local tmp_file
  tmp_file="$(mktemp)"
  cat >"$tmp_file" <<EOF
# Managed by write-main-upstream.sh
# Include this file inside the ${UPSTREAM_NAME} upstream block.
server ${MAIN_HOST}:${MAIN_PORT} max_fails=3 fail_timeout=10s;
EOF
  install -m 0644 "$tmp_file" "$INCLUDE_PATH"
  rm -f "$tmp_file"

  nginx -t
  systemctl reload nginx
  cat "$INCLUDE_PATH"
}

main "$@"
