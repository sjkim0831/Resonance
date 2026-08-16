#!/usr/bin/env bash
set -Eeuo pipefail

# Fail-closed postdeploy gate for composite design autocompletion.  This script
# never prints credentials and never turns the scheduler on until a measured
# physical p95 proves that all currently compiler-ready processes fit in 600s.
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${CARBONET_NAMESPACE:-carbonet-prod}"
BRIDGE_SECRET="${CARBONET_COMPOSITE_BRIDGE_SECRET:-resonance-ops-bridge}"
TOKEN_FILE="${CARBONET_COMPOSITE_TOKEN_FILE:-/etc/resonance/secrets/composite-live-smoke.env}"
ENABLE_MARKER="${CARBONET_COMPOSITE_ENABLE_MARKER:-/etc/resonance/state/composite-autocompletion-approval.json}"
ACTOR_ENV_FILE="${CARBONET_ACTOR_TEST_ENV_FILE:-/opt/carbonet-data/config/actor-test.env}"
RUNTIME_BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
POSTDEPLOY_CANDIDATE_ID="${CARBONET_POSTDEPLOY_CANDIDATE_ID:-}"
EXPECTED_RUNTIME_COMMIT="${CARBONET_COMPOSITE_EXPECTED_RUNTIME_COMMIT:-}"
CAMPAIGN_TIMEOUT_SECONDS="${CARBONET_COMPOSITE_CAMPAIGN_TIMEOUT_SECONDS:-720}"
CAMPAIGN_POLL_SECONDS="${CARBONET_COMPOSITE_CAMPAIGN_POLL_SECONDS:-5}"
ACTOR_CODE="COMPOSITE_AUTOCOMPLETION_POSTDEPLOY"
campaign_prepared=false

fail(){ printf '[composite-autocompletion-postdeploy] FAIL %s\n' "$1" >&2; exit 2; }

secret_value_from_file(){
  local file="$1" key="$2" line value
  [[ -f "$file" && ! -L "$file" ]] || return 1
  line="$(grep -E "^${key}=[^[:space:]]+$" "$file" 2>/dev/null | tail -n 1)"
  [[ -n "$line" ]] || return 1
  value="${line#*=}"
  [[ -n "$value" && "$value" != *$'\n'* && "$value" != *$'\r'* ]] || return 1
  printf '%s' "$value"
}

require_exact_denied_account_count(){
  [[ "${1:-}" =~ ^[0-9]+$ && "$1" == 1 ]]
}

campaign_runtime_superseded(){
  [[ "${1:-}" == campaign && "${2:-}" =~ ^[0-9a-f]{40}$ \
     && "${2:-}" != "${3:-}" ]]
}

skip_superseded_campaign(){
  local mode="${1:-}" observed="${2:-}" expected="${3:-}"
  campaign_runtime_superseded "$mode" "$observed" "$expected" || return 1
  printf '[composite-autocompletion-postdeploy] SKIP superseded campaign expected=%s observed=%s\n' \
    "$expected" "$observed"
}

inspection_allows_enable(){
  python3 -c 'import json,sys
x=json.loads(sys.argv[1])
assert x.get("success") is True and x.get("dryRun") is True
assert x.get("runtimeCommit")==sys.argv[2]
assert x.get("currentAuthoritySetHash")==sys.argv[3]
assert x.get("currentSourceInputAuthorityHash")==sys.argv[3]
assert x.get("currentFinalAuthoritySetHash")==x.get("currentVerifiedCanaryFinalAuthorityHash")
assert x.get("capabilityEnabled") is True
assert x.get("tenMinuteTarget")=="PASS" and x.get("estimatedTotalSeconds",600)<600
assert x.get("physicalSampleCount")==1 and x.get("currentVerifiedCanaryCount")==1
assert x.get("activeCanaryCount")==0 and x.get("currentVerifiedCanaryJobId",0)>0
assert x.get("preflightComplete") is True and x.get("preflightStable") is True
assert x.get("preflightTimedOutCount")==0 and x.get("preflightFailureCount")==0
assert x.get("preflightBusy") is False
assert x.get("quiescentForGateTransition") is True
assert x.get("preflightCheckedCount")==x.get("preflightCandidateCount")
assert 0<=x.get("preflightLatencyMs",15001)<=15000
assert x.get("requiredParallelism",10**9)<=x.get("liveSmokeParallelism",0)' \
    "$1" "${2:-}" "${3:-}" 2>/dev/null
}

