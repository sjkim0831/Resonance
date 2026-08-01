#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKER="$ROOT_DIR/ops/scripts/run-process-development-worker.sh"

fail() {
  echo "[process-worker-deploy-marker-test] FAIL: $*" >&2
  exit 1
}

grep -Fq 'DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"' "$WORKER" \
  || fail "canonical deployment marker is missing"
grep -Fq 'deployed_commit()' "$WORKER" || fail "deployment marker resolver is missing"
grep -Fq 'git -C "$WT" merge-base --is-ancestor "$RESULT_COMMIT" "$DEPLOYED"' "$WORKER" \
  || fail "worker does not verify the result against the deployed commit"

if sed -n '/for _ in $(seq 1 90)/,/deployment_is_ready ||/p' "$WORKER" \
  | grep -Fq 'git -C "$ROOT_DIR" rev-parse HEAD'; then
  fail "worker still treats the mutable root checkout as deployment evidence"
fi

echo "[process-worker-deploy-marker-test] PASS"
