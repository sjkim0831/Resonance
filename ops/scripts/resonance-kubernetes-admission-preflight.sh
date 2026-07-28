#!/usr/bin/env bash
set -euo pipefail

KUBECTL_REQUEST_TIMEOUT="${KUBECTL_REQUEST_TIMEOUT:-10s}"
KYVERNO_NAMESPACE="${KYVERNO_NAMESPACE:-kyverno}"
KYVERNO_DEPLOYMENT="${KYVERNO_DEPLOYMENT:-kyverno-admission-controller}"
KYVERNO_SERVICE="${KYVERNO_SERVICE:-kyverno-svc}"

fail() {
  echo "[admission-preflight] $*" >&2
  exit 1
}

kubectl_fast() {
  kubectl --request-timeout="$KUBECTL_REQUEST_TIMEOUT" "$@"
}

command -v kubectl >/dev/null ||
  fail "kubectl is required"

node_ready="$(
  kubectl_fast get nodes \
    -o jsonpath='{range .items[*]}{range .status.conditions[?(@.type=="Ready")]}{.status}{"\n"}{end}{end}' \
    2>/dev/null || true
)"
grep -qx 'True' <<<"$node_ready" ||
  fail "no Ready Kubernetes node; refusing a deployment write"

available="$(
  kubectl_fast -n "$KYVERNO_NAMESPACE" get deployment "$KYVERNO_DEPLOYMENT" \
    -o jsonpath='{.status.availableReplicas}' 2>/dev/null || true
)"
[[ "${available:-0}" -ge 1 ]] ||
  fail "Kyverno admission controller has no available replica"

ready_endpoint="$(
  kubectl_fast -n "$KYVERNO_NAMESPACE" get endpointslice \
    -l "kubernetes.io/service-name=$KYVERNO_SERVICE" \
    -o jsonpath='{range .items[*].endpoints[?(@.conditions.ready==true)]}{.addresses[0]}{"\n"}{end}' \
    2>/dev/null | sed '/^$/d' | head -n 1 || true
)"
[[ -n "$ready_endpoint" ]] ||
  fail "Kyverno admission service has no ready endpoint"

# Exercise the admission path without changing cluster state. This catches a
# Service with a stale endpoint before a real Secret, ConfigMap, or Deployment
# write waits on the webhook timeout.
probe_name="resonance-admission-probe-$(date +%s)-$$"
printf 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: %s\n  namespace: default\ndata:\n  probe: "true"\n' \
  "$probe_name" |
  kubectl_fast apply --dry-run=server -f - >/dev/null ||
  fail "Kyverno admission dry-run failed; deployment was not started"

echo "[admission-preflight] ready endpoint=$ready_endpoint"
