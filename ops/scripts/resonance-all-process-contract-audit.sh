#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
AUDIT_ENGINE="${RESONANCE_AUDIT_ENGINE:-$ROOT/ops/scripts/resonance-all-process-contract-audit.mjs}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
SECRET_NAME="${CARBONET_ADMIN_AUDIT_SECRET:-carbonet-runtime-smoke-admin}"

cleanup() {
  CARBONET_ADMIN_AUDIT_USER=
  CARBONET_ADMIN_AUDIT_PASSWORD=
  unset CARBONET_ADMIN_AUDIT_USER CARBONET_ADMIN_AUDIT_PASSWORD
}
trap cleanup EXIT
{ set +x; } 2>/dev/null

if [[ -n "${SYSTEM_TEST_REPORT_FIXTURE:-}" ]]; then
  exec node "$AUDIT_ENGINE" \
    --fixture "$SYSTEM_TEST_REPORT_FIXTURE" --skip-http-smoke
fi

command -v kubectl >/dev/null 2>&1 || { echo '[all-process-contract-audit] kubectl is required' >&2; exit 2; }
command -v base64 >/dev/null 2>&1 || { echo '[all-process-contract-audit] base64 is required' >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo '[all-process-contract-audit] node is required' >&2; exit 2; }
[[ -f "$AUDIT_ENGINE" ]] || { echo '[all-process-contract-audit] audit engine is missing' >&2; exit 2; }

if ! CARBONET_ADMIN_AUDIT_USER="$(
  kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" -o jsonpath='{.data.username}' 2>/dev/null | base64 -d
)"; then
  echo '[all-process-contract-audit] unable to read admin username secret' >&2
  exit 2
fi
if ! CARBONET_ADMIN_AUDIT_PASSWORD="$(
  kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" -o jsonpath='{.data.password}' 2>/dev/null | base64 -d
)"; then
  echo '[all-process-contract-audit] unable to read admin password secret' >&2
  exit 2
fi
export CARBONET_ADMIN_AUDIT_USER CARBONET_ADMIN_AUDIT_PASSWORD

[[ -n "$CARBONET_ADMIN_AUDIT_USER" ]] || { echo '[all-process-contract-audit] admin username is empty' >&2; exit 2; }
[[ -n "$CARBONET_ADMIN_AUDIT_PASSWORD" ]] || { echo '[all-process-contract-audit] admin password is empty' >&2; exit 2; }

set +e
node "$AUDIT_ENGINE" "$@"
status=$?
set -e
cleanup
trap - EXIT
exit "$status"
