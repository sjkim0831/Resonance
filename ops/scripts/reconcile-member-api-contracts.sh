#!/usr/bin/env bash
set -Eeuo pipefail
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
LOCK="${MEMBER_API_RECONCILE_LOCK:-/tmp/resonance-member-api-reconcile.lock}"
exec 9>"$LOCK"; flock -n 9 || { echo '{"status":"ALREADY_RUNNING"}'; exit 0; }
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo 'writable PostgreSQL leader not found' >&2; exit 1; }

kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE TEMP TABLE member_api_reconcile_map(
 contract_id bigint NOT NULL, old_method text NOT NULL, old_path text NOT NULL,
 new_method text NOT NULL, new_path text NOT NULL, PRIMARY KEY(contract_id,old_method,old_path)
) ON COMMIT DROP;
INSERT INTO member_api_reconcile_map VALUES
 (3018,'POST','/api/public/account-recovery/requests','POST','/signin/account-recovery/requests'),
 (3019,'POST','/api/public/account-recovery/requests','POST','/signin/account-recovery/requests'),
 (26248,'GET','/api/auth/groups','GET','/api/auth/roles'),
 (26248,'POST','/api/auth/groups','POST','/api/auth/roles'),
 (26290,'GET','/api/members/admin-accounts','GET','/admin/api/admin/member/admin-account/page'),
 (26290,'POST','/api/members/admin-accounts','POST','/admin/api/admin/member/admin-account'),
 (26292,'GET','/api/members/admin-list','GET','/admin/api/admin/member/admin-list/page'),
 (26294,'GET','/api/members/company-accounts','GET','/admin/api/admin/member/company-account/page'),
 (26295,'POST','/api/members/register','POST','/admin/api/admin/member/register'),
 (26296,'GET','/api/members/stats','GET','/admin/member/stats/page-data'),
 (26306,'GET','/api/system/authorities','GET','/api/auth/roles');

DO $$ DECLARE expected integer; found integer; BEGIN
 SELECT count(*) INTO expected FROM member_api_reconcile_map;
 SELECT count(*) INTO found
 FROM member_api_reconcile_map m
 JOIN framework_professional_screen_contract c ON c.contract_id=m.contract_id
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'method'=m.old_method AND api->>'path'=m.old_path;
 IF found<>expected THEN RAISE EXCEPTION 'member API source contract guard failed expected=% found=%',expected,found; END IF;
END $$;

WITH rebuilt AS (
 SELECT c.contract_id,
        jsonb_agg(CASE WHEN m.contract_id IS NULL THEN api
          ELSE jsonb_set(jsonb_set(api,'{method}',to_jsonb(m.new_method),false),'{path}',to_jsonb(m.new_path),false)
        END ORDER BY ord) corrected
 FROM framework_professional_screen_contract c
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) WITH ORDINALITY e(api,ord)
 LEFT JOIN member_api_reconcile_map m ON m.contract_id=c.contract_id
  AND api->>'method'=m.old_method AND api->>'path'=m.old_path
 WHERE c.contract_id IN (SELECT contract_id FROM member_api_reconcile_map)
 GROUP BY c.contract_id
)
UPDATE framework_professional_screen_contract c
SET api_contract=r.corrected::text,contract_revision=c.contract_revision+1,
    updated_by='MEMBER_API_RECONCILER',updated_at=current_timestamp
FROM rebuilt r WHERE r.contract_id=c.contract_id AND c.api_contract::jsonb IS DISTINCT FROM r.corrected;

DO $$ DECLARE expected integer; good integer; old_left integer; BEGIN
 SELECT count(*) INTO expected FROM member_api_reconcile_map;
 SELECT count(*) INTO good FROM member_api_reconcile_map m
 JOIN framework_professional_screen_contract c ON c.contract_id=m.contract_id
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'method'=m.new_method AND api->>'path'=m.new_path;
 SELECT count(*) INTO old_left FROM member_api_reconcile_map m
 JOIN framework_professional_screen_contract c ON c.contract_id=m.contract_id
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'method'=m.old_method AND api->>'path'=m.old_path
   AND (m.old_method,m.old_path) IS DISTINCT FROM (m.new_method,m.new_path);
 IF good<>expected OR old_left<>0 THEN RAISE EXCEPTION 'member API target guard failed expected=% good=% old=%',expected,good,old_left; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"RECONCILED","contracts":9,"apiUsages":11}\n'
