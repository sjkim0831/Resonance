#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
S="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"
for token in "job_status='SUPERSEDED'" "required=false" "SUPERSEDED_BY_CANONICAL_PUBLICATION" "event_type,from_status,to_status" "canonicalJobId" "supersededJobCount"; do grep -Fq "$token" "$S"; done
grep -Fq "job_status not in('RUNNING','COMPLETED','SUPERSEDED')" "$S"
if sed 's/job_status not in('\''RUNNING'\'','\''COMPLETED'\'','\''SUPERSEDED'\'')/job_status!='\''SUPERSEDED'\''/' "$S" | grep -Fq "job_status not in('RUNNING','COMPLETED','SUPERSEDED')"; then
  echo 'running-job protection mutant survived' >&2; exit 1
fi
printf 'CANONICAL_JOB_SUPERSESSION_PASS\n'
