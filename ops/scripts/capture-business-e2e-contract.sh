#!/usr/bin/env bash
set -Eeuo pipefail

[[ $# -eq 2 ]] || { echo "usage: $0 PROCESS_CODE STEP_CODE" >&2; exit 2; }
PROCESS_CODE="$1"; STEP_CODE="$2"
[[ "$PROCESS_CODE" =~ ^[A-Z0-9_]+$ && "$STEP_CODE" =~ ^[A-Z0-9_]+$ ]] || { echo 'invalid process/step code' >&2; exit 2; }
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
if [[ -z "${PATRONI_POD:-}" ]]; then
  PATRONI_POD="$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")"
fi
ROW="$(kubectl -n "$NAMESPACE" exec "$PATRONI_POD" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -At -F '|' -v ON_ERROR_STOP=1 -v process_code="$PROCESS_CODE" -v step_code="$STEP_CODE" -c "select runtime.source_commit,p.process_version,framework_current_process_step_contract_fingerprint(p.process_code,:'step_code') from framework_process_definition p join framework_runtime_release_state runtime on runtime.release_key='CARBONET_RUNTIME' where p.process_code=:'process_code'")"
IFS='|' read -r SOURCE_COMMIT PROCESS_VERSION CONTRACT_FINGERPRINT <<<"$ROW"
[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo 'current runtime release ledger is unavailable' >&2; exit 2; }
if [[ -n "${E2E_DEPLOYED_COMMIT:-}" && "$E2E_DEPLOYED_COMMIT" != "$SOURCE_COMMIT" ]]; then
  echo 'requested E2E commit does not match the current runtime release ledger' >&2
  exit 3
fi
ANNOTATED_COMMIT="$(kubectl -n "$NAMESPACE" get deployment carbonet-runtime -o jsonpath='{.metadata.annotations.resonance\.ai/target-commit}' 2>/dev/null || true)"
[[ "$ANNOTATED_COMMIT" == "$SOURCE_COMMIT" ]] || {
  echo 'runtime release ledger and deployment target-commit annotation differ' >&2
  exit 3
}
[[ -n "$PROCESS_VERSION" && "$CONTRACT_FINGERPRINT" =~ ^[0-9a-f]{32,128}$ ]] || { echo "current contract fingerprint unavailable: $PROCESS_CODE/$STEP_CODE" >&2; exit 3; }
jq -cn --arg processCode "$PROCESS_CODE" --arg stepCode "$STEP_CODE" \
  --arg processVersion "$PROCESS_VERSION" --arg contractFingerprint "$CONTRACT_FINGERPRINT" \
  --arg sourceCommit "$SOURCE_COMMIT" --arg capturedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{processCode:$processCode,stepCode:$stepCode,processVersion:$processVersion,contractFingerprint:$contractFingerprint,sourceCommit:$sourceCommit,capturedAt:$capturedAt}'
