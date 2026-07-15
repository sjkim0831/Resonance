#!/usr/bin/env bash
set -euo pipefail

# Keep removed CUBRID automation, duplicate deploy loops, and filesystem-level
# Kubernetes cleanup disabled after upgrades. cleanup-k8s used rm -rf directly
# under /var/lib/kubelet/pods and can unlink live hostPath mount state.
TIMERS=(
  hermes-session-sync.timer
  hermes-janitor.timer
  resonance-k8s-boot-stabilize.timer
  resonance-backend-auto-redeploy.timer
  resonance-k8s-self-heal.timer
  cleanup-k8s.timer
)
SERVICES=(
  hermes-session-sync.service
  hermes-janitor.service
  resonance-k8s-boot-stabilize.service
  resonance-backend-auto-redeploy.service
  resonance-k8s-self-heal.service
  cleanup-k8s.service
  resonance-hermes-framework-qwen40-exl3.service
)

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

systemctl disable --now "${TIMERS[@]}"
systemctl reset-failed "${SERVICES[@]}" 2>/dev/null || true

for timer in "${TIMERS[@]}"; do
  state="$(systemctl is-enabled "$timer" 2>/dev/null || true)"
  [[ "$state" == "disabled" ]] || {
    echo "Failed to disable $timer: $state" >&2
    exit 1
  }
done

echo "Deprecated automation is disabled."
