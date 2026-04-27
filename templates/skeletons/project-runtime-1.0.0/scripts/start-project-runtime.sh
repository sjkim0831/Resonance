#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-P_TEMPLATE}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

java -jar "$ROOT_DIR/project-runtime.jar" \
  --spring.profiles.active=prod \
  --app.project-id="$PROJECT_ID" \
  --spring.config.additional-location="$ROOT_DIR/config/application-prod.yml"
