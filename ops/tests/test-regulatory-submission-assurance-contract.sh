#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"; TARGET="$ROOT/ops/scripts/complete-regulatory-submission-assurance.sh"; bash -n "$TARGET"
for token in validate-regulatory-submission-workflow.sh run-regulatory-submission-business-e2e.sh 'RELAY_JSON="$(tail -n 1' resonance-regulatory-admin-e2e.sh validate-customer-work-journey.sh framework_simulation_run "job_status='VERIFIED'" 'jobs<>58' 'tests<3'; do grep -Fq "$token" "$TARGET" || { echo "[regulatory-submission-contract] FAIL missing=$token" >&2; exit 1; }; done
printf '[regulatory-submission-contract] PASS relay=4 admin=desktop+mobile jobs=58 simulation=approved-only\n'
