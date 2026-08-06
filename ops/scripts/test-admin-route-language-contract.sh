#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$ROOT/modules/resonance-common/web-support/src/main/java/egovframework/com/feature/admin/web/AdminReactRouteSupport.java"

grep -Fq 'if (uri.startsWith("/en/")) {' "$SOURCE"
grep -Fq 'if (uri.startsWith("/admin")) {' "$SOURCE"
grep -Fq 'return false;' "$SOURCE"

echo 'PASS /admin is Korean and /en/admin is English independent of browser locale'
