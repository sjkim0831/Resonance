#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SQL_FILE="${1:-$ROOT/var/run/sdui-page-manifest-sync.sql}"

cd "$ROOT"
node ops/scripts/sync-sdui-page-manifests.mjs "$SQL_FILE"
bash ops/scripts/patroni-online-migrate.sh "$SQL_FILE"
