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
# psql does not expand :variables inside a command supplied with -c.  Both
# identifiers are restricted to [A-Z0-9_]+ above, so quoting the validated
# values directly keeps this single-row read deterministic and injection-safe.
ROW="$(kubectl -n "$NAMESPACE" exec "$PATRONI_POD" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -At -F '|' -v ON_ERROR_STOP=1 -c "select runtime.source_commit,p.process_version,framework_current_process_step_contract_fingerprint(p.process_code,'$STEP_CODE'),framework_runtime_release_identity_hash(runtime),runtime.pod_template_sha256,runtime.deployment_namespace,runtime.deployment_name,runtime.deployment_uid from framework_process_definition p join framework_runtime_release_state runtime on runtime.release_key='CARBONET_RUNTIME' where p.process_code='$PROCESS_CODE'")"
IFS='|' read -r SOURCE_COMMIT PROCESS_VERSION CONTRACT_FINGERPRINT RUNTIME_IDENTITY_HASH POD_TEMPLATE_SHA256 DEPLOYMENT_NAMESPACE DEPLOYMENT_NAME DEPLOYMENT_UID <<<"$ROW"
[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo 'current runtime release ledger is unavailable' >&2; exit 2; }
[[ "$RUNTIME_IDENTITY_HASH" =~ ^[0-9a-f]{64}$ && "$POD_TEMPLATE_SHA256" =~ ^[0-9a-f]{64}$ ]] || {
  echo 'current PodTemplate-bound runtime identity is unavailable' >&2
  exit 2
}
[[ "$DEPLOYMENT_NAMESPACE" == "$NAMESPACE" && -n "$DEPLOYMENT_NAME" && -n "$DEPLOYMENT_UID" ]] || {
  echo 'runtime release ledger deployment coordinates are unavailable' >&2
  exit 2
}
if [[ -n "${E2E_DEPLOYED_COMMIT:-}" && "$E2E_DEPLOYED_COMMIT" != "$SOURCE_COMMIT" ]]; then
  echo 'requested E2E commit does not match the current runtime release ledger' >&2
  exit 3
fi
DEPLOYMENT_JSON="$(kubectl -n "$NAMESPACE" get deployment "$DEPLOYMENT_NAME" -o json 2>/dev/null || true)"
[[ -n "$DEPLOYMENT_JSON" ]] || { echo 'runtime deployment snapshot is unavailable' >&2; exit 3; }
LIVE_NAMESPACE="$(jq -r '.metadata.namespace // empty' <<<"$DEPLOYMENT_JSON")"
LIVE_NAME="$(jq -r '.metadata.name // empty' <<<"$DEPLOYMENT_JSON")"
LIVE_UID="$(jq -r '.metadata.uid // empty' <<<"$DEPLOYMENT_JSON")"
ANNOTATED_COMMIT="$(jq -r '.metadata.annotations["resonance.ai/target-commit"] // empty' <<<"$DEPLOYMENT_JSON")"
ANNOTATED_TEMPLATE_SHA256="$(jq -r '.metadata.annotations["resonance.ai/runtime-template-sha256"] // empty' <<<"$DEPLOYMENT_JSON")"
LIVE_TEMPLATE_SHA256="$(jq -cS '.spec.template' <<<"$DEPLOYMENT_JSON" | sha256sum | awk '{print $1}')"
[[ "$LIVE_NAMESPACE" == "$DEPLOYMENT_NAMESPACE" && "$LIVE_NAME" == "$DEPLOYMENT_NAME" && "$LIVE_UID" == "$DEPLOYMENT_UID" ]] || {
  echo 'runtime release ledger and deployment immutable coordinates differ' >&2
  exit 3
}
[[ "$ANNOTATED_COMMIT" == "$SOURCE_COMMIT" && "$ANNOTATED_TEMPLATE_SHA256" == "$POD_TEMPLATE_SHA256" && "$LIVE_TEMPLATE_SHA256" == "$POD_TEMPLATE_SHA256" ]] || {
  echo 'runtime release ledger and deployment source/PodTemplate attestations differ' >&2
  exit 3
}
[[ -n "$PROCESS_VERSION" && "$CONTRACT_FINGERPRINT" =~ ^[0-9a-f]{32,128}$ ]] || { echo "current contract fingerprint unavailable: $PROCESS_CODE/$STEP_CODE" >&2; exit 3; }
jq -cn --arg processCode "$PROCESS_CODE" --arg stepCode "$STEP_CODE" \
  --arg processVersion "$PROCESS_VERSION" --arg contractFingerprint "$CONTRACT_FINGERPRINT" \
  --arg sourceCommit "$SOURCE_COMMIT" --arg runtimeIdentityHash "$RUNTIME_IDENTITY_HASH" \
  --arg podTemplateSha256 "$POD_TEMPLATE_SHA256" --arg capturedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{processCode:$processCode,stepCode:$stepCode,processVersion:$processVersion,contractFingerprint:$contractFingerprint,sourceCommit:$sourceCommit,runtimeIdentityHash:$runtimeIdentityHash,podTemplateSha256:$podTemplateSha256,capturedAt:$capturedAt}'
