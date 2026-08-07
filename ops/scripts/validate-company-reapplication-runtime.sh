#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
PROJECT_ID="${CARBONET_REAPPLICATION_TEST_PROJECT_ID:-P003}"
UPLOAD_ROOT="${CARBONET_FILE_INSTT_DIR:-/opt/resonance-data/carbonet/files/instt}"
STARTED_AT_MS="$(( $(date +%s%N) / 1000000 ))"
RUN_TOKEN="$(date +%s%N | sha256sum | cut -c1-10)"
NUMERIC_TOKEN="$(date +%s%N)"
INSTT_ID="QA_REAP_${RUN_TOKEN}"
INSTT_ID="${INSTT_ID:0:20}"
if [[ "${INSTT_ID: -1}" == "X" ]]; then
  TAMPERED_INSTT_ID="${INSTT_ID::-1}Y"
else
  TAMPERED_INSTT_ID="${INSTT_ID::-1}X"
fi
BIZ_NO="${NUMERIC_TOKEN: -10}"
REP_NAME="QA_REAP_REP_${RUN_TOKEN:0:4}"
COOKIE="$(mktemp)"
BODY="$(mktemp)"
PDF_FIXTURE="$(mktemp --suffix=.pdf)"
STATUS_HEADERS="$(mktemp)"
STATUS_FILE="$(mktemp)"
STATUS_COOKIE="$(mktemp)"
DB_FILE_PATH=""
RESOLVED_CLEANUP_PATH=""
RATE_LIMIT_WINDOW_SECONDS=300
RATE_LIMIT_ENDPOINTS=()
declare -A RATE_LIMIT_WINDOW_BUCKETS=()
declare -A RATE_LIMIT_REMOTE_HASHES=()
declare -A RATE_LIMIT_REQUEST_COUNTS=()
declare -A RATE_LIMIT_FIXTURE_CLEANED=()
declare -A RATE_LIMIT_BASELINE_COUNTS=()

source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
q() { carbonet_postgres_query "$1"; }