inspection_confirms_enabled(){
  python3 -c 'import json,sys
x=json.loads(sys.argv[1])
assert x.get("success") is True and x.get("dryRun") is True and x.get("enabled") is True
assert x.get("runtimeCommit")==sys.argv[2] and x.get("gateRuntimeCommit")==sys.argv[2]
assert x.get("gatePostdeployCandidateId")==sys.argv[4]
assert x.get("currentAuthoritySetHash")==sys.argv[3]
assert x.get("gateStatus")=="ACTIVE" and x.get("approvalBindingCurrent") is True
assert x.get("releaseFinalized") is True
assert x.get("gateSourceInputAuthorityHash")==sys.argv[3]
assert x.get("gateSourceInputAuthorityHash")==x.get("currentVerifiedCanarySourceInputAuthorityHash")
assert x.get("gateFinalAuthorityHash")==x.get("currentVerifiedCanaryFinalAuthorityHash")
assert x.get("gateCanaryProcessCode")==x.get("currentVerifiedCanaryProcessCode")
assert x.get("gateCanaryJobId")==x.get("currentVerifiedCanaryJobId")
assert x.get("currentVerifiedCanaryCount")==1 and x.get("activeCanaryCount")==0
assert x.get("preflightComplete") is True and x.get("preflightStable") is True
assert x.get("preflightTimedOutCount")==0
assert x.get("automaticEnablementAllowed") is True' "$1" "$2" "$3" "${4:-}" 2>/dev/null
}

inspection_confirms_prepared(){
  python3 -c 'import json,sys
x=json.loads(sys.argv[1])
assert x.get("success") is True and x.get("dryRun") is True and x.get("enabled") is False
assert x.get("runtimeCommit")==sys.argv[2] and x.get("gateRuntimeCommit")==sys.argv[2]
assert x.get("gatePostdeployCandidateId")==sys.argv[4]
assert x.get("currentAuthoritySetHash")==sys.argv[3]
assert x.get("gateStatus")=="PREPARED" and x.get("preparedBindingCurrent") is True
assert x.get("approvalBindingCurrent") is False and x.get("automaticEnablementAllowed") is False
assert x.get("gateSourceInputAuthorityHash")==sys.argv[3]
assert x.get("gateFinalAuthorityHash")==x.get("currentVerifiedCanaryFinalAuthorityHash")
assert x.get("gateCanaryProcessCode")==x.get("currentVerifiedCanaryProcessCode")
assert x.get("gateCanaryJobId")==x.get("currentVerifiedCanaryJobId")
assert x.get("currentVerifiedCanaryCount")==1 and x.get("activeCanaryCount")==0' \
    "$1" "$2" "$3" "${4:-}" 2>/dev/null
}

audit_marker_matches(){
  local state="$1" runtime_commit="$2" authority_hash="$3"
  python3 -c 'import json,sys
x=json.loads(sys.argv[1])
assert x.get("schema")=="carbonet.composite-autocompletion-approval/v1"
assert x.get("runtimeCommit")==sys.argv[2] and x.get("authoritySetHash")==sys.argv[3]
assert x.get("decision")=="MEASURED_PASS"' "$state" "$runtime_commit" "$authority_hash" 2>/dev/null
}

if [[ "${COMPOSITE_AUTOCOMPLETION_LIBRARY_ONLY:-false}" == true ]]; then
  return 0 2>/dev/null || exit 0
fi

mode="${1:-preflight}"
[[ "$mode" == preflight || "$mode" == canary || "$mode" == enable ||
   "$mode" == activate || "$mode" == revoke || "$mode" == revoke-prepared ||
   "$mode" == revoke-candidate || "$mode" == reconcile || "$mode" == campaign ]] ||
  fail 'mode must be preflight, canary, enable, activate, revoke-prepared, revoke-candidate, revoke, reconcile, or campaign'
