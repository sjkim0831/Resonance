#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"; TARGET="$ROOT/ops/scripts/complete-report-certification-assurance.sh"; bash -n "$TARGET"
for token in REPORT_CERTIFICATION_01_PLAN REPORT_CERTIFICATION_04_APPROVE validate-report-certification-runtime.sh publicValid=1 publicInvalid=1 integrityHash=64 'merge-base --is-ancestor' framework_current_business_e2e_evidence 'actual<>4'; do grep -Fq "$token" "$TARGET" || { echo "[report-certification-contract] FAIL missing=$token" >&2; exit 1; }; done
printf '[report-certification-contract] PASS steps=4 integrity=required public=valid+invalid evidence=atomic\n'
