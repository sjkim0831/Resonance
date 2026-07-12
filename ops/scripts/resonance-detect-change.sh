#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -n "${DEPLOY_SCOPE:-}" ]]; then
  printf '%s\n' "${DEPLOY_SCOPE^^}"
  exit 0
fi

mapfile -t changed < <(git status --porcelain=v1 --untracked-files=all | sed -E 's/^.. //' | sed -E 's/.* -> //' | sed '/^$/d')
if [[ ${#changed[@]} -eq 0 ]]; then
  echo NO_CHANGES
  exit 0
fi

frontend=false
backend=false
config=false
for path in "${changed[@]}"; do
  case "$path" in
    projects/carbonet-frontend/*|projects/carbonet-assets/*) frontend=true ;;
    apps/*|modules/*|*.gradle|*.gradle.kts|gradle/*) backend=true ;;
    ops/k8s/*|ops/config/*|*.yaml|*.yml|*.properties) config=true ;;
    *) backend=true ;;
  esac
done

if $frontend && ! $backend && ! $config; then echo FRONTEND
elif $backend && ! $frontend && ! $config; then echo BACKEND
elif $config && ! $frontend && ! $backend; then echo CONFIG
else echo OTHER
fi
