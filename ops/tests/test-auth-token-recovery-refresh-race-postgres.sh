#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${CARBONET_NAMESPACE:-carbonet-prod}"
POD="${CARBONET_POSTGRES_POD:-postgres-patroni-0}"
DATABASE="${CARBONET_DATABASE:-carbonet}"
TABLE="auth_token_race_$$_${RANDOM}"
TABLE="${TABLE//[^a-zA-Z0-9_]/_}"
WORK_DIR="$(mktemp -d)"

psql_exec() {
  kubectl -n "$NAMESPACE" exec -i "$POD" -- \
    psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d "$DATABASE" "$@"
}

cleanup() {
  printf 'DROP TABLE IF EXISTS %s;\n' "$TABLE" | psql_exec >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

printf 'CREATE UNLOGGED TABLE %s (user_id text PRIMARY KEY, refresh_token_hash text NOT NULL);\n' "$TABLE" \
  | psql_exec >/dev/null

# Refresh wins the row lock first. Recovery must wait, then delete the rotated
# row; the transaction order must leave no token behind.
printf "INSERT INTO %s VALUES ('member01', 'old');\n" "$TABLE" | psql_exec >/dev/null
(
  printf "BEGIN; SELECT user_id FROM %s WHERE user_id='member01' FOR UPDATE; UPDATE %s SET refresh_token_hash='new' WHERE user_id='member01' AND refresh_token_hash='old'; SELECT pg_sleep(1.5); COMMIT;\n" \
    "$TABLE" "$TABLE" | psql_exec >"$WORK_DIR/refresh-first.log"
) &
refresh_pid=$!
sleep 0.25
(
  printf "BEGIN; DELETE FROM %s WHERE user_id='member01'; COMMIT;\n" "$TABLE" \
    | psql_exec >"$WORK_DIR/recovery-after-refresh.log"
) &
recovery_pid=$!
wait "$refresh_pid"
wait "$recovery_pid"

grep -Eq 'UPDATE 1' "$WORK_DIR/refresh-first.log"
grep -Eq 'DELETE 1' "$WORK_DIR/recovery-after-refresh.log"
refresh_first_final="$(printf "SELECT count(*) FROM %s WHERE user_id='member01';\n" "$TABLE" \
  | psql_exec -At 2>/dev/null | tr -d '[:space:]')"
test "$refresh_first_final" = "0"

# Recovery wins the row lock first. Refresh waits, observes no row, and its
# guarded update affects zero rows; it must never insert a replacement.
printf "INSERT INTO %s VALUES ('member01', 'old');\n" "$TABLE" | psql_exec >/dev/null
(
  printf "BEGIN; DELETE FROM %s WHERE user_id='member01'; SELECT pg_sleep(1.5); COMMIT;\n" "$TABLE" \
    | psql_exec >"$WORK_DIR/recovery-first.log"
) &
recovery_pid=$!
sleep 0.25
(
  printf "BEGIN; SELECT user_id FROM %s WHERE user_id='member01' FOR UPDATE; UPDATE %s SET refresh_token_hash='new' WHERE user_id='member01' AND refresh_token_hash='old'; COMMIT;\n" \
    "$TABLE" "$TABLE" | psql_exec >"$WORK_DIR/refresh-after-recovery.log"
) &
refresh_pid=$!
wait "$recovery_pid"
wait "$refresh_pid"

grep -Eq 'DELETE 1' "$WORK_DIR/recovery-first.log"
grep -Eq 'UPDATE 0' "$WORK_DIR/refresh-after-recovery.log"
recovery_first_final="$(printf "SELECT count(*) FROM %s WHERE user_id='member01';\n" "$TABLE" \
  | psql_exec -At 2>/dev/null | tr -d '[:space:]')"
test "$recovery_first_final" = "0"

printf 'AUTH_TOKEN_RECOVERY_REFRESH_RACE_POSTGRES_PASS refresh_first_final=%s recovery_first_final=%s\n' \
  "$refresh_first_final" "$recovery_first_final"
