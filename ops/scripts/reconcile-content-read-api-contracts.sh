#!/usr/bin/env bash
set -Eeuo pipefail
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
LOCK="${CONTENT_READ_RECONCILE_LOCK:-/tmp/resonance-content-read-reconcile.lock}"
exec 9>"$LOCK"; flock -n 9 || { echo '{"status":"ALREADY_RUNNING"}'; exit 0; }
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || exit 1
kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE TEMP TABLE content_read_map(contract_id bigint,description text,old_path text,new_path text,PRIMARY KEY(contract_id,description)) ON COMMIT DROP;
INSERT INTO content_read_map VALUES
 (26259,'메뉴 목록','/api/content/menus','/admin/system/admin/content/menu/page-data'),
 (26262,'게시글 목록 조회','/api/content/posts','/admin/api/admin/content/board/list'),
 (26265,'태그 목록','/api/content/tags','/admin/api/admin/content/tag');
DO $$ DECLARE expected int; source_count int; target_count int; BEGIN
 SELECT count(*) INTO expected FROM content_read_map;
 SELECT count(*) INTO source_count FROM content_read_map m JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'='GET' AND api->>'path'=m.old_path;
 SELECT count(*) INTO target_count FROM content_read_map m JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'='GET' AND api->>'path'=m.new_path;
 IF source_count+target_count<>expected THEN RAISE EXCEPTION 'content read guard failed expected=% source=% target=%',expected,source_count,target_count; END IF;
END $$;
WITH rebuilt AS (
 SELECT c.contract_id,jsonb_agg(CASE WHEN m.contract_id IS NULL THEN api
   ELSE jsonb_set(api,'{path}',to_jsonb(m.new_path),false) END ORDER BY ord) corrected
 FROM framework_professional_screen_contract c
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) WITH ORDINALITY e(api,ord)
 LEFT JOIN content_read_map m ON m.contract_id=c.contract_id AND api->>'desc'=m.description
  AND api->>'method'='GET' AND api->>'path'=m.old_path
 WHERE c.contract_id IN (SELECT contract_id FROM content_read_map) GROUP BY c.contract_id
)
UPDATE framework_professional_screen_contract c SET api_contract=r.corrected::text,
 contract_revision=c.contract_revision+1,updated_by='CONTENT_READ_RECONCILER',updated_at=current_timestamp
FROM rebuilt r WHERE r.contract_id=c.contract_id AND c.api_contract::jsonb IS DISTINCT FROM r.corrected;
DO $$ DECLARE good int; old_left int; BEGIN
 SELECT count(*) INTO good FROM content_read_map m JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'='GET' AND api->>'path'=m.new_path;
 SELECT count(*) INTO old_left FROM content_read_map m JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'='GET' AND api->>'path'=m.old_path;
 IF good<>3 OR old_left<>0 THEN RAISE EXCEPTION 'content read target guard failed good=% old=%',good,old_left; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"RECONCILED","contracts":3,"apiUsages":3}\n'
