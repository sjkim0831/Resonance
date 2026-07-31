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

temp_repo="$(mktemp -d)"
trap 'rm -rf "$temp_repo"' EXIT
git -C "$temp_repo" init -q
git -C "$temp_repo" config user.email test@example.invalid
git -C "$temp_repo" config user.name test
mkdir -p "$temp_repo/.github/workflows"
printf '%s\n' 'name: initial' >"$temp_repo/README.md"
git -C "$temp_repo" add .
git -C "$temp_repo" commit -qm initial
printf '%s\n' 'name: push' >"$temp_repo/.github/workflows/deploy.yml"
git -C "$temp_repo" add .
git -C "$temp_repo" commit -qm workflow
plan="$(cd "$temp_repo" && bash "$root/ops/scripts/plan-incremental-work.sh" HEAD^ HEAD)"
grep -q 'runtime=false frontend=false backend=false' <<<"$plan"
grep -q 'reasons=automation-only' <<<"$plan"

printf '%s\n' "PUSH_DEPLOY_DISPATCH_PASS"
