#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
secret="${GITHUB_DEPLOY_WEBHOOK_SECRET:-}"
container="${GITHUB_DEPLOY_WEBHOOK_TUNNEL_CONTAINER:-resonance-deploy-webhook-tunnel}"
state_dir="/opt/resonance-data/deploy/github-webhook"
bin_dir="/opt/resonance-data/control-plane/bin"
url_file="$state_dir/public-url"

[[ ${#secret} -ge 32 ]] || {
  echo "[deploy-webhook-install] secret must contain at least 32 characters" >&2
  exit 2
}

sudo -n install -d -m 0750 -o sjkim -g sjkim "$state_dir" "$state_dir/deliveries"
sudo -n install -d -m 0755 "$bin_dir" /etc/resonance
printf '%s' "$secret" |
  sudo -n tee /etc/resonance/github-deploy-webhook.secret >/dev/null
sudo -n chmod 0640 /etc/resonance/github-deploy-webhook.secret
sudo -n chown root:sjkim /etc/resonance/github-deploy-webhook.secret
sudo -n install -m 0750 -o root -g root \
  "$root/ops/scripts/resonance-github-deploy-webhook.py" \
  "$bin_dir/resonance-github-deploy-webhook.py"
sudo -n install -m 0644 \
  "$root/ops/systemd/carbonet-github-deploy-webhook.service" \
  /etc/systemd/system/carbonet-github-deploy-webhook.service
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now carbonet-github-deploy-webhook.service >/dev/null
sudo -n systemctl restart carbonet-github-deploy-webhook.service

sudo -n docker rm -f "$container" >/dev/null 2>&1 || true
sudo -n docker run -d \
  --name "$container" \
  --restart unless-stopped \
  --network host \
  cloudflare/cloudflared:latest \
  tunnel --no-autoupdate --url http://127.0.0.1:9088 >/dev/null

public_url=""
for _ in $(seq 1 60); do
  public_url="$(
    sudo -n docker logs "$container" 2>&1 |
      grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' |
      tail -n 1 || true
  )"
  [[ -n "$public_url" ]] && break
  sleep 1
done
[[ -n "$public_url" ]] || {
  echo "[deploy-webhook-install] Cloudflare quick tunnel URL unavailable" >&2
  exit 3
}
printf '%s\n' "$public_url" >"${url_file}.tmp"
mv "${url_file}.tmp" "$url_file"
public_ready=false
for _ in $(seq 1 60); do
  if curl -fsS --max-time 5 "$public_url/health" 2>/dev/null |
    grep -q '"status":"UP"'; then
    public_ready=true
    break
  fi
  sleep 1
done
[[ "$public_ready" == "true" ]] || {
  echo "[deploy-webhook-install] public webhook health did not become ready" >&2
  exit 4
}
sudo -n systemctl is-active --quiet carbonet-github-deploy-webhook.service
echo "[deploy-webhook-install] PASS url=$public_url/hooks/github/deploy"
