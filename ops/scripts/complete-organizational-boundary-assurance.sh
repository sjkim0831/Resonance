#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROCESS=ORGANIZATIONAL_BOUNDARY
STEPS=(ORGANIZATIONAL_BOUNDARY_S1 ORGANIZATIONAL_BOUNDARY_S2 ORGANIZATIONAL_BOUNDARY_S3 ORGANIZATIONAL_BOUNDARY_S4)
CONTRACTS='[]'
for step in "${STEPS[@]}"; do
  contract="$(bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" "$PROCESS" "$step")"
  CONTRACTS="$(jq -cn --argjson rows "$CONTRACTS" --argjson row "$contract" '$rows+[$row]')"
done
SOURCE_COMMIT="$(jq -r 'map(.sourceCommit)|unique|if length==1 then .[0] else error("mixed runtime commits") end' <<<"$CONTRACTS")"
VALIDATION_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
[[ "$(tr -d '[:space:]' < "$DEPLOY_STATE_FILE")" == "$VALIDATION_COMMIT" ]] || { echo '[organizational-boundary-assurance] FAIL validation commit is not deployed' >&2; exit 3; }
if [[ "$SOURCE_COMMIT" != "$VALIDATION_COMMIT" ]]; then
  git -C "$ROOT" merge-base --is-ancestor "$SOURCE_COMMIT" "$VALIDATION_COMMIT" || exit 3
  PLAN="$(bash "$ROOT/ops/scripts/plan-incremental-work.sh" "$SOURCE_COMMIT" "$VALIDATION_COMMIT" --format env)"
  for key in PLAN_RUNTIME_REQUIRED PLAN_FRONTEND_REQUIRED PLAN_BACKEND_REQUIRED PLAN_DATABASE_REQUIRED; do
    [[ "$(awk -F= -v key="$key" '$1==key{print $2}' <<<"$PLAN")" == false ]] || { echo "[organizational-boundary-assurance] FAIL unreleased runtime change key=$key" >&2; exit 3; }
  done
fi

RUNTIME="$(CARBONET_ORG_BOUNDARY_PROMOTE_JOBS=false bash "$ROOT/ops/scripts/validate-organizational-boundary-runtime.sh")"
grep -Eq '^\[organizational-boundary-runtime\] PASS ' <<<"$RUNTIME" || exit 1
EVIDENCE="$(jq -cn --argjson contracts "$CONTRACTS" --arg runtime "$RUNTIME" --arg validationCommit "$VALIDATION_COMMIT" '{suite:"ORGANIZATIONAL_BOUNDARY_ASSURANCE",validationCommit:$validationCommit,contracts:$contracts,runtime:$runtime,steps:4,caseFamilies:5}')"
SHA="$(printf '%s' "$EVIDENCE" | sha256sum | awk '{print $1}')"
B64="$(printf '%s' "$EVIDENCE" | base64 -w0)"

source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
carbonet_postgres_query "DO \$\$
DECLARE actual integer;
BEGIN
  INSERT INTO framework_process_qa_run(process_code,step_code,result,failure_reason,evidence_json,executed_by,executed_at,evidence_type,process_version,source_commit,contract_fingerprint,execution_environment,evidence_uri,evidence_hash)
  SELECT p.process_code,s.step_code,'PASSED',NULL,e.body||jsonb_build_object('stepCode',s.step_code),'ORGANIZATIONAL_BOUNDARY_ASSURANCE',current_timestamp,'BUSINESS_E2E',p.process_version,'$SOURCE_COMMIT',framework_current_process_step_contract_fingerprint(p.process_code,s.step_code),'carbonet-prod','inline://business-e2e/sha256/$SHA','$SHA'
  FROM framework_process_definition p JOIN framework_process_step s USING(process_code)
  CROSS JOIN LATERAL (SELECT convert_from(decode('$B64','base64'),'UTF8')::jsonb body) e
  JOIN LATERAL (SELECT c FROM jsonb_array_elements(e.body->'contracts') c WHERE c->>'stepCode'=s.step_code) captured ON true
  WHERE p.process_code='$PROCESS' AND p.process_version=captured.c->>'processVersion'
    AND framework_current_process_step_contract_fingerprint(p.process_code,s.step_code)=captured.c->>'contractFingerprint'
    AND captured.c->>'sourceCommit'='$SOURCE_COMMIT'
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO actual FROM framework_current_business_e2e_evidence
   WHERE process_code='$PROCESS' AND business_test_result='PASSED' AND source_commit='$SOURCE_COMMIT' AND evidence_hash='$SHA';
  IF actual<>4 THEN RAISE EXCEPTION 'organizational boundary evidence mismatch: %',actual; END IF;
END \$\$;" >/dev/null

printf '%s\n' "$RUNTIME"
printf '[organizational-boundary-assurance] PASS current=4/4 cases=5 sha256=%s\n' "$SHA"
