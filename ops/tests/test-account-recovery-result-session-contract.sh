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

grep -Fq 'AccountRecoveryResultSession.rotateAndGrant(request);' "$API"
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

node - "$API" "$SESSION" <<'NODE'
const fs = require('fs');
const api = fs.readFileSync(process.argv[2], 'utf8');
const session = fs.readFileSync(process.argv[3], 'utf8');

function methodBody(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`missing method: ${signature}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(brace, i + 1);
  }
  throw new Error(`unclosed method: ${signature}`);
}

function ordered(source, markers) {
  let cursor = -1;
  for (const marker of markers) {
    cursor = source.indexOf(marker, cursor + 1);
    if (cursor < 0) throw new Error(`missing or unordered marker: ${marker}`);
  }
}

function assertResetBoundary(source) {
  const body = methodBody(source, 'public ResponseEntity<?> resetPassword');
  ordered(body, [
    'if (!updated)',
    'AccountRecoveryResultSession.rotateAndGrant(request);',
    'message.put("status", "success");',
  ]);
  if (body.includes('AccountRecoveryResultSession.grant(request);')) {
    throw new Error('reset must never grant on the existing session');
  }
}

function assertRotatedOneTimeGrant(source) {
  const grant = methodBody(source, 'static void grant');
  ordered(grant, ['request.getSession(true)', 'setAttribute(COMPLETED_AT_ATTRIBUTE']);

  const rotate = methodBody(source, 'static void rotateAndGrant');
  ordered(rotate, [
    'SecurityContextHolder.clearContext();',
    'request.getSession(false)',
    'previous.invalidate();',
    'grant(request);',
  ]);

  const consume = methodBody(source, 'static boolean consume');
  ordered(consume, [
    'request.getSession(false)',
    'synchronized (session)',
    'session.getAttribute(COMPLETED_AT_ATTRIBUTE)',
    'session.removeAttribute(COMPLETED_AT_ATTRIBUTE);',
    'age <= RESULT_TTL_MILLIS',
  ]);
}

function expectFailure(check, name) {
  try {
    check();
  } catch (_) {
    return;
  }
  throw new Error(`security mutation unexpectedly passed: ${name}`);
}

assertResetBoundary(api);
assertRotatedOneTimeGrant(session);
expectFailure(
  () => assertResetBoundary(api.replace('AccountRecoveryResultSession.rotateAndGrant(request);',
    'AccountRecoveryResultSession.grant(request);')),
  'simple grant reuse',
);
expectFailure(
  () => assertRotatedOneTimeGrant(session.replace('previous.invalidate();', '/* session reused */')),
  'previous session reuse',
);
expectFailure(
  () => assertRotatedOneTimeGrant(session.replace('grant(request);', 'previous.setAttribute(COMPLETED_AT_ATTRIBUTE, 1L);')),
  'grant stored on previous session',
);
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

echo "ACCOUNT_RECOVERY_RESULT_SESSION_CONTRACT_PASS rotatedSession=1 oneTimeGrant=1 mutationsRejected=3"
