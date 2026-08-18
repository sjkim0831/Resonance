#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
DEPLOY="$ROOT/ops/scripts/resonance-backstage-deploy.sh"
AUTO_DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"
PLANNER="$ROOT/ops/scripts/plan-incremental-work.sh"
FAST_POLICY="$ROOT/ops/scripts/test-backstage-fast-deploy-policy.sh"
FIXED_ACTOR_REF="service:default/project-runtime-purge-recovery"

contract_path='ops/scripts/test-backstage-runtime-purge-recovery-secret.sh'
[[ "$(grep -Fc "$contract_path" "$AUTO_DEPLOY")" -ge 2 ]]
grep -Fq "$contract_path" "$PLANNER"
grep -Fq 'test-backstage-runtime-purge-recovery-secret.sh" "$ROOT"' "$FAST_POLICY"

function_source="$(sed -n '/^ensure_runtime_purge_recovery_secret() {/,/^}$/p' "$DEPLOY")"
[[ -n "$function_source" ]]
secret_apply_source="$(sed -n '/^apply_backstage_secret_from_values() {/,/^}$/p' "$DEPLOY")"
[[ -n "$secret_apply_source" ]]
grep -Fq 'bootstrap_secret_name="resonance-keycloak-integrated-admin"' \
  <<<"$function_source"
grep -Fq '{.data.USERNAME}' <<<"$function_source"
if grep -Fq 'PASSWORD' <<<"$function_source"; then
  echo '[backstage-runtime-purge-secret] recovery bootstrap must never read a password key' >&2
  exit 1
fi
eval "$secret_apply_source"
eval "$function_source"

fixture="$(mktemp -d)"
trap 'rm -rf -- "$fixture"' EXIT
record="$fixture/kubectl.record"
created="$fixture/created.tsv"
password_access="$fixture/password-access"
stdout_log="$fixture/stdout.log"
stderr_log="$fixture/stderr.log"
NAMESPACE=fixture-ops
export NAMESPACE

DEDICATED_EXISTS=false
DEDICATED_ACCOUNT=''
DEDICATED_ACTOR=''
INTEGRATED_EXISTS=false
INTEGRATED_USERNAME=''
LOOKUP_ERROR_SECRET=''
FIXTURE_PASSWORD='must-never-be-read-or-printed'

emit_base64() {
  printf '%s' "$1" | base64 | tr -d '\n'
}

kubectl() {
  local command name selector='' account='' actor='' argument expect_output=false
  if [[ "${1:-}" == -n ]]; then
    [[ "${2:-}" == "$NAMESPACE" ]]
    shift 2
  fi
  command="${1:-}"
  shift || true
  case "$command" in
    get)
      [[ "${1:-}" == secret ]]
      name="${2:-}"
      shift 2
      while (($#)); do
        case "$1" in
          --ignore-not-found) ;;
          -o)
            shift
            selector="${1:-}"
            expect_output=true
            ;;
          *) return 2 ;;
        esac
        shift || true
      done
      [[ "$expect_output" == true && "$selector" == jsonpath=* ]]
      printf 'read\t%s\t%s\n' "$name" "$selector" >>"$record"
      if [[ "$LOOKUP_ERROR_SECRET" == "$name" ]]; then
        echo 'Unable to connect to the server: fixture timeout' >&2
        return 42
      fi
      if [[ "$selector" == *PASSWORD* ]]; then
        : >"$password_access"
        emit_base64 "$FIXTURE_PASSWORD"
        return 0
      fi
      case "$name" in
        resonance-runtime-purge-recovery)
          [[ "$DEDICATED_EXISTS" == true ]] || return 0
          printf '%s|' "$name"
          emit_base64 "$DEDICATED_ACCOUNT"
          printf '|'
          emit_base64 "$DEDICATED_ACTOR"
          ;;
        resonance-keycloak-integrated-admin)
          [[ "$INTEGRATED_EXISTS" == true ]] || return 0
          [[ "$selector" == *USERNAME* ]] || return 2
          printf '%s|' "$name"
          emit_base64 "$INTEGRATED_USERNAME"
          ;;
        *) return 2 ;;
      esac
      ;;
    create)
      [[ "${1:-}" == secret && "${2:-}" == generic \
        && "${3:-}" == resonance-runtime-purge-recovery ]]
      for argument in "$@"; do
        case "$argument" in
          --from-literal=RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID=*)
            account="${argument#--from-literal=RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID=}" ;;
          --from-literal=RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF=*)
            actor="${argument#--from-literal=RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF=}" ;;
        esac
      done
      printf 'mutation\tcreate\n' >>"$record"
      printf '%s\t%s\n' "$account" "$actor" >"$created"
      printf 'apiVersion: v1\nkind: Secret\n'
      ;;
    apply)
      [[ "${1:-}" == -f && "${2:-}" == - ]]
      node -e '
        const chunks = [];
        process.stdin.on("data", chunk => chunks.push(chunk));
        process.stdin.on("end", () => {
          const object = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const data = object && object.data;
          if (object?.kind !== "Secret" || object?.metadata?.name !== "resonance-runtime-purge-recovery" ||
              object?.metadata?.namespace !== process.env.NAMESPACE || !data) process.exit(2);
          const account = Buffer.from(data.RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID || "", "base64").toString("utf8");
          const actor = Buffer.from(data.RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF || "", "base64").toString("utf8");
          process.stdout.write(`${account}\t${actor}\n`);
        });
      ' >"$created"
      printf 'mutation\tapply\n' >>"$record"
      ;;
    *) return 2 ;;
  esac
}

