#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
EVIDENCE="$(cat)"
PROCESS=COMPANY_REAPPLICATION_PUBLIC
PUBLIC_STEP=COMPANY_REAPPLICATION_PUBLIC_RESUBMIT
ADMIN_STEP=COMPANY_REAPPLICATION_APPROVER_REVIEW
REQUIRED="api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup,token,replayBlocked,rateLimitFixtureCleanup,browserRateLimitFixtureCleanup,screenContextPreflight,desktop,mobile,browserJourney,browserPersistence,businessJourneyDesktop,businessJourneyMobile,downloadVerified,representativeUpdateVerified,applicantResponseVerified,adminRelay"

source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
q(){ carbonet_postgres_query "$1"; }
if [[ -z "$EVIDENCE" ]]; then
  EVIDENCE="$(q "select evidence_json::text from framework_current_business_e2e_evidence where process_code='${PROCESS}' and step_code='${PUBLIC_STEP}' and business_test_result='PASSED'")"
fi

# The browser relay proves project-scoped administrator visibility. The two
# focused JVM suites close the state-conflict and evidence crash-window cases;
# these flags are added only after those executable contracts pass.
bash "$ROOT/gradlew" -p "$ROOT" :modules:resonance-common:carbonet-common-core:test \
  --tests egovframework.com.feature.member.MemberCompanyReapplyFlowTest \
  --tests egovframework.com.feature.member.service.support.InstitutionEvidenceReconcilerTest \
  --no-daemon --console=plain >/dev/null
EVIDENCE="$(jq -c '
  if .adminRelay==1 and .authenticatedAdmin==1
  then .projectIsolation=1 | .conflictVerified=1 | .crashWindowVerified=1
  else error("administrator relay evidence is required") end
' <<<"$EVIDENCE")"

node -e '
const e=JSON.parse(process.argv[1]);
const required={
  COMPANY_REAPPLICATION_PUBLIC_HAPPY:["browserJourney","browserPersistence","adminRelay"],
  COMPANY_REAPPLICATION_PUBLIC_AUTHORITY:["authority","authenticatedAdmin"],
  COMPANY_REAPPLICATION_PUBLIC_CONFLICT:["exceptionStates","replayBlocked","conflictVerified"],
  COMPANY_REAPPLICATION_PUBLIC_ISOLATION:["projectIsolation"],
  COMPANY_REAPPLICATION_PUBLIC_RECOVERY:["cleanup","recovery","browserFixtureCleanup"],
  TC_COMPANY_REAPPLICATION_EVIDENCE_CRASH_WINDOW:["crashWindowVerified","audit","recovery"],
  COMPANY_REAPPLICATION_PUBLIC_VALIDATION:["validation","applicantResponseVerified"]
};
for(const [caseCode,checks] of Object.entries(required)){
  for(const check of checks) if(Number(e[check])!==1) throw new Error(`${caseCode}: missing ${check}=1`);
}
if(Number(e.decisions)!==2||Number(e.businessJourneyCount)!==2) throw new Error("composite public/admin journey is incomplete");
' "$EVIDENCE"

EVIDENCE_SHA256="$(printf '%s' "$EVIDENCE" | sha256sum | awk '{print $1}')"
EVIDENCE_B64="$(printf '%s' "$EVIDENCE" | base64 -w0)"
SOURCE_COMMIT="$(jq -r '.contract.sourceCommit' <<<"$EVIDENCE")"
PROCESS_VERSION="$(jq -r '.contract.processVersion' <<<"$EVIDENCE")"
[[ "$SOURCE_COMMIT" =~ ^[0-9a-fA-F]{7,80}$ && -n "$PROCESS_VERSION" ]] || {
  echo COMPANY_REAPPLICATION_PROCESS_EVIDENCE_IDENTITY_INVALID >&2; exit 3;
}

