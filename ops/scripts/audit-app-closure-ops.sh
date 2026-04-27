#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/audit-app-closure-ops.sh

Purpose:
  Audit ops/scripts for canonical app-closure alignment.

Checks:
  - no legacy root target jar references remain
  - no legacy root package line remains
  - canonical app jar path is present
  - key wrapper scripts reference closure/freshness verifiers

Quick guide:
  bash ops/scripts/show-app-closure-sequence.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OPS_DIR="$ROOT_DIR/ops/scripts"
TMP_MATCHES="$(mktemp)"

cleanup() {
  rm -f "$TMP_MATCHES"
}
trap cleanup EXIT

info() {
  printf '[audit-app-closure-ops] %s\n' "$*"
}

fail() {
  printf '[audit-app-closure-ops] FAIL: %s\n' "$*" >&2
  exit 1
}

require_no_match() {
  local pattern="$1"
  if rg -n \
    --glob '!audit-app-closure-ops.sh' \
    --glob '!verify-large-move-app-closure.sh' \
    "$pattern" "$OPS_DIR" >"$TMP_MATCHES" 2>/dev/null; then
    cat "$TMP_MATCHES" >&2
    fail "unexpected match for pattern: $pattern"
  fi
}

require_match() {
  local pattern="$1"
  local path="$2"
  rg -q "$pattern" "$path" || fail "missing expected pattern in $path: $pattern"
}

info "checking legacy jar references"
require_no_match '\$REPO_ROOT/target/carbonet\.jar|\$ROOT_DIR/target/carbonet\.jar|\$BUILD_DIR/target/carbonet\.jar'

info "checking legacy package lines"
require_no_match 'mvn -q -DskipTests package|mvn -q package'

info "checking canonical jar path presence"
require_match 'apps/carbonet-app/target/carbonet\.jar' "$OPS_DIR"

info "checking wrapper verifier wiring"
require_match 'verify-large-move-app-closure\.sh' "$OPS_DIR/build-restart-verify-external-monitoring-18000.sh"
require_match 'verify-large-move-app-closure\.sh' "$OPS_DIR/build-restart-verify-emission-management-18000.sh"
require_match 'verify-large-move-app-closure\.sh' "$OPS_DIR/build-restart-fill-verify-emission-management-rollout-18000.sh"
require_match 'verify-large-move-app-closure\.sh' "$OPS_DIR/codex-apply-and-deploy.sh"
require_match 'verify-large-move-app-closure\.sh' "$OPS_DIR/deploy-193-to-221.sh"
require_match 'verify-large-move-app-closure\.sh' "$OPS_DIR/jenkins-deploy-carbonet.sh"
require_match 'codex-verify-18000-freshness\.sh' "$OPS_DIR/codex-apply-and-deploy.sh"
require_match 'codex-verify-18000-freshness\.sh' "$OPS_DIR/deploy-193-to-221.sh"
require_match 'codex-verify-18000-freshness\.sh' "$OPS_DIR/jenkins-deploy-carbonet.sh"
require_match 'codex-verify-18000-freshness\.sh' "$OPS_DIR/deploy-blue-green-221.sh"

info "ops app-closure audit completed"
