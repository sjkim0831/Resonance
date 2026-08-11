#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${RESONANCE_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
# Repository and installed control-plane copies keep the wrapper and engine as
# siblings.  Resolving from SCRIPT_DIR makes the same artifact portable in
# both locations without a deployment-only environment override.
AUDIT_ENGINE="${RESONANCE_AUDIT_ENGINE:-$SCRIPT_DIR/resonance-all-process-contract-audit.mjs}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
SECRET_NAME="${CARBONET_ADMIN_AUDIT_SECRET:-carbonet-usage-ledger-system-admin}"
CREDENTIAL_FILE=""

cleanup() {
  [[ -z "$CREDENTIAL_FILE" ]] || rm -f -- "$CREDENTIAL_FILE"
  CREDENTIAL_FILE=""
  unset CARBONET_ADMIN_AUDIT_CREDENTIAL_FILE
}
trap cleanup EXIT
{ set +x; } 2>/dev/null

if [[ -n "${SYSTEM_TEST_REPORT_FIXTURE:-}" ]]; then
  exec node "$AUDIT_ENGINE" \
    --fixture "$SYSTEM_TEST_REPORT_FIXTURE" --skip-http-smoke
fi

command -v kubectl >/dev/null 2>&1 || { echo '[all-process-contract-audit] kubectl is required' >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo '[all-process-contract-audit] node is required' >&2; exit 2; }
[[ -f "$AUDIT_ENGINE" ]] || { echo '[all-process-contract-audit] audit engine is missing' >&2; exit 2; }
[[ -f "$ROOT/ops/scripts/runtime-qa-auth-common.sh" ]] || {
  echo '[all-process-contract-audit] canonical authentication helper is missing' >&2
  exit 2
}
# shellcheck source=ops/scripts/runtime-qa-auth-common.sh
source "$ROOT/ops/scripts/runtime-qa-auth-common.sh"
export CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS="${CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-300}"

CREDENTIAL_FILE="$(mktemp "${TMPDIR:-/tmp}/carbonet-audit-credentials.XXXXXX.json")"
chmod 0600 "$CREDENTIAL_FILE"
if ! kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" -o json >"$CREDENTIAL_FILE" 2>/dev/null; then
  echo '[all-process-contract-audit] unable to read isolated admin credential Secret' >&2
  exit 2
fi
[[ -s "$CREDENTIAL_FILE" ]] || { echo '[all-process-contract-audit] credential Secret file is empty' >&2; exit 2; }
export CARBONET_ADMIN_AUDIT_CREDENTIAL_FILE="$CREDENTIAL_FILE"

set +e
carbonet_qa_auth_run_serialized all-process-contract-audit node "$AUDIT_ENGINE" "$@"
status=$?
set -e
cleanup
trap - EXIT
exit "$status"
