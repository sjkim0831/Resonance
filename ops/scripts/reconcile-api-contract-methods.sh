#!/usr/bin/env bash
set -Eeuo pipefail
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
LOCK="${API_METHOD_RECONCILE_LOCK:-/tmp/resonance-api-method-reconcile.lock}"
exec 9>"$LOCK"; flock -n 9 || { echo '{"status":"ALREADY_RUNNING"}'; exit 0; }
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo 'writable PostgreSQL leader not found' >&2; exit 1; }

kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
WITH target AS (
 SELECT contract_id,jsonb_agg(
   CASE WHEN api->>'method'='GET' AND api->>'path'='/join/api/company-reapply/page'
        THEN jsonb_set(api,'{method}','"POST"'::jsonb,false) ELSE api END ORDER BY ord) corrected
 FROM framework_professional_screen_contract c
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) WITH ORDINALITY e(api,ord)
 WHERE c.contract_id=263904 AND c.process_code='COMPANY_REAPPLICATION_PUBLIC'
   AND c.step_code='COMPANY_REAPPLICATION_PUBLIC_RESUBMIT' AND c.audience='PUBLIC'
 GROUP BY contract_id
)
UPDATE framework_professional_screen_contract c SET api_contract=t.corrected::text,
 contract_revision=c.contract_revision+1,updated_by='API_METHOD_RECONCILER',updated_at=current_timestamp
FROM target t WHERE t.contract_id=c.contract_id AND c.api_contract::jsonb IS DISTINCT FROM t.corrected;

DO $$ DECLARE good integer; bad integer; BEGIN
 SELECT count(*) FILTER (WHERE api->>'method'='POST'),count(*) FILTER (WHERE api->>'method'<>'POST') INTO good,bad
 FROM framework_professional_screen_contract c CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE c.contract_id=263904 AND api->>'path'='/join/api/company-reapply/page';
 IF good<>1 OR bad<>0 THEN RAISE EXCEPTION 'company reapplication lookup method reconciliation failed good=% bad=%',good,bad; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"RECONCILED","contractId":263904,"path":"/join/api/company-reapply/page","method":"POST"}\n'
