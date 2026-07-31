#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
python3 "$root/ops/scripts/resonance-github-deploy-webhook.py" --self-test
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
grep -q 'ReadWritePaths=/opt/resonance-data/deploy/github-webhook' \
  "$root/ops/systemd/carbonet-github-deploy-webhook.service"
grep -q 'chmod 0640 /etc/resonance/github-deploy-webhook.secret' \
  "$root/ops/scripts/install-resonance-github-deploy-webhook.sh"
grep -q 'chown root:sjkim /etc/resonance/github-deploy-webhook.secret' \
  "$root/ops/scripts/install-resonance-github-deploy-webhook.sh"
grep -q -- '--network host' \
  "$root/ops/scripts/install-resonance-github-deploy-webhook.sh"
grep -q 'GitHub webhook runtime synchronized' \
  "$root/ops/scripts/auto-deploy-main.sh"
printf '%s\n' "GITHUB_DEPLOY_WEBHOOK_CONTRACT_PASS"
