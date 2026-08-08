#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NS="${K8S_NAMESPACE:-carbonet-prod}"
POD="${PATRONI_POD:-}"
if [[ -z "$POD" ]]; then
  while read -r candidate; do
    [[ "$(kubectl -n "$NS" exec "$candidate" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && { POD="$candidate"; break; }
  done < <(kubectl -n "$NS" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
fi
[[ -n "$POD" ]] || { echo "Patroni leader not found" >&2; exit 1; }
RUN="$(date +%H%M%S)$((RANDOM%1000))"
ID1="QAAP${RUN}A"; ID2="QAAP${RUN}R"
ES1="QAES${RUN}A"; ES2="QAES${RUN}R"
export MEMBER_APPROVAL_FIXTURE_IDS="$ID1,$ID2"
if [[ -z "${CARBONET_ADMIN_TEST_PASSWORD:-}" ]]; then CARBONET_ADMIN_TEST_PASSWORD="$(kubectl -n "$NS" get secret carbonet-runtime-smoke-admin -o jsonpath='{.data.password}' | base64 -d)"; fi
export CARBONET_ADMIN_TEST_PASSWORD
psqlq(){ kubectl -n "$NS" exec "$POD" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -v ON_ERROR_STOP=1 -Atqc "$1"; }
cleanup(){
  set +e
  psqlq "delete from audit_event where entity_type='MEMBER' and (entity_id like '%${ID1}%' or entity_id like '%${ID2}%'); delete from comtnemplyrscrtyestbs where scrty_dtrmn_trget_id in ('${ES1}','${ES2}'); delete from msatnemplyrscrtyestbs where scrty_dtrmn_trget_id in ('${ES1}','${ES2}'); delete from comtnentrprsmber where entrprs_mber_id in ('${ID1}','${ID2}');" >/dev/null
}
trap cleanup EXIT
cleanup
psqlq "insert into comtnentrprsmber(entrprs_mber_id,entrprs_se_code,bizrno,cmpny_nm,cxfc,zip,adres,entrprs_middle_telno,applcnt_nm,sbscrb_de,entrprs_mber_sttus,entrprs_mber_password,entrprs_mber_password_hint,entrprs_mber_password_cnsr,entrprs_end_telno,area_no,applcnt_email_adres,esntl_id,instt_id,dept_nm,project_id) values ('${ID1}','1','9911111111','QA 승인 기업','QA 대표','12345','QA 주소','0000','QA 승인 대상',current_timestamp,'A','QA-FIXTURE','QA','QA','0000','02','qa-approve@example.invalid','${ES1}','P003','QA','P003'),('${ID2}','1','9922222222','QA 반려 기업','QA 대표','12345','QA 주소','0000','QA 반려 대상',current_timestamp,'A','QA-FIXTURE','QA','QA','0000','02','qa-reject@example.invalid','${ES2}','P003','QA','P003');" >/dev/null
cd "$ROOT"
OUTPUT="$(RESONANCE_ROOT="$ROOT" CARBONET_RUNTIME_BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}" node ops/scripts/member-approval-e2e.mjs)"
STATE="$(psqlq "select string_agg(entrprs_mber_id||':'||entrprs_mber_sttus||':'||coalesce(rjct_rsn,''),',' order by entrprs_mber_id) from comtnentrprsmber where entrprs_mber_id in ('${ID1}','${ID2}');")"
[[ "$STATE" == *"${ID1}:P:"* && "$STATE" == *"${ID2}:R:QA 자동 검증 보완 요청"* ]] || { echo "member approval DB state mismatch" >&2; exit 1; }
AUDIT="$(psqlq "select count(*) from audit_event where entity_type='MEMBER' and (entity_id like '%${ID1}%' or entity_id like '%${ID2}%') and action_code in ('MEMBER_APPROVAL_APPROVE','MEMBER_APPROVAL_REJECT') and result_status='SUCCESS';")"
[[ "$AUDIT" == "2" ]] || { echo "member approval audit mismatch count=$AUDIT" >&2; exit 1; }
cleanup
trap - EXIT
RESIDUE="$(psqlq "select (select count(*) from comtnentrprsmber where entrprs_mber_id in ('${ID1}','${ID2}'))+(select count(*) from comtnemplyrscrtyestbs where scrty_dtrmn_trget_id in ('${ES1}','${ES2}'))+(select count(*) from msatnemplyrscrtyestbs where scrty_dtrmn_trget_id in ('${ES1}','${ES2}'))+(select count(*) from audit_event where entity_type='MEMBER' and (entity_id like '%${ID1}%' or entity_id like '%${ID2}%')); ")"
[[ "$RESIDUE" == "0" ]] || { echo "fixture cleanup residue=$RESIDUE" >&2; exit 1; }
printf '%s\n' "$OUTPUT" | jq -c '. + {database:1,audit:1,cleanup:1}'
