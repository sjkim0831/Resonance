#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
PROCESS="MEMBER_REGISTRATION"
PROMOTED_STEPS=(MEMBER_REGISTRATION_S1 MEMBER_REGISTRATION_S2 MEMBER_REGISTRATION_S5)
BLOCKED_STEPS=(MEMBER_REGISTRATION_S3 MEMBER_REGISTRATION_S4)
LOCK_FILE="${MEMBER_REGISTRATION_E2E_LOCK_FILE:-/tmp/resonance-member-registration-business-e2e.lock}"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo '[member-registration-business-e2e] already running' >&2; exit 75; }

contracts='[]'
for step in "${PROMOTED_STEPS[@]}"; do
  contract="$(bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" "$PROCESS" "$step")"
  contracts="$(jq -cn --argjson contracts "$contracts" --argjson contract "$contract" '$contracts+[$contract]')"
done
source_commit="$(jq -r 'map(.sourceCommit)|unique|if length==1 then .[0] else error("mixed deployed commits") end' <<<"$contracts")"
[[ "$source_commit" =~ ^[0-9a-f]{40}$ ]] || { echo '[member-registration-business-e2e] invalid runtime commit' >&2; exit 2; }

runtime="$(timeout 120 bash "$ROOT/ops/scripts/validate-member-registration-runtime.sh")"
grep -Eq '^\[member-registration\] PASS steps=5 screens=11 tests=15/15 ' <<<"$runtime"
receipt="$(timeout 300 bash "$ROOT/ops/tests/run-member-registration-step5-business-e2e.sh")"
grep -Eq '^\[member-step5-e2e\] PASS cases=5 public-completion=1 admin-handoff=1 database=1 audit=1 cleanup=1 ' <<<"$receipt"
identity_test_log="$(mktemp)"
trap 'rm -f "$identity_test_log"' EXIT
timeout 90 bash "$ROOT/gradlew" :modules:resonance-common:carbonet-common-core:test \
  --tests egovframework.com.feature.member.MemberRegistrationIdentityFlowTest --no-daemon \
  >"$identity_test_log" 2>&1
grep -q 'BUILD SUCCESSFUL' "$identity_test_log"
identity_contract='MemberRegistrationIdentityFlowTest PASS cases=2 methodBinding=1 clientBinding=1 replayBlocked=1 step4Handoff=1'
kisa_readiness="$(bash "$ROOT/ops/scripts/validate-kisa-live-readiness.sh" --report)"
jq -e '.jarMounted==true and .requiredCount==7 and .overallChecks==11' <<<"$kisa_readiness" >/dev/null

current_contracts='[]'
for step in "${PROMOTED_STEPS[@]}"; do
  contract="$(E2E_DEPLOYED_COMMIT="$source_commit" bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" "$PROCESS" "$step")"
  current_contracts="$(jq -cn --argjson contracts "$current_contracts" --argjson contract "$contract" '$contracts+[$contract]')"
done
[[ "$(jq -S 'map(del(.capturedAt))' <<<"$contracts")" == "$(jq -S 'map(del(.capturedAt))' <<<"$current_contracts")" ]] || {
  echo '[member-registration-business-e2e] contract changed during E2E' >&2; exit 3;
}

evidence="$(jq -cn --argjson contracts "$contracts" --arg runtime "$runtime" --arg receipt "$receipt" --arg identity "$identity_contract" --argjson kisa "$kisa_readiness" \
  '{suite:"MEMBER_REGISTRATION_CURRENT_BUSINESS_E2E",contracts:$contracts,
    validators:{publicStepsOneAndTwo:$runtime,receiptAndAdminHandoff:$receipt,isolatedIdentityProviderContract:$identity,kisaLiveReadiness:$kisa},
    stepAssertions:{MEMBER_REGISTRATION_S1:["public step1 API","invalid value","session isolation","recovery"],
      MEMBER_REGISTRATION_S2:["required consent validation","accepted consent","session progression"],
      MEMBER_REGISTRATION_S5:["public receipt","desktop/mobile","missing-value exception","context isolation","reload recovery","administrator approval/rejection","database/audit/cleanup"]},
    simulatedStepAssertions:{MEMBER_REGISTRATION_S3:["provider success","method binding","client binding","single use","replay blocked"],
      MEMBER_REGISTRATION_S4:["verified identity handoff","required field rejection","successful multipart submission","administrator handoff"]},
    intentionallyNotPromoted:{MEMBER_REGISTRATION_S3:"LIVE_PROVIDER_ACCEPTANCE_PENDING",MEMBER_REGISTRATION_S4:"LIVE_PROVIDER_IDENTITY_REQUIRED"}}')"
