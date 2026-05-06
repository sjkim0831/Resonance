#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXPECTED_CONTEXT="${EXPECTED_CONTEXT:-docker-desktop}"
CARBONET_NS="${CARBONET_NS:-carbonet-prod}"
OPS_NS="${OPS_NS:-resonance-ops}"
APPLY_CONFIG="${APPLY_CONFIG:-false}"
APPLY_SECRET="${APPLY_SECRET:-false}"
APPLY_RUNTIME="${APPLY_RUNTIME:-false}"

CONFIG_MANIFEST="$ROOT_DIR/deploy/k8s/projects/carbonet/carbonet-runtime.config.yaml"
SECRET_EXAMPLE="$ROOT_DIR/deploy/k8s/projects/carbonet/carbonet-runtime.secret.example.yaml"
OPS_CONFIG_MANIFEST="$ROOT_DIR/deploy/k8s/base/operations-console.config.yaml"
OPS_SECRET_EXAMPLE="$ROOT_DIR/deploy/k8s/base/operations-console.secret.example.yaml"
OPS_MANIFEST="$ROOT_DIR/deploy/k8s/base/operations-console.deployment.yaml"
RUNTIME_MANIFEST="$ROOT_DIR/deploy/k8s/projects/carbonet/carbonet-runtime.deployment.yaml"

current_context="$(kubectl config current-context)"
if [ "$current_context" != "$EXPECTED_CONTEXT" ]; then
  echo "FAIL_CONTEXT expected=$EXPECTED_CONTEXT actual=$current_context"
  exit 1
fi

kubectl get namespace "$OPS_NS" >/dev/null
kubectl get namespace "$CARBONET_NS" >/dev/null

ready_nodes="$(kubectl get nodes --no-headers | awk '$2 == "Ready" { count++ } END { print count + 0 }')"
if [ "$ready_nodes" -lt 1 ]; then
  echo "FAIL_NODES no Ready nodes found"
  exit 1
fi

echo "CONTEXT_OK $current_context"
echo "NODES_READY $ready_nodes"
echo "NAMESPACE_OK $OPS_NS $CARBONET_NS"

kubectl apply --dry-run=server -f "$CONFIG_MANIFEST" >/dev/null
kubectl apply --dry-run=server -f "$SECRET_EXAMPLE" >/dev/null
kubectl apply --dry-run=server -f "$OPS_CONFIG_MANIFEST" >/dev/null
kubectl apply --dry-run=server -f "$OPS_SECRET_EXAMPLE" >/dev/null
kubectl apply --dry-run=server -f "$OPS_MANIFEST" >/dev/null
kubectl apply --dry-run=server -f "$RUNTIME_MANIFEST" >/dev/null
echo "SERVER_DRY_RUN_OK ops-config ops-secret-example runtime-config runtime-secret-example operations-console carbonet-runtime"

if [ "$APPLY_CONFIG" = "true" ]; then
  kubectl apply -f "$CONFIG_MANIFEST"
  echo "CONFIG_APPLIED $CONFIG_MANIFEST"
else
  echo "CONFIG_NOT_APPLIED set APPLY_CONFIG=true to apply"
fi

if [ "$APPLY_SECRET" = "true" ]; then
  : "${CARBONET_DB_USERNAME:?set CARBONET_DB_USERNAME before APPLY_SECRET=true}"
  : "${CARBONET_DB_URL:?set CARBONET_DB_URL before APPLY_SECRET=true}"
  : "${CARBONET_TOKEN_ACCESS_SECRET:?set CARBONET_TOKEN_ACCESS_SECRET before APPLY_SECRET=true}"
  : "${CARBONET_TOKEN_REFRESH_SECRET:?set CARBONET_TOKEN_REFRESH_SECRET before APPLY_SECRET=true}"
  if [ "${CARBONET_DB_PASSWORD+x}" != "x" ]; then
    echo "FAIL_SECRET set CARBONET_DB_PASSWORD before APPLY_SECRET=true"
    exit 1
  fi
  kubectl -n "$CARBONET_NS" create secret generic carbonet-runtime-secret \
    --from-literal=DB_USERNAME="$CARBONET_DB_USERNAME" \
    --from-literal=DB_PASSWORD="$CARBONET_DB_PASSWORD" \
    --from-literal=DB_URL="$CARBONET_DB_URL" \
    --from-literal=SPRING_DATASOURCE_USERNAME="$CARBONET_DB_USERNAME" \
    --from-literal=SPRING_DATASOURCE_PASSWORD="$CARBONET_DB_PASSWORD" \
    --from-literal=TOKEN_ACCESS_SECRET="$CARBONET_TOKEN_ACCESS_SECRET" \
    --from-literal=TOKEN_REFRESH_SECRET="$CARBONET_TOKEN_REFRESH_SECRET" \
    --dry-run=client -o yaml | kubectl apply -f -
  echo "SECRET_APPLIED carbonet-runtime-secret"
  if [ "${CARBONET_ECOINVENT_CLIENT_ID+x}" = "x" ] && [ "${CARBONET_ECOINVENT_CLIENT_SECRET+x}" = "x" ]; then
    kubectl -n "$CARBONET_NS" create secret generic carbonet-runtime-ecoinvent-secret \
      --from-literal=CARBONET_ECOINVENT_CLIENT_ID="$CARBONET_ECOINVENT_CLIENT_ID" \
      --from-literal=CARBONET_ECOINVENT_CLIENT_SECRET="$CARBONET_ECOINVENT_CLIENT_SECRET" \
      --dry-run=client -o yaml | kubectl apply -f -
    echo "SECRET_APPLIED carbonet-runtime-ecoinvent-secret"
  else
    echo "ECOINVENT_SECRET_NOT_APPLIED set CARBONET_ECOINVENT_CLIENT_ID/CARBONET_ECOINVENT_CLIENT_SECRET to enable ecoinvent API"
  fi
else
  echo "SECRET_NOT_APPLIED set APPLY_SECRET=true with CARBONET_DB_USERNAME/CARBONET_DB_PASSWORD/CARBONET_DB_URL/CARBONET_TOKEN_ACCESS_SECRET/CARBONET_TOKEN_REFRESH_SECRET"
fi

if [ "$APPLY_RUNTIME" = "true" ]; then
  kubectl apply -f "$RUNTIME_MANIFEST"
  kubectl -n "$CARBONET_NS" rollout status deployment/carbonet-runtime --timeout="${ROLLOUT_TIMEOUT:-240s}"
  echo "RUNTIME_ROLLOUT_OK carbonet-runtime"
else
  echo "RUNTIME_NOT_APPLIED set APPLY_RUNTIME=true after image availability is confirmed"
fi

echo "NEXT_MOVE verify services, logs, and Hermes/RAG control flow"
