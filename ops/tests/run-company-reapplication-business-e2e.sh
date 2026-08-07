#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
BROWSER_HOST_IP="$(hostname -I | awk '{print $1}')"
[[ -n "$BROWSER_HOST_IP" ]] || { echo CARBONET_BROWSER_HOST_IP_UNAVAILABLE >&2; exit 2; }
BROWSER_BASE_URL="${CARBONET_BROWSER_BASE_URL:-http://$BROWSER_HOST_IP}"
LOCK_FILE="${COMPANY_REAPPLICATION_E2E_LOCK_FILE:-/tmp/resonance-company-reapplication-e2e.lock}"
DEPLOY_LOCK_FILE="${CARBONET_DEPLOY_LOCK_FILE:-/tmp/carbonet-auto-deploy.lock}"
DEPLOY_LOCK_WAIT_SECONDS="${COMPANY_REAPPLICATION_DEPLOY_LOCK_WAIT_SECONDS:-120}"
DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
PROJECT_ID="${CARBONET_REAPPLICATION_TEST_PROJECT_ID:-P003}"
UPLOAD_ROOT="${CARBONET_FILE_INSTT_DIR:-/opt/resonance-data/carbonet/files/instt}"
PROCESS=COMPANY_REAPPLICATION_PUBLIC
STEP=COMPANY_REAPPLICATION_PUBLIC_RESUBMIT
REQUIRED="api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup,token,replayBlocked,rateLimitFixtureCleanup,browserRateLimitFixtureCleanup,screenContextPreflight,desktop,mobile,browserJourney,browserPersistence,businessJourneyDesktop,businessJourneyMobile,downloadVerified,representativeUpdateVerified"
BROWSER_RATE_LIMIT_WINDOW_SECONDS=300
BROWSER_RATE_LIMIT_MAX_REQUESTS=10
BROWSER_RATE_LIMIT_REQUIRED_CAPACITY=2
BROWSER_RATE_LIMIT_OWNED_DELTA=2
BROWSER_RATE_LIMIT_WINDOW_GUARD_SECONDS="${COMPANY_REAPPLICATION_RATE_LIMIT_WINDOW_GUARD_SECONDS:-60}"
BROWSER_RATE_LIMIT_MAX_WAIT_SECONDS="${COMPANY_REAPPLICATION_RATE_LIMIT_MAX_WAIT_SECONDS:-310}"
BROWSER_RATE_LIMIT_CANDIDATE_FILTER="$ROOT/ops/scripts/lib/company-reapplication-browser-rate-limit-candidate.jq"

exec 9>"$LOCK_FILE"
flock -n 9 || { echo COMPANY_REAPPLICATION_E2E_ALREADY_RUNNING >&2; exit 75; }
exec 8>"$DEPLOY_LOCK_FILE"
flock -w "$DEPLOY_LOCK_WAIT_SECONDS" 8 || { echo COMPANY_REAPPLICATION_DEPLOY_LOCK_TIMEOUT >&2; exit 75; }

TMP="$(mktemp -d)"
BROWSER_FIXTURES_CLEANED=0
BROWSER_RATE_LIMIT_BASELINE_CAPTURED=0
BROWSER_RATE_LIMIT_FIXTURE_CLEANED=0
BROWSER_RATE_LIMIT_BUCKET=""
BROWSER_RATE_LIMIT_BASELINE_FILE="$TMP/browser-rate-limit-baseline.json"
BROWSER_RATE_LIMIT_CURRENT_FILE="$TMP/browser-rate-limit-current.json"
BROWSER_RATE_LIMIT_CANDIDATE_FILE="$TMP/browser-rate-limit-candidate.json"
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
q() { carbonet_postgres_query "$1"; }

