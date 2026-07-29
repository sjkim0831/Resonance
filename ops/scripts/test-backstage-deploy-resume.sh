#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
deploy_script="$ROOT/ops/scripts/resonance-backstage-deploy.sh"
auto_deploy_script="$ROOT/ops/scripts/auto-deploy-main.sh"
unit="$ROOT/ops/systemd/carbonet-auto-deploy.service"
keycloak="$ROOT/deploy/k8s/control-plane/keycloak.yaml"

for file in "$deploy_script" "$auto_deploy_script"; do
  bash -n "$file"
done

grep -Fq 'reusing verified application image without dependency install' "$deploy_script"
grep -Fq 'BACKSTAGE_DEPLOY_STATE_FILE=' "$auto_deploy_script"
grep -Fq 'Backstage runtime checkpoint verified; resuming at E2E gates' "$auto_deploy_script"
grep -Fq 'MemoryHigh=6G' "$unit"
grep -Fq 'OOMScoreAdjust=500' "$unit"
grep -Fq 'value: -Xms192m -Xmx512m' "$keycloak"
grep -Fq 'memory: 1Gi' "$keycloak"

echo "PASS Backstage retries resume at E2E without rebuilding and protect Keycloak resources"
