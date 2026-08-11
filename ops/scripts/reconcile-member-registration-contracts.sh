#!/usr/bin/env bash
set -Eeuo pipefail
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
LOCK="${MEMBER_REGISTRATION_RECONCILE_LOCK:-/tmp/resonance-member-registration-reconcile.lock}"
exec 9>"$LOCK"; flock -n 9 || { echo '{"status":"ALREADY_RUNNING"}'; exit 0; }
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo 'writable PostgreSQL leader not found' >&2; exit 1; }

kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE TEMP TABLE registration_api_map(
 contract_id bigint NOT NULL,old_method text NOT NULL,old_path text NOT NULL,
 new_method text NOT NULL,new_path text NOT NULL,PRIMARY KEY(contract_id,old_method,old_path)
) ON COMMIT DROP;
INSERT INTO registration_api_map VALUES
 (84446,'GET','/admin/member/api/list','GET','/admin/api/admin/member/list/page'),
 (84448,'GET','/admin/system/consent-history/api','GET','/admin/system/consent-history/page-data'),
 (84450,'GET','/admin/member/api/list','GET','/admin/api/admin/member/list/page'),
 (84452,'GET','/admin/member/api/approve','GET','/admin/api/admin/member/approve/page'),
 (84452,'POST','/admin/member/api/approve','POST','/admin/api/admin/member/approve/action'),
 (84454,'GET','/admin/member/api/approve','GET','/admin/api/admin/member/approve/page'),
 (84454,'POST','/admin/member/api/approve','POST','/admin/api/admin/member/approve/action');

DO $$ DECLARE expected int; source_count int; target_count int; callback_count int; BEGIN
 SELECT count(*) INTO expected FROM registration_api_map;
 SELECT count(*) INTO source_count FROM registration_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE split_part(api#>>'{}',' ',1)=m.old_method AND split_part(api#>>'{}',' ',2)=m.old_path;
 SELECT count(*) INTO target_count FROM registration_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE split_part(api#>>'{}',' ',1)=m.new_method AND split_part(api#>>'{}',' ',2)=m.new_path;
 SELECT count(*) INTO callback_count FROM framework_professional_screen_contract c
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE c.contract_id=2966 AND lower(api#>>'{}')='identity provider callback';
 IF source_count+target_count<>expected OR callback_count NOT IN (0,1) THEN
  RAISE EXCEPTION 'registration source guard failed expected=% source=% target=% callback=%',expected,source_count,target_count,callback_count;
 END IF;
END $$;

WITH rebuilt AS (
 SELECT c.contract_id,jsonb_agg(
   CASE WHEN m.contract_id IS NULL THEN api ELSE to_jsonb(m.new_method||' '||m.new_path) END ORDER BY ord) corrected
 FROM framework_professional_screen_contract c
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) WITH ORDINALITY e(api,ord)
 LEFT JOIN registration_api_map m ON m.contract_id=c.contract_id
  AND split_part(api#>>'{}',' ',1)=m.old_method AND split_part(api#>>'{}',' ',2)=m.old_path
 WHERE c.contract_id IN (SELECT contract_id FROM registration_api_map)
 GROUP BY c.contract_id
), callback_removed AS (
 SELECT c.contract_id,coalesce(jsonb_agg(api ORDER BY ord) FILTER (WHERE lower(api#>>'{}')<>'identity provider callback'),'[]'::jsonb) corrected
 FROM framework_professional_screen_contract c
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) WITH ORDINALITY e(api,ord)
 WHERE c.contract_id=2966 GROUP BY c.contract_id
), corrected AS (
 SELECT * FROM rebuilt UNION ALL SELECT * FROM callback_removed
)
UPDATE framework_professional_screen_contract c
SET api_contract=x.corrected::text,contract_revision=c.contract_revision+1,
 updated_by='MEMBER_REGISTRATION_RECONCILER',updated_at=current_timestamp
FROM corrected x WHERE x.contract_id=c.contract_id AND c.api_contract::jsonb IS DISTINCT FROM x.corrected;

DO $$ DECLARE expected int; good int; invalid int; BEGIN
 SELECT count(*) INTO expected FROM registration_api_map;
 SELECT count(*) INTO good FROM registration_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE split_part(api#>>'{}',' ',1)=m.new_method AND split_part(api#>>'{}',' ',2)=m.new_path;
 SELECT count(*) INTO invalid FROM framework_professional_screen_contract c
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE c.contract_id=2966 AND lower(api#>>'{}')='identity provider callback';
 IF good<>expected OR invalid<>0 THEN RAISE EXCEPTION 'registration target guard failed expected=% good=% invalid=%',expected,good,invalid; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"RECONCILED","contracts":6,"apiUsages":7,"eventPseudoApisRemoved":1}\n'
