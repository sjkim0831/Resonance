#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/restart-local-carbonet-k8s.sh

Purpose:
  Rebuild the local Carbonet React bundle and project runtime image, roll out
  carbonet-prod/carbonet-runtime, and ensure 127.0.0.1:18080 points to that
  service rather than another local Kubernetes app.

Useful env:
  SKIP_FRONTEND=true       Skip npm build when static assets are already fresh.
  SKIP_IMAGE_BUILD=true    Skip Maven/Docker build and only rollout/port-forward.
  APPLY_CONFIG=true        Apply deploy/k8s/projects/carbonet/carbonet-runtime.config.yaml.
  IMAGE_NAME=...           Override the rollout image tag.
  LOCAL_PORT=18080         Override the local port-forward port.
  CARBONET_NODE_HEAP_MB=8192
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
CONTAINER="${CONTAINER:-carbonet-runtime}"
SERVICE="${SERVICE:-carbonet-runtime}"
LOCAL_PORT="${LOCAL_PORT:-18080}"
SERVICE_PORT="${SERVICE_PORT:-80}"
PROJECT_ID="${PROJECT_ID:-P003}"
KIND_CLUSTER="${KIND_CLUSTER:-dev}"
if [[ -z "${IMAGE_NAME:-}" && "${SKIP_IMAGE_BUILD:-false}" == "true" ]]; then
  IMAGE_NAME="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath="{.spec.template.spec.containers[?(@.name=='$CONTAINER')].image}")"
fi
IMAGE_NAME="${IMAGE_NAME:-registry.local/carbonet-runtime:$(date +%Y.%m.%d-%H%M%S-local)}"
RELEASE_DIR="$ROOT_DIR/var/releases/$PROJECT_ID/image-context"
PORT_FORWARD_LOG="$ROOT_DIR/var/logs/${SERVICE}-${LOCAL_PORT}-port-forward.log"
PORT_FORWARD_PID="$ROOT_DIR/var/run/${SERVICE}-${LOCAL_PORT}-port-forward.pid"
CONFIG_MANIFEST="$ROOT_DIR/deploy/k8s/projects/carbonet/carbonet-runtime.config.yaml"

cd "$ROOT_DIR"
mkdir -p "$ROOT_DIR/var/logs" "$ROOT_DIR/var/run"

echo "[local-k8s] board=context $(kubectl config current-context)"
echo "[local-k8s] image=$IMAGE_NAME namespace=$NAMESPACE service=$SERVICE local-port=$LOCAL_PORT"

if [[ "${SKIP_FRONTEND:-false}" != "true" ]]; then
  echo "[local-k8s] move=frontend-build"
  (cd "$ROOT_DIR/projects/carbonet-frontend/source" && CARBONET_NODE_HEAP_MB="${CARBONET_NODE_HEAP_MB:-8192}" npm run build)
else
  echo "[local-k8s] move=frontend-build skipped"
fi

