#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NS="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DB="${POSTGRES_DB:-carbonet}"
U="${POSTGRES_ADMIN_USER:-postgres}"
BASE="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
SOURCE_COMMIT="${CARBONET_POSTDEPLOY_SOURCE_COMMIT:-$(git -C "$ROOT" rev-parse HEAD)}"
EVIDENCE_MODE="${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-legacy}"
COOKIE="$(mktemp)"
TIMES="$(mktemp)"
API_BODY="$(mktemp)"
PAGE_BODY="$(mktemp)"
LOGIN_PAYLOAD="$(mktemp)"
LOGIN_RESPONSE="$(mktemp)"
LOGOUT_RESPONSE="$(mktemp)"
SESSION_ACTIVE=0

source "$ROOT/ops/scripts/runtime-qa-auth-common.sh"
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"

finalize() {
  local status=$? logout_status=""
  trap - EXIT
  set +e
  if [[ "$SESSION_ACTIVE" == 1 ]]; then
    logout_status="$(curl -sS -b "$COOKIE" -o "$LOGOUT_RESPONSE" -w '%{http_code}' -X POST "$BASE/signin/actionLogout")"
    if { [[ "$logout_status" != 200 ]] || ! jq -e '(.status // "") == "success"' "$LOGOUT_RESPONSE" >/dev/null 2>&1; } && [[ "$status" == 0 ]]; then
      echo "[report-runtime] FAIL logout status=$logout_status" >&2
      status=1
    fi
  fi
  rm -f "$COOKIE" "$TIMES" "$API_BODY" "$PAGE_BODY" "$LOGIN_PAYLOAD" "$LOGIN_RESPONSE" "$LOGOUT_RESPONSE"
  exit "$status"
}
trap finalize EXIT

carbonet_qa_load_credentials LOGIN_USER LOGIN_PASSWORD \
  "${CARBONET_RUNTIME_TEST_USER:-}" "${CARBONET_RUNTIME_TEST_PASSWORD:-}" \
  "${CARBONET_RUNTIME_AUTH_SECRET:-carbonet-screen-smoke}" "$NS"

carbonet_postgres_query_init
q() { carbonet_postgres_query "$1"; }
IFS='|' read -r project report cert hash <<<"$(q "select project_id||'|'||report_id||'|'||certificate_id||'|'||integrity_hash from emission_project_report where report_status='FINALIZED' and certificate_status='ACTIVE' and certificate_id is not null order by issued_at desc nulls last limit 1")"
[[ -n "$cert" ]] || { echo '[report-runtime] FAIL active certificate missing' >&2; exit 1; }

printf '%s' "$LOGIN_PASSWORD" | jq -Rsc --arg id "$LOGIN_USER" '{userId:$id,userPw:.,userSe:"USR"}' >"$LOGIN_PAYLOAD"
LOGIN_PASSWORD=""
unset LOGIN_PASSWORD CARBONET_RUNTIME_TEST_PASSWORD
login_code="$(curl -sS -c "$COOKIE" -o "$LOGIN_RESPONSE" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/signin/actionLogin" --data-binary "@$LOGIN_PAYLOAD")"
rm -f "$LOGIN_PAYLOAD"
[[ "$login_code" == 200 ]] && jq -e --arg user "$LOGIN_USER" '.status == "loginSuccess" and (.userId | ascii_downcase) == ($user | ascii_downcase)' "$LOGIN_RESPONSE" >/dev/null \
  || { echo "[report-runtime] FAIL login status=$login_code" >&2; exit 1; }
SESSION_ACTIVE=1

apis=("/home/api/emission-projects/$project/reports" "/home/api/emission-projects/$project/completion" "/home/api/report-access-history")
for p in "${apis[@]}"; do
  code="$(curl -sS -b "$COOKIE" -o "$API_BODY" -w '%{http_code}' "$BASE$p")"
  [[ "$code" == 200 ]] || { echo "[report-runtime] FAIL api=$p status=$code" >&2; exit 1; }
  grep -Eq '^\s*[\{\[]' "$API_BODY" || exit 1