reset_fixture() {
  : >"$record"
  rm -f -- "$created" "$password_access" "$stdout_log" "$stderr_log"
  DEDICATED_EXISTS=false
  DEDICATED_ACCOUNT=''
  DEDICATED_ACTOR=''
  INTEGRATED_EXISTS=false
  INTEGRATED_USERNAME=''
  LOOKUP_ERROR_SECRET=''
  unset RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID
  unset RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF
}

assert_no_password_access() {
  [[ ! -e "$password_access" ]]
  ! grep -Fq "$FIXTURE_PASSWORD" "$record" "$stdout_log" "$stderr_log" 2>/dev/null
}

assert_success() {
  local label="$1" expected_account="$2" expected_actor="$3"
  if ! ensure_runtime_purge_recovery_secret >"$stdout_log" 2>"$stderr_log"; then
    echo "[backstage-runtime-purge-secret] expected success: $label" >&2
    cat "$stderr_log" >&2
    exit 1
  fi
  if [[ -s "$stdout_log" || -s "$stderr_log" ]]; then
    echo "[backstage-runtime-purge-secret] unexpected output: $label" >&2
    cat "$stdout_log" "$stderr_log" >&2
    exit 1
  fi
  [[ "$(grep -c $'^mutation\t' "$record" || true)" == 1 ]] || {
    echo "[backstage-runtime-purge-secret] unexpected mutation count: $label" >&2
    exit 1
  }
  [[ "$(cat "$created")" == "$expected_account"$'\t'"$expected_actor" ]] || {
    echo "[backstage-runtime-purge-secret] created identity mismatch: $label" >&2
    exit 1
  }
  assert_no_password_access
}

assert_failure() {
  local label="$1" expected_error="$2" status
  set +e
  ensure_runtime_purge_recovery_secret >"$stdout_log" 2>"$stderr_log"
  status=$?
  set -e
  [[ "$status" == 1 ]] || {
    echo "[backstage-runtime-purge-secret] expected status 1: $label status=$status" >&2
    exit 1
  }
  [[ ! -s "$stdout_log" ]]
  [[ "$(cat "$stderr_log")" == "$expected_error" ]]
  [[ "$(grep -c $'^mutation\t' "$record" || true)" == 0 ]]
  [[ ! -e "$created" ]]
  assert_no_password_access
}

assert_lookup_failure() {
  local label="$1" expected_error="$2" status
  set +e
  ensure_runtime_purge_recovery_secret >"$stdout_log" 2>"$stderr_log"
  status=$?
  set -e
  [[ "$status" == 1 ]] || {
    echo "[backstage-runtime-purge-secret] expected lookup status 1: $label status=$status" >&2
    exit 1
  }
  [[ ! -s "$stdout_log" ]]
  grep -Fq 'Unable to connect to the server: fixture timeout' "$stderr_log"
  grep -Fq "$expected_error" "$stderr_log"
  ! grep -Fq "$account_error" "$stderr_log"
  [[ "$(grep -c $'^mutation\t' "$record" || true)" == 0 ]]
  [[ ! -e "$created" ]]
  assert_no_password_access
}

account_error='[backstage] runtime purge recovery account secret is required'
actor_error='[backstage] runtime purge recovery actor ref is invalid'

