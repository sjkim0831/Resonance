#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(git rev-parse --show-toplevel)}"
REF="${2:-HEAD}"
PREFIX=platform/control-plane/backstage

git -C "$ROOT" ls-tree -r "$REF" -- "$PREFIX" |
  awk -F '\t' '
    {
      path=$2
      if (path ~ /\/packages\/app\/e2e-tests\//) next
      if (path ~ /\/e2e-test-report\//) next
      if (path ~ /\/playwright\.config\.ts$/) next
      if (path ~ /\/README\.md$/) next
      if (path ~ /\/catalog-info\.yaml$/) next
      if (path ~ /\/\.eslint(ignore|rc\.js)$/) next
      if (path ~ /\/\.prettier(ignore)?$/) next
      if (path ~ /\/\.gitignore$/) next
      print
    }
  ' |
  sha256sum |
  awk '{print $1}'
