#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/auth/web/AuthApiController.java"
PAGE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/auth/web/AuthPageController.java"
SESSION="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/auth/web/AccountRecoveryResultSession.java"
FRONTEND="$ROOT/projects/carbonet-frontend/source/src/features/public-entry/PublicEntryPages.tsx"
ENTRY_API="$ROOT/projects/carbonet-frontend/source/src/features/public-entry/publicEntryApi.ts"
CORE_API="$ROOT/projects/carbonet-frontend/source/src/lib/api/core.ts"

for file in "$API" "$PAGE" "$SESSION" "$FRONTEND" "$ENTRY_API" "$CORE_API"; do
  [[ -f "$file" ]] || { echo "missing source: $file" >&2; exit 1; }
done

grep -Fq 'AccountRecoveryResultSession.grant(request);' "$API"
grep -Fq 'AccountRecoveryResultSession.consume(request)' "$PAGE"
grep -Fq 'redirect:/signin/findPassword' "$PAGE"
grep -Fq 'redirect:/en/signin/findPassword' "$PAGE"
grep -Fq 'session.removeAttribute(COMPLETED_AT_ATTRIBUTE);' "$SESSION"
grep -Fq 'Duration.ofMinutes(5)' "$SESSION"
grep -Fq 'window.location.assign(buildLocalizedPath("/signin/findPassword/result", "/en/signin/findPassword/result"));' "$FRONTEND"
grep -Fq 'return postJson<TResponse>(url, payload);' "$ENTRY_API"

if grep -Fq 'navigate(buildLocalizedPath("/signin/findPassword/result", english))' "$FRONTEND"; then
  echo "result page still uses SPA navigation" >&2
  exit 1
fi

node - "$API" <<'NODE'
const fs = require('fs');
const source = fs.readFileSync(process.argv[2], 'utf8');
const failed = source.indexOf('if (!updated)');
const grant = source.indexOf('AccountRecoveryResultSession.grant(request);');
const success = source.indexOf('message.put("status", "success");', grant);
if (!(failed >= 0 && failed < grant && grant < success)) {
  throw new Error('session grant must occur only after the reset failure branch and before success response');
}
NODE

node - "$CORE_API" <<'NODE'
const fs = require('fs');
const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf('export async function postJsonWithResponse');
const end = source.indexOf('export async function postAdminJson', start);
const implementation = source.slice(start, end);
if (start < 0 || end < 0 || !implementation.includes('credentials: "include"')) {
  throw new Error('password reset transport must include the shared server session cookie');
}
NODE

echo "ACCOUNT_RECOVERY_RESULT_SESSION_CONTRACT_PASS"
