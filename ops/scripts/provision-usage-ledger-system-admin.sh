#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ACCOUNT_ID="qausageadmin26"
ACCOUNT_NAME="QA Usage Ledger Admin"
ACCOUNT_EMAIL="qa-usage-ledger-admin@resonance.invalid"
ACCOUNT_MARKER="AUTOMATION_ONLY"
ACCOUNT_ROLE="ROLE_SYSTEM_ADMIN"
ACCOUNT_ROLE_PRESET="SYSTEM"
ACCOUNT_INSTT="TEST_COMPANY_001"
ACCOUNT_PROJECT="P003"
SECRET_NAME="carbonet-usage-ledger-system-admin"
OPERATOR_SECRET="carbonet-screen-smoke"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
MAINTENANCE_LOCK_FILE="${CARBONET_WEBMASTER_MAINTENANCE_LOCK_FILE:-/tmp/carbonet-webmaster-maintenance.lock}"
MAINTENANCE_LOCK_TIMEOUT="${CARBONET_WEBMASTER_MAINTENANCE_LOCK_TIMEOUT_SECONDS:-300}"

fail() { printf '[usage-ledger-admin-provision] FAIL: %s\n' "$*" >&2; return 1; }
info() { printf '[usage-ledger-admin-provision] %s\n' "$*"; }

decide_state() {
  local account_exists="$1" secret_exists="$2" account_exact="$3" secret_exact="$4"
  if [[ "$account_exists" == 0 && "$secret_exists" == 0 ]]; then printf 'CREATE\n'; return; fi
  if [[ "$account_exists" == 1 && "$secret_exists" == 1 && "$account_exact" == 1 && "$secret_exact" == 1 ]]; then
    printf 'VERIFY\n'; return
  fi
  printf 'BLOCKED\n'
}

self_test() {
  [[ "$(decide_state 0 0 0 0)" == CREATE ]]
  [[ "$(decide_state 1 1 1 1)" == VERIFY ]]
  [[ "$(decide_state 1 0 1 0)" == BLOCKED ]]
  [[ "$(decide_state 0 1 0 1)" == BLOCKED ]]
  [[ "$(decide_state 1 1 0 1)" == BLOCKED ]]
  [[ "$(decide_state 1 1 1 0)" == BLOCKED ]]
  printf '[usage-ledger-admin-provision] self-test PASS states=6 partial=fail-closed mismatch=fail-closed\n'
}

if [[ "${1:-}" == --self-test ]]; then self_test; exit; fi
if [[ "${1:-}" == --help || "${1:-}" == -h ]]; then
  printf 'Usage: bash ops/scripts/provision-usage-ledger-system-admin.sh\n'
  printf 'Creates or verifies the dedicated usage-ledger ROLE_SYSTEM_ADMIN through the normal admin API.\n'
  exit
