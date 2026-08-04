#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
runtime="$root/projects/carbonet-frontend/source/src/lib/aiContext.ts"
main="$root/projects/carbonet-frontend/source/src/main.tsx"

require() {
  local pattern="$1"
  local file="$2"
  local message="$3"
  if ! grep -q "$pattern" "$file"; then
    echo "[FAIL] $message"
    exit 1
  fi
}

require "__AI_CONTEXT_RUNTIME__" "$runtime" "AI context runtime global export is missing"
require "__AI_SCREEN_CONTEXT__" "$runtime" "AI screen context static global is missing"
require "collectVisibleContext" "$runtime" "visible screen context collector is missing"
require "sessionStorage.setItem(LATEST_INTENT_KEY" "$runtime" "latest intent persistence is missing"
require "openTaskPopup" "$runtime" "task popup intent bridge is missing"
require "SENSITIVE_KEY_PATTERN" "$runtime" "sensitive-data masking contract is missing"
require "installAiContextRuntime" "$main" "main.tsx does not install AI context runtime"

echo "[PASS] AI context runtime contract is installed"
