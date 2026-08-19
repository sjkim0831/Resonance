#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LANE="$ROOT/ops/scripts/deploy-certificate-verify-fast.sh"
FRONTEND="$ROOT/ops/scripts/restart-local-carbonet-frontend-fast.sh"

bash -n "$LANE"
bash -n "$FRONTEND"
python3 - "$LANE" "$FRONTEND" <<'PY'
from pathlib import Path
import sys
lane=Path(sys.argv[1]).read_text(encoding="utf-8")
frontend=Path(sys.argv[2]).read_text(encoding="utf-8")
for token in (
    "verify-certificate-pdf-tamper-contract.mjs",
    "/home/certificate-verify",
    "/api/public/report-certificates/$CERTIFICATE_ID",
    "dbBackup=0 imageBuild=0 rollout=0",
    "BLOCKED non-frontend certificate path=",
    "CARBONET_DEPLOY_LOCK_FILE",
    "CARBONET_FRONTEND_OVERLAY_LOCK_FILE",
    "flock -w 5 9",
    "flock -w 5 8",
):
    assert token in lane, token
assert "mapfile -t ready_pods" in frontend
assert 'ready pod count mismatch' in frontend
assert 'for pod in "${ready_pods[@]}"' in frontend
assert 'HomeCertificateVerifyPage' in frontend
PY
echo '[certificate-fast-contract] PASS scope=frontend-only readyPods=all static+page+api dbBackup=0 imageBuild=0 rollout=0'
