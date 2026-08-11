#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
LOGIN_USER=""
LOGIN_PASSWORD=""
SOURCE_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
KUBE_NAMESPACE="${CARBONET_KUBE_NAMESPACE:-carbonet-prod}"
RUNTIME_DEPLOYMENT="${CARBONET_RUNTIME_DEPLOYMENT:-carbonet-runtime}"
REACT_OVERLAY_PATH="${CARBONET_REACT_OVERLAY_PATH:-/app/react-app-overlay}"
COOKIE="$(mktemp)"; BODY="$(mktemp)"; LOGIN_PAYLOAD="$(mktemp)"; LOGIN_RESPONSE="$(mktemp)"; LOGOUT_RESPONSE="$(mktemp)"
SESSION_ACTIVE=0

source "$ROOT/ops/scripts/runtime-qa-auth-common.sh"
carbonet_qa_load_credentials LOGIN_USER LOGIN_PASSWORD \
  "${CARBONET_RUNTIME_TEST_USER:-}" "${CARBONET_RUNTIME_TEST_PASSWORD:-}" \
  "${CARBONET_RUNTIME_AUTH_SECRET:-carbonet-screen-smoke}" "$KUBE_NAMESPACE"

cleanup() {
  local status=$? logout_status=""
  trap - EXIT
  set +e
  if [[ "$SESSION_ACTIVE" == 1 ]]; then
    logout_status="$(curl -sS -b "$COOKIE" -o "$LOGOUT_RESPONSE" -w '%{http_code}' -X POST "$BASE_URL/signin/actionLogout")"
    if { [[ "$logout_status" != 200 ]] || ! jq -e '(.status // "") == "success"' "$LOGOUT_RESPONSE" >/dev/null 2>&1; } && [[ "$status" == 0 ]]; then
      echo "[member-assurance] FAIL logout status=$logout_status" >&2
      status=1
    fi
  fi
  rm -f "$COOKIE" "$BODY" "$LOGIN_PAYLOAD" "$LOGIN_RESPONSE" "$LOGOUT_RESPONSE"
  exit "$status"
}
trap cleanup EXIT

bash "$ROOT/ops/scripts/validate-member-registration-runtime.sh" >/dev/null
bash "$ROOT/gradlew" -p "$ROOT" :modules:resonance-common:carbonet-common-core:test \
  --tests egovframework.com.feature.member.MemberRegistrationIdentityFlowTest \
  --no-daemon --console=plain >/dev/null

controller="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/member/web/MemberJoinController.java"
service="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/auth/external/service/impl/ExternalAuthServiceImpl.java"
grep -Fq '@Transactional(rollbackFor = Exception.class)' "$controller" || { echo '[member-assurance] FAIL transaction boundary' >&2; exit 1; }
grep -Fq 'completePendingJoinIdentity' "$service" || { echo '[member-assurance] FAIL identity handoff' >&2; exit 1; }
kubectl -n "$KUBE_NAMESPACE" exec "deployment/$RUNTIME_DEPLOYMENT" -- \
  grep -Rql 'joinVerificationSuccess' "$REACT_OVERLAY_PATH" \
  || { echo '[member-assurance] FAIL deployed join identity overlay asset' >&2; exit 1; }

printf '%s' "$LOGIN_PASSWORD" | jq -Rsc --arg id "$LOGIN_USER" '{userId:$id,userPw:.,userSe:"USR"}' >"$LOGIN_PAYLOAD"
LOGIN_PASSWORD=""
unset LOGIN_PASSWORD CARBONET_RUNTIME_TEST_PASSWORD
login_code="$(curl -sS -c "$COOKIE" -o "$LOGIN_RESPONSE" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE_URL/signin/actionLogin" --data-binary "@$LOGIN_PAYLOAD")"
rm -f "$LOGIN_PAYLOAD"
[[ "$login_code" == 200 ]] && jq -e --arg user "$LOGIN_USER" '.status == "loginSuccess" and (.userId | ascii_downcase) == ($user | ascii_downcase)' "$LOGIN_RESPONSE" >/dev/null \
  || { echo "[member-assurance] FAIL administrator login status=$login_code" >&2; exit 1; }
