#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NS="${K8S_NAMESPACE:-carbonet-prod}"
MODE="${1:-}"
EVIDENCE="$(cat)"
CASES=(COMPANY_MANAGER_DELEGATION_AUTHORITY COMPANY_MANAGER_DELEGATION_EXCEPTION COMPANY_MANAGER_DELEGATION_HAPPY COMPANY_MANAGER_DELEGATION_ISOLATION COMPANY_MANAGER_DELEGATION_RECOVERY)
jq -e '.status=="PASS" and .promotionEligible==true and .processCode=="COMPANY_MANAGER_DELEGATION" and .stepCount==3 and .caseCount==5 and .cleanup==1 and .request==1 and .idempotency==1 and .authorityDenial==1 and .approval==1 and .atomicHandover==1 and .successorVisible==1 and .projectCleanup==1 and ([.steps[]?.result]|length)==3 and ([.steps[]?.result]|all(.=="PASSED")) and ([.cases[]?.result]|length)==5 and ([.cases[]?.result]|all(.=="PASSED")) and (.sourceCommit|test("^[0-9a-f]{40}$"))' <<<"$EVIDENCE" >/dev/null
for code in "${CASES[@]}"; do jq -e --arg code "$code" '.cases[$code].result=="PASSED"' <<<"$EVIDENCE" >/dev/null; done
[[ "$MODE" == "--validate-only" ]] && { printf '{"status":"VALID","processCode":"COMPANY_MANAGER_DELEGATION","cases":5}\n'; exit 0; }
SOURCE="$(jq -r '.sourceCommit' <<<"$EVIDENCE")"
DEPLOYED="$(kubectl -n "$NS" get deploy carbonet-runtime -o jsonpath='{.metadata.annotations.resonance\.ai/target-commit}')"
[[ "$SOURCE" == "$DEPLOYED" ]] || { echo 'delegation evidence is not from deployed commit' >&2; exit 3; }
POD="${PATRONI_POD:-$(K8S_NAMESPACE="$NS" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")}"; [[ -n "$POD" ]]
SHA="$(printf '%s' "$EVIDENCE" | sha256sum | awk '{print $1}')"
kubectl -n "$NS" exec -i "$POD" -c patroni -- psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q -o /dev/null -v source="$SOURCE" -v sha="$SHA" <<'SQL'
BEGIN;
INSERT INTO framework_simulation_run(case_code,process_version,result,failure_reason,evidence_json,executed_by,source_commit,execution_environment,evidence_hash)
SELECT c.case_code,p.process_version,'PASSED',NULL,jsonb_build_object('evidenceSha256',:'sha','evidenceType','COMPANY_MANAGER_DELEGATION_BUSINESS_E2E','steps',3,'cases',5,'authority',true,'idempotency',true,'atomicHandover',true,'cleanup',true)::text,'COMPANY_MANAGER_DELEGATION_E2E_PROMOTER',:'source','carbonet-prod',md5(c.case_code||':'||:'sha')
FROM framework_simulation_case c JOIN framework_process_definition p ON p.process_code=c.process_code
WHERE c.process_code='COMPANY_MANAGER_DELEGATION' AND c.case_status='APPROVED' AND c.automated=true
AND NOT EXISTS(SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED' AND r.source_commit=:'source' AND r.evidence_hash=md5(c.case_code||':'||:'sha'));
DO $$ DECLARE approved integer; passed integer; BEGIN
 SELECT count(*) INTO approved FROM framework_simulation_case WHERE process_code='COMPANY_MANAGER_DELEGATION' AND case_status='APPROVED' AND automated=true;
 SELECT count(*) INTO passed FROM framework_simulation_case c WHERE c.process_code='COMPANY_MANAGER_DELEGATION' AND EXISTS(SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED');
 IF approved<>5 OR passed<>5 THEN RAISE EXCEPTION 'delegation evidence mismatch approved=% passed=%',approved,passed; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"PROMOTED","processCode":"COMPANY_MANAGER_DELEGATION","cases":5,"evidenceSha256":"%s"}\n' "$SHA"
