#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
IMAGE_REPOSITORY="${CARBONET_REPORT_OCR_IMAGE_REPOSITORY:-localhost:5000/carbonet-report-ocr}"
IMAGE_TAG="${CARBONET_REPORT_OCR_IMAGE_TAG:-3.1.0-r3}"
IMAGE="${IMAGE_REPOSITORY}:${IMAGE_TAG}"

docker build --pull=false --tag "$IMAGE" "$ROOT_DIR/services/report-ocr"
docker push "$IMAGE"
docker image inspect "$IMAGE" --format '{{index .RepoDigests 0}}'
