#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 PROCESS_CODE STEP_CODE REQUIRED_CHECKS [USER|ADMIN|ALL] [--validate-only]" >&2
  exit 2
}

[[ $# -ge 3 ]] || usage
PROCESS_CODE="$1"
STEP_CODE="$2"
REQUIRED_CHECKS="$3"
AUDIENCE="USER"
MODE=""
if [[ "${4:-}" == "--validate-only" ]]; then MODE="$4";
elif [[ -n "${4:-}" ]]; then AUDIENCE="$4"; MODE="${5:-}"; fi
[[ "$PROCESS_CODE" =~ ^[A-Z0-9_]+$ ]] || { echo "invalid process code" >&2; exit 2; }
[[ "$STEP_CODE" =~ ^[A-Z0-9_]+$ ]] || { echo "invalid step code" >&2; exit 2; }
[[ "$REQUIRED_CHECKS" =~ ^[A-Za-z0-9_,=]+$ ]] || { echo "invalid required checks" >&2; exit 2; }
[[ "$AUDIENCE" =~ ^(USER|ADMIN|ALL)$ ]] || usage
[[ -z "$MODE" || "$MODE" == "--validate-only" ]] || usage

EVIDENCE="$(cat)"
node -e '
const evidence=JSON.parse(process.argv[1]);
const checks=process.argv[2].split(",").filter(Boolean);
if(!["PASS","PASSED"].includes(evidence.status)) throw new Error("E2E status must be PASS or PASSED");
for(const assertion of checks){
  const [check,rawExpected="1"]=assertion.split("=");
  const expected=Number(rawExpected);
  if(!Number.isFinite(expected)||Number(evidence[check])!==expected){
    throw new Error(`required E2E assertion failed: ${check}=${rawExpected}`);
  }
}
' "$EVIDENCE" "$REQUIRED_CHECKS"

EVIDENCE_SHA256="$(printf '%s' "$EVIDENCE" | sha256sum | awk '{print $1}')"
if [[ "$MODE" == "--validate-only" ]]; then
  printf '{"status":"VALID","sha256":"%s"}\n' "$EVIDENCE_SHA256"
  exit 0
fi

EVIDENCE_B64="$(printf '%s' "$EVIDENCE" | base64 -w0)"
K8S_NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
PATRONI_POD="${PATRONI_POD:-postgres-patroni-2}"

kubectl -n "$K8S_NAMESPACE" exec -i "$PATRONI_POD" -c patroni -- \
  psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q \
    -o /dev/null \
    -v process_code="$PROCESS_CODE" -v step_code="$STEP_CODE" \
    -v audience="$AUDIENCE" -v evidence_b64="$EVIDENCE_B64" -v evidence_sha256="$EVIDENCE_SHA256" <<'SQL'
BEGIN;

SELECT set_config('resonance.process_code',:'process_code',true);
SELECT set_config('resonance.step_code',:'step_code',true);
SELECT set_config('resonance.audience',:'audience',true);
SELECT set_config('resonance.evidence_sha256',:'evidence_sha256',true);

INSERT INTO framework_process_qa_run(
  process_code,step_code,result,failure_reason,evidence_json,executed_by,executed_at
)
VALUES (
  :'process_code', :'step_code', 'PASSED', NULL,
  convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb ||
    jsonb_build_object('sha256',:'evidence_sha256','promotionMode','FAIL_CLOSED'),
  'CONTRACT_E2E_PROMOTER', current_timestamp
);

UPDATE framework_professional_screen_contract contract
SET api_verified=true,
    database_verified=true,
    authority_verified=true,
    exception_states_verified=true,
    audit_evidence_ref=concat('qa-run:sha256:',:'evidence_sha256'),
    contract_status='VERIFIED',
    updated_by='CONTRACT_E2E_PROMOTER',
    updated_at=current_timestamp
WHERE contract.process_code=:'process_code'
  AND contract.step_code=:'step_code'
  AND (:'audience'='ALL' OR contract.audience=:'audience')
  AND contract.responsive_verified
  AND contract.accessibility_verified
  AND (contract.contract_status='VERIFIED' OR EXISTS (
    SELECT 1
    FROM framework_step_execution_spec spec
    WHERE spec.process_code=contract.process_code
      AND spec.step_code=contract.step_code
      AND spec.design_status='DESIGN_COMPLETE'
      AND spec.approval_status='APPROVED'
      AND spec.generation_status IN ('READY','GENERATED')
  ));

DO $$
DECLARE total_count integer;
DECLARE verified_count integer;
BEGIN
  SELECT count(*),count(*) FILTER (
    WHERE contract_status='VERIFIED'
      AND api_verified AND database_verified AND authority_verified
      AND responsive_verified AND accessibility_verified AND exception_states_verified
      AND audit_evidence_ref=concat('qa-run:sha256:',current_setting('resonance.evidence_sha256'))
  )
  INTO total_count,verified_count
  FROM framework_professional_screen_contract
  WHERE process_code=current_setting('resonance.process_code')
    AND step_code=current_setting('resonance.step_code')
    AND (current_setting('resonance.audience')='ALL' OR audience=current_setting('resonance.audience'));

  IF total_count=0 OR verified_count<>total_count THEN
    RAISE EXCEPTION 'contract promotion rejected process=% step=% total=% verified=%',
      current_setting('resonance.process_code'),current_setting('resonance.step_code'),
      total_count,verified_count;
  END IF;
END $$;

COMMIT;
SQL

printf '{"status":"PROMOTED","processCode":"%s","stepCode":"%s","audience":"%s","sha256":"%s"}\n' \
  "$PROCESS_CODE" "$STEP_CODE" "$AUDIENCE" "$EVIDENCE_SHA256"
