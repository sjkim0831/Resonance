#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
COOKIE_A="$(mktemp)"; COOKIE_B="$(mktemp)"; BODY="$(mktemp)"
trap 'rm -f "$COOKIE_A" "$COOKIE_B" "$BODY"' EXIT
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
q(){ carbonet_postgres_query "$1"; }
controller="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/member/web/MemberJoinController.java"

for contract in '@PostMapping("/api/step1")' '@PostMapping("/api/step2")' '@PostMapping("/api/step3")' '/api/step4/submit' 'insertEntrprsmber(joinVO)' 'insertEntrprsMberFiles(evidenceFiles)' 'ensureEnterpriseSecurityMapping'; do
  grep -Fq "$contract" "$controller" || { echo "[member-registration] FAIL source=$contract" >&2; exit 1; }
done

for path in /join/step1 /join/en/step1; do
  code="$(curl -sS -c "$COOKIE_A" -b "$COOKIE_A" -o "$BODY" -w '%{http_code}' "$BASE_URL$path")"
  [[ "$code" == 200 ]] && grep -qi '<!doctype html' "$BODY" || { echo "[member-registration] FAIL page=$path status=$code" >&2; exit 1; }
done

code="$(curl -sS -c "$COOKIE_A" -b "$COOKIE_A" -o "$BODY" -w '%{http_code}' -X POST --data 'membership_type=EMITTER' "$BASE_URL/join/api/step1")"
[[ "$code" == 200 ]] && jq -e '.success==true and .step==1 and .joinVO.userTy=="USR02"' "$BODY" >/dev/null \
  || { echo "[member-registration] FAIL step1 status=$code" >&2; exit 1; }
code="$(curl -sS -c "$COOKIE_B" -b "$COOKIE_B" -o "$BODY" -w '%{http_code}' -X POST --data 'membership_type=GOV' "$BASE_URL/join/api/step1")"
[[ "$code" == 200 ]] || { echo '[member-registration] FAIL isolated session B' >&2; exit 1; }
a="$(curl -fsS -c "$COOKIE_A" -b "$COOKIE_A" "$BASE_URL/join/api/session" | jq -r .membershipType)"
b="$(curl -fsS -c "$COOKIE_B" -b "$COOKIE_B" "$BASE_URL/join/api/session" | jq -r .membershipType)"
[[ "$a" == EMITTER && "$b" == GOV ]] || { echo "[member-registration] FAIL isolation A=$a B=$b" >&2; exit 1; }

code="$(curl -sS -c "$COOKIE_A" -b "$COOKIE_A" -o "$BODY" -w '%{http_code}' -X POST --data 'marketing_yn=N&agree_terms=Y&agree_privacy=Y&agree_gwp=N' "$BASE_URL/join/api/step2")"
[[ "$code" == 400 ]] || { echo '[member-registration] FAIL required GWP consent accepted incorrectly' >&2; exit 1; }
code="$(curl -sS -c "$COOKIE_A" -b "$COOKIE_A" -o "$BODY" -w '%{http_code}' -X POST --data 'marketing_yn=N&agree_terms=Y&agree_privacy=Y&agree_gwp=Y' "$BASE_URL/join/api/step2")"
[[ "$code" == 200 ]] && jq -e '.success==true and .step==2' "$BODY" >/dev/null || { echo '[member-registration] FAIL step2' >&2; exit 1; }
code="$(curl -sS -c "$COOKIE_A" -b "$COOKIE_A" -o "$BODY" -w '%{http_code}' -X POST --data 'auth_method=MOBILE' "$BASE_URL/join/api/step3")"
[[ "$code" == 409 ]] && jq -e '.message=="IDENTITY_PROVIDER_VERIFICATION_REQUIRED"' "$BODY" >/dev/null \
  || { echo "[member-registration] FAIL identity fail-closed status=$code" >&2; exit 1; }

gate="$(q "select
 (select count(*) from framework_process_step where process_code='MEMBER_REGISTRATION' and nullif(user_path,'') is not null and nullif(api_contract,'') is not null)=5
 and (select count(*) from framework_professional_screen_readiness where process_code='MEMBER_REGISTRATION')=11
 and (select count(*) from framework_professional_screen_readiness where process_code='MEMBER_REGISTRATION' and readiness_score=100)=11
 and not exists(select 1 from framework_professional_screen_readiness where process_code='MEMBER_REGISTRATION' and lower(split_part(route_path,'?',1)) like '%/planned/%')
 and to_regclass('member_consent_history') is not null
 and to_regclass('comtnentrprsmber') is not null")"
[[ "$gate" == t ]] || { echo '[member-registration] FAIL database/design gate' >&2; exit 1; }

echo '[member-registration] PASS steps=5 screens=11 sessions=2 consent=verified identity=fail-closed persistence=source-verified'
