#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
REGISTRY="${BUSINESS_E2E_RUNNER_REGISTRY:-$ROOT/ops/runtime-metadata/business-e2e-runner-registry.json}"
LOCK="${BUSINESS_E2E_RUNNER_LOCK:-/tmp/resonance-current-business-e2e-runner.lock}"
LOG_DIR="${BUSINESS_E2E_LOG_DIR:-$ROOT/var/test-evidence/current-business-e2e}"
exec 9>"$LOCK"
flock -n 9 || { echo '[current-business-e2e] already running' >&2; exit 75; }

jq -e '.schemaVersion=="1.0.0" and .policy.maxRunsPerInvocation==1 and .policy.failClosed==true' "$REGISTRY" >/dev/null
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
mkdir -p "$LOG_DIR"

mapfile -t runners < <(jq -c '.runners | sort_by(.priority)[] | select(.automation=="AUTOMATIC" or .automation=="AUTOMATIC_PARTIAL")' "$REGISTRY")
for runner in "${runners[@]}"; do
  process="$(jq -r '.processCode' <<<"$runner")"
  path="$(jq -r '.runner' <<<"$runner")"
  expected="$(jq -r '.expectedCurrentPassedSteps' <<<"$runner")"
  total="$(jq -r '.totalSteps' <<<"$runner")"
  timeout_seconds="$(jq -r '.timeoutSeconds' <<<"$runner")"
  [[ "$process" =~ ^[A-Z0-9_]+$ && "$path" =~ ^ops/(scripts|tests)/[a-zA-Z0-9._/-]+\.sh$ && -f "$ROOT/$path" ]] || {
    echo "[current-business-e2e] invalid registry entry process=$process" >&2
    exit 2
  }
  [[ "$expected" =~ ^[0-9]+$ && "$total" =~ ^[0-9]+$ && "$timeout_seconds" =~ ^[0-9]+$ ]] || exit 2
  (( expected > 0 && expected <= total && timeout_seconds >= 30 && timeout_seconds <= 900 )) || exit 2

  current="$(carbonet_postgres_query "select count(*) from framework_current_business_e2e_evidence where process_code='$process' and business_test_result='PASSED' and current_version;")"
  if (( current >= expected )); then
    continue
  fi

  started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log="$LOG_DIR/${process}-$(date -u +%Y%m%dT%H%M%SZ).log"
  if ! timeout "$timeout_seconds" bash "$ROOT/$path" >"$log" 2>&1; then
    echo "[current-business-e2e] FAILED process=$process log=$log" >&2
    exit 1
  fi
  current_after="$(carbonet_postgres_query "select count(*) from framework_current_business_e2e_evidence where process_code='$process' and business_test_result='PASSED' and current_version;")"
  [[ "$current_after" == "$expected" ]] || {
    echo "[current-business-e2e] evidence mismatch process=$process expected=$expected actual=$current_after log=$log" >&2
    exit 1
  }
  blockers="$(jq -c '.externalBlockers' <<<"$runner")"
  echo "[current-business-e2e] PASS process=$process current=$current_after/$total started=$started blockers=$blockers log=$log"
  exit 0
done

echo '[current-business-e2e] COMPLETE eligible-current-evidence=closed'
