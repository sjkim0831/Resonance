#!/usr/bin/env bash
set -euo pipefail

# Assemble, Build, and Run a specific project locally using Docker Compose
# Usage: bash ops/scripts/run-local-docker.sh [PROJECT_ID] [HOST_PORT]

PROJECT_ID="${1:-}"
HOST_PORT="${2:-18000}"

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 [PROJECT_ID] [HOST_PORT]"
    echo "Example: $0 p003 18000"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "================================================================"
echo " Starting Local Docker Environment for Carbonet Project: $PROJECT_ID"
echo "================================================================"

# 1. Assemble the release package
echo "[local-run] 1. Assembling release package..."
bash "$ROOT_DIR/ops/scripts/assemble-project-release.sh" "$PROJECT_ID"

# 2. Run Docker Compose
echo "[local-run] 2. Starting Docker container (Port: $HOST_PORT)..."
export PROJECT_ID="$PROJECT_ID"
export HOST_PORT="$HOST_PORT"

docker-compose -f "$ROOT_DIR/ops/docker/docker-compose.project.yml" up --build -d

echo "================================================================"
echo " [SUCCESS] Container carbonet-${PROJECT_ID}-local is starting!"
echo " - API Endpoint: http://localhost:$HOST_PORT/api/v1/$PROJECT_ID/..."
echo " - Health Check: http://localhost:$HOST_PORT/api/runtime/project-info"
echo " - Logs: docker logs -f carbonet-${PROJECT_ID}-local"
echo " To stop: docker-compose -f ops/docker/docker-compose.project.yml down"
echo "================================================================"
