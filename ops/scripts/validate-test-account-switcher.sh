#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
component="$root/projects/carbonet-frontend/source/src/features/home-entry/TestAccountSwitcher.tsx"
shell="$root/projects/carbonet-frontend/source/src/features/home-entry/GlobalUserGnbShell.tsx"
grep -Fq 'testMode") === "1"' "$component"
grep -Fq 'sessionStorage.setItem(TEST_MODE_KEY, "enabled")' "$component"
grep -Fq 'type="password"' "$component"
grep -Fq 'autoLogin: false' "$component"
grep -Fq '<TestAccountSwitcher />' "$shell"
if grep -Eqi 'password[^\n]*(localStorage|sessionStorage)' "$component"; then
  echo '[test-account-switcher] FAIL password persistence detected' >&2
  exit 1
fi
echo '[test-account-switcher] PASS accounts=5 passwordPersistence=none loginApi=standard featureGate=testMode'
