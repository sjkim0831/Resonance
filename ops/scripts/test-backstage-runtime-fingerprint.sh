#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FINGERPRINT="$ROOT/ops/scripts/resonance-backstage-runtime-fingerprint.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git -C "$tmp" init -q
git -C "$tmp" config user.email test@resonance.local
git -C "$tmp" config user.name resonance-test
mkdir -p "$tmp/platform/control-plane/backstage/packages/app/src" \
  "$tmp/platform/control-plane/backstage/packages/app/e2e-tests"
printf 'runtime-v1\n' >"$tmp/platform/control-plane/backstage/packages/app/src/App.tsx"
printf 'test-v1\n' >"$tmp/platform/control-plane/backstage/packages/app/e2e-tests/app.test.ts"
git -C "$tmp" add .
git -C "$tmp" commit -qm base
base="$(bash "$FINGERPRINT" "$tmp")"

printf 'test-v2\n' >"$tmp/platform/control-plane/backstage/packages/app/e2e-tests/app.test.ts"
git -C "$tmp" add . && git -C "$tmp" commit -qm test-only
[[ "$(bash "$FINGERPRINT" "$tmp")" == "$base" ]]

printf 'runtime-v2\n' >"$tmp/platform/control-plane/backstage/packages/app/src/App.tsx"
git -C "$tmp" add . && git -C "$tmp" commit -qm runtime
[[ "$(bash "$FINGERPRINT" "$tmp")" != "$base" ]]

echo BACKSTAGE_RUNTIME_FINGERPRINT_PASS