# 1. The already dedicated Secret is authoritative over both lower-priority sources.
reset_fixture
DEDICATED_EXISTS=true
DEDICATED_ACCOUNT='dedicated.admin'
DEDICATED_ACTOR='service:default/dedicated-recovery'
INTEGRATED_EXISTS=true
INTEGRATED_USERNAME='integrated.admin'
RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID='environment.admin'
RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF='service:default/environment-recovery'
assert_success dedicated-precedence "$DEDICATED_ACCOUNT" "$DEDICATED_ACTOR"
! grep -Fq $'read\tresonance-keycloak-integrated-admin\t' "$record"

# 2. When the dedicated Secret is absent, an explicit account binding wins.
reset_fixture
INTEGRATED_EXISTS=true
INTEGRATED_USERNAME='integrated.admin'
RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID='environment.admin'
RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF='service:default/environment-recovery'
assert_success environment-precedence "$RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID" \
  "$RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF"
! grep -Fq $'read\tresonance-keycloak-integrated-admin\t' "$record"

# 3. An explicit account may omit the actor and receive the fixed service actor.
reset_fixture
INTEGRATED_EXISTS=true
INTEGRATED_USERNAME='integrated.admin'
RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID='environment.admin'
assert_success environment-default-actor "$RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID" \
  "$FIXED_ACTOR_REF"

# 4. Only with both higher-priority bindings absent is USERNAME bootstrapped.
reset_fixture
INTEGRATED_EXISTS=true
INTEGRATED_USERNAME='integrated.admin'
RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF='service:default/must-be-ignored'
assert_success integrated-username-fallback "$INTEGRATED_USERNAME" "$FIXED_ACTOR_REF"
grep -F $'read\tresonance-keycloak-integrated-admin\t' "$record" | grep -Fq '{.data.USERNAME}'

# 5-9. Missing/malformed higher-priority bindings fail closed without mutation
# or fallback privilege escalation.
reset_fixture
assert_failure missing-bootstrap "$account_error"

reset_fixture
INTEGRATED_EXISTS=true
INTEGRATED_USERNAME='invalid account'
assert_failure malformed-bootstrap "$account_error"

reset_fixture
DEDICATED_EXISTS=true
DEDICATED_ACCOUNT='invalid account'
DEDICATED_ACTOR="$FIXED_ACTOR_REF"
INTEGRATED_EXISTS=true
INTEGRATED_USERNAME='integrated.admin'
RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID='environment.admin'
assert_failure malformed-dedicated "$account_error"
! grep -Fq $'read\tresonance-keycloak-integrated-admin\t' "$record"

reset_fixture
INTEGRATED_EXISTS=true
INTEGRATED_USERNAME='integrated.admin'
RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID='invalid account'
assert_failure malformed-environment "$account_error"
! grep -Fq $'read\tresonance-keycloak-integrated-admin\t' "$record"

reset_fixture
INTEGRATED_EXISTS=true
INTEGRATED_USERNAME='integrated.admin'
RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID=''
assert_failure empty-explicit-environment "$account_error"
! grep -Fq $'read\tresonance-keycloak-integrated-admin\t' "$record"

# 10. Actor validation also precedes every Kubernetes mutation.
reset_fixture
DEDICATED_EXISTS=true
DEDICATED_ACCOUNT='dedicated.admin'
DEDICATED_ACTOR='INVALID ACTOR'
assert_failure malformed-actor "$actor_error"

# 11-12. API/RBAC/transport errors are not absence: they preserve the original
# diagnostic, never descend to a lower-priority identity, and never mutate.
reset_fixture
LOOKUP_ERROR_SECRET='resonance-runtime-purge-recovery'
INTEGRATED_EXISTS=true
INTEGRATED_USERNAME='integrated.admin'
RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID='environment.admin'
assert_lookup_failure dedicated-lookup-error \
  '[backstage] runtime purge recovery secret lookup failed'
! grep -Fq $'read\tresonance-keycloak-integrated-admin\t' "$record"

reset_fixture
LOOKUP_ERROR_SECRET='resonance-keycloak-integrated-admin'
assert_lookup_failure bootstrap-lookup-error \
  '[backstage] runtime purge recovery bootstrap lookup failed'

echo 'BACKSTAGE_RUNTIME_PURGE_SECRET_PASS cases=12 precedence=dedicated>env>username lookupErrors=2 passwordReads=0 invalidMutations=0'