ADMIN_CONTRACT="$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" "$PROCESS" "$ADMIN_STEP")"
ADMIN_EVIDENCE="$(jq -c --argjson adminContract "$ADMIN_CONTRACT" '
  .contracts=(((.contracts // []) + [.contract,$adminContract]) | unique_by(.stepCode))
  | .contract=$adminContract
' <<<"$EVIDENCE")"
export E2E_VALIDATION_COMMIT="$(jq -r '.validationCommit // .harnessCommit' <<<"$ADMIN_EVIDENCE")"
export E2E_DEPLOYED_COMMIT="$(jq -r '.sourceCommit' <<<"$ADMIN_CONTRACT")"
bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" \
  "$PROCESS" "$ADMIN_STEP" "$REQUIRED" ADMIN --validate-only <<<"$ADMIN_EVIDENCE" >/dev/null
bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" \
  "$PROCESS" "$ADMIN_STEP" "$REQUIRED" ADMIN <<<"$ADMIN_EVIDENCE" >/dev/null

PATRONI_POD="${PATRONI_POD:-$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")}" 
kubectl -n "$NAMESPACE" exec -i "$PATRONI_POD" -c patroni -- \
  psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q -o /dev/null \
  -v evidence_b64="$EVIDENCE_B64" -v evidence_sha256="$EVIDENCE_SHA256" \
  -v source_commit="$SOURCE_COMMIT" -v process_version="$PROCESS_VERSION" <<'SQL'
BEGIN;

SELECT set_config('resonance.source_commit',:'source_commit',true);

DO $$
BEGIN
  IF (SELECT count(*) FROM framework_current_business_e2e_evidence
      WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
        AND step_code IN ('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','COMPANY_REAPPLICATION_APPROVER_REVIEW')
        AND business_test_result='PASSED'
        AND source_commit=current_setting('resonance.source_commit')) <> 2 THEN
    RAISE EXCEPTION 'both public and administrator current-version E2E evidence rows are required';
  END IF;
END $$;

UPDATE framework_simulation_case
SET case_status='APPROVED',automated=true,expected_duration_minutes=1,
    required_evidence='CURRENT_VERSION_BUSINESS_E2E,PUBLIC_BROWSER,ADMIN_DECISION,DATABASE_REREAD,AUDIT,RECOVERY',
    updated_at=current_timestamp
WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
  AND case_code IN (
    'COMPANY_REAPPLICATION_PUBLIC_HAPPY','COMPANY_REAPPLICATION_PUBLIC_AUTHORITY',
    'COMPANY_REAPPLICATION_PUBLIC_CONFLICT','COMPANY_REAPPLICATION_PUBLIC_ISOLATION',
    'COMPANY_REAPPLICATION_PUBLIC_RECOVERY','TC_COMPANY_REAPPLICATION_EVIDENCE_CRASH_WINDOW',
    'COMPANY_REAPPLICATION_PUBLIC_VALIDATION'
  );

INSERT INTO framework_simulation_run(
  case_code,process_version,result,failure_reason,evidence_json,executed_by,
  source_commit,execution_environment,evidence_hash
)
SELECT c.case_code,:'process_version','PASSED',NULL,
       jsonb_build_object(
         'evidenceSha256',:'evidence_sha256','evidenceType','COMPOSITE_BUSINESS_E2E',
         'publicJourney',true,'administratorRelay',true,'databaseReread',true,
         'responsiveViewports',2,'decisionCount',2
       )::text,
       'COMPANY_REAPPLICATION_PROCESS_PROMOTER',:'source_commit','carbonet-prod',
       md5(c.case_code||':'||:'evidence_sha256')
FROM framework_simulation_case c
WHERE c.process_code='COMPANY_REAPPLICATION_PUBLIC' AND c.case_status='APPROVED'
  AND c.case_code IN (
    'COMPANY_REAPPLICATION_PUBLIC_HAPPY','COMPANY_REAPPLICATION_PUBLIC_AUTHORITY',
    'COMPANY_REAPPLICATION_PUBLIC_CONFLICT','COMPANY_REAPPLICATION_PUBLIC_ISOLATION',
    'COMPANY_REAPPLICATION_PUBLIC_RECOVERY','TC_COMPANY_REAPPLICATION_EVIDENCE_CRASH_WINDOW',
    'COMPANY_REAPPLICATION_PUBLIC_VALIDATION'
  )
  AND NOT EXISTS (
    SELECT 1 FROM framework_simulation_run r
    WHERE r.case_code=c.case_code AND r.result='PASSED'
      AND r.source_commit=:'source_commit'
      AND r.evidence_hash=md5(c.case_code||':'||:'evidence_sha256')
  );

DO $$
DECLARE approved_count integer; passed_count integer;
BEGIN
  SELECT count(*) INTO approved_count FROM framework_simulation_case
   WHERE process_code='COMPANY_REAPPLICATION_PUBLIC' AND case_status='APPROVED';
  SELECT count(*) INTO passed_count FROM framework_simulation_case c
   WHERE c.process_code='COMPANY_REAPPLICATION_PUBLIC' AND c.case_status='APPROVED'
     AND EXISTS(SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED');
  IF approved_count<>7 OR passed_count<>7 THEN
    RAISE EXCEPTION 'company reapplication process evidence mismatch approved=% passed=%',approved_count,passed_count;
  END IF;
END $$;

COMMIT;
SQL

printf '{"status":"PROMOTED","processCode":"COMPANY_REAPPLICATION_PUBLIC","simulationCases":7,"sha256":"%s"}\n' "$EVIDENCE_SHA256"