prepare_public_rate_limit_fixture() {
  local endpoint="${1:?endpoint is required}" now seconds_left remote_hash request_count bucket key
  [[ "$endpoint" =~ ^[a-z0-9-]+$ ]] || return 1
  now="$(date +%s)"
  seconds_left=$((RATE_LIMIT_WINDOW_SECONDS-(now%RATE_LIMIT_WINDOW_SECONDS)))
  if (( seconds_left <= 20 )); then
    sleep $((seconds_left+1))
    now="$(date +%s)"
  fi
  bucket=$((now/RATE_LIMIT_WINDOW_SECONDS))
  RATE_LIMIT_WINDOW_BUCKETS["$endpoint"]="$bucket"
  RATE_LIMIT_REQUEST_COUNTS["$endpoint"]=0
  RATE_LIMIT_FIXTURE_CLEANED["$endpoint"]=0
  RATE_LIMIT_ENDPOINTS+=("$endpoint")
  while IFS='|' read -r remote_hash request_count; do
    [[ -n "$remote_hash" ]] || continue
    [[ "$remote_hash" =~ ^[0-9a-f]{64}$ && "$request_count" =~ ^[0-9]+$ ]] || {
      echo '[company-reapplication-e2e] FAIL invalid limiter baseline row' >&2
      return 1
    }
    key="$endpoint|$remote_hash"
    RATE_LIMIT_BASELINE_COUNTS["$key"]="$request_count"
  done < <(q "select remote_addr_hash||'|'||request_count
    from framework_public_lookup_rate_limit
    where project_id='${PROJECT_ID}' and endpoint_code='${endpoint}'
      and window_bucket=${bucket}")
}

capture_public_rate_limit_identity() {
  local endpoint="${1:?endpoint is required}" current_bucket bucket remote_hash request_count baseline delta key
  local changed_rows=0 candidate_rows=0 candidate_hash=""
  bucket="${RATE_LIMIT_WINDOW_BUCKETS[$endpoint]:-0}"
  current_bucket=$(($(date +%s)/RATE_LIMIT_WINDOW_SECONDS))
  [[ "$current_bucket" == "$bucket" ]] || {
    echo '[company-reapplication-e2e] FAIL limiter window changed during identity capture' >&2
    return 1
  }
  while IFS='|' read -r remote_hash request_count; do
    [[ -n "$remote_hash" ]] || continue
    [[ "$remote_hash" =~ ^[0-9a-f]{64}$ && "$request_count" =~ ^[0-9]+$ ]] || return 1
    key="$endpoint|$remote_hash"
    baseline="${RATE_LIMIT_BASELINE_COUNTS[$key]:-0}"
    delta=$((request_count-baseline))
    if (( delta != 0 )); then
      changed_rows=$((changed_rows+1))
      if (( delta == 1 )); then
        candidate_rows=$((candidate_rows+1))
        candidate_hash="$remote_hash"
      fi
    fi
  done < <(q "select remote_addr_hash||'|'||request_count
    from framework_public_lookup_rate_limit
    where project_id='${PROJECT_ID}' and endpoint_code='${endpoint}'
      and window_bucket=${bucket}")
  [[ "$changed_rows" == 1 && "$candidate_rows" == 1 && "$candidate_hash" =~ ^[0-9a-f]{64}$ ]] || {
    echo "[company-reapplication-e2e] FAIL limiter identity is not uniquely attributable endpoint=$endpoint" >&2
    return 1
  }
  RATE_LIMIT_REMOTE_HASHES["$endpoint"]="$candidate_hash"
  RATE_LIMIT_REQUEST_COUNTS["$endpoint"]=1
}

track_public_rate_limit_request() {
  local endpoint="${1:?endpoint is required}" current_bucket bucket remote_hash
  bucket="${RATE_LIMIT_WINDOW_BUCKETS[$endpoint]:-0}"
  remote_hash="${RATE_LIMIT_REMOTE_HASHES[$endpoint]:-}"
  current_bucket=$(($(date +%s)/RATE_LIMIT_WINDOW_SECONDS))
  [[ "$current_bucket" == "$bucket" && "$remote_hash" =~ ^[0-9a-f]{64}$ ]] || {
    echo "[company-reapplication-e2e] FAIL limiter window or identity changed endpoint=$endpoint" >&2
    return 1
  }
  RATE_LIMIT_REQUEST_COUNTS["$endpoint"]=$(( ${RATE_LIMIT_REQUEST_COUNTS[$endpoint]:-0}+1 ))
}

cleanup_public_rate_limit_fixture() {
  local endpoint="${1:?endpoint is required}" strict="${2:-0}" adjusted action remaining_count
  local bucket="${RATE_LIMIT_WINDOW_BUCKETS[$endpoint]:-0}"
  local remote_hash="${RATE_LIMIT_REMOTE_HASHES[$endpoint]:-}"
  local owned="${RATE_LIMIT_REQUEST_COUNTS[$endpoint]:-0}"
  local cleaned="${RATE_LIMIT_FIXTURE_CLEANED[$endpoint]:-0}"
  if [[ "$cleaned" != 0 || "$owned" -le 0 || "$bucket" -le 0 || ! "$remote_hash" =~ ^[0-9a-f]{64}$ ]]; then
    [[ "$strict" == 0 ]] && return 0
    echo "[company-reapplication-e2e] FAIL incomplete limiter cleanup state endpoint=$endpoint" >&2
    return 1
  fi
  set +e
  adjusted="$(q "with locked as (
      select request_count
        from framework_public_lookup_rate_limit
       where project_id='${PROJECT_ID}' and remote_addr_hash='${remote_hash}'
         and endpoint_code='${endpoint}' and window_bucket=${bucket}
       for update
    ), deleted as (
      delete from framework_public_lookup_rate_limit rate using locked
       where rate.project_id='${PROJECT_ID}' and rate.remote_addr_hash='${remote_hash}'
         and rate.endpoint_code='${endpoint}' and rate.window_bucket=${bucket}
         and locked.request_count=${owned}
      returning 'DELETE'::text as action,0::integer as remaining_count
    ), updated as (
      update framework_public_lookup_rate_limit rate set request_count=rate.request_count-${owned}
        from locked
       where rate.project_id='${PROJECT_ID}' and rate.remote_addr_hash='${remote_hash}'
         and rate.endpoint_code='${endpoint}' and rate.window_bucket=${bucket}
         and locked.request_count>${owned}
      returning 'UPDATE'::text as action,rate.request_count as remaining_count
    )
    select action||'|'||remaining_count from deleted
    union all select action||'|'||remaining_count from updated")"
  IFS='|' read -r action remaining_count <<<"$adjusted"
  if [[ "$action" =~ ^(DELETE|UPDATE)$ && "$remaining_count" =~ ^[0-9]+$ ]]; then
    RATE_LIMIT_FIXTURE_CLEANED["$endpoint"]=1
    RATE_LIMIT_REQUEST_COUNTS["$endpoint"]=0
  fi
  set -e
  if [[ "$strict" == 1 && "${RATE_LIMIT_FIXTURE_CLEANED[$endpoint]:-0}" != 1 ]]; then
    echo "[company-reapplication-e2e] FAIL rate-limit fixture cleanup endpoint=$endpoint" >&2
    return 1
  fi
}

cleanup_all_public_rate_limit_fixtures() {
  local strict="${1:-0}" endpoint result=0
  ((${#RATE_LIMIT_ENDPOINTS[@]} > 0)) || return 0
  for endpoint in "${RATE_LIMIT_ENDPOINTS[@]}"; do
    cleanup_public_rate_limit_fixture "$endpoint" "$strict" || result=1
  done
  return "$result"
}

cleanup() {
  local exit_code=$?
  trap - EXIT
  set +e
  cleanup_all_public_rate_limit_fixtures 0
  RESOLVED_CLEANUP_PATH=""
  if [[ -n "$DB_FILE_PATH" ]]; then
    case "$DB_FILE_PATH" in
      "$UPLOAD_ROOT"/*) RESOLVED_CLEANUP_PATH="$(realpath -m -- "$DB_FILE_PATH")" ;;
      /var/file/instt/*)
        RESOLVED_CLEANUP_PATH="$(realpath -m -- "$UPLOAD_ROOT/${DB_FILE_PATH#/var/file/instt/}")"
        ;;
      *) echo "[company-reapplication-e2e] WARN cleanup refused out-of-root path" >&2 ;;
    esac
    if [[ -n "$RESOLVED_CLEANUP_PATH" ]]; then
      case "$RESOLVED_CLEANUP_PATH" in
        "$(realpath -m -- "$UPLOAD_ROOT")"/*) rm -f -- "$RESOLVED_CLEANUP_PATH" ;;
        *) echo "[company-reapplication-e2e] WARN cleanup refused resolved out-of-root path" >&2; RESOLVED_CLEANUP_PATH="" ;;
      esac
    fi
  fi
  q "begin;
     set local session_replication_role=replica;
     delete from framework_company_reapplication_audit where project_id='${PROJECT_ID}' and instt_id='${INSTT_ID}';
     delete from comtninsttfile where project_id='${PROJECT_ID}' and trim(instt_id)='${INSTT_ID}';
     delete from comtninsttinfo where project_id='${PROJECT_ID}' and trim(instt_id)='${INSTT_ID}';
     commit;" >/dev/null 2>&1 || true
  rm -f "$COOKIE" "$BODY" "$PDF_FIXTURE" "$STATUS_HEADERS" "$STATUS_FILE" "$STATUS_COOKIE"
  set -e
  return "$exit_code"
}
trap cleanup EXIT

node "$ROOT/projects/carbonet-frontend/source/scripts/verify-join-company-status-security-contract.mjs" >/dev/null
printf '%%PDF-1.4\n%% Resonance company reapplication E2E fixture\n' >"$PDF_FIXTURE"

q "insert into comtninsttinfo(
     instt_id,project_id,instt_nm,entrprs_se_code,reprsnt_nm,bizrno,zip,adres,detail_adres,
     biz_reg_file_path,instt_sttus,rjct_rsn,rjct_pnttm,frst_regist_pnttm,last_updt_pnttm,
     charger_nm,charger_email,charger_tel)
   values('${INSTT_ID}','${PROJECT_ID}','QA REAPPLICATION COMPANY','E','${REP_NAME}','${BIZ_NO}',
     '04524','QA SEOUL JUNG-GU','QA ONLY','', 'R','QA REJECTION EVIDENCE REQUIRED',current_timestamp,
     current_timestamp,current_timestamp,'QA MANAGER','qa-reapply@example.test','010-0000-0000');" >/dev/null

page_code="$(curl -sS -c "$COOKIE" -b "$COOKIE" -o "$BODY" -w '%{http_code}' "$BASE_URL/join/companyReapply")"
[[ "$page_code" == 200 ]] && grep -qi '<!doctype html' "$BODY" || {
  echo "[company-reapplication-e2e] FAIL direct-page status=$page_code" >&2
  exit 1
}

IDENTITY_PAYLOAD="$(jq -cn --arg bizNo "$BIZ_NO" --arg repName "$REP_NAME" \
  --arg registeredContact 'qa-reapply@example.test' \
  '{bizNo:$bizNo,repName:$repName,registeredContact:$registeredContact}')"
prepare_public_rate_limit_fixture company-reapply-page
lookup_code="$(curl -sS -c "$COOKIE" -b "$COOKIE" -o "$BODY" -w '%{http_code}' \
  -H 'Content-Type: application/json' --data "$IDENTITY_PAYLOAD" \
  "$BASE_URL/join/api/company-reapply/page")"
capture_public_rate_limit_identity company-reapply-page
[[ "$lookup_code" == 200 ]] || {
  echo "[company-reapplication-e2e] FAIL lookup status=$lookup_code" >&2
  exit 1
}
jq -e '.success==true and .result.insttId!=null and .result.insttSttus=="R" and (.reapplyToken|length)>=20' "$BODY" >/dev/null
if jq -e '.. | objects | (has("fileStrePath") or has("bizRegFilePath") or has("rawInsttId"))' "$BODY" >/dev/null; then
  echo '[company-reapplication-e2e] FAIL public response exposes a forbidden storage field' >&2
  exit 1
fi
REAPPLY_TOKEN="$(jq -r '.reapplyToken' "$BODY")"
REAPPLY_LOOKUP_HANDLE="$(jq -r '.lookupHandle' "$BODY")"
[[ "$REAPPLY_LOOKUP_HANDLE" =~ ^[0-9a-f-]{36}$ ]] || { echo '[company-reapplication-e2e] FAIL missing opaque reapply lookup handle' >&2; exit 1; }

prepare_public_rate_limit_fixture company-reapply-submit
missing_token_code="$(curl -sS -c "$COOKIE" -b "$COOKIE" -o "$BODY" -w '%{http_code}' \
  -F "insttId=$INSTT_ID" -F 'agencyName=QA REAPPLICATION COMPANY' -F "representativeName=$REP_NAME" \
  -F "bizRegistrationNumber=$BIZ_NO" -F 'zipCode=04524' -F 'companyAddress=QA SEOUL JUNG-GU' \
  -F 'chargerName=QA MANAGER' -F 'chargerEmail=qa-reapply@example.test' -F 'chargerTel=010-0000-0000' \
  -F "fileUploads=@$PDF_FIXTURE;type=application/pdf" "$BASE_URL/join/api/company-reapply")"
capture_public_rate_limit_identity company-reapply-submit
[[ "$missing_token_code" == 403 ]] || {
  echo "[company-reapplication-e2e] FAIL missing-token status=$missing_token_code" >&2
  exit 1
}

missing_file_code="$(curl -sS -c "$COOKIE" -b "$COOKIE" -o "$BODY" -w '%{http_code}' \
  -F "reapplyToken=$REAPPLY_TOKEN" -F "insttId=$INSTT_ID" -F 'agencyName=QA REAPPLICATION COMPANY' \
  -F "representativeName=$REP_NAME" -F "bizRegistrationNumber=$BIZ_NO" -F 'zipCode=04524' \
  -F 'companyAddress=QA SEOUL JUNG-GU' -F 'chargerName=QA MANAGER' \
  -F 'chargerEmail=qa-reapply@example.test' -F 'chargerTel=010-0000-0000' \
  "$BASE_URL/join/api/company-reapply")"
track_public_rate_limit_request company-reapply-submit
[[ "$missing_file_code" == 400 ]] || {
  echo "[company-reapplication-e2e] FAIL missing-file status=$missing_file_code" >&2
  exit 1
}

tampered_identity_code="$(curl -sS -c "$COOKIE" -b "$COOKIE" -o "$BODY" -w '%{http_code}' \
  -F "reapplyToken=$REAPPLY_TOKEN" -F "insttId=$TAMPERED_INSTT_ID" \
  -F 'agencyName=QA REAPPLICATION COMPANY' -F "representativeName=$REP_NAME" \
  -F "bizRegistrationNumber=$BIZ_NO" -F 'zipCode=04524' -F 'companyAddress=QA SEOUL JUNG-GU' \
  -F 'chargerName=QA MANAGER' -F 'chargerEmail=qa-reapply@example.test' -F 'chargerTel=010-0000-0000' \
  -F "fileUploads=@$PDF_FIXTURE;type=application/pdf" "$BASE_URL/join/api/company-reapply")"
track_public_rate_limit_request company-reapply-submit
[[ "$tampered_identity_code" == 403 ]] || {
  echo "[company-reapplication-e2e] FAIL token-identity-binding status=$tampered_identity_code" >&2
  exit 1
}

# A rejected token is consumed. Re-identify before the valid command.
lookup_code="$(curl -sS -c "$COOKIE" -b "$COOKIE" -o "$BODY" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  --data "$(jq -cn --arg lookupHandle "$REAPPLY_LOOKUP_HANDLE" '{lookupHandle:$lookupHandle}')" \
  "$BASE_URL/join/api/company-reapply/page")"
track_public_rate_limit_request company-reapply-page
[[ "$lookup_code" == 200 ]] || {
  echo "[company-reapplication-e2e] FAIL token-refresh status=$lookup_code" >&2
  exit 1
}
cleanup_public_rate_limit_fixture company-reapply-page 1
REAPPLY_TOKEN="$(jq -r '.reapplyToken' "$BODY")"

submit_code="$(curl -sS -c "$COOKIE" -b "$COOKIE" -o "$BODY" -w '%{http_code}' \
  -F "reapplyToken=$REAPPLY_TOKEN" -F "insttId=$INSTT_ID" -F 'agencyName=QA REAPPLICATION COMPANY UPDATED' \
  -F "representativeName=$REP_NAME" -F "bizRegistrationNumber=$BIZ_NO" -F 'zipCode=04524' \
  -F 'companyAddress=QA SEOUL JUNG-GU' -F 'companyAddressDetail=QA UPDATED ADDRESS' \
  -F 'chargerName=QA MANAGER' -F 'chargerEmail=qa-reapply@example.test' -F 'chargerTel=010-0000-0000' \
  -F "fileUploads=@$PDF_FIXTURE;type=application/pdf" "$BASE_URL/join/api/company-reapply")"
track_public_rate_limit_request company-reapply-submit
[[ "$submit_code" == 200 ]] && jq -e '.success==true and .insttId!=null' "$BODY" >/dev/null || {
  echo "[company-reapplication-e2e] FAIL submit status=$submit_code" >&2
  exit 1
}
jq -e '.receipt.applicationVersion==1 and .receipt.evidenceFileCount==1
  and (.receipt.changeHash|length)==64 and (.receipt.fileIds|length)==1
  and (.receipt.fileSha256s|length)==1 and (.receipt.fileSha256s[0]|length)==64' "$BODY" >/dev/null || {
  echo '[company-reapplication-e2e] FAIL persistence receipt contract' >&2
  exit 1
}
RECEIPT_HASH="$(jq -r '.receipt.changeHash' "$BODY")"
RECEIPT_FILE_SHA="$(jq -r '.receipt.fileSha256s[0]' "$BODY")"

db_result="$(q "select i.instt_sttus||'|'||
     (select count(*) from comtninsttfile f where f.project_id=i.project_id and trim(f.instt_id)=trim(i.instt_id))||'|'||
     (select count(*) from framework_company_reapplication_audit a where a.project_id=i.project_id and a.instt_id=trim(i.instt_id))
   from comtninsttinfo i where i.project_id='${PROJECT_ID}' and trim(i.instt_id)='${INSTT_ID}'")"
[[ "$db_result" == 'A|1|1' ]] || {
  echo "[company-reapplication-e2e] FAIL persistence=$db_result" >&2
  exit 1
}
audit_result="$(q "select actor_code||'|'||command_code||'|'||from_state||'|'||to_state||'|'||
    evidence_file_count||'|'||length(change_hash)||'|'||coalesce(rejection_reason,'')
  from framework_company_reapplication_audit
  where project_id='${PROJECT_ID}' and instt_id='${INSTT_ID}'
  order by application_version desc limit 1")"
[[ "$audit_result" == 'PUBLIC_APPLICANT|RESUBMIT_COMPANY_APPLICATION|REJECTED|APPLIED|1|64|QA REJECTION EVIDENCE REQUIRED' ]] || {
  echo "[company-reapplication-e2e] FAIL audit-contract=$audit_result" >&2
  exit 1
}
db_hashes="$(q "select change_hash||'|'||evidence_sha256[1]
  from framework_company_reapplication_audit
  where project_id='${PROJECT_ID}' and instt_id='${INSTT_ID}'
  order by application_version desc limit 1")"
[[ "$db_hashes" == "$RECEIPT_HASH|$RECEIPT_FILE_SHA" ]] || {
  echo '[company-reapplication-e2e] FAIL receipt/database hash mismatch' >&2
  exit 1
}
DB_FILE_PATH="$(q "select file_stre_path from comtninsttfile where project_id='${PROJECT_ID}' and trim(instt_id)='${INSTT_ID}' order by file_sn desc limit 1")"
prepare_public_rate_limit_fixture company-status-detail

status_code="$(curl -sS -c "$COOKIE" -b "$COOKIE" -D "$STATUS_HEADERS" -o "$BODY" -w '%{http_code}' \
  -H 'Content-Type: application/json' --data "$IDENTITY_PAYLOAD" \
  "$BASE_URL/join/api/company-status/detail")"
capture_public_rate_limit_identity company-status-detail
[[ "$status_code" == 200 ]] || {
  echo "[company-reapplication-e2e] FAIL status-lookup status=$status_code" >&2
  exit 1
}
grep -Eqi '^Cache-Control:.*no-store' "$STATUS_HEADERS" && grep -Eqi '^Pragma:.*no-cache' "$STATUS_HEADERS" || {
  echo '[company-reapplication-e2e] FAIL status response cache policy' >&2
  exit 1
}
jq -e '
  .success==true and
  ((.result|keys|sort)==(["bizrno","entrprsSeCode","frstRegistPnttm","insttId","insttNm","insttSttus","lastUpdtPnttm","reprsntNm","rjctPnttm","rjctRsn"]|sort)) and
  (.insttFiles|length)==1 and
  ((.insttFiles[0]|keys|sort)==(["downloadToken","fileExtsn","fileMg","fileSn","orignlFileNm","regDate"]|sort)) and
  (.insttFiles[0].downloadToken|length)>=20' "$BODY" >/dev/null || {
  echo '[company-reapplication-e2e] FAIL status public allowlist/token contract' >&2
  exit 1
}
STATUS_LOOKUP_HANDLE="$(jq -r '.lookupHandle' "$BODY")"
[[ "$STATUS_LOOKUP_HANDLE" =~ ^[0-9a-f-]{36}$ ]] || {
  echo '[company-reapplication-e2e] FAIL missing opaque status lookup handle' >&2
  exit 1
}
status_handle_code="$(curl -sS -c "$COOKIE" -b "$COOKIE" -o "$BODY" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  --data "$(jq -cn --arg lookupHandle "$STATUS_LOOKUP_HANDLE" '{lookupHandle:$lookupHandle}')" \
  "$BASE_URL/join/api/company-status/detail")"
track_public_rate_limit_request company-status-detail
[[ "$status_handle_code" == 200 ]] && [[ "$(jq -r '.lookupHandle' "$BODY")" == "$STATUS_LOOKUP_HANDLE" ]] || {
  echo "[company-reapplication-e2e] FAIL opaque-handle continuation status=$status_handle_code" >&2
  exit 1
}
if jq -e '.. | objects | (has("fileId") or has("fileStrePath") or has("fileSha256") or has("chargerEmail") or has("detailAdres"))' "$BODY" >/dev/null; then
  echo '[company-reapplication-e2e] FAIL status response exposes a forbidden field' >&2
  exit 1
fi
STATUS_DOWNLOAD_TOKEN="$(jq -r '.insttFiles[0].downloadToken' "$BODY")"
download_code="$(curl -sS -c "$COOKIE" -b "$COOKIE" -D "$STATUS_HEADERS" -o "$STATUS_FILE" -w '%{http_code}' \
  --get --data-urlencode "downloadToken=$STATUS_DOWNLOAD_TOKEN" "$BASE_URL/join/downloadInsttFile")"
[[ "$download_code" == 200 ]] || {
  echo "[company-reapplication-e2e] FAIL status-download status=$download_code" >&2
  exit 1
}
grep -Eqi '^Cache-Control:.*no-store' "$STATUS_HEADERS" || {
  echo '[company-reapplication-e2e] FAIL download cache policy' >&2
  exit 1
}
[[ "$(sha256sum "$STATUS_FILE" | awk '{print $1}')" == "$RECEIPT_FILE_SHA" ]] || {
  echo '[company-reapplication-e2e] FAIL downloaded evidence hash mismatch' >&2
  exit 1
}

bad_identity_code="$(curl -sS -c "$COOKIE" -b "$COOKIE" -o "$BODY" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  --data "$(jq -cn --arg appNo "$INSTT_ID" --arg repName 'WRONG-REPRESENTATIVE' \
    --arg registeredContact 'qa-reapply@example.test' \
    '{appNo:$appNo,repName:$repName,registeredContact:$registeredContact}')" \
  "$BASE_URL/join/api/company-status/detail")"
track_public_rate_limit_request company-status-detail
[[ "$bad_identity_code" == 400 ]] && jq -e '.errorCode=="STATUS_LOOKUP_NOT_AVAILABLE"' "$BODY" >/dev/null || {
  echo "[company-reapplication-e2e] FAIL status fail-closed identity status=$bad_identity_code" >&2
  exit 1
}

for index in $(seq 1 7); do
  limited_code="$(curl -sS -c "$STATUS_COOKIE" -b "$STATUS_COOKIE" -o "$BODY" -w '%{http_code}' \
    -H 'Content-Type: application/json' -H "X-Forwarded-For: 203.0.113.$index" \
    --data "$IDENTITY_PAYLOAD" "$BASE_URL/join/api/company-status/detail")"
  track_public_rate_limit_request company-status-detail
  [[ "$limited_code" == 200 ]] || {
    echo "[company-reapplication-e2e] FAIL status-rate prelimit index=$index status=$limited_code" >&2
    exit 1
  }
done
limited_code="$(curl -sS -c "$STATUS_COOKIE" -b "$STATUS_COOKIE" -o "$BODY" -w '%{http_code}' \
  -H 'Content-Type: application/json' -H 'X-Forwarded-For: 198.51.100.250' \
  --data "$IDENTITY_PAYLOAD" "$BASE_URL/join/api/company-status/detail")"
track_public_rate_limit_request company-status-detail
[[ "$limited_code" == 429 ]] && jq -e '.errorCode=="STATUS_LOOKUP_NOT_AVAILABLE"' "$BODY" >/dev/null || {
  echo "[company-reapplication-e2e] FAIL status-rate-limit status=$limited_code" >&2
  exit 1
}
cleanup_public_rate_limit_fixture company-status-detail 1

legacy_code="$(curl -sS -X POST -c "$COOKIE" -b "$COOKIE" -o "$BODY" -w '%{http_code}' \
  "$BASE_URL/join/companyReapplySubmit")"
[[ "$legacy_code" == 410 ]] && jq -e '.errorCode=="LEGACY_REAPPLICATION_ENDPOINT_RETIRED"' "$BODY" >/dev/null || {
  echo "[company-reapplication-e2e] FAIL legacy endpoint retirement status=$legacy_code" >&2
  exit 1
}

repeat_code="$(curl -sS -c "$COOKIE" -b "$COOKIE" -o "$BODY" -w '%{http_code}' \
  -F "reapplyToken=$REAPPLY_TOKEN" -F "insttId=$INSTT_ID" -F 'agencyName=QA REAPPLICATION COMPANY UPDATED' \
  -F "representativeName=$REP_NAME" -F "bizRegistrationNumber=$BIZ_NO" -F 'zipCode=04524' \
  -F 'companyAddress=QA SEOUL JUNG-GU' -F 'chargerName=QA MANAGER' \
  -F 'chargerEmail=qa-reapply@example.test' -F 'chargerTel=010-0000-0000' \
  -F "fileUploads=@$PDF_FIXTURE;type=application/pdf" "$BASE_URL/join/api/company-reapply")"
track_public_rate_limit_request company-reapply-submit
[[ "$repeat_code" == 403 || "$repeat_code" == 409 ]] || {
  echo "[company-reapplication-e2e] FAIL replay status=$repeat_code" >&2
  exit 1
}
cleanup_public_rate_limit_fixture company-reapply-submit 1

context_code="$(curl -sS -G -o "$BODY" -w '%{http_code}' \
  --data-urlencode 'routePath=/join/companyReapply' --data-urlencode 'pageId=join-company-reapply' \
  --data-urlencode 'audience=PUBLIC' --data-urlencode 'processCode=COMPANY_REAPPLICATION_PUBLIC' \
  --data-urlencode 'stepCode=COMPANY_REAPPLICATION_PUBLIC_RESUBMIT' \
  --data-urlencode 'actorCode=PUBLIC_APPLICANT' "$BASE_URL/home/api/screen-context")"
binding_status="$(q "select binding.binding_status from framework_process_step_screen_binding binding
  join framework_screen_resource resource using(screen_resource_id)
 where resource.route_key='/join/companyreapply'
   and binding.process_code='COMPANY_REAPPLICATION_PUBLIC'
   and binding.step_code='COMPANY_REAPPLICATION_PUBLIC_RESUBMIT'
   and binding.audience='PUBLIC' and binding.actor_code='PUBLIC_APPLICANT'")"
screen_context_linked=0
if [[ "$binding_status" == DRAFT ]]; then
  [[ "$context_code" == 200 ]] && jq -e '
    .linked==false and .selectionRequired==false and
    .classification=="REVIEW_REQUIRED" and .reasonCode=="MISSING_WORKFLOW_EVIDENCE"
  ' "$BODY" >/dev/null || {
    echo "[company-reapplication-e2e] FAIL pre-promotion screen-context status=$context_code" >&2
    exit 1
  }
elif [[ "$binding_status" == ACTIVE ]]; then
  [[ "$context_code" == 200 ]] && jq -e '
    .linked==true and .selectionRequired==false and
    .classification=="EXECUTABLE" and .reasonCode=="RUNTIME_WORKFLOW_RESOLVED"
  ' "$BODY" >/dev/null || {
    echo "[company-reapplication-e2e] FAIL post-promotion screen-context status=$context_code" >&2
    exit 1
  }
  screen_context_linked=1
else
  echo "[company-reapplication-e2e] FAIL exact binding status=$binding_status" >&2
  exit 1
fi
[[ "$context_code" == 200 ]] || {
  echo "[company-reapplication-e2e] FAIL screen-context status=$context_code" >&2
  exit 1
}

cleanup
trap - EXIT
remaining="$(q "select
  (select count(*) from framework_company_reapplication_audit where project_id='${PROJECT_ID}' and instt_id='${INSTT_ID}')+
  (select count(*) from comtninsttfile where project_id='${PROJECT_ID}' and trim(instt_id)='${INSTT_ID}')+
  (select count(*) from comtninsttinfo where project_id='${PROJECT_ID}' and trim(instt_id)='${INSTT_ID}')")"
[[ "$remaining" == 0 ]] || {
  echo "[company-reapplication-e2e] FAIL cleanup remaining=$remaining" >&2
  exit 1
}
if [[ -n "$RESOLVED_CLEANUP_PATH" ]] &&
   { [[ -e "$RESOLVED_CLEANUP_PATH" ]] || [[ -L "$RESOLVED_CLEANUP_PATH" ]]; }; then
  echo '[company-reapplication-e2e] FAIL physical evidence cleanup' >&2
  exit 1
fi

FINISHED_AT_MS="$(( $(date +%s%N) / 1000000 ))"
PERFORMANCE_MS="$((FINISHED_AT_MS - STARTED_AT_MS))"
jq -cn --argjson suiteDurationMs "$PERFORMANCE_MS" --arg bindingStatus "$binding_status" \
  --argjson screenContextLinked "$screen_context_linked" '{
  status:"PASS",promotionEligible:false,processCode:"COMPANY_REAPPLICATION_PUBLIC",
  stepCode:"COMPANY_REAPPLICATION_PUBLIC_RESUBMIT",api:1,database:1,authority:1,
  validation:1,exceptionStates:1,audit:1,cleanup:1,token:1,replayBlocked:1,
  statusLookup:1,statusAllowlist:1,statusOpaqueHandle:1,statusDownload:1,statusRateLimit:1,
  rateLimitFixtureCleanup:1,cachePolicy:1,legacy410:1,
  screenContextPreflight:1,screenContextLinked:$screenContextLinked,
  bindingStatus:$bindingStatus,responsive:0,accessibility:0,suiteDurationMs:$suiteDurationMs
}'
