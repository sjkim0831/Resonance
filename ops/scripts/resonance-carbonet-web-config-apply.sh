#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-web}"
CONFIG_FILE="$ROOT_DIR/ops/k8s/carbonet-web/nginx.conf"
BASE_URL="${BASE_URL:-http://127.0.0.1}"

test -s "$CONFIG_FILE"
grep -Eq 'application/javascript[[:space:]]+mjs' "$CONFIG_FILE"
grep -Fq 'location ^~ /admin/digital-twin/woosu-factory/' "$CONFIG_FILE"
grep -Fq 'proxy_pass http://172.16.1.232:5173/;' "$CONFIG_FILE"

kubectl -n "$NAMESPACE" create configmap carbonet-web-nginx \
  --from-file="nginx.conf=$CONFIG_FILE" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NAMESPACE" rollout restart "deployment/$DEPLOYMENT"
kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=120s

viewer_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/admin/digital-twin/woosu-factory/?view=canvas")"
case "$viewer_status" in
  200) ;;
  *) echo "ERROR: Omniverse canvas route returned HTTP $viewer_status" >&2; exit 1 ;;
esac

worker_file="$(find "$ROOT_DIR/projects/carbonet-assets/static/react-app/assets" -maxdepth 1 -type f -name 'pdf.worker.min-*.mjs' -printf '%f\n' | sort | tail -1)"
test -n "$worker_file"
content_type="$(curl -fsSI "$BASE_URL/assets/react/assets/$worker_file" | awk -F': ' 'tolower($1)=="content-type" {gsub("\r", "", $2); print tolower($2)}' | tail -1)"
case "$content_type" in
  application/javascript*|text/javascript*) ;;
  *) echo "ERROR: $worker_file served as ${content_type:-missing}" >&2; exit 1 ;;
esac
cache_control="$(curl -fsSI "$BASE_URL/assets/react/assets/$worker_file" | awk -F': ' 'tolower($1)=="cache-control" {gsub("\r", "", $2); print tolower($2)}' | tail -1)"
case "$cache_control" in
  *no-store*) ;;
  *) echo "ERROR: $worker_file uses unsafe cache policy ${cache_control:-missing}" >&2; exit 1 ;;
esac
echo "OK: $worker_file -> $content_type"
