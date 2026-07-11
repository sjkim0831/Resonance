#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SQL_FILE="${SQL_FILE:-$ROOT_DIR/var/run/sdui-component-registry-sync.sql}"

cd "$ROOT_DIR"
node ops/scripts/generate-builder-asset-registry.mjs
node ops/scripts/sync-sdui-component-registry.mjs "$SQL_FILE"
bash ops/scripts/patroni-online-migrate.sh "$SQL_FILE"
