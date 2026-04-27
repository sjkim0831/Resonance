#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTAINER_NAME="${CF_TUNNEL_CONTAINER_NAME:-carbonet-cloudflare-tunnel}"
CLOUDFLARED_IMAGE="${CLOUDFLARED_IMAGE:-cloudflare/cloudflared:latest}"
ORIGIN_HOST="${ORIGIN_HOST:-}"
ORIGIN_PORT="${ORIGIN_PORT:-18000}"
ORIGIN_SCHEME="${ORIGIN_SCHEME:-https}"
PUBLIC_HOST_HEADER="${PUBLIC_HOST_HEADER:-carbonet2026.duckdns.org}"
ORIGIN_SERVER_NAME="${ORIGIN_SERVER_NAME:-localhost}"
QUICK_TUNNEL="${QUICK_TUNNEL:-true}"
CF_TUNNEL_TOKEN="${CF_TUNNEL_TOKEN:-}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/var/cloudflare-tunnel}"
LOG_FILE="$LOG_DIR/${CONTAINER_NAME}.log"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

detect_origin_host() {
  if [[ -n "$ORIGIN_HOST" ]]; then
    printf '%s\n' "$ORIGIN_HOST"
    return
  fi

  local detected_host
  detected_host="$(hostname -I | awk '{print $1}')"
  if [[ -z "$detected_host" ]]; then
    echo "Unable to detect origin host IP" >&2
    exit 1
  fi

  printf '%s\n' "$detected_host"
}

remove_existing_container() {
  if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
    docker rm -f "$CONTAINER_NAME" >/dev/null
  fi
}

run_quick_tunnel() {
  local origin_host="$1"
  local origin_url="${ORIGIN_SCHEME}://${origin_host}:${ORIGIN_PORT}"

  docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    "$CLOUDFLARED_IMAGE" \
    tunnel \
    --no-autoupdate \
    --url "$origin_url" \
    --http-host-header "$PUBLIC_HOST_HEADER" \
    --origin-server-name "$ORIGIN_SERVER_NAME" \
    --no-tls-verify >/dev/null
}

run_token_tunnel() {
  docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    "$CLOUDFLARED_IMAGE" \
    tunnel \
    run \
    --token "$CF_TUNNEL_TOKEN" >/dev/null
}

wait_for_logs() {
  mkdir -p "$LOG_DIR"
  : > "$LOG_FILE"

  local tries=30
  while (( tries > 0 )); do
    docker logs "$CONTAINER_NAME" >"$LOG_FILE" 2>&1 || true
    if [[ -s "$LOG_FILE" ]]; then
      break
    fi
    sleep 1
    tries=$((tries - 1))
  done
}

print_summary() {
  local origin_host="$1"
  cat <<EOF
container=$CONTAINER_NAME
mode=$([[ -n "$CF_TUNNEL_TOKEN" && "$QUICK_TUNNEL" != "true" ]] && printf 'token' || printf 'quick')
origin=${ORIGIN_SCHEME}://${origin_host}:${ORIGIN_PORT}
public_host_header=$PUBLIC_HOST_HEADER
origin_server_name=$ORIGIN_SERVER_NAME
log_file=$LOG_FILE
EOF
}

main() {
  require_command docker
  require_command hostname
  require_command awk

  local origin_host
  origin_host="$(detect_origin_host)"

  remove_existing_container

  if [[ "$QUICK_TUNNEL" == "true" || -z "$CF_TUNNEL_TOKEN" ]]; then
    run_quick_tunnel "$origin_host"
  else
    run_token_tunnel
  fi

  wait_for_logs
  print_summary "$origin_host"

  if [[ -f "$LOG_FILE" ]]; then
    sed -n '1,40p' "$LOG_FILE"
  fi
}

main "$@"
