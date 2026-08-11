#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CORE="$ROOT/modules/resonance-common/carbonet-common-core"
CONTROLLER="$CORE/src/main/java/egovframework/com/feature/auth/web/AuthApiController.java"
EXTERNAL="$CORE/src/main/java/egovframework/com/feature/auth/external/service/impl/AuthTokenLoginServiceImpl.java"
EXTERNAL_FLOW="$CORE/src/main/java/egovframework/com/feature/auth/external/service/impl/ExternalAuthServiceImpl.java"
TOKEN_STORE="$CORE/src/main/java/egovframework/com/feature/auth/service/AuthTokenStoreService.java"
LOCK_SERVICE="$CORE/src/main/java/egovframework/com/feature/auth/service/CredentialMutationLockService.java"
MAPPER_XML="$CORE/src/main/resources/egovframework/mapper/com/feature/auth/AuthLoginMapper.xml"

require_text() {
  local file="$1"
  local text="$2"
  if ! grep -Fq "$text" "$file"; then
    printf 'Missing credential lock contract: %s in %s\n' "$text" "$file" >&2
    exit 1
  fi
}

require_text "$LOCK_SERVICE" '@Transactional(rollbackFor = Exception.class)'
require_text "$LOCK_SERVICE" '@Transactional(propagation = Propagation.MANDATORY)'
require_text "$LOCK_SERVICE" 'authLoginMapper.acquireCredentialMutationLock(canonicalUserId)'
require_text "$MAPPER_XML" "hashtextextended('carbonet:credential:' || LOWER(TRIM(#{value})), 0)"

# Issuance path 1: normal password login. The lock wraps password validation,
# token persistence, session persistence, and cookie exposure as one transaction.
require_text "$CONTROLLER" 'credentialMutationLockService.executeLocked(credentialUserId,'
require_text "$CONTROLLER" '() -> actionLoginWithinCredentialLock(loginVO, request, response)'

# Issuance path 2: QA account switch delegates to the same locked actionLogin.
require_text "$CONTROLLER" 'ResponseEntity<?> result = actionLogin(login, request, response);'

# Issuance paths 3 and 4: linked external identity and pre-linked external
# identity both delegate to the same locked external token issuer.
external_calls="$(grep -Fc 'authTokenLoginService.issueLogin(' "$EXTERNAL_FLOW")"
test "$external_calls" = '2'
require_text "$EXTERNAL" 'credentialMutationLockService.executeLocked(credentialUserId,'
require_text "$EXTERNAL" '() -> issueLoginWithinCredentialLock(loginResult, autoLogin, request, response)'

# Refresh follows the same advisory-lock -> token-row-lock order. This prevents
# deadlocks and prevents a recovery-deleted token row from being reinserted.
require_text "$TOKEN_STORE" 'credentialMutationLockService.acquireInCurrentTransaction(userId);'
require_text "$TOKEN_STORE" 'authLoginMapper.selectActiveAuthTokenForUpdate(userId)'
acquire_line="$(grep -n 'credentialMutationLockService.acquireInCurrentTransaction(userId);' "$TOKEN_STORE" | tail -1 | cut -d: -f1)"
row_lock_line="$(grep -n 'authLoginMapper.selectActiveAuthTokenForUpdate(userId)' "$TOKEN_STORE" | cut -d: -f1)"
test "$acquire_line" -lt "$row_lock_line"

printf 'AUTH_CREDENTIAL_MUTATION_LOCK_CONTRACT_PASS issuancePaths=4 passwordValidationToTokenPersist=locked refreshLockOrder=advisoryThenRow\n'
