#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
RUNNER="$ROOT/ops/scripts/run-next-current-business-e2e.sh"
REGISTRY="$ROOT/ops/runtime-metadata/business-e2e-runner-registry.json"
bash -n "$RUNNER"
jq -e '.policy.maxRunsPerInvocation==1 and .policy.failClosed==true
  and ([.runners[].processCode]|unique|length)==(.runners|length)
  and ([.runners[]|select(.automation=="AUTOMATIC" or .automation=="AUTOMATIC_PARTIAL")]|length)==3
  and ([.runners[].deployLockMode]|all(.=="SHARED_PARENT" or .=="EXCLUSIVE_SELF"))
  and (.runners[]|select(.processCode=="MEMBER_REGISTRATION")|.externalBlockers|length)==2
  and (.runners[]|select(.processCode=="COMPANY_REAPPLICATION_PUBLIC")
    |.automation=="AUTOMATIC" and .expectedCurrentPassedSteps==2 and .totalSteps==2
      and .deployLockMode=="EXCLUSIVE_SELF" and (.externalBlockers|length)==0)' "$REGISTRY" >/dev/null

for contract in \
  'framework_current_business_e2e_evidence' \
  'maxRunsPerInvocation==1' \
  'timeout "$timeout_seconds"' \
  'flock -s -w 30 8' \
  'flock -u 8' \
  'EXCLUSIVE_SELF' \
  'current_after" == "$expected' \
  'invalid registry entry' \
  'AUTOMATIC_PARTIAL'; do
  grep -Fq "$contract" "$RUNNER" "$REGISTRY" || {
    echo "[current-business-e2e-runner] FAIL missing=$contract" >&2
    exit 1
  }
done

if grep -Eq '\beval\b|find .*business.*e2e|for .*ops/tests/\*' "$RUNNER"; then
  echo '[current-business-e2e-runner] FAIL ungoverned runner discovery' >&2
  exit 1
fi
echo '[current-business-e2e-runner] PASS allowlist=3 max-runs=1 timeout=bounded evidence=current-version deploy-lock=governed external-blockers=explicit'
