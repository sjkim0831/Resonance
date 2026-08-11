#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

python3 - "$ROOT_DIR" <<'PY'
from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
java_root = root / "modules/resonance-common/carbonet-common-core/src/main/java"
provider_path = java_root / "egovframework/com/feature/auth/util/JwtTokenProvider.java"
store_path = java_root / "egovframework/com/feature/auth/service/AuthTokenStoreService.java"
controller_path = java_root / "egovframework/com/feature/auth/web/AuthApiController.java"
external_path = java_root / "egovframework/com/feature/auth/external/service/impl/AuthTokenLoginServiceImpl.java"
home_mypage_path = java_root / "egovframework/com/feature/home/service/impl/HomeMypageServiceImpl.java"
mapper_path = root / "modules/resonance-common/carbonet-common-core/src/main/resources/egovframework/mapper/com/feature/auth/AuthLoginMapper.xml"
migration_path = root / "apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811204500__enforce_single_active_auth_token_per_user.sql"

def read(path: Path) -> str:
    if not path.is_file():
        raise AssertionError(f"missing source: {path}")
    return path.read_text(encoding="utf-8")

def method_body(source: str, signature: str) -> str:
    start = source.index(signature)
    brace = source.index("{", start)
    depth = 0
    for index in range(brace, len(source)):
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
            if depth == 0:
                return source[brace:index + 1]
    raise AssertionError(f"unclosed method: {signature}")

def ordered(body: str, markers: list[str]) -> None:
    cursor = -1
    for marker in markers:
        cursor = body.index(marker, cursor + 1)

def locked_boundary(wrapper: str, helper_name: str) -> None:
    assert "credentialMutationLockService.executeLocked" in wrapper
    assert f"() -> {helper_name}" in wrapper

def persisted_before_first_exposure(helper: str, require_session: bool) -> None:
    rollback_guard = helper.index("authenticationExposureRollbackGuard.register")
    session_rotation = helper.index("request.changeSessionId()")
    security_context = helper.index("SecurityContextHolder.getContext().setAuthentication")
    created = helper.index("createAccessToken")
    persisted = helper.index("saveLoginToken", created)
    exposed = helper.index("response.addHeader", created)
    assert rollback_guard < session_rotation < security_context < created
    if require_session:
        session_saved = helper.index("saveContext", created)
        assert created < persisted < session_saved < exposed
    else:
        assert created < persisted < exposed
    assert helper.count("authenticationExposureRollbackGuard.register") == 1
    assert helper.count("saveLoginToken") == 1
    assert helper.count("response.addHeader") == 2

def expect_contract_failure(check) -> None:
    try:
        check()
    except (AssertionError, ValueError):
        return
    raise AssertionError("security mutation unexpectedly passed the contract")

def expose_before_save_mutation(helper: str) -> str:
    # Swap only the first save/header marker. The resulting synthetic source is
    # intentionally invalid as an ordering contract and must be rejected.
    mutated = helper.replace("saveLoginToken", "__TOKEN_SAVE__", 1)
    mutated = mutated.replace("response.addHeader", "saveLoginToken", 1)
    return mutated.replace("__TOKEN_SAVE__", "response.addHeader", 1)

provider = read(provider_path)
store = read(store_path)
controller = read(controller_path)
external = read(external_path)
home_mypage = read(home_mypage_path)
mapper = read(mapper_path)
migration = read(migration_path)

for marker in (
    "authLoginMapper.selectActiveAuthToken(userId)",
    "tokenHashMatches(expectedHash, token)",
    "MessageDigest.isEqual(expected, actual)",
    "return isPersistedAccessToken(token, claims) ? 200 : 401",
    "return 503",
):
    assert marker in provider, marker

save = method_body(store, "public void saveLoginToken")
assert "@Transactional(rollbackFor = Exception.class)" in store
assert "inserted != 1" in save
assert "Login continues with JWT-only validation" not in store
assert "Falling back to JWT-only refresh validation" not in store
assert "return false" in method_body(store, "public boolean isRefreshTokenAccepted")
rotate = method_body(store, "public boolean rotateLoginToken")
ordered(rotate, ["selectActiveAuthTokenForUpdate", "tokenHashMatches", "rotateAuthToken"])
assert "insertAuthToken" not in rotate
assert 'id="selectActiveAuthTokenForUpdate"' in mapper
assert "FOR UPDATE" in mapper
assert 'id="rotateAuthToken"' in mapper
assert "TOKEN_KEY = #{currentTokenKey}" in mapper
assert mapper.count("LOWER(USER_ID) = LOWER(#{value})") >= 3
assert "CREATE UNIQUE INDEX IF NOT EXISTS UX_AUTHTOKENSTORE_USER_ID_CI" in migration
assert "CREATE UNIQUE INDEX IF NOT EXISTS UX_AUTHTOKENSTORE_TOKEN_KEY" in migration

