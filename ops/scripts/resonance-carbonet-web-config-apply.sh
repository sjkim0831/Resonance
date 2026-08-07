#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-web}"
CONFIG_FILE="$ROOT_DIR/ops/k8s/carbonet-web/nginx.conf"
BASE_URL="${BASE_URL:-http://127.0.0.1}"

test -s "$CONFIG_FILE"
bash "$ROOT_DIR/ops/scripts/validate-carbonet-web-nodeport-client-ip-contract.sh" --live --namespace "$NAMESPACE"
grep -Eq 'application/javascript[[:space:]]+mjs' "$CONFIG_FILE"
if grep -Fq '$proxy_add_x_forwarded_for' "$CONFIG_FILE"; then
  echo 'ERROR: inbound X-Forwarded-For must be overwritten, not appended' >&2
  exit 1
fi
forwarded_count="$(grep -Fc 'proxy_set_header X-Forwarded-For $remote_addr;' "$CONFIG_FILE")"
rate_client_count="$(grep -Fc 'proxy_set_header X-RateLimit-Client-IP $remote_addr;' "$CONFIG_FILE")"
if [[ "$forwarded_count" != 4 || "$rate_client_count" != 4 ]]; then
  echo "ERROR: sanitized client-IP headers incomplete forwarded=$forwarded_count rateLimit=$rate_client_count expected=4" >&2
  exit 1
fi

kubectl -n "$NAMESPACE" create configmap carbonet-web-nginx \
  --from-file="nginx.conf=$CONFIG_FILE" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NAMESPACE" rollout restart "deployment/$DEPLOYMENT"
kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=120s

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
