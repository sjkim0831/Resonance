#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bash -n "$root/ops/scripts/reconcile-post-reboot-runtime.sh"
grep -q 'init-addr last,libc,none' \
  "$root/ops/kubernetes/postgres-haproxy-config.yaml"
grep -q 'nameserver kube-dns 10.96.0.10:53' \
  "$root/ops/kubernetes/postgres-haproxy-config.yaml"
grep -q 'POST_REBOOT_RUNTIME_RECOVERY_PASS' \
  "$root/ops/scripts/reconcile-post-reboot-runtime.sh"
grep -q 'Kubernetes mutation not ready; retry=' \
  "$root/ops/scripts/reconcile-post-reboot-runtime.sh"
grep -q 'WantedBy=multi-user.target' \
  "$root/ops/systemd/carbonet-post-reboot-recovery.service"
grep -q 'post-reboot runtime recovery synchronized' \
  "$root/ops/scripts/auto-deploy-main.sh"
echo "POST_REBOOT_RUNTIME_RECOVERY_CONTRACT_PASS"