wait_for_browser_rate_limit_capacity() {
  local now bucket seconds_left max_count wait_seconds
  [[ "$BROWSER_RATE_LIMIT_WINDOW_GUARD_SECONDS" =~ ^[0-9]+$
     && "$BROWSER_RATE_LIMIT_MAX_WAIT_SECONDS" =~ ^[0-9]+$ ]] || {
    echo COMPANY_REAPPLICATION_RATE_LIMIT_PREFLIGHT_CONFIG_INVALID >&2
    return 2
  }
  while true; do
    now="$(date +%s)"
    bucket=$((now/BROWSER_RATE_LIMIT_WINDOW_SECONDS))
    seconds_left=$((BROWSER_RATE_LIMIT_WINDOW_SECONDS-(now%BROWSER_RATE_LIMIT_WINDOW_SECONDS)))
    max_count="$(q "select coalesce(max(request_count),0)
      from framework_public_lookup_rate_limit
      where project_id='${PROJECT_ID}'
        and endpoint_code in ('company-reapply-page','company-reapply-submit','company-status-detail')
        and window_bucket=${bucket}")"
    [[ "$max_count" =~ ^[0-9]+$ ]] || {
      echo COMPANY_REAPPLICATION_RATE_LIMIT_PREFLIGHT_INVALID >&2
      return 2
    }
    if (( max_count+BROWSER_RATE_LIMIT_REQUIRED_CAPACITY <= BROWSER_RATE_LIMIT_MAX_REQUESTS
          && seconds_left > BROWSER_RATE_LIMIT_WINDOW_GUARD_SECONDS )); then
      return 0
    fi
    wait_seconds=$((seconds_left+1))
    if (( wait_seconds > BROWSER_RATE_LIMIT_MAX_WAIT_SECONDS )); then
      echo "COMPANY_REAPPLICATION_RATE_LIMIT_PREFLIGHT_WAIT_EXCEEDED retryAfterSeconds=${wait_seconds}" >&2
      return 75
    fi
    echo "[company-reapplication-e2e] waiting for clean public limiter capacity seconds=${wait_seconds}" >&2
    sleep "$wait_seconds"
  done
}

capture_browser_rate_limit_rows() {
  local bucket="$1" output_file="$2"
  q "select coalesce(jsonb_agg(jsonb_build_object(
       'remoteHash',remote_addr_hash,
       'endpointCode',endpoint_code,
       'windowBucket',window_bucket,
       'requestCount',request_count)
       order by endpoint_code,remote_addr_hash),'[]'::jsonb)::text
     from framework_public_lookup_rate_limit
     where project_id='${PROJECT_ID}'
       and endpoint_code in ('company-reapply-page','company-reapply-submit','company-status-detail')
       and window_bucket=${bucket}" >"$output_file"
  jq -e 'type=="array" and all(.[];
      (.remoteHash|type)=="string" and (.remoteHash|test("^[0-9a-f]{64}$"))
      and (.endpointCode=="company-reapply-page" or .endpointCode=="company-reapply-submit" or .endpointCode=="company-status-detail")
      and (.windowBucket|type)=="number" and (.requestCount|type)=="number" and .requestCount>=0)' \
    "$output_file" >/dev/null
}

snapshot_browser_rate_limit_baseline() {
  local now seconds_left
  [[ -f "$BROWSER_RATE_LIMIT_CANDIDATE_FILTER" ]] || {
    echo COMPANY_REAPPLICATION_RATE_LIMIT_CANDIDATE_FILTER_MISSING >&2
    return 2
  }
  now="$(date +%s)"
  BROWSER_RATE_LIMIT_BUCKET=$((now/BROWSER_RATE_LIMIT_WINDOW_SECONDS))
  seconds_left=$((BROWSER_RATE_LIMIT_WINDOW_SECONDS-(now%BROWSER_RATE_LIMIT_WINDOW_SECONDS)))
  (( seconds_left > BROWSER_RATE_LIMIT_WINDOW_GUARD_SECONDS )) || {
    echo COMPANY_REAPPLICATION_RATE_LIMIT_BASELINE_WINDOW_TOO_SHORT >&2
    return 75
  }
  capture_browser_rate_limit_rows "$BROWSER_RATE_LIMIT_BUCKET" "$BROWSER_RATE_LIMIT_BASELINE_FILE" || {
    echo COMPANY_REAPPLICATION_RATE_LIMIT_BASELINE_INVALID >&2
    return 2
  }
  BROWSER_RATE_LIMIT_BASELINE_CAPTURED=1
}

