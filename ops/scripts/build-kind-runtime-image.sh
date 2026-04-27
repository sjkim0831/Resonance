#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_ID="${PROJECT_ID:-P003}"
IMAGE_NAME="${IMAGE_NAME:-carbonet-local/carbonet-p003:latest}"
KIND_CLUSTER="${KIND_CLUSTER:-dev}"
RELEASE_DIR="$ROOT_DIR/var/releases/$PROJECT_ID/image-context"

cd "$ROOT_DIR"

mvn -pl apps/project-runtime -am -Dmaven.test.skip=true package

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR/lib" "$RELEASE_DIR/config"
cp apps/project-runtime/target/project-runtime.jar "$RELEASE_DIR/project-runtime.jar"

if compgen -G "projects/carbonet-adapter/target/*.jar" >/dev/null; then
  cp projects/carbonet-adapter/target/*.jar "$RELEASE_DIR/lib/" || true
fi

if [ -d templates/skeletons/project-runtime-1.0.0/config ]; then
  cp -R templates/skeletons/project-runtime-1.0.0/config/. "$RELEASE_DIR/config/"
fi

docker build   --build-arg PROJECT_ID="$PROJECT_ID"   -f ops/docker/Dockerfile.project-runtime   -t "$IMAGE_NAME"   "$RELEASE_DIR"

if command -v kind >/dev/null 2>&1; then
  kind load docker-image "$IMAGE_NAME" --name "$KIND_CLUSTER"
else
  for node in "${KIND_CLUSTER}-control-plane" "${KIND_CLUSTER}-worker" "${KIND_CLUSTER}-worker2"; do
    if docker ps --format '{{.Names}}' | grep -Fxq "$node"; then
      docker save "$IMAGE_NAME" | docker exec -i "$node" ctr -n k8s.io images import -
    fi
  done
fi

echo "BUILT_AND_LOADED $IMAGE_NAME into kind/$KIND_CLUSTER from $RELEASE_DIR"
