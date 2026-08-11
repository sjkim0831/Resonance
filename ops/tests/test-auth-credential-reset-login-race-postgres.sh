#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${CARBONET_NAMESPACE:-carbonet-prod}"
POD="${CARBONET_POSTGRES_POD:-postgres-patroni-0}"
DATABASE="${CARBONET_DATABASE:-carbonet}"
SUFFIX="$$_${RANDOM}"
CREDENTIAL_TABLE="auth_credential_race_${SUFFIX//[^a-zA-Z0-9_]/_}"
TOKEN_TABLE="auth_token_login_race_${SUFFIX//[^a-zA-Z0-9_]/_}"
WORK_DIR="$(mktemp -d)"
USER_ID="race-member-${SUFFIX}"

psql_exec() {
  kubectl -n "$NAMESPACE" exec -i "$POD" -- \
    psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d "$DATABASE" "$@"
}

cleanup() {
  printf 'DROP TABLE IF EXISTS %s; DROP TABLE IF EXISTS %s;\n' "$TOKEN_TABLE" "$CREDENTIAL_TABLE" \
    | psql_exec >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

printf 'CREATE UNLOGGED TABLE %s (user_id text PRIMARY KEY, password_hash text NOT NULL);\nCREATE UNLOGGED TABLE %s (user_id text PRIMARY KEY, token_hash text NOT NULL);\n' \
  "$CREDENTIAL_TABLE" "$TOKEN_TABLE" | psql_exec >/dev/null

reset_fixture() {
  printf "TRUNCATE %s, %s; INSERT INTO %s VALUES ('%s', 'old-password-hash');\n" \
    "$TOKEN_TABLE" "$CREDENTIAL_TABLE" "$CREDENTIAL_TABLE" "$USER_ID" | psql_exec >/dev/null
}

lock_sql="SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('carbonet:credential:' || lower(trim('$USER_ID')), 0));"

# LOGIN -> RESET: the old password is validated and a token is persisted while
# holding the account lock. Reset waits, then changes the password and revokes
# that token. The final state must contain the new password and zero tokens.
reset_fixture
(
  printf "BEGIN; %s SELECT password_hash FROM %s WHERE user_id='%s'; SELECT pg_sleep(1.5); INSERT INTO %s SELECT user_id, 'old-login-token' FROM %s WHERE user_id='%s' AND password_hash='old-password-hash'; COMMIT;\n" \
    "$lock_sql" "$CREDENTIAL_TABLE" "$USER_ID" "$TOKEN_TABLE" "$CREDENTIAL_TABLE" "$USER_ID" \
    | psql_exec >"$WORK_DIR/login-first.log"
) &
login_pid=$!
sleep 0.25
(
  printf "BEGIN; %s UPDATE %s SET password_hash='new-password-hash' WHERE user_id='%s'; DELETE FROM %s WHERE user_id='%s'; COMMIT;\n" \
    "$lock_sql" "$CREDENTIAL_TABLE" "$USER_ID" "$TOKEN_TABLE" "$USER_ID" \
    | psql_exec >"$WORK_DIR/reset-after-login.log"
) &
reset_pid=$!
wait "$login_pid"
wait "$reset_pid"
grep -Eq 'INSERT 0 1' "$WORK_DIR/login-first.log"
grep -Eq 'UPDATE 1' "$WORK_DIR/reset-after-login.log"
grep -Eq 'DELETE 1' "$WORK_DIR/reset-after-login.log"
login_then_reset="$(printf "SELECT password_hash || ':' || (SELECT count(*) FROM %s WHERE user_id='%s') FROM %s WHERE user_id='%s';\n" \
  "$TOKEN_TABLE" "$USER_ID" "$CREDENTIAL_TABLE" "$USER_ID" | psql_exec -At 2>/dev/null | tr -d '[:space:]')"
test "$login_then_reset" = 'new-password-hash:0'

# RESET -> LOGIN: reset changes the credential and revokes tokens first. The
# waiting old-password login revalidates only after reset commits, so its
# guarded token insert must affect zero rows.
reset_fixture
printf "INSERT INTO %s VALUES ('%s', 'pre-reset-token');\n" "$TOKEN_TABLE" "$USER_ID" | psql_exec >/dev/null
(
  printf "BEGIN; %s UPDATE %s SET password_hash='new-password-hash' WHERE user_id='%s'; DELETE FROM %s WHERE user_id='%s'; SELECT pg_sleep(1.5); COMMIT;\n" \
    "$lock_sql" "$CREDENTIAL_TABLE" "$USER_ID" "$TOKEN_TABLE" "$USER_ID" \
    | psql_exec >"$WORK_DIR/reset-first.log"
) &
reset_pid=$!
sleep 0.25
(
  printf "BEGIN; %s INSERT INTO %s SELECT user_id, 'resurrected-old-login-token' FROM %s WHERE user_id='%s' AND password_hash='old-password-hash'; COMMIT;\n" \
    "$lock_sql" "$TOKEN_TABLE" "$CREDENTIAL_TABLE" "$USER_ID" \
    | psql_exec >"$WORK_DIR/login-after-reset.log"
) &
login_pid=$!
wait "$reset_pid"
wait "$login_pid"
grep -Eq 'UPDATE 1' "$WORK_DIR/reset-first.log"
grep -Eq 'DELETE 1' "$WORK_DIR/reset-first.log"
grep -Eq 'INSERT 0 0' "$WORK_DIR/login-after-reset.log"
reset_then_login="$(printf "SELECT password_hash || ':' || (SELECT count(*) FROM %s WHERE user_id='%s') FROM %s WHERE user_id='%s';\n" \
  "$TOKEN_TABLE" "$USER_ID" "$CREDENTIAL_TABLE" "$USER_ID" | psql_exec -At 2>/dev/null | tr -d '[:space:]')"
test "$reset_then_login" = 'new-password-hash:0'

remaining_fixture_rows="$(printf "SELECT (SELECT count(*) FROM %s) + (SELECT count(*) FROM %s);\n" \
  "$TOKEN_TABLE" "$CREDENTIAL_TABLE" | psql_exec -At 2>/dev/null | tr -d '[:space:]')"

printf 'AUTH_CREDENTIAL_RESET_LOGIN_RACE_POSTGRES_PASS directions=2 loginThenReset=%s resetThenOldLogin=%s fixtureRowsBeforeCleanup=%s oldCredentialTokenResurrection=0\n' \
  "$login_then_reset" "$reset_then_login" "$remaining_fixture_rows"