if [[ "${SKIP_IMAGE_BUILD:-false}" != "true" ]]; then
  echo "[local-k8s] move=maven-package"
  mvn -q -pl apps/project-runtime -am -Dmaven.test.skip=true package

  echo "[local-k8s] move=image-context"
  rm -rf "$RELEASE_DIR"
  mkdir -p "$RELEASE_DIR/lib" "$RELEASE_DIR/config" "$RELEASE_DIR/ops/config"
  cp "$ROOT_DIR/apps/project-runtime/target/project-runtime.jar" "$RELEASE_DIR/project-runtime.jar"
  if compgen -G "$ROOT_DIR/projects/carbonet-adapter/target/*.jar" >/dev/null; then
    cp "$ROOT_DIR"/projects/carbonet-adapter/target/*.jar "$RELEASE_DIR/lib/" || true
  fi
  if [[ -d "$ROOT_DIR/templates/skeletons/project-runtime-1.0.0/config" ]]; then
    cp -R "$ROOT_DIR/templates/skeletons/project-runtime-1.0.0/config/." "$RELEASE_DIR/config/"
  fi
  cp -R "$RELEASE_DIR/config/." "$RELEASE_DIR/ops/config/" 2>/dev/null || true

  echo "[local-k8s] move=docker-build"
  docker build \
    --build-arg PROJECT_ID="$PROJECT_ID" \
    -f "$ROOT_DIR/ops/docker/Dockerfile.project-runtime" \
    -t "$IMAGE_NAME" \
    "$RELEASE_DIR"

  if command -v kind >/dev/null 2>&1; then
    echo "[local-k8s] move=kind-load cluster=$KIND_CLUSTER"
    kind load docker-image "$IMAGE_NAME" --name "$KIND_CLUSTER"
  else
    mapfile -t docker_nodes < <(docker ps --format '{{.Names}}' | grep -E "^(${KIND_CLUSTER}|desktop)-(control-plane|worker[0-9]*)$" || true)
    if [[ "${#docker_nodes[@]}" -gt 0 ]]; then
      echo "[local-k8s] move=ctr-import nodes=${docker_nodes[*]}"
      for node in "${docker_nodes[@]}"; do
        docker save "$IMAGE_NAME" | docker exec -i "$node" ctr -n k8s.io images import - >/dev/null
      done
    else
      echo "[local-k8s] move=ctr-import skipped no visible kind node containers"
    fi
  fi
else
  echo "[local-k8s] move=image-build skipped"
fi

if [[ "${APPLY_CONFIG:-false}" == "true" ]]; then
  echo "[local-k8s] move=apply-config"
  kubectl apply -f "$CONFIG_MANIFEST"
fi

echo "[local-k8s] move=rollout"
kubectl -n "$NAMESPACE" set image "deployment/$DEPLOYMENT" "$CONTAINER=$IMAGE_NAME"
kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout="${ROLLOUT_TIMEOUT:-300s}"

stop_existing_port_forward() {
  local pid
  pid="$(ss -ltnp 2>/dev/null | awk -v port=":$LOCAL_PORT" 'index($4, port) && match($0, /pid=[0-9]+/) { print substr($0, RSTART + 4, RLENGTH - 4); exit }' || true)"
  if [[ -n "$pid" ]]; then
    local command_line
    command_line="$(ps -p "$pid" -o args= 2>/dev/null || true)"
    if [[ "$command_line" == *"kubectl"* && "$command_line" == *"port-forward"* ]]; then
      echo "[local-k8s] move=stop-port-forward pid=$pid"
      kill "$pid" 2>/dev/null || true
      sleep 1
    else
      echo "[local-k8s] port $LOCAL_PORT is used by non-kubectl process: $command_line" >&2
      exit 1
    fi
  fi
}

if [[ "${ENSURE_PORT_FORWARD:-true}" == "true" ]]; then
  stop_existing_port_forward
  echo "[local-k8s] move=start-port-forward $LOCAL_PORT:$SERVICE_PORT"
  nohup kubectl -n "$NAMESPACE" port-forward --address 127.0.0.1 "svc/$SERVICE" "$LOCAL_PORT:$SERVICE_PORT" >"$PORT_FORWARD_LOG" 2>&1 &
  echo "$!" >"$PORT_FORWARD_PID"
  sleep 2
  tail -20 "$PORT_FORWARD_LOG" || true
fi

echo "[local-k8s] move=verify"
curl -fsS --max-time 10 "http://127.0.0.1:$LOCAL_PORT/actuator/health" >/tmp/carbonet-local-health.json
cat /tmp/carbonet-local-health.json
echo

manifest_file="$(mktemp)"
curl -fsS --max-time 10 "http://127.0.0.1:$LOCAL_PORT/assets/react/.vite/manifest.json" >"$manifest_file"
if grep -q "EmissionEcoinventAdminMigrationPage" "$manifest_file"; then
  rm -f "$manifest_file"
  echo "[local-k8s] CHECKMATE ecoinvent bundle is served on :$LOCAL_PORT"
else
  rm -f "$manifest_file"
  echo "[local-k8s] WARN ecoinvent bundle marker not found on :$LOCAL_PORT" >&2
  exit 1
fi
