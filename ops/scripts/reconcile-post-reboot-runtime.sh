#!/usr/bin/env bash
set -euo pipefail

namespace="${CARBONET_NAMESPACE:-carbonet-prod}"
manifest="${CARBONET_HAPROXY_CONFIG_MANIFEST:-/opt/resonance-data/control-plane/manifests/postgres-haproxy-config.yaml}"
deadline=$((SECONDS + 600))

kubectl_retry() {
  local attempt
  for attempt in $(seq 1 30); do
    if "$@"; then
      return 0
    fi
    echo "[post-reboot] Kubernetes mutation not ready; retry=$attempt/30" >&2
    sleep 5
  done
  return 1
}

until kubectl get node ccus >/dev/null 2>&1; do
  ((SECONDS < deadline)) || {
    echo "[post-reboot] Kubernetes API did not become ready" >&2
    exit 2
  }
  sleep 5
done

kubectl_retry kubectl apply -f "$manifest"
desired="$(kubectl -n "$namespace" get deployment postgres-haproxy -o jsonpath='{.spec.replicas}')"
available="$(kubectl -n "$namespace" get deployment postgres-haproxy -o jsonpath='{.status.availableReplicas}')"
if [[ "${available:-0}" != "$desired" ]]; then
  kubectl_retry kubectl -n "$namespace" rollout restart deployment/postgres-haproxy
fi
kubectl -n "$namespace" rollout status deployment/postgres-haproxy --timeout=180s

health="$(curl -fsS --max-time 10 http://127.0.0.1/actuator/health || true)"
if [[ "$health" != *'"status":"UP"'* ]]; then
  kubectl_retry kubectl -n "$namespace" rollout restart deployment/carbonet-runtime
  kubectl -n "$namespace" rollout status deployment/carbonet-runtime --timeout=240s
  kubectl_retry kubectl -n "$namespace" rollout restart deployment/carbonet-web
  kubectl -n "$namespace" rollout status deployment/carbonet-web --timeout=180s
fi

health="$(curl -fsS --max-time 10 http://127.0.0.1/actuator/health)"
[[ "$health" == *'"status":"UP"'* ]]
echo "POST_REBOOT_RUNTIME_RECOVERY_PASS"
