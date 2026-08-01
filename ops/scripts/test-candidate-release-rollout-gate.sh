#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_SCRIPT="$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
AUTO_DEPLOY_SCRIPT="$ROOT_DIR/ops/scripts/auto-deploy-main.sh"

fail() {
  echo "[candidate-rollout-test] FAIL: $*" >&2
  exit 1
}

grep -Fq 'resonance.ai/release-id' "$DEPLOY_SCRIPT" || fail "candidate release label is missing"
grep -Fq 'candidate_selector="app=$DEPLOYMENT,resonance.ai/release-id=$candidate_release_id"' "$DEPLOY_SCRIPT" || fail "candidate selector is missing"
grep -Fq 'wait --for=condition=Ready pod' "$DEPLOY_SCRIPT" || fail "candidate Ready gate is missing"
grep -Fq 'pod_selector+=",resonance.ai/release-id=$CANDIDATE_RELEASE_ID"' "$DEPLOY_SCRIPT" || fail "verification is not pinned to candidate pods"

runtime_rollout_waits="$(grep -Ec '^[[:space:]]*kubectl .*rollout status deployment/"\$DEPLOYMENT"' "$AUTO_DEPLOY_SCRIPT" || true)"
[[ "$runtime_rollout_waits" == "0" ]] || fail "auto-deploy still repeats rollout status"

echo "[candidate-rollout-test] PASS"