done
public="$(curl -fsS "$BASE/api/public/report-certificates/$cert")"
grep -q '"valid":true' <<<"$public" || { echo '[report-runtime] FAIL valid certificate rejected' >&2; exit 1; }
invalid="$(curl -fsS "$BASE/api/public/report-certificates/INVALID-CERTIFICATE")"
grep -q '"valid":false' <<<"$invalid" || { echo '[report-runtime] FAIL invalid certificate accepted' >&2; exit 1; }
for p in "/home/api/emission-projects/$project/reports" /home/api/report-access-history; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE$p")"
  [[ "$code" == 401 || "$code" == 403 ]] || { echo "[report-runtime] FAIL protection=$p status=$code" >&2; exit 1; }
done
pages=("/emission/report_submit?projectId=$project" "/emission/report-download?projectId=$project" /home/certificate-verify /admin/emission/report-certificates /admin/emission/survey-report '/admin/emission/survey-report-print?lang=ko' /admin/emission/survey-report-verify)
for p in "${pages[@]}"; do
  code="$(curl -sS -L -b "$COOKIE" -o "$PAGE_BODY" -w '%{http_code}' "$BASE$p")"
  [[ "$code" == 200 ]] || { echo "[report-runtime] FAIL page=$p status=$code" >&2; exit 1; }
  grep -qi '<!doctype html' "$PAGE_BODY" || exit 1
done
for _ in $(seq 1 20); do
  curl -sS -o /dev/null -w '%{time_total}\n' "$BASE/api/public/report-certificates/$cert" >>"$TIMES"
done
p95="$(sort -n "$TIMES" | awk 'NR==19{printf "%d",$1*1000}')"
[[ "$p95" -le 2500 ]] || exit 1
read -r desired ready available <<<"$(kubectl -n "$NS" get deploy carbonet-runtime -o jsonpath='{.spec.replicas} {.status.readyReplicas} {.status.availableReplicas}')"
[[ -n "$desired" && "$desired" -gt 0 && "$ready" -ge "$desired" && "$available" -ge "$desired" ]] || { echo "[report-certification-runtime] FAIL replicas desired=$desired ready=$ready available=$available" >&2; exit 1; }
gate="$(q "select length('$hash')=64 and (select count(*) from framework_professional_screen_readiness where process_code='REPORT_CERTIFICATION' and readiness_score=100)=(select count(*) from framework_professional_screen_contract where process_code='REPORT_CERTIFICATION') and (select count(*) from framework_professional_screen_contract where process_code='REPORT_CERTIFICATION')>0 and (select count(distinct case_type) from framework_simulation_case where process_code='REPORT_CERTIFICATION')>=5 and exists(select 1 from emission_report_certificate_audit where report_id=$report)")"
[[ "$gate" == t ]] || { echo '[report-runtime] FAIL integrity/design/audit gate' >&2; exit 1; }
if [[ "$EVIDENCE_MODE" == candidate ]]; then
  jq -cn --arg projectId "$project" --arg reportId "$report" --arg certificate "$cert" --arg integrityHash "$hash" --argjson authenticatedApiCount "${#apis[@]}" --argjson protectedApiCount 2 --argjson pageCount "${#pages[@]}" --argjson p95Millis "$p95" --argjson readyReplicas "$ready" '{projectId:$projectId,reportId:$reportId,certificate:$certificate,integrityHash:$integrityHash,authenticatedApiCount:$authenticatedApiCount,protectedApiCount:$protectedApiCount,pageCount:$pageCount,p95Millis:$p95Millis,readyReplicas:$readyReplicas,publicValid:true,publicInvalid:true}' | bash "$ROOT/ops/scripts/stage-postdeploy-evidence-candidate.sh" REPORT_CERTIFICATION_RUNTIME REPORT_CERTIFICATION RUNTIME "$SOURCE_COMMIT"
else
  q "begin;update framework_development_job set job_status='COMPLETED',approval_status='APPROVED',quality_status='PASSED',evidence_ref='runtime:report+certificate+public-verify+integrity+performance+deployment',last_error=null,completed_at=current_timestamp,updated_at=current_timestamp where process_code='REPORT_CERTIFICATION' and job_type in('ACTOR_TEST','DEPLOYMENT','INTEGRATION','PERFORMANCE','TEST');update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='runtime:report+certificate+public-verify+integrity+performance+deployment',updated_at=current_timestamp where process_code='REPORT_CERTIFICATION';commit;" >/dev/null
fi
echo "[report-runtime] PASS project=$project report=$report certificate=$cert authenticatedApi=${#apis[@]} publicValid=1 publicInvalid=1 protected=2 pages=${#pages[@]} integrityHash=64 p95=${p95}ms replicas=$ready/$desired"
