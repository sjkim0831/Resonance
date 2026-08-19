#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/ops/scripts/configure-patroni-hot-standby-feedback.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
MOCK_BIN="$TMP_DIR/bin"
MOCK_LOG="$TMP_DIR/kubectl.log"
MOCK_STATE="$TMP_DIR/feedback.state"
mkdir -p "$MOCK_BIN"

fail() {
  echo "[patroni-hot-standby-feedback-test] FAIL: $*" >&2
  exit 1
}

cat >"$MOCK_BIN/jq" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
input="$(cat)"
if [[ " $* " == *" -e "* ]]; then
  [[ "$input" == *'"Member":"postgres-patroni-0"'* ]]
  [[ "$input" == *'"Member":"postgres-patroni-1"'* ]]
  [[ "$input" == *'"Member":"postgres-patroni-2"'* ]]
  (( ${MOCK_TOPOLOGY_LAG_MB:-0} <= 64 ))
  exit
fi
if [[ " $* " == *" -r "* ]]; then
  printf '%s\n' postgres-patroni-0
  exit
fi
echo "unsupported mock jq call: $*" >&2
exit 2
MOCK

cat >"$MOCK_BIN/kubectl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$MOCK_LOG"
args=" $* "
pod=""
for arg in "$@"; do
  case "$arg" in postgres-patroni-[0-2]) pod="$arg" ;; esac
done

if [[ "$args" == *" get pods "* && "$args" == *" app=postgres-patroni "* ]]; then
  count="${MOCK_READY_MEMBERS:-3}"
  (( count >= 1 )) && printf 'postgres-patroni-0|true\n'
  (( count >= 2 )) && printf 'postgres-patroni-1|true\n'
  (( count >= 3 )) && printf 'postgres-patroni-2|true\n'
  exit 0
fi
if [[ "$args" == *" get pod postgres-patroni-"* ]]; then
  [[ "${MOCK_UNHEALTHY_POD:-}" != "$pod" ]] || { printf 'false'; exit 0; }
  printf 'true'
  exit 0
fi
if [[ "$args" == *" patronictl -c /tmp/patroni.yml list "* ]]; then
  lag="${MOCK_TOPOLOGY_LAG_MB:-0}"
  printf '[{"Member":"postgres-patroni-0","Role":"Leader","State":"running","Lag in MB":0},{"Member":"postgres-patroni-1","Role":"Replica","State":"streaming","Lag in MB":%s},{"Member":"postgres-patroni-2","Role":"Replica","State":"streaming","Lag in MB":%s}]\n' "$lag" "$lag"
  exit 0
fi
if [[ "$args" == *" patronictl -c /tmp/patroni.yml show-config "* ]]; then
  printf 'postgresql:\n  parameters:\n    hot_standby_feedback: %s\n' "$(cat "$MOCK_STATE")"
  exit 0
fi
if [[ "$args" == *" patronictl -c /tmp/patroni.yml edit-config "* ]]; then
  printf 'on\n' >"$MOCK_STATE"
  exit 0
fi
if [[ "$args" == *" patronictl -c /tmp/patroni.yml reload "* ]]; then
  exit 0
fi
if [[ "$args" == *" psql "* && "$args" == *" show hot_standby_feedback "* ]]; then
  if [[ "${MOCK_STICKY_MEMBER_OFF:-}" == "$pod" ]]; then printf 'off\n'; else cat "$MOCK_STATE"; fi
  exit 0
fi
if [[ "$args" == *" psql "* && "$args" == *" select 1 "* ]]; then
  [[ "${MOCK_SQL_UNHEALTHY_POD:-}" != "$pod" ]] || exit 1
  printf '1\n'
  exit 0
fi
if [[ "$args" == *" psql "* && "$args" == *" pg_stat_replication "* ]]; then
  printf '%s|%s|%s|%s\n' \
    "${MOCK_REPLICATION_ROWS:-2}" "${MOCK_STREAMING_ROWS:-2}" \
    "${MOCK_SQL_LAG_BYTES:-0}" "${MOCK_XMIN_AGE:-0}"
  exit 0
