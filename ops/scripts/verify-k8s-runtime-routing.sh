#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
SERVICE="${SERVICE:-carbonet-runtime}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
LOCAL_PORT="${LOCAL_PORT:-18080}"
HEALTH_PATH="${HEALTH_PATH:-/actuator/health}"
EXPECTED_CONTEXT="${EXPECTED_CONTEXT:-}"
CHECK_LOCAL_PORT="${CHECK_LOCAL_PORT:-true}"

if [[ -n "$EXPECTED_CONTEXT" ]]; then
  current_context="$(kubectl config current-context)"
  if [[ "$current_context" != "$EXPECTED_CONTEXT" ]]; then
    echo "FAIL_CONTEXT expected=$EXPECTED_CONTEXT actual=$current_context"
    exit 20
  fi
fi

echo "[k8s-routing] namespace=$NAMESPACE deployment=$DEPLOYMENT service=$SERVICE local_port=$LOCAL_PORT"

kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" >/dev/null
kubectl -n "$NAMESPACE" get "svc/$SERVICE" >/dev/null

ready_replicas="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
ready_replicas="${ready_replicas:-0}"
desired_replicas="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath='{.spec.replicas}' 2>/dev/null || true)"
desired_replicas="${desired_replicas:-0}"
echo "[k8s-routing] replicas ready=$ready_replicas desired=$desired_replicas"

endpoint_ips="$(kubectl -n "$NAMESPACE" get endpoints "$SERVICE" -o jsonpath='{range .subsets[*].addresses[*]}{.ip}{" "}{end}' 2>/dev/null || true)"
endpoint_ports="$(kubectl -n "$NAMESPACE" get endpoints "$SERVICE" -o jsonpath='{range .subsets[*].ports[*]}{.port}{" "}{end}' 2>/dev/null || true)"
if [[ -z "${endpoint_ips// }" ]]; then
  echo "FAIL_ENDPOINTS no ready endpoints for svc/$SERVICE"
  kubectl -n "$NAMESPACE" describe "svc/$SERVICE" || true
  exit 30
fi
echo "[k8s-routing] endpoints ips=$endpoint_ips ports=$endpoint_ports"

mapfile -t ready_pods < <(kubectl -n "$NAMESPACE" get pods -l "app=$SERVICE" -o json |
  jq -r '
    .items[]
    | select(.metadata.deletionTimestamp == null)
    | select(.status.phase == "Running")
    | select(any(.status.containerStatuses[]?; .ready == true))
    | .metadata.name
  ')

if ((${#ready_pods[@]} == 0)); then
  echo "FAIL_PODS no Running+Ready pods with app=$SERVICE"
  kubectl -n "$NAMESPACE" get pods -l "app=$SERVICE" -o wide || true
  exit 31
fi

echo "[k8s-routing] ready_pods=${ready_pods[*]}"

probe_pod="runtime-routing-curl-$(date +%s)"
cluster_health="$(kubectl -n "$NAMESPACE" run "$probe_pod" \
  --image=curlimages/curl:8.10.1 \
  --restart=Never \
  --rm -i --quiet \
  --command -- curl -fsS --max-time 10 "http://$SERVICE$HEALTH_PATH" 2>/dev/null || true)"

if [[ "$cluster_health" != *'"status":"UP"'* && "$cluster_health" != *'"status": "UP"'* ]]; then
  echo "FAIL_CLUSTER_HEALTH svc/$SERVICE$HEALTH_PATH returned: ${cluster_health:-<empty>}"
  kubectl -n "$NAMESPACE" get pods -l "app=$SERVICE" -o wide || true
  exit 40
fi
echo "[k8s-routing] cluster_health=$cluster_health"

if [[ "$CHECK_LOCAL_PORT" == "true" ]]; then
  local_health="$(curl -fsS --max-time 10 "http://127.0.0.1:$LOCAL_PORT$HEALTH_PATH" 2>/dev/null || true)"
  if [[ "$local_health" != *'"status":"UP"'* && "$local_health" != *'"status": "UP"'* ]]; then
    echo "FAIL_LOCAL_HEALTH http://127.0.0.1:$LOCAL_PORT$HEALTH_PATH returned: ${local_health:-<empty>}"
    echo "HINT restart governed port-forward with ops/scripts/restart-local-carbonet-k8s.sh or frontend-fast script"
    exit 41
  fi
  echo "[k8s-routing] local_health=$local_health"
fi

echo "ROUTING_HEALTH_OK service=$SERVICE endpoints='${endpoint_ips}' ready_replicas=$ready_replicas"
