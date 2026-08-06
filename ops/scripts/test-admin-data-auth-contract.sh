#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/common/interceptor/AdminMainAuthInterceptor.java"

grep -Fq 'if (isAjaxRequest(request) || isAdminDataRequest(requestUri)) {' "$SOURCE"
grep -Fq 'response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);' "$SOURCE"
grep -Fq 'normalized.endsWith("/page-data")' "$SOURCE"
grep -Fq 'normalized.contains("/api/")' "$SOURCE"

echo 'PASS anonymous admin data requests fail closed with JSON 401'