fi
[[ $# == 0 ]] || { fail "unexpected arguments"; exit 2; }

for command_name in curl jq kubectl openssl flock base64; do
  command -v "$command_name" >/dev/null 2>&1 || { fail "required command unavailable: $command_name"; exit 1; }
done
[[ "$NAMESPACE" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]] || { fail "unsafe Kubernetes namespace"; exit 1; }
[[ "$MAINTENANCE_LOCK_TIMEOUT" =~ ^[1-9][0-9]*$ ]] || { fail "invalid maintenance lock timeout"; exit 1; }

# shellcheck source=ops/scripts/runtime-url-common.sh
source "$ROOT/ops/scripts/runtime-url-common.sh"
# shellcheck source=ops/scripts/runtime-qa-auth-common.sh
source "$ROOT/ops/scripts/runtime-qa-auth-common.sh"
# shellcheck source=ops/scripts/lib/carbonet-postgres-query.sh
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"

BASE_URL="${CARBONET_RUNTIME_BASE_URL:-$(carbonet_runtime_base_url)}"
BASE_URL="${BASE_URL%/}"

provision_locked() (
  set -Eeuo pipefail
  umask 077
  local tmp_dir maintenance_fd maintenance_session_active created_secret_uid secret_create_attempted
  local account_exists secret_exists account_exact secret_exact decision api_status login_status logout_status
  maintenance_fd=""
  tmp_dir="$(mktemp -d /tmp/usage-ledger-admin-provision.XXXXXX)"
  chmod 700 "$tmp_dir"
  maintenance_session_active=0
  created_secret_uid=""
  secret_create_attempted=0

  maintenance_logout() {
    local status body="$tmp_dir/operator-logout.json"
    [[ "$maintenance_session_active" == 1 ]] || return 0
    status="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -b "$tmp_dir/operator.cookies" -o "$body" -w '%{http_code}' \
      -X POST "$BASE_URL/signin/actionLogout")" || status=000
    maintenance_session_active=0
    [[ "$status" == 200 ]] && jq -e '(.status // "") == "success"' "$body" >/dev/null 2>&1
  }

  cleanup() {
    local original_status=$? cleanup_status=0
    trap - EXIT INT TERM
    set +e
    maintenance_logout || cleanup_status=1
    delete_created_secret_if_account_absent || cleanup_status=1
    if [[ "$maintenance_fd" =~ ^[0-9]+$ ]]; then
      flock -u "$maintenance_fd" >/dev/null 2>&1
      eval "exec ${maintenance_fd}>&-"
    fi
    rm -rf "$tmp_dir"
    if (( original_status == 0 && cleanup_status != 0 )); then original_status=1; fi
    exit "$original_status"
  }
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  exec {maintenance_fd}>"$MAINTENANCE_LOCK_FILE"
  flock -w "$MAINTENANCE_LOCK_TIMEOUT" "$maintenance_fd" || fail "webmaster maintenance lock timed out"
  carbonet_set_curl_args
  carbonet_postgres_query_init

  institution_contract="$(carbonet_postgres_query "
    select count(*)::text || '|' ||
           count(*) filter (where project_id='$ACCOUNT_PROJECT' and instt_sttus='P')::text
    from comtninsttinfo
    where trim(instt_id)='$ACCOUNT_INSTT'
  ")"
  [[ "$institution_contract" == '1|1' ]] || {
    fail "dedicated QA institution must exist exactly once with project/status contract"
    exit 1
  }

  snapshot_account() {
    carbonet_postgres_query "
      select coalesce(jsonb_agg(row_data order by row_data->>'role'),'[]'::jsonb)::text
      from (
        select jsonb_build_object(
          'id',lower(e.emplyr_id),'name',e.user_nm,'email',e.email_adres,
          'marker',e.ofcps_nm,'instt',trim(e.instt_id),'org',trim(e.orgnzt_id),
          'group',trim(e.group_id),'status',e.emplyr_sttus_code,'role',s.author_code
        ) row_data
        from comtnemplyrinfo e
        left join comtnemplyrscrtyestbs s on s.scrty_dtrmn_trget_id=e.esntl_id
        where lower(e.emplyr_id)='qausageadmin26'
      ) owned" >"$tmp_dir/account.json"
  }

  snapshot_secret() {
    if kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" -o json >"$tmp_dir/secret.json" 2>"$tmp_dir/secret.err"; then
      secret_exists=1
    else
      secret_exists=0
      : >"$tmp_dir/secret.json"
    fi
  }

  evaluate_state() {
    snapshot_account
    snapshot_secret
    account_exists="$(jq -r 'if length==0 then 0 else 1 end' "$tmp_dir/account.json")"
    account_exact=0
    secret_exact=0
    jq -e --arg id "$ACCOUNT_ID" --arg name "$ACCOUNT_NAME" --arg email "$ACCOUNT_EMAIL" \
      --arg marker "$ACCOUNT_MARKER" --arg instt "$ACCOUNT_INSTT" --arg role "$ACCOUNT_ROLE" '
        length==1 and .[0].id==($id|ascii_downcase) and .[0].name==$name and .[0].email==$email and
        .[0].marker==$marker and .[0].instt==$instt and .[0].org==$instt and .[0].group==$instt and
        .[0].status=="P" and .[0].role==$role
      ' "$tmp_dir/account.json" >/dev/null 2>&1 && account_exact=1
    if [[ "$secret_exists" == 1 ]]; then
      jq -e --arg id "$ACCOUNT_ID" --arg purpose usage-ledger-system-admin '
        .type=="Opaque" and .metadata.labels["app.kubernetes.io/managed-by"]=="resonance-qa-provisioner" and
        .metadata.labels["resonance.ai/purpose"]==$purpose and .metadata.labels["resonance.ai/account-id"]==$id and
        (.data.username|@base64d)==$id and (.data.password|type=="string" and length>0)
      ' "$tmp_dir/secret.json" >/dev/null 2>&1 && secret_exact=1
    fi
    decision="$(decide_state "$account_exists" "$secret_exists" "$account_exact" "$secret_exact")"
  }

  delete_created_secret_if_account_absent() {
    local current_uid current_account_exists
    [[ "$secret_create_attempted" == 1 || -n "$created_secret_uid" ]] || return 0
    snapshot_account || return 1
    current_account_exists="$(jq -r 'if length==0 then 0 else 1 end' "$tmp_dir/account.json")"
    # Once the normal API has durably created the exact account, retaining the
    # owned Secret is the only retry-safe state. Cleanup only owns the orphan
    # account=0/Secret=1 case.
    [[ "$current_account_exists" == 0 ]] || return 0
    kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" -o json >"$tmp_dir/rollback-secret.json" 2>/dev/null || return 0
    current_uid="$(jq -r '.metadata.uid // empty' "$tmp_dir/rollback-secret.json")"
    [[ "$current_uid" =~ ^[A-Za-z0-9-]+$ ]] || return 1
    [[ -z "$created_secret_uid" || "$current_uid" == "$created_secret_uid" ]] || return 1
    jq -e --arg uid "$current_uid" --arg id "$ACCOUNT_ID" '
      .metadata.uid==$uid and .metadata.labels["app.kubernetes.io/managed-by"]=="resonance-qa-provisioner" and
      .metadata.labels["resonance.ai/purpose"]=="usage-ledger-system-admin" and
      .metadata.labels["resonance.ai/account-id"]==$id and (.data.username|@base64d)==$id
    ' "$tmp_dir/rollback-secret.json" >/dev/null || return 1
    jq -n --arg uid "$current_uid" '{apiVersion:"v1",kind:"DeleteOptions",preconditions:{uid:$uid}}' >"$tmp_dir/delete-options.json"
    kubectl delete --raw "/api/v1/namespaces/$NAMESPACE/secrets/$SECRET_NAME" -f "$tmp_dir/delete-options.json" >/dev/null
    created_secret_uid=""
    secret_create_attempted=0
  }

  verify_target_runtime() {
    local cookie="$tmp_dir/target.cookies" session="$tmp_dir/target-session.json" report="$tmp_dir/target-report.json"
    local status result=0
    export CARBONET_QA_AUTH_SECRET="$SECRET_NAME"
    export K8S_NAMESPACE="$NAMESPACE"
    unset CARBONET_QA_AUTH_USER CARBONET_QA_AUTH_PASSWORD CARBONET_ACTOR_TEST_PASSWORD
    carbonet_qa_login "$cookie" "$BASE_URL" || return 1
    status="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -b "$cookie" -c "$cookie" -o "$session" -w '%{http_code}' \
      "$BASE_URL/api/frontend/session")" || status=000
    [[ "$status" == 200 ]] && jq -e --arg id "$ACCOUNT_ID" --arg role "$ACCOUNT_ROLE" '
      .authenticated==true and ((.actualUserId // .userId // "")|ascii_downcase)==($id|ascii_downcase) and .authorCode==$role
    ' "$session" >/dev/null || result=1
    status="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -b "$cookie" -c "$cookie" -o "$report" -w '%{http_code}' \
      "$BASE_URL/admin/api/system/actor-process/system-test-report?compact=true&page=0&size=1")" || status=000
    [[ "$status" == 200 ]] && jq -e '.success==true and .compact==true and (.items|type)=="array"' "$report" >/dev/null || result=1
    carbonet_qa_logout "$cookie" "$BASE_URL" || result=1
    return "$result"
  }

  evaluate_state
  if [[ "$decision" == BLOCKED ]]; then
    fail "account/Secret partial state or ownership mismatch; refusing mutation"
    exit 1
  fi
  if [[ "$decision" == VERIFY ]]; then
    verify_target_runtime || { fail "exact existing principal failed login/report verification"; exit 1; }
    info "PASS mode=no-op account=$ACCOUNT_ID role=$ACCOUNT_ROLE status=P report=200"
    exit 0
  fi

  # Recheck after both locks before creating either resource.
  evaluate_state
  [[ "$decision" == CREATE ]] || { fail "state changed while acquiring provisioning locks"; exit 1; }

  : >"$tmp_dir/target-password"
  for _ in $(seq 1 20); do
    openssl rand -base64 36 | tr -d '\r\n' >"$tmp_dir/target-password"
    if grep -q '[a-z]' "$tmp_dir/target-password" && grep -q '[A-Z]' "$tmp_dir/target-password" \
      && grep -q '[0-9]' "$tmp_dir/target-password" && grep -q '[+/=]' "$tmp_dir/target-password"; then break; fi
  done
  [[ -s "$tmp_dir/target-password" ]] && grep -q '[a-z]' "$tmp_dir/target-password" \
    && grep -q '[A-Z]' "$tmp_dir/target-password" && grep -q '[0-9]' "$tmp_dir/target-password" \
    && grep -q '[+/=]' "$tmp_dir/target-password" || { fail "strong password generation failed"; exit 1; }
  printf '%s' "$ACCOUNT_ID" >"$tmp_dir/target-username"
  kubectl -n "$NAMESPACE" create secret generic "$SECRET_NAME" \
    --from-file=username="$tmp_dir/target-username" --from-file=password="$tmp_dir/target-password" \
    --dry-run=client -o json \
    | jq --arg id "$ACCOUNT_ID" '.metadata.labels={"app.kubernetes.io/managed-by":"resonance-qa-provisioner","resonance.ai/purpose":"usage-ledger-system-admin","resonance.ai/account-id":$id}' \
    >"$tmp_dir/secret-create.json"
  secret_create_attempted=1
  kubectl -n "$NAMESPACE" create -f "$tmp_dir/secret-create.json" >/dev/null
  created_secret_uid="$(kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" -o jsonpath='{.metadata.uid}')"
  [[ "$created_secret_uid" =~ ^[A-Za-z0-9-]+$ ]] || { fail "created Secret UID is invalid"; exit 1; }
  if [[ "${CARBONET_QA_PROVISION_FAULT_AFTER_SECRET_CREATE:-0}" == 1 ]]; then
    fail 'injected failure after Secret creation'
    exit 97
  fi

  kubectl -n "$NAMESPACE" get secret "$OPERATOR_SECRET" -o json >"$tmp_dir/operator-secret.json"
  jq -e '(.data.username|@base64d|ascii_downcase)=="webmaster" and (.data.password|length)>0' \
    "$tmp_dir/operator-secret.json" >/dev/null || { delete_created_secret_if_account_absent; fail "maintenance operator Secret contract mismatch"; exit 1; }
  jq -j '.data.password|@base64d' "$tmp_dir/operator-secret.json" >"$tmp_dir/operator-password"
  jq -Rs '{userId:"webmaster",userPw:.,userSe:"USR"}' "$tmp_dir/operator-password" >"$tmp_dir/operator-login.json"
  login_status="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -c "$tmp_dir/operator.cookies" -o "$tmp_dir/operator-login-response.json" \
    -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE_URL/signin/actionLogin" \
    --data-binary @"$tmp_dir/operator-login.json")" || login_status=000
  if [[ "$login_status" != 200 ]] || ! jq -e '.status=="loginSuccess" and (.userId|ascii_downcase)=="webmaster"' \
    "$tmp_dir/operator-login-response.json" >/dev/null 2>&1; then
    delete_created_secret_if_account_absent || true
    fail "maintenance operator login failed (http=$login_status)"
    exit 1
  fi
  maintenance_session_active=1

  jq -Rs --arg id "$ACCOUNT_ID" --arg name "$ACCOUNT_NAME" --arg email "$ACCOUNT_EMAIL" \
    --arg marker "$ACCOUNT_MARKER" --arg instt "$ACCOUNT_INSTT" '
      {rolePreset:"SYSTEM",adminId:$id,adminName:$name,password:.,passwordConfirm:.,adminEmail:$email,
       phone1:"010",phone2:"0000",phone3:"0026",deptNm:$marker,insttId:$instt,zip:"000000",
       adres:"QA AUTOMATION",detailAdres:"USAGE LEDGER",featureCodes:[]}
    ' "$tmp_dir/target-password" >"$tmp_dir/admin-create.json"
  api_status="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -b "$tmp_dir/operator.cookies" -c "$tmp_dir/operator.cookies" \
    -o "$tmp_dir/admin-create-response.json" -w '%{http_code}' -H 'Content-Type: application/json' \
    -X POST "$BASE_URL/admin/api/admin/member/admin-account" --data-binary @"$tmp_dir/admin-create.json")" || api_status=000
  if [[ "$api_status" != 200 ]] || ! jq -e --arg id "$ACCOUNT_ID" --arg role "$ACCOUNT_ROLE" --arg instt "$ACCOUNT_INSTT" '
    .success==true and .emplyrId==$id and .authorCode==$role and .insttId==$instt
  ' "$tmp_dir/admin-create-response.json" >/dev/null 2>&1; then
    maintenance_logout || true
    delete_created_secret_if_account_absent || true
    fail "normal admin create API failed (http=$api_status)"
    exit 1
  fi
  maintenance_logout || { fail "maintenance operator logout failed"; exit 1; }

  evaluate_state
  [[ "$decision" == VERIFY ]] || { fail "created principal failed exact DB/Secret postcondition"; exit 1; }
  verify_target_runtime || { fail "created principal failed login/report verification"; exit 1; }
  created_secret_uid=""
  secret_create_attempted=0
  info "PASS mode=created account=$ACCOUNT_ID role=$ACCOUNT_ROLE status=P report=200"
)

export CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS="${CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-300}"
carbonet_qa_auth_run_serialized usage-ledger-system-admin-provision provision_locked
