#!/usr/bin/env bash
set -Eeuo pipefail

NS="${K8S_NAMESPACE:-carbonet-prod}"
MODE="${1:-}"
EVIDENCE="$(cat)"
CASES=(
  COMPANY_ONBOARDING_HAPPY
  COMPANY_ONBOARDING_NO_COMPANY
  COMPANY_ONBOARDING_NO_SITE
  COMPANY_ONBOARDING_RETRY
  COMPANY_ONBOARDING_ROLE_GAP
  COMPANY_ONBOARDING_SOD
  COMPANY_ONBOARDING_TENANT
)

jq -e '
  .status=="PASS" and .promotionEligible==true and .processCode=="COMPANY_ONBOARDING" and
  .stepCount==5 and .caseCount==7 and .cleanup==1 and .api==1 and .database==1 and
  .authority==1 and .responsive==1 and .accessibility==1 and .exceptionStates==1 and
  .audit==1 and .recovery==1 and .desktop==1 and .mobile==1 and
  (.routes|length)==20 and .performanceSampleCount>=20 and
  .performanceP95Ms>0 and .performanceP95Ms<=500 and
  ([.steps[]?.result]|length)==5 and ([.steps[]?.result]|all(.=="PASSED")) and
  ([.cases[]?.result]|length)==7 and ([.cases[]?.result]|all(.=="PASSED")) and
  (.sourceCommit|test("^[0-9a-f]{40}$")) and
  (.validationCommit|test("^[0-9a-f]{40}$"))
' <<<"$EVIDENCE" >/dev/null

for case_code in "${CASES[@]}"; do
  jq -e --arg code "$case_code" '.cases[$code].result=="PASSED"' <<<"$EVIDENCE" >/dev/null
done
[[ "$MODE" == "--validate-only" ]] && { printf '{"status":"VALID","processCode":"COMPANY_ONBOARDING","cases":7}\n'; exit 0; }

SOURCE="$(jq -r '.sourceCommit' <<<"$EVIDENCE")"
VALIDATION="$(jq -r '.validationCommit' <<<"$EVIDENCE")"
DEPLOYED="$(kubectl -n "$NS" get deploy carbonet-runtime -o jsonpath='{.metadata.annotations.resonance\.ai/target-commit}')"
[[ "$SOURCE" == "$DEPLOYED" && "$VALIDATION" == "$DEPLOYED" ]] || { echo 'onboarding evidence is not from the deployed commit' >&2; exit 3; }

POD="${PATRONI_POD:-}"
if [[ -z "$POD" ]]; then
  POD="$(K8S_NAMESPACE="$NS" bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/resolve-patroni-primary-pod.sh")"
fi
[[ -n "$POD" ]] || exit 2
SHA="$(printf '%s' "$EVIDENCE" | sha256sum | awk '{print $1}')"
EVIDENCE_B64="$(printf '%s' "$EVIDENCE" | base64 -w0)"

kubectl -n "$NS" exec -i "$POD" -c patroni -- \
  psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q -o /dev/null \
  -v source="$SOURCE" -v sha="$SHA" -v evidence_b64="$EVIDENCE_B64" <<'SQL'
BEGIN;
UPDATE framework_simulation_case
SET case_status='APPROVED', automated=true, expected_duration_minutes=3,
    required_evidence='PUBLIC_APPLICATION,ADMIN_APPROVAL,SITE_REGISTRATION,ACTOR_ASSIGNMENT,PROJECT_CREATION,AUTHORITY,ISOLATION,RECOVERY,RESPONSIVE,ACCESSIBILITY,DATABASE_REREAD,AUDIT,CLEANUP',
    updated_at=current_timestamp
WHERE process_code='COMPANY_ONBOARDING'
  AND case_code IN ('COMPANY_ONBOARDING_HAPPY','COMPANY_ONBOARDING_NO_COMPANY','COMPANY_ONBOARDING_NO_SITE','COMPANY_ONBOARDING_RETRY','COMPANY_ONBOARDING_ROLE_GAP','COMPANY_ONBOARDING_SOD','COMPANY_ONBOARDING_TENANT');

INSERT INTO framework_simulation_run(case_code,process_version,result,failure_reason,evidence_json,executed_by,source_commit,execution_environment,evidence_hash)
SELECT c.case_code,p.process_version,'PASSED',NULL,
  jsonb_build_object(
    'evidenceSha256',:'sha','evidenceType','COMPANY_ONBOARDING_BUSINESS_E2E',
    'steps',5,'cases',7,'responsiveRoutes',20,
    'performanceP95Ms',(convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb->>'performanceP95Ms')::integer,
    'databaseReread',true,'authority',true,'audit',true,'cleanup',true
  )::text,
  'COMPANY_ONBOARDING_E2E_PROMOTER',:'source','carbonet-prod',md5(c.case_code||':'||:'sha')
FROM framework_simulation_case c
JOIN framework_process_definition p ON p.process_code=c.process_code
WHERE c.process_code='COMPANY_ONBOARDING' AND c.case_status='APPROVED'
  AND c.case_code IN ('COMPANY_ONBOARDING_HAPPY','COMPANY_ONBOARDING_NO_COMPANY','COMPANY_ONBOARDING_NO_SITE','COMPANY_ONBOARDING_RETRY','COMPANY_ONBOARDING_ROLE_GAP','COMPANY_ONBOARDING_SOD','COMPANY_ONBOARDING_TENANT')
  AND NOT EXISTS (
    SELECT 1 FROM framework_simulation_run r
    WHERE r.case_code=c.case_code AND r.result='PASSED' AND r.source_commit=:'source'
      AND r.evidence_hash=md5(c.case_code||':'||:'sha')
  );

DO $$
DECLARE approved_count integer; passed_count integer;
BEGIN
  SELECT count(*) INTO approved_count FROM framework_simulation_case
  WHERE process_code='COMPANY_ONBOARDING' AND case_status='APPROVED';
  SELECT count(*) INTO passed_count FROM framework_simulation_case c
  WHERE c.process_code='COMPANY_ONBOARDING'
    AND EXISTS (SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED');
  IF approved_count<>7 OR passed_count<>7 THEN
    RAISE EXCEPTION 'company onboarding evidence mismatch approved=% passed=%',approved_count,passed_count;
  END IF;
END $$;
COMMIT;
SQL

printf '{"status":"PROMOTED","processCode":"COMPANY_ONBOARDING","cases":7,"evidenceSha256":"%s"}\n' "$SHA"
