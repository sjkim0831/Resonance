#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ -n "${CARBONET_DEPLOY_ROOT:-}" ]]; then
  ROOT="$CARBONET_DEPLOY_ROOT"
elif ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi

BASE_URL="${CARBONET_RUNTIME_BASE_URL:-https://resonance.172.16.1.232.nip.io}"
BASE_URL="${BASE_URL%/}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
AUTH_SECRET="carbonet-usage-ledger-system-admin"
NODE_BIN="${NODE_BIN:-node}"
TARGET_IDS="216005,216006,216007,216008"
DEPLOYMENT="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
CONTAINER="${CARBONET_K8S_CONTAINER:-carbonet-runtime}"
CURL_CONNECT_TIMEOUT="${CARBONET_MEMBER_CONTRACT_CONNECT_TIMEOUT_SECONDS:-5}"
CURL_MAX_TIME="${CARBONET_MEMBER_CONTRACT_REQUEST_TIMEOUT_SECONDS:-15}"
RUNNER="$ROOT/ops/scripts/publish-member-lifecycle-screen-contracts.mjs"
AUTH_COMMON="$ROOT/ops/scripts/runtime-qa-auth-common.sh"
PG_ADAPTER="$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"

[[ -f "$RUNNER" && -f "$AUTH_COMMON" && -f "$PG_ADAPTER" ]] || {
  echo '[member-contract-publisher] required runtime helper is missing' >&2
  exit 1
}
[[ "$BASE_URL" =~ ^https?://[^[:space:]]+$ ]] || {
  echo '[member-contract-publisher] runtime base URL is invalid' >&2
  exit 1
}
[[ "$DEPLOYMENT" =~ ^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$ && "$CONTAINER" =~ ^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$ ]] || {
  echo '[member-contract-publisher] Kubernetes identity is invalid' >&2
  exit 1
}
[[ "$CURL_CONNECT_TIMEOUT" =~ ^[1-9][0-9]*$ && "$CURL_MAX_TIME" =~ ^[1-9][0-9]*$ ]] || {
  echo '[member-contract-publisher] HTTP timeout is invalid' >&2
  exit 1
}

# shellcheck source=ops/scripts/runtime-qa-auth-common.sh
source "$AUTH_COMMON"
# shellcheck source=ops/scripts/lib/carbonet-postgres-query.sh
source "$PG_ADAPTER"

CARBONET_PG_NAMESPACE="$NAMESPACE"
POSTGRES_DB="${POSTGRES_DB:-carbonet}"
POSTGRES_ADMIN_USER="${POSTGRES_ADMIN_USER:-postgres}"
carbonet_postgres_query_init

source_commit="$(git -C "$ROOT" rev-parse HEAD)"
[[ "$source_commit" =~ ^[0-9a-f]{40}$ ]] || {
  echo '[member-contract-publisher] Git source commit is invalid' >&2
  exit 1
}
[[ -z "$(git -C "$ROOT" status --porcelain=v1 --untracked-files=all)" ]] || {
  echo '[member-contract-publisher] Git worktree must be clean before authenticated publication' >&2
  exit 1
}

work_dir="$(mktemp -d /tmp/member-contract-publisher.XXXXXX)"
input_file="$work_dir/current-db-payloads.json"
initial_file="$work_dir/initial.json"
idempotent_file="$work_dir/idempotent.json"
state_before_file="$work_dir/runtime-state-before-rerun.json"
state_after_file="$work_dir/runtime-state-after-rerun.json"
deployment_file="$work_dir/deployment.json"
pods_file="$work_dir/pods.json"
cookie_jar="$work_dir/auth.cookies"
logout_response="$work_dir/logout.json"
lock_owned=false
session_active=false
effective_user=""

active_token_count() {
  [[ "$effective_user" =~ ^[A-Za-z0-9_.@-]+$ ]] || return 1
  carbonet_postgres_query "select count(*) from COMTNAUTHTOKENSTORE
    where lower(user_id)=lower('$effective_user')
      and (expiration_at is null or expiration_at>current_timestamp)"
}

logout_without_unlock() {
  local status="" result=0
  if [[ "$session_active" == true ]]; then
    status="$(curl -sS --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" \
      -b "$cookie_jar" -o "$logout_response" -w '%{http_code}' \
      -X POST "$BASE_URL/signin/actionLogout")" || status="000"
    if [[ "$status" != 200 ]] || ! jq -e '(.status // "") == "success"' "$logout_response" >/dev/null 2>&1; then
      echo "[member-contract-publisher] authenticated logout failed (http=$status)" >&2
      result=1
    fi
  fi
  session_active=false
  unset CARBONET_QA_AUTH_SESSION_ACTIVE CARBONET_QA_AUTH_EFFECTIVE_USER
  rm -f "$cookie_jar" "$logout_response"
  return "$result"
}

