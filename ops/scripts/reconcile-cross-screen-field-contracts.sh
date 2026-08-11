#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
LOCK="${FIELD_CONTRACT_RECONCILE_LOCK:-/tmp/resonance-field-contract-reconcile.lock}"
exec 9>"$LOCK"; flock -n 9 || { echo '{"status":"ALREADY_RUNNING"}'; exit 0; }

leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo 'writable PostgreSQL leader not found' >&2; exit 1; }

kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

WITH rewritten AS (
  SELECT c.contract_id,
         jsonb_agg(
           CASE
             WHEN lower(f->>'sourceTable')='emission_project_report'
              AND lower(f->>'sourceColumn')='report_id'
             THEN jsonb_set(f,'{dataType}','"LONG"'::jsonb,true)
             WHEN c.contract_id IN (738,739)
              AND f->>'fieldCode' IN ('page','size','summaryCount','total')
             THEN f - 'sourceTable' - 'sourceColumn' - 'mappingStatus'
             WHEN c.contract_id=84453 AND f->>'fieldCode'='nextAction'
             THEN f - 'sourceTable' - 'sourceColumn' - 'mappingStatus'
             WHEN c.contract_id=239 AND f->>'fieldCode' IN ('requiredInputs','expectedOutput')
             THEN f - 'sourceTable' - 'sourceColumn' - 'mappingStatus'
             ELSE f
           END ORDER BY ord
         ) AS fields
  FROM framework_professional_screen_contract c
  CROSS JOIN LATERAL jsonb_array_elements(c.field_contract::jsonb) WITH ORDINALITY e(f,ord)
  GROUP BY c.contract_id
)
UPDATE framework_professional_screen_contract c
SET field_contract=r.fields::text,
    contract_revision=c.contract_revision+1,
    updated_by='FIELD_CONTRACT_RECONCILER',
    updated_at=current_timestamp
FROM rewritten r
WHERE r.contract_id=c.contract_id
  AND c.field_contract::jsonb IS DISTINCT FROM r.fields;

DO $$
DECLARE report_total integer; report_bad integer; portfolio_fields integer; portfolio_bad integer;
        next_fields integer; next_bad integer; derived_fields integer; derived_bad integer;
BEGIN
  SELECT count(*),count(*) FILTER (WHERE upper(f->>'dataType')<>'LONG')
    INTO report_total,report_bad
  FROM framework_professional_screen_contract c
  CROSS JOIN LATERAL jsonb_array_elements(c.field_contract::jsonb) f
  WHERE lower(f->>'sourceTable')='emission_project_report' AND lower(f->>'sourceColumn')='report_id';
  IF report_total=0 OR report_bad<>0 THEN RAISE EXCEPTION 'report_id contract reconciliation failed total=% bad=%',report_total,report_bad; END IF;

  SELECT count(*),count(*) FILTER (WHERE f ? 'sourceTable' OR f ? 'sourceColumn')
    INTO portfolio_fields,portfolio_bad
  FROM framework_professional_screen_contract c CROSS JOIN LATERAL jsonb_array_elements(c.field_contract::jsonb) f
  WHERE c.contract_id IN (738,739) AND f->>'fieldCode' IN ('page','size','summaryCount','total');
  IF portfolio_fields<>8 OR portfolio_bad<>0 THEN RAISE EXCEPTION 'portfolio derived mapping reconciliation failed total=% bad=%',portfolio_fields,portfolio_bad; END IF;

  SELECT count(*),count(*) FILTER (WHERE f ? 'sourceTable' OR f ? 'sourceColumn')
    INTO next_fields,next_bad
  FROM framework_professional_screen_contract c CROSS JOIN LATERAL jsonb_array_elements(c.field_contract::jsonb) f
  WHERE c.contract_id=84453 AND f->>'fieldCode'='nextAction';
  IF next_fields<>1 OR next_bad<>0 THEN RAISE EXCEPTION 'nextAction mapping reconciliation failed total=% bad=%',next_fields,next_bad; END IF;

  SELECT count(*),count(*) FILTER (WHERE f ? 'sourceTable' OR f ? 'sourceColumn')
    INTO derived_fields,derived_bad
  FROM framework_professional_screen_contract c CROSS JOIN LATERAL jsonb_array_elements(c.field_contract::jsonb) f
  WHERE c.contract_id=239 AND f->>'fieldCode' IN ('requiredInputs','expectedOutput');
  IF derived_fields<>2 OR derived_bad<>0 THEN RAISE EXCEPTION 'derived work fields reconciliation failed total=% bad=%',derived_fields,derived_bad; END IF;
END $$;
COMMIT;
SQL

printf '{"status":"RECONCILED","reportIdType":"LONG","portfolioDerivedFields":8,"nextActionFields":1,"workDerivedFields":2}\n'
