#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ACTIVE_DEPLOY_SCRIPT="$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
# shellcheck source=ops/scripts/docker-registry-cache.sh
source "$ROOT_DIR/ops/scripts/docker-registry-cache.sh"

valid_refs=(
  'localhost:5000/carbonet-runtime:2026.08.11-101500-gradle'
  'registry.local/carbonet-runtime:base'
  'registry.example.com/team/carbonet-runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
)
invalid_refs=(
  'localhost:5000/carbonet-runtime:2026.08.11-101500:*'
  'localhost:5000/carbonet-runtime:*'
  'localhost:5000/carbonet-runtime:two:tags'
  'localhost:5000/Carbonet/runtime:latest'
  'localhost:5000/carbonet runtime:latest'
  ''
)

for reference in "${valid_refs[@]}"; do
  docker_registry_reference_is_valid "$reference" || {
    echo "[docker-registry-cache] FAIL valid reference rejected: $reference" >&2
    exit 1
  }
done

for reference in "${invalid_refs[@]}"; do
  if docker_registry_reference_is_valid "$reference"; then
    echo "[docker-registry-cache] FAIL invalid reference accepted: $reference" >&2
    exit 1
  fi
done

cache_args=()
append_docker_registry_cache_from cache_args "${valid_refs[0]}"
[[ "${#cache_args[@]}" -eq 2 ]]
[[ "${cache_args[0]}" == '--cache-from' ]]
[[ "${cache_args[1]}" == "type=registry,ref=${valid_refs[0]}" ]]

before_count="${#cache_args[@]}"
if append_docker_registry_cache_from cache_args "${invalid_refs[0]}"; then
  echo '[docker-registry-cache] FAIL wildcard cache source was appended' >&2
  exit 1
fi
[[ "${#cache_args[@]}" -eq "$before_count" ]]

cache_source_block="$(sed -n '/local cache_ref=""/,/log_cmd "docker build/p' "$ACTIVE_DEPLOY_SCRIPT")"
grep -Fq 'append_docker_registry_cache_from registry_cache_args "$cache_ref"' <<<"$cache_source_block"
grep -Fq -- '--arg container "$CONTAINER"' <<<"$cache_source_block"
grep -Fq 'select(.name == $container)' <<<"$cache_source_block"
if grep -Fq 'containers[0].image' <<<"$cache_source_block"; then
  echo '[docker-registry-cache] FAIL cache source depends on container array order' >&2
  exit 1
fi
if grep -Eq -- '--cache-from.*(\*|\?)|ref=[^[:space:]]*[*?]' "$ACTIVE_DEPLOY_SCRIPT"; then
  echo '[docker-registry-cache] FAIL active deploy contains a wildcard cache importer' >&2
  exit 1
fi
if grep -Fq '${IMAGE_NAME%-*}:*' "$ACTIVE_DEPLOY_SCRIPT"; then
  echo '[docker-registry-cache] FAIL invalid timestamp wildcard construction remains' >&2
  exit 1
fi

echo '[docker-registry-cache] PASS valid=3 invalid=6 wildcard=0 active=current-deployment-ref container=name'
