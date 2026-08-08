#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NS="${K8S_NAMESPACE:-carbonet-prod}"
EVIDENCE="$(cat)"
jq -e '.status=="PASS" and .processCode=="MEMBER_APPROVAL" and .happy==1 and .auth==1 and .exception==1 and .isolation==1 and .recovery==1 and .database==1 and .audit==1 and .cleanup==1 and (.outcomes|length)==2 and ([.outcomes[].responsive]|all(.==1)) and ([.outcomes[].accessible]|all(.==1))' <<<"$EVIDENCE" >/dev/null
POD="${PATRONI_POD:-}"
if [[ -z "$POD" ]]; then
  while read -r p; do [[ "$(kubectl -n "$NS" exec "$p" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && { POD="$p"; break; }; done < <(kubectl -n "$NS" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
fi
[[ -n "$POD" ]] || exit 2
SHA="$(printf '%s' "$EVIDENCE" | sha256sum | awk '{print $1}')"
SOURCE="$(kubectl -n "$NS" get deploy carbonet-runtime -o jsonpath='{.metadata.annotations.resonance\.ai/target-commit}')"
[[ "$SOURCE" =~ ^[0-9a-f]{40}$ ]] || { echo "runtime source identity missing" >&2; exit 3; }
kubectl -n "$NS" exec -i "$POD" -c patroni -- psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q -o /dev/null -v source="$SOURCE" -v sha="$SHA" <<'SQL'
BEGIN;
UPDATE framework_simulation_case SET case_status='APPROVED',automated=true,expected_duration_minutes=1,
 required_evidence='AUTHENTICATED_BROWSER,APPROVE,REJECT_REASON,DATABASE_REREAD,AUDIT,RESPONSIVE,ACCESSIBILITY,CLEANUP',updated_at=current_timestamp
WHERE process_code='MEMBER_APPROVAL' AND case_code IN ('MEMBER_APPROVAL_AUTH','MEMBER_APPROVAL_EXCEPTION','MEMBER_APPROVAL_HAPPY','MEMBER_APPROVAL_ISOLATION','MEMBER_APPROVAL_RECOVERY');
INSERT INTO framework_simulation_run(case_code,process_version,result,failure_reason,evidence_json,executed_by,source_commit,execution_environment,evidence_hash)
SELECT c.case_code,p.process_version,'PASSED',NULL,
 jsonb_build_object('evidenceSha256',:'sha','evidenceType','MEMBER_APPROVAL_BUSINESS_E2E','approve',true,'rejectWithReason',true,'databaseReread',true,'audit',true,'viewports',2)::text,
 'MEMBER_APPROVAL_E2E_PROMOTER',:'source','carbonet-prod',md5(c.case_code||':'||:'sha')
FROM framework_simulation_case c JOIN framework_process_definition p ON p.process_code=c.process_code
WHERE c.process_code='MEMBER_APPROVAL' AND c.case_status='APPROVED'
 AND c.case_code IN ('MEMBER_APPROVAL_AUTH','MEMBER_APPROVAL_EXCEPTION','MEMBER_APPROVAL_HAPPY','MEMBER_APPROVAL_ISOLATION','MEMBER_APPROVAL_RECOVERY')
 AND NOT EXISTS(SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED' AND r.source_commit=:'source' AND r.evidence_hash=md5(c.case_code||':'||:'sha'));
DO $$ DECLARE a int; r int; BEGIN
 SELECT count(*) INTO a FROM framework_simulation_case WHERE process_code='MEMBER_APPROVAL' AND case_status='APPROVED';
 SELECT count(*) INTO r FROM framework_simulation_case c WHERE c.process_code='MEMBER_APPROVAL' AND EXISTS(SELECT 1 FROM framework_simulation_run x WHERE x.case_code=c.case_code AND x.result='PASSED');
 IF a<>5 OR r<>5 THEN RAISE EXCEPTION 'member approval evidence mismatch approved=% passed=%',a,r; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"PROMOTED","processCode":"MEMBER_APPROVAL","cases":5,"evidenceSha256":"%s"}\n' "$SHA"
