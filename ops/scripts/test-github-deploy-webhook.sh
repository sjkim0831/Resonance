#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
python3 "$root/ops/scripts/resonance-github-deploy-webhook.py" --self-test
python3 -m py_compile \
  "$root/ops/scripts/sync-github-deploy-webhook-url.py"
bash -n "$root/ops/scripts/install-resonance-github-deploy-webhook.sh"
grep -q 'X-Hub-Signature-256' \
  "$root/ops/scripts/resonance-github-deploy-webhook.py"
grep -q 'refs/heads/main' \
  "$root/ops/scripts/resonance-github-deploy-webhook.py"
grep -q 'sjkim0831/Resonance' \
  "$root/ops/scripts/resonance-github-deploy-webhook.py"
grep -q 'NoNewPrivileges=true' \
  "$root/ops/systemd/carbonet-github-deploy-webhook.service"
grep -q 'User=root' \
  "$root/ops/systemd/carbonet-github-deploy-webhook.service"
grep -Fq '["systemctl", "start", "--no-block"' \
  "$root/ops/scripts/resonance-github-deploy-webhook.py"
grep -q 'def prefetch_revision' \
  "$root/ops/scripts/resonance-github-deploy-webhook.py"
grep -q '"runuser", "-u", "sjkim"' \
  "$root/ops/scripts/resonance-github-deploy-webhook.py"
test "$(grep -c '"runuser", "-u", "sjkim"' \
  "$root/ops/scripts/resonance-github-deploy-webhook.py")" -eq 2
grep -q 'prefetch deferred to deploy service' \
  "$root/ops/scripts/resonance-github-deploy-webhook.py"
grep -q 'ReadWritePaths=/opt/resonance-data/deploy/github-webhook' \
  "$root/ops/systemd/carbonet-github-deploy-webhook.service"
grep -q '/opt/Resonance/.git' \
  "$root/ops/systemd/carbonet-github-deploy-webhook.service"
grep -q 'chmod 0640 /etc/resonance/github-deploy-webhook.secret' \
  "$root/ops/scripts/install-resonance-github-deploy-webhook.sh"
grep -q 'chown root:sjkim /etc/resonance/github-deploy-webhook.secret' \
  "$root/ops/scripts/install-resonance-github-deploy-webhook.sh"
grep -q -- '--network host' \
  "$root/ops/scripts/install-resonance-github-deploy-webhook.sh"
grep -q 'GitHub webhook runtime synchronized' \
  "$root/ops/scripts/auto-deploy-main.sh"
grep -q 'OnUnitActiveSec=60s' \
  "$root/ops/systemd/carbonet-github-webhook-reconcile.timer"
grep -q 'GITHUB_WEBHOOK_URL_SYNC_PASS' \
  "$root/ops/scripts/sync-github-deploy-webhook-url.py"
grep -q 'docker\", \"run\", \"-d\"' \
  "$root/ops/scripts/sync-github-deploy-webhook-url.py"
grep -q 'wait_public_health' \
  "$root/ops/scripts/sync-github-deploy-webhook-url.py"
grep -q 'consecutive_successes >= 3' \
  "$root/ops/scripts/sync-github-deploy-webhook-url.py"
grep -q 'stable_funnel or current_tunnel_url' \
  "$root/ops/scripts/sync-github-deploy-webhook-url.py"
grep -q 'ensure_configured_funnel(configured_url)' \
  "$root/ops/scripts/sync-github-deploy-webhook-url.py"
grep -q 'verify_local_webhook_health()' \
  "$root/ops/scripts/sync-github-deploy-webhook-url.py"
grep -q 'transport = \"tailscale\"' \
  "$root/ops/scripts/sync-github-deploy-webhook-url.py"
grep -q 'webhook URL reconciliation deferred to timer' \
  "$root/ops/scripts/auto-deploy-main.sh"
grep -q -- '--protocol http2' \
  "$root/ops/scripts/install-resonance-github-deploy-webhook.sh"
printf '%s\n' "GITHUB_DEPLOY_WEBHOOK_CONTRACT_PASS"
