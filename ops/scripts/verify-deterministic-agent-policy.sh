#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
POLICY_FILE="${POLICY_FILE:-$ROOT_DIR/data/ai-runtime/deterministic-agent-policy.json}"
MATRIX_FILE="${MATRIX_FILE:-$ROOT_DIR/data/ai-runtime/agent-stage-model-matrix.json}"

fail() {
  echo "FAIL $*" >&2
  exit 1
}

command -v jq >/dev/null 2>&1 || fail "missing required command: jq"
[[ -f "$POLICY_FILE" ]] || fail "policy file not found: $POLICY_FILE"
[[ -f "$MATRIX_FILE" ]] || fail "model matrix not found: $MATRIX_FILE"

jq empty "$POLICY_FILE" "$MATRIX_FILE"

default_model="$(jq -r '.defaultModel' "$POLICY_FILE")"
[[ "$default_model" == "gemma3:4b" ]] || fail "default model must remain gemma3:4b"

jq -e --arg model "$default_model" '
  .models[]
  | select(.model == $model)
  | select(.status == "APPROVED")
  | (.allowedStages | index("classify"))
  and (.allowedStages | index("route"))
  and (.allowedStages | index("safety-summary"))
' "$POLICY_FILE" >/dev/null || fail "default model is not approved for classify/route/safety-summary"

for op in deploy backup rollback restart "k8s apply" "db migration"; do
  jq -e --arg op "$op" '.dangerousOperationPolicy.scriptOnly | index($op)' "$POLICY_FILE" >/dev/null \
    || fail "dangerous operation is not script-only: $op"
done

jq -e '.dangerousOperationPolicy.directModelExecutionAllowed == false' "$POLICY_FILE" >/dev/null \
  || fail "direct model execution for dangerous operations must be false"

jq -e '.workerPolicy.genericWorker.mutationAllowed == false and .workerPolicy.genericWorker.verificationOnly == true' "$POLICY_FILE" >/dev/null \
  || fail "generic worker must be verification-only"

jq -e '.workerPolicy.implementationWorker.genericWorkerMayHandle == false and .workerPolicy.implementationWorker.requiresHumanApprovalFlag == true' "$POLICY_FILE" >/dev/null \
  || fail "implementation packets must be blocked from generic worker and require approval"

if jq -e '
  .models[]
  | select(.status == "RESTRICTED")
  | (.forbiddenStages | index("safety-authority")) | not
' "$POLICY_FILE" >/dev/null; then
  fail "restricted models must forbid safety-authority"
fi

jq -e '.latestGateResults["gemma3:4b"] | test("PASS")' "$MATRIX_FILE" >/dev/null \
  || fail "model matrix must record gemma3:4b PASS"

echo "PASS deterministic agent policy is valid"
