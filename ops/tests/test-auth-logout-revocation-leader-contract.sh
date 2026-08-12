#!/usr/bin/env bash
set -euo pipefail

CONTRACT_CREDENTIAL_SENTINEL='contract-credential-sentinel-7f0b3d2e'

fake_kubectl() {
  local joined=" $* " pod="" index
  if [[ "$joined" == *" get pods "* && "$joined" == *" app=postgres-patroni "* ]]; then
    local round=0
    if [[ -n "${FAKE_STATE_DIR:-}" ]]; then
      [[ ! -f "$FAKE_STATE_DIR/leader-round" ]] || round="$(<"$FAKE_STATE_DIR/leader-round")"
      round=$((round + 1))
      printf '%s\n' "$round" > "$FAKE_STATE_DIR/leader-round"
    fi
    printf 'patroni-0\npatroni-1\npatroni-2\n'
    return 0
  fi
  if [[ "$joined" == *" exec "* && "$joined" == *" select pg_is_in_recovery() "* ]]; then
    for ((index=1; index<=$#; index+=1)); do
      if [[ "${!index}" == "exec" ]]; then
        index=$((index + 1))
        pod="${!index}"
        break
      fi
    done
    local state="${FAKE_PATRONI_STATE:-one}" round=1 failover_leader=patroni-1
    if [[ -n "${FAKE_STATE_DIR:-}" && -f "$FAKE_STATE_DIR/leader-round" ]]; then
      round="$(<"$FAKE_STATE_DIR/leader-round")"
    fi
    if [[ "$state" == "failover" ]]; then
      case "$(( (round - 1) % 3 ))" in
        0) failover_leader=patroni-1 ;;
        1) failover_leader=patroni-0 ;;
        2) failover_leader=patroni-2 ;;
      esac
    fi
    case "$state:$pod" in
      one:patroni-1|two:patroni-0|two:patroni-1) printf 'f\n' ;;
      one:patroni-0|one:patroni-2|zero:patroni-0|zero:patroni-1|zero:patroni-2|two:patroni-2) printf 't\n' ;;
      failover:*) [[ "$pod" == "$failover_leader" ]] && printf 'f\n' || printf 't\n' ;;
      *) echo "unexpected fake Patroni probe state=${FAKE_PATRONI_STATE:-unset} pod=$pod" >&2; return 2 ;;
    esac
    return 0
  fi
  if [[ "$joined" == *" get secret "* && "$joined" == *".data.username"* ]]; then
    printf '%s' "${FAKE_SECRET_USER:-qausageadmin26}" | base64 | tr -d '\n'
    return 0
  fi
  if [[ "$joined" == *" get secret "* && "$joined" == *".data.password"* ]]; then
    printf '%s' "$CONTRACT_CREDENTIAL_SENTINEL" | base64 | tr -d '\n'
    return 0
  fi
  if [[ "$joined" == *" exec "* && "$joined" == *" from comtnauthtokenstore "* ]]; then
    for ((index=1; index<=$#; index+=1)); do
      if [[ "${!index}" == "exec" ]]; then
        index=$((index + 1))
        pod="${!index}"
        break
      fi
    done
    local round=1 expected_leader=patroni-1
    if [[ -n "${FAKE_STATE_DIR:-}" && -f "$FAKE_STATE_DIR/leader-round" ]]; then
      round="$(<"$FAKE_STATE_DIR/leader-round")"
    fi
    if [[ "${FAKE_PATRONI_STATE:-one}" == "failover" ]]; then
      case "$(( (round - 1) % 3 ))" in
        0) expected_leader=patroni-1 ;;
        1) expected_leader=patroni-0 ;;
        2) expected_leader=patroni-2 ;;
      esac
    fi
    [[ "$pod" == "$expected_leader" ]] || {
      echo "token query used stale leader pod=$pod expected=$expected_leader round=$round" >&2
      return 2
    }
    printf '%s\n' "$pod" >> "$FAKE_STATE_DIR/token-query-pods"
    [[ -f "$FAKE_STATE_DIR/token-count" ]] || printf '0\n' > "$FAKE_STATE_DIR/token-count"
    cat "$FAKE_STATE_DIR/token-count"
    return 0
  fi
  echo "unexpected fake kubectl invocation: $*" >&2
  return 2
}

fake_mktemp() {
  local target
  [[ -n "${FAKE_STATE_DIR:-}" ]] || return 2
  target="$FAKE_STATE_DIR/live-tmp"
  [[ ! -e "$target" ]] || return 2
  mkdir -m 0700 "$target"
  printf '%s\n' "$target"
}

