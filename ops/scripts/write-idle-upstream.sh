#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
IDLE_HOST="${2:-}"
IDLE_PORT="${3:-18000}"
INCLUDE_PATH="${NGINX_IDLE_INCLUDE_PATH:-/etc/nginx/carbonet/carbonet-idle-upstream.inc}"
UPSTREAM_NAME="${NGINX_UPSTREAM_NAME:-carbonet_app}"

usage() {
  cat <<'EOF'
Usage:
  write-idle-upstream.sh enable <idle-host> [idle-port]
  write-idle-upstream.sh disable

Environment:
  NGINX_IDLE_INCLUDE_PATH  Managed include file path
  NGINX_UPSTREAM_NAME      Upstream name used by the main nginx config
EOF
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "write-idle-upstream.sh must run as root" >&2
    exit 1
  fi
}

write_enable() {
  local tmp_file
  tmp_file="$(mktemp)"
  cat >"$tmp_file" <<EOF
# Managed by write-idle-upstream.sh
# Include this file inside the ${UPSTREAM_NAME} upstream block.
server ${IDLE_HOST}:${IDLE_PORT} max_fails=3 fail_timeout=10s;
EOF
  install -m 0644 "$tmp_file" "$INCLUDE_PATH"
  rm -f "$tmp_file"
}

write_disable() {
  local tmp_file
  tmp_file="$(mktemp)"
  cat >"$tmp_file" <<'EOF'
# Managed by write-idle-upstream.sh
# Idle upstream disabled.
EOF
  install -m 0644 "$tmp_file" "$INCLUDE_PATH"
  rm -f "$tmp_file"
}

reload_nginx() {
  nginx -t
  systemctl reload nginx
}

main() {
  if [[ -z "$MODE" || "$MODE" == "-h" || "$MODE" == "--help" ]]; then
    usage
    exit 0
  fi

  require_root

  case "$MODE" in
    enable)
      if [[ -z "$IDLE_HOST" ]]; then
        echo "idle host is required for enable" >&2
        exit 1
      fi
      write_enable
      ;;
    disable)
      write_disable
      ;;
    *)
      usage
      exit 1
      ;;
  esac

  reload_nginx
  cat "$INCLUDE_PATH"
}

main "$@"