runtime_snapshot() {
  local target release image health
  kubectl -n "$NAMESPACE" get deployment "$DEPLOYMENT" -o json >"$deployment_file"
  target="$(jq -r '.metadata.annotations["resonance.ai/target-commit"] // empty' "$deployment_file")"
  release="$(jq -r '.spec.template.metadata.labels["resonance.ai/release-id"] // empty' "$deployment_file")"
  image="$(jq -r --arg container "$CONTAINER" '.spec.template.spec.containers[]|select(.name==$container)|.image' "$deployment_file")"
  [[ "$target" == "$source_commit" && -n "$release" && -n "$image" ]] || {
    echo '[member-contract-publisher] Deployment target/image/release does not bind Git HEAD' >&2
    return 1
  }
  jq -e '
    (.metadata.generation|type)=="number"
    and .status.observedGeneration==.metadata.generation
    and (.spec.replicas // 0)>0
    and .status.updatedReplicas==.spec.replicas
    and .status.readyReplicas==.spec.replicas
    and .status.availableReplicas==.spec.replicas
    and (.status.unavailableReplicas // 0)==0
  ' "$deployment_file" >/dev/null || {
    echo '[member-contract-publisher] Deployment generation/replica gate failed' >&2
    return 1
  }
  kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT,resonance.ai/release-id=$release" -o json >"$pods_file"
  jq -e --arg container "$CONTAINER" --arg image "$image" --slurpfile deployment "$deployment_file" '
    ($deployment[0].spec.replicas) as $desired
    | (.items|length)==$desired
    and all(.items[];
      .status.phase=="Running"
      and any(.status.conditions[]?;.type=="Ready" and .status=="True")
      and any(.spec.containers[];.name==$container and .image==$image)
      and any(.status.containerStatuses[]?;.name==$container and .ready==true
        and ((.imageID // "")|length)>0))
    and ([.items[].status.containerStatuses[]?|select(.name==$container)|.imageID]|unique|length)==1
  ' "$pods_file" >/dev/null || {
    echo '[member-contract-publisher] ready pod/imageID closure is not exact' >&2
    return 1
  }
  health="$(curl -fsS --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" "$BASE_URL/actuator/health")" || {
    echo '[member-contract-publisher] runtime health request failed' >&2
    return 1
  }
  jq -e '.status=="UP"' <<<"$health" >/dev/null || {
    echo '[member-contract-publisher] runtime health is not UP' >&2
    return 1
  }
  jq -cS --arg source "$source_commit" --arg container "$CONTAINER" \
    --slurpfile deployment "$deployment_file" --slurpfile pods "$pods_file" '
    ($deployment[0]) as $d | ($pods[0]) as $p |
    {
      sourceCommit:$source,
      targetCommit:$d.metadata.annotations["resonance.ai/target-commit"],
      deploymentUid:$d.metadata.uid,
      deploymentGeneration:$d.metadata.generation,
      observedGeneration:$d.status.observedGeneration,
      desiredReplicas:$d.spec.replicas,
      updatedReplicas:$d.status.updatedReplicas,
      readyReplicas:$d.status.readyReplicas,
      availableReplicas:$d.status.availableReplicas,
      releaseId:$d.spec.template.metadata.labels["resonance.ai/release-id"],
      imageRef:([$d.spec.template.spec.containers[]|select(.name==$container)|.image][0]),
      podNames:([$p.items[].metadata.name]|sort),
      imageIds:([$p.items[].status.containerStatuses[]?|select(.name==$container)|.imageID]|unique|sort),
      healthStatus:"UP"
    }'
}

cleanup_on_exit() {
  local status=$? cleanup_status=0 final_tokens=""
  trap - EXIT INT TERM
  set +e
  if [[ "$session_active" == true ]]; then
    logout_without_unlock || cleanup_status=1
  fi
  if [[ -n "$effective_user" ]]; then
    final_tokens="$(active_token_count 2>/dev/null)" || cleanup_status=1
    if [[ ! "$final_tokens" =~ ^[0-9]+$ || "$final_tokens" != 0 ]]; then
      echo "[member-contract-publisher] cleanup token postcondition failed count=${final_tokens:-unknown}" >&2
      cleanup_status=1
    fi
  fi
  if [[ "$lock_owned" == true ]]; then
    carbonet_qa_auth_release_lock
  fi
  unset CARBONET_QA_AUTH_PASSWORD PUBLISH_PASSWORD CARBONET_PG_PASSWORD
  rm -rf "$work_dir"
  if (( status == 0 && cleanup_status != 0 )); then status=1; fi
  exit "$status"
}
trap cleanup_on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

read -r -d '' PAYLOAD_SQL <<'SQL' || true
with target as (
  select contract.*,
         lower(split_part(contract.route_path,'?',1)) normalized_route,
         framework_canonical_screen_bundle(
           contract.process_code,contract.step_code,contract.audience,contract.route_path
         ) bundle
    from framework_professional_screen_contract contract
    join framework_screen_blueprint blueprint
      on blueprint.process_code=contract.process_code
     and blueprint.step_code=contract.step_code
     and blueprint.audience=contract.audience
     and lower(split_part(blueprint.route_path,'?',1))=lower(split_part(contract.route_path,'?',1))
     and blueprint.validation_status='VALID'
     and blueprint.transition_status='CONTRACT_LINKED'
     and blueprint.source_reference='framework_professional_screen_contract:'||contract.contract_id
   where contract.contract_id=any(array[216005,216006,216007,216008]::bigint[])
)
select coalesce(jsonb_agg(jsonb_build_object(
  'payload',jsonb_build_object(
    'contractId',contract_id,
    'businessPurpose',business_purpose,
    'entryCondition',entry_condition,
    'exitCondition',exit_condition,
    'kpiContract',kpi_contract,
    'sectionContract',section_contract,
    'fieldContract',field_contract,
    'commandContract',command_contract,
    'stateContract',state_contract,
    'apiContract',api_contract,
    'dataContract',data_contract,
    'evidenceContract',evidence_contract,
    'responsiveContract',responsive_contract,
    'accessibilityContract',accessibility_contract,
    'securityContract',security_contract,
    'apiVerified',api_verified,
    'databaseVerified',database_verified,
    'authorityVerified',authority_verified,
    'responsiveVerified',responsive_verified,
    'accessibilityVerified',accessibility_verified,
    'exceptionStatesVerified',exception_states_verified,
    'auditEvidenceRef',coalesce(audit_evidence_ref,''),
    'contractStatus',contract_status
  ),
  'expected',jsonb_build_object(
    'processCode',process_code,
    'stepCode',step_code,
    'audience',audience,
    'routePath',normalized_route,
    'designHash',bundle->>'designHash',
    'catalogHash',bundle->>'catalogHash'
  )
) order by contract_id),'[]'::jsonb)::text
from target
where process_code='MEMBER_LIFECYCLE'
  and audience='USER'
  and normalized_route='/work/execution'
  and contract_status='VERIFIED';
SQL

carbonet_postgres_query "$PAYLOAD_SQL" >"$input_file"
jq -e '
  length==4
  and ([.[].payload.contractId]==[216005,216006,216007,216008])
  and all(.[]; .payload.contractStatus=="VERIFIED")
  and all(.[]; .expected.processCode=="MEMBER_LIFECYCLE" and .expected.audience=="USER"
    and .expected.routePath=="/work/execution"
    and (.expected.designHash|test("^[0-9a-f]{64}$"))
    and ((.expected.catalogHash==null) or (.expected.catalogHash=="")
      or (.expected.catalogHash|test("^[0-9a-f]{64}$"))))
' "$input_file" >/dev/null || {
  echo '[member-contract-publisher] current DB source is not the exact four VERIFIED contracts' >&2
  exit 1
}

runtime_state() {
  carbonet_postgres_query "with ids(contract_id) as (
      values (216005::bigint),(216006::bigint),(216007::bigint),(216008::bigint)
    )
    select jsonb_agg(jsonb_build_object(
      'contractId',ids.contract_id,
      'bindingCount',(select count(*) from framework_screen_contract_binding b where b.contract_id=ids.contract_id),
      'versionCount',(select count(*) from framework_screen_contract_version v where v.contract_id=ids.contract_id),
      'eventCount',(select count(*) from framework_screen_contract_event e where e.screen_key in
        (select b.screen_key from framework_screen_contract_binding b where b.contract_id=ids.contract_id)),
      'active',(select jsonb_build_object(
          'screenKey',b.screen_key,'routePath',b.route_path,'cacheEpoch',b.cache_epoch,
          'versionId',v.version_id,'versionNo',v.version_no,'contractHash',v.contract_hash,
          'versionStatus',v.version_status,'support',v.contract_json->'support'
        ) from framework_screen_contract_binding b
        join framework_screen_contract_version v on v.version_id=b.active_version_id
        where b.contract_id=ids.contract_id order by b.screen_key limit 1)
    ) order by ids.contract_id)::text from ids"
}