resolve_browser_rate_limit_candidate() {
  capture_browser_rate_limit_rows "$BROWSER_RATE_LIMIT_BUCKET" "$BROWSER_RATE_LIMIT_CURRENT_FILE" || return 1
  jq -n \
    --argjson endpoints '["company-reapply-page","company-reapply-submit","company-status-detail"]' \
    --argjson ownedDelta "$BROWSER_RATE_LIMIT_OWNED_DELTA" \
    --argjson bucket "$BROWSER_RATE_LIMIT_BUCKET" \
    --slurpfile baseline "$BROWSER_RATE_LIMIT_BASELINE_FILE" \
    --slurpfile current "$BROWSER_RATE_LIMIT_CURRENT_FILE" \
    -f "$BROWSER_RATE_LIMIT_CANDIDATE_FILTER" >"$BROWSER_RATE_LIMIT_CANDIDATE_FILE"
}

cleanup_browser_rate_limit_fixture() {
  local strict="${1:-0}" remote_hash bucket owned_delta page_baseline submit_baseline detail_baseline
  [[ "$BROWSER_RATE_LIMIT_BASELINE_CAPTURED" == 1 && "$BROWSER_RATE_LIMIT_FIXTURE_CLEANED" != 1 ]] || return 0
  if ! resolve_browser_rate_limit_candidate 2>"$TMP/browser-rate-limit-candidate.err"; then
    if [[ "$strict" == 1 ]]; then
      echo COMPANY_REAPPLICATION_BROWSER_RATE_LIMIT_CANDIDATE_MISMATCH >&2
      return 1
    fi
    return 0
  fi
  remote_hash="$(jq -r '.remoteHash' "$BROWSER_RATE_LIMIT_CANDIDATE_FILE")"
  bucket="$(jq -r '.windowBucket' "$BROWSER_RATE_LIMIT_CANDIDATE_FILE")"
  owned_delta="$(jq -r '.ownedDelta' "$BROWSER_RATE_LIMIT_CANDIDATE_FILE")"
  page_baseline="$(jq -r '.rows[]|select(.endpointCode=="company-reapply-page")|.baselineCount' "$BROWSER_RATE_LIMIT_CANDIDATE_FILE")"
  submit_baseline="$(jq -r '.rows[]|select(.endpointCode=="company-reapply-submit")|.baselineCount' "$BROWSER_RATE_LIMIT_CANDIDATE_FILE")"
  detail_baseline="$(jq -r '.rows[]|select(.endpointCode=="company-status-detail")|.baselineCount' "$BROWSER_RATE_LIMIT_CANDIDATE_FILE")"
  [[ "$remote_hash" =~ ^[0-9a-f]{64}$
     && "$bucket" =~ ^[0-9]+$
     && "$owned_delta" == "$BROWSER_RATE_LIMIT_OWNED_DELTA"
     && "$page_baseline" =~ ^[0-9]+$
     && "$submit_baseline" =~ ^[0-9]+$
     && "$detail_baseline" =~ ^[0-9]+$ ]] || {
    [[ "$strict" == 1 ]] && echo COMPANY_REAPPLICATION_BROWSER_RATE_LIMIT_CANDIDATE_INVALID >&2
    return "$strict"
  }

  if ! q "begin;
    do \$browser_rate_cleanup\$
    declare
      locked_rows integer;
      updated_rows integer;
    begin
      select count(*) into locked_rows
      from (
        select 1
        from framework_public_lookup_rate_limit
        where project_id='${PROJECT_ID}'
          and remote_addr_hash='${remote_hash}'
          and endpoint_code in ('company-reapply-page','company-reapply-submit','company-status-detail')
          and window_bucket=${bucket}
        for update
      ) locked;
      if locked_rows <> 3 then
        raise exception 'browser limiter exact-row lock mismatch';
      end if;
      if exists (
        select 1
        from framework_public_lookup_rate_limit
        where project_id='${PROJECT_ID}'
          and remote_addr_hash='${remote_hash}'
          and endpoint_code in ('company-reapply-page','company-reapply-submit','company-status-detail')
          and window_bucket=${bucket}
          and request_count < case endpoint_code
            when 'company-reapply-page' then ${page_baseline}+${owned_delta}
            when 'company-reapply-submit' then ${submit_baseline}+${owned_delta}
            when 'company-status-detail' then ${detail_baseline}+${owned_delta}
          end
      ) then
        raise exception 'browser limiter owned delta is no longer present';
      end if;
      update framework_public_lookup_rate_limit
      set request_count=request_count-${owned_delta},updated_at=current_timestamp
      where project_id='${PROJECT_ID}'
        and remote_addr_hash='${remote_hash}'
        and endpoint_code in ('company-reapply-page','company-reapply-submit','company-status-detail')
        and window_bucket=${bucket};
      get diagnostics updated_rows = row_count;
      if updated_rows <> 3 then
        raise exception 'browser limiter exact-row update mismatch';
      end if;
      delete from framework_public_lookup_rate_limit
      where project_id='${PROJECT_ID}'
        and remote_addr_hash='${remote_hash}'
        and endpoint_code in ('company-reapply-page','company-reapply-submit','company-status-detail')
        and window_bucket=${bucket}
        and request_count=0;
    end
    \$browser_rate_cleanup\$;
    commit;" >/dev/null; then
    [[ "$strict" == 1 ]] && echo COMPANY_REAPPLICATION_BROWSER_RATE_LIMIT_CLEANUP_FAILED >&2
    return "$strict"
  fi
  BROWSER_RATE_LIMIT_FIXTURE_CLEANED=1
}

