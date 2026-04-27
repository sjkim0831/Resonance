#!/usr/bin/env bash
set -euo pipefail

# Build a Docker image for an assembled independent project runtime
# Usage: bash ops/scripts/build-project-docker.sh [PROJECT_ID] [REGISTRY_PREFIX]

PROJECT_ID="${1:-}"
REGISTRY_PREFIX="${2:-carbonet-local}" # e.g., your-docker-hub-id or aws-ecr-url

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 [PROJECT_ID] [REGISTRY_PREFIX]"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE_DIR="$ROOT_DIR/var/releases/$PROJECT_ID"
DOCKERFILE="$ROOT_DIR/ops/docker/Dockerfile.project-runtime"

if [ ! -d "$RELEASE_DIR" ]; then
    echo "[docker-build] Error: Release directory not found: $RELEASE_DIR"
    echo "[docker-build] Please run 'bash ops/scripts/assemble-project-release.sh $PROJECT_ID' first."
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d%H%M%S)
IMAGE_NAME="${REGISTRY_PREFIX}/carbonet-${PROJECT_ID}"
IMAGE_TAG_LATEST="${IMAGE_NAME}:latest"
IMAGE_TAG_VERSION="${IMAGE_NAME}:${TIMESTAMP}"

echo "[docker-build] Building Docker image for $PROJECT_ID..."
echo "[docker-build] Build context: $RELEASE_DIR"
echo "[docker-build] Tags: $IMAGE_TAG_LATEST, $IMAGE_TAG_VERSION"

# Build the image using the release directory as the context
docker build \
    --build-arg PROJECT_ID="$PROJECT_ID" \
    -t "$IMAGE_TAG_LATEST" \
    -t "$IMAGE_TAG_VERSION" \
    -f "$DOCKERFILE" \
    "$RELEASE_DIR"

echo "[docker-build] SUCCESS!"
echo "[docker-build] To run locally:"
echo "  docker run -p 18000:8080 -e DB_USERNAME=dba -e DB_PASSWORD=dba123 $IMAGE_TAG_LATEST"