verify_runtime_state() {
  local state_file="$1" result_file="$2"
  jq -e --slurpfile result "$result_file" '
    ($result[0]) as $r
    | length==4 and ([.[].contractId]==[216005,216006,216007,216008])
    and all(.[] as $db |
      ($r.contracts[]|select(.contractId==$db.contractId)) as $http
      | $db.bindingCount==1 and $db.versionCount>=1 and $db.eventCount>=1
      and $db.active.versionStatus=="PUBLISHED"
      and $db.active.versionId==$http.versionId
      and $db.active.versionNo==$http.versionNo
      and $db.active.contractHash==$http.contractHash
      and $db.active.routePath=="/work/execution"
      and $db.active.support.schemaVersion=="carbonet.executable-screen-support/v1"
      and $db.active.support.designHash==$http.designHash
      and (($db.active.support.catalogHash // null)==($http.catalogHash // null))
      and (($db.active.support.lanes|keys)==["API","DATABASE","DESIGN_CARD","FRONTEND","HELP","QA","WORK_GUIDE"])
      and (($db.active.support.assetBindings|length)>0)
    )
  ' "$state_file" >/dev/null
}

carbonet_qa_auth_acquire_lock
lock_owned=true
carbonet_qa_load_credentials PUBLISH_USER PUBLISH_PASSWORD "" "" "$AUTH_SECRET" "$NAMESPACE"
effective_user="$PUBLISH_USER"
[[ "$effective_user" =~ ^[A-Za-z0-9_.@-]+$ ]] || {
  echo '[member-contract-publisher] dedicated account identifier is malformed' >&2
  exit 1
}
token_baseline="$(active_token_count)"
[[ "$token_baseline" == 0 ]] || {
  echo "[member-contract-publisher] dedicated account already has active tokens count=$token_baseline" >&2
  exit 1
}

CARBONET_QA_AUTH_SECRET="$AUTH_SECRET"
CARBONET_QA_AUTH_USER="$PUBLISH_USER"
CARBONET_QA_AUTH_PASSWORD="$PUBLISH_PASSWORD"
export CARBONET_QA_AUTH_SECRET CARBONET_QA_AUTH_USER
carbonet_qa_login "$cookie_jar" "$BASE_URL"
session_active=true
effective_user="$CARBONET_QA_AUTH_EFFECTIVE_USER"
PUBLISH_PASSWORD=""
unset PUBLISH_PASSWORD CARBONET_QA_AUTH_PASSWORD

export CARBONET_MEMBER_CONTRACT_INPUT_FILE="$input_file"
export CARBONET_MEMBER_CONTRACT_COOKIE_JAR="$cookie_jar"
export CARBONET_RUNTIME_BASE_URL="$BASE_URL"
runtime_snapshot_before="$(runtime_snapshot)"
runtime_snapshot_before_hash="$(printf '%s' "$runtime_snapshot_before" | sha256sum | awk '{print $1}')"
CARBONET_MEMBER_CONTRACT_PHASE=initial "$NODE_BIN" "$RUNNER" >"$initial_file"
jq -e '.success==true and .previewBeforeMutation==true and .previewCount==4
  and .publishCount==4 and .resolverCount==4' "$initial_file" >/dev/null
runtime_snapshot_after_initial="$(runtime_snapshot)"
runtime_snapshot_after_initial_hash="$(printf '%s' "$runtime_snapshot_after_initial" | sha256sum | awk '{print $1}')"
[[ "$runtime_snapshot_after_initial_hash" == "$runtime_snapshot_before_hash" ]] || {
  echo '[member-contract-publisher] Deployment drifted during initial publication; rerun after stability to reconcile idempotently' >&2
  exit 1
}

runtime_state >"$state_before_file"
verify_runtime_state "$state_before_file" "$initial_file"
state_hash_before="$(sha256sum "$state_before_file" | awk '{print $1}')"

CARBONET_MEMBER_CONTRACT_PHASE=idempotent "$NODE_BIN" "$RUNNER" >"$idempotent_file"
jq -e '.success==true and .previewBeforeMutation==true and .previewCount==4
  and .publishCount==4 and .resolverCount==4
  and all(.contracts[].predictionReason=="UNCHANGED")' "$idempotent_file" >/dev/null

runtime_state >"$state_after_file"
verify_runtime_state "$state_after_file" "$idempotent_file"
state_hash_after="$(sha256sum "$state_after_file" | awk '{print $1}')"
[[ "$state_hash_after" == "$state_hash_before" ]] || {
  echo '[member-contract-publisher] idempotent rerun changed binding/version/event runtime state' >&2
  exit 1
}
runtime_snapshot_final="$(runtime_snapshot)"
runtime_snapshot_final_hash="$(printf '%s' "$runtime_snapshot_final" | sha256sum | awk '{print $1}')"
[[ "$runtime_snapshot_final_hash" == "$runtime_snapshot_before_hash" ]] || {
  echo '[member-contract-publisher] Deployment drifted before final publication evidence' >&2
  exit 1
}

logout_without_unlock
final_tokens="$(active_token_count)"
[[ "$final_tokens" == 0 ]] || {
  echo "[member-contract-publisher] final active-token postcondition failed count=$final_tokens" >&2
  exit 1
}
carbonet_qa_auth_release_lock
lock_owned=false
trap - EXIT INT TERM

jq -n --slurpfile initial "$initial_file" --slurpfile idempotent "$idempotent_file" \
  --arg stateBefore "$state_hash_before" --arg stateAfter "$state_hash_after" \
  --arg sourceCommit "$source_commit" --arg runtimeSnapshot "$runtime_snapshot_before_hash" \
  --argjson tokenBaseline "$token_baseline" --argjson finalTokens "$final_tokens" '
  {
    success:true,
    schema:"carbonet.member-lifecycle-screen-contract-publish/v1",
    contractIds:[216005,216006,216007,216008],
    sourceCommit:$sourceCommit,
    phases:{initial:$initial[0],idempotent:$idempotent[0]},
    previewBeforeMutation:true,
    resolver:{passed:4,total:4},
    idempotency:{reason:"UNCHANGED",runtimeStateHashBefore:$stateBefore,
      runtimeStateHashAfter:$stateAfter,runtimeWriteCount:0},
    runtimeStability:{status:"STABLE",snapshotHashBefore:$runtimeSnapshot,
      snapshotHashAfterInitial:$runtimeSnapshot,snapshotHashFinal:$runtimeSnapshot,
      targetCommit:$sourceCommit,healthStatus:"UP",imageIdCount:1},
    authentication:{secretRef:"carbonet-usage-ledger-system-admin",
      passwordOutputCount:0,activeTokenBaseline:$tokenBaseline,activeTokenFinal:$finalTokens},
    buildRequired:false
  }'

unset CARBONET_QA_AUTH_USER CARBONET_QA_AUTH_SECRET CARBONET_PG_PASSWORD
rm -rf "$work_dir"
