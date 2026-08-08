#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"; NS="${K8S_NAMESPACE:-carbonet-prod}"; POD="${PATRONI_POD:-}"
if [[ -z "$POD" ]];then while read -r p;do [[ "$(kubectl -n "$NS" exec "$p" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc 'select pg_is_in_recovery()' 2>/dev/null||true)" == f ]]&&{ POD="$p";break;};done < <(kubectl -n "$NS" get pods -l app=postgres-patroni -o name|sed 's#pod/##');fi
[[ -n "$POD" ]]||exit 2
ID="qadm$(date +%H%M%S)$((RANDOM%100))"; export MEMBER_ADMIN_FIXTURE_ID="$ID"
if [[ -z "${CARBONET_ADMIN_TEST_PASSWORD:-}" ]];then CARBONET_ADMIN_TEST_PASSWORD="$(kubectl -n "$NS" get secret carbonet-runtime-smoke-admin -o jsonpath='{.data.password}'|base64 -d)";fi;export CARBONET_ADMIN_TEST_PASSWORD
q(){ kubectl -n "$NS" exec "$POD" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -v ON_ERROR_STOP=1 -Atqc "$1"; }
cleanup(){ set +e; ES="$(q "select esntl_id from comtnentrprsmber where entrprs_mber_id='${ID}'" 2>/dev/null|head -1)"; q "delete from business_change_log where entity_id='${ID}'; delete from audit_event where entity_type='MEMBER' and entity_id='${ID}'; delete from comtnuserfeatureoverride where scrty_dtrmn_trget_id='${ES}'; delete from comtnemplyrscrtyestbs where scrty_dtrmn_trget_id='${ES}'; delete from msatnemplyrscrtyestbs where scrty_dtrmn_trget_id='${ES}'; delete from comtnentrprsmber where entrprs_mber_id='${ID}';" >/dev/null 2>&1||true; }
trap cleanup EXIT;cleanup
cd "$ROOT"; OUT="$(RESONANCE_ROOT="$ROOT" node ops/scripts/member-administration-e2e.mjs)"
STATE="$(q "select entrprs_mber_sttus||'|'||applcnt_nm||'|'||dept_nm from comtnentrprsmber where entrprs_mber_id='${ID}'")";[[ "$STATE" == 'P|QA 회원 관리 수정|QA 검증팀' ]]||{ echo "member administration DB mismatch" >&2;exit 1;}
AUDITS="$(q "select count(*) from audit_event where entity_type='MEMBER' and entity_id='${ID}' and action_code in ('MEMBER_REGISTER_SAVE','MEMBER_EDIT_SAVE') and result_status='SUCCESS'")";[[ "$AUDITS" == 3 ]]||{ echo "member administration audit mismatch count=$AUDITS" >&2;exit 1;}
cleanup;trap - EXIT
RESIDUE="$(q "select (select count(*) from comtnentrprsmber where entrprs_mber_id='${ID}')+(select count(*) from audit_event where entity_id='${ID}')+(select count(*) from business_change_log where entity_id='${ID}')")";[[ "$RESIDUE" == 0 ]]||{ echo "member administration cleanup residue=$RESIDUE" >&2;exit 1;}
printf '%s\n' "$OUT"|jq -c '.+{database:1,audit:1,cleanup:1}'
