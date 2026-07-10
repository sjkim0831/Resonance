#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
PHASE="${1:-pre}"
shift || true
WORKLOADS=("${@:-carbonet-runtime carbonet-web}")

fail() {
  echo "[zero-downtime-gate] FAIL: $*" >&2
  exit 1
}

for name in ${WORKLOADS[*]}; do
  kubectl -n "$NAMESPACE" get deployment "$name" >/dev/null 2>&1 \
    || fail "deployment/$name does not exist"

  replicas=$(kubectl -n "$NAMESPACE" get deployment "$name" -o jsonpath='{.spec.replicas}')
  unavailable=$(kubectl -n "$NAMESPACE" get deployment "$name" -o jsonpath='{.spec.strategy.rollingUpdate.maxUnavailable}')
  surge=$(kubectl -n "$NAMESPACE" get deployment "$name" -o jsonpath='{.spec.strategy.rollingUpdate.maxSurge}')
  ready=$(kubectl -n "$NAMESPACE" get deployment "$name" -o jsonpath='{.status.readyReplicas}')
  endpoints=$(kubectl -n "$NAMESPACE" get endpoints "$name" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null | wc -w)

  [[ "$replicas" =~ ^[0-9]+$ && "$replicas" -ge 2 ]] \
    || fail "deployment/$name must have at least two replicas"
  [[ "$unavailable" == "0" || "$unavailable" == "0%" ]] \
    || fail "deployment/$name maxUnavailable must be zero"
  [[ -n "$surge" && "$surge" != "0" && "$surge" != "0%" ]] \
    || fail "deployment/$name maxSurge must allow a replacement pod"
  [[ "$ready" =~ ^[0-9]+$ && "$ready" -ge 2 ]] \
    || fail "deployment/$name has fewer than two ready pods"
  [[ "$endpoints" -ge 2 ]] \
    || fail "service/$name has fewer than two ready endpoints"
  kubectl -n "$NAMESPACE" get pdb "$name-pdb" >/dev/null 2>&1 \
    || fail "pdb/$name-pdb does not exist"

  echo "[zero-downtime-gate] $PHASE deployment/$name replicas=$replicas ready=$ready endpoints=$endpoints policy=$unavailable/$surge"
done
