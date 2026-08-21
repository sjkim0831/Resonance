#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/resonance-data/dev-worktrees/certificate-verification}"
original_url="${SPRING_DATASOURCE_URL:-}"
[[ "$original_url" == jdbc:postgresql://*/* ]] || {
  printf 'CERTIFICATE_FAST_DEV_INVALID_DATASOURCE\n' >&2
  exit 79
}

primary_ip="$(kubectl -n carbonet-prod get service postgres-haproxy -o jsonpath='{.spec.clusterIP}')"
[[ "$primary_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  printf 'CERTIFICATE_FAST_DEV_PRIMARY_UNAVAILABLE\n' >&2
  exit 75
}

database_path="/${original_url#jdbc:postgresql://*/}"
export SPRING_DATASOURCE_URL="jdbc:postgresql://${primary_ip}:5432${database_path}"
exec /bin/bash "$ROOT_DIR/ops/scripts/start-java-fast-dev.sh"
