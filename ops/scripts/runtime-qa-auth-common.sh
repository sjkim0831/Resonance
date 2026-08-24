#!/usr/bin/env bash

# Canonical QA authentication helper for runtime verification scripts.
# It deliberately uses the public login contract so issued access tokens are
# persisted in COMTNAUTHTOKENSTORE and remain compatible with central
# revocation. The default account is an existing isolated QA account; the
# primary webmaster account is rejected to avoid terminating an operator's
# active session under the single-token policy.

carbonet_qa_auth_require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[runtime-qa-auth] required command not found: $1" >&2
    return 1
  }
}

# Resolve one credential pair without placing the password in argv or logs.
# Explicit credentials are accepted only as a complete pair; otherwise both
# fields are read from one Kubernetes Secret and returned through caller-owned
# variable names. The helper never supplies a tracked default password.
carbonet_qa_load_credentials() {
  if (($# < 2 || $# > 6)); then
    echo "[runtime-qa-auth] credential loader requires output variable names and optional explicit pair/Secret/namespace" >&2
    return 2
  fi
  local output_user_var="$1" output_password_var="$2"
  local explicit_user="${3:-}" explicit_password="${4:-}"
  local secret_name="${5:-carbonet-screen-smoke}"
  local namespace="${6:-${K8S_NAMESPACE:-carbonet-prod}}"
  local resolved_user="" resolved_password=""
  [[ "$output_user_var" =~ ^[A-Za-z_][A-Za-z0-9_]*$ && "$output_password_var" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || {
    echo "[runtime-qa-auth] credential output variable name is invalid" >&2
    return 1
  }
  if [[ -n "$explicit_user" || -n "$explicit_password" ]]; then
    if [[ -z "$explicit_user" || -z "$explicit_password" ]]; then
      echo "[runtime-qa-auth] explicit credential pair is incomplete" >&2
      return 1
    fi
    resolved_user="$explicit_user"
    resolved_password="$explicit_password"
  else
    carbonet_qa_auth_require kubectl || return 1
    carbonet_qa_auth_require base64 || return 1
    [[ "$secret_name" =~ ^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$ ]] || {
      echo "[runtime-qa-auth] credential Secret name is invalid" >&2
      return 1
    }
    [[ "$namespace" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]] || {
      echo "[runtime-qa-auth] credential namespace is invalid" >&2
      return 1
    }
    resolved_user="$(kubectl -n "$namespace" get secret "$secret_name" -o jsonpath='{.data.username}' 2>/dev/null | base64 -d 2>/dev/null || true)"
    resolved_password="$(kubectl -n "$namespace" get secret "$secret_name" -o jsonpath='{.data.password}' 2>/dev/null | base64 -d 2>/dev/null || true)"
  fi
  if [[ -z "$resolved_user" || -z "$resolved_password" || "$resolved_user" == *$'\n'* || "$resolved_password" == *$'\n'* ]]; then
    resolved_password=""
    unset resolved_password explicit_password
    echo "[runtime-qa-auth] credential pair is unavailable or malformed" >&2
    return 1
  fi
  printf -v "$output_user_var" '%s' "$resolved_user"
  printf -v "$output_password_var" '%s' "$resolved_password"
  resolved_password=""
  explicit_password=""
  unset resolved_password explicit_password
}

carbonet_qa_auth_acquire_lock() {
  local lock_file="${CARBONET_QA_AUTH_LOCK_FILE:-/tmp/carbonet-qa-auth-session.lock}"
  local timeout_seconds="${CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-60}"
  local lock_fd
  local current_pid="${BASHPID:-$$}"
  if [[ -n "${CARBONET_QA_AUTH_LOCK_FD:-}" ]]; then
    if [[ ! "${CARBONET_QA_AUTH_LOCK_FD:-}" =~ ^[0-9]+$ \
       || ! "${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}" =~ ^[0-9]+$ ]]; then
      echo "[runtime-qa-auth] inherited authentication lock metadata is invalid" >&2
      return 1
    fi
    # A forked child borrows the owner's open file description. Reacquiring
    # that same flock would deadlock, so the inherited descriptor is reused;
    # release remains exclusively owned by the BASHPID that acquired it.
    return 0
  fi
  carbonet_qa_auth_require flock || return 1
  [[ "$timeout_seconds" =~ ^[1-9][0-9]*$ ]] || {
    echo "[runtime-qa-auth] invalid lock timeout" >&2
    return 1
  }
  umask 077
  exec {lock_fd}>"$lock_file" || {
    echo "[runtime-qa-auth] unable to open shared authentication lock" >&2
    return 1
  }
  if ! flock -w "$timeout_seconds" "$lock_fd"; then
    eval "exec ${lock_fd}>&-"
    echo "[runtime-qa-auth] shared authentication lock timed out after ${timeout_seconds}s" >&2
    return 1
  fi
  CARBONET_QA_AUTH_LOCK_FD="$lock_fd"
  CARBONET_QA_AUTH_LOCK_OWNER_BASHPID="$current_pid"
  export CARBONET_QA_AUTH_LOCK_FD CARBONET_QA_AUTH_LOCK_OWNER_BASHPID
}

carbonet_qa_auth_release_lock() {
  local lock_fd="${CARBONET_QA_AUTH_LOCK_FD:-}"
  local lock_owner="${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}"
  local current_pid="${BASHPID:-$$}"
  # flock locks are attached to the shared open file description. A borrowed
  # child's flock -u would therefore unlock the owner's critical section.
  # Keep both inherited variables intact so every later nested acquire in the
  # borrower remains a no-op until the owning process exits.
  if [[ -n "$lock_fd" && "$lock_owner" != "$current_pid" ]]; then
    return 0
  fi
  if [[ "$lock_fd" =~ ^[0-9]+$ ]]; then
    flock -u "$lock_fd" >/dev/null 2>&1 || true
    eval "exec ${lock_fd}>&-"
  fi
  unset CARBONET_QA_AUTH_LOCK_FD CARBONET_QA_AUTH_LOCK_OWNER_BASHPID
}

# Run one complete authenticated verifier lifecycle under the canonical lock.
# The command runs in a child of the lock owner, so a nested call to this helper
# borrows the exported descriptor and cannot deadlock or release its parent.
carbonet_qa_auth_run_serialized() (
  if (($# < 2)); then
    echo "[runtime-qa-auth] serialized lifecycle requires a name and command" >&2
    return 2
  fi
  local lifecycle_name="$1"
  local lifecycle_started lifecycle_status
  shift
  lifecycle_started="$(date +%s)"
  lifecycle_status=0
  if ! carbonet_qa_auth_acquire_lock; then
    echo "[runtime-qa-auth] lifecycle lock failed name=$lifecycle_name" >&2
    return 1
  fi
  trap carbonet_qa_auth_release_lock EXIT
  echo "[runtime-qa-auth] lifecycle lock acquired name=$lifecycle_name" >&2
  "$@" || lifecycle_status=$?
  carbonet_qa_auth_release_lock
  trap - EXIT
  if (( lifecycle_status != 0 )); then
    echo "[runtime-qa-auth] lifecycle failed name=$lifecycle_name status=$lifecycle_status" >&2
  else
    echo "[runtime-qa-auth] lifecycle PASS name=$lifecycle_name duration=$(( $(date +%s) - lifecycle_started ))s"
  fi >&2
  return "$lifecycle_status"
)

carbonet_qa_login() {
  local cookie_jar="$1"
  local base_url="${2%/}"
  local namespace="${K8S_NAMESPACE:-carbonet-prod}"
  local secret_name="${CARBONET_QA_AUTH_SECRET:-carbonet-test-account-switch}"
  local user="${CARBONET_QA_AUTH_USER:-}"
  local password="${CARBONET_QA_AUTH_PASSWORD:-${CARBONET_ACTOR_TEST_PASSWORD:-}}"
  local payload_file="${cookie_jar}.login-payload"
  local response_file="${cookie_jar}.login-response"
  local status

  carbonet_qa_auth_require curl || return 1
  carbonet_qa_auth_require jq || return 1
  if [[ -z "$password" ]]; then
    carbonet_qa_auth_require kubectl || return 1
    carbonet_qa_auth_require base64 || return 1
    if [[ -z "$user" ]]; then
      user="$(kubectl -n "$namespace" get secret "$secret_name" -o jsonpath='{.data.username}' 2>/dev/null | base64 -d || true)"
    fi
    password="$(kubectl -n "$namespace" get secret "$secret_name" -o jsonpath='{.data.password}' 2>/dev/null | base64 -d)"
  fi
  user="${user:-qaassign26}"
  if [[ -z "$user" || -z "$password" ]]; then
    echo "[runtime-qa-auth] isolated QA credential is unavailable" >&2
    return 1
  fi
  if [[ "${user,,}" == "webmaster" ]]; then
    echo "[runtime-qa-auth] primary webmaster login is forbidden; configure an isolated QA account" >&2
    return 1
  fi
  carbonet_qa_auth_acquire_lock || return 1

  umask 077
  if ! printf '%s' "$password" | jq -Rsc --arg id "$user" \
    '{userId:$id,userPw:.,userSe:"USR"}' > "$payload_file"; then
    carbonet_qa_auth_release_lock
    return 1
  fi
  password=
  unset password CARBONET_QA_AUTH_PASSWORD CARBONET_ACTOR_TEST_PASSWORD

  status="$(curl -sS -c "$cookie_jar" -o "$response_file" -w '%{http_code}' \
    -H 'Content-Type: application/json' -X POST "$base_url/signin/actionLogin" \
    --data-binary "@$payload_file")" || status="000"
  rm -f "$payload_file"
  if [[ "$status" != "200" ]] || ! jq -e '(.status // "") == "loginSuccess"' "$response_file" >/dev/null 2>&1; then
    rm -f "$response_file" "$cookie_jar"
    carbonet_qa_auth_release_lock
    echo "[runtime-qa-auth] isolated QA login failed (http=$status)" >&2
    return 1
  fi
  rm -f "$response_file"
  CARBONET_QA_AUTH_EFFECTIVE_USER="$user"
  CARBONET_QA_AUTH_SESSION_ACTIVE=1
  export CARBONET_QA_AUTH_EFFECTIVE_USER
  export CARBONET_QA_AUTH_SESSION_ACTIVE
}

carbonet_qa_logout() {
  local cookie_jar="$1"
  local base_url="${2%/}"
  local response_file="${cookie_jar}.logout-response"
  local status=""
  local result=0
  if [[ "${CARBONET_QA_AUTH_SESSION_ACTIVE:-}" == "1" ]]; then
    if [[ ! -f "$cookie_jar" ]]; then
      echo "[runtime-qa-auth] active QA session cookie jar is missing" >&2
      result=1
    else
      status="$(curl -sS -b "$cookie_jar" -o "$response_file" -w '%{http_code}' \
        -X POST "$base_url/signin/actionLogout")" || status="000"
      # Logout is idempotently complete when the server reports that the
      # short-lived QA session is already unauthenticated.
      if [[ "$status" != "401" ]] && { [[ "$status" != "200" ]] || ! jq -e '(.status // "") == "success"' "$response_file" >/dev/null 2>&1; }; then
        echo "[runtime-qa-auth] isolated QA logout failed (http=$status)" >&2
        result=1
      fi
    fi
  fi
  rm -f "$cookie_jar" "$response_file"
  unset CARBONET_QA_AUTH_EFFECTIVE_USER CARBONET_QA_AUTH_SESSION_ACTIVE
  carbonet_qa_auth_release_lock
  return "$result"
}