fake_curl() {
  local output_file="" cookie_file="" url="" index status body token_count=0 argument
  for argument in "$@"; do
    if [[ "$argument" == *"$CONTRACT_CREDENTIAL_SENTINEL"* ]]; then
      echo 'credential sentinel appeared in curl argv' >&2
      return 2
    fi
  done
  for ((index=1; index<=$#; index+=1)); do
    case "${!index}" in
      -o|-c)
        local option="${!index}"
        index=$((index + 1))
        [[ "$option" == "-o" ]] && output_file="${!index}" || cookie_file="${!index}"
        ;;
      http://*|https://*) url="${!index}" ;;
    esac
  done
  [[ -n "$FAKE_STATE_DIR" && -n "$url" ]] || return 2
  [[ ! -f "$FAKE_STATE_DIR/token-count" ]] || token_count="$(<"$FAKE_STATE_DIR/token-count")"
  case "$url" in
    */signin/actionLogin)
      status=200
      body='{"status":"loginSuccess"}'
      printf '%s\n' "${FAKE_LOGIN_TOKEN_COUNT:-1}" > "$FAKE_STATE_DIR/token-count"
      if [[ -n "$cookie_file" ]]; then
        printf '# Netscape HTTP Cookie File\n127.0.0.1\tFALSE\t/\tFALSE\t0\taccessToken\tcontract-access\n127.0.0.1\tFALSE\t/\tFALSE\t0\trefreshToken\tcontract-refresh\n' > "$cookie_file"
      fi
      ;;
    */signin/actionLogout)
      local logout_round=0
      [[ ! -f "$FAKE_STATE_DIR/logout-round" ]] || logout_round="$(<"$FAKE_STATE_DIR/logout-round")"
      logout_round=$((logout_round + 1))
      printf '%s\n' "$logout_round" > "$FAKE_STATE_DIR/logout-round"
      if [[ -n "${FAKE_LOGOUT_STATUS:-}" && "$logout_round" == "1" ]]; then
        status="$FAKE_LOGOUT_STATUS"
      else
        status=200
      fi
      if [[ "$status" == "200" ]]; then
        body='{"status":"success"}'
        if [[ "${FAKE_LOGOUT_PRESERVE_ONCE:-false}" != "true" || "$logout_round" != "1" ]]; then
          printf '0\n' > "$FAKE_STATE_DIR/token-count"
        fi
      else
        body="{\"status\":\"failure\",\"httpStatus\":${status}}"
      fi
      ;;
    */api/frontend/session)
      if [[ "$token_count" != "0" ]]; then
        status=200
        body="{\"authenticated\":${FAKE_PRE_SESSION_AUTHENTICATED:-true},\"actualUserId\":\"${FAKE_SESSION_USER:-qausageadmin26}\"}"
      else
        status="${FAKE_STALE_SESSION_STATUS:-200}"
        body="{\"authenticated\":${FAKE_STALE_SESSION_AUTHENTICATED:-false}}"
      fi
      ;;
    *'/admin/api/system/actor-process/system-test-report?'*)
      if [[ "$token_count" != "0" ]]; then
        status="${FAKE_PRE_PROTECTED_STATUS:-200}"
        body="{\"success\":${FAKE_PRE_PROTECTED_SUCCESS:-true}}"
      else
        status="${FAKE_PROTECTED_STATUS:-401}"
        body="{\"status\":${status},\"success\":${FAKE_PROTECTED_SUCCESS:-false},\"message\":\"${FAKE_PROTECTED_MESSAGE:-AUTHENTICATION_REQUIRED}\"}"
      fi
      ;;
    */signin/refreshSession)
      status="${FAKE_REFRESH_STATUS:-401}"
      body="{\"status\":${status}}"
      ;;
    *) echo "unexpected fake curl URL: $url" >&2; return 2 ;;
  esac
  [[ -z "$output_file" ]] || printf '%s\n' "$body" > "$output_file"
  printf '%s' "$status"
}

if [[ "${0##*/}" == "kubectl" ]]; then
  fake_kubectl "$@"
  exit $?
fi
if [[ "${0##*/}" == "curl" ]]; then
  fake_curl "$@"
  exit $?
fi
if [[ "${0##*/}" == "mktemp" ]]; then
  fake_mktemp "$@"
  exit $?
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LIVE="$ROOT/ops/tests/test-auth-logout-revocation-live.sh"
TMP_DIR="$(mktemp -d /tmp/auth-logout-leader-contract.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() {
  echo "[auth-logout-leader-contract] FAIL: $*" >&2
  exit 1
}