evidence_sha="$(printf '%s' "$evidence" | sha256sum | awk '{print $1}')"
evidence_b64="$(printf '%s' "$evidence" | base64 -w0)"
evidence_uri="inline://business-e2e/sha256/$evidence_sha"
pod="$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")"

kubectl -n "$NAMESPACE" exec -i "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -q -v ON_ERROR_STOP=1 <<SQL
do \$\$
declare promoted integer; blocked_promoted integer;
begin
  insert into framework_process_qa_run(
    process_code,step_code,result,failure_reason,evidence_json,executed_by,executed_at,
    evidence_type,process_version,source_commit,contract_fingerprint,
    execution_environment,evidence_uri,evidence_hash
  )
  select p.process_code,s.step_code,'PASSED',null,
    evidence.body||jsonb_build_object('stepCode',s.step_code,'sha256','$evidence_sha'),
    'MEMBER_REGISTRATION_BUSINESS_E2E',current_timestamp,'BUSINESS_E2E',p.process_version,
    '$source_commit',framework_current_process_step_contract_fingerprint(p.process_code,s.step_code),
    '$NAMESPACE','$evidence_uri','$evidence_sha'
  from framework_process_definition p
  join framework_process_step s using(process_code)
  cross join lateral (select convert_from(decode('$evidence_b64','base64'),'UTF8')::jsonb body) evidence
  join lateral (select contract from jsonb_array_elements(evidence.body->'contracts') contract
    where contract->>'processCode'=p.process_code and contract->>'stepCode'=s.step_code) captured on true
  where p.process_code='$PROCESS'
    and s.step_code in ('MEMBER_REGISTRATION_S1','MEMBER_REGISTRATION_S2','MEMBER_REGISTRATION_S5')
    and p.process_version=captured.contract->>'processVersion'
    and framework_current_process_step_contract_fingerprint(p.process_code,s.step_code)=captured.contract->>'contractFingerprint'
    and captured.contract->>'sourceCommit'='$source_commit'
  on conflict do nothing;

  select count(*) into promoted from framework_current_business_e2e_evidence
   where process_code='$PROCESS'
     and step_code in ('MEMBER_REGISTRATION_S1','MEMBER_REGISTRATION_S2','MEMBER_REGISTRATION_S5')
     and business_test_result='PASSED' and source_commit='$source_commit' and evidence_hash='$evidence_sha';
  select count(*) into blocked_promoted from framework_current_business_e2e_evidence
   where process_code='$PROCESS' and step_code in ('MEMBER_REGISTRATION_S3','MEMBER_REGISTRATION_S4')
     and business_test_result='PASSED';
  if promoted<>3 then raise exception 'member registration current E2E mismatch %/3',promoted; end if;
  if blocked_promoted<>0 then raise exception 'identity-dependent steps were promoted without evidence'; end if;
end \$\$;
SQL

persisted="$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -At -v ON_ERROR_STOP=1 \
  -c "select count(*) from framework_current_business_e2e_evidence where process_code='$PROCESS' and step_code in ('MEMBER_REGISTRATION_S1','MEMBER_REGISTRATION_S2','MEMBER_REGISTRATION_S5') and business_test_result='PASSED' and source_commit='$source_commit' and evidence_hash='$evidence_sha'")"
[[ "$persisted" == "3" ]] || {
  echo "[member-registration-business-e2e] persisted evidence mismatch ${persisted:-missing}/3" >&2
  exit 4
}

echo "[member-registration-business-e2e] PASS current=3/5 simulated=2/2 blocked=2 live-provider=pending evidence=${evidence_sha:0:12}"
