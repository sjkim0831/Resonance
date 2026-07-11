#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-}"
MODE="${2:---dry-run}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
IMAGE="${IMAGE_NAME:-}"

if [[ ! "$PROJECT_ID" =~ ^[A-Za-z][A-Za-z0-9_-]{1,31}$ ]]; then
  echo "A valid project-id is required." >&2
  exit 2
fi
if [[ "$MODE" != "--dry-run" && "$MODE" != "--apply" ]]; then
  echo "Mode must be --dry-run or --apply." >&2
  exit 2
fi
if [[ -z "$IMAGE" ]]; then
  IMAGE="$(kubectl -n "$NAMESPACE" get deployment carbonet-runtime -o jsonpath='{.spec.template.spec.containers[0].image}')"
fi

resource_id="$(tr '[:upper:]_' '[:lower:]-' <<<"$PROJECT_ID" | sed 's/[^a-z0-9-]//g')"
app="$resource_id-runtime"
output="$ROOT/var/run/project-runtime/$PROJECT_ID/k8s.yaml"
mkdir -p "$(dirname "$output")"
python3 "$ROOT/ops/scripts/render-project-k8s.py" "$PROJECT_ID" --namespace "$NAMESPACE" --image "$IMAGE" >"$output"

if [[ "$MODE" == "--dry-run" ]]; then
  kubectl apply --dry-run=server -f "$output" >/dev/null
  echo "Validated Kubernetes resources: $output"
  exit 0
fi

bash "$ROOT/ops/scripts/patroni-health-check.sh"
kubectl apply -f "$output"
if ! kubectl -n "$NAMESPACE" rollout status "deployment/$app" --timeout=600s; then
  kubectl -n "$NAMESPACE" rollout undo "deployment/$app" >/dev/null 2>&1 || true
  exit 1
fi
kubectl -n "$NAMESPACE" get deployment "$app" \
  -o custom-columns='NAME:.metadata.name,READY:.status.readyReplicas,DESIRED:.spec.replicas,IMAGE:.spec.template.spec.containers[0].image'
bash "$ROOT/ops/scripts/patroni-health-check.sh"
