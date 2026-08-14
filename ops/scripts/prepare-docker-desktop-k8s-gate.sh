#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXPECTED_CONTEXT="${EXPECTED_CONTEXT:-docker-desktop}"
CARBONET_NS="${CARBONET_NS:-carbonet-prod}"
OPS_NS="${OPS_NS:-resonance-ops}"
APPLY_CONFIG="${APPLY_CONFIG:-false}"
APPLY_SECRET="${APPLY_SECRET:-false}"
APPLY_RUNTIME="${APPLY_RUNTIME:-false}"
MIGRATION_SECRET_NAME="carbonet-migration-secret"
MIGRATION_PASSWORD_KEY="SPRING_FLYWAY_PASSWORD"

CONFIG_MANIFEST="$ROOT_DIR/deploy/k8s/projects/carbonet/carbonet-runtime.config.yaml"
SECRET_EXAMPLE="$ROOT_DIR/deploy/k8s/projects/carbonet/carbonet-runtime.secret.example.yaml"
OPS_CONFIG_MANIFEST="$ROOT_DIR/deploy/k8s/base/operations-console.config.yaml"
OPS_SECRET_EXAMPLE="$ROOT_DIR/deploy/k8s/base/operations-console.secret.example.yaml"
OPS_MANIFEST="$ROOT_DIR/deploy/k8s/base/operations-console.deployment.yaml"
RUNTIME_MANIFEST="$ROOT_DIR/deploy/k8s/projects/carbonet/carbonet-runtime.deployment.yaml"

migration_secret_valid() {
  kubectl -n "$CARBONET_NS" get secret "$MIGRATION_SECRET_NAME" -o json 2>/dev/null |
    MIGRATION_PASSWORD_KEY="$MIGRATION_PASSWORD_KEY" python3 -c '
import base64
import json
import os
import sys

try:
    encoded = json.load(sys.stdin).get("data", {}).get(os.environ["MIGRATION_PASSWORD_KEY"])
    decoded = base64.b64decode(encoded, validate=True) if isinstance(encoded, str) else b""
except (ValueError, TypeError, json.JSONDecodeError):
    decoded = b""
raise SystemExit(0 if decoded else 1)
' >/dev/null
}

apply_migration_secret_from_environment() {
  if [ "${CARBONET_DB_PASSWORD+x}" != "x" ] || [ -z "$CARBONET_DB_PASSWORD" ]; then
    echo "FAIL_SECRET set nonempty CARBONET_DB_PASSWORD before provisioning $MIGRATION_SECRET_NAME"
    return 1
  fi
  CARBONET_DB_PASSWORD="$CARBONET_DB_PASSWORD" python3 -c '
import os
import sys

value = os.environ["CARBONET_DB_PASSWORD"].encode()
if not value:
    raise SystemExit(1)
sys.stdout.buffer.write(value)
' |
    kubectl -n "$CARBONET_NS" create secret generic "$MIGRATION_SECRET_NAME" \
      --from-file="$MIGRATION_PASSWORD_KEY=/dev/stdin" \
      --dry-run=client -o yaml |
    kubectl apply -f - >/dev/null
  if ! migration_secret_valid; then
    echo "FAIL_SECRET $MIGRATION_SECRET_NAME/$MIGRATION_PASSWORD_KEY failed decoded-nonempty verification"
    return 1
  fi
}

if [[ "${CARBONET_DESKTOP_MIGRATION_SECRET_ENSURE_ONLY:-false}" == "true" ]]; then
  apply_migration_secret_from_environment
  echo "MIGRATION_SECRET_OK $MIGRATION_SECRET_NAME/$MIGRATION_PASSWORD_KEY"
  exit 0
fi

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
  if [ "${CARBONET_DB_PASSWORD+x}" != "x" ] || [ -z "$CARBONET_DB_PASSWORD" ]; then
    echo "FAIL_SECRET set CARBONET_DB_PASSWORD before APPLY_SECRET=true"
    exit 1
  fi
  CARBONET_DB_USERNAME="$CARBONET_DB_USERNAME" \
  CARBONET_DB_PASSWORD="$CARBONET_DB_PASSWORD" \
  CARBONET_DB_URL="$CARBONET_DB_URL" \
  CARBONET_TOKEN_ACCESS_SECRET="$CARBONET_TOKEN_ACCESS_SECRET" \
  CARBONET_TOKEN_REFRESH_SECRET="$CARBONET_TOKEN_REFRESH_SECRET" \
    python3 -c '
