#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
LOCK="${CORE_LINEAGE_RECONCILE_LOCK:-/tmp/resonance-core-lineage-reconcile.lock}"
exec 9>"$LOCK"; flock -n 9 || { echo '{"status":"ALREADY_RUNNING"}'; exit 0; }

leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo 'writable PostgreSQL leader not found' >&2; exit 1; }

kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE TEMP TABLE required_lineage_field(
  process_code text, step_code text, audience text, field_code text,
  PRIMARY KEY(process_code,step_code,audience,field_code)
) ON COMMIT DROP;
INSERT INTO required_lineage_field VALUES
('EMISSION_CALCULATION','EMISSION_CALCULATION_03_VERIFY','USER','recordId'),
('EMISSION_CALCULATION','EMISSION_CALCULATION_03_VERIFY','USER','rowVersion'),
('EMISSION_PROJECT','EMISSION_PROJECT_VALIDATE','USER','recordId'),
('EMISSION_PROJECT','EMISSION_PROJECT_VALIDATE','USER','rowVersion'),
('EMISSION_PROJECT','EMISSION_PROJECT_APPROVE','USER','recordId'),
('EMISSION_PROJECT','EMISSION_PROJECT_APPROVE','USER','rowVersion'),
('CERTIFICATE_ISSUANCE','CERTIFICATE_ISSUANCE_02_WORK','ADMIN','recordId'),
('CERTIFICATE_ISSUANCE','CERTIFICATE_ISSUANCE_02_WORK','ADMIN','rowVersion'),
('CUSTOMER_WORK_COORDINATION','CUSTOMER_WORK_DISCOVER','USER','tenantId'),
('CUSTOMER_WORK_COORDINATION','CUSTOMER_WORK_DISCOVER','USER','projectId'),
('CUSTOMER_WORK_COORDINATION','CUSTOMER_WORK_DISCOVER','USER','recordId'),
('CUSTOMER_WORK_COORDINATION','CUSTOMER_WORK_DISCOVER','USER','rowVersion'),
('CUSTOMER_WORK_COORDINATION','CUSTOMER_WORK_APPROVE','USER','tenantId'),
('CUSTOMER_WORK_COORDINATION','CUSTOMER_WORK_APPROVE','USER','projectId'),
('CUSTOMER_WORK_COORDINATION','CUSTOMER_WORK_APPROVE','USER','recordId'),
('CUSTOMER_WORK_COORDINATION','CUSTOMER_WORK_APPROVE','USER','rowVersion');

-- Once a process uses a core identity field, every step carries it. This prevents
-- fixing one transition from merely moving the lineage gap to an earlier step.
INSERT INTO required_lineage_field(process_code,step_code,audience,field_code)
SELECT DISTINCT step_contract.process_code,step_contract.step_code,step_contract.audience,used.field_code
FROM framework_professional_screen_contract step_contract
JOIN (
  SELECT DISTINCT c.process_code,c.audience,f->>'fieldCode' field_code
  FROM framework_professional_screen_contract c
  CROSS JOIN LATERAL jsonb_array_elements(c.field_contract::jsonb) f
  WHERE lower(f->>'fieldCode') IN ('tenantid','projectid','recordid','rowversion')
) used USING(process_code,audience)
ON CONFLICT DO NOTHING;

WITH targets AS (
  SELECT c.contract_id,c.route_path,c.audience,c.field_contract::jsonb fields,
         coalesce(c.field_contract::jsonb->0->>'pageCode',c.process_code||'_'||c.step_code||'_'||c.audience) page_code,
         coalesce(c.field_contract::jsonb->0->>'permissionCode',c.actor_code||':'||c.audience) permission_code,
         r.field_code
  FROM framework_professional_screen_contract c JOIN required_lineage_field r USING(process_code,step_code,audience)
), additions AS (
  SELECT contract_id,jsonb_agg(jsonb_build_object(
    'route',route_path,'audience',audience,'pageCode',page_code,
    'fieldCode',field_code,'fieldName',CASE field_code WHEN 'tenantId' THEN '테넌트' WHEN 'projectId' THEN '프로젝트' WHEN 'recordId' THEN '업무 레코드 ID' ELSE '데이터 버전' END,
    'fieldGroup','공통','fieldOrder',CASE field_code WHEN 'tenantId' THEN 910 WHEN 'projectId' THEN 920 WHEN 'recordId' THEN 930 ELSE 940 END,
    'dataType',CASE field_code WHEN 'recordId' THEN 'UUID' WHEN 'rowVersion' THEN 'INTEGER' ELSE 'STRING' END,
    'required',field_code IN ('tenantId','projectId','rowVersion'),'editable',false,
    'apiProperty',field_code,'controlType','HIDDEN','sourceTable',NULL,'sourceColumn',NULL,
    'privacyClass','INTERNAL','mappingStatus',CASE WHEN field_code='tenantId' THEN 'CONTEXT' ELSE 'LOGICAL_CONTRACT' END,
    'permissionCode',permission_code,'evidenceRequired',false,
    'validation',CASE field_code WHEN 'rowVersion' THEN '{"min":0}'::jsonb WHEN 'recordId' THEN '{"source":"SERVER_CONTEXT","required":false,"immutable":true}'::jsonb ELSE '{"minLength":1}'::jsonb END
  ) ORDER BY field_code) missing_fields
  FROM targets t
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE lower(f->>'fieldCode')=lower(t.field_code))
  GROUP BY contract_id
)
UPDATE framework_professional_screen_contract c
SET field_contract=(c.field_contract::jsonb||a.missing_fields)::text,
    contract_revision=c.contract_revision+1,updated_by='CORE_LINEAGE_RECONCILER',updated_at=current_timestamp
FROM additions a WHERE a.contract_id=c.contract_id;

DO $$ DECLARE missing_count integer; target_count integer; BEGIN
  SELECT count(*) INTO target_count FROM required_lineage_field;
  IF target_count<16 THEN RAISE EXCEPTION 'unexpected required lineage target count %',target_count; END IF;
  SELECT count(*) INTO missing_count
  FROM framework_professional_screen_contract c JOIN required_lineage_field r USING(process_code,step_code,audience)
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.field_contract::jsonb) f WHERE lower(f->>'fieldCode')=lower(r.field_code));
  IF missing_count<>0 THEN RAISE EXCEPTION 'core lineage reconciliation incomplete missing=%',missing_count; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"RECONCILED","coreLineageMinimumFields":16,"strategy":"PROCESS_WIDE_CARRY_FORWARD"}\n'
