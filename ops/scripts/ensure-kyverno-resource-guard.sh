#!/usr/bin/env bash
set -euo pipefail

namespace="${KYVERNO_NAMESPACE:-kyverno}"
deployment="${KYVERNO_REPORTS_DEPLOYMENT:-kyverno-reports-controller}"
container="${KYVERNO_REPORTS_CONTAINER:-controller}"
cpu_limit="${KYVERNO_REPORTS_CPU_LIMIT:-750m}"
memory_limit="${KYVERNO_REPORTS_MEMORY_LIMIT:-256Mi}"

if ! kubectl -n "$namespace" get deployment "$deployment" >/dev/null 2>&1; then
  echo "[kyverno-resource-guard] skipped: $namespace/$deployment is not installed"
  exit 0
fi

patch_json="$(kubectl -n "$namespace" get deployment "$deployment" -o json |
  CONTAINER_NAME="$container" python3 -c '
import json, os, sys
deployment = json.load(sys.stdin)
name = os.environ["CONTAINER_NAME"]
for item in deployment["spec"]["template"]["spec"]["containers"]:
    if item["name"] != name:
        continue
    args = item.get("args", [])
    if "--skipResourceFilters=true" not in args:
        break
    args = ["--skipResourceFilters=false" if value == "--skipResourceFilters=true" else value for value in args]
    print(json.dumps({"spec":{"template":{"spec":{"containers":[{"name":name,"args":args}]}}}}))
    break
')"
if [[ -n "$patch_json" ]]; then
  kubectl -n "$namespace" patch deployment "$deployment" --type=strategic -p "$patch_json"
  echo "[kyverno-resource-guard] enabled configured resource filters"
fi

current_cpu="$(kubectl -n "$namespace" get deployment "$deployment" \
  -o jsonpath='{.spec.template.spec.containers[?(@.name=="'"$container"'")].resources.limits.cpu}')"
current_memory="$(kubectl -n "$namespace" get deployment "$deployment" \
  -o jsonpath='{.spec.template.spec.containers[?(@.name=="'"$container"'")].resources.limits.memory}')"
if [[ "$current_cpu" != "$cpu_limit" || "$current_memory" != "$memory_limit" ]]; then
  kubectl -n "$namespace" set resources deployment "$deployment" \
    --containers="$container" \
    --requests=cpu=100m,memory=64Mi \
    --limits="cpu=$cpu_limit,memory=$memory_limit"
  echo "[kyverno-resource-guard] restored cpu=$cpu_limit memory=$memory_limit"
fi

echo "[kyverno-resource-guard] healthy cpu=$cpu_limit memory=$memory_limit filters=enabled"
