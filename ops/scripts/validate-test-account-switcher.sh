#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
component="$root/projects/carbonet-frontend/source/src/features/home-entry/TestAccountSwitcher.tsx"
shell="$root/projects/carbonet-frontend/source/src/features/home-entry/GlobalUserGnbShell.tsx"
controller="$root/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/auth/web/AuthApiController.java"
deploy="$root/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
grep -Fq 'testMode") === "1"' "$component"
grep -Fq 'sessionStorage.setItem(TEST_MODE_KEY, "enabled")' "$component"
grep -Fq '/signin/testAccountSwitch' "$component"
grep -Fq '"X-Carbonet-Test-Mode": "1"' "$component"
grep -Fq 'right-3 top-1/2' "$component"
grep -Fq '<TestAccountSwitcher />' "$shell"
grep -Fq 'TEST_SWITCH_ACCOUNTS = Set.of(' "$controller"
grep -Fq 'AdminConsoleAccessPolicy.allows' "$controller"
grep -Fq 'TEST_SWITCH_SESSION_ATTRIBUTE' "$controller"
grep -Fq 'recordLoginHistory(targetUserId' "$controller"
grep -Fq 'carbonet-test-account-switch' "$deploy"
if grep -Eqi 'password|userPw|autoLogin' "$component"; then
  echo '[test-account-switcher] FAIL client-side password handling detected' >&2
  exit 1
fi
echo '[test-account-switcher] PASS accounts=5 passwordInput=none endpoint=testAccountSwitch featureGate=testMode position=right-center'
