#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${ROOK_CEPH_NAMESPACE:-rook-ceph}"
LOCK_FILE="${ROOK_CEPH_GUARD_LOCK:-/tmp/resonance-unused-ceph-guard.lock}"
REQUEST_TIMEOUT="${KUBECTL_REQUEST_TIMEOUT:-10s}"

for command in kubectl jq flock; do
  command -v "$command" >/dev/null || {
    echo "[unused-ceph-guard] missing command: $command" >&2
    exit 1
  }
done

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

kubectl_fast() {
  kubectl --request-timeout="$REQUEST_TIMEOUT" "$@"
}

ceph_volume_count="$(
  kubectl_fast get pv -o json |
    jq '[.items[] | select((.spec.csi.driver // "") | contains("ceph"))] | length'
)"

if [[ "$ceph_volume_count" -gt 0 ]]; then
  echo "[unused-ceph-guard] active Ceph volumes=$ceph_volume_count; no action"
  exit 0
fi

mapfile -t deployments < <(
  kubectl_fast -n "$NAMESPACE" get deployment \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null ||
    true
)
[[ "${#deployments[@]}" -gt 0 ]] || {
  echo "[unused-ceph-guard] no Rook deployments found"
  exit 0
}

# Stop reconciliation before workloads so the operator cannot immediately
# recreate an unused monitor. No Ceph CR, host data, or Kubernetes object is
# deleted; setting replicas back to one is a complete rollback.
for deployment in rook-ceph-operator "${deployments[@]}"; do
  [[ -n "$deployment" ]] || continue
  kubectl_fast -n "$NAMESPACE" get deployment "$deployment" >/dev/null 2>&1 ||
    continue
  replicas="$(
    kubectl_fast -n "$NAMESPACE" get deployment "$deployment" \
      -o jsonpath='{.spec.replicas}'
  )"
  [[ "${replicas:-0}" -eq 0 ]] ||
    kubectl_fast -n "$NAMESPACE" scale deployment "$deployment" \
      --replicas=0 >/dev/null
done

echo "[unused-ceph-guard] PASS Ceph volumes=0; unused Rook deployments remain disabled"