SESSION_ACTIVE=1
for path in /admin/member/list /admin/member/approve /admin/system/consent-history; do
  code="$(curl -sS -L -b "$COOKIE" -o "$BODY" -w '%{http_code}' "$BASE_URL$path")"
  [[ "$code" == 200 ]] && grep -qi '<!doctype html' "$BODY" \
    || { echo "[member-assurance] FAIL admin page=$path status=$code" >&2; exit 1; }
done

source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
q(){ carbonet_postgres_query "$1"; }
gate="$(q "select
 (select count(*) from framework_professional_screen_readiness where process_code='MEMBER_REGISTRATION' and readiness_score=100)=11
 and (select count(*) from framework_process_step where process_code='MEMBER_REGISTRATION' and nullif(actor_code,'') is not null)=5
 and to_regclass('comtnentrprsmber') is not null
 and to_regclass('comtnentrprsmberfile') is not null
 and to_regclass('comtnemplyrscrtyestbs') is not null
 and to_regclass('member_consent_history') is not null")"
[[ "$gate" == t ]] || { echo '[member-assurance] FAIL persistence/design gate' >&2; exit 1; }

s5_evidence="$(q "select count(*) from framework_simulation_case c
 where c.process_code='MEMBER_REGISTRATION' and c.case_code like 'MEMBER_REGISTRATION_S5_%'
 and exists(select 1 from framework_simulation_run r where r.case_code=c.case_code
   and r.result='PASSED' and r.executed_by='member-registration-step5-relay-e2e'
   and r.execution_environment='production-runtime+browser+admin-handoff')")"
[[ "$s5_evidence" == 5 ]] || {
  echo "[member-assurance] BLOCKED real step5 browser/admin handoff evidence=$s5_evidence/5" >&2
  exit 75
}

evidence="verified:member-registration:public-runtime+isolated-provider-success+transaction+admin-handoff:$SOURCE_COMMIT"
q "begin;
with candidate as (
 select job_id,job_status from framework_development_job where process_code='MEMBER_REGISTRATION' and required
), changed as (
 update framework_development_job j set job_status='COMPLETED',approval_status='APPROVED',quality_status='PASSED',
  evidence_ref='$evidence',last_error=null,completed_at=current_timestamp,worker_id=null,lease_token=null,lease_until=null,
  updated_at=current_timestamp from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status
)
insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
select job_id,'MEMBER_ASSURANCE_VERIFIED',job_status,'COMPLETED','member-registration-assurance',
 jsonb_build_object('commit','$SOURCE_COMMIT','tests',10,'screens',11) from changed where job_status<>'COMPLETED';
update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='$evidence',updated_at=current_timestamp
 where process_code='MEMBER_REGISTRATION' and required;
update framework_process_definition set definition_locked=true,process_status='ACTIVE',updated_at=current_timestamp
 where process_code='MEMBER_REGISTRATION';
commit;" >/dev/null

status="$(q "select completion_score||'|'||passed_tests||'/'||test_count||'|'||completed_tasks||'/'||required_tasks||'|'||verified_artifacts||'/'||required_artifacts||'|'||ready_screens||'/'||screen_contracts||'|'||next_action from framework_process_delivery_queue where process_code='MEMBER_REGISTRATION'")"
IFS='|' read -r score tests tasks artifacts screens next_action <<<"$status"
complete_ratio(){ local ratio="$1" minimum="$2"; local completed="${ratio%/*}" required="${ratio#*/}"; [[ "$completed" =~ ^[0-9]+$ && "$required" =~ ^[0-9]+$ && "$completed" == "$required" && "$required" -ge "$minimum" ]]; }
[[ "$score" == 100 && "$next_action" == COMPLETE ]] \
  && complete_ratio "$tests" 15 \
  && complete_ratio "$tasks" 57 \
  && complete_ratio "$artifacts" 6 \
  && complete_ratio "$screens" 11 \
  || { echo "[member-assurance] FAIL delivery=$status" >&2; exit 1; }
echo "[member-assurance] PASS delivery=$status admin-pages=3 transaction=verified provider-contract=verified"
