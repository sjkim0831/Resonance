#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
workflow="$root/.github/workflows/carbonet-push-deploy.yml"
timer="$root/ops/systemd/carbonet-auto-deploy.timer"
installer="$root/ops/scripts/install-resonance-github-runner.sh"

bash -n "$installer"
grep -q 'resonance-deploy' "$workflow"
grep -q 'systemctl start --no-block carbonet-auto-deploy.service' "$workflow"
grep -q 'carbonet-main-success.commit' "$workflow"
grep -q 'actuator/health' "$workflow"
grep -q 'OnCalendar=.*0/10' "$timer"
grep -q '/opt/resonance-data/github-runner' "$installer"
grep -q 'systemctl is-active --quiet' "$installer"

printf '%s\n' "PUSH_DEPLOY_DISPATCH_PASS"
