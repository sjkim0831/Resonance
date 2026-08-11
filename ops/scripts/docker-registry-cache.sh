#!/usr/bin/env bash

# Registry cache importers must use one concrete Docker image reference.
# Wildcards are not part of Docker's reference grammar and make BuildKit reject
# the importer before it can reuse any layers.
docker_registry_reference_is_valid() {
  local reference="${1:-}"

  [[ -n "$reference" ]] || return 1
  [[ "$reference" != *[[:space:]]* ]] || return 1
  [[ "$reference" != *'*'* && "$reference" != *'?'* ]] || return 1

  # Repository names are lowercase. Tags may contain letters, digits,
  # underscores, periods and dashes, and must start with a word character.
  [[ "$reference" =~ ^([a-z0-9]+([._-]+[a-z0-9]+)*(:[0-9]+)?/)*[a-z0-9]+([._-]+[a-z0-9]+)*(:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?(@sha256:[a-f0-9]{64})?$ ]]
}

append_docker_registry_cache_from() {
  local output_name="${1:?cache argument array name is required}"
  local reference="${2:-}"

  docker_registry_reference_is_valid "$reference" || return 1

  local -n output_ref="$output_name"
  output_ref+=(--cache-from "type=registry,ref=$reference")
}