assert_source_contract() {
  local candidate="$1"
  grep -Fq "select pg_is_in_recovery()" "$candidate" || return 1
  grep -Fq '${#leaders[@]} != 1' "$candidate" || return 1
  grep -Fq "{range .items[*]}{.metadata.name}" "$candidate" || return 1
  grep -Fq 'current_leader="$(resolve_patroni_leader)"' "$candidate" || return 1
  grep -Fq '.authenticated==true' "$candidate" || return 1
  grep -Fq 'protected_code" == "401"' "$candidate" || return 1
  grep -Fq '.authenticated==false' "$candidate" || return 1
  grep -Fq '.success==false and .message=="AUTHENTICATION_REQUIRED"' "$candidate" || return 1
  grep -Fq 'refresh_code" == "401" || "$refresh_code" == "403"' "$candidate" || return 1
  grep -Fq 'rm -rf -- "$TMP_DIR"' "$candidate" || return 1
  grep -Fq 'return "$original_status"' "$candidate" || return 1
  ! grep -Fq ".items[0].metadata.name" "$candidate"
}

assert_source_contract "$LIVE" || fail 'live logout verifier must reject first-pod selection and require exactly one leader'
MUTANT="$TMP_DIR/items-zero-mutant.sh"
sed 's/{range \.items\[\*\]}{\.metadata\.name}{"\\n"}{end}/{.items[0].metadata.name}/' "$LIVE" > "$MUTANT"
if assert_source_contract "$MUTANT"; then
  fail 'items[0] mutation survived the leader contract'
fi

mkdir -p "$TMP_DIR/bin"
install -m 0700 "$ROOT/ops/tests/test-auth-logout-revocation-leader-contract.sh" "$TMP_DIR/bin/kubectl"
install -m 0700 "$ROOT/ops/tests/test-auth-logout-revocation-leader-contract.sh" "$TMP_DIR/bin/curl"
install -m 0700 "$ROOT/ops/tests/test-auth-logout-revocation-leader-contract.sh" "$TMP_DIR/bin/mktemp"

credential_argv_stdout="$TMP_DIR/credential-argv.out"
credential_argv_stderr="$TMP_DIR/credential-argv.err"
if FAKE_STATE_DIR="$TMP_DIR" "$TMP_DIR/bin/curl" http://127.0.0.1/signin/actionLogin \
    --data "$CONTRACT_CREDENTIAL_SENTINEL" >"$credential_argv_stdout" 2>"$credential_argv_stderr"; then
  fail 'credential sentinel in curl argv was not rejected'
fi
grep -Fq 'credential sentinel appeared in curl argv' "$credential_argv_stderr" \
  || fail 'credential argv rejection did not report the safe generic reason'
if grep -Fq "$CONTRACT_CREDENTIAL_SENTINEL" "$credential_argv_stdout" "$credential_argv_stderr"; then
  fail 'credential sentinel leaked while rejecting curl argv'
fi

run_probe() {
  local state="$1" expected_outcome="$2" expected_value="$3" status=0 output error_file
  rm -rf "$TMP_DIR/state"
  mkdir -p "$TMP_DIR/state"
  error_file="$TMP_DIR/${state}.err"
  output="$(PATH="$TMP_DIR/bin:$PATH" FAKE_STATE_DIR="$TMP_DIR/state" FAKE_PATRONI_STATE="$state" \
    bash "$LIVE" --resolve-leader-only 2>"$error_file")" || status=$?
  if [[ "$expected_outcome" == "pass" ]]; then
    [[ "$status" == "0" && "$output" == "$expected_value" ]] \
      || fail "state=$state expected leader=$expected_value status=0; actual leader=$output status=$status"
  else
    [[ "$status" != "0" ]] || fail "state=$state unexpectedly selected leader=$output"
    grep -Fq "expected exactly one writable Patroni leader; found=${expected_value}" "$error_file" \
      || fail "state=$state did not report leader cardinality=${expected_value}"
  fi
}

run_probe one pass patroni-1
run_probe zero fail 0
run_probe two fail 2

status_state_dir="$TMP_DIR/status-preservation"
mkdir -p "$status_state_dir"
status_preservation=0
PATH="$TMP_DIR/bin:$PATH" FAKE_STATE_DIR="$status_state_dir" \
  bash "$LIVE" unexpected-argument >"$status_state_dir/stdout" 2>"$status_state_dir/stderr" \
  || status_preservation=$?
[[ "$status_preservation" == "2" ]] \
  || fail "EXIT cleanup did not preserve status=2; actual=$status_preservation"
[[ ! -e "$status_state_dir/live-tmp" ]] \
  || fail 'status-preservation path left the live verifier temporary directory behind'
