#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOMAIN="${DUCKDNS_DOMAIN:-carbonet2026.duckdns.org}"
CONTAINER_NAME="${NGINX_CONTAINER_NAME:-carbonet-duckdns-local-nginx}"
NGINX_IMAGE="${NGINX_IMAGE:-nginx:1.27-alpine}"
HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
STATE_DIR="${STATE_DIR:-$ROOT_DIR/var/nginx-duckdns-local}"
CERT_DIR="$STATE_DIR/certs/$DOMAIN"
CONF_DIR="$STATE_DIR/conf"
CONF_PATH="$CONF_DIR/${DOMAIN}.conf"
TEMPLATE_PATH="$ROOT_DIR/ops/config/nginx/carbonet2026.duckdns.org.local.conf.template"
UPSTREAM_HOST="${UPSTREAM_HOST:-}"
CERT_GENERATOR_SCRIPT="${CERT_GENERATOR_SCRIPT:-$ROOT_DIR/ops/scripts/generate-local-browser-trusted-cert.sh}"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

prepare_dirs() {
  mkdir -p "$CERT_DIR" "$CONF_DIR"
}

generate_cert_if_missing() {
  if [[ -x "$CERT_GENERATOR_SCRIPT" ]]; then
    DOMAIN="$DOMAIN" STATE_DIR="$STATE_DIR" bash "$CERT_GENERATOR_SCRIPT" >/dev/null
    if [[ -f "$CERT_DIR/fullchain.pem" && -f "$CERT_DIR/privkey.pem" ]]; then
      return
    fi
  fi

  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -days 3650 \
    -subj "/C=KR/ST=Seoul/L=Seoul/O=Carbonet/OU=Local Proxy/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1"
}

render_conf() {
  local rendered_upstream_host="$UPSTREAM_HOST"
  if [[ -z "$rendered_upstream_host" ]]; then
    rendered_upstream_host="$(hostname -I | awk '{print $1}')"
  fi

  if [[ -z "$rendered_upstream_host" ]]; then
    echo "Unable to detect upstream host IP" >&2
    exit 1
  fi

  sed \
    -e "s/__DOMAIN__/$DOMAIN/g" \
    -e "s/__UPSTREAM_HOST__/$rendered_upstream_host/g" \
    "$TEMPLATE_PATH" > "$CONF_PATH"
}

remove_existing_container() {
  if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
    docker rm -f "$CONTAINER_NAME" >/dev/null
  fi
}

run_container() {
  docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "$HTTP_PORT:80" \
    -p "$HTTPS_PORT:443" \
    -v "$CONF_PATH:/etc/nginx/conf.d/default.conf:ro" \
    -v "$CERT_DIR:/etc/nginx/certs:ro" \
    "$NGINX_IMAGE" >/dev/null
}

print_summary() {
  cat <<EOF
container=$CONTAINER_NAME
domain=$DOMAIN
http=http://$DOMAIN
https=https://$DOMAIN
conf=$CONF_PATH
cert_dir=$CERT_DIR
root_ca=$STATE_DIR/ca/carbonet-local-root-ca.pem
EOF
}

main() {
  require_command docker
  require_command openssl
  require_command sed

  if [[ ! -f "$TEMPLATE_PATH" ]]; then
    echo "Template not found: $TEMPLATE_PATH" >&2
    exit 1
  fi

  prepare_dirs
  generate_cert_if_missing
  render_conf
  remove_existing_container
  run_container
  print_summary
}

main "$@"