fi
echo "unsupported mock kubectl call: $*" >&2
exit 2
MOCK
chmod +x "$MOCK_BIN/jq" "$MOCK_BIN/kubectl"
export PATH="$MOCK_BIN:$PATH" MOCK_LOG MOCK_STATE
export CARBONET_PATRONI_FEEDBACK_CONVERGE_TIMEOUT_SECONDS=2
export CARBONET_PATRONI_FEEDBACK_POLL_SECONDS=1
export CARBONET_PATRONI_KUBECTL_TIMEOUT_SECONDS=3

bash -n "$SCRIPT"
[[ "$(grep -oF "count(*) filter(where state='streaming')" "$SCRIPT" | wc -l | tr -d '[:space:]')" == 2 ]] ||
  fail 'replica cardinality must exclude non-streaming pg_basebackup walsenders'
grep -Fq "max(pg_wal_lsn_diff(pg_current_wal_lsn(),replay_lsn)) filter(where state='streaming')" "$SCRIPT" ||
  fail 'replay lag must be scoped to streaming Patroni replicas'
grep -Fq "filter(where state='streaming' and backend_xmin is not null)" "$SCRIPT" ||
  fail 'feedback xmin age must be scoped to streaming Patroni replicas'

# Drift is changed once through Patroni DCS and converges without a restart.
printf 'off\n' >"$MOCK_STATE"
: >"$MOCK_LOG"
bash "$SCRIPT"
[[ "$(cat "$MOCK_STATE")" == on ]] || fail 'DCS edit did not update the effective mock value'
[[ "$(grep -c ' patronictl -c /tmp/patroni.yml edit-config ' "$MOCK_LOG")" -eq 1 ]] || fail 'drift must invoke one DCS edit'
[[ "$(grep -c ' patronictl -c /tmp/patroni.yml reload ' "$MOCK_LOG")" -eq 1 ]] || fail 'dynamic DCS change must invoke one Patroni reload'
! grep -Eq ' delete pod | rollout restart | switchover | restart ' "$MOCK_LOG" || fail 'dynamic setting attempted a restart or switchover'

# A healthy rerun and check mode are read-only/idempotent.
: >"$MOCK_LOG"
bash "$SCRIPT"
bash "$SCRIPT" --check
! grep -Fq ' edit-config ' "$MOCK_LOG" || fail 'healthy rerun edited DCS'

# Check mode reports drift but must never repair it.
printf 'off\n' >"$MOCK_STATE"
: >"$MOCK_LOG"
if bash "$SCRIPT" --check >/dev/null 2>&1; then fail 'check mode accepted drift'; fi
! grep -Fq ' edit-config ' "$MOCK_LOG" || fail 'check mode mutated DCS'

# Replication lag, feedback xmin retention and incomplete membership fail closed.
printf 'off\n' >"$MOCK_STATE"
if MOCK_TOPOLOGY_LAG_MB=65 bash "$SCRIPT" >/dev/null 2>&1; then fail 'excess topology lag was accepted'; fi
if MOCK_SQL_LAG_BYTES=67108865 bash "$SCRIPT" >/dev/null 2>&1; then fail 'excess SQL replay lag was accepted'; fi
if MOCK_XMIN_AGE=1000001 bash "$SCRIPT" >/dev/null 2>&1; then fail 'excess feedback xmin age was accepted'; fi
if MOCK_READY_MEMBERS=2 bash "$SCRIPT" >/dev/null 2>&1; then fail 'two-member topology was accepted'; fi

# A member that does not reload the SIGHUP parameter fails after the bounded wait.
printf 'off\n' >"$MOCK_STATE"
: >"$MOCK_LOG"
if MOCK_STICKY_MEMBER_OFF=postgres-patroni-2 bash "$SCRIPT" >/dev/null 2>&1; then
  fail 'partial member convergence was accepted'
fi
grep -Fq ' edit-config ' "$MOCK_LOG" || fail 'partial convergence test did not exercise DCS edit'
! grep -Eq ' delete pod | rollout restart | switchover | restart ' "$MOCK_LOG" || fail 'failed convergence attempted a restart'

echo '[patroni-hot-standby-feedback-test] PASS: dynamic DCS apply, 3/3 SHOW, streaming, lag/xmin and no-restart contracts'
