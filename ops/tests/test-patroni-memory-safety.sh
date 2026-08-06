#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/ops/scripts/configure-patroni-memory-safety.sh"
DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"

fail() {
  echo "[patroni-memory-safety-test] FAIL: $*" >&2
  exit 1
}

bash -n "$SCRIPT"
grep -Fq 'CARBONET_PATRONI_SHARED_BUFFERS:-1GB' "$SCRIPT" || fail 'shared_buffers must default to 1GB'
grep -Fq 'CARBONET_PATRONI_WORK_MEM:-16MB' "$SCRIPT" || fail 'work_mem contract is missing'
grep -Fq 'CARBONET_PATRONI_MAINTENANCE_WORK_MEM:-128MB' "$SCRIPT" || fail 'maintenance_work_mem contract is missing'
grep -Fq 'CARBONET_PATRONI_TEMP_FILE_LIMIT:-8GB' "$SCRIPT" || fail 'temp_file_limit contract is missing'
grep -Fq 'expected 3 Ready Patroni members' "$SCRIPT" || fail 'three-member readiness guard is missing'
grep -Fq 'CARBONET_PATRONI_CONFIGMAP:-patroni-template' "$SCRIPT" || fail 'ConfigMap contract is missing'
grep -Fq 'patch configmap "$CONFIGMAP"' "$SCRIPT" || fail 'ConfigMap self-healing is missing'
grep -Fq 'cat "$next" > /tmp/patroni.yml' "$SCRIPT" || fail 'active local configuration self-healing is missing'
grep -Fq 'kill -HUP 1' "$SCRIPT" || fail 'active local configuration reload is missing'
grep -Fq 'RESONANCE_HEAVY_DB_LOCK_FILE' "$SCRIPT" || fail 'shared heavy-DB lock is missing'
grep -Fq 'flock -n 7' "$SCRIPT" || fail 'non-blocking heavy-DB serialization is missing'
grep -Fq 'CARBONET_POSTGRES_BACKUP_SELECTOR:-app=postgres-backup' "$SCRIPT" || fail 'backup pod guard is missing'
grep -Fq 'could not verify whether a PostgreSQL backup pod is active' "$SCRIPT" || fail 'backup discovery must fail closed'
grep -Fq "lower(application_name) like '%pg_dump%'" "$SCRIPT" || fail 'backup session guard is missing'
grep -Fq 'select((.Role | ascii_downcase) == "leader")' "$SCRIPT" || fail 'leader must be identified dynamically'
grep -Fq '(.State | ascii_downcase) == "streaming"' "$SCRIPT" || fail 'replica streaming validation is missing'
grep -Fq '"Lag in MB" // 0' "$SCRIPT" || fail 'zero-lag validation is missing'
grep -Fq 'delete pod "$member" --wait=false' "$SCRIPT" || fail 'bounded full member restart is missing'
grep -Fq 'wait --for=condition=Ready "pod/$member"' "$SCRIPT" || fail 'member Ready verification is missing'
grep -Fq 'switchover "$CLUSTER"' "$SCRIPT" || fail 'planned switchover is missing'
grep -Fq -- '--leader "$leader" --candidate "$candidate" --force' "$SCRIPT" || fail 'explicit old/new leader contract is missing'
grep -Fq 'wait_for_demoted_member "$leader"' "$SCRIPT" || fail 'old leader demotion must not require the pre-restart SQL contract'
grep -Fq '"$matched" -eq "$total"' "$SCRIPT" || fail 'all duplicate YAML parameter values must match'
grep -Fq 'final DCS memory contract mismatch' "$SCRIPT" || fail 'final DCS validation is missing'
grep -Fq 'final ConfigMap memory contract mismatch' "$SCRIPT" || fail 'final ConfigMap validation is missing'
grep -Fq 'final local memory contract mismatch' "$SCRIPT" || fail 'final local validation is missing'
grep -Fq 'final SQL memory contract mismatch' "$SCRIPT" || fail 'final SQL validation is missing'
grep -Fq 'PASS no-op members=3' "$SCRIPT" || fail 'idempotent no-op path is missing'
grep -Fq 'configure-patroni-memory-safety.sh' "$DEPLOY" || fail 'auto-deploy integration is missing'
[[ "$(grep -Fc 'ops/scripts/configure-patroni-memory-safety.sh' "$DEPLOY")" -ge 3 ]] || \
  fail 'memory safety changes must enter the control-plane fast path'
grep -Fq 'ops/tests/test-patroni-memory-safety.sh' "$DEPLOY" || fail 'memory safety test is not mapped into deployment'
grep -Fq 'patroni_memory_check_completed' "$DEPLOY" || fail 'preflight result must be reused after application rollout'
grep -Fq 'Patroni memory drift check deferred in an N-1 or transient state' "$DEPLOY" || \
  fail 'routine N-1 drift checks must defer without invalidating an application rollout'
grep -Fq 'periodic control-plane drift marker withheld' "$DEPLOY" || \
  fail 'a deferred drift check must remain eligible for retry'

mismatch_line="$(grep -n 'if \[\[ "$contract_mismatch" -eq 0 \]\]' "$SCRIPT" | head -1 | cut -d: -f1)"
lock_line="$(grep -n 'exec 7>"$HEAVY_DB_LOCK_FILE"' "$SCRIPT" | head -1 | cut -d: -f1)"
[[ -n "$mismatch_line" && -n "$lock_line" && "$lock_line" -gt "$mismatch_line" ]] || \
  fail 'heavy-DB lock must be acquired only after an actual mismatch'

echo '[patroni-memory-safety-test] PASS: 1GB contract uses bounded, idempotent, backup-aware Patroni rolling reconciliation'