grep -Fq '[auth-logout-live] unexpected argument' "$status_state_dir/stderr" \
  || fail 'status-preservation path failed for the wrong reason'

run_full() {
  local name="$1" expected="$2" expected_error="$3" status=0 output error_file state_dir
  shift 3
  state_dir="$TMP_DIR/full-$name"
  error_file="$state_dir/stderr"
  mkdir -p "$state_dir"
  output="$(env \
    PATH="$TMP_DIR/bin:$PATH" \
    FAKE_STATE_DIR="$state_dir" \
    FAKE_PATRONI_STATE=failover \
    CARBONET_RUNTIME_BASE_URL=http://127.0.0.1 \
    CARBONET_QA_AUTH_LOCK_FILE="$state_dir/auth.lock" \
    "$@" bash "$LIVE" 2>"$error_file")" || status=$?
  if [[ "$output" == *"$CONTRACT_CREDENTIAL_SENTINEL"* ]] \
     || grep -Fq "$CONTRACT_CREDENTIAL_SENTINEL" "$error_file"; then
    fail "full state=$name leaked the credential sentinel"
  fi
  [[ ! -e "$state_dir/live-tmp" ]] \
    || fail "full state=$name left the live verifier temporary directory behind"
  [[ -f "$state_dir/token-count" && "$(<"$state_dir/token-count")" == "0" ]] \
    || fail "full state=$name did not best-effort clean the QA token row"
  if [[ "$expected" == pass ]]; then
    [[ "$status" == 0 ]] || fail "full state=$name expected pass status=0; actual status=$status error=$(<"$error_file")"
    grep -Fq '[auth-logout-live] PASS account=qausageadmin26' <<<"$output" \
      || fail "full state=$name did not emit exact PASS identity"
    [[ "$(cat "$state_dir/token-query-pods")" == $'patroni-1\npatroni-0' ]] \
      || fail "full state=$name did not re-resolve the leader across failover"
  else
    [[ "$status" == 1 ]] || fail "full state=$name expected status=1; actual=$status"
    grep -Fq "$expected_error" "$error_file" \
      || fail "full state=$name failed for the wrong reason; expected=$expected_error actual=$(<"$error_file")"
  fi
}

run_full exact pass -
run_full account-not-dedicated fail 'authenticated QA account is not the dedicated usage-ledger administrator' FAKE_SECRET_USER=other-admin FAKE_SESSION_USER=other-admin
run_full identity-mismatch fail 'authenticated session identity mismatch' FAKE_SESSION_USER=wrong-user
run_full pre-session-unauthenticated fail 'authenticated session identity mismatch' FAKE_PRE_SESSION_AUTHENTICATED=false
run_full pre-protected-302 fail 'authenticated protected API probe http=302' FAKE_PRE_PROTECTED_STATUS=302
run_full pre-protected-false fail 'authenticated protected API response mismatch' FAKE_PRE_PROTECTED_SUCCESS=false
run_full token-count-two fail 'login token row was not persisted exactly once' FAKE_LOGIN_TOKEN_COUNT=2
run_full logout-500 fail 'authoritative logout failed' FAKE_LOGOUT_STATUS=500
run_full logout-token-survived fail 'token row survived logout' FAKE_LOGOUT_PRESERVE_ONCE=true
run_full protected-302 fail 'stale access protected API http=302' FAKE_PROTECTED_STATUS=302
run_full protected-success-true fail 'stale access denial response mismatch' FAKE_PROTECTED_SUCCESS=true
run_full protected-message-wrong fail 'stale access denial response mismatch' FAKE_PROTECTED_MESSAGE=WRONG_REASON
run_full session-stale-401 fail 'stale session probe http=401' FAKE_STALE_SESSION_STATUS=401
run_full session-stale-authenticated fail 'stale session remained authenticated' FAKE_STALE_SESSION_AUTHENTICATED=true
run_full refresh-302 fail 'stale refresh denial was not authoritative (http=302)' FAKE_REFRESH_STATUS=302
run_full refresh-500 fail 'stale refresh denial was not authoritative (http=500)' FAKE_REFRESH_STATUS=500

printf '[auth-logout-leader-contract] PASS selected=patroni-1 zeroLeaders=failed twoLeaders=failed failover=leader-reresolved exitStatus=preserved exactAccount=enforced identityMismatch=failed preSession=failed preProtected=failed tokenCount2=failed logout500=cleaned logoutTokenSurvived=cleaned protected302=failed protectedJsonMutants=failed staleSession=failed refresh302=failed refresh500=failed credentialArgvLog=clean items0Mutation=killed\n'
