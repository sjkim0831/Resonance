#!/usr/bin/env bash
set -euo pipefail

TARGET_NAMESPACE="${1:-${BACKSTAGE_NAMESPACE:-resonance-ops}}"
REQUEST_TIMEOUT="${KUBECTL_REQUEST_TIMEOUT:-10s}"

fail() {
  echo "[admission-preflight] BLOCK $*" >&2
  exit 17
}

kubectl_fast() {
  kubectl --request-timeout="$REQUEST_TIMEOUT" "$@"
}

command -v kubectl >/dev/null 2>&1 || fail "kubectl is unavailable"

kubectl_fast get namespace "$TARGET_NAMESPACE" >/dev/null 2>&1 ||
  fail "target namespace is unavailable: $TARGET_NAMESPACE"

ready_nodes="$(
  kubectl_fast get nodes \
    -o jsonpath='{range .items[*]}{range .status.conditions[?(@.type=="Ready")]}{.status}{"\n"}{end}{end}' \
    2>/dev/null | grep -c '^True$' || true
)"
[[ "$ready_nodes" -ge 1 ]] || fail "no Ready Kubernetes node"

# Exercise the complete API admission chain without persisting cluster state.
# This detects unavailable validating/mutating webhooks independently of their
# implementation (Kyverno today, another policy engine later).
probe_name="resonance-admission-probe-$(date +%s)-$$"
printf '%s\n' \
  'apiVersion: v1' \
  'kind: ConfigMap' \
  'metadata:' \
  "  name: $probe_name" \
  "  namespace: $TARGET_NAMESPACE" \
  '  labels:' \
  '    app.kubernetes.io/part-of: resonance-control-plane' \
  'data:' \
  '  probe: "true"' |
  kubectl_fast apply --dry-run=server -f - >/dev/null ||
  fail "server-side admission dry-run failed"

echo "[admission-preflight] PASS namespace=$TARGET_NAMESPACE readyNodes=$ready_nodes"
