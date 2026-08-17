#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NS="${K8S_NAMESPACE:-carbonet-prod}"
MODE="${1:-}"
EVIDENCE="$(cat)"
CASES=(COMPANY_MANAGER_DELEGATION_AUTHORITY COMPANY_MANAGER_DELEGATION_EXCEPTION COMPANY_MANAGER_DELEGATION_HAPPY COMPANY_MANAGER_DELEGATION_ISOLATION COMPANY_MANAGER_DELEGATION_RECOVERY)
jq -e '.sourceCommit as $source
  | .status=="PASS" and .promotionEligible==true and .processCode=="COMPANY_MANAGER_DELEGATION"
  and .stepCount==3 and .caseCount==5 and .cleanup==1 and .request==1 and .idempotency==1
  and .authorityDenial==1 and .approval==1 and .atomicHandover==1 and .successorVisible==1 and .projectCleanup==1
  and ([.steps[]?.result]|length)==3 and ([.steps[]?.result]|all(.=="PASSED"))
  and ([.cases[]?.result]|length)==5 and ([.cases[]?.result]|all(.=="PASSED"))
  and ($source|test("^[0-9a-f]{40}$")) and (.contracts|length)==3
  and all(.contracts[];.sourceCommit==$source)
  and ([.contracts[].runtimeIdentityHash]|unique|length)==1
  and ([.contracts[].podTemplateSha256]|unique|length)==1
  and all(.contracts[];(.runtimeIdentityHash|test("^[0-9a-f]{64}$"))
    and (.podTemplateSha256|test("^[0-9a-f]{64}$")))' <<<"$EVIDENCE" >/dev/null
for code in "${CASES[@]}"; do jq -e --arg code "$code" '.cases[$code].result=="PASSED"' <<<"$EVIDENCE" >/dev/null; done
[[ "$MODE" == "--validate-only" ]] && { printf '{"status":"VALID","processCode":"COMPANY_MANAGER_DELEGATION","cases":5}\n'; exit 0; }
SOURCE="$(jq -r '.sourceCommit' <<<"$EVIDENCE")"
RUNTIME_IDENTITY_HASH="$(jq -r '.contracts[0].runtimeIdentityHash' <<<"$EVIDENCE")"
POD_TEMPLATE_SHA256="$(jq -r '.contracts[0].podTemplateSha256' <<<"$EVIDENCE")"
DEPLOYMENT_JSON="$(kubectl -n "$NS" get deploy carbonet-runtime -o json)"
DEPLOYED="$(jq -r '.metadata.annotations["resonance.ai/target-commit"] // empty' <<<"$DEPLOYMENT_JSON")"
LIVE_TEMPLATE_ANNOTATION="$(jq -r '.metadata.annotations["resonance.ai/runtime-template-sha256"] // empty' <<<"$DEPLOYMENT_JSON")"
LIVE_TEMPLATE_SHA256="$(jq -cS '.spec.template' <<<"$DEPLOYMENT_JSON" | sha256sum | awk '{print $1}')"
[[ "$SOURCE" == "$DEPLOYED" && "$POD_TEMPLATE_SHA256" == "$LIVE_TEMPLATE_ANNOTATION" \
   && "$POD_TEMPLATE_SHA256" == "$LIVE_TEMPLATE_SHA256" ]] \
  || { echo 'delegation evidence is not from the exact deployed runtime identity' >&2; exit 3; }
POD="${PATRONI_POD:-$(K8S_NAMESPACE="$NS" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")}"; [[ -n "$POD" ]]
SHA="$(printf '%s' "$EVIDENCE" | sha256sum | awk '{print $1}')"
kubectl -n "$NS" exec -i "$POD" -c patroni -- psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q -o /dev/null \
  -v source="$SOURCE" -v sha="$SHA" -v runtime_identity_hash="$RUNTIME_IDENTITY_HASH" \
  -v pod_template_sha256="$POD_TEMPLATE_SHA256" <<'SQL'
BEGIN;
SELECT set_config('resonance.manager_delegation_source',:'source',true);
SELECT set_config('resonance.manager_delegation_runtime_hash',:'runtime_identity_hash',true);
SELECT release_key FROM framework_runtime_release_state runtime
WHERE release_key='CARBONET_RUNTIME' AND health_status='UP' AND source_commit=:'source'
  AND pod_template_sha256=:'pod_template_sha256'
  AND framework_runtime_release_identity_hash(runtime)=:'runtime_identity_hash'
FOR SHARE;
SELECT 1 / CASE WHEN count(*)=1 THEN 1 ELSE 0 END
FROM framework_runtime_release_state runtime
WHERE release_key='CARBONET_RUNTIME' AND health_status='UP' AND source_commit=:'source'
  AND pod_template_sha256=:'pod_template_sha256'
  AND framework_runtime_release_identity_hash(runtime)=:'runtime_identity_hash';
INSERT INTO framework_simulation_run(case_code,process_version,result,failure_reason,evidence_json,executed_by,source_commit,execution_environment,evidence_hash)
SELECT c.case_code,p.process_version,'PASSED',NULL,jsonb_build_object('evidenceSha256',:'sha','evidenceType','COMPANY_MANAGER_DELEGATION_BUSINESS_E2E','steps',3,'cases',5,'authority',true,'idempotency',true,'atomicHandover',true,'cleanup',true,'runtimeIdentityHash',:'runtime_identity_hash','podTemplateSha256',:'pod_template_sha256')::text,'COMPANY_MANAGER_DELEGATION_E2E_PROMOTER',:'source','carbonet-prod',md5(c.case_code||':'||:'runtime_identity_hash'||':'||:'sha')
FROM framework_simulation_case c JOIN framework_process_definition p ON p.process_code=c.process_code
WHERE c.process_code='COMPANY_MANAGER_DELEGATION' AND c.case_status='APPROVED' AND c.automated=true
AND NOT EXISTS(SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED' AND r.source_commit=:'source' AND r.evidence_json::jsonb->>'runtimeIdentityHash'=:'runtime_identity_hash' AND r.evidence_hash=md5(c.case_code||':'||:'runtime_identity_hash'||':'||:'sha'));
DO $$ DECLARE approved integer; passed integer; BEGIN
 SELECT count(*) INTO approved FROM framework_simulation_case WHERE process_code='COMPANY_MANAGER_DELEGATION' AND case_status='APPROVED' AND automated=true;
 SELECT count(*) INTO passed FROM framework_simulation_case c WHERE c.process_code='COMPANY_MANAGER_DELEGATION' AND EXISTS(SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED' AND r.source_commit=current_setting('resonance.manager_delegation_source',true) AND r.evidence_json::jsonb->>'runtimeIdentityHash'=current_setting('resonance.manager_delegation_runtime_hash',true));
 IF approved<>5 OR passed<>5 THEN RAISE EXCEPTION 'delegation evidence mismatch approved=% passed=%',approved,passed; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"PROMOTED","processCode":"COMPANY_MANAGER_DELEGATION","cases":5,"evidenceSha256":"%s"}\n' "$SHA"