if [[ "$mode" == enable || "$mode" == activate || "$mode" == reconcile ||
      "$mode" == revoke-prepared || "$mode" == revoke-candidate ||
      "$mode" == campaign ]]; then
  [[ "$POSTDEPLOY_CANDIDATE_ID" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] ||
    fail 'exact postdeploy candidate identity is required'
fi
if [[ "$mode" == campaign ]]; then
  [[ "$EXPECTED_RUNTIME_COMMIT" =~ ^[0-9a-f]{40}$ ]] ||
    fail 'exact expected runtime commit is required for the asynchronous campaign'
  [[ "$CAMPAIGN_TIMEOUT_SECONDS" =~ ^[0-9]+$ \
     && "$CAMPAIGN_TIMEOUT_SECONDS" -ge 30 \
     && "$CAMPAIGN_TIMEOUT_SECONDS" -le 900 ]] ||
    fail 'campaign timeout must be an integer from 30 through 900 seconds'
  [[ "$CAMPAIGN_POLL_SECONDS" =~ ^[0-9]+$ \
     && "$CAMPAIGN_POLL_SECONDS" -ge 1 \
     && "$CAMPAIGN_POLL_SECONDS" -le 30 ]] ||
    fail 'campaign poll interval must be an integer from 1 through 30 seconds'
fi
for command in kubectl base64 curl jq python3; do
  command -v "$command" >/dev/null 2>&1 || fail "required command unavailable: $command"
done
if [[ "$mode" == campaign ]]; then
  early_runtime_commit="$(kubectl -n "$NAMESPACE" get deployment/carbonet-runtime \
    -o 'jsonpath={.metadata.annotations.resonance\.ai/target-commit}' 2>/dev/null || true)"
  if skip_superseded_campaign "$mode" "$early_runtime_commit" \
      "$EXPECTED_RUNTIME_COMMIT"; then
    exit 0
  fi
fi
[[ -r "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh" ]] ||
  fail 'PostgreSQL read-only adapter unavailable'

# Decode only into a private temporary file, then atomically rename a 0600
# host-owned file.  Neither kubectl output nor the decoded value reaches logs.
umask 077
token_tmp="$(mktemp)"
next_file="${TOKEN_FILE}.next.$$"
marker_tmp=""
cleanup(){
  local original_status=$?
  trap - EXIT
  set +e
  rm -f "$token_tmp" ${marker_tmp:+"$marker_tmp"}
  sudo -n rm -f "$next_file" "${ENABLE_MARKER}.next.$$" >/dev/null 2>&1 || true
  if ((original_status!=0)) && [[ "${campaign_prepared:-false}" == true ]] \
      && declare -F inspect >/dev/null 2>&1 \
      && declare -F revoke_prepared_gate >/dev/null 2>&1; then
    inspection="$(inspect 2>/dev/null || true)"
    [[ -z "$inspection" ]] || revoke_prepared_gate CAMPAIGN_ACTIVATION_FAILED \
      >/dev/null 2>&1 || true
  fi
  return "$original_status"
}
trap cleanup EXIT
if ! kubectl -n "$NAMESPACE" get secret "$BRIDGE_SECRET" \
    -o 'jsonpath={.data.RESONANCE_OPS_TOKEN}' 2>/dev/null | base64 -d >"$token_tmp"; then
  fail 'Kubernetes bridge token unavailable'
fi
token="$(tr -d '\r\n' <"$token_tmp")"
[[ -n "$token" && ${#token} -le 4096 && "$token" =~ ^[A-Za-z0-9._~:/+=-]+$ ]] ||
  fail 'Kubernetes bridge token invalid'
printf 'RESONANCE_OPS_TOKEN=%s\n' "$token" >"$token_tmp"
sudo -n install -d -m 0750 -o root -g sjkim "$(dirname "$TOKEN_FILE")"
sudo -n install -m 0600 -o sjkim -g sjkim "$token_tmp" "$next_file"
sudo -n mv -f "$next_file" "$TOKEN_FILE"
sudo -n test -f "$TOKEN_FILE" && ! sudo -n test -L "$TOKEN_FILE" ||
  fail 'host bridge token publication failed'
[[ "$(sudo -n stat -c '%a:%U:%G' "$TOKEN_FILE")" == 600:sjkim:sjkim ]] ||
  fail 'host bridge token ownership or mode is not sjkim:0600'

# shellcheck source=ops/scripts/lib/carbonet-postgres-query.sh
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
denied_count="$(carbonet_postgres_query "
with active_identity_row as (
  select lower(account.emplyr_id) account_key,account.emplyr_id account_id,
         'EMPLOYEE:'||account.esntl_id identity_key,security.author_code
    from comtnemplyrinfo account join comtnemplyrscrtyestbs security
      on security.scrty_dtrmn_trget_id=account.esntl_id
   where upper(coalesce(account.emplyr_sttus_code,'')) in('P','A')
  union all
  select lower(account.entrprs_mber_id),account.entrprs_mber_id,
         'ENTERPRISE:'||account.esntl_id,security.author_code
    from comtnentrprsmber account join comtnemplyrscrtyestbs security
      on security.scrty_dtrmn_trget_id=account.esntl_id
   where upper(coalesce(account.entrprs_mber_sttus,'')) in('P','A')
), active_identity as (
  select account_key
    from active_identity_row
   group by account_key
  having count(distinct account_id)=1 and count(distinct identity_key)=1
     and bool_or(upper(author_code) in(
       'ROLE_LIVE_SMOKE_DENIED','ROLE_COMPOSITE_LIVE_SMOKE_DENIED'))
)
select count(*)::integer from active_identity;")"
preflight_failure_reason=""
actor_password=""
if require_exact_denied_account_count "$denied_count"; then
  actor_password="$(secret_value_from_file "$ACTOR_ENV_FILE" \
    CARBONET_ACTOR_TEST_PASSWORD || true)"
  [[ -n "$actor_password" ]] || preflight_failure_reason=ACTOR_PASSWORD_UNAVAILABLE
else
  preflight_failure_reason=DENIED_ROLE_ACCOUNT_COUNT_INVALID
fi

tables_ready="$(carbonet_postgres_query "select count(*)::integer from (values
 ('framework_composite_design_target_identity'),
 ('integrated_design_autocompletion_receipt'),
 ('integrated_design_autocompletion_gate'),
 ('integrated_design_live_smoke_dispatch')) expected(name)
 where to_regclass(expected.name) is not null;")"
[[ "$tables_ready" == 4 ]] || fail 'composite runtime migrations are not ready'

admin_account="$(carbonet_postgres_query "
select min(account_id collate \"C\") from (
  select employee.emplyr_id account_id
    from comtnemplyrscrtyestbs security join comtnemplyrinfo employee
      on employee.esntl_id=security.scrty_dtrmn_trget_id
   where security.author_code='ROLE_SYSTEM_MASTER'
     and upper(coalesce(employee.emplyr_sttus_code,'')) in('P','A')
  union
  select member.entrprs_mber_id
    from comtnemplyrscrtyestbs security join comtnentrprsmber member
      on member.esntl_id=security.scrty_dtrmn_trget_id
   where security.author_code='ROLE_SYSTEM_MASTER'
     and upper(coalesce(member.entrprs_mber_sttus,'')) in('P','A')
) administrator;")"
[[ "$admin_account" =~ ^[A-Za-z0-9._@-]{2,120}$ ]] ||
  fail 'active system administrator account unavailable'

inspect(){
  curl -fsS --max-time 20 \
    -H "X-Resonance-Token: $token" -H "X-Resonance-Actor: $ACTOR_CODE" \
    -H "X-Resonance-Account: $admin_account" \
    "$RUNTIME_BASE_URL/api/internal/actor-process/composite-autocompletion/inspect"
}

runtime_revision_ready(){
  kubectl -n "$NAMESPACE" get deployment/carbonet-runtime -o json 2>/dev/null |
    jq -e '(.spec.replicas//1) as $desired |
      .metadata.generation==.status.observedGeneration and
      (.status.updatedReplicas//0)==$desired and
      (.status.readyReplicas//0)==$desired and
      (.status.availableReplicas//0)==$desired and
      (.status.unavailableReplicas//0)==0' >/dev/null
}
inspection="$(inspect)" || fail 'authenticated read-only inspection unavailable'
jq -e '.success==true and .dryRun==true and
  (.totalProcessCount|numbers) and (.screenIdentityCount|numbers) and
  (.readyProcessCount|numbers) and (.configuredReplicas|numbers) and
  (.liveSmokeParallelism|numbers) and
  (.preflightCandidateCount|numbers) and (.preflightCheckedCount|numbers) and
  (.preflightFailureCount|numbers) and (.preflightTimedOutCount|numbers) and
  (.preflightLatencyMs|numbers) and (.preflightComplete|booleans) and
  (.preflightStable|booleans) and (.preflightBusy|booleans) and
  (.capabilityEnabled|booleans) and (.enabled|booleans) and
  (.releaseFinalized|booleans) and
  (.activeCanaryCount|numbers) and (.currentVerifiedCanaryCount|numbers) and
  (.runtimeCommit|strings) and
  (.gateStatus=="DISABLED" or .gateStatus=="PREPARED" or
   .gateStatus=="ACTIVE" or .gateStatus=="REVOKED") and
  (.gateRevision|numbers) and
  (.currentAuthoritySetHash|strings|test("^[0-9a-f]{64}$")) and
  (.currentFinalAuthoritySetHash|strings|test("^[0-9a-f]{64}$")) and
  (.tenMinuteTarget=="PASS" or .tenMinuteTarget=="FAIL" or
   .tenMinuteTarget=="MEASUREMENT_REQUIRED")' <<<"$inspection" >/dev/null ||
  fail 'inspection contract invalid'
runtime_replicas="$(kubectl -n "$NAMESPACE" get deployment/carbonet-runtime \
  -o 'jsonpath={.spec.replicas}' 2>/dev/null || true)"
[[ "$runtime_replicas" =~ ^[1-9][0-9]*$ ]] || fail 'runtime replica count unavailable'
[[ "$(jq -r .configuredReplicas <<<"$inspection")" == "$runtime_replicas" ]] ||
  fail 'configured and actual runtime replica counts differ'

deployment_runtime_commit(){
  kubectl -n "$NAMESPACE" get deployment/carbonet-runtime \
    -o 'jsonpath={.metadata.annotations.resonance\.ai/target-commit}' 2>/dev/null || true
}
runtime_commit="$(deployment_runtime_commit)"
[[ "$runtime_commit" =~ ^[0-9a-f]{40}$ ]] || fail 'runtime commit annotation unavailable'
if skip_superseded_campaign "$mode" "$runtime_commit" "$EXPECTED_RUNTIME_COMMIT"; then
  exit 0
fi
authority_hash="$(jq -r .currentAuthoritySetHash <<<"$inspection")"
final_authority_hash="$(jq -r .currentFinalAuthoritySetHash <<<"$inspection")"

refresh_campaign_inspection(){
  local observed_commit
  observed_commit="$(deployment_runtime_commit)"
  if skip_superseded_campaign campaign "$observed_commit" \
      "$EXPECTED_RUNTIME_COMMIT"; then
    exit 0
  fi
  [[ "$observed_commit" == "$EXPECTED_RUNTIME_COMMIT" ]] ||
    fail 'asynchronous campaign runtime commit unavailable while polling'
  inspection="$(inspect)" || fail 'asynchronous campaign inspection unavailable'
  authority_hash="$(jq -r .currentAuthoritySetHash <<<"$inspection")"
  final_authority_hash="$(jq -r .currentFinalAuthoritySetHash <<<"$inspection")"
}

change_approval(){
  local action="$1" revision="$2" reason="${3:-}" payload
  if [[ "$action" == PREPARE ]]; then
    payload="$(jq -nc --arg action PREPARE --argjson revision "$revision" \
      --arg commit "$runtime_commit" --arg authority "$final_authority_hash" \
      --arg candidate "$POSTDEPLOY_CANDIDATE_ID" \
      '{action:$action,expectedRevision:$revision,expectedRuntimeCommit:$commit,
        expectedFinalAuthorityHash:$authority,expectedPostdeployCandidateId:$candidate}')"
  elif [[ "$action" == ACTIVATE ]]; then
    payload="$(jq -nc --arg action ACTIVATE --argjson revision "$revision" \
      --arg commit "$runtime_commit" --arg source "$authority_hash" \
      --arg candidate "$POSTDEPLOY_CANDIDATE_ID" \
      '{action:$action,expectedRevision:$revision,expectedRuntimeCommit:$commit,
        expectedSourceInputAuthorityHash:$source,
        expectedPostdeployCandidateId:$candidate}')"
  elif [[ "$action" == REVOKE_PREPARED ]]; then
    payload="$(jq -nc --arg action REVOKE_PREPARED --argjson revision "$revision" \
      --arg candidate "$POSTDEPLOY_CANDIDATE_ID" \
      --arg reason "${reason:-POSTDEPLOY_PREPARED_ABORTED}" \
      '{action:$action,expectedRevision:$revision,
        expectedPostdeployCandidateId:$candidate,reason:$reason}')"
  else
    payload="$(jq -nc --arg action REVOKE --argjson revision "$revision" \
      --arg reason "${reason:-POSTDEPLOY_FAIL_CLOSED}" \
      '{action:$action,expectedRevision:$revision,reason:$reason}')"
  fi
  curl -fsS --max-time 20 -X POST -H 'Content-Type: application/json' \
    -H "X-Resonance-Token: $token" -H "X-Resonance-Actor: $ACTOR_CODE" \
    -H "X-Resonance-Account: $admin_account" --data-binary "$payload" \
    "$RUNTIME_BASE_URL/api/internal/actor-process/composite-autocompletion/approval"
}

prepare_current_gate(){
  local revision response post
  revision="$(jq -r .gateRevision <<<"$inspection")"
  response="$(change_approval PREPARE "$revision")" || fail 'durable gate prepare CAS rejected'
  jq -e --arg commit "$runtime_commit" --arg authority "$final_authority_hash" \
    --arg candidate "$POSTDEPLOY_CANDIDATE_ID" \
    '.success==true and .action=="PREPARE" and .approvalStatus=="PREPARED" and
     .runtimeCommit==$commit and .finalAuthorityHash==$authority and
     .postdeployCandidateId==$candidate and
     .effectiveWithoutRollout==false' <<<"$response" >/dev/null ||
    fail 'durable gate prepare response invalid'
  post="$(inspect)" || fail 'same-revision post-prepare inspection unavailable'
  inspection_confirms_prepared "$post" "$runtime_commit" "$authority_hash" \
    "$POSTDEPLOY_CANDIDATE_ID" || {
    inspection="$post"
    local rollback_revision
    rollback_revision="$(jq -r .gateRevision <<<"$inspection")"
    change_approval REVOKE_PREPARED "$rollback_revision" \
      POST_PREPARE_INSPECTION_FAILED >/dev/null || true
    fail 'prepared gate commit source canary binding mismatch'
  }
  inspection="$post"
}

activate_current_gate(){
  local revision
  inspection_confirms_prepared "$inspection" "$runtime_commit" "$authority_hash" \
    "$POSTDEPLOY_CANDIDATE_ID" ||
    fail 'durable gate is not current PREPARED state'
  revision="$(jq -r .gateRevision <<<"$inspection")"
  # This curl is deliberately the last fallible command. The server performs
  # every exact-candidate/current-runtime check in the ACTIVATE transaction.
  # No post-activation inspection or marker write can race worker claims.
  change_approval ACTIVATE "$revision" >/dev/null
}

revoke_current_gate(){
  local reason="${1:-POSTDEPLOY_FAIL_CLOSED}" revision response post
  [[ "$(jq -r .gateStatus <<<"$inspection")" == PREPARED ||
     "$(jq -r .gateStatus <<<"$inspection")" == ACTIVE ]] || return 0
  revision="$(jq -r .gateRevision <<<"$inspection")"
  response="$(change_approval REVOKE "$revision" "$reason")" ||
    fail 'durable gate revoke CAS rejected'
  jq -e '.success==true and .action=="REVOKE" and .approvalStatus=="REVOKED"' \
    <<<"$response" >/dev/null || fail 'durable gate revoke response invalid'
  post="$(inspect)" || fail 'post-revoke inspection unavailable'
  [[ "$(jq -r .enabled <<<"$post")" == false ]] || fail 'durable gate remained enabled'
  inspection="$post"
}

revoke_prepared_gate(){
  local reason="${1:-POSTDEPLOY_PREPARED_ABORTED}" revision response post
  [[ "$(jq -r .gateStatus <<<"$inspection")" == PREPARED ]] || return 0
  [[ "$(jq -r .gatePostdeployCandidateId <<<"$inspection")" == "$POSTDEPLOY_CANDIDATE_ID" ]] ||
    return 0
  revision="$(jq -r .gateRevision <<<"$inspection")"
  response="$(change_approval REVOKE_PREPARED "$revision" "$reason")" ||
    fail 'prepared-only durable gate revoke CAS rejected'
  jq -e --arg candidate "$POSTDEPLOY_CANDIDATE_ID" \
    '.success==true and .action=="REVOKE_PREPARED" and
     .approvalStatus=="REVOKED" and .postdeployCandidateId==$candidate' \
    <<<"$response" >/dev/null || fail 'prepared-only revoke response invalid'
  post="$(inspect)" || fail 'post prepared-only revoke inspection unavailable'
  [[ "$(jq -r .enabled <<<"$post")" == false ]] ||
    fail 'prepared-only revoke left scheduler enabled'
  inspection="$post"
}

best_effort_revoke_preflight_gate(){
  local reason="${1:-POSTDEPLOY_PREFLIGHT_FAILED}" status revision response post
  status="$(jq -r .gateStatus <<<"$inspection")"
  [[ "$status" == PREPARED || "$status" == ACTIVE ]] || return 0
  # The inspected candidate plus monotonic expectedRevision fence both paths.
  # PREPARED additionally uses the server's candidate-bearing narrow CAS.
  [[ "$(jq -r .gatePostdeployCandidateId <<<"$inspection")" == \
     "$POSTDEPLOY_CANDIDATE_ID" ]] || return 1
  revision="$(jq -r .gateRevision <<<"$inspection")"
  if [[ "$status" == PREPARED ]]; then
    response="$(change_approval REVOKE_PREPARED "$revision" "$reason" \
      2>/dev/null)" || return 1
    jq -e --arg candidate "$POSTDEPLOY_CANDIDATE_ID" \
      '.success==true and .action=="REVOKE_PREPARED" and
       .approvalStatus=="REVOKED" and .postdeployCandidateId==$candidate' \
      <<<"$response" >/dev/null || return 1
  else
    response="$(change_approval REVOKE "$revision" "$reason" 2>/dev/null)" || return 1
    jq -e '.success==true and .action=="REVOKE" and .approvalStatus=="REVOKED"' \
      <<<"$response" >/dev/null || return 1
  fi
  post="$(inspect 2>/dev/null)" || return 1
  jq -e '.enabled==false and (.gateStatus=="REVOKED" or .gateStatus=="DISABLED")' \
    <<<"$post" >/dev/null || return 1
  inspection="$post"
}

fail_closed_preflight_state(){
  local reason="$1"
  preflight_revoke=false
  preflight_timer_off=false
  if best_effort_revoke_preflight_gate "$reason"; then
    preflight_revoke=true
  fi
  sudo -n systemctl disable --now resonance-composite-live-smoke.timer \
    >/dev/null 2>&1 || true
  if ! systemctl is-active --quiet resonance-composite-live-smoke.timer; then
    preflight_timer_off=true
  fi
  return 0
}

if [[ -z "$preflight_failure_reason" ]]; then
  export CARBONET_ACTOR_TEST_PASSWORD="$actor_password" RESONANCE_OPS_TOKEN="$token"
  set +e
  python3 "$ROOT/ops/scripts/generate-composite-relay-account-map.py" \
    --manifest "$ROOT/ops/runtime-metadata/composite-relay-account-map.json" \
    --output-env /opt/resonance-data/control-plane/run/composite-relay-accounts.env \
    --state /opt/resonance-data/control-plane/run/composite-relay-accounts.state.json \
    >/dev/null
  map_status=$?
  set -e
  ((map_status==0 || map_status==10)) || preflight_failure_reason=RELAY_ACCOUNT_MAP_FAILED
fi
if [[ -n "$preflight_failure_reason" ]]; then
  fail_closed_preflight_state "$preflight_failure_reason"
  printf '[composite-autocompletion-postdeploy] WARN preflight=%s deniedRoleCount=%s revoke=%s timerOff=%s\n' \
    "$preflight_failure_reason" "$denied_count" "$preflight_revoke" \
    "$preflight_timer_off" >&2
  if [[ "$mode" == reconcile ]]; then
    printf '[composite-autocompletion-postdeploy] READY mode=reconcile gate=%s prepared=false target=%s scheduler=false deniedRoleCount=%s deniedRoleReady=false revoke=%s timerOff=%s\n' \
      "$(jq -r .gateStatus <<<"$inspection")" \
      "$(jq -r .tenMinuteTarget <<<"$inspection")" "$denied_count" \
      "$preflight_revoke" "$preflight_timer_off"
    exit 0
  fi
  fail "preflight unavailable: $preflight_failure_reason"
fi

write_audit_marker(){
  marker_tmp="$(mktemp)"
  jq -n --arg commit "$runtime_commit" --arg authority "$authority_hash" \
    --arg candidate "$POSTDEPLOY_CANDIDATE_ID" \
    --arg finalAuthority "$(jq -r .gateFinalAuthorityHash <<<"$inspection")" \
    --arg source "$(jq -r .gateSourceInputAuthorityHash <<<"$inspection")" \
    --argjson revision "$(jq -r .gateRevision <<<"$inspection")" \
    --argjson p95 "$(jq -r .p95PhysicalMs <<<"$inspection")" \
    --argjson samples "$(jq -r .physicalSampleCount <<<"$inspection")" \
    --arg process "$(jq -r .currentVerifiedCanaryProcessCode <<<"$inspection")" \
    --argjson job "$(jq -r .currentVerifiedCanaryJobId <<<"$inspection")" \
    '{schema:"carbonet.composite-autocompletion-approval/v1",
      decision:"MEASURED_PASS",runtimeCommit:$commit,authoritySetHash:$authority,
      postdeployCandidateId:$candidate,
      finalAuthorityHash:$finalAuthority,
      sourceInputAuthorityHash:$source,preparedGateRevision:$revision,
      p95PhysicalMs:$p95,physicalSampleCount:$samples,
      canaryProcessCode:$process,canaryJobId:$job}' >"$marker_tmp" || return 1
  sudo -n install -d -m 0700 -o root -g root "$(dirname "$ENABLE_MARKER")" || return 1
  sudo -n install -m 0600 -o root -g root "$marker_tmp" \
    "${ENABLE_MARKER}.next.$$" || return 1
  sudo -n mv -f "${ENABLE_MARKER}.next.$$" "$ENABLE_MARKER" || return 1
  rm -f "$marker_tmp" || return 1;marker_tmp=""
}

dispatch_current_canary(){
  curl -fsS --max-time 20 -X POST -H 'Content-Type: application/json' \
    -H "X-Resonance-Token: $token" -H "X-Resonance-Actor: $ACTOR_CODE" \
    -H "X-Resonance-Account: $admin_account" --data '{"limit":1}' \
    "$RUNTIME_BASE_URL/api/internal/actor-process/composite-autocompletion/dispatch" |
    jq -e '.success==true and .canary==true and .requestedLimit==1 and
      .claimedCount==1 and (.canaryId|strings|test("^[0-9a-f-]{36}$"))' >/dev/null
}

if [[ "$mode" == canary ]]; then
  dispatch_current_canary ||
    fail 'bounded canary dispatch rejected'
fi

if [[ "$mode" == enable ]]; then
  runtime_revision_ready || fail 'candidate runtime revision is not fully ready'
  if ! inspection_confirms_enabled "$inspection" "$runtime_commit" "$authority_hash" \
      "$POSTDEPLOY_CANDIDATE_ID"; then
    inspection_allows_enable "$inspection" "$runtime_commit" "$authority_hash" ||
      fail 'measured capacity is insufficient'
    if ! inspection_confirms_prepared "$inspection" "$runtime_commit" "$authority_hash" \
        "$POSTDEPLOY_CANDIDATE_ID"; then
      prepare_current_gate
    fi
    write_audit_marker ||
      printf '[composite-autocompletion-postdeploy] WARN audit marker publication failed\n' >&2
    activate_current_gate
    exit 0
  fi
  scheduler_state=true
fi

if [[ "$mode" == activate ]]; then
  runtime_revision_ready || fail 'finalized runtime revision is not fully ready'
  if ! inspection_confirms_enabled "$inspection" "$runtime_commit" "$authority_hash" \
      "$POSTDEPLOY_CANDIDATE_ID"; then
    inspection_allows_enable "$inspection" "$runtime_commit" "$authority_hash" ||
      fail 'finalized runtime capacity proof is insufficient'
    write_audit_marker ||
      printf '[composite-autocompletion-postdeploy] WARN audit marker publication failed\n' >&2
    activate_current_gate
    exit 0
  fi
  scheduler_state=true
fi

if [[ "$mode" == revoke ]]; then
  revoke_current_gate OPERATOR_POSTDEPLOY_REVOKE
  scheduler_state=false
fi

if [[ "$mode" == revoke-prepared ]]; then
  revoke_prepared_gate OPERATOR_POSTDEPLOY_PREPARED_ABORT
  scheduler_state=false
fi

if [[ "$mode" == revoke-candidate ]]; then
  best_effort_revoke_preflight_gate POSTDEPLOY_CANDIDATE_FAIL_CLOSED ||
    fail 'exact-candidate durable gate revoke CAS rejected'
  scheduler_state=false
fi

if [[ "$mode" == reconcile ]]; then
  runtime_revision_ready || fail 'validated runtime revision is not fully ready'
  # The root-owned marker is audit output only. This reconcile entrypoint is
  # called after the same pod revision completes all deployment validation;
  # current database canary evidence, never the marker, authorizes its CAS.
  if inspection_confirms_enabled "$inspection" "$runtime_commit" "$authority_hash" \
      "$POSTDEPLOY_CANDIDATE_ID"; then
    scheduler_state=true
  elif inspection_confirms_prepared "$inspection" "$runtime_commit" "$authority_hash" \
      "$POSTDEPLOY_CANDIDATE_ID"; then
    scheduler_state=false
  elif inspection_allows_enable "$inspection" "$runtime_commit" "$authority_hash"; then
    prepare_current_gate
    scheduler_state=false
  else
    revoke_prepared_gate STALE_OR_MISSING_MEASURED_APPROVAL
    scheduler_state=false
  fi
fi

if [[ "$mode" == campaign ]]; then
  runtime_revision_ready || fail 'asynchronous campaign runtime revision is not fully ready'
  sudo -n systemctl enable --now resonance-composite-live-smoke.timer >/dev/null ||
    fail 'asynchronous campaign could not start the live-smoke timer'
  campaign_deadline=$((SECONDS+CAMPAIGN_TIMEOUT_SECONDS))
  next_dispatch_second=$SECONDS
  while ((SECONDS<campaign_deadline)); do
    refresh_campaign_inspection
    if [[ "$(jq -r .runtimeCommit <<<"$inspection")" != "$runtime_commit" ]]; then
      sleep "$CAMPAIGN_POLL_SECONDS"
      continue
    fi
    if inspection_confirms_enabled "$inspection" "$runtime_commit" "$authority_hash" \
        "$POSTDEPLOY_CANDIDATE_ID"; then
      campaign_prepared=false
      exit 0
    fi
    if inspection_allows_enable "$inspection" "$runtime_commit" "$authority_hash"; then
      if inspection_confirms_prepared "$inspection" "$runtime_commit" "$authority_hash" \
          "$POSTDEPLOY_CANDIDATE_ID"; then
        campaign_prepared=true
      else
        prepare_current_gate
        campaign_prepared=true
      fi
      write_audit_marker ||
        printf '[composite-autocompletion-postdeploy] WARN audit marker publication failed\n' >&2
      activate_current_gate
      campaign_prepared=false
      exit 0
    fi
    if [[ "$(jq -r .gateStatus <<<"$inspection")" == PREPARED \
       && "$(jq -r .gatePostdeployCandidateId <<<"$inspection")" == \
          "$POSTDEPLOY_CANDIDATE_ID" ]]; then
      campaign_prepared=true
      revoke_prepared_gate CAMPAIGN_PREPARED_BINDING_STALE
      campaign_prepared=false
      fail 'asynchronous campaign prepared binding became stale'
    fi
    active_canaries="$(jq -r .activeCanaryCount <<<"$inspection")"
    verified_canaries="$(jq -r .currentVerifiedCanaryCount <<<"$inspection")"
    preflight_complete="$(jq -r .preflightComplete <<<"$inspection")"
    if [[ "$active_canaries" == 0 && "$verified_canaries" == 0 \
       && "$preflight_complete" == true && SECONDS -ge next_dispatch_second ]]; then
      if dispatch_current_canary; then
        printf '[composite-autocompletion-postdeploy] canary dispatched commit=%s\n' \
          "$runtime_commit"
        next_dispatch_second=$((SECONDS+30))
      else
        # A concurrent exact campaign or a transaction still becoming visible
        # is harmless; re-read durable state instead of consuming retries.
        next_dispatch_second=$((SECONDS+15))
      fi
    fi
    sleep "$CAMPAIGN_POLL_SECONDS"
  done
  fail 'asynchronous canary campaign exceeded its bounded deadline'
fi

prepared_state=false
if inspection_confirms_prepared "$inspection" "$runtime_commit" "$authority_hash" \
    "$POSTDEPLOY_CANDIDATE_ID"; then
  prepared_state=true
fi
printf '[composite-autocompletion-postdeploy] READY mode=%s gate=%s prepared=%s target=%s scheduler=%s processes=%s identities=%s samples=%s estimateSeconds=%s requiredParallelism=%s slots=%s replicas=%s\n' \
  "$mode" "$(jq -r .gateStatus <<<"$inspection")" \
  "$prepared_state" \
  "$(jq -r .tenMinuteTarget <<<"$inspection")" \
  "${scheduler_state:-unchanged}" \
  "$(jq -r .readyProcessCount <<<"$inspection")" \
  "$(jq -r .readyIdentityCount <<<"$inspection")" \
  "$(jq -r .physicalSampleCount <<<"$inspection")" \
  "$(jq -r '.estimatedTotalSeconds//"NA"' <<<"$inspection")" \
  "$(jq -r '.requiredParallelism//"NA"' <<<"$inspection")" \
  "$(jq -r .liveSmokeParallelism <<<"$inspection")" \
  "$(jq -r .configuredReplicas <<<"$inspection")"
