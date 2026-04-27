#!/usr/bin/env bash
set -euo pipefail

# Update Nginx routing for a specific project
# Usage: bash ops/scripts/update-nginx-project-routing.sh [PROJECT_ID] [PORT] [REMOTE_TARGET]

PROJECT_ID="${1:-}"
PORT="${2:-18000}"
REMOTE_TARGET="${3:-carbonet2026@136.117.100.221}"
NGINX_CONF_DIR="/etc/nginx/conf.d"

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 [PROJECT_ID] [PORT] [REMOTE_TARGET]"
    exit 1
fi

echo "[nginx] generating routing config for $PROJECT_ID on port $PORT..."

# 1. Create a partial nginx config snippet
# This assumes the main nginx.conf includes /etc/nginx/conf.d/*.conf inside a server block
# or we are creating a new server block.
# Here we create a snippet that can be included in the main site config.
cat > /tmp/carbonet-route-${PROJECT_ID}.conf <<EOF
# Routing for project: ${PROJECT_ID}
location /r/${PROJECT_ID}/ {
    proxy_pass http://127.0.0.1:${PORT}/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}
EOF

# 2. Upload and Apply to Nginx
echo "[nginx] uploading and reloading nginx on $REMOTE_TARGET..."
scp -o StrictHostKeyChecking=no /tmp/carbonet-route-${PROJECT_ID}.conf "$REMOTE_TARGET:/tmp/"
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "sudo mv /tmp/carbonet-route-${PROJECT_ID}.conf $NGINX_CONF_DIR/ && sudo nginx -t && sudo systemctl reload nginx"

echo "[nginx] Routing for $PROJECT_ID is now active via Nginx snippet."
