#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATUS_FILE="${STATUS_FILE:-$ROOT_DIR/data/version-control/k8s-runtime-status-20260427.json}"

fail() {
  echo "FAIL $*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

need_cmd jq
need_cmd kubectl

[[ -f "$STATUS_FILE" ]] || fail "status file not found: $STATUS_FILE"
jq empty "$STATUS_FILE"

expected_context="$(jq -r '.cluster.context' "$STATUS_FILE")"
current_context="$(kubectl config current-context)"
[[ "$current_context" == "$expected_context" ]] || fail "context mismatch: expected=$expected_context actual=$current_context"

expected_nodes="$(jq -r '.cluster.readyNodeCount' "$STATUS_FILE")"
actual_nodes="$(kubectl get nodes --no-headers | awk '$2 == "Ready" { count++ } END { print count + 0 }')"
[[ "$actual_nodes" == "$expected_nodes" ]] || fail "ready node mismatch: expected=$expected_nodes actual=$actual_nodes"

deployment_count="$(jq '.deployments | length' "$STATUS_FILE")"
for index in $(seq 0 $((deployment_count - 1))); do
  component="$(jq -r ".deployments[$index].component" "$STATUS_FILE")"
  namespace="$(jq -r ".deployments[$index].namespace" "$STATUS_FILE")"
  deployment="$(jq -r ".deployments[$index].deployment" "$STATUS_FILE")"
  expected_image="$(jq -r ".deployments[$index].expectedImage" "$STATUS_FILE")"
  expected_ready="$(jq -r ".deployments[$index].expectedReadyReplicas" "$STATUS_FILE")"

  actual_image="$(kubectl -n "$namespace" get deploy "$deployment" -o jsonpath='{.spec.template.spec.containers[0].image}')"
  [[ "$actual_image" == "$expected_image" ]] || fail "$component image mismatch: expected=$expected_image actual=$actual_image"

  actual_ready="$(kubectl -n "$namespace" get deploy "$deployment" -o jsonpath='{.status.readyReplicas}')"
  actual_ready="${actual_ready:-0}"
  [[ "$actual_ready" == "$expected_ready" ]] || fail "$component ready mismatch: expected=$expected_ready actual=$actual_ready"
done

echo "PASS build version metadata matches current Kubernetes runtime"