RUN_TOKEN="$(date +%s%N | sha256sum | cut -c1-8)"
NUMERIC_TOKEN="$(date +%s%N)"
DESKTOP_INSTT_ID="QA_UI_D_${RUN_TOKEN}"
MOBILE_INSTT_ID="QA_UI_M_${RUN_TOKEN}"
DESKTOP_BIZ_NO="${NUMERIC_TOKEN: -9}1"
MOBILE_BIZ_NO="${NUMERIC_TOKEN: -9}2"
DESKTOP_REP="QA_UI_D_${RUN_TOKEN:0:4}"
DESKTOP_UPDATED_REP="QA_UI_D_NEW_${RUN_TOKEN:0:4}"
MOBILE_REP="QA_UI_M_${RUN_TOKEN:0:4}"
REGISTERED_CONTACT="qa-browser@example.test"
DESKTOP_PDF="$TMP/reapplication-desktop.pdf"
MOBILE_PDF="$TMP/reapplication-mobile.pdf"
CASES_FILE="$TMP/browser-cases.json"
BROWSER_DB_FILE_PATHS=()

resolve_upload_path() {
  local db_path="$1" candidate="" upload_root_real
  upload_root_real="$(realpath -m -- "$UPLOAD_ROOT")"
  case "$db_path" in
    "$UPLOAD_ROOT"/*) candidate="$(realpath -m -- "$db_path")" ;;
    /var/file/instt/*) candidate="$(realpath -m -- "$UPLOAD_ROOT/${db_path#/var/file/instt/}")" ;;
    *) return 1 ;;
  esac
  case "$candidate" in "$upload_root_real"/*) printf '%s\n' "$candidate" ;; *) return 1 ;; esac
}

delete_browser_fixtures() {
  local strict="${1:-0}" path resolved remaining
  set +e
  mapfile -t BROWSER_DB_FILE_PATHS < <(q "select file_stre_path from comtninsttfile where project_id='${PROJECT_ID}' and trim(instt_id) in ('${DESKTOP_INSTT_ID}','${MOBILE_INSTT_ID}') order by file_sn")
  q "begin;
     set local session_replication_role=replica;
     delete from framework_company_reapplication_audit where project_id='${PROJECT_ID}' and instt_id in ('${DESKTOP_INSTT_ID}','${MOBILE_INSTT_ID}');
     delete from comtninsttfile where project_id='${PROJECT_ID}' and trim(instt_id) in ('${DESKTOP_INSTT_ID}','${MOBILE_INSTT_ID}');
     delete from comtninsttinfo where project_id='${PROJECT_ID}' and trim(instt_id) in ('${DESKTOP_INSTT_ID}','${MOBILE_INSTT_ID}');
     commit;" >/dev/null
  local db_status=$?
  for path in "${BROWSER_DB_FILE_PATHS[@]:-}"; do
    [[ -n "$path" ]] || continue
    resolved="$(resolve_upload_path "$path" 2>/dev/null)" || { [[ "$strict" == 1 ]] && echo "BROWSER_FIXTURE_CLEANUP_PATH_REFUSED" >&2; continue; }
    rm -f -- "$resolved"
    if [[ -e "$resolved" || -L "$resolved" ]]; then
      [[ "$strict" == 1 ]] && echo "BROWSER_FIXTURE_PHYSICAL_CLEANUP_FAILED" >&2
      db_status=1
    fi
  done
  remaining="$(q "select
    (select count(*) from framework_company_reapplication_audit where project_id='${PROJECT_ID}' and instt_id in ('${DESKTOP_INSTT_ID}','${MOBILE_INSTT_ID}'))+
    (select count(*) from comtninsttfile where project_id='${PROJECT_ID}' and trim(instt_id) in ('${DESKTOP_INSTT_ID}','${MOBILE_INSTT_ID}'))+
    (select count(*) from comtninsttinfo where project_id='${PROJECT_ID}' and trim(instt_id) in ('${DESKTOP_INSTT_ID}','${MOBILE_INSTT_ID}'))")"
  [[ "$remaining" == 0 ]] || db_status=1
  set -e
  if [[ "$strict" == 1 && "$db_status" != 0 ]]; then
    echo "BROWSER_FIXTURE_CLEANUP_FAILED remaining=$remaining" >&2
    return 1
  fi
  BROWSER_FIXTURES_CLEANED=1
}

cleanup() {
  local exit_code=$?
  set +e
  [[ "$BROWSER_RATE_LIMIT_FIXTURE_CLEANED" == 1 ]] || cleanup_browser_rate_limit_fixture 0
  [[ "$BROWSER_FIXTURES_CLEANED" == 1 ]] || delete_browser_fixtures 0
  rm -rf -- "$TMP"
  return "$exit_code"
}
trap cleanup EXIT

verify_release_identity() {
  local expected_runtime="$1" expected_validation="$2" stage="$3" marker current
  marker="$(tr -d '[:space:]' < "$DEPLOY_STATE_FILE" 2>/dev/null || true)"
  [[ "$marker" == "$expected_validation" ]] || {
    echo "COMPANY_REAPPLICATION_RELEASE_FRESHNESS_FAILED stage=$stage source=validation-marker" >&2
    exit 3
  }
  if [[ "$expected_runtime" != "$expected_validation" ]]; then
    git -C "$ROOT" merge-base --is-ancestor "$expected_runtime" "$expected_validation" || {
      echo "COMPANY_REAPPLICATION_RELEASE_FRESHNESS_FAILED stage=$stage source=commit-lineage" >&2; exit 3;
    }
    plan="$(bash "$ROOT/ops/scripts/plan-incremental-work.sh" "$expected_runtime" "$expected_validation" --format env)"
    for key in PLAN_RUNTIME_REQUIRED PLAN_FRONTEND_REQUIRED PLAN_BACKEND_REQUIRED PLAN_DATABASE_REQUIRED; do
      [[ "$(awk -F= -v key="$key" '$1==key{print $2}' <<<"$plan")" == false ]] || {
        echo "COMPANY_REAPPLICATION_RELEASE_FRESHNESS_FAILED stage=$stage source=unreleased-$key" >&2; exit 3;
      }
    done
  fi
  current="$(bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" "$PROCESS" "$STEP")"
  [[ "$(jq -r '.sourceCommit' <<<"$current")" == "$expected_runtime"
     && "$(jq -r '.processVersion' <<<"$current")" == "$PROCESS_VERSION"
     && "$(jq -r '.contractFingerprint' <<<"$current")" == "$CONTRACT_FINGERPRINT" ]] || {
    echo "COMPANY_REAPPLICATION_RELEASE_FRESHNESS_FAILED stage=$stage source=runtime-contract" >&2
    exit 3
  }
}

export RESONANCE_ROOT="$ROOT" K8S_NAMESPACE="$NAMESPACE" CARBONET_RUNTIME_BASE_URL="$BASE_URL"
export CARBONET_BROWSER_BASE_URL="$BROWSER_BASE_URL" CARBONET_REAPPLICATION_BROWSER_CASES_FILE="$CASES_FILE"
VALIDATION_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
[[ "$VALIDATION_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo COMPANY_REAPPLICATION_VALIDATION_COMMIT_INVALID >&2; exit 3; }
git -C "$ROOT" diff --quiet -- ops/scripts/validate-company-reapplication-browser.mjs ops/scripts/promote-screen-contract-after-e2e.sh \
  ops/scripts/lib/company-reapplication-browser-rate-limit-candidate.jq ops/tests/run-company-reapplication-business-e2e.sh || {
  echo COMPANY_REAPPLICATION_VALIDATION_HARNESS_DIRTY >&2; exit 3;
}
git -C "$ROOT" diff --cached --quiet -- ops/scripts/validate-company-reapplication-browser.mjs ops/scripts/promote-screen-contract-after-e2e.sh \
  ops/scripts/lib/company-reapplication-browser-rate-limit-candidate.jq ops/tests/run-company-reapplication-business-e2e.sh || {
  echo COMPANY_REAPPLICATION_VALIDATION_HARNESS_STAGED_DIRTY >&2; exit 3;
}

bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" "$PROCESS" "$STEP" >"$TMP/contract.json"
SOURCE_COMMIT="$(jq -r '.sourceCommit' "$TMP/contract.json")"
PROCESS_VERSION="$(jq -r '.processVersion' "$TMP/contract.json")"
CONTRACT_FINGERPRINT="$(jq -r '.contractFingerprint' "$TMP/contract.json")"
verify_release_identity "$SOURCE_COMMIT" "$VALIDATION_COMMIT" after-capture
bash "$ROOT/ops/scripts/validate-company-reapplication-runtime.sh" >"$TMP/runtime.json"

printf '%%PDF-1.4\n%% Resonance desktop reapplication browser fixture\n' >"$DESKTOP_PDF"
printf '%%PDF-1.4\n%% Resonance mobile reapplication browser fixture\n' >"$MOBILE_PDF"
[[ -s "$DESKTOP_PDF" && -s "$MOBILE_PDF" ]] || {
  echo COMPANY_REAPPLICATION_BROWSER_FIXTURE_EMPTY >&2; exit 1;
}
q "insert into comtninsttinfo(
     instt_id,project_id,instt_nm,entrprs_se_code,reprsnt_nm,bizrno,zip,adres,detail_adres,
     biz_reg_file_path,instt_sttus,rjct_rsn,rjct_pnttm,frst_regist_pnttm,last_updt_pnttm,
     charger_nm,charger_email,charger_tel)
   values
     ('${DESKTOP_INSTT_ID}','${PROJECT_ID}','QA BROWSER DESKTOP COMPANY','E','${DESKTOP_REP}','${DESKTOP_BIZ_NO}',
      '04524','QA SEOUL JUNG-GU','QA DESKTOP','', 'R','QA BROWSER REJECTION',current_timestamp,current_timestamp,current_timestamp,
      'QA DESKTOP MANAGER','${REGISTERED_CONTACT}','010-1000-0001'),
     ('${MOBILE_INSTT_ID}','${PROJECT_ID}','QA BROWSER MOBILE COMPANY','E','${MOBILE_REP}','${MOBILE_BIZ_NO}',
      '04524','QA SEOUL JUNG-GU','QA MOBILE','', 'R','QA BROWSER REJECTION',current_timestamp,current_timestamp,current_timestamp,
      'QA MOBILE MANAGER','${REGISTERED_CONTACT}','010-1000-0002');" >/dev/null

jq -n   --arg desktopBiz "$DESKTOP_BIZ_NO" --arg desktopRep "$DESKTOP_REP" --arg desktopUpdatedRep "$DESKTOP_UPDATED_REP" --arg desktopPdf "$DESKTOP_PDF"   --arg mobileBiz "$MOBILE_BIZ_NO" --arg mobileRep "$MOBILE_REP" --arg mobilePdf "$MOBILE_PDF"   --arg contact "$REGISTERED_CONTACT" '[
    {caseId:"desktop",viewport:"desktop",bizNo:$desktopBiz,repName:$desktopRep,registeredContact:$contact,
      chargerName:"QA DESKTOP MANAGER",chargerEmail:$contact,chargerTel:"010-1000-0001",
      detailAddress:"QA DESKTOP UPDATED",updatedRepName:$desktopUpdatedRep,pdfPath:$desktopPdf,fileName:"reapplication-desktop.pdf"},
    {caseId:"mobile",viewport:"mobile",bizNo:$mobileBiz,repName:$mobileRep,registeredContact:$contact,
     chargerName:"QA MOBILE MANAGER",chargerEmail:$contact,chargerTel:"010-1000-0002",
     detailAddress:"QA MOBILE UPDATED",pdfPath:$mobilePdf,fileName:"reapplication-mobile.pdf"}
  ]' >"$CASES_FILE"

wait_for_browser_rate_limit_capacity
snapshot_browser_rate_limit_baseline
node "$ROOT/ops/scripts/validate-company-reapplication-browser.mjs" >"$TMP/browser.json"
cleanup_browser_rate_limit_fixture 1

for instt_id in "$DESKTOP_INSTT_ID" "$MOBILE_INSTT_ID"; do
  persistence="$(q "select i.instt_sttus||'|'||
    (select count(*) from comtninsttfile f where f.project_id=i.project_id and trim(f.instt_id)=trim(i.instt_id))||'|'||
    (select count(*) from comtninsttfile f where f.project_id=i.project_id and trim(f.instt_id)=trim(i.instt_id) and f.scope_status='SCOPED' and f.file_sha256 ~ '^[0-9a-f]{64}$')||'|'||
    (select count(*) from framework_company_reapplication_audit a where a.project_id=i.project_id and a.instt_id=trim(i.instt_id)
      and a.actor_code='PUBLIC_APPLICANT' and a.command_code='RESUBMIT_COMPANY_APPLICATION'
      and a.from_state='REJECTED' and a.to_state='APPLIED' and a.evidence_file_count=1
      and length(a.change_hash)=64 and length(a.evidence_sha256[1])=64
      and a.evidence_sha256[1]=(select f.file_sha256 from comtninsttfile f where f.project_id=i.project_id and trim(f.instt_id)=trim(i.instt_id) order by f.file_sn desc limit 1))
    from comtninsttinfo i where i.project_id='${PROJECT_ID}' and trim(i.instt_id)='${instt_id}'")"
  [[ "$persistence" == "A|1|1|1" ]] || {
    echo "COMPANY_REAPPLICATION_BROWSER_PERSISTENCE_FAILED case=${instt_id:0:7} result=$persistence" >&2
    exit 1
  }
done
[[ "$(q "select reprsnt_nm from comtninsttinfo where project_id='${PROJECT_ID}' and trim(instt_id)='${DESKTOP_INSTT_ID}'")" == "$DESKTOP_UPDATED_REP" ]] || {
  echo COMPANY_REAPPLICATION_BROWSER_UPDATED_REPRESENTATIVE_FAILED >&2
  exit 1
}

delete_browser_fixtures 1

jq -n --arg validationCommit "$VALIDATION_COMMIT" --slurpfile runtime "$TMP/runtime.json" --slurpfile browser "$TMP/browser.json"   --slurpfile contract "$TMP/contract.json" '
  $runtime[0] * $browser[0] * {
    promotionEligible:true,
    validationCommit:$validationCommit,
    recovery:($runtime[0].cleanup * $runtime[0].replayBlocked),
    browserPersistence:1,
    browserRateLimitFixtureCleanup:1,
    browserFixtureCleanup:1,
    performanceP95Ms:$browser[0].performanceP95Ms,
    performanceSampleCount:$browser[0].performanceSampleCount,
    suiteDurationMs:($runtime[0].suiteDurationMs + $browser[0].suiteDurationMs),
    contract:$contract[0]
  }
  | if .performanceSampleCount<20 or .businessJourneyCount!=2 or .browserJourney!=1 or .browserPersistence!=1
      or .downloadVerified!=1 or .representativeUpdateVerified!=1
      or .browserRateLimitFixtureCleanup!=1
      or (.performanceP95Ms|type)!="number" or .performanceP95Ms<=0
    then error("browser business journey or 20-sample p95 evidence is incomplete") else . end
  ' >"$TMP/evidence.json"

bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh"   "$PROCESS" "$STEP" "$REQUIRED" PUBLIC --validate-only <"$TMP/evidence.json" >/dev/null
verify_release_identity "$SOURCE_COMMIT" "$VALIDATION_COMMIT" before-promotion
export E2E_VALIDATION_COMMIT="$VALIDATION_COMMIT" E2E_DEPLOYED_COMMIT="$SOURCE_COMMIT"
bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh"   "$PROCESS" "$STEP" "$REQUIRED" PUBLIC <"$TMP/evidence.json" >"$TMP/promotion.json"

code="$(curl -sS -G -o "$TMP/context.json" -w '%{http_code}'   --data-urlencode 'routePath=/join/companyReapply' --data-urlencode 'pageId=join-company-reapply'   --data-urlencode 'audience=PUBLIC' --data-urlencode "processCode=$PROCESS"   --data-urlencode "stepCode=$STEP" --data-urlencode 'actorCode=PUBLIC_APPLICANT'   "$BASE_URL/home/api/screen-context")"
[[ "$code" == 200 ]] && jq -e '.linked==true and .selectionRequired==false and .classification=="EXECUTABLE" and .reasonCode=="RUNTIME_WORKFLOW_RESOLVED"' "$TMP/context.json" >/dev/null || {
  echo "COMPANY_REAPPLICATION_POST_PROMOTION_CONTEXT_FAILED status=$code" >&2
  exit 1
}
verify_release_identity "$SOURCE_COMMIT" "$VALIDATION_COMMIT" after-post-context

jq -n --slurpfile evidence "$TMP/evidence.json" --slurpfile promotion "$TMP/promotion.json"   '{status:"PASS",evidence:$evidence[0],promotion:$promotion[0],postPromotionScreenContext:1,releaseFreshnessChecks:3}'