import os
import sys

values = {
    "DB_USERNAME": os.environ["CARBONET_DB_USERNAME"],
    "DB_PASSWORD": os.environ["CARBONET_DB_PASSWORD"],
    "DB_URL": os.environ["CARBONET_DB_URL"],
    "SPRING_DATASOURCE_USERNAME": os.environ["CARBONET_DB_USERNAME"],
    "SPRING_DATASOURCE_PASSWORD": os.environ["CARBONET_DB_PASSWORD"],
    "TOKEN_ACCESS_SECRET": os.environ["CARBONET_TOKEN_ACCESS_SECRET"],
    "TOKEN_REFRESH_SECRET": os.environ["CARBONET_TOKEN_REFRESH_SECRET"],
}
if any("\n" in value or "\r" in value for value in values.values()):
    raise SystemExit("Secret environment values must be single-line")
for key, value in values.items():
    sys.stdout.write(f"{key}={value}\n")
' |
  kubectl -n "$CARBONET_NS" create secret generic carbonet-runtime-secret \
    --from-env-file=/dev/stdin \
    --dry-run=client -o yaml | kubectl apply -f -
  echo "SECRET_APPLIED carbonet-runtime-secret"
  apply_migration_secret_from_environment
  echo "SECRET_APPLIED $MIGRATION_SECRET_NAME"
  if [ "${CARBONET_ECOINVENT_CLIENT_ID+x}" = "x" ] && [ "${CARBONET_ECOINVENT_CLIENT_SECRET+x}" = "x" ]; then
    CARBONET_ECOINVENT_CLIENT_ID="$CARBONET_ECOINVENT_CLIENT_ID" \
    CARBONET_ECOINVENT_CLIENT_SECRET="$CARBONET_ECOINVENT_CLIENT_SECRET" \
      python3 -c '
import os
import sys

values = {
    "CARBONET_ECOINVENT_CLIENT_ID": os.environ["CARBONET_ECOINVENT_CLIENT_ID"],
    "CARBONET_ECOINVENT_CLIENT_SECRET": os.environ["CARBONET_ECOINVENT_CLIENT_SECRET"],
}
if any("\n" in value or "\r" in value for value in values.values()):
    raise SystemExit("Secret environment values must be single-line")
for key, value in values.items():
    sys.stdout.write(f"{key}={value}\n")
' |
    kubectl -n "$CARBONET_NS" create secret generic carbonet-runtime-ecoinvent-secret \
      --from-env-file=/dev/stdin \
      --dry-run=client -o yaml | kubectl apply -f -
    echo "SECRET_APPLIED carbonet-runtime-ecoinvent-secret"
  else
    echo "ECOINVENT_SECRET_NOT_APPLIED set CARBONET_ECOINVENT_CLIENT_ID/CARBONET_ECOINVENT_CLIENT_SECRET to enable ecoinvent API"
  fi
else
  echo "SECRET_NOT_APPLIED set APPLY_SECRET=true with CARBONET_DB_USERNAME/CARBONET_DB_PASSWORD/CARBONET_DB_URL/CARBONET_TOKEN_ACCESS_SECRET/CARBONET_TOKEN_REFRESH_SECRET"
fi

if ! migration_secret_valid; then
  echo "FAIL_SECRET $MIGRATION_SECRET_NAME/$MIGRATION_PASSWORD_KEY is missing, invalid, or decoded-empty"
  exit 1
fi
echo "MIGRATION_SECRET_OK $MIGRATION_SECRET_NAME/$MIGRATION_PASSWORD_KEY"

if [ "$APPLY_RUNTIME" = "true" ]; then
  kubectl apply -f "$RUNTIME_MANIFEST"
  kubectl -n "$CARBONET_NS" rollout status deployment/carbonet-runtime --timeout="${ROLLOUT_TIMEOUT:-240s}"
  echo "RUNTIME_ROLLOUT_OK carbonet-runtime"
else
  echo "RUNTIME_NOT_APPLIED set APPLY_RUNTIME=true after image availability is confirmed"
fi

echo "NEXT_MOVE verify services, logs, and Hermes/RAG control flow"
