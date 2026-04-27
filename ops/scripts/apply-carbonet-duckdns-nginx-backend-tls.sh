#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-carbonet.duckdns.org}"
SITE_PATH="${SITE_PATH:-/etc/nginx/sites-enabled/carbonet}"
BACKUP_DIR="${BACKUP_DIR:-/etc/nginx/carbonet/backups}"
MAIN_UPSTREAM_INC="${MAIN_UPSTREAM_INC:-/etc/nginx/carbonet/carbonet-main-upstream.inc}"
IDLE_UPSTREAM_INC="${IDLE_UPSTREAM_INC:-/etc/nginx/carbonet/carbonet-idle-upstream.inc}"
CERT_PATH="${CERT_PATH:-/etc/letsencrypt/live/${DOMAIN}/fullchain.pem}"
KEY_PATH="${KEY_PATH:-/etc/letsencrypt/live/${DOMAIN}/privkey.pem}"

need_sudo() {
  if [[ "$(id -u)" -eq 0 ]]; then
    return 1
  fi
  return 0
}

run_sudo() {
  if need_sudo; then
    sudo "$@"
  else
    "$@"
  fi
}

if need_sudo; then
  sudo -n true
fi

run_sudo mkdir -p "$(dirname "$SITE_PATH")" "$BACKUP_DIR" "$(dirname "$MAIN_UPSTREAM_INC")"
if [[ -f "$SITE_PATH" ]]; then
  run_sudo cp "$SITE_PATH" "$BACKUP_DIR/carbonet.$(date '+%Y%m%d-%H%M%S').bak"
fi

if [[ ! -f "$MAIN_UPSTREAM_INC" ]]; then
  cat <<'EOF' | run_sudo tee "$MAIN_UPSTREAM_INC" >/dev/null
# Managed by write-main-upstream.sh
# Include this file inside the carbonet_app upstream block.
server 127.0.0.1:18000 max_fails=3 fail_timeout=10s;
EOF
fi

if [[ ! -f "$IDLE_UPSTREAM_INC" ]]; then
  cat <<'EOF' | run_sudo tee "$IDLE_UPSTREAM_INC" >/dev/null
# Managed by write-idle-upstream.sh
# Idle upstream disabled.
EOF
fi

tmp_file="$(mktemp)"
cat >"$tmp_file" <<EOF
upstream carbonet_app {
    include $MAIN_UPSTREAM_INC;
    include $IDLE_UPSTREAM_INC;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate $CERT_PATH;
    ssl_certificate_key $KEY_PATH;
    ssl_session_timeout 1d;
    ssl_session_cache shared:CarbonetSSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), geolocation=(), microphone=()" always;
    add_header Content-Security-Policy "upgrade-insecure-requests" always;

    proxy_http_version 1.1;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_ssl_server_name on;
    proxy_ssl_name localhost;
    proxy_ssl_verify off;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header X-Forwarded-Port 443;

    location = / {
        return 301 https://$DOMAIN/home;
    }

    location = /home {
        proxy_pass https://carbonet_app;
    }

    location / {
        proxy_pass https://carbonet_app;
    }
}
EOF

run_sudo cp "$tmp_file" "$SITE_PATH"
rm -f "$tmp_file"
run_sudo nginx -t
run_sudo systemctl reload nginx