login_wrapper = method_body(controller, "public ResponseEntity<?> actionLogin")
login_locked = method_body(controller, "private ResponseEntity<?> actionLoginWithinCredentialLock")
locked_boundary(login_wrapper, "actionLoginWithinCredentialLock")
persisted_before_first_exposure(login_locked, True)
expect_contract_failure(lambda: locked_boundary(
    login_wrapper.replace("credentialMutationLockService.executeLocked", "credentialMutationLockService.executeUnlocked", 1),
    "actionLoginWithinCredentialLock",
))
expect_contract_failure(lambda: persisted_before_first_exposure(
    expose_before_save_mutation(login_locked), True,
))
expect_contract_failure(lambda: persisted_before_first_exposure(
    login_locked.replace("authenticationExposureRollbackGuard.register(request, response);", "/* rollback guard removed */", 1),
    True,
))

recreate = method_body(controller, "public ResponseEntity<?> recreateAccessToken")
ordered(recreate, ["refreshValidateToken", "createAccessToken", "rotateLoginToken", 'message.put("accessToken"'])
assert "saveLoginToken" not in recreate
assert "isRefreshTokenAccepted" not in recreate

refresh = method_body(controller, "public ResponseEntity<?> refreshSession")
ordered(refresh, ["String newAccessToken", "rotateLoginToken", "response.addHeader"])
assert "saveLoginToken" not in refresh
assert "isRefreshTokenAccepted" not in refresh

validate_refresh = method_body(controller, "public Mono<Boolean> validateRefreshToken")
assert "isRefreshTokenAccepted" in validate_refresh

issue_wrapper = method_body(external, "public Map<String, Object> issueLogin")
issue_locked = method_body(external, "private Map<String, Object> issueLoginWithinCredentialLock")
locked_boundary(issue_wrapper, "issueLoginWithinCredentialLock")
persisted_before_first_exposure(issue_locked, False)
expect_contract_failure(lambda: locked_boundary(
    issue_wrapper.replace("credentialMutationLockService.executeLocked", "credentialMutationLockService.executeUnlocked", 1),
    "issueLoginWithinCredentialLock",
))
expect_contract_failure(lambda: persisted_before_first_exposure(
    expose_before_save_mutation(issue_locked), False,
))
expect_contract_failure(lambda: persisted_before_first_exposure(
    issue_locked.replace("authenticationExposureRollbackGuard.register(request, response);", "/* rollback guard removed */", 1),
    False,
))

assert "private String extractAuthenticatedUserId" not in controller
assert "private boolean isAuthenticatedRequest" not in controller

auth_update = method_body(controller, "public ResponseEntity<?> updateAuthInfo")
assert "service.updateAuthInfo" not in auth_update
assert "HttpStatus.GONE" in auth_update

reload_metadata = method_body(controller, "public ResponseEntity<String> reloadSecurityMetadata")
assert "reloadSecurityMetadata" not in reload_metadata.replace(
    "public ResponseEntity<String> reloadSecurityMetadata", "")
assert "HttpStatus.GONE" in reload_metadata

mypage_identity = method_body(home_mypage, "private String extractUserId")
ordered(mypage_identity, ["accessValidateToken", "accessExtractClaims"])

issuers = []
for path in java_root.rglob("*.java"):
    if path == provider_path:
        continue
    count = read(path).count(".createAccessToken(")
    if count:
        issuers.extend([str(path.relative_to(root))] * count)

expected = sorted([
    str(controller_path.relative_to(root)),
    str(controller_path.relative_to(root)),
    str(controller_path.relative_to(root)),
    str(external_path.relative_to(root)),
])
assert sorted(issuers) == expected, f"uncovered access-token issuer(s): {issuers}"

print("AUTH_ACCESS_TOKEN_REVOCATION_CONTRACT_PASS issuers=4 lockedBoundaries=2 rollbackGuards=2 persisted_before_exposure=4 mutationsRejected=6")
PY
