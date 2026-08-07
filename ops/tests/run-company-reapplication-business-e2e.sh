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
REQUIRED="api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup,token,replayBlocked,screenContextPreflight,desktop,mobile,browserJourney,browserPersistence,businessJourneyDesktop,businessJourneyMobile"

exec 9>"$LOCK_FILE"
flock -n 9 || { echo COMPANY_REAPPLICATION_E2E_ALREADY_RUNNING >&2; exit 75; }
exec 8>"$DEPLOY_LOCK_FILE"
flock -w "$DEPLOY_LOCK_WAIT_SECONDS" 8 || { echo COMPANY_REAPPLICATION_DEPLOY_LOCK_TIMEOUT >&2; exit 75; }

TMP="$(mktemp -d)"
BROWSER_FIXTURES_CLEANED=0
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
q() { carbonet_postgres_query "$1"; }

RUN_TOKEN="$(date +%s%N | sha256sum | cut -c1-8)"
NUMERIC_TOKEN="$(date +%s%N)"
DESKTOP_INSTT_ID="QA_UI_D_${RUN_TOKEN}"
MOBILE_INSTT_ID="QA_UI_M_${RUN_TOKEN}"
DESKTOP_BIZ_NO="${NUMERIC_TOKEN: -9}1"
MOBILE_BIZ_NO="${NUMERIC_TOKEN: -9}2"
DESKTOP_REP="QA_UI_D_${RUN_TOKEN:0:4}"
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
git -C "$ROOT" diff --quiet -- ops/scripts/validate-company-reapplication-browser.mjs ops/scripts/promote-screen-contract-after-e2e.sh ops/tests/run-company-reapplication-business-e2e.sh || {
  echo COMPANY_REAPPLICATION_VALIDATION_HARNESS_DIRTY >&2; exit 3;
}
git -C "$ROOT" diff --cached --quiet -- ops/scripts/validate-company-reapplication-browser.mjs ops/scripts/promote-screen-contract-after-e2e.sh ops/tests/run-company-reapplication-business-e2e.sh || {
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

jq -n   --arg desktopBiz "$DESKTOP_BIZ_NO" --arg desktopRep "$DESKTOP_REP" --arg desktopPdf "$DESKTOP_PDF"   --arg mobileBiz "$MOBILE_BIZ_NO" --arg mobileRep "$MOBILE_REP" --arg mobilePdf "$MOBILE_PDF"   --arg contact "$REGISTERED_CONTACT" '[
    {caseId:"desktop",viewport:"desktop",bizNo:$desktopBiz,repName:$desktopRep,registeredContact:$contact,
     chargerName:"QA DESKTOP MANAGER",chargerEmail:$contact,chargerTel:"010-1000-0001",
     detailAddress:"QA DESKTOP UPDATED",pdfPath:$desktopPdf,fileName:"reapplication-desktop.pdf"},
    {caseId:"mobile",viewport:"mobile",bizNo:$mobileBiz,repName:$mobileRep,registeredContact:$contact,
     chargerName:"QA MOBILE MANAGER",chargerEmail:$contact,chargerTel:"010-1000-0002",
     detailAddress:"QA MOBILE UPDATED",pdfPath:$mobilePdf,fileName:"reapplication-mobile.pdf"}
  ]' >"$CASES_FILE"

node "$ROOT/ops/scripts/validate-company-reapplication-browser.mjs" >"$TMP/browser.json"

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

delete_browser_fixtures 1

jq -n --arg validationCommit "$VALIDATION_COMMIT" --slurpfile runtime "$TMP/runtime.json" --slurpfile browser "$TMP/browser.json"   --slurpfile contract "$TMP/contract.json" '
  $runtime[0] * $browser[0] * {
    promotionEligible:true,
    validationCommit:$validationCommit,
    recovery:($runtime[0].cleanup * $runtime[0].replayBlocked),
    browserPersistence:1,
    browserFixtureCleanup:1,
    performanceP95Ms:$browser[0].performanceP95Ms,
    performanceSampleCount:$browser[0].performanceSampleCount,
    suiteDurationMs:($runtime[0].suiteDurationMs + $browser[0].suiteDurationMs),
    contract:$contract[0]
  }
  | if .performanceSampleCount<20 or .businessJourneyCount!=2 or .browserJourney!=1 or .browserPersistence!=1
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
